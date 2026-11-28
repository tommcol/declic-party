import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {createGame,saveGameSnapshot,competitionRanking,eveningDistinctions,musicPerformance,eveningTotals,roundStatistics} from '../public/engine.js';

const source=await readFile(new URL('../src/worker.js',import.meta.url),'utf8');
const runtime=vm.createContext({
 Response, URL, crypto, TextEncoder, TextDecoder, Uint8Array, console,
 DurableObject:class {constructor(ctx,env){Object.assign(this,{ctx,env});}},
 WebSocketRequestResponsePair:class {}, createGame,saveGameSnapshot,competitionRanking,eveningDistinctions,musicPerformance,eveningTotals,roundStatistics
});
vm.runInContext(source.replace(/^import .*;$/gm,'').replace('export {MusicLibrary};','')
 .replace('export default {','globalThis.worker = {')
 .replace('export class PartyRoom','globalThis.PartyRoom = class PartyRoom'),runtime);

function setup(){
 const origin='https://declic.test';
 const objects=new Map();
 let rejectRemoval=false;
 const env={ROOMS:{getByName(name){
  if(!objects.has(name)){
   const records=new Map();
   const storage={
    get:async key=>structuredClone(records.get(key)),
    put:async (key,value)=>records.set(key,structuredClone(value)),
    delete:async key=>records.delete(key),
    deleteAll:async()=>records.clear(),
    transaction:async call=>call(storage),
    deleteAlarm:async()=>{}
   };
   const object=new runtime.PartyRoom({storage,setWebSocketAutoResponse(){},getWebSockets:()=>[]},env);
   const remove=object.removeRoom.bind(object);
   object.removeRoom=async hash=>{
    if(rejectRemoval){rejectRemoval=false;throw Error('Indisponibilité temporaire');}
    return remove(hash);
   };
   objects.set(name,object);
  }
  return objects.get(name);
 }}};
 return {
  failRemoval:()=>{rejectRemoval=true;},
  room:code=>env.ROOMS.getByName(code).ctx.storage.get('room'),
  request:(method='GET',body,key='a'.repeat(64),requestOrigin=origin)=>runtime.worker.fetch(new Request(origin+'/api/evening',{
   method,headers:{Authorization:'Bearer '+key,Origin:requestOrigin},body:body===undefined?undefined:JSON.stringify(body)
  }),env)
 };
}

test('Seule la clé animateur permet de gérer sa soirée et les créations concurrentes sont arbitrées',async()=>{
 const {request}=setup();
 const changes=Array.from({length:2},()=>({expected:null,id:crypto.randomUUID()}));
 const results=await Promise.all(changes.map(change=>request('POST',change)));
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const winner=results.findIndex(r=>r.status===200);
 const {active}=await results[winner].json();
 const duplicate=await request('POST',changes[winner]);
 assert.equal((await duplicate.json()).active.code,active.code);
 assert.equal((await request('DELETE',{expected:active.code},active.code)).status,403);
 assert.equal((await request('DELETE',{expected:active.code},active.token)).status,403);
 assert.equal((await request('DELETE',{expected:active.code},'a'.repeat(64),'https://autre.test')).status,403);
 assert.equal((await request('DELETE',{expected:active.code},'b'.repeat(64))).status,409);
 assert.equal((await (await request()).json()).active.code,active.code);
});

test('Une interruption de remplacement est récupérée, les anciens accès et l’état USB sont supprimés',async()=>{
 const {request,room,failRemoval}=setup();
 const {active}=await (await request('POST',{expected:null,id:crypto.randomUUID()})).json();
 const snapshot={code:active.code,revision:0,id:crypto.randomUUID(),state:{mode:'usb',questions:[],teams:[{score:42}]}};
 assert.equal((await request('PUT',snapshot)).status,200);
 assert.equal((await request('PUT',{...snapshot,id:crypto.randomUUID()})).status,409);
 assert.equal((await (await request()).json()).active.usb.state.teams[0].score,42);
 failRemoval();
 const replacement={expected:active.code,id:crypto.randomUUID()};
 assert.equal((await request('POST',replacement)).status,500);
 assert.ok(await room(active.code));
 const {active:fresh}=await (await request()).json();
 assert.notEqual(fresh.code,active.code);
 assert.equal(fresh.usb,undefined);
 assert.equal(await room(active.code),undefined);
 assert.deepEqual((await room(fresh.code)).teams,[]);
 assert.equal((await request('PUT',snapshot)).status,409);
 assert.equal((await request('DELETE',{expected:fresh.code})).status,200);
 assert.equal(await room(fresh.code),undefined);
 assert.equal((await (await request()).json()).active,null);
});
