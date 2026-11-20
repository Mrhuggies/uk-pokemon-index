const T = 'https://api.tcgdex.net/v2/en';
const j = async (u, o) => { const t0 = Date.now(); const r = await fetch(u, o); const b = await r.text(); return { s: r.status, ms: Date.now() - t0, b, h: Object.fromEntries(r.headers) }; };
let r = await j(`${T}/rarities`); console.log('rarities', r.s, r.b.slice(0, 1500));
r = await j(`${T}/cards`); const all = JSON.parse(r.b); console.log('all cards', all.length, 'bytes', r.b.length, 'ms', r.ms, JSON.stringify(all[0]));
console.log('cors', r.h['access-control-allow-origin']);
const names = new Set(all.map((c) => c.name)); console.log('distinct names', names.size);
r = await j(`${T}/sets`); const sets = JSON.parse(r.b); console.log('sets', sets.length, JSON.stringify(sets[0]));
r = await j(`${T}/sets/sv03.5`); const s = JSON.parse(r.b); console.log('set keys', Object.keys(s), s.releaseDate, JSON.stringify(s.cards?.[0]));
for (const q of ['rarity=Special%20illustration%20rare', 'rarity=eq:Rare%20Holo', 'name=char', 'name=eq:Charizard']) { r = await j(`${T}/cards?${q}`); let a = []; try { a = JSON.parse(r.b); } catch {} console.log(q, r.s, a.length, a.slice(0, 4).map((c) => c.name).join(', ')); }
r = await j(`${T}/series`); console.log('series', r.b.slice(0, 600));
const gq = '{ cards(filters:{name:"Charizard"}) { id name pricing { cardmarket { trend avg7 avg30 } } } }';
r = await j('https://api.tcgdex.net/v2/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: gq }) });
console.log('graphql', r.s, r.b.slice(0, 600));
// timing for 40 sequential-ish full cards
const t0 = Date.now(); await Promise.all(all.slice(5000, 5040).map((c) => fetch(`${T}/cards/${c.id}`).then((x) => x.text()))); console.log('40 cards parallel ms', Date.now() - t0);
