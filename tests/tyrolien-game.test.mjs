import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame, publicGame, roundStatistics} from '../public/engine.js';
import {teamIdentity} from '../public/teams.js';
import {applyMountain, mountainSettings, mountainView, startMountain} from '../src/tyrolien-game.js';

const clip=id=>({id,kind:'audio',universe:'music',target:'title',title:'Chanson '+id,artist:'Musicien',
 prompt:'Quel titre ?',answer:'Chanson '+id,options:['Chanson '+id,'Autre titre'],duration:5,points:100});

function fixture(count, settings={}, options={}){
 const groups=Array.from({length:count},(_,index)=>teamIdentity(index));
 const players=Array.from({length:count+1},(_,index)=>({id:'p'+index,name:'Joueur '+index}));
 const assignments=Object.fromEntries(players.map(({id},index)=>[id,String(index%count)]));
 let room={...createGame(['a','b','c'].map(clip),players,'phone','qcm',settings),mountain:mountainSettings(options)};
 startMountain(room,{groups,assignments});
 room=applyMountain(room,{type:'play'},0);
 return room;
}
function answer(room,player,right,elapsed){
 const q=room.questions[room.index];
 return applyMountain(room,{type:'answer',team:player,answer:right?q.answer:'Autre titre',questionId:q.id},room.startAt+elapsed);
}

for(const count of [2,3,4,5,6]){
 test(`Tyrolien intégré · ${count} équipes, tailles différentes et points communs`,()=>{
  let room=fixture(count,{titlePoints:200,speed:true});
  room=answer(room,'p0',true,100);
  const dup=answer(room,'p0',true,200);
  assert.equal(dup,room);
  for(let index=1;index<count;index++)room=answer(room,'p'+index,index!==1,200+index);
  const result=applyMountain(room,{type:'reveal'},room.startAt+500);
  assert.equal(result.mountain.loser,'1');
  assert.equal(result.mountain.teams[1].position,1);
  assert.equal(result.mountain.results.find(team=>team.id==='0').players,2);
  assert.ok(result.teams[0].score>200);
  assert.equal(result.teams[1].score,0);
  assert.equal(applyMountain(result,{type:'reveal'},9000),result);
  assert.equal(publicGame(room,'p0').question.answer,undefined);
  assert.equal(publicGame(result,'p0').question.title,'Chanson a');
 });
}

test('Série collective, attaque votée et participation après élimination',()=>{
 let room=fixture(3,{streak:true,jokers:true},{levels:4});
 for(let i=0;i<4;i++){
  room=answer(room,'p0',true,100);
  room=answer(room,'p3',true,110);
  room=answer(room,'p1',true,200);
  room=answer(room,'p2',false,200);
  room=applyMountain(room,{type:'reveal'},room.startAt+500);
  if(i<3)room=applyMountain(room,{type:'next'},room.startAt+600);
 }
 assert.equal(room.mountain.beneficiary,'0');
 assert.ok(room.teams[0].joker.held);
 assert.ok(room.answers.p0.breakdown.streak>0);
 room=applyMountain(room,{type:'next'},room.startAt+1000);
 assert.equal(room.mountain.phase,'vote');
 assert.equal(mountainView(room,'player','p0').tallies,undefined);
 assert.equal(applyMountain(room,{type:'ty-vote',player:'p2',value:'1'},room.nextAt-5000),room);
 room=applyMountain(room,{type:'ty-vote',player:'p0',value:'2'},room.nextAt-5000);
 assert.equal(applyMountain(room,{type:'ty-vote',player:'p0',value:'1'},room.nextAt-3000),room);
 room=applyMountain(room,{type:'ty-tick'},room.nextAt);
 assert.equal(room.mountain.target,'2');
 assert.deepEqual(room.mountain.eliminated,['2']);
 assert.equal(room.mountain.teams[0].streak,0);
 assert.equal(room.nextAt,0);
 room=applyMountain(room,{type:'next'},room.startAt+17000);
 assert.equal(mountainView(room,'player','p2').team,'2');
 room=answer(room,'p2',true,10);
 room=answer(room,'p0',true,100);
 room=applyMountain(room,{type:'reveal'},room.startAt+500);
 assert.ok(room.teams[2].score>0);
 assert.ok(!room.mountain.results.some(team=>team.id==='2'));
 assert.equal(room.mountain.loser,'1');
});

test('Égalité parfaite, pause, recyclage automatique et historique borné',()=>{
 let room=fixture(2,{autoNext:true,autoNextSeconds:3});
 room=applyMountain(room,{type:'pause'},room.startAt+500);
 assert.equal(room.phase,'paused');
 room=applyMountain(room,{type:'resume'},10000);
 assert.equal(room.endAt,14500);
 let previous;
 for(let i=0;i<25;i++){
  const q=room.questions[room.index];
  assert.notEqual(q.title,previous?.title);
  assert.notEqual(q.id,previous?.id);
  if(previous)assert.equal(applyMountain(room,{type:'answer',team:'p0',questionId:previous.id,answer:q.answer},room.startAt+100),room);
  room=applyMountain(room,{type:'timeout'},room.endAt);
  assert.equal(room.mountain.loser,null);
  previous=q;
  room=applyMountain(room,{type:'ty-tick'},room.nextAt);
 }
 assert.equal(room.mountain.roundsPlayed,25);
 assert.equal(room.history.length,20);
 assert.equal(roundStatistics(room.history,room.teams,room.archivedStats)[0].absent,25);
});

test('Deux équipes, attaque directe, victoire et arrêt du moteur',()=>{
 let room=fixture(2,{},{levels:4});
 for(let i=0;i<4;i++){
  room=answer(room,'p0',true,100);
  room=answer(room,'p3',true,100);
  room=applyMountain(room,{type:'reveal'},room.startAt+500);
  if(i<3)room=applyMountain(room,{type:'next'},room.startAt+600);
 }
 room=applyMountain(room,{type:'ty-tick'},room.nextAt);
 assert.equal(room.mountain.phase,'attack');
 assert.equal(room.mountain.winner,'0');
 room=applyMountain(room,{type:'ty-tick'},room.nextAt);
 assert.equal(room.phase,'finished');
 assert.equal(room.nextAt,0);
 assert.equal(applyMountain(room,{type:'next'},100000),room);
});
