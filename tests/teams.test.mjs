import assert from 'node:assert/strict';
import test from 'node:test';
import {changeTeamPlan,startTeamPlan,teamCapacity,teamContrast} from '../public/teams.js';

const host={role:'host'};
const players=count=>Array.from({length:count},(_,index)=>({id:'p'+index,name:'Joueur '+index}));
const configure=(room,count)=>changeTeamPlan(room,{type:'teams-config',count},host);

test('Les capacités équilibrées correspondent aux six cas de la soirée',()=>{
 for(const [count,expected] of [
  [20,[5,5,5,5]],[26,[7,7,6,6]],[30,[5,5,5,5,5,5]],[35,[6,6,6,6,6,5]],
  [100,[13,13,13,13,12,12,12,12]],[300,Array(10).fill(30)]
 ]){
  const room={phase:'lobby',teams:players(count)};
  configure(room,expected.length);
  assert.deepEqual(teamCapacity(room.teamPlan,room.teams).groups.map(group=>group.capacity),expected);
  changeTeamPlan(room,{type:'teams-mode',mode:'auto'},host);
  const plan=startTeamPlan(room);
  assert.deepEqual(teamCapacity(plan,room.teams).groups.map(group=>group.members.length),expected);
  assert.equal(plan.open,false);
 }
});

test('Les arrivées préservent les choix et l’animateur peut changer la répartition',()=>{
 const room={phase:'lobby',teams:players(5)};
 configure(room,2);
 assert.equal(room.teamPlan.mode,'free');
 changeTeamPlan(room,{type:'teams-open',open:true},host);
 const choose=(id,group)=>changeTeamPlan(room,{type:'teams-choose',group},{role:'player',team:id});
 choose('p0','0');choose('p1','0');choose('p2','0');
 assert.throws(()=>choose('p3','0'),/complète/);
 choose('p4','1');
 room.teams.push(...players(7).slice(5));
 choose('p3','1');
 choose('p4','0');
 assert.deepEqual(teamCapacity(room.teamPlan,room.teams).groups.map(group=>group.members.length),[4,1]);
 changeTeamPlan(room,{type:'teams-mode',mode:'manual'},host);
 assert.throws(()=>choose('p5','1'),/indisponible/);
 changeTeamPlan(room,{type:'teams-choose',player:'p5',group:'1'},host);
 changeTeamPlan(room,{type:'teams-shuffle'},host);
 assert.deepEqual(teamCapacity(room.teamPlan,room.teams).groups.map(group=>group.members.length),[4,3]);
 room.phase='playing';
 assert.throws(()=>configure(room,3),/verrouillées/);
 assert.throws(()=>changeTeamPlan(room,{type:'teams-gather',active:true},host),/pause/);
 room.phase='paused';
 changeTeamPlan(room,{type:'teams-gather',active:true},host);
 assert.equal(room.teamPlan.gather,true);
});

test('Identités personnalisées et nombre maximal technique ou propre au Tyrolien',()=>{
 const room={phase:'lobby',teams:players(300)};
 configure(room,300);
 assert.equal(new Set(room.teamPlan.groups.map(group=>group.name)).size,300);
 assert.throws(()=>configure(room,301),/300/);
 room.tyrolien={};
 assert.throws(()=>configure(room,7),/6/);
 configure(room,6);
 changeTeamPlan(room,{type:'teams-style',group:'5',color:'#ffff00',icon:'🌟',name:'Les Étoiles'},host);
 assert.equal(room.teamPlan.groups[5].name,'Les Étoiles');
 assert.equal(teamContrast('#ffff00'),'#000');
 assert.equal(teamContrast('#121212'),'#fff');
});
