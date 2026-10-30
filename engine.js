// Slag rules engine and computer players. Shared by the page (index.html) and the game server (server.js).
// ===== Slag rules engine (matches the Slag Rulebook) =====
const SUITS = {
  red:    { name: 'Red',    art: 'Crossbow',    rank: 6, sister: 'orange', hex: '#d0161b' },
  orange: { name: 'Orange', art: 'Spear',       rank: 5, sister: 'red',    hex: '#f07c12' },
  green:  { name: 'Green',  art: 'Axe',         rank: 4, sister: 'blue',   hex: '#16b85a' },
  blue:   { name: 'Blue',   art: 'Sword',       rank: 3, sister: 'green',  hex: '#1a4fb0' },
  purple: { name: 'Purple', art: 'Chest armor', rank: 2, sister: 'grey',   hex: '#8b5cf0' },
  grey:   { name: 'Grey',   art: 'Helmet',      rank: 1, sister: 'purple', hex: '#5d5d63' },
  black:  { name: 'Black',  art: 'Serpent',     rank: 0, sister: null,     hex: '#111111' },
};
const SUIT_ORDER = ['red', 'orange', 'green', 'blue', 'purple', 'grey'];

let _uid = 0;
function mkCard(suit, value, star) { return { id: 'c' + (++_uid), suit, value, star: !!star }; }

function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function setupFor(n) {
  if (n === 2) return { suits: SUIT_ORDER.slice(0, 4), doubles: false, hand: 11, black: 0 };
  if (n === 3 || n === 4) return RULES.colorCount
    ? { suits: SUIT_ORDER, doubles: true, hand: 11, black: 0, singleOnly: ['purple', 'grey'] } // Most of the color: Purple & Grey 1–10, no doubles
    : { suits: SUIT_ORDER, doubles: true, hand: 11, black: 0, highOnly: ['purple', 'grey'] }; // Highest card: Purple & Grey 6–10 only
  if (n <= 6) return { suits: SUIT_ORDER, doubles: true, hand: 11, black: 0 };
  if (n === 7) return { suits: SUIT_ORDER, doubles: true, hand: 11, black: 1 };
  return { suits: SUIT_ORDER, doubles: true, hand: 10, black: 2 };
}

function cardLabel(c) { return SUITS[c.suit].name + ' ' + (c.value < 0 ? '−' + (-c.value) : c.value) + (c.star ? '★' : ''); }

// Ranking key of a single positive card relative to a target (higher array wins, compared left to right)
function cardKey(c, target) {
  return [c.suit === target.suit ? 1 : 0, c.value, SUITS[target.suit].sister === c.suit ? 1 : 0, SUITS[c.suit].rank, c.star ? 1 : 0];
}
function cmpKey(a, b) { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; }
function bestCard(play, target) {
  let best = null, bk = null;
  for (const c of play) { if (c.value < 0) continue; const k = cardKey(c, target); if (!bk || cmpKey(k, bk) > 0) { best = c; bk = k; } }
  return { card: best, key: bk };
}

// Table rule: when on, the play with the most cards of the target's color wins (negatives count),
// and the highest target-color card breaks ties. When off, only the single best card counts.
const RULES = { colorCount: false };
function colorCount(play, target) { return play.filter(c => c.suit === target.suit).length; }
function topColor(play, target) { return Math.max(0, ...play.filter(c => c.value > 0 && c.suit === target.suit).map(c => c.value)); }
function playKey(play, target) {
  const k = bestCard(play, target).key;
  return RULES.colorCount ? [colorCount(play, target), topColor(play, target), ...k.slice(1)] : k;
}

function isLegal(play, target) {
  if (!play.length || play.length > 3) return false;
  if (play.filter(c => c.value < 0).length > 1) return false;
  if (!play.some(c => c.value > 0)) return false;
  return play.reduce((s, c) => s + c.value, 0) === target.value;
}

// all legal plays from a hand
function legalPlays(hand, target) {
  const out = [], n = hand.length;
  for (let i = 0; i < n; i++) {
    if (isLegal([hand[i]], target)) out.push([hand[i]]);
    for (let j = i + 1; j < n; j++) {
      if (isLegal([hand[i], hand[j]], target)) out.push([hand[i], hand[j]]);
      for (let k = j + 1; k < n; k++) if (isLegal([hand[i], hand[j], hand[k]], target)) out.push([hand[i], hand[j], hand[k]]);
    }
  }
  return out;
}

// Scoring: positives score value; a negative paired with a same-suit positive subtracts, else +5. Black never pairs.
function scoreHand(hand) {
  const lines = []; let total = 0;
  const pos = hand.filter(c => c.value > 0), neg = hand.filter(c => c.value < 0).sort((a, b) => a.value - b.value);
  const avail = {}; pos.forEach(c => { avail[c.suit] = (avail[c.suit] || 0) + 1; });
  pos.forEach(c => { total += c.value; });
  const negLines = [];
  for (const c of neg) {
    if (c.suit !== 'black' && avail[c.suit] > 0) { avail[c.suit]--; total += c.value; negLines.push({ card: c, pts: c.value, paired: true }); }
    else { total += 5; negLines.push({ card: c, pts: 5, paired: false }); }
  }
  return { total, pos: pos.map(c => ({ card: c, pts: c.value })), neg: negLines };
}

// ===== Game state =====
function newDeal(names, rng, opts = {}) {
  const n = names.length, cfg = setupFor(n);
  let main = [];
  for (const s of cfg.suits) for (let v = 1; v <= 10; v++) {
    if (cfg.highOnly && cfg.highOnly.includes(s) && v <= 5) continue;
    main.push(mkCard(s, v, cfg.doubles && v <= 5 && !(cfg.singleOnly && cfg.singleOnly.includes(s))));
    if (cfg.doubles && v <= 5 && !(cfg.singleOnly && cfg.singleOnly.includes(s))) main.push(mkCard(s, v, false));
  }
  shuffle(main, rng);
  const negSuits = cfg.suits.slice();
  for (let b = 0; b < cfg.black; b++) negSuits.push('black');
  const piles = [-1, -2, -3].map(v => shuffle(negSuits.map(s => mkCard(s, v, false)), rng));
  const players = names.map((name, i) => ({ name, hand: [], seat: i }));
  for (const p of players) p.hand = main.splice(0, cfg.hand);
  for (const p of players) for (const pile of piles) p.hand.push(pile.pop());
  const target = main.shift();
  return { players, draw: main, discard: [], target, round: 1, reflips: 0, cfg, n, over: false, endReason: null, rng };
}

function drawOne(G) {
  if (!G.draw.length && G.discard.length) { G.draw = shuffle(G.discard, G.rng || Math.random); G.discard = []; G.reshuffled = true; }
  return G.draw.length ? G.draw.shift() : null;
}

// plays: array (per player) of card arrays or null (pass). Returns round result; mutates G.
function resolveRound(G, plays) {
  const t = G.target;
  const res = { target: t, plays: plays.map(p => p ? p.slice() : null), made: [], winner: -1, reason: '', penalties: [], ended: false, reflip: false };
  plays.forEach((p, i) => { if (p && isLegal(p, t)) res.made.push(i); });
  if (!res.made.length) {
    if (G.n === 2 && G.reflips === 0) {
      G.reflips++;
      // nobody draws; flip a fresh target
      G.discard.push(t);
      const nt = drawOne(G);
      if (nt) { G.target = nt; res.reflip = true; G.round++; return res; }
    }
    G.over = true; G.endReason = 'Nobody could make ' + cardLabel(t) + '.'; res.ended = true; return res;
  }
  let best = -1, bk = null;
  for (const i of res.made) { const k = playKey(plays[i], t); if (!bk || cmpKey(k, bk) > 0) { best = i; bk = k; } }
  res.winner = best; res.winCard = bestCard(plays[best], t).card;
  res.reason = explain(plays, res.made, best, t);
  for (const i of res.made) {
    const ids = new Set(plays[i].map(c => c.id));
    G.players[i].hand = G.players[i].hand.filter(c => !ids.has(c.id));
    plays[i].forEach(c => { if (c.value > 0) G.discard.push(c); });
  }
  const out = G.players.findIndex(p => p.hand.length === 0);
  if (out >= 0) { G.over = true; G.endReason = G.players[out].name + ' went out.'; res.ended = true; G.discard.push(t); return res; }
  G.players.forEach((p, i) => { if (!res.made.includes(i)) { const c = drawOne(G); if (c) { p.hand.push(c); res.penalties.push({ i, card: c }); } } });
  return res;
}

function explain(plays, made, w, t) {
  if (RULES.colorCount && made.length > 1) {
    const n = colorCount(plays[w], t), tc = SUITS[t.suit].name;
    const others = made.filter(i => i !== w).map(i => colorCount(plays[i], t));
    if (n > 0 && others.every(o => o < n)) return n === 1 ? 'the only play with ' + tc : 'most ' + tc + ' cards (' + n + ')';
    if (n > 0 && others.some(o => o === n)) {
      const top = topColor(plays[w], t), tied = made.filter(i => i !== w && colorCount(plays[i], t) === n).map(i => topColor(plays[i], t));
      if (tied.every(v => v < top)) return 'tied on ' + n + ' ' + tc + ', highest ' + tc + ' card wins';
    }
  }
  const wc = bestCard(plays[w], t).card;
  if (made.length === 1) return 'the only player to make ' + t.value;
  const others = made.filter(i => i !== w).map(i => bestCard(plays[i], t).card);
  const tc = SUITS[t.suit].name;
  if (wc.suit === t.suit) {
    if (others.every(c => c.suit !== t.suit)) return 'played ' + tc + ', the target color';
    if (others.every(c => c.suit !== t.suit || c.value < wc.value)) return 'highest ' + tc + ' card';
    return 'tie on ' + cardLabel(wc).replace('★', '') + ', the starred copy wins';
  }
  const top = others.filter(c => c.value === wc.value);
  if (!top.length) return 'nobody played ' + tc + ', and ' + cardLabel(wc) + ' is the highest card';
  if (SUITS[t.suit].sister === wc.suit && top.every(c => c.suit !== wc.suit)) return 'tie on ' + wc.value + ', broken by the sister suit (' + SUITS[wc.suit].name + ')';
  if (top.every(c => c.suit !== wc.suit)) return 'tie on ' + wc.value + ', broken by suit rank (' + SUITS[wc.suit].name + ' ' + SUITS[wc.suit].rank + ')';
  return 'tie on ' + cardLabel(wc).replace('★', '') + ', the starred copy wins';
}

// winner sets the next target (card from their hand) or null → flip
function setNextTarget(G, winner, card) {
  G.discard.push(G.target);
  const p = G.players[winner];
  if (card) { p.hand = p.hand.filter(c => c.id !== card.id); G.target = card; }
  else { const c = drawOne(G); if (!c) { G.over = true; G.endReason = 'The deck ran out.'; return; } G.target = c; }
  G.round++;
  const out = G.players.findIndex(q => q.hand.length === 0);
  if (out >= 0) { G.over = true; G.endReason = G.players[out].name + ' went out.'; }
}

// ===== Bots =====
// Every bot weighs two goals on each play: shed cards and points now, and win the round
// so it can set a target that suits its own hand. Styles only tilt the balance.
const STYLES = ['bold', 'shedder', 'steady'];
const BOT_W = { bold: { win: 1.4, shed: 0.8 }, shedder: { win: 0.7, shed: 1.3 }, steady: { win: 1, shed: 1 } };

// What a bot can fairly know: everyone else's cards and the draw pile, mixed together, plus hand sizes.
function botCtx(G, i) {
  const pool = [];
  G.players.forEach((p, j) => { if (j !== i) pool.push(...p.hand); });
  pool.push(...G.draw);
  return { pool, oppSizes: G.players.filter((_, j) => j !== i).map(p => p.hand.length) };
}
// Deal random hands to the opponents from the unseen cards and see how they could answer this target.
function sampleOpps(target, ctx, rng, samples) {
  const out = [];
  for (let s = 0; s < samples; s++) {
    const deck = shuffle(ctx.pool.slice(), rng);
    let best = null, makers = 0, idx = 0;
    for (const n of ctx.oppSizes) {
      const h = deck.slice(idx, idx + n); idx += n;
      const plays = legalPlays(h, target);
      if (plays.length) {
        makers++;
        for (const p of plays) { const k = playKey(p, target); if (!best || cmpKey(k, best) > 0) best = k; }
      }
    }
    out.push({ best, makers });
  }
  return out;
}
function winShare(key, sims) { return sims.filter(x => !x.best || cmpKey(key, x.best) > 0).length / sims.length; }
function roughWin(key) { return key[0] > 0 ? Math.min(0.95, 0.3 + key[0] * 0.15 + key[1] * 0.04) : Math.min(0.4, key[1] * 0.03); }

// How good a hand is for choosing the next target: dump a high card that you can follow up on, ideally in its own color.
function targetValue(rest) {
  let best = -2;
  for (const c of rest) {
    if (c.value <= 0) continue;
    const after = rest.filter(x => x !== c);
    if (!after.length) return 10; // setting your last card takes you out
    const plays = legalPlays(after, c);
    let v = c.value * 0.3;
    if (plays.length) {
      v += 1.5 + Math.max(...plays.map(p => p.length)) * 0.6;
      v += 1.5 * Math.max(...plays.map(p => colorCount(p, c)));
    } else v -= 1.5;
    if (v > best) best = v;
  }
  return best;
}

function botPlay(hand, target, style, rng, ctx) {
  const plays = legalPlays(hand, target);
  if (!plays.length) return null;
  const W = BOT_W[style] || BOT_W.steady;
  const base = scoreHand(hand).total;
  const sims = ctx ? sampleOpps(target, ctx, rng, 16) : null;
  let best = null, bs = -1e9;
  for (const p of plays) {
    const rest = hand.filter(c => !p.includes(c));
    if (!rest.length) return p; // going out ends the deal at 0 points
    const saved = base - scoreHand(rest).total; // points removed from the hand (a paired negative counts against)
    const shed = p.length * 2.2 + saved * 0.35;
    const key = playKey(p, target);
    const pWin = sims ? winShare(key, sims) : roughWin(key);
    const winVal = 2.2 + targetValue(rest); // the target card leaves your hand too
    const u = W.shed * shed + 2 * W.win * pWin * winVal + rng() * 0.6;
    if (u > bs) { bs = u; best = p; }
  }
  return best;
}

function botTarget(hand, rng, ctx) {
  const pos = hand.filter(c => c.value > 0);
  if (!pos.length) return null;
  let best = null, bs = -1e9;
  for (const c of pos) {
    const rest = hand.filter(x => x.id !== c.id);
    if (!rest.length) return c; // goes out
    const plays = legalPlays(rest, c);
    let s = c.value * 0.4; // dumping a high card saves points
    if (plays.length) {
      s += 3 + Math.max(...plays.map(p => p.length)) * 0.8;
      let myBest = null;
      for (const p of plays) { const k = playKey(p, c); if (!myBest || cmpKey(k, myBest) > 0) myBest = k; }
      if (ctx) {
        const sims = sampleOpps(c, ctx, rng, 10);
        const miss = sims.reduce((a, x) => a + (ctx.oppSizes.length - x.makers), 0) / sims.length;
        s += winShare(myBest, sims) * 4 + miss * 1.2; // likely to win again, and others draw penalties
      } else if (myBest[0] > 0) s += 3;
    } else s -= 6; // you'd have to draw
    s += rng() * 0.5;
    if (s > bs) { bs = s; best = c; }
  }
  return best;
}

if (typeof module !== 'undefined') module.exports = { RULES, playKey, colorCount, SUITS, SUIT_ORDER, setupFor, newDeal, resolveRound, setNextTarget, legalPlays, isLegal, bestCard, cardKey, cmpKey, scoreHand, botPlay, botTarget, botCtx, STYLES, cardLabel, shuffle };

