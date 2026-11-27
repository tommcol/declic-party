import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {createLocalServer} from '../local/server.mjs';
import {LIBRARY_MASTER} from '../src/library-master.js';
import {SCREEN_WORKS,screenWorkByRecording} from '../src/library-screen-works.js';
import {buildLocal} from '../build.mjs';

test('Le catalogue local croise les filtres, conserve les références et retrouve les playlists enregistrées',async t=>{
 await buildLocal();
 const {default:worker,PartyRoom,MusicLibrary}=await import('../dist/local-worker.mjs');
 const directory=await mkdtemp(join(tmpdir(),'declic-library-'));
 let app,origin;
 t.after(async()=>{await app?.close();await rm(directory,{recursive:true,force:true});});
 async function boot(){
  app=createLocalServer({worker,PartyRoom,MusicLibrary},directory);
  app.server.listen(0,'127.0.0.1');
  await once(app.server,'listening');
  origin='http://127.0.0.1:'+app.server.address().port;
 }
 async function request(path,data,method='POST',status=data===undefined?200:201){
  const response=await fetch(origin+'/api/library'+path,{method:data===undefined?'GET':method,
   headers:{Origin:origin,Authorization:'Bearer '+'b'.repeat(64),'Content-Type':'application/json'},
   body:data===undefined?undefined:JSON.stringify(data)});
  assert.equal(response.status,status,await response.clone().text());
  assert.equal(response.headers.get('cache-control'),'no-store');
  return response.json();
 }
 await boot();
 const summary=await request('');
 assert.equal(summary.total,5166);
 assert.equal(summary.references,summary.total);
 const catalog=new Map(LIBRARY_MASTER.map(track=>[track[1]+'|'+track[0],track]));
 assert.equal(screenWorkByRecording.size,SCREEN_WORKS.reduce((total,entry)=>total+entry[3].length,0));
 for(const [recording,credit] of screenWorkByRecording){
  const track=catalog.get(recording);
  assert.ok(track,recording);
  assert.equal(track[4],null,recording);
  assert.ok(credit.work);
 }
 const film=await request('/tracks?playlist=films&q=How+Deep+Is+Your+Love');
 assert.equal(film.tracks.find(track=>track.artist==='Bee Gees')?.work,'La Fièvre du samedi soir');
 assert.equal(film.tracks.find(track=>track.artist==='Bee Gees')?.workSource,'https://www.loc.gov/item/95781649/');
 const series=await request('/tracks?playlist=series&q=Every+Breath+You+Take');
 assert.equal(series.tracks.find(track=>track.artist==='The Police')?.work,'Stranger Things');
 const cartoon=await request('/tracks?playlist=cartoons&q=How+Far');
 assert.ok(cartoon.tracks.some(track=>track.work==='Vaiana, la légende du bout du monde'));
 const periods=summary.categories.find(group=>group.id==='decades').playlists;
 assert.equal(periods[0].name,'Années 1960');
 assert.equal(periods.find(item=>item.id.startsWith('year-')).name,'1960');
 assert.ok(periods.every(item=>Number(item.id.split('-').at(-1))>=1960));
 assert.ok((await request('/tracks?period=1950')).total>0);
 for(const type of ['films','series','cartoons']){
  const {tracks}=await request('/tracks?playlist='+type);
  assert.ok(tracks.some(track=>track.work));
 }

 assert.match(summary.import.version,/^[a-f0-9]{12}$/);
 const index=new Map(summary.categories.flatMap(group=>group.playlists).map(item=>[item.name.toLowerCase(),item]));
 const santa=index.get('santa'),indochine=index.get('indochine');
 assert.ok(santa.references>0);
 assert.ok(index.get('florent pagny').references>0);
 assert.ok(index.get('pierre garnier').references>0);
 for(const item of [santa,index.get('hits français'),index.get('hits internationaux')]){
  const result=await request('/tracks?playlist='+item.id);
  assert.equal(result.total,item.references);
  assert.ok(result.tracks.length>0);
  assert.ok(result.tracks.every(track=>track.playlists.includes(item.id)));
 }
 const missingYear=await request('/tracks?playlist='+santa.id);
 assert.ok(missingYear.tracks.some(track=>track.year===null));
 const sorted=await request('/tracks?playlist=fr&sort=year');
 assert.ok(sorted.tracks.every((track,i)=>!i||track.year>=sorted.tracks[i-1].year));
 const filtered=[
  ['origin=fr&genres=rock&period=1980',track=>track.origins.includes('fr')&&track.genres.includes('rock')&&track.year>=1980&&track.year<1990],
  ['origin=intl&genres=disco&period=1970',track=>track.origins.includes('intl')&&track.genres.includes('disco')&&track.year>=1970&&track.year<1980],
  ['origin=fr&genres=rock&period=year-2020',track=>track.origins.includes('fr')&&track.genres.includes('rock')&&track.year===2020],
  ['genres=rock&genres=pop',track=>track.genres.includes('rock')||track.genres.includes('pop')],
  ['artists='+santa.id+'&artists='+indochine.id,track=>/^(santa|indochine)$/i.test(track.artist)]
 ];
 for(const [query,accept] of filtered){
  const {tracks}=await request('/candidates?'+query);
  assert.ok(tracks.length>0);
  assert.ok(tracks.every(accept));
  assert.equal(tracks.length,new Set(tracks.map(track=>track.id)).size);
  const page=await request('/tracks?'+query);
  assert.equal(page.total,tracks.length);
  if(page.next!==null){
   const second=await request('/tracks?'+query+'&offset='+page.next);
   assert.ok(second.tracks.every(track=>!page.tracks.some(first=>first.id===track.id)));
  }
 }
 assert.equal((await request('/tracks?origin=to-edit',undefined,undefined,400)).error,'Recherche ou filtres invalides.');
 assert.equal((await request('/tracks?origin=intl&artists='+santa.id)).total,0);
 const shortcut=await request('/candidates?playlist=fr&playlist=rock&playlist=1980');
 assert.deepEqual(shortcut.tracks,(await request('/candidates?'+filtered[0][0])).tracks);
 const filters={origin:['fr'],genres:['rock'],period:['1980']};
 const {playlist}=await request('/playlists',{name:'Rock français années 1980',filters});
 const {tracks:initial}=await request('/candidates?playlist='+playlist.id);
 const restricted=await request('/playlists',{name:'Uniquement le rock de 1981',filters:{base:[playlist.id],period:['year-1981']}});
 const narrowed=await request('/candidates?playlist='+restricted.playlist.id);
 assert.ok(narrowed.tracks.every(track=>track.year===1981&&initial.some(entry=>entry.id===track.id)));
 assert.deepEqual(initial,(await request('/candidates?'+filtered[0][0])).tracks);
 await request('/tracks',{id:initial[0].id,excluded:true},'PATCH',200);
 await app.close();app=null;await boot();
 const restored=await request('');
 assert.equal(restored.total,5166);
 assert.equal(restored.references,5165);
 assert.ok(restored.categories.find(item=>item.id==='custom').playlists.some(item=>item.id===playlist.id));
 assert.equal((await request('/tracks?playlist='+playlist.id)).total,initial.length-1);
 assert.equal((await request('/tracks?playlist='+playlist.id+'&excluded=1')).tracks[0].id,initial[0].id);
 await request('/tracks',{id:initial[0].id,excluded:false},'PATCH',200);
 assert.equal((await request('/tracks?playlist='+playlist.id)).total,initial.length);
});
