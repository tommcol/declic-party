import test from 'node:test';
import assert from 'node:assert/strict';
import {SoundDesk} from '../public/audio.js';
test('Une écoute limitée programme son arrêt et le palier suivant repart du début',()=>{
 const calls=[];const desk=new SoundDesk();desk.buffer={duration:30};desk.ctx={currentTime:10,destination:{},createBufferSource(){return {playbackRate:{},connect(){},disconnect(){},start(...v){calls.push(['start',...v]);},stop(...v){calls.push(['stop',...v]);}};},createGain(){return {gain:{},connect(){}};}};
 desk.play(1);assert.deepEqual(calls,[['start',0,0],['stop',11]]);desk.play(1);assert.equal(calls.length,2);desk.ctx.currentTime=11.2;desk.pause();desk.stop();desk.play(2);assert.deepEqual(calls.at(-2),['start',0,0]);assert.deepEqual(calls.at(-1),['stop',13.2]);
});
