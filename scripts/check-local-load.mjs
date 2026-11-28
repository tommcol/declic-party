import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {setTimeout as sleep} from 'node:timers/promises';
import {monitorEventLoopDelay} from 'node:perf_hooks';
import {WebSocket} from 'ws';
import {buildLocal} from '../build.mjs';
import {createLocalServer} from '../local/server.mjs';

await buildLocal();
const runtime=await import('../dist/local-worker.mjs');
const authorization='Bearer '+'a'.repeat(64);
const levels=[4,10,30,50,100,200,300];
const quantile=(samples,p)=>samples.toSorted((a,b)=>a-b)[Math.ceil(samples.length*p)-1];
const rounded=n=>Math.round(n*10)/10;
const song={id:'charge',kind:'question',universe:'music',prompt:'Quel instrument ?',answer:'Piano',options:['Piano','Guitare'],points:100,duration:30};

for(const n of levels){
 const data=await mkdtemp(join(tmpdir(),'declic-charge-'));
 const app=createLocalServer({worker:runtime.default,PartyRoom:runtime.PartyRoom,MusicLibrary:runtime.MusicLibrary},data);
 const delay=monitorEventLoopDelay({resolution:10});
 try{
  app.server.listen(0,'127.0.0.1');
  await once(app.server,'listening');
  const origin='http://127.0.0.1:'+app.server.address().port;
  const sockets=[];
  const clients=[];
  let bytes=0;
  const errors=[];
  async function api(path,method,data){
   const res=await fetch(origin+path,{method,headers:{origin,authorization,'content-type':'application/json'},body:data&&JSON.stringify(data)});
   assert.equal(res.status,200,await res.clone().text());
   return res.json();
  }
  function connect(code){
   return new Promise((resolve,reject)=>{
    const ws=new WebSocket(origin.replace('http','ws')+'/api/rooms/'+code,{origin});
    sockets.push(ws);
    const queue=[];
    const watchers=new Set();
    const client={
     send:message=>ws.send(JSON.stringify(message)),
     take(test,timeout=30000){
      const found=queue.findIndex(test);
      if(found>=0)return Promise.resolve(queue.splice(found,1)[0]);
      return new Promise((done,fail)=>{
       const watcher={test,resolve:message=>{clearTimeout(timer);watchers.delete(watcher);done(message);}};
       const timer=setTimeout(()=>{watchers.delete(watcher);fail(Error('État attendu absent pour '+n+' joueurs, messages en attente : '+queue.length));},timeout);
       watchers.add(watcher);
      });
     }
    };
    ws.addEventListener('open',()=>resolve(client),{once:true});
    ws.once('error',reject);
    ws.addEventListener('message',event=>{
     bytes+=Buffer.byteLength(event.data);
     const message=JSON.parse(event.data);
     if(message.type==='error')errors.push(message.message);
     const watcher=[...watchers].find(item=>item.test(message));
     if(watcher)watcher.resolve(message);
     else queue.push(message);
    });
   });
  }
  const {active:{code,token}}=await api('/api/evening','POST',{expected:null,id:crypto.randomUUID()});
  const [host,tv]=await Promise.all([connect(code),connect(code)]);
  host.send({type:'host',token});tv.send({type:'tv'});
  await Promise.all([host.take(m=>m.state?.phase==='lobby'),tv.take(m=>m.state?.phase==='lobby')]);
  delay.enable();
  let started=performance.now();
  clients.push(...await Promise.all(Array.from({length:n},()=>connect(code))));
  const joins=await Promise.all(clients.map(async(client,index)=>{
   client.send({type:'join',name:'Joueur '+(index+1),avatar:index%40});
   const {id}=await client.take(m=>m.type==='session');
   return {id,ms:performance.now()-started};
  }));
  assert.equal(new Set(joins.map(j=>j.id)).size,n);
  await tv.take(m=>m.state?.teams.length===n);
  await api('/api/rooms','POST',{room:code,token,questions:[song],input:'qcm',musicGame:'blind'});
  host.send({type:'play'});
  const {state}=await tv.take(m=>m.state?.phase==='playing');
  assert.equal(state.question.answer,undefined);
  await Promise.all(clients.map(client=>client.take(m=>m.state?.phase==='playing')));
  assert.ok(Date.now()<state.endAt);
  await sleep(Math.max(0,state.startAt-Date.now())+35);
  started=performance.now();
  const answers=await Promise.all(clients.map(async (client,index)=>{
   client.send({type:'answer',questionId:song.id,answer:index%2?'Guitare':'Piano'});
   const reply=await client.take(m=>m.type==='received');
   assert.equal(reply.accepted,true);
   return performance.now()-started;
  }));
  host.send({type:'reveal'});
  const {state:result}=await tv.take(m=>m.state?.phase==='reveal');
  assert.equal(result.history.at(-1).results.length,n);
  assert.equal(result.history.at(-1).results.filter(row=>row.result.correct).length,Math.ceil(n/2));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({joueurs:n,inscrits:joins.length,confirmations:answers.length,inscriptionP95Ms:rounded(quantile(joins.map(j=>j.ms),.95)),
   reponseP50Ms:rounded(quantile(answers,.5)),reponseP95Ms:rounded(quantile(answers,.95)),reponseMaxMs:rounded(Math.max(...answers)),
   jitterServeurP95Ms:rounded(delay.percentile(95)/1e6),mebibytes:rounded(bytes/2**20)}));
  for(const ws of sockets)ws.close();
 }finally{
  delay.disable();
  await app.close();
  await rm(data,{recursive:true,force:true});
 }
}
