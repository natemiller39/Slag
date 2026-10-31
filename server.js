// Slag online: serves the game page and runs hosted games over WebSockets.
// The server holds every hand, so players only ever see their own cards.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const E = require('./engine.js');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp',
  '.png': 'image/png', '.ico': 'image/x-icon', '.css': 'text/css; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};
const PUBLIC = new Set(['/index.html', '/engine.js', '/README.md']);

// ---------- static files ----------
const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { p = '/'; }
  if (p === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (p === '/') p = '/index.html';
  const allowed = PUBLIC.has(p) || /^\/cards\/[a-z]+_?-?\d*\.webp$/.test(p) || p === '/cards/back.webp';
  if (!allowed) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  fs.readFile(path.join(ROOT, p), (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream',
      'Cache-Control': p.startsWith('/cards/') ? 'public, max-age=86400' : 'no-cache',
    });
    res.end(data);
  });
});

// ---------- rooms ----------
const rooms = new Map();
const BOT_NAMES = ['Ana', 'Ben', 'Cora', 'Dev', 'Edda', 'Finn', 'Gus', 'Hal'];
const GRACE_MS = 12000;      // a dropped player gets this long before a bot plays for them
const REVEAL_MS = 20000;     // the reveal moves on by itself after this long
const IDLE_MS = 30 * 60e3;   // empty rooms are removed after 30 minutes

const token = () => crypto.randomBytes(12).toString('hex');
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = Array.from({ length: 4 }, () => A[crypto.randomInt(A.length)]).join(''); } while (rooms.has(c));
  return c;
}
function cleanName(n) { return String(n || '').replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Player'; }
function uniqueName(room, name) {
  const taken = new Set(room.seats.map(s => s.name.toLowerCase()));
  if (!taken.has(name.toLowerCase()) && name.toLowerCase() !== 'you') return name;
  for (let k = 2; ; k++) { const n = `${name.slice(0, 13)} ${k}`; if (!taken.has(n.toLowerCase())) return n; }
}
const humans = room => room.seats.filter(s => !s.bot);
const isAway = (s, now = Date.now()) => !s.bot && !s.connected && now - (s.goneAt || 0) > GRACE_MS;
const playsForSelf = s => !s.bot && (s.connected || Date.now() - (s.goneAt || 0) <= GRACE_MS);

function send(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function useRules(room) { E.RULES.colorCount = room.settings.colorRule; E.RULES.quench = !!room.settings.quench; }

function createRoom(name) {
  const room = {
    code: newCode(), hostToken: null, seats: [], settings: { colorRule: false, mode: 'deals', quench: false },
    phase: 'lobby', match: null, G: null, plays: [], submitted: [], last: null, picker: -1,
    ready: new Set(), revealAt: 0, dealScores: null, note: null, lastActive: Date.now(),
  };
  room.timer = setInterval(() => tick(room), 2000);
  rooms.set(room.code, room);
  return room;
}
function deleteRoom(room) { clearInterval(room.timer); rooms.delete(room.code); }

function addHuman(room, name, ws) {
  const seat = { token: token(), name: uniqueName(room, cleanName(name)), bot: false, ws, connected: true, goneAt: 0 };
  room.seats.push(seat);
  if (!room.hostToken) room.hostToken = seat.token;
  return seat;
}
function addBot(room) {
  const used = new Set(room.seats.map(s => s.name));
  const name = BOT_NAMES.find(n => !used.has(n)) || uniqueName(room, 'Bot');
  const style = E.STYLES[room.seats.filter(s => s.bot).length % 3];
  room.seats.push({ token: token(), name, bot: true, style, connected: true });
}

// ---------- game flow ----------
function startMatch(room) {
  useRules(room);
  room.match = {
    names: room.seats.map(s => s.name), styles: room.seats.map(s => (s.bot ? s.style : 'human')),
    totals: room.seats.map(() => 0), deals: [], mode: room.settings.mode,
  };
  startDeal(room);
}
function startDeal(room) {
  useRules(room);
  room.G = E.newDeal(room.match.names, Math.random);
  room.dealScores = null;
  room.note = { text: `Deal ${room.match.deals.length + 1}. Pick up to 3 cards that add up to the target.` };
  newRound(room);
}
function newRound(room) {
  const n = room.seats.length;
  room.phase = 'choose';
  room.plays = Array(n).fill(null);
  room.submitted = Array(n).fill(false);
  room.last = null; room.picker = -1; room.ready = new Set();
  autoPlays(room);
  broadcast(room);
}
// Bots, and players who have been gone past the grace period, play automatically.
function autoPlays(room) {
  if (room.phase !== 'choose') return;
  useRules(room);
  const G = room.G;
  room.seats.forEach((s, i) => {
    if (room.submitted[i]) return;
    if (s.bot || isAway(s)) {
      room.plays[i] = E.botMove(G, i, s.bot ? s.style : 'steady', Math.random);
      room.submitted[i] = true;
    }
  });
  if (room.submitted.every(Boolean)) resolve(room);
}
function resolve(room) {
  useRules(room);
  const G = room.G;
  const res = E.resolveRound(G, room.plays);
  room.last = res; room.ready = new Set(); room.revealAt = Date.now(); room.picker = -1;
  room.phase = 'reveal';
  if (!G.over && !res.reflip && res.winner >= 0) {
    const w = room.seats[res.winner];
    if (playsForSelf(w) && G.players[res.winner].hand.some(c => c.value > 0)) room.picker = res.winner;
  }
}
function maybeAdvance(room) {
  if (room.phase !== 'reveal') return;
  const now = Date.now();
  if (room.picker >= 0) {
    if (playsForSelf(room.seats[room.picker])) return; // waiting for them to pick
    room.picker = -1;
  }
  const waiting = room.seats.some((s, i) => !s.bot && s.connected && !room.ready.has(i));
  if (waiting && now - room.revealAt < REVEAL_MS) return;
  useRules(room);
  const G = room.G, res = room.last;
  if (G.over) return endDeal(room);
  if (res.reflip || res.quenched) { room.note = { text: `New target flipped. Make ${G.target.value}.` }; return newRound(room); }
  const w = res.winner;
  const card = E.botTarget(G.players[w].hand, Math.random, E.botCtx(G, w));
  E.setNextTarget(G, w, card);
  if (G.over) return endDeal(room);
  room.note = card ? { who: w, text: `{who} set the next target: ${E.cardLabel(card)}.` } : { who: w, text: '{who} only had negatives, so the target was flipped.' };
  newRound(room);
}
function endDeal(room) {
  const M = room.match, G = room.G;
  const scores = G.players.map(p => E.scoreHand(p.hand));
  scores.forEach((s, i) => { M.totals[i] += s.total; });
  M.deals.push(scores.map(s => s.total));
  const done = M.mode === 'deals' ? M.deals.length >= 3 : M.totals.some(t => t >= 50);
  room.dealScores = scores;
  room.phase = done ? 'matchEnd' : 'dealEnd';
  broadcast(room);
}
function tick(room) {
  const now = Date.now();
  if (!humans(room).some(s => s.connected)) {
    if (now - room.lastActive > IDLE_MS) deleteRoom(room);
    return;
  }
  room.lastActive = now;
  if (room.phase === 'choose') { const before = room.phase; autoPlays(room); if (room.phase !== before) broadcast(room); }
  else if (room.phase === 'reveal') { const r = room.G.round, p = room.phase; maybeAdvance(room); if (room.phase !== p || room.G.round !== r) broadcast(room); }
}

// ---------- what each player sees ----------
function viewFor(room, s) {
  const seats = room.seats, n = seats.length, now = Date.now();
  const v = {
    t: 'state', code: room.code, host: seats[s].token === room.hostToken, settings: room.settings,
    seats: seats.map((x, i) => ({ name: x.name, bot: !!x.bot, style: x.style || null, connected: x.bot || x.connected, host: x.token === room.hostToken, you: i === s })),
    phase: room.phase,
  };
  if (room.phase === 'lobby') return v;
  // rotate everything so this player is seat 0 on their screen
  const R = i => (i - s + n) % n;
  const rot = a => a.slice(s).concat(a.slice(0, s));
  const nameOf = i => (i === s ? 'You' : seats[i].name);
  const G = room.G, showAll = room.phase === 'dealEnd' || room.phase === 'matchEnd';
  const relEnd = r => (r && r === `${seats[s].name} went out.` ? 'You went out.' : r);
  v.G = {
    players: rot(G.players.map((p, i) => ({ name: nameOf(i), seat: R(i), hand: i === s || showAll ? p.hand : Array(p.hand.length).fill(0) }))),
    draw: Array(G.draw.length).fill(0), discard: G.discard, target: G.target, round: G.round,
    over: G.over, endReason: relEnd(G.endReason), n, cfg: G.cfg,
  };
  const M = room.match;
  v.match = { names: rot(M.names).map((x, k) => (k === 0 ? 'You' : x)), styles: rot(M.styles), totals: rot(M.totals), deals: M.deals.map(rot), mode: M.mode };
  const L = room.last;
  v.last = L ? {
    target: L.target, plays: rot(L.plays), made: L.made.map(R), winner: L.winner >= 0 ? R(L.winner) : -1, reason: L.reason, quenched: !!L.quenched, quenchedBy: (L.quenchedBy || []).map(R), wouldWin: L.wouldWin >= 0 ? R(L.wouldWin) : -1,
    penalties: L.penalties.map(q => ({ i: R(q.i), card: q.i === s ? q.card : null })), ended: L.ended, reflip: L.reflip,
  } : null;
  v.ready = rot(room.submitted);
  v.away = rot(seats.map(x => !x.bot && !x.connected));
  v.submitted = !!room.submitted[s];
  v.waitingOn = room.phase === 'choose' ? seats.filter((x, i) => !room.submitted[i]).map(x => x.name) : [];
  v.readyDone = room.ready.has(s);
  v.pickerOther = room.phase === 'reveal' && room.picker >= 0 && room.picker !== s;
  v.dealScores = room.dealScores ? rot(room.dealScores) : null;
  let phase = room.phase, msg = '';
  if (room.note) msg = room.note.text.replace('{who}', room.note.who === s ? 'You' : (room.note.who >= 0 ? seats[room.note.who].name : ''));
  if (room.phase === 'reveal') {
    if (L.reflip) msg = `Nobody made ${L.target.value}. In a 2-player game the first miss flips a new target.`;
    else if (L.quenched && !L.ended) { const names = L.quenchedBy.map(i => (i === s ? 'You' : seats[i].name)); msg = `<b>Quenched!</b> ${names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0]} doused the round. Nobody wins, and a new target is flipped.`; }
    else if (L.ended) msg = relEnd(G.endReason);
    else {
      msg = `<b>${L.winner === s ? 'You win' : seats[L.winner].name + ' wins'}</b> the round: ${L.reason}.`;
      if (room.picker === s) { phase = 'pick'; msg += ' Now pick the next target from your hand.'; }
      else if (room.picker >= 0) msg += ` ${seats[room.picker].name} is choosing the next target.`;
    }
  }
  v.phase = phase; v.msg = msg;
  return v;
}
function broadcast(room) {
  room.seats.forEach((s, i) => { if (!s.bot && s.connected) send(s.ws, viewFor(room, i)); });
}

// ---------- messages ----------
function seatOf(room, ws) { return room ? room.seats.findIndex(s => s.ws === ws && !s.bot) : -1; }

function handle(ws, msg) {
  const fail = (text, fatal) => send(ws, { t: 'error', msg: text, fatal: !!fatal });
  if (msg.t === 'create') {
    const room = createRoom();
    const seat = addHuman(room, msg.name, ws);
    ws.room = room;
    send(ws, { t: 'joined', code: room.code, token: seat.token, name: seat.name });
    return broadcast(room);
  }
  if (msg.t === 'join') {
    const room = rooms.get(String(msg.code || '').toUpperCase().trim());
    if (!room) return fail('No game with that code. Check the code with your host.', true);
    const back = msg.token && room.seats.find(s => s.token === msg.token && !s.bot);
    if (back) {
      if (back.ws && back.ws !== ws) { try { back.ws.close(4000, 'replaced'); } catch {} }
      back.ws = ws; back.connected = true; back.goneAt = 0; ws.room = room;
      send(ws, { t: 'joined', code: room.code, token: back.token, name: back.name });
      return broadcast(room);
    }
    if (msg.rejoinOnly) return fail('That game has ended.', true);
    if (room.phase !== 'lobby') return fail('That game has already started.', true);
    if (room.seats.length >= 8) return fail('That game is full (8 players).', true);
    const seat = addHuman(room, msg.name, ws);
    ws.room = room;
    send(ws, { t: 'joined', code: room.code, token: seat.token, name: seat.name });
    return broadcast(room);
  }
  const room = ws.room;
  const s = seatOf(room, ws);
  if (s < 0) return fail('You are not in a game.', true);
  const seat = room.seats[s], isHost = seat.token === room.hostToken;
  const G = room.G;

  switch (msg.t) {
    case 'settings':
      if (!isHost || room.phase !== 'lobby') return;
      if (typeof msg.colorRule === 'boolean') room.settings.colorRule = msg.colorRule;
      if (typeof msg.quench === 'boolean') room.settings.quench = msg.quench;
      if (msg.mode === 'deals' || msg.mode === 'fifty') room.settings.mode = msg.mode;
      return broadcast(room);
    case 'addBot':
      if (!isHost || room.phase !== 'lobby' || room.seats.length >= 8) return;
      addBot(room); return broadcast(room);
    case 'remove': {
      if (!isHost || room.phase !== 'lobby') return;
      const t = room.seats[msg.seat];
      if (!t || t === seat) return;
      room.seats.splice(msg.seat, 1);
      if (!t.bot) { send(t.ws, { t: 'kicked', msg: 'The host removed you from the game.' }); if (t.ws) t.ws.room = null; }
      return broadcast(room);
    }
    case 'start':
      if (!isHost || room.phase !== 'lobby') return;
      if (room.seats.length < 2) return fail('Add at least one more player or a bot.');
      return startMatch(room);
    case 'play': {
      if (room.phase !== 'choose' || room.submitted[s]) return;
      let play = null;
      if (Array.isArray(msg.ids)) {
        const hand = G.players[s].hand;
        play = msg.ids.map(id => hand.find(c => c.id === id));
        if (play.some(c => !c) || new Set(msg.ids).size !== msg.ids.length) return fail('Those cards are not in your hand.');
        useRules(room);
        if (!E.isLegal(play, G.target)) return fail(`That play doesn't make ${G.target.value}.`);
      }
      room.plays[s] = play; room.submitted[s] = true;
      if (room.submitted.every(Boolean)) resolve(room);
      return broadcast(room);
    }
    case 'target': {
      if (room.phase !== 'reveal' || room.picker !== s) return;
      const card = G.players[s].hand.find(c => c.id === msg.id && c.value > 0);
      if (!card) return;
      useRules(room);
      E.setNextTarget(G, s, card);
      if (G.over) return endDeal(room);
      room.note = { who: s, text: `{who} set the next target: ${E.cardLabel(card)}.` };
      return newRound(room);
    }
    case 'ready':
      if (room.phase !== 'reveal') return;
      room.ready.add(s);
      maybeAdvance(room);
      return broadcast(room);
    case 'next':
      if (!isHost) return;
      if (room.phase === 'dealEnd') return startDeal(room);
      if (room.phase === 'matchEnd') return startMatch(room);
      return;
    case 'lobby':
      if (!isHost || (room.phase !== 'dealEnd' && room.phase !== 'matchEnd')) return;
      room.phase = 'lobby'; room.G = null; room.match = null; room.last = null;
      room.seats = room.seats.filter(x => x.bot || x.connected);
      return broadcast(room);
    case 'leave':
      return leave(room, s, ws);
  }
}
function leave(room, s, ws) {
  const seat = room.seats[s];
  ws.room = null;
  if (room.phase === 'lobby') room.seats.splice(s, 1);
  else { seat.connected = false; seat.goneAt = 0; seat.ws = null; seat.left = true; }
  if (seat.token === room.hostToken) {
    const next = room.seats.find(x => !x.bot && x.connected);
    room.hostToken = next ? next.token : null;
  }
  if (!humans(room).some(x => x.connected)) { if (room.phase === 'lobby') deleteRoom(room); return; }
  broadcast(room);
  autoPlays(room);
}

// ---------- sockets ----------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', data => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    try { handle(ws, msg); } catch (e) { console.error(e); send(ws, { t: 'error', msg: 'Something went wrong on the server.' }); }
  });
  ws.on('close', () => {
    const room = ws.room;
    if (!room) return;
    const s = seatOf(room, ws);
    if (s < 0) return;
    const seat = room.seats[s];
    seat.connected = false; seat.goneAt = Date.now(); seat.ws = null;
    if (room.phase === 'lobby') {
      // give a quick refresh time to come back before dropping them from the lobby
      setTimeout(() => {
        if (room.phase === 'lobby' && !seat.connected && room.seats.includes(seat)) {
          room.seats.splice(room.seats.indexOf(seat), 1);
          if (seat.token === room.hostToken) { const n = room.seats.find(x => !x.bot && x.connected); room.hostToken = n ? n.token : null; }
          if (!humans(room).some(x => x.connected)) deleteRoom(room); else broadcast(room);
        }
      }, GRACE_MS);
    }
    broadcast(room);
  });
});
// keep connections alive through proxies
setInterval(() => {
  wss.clients.forEach(ws => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); });
}, 25000);

server.listen(PORT, () => console.log(`Slag is running on port ${PORT}`));
