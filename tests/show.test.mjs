import assert from 'node:assert/strict';
import test from 'node:test';
import {showRoundSummary,showScene,showVenue,stageReaction} from '../public/show.js';

test('Grand Soir ouvre un décor par jeu et revient en salle aux entractes', () => {
  const expected={blind:'studio',progressive:'laboratory',bingo:'disco',timeline:'chronology',coversQuiz:'duel',
    soundtrack:'cinema',covers:'gallery',survival:'arena',chain:'chain'};
  for(const [musicGame,scene] of Object.entries(expected)){
    assert.equal(showScene({musicGame,phase:'playing'}),scene);
    assert.equal(showScene({musicGame,phase:'lobby',total:5}),scene);
    assert.equal(showScene({musicGame,phase:'finished'}),scene);
    assert.equal(showScene({musicGame,phase:'finished'},null,true),'plateau');
    for(const phase of ['lobby','paused']){
      assert.equal(showVenue({musicGame,phase}),'Salle principale');
    }
  }
  assert.equal(showVenue({musicGame:'tyrolien',phase:'playing'}),'Le Tyrolien');
  assert.equal(showVenue({musicGame:'tyrolien',phase:'playing'},true),'Salle principale');
});

test('La régie distingue réponses partielles, absences et ex æquo', () => {
  const answer=(id,result)=>({id,name:id,result});
  const rows=[
    answer('a',{attempts:1,correct:true,elapsed:1000}),
    answer('b',{attempts:1,correct:true,elapsed:1000}),
    answer('c',{attempts:1,correct:true,elapsed:4000}),
    answer('d',{attempts:1,correct:false,parts:['title']}),
    answer('e',{attempts:1,correct:false}),
    answer('f',{})
  ];
  const summary=showRoundSummary({results:rows});
  assert.equal(summary.complete,3);
  assert.equal(summary.partial,1);
  assert.equal(summary.wrong,1);
  assert.equal(summary.absent,1);
  assert.equal(summary.median,1000);
  assert.deepEqual(summary.fastest.map(row=>row.id),['a','b']);
  assert.deepEqual(summary.slowest.map(row=>row.id),['c']);
  assert.deepEqual(showRoundSummary({results:rows.slice(0,2)}).slowest,[]);
});

test('La TV couronne le premier Bingo même lorsque la deuxième étape a un autre gagnant',()=>{
 const game={event:{type:'podium'},settings:{bingo:true},bingoFinishRows:1,
  teams:[{id:'a',name:'Alpha',score:100},{id:'b',name:'Beta',score:150}],
  bingoMilestones:[{rows:1,winners:['a']},{rows:2,winners:['b']}]};
 assert.deepEqual(stageReaction(game).players.map(player=>player.id),['a']);
});
