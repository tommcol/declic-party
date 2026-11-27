import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyAction,publicGame,bingoGrandWinners,audioRemaining,DEMO} from '../public/engine.js';
const teams=[{id:'a',name:'Alpha'},{id:'b',name:'Beta'}];
const audio={id:'audio',kind:'audio',prompt:'Le titre ?',answer:'Titre',title:'Titre',artist:'Artiste',target:'title',options:['Titre','Faux','Non','Autre'],duration:30,points:100};
const start=(input='buzzer',settings={},q=audio)=>applyAction(createGame([q],teams,'phone',input,{speed:false,streak:false,...settings}),{type:'play'},1000);
test('Téléphone-buzzer : priorité, mauvaise réponse, blocage et validation animateur',()=>{let s=start();s=applyAction(s,{type:'buzz',team:'a'},5000);assert.equal(s.buzz,'a');assert.equal(applyAction(s,{type:'buzz',team:'b'},5001),s);assert.equal(applyAction(s,{type:'answer',team:'a',answer:'Titre'},5100),s);s=applyAction(s,{type:'judge',correct:false},6000);assert.ok(s.blocked.includes('a'));assert.equal(applyAction(s,{type:'buzz',team:'a'},6100),s);s=applyAction(s,{type:'buzz',team:'b'},6200);s=applyAction(s,{type:'judge',correct:true},6300);assert.equal(s.phase,'reveal');assert.equal(s.teams[1].score,50);});
test('Un téléphone QCM ne peut pas interrompre la manche avec un buzz',()=>{const s=start('qcm');assert.equal(applyAction(s,{type:'buzz',team:'a'},5000),s);});
test('Progressif : arrêt du son après 1s, nouveau départ de 2s et réduction des points',()=>{let s=start('buzzer',{listening:'progressive',speed:true});assert.equal(audioRemaining(s,3999),0);assert.equal(audioRemaining(s,4500),.5);assert.equal(audioRemaining(s,5100),0);s=applyAction(s,{type:'listen-more',questionId:'audio'},6000);assert.equal(s.listenStep,1);assert.equal(audioRemaining(s,7500),1.5);s=applyAction(s,{type:'buzz',team:'a'},8000);s=applyAction(s,{type:'judge',correct:true},9000);assert.equal(s.teams[0].score,40);assert.equal(s.history[0].results[0].result.breakdown.speed,0);});
test('Une pause conserve le temps d’écoute restant, même après une longue attente',()=>{let s=start('buzzer',{listening:'progressive'});s=applyAction(s,{type:'pause'},4500);s=applyAction(s,{type:'resume'},20000);assert.ok(Math.abs(audioRemaining(s,20200)-.3)<1e-9);assert.equal(audioRemaining(s,21000),0);});
test('Toutes les équipes bloquées en progressif peuvent retenter au palier suivant',()=>{let s=start('buzzer',{listening:'progressive'});for(const [i,team]of ['a','b'].entries()){s=applyAction(s,{type:'buzz',team},5000+i*1000);s=applyAction(s,{type:'judge',correct:false},5500+i*1000);}assert.equal(s.phase,'paused');s=applyAction(s,{type:'listen-more'},7000);assert.deepEqual(s.blocked,[]);assert.equal(s.phase,'playing');});
test('Progressif QCM : nouvel essai à chaque palier, points déjà acquis inchangés',()=>{let s=start('qcm',{listening:'progressive'});s=applyAction(s,{type:'answer',team:'a',answer:'Faux'},5000);s=applyAction(s,{type:'answer',team:'b',answer:'Titre'},5001);s=applyAction(s,{type:'listen-more'},6000);s=applyAction(s,{type:'answer',team:'a',answer:'Titre'},8000);s=applyAction(s,{type:'reveal'},9000);assert.equal(s.teams[0].score,40);assert.equal(s.teams[1].score,50);});
test('La quatrième écoute est la dernière et une ancienne question est refusée',()=>{let s=start('buzzer',{listening:'progressive'});for(let i=0;i<3;i++)s=applyAction(s,{type:'listen-more'},6000+i*2000);assert.equal(s.listenStep,3);assert.equal(applyAction(s,{type:'listen-more'},13000),s);assert.equal(applyAction(s,{type:'buzz',team:'a',questionId:'ancienne'},13000),s);});
test('Paroles : coupure précise, aucun retour du son après pause et réponse générique',()=>{const q={...DEMO.find(q=>q.kind==='lyrics'),title:'Titre privé',artist:'Artiste privé'};let s=start('text',{},q);assert.equal(audioRemaining(s,6500),.5);assert.equal(audioRemaining(s,7000),0);s=applyAction(s,{type:'pause'},8000);s=applyAction(s,{type:'resume'},12000);assert.equal(audioRemaining(s,12001),0);s=applyAction(s,{type:'answer',team:'a',answer:'Pierrot'},13000);s=applyAction(s,{type:'reveal'},14000);assert.equal(s.teams[0].score,100);});
test('Vue téléphone : état du palier partagé, solution et médias personnels protégés',()=>{const s=start('buzzer',{listening:'progressive'});s.questions[0].mediaKey='secret';s.questions[0].audioUrl='/private';const p=publicGame(s,'a');assert.equal(p.settings.listening,'progressive');assert.equal(p.listenStep,0);assert.equal(p.question.title,undefined);assert.equal(p.question.audioUrl,undefined);assert.equal(p.question.mediaKey,undefined);assert.deepEqual(p.question.options,[]);});

test('Dernier survivant : vies, départage et réponses des éliminés',()=>{
 const participants=[...teams,{id:'c',name:'Gamma'}];
 let s=createGame([audio,audio,audio],participants,'phone','qcm',{survival:true,survivalLives:1});
 const act=(type,now,extra={})=>{s=applyAction(s,{type,...extra},now);};
 act('play',1000);
 act('answer',5000,{team:'a',answer:'Titre'});
 act('answer',5001,{team:'b',answer:'Titre'});
 act('reveal',6000);
 assert.equal(publicGame(s,'c').teams.find(t=>t.id==='c').lives,0);
 act('next',7000);
 act('play',8000);
 act('answer',12000,{team:'c',answer:'Titre'});
 act('reveal',13000);
 assert.equal(s.teams.find(t=>t.id==='c').eliminated,true);
 assert.ok(s.teams.find(t=>t.id==='c').score>0);
 assert.equal(s.survivalWinner,undefined);
 assert.deepEqual(s.teams.map(t=>t.lives),[1,1,0]);
 act('next',14000);
 act('play',15000);
 act('answer',19000,{team:'b',answer:'Titre'});
 act('reveal',20000);
 assert.equal(publicGame(s,'b').survivalWinner,'b');
 act('next',21000);
 assert.equal(s.phase,'finished');
});

test('Bingo : mêmes 16 titres, choix secret, cochage à la révélation et trois étapes',()=>{
 const questions=Array.from({length:16},(_,i)=>({...audio,id:'song-'+i,title:'Titre '+i}));
 let s=createGame(questions,teams,'phone','qcm',{bingo:true});
 let now=1000;
 const act=(type,extra={})=>{s=applyAction(s,{type,...extra},now);};
 act('play');
 assert.equal(new Set(s.teams[0].bingo.card.map(q=>q.id)).size,16);
 assert.notDeepEqual(s.teams[0].bingo.card,s.teams[1].bingo.card);
 assert.equal(publicGame(s).bingoCard,undefined);
 assert.equal(publicGame(s,'a').question.id,'bingo-round-0');
 now+=3000;
 act('bingo-mark',{team:'a',song:'song-0'});
 assert.deepEqual(publicGame(s,'a').me,{attempts:1,selectedSong:'song-0'});
 assert.deepEqual(s.teams[0].bingo.marked,[]);
 const first=s;
 act('bingo-mark',{team:'a',song:'song-1'});
 assert.equal(s,first);
 while(s.phase!=='finished'){
  act('reveal');
  assert.ok(s.teams.every(team=>team.bingo.marked.includes(questions[s.index].id)));
  act('next');
  if(s.phase!=='finished'){
   now+=1000;
   act('play');
   now+=3000;
  }
 }
 assert.deepEqual(s.bingoMilestones.map(goal=>goal.rows),[1,2,3]);
 assert.equal(s.index,16);
 assert.equal(s.history.length,16);
});

test('Bingo : les points finaux départagent les gagnants simultanés du Triple Bingo',()=>{
 const milestone=[{rows:3,winners:['a','b'],index:12}];
 const finalists=[{id:'a',score:80},{id:'b',score:110},{id:'c',score:200}];
 assert.deepEqual(bingoGrandWinners(finalists,milestone).map(team=>team.id),['b']);
 finalists[0].score=110;
 assert.deepEqual(bingoGrandWinners(finalists,milestone).map(team=>team.id),['a','b']);
 assert.deepEqual(bingoGrandWinners(finalists),[]);
});

test('Bingo : colonne, ligne et double étape simultanée avec ex æquo',()=>{
 const questions=Array.from({length:16},(_,i)=>({...audio,id:'song-'+i,target:'artist'}));
 let now=1000;
 let state=createGame(questions,teams,'phone','qcm',{bingo:true});
 function act(type,extra={}){state=applyAction(state,{type,...extra},now);}
 act('play');
 const layout=[6,0,1,2,3,7,8,9,4,10,11,12,5,13,14,15];
 for(const team of state.teams)team.bingo.card=layout.map(i=>questions[i]);
 for(let i=0;i<7;i++){
  now+=3100;
  if(i===0){
   act('bingo-mark',{team:'a',song:'song-1'});
   assert.equal(publicGame(state,'a').me.correct,undefined);
   assert.equal(publicGame(state,'b').me,undefined);
  }
  act('reveal');
  if(i===0)assert.equal(publicGame(state,'a').me.correct,false);
  if(i<6){
   assert.deepEqual(state.bingoMilestones,[]);
   act('next');
   act('play');
  }
 }
 assert.deepEqual(state.bingoMilestones,[
  {rows:1,winners:['a','b'],index:6},{rows:2,winners:['a','b'],index:6}
 ]);
 assert.deepEqual(state.bingoProgressions,[{id:'a',previous:0,count:2},{id:'b',previous:0,count:2}]);
 act('next');
 assert.equal(state.phase,'ready');
});

test('Maillon faible : points sécurisés, points perdus et vote privé',()=>{
 const participants=[...teams,{id:'c',name:'Gamma'}];
 const questions=Array.from({length:5},(_,i)=>({...audio,id:'track-'+i}));
 let s=createGame(questions,participants,'phone','qcm',{chain:true,speed:false,streak:false});
 const action=(type,now,extra={})=>{s=applyAction(s,{type,...extra},now);};
 action('play',1000);
 action('answer',4500,{team:'a',answer:'Titre'});
 action('answer',4500,{team:'b',answer:'Titre'});
 action('reveal',5000);
 assert.equal(publicGame(s,'a').chainUnbanked,50);
 assert.equal(s.teams[0].score,0);
 action('next',5100);
 action('play',5200);
 action('chain-bank',8500,{team:'a'});
 action('answer',9000,{team:'b',answer:'Faux'});
 action('reveal',9100);
 assert.equal(s.teams[0].score,50);
 assert.equal(publicGame(s,'b').chainUnbanked,0);
 action('next',9200);
 action('play',9300);
 action('reveal',13000);
 action('chain-vote',13100,{team:'a',candidate:'c'});
 action('chain-vote',13200,{team:'b',candidate:'c'});
 assert.equal(publicGame(s,'a').chainMyVote,'c');
 assert.equal(publicGame(s,'c').chainMyVote,undefined);
 action('next',14000);
 assert.equal(s.teams[2].eliminated,true);
 action('play',14100);
 const before=s;
 action('answer',18000,{team:'c',answer:'Titre'});
 assert.equal(s,before);
});

for(const timelineMode of ['collective','individual']){
 test('Frise '+timelineMode+' : placement, dates égales, confidentialité et classement',()=>{
  const anchor={id:'anchor',title:'Point de départ',artist:'Artiste',year:1980};
  const questions=[1980,1995,1965,2000,2010,2020].map((year,index)=>({
   ...audio,id:'timeline-'+index,target:'timeline',year,prompt:'Titre visible uniquement par l’animateur'
  }));
  let game=createGame(questions,teams,'phone','qcm',{timelineMode,timelineAnchor:anchor});
  let now=1000;
  const act=(type,extra={})=>{game=applyAction(game,{type,...extra},now);};
  act('play');
  now=game.startAt+20;
  assert.equal(publicGame(game,'a').question.year,undefined);
  assert.doesNotMatch(publicGame(game).question.prompt,/Titre visible/);
  assert.deepEqual(publicGame(game,'a').timelineSlots,[0,1]);
  act('answer',{team:'a',answer:'0'});
  now+=10;
  act('answer',{team:'b',answer:'1'});
  const answered=game;
  act('answer',{team:'a',answer:'1'});
  act('reveal');
  assert.equal(game,answered);
  now=game.endAt;
  act('timeout');
  assert.deepEqual(game.teams.map(team=>team.score),[1,1]);
  assert.equal(publicGame(game,'a').teams[0].score,undefined);
  assert.deepEqual(publicGame(game,'a').me,{attempts:1});
  act('next');
  act('play');
  now=game.startAt+20;
  act('answer',{team:'a',answer:'0'});
  now=game.endAt;
  act('timeout');
  assert.equal(publicGame(game,'a').timelineCards.length,timelineMode==='collective'?3:2);
  while(game.phase!=='finished'){
   act('next');
   if(game.phase==='finished')break;
   act('play');
   now=game.endAt;
   act('timeout');
  }
  assert.equal(publicGame(game,'a').timelineResult.rank,1);
  assert.equal(publicGame(game,'a').timelineResult.correct,1);
  assert.equal(publicGame(game,'a').timelineResult.total,6);
  if(timelineMode==='individual')assert.deepEqual(publicGame(game).distribution,[{correct:1,players:2}]);
 });
}

test('Jokers : séries distinctes, cumul impossible, réinitialisation et points bruts',()=>{
 const questions=Array.from({length:8},(_,index)=>({...audio,id:'joker-'+index,target:'soundtrack',answer:'Titre'}));
 let game=createGame(questions,teams,'phone','qcm',{jokers:true,speed:false,streak:false});
 let now=1000;
 const act=(type,extra={})=>{game=applyAction(game,{type,...extra},now);};
 for(let round=0;round<4;round++){
  act('play');
  now=game.startAt+10;
  act('answer',{team:'a',answer:'Titre'});
  now+=10;
  act('answer',{team:'b',answer:'Titre'});
  now=game.endAt;
  act('timeout');
  if(round===1)assert.equal(game.teams[0].joker.earned.length,1);
  act('next');
 }
 assert.equal(game.teams[0].joker.earned.length,1);
 assert.equal(game.teams[1].joker.earned.length,1);
 game.teams[0].joker.held='double';
 const before=game.teams[0].score;
 act('play');
 now=game.startAt+10;
 act('joker',{team:'a'});
 assert.equal(game.teams[0].joker.correct,0);
 assert.equal(game.teams[0].joker.fastest,0);
 assert.equal(game.teams[0].joker.held,undefined);
 const used=game;
 act('joker',{team:'a'});
 assert.equal(game,used);
 act('answer',{team:'a',answer:'Titre'});
 now=game.endAt;
 act('timeout');
 assert.equal(game.teams[0].score,before+200);
 assert.equal(game.history.at(-1).results[0].result.total,100);
});
