import {test} from 'node:test';import assert from 'node:assert/strict';
import {createGame,applyAction,publicGame,returnToLobby,DEMO} from '../public/engine.js';
const init=(mode='usb')=>createGame([DEMO[0]],[{id:'a',name:'Alpha'},{id:'b',name:'Beta'}],mode,'qcm',{speed:false,streak:false});
test('Premier buzzer, pause, mauvaise réponse et exclusion du titre',()=>{let s=applyAction(init(),{type:'play'},1000);s=applyAction(s,{type:'buzz',team:'a'},5000);assert.equal(s.phase,'buzzed');assert.equal(s.buzz,'a');assert.equal(applyAction(s,{type:'buzz',team:'b'},5001),s);s=applyAction(s,{type:'judge',correct:false},6000);assert.equal(s.phase,'playing');assert.deepEqual(s.blocked,['a']);assert.equal(applyAction(s,{type:'buzz',team:'a'},7000),s);s=applyAction(s,{type:'buzz',team:'b'},7001);s=applyAction(s,{type:'judge',correct:true},7500);assert.equal(s.teams[1].score,100);assert.equal(s.phase,'reveal');s=applyAction(s,{type:'next'},8000);assert.equal(s.phase,'finished');});
test('Le compte à rebours et la fin du délai refusent les buzz',()=>{let s=applyAction(init(),{type:'play'},1000);assert.equal(applyAction(s,{type:'buzz',team:'a'},3999),s);assert.equal(applyAction(s,{type:'buzz',team:'a'},s.endAt),s);});
test('Téléphone : accents tolérés, réponse unique, points révélés ensemble',()=>{let s=applyAction({...init('phone'),input:'text',settings:{speed:true,streak:false}},{type:'play'},1000);s=applyAction(s,{type:'answer',team:'a',answer:'frere jacques'},5000);assert.equal(s.teams[0].score,0);assert.equal(s.answers.a.correct,true);assert.equal(applyAction(s,{type:'answer',team:'a',answer:'autre'},5100),s);s=applyAction(s,{type:'reveal'},6000);assert.ok(s.teams[0].score>100);const once=s.teams[0].score;s=applyAction(s,{type:'reveal'},6100);assert.equal(s.teams[0].score,once);});
test('Les clients publics ne reçoivent ni solution, ni alias, ni jeton',()=>{const s=init('phone');s.teams[0].token='SECRET';s.hostHash='SECRET';s.questions[0].aliases=['SECRET'];const p=publicGame(s);assert.ok(!JSON.stringify(p).includes('SECRET'));assert.equal(p.question.answer,undefined);assert.equal(p.questions,undefined);assert.equal(p.question.options.length,4);});
test('Pas de réponse après expiration, ni de points pour un inconnu',()=>{let s=applyAction({...init('phone'),input:'text',settings:{speed:true,streak:false}},{type:'play'},1000);assert.equal(applyAction(s,{type:'answer',team:'a',answer:'Frère Jacques'},s.endAt+1),s);assert.equal(applyAction(s,{type:'answer',team:'intrus',answer:'Frère Jacques'},5000),s);s=applyAction(s,{type:'timeout'},s.endAt);assert.equal(s.phase,'reveal');assert.equal(s.teams[0].score,0);});
test('Toutes les équipes bloquées : révélation sans attribution',()=>{let s=applyAction(init(),{type:'play'},0);let at=5000;for(const id of ['a','b']){s=applyAction(s,{type:'buzz',team:id},at);s=applyAction(s,{type:'judge',correct:false},at+500);at+=1000;}assert.equal(s.phase,'reveal');assert.equal(s.teams[0].score,0);});

test('Arrêt animateur : valide la manche une seule fois, bloque les actions et conserve les joueurs',()=>{let s=applyAction(init('phone'),{type:'play'},1000);s=applyAction(s,{type:'answer',team:'a',answer:'Frère Jacques'},5000);s=applyAction(s,{type:'stop'},6000);assert.equal(s.phase,'finished');assert.equal(s.teams[0].score,100);assert.equal(s.history.length,1);assert.equal(s.nextAt,0);assert.equal(publicGame(s).phase,'finished');assert.equal(applyAction(s,{type:'stop'},7000),s);assert.equal(applyAction(s,{type:'next'},7000),s);assert.equal(applyAction(s,{type:'answer',team:'b',answer:'Frère Jacques'},7000),s);});
test('Arrêt pendant le compte à rebours : aucun tirage ni point inventé',()=>{let s=applyAction(init('phone'),{type:'play'},1000);s=applyAction(s,{type:'stop'},2000);assert.equal(s.phase,'finished');assert.equal(s.history.length,0);assert.equal(s.teams[0].score,0);});

test('Retour au salon : les sessions et les anciens résultats survivent à un abandon',()=>{
 const state=applyAction(init('phone'),{type:'play'},1000);
 state.teams[0].token='session';
 state.teams[0].avatar=13;
 state.teams[0].score=120;
 state.nextAt=9000;
 state.eveningTotals={a:{points:400}};
 state.teamResults=[{game:'tyrolien'}];
 const lobby=returnToLobby(state,state.eveningTotals);
 assert.equal(lobby.phase,'lobby');
 assert.equal(lobby.endAt,0);
 assert.equal(lobby.nextAt??0,0);
 assert.deepEqual(lobby.questions,[]);
 assert.deepEqual(lobby.teams.map(({id,score})=>[id,score]),[['a',0],['b',0]]);
 assert.equal(lobby.teams[0].token,'session');
 assert.equal(lobby.teams[0].avatar,13);
 assert.deepEqual(lobby.eveningTotals,{a:{points:400}});
 assert.deepEqual(lobby.teamResults,[{game:'tyrolien'}]);
});
test('Bingo : la fin sur la première ligne exige une ligne validée',()=>{
 const state={...init('phone'),phase:'reveal',settings:{bingo:true},bingoMilestones:[]};
 const stop={type:'stop',bingoLine:true};
 assert.equal(applyAction(state,stop,5000),state);
 state.bingoMilestones=[{rows:1,index:3,winners:['a']},{rows:2,index:8,winners:['b']}];
 const finished=applyAction(state,stop,5000);
 assert.equal(finished.phase,'finished');
 assert.equal(publicGame(finished).bingoFinishRows,1);
 assert.deepEqual(finished.bingoMilestones,state.bingoMilestones);
});
