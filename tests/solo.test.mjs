import test from 'node:test';
import assert from 'node:assert/strict';
import {startSolo,answerSolo,nextSolo} from '../public/solo-engine.js';
const questions=[{id:'a',answer:'Paris',options:['Paris','Lyon','Dijon','Nice'],duration:30},{id:'b',answer:'2',options:['1','2','3','4'],duration:30}];
test('Solo : correction immédiate, pas de double score, suite et bilan',()=>{let s=startSolo(questions,1000);assert.equal(nextSolo(s),s);assert.equal(answerSolo(s,'intrus',1100),s);s=answerSolo(s,'Paris',1200);assert.equal(s.score,100);assert.equal(s.phase,'reveal');assert.equal(answerSolo(s,'Paris',1300),s);s=nextSolo(s,2000);assert.equal(s.deadline,32000);s=answerSolo(s,'1',2500);assert.equal(s.score,100);s=nextSolo(s,3000);assert.equal(s.phase,'finished');assert.equal(s.results.filter(r=>r.correct).length,1);assert.equal(s.results.length,2);});
test('Solo : une réponse après expiration ne gagne aucun point',()=>{const s=answerSolo(startSolo(questions,1000),'Paris',31000);assert.equal(s.score,0);assert.equal(s.results[0].answer,null);assert.equal(s.phase,'reveal');});
test('Solo : expiration sans réponse et nouvelle partie indépendante',()=>{const s=answerSolo(startSolo(questions,0),null,30001);assert.equal(s.results[0].correct,false);const fresh=startSolo(questions,40000);assert.equal(fresh.score,0);assert.deepEqual(fresh.results,[]);assert.throws(()=>startSolo([]));});
