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
 assert.equal(changeRoulette(wheel,start,host,players,[],1100),wheel);
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
 assert.equal(changeRoulette(wheel,start,host,players,[],100),wheel);
 assert.deepEqual(rouletteView(wheel,100).result,choices[0]);
 assert.equal(changeRoulette(wheel,{type:'roulette-dismiss',id:wheel.id},{role:'tv'},players,[],100),wheel);
 assert.equal(changeRoulette(wheel,{type:'roulette-dismiss',id:wheel.id},host,players,[],100),null);
 for(let roll=0;roll<100;roll++)assert.ok(rouletteIndex(7)<7);
});

test('Une roulette réservée à l’animateur ne désigne aucun joueur',()=>{
 const wheel=changeRoulette(null,{...start,hostOnly:true},host,players,[],100);
 assert.equal(wheel.player,null);
 const stop={type:'roulette-stop',id:wheel.id};
 assert.equal(changeRoulette(wheel,stop,{role:'player',team:'a'},players,[],150),wheel);
 assert.equal(changeRoulette(wheel,stop,host,players,[],200).stopAt,200);
});

test('Le vote compte une voix par joueur et départage uniquement les premiers',()=>{
 const options=[...choices,{id:'third',name:'Troisième choix'}];
 const vote=changeRoulette(null,{...start,mode:'vote',options},host,players,[],1000);
 const cast=(state,team,choice,now)=>changeRoulette(state,{type:'roulette-vote',id:state.id,choice},{role:'player',team},players,[],now);
 assert.equal(rouletteView(vote,1001,'a').canVote,true);
 assert.equal(cast(vote,'absent',choices[0].id,1100),vote);
 assert.equal(cast(vote,'a','invalid',1100),vote);
 const first=cast(vote,'a',choices[0].id,1100);
 assert.equal(cast(first,'a',choices[1].id,1200),first);
 assert.equal(rouletteView(first,1200,'a').hasVoted,true);
 assert.equal(rouletteView(first,1200,'b').hasVoted,false);
 assert.equal(rouletteView(first,1200,'b').voted,undefined);
 const tie=cast(first,'b',choices[1].id,1300);
 assert.equal(tie.tiebreak,true);
 assert.equal(rouletteView(tie,3699).result,null);
 assert.ok(choices.some(choice=>choice.id===rouletteView(tie,3700).result.id));
});

test('Sans vote, le délai déclenche un tirage et une déconnexion ajuste le quorum',()=>{
 const vote=changeRoulette(null,{...start,mode:'vote',seconds:5},host,players,[],100);
 assert.equal(vote.deadline,5100);
 const close={type:'roulette-stop',id:vote.id};
 assert.equal(changeRoulette(vote,close,{role:'player',team:'a'},players,[],200),vote);
 const absent=changeRoulette(vote,close,{role:'server'},players,[],5100);
 assert.equal(absent.tiebreak,true);
 assert.ok(rouletteView(absent,7500).result);
 const first=changeRoulette(vote,{type:'roulette-vote',id:vote.id,choice:choices[0].id},{role:'player',team:'a'},players,[],600);
 const disconnected=changeRoulette(first,{type:'vote-presence',id:vote.id},{role:'server'},[players[0]],[],700);
 assert.equal(rouletteView(disconnected,700).result.id,choices[0].id);
});

test('La roulette automatique ne désigne personne et utilise son propre délai',()=>{
 const wheel=changeRoulette(null,{...start,mode:'automatic',player:'a'},host,players,[],100);
 assert.equal(wheel.player,null);
 assert.equal(wheel.deadline,3500);
});

test('Un vote conserve tous les candidats et résout directement un candidat unique',()=>{
 const options=Array.from({length:221},(_,index)=>({id:'list-'+index,name:'Playlist '+index}));
 const vote=changeRoulette(null,{...start,mode:'vote',options},host,players,[],1000);
 assert.equal(rouletteView(vote,1000,'a').choices.length,221);
 const choice=options.at(-1).id;
 const first=changeRoulette(vote,{type:'roulette-vote',id:vote.id,choice},{role:'player',team:'a'},players,[],1100);
 const last=changeRoulette(first,{type:'roulette-vote',id:vote.id,choice},{role:'player',team:'b'},players,[],1200);
 assert.equal(rouletteView(last,1200).result.id,choice);
 assert.equal(last.stopAt,1200);
 const single=changeRoulette(null,{...start,mode:'vote',options:[options[0]]},host,players,[],1400);
 assert.equal(rouletteView(single,1400).result.id,options[0].id);
 assert.equal(single.player,undefined);
});

test('Le choix musical enchaîne les catégories et les playlists et donne le second STOP à un autre joueur',()=>{
 const options=[{id:'genres',name:'Genres'},{id:'artists',name:'Artistes'}];
 const playlists=Array.from({length:221},(_,index)=>({id:'list-'+index,name:'Playlist '+index}));
 const categories=options.map(group=>({...group,playlists}));
 const first=changeRoulette(null,{...start,kind:'playlist',options,categories},host,players,['a','a','b'],1000);
 assert.equal(first.player.id,'b');
 assert.equal(rouletteView(first,1000).categories,undefined);
 const stopped=changeRoulette(first,{type:'roulette-stop',id:first.id},{role:'player',team:'b'},players,[],1100);
 const advance={type:'roulette-advance',id:first.id};
 assert.equal(changeRoulette(stopped,advance,{role:'server'},players,[],5099),stopped);
 const second=changeRoulette(stopped,advance,{role:'server'},players,['a','a','b','b'],5100);
 assert.equal(second.player.id,'a');
 assert.equal(second.optionsCount,221);
 assert.equal(second.category.id,stopped.selected.id);
 assert.equal(second.deadline,20100);
 const expired=changeRoulette(second,{type:'roulette-stop',id:second.id},{role:'server'},players,[],20100);
 assert.ok(playlists.some(item=>item.id===rouletteView(expired,22500).result.id));
});

test('Le vote musical sans voix tire une catégorie puis enchaîne automatiquement',()=>{
 const options=[{id:'decades',name:'Décennies'},{id:'genres',name:'Genres'}];
 const categories=options.map(group=>({...group,playlists:choices}));
 const vote=changeRoulette(null,{...start,kind:'playlist',mode:'vote',options,categories},host,players,[],1000);
 const stopped=changeRoulette(vote,{type:'roulette-stop',id:vote.id},{role:'server'},players,[],16000);
 const stage=changeRoulette(stopped,{type:'roulette-advance',id:vote.id},{role:'server'},players,[],20000);
 assert.equal(stage.mode,'automatic');
 assert.equal(stage.originMode,'vote');
 assert.equal(stage.category.id,stopped.selected.id);
 assert.equal(stage.deadline,23400);
});
