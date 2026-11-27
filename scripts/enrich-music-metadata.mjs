// Node 22. Metadata only; no preview downloads or provider IDs stored.
import {LIBRARY_MASTER} from '../src/library-master.js';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
const file=process.argv[2]||'/opt/applications/declic-party-music/metadata.json';
const limit=Number(process.argv[3]||200);
if(!Number.isInteger(limit)||limit<1||limit>200)throw Error('Lot : 1 à 200');
const norm=s=>String(s??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const genres=new Set(['var','pop','rock','disco','dance','rapfr','rapus']);
const id=(a,t)=>norm(a)+'|'+norm(t);
function classify(g,tags){
 const s=norm(g), out=[];
 if(/\b(hip hop|rap|r b|soul)\b/.test(s))out.push(tags.includes('fr')?'rapfr':'rapus');
 if(/\b(rock|metal|punk)\b/.test(s))out.push('rock');
 if(/\b(disco|funk)\b/.test(s))out.push('disco');
 if(/\b(dance|electronic|house|techno|trance|electro)\b/.test(s))out.push('dance');
 if(/\b(pop|chanson|variete)\b/.test(s))out.push(tags.includes('fr')?'var':'pop');
 return [...new Set(out)];
}
let saved={};try{saved=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(dirname(file),{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let processed=0;
for(const [title,artist,year,tags] of LIBRARY_MASTER){
 const k=id(artist,title);
 if((year&&tags.some(t=>genres.has(t)))||saved[k]||processed>=limit)continue;
 const url=new URL('https://itunes.apple.com/search');
 url.search=new URLSearchParams({term:artist+' '+title,country:'FR',entity:'song',limit:'25'});
 try{
  await pause(3500);
  const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();
  if(!Array.isArray(data.results))throw Error('Réponse inattendue');
  const matches=data.results.filter(t=>norm(t.artistName)===norm(artist)&&norm(t.trackName)===norm(title));
  const years=matches.map(t=>Number(String(t.releaseDate||'').slice(0,4))).filter(y=>y>=1960&&y<=2026);
  const candidates=[...new Set(matches.flatMap(t=>classify(t.primaryGenreName,tags)))];
  saved[k]={artist,title,originalYear:year||null,proposedYear:years.length?Math.min(...years):null,proposedGenres:candidates,status:matches.length?'review_required':'no_exact_match',source:'iTunes FR',checkedAt:new Date().toISOString()};
  await writeFile(file+'.tmp',JSON.stringify(saved,null,2)+'\n');await rename(file+'.tmp',file);
  processed++;
  console.log(processed,artist,'—',title,saved[k].proposedYear,candidates.join(','));
 }catch(e){console.error('Interruption :',e.message);process.exitCode=1;break;}
}
console.log('Lot traité :',processed,'; cumul :',Object.keys(saved).length);
console.log('Les années proposées sont des dates de catalogue, à confirmer comme première sortie. Aucun changement automatique des playlists.');
