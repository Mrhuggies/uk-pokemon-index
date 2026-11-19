// Core logic for the UK Pokémon Card Index.
// Pure functions take injected I/O (fetchJson, fetchText, store) so they can be tested offline.

export const TCGDEX = 'https://api.tcgdex.net/v2/en';
export const BASE_INDEX = 1000;
export const SEGMENTS = ['all', 'vintage', 'modern', 'current'];
const CLAMP = 0.4; // max |ln(daily relative)| per card, guards against thin-market spikes

export function londonDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const num = (v) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null);

// Choose the headline EUR price for a card from TCGdex's Cardmarket block.
// variant 'holo' = Cardmarket's foil (reverse holo) price guide.
export function pickPrice(cm, variant = 'normal') {
  if (!cm) return null;
  const sfx = variant === 'holo' ? '-holo' : '';
  const alt = variant === 'holo' ? '' : '-holo';
  const get = (s) => ({
    trend: num(cm['trend' + s]), avg: num(cm['avg' + s]), low: num(cm['low' + s]),
    avg1: num(cm['avg1' + s]), avg7: num(cm['avg7' + s]), avg30: num(cm['avg30' + s]),
  });
  let p = get(sfx);
  let used = variant;
  if (!p.trend && !p.avg30 && !p.avg) { p = get(alt); used = variant === 'holo' ? 'normal' : 'holo'; }
  const eur = p.trend ?? p.avg30 ?? p.avg;
  if (!eur) return null;
  return { eur, ...p, variant: used, updated: cm.updated || null };
}

export function cardImage(card) {
  return card?.image ? card.image + '/low.webp' : null;
}

// Convert a TCGdex card into the compact record the site uses.
export function toRecord(card, fx, variant) {
  const p = pickPrice(card?.pricing?.cardmarket, variant);
  const r2 = (v) => (v == null ? null : Math.round(v * fx * 100) / 100);
  return {
    id: card.id,
    name: card.name,
    set: card.set?.name || '',
    setId: card.set?.id || '',
    number: card.localId,
    rarity: card.rarity || '',
    img: cardImage(card),
    gbp: p ? r2(p.eur) : null,
    eur: p ? p.eur : null,
    avg1: p ? r2(p.avg1) : null,
    avg7: p ? r2(p.avg7) : null,
    avg30: p ? r2(p.avg30) : null,
    low: p ? r2(p.low) : null,
    variant: p?.variant || variant || 'normal',
    priceUpdated: p?.updated || null,
  };
}

export async function getFx(fetchText, fetchJson) {
  try {
    const xml = await fetchText('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml');
    const m = xml.match(/currency=['"]GBP['"]\s+rate=['"]([\d.]+)['"]/);
    const t = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/);
    if (m) return { rate: parseFloat(m[1]), date: t ? t[1] : null, source: 'ECB euro reference rate' };
  } catch (e) { /* fall through */ }
  const j = await fetchJson('https://api.frankfurter.app/latest?from=EUR&to=GBP');
  return { rate: j.rates.GBP, date: j.date, source: 'Frankfurter (ECB data)' };
}

export async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  });
  await Promise.all(workers);
  return out;
}

export function emptyHistory() {
  return { dates: [], fx: [], idx: Object.fromEntries(SEGMENTS.map((s) => [s, []])), n: Object.fromEntries(SEGMENTS.map((s) => [s, []])), cards: {} };
}

// Append (or replace) the point for `date` and chain-link every segment index.
export function applyDay(history, date, fx, prices, segOf) {
  const h = history;
  let pos = h.dates.indexOf(date);
  if (pos === -1) {
    pos = h.dates.length;
    h.dates.push(date); h.fx.push(fx);
    for (const s of SEGMENTS) { h.idx[s].push(null); h.n[s].push(0); }
    for (const id of Object.keys(h.cards)) h.cards[id].push(null);
  } else {
    h.fx[pos] = fx;
  }
  for (const [id, gbp] of Object.entries(prices)) {
    if (!h.cards[id]) h.cards[id] = new Array(h.dates.length).fill(null);
    h.cards[id][pos] = gbp;
  }
  for (const s of SEGMENTS) {
    if (pos === 0) { h.idx[s][0] = BASE_INDEX; h.n[s][0] = Object.keys(prices).filter((id) => s === 'all' || segOf[id] === s).length; continue; }
    const prev = h.idx[s][pos - 1];
    let sum = 0, k = 0;
    for (const [id, series] of Object.entries(h.cards)) {
      const seg = segOf[id];
      if (!seg || (s !== 'all' && seg !== s)) continue;
      const a = series[pos - 1], b = series[pos];
      if (a > 0 && b > 0) { sum += Math.max(-CLAMP, Math.min(CLAMP, Math.log(b / a))); k++; }
    }
    const base = prev ?? BASE_INDEX;
    h.idx[s][pos] = Math.round(base * (k ? Math.exp(sum / k) : 1) * 100) / 100;
    h.n[s][pos] = k;
  }
  return h;
}

// Geometric-mean momentum of current price against Cardmarket's rolling averages.
export function momentum(records) {
  const g = (key) => {
    let s = 0, k = 0;
    for (const r of records) if (r.gbp > 0 && r[key] > 0) { s += Math.log(r.gbp / r[key]); k++; }
    return k ? Math.round((Math.exp(s / k) - 1) * 10000) / 100 : null;
  };
  return { vs7: g('avg7'), vs30: g('avg30') };
}

export async function fetchCard(fetchJson, id) {
  try { return await fetchJson(`${TCGDEX}/cards/${encodeURIComponent(id)}`); } catch (e) { return null; }
}

// Full nightly run. store: { read(name) -> obj|null, write(name, obj) }
export async function runUpdate({ fetchJson, fetchText, store, basket, watch: watchIn, repo = null, now = new Date(), log = () => {} }) {
  const date = londonDate(now);
  const fx = await getFx(fetchText, fetchJson);
  const watch = watchIn || (await store.read('watchlist.json')) || { cards: [] };
  const history = (await store.read('history.json')) || emptyHistory();

  const entries = [
    ...basket.map((b) => ({ ...b, inIndex: true })),
    ...watch.cards.filter((w) => !basket.some((b) => b.id === w.id)).map((w) => ({ id: w.id, variant: w.variant, inIndex: false })),
  ];
  const failed = [];
  const records = (await pool(entries, 6, async (e) => {
    const card = await fetchCard(fetchJson, e.id);
    if (!card) { failed.push({ id: e.id, reason: 'not found' }); return null; }
    const r = toRecord(card, fx.rate, e.variant);
    if (r.gbp == null) failed.push({ id: e.id, reason: 'no Cardmarket price' });
    return { ...r, segment: e.segment || null, inIndex: e.inIndex };
  })).filter(Boolean);

  const segOf = {}; const prices = {};
  for (const r of records) {
    if (r.gbp == null) continue;
    prices[r.id] = r.gbp;
    if (r.inIndex) segOf[r.id] = r.segment;
  }
  applyDay(history, date, fx.rate, prices, segOf);

  const segMomentum = {};
  for (const s of SEGMENTS) segMomentum[s] = momentum(records.filter((r) => r.inIndex && (s === 'all' || r.segment === s)));

  const latest = {
    date, generatedAt: now.toISOString(), fx, repo, watchlist: watch,
    momentum: segMomentum,
    records, failed,
    counts: { basket: basket.length, priced: records.filter((r) => r.inIndex && r.gbp != null).length, watch: watch.cards.length },
  };
  await store.write('history.json', history);
  await store.write('latest.json', latest);
  log(`updated ${date}: ${Object.keys(prices).length} prices, ${failed.length} failed, fx ${fx.rate}`);
  return latest;
}
