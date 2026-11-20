// Core logic for the UK Pokémon Card Index.
// Pure functions take injected I/O (fetchJson, fetchText, store) so they can be tested offline.

export const TCGDEX = 'https://api.tcgdex.net/v2/en';
export const BASE_INDEX = 1000;
export const SEGMENTS = ['all', 'vintage', 'modern', 'current', 'blue'];
export const MARKET_SEGS = ['all', 'vintage', 'modern', 'current'];
export const MIN_GBP = 3;     // a card joins the market index once its previous price is at least this
export const MOVER_GBP = 10;  // movers lists ignore cards below this
export const SET_MIN = 15;    // sets need this many £3+ cards to be ranked
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
  // Headline price = median of trend, 7-day and 30-day averages. Cardmarket's trend alone swings
  // hard on vintage cards because listings mix conditions; the median damps single-source spikes.
  const xs = [p.trend, p.avg7, p.avg30].filter(Boolean).sort((a, b) => a - b);
  const eur = xs.length === 3 ? xs[1] : xs.length === 2 ? (xs[0] + xs[1]) / 2 : xs[0] ?? p.avg;
  if (!eur) return null;
  return { eur, ...p, variant: used, updated: cm.updated || null };
}

export function cardImage(card) {
  return card?.image ? card.image + '/low.webp' : null;
}

// TCGplayer (US) market price in USD, used only when Cardmarket has nothing. edition: '1st' or 'unlimited'.
export function tcgplayerPrice(tp, edition = 'unlimited') {
  if (!tp) return null;
  const order = edition === '1st'
    ? ['1st-edition-holofoil', '1st-edition', '1st-edition-normal']
    : ['unlimited-holofoil', 'unlimited', 'holofoil', 'normal', 'unlimited-normal', 'reverse-holofoil'];
  for (const k of order) { const v = tp[k]; const m = num(v?.marketPrice) ?? num(v?.midPrice); if (m) return m; }
  return null;
}

// Convert a TCGdex card into the compact record the site uses. usd = GBP per US dollar.
export function toRecord(card, fx, variant, usd = null) {
  const p = pickPrice(card?.pricing?.cardmarket, variant);
  const r2 = (v) => (v == null ? null : Math.round(v * fx * 100) / 100);
  const u2 = (v) => (v == null || !usd ? null : Math.round(v * usd * 100) / 100);
  const tp = card?.pricing?.tcgplayer;
  const usUnl = u2(tcgplayerPrice(tp, 'unlimited')), us1st = u2(tcgplayerPrice(tp, '1st'));
  return {
    id: card.id,
    name: card.name,
    set: card.set?.name || '',
    setId: card.set?.id || '',
    number: card.localId,
    rarity: card.rarity || '',
    img: cardImage(card),
    gbp: p ? r2(p.eur) : usUnl,
    source: p ? 'cardmarket' : usUnl != null ? 'tcgplayer' : null,
    usGbp: usUnl, us1stGbp: us1st,
    eur: p ? Math.round(p.eur * 100) / 100 : null,
    trend: p ? r2(p.trend) : null,
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
    const u = xml.match(/currency=['"]USD['"]\s+rate=['"]([\d.]+)['"]/);
    if (m) return { rate: parseFloat(m[1]), usd: u ? Math.round(parseFloat(m[1]) / parseFloat(u[1]) * 1e5) / 1e5 : null, date: t ? t[1] : null, source: 'ECB euro reference rate' };
  } catch (e) { /* fall through */ }
  const j = await fetchJson('https://api.frankfurter.app/latest?from=EUR&to=GBP,USD');
  return { rate: j.rates.GBP, usd: j.rates.USD ? Math.round(j.rates.GBP / j.rates.USD * 1e5) / 1e5 : null, date: j.date, source: 'Frankfurter (ECB data)' };
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

export const eraOf = (date) => { if (!date) return null; const y = +String(date).slice(0, 4); return y < 2010 ? 'vintage' : y < 2023 ? 'modern' : 'current'; };
const clampLog = (b, a) => Math.max(-CLAMP, Math.min(CLAMP, Math.log(b / a)));
const r2 = (v) => Math.round(v * 100) / 100;

// Geometric-mean momentum of 7-day average against 30-day average, as a % change.
export function momentumOf(list) {
  let s = 0, k = 0;
  for (const r of list) if (r.a7 > 0 && r.a30 > 0) { s += Math.log(r.a7 / r.a30); k++; }
  return { vs30: k ? r2((Math.exp(s / k) - 1) * 100) : null, n: k };
}

// One chain-link step: geometric mean of clamped daily relatives across ids priced on both days.
export function step(base, today, ids) {
  let s = 0, k = 0, adv = 0, dec = 0;
  for (const id of ids) {
    const a = base?.[id], b = today[id];
    if (a > 0 && b > 0) { const l = clampLog(b, a); s += l; k++; if (l > 0.005) adv++; else if (l < -0.005) dec++; }
  }
  return { rel: k ? Math.exp(s / k) : 1, k, adv, dec, flat: k - adv - dec };
}

export function emptyHistory() {
  const o = () => Object.fromEntries(SEGMENTS.map((s) => [s, []]));
  return { version: 2, dates: [], fx: [], idx: o(), n: o(), breadth: { adv: [], dec: [], flat: [] }, cards: {} };
}

// Every English card outside TCG Pocket, with its set's release date.
export async function loadUniverse(fetchJson) {
  const list = await fetchJson(`${TCGDEX}/sets`);
  const sets = (await pool(list, 8, (s) => fetchJson(`${TCGDEX}/sets/${encodeURIComponent(s.id)}`).catch(() => null))).filter(Boolean);
  const setInfo = {}, cards = [];
  for (const s of sets) {
    const serie = s.serie || {};
    if (serie.id === 'tcgp' || /pocket/i.test(serie.name || '')) continue;
    setInfo[s.id] = { id: s.id, name: s.name, date: s.releaseDate || null, serie: serie.name || '', logo: s.logo ? s.logo + '.webp' : null };
    for (const c of s.cards || []) cards.push({ id: c.id, name: c.name, setId: s.id });
  }
  return { setInfo, cards };
}

// Full nightly run. store: { read(path) -> obj|null, write(path, obj) }, paths relative to the repo root.
export async function runUpdate({ fetchJson, fetchText, store, basket, watch: watchIn, repo = null, now = new Date(), log = () => {}, concurrency = 16 }) {
  const date = londonDate(now);
  const fx = await getFx(fetchText, fetchJson);
  const watch = watchIn || (await store.read('public/data/watchlist.json')) || { cards: [] };
  let history = await store.read('public/data/history.json');
  if (!history || history.version !== 2) history = emptyHistory();

  const { setInfo, cards } = await loadUniverse(fetchJson);
  const known = new Set(cards.map((c) => c.id));
  const special = new Map(); // id -> { variant, segment, inBasket }
  for (const b of basket) special.set(b.id, { variant: 'normal', segment: b.segment, inBasket: true });
  for (const w of watch.cards) special.set(w.id, { ...(special.get(w.id) || { segment: null, inBasket: false }), variant: w.variant || 'normal', edition: w.edition || null, inWatch: true });
  for (const id of special.keys()) if (!known.has(id)) cards.push({ id, name: id, setId: null });
  log(`universe: ${cards.length} cards in ${Object.keys(setInfo).length} sets`);

  const today = {}, compact = [], records = [], failed = [];
  let fetched = 0;
  await pool(cards, concurrency, async (c) => {
    const card = await fetchCard(fetchJson, c.id);
    if (++fetched % 2000 === 0) log(`  fetched ${fetched}/${cards.length}`);
    const sp = special.get(c.id);
    if (!card) { if (sp) failed.push({ id: c.id, reason: 'not found' }); return; }
    const rec = toRecord(card, fx.rate, 'normal', fx.usd);
    if (rec.gbp != null && rec.source === 'cardmarket') {
      today[c.id] = rec.gbp;
      compact.push({ id: c.id, name: card.name, setId: card.set?.id || c.setId, rarity: card.rarity || '', img: rec.img, gbp: rec.gbp, a1: rec.avg1, a7: rec.avg7, a30: rec.avg30, tr: rec.trend });
    }
    if (sp) {
      let r = sp.variant === 'holo' ? toRecord(card, fx.rate, 'holo', fx.usd) : rec;
      if (sp.edition === '1st' && r.us1stGbp != null) r = { ...r, gbp: r.us1stGbp, source: 'tcgplayer-1st', avg1: null, avg7: null, avg30: null, trend: null };
      if (r.gbp == null) failed.push({ id: c.id, reason: 'no Cardmarket price' });
      records.push({ ...r, setDate: setInfo[r.setId]?.date || null, segment: sp.segment || eraOf(setInfo[r.setId]?.date), inIndex: !!sp.inBasket, inWatch: !!sp.inWatch });
    }
  });
  log(`priced ${compact.length} of ${cards.length}`);
  if (compact.length < cards.length * 0.25 || records.filter((r) => r.inIndex && r.gbp != null).length < basket.length * 0.5) throw new Error(`Too few prices (${compact.length}); not saving this run.`);

  // Previous-day prices for chain-linking. A same-day re-run links from the day before, not itself.
  let cur = await store.read('state/prices-cur.json'), prev = await store.read('state/prices-prev.json');
  const base = cur && cur.date === date ? prev : cur;
  const basePrices = base && base.date < date ? base.prices : null;

  const eraOfId = {};
  for (const c of compact) eraOfId[c.id] = eraOf(setInfo[c.setId]?.date);
  const marketIds = basePrices ? Object.keys(basePrices).filter((id) => basePrices[id] >= MIN_GBP) : [];
  const idsFor = (s) => s === 'blue' ? basket.map((b) => b.id) : s === 'all' ? marketIds : marketIds.filter((id) => eraOfId[id] === s);

  let pos = history.dates.indexOf(date);
  if (pos === -1) {
    pos = history.dates.length;
    history.dates.push(date); history.fx.push(fx.rate);
    for (const s of SEGMENTS) { history.idx[s].push(null); history.n[s].push(0); }
    for (const k of ['adv', 'dec', 'flat']) history.breadth[k].push(null);
    for (const id of Object.keys(history.cards)) history.cards[id].push(null);
  } else history.fx[pos] = fx.rate;

  for (const s of SEGMENTS) {
    const prevIdx = pos > 0 ? history.idx[s][pos - 1] : null;
    if (prevIdx == null || !basePrices) {
      history.idx[s][pos] = prevIdx ?? BASE_INDEX;
      history.n[s][pos] = s === 'blue' ? basket.filter((b) => today[b.id]).length : compact.filter((c) => c.gbp >= MIN_GBP && (s === 'all' || eraOfId[c.id] === s)).length;
      continue;
    }
    const st = step(basePrices, today, idsFor(s));
    history.idx[s][pos] = r2(prevIdx * st.rel);
    history.n[s][pos] = st.k;
    if (s === 'all') { history.breadth.adv[pos] = st.adv; history.breadth.dec[pos] = st.dec; history.breadth.flat[pos] = st.flat; }
  }
  for (const r of records) {
    if (r.gbp == null) continue;
    if (!history.cards[r.id]) history.cards[r.id] = new Array(history.dates.length).fill(null);
    history.cards[r.id][pos] = r.gbp;
  }

  // Back-estimate for the chart: Cardmarket's 30-day, 7-day and 1-day averages, as a geometric mean
  // ratio to today's price, placed at the middle of each window. Computed once, when history starts.
  if (!history.est) {
    const ratio = (list, key) => { let s = 0, k = 0; for (const c of list) if (c[key] > 0 && c.gbp > 0) { s += Math.max(-0.7, Math.min(0.7, Math.log(c[key] / c.gbp))); k++; } return k ? Math.exp(s / k) : null; };
    const pts = {};
    const groups = { all: compact.filter((c) => c.gbp >= MIN_GBP), blue: records.filter((r) => r.inIndex).map((r) => ({ gbp: r.gbp, a1: r.avg1, a7: r.avg7, a30: r.avg30 })) };
    for (const sg of ['vintage', 'modern', 'current']) groups[sg] = groups.all.filter((c) => eraOfId[c.id] === sg);
    for (const sg of SEGMENTS) {
      const lvl = history.idx[sg][pos];
      pts[sg] = [[-15, 'a30'], [-3.5, 'a7'], [-1, 'a1']].map(([off, key]) => { const r = ratio(groups[sg], key); return [off, r == null ? null : r2(lvl * r)]; });
    }
    history.est = { anchor: date, points: pts, note: 'Cardmarket 30-day, 7-day and 1-day averages relative to the anchor date, placed mid-window' };
  }

  // Momentum by segment across the whole priced market (cards at or above MIN_GBP today).
  const live = compact.filter((c) => c.gbp >= MIN_GBP);
  const momentum = {};
  for (const s of MARKET_SEGS) momentum[s] = momentumOf(s === 'all' ? live : live.filter((c) => eraOfId[c.id] === s));
  momentum.blue = momentumOf(records.filter((r) => r.inIndex).map((r) => ({ a7: r.avg7, a30: r.avg30 })));

  // Sets ranked by momentum.
  const bySet = {};
  for (const c of live) (bySet[c.setId] ||= []).push(c);
  const median = (xs) => { const v = xs.slice().sort((a, b) => a - b); const k = v.length >> 1; return v.length ? (v.length % 2 ? v[k] : (v[k - 1] + v[k]) / 2) : null; };
  const sets = Object.entries(bySet).filter(([, l]) => l.length >= SET_MIN).map(([id, l]) => {
    const logs = l.filter((c) => c.a7 > 0 && c.a30 > 0).map((c) => Math.log(c.a7 / c.a30)); const md = median(logs); const si = setInfo[id] || {};
    return { id, name: si.name || id, date: si.date, era: eraOf(si.date), logo: si.logo, n: l.length, mom: md == null ? null : r2((Math.exp(md) - 1) * 100), value: r2(l.reduce((a, c) => a + c.gbp, 0)) };
  }).filter((x) => x.mom != null).sort((a, b) => b.mom - a.mom);

  // Movers: day change once there is a previous day, otherwise 7d vs 30d.
  const cand = compact.filter((c) => c.gbp >= MOVER_GBP && c.a30 >= MOVER_GBP && (!basePrices || basePrices[c.id] >= MOVER_GBP));
  // Without a previous day, a move counts only when the 7-day average and the trend agree on direction,
  // and the smaller of the two is used, which filters out one-off sales on thin cards.
  const confirmed = (c) => { if (!(c.a7 > 0 && c.a30 > 0 && c.tr > 0)) return null; const a = c.a7 / c.a30 - 1, b = c.tr / c.a30 - 1; return Math.sign(a) === Math.sign(b) ? Math.sign(a) * Math.min(Math.abs(a), Math.abs(b)) * 100 : null; };
  const scored = cand.map((c) => ({ c, v: basePrices ? (basePrices[c.id] ? (c.gbp / basePrices[c.id] - 1) * 100 : null) : confirmed(c) }))
    .filter((x) => x.v != null && isFinite(x.v)).sort((a, b) => b.v - a.v);
  const mv = (x) => ({ id: x.c.id, name: x.c.name, set: setInfo[x.c.setId]?.name || '', rarity: x.c.rarity, img: x.c.img, gbp: x.c.gbp, avg7: x.c.a7, avg30: x.c.a30, chg: r2(x.v) });
  const seen = new Set(); const uniq = (l) => l.filter((x) => { const k = `${x.c.name}|${x.c.setId}|${x.c.gbp}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const movers = { basis: basePrices ? 'day' : 'momentum', up: uniq(scored.filter((x) => x.v > 0)).slice(0, 8).map(mv), down: uniq(scored.filter((x) => x.v < 0).reverse()).slice(0, 8).map(mv) };

  // Price bands: how much of the market sits where.
  const bands = [[3, 10], [10, 25], [25, 50], [50, 100], [100, 250], [250, 1000], [1000, Infinity]].map(([lo, hi]) => {
    const l = live.filter((c) => c.gbp >= lo && c.gbp < hi);
    return { lo, hi: hi === Infinity ? null : hi, n: l.length, mom: momentumOf(l).vs30 };
  });

  // Card names for type-ahead search.
  const counts = {};
  for (const c of cards) if (c.setId) counts[c.name] = (counts[c.name] || 0) + 1;
  const names = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const latest = {
    version: 2, date, generatedAt: now.toISOString(), fx, repo, watchlist: watch,
    momentum, sets, movers, bands, records, failed,
    breadth: history.breadth.adv[pos] == null ? null : { adv: history.breadth.adv[pos], dec: history.breadth.dec[pos], flat: history.breadth.flat[pos] },
    counts: { universe: cards.length, priced: compact.length, market: live.length, basket: basket.length, basketPriced: records.filter((r) => r.inIndex && r.gbp != null).length, watch: watch.cards.length, minGbp: MIN_GBP },
  };

  if (!cur || cur.date !== date) { if (cur) await store.write('state/prices-prev.json', cur); }
  await store.write('state/prices-cur.json', { date, prices: today });
  await store.write('public/data/history.json', history);
  await store.write('public/data/latest.json', latest);
  await store.write('public/data/names.json', names);
  log(`updated ${date}: market ${live.length} cards, index ${history.idx.all[pos]}, blue ${history.idx.blue[pos]}, fx ${fx.rate}`);
  return latest;
}

export async function fetchCard(fetchJson, id) {
  try { return await fetchJson(`${TCGDEX}/cards/${encodeURIComponent(id)}`); } catch (e) { return null; }
}
