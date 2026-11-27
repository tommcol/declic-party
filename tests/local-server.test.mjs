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

test('Le serveur Node synchronise une manche et reprend ses données et alarmes après un arrêt',{timeout:34000},async t=>{
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
   close:()=>ws.close(),
   messages,
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
 assert.equal(full.tracks.length,5166);
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

 const leader=await connect(code);
 leader.send({type:'host',token});
 await phase(leader,'reveal');
 leader.send({type:'next'});
 await phase(leader,'finished');
 const teamMessage=(client,predicate)=>client.waitFor(m=>m.type==='team-plan'&&predicate(m.teamPlan)).then(m=>m.teamPlan);
 for(const count of [4,6,8,10,7,2]){
  leader.send({type:'teams-config',count});
  await teamMessage(leader,plan=>plan.groups.length===count);
 }
 const second=await connect(code);
 second.send({type:'join',token:sessions[1].token});
 await second.waitFor(m=>m.type==='session');
 leader.send({type:'teams-open',open:true});
 await teamMessage(restoredPlayer,plan=>plan.open);
 restoredPlayer.send({type:'teams-choose',group:'0'});
 second.send({type:'teams-choose',group:'0'});
 const races=await Promise.all([restoredPlayer,second].map(player=>player.waitFor(m=>m.type==='error'||m.teamPlan?.groups[0].members.length===1)));
 assert.ok(races.some(m=>m.teamPlan));
 const filled=await teamMessage(leader,plan=>plan.groups[0].members.length===1);
 const firstId=filled.groups[0].members[0].id;
 const loser=firstId===sessions[0].id?second:restoredPlayer;
 const loserId=filled.unassigned[0].id;
 const rejected=races.some(m=>m.type==='error')?races.find(m=>m.type==='error'):await loser.waitFor(m=>m.type==='error');
 assert.match(rejected.message,/complète/);
 leader.send({type:'teams-mode',mode:'manual'});
 await teamMessage(leader,plan=>plan.mode==='manual');
 leader.send({type:'teams-choose',player:loserId,group:'1'});
 await teamMessage(leader,plan=>plan.unassigned.length===0&&plan.groups[1].members.length===1);

 const third=await connect(code);
 third.send({type:'join',name:'Troisième personne'});
 const thirdSession=await third.waitFor(m=>m.type==='session');
 const grown=await teamMessage(leader,plan=>plan.total===3);
 assert.deepEqual(grown.groups.map(group=>group.capacity),[2,1]);
 assert.equal(grown.groups[0].members[0].id,firstId);
 leader.send({type:'teams-mode',mode:'free'});
 await teamMessage(leader,plan=>plan.total===3&&plan.mode==='free');
 third.send({type:'teams-choose',group:'0'});
 await teamMessage(leader,plan=>plan.groups[0].members.length===2);
 await sleep(1050); // Respect the WebSocket per-client burst limit.
 leader.send({type:'teams-style',group:'1',name:'Les Comètes',color:'#a01132',icon:'☄️'});
 await teamMessage(leader,plan=>plan.groups[1].name==='Les Comètes');
 leader.send({type:'teams-gather',active:true});
 const gathering=await teamMessage(loser,plan=>plan.gather);
 assert.equal(gathering.groups[1].color,'#a01132');
 const gatheringOthers=await teamMessage(third,plan=>plan.gather);
 assert.notEqual(gatheringOthers.groups[0].color,gatheringOthers.groups[1].color);
 const traffic=third.messages.filter(m=>m.type==='team-plan').length;
 await sleep(200);
 assert.equal(third.messages.filter(m=>m.type==='team-plan').length,traffic);
 leader.send({type:'teams-gather',active:false});
 await teamMessage(third,plan=>!plan.gather&&plan.groups[1].name==='Les Comètes');

 await request('/api/rooms','POST',{room:code,token,questions:[question],input:'qcm',musicGame:'blind',teamPlay:true,randomTeamCount:2});
 await leader.waitFor(m=>m.state?.teamPlay&&m.state.phase==='lobby');
 leader.send({type:'teams-gather',active:true});
 await teamMessage(leader,plan=>plan.gather&&plan.total===3);
 leader.send({type:'play'});
 const grouped=await third.waitFor(m=>m.state?.phase==='playing'&&m.state.teamPlay);
 assert.equal(grouped.state.teamPlan,null);
 assert.equal(grouped.state.myRandomTeam,0);
 third.send({type:'teams-choose',group:'1'});
 assert.match((await third.waitFor(m=>m.type==='error')).message,/verrouillées/);
 await sleep(Math.max(0,grouped.state.startAt-Date.now())+25);
 leader.send({type:'pause'});
 await phase(leader,'paused');
 leader.send({type:'teams-gather',active:true});
 await teamMessage(leader,plan=>plan.gather);
 leader.send({type:'resume'});
 const resumed=await leader.waitFor(m=>m.state?.phase==='playing'&&m.state.event?.type==='resume');
 assert.equal(resumed.state.teamPlan,null);
 leader.send({type:'reveal'});
 await phase(leader,'reveal');
 leader.send({type:'next'});
 await phase(leader,'finished');
 await request('/api/rooms','POST',{room:code,token,questions:[question],input:'qcm',musicGame:'blind'});
 const individual=await leader.waitFor(m=>m.state?.phase==='lobby'&&m.state.teamPlay===false&&m.state.teamPlan?.total===3);
 assert.equal(individual.state.randomTeams,undefined);
 assert.ok(individual.state.teamPlan.groups[0].members.some(member=>member.id===thirdSession.id));
 assert.ok(individual.state.teamResults.some(result=>result.game==='blind'&&result.groups.some(group=>group.name==='Les Comètes')));
 assert.ok(individual.state.eveningRanking.some(row=>row.id===sessions[0].id&&row.points>0));

 const clip={...question,id:'clip-piano',kind:'audio',target:'title',title:'Piano',artist:'Déclic Party'};
 await request('/api/rooms','POST',{room:code,token,musicGame:'tyrolien',questions:[clip],input:'qcm',mountain:{levels:4,bonuses:false}});
 await leader.waitFor(m=>m.state?.mountain&&m.state.phase==='lobby');
 await sleep(1050);
 leader.send({type:'teams-config',count:6});
 await teamMessage(leader,plan=>plan.groups.length===6);
 const extraPlayers=await Promise.all([connect(code),connect(code),connect(code)]);
 extraPlayers.forEach((client,index)=>client.send({type:'join',name:'Nouvelle personne '+index}));
 await Promise.all(extraPlayers.map(client=>client.waitFor(m=>m.type==='session')));
 leader.send({type:'teams-mode',mode:'auto'});
 leader.send({type:'teams-shuffle'});
 await teamMessage(leader,plan=>plan.mode==='auto'&&plan.total===6&&plan.groups.every(group=>group.members.length===1));
 leader.send({type:'play'});
 const {state:ty}=await restoredTv.waitFor(m=>m.state?.mountain&&m.state.phase==='playing');
 assert.equal(ty.mountain.teams.length,6);
 assert.ok(ty.mountain.teams.some(group=>group.name==='Les Comètes'&&group.color==='#a01132'));
 assert.equal(ty.question.answer,undefined);
 assert.equal(ty.mountain.roster,undefined);
 await sleep(Math.max(0,ty.startAt-Date.now())+30);
 extraPlayers.forEach(client=>client.send({type:'answer',questionId:ty.question.id,answer:'Piano'}));
 const replies=await Promise.all(extraPlayers.map(client=>client.waitFor(m=>m.type==='received'&&m.accepted)));
 assert.equal(replies.length,3);
 leader.send({type:'reveal',questionId:ty.question.id});
 const {state:reveal}=await restoredTv.waitFor(m=>m.state?.mountain&&m.state.phase==='reveal');
 assert.equal(reveal.question.artist,'Déclic Party');
 assert.equal(reveal.history[0].results.filter(player=>player.result.correct).length,3);
 leader.send({type:'next',questionId:ty.question.id});
 const {state:recycled}=await restoredTv.waitFor(m=>m.state?.mountain?.round===2);
 assert.notEqual(recycled.question.id,ty.question.id);
 leader.send({type:'stop'});
 const {state:finished}=await restoredTv.waitFor(m=>m.state?.mountain&&m.state.phase==='finished');
 assert.equal(finished.gameStatistics.filter(player=>player.correct===1).length,3);
 await request('/api/rooms','POST',{room:code,token,questions:[question],input:'qcm',musicGame:'blind'});
 const {state:after}=await restoredTv.waitFor(m=>m.state?.musicGame==='blind'&&m.state.phase==='lobby'&&m.state.teams.length===6);
 assert.equal(after.eveningRanking.filter(row=>row.correct>=1).length>=3,true);
 assert.equal((await request('/api/evening')).active.code,code);

});
