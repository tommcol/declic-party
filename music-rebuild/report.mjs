import { artists, sources } from './francophone.mjs';

const normalize = text => text.normalize('NFKD').replace(/\p{M}/gu, '')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const ids = new Set();
const recordings = new Set();
const report = {
  creditsRetenus: artists.length,
  titresDocumentes: 0,
  controlesAudioRealises: 0,
  jouables: 0,
  enAttente: 0,
  parDecennie: {},
  parGenre: {},
  parPlaylist: {},
};
function increment(counts, key) {
  counts[key] = (counts[key] ?? 0) + 1;
}

for (const [artist, tracks] of artists) {
  for (const [id, title, year, genre, tags, evidence] of tracks) {
    const key = normalize(artist) + '|' + normalize(title);
    if (!/^fr-\d+$/.test(id) || ids.has(id) || recordings.has(key)) {
      throw new Error(`Identifiant ou référence en double ou invalide : ${id} (${artist}, ${title})`);
    }
    if (!title || !artist || !Number.isInteger(year) || year < 1950 || !genre ||
        !evidence.length || evidence.some(source => !Object.hasOwn(sources, source))) {
      throw new Error(`Notice incomplète : ${id}`);
    }
    ids.add(id);
    recordings.add(key);
    report.titresDocumentes++;
    report.enAttente++;
    const decade = String(year - year % 10);
    increment(report.parDecennie, decade);
    increment(report.parGenre, genre);
    const period = year >= 2020 ? String(year) : decade;
    for (const playlist of new Set(['fr', 'mix', period, ...tags])) {
      increment(report.parPlaylist, playlist);
    }
  }
}
console.log(JSON.stringify(report, null, 2));
