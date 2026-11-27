import assert from 'node:assert/strict';
import test from 'node:test';
import {changeRoulette,rouletteIndex,rouletteView} from '../public/roulette.js';

const host={role:'host'};
const players=[{id:'a',name:'Alice'},{id:'b',name:'Bastien'}];
const choices=[{id:'bingo',name:'Bingo'},{id:'blind',name:'Blind test'}];
const start={type:'roulette-start',kind:'game',options:choices};

test('Le serveur réserve le STOP au joueur désigné et masque le résultat jusqu’à la révélation',()=>{
 const wheel=changeRoulette(null,start,host,players,['a'],1000);
 assert.equal(wheel.player.id,'b');
 assert.equal(wheel.deadline,16000);
 assert.equal(rouletteView(wheel,1000).result,null);
 const stop={type:'roulette-stop',id:wheel.id};
 assert.equal(changeRoulette(wheel,stop,{role:'player',team:'a'},players,[],2000),wheel);
 const slowed=changeRoulette(wheel,stop,{role:'player',team:'b'},players,[],2000);
 assert.equal(changeRoulette(slowed,stop,host,players,[],2200),slowed);
 assert.equal(rouletteView(slowed,4399).result,null);
 assert.deepEqual(rouletteView(slowed,4400).result,wheel.selected);
});

test('Une roulette sans animation révèle immédiatement et déduplique les choix',()=>{
 const wheel=changeRoulette(null,{...start,animation:false,options:[choices[0],choices[0]]},host,players,[],100);
 assert.equal(wheel.optionsCount,1);
 assert.deepEqual(rouletteView(wheel,100).result,choices[0]);
 assert.equal(changeRoulette(wheel,{type:'roulette-dismiss',id:wheel.id},{role:'tv'},players,[],100),wheel);
 assert.equal(changeRoulette(wheel,{type:'roulette-dismiss',id:wheel.id},host,players,[],100),null);
 for(let roll=0;roll<100;roll++)assert.ok(rouletteIndex(7)<7);
});
