// randomUUID is unavailable on plain HTTP LAN origins, but getRandomValues is available.
export function randomUUID(){
 if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
 const bytes=crypto.getRandomValues(new Uint8Array(16));
 bytes[6]=(bytes[6]&0x0f)|0x40;
 bytes[8]=(bytes[8]&0x3f)|0x80;
 const hex=Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
 return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
export const normalize = v => String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function matches(value, expected, aliases=[]){const a=normalize(value);if(!a)return false;return [expected,...aliases].filter(Boolean).some(v=>{const b=normalize(v);if(a===b)return true;if(Math.min(a.length,b.length)<5)return false;const max=Math.min(a.length,b.length)>=9?2:1;if(Math.abs(a.length-b.length)>max)return false;let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){const next=[i+1];for(let j=0;j<b.length;j++)next.push(Math.min(next[j]+1,row[j+1]+1,row[j]+(a[i]===b[j]?0:1)));row=next;}return row[b.length]<=max;});}
// Only known dataset origins may be displayed as source links in rooms.
export function normalizeQuizCredit(credit){
 if(!credit||typeof credit.author!=='string'||typeof credit.source!=='string')return undefined;
 const source=credit.source;let publisher,license,licenseUrl;
 if(/^https:\/\/github\.com\/Zeuh\/OpenQuizzDB\/blob\/[a-f0-9]{40}\/data\/openquizzdb_\d+\.json$/.test(source)){publisher='OpenQuizzDB';license='CC BY-SA 4.0';licenseUrl='https://creativecommons.org/licenses/by-sa/4.0/';}
 else if(source==='https://www.qulture-app.com/open-data/qulture-reviewed-questions.json'){publisher='Qulture';license='CC BY 4.0';licenseUrl='https://creativecommons.org/licenses/by/4.0/';}
 else if(/^https:\/\/github\.com\/Pluxia-GmbH\/learnclash-open-trivia\/blob\/[a-f0-9]{40}\/fr\/index\.html$/.test(source)){publisher='LearnClash';license='CC BY 4.0';licenseUrl='https://creativecommons.org/licenses/by/4.0/';}
 else return undefined;
 return {publisher,author:credit.author.slice(0,100),source,license,licenseUrl};
}
export const LISTEN_STEPS=[1,2,5,10];
export const isBuzzer=s=>s.mode==='usb'||s.input==='buzzer';
export const isProgressive=(s,q=s.question||s.questions?.[s.index])=>s.settings?.listening==='progressive'&&q?.kind==='audio';
export const listeningLimit=(s,q=s.question||s.questions?.[s.index])=>q?.kind==='lyrics'?Number(q.cutAt)||5:isProgressive(s,q)?LISTEN_STEPS[s.listenStep||0]:Infinity;
export function audioRemaining(s,now=Date.now()){if(s.phase!=='playing'||now<s.startAt)return 0;return Math.max(0,listeningLimit(s)-((s.audioElapsed||0)+now-s.startAt)/1000);}
export function targets(q){if(q.kind==='lyrics'||['coverChoice','timeline','coversQuiz','soundtrack'].includes(q.target))return ['answer'];return (q.title&&q.artist)||q.musical?(q.target==='both'?['title','artist']:[q.target==='artist'||q.target==='cover'?'artist':'title']):['answer'];}
export const BINGO_CARD_SIZE=16;
export function bingoProgress({card, marked}) {
 const size=Math.sqrt(card.length);
 const indices=Array.from({length:size},(_,index)=>index);
 const marks=new Set(marked);
 const rows=indices.map(row=>indices.map(col=>card[row*size+col].id));
 const columns=indices.map(col=>indices.map(row=>card[row*size+col].id));
 const complete=lines=>lines.filter(line=>line.every(id=>marks.has(id)));
 const fullRows=complete(rows),fullColumns=complete(columns);
 return {
  rows:fullRows.length,columns:fullColumns.length,
  total:fullRows.length+fullColumns.length,
  cells:[...new Set([...fullRows,...fullColumns].flat())],
  remaining:Math.min(...[...rows,...columns].map(line=>line.filter(id=>!marks.has(id)).length).filter(Boolean),size)
 };
}
export function bingoGrandWinners(teams,milestones=[]){
 const triple=[...milestones].sort((a,b)=>b.rows-a.rows)[0];
 if(!triple)return [];
 const contenders=teams.filter(team=>triple.winners.includes(team.id));
 const best=Math.max(...contenders.map(team=>team.score));
 return contenders.filter(team=>team.score===best);
}
export function roundStatistics(history,teams,previous) {
 const rows=new Map(teams.map(({id,name})=>[id,{id,name,correct:0,wrong:0,absent:0,
  timed:0,elapsed:0,best:null,last:null,fastest:0,streak:0,bestStreak:0,...previous?.[id]}]));
 for(const round of history||[]){
  let fastest=Infinity;
  const timed=[];
  for(const {id,result} of round.results){
   const row=rows.get(id);
   if(!row)continue;
   row.last=result.elapsed??null;
   if(result.correct||result.parts?.length){
    row.correct++;
    row.bestStreak=Math.max(row.bestStreak,++row.streak);
    if(Number.isFinite(result.elapsed)){
     row.elapsed+=result.elapsed;
     row.timed++;
     row.best=Math.min(row.best??Infinity,result.elapsed);
     fastest=Math.min(fastest,result.elapsed);
     timed.push([row,result.elapsed]);
    }
   }else{
    row.streak=0;
    if(result.attempts)row.wrong++;
    else row.absent++;
   }
  }
  for(const [row,elapsed] of timed)if(elapsed===fastest)row.fastest++;
 }
 return [...rows.values()].map(row=>({...row,average:row.timed?row.elapsed/row.timed:null}));
}
function dealBingoCard(catalog) {
 const songs=[...catalog];
 for(let i=songs.length-1;i>0;i--){
  const j=Math.floor(Math.random()*(i+1));
  [songs[i],songs[j]]=[songs[j],songs[i]];
 }
 return songs;
}
function timelineMode(input){
 return ['collective','individual'].includes(input)?input:undefined;
}
function timelineSong(question){
 return {id:question.id,title:question.title,artist:question.artist,year:question.year};
}
function timelineInsert(cards,question){
 cards.push(timelineSong(question));
 cards.sort((left,right)=>left.year-right.year);
}
function timelineCards(state,team){
 return state.settings.timelineMode==='individual'?team?.timelineCards||[]:state.timelineCards||[];
}
function inChronologicalOrder(cards,slot,year){
 return (cards[slot-1]?.year??-Infinity)<=year&&year<=(cards[slot]?.year??Infinity);
}
function timelineSlots(cards,question){
 const total=cards.length+1;
 if(total<=5)return Array.from({length:total},(_,slot)=>slot);
 const valid=cards.findIndex(card=>card.year>=question.year);
 const firstValid=valid===-1?cards.length:valid;
 const earliest=Math.max(0,firstValid-4), latest=Math.min(firstValid,total-5);
 const offset=[...question.id].reduce((value,char)=>(value*31+char.charCodeAt(0))>>>0,0);
 const start=earliest+offset%(latest-earliest+1);
 return Array.from({length:5},(_,index)=>start+index);
}
function compatibleJokers(state,question){
 if(!state.settings.jokers||state.mode!=='phone'||state.input==='buzzer'||state.settings.bingo||state.settings.chain)return [];
 if(state.settings.timelineMode)return ['decade','double'];
 if(state.settings.survival)return ['life','shield','half'];
 if(question.target==='coverChoice')return ['half','retry'];
 if(question.target==='coversQuiz')return ['half','retry','double'];
 if(question.target==='soundtrack')return ['half','double'];
 return state.input==='qcm'?['double','retry']:['double'];
}
function jokerProgress(state,question){
 const available=compatibleJokers(state,question);
 if(!available.length)return;
 const fastest=state.teams.filter(team=>state.answers[team.id]?.correct&&Number.isFinite(state.answers[team.id].elapsed))
  .sort((left,right)=>state.answers[left.id].elapsed-state.answers[right.id].elapsed)[0]?.id;
 state.jokerAwards=0;
 for(const team of state.teams){
  const joker=team.joker??={correct:0,fastest:0,earned:[],used:[]};
  if(joker.held||joker.armed)continue;
  joker.correct=state.answers[team.id]?.correct?joker.correct+1:0;
  joker.fastest=fastest===team.id?joker.fastest+1:0;
  if(joker.correct<4&&joker.fastest<2)continue;
  const compatible=available.filter(kind=>kind!=='life'&&kind!=='shield'||!team.eliminated);
  if(!compatible.length)continue;
  joker.held=compatible[Math.floor(Math.random()*compatible.length)];
  joker.earned.push(joker.held);
  state.jokerAwards++;
 }
}
function applyJoker(state,question,team){
 const joker=team?.joker,kind=joker?.held;
 if(!kind||!compatibleJokers(state,question).includes(kind))return false;
 const prior=state.answers[team.id];
 if(kind==='retry'&&(!prior?.attempts||prior.correct))return false;
 if(kind==='half'&&(prior?.attempts||question.options.length<3))return false;
 if(kind==='life'&&(team.eliminated||team.lives>=state.settings.survivalLives))return false;
 if(kind==='shield'&&team.eliminated)return false;
 if((kind==='double'||kind==='shield')&&(prior?.attempts||joker.armed))return false;
 switch(kind){
  case 'life': team.lives++;break;
  case 'retry': joker.extraAttempt=true;break;
  case 'double':
  case 'shield': joker.armed=kind;break;
  case 'half': joker.hidden=question.options.filter(option=>option!==question.answer).slice(0,Math.floor((question.options.length-1)/2));break;
  case 'decade': joker.decade=Math.floor(question.year/10)*10;break;
 }
 joker.used.push(kind);
 joker.held=undefined;
 joker.correct=0;
 joker.fastest=0;
 return true;
}

export function gameSettings(input={}){return {chain:input.chain===true,jokers:input.jokers===true,bingo:input.bingo===true,survival:input.survival===true,timelineMode:timelineMode(input.timelineMode),timelineAnchor:timelineMode(input.timelineMode)?input.timelineAnchor:undefined,survivalLives:Math.max(1,Math.min(5,Math.trunc(Number(input.survivalLives)||3))),listening:input.listening==='progressive'?'progressive':'continuous',duration:Math.max(5,Math.min(90,Number(input.duration)||30)),titlePoints:Math.max(1,Math.min(1000,Number(input.titlePoints)||50)),artistPoints:Math.max(1,Math.min(1000,Number(input.artistPoints)||50)),speed:input.speed!==false,streak:input.streak!==false,rebuzz:['round','none','3','5','10'].includes(String(input.rebuzz))?String(input.rebuzz):'round',resume:input.resume==='manual'?'manual':'auto',autoHost:input.autoHost===true,autoNext:input.autoNext===true,autoNextSeconds:Math.max(3,Math.min(60,Math.trunc(Number(input.autoNextSeconds)||8)))};}
export function createGame(questions, teams=[], mode='usb', input='qcm', settings={}) {
 return {version:2,questions:structuredClone(questions),teams:teams.map((t,i)=>({id:t.id||String(i),name:t.name||t,score:0,key:t.key||String(i+1),streak:0})),mode,input,settings:gameSettings(settings),index:0,phase:'lobby',buzz:null,blocked:[],cooldowns:{},claimed:{},answers:{},pending:{},startAt:0,endAt:0,remaining:0,event:null,revision:0,history:[],listenStep:0,audioElapsed:0};
}
export function returnToLobby(game, eveningTotals, teamResults=game.teamResults) {
 const next=createGame([],game.teams,game.mode,game.input);
 next.teams=next.teams.map((team,index)=>({
  ...team,token:game.teams[index].token,avatar:game.teams[index].avatar
 }));
 return {...next,code:game.code,hostHash:game.hostHash,expires:game.expires,
  teamPlan:game.teamPlan?{...game.teamPlan,gather:false,open:false}:undefined,
  teamResults,eveningTotals,showAnimations:game.showAnimations,
  revision:(game.revision||0)+1,event:{type:'salon',id:randomUUID()}};
}
export function applyAction(game, action, now=Date.now()) {
 // Une réponse Bingo ne modifie ni les cartons ni l'historique.
 const bingoMark=action.type==='bingo-mark'&&game.settings?.bingo&&game.mode==='phone'&&game.input==='qcm';
 const s=bingoMark?{...game,answers:{...game.answers},pending:{...game.pending}}:structuredClone(game);
 const q=s.questions[s.index];s.settings=gameSettings(s.settings);s.history??=[];s.cooldowns??={};s.claimed??={};
 if(action.questionId&&action.questionId!==q?.id)return game;
 const emit=(type,extra={})=>{s.event={type,id:randomUUID(),...extra};};
 const roundResult=id=>s.answers[id]??={parts:[],breakdown:{title:0,artist:0,answer:0,speed:0,streak:0},total:0,attempts:0};
 const award=(id,part)=>{const r=roundResult(id);if(r.parts.includes(part))return;r.parts.push(part);const factor=isProgressive(s,q)?[1,.8,.6,.4][s.listenStep||0]:1;const points=Math.round(factor*(part==='title'?s.settings.titlePoints:part==='artist'?s.settings.artistPoints:(q.points||100)));r.breakdown[part]=points;r.total+=points;if(r.parts.length===1){const speed=s.settings.speed&&!isProgressive(s,q)?Math.round(50*Math.max(0,Math.min(1,(s.phase==='buzzed'?s.remaining:s.endAt-now)/((q.duration||s.settings.duration)*1000)))):0;const streak=s.settings.streak?Math.min(5,s.teams.find(t=>t.id===id)?.streak||0)*10:0;r.breakdown.speed=speed;r.breakdown.streak=streak;r.total+=speed+streak;}s.pending[id]=r.total;};
 const bingo=s.settings.bingo&&s.mode==='phone'&&s.input==='qcm';
 const chain=s.settings.chain&&s.mode==='phone'&&s.input==='qcm';
 const timeline=s.settings.timelineMode;
 const survival=s.settings.survival&&s.mode==='phone'&&s.input==='qcm';
 const reveal=()=>{
  if(timeline){
   if(timeline==='collective')timelineInsert(s.timelineCards,q);
   for(const team of s.teams){
    const result=s.answers[team.id];
    if(result?.correct){
     team.timelineElapsed=(team.timelineElapsed||0)+result.elapsed;
     if(timeline==='individual')timelineInsert(team.timelineCards,q);
    }
   }
  }
  if(bingo){
   const correct=Object.entries(s.answers).filter(([,answer])=>answer.correct);
   const best=Math.min(...correct.map(([,answer])=>answer.elapsed));
   s.bingoFastest=correct.filter(([,answer])=>answer.elapsed===best).map(([id])=>id);
   s.bingoProgressions=[];
   for(const team of s.teams){
    const previous=bingoProgress(team.bingo).total;
    team.bingo.marked.push(q.id);
    const count=bingoProgress(team.bingo).total;
    if(count>previous)s.bingoProgressions.push({id:team.id,previous,count});
   }
   s.bingoMilestones??=[];
   for(let goal=s.bingoMilestones.length+1;goal<=3;goal++){
    const winners=s.bingoProgressions.filter(({count})=>count>=goal).map(({id})=>id);
    if(!winners.length)break;
    s.bingoMilestones.push({rows:goal,winners,index:s.index});
   }
  }
  if(survival){
   const active=s.teams.filter(t=>!t.eliminated);
   const outcomes=[];
   for(const team of active){
    const lives=team.lives??s.settings.survivalLives;
    const correct=s.answers[team.id]?.correct===true;
    const protectedLife=!correct&&team.joker?.armed==='shield';
    team.lives=Math.max(0,lives-(correct||protectedLife?0:1));
    team.eliminated=team.lives===0;
    const status=team.eliminated?'eliminated':correct?'safe':protectedLife?'shield':'lost';
    outcomes.push({id:team.id,status,answered:!!s.answers[team.id]?.attempts});
   }
   const survivors=active.filter(t=>!t.eliminated);
   if(survivors.length===1)s.survivalWinner=survivors[0].id;
   const replay=survivors.length===0&&active.length>0;
   if(replay){
    for(const team of active){team.lives=1;team.eliminated=false;}
   }
   s.survivalRound={replay,outcomes};
  }
  if(chain){
   const active=s.teams.filter(t=>!t.eliminated);
   const lastRound=s.index===s.questions.length-1;
   for(const team of active){
    team.unbanked=s.answers[team.id]?.correct?(team.unbanked||0)+(s.pending[team.id]||0):0;
    if(lastRound){
     if(team.unbanked){s.chainFinalBank??={};s.chainFinalBank[team.id]=team.unbanked;}
     team.score+=team.unbanked;team.unbanked=0;
    }
   }
   s.chainVote=!lastRound&&(s.index+1)%3===0&&active.length>2?{}:null;
  }
  for(const t of s.teams){
   const points=s.pending[t.id]||0;
   if(!chain)t.score+=points;
   if(t.joker?.armed==='double'){
    if(timeline)t.timelineBonus=(t.timelineBonus||0)+points;
    else t.score+=points;
   }
   if(t.joker){
    if(t.joker.armed==='double'&&points>0||t.joker.armed==='shield'&&!s.answers[t.id]?.correct)t.joker.armed=undefined;
    t.joker.extraAttempt=false;
    t.joker.hidden=undefined;
    t.joker.decade=undefined;
   }
   t.streak=s.answers[t.id]?.parts?.length?(t.streak||0)+1:0;
  }
  jokerProgress(s,q);
  const eligible=survival?new Set(s.survivalRound.outcomes.map(row=>row.id)):null;
  s.pending={};s.phase='reveal';s.buzz=null;s.history.push({index:s.index,bingoProgressions:bingo?s.bingoProgressions:undefined,survivalRound:survival?s.survivalRound:undefined,question:{id:q.id,prompt:q.prompt,title:q.title,artist:q.artist,answer:q.answer,provider:q.provider,link:q.link,explanation:q.explanation,credit:q.credit,theme:q.theme},results:s.teams.filter(t=>!eligible||eligible.has(t.id)).map(t=>({id:t.id,name:t.name,score:t.score,result:s.answers[t.id]||{parts:[],total:0,breakdown:{}}}))});emit('reveal');s.nextAt=(s.settings.autoHost||s.settings.autoNext)&&!s.chainVote?now+1000*(s.settings.autoNextSeconds||8):0;};
 const continueRound=()=>{s.buzz=null;if(s.settings.resume==='manual'){s.phase='paused';}else{s.phase='playing';s.startAt=now;s.endAt=now+s.remaining;}};
 if(action.type==='play'&&['lobby','ready'].includes(s.phase)&&q&&(!(survival||chain)||s.teams.length>=(chain?3:2))){
  if(timeline&&s.phase==='lobby'){
   const first=s.settings.timelineAnchor;
   if(!first||!Number.isInteger(first.year))return game;
   if(timeline==='collective')s.timelineCards=[first];
   else for(const team of s.teams)team.timelineCards=[{...first}];
  }
  if(survival&&s.phase==='lobby'){
   for(const team of s.teams)team.lives=s.settings.survivalLives;
  }
  if(bingo&&s.phase==='lobby'){
   if(s.questions.length!==BINGO_CARD_SIZE)return game;
   const permutations=new Set();
   const catalog=s.questions.map(({id,title,artist})=>({id,title,artist}));
   for(const team of s.teams){
    let card,key;
    do{
     card=dealBingoCard(catalog);
     key=JSON.stringify(card.map(song=>song.id));
    }while(permutations.has(key));
    permutations.add(key);
    team.bingo={card,marked:[]};
   }
  }
  if(bingo&&Number.isFinite(action.sourceDuration)){
   q.duration=Math.min(30,Math.max(.25,action.sourceDuration));
  }
  if(chain){s.chainResult=null;s.chainBanked={};}
  s.phase='playing';s.listenStep=0;s.audioElapsed=0;s.startAt=now+3000;s.endAt=s.startAt+(q.duration||s.settings.duration)*1000;s.buzz=null;s.blocked=[];s.cooldowns={};s.claimed={};s.answers={};s.pending={};emit('start');}
 else if(action.type==='pause'&&s.phase==='playing'&&now>=s.startAt){s.remaining=Math.max(0,s.endAt-now);s.audioElapsed=(s.audioElapsed||0)+Math.max(0,now-s.startAt);s.phase='paused';emit('pause');}
 else if(action.type==='resume'&&s.phase==='paused'){s.phase='playing';s.startAt=now;s.endAt=now+s.remaining;emit('resume');}
 else if(action.type==='buzz'&&isBuzzer(s)&&s.phase==='playing'&&now>=s.startAt&&now<s.endAt&&s.teams.some(t=>t.id===action.team)&&!s.blocked.includes(action.team)&&(s.cooldowns[action.team]||0)<=now){s.buzz=action.team;s.remaining=s.endAt-now;s.audioElapsed=(s.audioElapsed||0)+Math.max(0,now-s.startAt);s.phase='buzzed';emit('buzz',{team:action.team});}
 else if(action.type==='listen-more'&&isProgressive(s,q)&&['playing','paused'].includes(s.phase)&&now>=s.startAt&&(s.phase==='paused'||now<s.endAt)&&(s.listenStep||0)<LISTEN_STEPS.length-1){s.listenStep=(s.listenStep||0)+1;s.audioElapsed=0;s.phase='playing';s.startAt=now+1000;s.endAt=s.startAt+(q.duration||s.settings.duration)*1000;s.blocked=[];s.cooldowns={};for(const r of Object.values(s.answers))r.attempts=0;emit('listen');}
 else if(action.type==='judge'&&s.phase==='buzzed'){
  const id=s.buzz;if(action.correct){const wanted=targets(q),requested=action.part&&action.part!=='both'?[action.part]:wanted;const fresh=requested.filter(p=>wanted.includes(p)&&!s.claimed[p]);if(!fresh.length)return game;for(const p of fresh){award(id,p);s.claimed[p]=id;}if(wanted.every(p=>s.claimed[p])){reveal();s.event.type='correct';s.event.team=id;}else{continueRound();emit('partial',{team:id});}}
  else{if(s.settings.rebuzz==='round')s.blocked.push(id);else if(s.settings.rebuzz!=='none')s.cooldowns[id]=now+Number(s.settings.rebuzz)*1000;if(s.blocked.length>=s.teams.length){if(isProgressive(s,q)&&(s.listenStep||0)<LISTEN_STEPS.length-1){s.buzz=null;s.phase='paused';emit('wrong');}else reveal();}else{continueRound();emit('wrong');}}
 }
 else if(bingo&&action.type==='bingo-mark'&&s.phase==='playing'&&now>=s.startAt&&now<s.endAt){
  const card=s.teams.find(t=>t.id===action.team)?.bingo;
  if(!card||s.answers[action.team]||card.marked.includes(action.song)||!card.card.some(song=>song.id===action.song))return game;
  const result=roundResult(action.team);
  result.attempts=1;
  result.elapsed=(s.audioElapsed||0)+now-s.startAt;
  result.selectedSong=action.song;
  result.correct=action.song===q.id;
  if(result.correct)award(action.team,q.target==='artist'?'artist':'title');
 }
 else if(chain&&action.type==='chain-bank'&&s.phase==='playing'&&now>=s.startAt&&now<s.endAt){
  const team=s.teams.find(t=>t.id===action.team&&!t.eliminated);
  if(!team?.unbanked||s.answers[team.id])return game;
  s.chainBanked??={};
  s.chainBanked[team.id]=team.unbanked;
  team.score+=team.unbanked;
  team.unbanked=0;
 }
 else if(chain&&action.type==='chain-vote'&&s.phase==='reveal'&&s.chainVote){
  const active=s.teams.filter(t=>!t.eliminated);
  if(action.team===action.candidate||s.chainVote[action.team]||!active.some(t=>t.id===action.team)||!active.some(t=>t.id===action.candidate))return game;
  s.chainVote[action.team]=action.candidate;
 }
 else if(action.type==='joker'&&s.phase==='playing'&&now>=s.startAt&&now<s.endAt){
  const team=s.teams.find(team=>team.id===action.team);
  if((survival&&team?.eliminated)||!applyJoker(s,q,team))return game;
 }
 else if(timeline&&action.type==='answer'&&s.phase==='playing'&&now>=s.startAt&&now<s.endAt){
  const team=s.teams.find(entry=>entry.id===action.team);
  if(!team||s.answers[team.id]||typeof action.answer!=='string'||!/^\d{1,3}$/.test(action.answer))return game;
  const cards=timelineCards(s,team),slot=Number(action.answer);
  if(!timelineSlots(cards,q).includes(slot))return game;
  const result=roundResult(team.id);
  result.correct=inChronologicalOrder(cards,slot,q.year);
  result.attempts=1;
  result.elapsed=(s.audioElapsed||0)+now-s.startAt;
  if(result.correct){
   result.parts.push('answer');
   result.breakdown.answer=result.total=s.pending[team.id]=1;
  }
 }
 else if(!bingo&&action.type==='answer'&&s.mode==='phone'&&['text','qcm'].includes(s.input)&&s.phase==='playing'&&now>=s.startAt&&now<s.endAt&&s.teams.some(t=>t.id===action.team&&(!(chain||survival)||!t.eliminated))){
  const id=action.team,r=roundResult(id),wanted=targets(q);
  const joker=s.teams.find(team=>team.id===id)?.joker;
  if(r.attempts>=(s.input==='qcm'?(joker?.extraAttempt?2:1):5)||wanted.every(p=>r.parts.includes(p)))return game;
  if(joker?.hidden?.includes(action.answer))return game;
  const values=s.input==='text'&&wanted[0]!=='answer'&&q.title&&q.artist?{title:action.title,artist:action.artist}:{[wanted[0]]:action.answer};
  if(!Object.values(values).some(v=>typeof v==='string'&&v.trim()))return game;if(s.input==='qcm'&&!q.options.includes(action.answer))return game;
  if(q.target==='coverChoice')r.selectedCover=action.answer;
  if(q.target==='coversQuiz')r.selectedArtist=action.answer;
  r.attempts++;r.elapsed??=(s.audioElapsed||0)+now-s.startAt;for(const part of wanted){if(r.parts.includes(part))continue;const text=String(values[part]||'').trim().slice(0,180);if(!text)continue;const expected=part==='title'?q.title:part==='artist'?q.artist:q.answer;const aliases=part==='artist'?(q.artistAliases||[]):part==='title'?(q.titleAliases||[]):(q.aliases||[]);if(s.input==='qcm'?normalize(text)===normalize(expected):matches(text,expected,aliases))award(id,part);}
  const wasCorrect=r.correct;
  r.correct=r.parts.length>0;
  if(r.correct&&!wasCorrect)r.elapsed=(s.audioElapsed||0)+now-s.startAt;
  if(wanted.length>1&&wanted.every(part=>r.parts.includes(part)))r.completedElapsed=(s.audioElapsed||0)+now-s.startAt;
  emit('answer');
 }
 else if((action.type==='reveal'||action.type==='timeout')&&['playing','buzzed','paused'].includes(s.phase)){
  if(action.type==='timeout'&&(s.phase!=='playing'||now<s.endAt))return game;
  if((bingo||survival||chain||['coverChoice','coversQuiz'].includes(q?.target))&&now<s.startAt)return game;
  if(timeline&&action.type==='reveal'&&(s.phase!=='playing'||now<s.startAt||
     now<s.endAt&&(!s.teams.length||!s.teams.every(team=>s.answers[team.id]?.attempts))))return game;
  reveal();
 }
 else if(action.type==='stop'&&['ready','playing','buzzed','paused','reveal'].includes(s.phase)){
  if(action.bingoLine){
   if(!bingo||!s.bingoMilestones?.some(goal=>goal.rows===1))return game;
   s.bingoFinishRows=1;
  }
  // Close a started round once, but never invent a draw during a countdown.
  if(['playing','buzzed','paused'].includes(s.phase)&&now>=s.startAt)reveal();
  if(chain)for(const team of s.teams){
   if(team.unbanked){s.chainFinalBank??={};s.chainFinalBank[team.id]=team.unbanked;}
   team.score+=team.unbanked||0;team.unbanked=0;
  }
  s.chainVote=null;s.phase='finished';s.buzz=null;s.blocked=[];s.pending={};s.claimed={};s.cooldowns={};s.nextAt=0;s.endAt=0;s.remaining=0;
  if(timeline)s.teams.sort((left,right)=>right.score-left.score||(left.timelineElapsed||0)-(right.timelineElapsed||0));
  emit('podium');
 }
 else if(action.type==='next'&&s.phase==='reveal'){
  if(chain&&s.chainVote){
   if(action.closeVote!==true)return game;
   const votes=Object.values(s.chainVote);
   const active=s.teams.filter(t=>!t.eliminated);
   const tallies=active.map(t=>({team:t,count:votes.filter(id=>id===t.id).length})).sort((a,b)=>b.count-a.count||a.team.score-b.team.score);
   const [first,second]=tallies;
   const eliminated=first?.count&&(first.count!==second?.count||first.team.score!==second?.team.score)?first.team:null;
   if(eliminated)eliminated.eliminated=true;
   s.chainResult={eliminated:eliminated?.id??null};
   s.chainVote=null;
   emit('chain-result');
   s.revision++;
   return s;
  }
  s.index++;s.phase=s.survivalWinner||s.index>=s.questions.length?'finished':'ready';s.buzz=null;s.blocked=[];s.answers={};s.pending={};s.claimed={};s.cooldowns={};s.nextAt=0;
  if(timeline&&s.phase==='finished')s.teams.sort((left,right)=>right.score-left.score||(left.timelineElapsed||0)-(right.timelineElapsed||0));
  emit(s.phase==='finished'?'podium':'next');}
 else if(action.type==='adjust'&&s.teams.some(t=>t.id===action.team)&&Number.isFinite(action.points)&&Math.abs(action.points)<=1000){s.teams.find(t=>t.id===action.team).score+=Math.round(action.points);emit('adjust');}
 else return game;
 s.revision++;return s;
}
export function publicGame(s,teamId){
 const q=s.questions[s.index],revealed=s.phase==='reveal';
 const timeMode=s.settings?.timelineMode;
 const timelineTeam=teamId?s.teams.find(team=>team.id===teamId):undefined;
 const myJoker=timelineTeam?.joker;
 const cards=timeMode?(s.phase==='lobby'&&s.settings.timelineAnchor?[timelineSong(s.settings.timelineAnchor)]:timelineCards(s,timelineTeam)):undefined;
 const visibleCards=timeMode==='individual'&&teamId&&revealed?cards.filter(card=>card.id!==q.id):cards;
 const timelineResult=timeMode&&s.phase==='finished'&&timelineTeam?{
  rank:s.teams.findIndex(team=>team.id===teamId)+1,
  correct:timelineTeam.score,total:s.history?.length??0
 }:undefined;
 const distribution=timeMode==='individual'&&!teamId&&(revealed||s.phase==='finished')?Object.entries(
  s.teams.reduce((counts,team)=>(counts[team.score]=(counts[team.score]||0)+1,counts),{})
 ).map(([correct,players])=>({correct:Number(correct),players})).reverse():undefined;
 const question=q?{id:s.settings?.bingo&&!revealed?`bingo-round-${s.index}`:q.id,universe:q.universe,kind:q.kind,prompt:timeMode?'Où placer cette chanson sur la frise ?':q.prompt,timeline:timeMode?undefined:q.timeline,options:timeMode?[]:s.input==='qcm'&&!s.settings?.bingo?(q.options||[]).filter(option=>(revealed&&q.target==='coverChoice')||!myJoker?.hidden?.includes(option)):[],optionArtwork:s.input==='qcm'&&q.optionArtwork?q.optionArtwork.filter((_,index)=>(revealed&&q.target==='coverChoice')||!myJoker?.hidden?.includes(q.options[index])):undefined,emoji:q.emoji,duration:q.duration,cutAt:q.kind==='lyrics'?q.cutAt:undefined,points:q.points,target:q.target,musical:targets(q)[0]!=='answer',displayArtist:q.target==='artistTitle'?q.artist:undefined,artwork:q.target==='cover'||q.target!=='coverChoice'&&s.effect==='image'||revealed?q.artwork:undefined,...(revealed?{answer:q.answer,title:q.title,artist:q.artist,provider:q.provider,link:q.link,explanation:q.explanation,credit:q.credit,theme:q.theme,year:q.year}: {})}:null;
 return {joker:teamId&&q&&!(s.settings?.survival&&timelineTeam?.eliminated)&&compatibleJokers(s,q).length&&s.phase!=='finished'?
 {held:myJoker?.held,correct:myJoker?.correct||0,fastest:myJoker?.fastest||0,
  decade:myJoker?.decade,shield:s.settings?.survival&&myJoker?.armed==='shield'||undefined,retry:myJoker?.extraAttempt===true,
  canRetry:myJoker?.held==='retry'&&!!s.answers[teamId]?.attempts&&!s.answers[teamId]?.correct}:undefined,
 jokerAwards:revealed?s.jokerAwards:undefined,timelineMode:timeMode,timelineCards:visibleCards,timelineSlots:q&&cards&&teamId&&!revealed?timelineSlots(cards,q):undefined,timelineResult,distribution,musicGame:s.musicGame,showTheme:s.showTheme,showAnimations:s.showAnimations,version:2,mode:s.mode,input:s.input,index:s.index,total:s.questions.length,phase:s.phase,buzz:s.buzz,blocked:s.blocked,claimed:s.claimed,cooldowns:s.cooldowns,answered:Object.keys(s.answers),remaining:s.remaining,settings:{listening:s.settings?.listening||'continuous',survival:s.settings?.survival===true,survivalLives:s.settings?.survival?s.settings.survivalLives:undefined,bingo:s.settings?.bingo===true,bingoTarget:s.questions[0]?.target,chain:s.settings?.chain===true},chainVoting:!!s.chainVote,chainVoteCount:s.chainVote?Object.keys(s.chainVote).length:undefined,chainResult:revealed?s.chainResult:undefined,chainFinalBank:s.phase==='finished'?s.chainFinalBank:undefined,chainBanked:teamId?s.chainBanked?.[teamId]:undefined,chainMyVote:teamId?s.chainVote?.[teamId]:undefined,chainUnbanked:teamId?s.teams.find(t=>t.id===teamId)?.unbanked:undefined,bingoFinal:s.settings?.bingo&&s.phase==='finished'?roundStatistics(s.history,teamId?s.teams.filter(t=>t.id===teamId):s.teams):undefined,bingoProgressions:revealed?s.bingoProgressions:undefined,bingoFastest:revealed?s.bingoFastest:undefined,bingoMilestones:s.bingoMilestones,bingoFinishRows:s.bingoFinishRows,bingoCard:teamId?s.teams.find(t=>t.id===teamId)?.bingo:undefined,survivalWinner:s.survivalWinner,survivalRound:revealed&&s.settings?.survival?s.survivalRound:undefined,listenStep:s.listenStep||0,audioElapsed:s.audioElapsed||0,teams:s.teams.map(({id,name,avatar,score,key,streak,eliminated,lives})=>({id,name,avatar,score:timeMode&&teamId&&s.phase!=='finished'?undefined:score,key,streak:timeMode&&teamId?undefined:streak,eliminated,lives})),startAt:s.startAt,endAt:s.endAt,nextAt:s.nextAt,event:s.event,revision:s.revision,question,effect:s.effect,history:timeMode&&teamId&&s.phase!=='finished'?[]:s.history,me:teamId?(s.input==='qcm'&&(!revealed||timeMode)&&s.answers[teamId]?{attempts:s.answers[teamId].attempts,...(revealed&&timeMode==='collective'?{correct:s.answers[teamId].correct}:{}),...(s.settings?.bingo?{selectedSong:s.answers[teamId].selectedSong}:{}),...(q?.target==='coverChoice'?{selectedCover:s.answers[teamId].selectedCover}:{}),...(q?.target==='coversQuiz'?{selectedArtist:s.answers[teamId].selectedArtist}:{})}:s.answers[teamId]):undefined};
}
export const DEMO=[
{id:'m1',universe:'music',kind:'audio',prompt:'Quel est le titre de cette mélodie ?',answer:'Frère Jacques',aliases:['frere jacques'],options:['Frère Jacques','Au clair de la lune','Sur le pont d’Avignon','Une souris verte'],notes:[[60,.4],[62,.4],[64,.4],[60,.4],[60,.4],[62,.4],[64,.4],[60,.4],[64,.4],[65,.4],[67,.8],[64,.4],[65,.4],[67,.8]],hint:'Une mélodie qui traverse les générations.',duration:25,points:100},
{id:'m2',universe:'music',kind:'audio',prompt:'Reconnaissez-vous cette œuvre ?',answer:'Ode à la joie',aliases:['hymne a la joie','ode a la joie','beethoven'],options:['La Marche turque','Ode à la joie','Le Lac des cygnes','Les Quatre Saisons'],notes:[[64,.4],[64,.4],[65,.4],[67,.4],[67,.4],[65,.4],[64,.4],[62,.4],[60,.4],[60,.4],[62,.4],[64,.4],[64,.6],[62,.2],[62,.8]],hint:'Un air de Beethoven.',duration:25,points:100},
{id:'m3',universe:'music',kind:'question',prompt:'Quel instrument possède généralement 88 touches ?',answer:'Le piano',aliases:['piano'],options:['L’accordéon','La guitare','Le piano','La batterie'],emoji:'🎹',hint:'Les touches noires et blanches.',duration:20,points:100},
{id:'m4',universe:'music',kind:'audio',prompt:'Retrouvez cette chanson traditionnelle.',answer:'Au clair de la lune',aliases:['au clair de lune'],options:['Alouette','Au clair de la lune','Frère Jacques','À la claire fontaine'],notes:[[60,.4],[60,.4],[60,.4],[62,.4],[64,.8],[62,.8],[60,.4],[64,.4],[62,.4],[62,.4],[60,1]],duration:25,points:100,hint:'Une chanson à fredonner la nuit.'},
{id:'m5',universe:'music',kind:'lyrics',prompt:'Complétez : « Au clair de la lune, mon ami ___ ».',answer:'Pierrot',aliases:[],options:['Pierrot','Jacquot','Charlot','Gaston'],notes:[[60,.4],[60,.4],[60,.4],[62,.4],[64,.8],[62,.8],[60,.4],[64,.4],[62,.4],[62,.4],[60,1]],cutAt:3,duration:30,points:100,hint:'Démonstration instrumentale. Préparez vos extraits chantés dans Mes questions.'},
];
