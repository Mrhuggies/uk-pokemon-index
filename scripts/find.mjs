// Look up TCGdex card ids and current GBP prices.
//   node scripts/find.mjs "Umbreon VMAX, base5:Dratini, gym1:52"
// "name" searches every set; "setId:name" searches one set; "setId:number" finds a card by its number.
import { TCGDEX, toRecord, getFx, pool, fetchCard } from '../lib/core.js';
const get = async (u, t) => { const r = await fetch(u); if (!r.ok) throw new Error(`${r.status} ${u}`); return t ? r.text() : r.json(); };
const fx = (await getFx((u) => get(u, 1), (u) => get(u))).rate;
const setCache = {};
const line = (r, c) => [r.id, r.name, `${r.set} #${r.number}`, r.rarity, c?.variants ? Object.entries(c.variants).filter(([, v]) => v).map(([k]) => k).join('/') : '', r.gbp == null ? 'no price' : '£' + r.gbp].join(' | ');
for (const q of (process.argv[2] || '').split(',').map((s) => s.trim()).filter(Boolean)) {
  const m = q.match(/^([a-z0-9.\-]+):(.+)$/i);
  if (m) {
    const [, setId, what] = m;
    try { setCache[setId] ||= await get(`${TCGDEX}/sets/${encodeURIComponent(setId)}`); } catch { console.log(`\n== ${q}: set "${setId}" not found`); continue; }
    const set = setCache[setId];
    const w = what.trim().toLowerCase();
    const hits = set.cards.filter((c) => /^\d+$/.test(w) ? String(+c.localId) === String(+w) : c.name.toLowerCase().includes(w));
    console.log(`\n== ${q} (${set.name}, ${hits.length} match${hits.length === 1 ? '' : 'es'})`);
    const full = await pool(hits, 6, (c) => fetchCard(get, c.id));
    full.forEach((c) => c && console.log(line(toRecord(c, fx), c)));
    continue;
  }
  const p = new URLSearchParams({ name: q, 'pagination:page': '1', 'pagination:itemsPerPage': '60' });
  const briefs = await get(`${TCGDEX}/cards?${p}`);
  const cards = (await pool(briefs, 8, (b) => fetchCard(get, b.id))).filter(Boolean);
  const recs = cards.map((c) => [toRecord(c, fx), c]).sort((a, b) => (b[0].gbp ?? -1) - (a[0].gbp ?? -1));
  console.log(`\n== ${q} (${cards.length} cards)`);
  for (const [r, c] of recs.slice(0, 25)) console.log(line(r, c));
}
