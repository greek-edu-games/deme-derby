// Έλεγχος αναλλοίωτων της λογικής (node test.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const m = html.match(/<script id="logic">([\s\S]*?)<\/script>/);
if (!m) throw new Error('logic block not found');
const mod = { exports: {} };
new Function('module', m[1])(mod);
const L = mod.exports;
let n = 0, fails = 0;
function ok(c, msg) { n++; if (!c) { fails++; if (fails < 40) console.error('FAIL: ' + msg); } }
const rng = L.mulberry32(12345);

// --- Τράπεζα ---
ok(L.BANK.length >= 80, 'bank has at least 80 items (' + L.BANK.length + ')');
const byT = {}, byCh = {};
let plain = 0, hard = 0;
const texts = new Set();
for (const q of L.BANK) {
  byT[q.t] = (byT[q.t] || 0) + 1; byCh[q.ch] = (byCh[q.ch] || 0) + 1;
  ok(['mc', 'tf', 'odd', 'match', 'order'].includes(q.t), 'known type ' + q.id);
  ok(Number.isInteger(q.ch) && q.ch >= 1 && q.ch <= 12, 'chapter 1..12 for #' + q.id);
  ok(q.d === 1 || q.d === 2, 'difficulty for #' + q.id);
  ok(typeof q.q === 'string' && q.q.length > 5 && !/undefined|NaN/.test(q.q), 'question text #' + q.id);
  ok(typeof q.why === 'string' && q.why.length > 10 && !/undefined|NaN/.test(q.why), 'explanation #' + q.id);
  ok(!texts.has(q.q + '|' + JSON.stringify(q.o || q.pairs || q.items)), 'duplicate question #' + q.id); texts.add(q.q + '|' + JSON.stringify(q.o || q.pairs || q.items));
  if (q.d === 2) hard++;
  if (q.t === 'mc') plain++;
  if (q.t === 'mc' || q.t === 'odd') {
    ok(q.o.length === 4 && new Set(q.o).size === 4, 'unique 4 options #' + q.id);
    ok(q.o.every(o => typeof o === 'string' && o.trim() && !/undefined|NaN/.test(o)), 'option text #' + q.id);
  }
  if (q.t === 'tf') ok(q.o.length === 2 && q.o[0] !== q.o[1] && (q.a === 0 || q.a === 1), 'tf shape #' + q.id);
  if (q.t === 'match') {
    ok(q.pairs.length === 3, 'match has 3 pairs #' + q.id);
    ok(new Set(q.pairs.map(p => p[0])).size === 3 && new Set(q.pairs.map(p => p[1])).size === 3, 'match lefts/rights unique #' + q.id);
  }
  if (q.t === 'order') {
    ok(q.items.length === 3 && new Set(q.items.map(i => i.y)).size === 3 && q.items.every(i => Number.isInteger(i.y)), 'order: 3 distinct integer years #' + q.id);
    ok(new Set(q.items.map(i => i.l)).size === 3, 'order labels unique #' + q.id);
  }
}
ok(plain / L.BANK.length <= 0.5, 'plain multiple-choice ≤ 50% (' + plain + '/' + L.BANK.length + ')');
for (let c = 1; c <= 12; c++) ok((byCh[c] || 0) >= 3, 'chapter ' + c + ' has ≥3 items (' + (byCh[c] || 0) + ')');
ok(hard >= 20, 'at least 20 hard items for sabotage (' + hard + ')');
ok(L.BANK.filter(q => q.t === 'order').length >= 8 && L.BANK.filter(q => q.t === 'match').length >= 6 && L.BANK.filter(q => q.t === 'tf').length >= 10 && L.BANK.filter(q => q.t === 'odd').length >= 6, 'enough variety of formats');
// απαγορευμένο περιεχόμενο (εκτός ύλης)
ok(!L.BANK.some(q => /Νίκα(?![ιί])|Ιουστινιαν|Βελισάρ|Θεοδώρα/.test(JSON.stringify(q))), 'no out-of-scope (Nika/Justinian) content');

// --- Παρουσίαση: ακριβώς μία σωστή, ταξινομήσιμες ημερομηνίες ---
for (const q of L.BANK) for (let k = 0; k < 6; k++) {
  const p = L.present(q, rng);
  if (p.t === 'mc' || p.t === 'odd' || p.t === 'tf') {
    ok(new Set(p.opts).size === p.opts.length, 'presented opts unique #' + q.id);
    const good = p.opts.map((_, i) => L.judge(p, i)).filter(Boolean).length;
    ok(good === 1, 'exactly one correct #' + q.id);
    ok(p.opts[p.a] === q.o[q.a], 'correct option preserved #' + q.id);
  } else if (p.t === 'match') {
    ok(L.judge(p, p.key), 'match key correct #' + q.id);
    ok(p.lefts.every((l, i) => p.rights[p.key[i]] === q.pairs.find(x => x[0] === l)[1]), 'match key pairs correctly #' + q.id);
    ok(!L.judge(p, L.wrongResponse(p, rng)), 'match wrong response judged wrong #' + q.id);
  } else {
    ok(L.judge(p, p.key), 'order key correct #' + q.id);
    const ys = p.key.map(i => p.items[i].y);
    ok(ys[0] < ys[1] && ys[1] < ys[2], 'order key strictly sorted #' + q.id);
    ok(!L.judge(p, L.wrongResponse(p, rng)), 'order wrong response judged wrong #' + q.id);
  }
  ok(L.judge(p, L.correctResponse(p)), 'correctResponse judged correct #' + q.id);
}
// η θέση της σωστής απάντησης δεν είναι πάντα η ίδια
{ const pos = new Set(); for (let k = 0; k < 200; k++) pos.add(L.present(L.BANK[0], rng).a); ok(pos.size === 4, 'correct option position is shuffled'); }
ok(L.fmtYear(-146) === '146 π.Χ.' && L.fmtYear(313) === '313 μ.Χ.', 'fmtYear');

// --- Κάρτες ---
ok(L.CARDS.length >= 12 && new Set(L.CARDS.map(c => c.id)).size === L.CARDS.length, 'deck has ≥12 unique cards (' + L.CARDS.length + ')');
for (const c of L.CARDS) ok(c.icon && c.title && c.text && typeof c.fx === 'function' && typeof c.ok === 'function', 'card shape ' + c.id);
// Κάθε κάρτα από τυχαίες καταστάσεις: θέσεις πάντα στο [0, FINISH], κανένα NaN
for (const c of L.CARDS) for (let k = 0; k < 400; k++) {
  const race = L.newRace({ mode: 'solo', players: L.champPlayers(2, 'green') });
  race.racers.forEach(r => { r.pos = Math.floor(rng() * L.FINISH); r.crowd = Math.floor(rng() * L.CROWD_MAX); r.score = Math.floor(rng() * 200); });
  race.swapUsed = rng() < 0.3;
  const r = race.racers[0];
  if (!c.ok(race, r)) continue;
  const before = race.racers.map(x => x.pos);
  c.fx(race, r, rng);
  ok(race.racers.every(x => Number.isInteger(x.pos) && x.pos >= 0 && x.pos <= L.FINISH), c.id + ': positions bounded');
  ok(Number.isFinite(r.score) && r.crowd >= 0 && r.crowd < L.CROWD_MAX, c.id + ': score/crowd sane');
  if (c.id === 'lysippus') {
    ok(!race.swapUsed === false && true, 'swap marks used');
    ok(before[0] < Math.max(...before.slice(1)), 'swap only when behind');
    ok(r.pos >= before[0], 'swap never moves player backwards');
    ok(race.racers.every(x => x.pos < L.FINISH), 'swap never hands out the finish');
  }
  if (c.id === 'emperor') ok(r.pos === Math.min(L.FINISH, before[0] + 2), 'emperor +2 clamped');
  if (c.id === 'wheel') ok(r.pos === before[0] - 1, 'wheel -1');
}
{ // ο κύκλος ερώτησης/κάρτας: swap δεν επιλέγεται ξανά μετά τη χρήση
  const race = L.newRace({ mode: 'solo', players: L.champPlayers(2, 'green') });
  race.racers[0].pos = 1; race.racers[1].pos = 8; race.swapUsed = true;
  ok(!L.CARDS.find(c => c.id === 'lysippus').ok(race, race.racers[0]), 'swap card ineligible after use');
  race.swapUsed = false; ok(L.CARDS.find(c => c.id === 'lysippus').ok(race, race.racers[0]), 'swap card eligible when behind');
  race.racers[0].pos = 9; ok(!L.CARDS.find(c => c.id === 'lysippus').ok(race, race.racers[0]), 'swap card ineligible when leading');
}

// --- Ταμείο οπαδών (crowd meter) ---
function freshRace(mode) { return L.newRace({ mode: mode || 'solo', players: mode === 'versus' ? L.versusPlayers() : L.champPlayers(0, 'green') }); }
function fixed(race, rng2, correct, d) {
  const item = L.BANK.find(q => q.t === 'mc' && q.d === (d || 1));
  const q = L.present(item, rng2);
  return L.submit(race, q, correct ? q.a : (q.a + 1) % 4, rng2);
}
{
  const race = freshRace(); const r = race.racers[0]; let trig = 0; let prev = 0;
  r.seen = [3, 6, 9]; // καμία κάρτα στη δοκιμή
  const log = [];
  for (let i = 0; i < 9 && !race.over; i++) { const res = fixed(race, rng, true); log.push(res.crowdTrigger); if (res.crowdTrigger) { trig++; ok(r.crowd === 0, 'meter resets on trigger'); ok(res.steps >= 3, 'trigger adds +2 steps'); } else ok(r.crowd === prev + 1, 'meter +1 per correct'); ok(r.crowd >= 0 && r.crowd < L.CROWD_MAX, 'meter in range'); prev = r.crowd; if (race.over) break; }
  ok(log[2] === true, 'full meter after exactly 3 correct in a row');
  // λάθος αδειάζει το μετρητή
  const r2 = freshRace().racers[0];
  const race2 = freshRace(); const q2 = race2.racers[0];
  q2.seen = [3, 6, 9]; fixed(race2, rng, true); fixed(race2, rng, true); ok(q2.crowd === 2, 'meter at 2'); fixed(race2, rng, false); ok(q2.crowd === 0 && q2.streak === 0, 'wrong answer empties the meter');
  // ασπίδα
  q2.shield = true; q2.crowd = 2; fixed(race2, rng, false); ok(q2.crowd === 2 && !q2.shield, 'shield protects meter once');
  // διπλό γέμισμα
  const race3 = freshRace(); const q3 = race3.racers[0]; q3.seen = [3, 6, 9]; q3.crowdBoost = 3; fixed(race3, rng, true); ok(q3.crowd === 2 && q3.crowdBoost === 2, 'crowd boost doubles fill');
  fixed(race3, rng, true); ok(q3.crowd === 0, 'boosted fill triggers early');
  // ποτέ δεν μειώνεται σε σωστή απάντηση (εκτός trigger)
  for (let k = 0; k < 500; k++) { const rc = freshRace(); const p = rc.racers[0]; p.seen = [3, 6, 9]; p.crowd = Math.floor(rng() * 3); p.crowdBoost = rng() < .5 ? 2 : 0; const b = p.crowd; const res = fixed(rc, rng, true); ok(res.crowdTrigger ? p.crowd === 0 : p.crowd > b, 'monotonic: correct never lowers meter'); }
}
// Βαθμολογία και βήματα
{
  const race = freshRace(); const p = race.racers[0]; p.seen = [3, 6, 9];
  const a = fixed(race, rng, true, 1); ok(a.steps === 1 && a.score === 10, '+10 and +1 for easy');
  const b = fixed(race, rng, true, 2); ok(b.steps === 2 && b.score === 20, 'hard: +2 steps, +20');
  const w = fixed(race, rng, false, 1); ok(w.steps === 0 && w.to === w.from, 'wrong: no movement');
  p.fresh = 1; p.crowd = 0; const f = fixed(race, rng, true, 1); ok(f.steps === 2 && p.fresh === 0, 'fresh horses +1 once');
}

// --- Ροή: μπόνους, skip, Σαμποτάζ ---
{
  const race = freshRace(); const p = race.racers[0];
  p.skip = 1; const t = L.beginTurn(race, rng); ok(t.skipped && p.skip === 0 && race.round === 1, 'skip consumes one turn and AI still moves');
  race.pendingBonus = true; const tb = L.beginTurn(race, rng); ok(tb.q && tb.q.bonus && !race.pendingBonus, 'bonus question served');
  const r = L.submit(race, tb.q, L.correctResponse(tb.q), rng); ok(r.correct && r.steps === 1 && r.score === 20, 'bonus: +1 step, +20');
  p.hard = true; const ts = L.beginTurn(race, rng); ok(ts.q.d === 2 && ts.q.sab && !p.hard, 'sabotage serves a hard question');
  const rs = L.submit(race, ts.q, L.correctResponse(ts.q), rng); ok(rs.score >= 40 && rs.steps >= 3, 'sabotage doubles score, +1 step');
}

// --- Προσομοιώσεις αγώνων ---
const stats = { solo: 0, versus: 0, draws: 0, swapMax: 0, cards: 0, bonus: 0 };
const cardSeen = {};
for (const mode of ['solo', 'versus']) {
  for (let i = 0; i < 2000; i++) {
    const race = L.simulateRace(mode, rng, { champ: i % 3 });
    ok(race.over && race.guard < 2000, mode + ' race ' + i + ' finishes (rounds ' + race.round + ')');
    ok(race.racers.every(r => r.pos >= 0 && r.pos <= L.FINISH), 'positions bounded');
    ok(race.racers.some(r => r.pos === L.FINISH), 'somebody reached the finish');
    const sw = race.cardLog.filter(c => c === 'lysippus').length; ok(sw <= 1, 'swap card at most once per race (' + sw + ')');
    stats.swapMax = Math.max(stats.swapMax, sw); stats.cards += race.cardLog.length; race.cardLog.forEach(c => { cardSeen[c] = (cardSeen[c] || 0) + 1; });
    if (mode === 'versus') {
      ok(race.humans.every(h => race.turnsTaken[h] === race.turnsTaken[0]), 'versus: both players had equal turns');
      ok(race.draw || (race.winner !== null && race.racers[race.winner].pos === L.FINISH), 'versus: winner at finish or draw');
      if (race.draw) stats.draws++;
    } else ok(race.winner !== null && race.racers[race.winner].pos === L.FINISH, 'solo: winner at finish');
    stats[mode]++;
  }
}
// Και οι δύο παίκτες τερματίζουν όταν απαντούν σωστά (100%, και 70%) και με τυχαία απάντηση εντός ορίου
for (const acc of [1, 0.7, 0.3]) for (let i = 0; i < 200; i++) {
  const race = L.simulateRace('versus', rng, { acc });
  ok(race.over && race.racers.some(r => r.pos === L.FINISH) && race.racers.every(r => r.pos <= L.FINISH), 'versus acc ' + acc + ' finishes');
  const rs = L.simulateRace('solo', rng, { acc, champ: 2 }); ok(rs.over, 'solo acc ' + acc + ' finishes');
}
// Σε σχεδόν τέλειο παιχνίδι ο παίκτης νικά τον πιο εύκολο αντίπαλο
{ let w = 0; for (let i = 0; i < 300; i++) { const rc = L.simulateRace('solo', rng, { acc: 0.9, champ: 0 }); if (rc.winner === 0) w++; } ok(w > 200, 'strong player beats easy AI (' + w + '/300)'); }
{ let w = 0; for (let i = 0; i < 300; i++) { const rc = L.simulateRace('solo', rng, { acc: 0.1, champ: 2 }); if (rc.winner === 0) w++; } ok(w < 60, 'weak player rarely beats hard AI (' + w + '/300)'); }
for (const c of L.CARDS) ok(cardSeen[c.id] > 0, 'card ' + c.id + ' is actually drawn in simulation');
ok(L.champStars(9) === 3 && L.champStars(7) === 2 && L.champStars(5) === 1 && L.champStars(3) === 0, 'champStars');

console.log('bank: ' + L.BANK.length + ' items', JSON.stringify(byT), 'plain mc ' + Math.round(100 * plain / L.BANK.length) + '%');
console.log('by chapter:', JSON.stringify(byCh));
console.log('sim cards drawn:', JSON.stringify(cardSeen), 'versus draws:', stats.draws, 'max swaps/race:', stats.swapMax);
console.log(n + ' assertions, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
