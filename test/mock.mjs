// Offline mock of TCGdex + ECB for tests and fixtures.
export function makeMock({ seed = 7, nPerSet = 30 } = {}) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const setDefs = [['base1', 'Base Set', '1999-01-09'], ['swsh7', 'Evolving Skies', '2021-08-27'], ['sv03.5', '151', '2023-09-22'], ['A1', 'Genetic Apex', '2024-10-30', 'tcgp']];
  const names = ['Charizard', 'Charmander', 'Charmeleon', 'Pikachu', 'Umbreon VMAX', 'Mew ex', 'Blastoise', 'Professor Oak', 'Lugia V', 'Rayquaza VMAX'];
  const sets = setDefs.map(([id, name, date, serie]) => ({ id, name, releaseDate: date, serie: { id: serie || id.replace(/\d.*/, ''), name: serie ? 'Pokémon TCG Pocket' : name }, cards: Array.from({ length: nPerSet }, (_, i) => ({ id: `${id}-${i + 1}`, localId: String(i + 1), name: names[i % names.length] })) }));
  const base = {}, drift = {};
  const state = { day: 0, mult: {} };
  const fetchText = async () => `<Cube time='2026-11-19'><Cube currency='GBP' rate='0.85'/>`;
  const fetchJson = async (url) => {
    const u = url.replace('https://api.tcgdex.net/v2/en', '');
    if (u === '/sets') return sets.map(({ id, name }) => ({ id, name }));
    if (u.startsWith('/sets/')) return sets.find((x) => x.id === decodeURIComponent(u.slice(6)));
    const id = decodeURIComponent(u.split('/').pop());
    const set = sets.find((x) => id.startsWith(x.id + '-'));
    if (!set) throw new Error('404 ' + id);
    if (set.serie.id === 'tcgp') return { id, name: 'x', set: { id: set.id, name: set.name } };
    const key = id + ':' + state.day;
    base[id] ??= 1 + rnd() * 400; drift[id] ??= (rnd() - 0.45) * 0.01;
    if (!state.mult[key]) { base[id] *= Math.exp(drift[id] + (rnd() - 0.5) * 0.04); state.mult[key] = [base[id], 0.95 + rnd() * 0.1, 0.85 + rnd() * 0.25]; }
    const [bp, f7, f30] = state.mult[key]; const p = bp / 0.85;
    return { id, name: set.cards.find((c) => c.id === id).name, localId: id.split('-')[1], rarity: 'Rare Holo', set: { id: set.id, name: set.name }, image: 'https://assets.tcgdex.net/en/x/' + id,
      pricing: { cardmarket: { trend: p, avg7: p * f7, avg30: p * f30, avg1: p, low: p * 0.7 } } };
  };
  return { fetchJson, fetchText, state, sets };
}
export function memStore(init = {}) {
  const mem = { ...init };
  return { mem, read: async (p) => (p in mem ? JSON.parse(mem[p]) : null), write: async (p, o) => { mem[p] = JSON.stringify(o); } };
}
