import assert from 'node:assert';
import { runUpdate, step, pickPrice, eraOf, MIN_GBP } from '../lib/core.js';
import { makeMock, memStore } from './mock.mjs';

// step(): geometric mean with clamp
let st = step({ a: 10, b: 10 }, { a: 11, b: 12.1 }, ['a', 'b']);
assert.ok(Math.abs(st.rel - Math.sqrt(1.1 * 1.21)) < 1e-9 && st.k === 2 && st.adv === 2);
st = step({ a: 10 }, { a: 100 }, ['a']); assert.ok(Math.abs(st.rel - Math.exp(0.4)) < 1e-9, 'clamped');
assert.equal(eraOf('1999-01-09'), 'vintage'); assert.equal(eraOf('2021-08-27'), 'modern'); assert.equal(eraOf('2023-09-22'), 'current');
assert.equal(pickPrice({ 'trend-holo': 5 }).variant, 'holo');
assert.equal(pickPrice({ trend: 2, avg7: 17, avg30: 20 }).eur, 17, 'median');

const m = makeMock(); const store = memStore();
const basket = [{ id: 'base1-1', segment: 'vintage' }, { id: 'swsh7-5', segment: 'modern' }, { id: 'nope-1', segment: 'current' }];
const watch = { cards: [{ id: 'sv03.5-6', qty: 2, cost: 10, variant: 'normal' }] };
const run = (d, h = 5) => { m.state.day = d; return runUpdate({ ...m, store, basket, watch, now: new Date(Date.UTC(2026, 10, 20 + d, h)) }); };

let L = await run(0);
assert.equal(L.counts.universe, 91, 'pocket set excluded, unknown basket id appended');
assert.equal(L.counts.priced, 90);
assert.equal(L.breadth, null);
let H = JSON.parse(store.mem['public/data/history.json']);
assert.deepEqual(H.idx.all, [1000]); assert.deepEqual(H.idx.blue, [1000]);
assert.ok(L.failed.some((f) => f.id === 'nope-1'));
assert.ok(L.records.find((r) => r.id === 'sv03.5-6').inWatch);
const names = JSON.parse(store.mem['public/data/names.json']);
assert.ok(names.find((n) => n[0] === 'Charizard')[1] === 9, 'names counted across non-pocket sets');

L = await run(1);
H = JSON.parse(store.mem['public/data/history.json']);
const cur = JSON.parse(store.mem['state/prices-cur.json']), prev = JSON.parse(store.mem['state/prices-prev.json']);
const ids = Object.keys(prev.prices).filter((id) => prev.prices[id] >= MIN_GBP);
const exp = 1000 * step(prev.prices, cur.prices, ids).rel;
assert.ok(Math.abs(H.idx.all[1] - exp) < 0.01, `all ${H.idx.all[1]} vs ${exp}`);
assert.ok(L.breadth && L.breadth.adv + L.breadth.dec + L.breadth.flat === H.n.all[1]);
assert.equal(L.movers.basis, 'day');
const all1 = H.idx.all[1];

// Same-day re-run must link from the previous day, not from itself, and not duplicate the date.
await run(1, 9);
H = JSON.parse(store.mem['public/data/history.json']);
assert.deepEqual(H.dates, ['2026-11-20', '2026-11-21']);
assert.ok(Math.abs(H.idx.all[1] - all1) < 0.01, 're-run stable');
assert.equal(JSON.parse(store.mem['state/prices-prev.json']).date, '2026-11-20');

await run(2);
H = JSON.parse(store.mem['public/data/history.json']);
assert.equal(H.dates.length, 3); assert.equal(H.cards['sv03.5-6'].length, 3);
assert.ok(L.sets.length >= 2 && L.bands.length === 7);
console.log('index', H.idx, 'breadth', H.breadth);
console.log('ALL TESTS PASS');
{
  const H2 = JSON.parse(store.mem['public/data/history.json']);
  assert.equal(H2.est.anchor, '2026-11-20'); assert.equal(H2.est.points.all.length, 2);
  assert.ok(H2.est.points.all.every(([o, v]) => o < 0 && v > 0));
  console.log('est', JSON.stringify(H2.est.points.all));
}
