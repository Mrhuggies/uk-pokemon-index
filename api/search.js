// Vercel function: live card search with prices in GBP. Optional; the site falls back to calling TCGdex directly.
import { TCGDEX, toRecord, pool, fetchCard, getFx } from '../lib/core.js';

const get = async (url, type) => { const r = await fetch(url, { headers: { 'user-agent': 'uk-pokemon-index' } }); if (!r.ok) throw new Error(`${r.status} ${url}`); return type === 'text' ? r.text() : r.json(); };
const fetchJson = (u) => get(u, 'json'); const fetchText = (u) => get(u, 'text');
const json = (b, s = 200, c = 'no-store') => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': c } });

export async function GET(request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  try {
    const fxParam = parseFloat(url.searchParams.get('fx'));
    const fx = fxParam > 0.5 && fxParam < 1.2 ? fxParam : (await getFx(fetchText, fetchJson)).rate;
    if (q.length < 2) return json({ error: 'query too short' }, 400);
    const params = new URLSearchParams({ name: q, 'sort:field': 'id', 'sort:order': 'DESC', 'pagination:page': '1', 'pagination:itemsPerPage': '30' });
    const briefs = await fetchJson(`${TCGDEX}/cards?${params}`);
    const cards = await pool((Array.isArray(briefs) ? briefs : []).slice(0, 18), 6, (b) => fetchCard(fetchJson, b.id));
    const results = cards.filter(Boolean).map((c) => toRecord(c, fx, 'normal')).sort((a, b) => (b.gbp ?? -1) - (a.gbp ?? -1));
    return json({ fx, q, results }, 200, 'public, s-maxage=1800');
  } catch (e) {
    return json({ error: String(e?.message || e) }, 502);
  }
}
