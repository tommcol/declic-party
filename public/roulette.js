export function rouletteIndex(length) {
 const limit=2**32-(2**32%length);
 const word=new Uint32Array(1);
 do crypto.getRandomValues(word); while(word[0]>=limit);
 return word[0]%length;
}

function finishVote(state,now){
 const highest=Math.max(0,...Object.values(state.tally));
 const leaders=state.choices.filter(option=>(state.tally[option.id]||0)===highest);
 const tiebreak=highest===0||leaders.length>1;
 return {...state,stopAt:now,revealAt:now+(tiebreak&&state.animation?2400:0),
  selected:leaders[rouletteIndex(leaders.length)],tiebreak,optionsCount:leaders.length};
}

function updateVote(state,action,identity,participants,now){
 const host=identity.role==='host', server=identity.role==='server';
 if(action.type==='roulette-stop'&&(host||server))return finishVote(state,now);
 if(action.type==='vote-presence'&&server){
  const connected=new Set(participants.map(person=>person.id));
  const eligible=state.eligible.filter(id=>connected.has(id)||state.voted.includes(id));
  if(eligible.length===state.eligible.length)return state;
  const next={...state,eligible};
  return eligible.length===state.voted.length?finishVote(next,now):next;
 }
 if(action.type!=='roulette-vote'||identity.role!=='player'||now>=state.deadline||
  !state.eligible.includes(identity.team)||state.voted.includes(identity.team)||
  !state.choices.some(option=>option.id===action.choice))return state;
 const next={...state,voted:[...state.voted,identity.team],
  tally:{...state.tally,[action.choice]:(state.tally[action.choice]||0)+1}};
 return next.voted.length===next.eligible.length?finishVote(next,now):next;
}

function cleanOptions(options){
 return [...new Map((Array.isArray(options)?options:[])
  .filter(option=>typeof option?.id==='string'&&option.id.length<=120&&typeof option?.name==='string'&&option.name.length<=100)
  .map(({id,name})=>[id,{id,name}])).values()];
}

function choosePlayer(participants,history,settings,previousPlayer){
 if(settings.hostOnly||!participants.length)return null;
 if(settings.player&&!previousPlayer){
  const assigned=participants.find(person=>person.id===settings.player);
  if(assigned)return assigned;
 }
 const others=participants.filter(person=>person.id!==previousPlayer);
 const eligible=others.length?others:participants;
 const count=id=>history.filter(previous=>previous===id).length;
 const minimum=Math.min(...eligible.map(person=>count(person.id)));
 const pool=eligible.filter(person=>count(person.id)===minimum);
 return pool[rouletteIndex(pool.length)];
}

export function rouletteAdvanceAt(state){
 return state?.categories&&state.revealAt!==null?state.revealAt+(state.animation?1600:0):null;
}

export function changeRoulette(current, action, identity, participants, history, now) {
 const host=identity.role==='host';
 if(action.type==='roulette-start'&&host&&!current){
  const options=cleanOptions(action.options);
  if(!options.length||!['game','playlist'].includes(action.kind))throw Error('Aucun choix compatible.');
  const categories=action.kind==='playlist'&&Array.isArray(action.categories)?Object.fromEntries(options.map(({id})=>{
   return [id,cleanOptions(action.categories.find(group=>group?.id===id)?.playlists)];
  }).filter(([,playlists])=>playlists.length)):null;
  if(categories&&options.some(({id})=>!Object.hasOwn(categories,id)))throw Error('Catégorie musicale vide.');
  return beginWheel(options,action.kind,action.mode||'participatory',participants,history,now,{
   player:action.player,hostOnly:action.hostOnly,animation:action.animation!==false,seconds:action.seconds
  },categories);
 }
 if(action.type==='roulette-advance'&&identity.role==='server'&&current?.id===action.id){
  const advanceAt=rouletteAdvanceAt(current);
  if(advanceAt===null||now<advanceAt)return current;
  return beginWheel(current.categories[current.selected.id],'playlist',current.mode==='participatory'?'participatory':'automatic',
   participants,history,now,current.settings,null,current.selected,current.player?.id,current.originMode);
 }
 if(!current||action.id!==current.id)return current;
 if(action.type==='roulette-dismiss'&&host)return null;
 if(current.stopAt!==null)return current;
 if(current.mode==='vote')return updateVote(current,action,identity,participants,now);
 const automatic=identity.role==='server';
 if(action.type==='roulette-stop'&&(host||automatic||identity.role==='player'&&current.player?.id===identity.team)){
  return {...current,stopAt:now,revealAt:now+(current.animation?2400:0)};
 }
 return current;
}

function beginWheel(options,kind,mode,participants,history,now,settings,categories=null,category=null,previousPlayer=null,originMode=mode){
 const animation=settings.animation;
 const state={id:crypto.randomUUID(),kind,mode,originMode,category,categories,settings,animation,
  stage:categories?'category':'choice',optionsCount:options.length,startAt:now};
 if(options.length===1)return {...state,mode:'automatic',animation:animation&&Boolean(category),choices:options,
  selected:options[0],deadline:now,stopAt:now,revealAt:now};
 if(mode==='vote'){
  const vote={...state,choices:options,tally:{},eligible:participants.map(person=>person.id),voted:[],
   deadline:now+1000*Math.max(5,Math.min(60,Math.trunc(Number(settings.seconds)||15))),stopAt:null,revealAt:null};
  return participants.length?vote:finishVote(vote,now);
 }
 const player=mode==='participatory'?choosePlayer(participants,history,settings,previousPlayer):null;
 const shouldWait=animation||mode==='participatory';
 return {...state,player,choices:options,selected:options[rouletteIndex(options.length)],
  deadline:now+(shouldWait?(mode==='automatic'?3400:15000):0),stopAt:shouldWait?null:now,revealAt:shouldWait?null:now};
}

export function rouletteView(state, now=Date.now(), playerId) {
 if(!state)return null;
 const {selected,eligible,voted,categories,settings,...publicState}=state;
 const vote=eligible?{eligibleCount:eligible.length,voteCount:voted.length,
  canVote:eligible.includes(playerId)&&!voted.includes(playerId),hasVoted:voted.includes(playerId)}:{};
 return {...publicState,...vote,result:state.revealAt!==null&&state.revealAt<=now?selected:null};
}
