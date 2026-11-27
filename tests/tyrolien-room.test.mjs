import test from 'node:test';
import assert from 'node:assert/strict';
import {applyTyrolien,createTyrolien,tyrolienView} from '../src/tyrolien-room.js';
import {practiceClips} from '../public/music-source.js';

const host={role:'host'};
const server={role:'server'};
const player=team=>({role:'player',team});
const players=Array.from({length:40},(_,index)=>({id:'p'+index,name:'Joueur '+index}));

for(const teamCount of [2,3,4,6]){
 test(`Partie complète à ${teamCount} équipes et 40 participants`,()=>{
  const g=createTyrolien(),room={tyrolien:g,teams:players};
  let now=10000, turns=0;
  const apply=(action,who=host)=>applyTyrolien(g,action,who,players,now);
  const tick=()=>{now=g.nextAt;apply({type:'ty-tick'},server);};
  apply({type:'ty-start',names:Array.from({length:teamCount},(_,i)=>'Équipe '+i),levels:4,seconds:5,
   bonuses:false,assignments:{p0:'1'}});
  const sizes=g.teams.map(team=>g.roster.filter(p=>p.team===team.id).length);
  assert.ok(Math.max(...sizes)-Math.min(...sizes)<=1);
  const played=new Set();
  while(g.phase!=='finished'&&turns<(teamCount-1)*5+1){
   assert.equal(g.phase,'listen');
   assert.ok(!played.has(g.clips[g.index]));
   played.add(g.clips[g.index]);
   tick();
   const question=tyrolienView(room,'player','p0').tyrolien.question;
   assert.equal(question.answer,undefined);
   assert.equal(question.audio,undefined);
   assert.equal(new Set(question.options).size,4);
   const answer=practiceClips.find(clip=>clip.id===g.clips[g.index]).answer;
   const losing=g.teams.filter(team=>!team.eliminated).at(-1).id;
   const action={type:'ty-answer',questionId:g.questionId,value:answer};
   for(const participant of g.roster){
    if(participant.team===losing)continue;
    apply(action,player(participant.id));
    assert.throws(()=>apply(action,player(participant.id)));
   }
   now=g.nextAt;
   const late=g.roster.find(participant=>participant.team===losing);
   assert.throws(()=>apply(action,player(late.id)));
   tick();
   assert.equal(tyrolienView(room,'tv').tyrolien.question.answer,answer);
   if(g.round===4)assert.equal(g.teams.at(-1).eliminated,false);
   if(g.round===5)assert.equal(g.teams.at(-1).eliminated,true);
   tick();
   turns++;
  }
  assert.equal(g.winner,'0');
  assert.equal(turns,(teamCount-1)*5);
  assert.equal(g.eliminated.length,teamCount-1);
  assert.equal(tyrolienView(room,'host').tyrolien.scores.length,40);
 });
}
