import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {LIBRARY_MASTER} from '../src/library-master.js';

const origin=process.argv[2]||'http://127.0.0.1:3000';
const revision=createHash('sha256').update((await readFile(
 new URL('../src/library-master.js',import.meta.url),'utf8')).replace(/^export /gm,'')).digest('hex').slice(0,12);
const authorization='Bearer '+randomBytes(32).toString('hex');
async function get(path){
 const response=await fetch(origin+path,{headers:{Authorization:authorization},signal:AbortSignal.timeout(4000)});
 if(!response.ok)throw Error(path+' : HTTP '+response.status);
 return response.json();
}
const library=await get('/api/library');
assert.equal(library.import?.version,revision,'Le serveur ne sert pas le catalogue du dépôt installé.');
assert.equal(library.total,LIBRARY_MASTER.length);
const artists=library.categories.find(group=>group.id==='artists').playlists;
for(const name of ['Santa','Florent Pagny','Pierre Garnier']){
 const item=artists.find(item=>item.name.toLowerCase()===name.toLowerCase());
 assert.ok(item?.references,'Artiste absent : '+name);
 const {total,tracks}=await get('/api/library/tracks?playlist='+encodeURIComponent(item.id));
 assert.equal(total,item.references);
 assert.ok(tracks.every(track=>track.artist.toLowerCase()===name.toLowerCase()));
 console.log(name+' : '+total+' titre(s)');
}
console.log('Catalogue '+revision+' — '+library.total+' références servies par '+origin);
