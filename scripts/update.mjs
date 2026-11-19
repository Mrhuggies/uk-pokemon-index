// Nightly job: fetch Cardmarket prices via TCGdex, convert to GBP, update the index files in public/data.
import fs from 'node:fs/promises';
import path from 'node:path';
import { runUpdate } from '../lib/core.js';
import { BASKET } from '../lib/basket.js';

const DATA = path.resolve('public/data');
const WATCH = path.resolve('watch');
const UA = { 'user-agent': 'uk-pokemon-index (github actions)' };

async function retry(fn, tries = 3) {
  for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= tries - 1 || /\b404\b/.test(e.message)) throw e; await new Promise((r) => setTimeout(r, 800 * (i + 1))); } }
}
const fetchJson = (url) => retry(async () => { const r = await fetch(url, { headers: { ...UA, accept: 'application/json' } }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); });
const fetchText = (url) => retry(async () => { const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.text(); });

const store = {
  async read(name) { try { return JSON.parse(await fs.readFile(path.join(DATA, name), 'utf8')); } catch { return null; } },
  async write(name, obj) { await fs.mkdir(DATA, { recursive: true }); await fs.writeFile(path.join(DATA, name), JSON.stringify(obj)); },
};

// Each file in watch/ is one tracked card: watch/<tcgdex-id>.json with optional {qty, cost, variant}.
async function readWatch() {
  const cards = [];
  let files = [];
  try { files = await fs.readdir(WATCH); } catch {}
  for (const f of files.filter((f) => f.endsWith('.json')).sort()) {
    const id = f.slice(0, -5);
    let meta = {};
    try { const t = (await fs.readFile(path.join(WATCH, f), 'utf8')).trim(); meta = t ? JSON.parse(t) : {}; } catch (e) { console.warn(`watch/${f}: bad JSON, using defaults`); }
    const n = (v) => (v === '' || v == null || isNaN(+v) ? null : +v);
    cards.push({ id, qty: n(meta.qty), cost: n(meta.cost), variant: meta.variant === 'holo' ? 'holo' : 'normal' });
  }
  return { cards };
}

const watch = await readWatch();
const latest = await runUpdate({ fetchJson, fetchText, store, basket: BASKET, watch, repo: process.env.GITHUB_REPOSITORY || null, log: console.log });
console.log(`Index cards priced: ${latest.counts.priced}/${latest.counts.basket}; watchlist: ${watch.cards.length}`);
if (latest.failed.length) console.log('Not priced:\n' + latest.failed.map((f) => `  ${f.id}: ${f.reason}`).join('\n'));
if (latest.counts.priced < latest.counts.basket * 0.5) { console.error('Fewer than half the index cards priced; failing so the bad day is not committed.'); process.exit(1); }
