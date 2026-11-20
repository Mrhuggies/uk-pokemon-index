import { runUpdate, pickPrice } from '../lib/core.js';
import assert from 'node:assert';
const mem = {}; const store = { read: async (n) => mem[n] ? JSON.parse(mem[n]) : null, write: async (n, o) => { mem[n] = JSON.stringify(o); } };
const basket = [{ id: 'a-1', segment: 'vintage' }, { id: 'b-1', segment: 'modern' }, { id: 'c-1', segment: 'current' }, { id: 'bad-1', segment: 'current' }];
let day = 0; const mult = [1, 1.1, 1.21];
const fetchText = async () => `<Cube time='2026-11-19'><Cube currency='GBP' rate='0.85'/>`;
const fetchJson = async (url) => {
  const id = decodeURIComponent(url.split('/').pop());
  if (id === 'bad-1') throw new Error('404');
  const base = { 'a-1': 100, 'b-1': 50, 'c-1': 20, 'w-1': 10 }[id];
  const m = id === 'c-1' ? 1 : mult[day];
  return { id, name: id, localId: '1', set: { id: 'x', name: 'Set X' }, image: 'https://assets.tcgdex.net/en/x/x/1',
    pricing: { cardmarket: { updated: 'x', unit: 'EUR', trend: base * m, avg1: base, avg7: base * m, avg30: base * m * 0.8 } } };
};
mem['watchlist.json'] = JSON.stringify({ cards: [{ id: 'w-1', variant: 'normal' }] });
for (day = 0; day < 3; day++) {
  const l = await runUpdate({ fetchJson, fetchText, store, basket, now: new Date(Date.UTC(2026, 10, 19 + day, 5)) });
  if (day === 0) { assert.equal(l.failed.length, 1); assert.equal(l.records.find(r => r.id === 'a-1').gbp, 85); assert.equal(l.records.find(r => r.id === 'a-1').trend, 85); }
}
day = 2; // re-run the last day to ensure replacement not duplication
await runUpdate({ fetchJson, fetchText, store, basket, now: new Date(Date.UTC(2026, 10, 21, 6)) });
const h = JSON.parse(mem['history.json']);
console.log(h.dates, h.idx);
assert.deepEqual(h.dates, ['2026-11-19', '2026-11-20', '2026-11-21']);
assert.equal(h.idx.vintage[2], 1210);
assert.equal(h.idx.current[2], 1000);
assert.ok(Math.abs(h.idx.all[1] - 1000 * Math.exp((2 * Math.log(1.1)) / 3)) < 0.02);
assert.ok(h.cards['w-1'] && !('w-1' in {}));
const L = JSON.parse(mem['latest.json']); console.log(L.momentum.all, L.counts);
assert.equal(pickPrice({ 'trend-holo': 5 }).variant, 'holo');
console.log('ALL TESTS PASS');
