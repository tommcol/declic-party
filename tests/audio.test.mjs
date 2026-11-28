import test from 'node:test';
import assert from 'node:assert/strict';
import {SoundDesk} from '../public/audio.js';
test('Une écoute limitée programme son arrêt et le palier suivant repart du début',()=>{
 const calls=[];const desk=new SoundDesk();desk.buffer={duration:30};desk.ctx={currentTime:10,destination:{},createBufferSource(){return {playbackRate:{},connect(){},disconnect(){},start(...v){calls.push(['start',...v]);},stop(...v){calls.push(['stop',...v]);}};},createGain(){return {gain:{},connect(){}};}};
 desk.play(1);assert.deepEqual(calls,[['start',0,0],['stop',11]]);desk.play(1);assert.equal(calls.length,2);desk.ctx.currentTime=11.2;desk.pause();desk.stop();desk.play(2);assert.deepEqual(calls.at(-2),['start',0,0]);assert.deepEqual(calls.at(-1),['stop',13.2]);
});

test('Le volume de l’extrait peut changer pendant la lecture indépendamment du mixage',()=>{
 const desk=new SoundDesk();
 desk.ctx={currentTime:10,destination:{},createBufferSource(){
  return {playbackRate:{},connect(){},start(){}};
 },createGain(){return {gain:{},connect(){}};}};
 desk.buffer={duration:30};
 desk.play();
 desk.setLevel('excerpt',.2);
 desk.setLevel('ambience',.6);
 desk.setLevel('effects',.8);
 assert.equal(desk.excerptGain.gain.value,.2);
 assert.equal(desk.ambience,.6);
 assert.equal(desk.effects,.8);
});

test('Un extrait indisponible ne peut pas rejouer le morceau précédent',async t=>{
 const desk=new SoundDesk();
 desk.ctx={state:'running'};
 desk.buffer={duration:30};
 t.mock.method(globalThis,'fetch',async ()=>new Response(null,{status:503}));
 await assert.rejects(()=>desk.load({id:'absent',audioUrl:'/api/music/preview/123'}),/ne peut pas être chargé/);
 assert.equal(desk.buffer,null);
});
