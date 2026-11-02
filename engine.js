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
  usurper: { name: 'Usurper', art: '', rank: 0, sister: null, hex: '#d9cbb0' },
  quench: { name: 'Quench', art: 'Water bucket', rank: 0, sister: null,    hex: '#2e86ab' },
  slag:   { name: 'Slag',   art: '',            rank: 0, sister: null,     hex: '#3a2a22' },
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

// Quench option: colorless 0-value Quench cards shuffled into the deck. One at 2–3 players, two at 4–5, three at 6–8.
const isQuench = c => !!c && c.suit === 'quench';
function quenchCount(n) { return n <= 3 ? 1 : n <= 5 ? 2 : 3; }
function cardLabel(c) { if (isQuench(c)) return 'Quench 0'; if (isUsurper(c)) return (c.pair ? SUITS[PAIRS[c.pair][0]].name + '/' + SUITS[PAIRS[c.pair][1]].name + ' ' : '') + 'Usurper 3'; if (isSlag(c)) return 'Slag 7'; return SUITS[c.suit].name + ' ' + (c.value < 0 ? '−' + (-c.value) : c.value) + (c.star ? '★' : ''); }

// Ranking key of a single positive card relative to a target (higher array wins, compared left to right)
function cardKey(c, target) {
  return [c.suit === target.suit ? 1 : 0, c.value, SUITS[target.suit].sister === c.suit ? 1 : 0, SUITS[c.suit].rank, c.star ? 1 : 0];
}
function cmpKey(a, b) { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; }
function bestCard(play, target) {
  let best = null, bk = null;
  for (const c of play) { if (c.value < 0 || isUsurper(c) || isQuench(c) || isSlag(c)) continue; const k = cardKey(c, target); if (!bk || cmpKey(k, bk) > 0) { best = c; bk = k; } }
  return { card: best, key: bk };
}

// Table rule: when on, the play with the most cards of the target's color wins (negatives count),
// and the highest target-color card breaks ties. When off, only the single best card counts.
const RULES = { colorCount: false, quench: false, usurper: false, slag: false };
// Slag card option: one colorless 7. Played in a combo, whoever wins the round draws a penalty card (unless it's you).
// As the target, color doesn't count, the best play wins, and the winner draws a penalty card. It never counts as the high card.
const isSlag = c => !!c && c.suit === 'slag';
// Usurper option: one colorless 3. As the target, color doesn't count. Played with a card of the target's color, it takes the round outright;
// played without one, it is just a colorless 3.
const isUsurper = c => !!c && c.suit === 'usurper';
// Three Usurpers, one per sister pair. A Usurper takes the round only when the target is one of its two colors
// and the same play holds a positive card of the target's color. Otherwise it is a plain colorless 3.
const PAIRS = { red: ['red', 'orange'], green: ['green', 'blue'], purple: ['purple', 'grey'] };
const usurperLive = (c, t, play) => isUsurper(c) && (!c.pair || PAIRS[c.pair].includes(t.suit)) && play.some(x => x.suit === t.suit && x.value > 0);
function colorCount(play, target) { return play.filter(c => c.suit === target.suit).length; }
function topColor(play, target) { return Math.max(0, ...play.filter(c => c.value > 0 && c.suit === target.suit).map(c => c.value)); }
function playKey(play, target) {
  const k = bestCard(play, target).key || [-1, 0, 0, 0, 0];
  return RULES.colorCount ? [colorCount(play, target), topColor(play, target), ...k.slice(1)] : k;
}

function isLegal(play, target) {
  if (play.filter(isQuench).length > 1) return false;
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
  const qn = hand.filter(isQuench).map(c => ({ card: c, pts: 5 }));
  total += 5 * qn.length;
  return { total, pos: pos.map(c => ({ card: c, pts: c.value })), neg: negLines, quench: qn };
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
  if (RULES.usurper) for (const k of Object.keys(PAIRS)) if (cfg.suits.includes(k)) { const c = mkCard('usurper', 3, false); c.pair = k; main.push(c); }
  if (RULES.slag) main.push(mkCard('slag', 7, false));
  if (RULES.quench) for (let k = 0; k < quenchCount(n); k++) main.push(mkCard('quench', 0, false));
  shuffle(main, rng);
  const negSuits = cfg.suits.slice();
  for (let b = 0; b < cfg.black; b++) negSuits.push('black');
  const piles = [-1, -2, -3].map(v => shuffle(negSuits.map(s => mkCard(s, v, false)), rng));
  const players = names.map((name, i) => ({ name, hand: [], seat: i }));
  for (const p of players) p.hand = main.splice(0, cfg.hand);
  for (const p of players) for (const pile of piles) p.hand.push(pile.pop());
  // a Quench never starts as the target: slide it under the pile and flip again
  let target = main.shift();
  for (let k = 0; isQuench(target) && k < main.length; k++) { main.push(target); target = main.shift(); }
  return { players, draw: main, discard: [], target, round: 1, reflips: 0, cfg, n, over: false, endReason: null, rng, setter: -1 };
}

function drawTarget(G) {
  for (let k = 0, lim = G.draw.length + G.discard.length + 1; k <= lim; k++) {
    const c = drawOne(G);
    if (!c) return null;
    if (!isQuench(c)) return c;
    G.draw.push(c);
  }
  return null;
}
function drawOne(G) {
  if (!G.draw.length && G.discard.length) { G.draw = shuffle(G.discard, G.rng || Math.random); G.discard = []; G.reshuffled = true; }
  return G.draw.length ? G.draw.shift() : null;
}

// plays: array (per player) of card arrays or null (pass). Returns round result; mutates G.
function resolveRound(G, plays) {
  const t = G.target;
  const res = { target: t, plays: plays.map(p => p ? p.slice() : null), made: [], winner: -1, reason: '', penalties: [], ended: false, reflip: false, quenchedBy: [], quenched: false };
  plays.forEach((p, i) => { if (p && isLegal(p, t)) res.made.push(i); });
  if (!res.made.length) {
    if (G.n === 2 && G.reflips === 0) {
      G.reflips++;
      // nobody draws; flip a fresh target
      G.discard.push(t);
      const nt = drawTarget(G);
      if (nt) { G.target = nt; G.setter = -1; res.reflip = true; G.round++; return res; }
    }
    G.over = true; G.endReason = 'Nobody could make ' + cardLabel(t) + '.'; res.ended = true; return res;
  }
  // A Quench in any play means nobody wins: plays still discard, misses still draw, and a new target is flipped.
  res.quenchedBy = res.made.filter(i => plays[i].some(isQuench));
  res.quenched = res.quenchedBy.length > 0;
  let best = -1, bk = null;
  for (const i of res.made) { const k = playKey(plays[i], t); if (!bk || cmpKey(k, bk) > 0) { best = i; bk = k; } }
  res.wouldWin = best;
  res.usurperTarget = isUsurper(t);
  res.usurperPlayed = res.made.some(i => plays[i].some(c => usurperLive(c, t, plays[i])));
  if (res.quenched) res.reason = 'quenched';
  else if (res.usurperTarget) {
    // Usurper as the target: it has no color, so the highest single card wins; a tie on that card flips a new target.
    res.colorless = true;
    const top = i => Math.max(0, ...plays[i].filter(c => c.value > 0 && !isUsurper(c)).map(c => c.value));
    const hi = Math.max(...res.made.map(top)), at = res.made.filter(i => top(i) === hi);
    res.usurperTop = hi;
    if (at.length > 1) { res.usurperTie = true; res.reason = `Usurper tie on ${hi}`; }
    else { res.winner = at[0]; res.winCard = bestCard(plays[at[0]], t).card; res.reason = `Usurper: color doesn't count, and ${res.winCard ? cardLabel(res.winCard) : 'that play'} is the highest card`; }
  }
  else if (res.usurperPlayed) {
    // Usurper played: with a positive target-color card it seizes the round; otherwise it is just a colorless 3.
    const u = res.made.find(i => plays[i].some(c => usurperLive(c, t, plays[i])));
    res.usurper = u;
    const tc = plays[u].find(c => c.suit === t.suit && c.value > 0);
    const name = i => G.players[i].name;
    if (tc) {
      res.winner = u; res.winCard = tc; res.seized = true;
      res.reason = best === u ? `Usurper with ${cardLabel(tc)}, the target color` : `Usurper with ${cardLabel(tc)}, the target color, seizes the round from ${name(best)}`;
    } else { res.winner = best; res.winCard = bestCard(plays[best], t).card; res.reason = explain(plays, res.made, best, t); }
  }
  else { res.winner = best; res.winCard = bestCard(plays[best], t).card; res.reason = explain(plays, res.made, best, t); }
  // Slag card: as the target, or played by someone other than the winner, the winner draws a penalty card.
  res.slagTarget = isSlag(t);
  const sb = res.made.find(i => plays[i].some(isSlag));
  res.slagBy = sb === undefined ? -1 : sb;
  res.slagHit = res.winner >= 0 && (res.slagTarget || (res.slagBy >= 0 && res.slagBy !== res.winner)) ? res.winner : -1;
  for (const i of res.made) {
    const ids = new Set(plays[i].map(c => c.id));
    G.players[i].hand = G.players[i].hand.filter(c => !ids.has(c.id));
    plays[i].forEach(c => { if (c.value >= 0) G.discard.push(c); });
  }
  const out = G.players.findIndex(p => p.hand.length === 0);
  if (out >= 0) { G.over = true; G.endReason = G.players[out].name + ' went out.'; res.ended = true; G.discard.push(t); return res; }
  G.players.forEach((p, i) => { if (!res.made.includes(i)) { const c = drawOne(G); if (c) { p.hand.push(c); res.penalties.push({ i, card: c }); } } });
  if (res.slagHit >= 0) { const c = drawOne(G); res.reason += res.slagTarget ? '. The Slag target burns the winner, who draws a penalty card' : `. ${G.players[res.slagBy].name}'s Slag card burns the winner, who draws a penalty card`; if (c) { G.players[res.slagHit].hand.push(c); res.penalties.push({ i: res.slagHit, card: c, slag: true }); } }
  if (res.quenched || res.usurperTie) {
    G.discard.push(t);
    // table rule: a Quench played when the draw pile is empty ends the deal (no reshuffle for the new target)
    if (res.quenched && !G.draw.length) { G.over = true; G.endReason = 'Quenched with an empty draw pile, so the deal ends.'; res.ended = true; return res; }
    const nt = drawTarget(G);
    if (!nt) { G.over = true; G.endReason = 'The deck ran out.'; res.ended = true; return res; }
    G.target = nt; G.setter = -1; G.round++;
  }
  return res;
}

function explain(plays, made, w, t) {
  if (isSlag(t)) return made.length === 1 ? 'the only player to make ' + t.value : `color doesn't count, and ${cardLabel(bestCard(plays[w], t).card)} is the highest card`;
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
  const others = made.filter(i => i !== w).map(i => bestCard(plays[i], t).card).filter(Boolean);
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
  if (card) { p.hand = p.hand.filter(c => c.id !== card.id); G.target = card; G.setter = winner; }
  else { const c = drawTarget(G); if (!c) { G.over = true; G.endReason = 'The deck ran out.'; return; } G.target = c; G.setter = -1; }
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
  const plays = legalPlays(hand, target).filter(p => !p.some(isQuench));
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
    let pWin = sims ? winShare(key, sims) : roughWin(key);
    if (p.some(isUsurper) && !isUsurper(target)) pWin = p.some(c => usurperLive(c, target, p)) ? 0.97 : pWin;
    let winVal = 2.2 + targetValue(rest); // the target card leaves your hand too
    if (isSlag(target)) winVal -= 4.5; // the winner of a Slag round draws a penalty card
    if (p.some(isSlag)) pWin *= 0.5; // the Slag card never counts as your high card; others pay if they win
    const u = W.shed * shed + 2 * W.win * pWin * winVal + rng() * 0.6;
    if (u > bs) { bs = u; best = p; }
  }
  return best;
}

// A bot's whole move: its best normal play, plus a Quench when a rival set this target and is likely to win it,
// or when the game is nearly over and an unplayed Quench would cost 5 points.
function botMove(G, i, style, rng) {
  const hand = G.players[i].hand, t = G.target, ctx = botCtx(G, i);
  const play = botPlay(hand, t, style, rng, ctx);
  const q = hand.find(isQuench);
  if (!play || !q || play.length >= 3) return play;
  const myWin = winShare(playKey(play, t), sampleOpps(t, ctx, rng, 10));
  let use = hand.length <= 4 && myWin < 0.5;
  const s = G.setter;
  if (!use && s >= 0 && s !== i && myWin < 0.35) {
    const rival = G.players[s].hand.length;
    use = rng() < (rival <= 4 ? 0.85 : rival <= 7 ? 0.45 : 0.15);
  }
  return use ? [...play, q] : play;
}
function botTarget(hand, rng, ctx) {
  const pos = hand.filter(c => c.value > 0);
  if (!pos.length) return null;
  const sl = pos.find(isSlag);
  if (sl && rng() < 0.9) return sl; // pass the curse along
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

if (typeof module !== 'undefined') module.exports = { PAIRS, usurperLive, isSlag, isUsurper, RULES, playKey, colorCount, SUITS, SUIT_ORDER, setupFor, newDeal, resolveRound, setNextTarget, legalPlays, isLegal, bestCard, cardKey, cmpKey, scoreHand, botPlay, botTarget, botCtx, botMove, isQuench, quenchCount, STYLES, cardLabel, shuffle };

