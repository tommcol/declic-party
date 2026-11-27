import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {setTimeout as sleep} from 'node:timers/promises';
import {WebSocket} from 'ws';
import {buildLocal} from '../build.mjs';
import {createLocalServer} from '../local/server.mjs';

test('Le serveur Node synchronise une manche et reprend ses données et alarmes après un arrêt',{timeout:20000},async t=>{
 await buildLocal();
 const {default:worker,PartyRoom,MusicLibrary}=await import('../dist/local-worker.mjs');
 const directory=await mkdtemp(join(tmpdir(),'declic-test-'));
 let app, origin;
 t.after(async()=>{
  await app?.close();
  await rm(directory,{recursive:true,force:true});
 });

 async function boot(){
  app=createLocalServer({worker,PartyRoom,MusicLibrary},directory);
  app.server.listen(0,'127.0.0.1');
  await once(app.server,'listening');
  origin='http://127.0.0.1:'+app.server.address().port;
 }
 const authorization='Bearer '+'a'.repeat(64);
 async function request(path,method='GET',data){
  const response=await fetch(origin+path,{
   method,headers:{origin,authorization,'content-type':'application/json'},
   body:data===undefined?undefined:JSON.stringify(data)
  });
  assert.equal(response.status,200,await response.clone().text());
  return response.json();
 }
 async function connect(code){
  const ws=new WebSocket(origin.replace('http:','ws:')+'/api/rooms/'+code,{origin});
  const messages=[];
  ws.on('message',data=>{
   const raw=data.toString();
   messages.push(raw==='pong'?raw:JSON.parse(raw));
  });
  await once(ws,'open');
  return {
   send:message=>ws.send(typeof message==='string'?message:JSON.stringify(message)),
   async waitFor(predicate,timeout=2500){
    const deadline=Date.now()+timeout;
    while(Date.now()<deadline){
     const index=messages.findIndex(predicate);
     if(index>=0)return messages.splice(index,1)[0];
     await sleep(15);
    }
    assert.fail('Message WebSocket manquant : '+JSON.stringify(messages));
   }
  };
 }
 const phase=(client,value,timeout)=>client.waitFor(m=>m.state?.phase===value,timeout).then(m=>m.state);

 await boot();
 for(const path of ['/','/tv','/join']){
  const response=await fetch(origin+path);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.match(await response.text(),/Déclic/i);
 }
 assert.deepEqual(await request('/api/evening'),{active:null});
 const {active}=await request('/api/evening','POST',{expected:null,id:crypto.randomUUID()});
 const {code,token}=active;
 const host=await connect(code);
 const tv=await connect(code);
 const players=await Promise.all([connect(code),connect(code)]);
 host.send({type:'host',token});
 tv.send({type:'tv'});
 players.forEach((player,index)=>player.send({type:'join',name:'Équipe '+index}));
 const sessions=await Promise.all(players.map(p=>p.waitFor(m=>m.type==='session')));
 await tv.waitFor(m=>m.state?.teams.length===2);
 tv.send('ping');
 await tv.waitFor(m=>m==='pong');
 assert.equal(new Set(sessions.map(s=>s.id)).size,2);

 const groups=[{id:'genres',name:'Genres'},{id:'decades',name:'Décennies'}];
 const playlists=Array.from({length:7},(_,index)=>({id:'p'+index,name:'Playlist '+index}));
 host.send({type:'roulette-start',mode:'vote',kind:'playlist',animation:false,
  options:groups,categories:groups.map(group=>({...group,playlists}))});
 const {wheel:vote}=await players[0].waitFor(m=>m.wheel?.canVote);
 players.forEach(player=>player.send({type:'roulette-vote',id:vote.id,choice:'genres'}));
 const {wheel:selection}=await tv.waitFor(m=>m.wheel?.result&&m.wheel?.stage==='choice');
 assert.equal(selection.category.id,'genres');
 assert.equal(selection.optionsCount,7);
 assert.equal(selection.player,null);
 assert.equal((await request('/api/evening')).active.code,code);
 host.send({type:'roulette-dismiss',id:selection.id});
 await tv.waitFor(m=>m.type==='roulette'&&m.wheel===null);
 const full=await request('/api/library/candidates?playlist=mix');
 assert.ok(full.tracks.length>9000);
 assert.equal(new Set(full.tracks.map(track=>track.id)).size,full.tracks.length);

 const question={id:'piano',universe:'music',kind:'question',prompt:'Quel instrument ?',answer:'Piano',options:['Piano','Guitare'],points:100,duration:5};
 await request('/api/rooms','POST',{room:code,token,questions:[question],input:'qcm',randomTeamCount:2});
 host.send({type:'play'});
 const playing=await phase(tv,'playing');
 assert.equal(playing.question.answer,undefined);
 assert.deepEqual(playing.randomTeams.map(group=>group.score),[0,0]);
 const assigned=await Promise.all(players.map(player=>phase(player,'playing')));
 assert.equal(new Set(assigned.map(state=>state.myRandomTeam)).size,2);
 await sleep(Math.max(0,playing.startAt-Date.now())+40);
 players[0].send({type:'answer',questionId:question.id,answer:'Piano'});
 players[1].send({type:'answer',questionId:question.id,answer:'Guitare'});
 await Promise.all(players.map(p=>p.waitFor(m=>m.type==='received')));

 const {tracks}=await request('/api/library/tracks?playlist=mix');
 assert.ok(tracks.length>0);
 await request('/api/library/tracks','PATCH',{id:tracks[0].id,excluded:true});

 await app.close();
 app=null;
 await boot();
 assert.equal((await request('/api/evening')).active.code,code);
 const restoredPlayer=await connect(code);
 const restoredTv=await connect(code);
 restoredPlayer.send({type:'join',token:sessions[0].token});
 restoredTv.send({type:'tv'});
 assert.equal((await restoredPlayer.waitFor(m=>m.type==='session')).id,sessions[0].id);
 const revealed=await phase(restoredTv,'reveal',9000);
 assert.equal(revealed.question.answer,'Piano');
 assert.equal(revealed.randomTeams[0].id,assigned[0].myRandomTeam);
 assert.equal(revealed.randomTeams[0].score,revealed.teams.find(team=>team.id===sessions[0].id).score);
 assert.ok(revealed.teams.find(team=>team.id===sessions[0].id).score>0);
 assert.equal(revealed.teams.find(team=>team.id===sessions[1].id).score,0);
 const exclusions=await request('/api/library/tracks?playlist=mix&excluded=1');
 assert.ok(exclusions.tracks.some(track=>track.id===tracks[0].id));
 assert.ok(!(await request('/api/library/candidates?playlist=mix')).tracks.some(track=>track.id===tracks[0].id));
});
