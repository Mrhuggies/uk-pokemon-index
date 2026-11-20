import { runUpdate } from '../lib/core.js';
import { BASKET } from '../lib/basket.js';
import { makeMock, memStore } from './mock.mjs';
import fs from 'node:fs';
const days = +process.argv[2] || 40;
const m = makeMock({ nPerSet: 120 }); const store = memStore();
const basket = BASKET.slice(0, 3).map((b, i) => ({ ...b, id: ['base1-4', 'swsh7-15', 'sv03.5-1'][i] })).concat([{ id: 'base1-9', segment: 'vintage' }, { id: 'swsh7-25', segment: 'modern' }, { id: 'sv03.5-11', segment: 'current' }]);
const watch = { cards: [{ id: 'swsh7-5', qty: 1, cost: 450 }, { id: 'base1-1', qty: 2, cost: 30 }, { id: 'sv03.5-21' }] };
for (let d = 0; d < days; d++) { m.state.day = d; await runUpdate({ ...m, store, basket, watch, now: new Date(Date.UTC(2026, 9, 12 + d, 5)), concurrency: 32 }); }
fs.mkdirSync(`test/site-${days}/data`, { recursive: true });
for (const n of ['latest', 'history', 'names']) fs.writeFileSync(`test/site-${days}/data/${n}.json`, store.mem[`public/data/${n}.json`]);
console.log(days, 'days ok');
