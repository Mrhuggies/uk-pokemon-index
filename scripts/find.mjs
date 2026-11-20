// Look up TCGdex card ids and current GBP prices: node scripts/find.mjs "Charizard VMAX, Blaine's Charizard"
import { TCGDEX, toRecord, getFx, pool, fetchCard } from '../lib/core.js';
const get = async (u, t) => { const r = await fetch(u); if (!r.ok) throw new Error(`${r.status} ${u}`); return t ? r.text() : r.json(); };
const fx = (await getFx((u) => get(u, 1), (u) => get(u))).rate;
for (const q of (process.argv[2] || '').split(',').map((s) => s.trim()).filter(Boolean)) {
  const p = new URLSearchParams({ name: q, 'pagination:page': '1', 'pagination:itemsPerPage': '60' });
  const briefs = await get(`${TCGDEX}/cards?${p}`);
  const cards = (await pool(briefs, 8, (b) => fetchCard(get, b.id))).filter(Boolean).map((c) => toRecord(c, fx));
  cards.sort((a, b) => (b.gbp ?? -1) - (a.gbp ?? -1));
  console.log(`\n== ${q} (${cards.length} cards)`);
  for (const r of cards.slice(0, 25)) console.log([r.id, r.name, r.set, r.rarity, r.gbp == null ? 'no price' : '£' + r.gbp].join(' | '));
}
