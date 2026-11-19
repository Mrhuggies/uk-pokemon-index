import { runUpdate } from '../lib/core.js';
import { BASKET } from '../lib/basket.js';
import fs from 'node:fs';
const days = +process.argv[2] || 40;
const mem = {}; const store = { read: async (n) => mem[n] ? JSON.parse(mem[n]) : null, write: async (n, o) => { mem[n] = JSON.stringify(o); } };
mem['watchlist.json'] = JSON.stringify({ cards: [{ id: 'swsh7-215', qty: 1, cost: 450 }, { id: 'base1-4', qty: 2, cost: 300 }, { id: 'zz-1' }] });
let day = 0; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const base = {}; const drift = {};
const fetchText = async () => `<Cube time='2026-11-19'><Cube currency='GBP' rate='0.8432'/>`;
const fetchJson = async (url) => {
  const id = decodeURIComponent(url.split('/').pop());
  if (id === 'ex15-100' || id === 'zz-1') throw new Error('404');
  base[id] ??= 5 + rnd() * 900; drift[id] ??= (rnd() - 0.45) * 0.01;
  base[id] *= Math.exp(drift[id] + (rnd() - 0.5) * 0.04);
  const p = base[id];
  return { id, name: id.startsWith('base') ? 'Charizard' : id.startsWith('swsh') ? 'Umbreon VMAX' : 'Charizard ex', localId: id.split('-')[1], rarity: 'Rare Holo', set: { id: id.split('-')[0], name: 'Set ' + id.split('-')[0] }, image: null,
    pricing: { cardmarket: { updated: 'x', trend: p, avg1: p * 0.99, avg7: p * (0.95 + rnd() * 0.1), avg30: p * (0.85 + rnd() * 0.25), low: p * 0.8 } } };
};
for (day = 0; day < days; day++) await runUpdate({ fetchJson, fetchText, store, basket: BASKET, now: new Date(Date.UTC(2026, 9, 11 + day, 5)) });
const out = { latest: JSON.parse(mem['latest.json']), history: JSON.parse(mem['history.json']), watchlist: JSON.parse(mem['watchlist.json']), basketSize: BASKET.length };
fs.writeFileSync(`test/fixture-${days}.json`, JSON.stringify(out));
console.log('days', out.history.dates.length, 'all idx last', out.history.idx.all.at(-1), 'failed', out.latest.failed.length);
