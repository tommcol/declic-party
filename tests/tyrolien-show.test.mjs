import assert from 'node:assert/strict';
import test from 'node:test';
import {mountainMoment, mountainPanel} from '../public/tyrolien-ui.js';

const team=(id,name,position,eliminated=false)=>({id,name,position,eliminated,color:'#ac8056',icon:'◆'});
const teams=[team('a','A <Nord>',0),team('b','B',5),team('c','C',6)];
const base={phase:'reveal',nextAt:0,mountain:{
  teams,levels:6,eliminated:[],results:[{id:'a',players:2,correct:2,totalTime:4000}],
  loser:'b',beneficiary:'a',round:3,phase:'result'
}};
const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');

test('Le Tyrolien distingue montée, vote, attaque, chute et podium',()=>{
  const render=(phase,mountain)=>mountainMoment({...base,phase,mountain:{...base.mountain,...mountain}});
  assert.equal(render('reveal',{}).kind,'climb');
  assert.equal(render('reveal',{phase:'vote'}).kind,'vote');
  assert.equal(render('reveal',{phase:'attack',target:'c'}).kind,'attack');
  const fallen=[...teams.slice(0,2),team('c','C',7,true)];
  assert.deepEqual(render('reveal',{phase:'attack',target:'c',teams:fallen}),
    {kind:'fall',label:'La chute',actor:'c',attacker:'a'});
  assert.equal(render('reveal',{loser:'c',teams:fallen}).kind,'fall');
  assert.equal(render('paused',{}).kind,'pause');
  assert.equal(render('finished',{winner:'a'}).kind,'podium');
});

test('La régie et la TV reprennent les résultats publics sans changer les commandes joueurs',()=>{
  const tv=mountainPanel(base,'tv',escape,true);
  const desk=mountainPanel(base,'host',escape,true);
  assert.match(tv,/Un palier de plus/);
  assert.match(tv,/<meter min="0" max="100" value="100"/);
  assert.match(desk,/Meilleure performance · <b>A &lt;Nord>/);
  const vote={...base,mountain:{...base.mountain,phase:'vote',team:'a'}};
  assert.match(mountainPanel(vote,'player',escape,false),/data-action="mountain-vote"/);
  assert.doesNotMatch(mountainPanel(vote,'tv',escape,false),/data-action="mountain-vote"/);
});
