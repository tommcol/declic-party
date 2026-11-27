// Local metadata-only pilot. Node 22+. No Cloudflare calls or audio downloads.
import { LIBRARY_MASTER } from '../src/library-master.js';
import { readFile, writeFile, rename } from 'node:fs/promises';
const year = Number(process.argv[2] || 2026);
if (!Number.isInteger(year) || year < 1900 || year > 2100) throw Error('Année invalide');
const output = process.argv[3] || '/tmp/declic-music-' + year + '.json';
const norm = s => String(s).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const rows = new Map();
for (const [title,artist,releaseYear,tags] of LIBRARY_MASTER) {
 if (!tags.includes(String(year))) continue;
 const id = norm(artist)+'|'+norm(title);
 rows.set(id,{id,title,artist,year:releaseYear});
}
let saved = {};
try { saved = JSON.parse(await readFile(output,'utf8')); } catch(e) { if(e.code !== 'ENOENT') throw e; }
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
for (const row of rows.values()) {
 if (saved[row.id]?.status === 'preview_candidate') continue;
 const url = new URL('https://api.deezer.com/search');
 url.searchParams.set('q',row.artist+' '+row.title);
 url.searchParams.set('limit','25');
 try {
  const response = await fetch(url,{signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw Error('HTTP '+response.status);
  const data = await response.json();
  if (data.error || !Array.isArray(data.data)) throw Error('Réponse fournisseur indisponible');
  const matches = data.data.filter(t=>norm(t.title)===norm(row.title)&&norm(t.artist?.name)===norm(row.artist)&&/^\d+$/.test(String(t.id)));
  const match = matches.find(t=>{try {const u=new URL(t.preview);return u.protocol==='https:'&&u.hostname.endsWith('.dzcdn.net');}catch{return false;}});
  const titleBase = s => norm(String(s).replace(/\s*\((?:feat\.?|ft\.?|.*feat\.).*\)\s*$/i,''));
  const artistParts = s => String(s).split(/\s*(?:&|,|\bfeat\.?\s+|\bft\.?\s+)\s*/i).map(norm).filter(Boolean);
  const suggestions = data.data.filter(t => {
   const names = [t.artist?.name,...(Array.isArray(t.contributors)?t.contributors.map(a=>a.name):[])].filter(Boolean).map(norm);
   return titleBase(t.title)===titleBase(row.title) && artistParts(row.artist).some(a=>names.includes(a)) && /^\d+$/.test(String(t.id));
  }).slice(0,5).map(t=>({providerId:String(t.id),title:t.title,artist:t.artist?.name,previewListed:!!t.preview}));
  saved[row.id] = {...row,suggestions,provider:'Deezer',providerId:match?String(match.id):null,status:match?'preview_candidate':matches.length?'no_preview':suggestions.length?'review_required':'no_exact_match',checkedAt:new Date().toISOString()};
  await writeFile(output+'.tmp',JSON.stringify(saved,null,2)+'\n');
  await rename(output+'.tmp',output);
  console.log(saved[row.id].status,row.artist,'—',row.title);
 } catch(e) { console.error('Arrêt sans perdre les résultats :',e.message);process.exitCode=1;break; }
 await sleep(1500);
}
console.log('Rapport local :',output,'—',Object.keys(saved).length,'références traitées sur',rows.size);
console.log('Les candidats ne sont pas déclarés jouables : autorisation et lecture restent à valider.');
