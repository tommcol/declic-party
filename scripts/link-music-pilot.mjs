// Local metadata-only catalogue linker, Node 22+. No Cloudflare calls.
import { LIBRARY_MASTER } from '../src/library-master.js';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
const scope=process.argv[2]||'2026';
if(scope!=='all'&&!/^\d{4}$/.test(scope)) throw Error('Année ou all attendu');
const output=process.argv[3]||'/opt/applications/declic-party-music/catalogue-'+scope+'.json';
await mkdir(dirname(output),{recursive:true});
const norm=s=>String(s??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/œ/g,'oe').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const base=s=>norm(String(s).replace(/\s*\([^)]*\b(?:feat|ft)\.?\s+[^)]*\)\s*$/i,''));
const parts=s=>String(s).split(/\s*(?:&|,|\bfeat\.?\s+|\bft\.?\s+)\s*/i).map(norm).filter(Boolean);
const rows=new Map();
for(const [title,artist,year,tags] of LIBRARY_MASTER){
 if(scope!=='all'&&!tags.includes(scope))continue;
 const id=norm(artist)+'|'+norm(title); rows.set(id,{id,title,artist,year});
}
let saved={};try{saved=JSON.parse(await readFile(output,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function json(url){
 await sleep(1500);
 const r=await fetch(url,{signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('HTTP '+r.status);
 const d=await r.json();if(d.error)throw Error(JSON.stringify(d.error));return d;
}
function valid(url,provider){try{const u=new URL(url);return u.protocol==='https:'&&(provider==='Deezer'?u.hostname.endsWith('.dzcdn.net'):u.hostname.endsWith('.apple.com')||u.hostname.endsWith('.mzstatic.com'));}catch{return false;}}
async function probe(url){
 try{const r=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(15000),redirect:'error'});return r.ok&&/^audio\//i.test(r.headers.get('content-type')||'')?'head_audio_ok':'unverified';}catch{return 'unverified';}
}
const batch=Number(process.argv[4]||200);
if(!Number.isInteger(batch)||batch<1||batch>200)throw Error('Lot attendu : 1 à 200');
let processed=0;
const seen=new Map();
for(const r of Object.values(saved))if(r.providerId)seen.set(r.provider+':'+r.providerId,r.id);
for(const row of rows.values()){
 if(saved[row.id]?.version===3)continue;
 if(processed>=batch)break;
 try{
 const wanted=parts(row.artist);
 const suggestions=[];
 let found=null;
 const queries=[row.artist+' '+row.title,wanted[0]+' '+base(row.title)];
 for(const q of new Set(queries)){
 const u=new URL('https://api.deezer.com/search');u.searchParams.set('q',q);u.searchParams.set('limit','25');
 const d=await json(u);if(!Array.isArray(d.data))throw Error('Réponse Deezer invalide');
 for(const t of d.data.filter(t=>base(t.title)===base(row.title)&&wanted.includes(norm(t.artist?.name))&&/^\d+$/.test(String(t.id))).slice(0,5)){
 if(suggestions.some(s=>s.providerId===String(t.id)))continue;
 const detail=await json('https://api.deezer.com/track/'+t.id);
 const names=[detail.artist?.name,...(detail.contributors||[]).map(a=>a.name)].map(norm);
 suggestions.push({provider:'Deezer',providerId:String(t.id),title:detail.title,artists:names});
 if(wanted.every(a=>names.includes(a))&&base(detail.title)===base(row.title)&&valid(detail.preview,'Deezer')){
 found={provider:'Deezer',providerId:String(t.id),technical:await probe(detail.preview)};break;
 }
 }if(found)break;
 }
 if(!found){
 const u=new URL('https://itunes.apple.com/search');u.searchParams.set('term',row.artist+' '+row.title);u.searchParams.set('country','FR');u.searchParams.set('entity','song');u.searchParams.set('limit','25');
 const d=await json(u);if(!Array.isArray(d.results))throw Error('Réponse iTunes invalide');
 for(const t of d.results.filter(t=>base(t.trackName)===base(row.title)&&/^\d+$/.test(String(t.trackId)))){
 const names=parts(t.artistName);
 if(!wanted.some(a=>names.includes(a)))continue;
 suggestions.push({provider:'iTunes',providerId:String(t.trackId),title:t.trackName,artists:names});
 if(wanted.every(a=>names.includes(a))&&valid(t.previewUrl,'iTunes')){found={provider:'iTunes',providerId:String(t.trackId),technical:await probe(t.previewUrl)};break;}
 }
 }
 const key=found?found.provider+':'+found.providerId:null;
 const duplicateOf=key&&seen.has(key)&&seen.get(key)!==row.id?seen.get(key):null;
 if(key&&!duplicateOf)seen.set(key,row.id);
 saved[row.id]={...row,...found,duplicateOf,status:found?'preview_candidate':suggestions.length?'review_required':'no_exact_match',suggestions,version:3,checkedAt:new Date().toISOString()};
 await writeFile(output+'.tmp',JSON.stringify(saved,null,2)+'\n');await rename(output+'.tmp',output);
 processed++;
 console.log(saved[row.id].status,row.artist,'—',row.title,found?.technical||'',duplicateOf?'doublon probable':'');
 }catch(e){console.error('Arrêt, relancer la même commande :',e.message);process.exitCode=1;break;}
}
console.log('Lot terminé :',processed,'références nouvelles');
console.log(output,Object.values(saved).filter(r=>r.version===3&&rows.has(r.id)).length,'/',rows.size);
console.log('HEAD ne garantit pas la lecture. Aucun extrait autorisé pour le jeu par ce script.');
