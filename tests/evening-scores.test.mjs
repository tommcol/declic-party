import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,createGame,DEMO,eveningDistinctions,eveningGameResult,eveningTotals,saveGameSnapshot} from '../public/engine.js';
import {applyMountain,mountainSettings,startMountain} from '../src/tyrolien-game.js';

const players=['A','B','C'].map(id=>({id,name:id}));
const question={...DEMO[0],points:50};

test('Tyrolien interrompu : 87/0/0 au jeu, zéro au général et aucun Patron',()=>{
 const initial={...createGame([question],players,'phone'),musicGame:'tyrolien',mountain:mountainSettings({})};
 startMountain(initial,{groups:[{id:'red'},{id:'blue'}],assignments:{A:'red',B:'blue',C:'blue'}});
 const opened=applyMountain(initial,{type:'play'},1000);
 assert.deepEqual(eveningGameResult(applyMountain(opened,{type:'stop'},2000)).rows,[]);
 let room=applyMountain(opened,{type:'answer',team:'A',answer:question.answer},10500);
 room=applyMountain(room,{type:'reveal'},10600);
 assert.deepEqual(room.teams.map(player=>player.score),[87,0,0]);
 assert.equal(room.mountain.loser,'blue');
 const stopped=applyMountain(room,{type:'stop'},10700);
 assert.deepEqual(eveningGameResult(stopped).rows.map(row=>row.points),[0,0,0]);
 assert.equal(eveningDistinctions(saveGameSnapshot(stopped),Object.values(eveningTotals(stopped))).some(award=>award.title==='Le Patron'),false);

 const completed={...stopped,finishReason:'completed',mountain:{...stopped.mountain,winner:'red',
  roster:[{id:'A',team:'red'},{id:'B',team:'red'},{id:'C',team:'blue'}],eliminated:['blue']}};
 const result=eveningGameResult(completed);
 assert.deepEqual(result.rows.map(row=>[row.rank,row.points]),[[1,100],[1,0],[2,0]]);
 const patrons=eveningDistinctions(saveGameSnapshot(completed),Object.values(eveningTotals(completed)))
  .filter(award=>award.title==='Le Patron');
 assert.deepEqual(patrons.map(award=>award.id),['A']);
});

test('Deux parties peuvent partager la même première question et chaque instantané reste unique',()=>{
 function finish(){
  let game=applyAction(createGame([question],players,'phone'),{type:'play'},1000);
  for(const team of ['A','B'])game=applyAction(game,{type:'answer',team,answer:question.answer},5000);
  game=applyAction(game,{type:'reveal'},6000);
  return applyAction(game,{type:'next'},7000);
 }
 const first=finish();
 const second={...finish(),completedGames:saveGameSnapshot(first),eveningTotals:eveningTotals(first)};
 const snapshots=saveGameSnapshot(second);
 assert.equal(snapshots.length,2);
 assert.equal(saveGameSnapshot({...second,completedGames:snapshots}).length,2);
 assert.deepEqual(eveningGameResult(second).rows.map(row=>[row.rank,row.points,row.cumulative]),
  [[1,100,200],[1,100,200],[3,0,0]]);
});

test('Un Bingo arrêté sur une ligne validée conserve le vainqueur de cette ligne',()=>{
 const game={...createGame([question],players,'phone','qcm',{bingo:true}),phase:'finished',finishReason:'bingo-line',
  bingoFinishRows:1,bingoMilestones:[{rows:1,winners:['A']},{rows:2,winners:['B']}],
  history:[{question,results:['A','B'].map(id=>({id,result:{correct:true}}))}]};
 assert.deepEqual(eveningGameResult(game).rows.map(row=>[row.id,row.points]),[['A',100],['B',70]]);
});
