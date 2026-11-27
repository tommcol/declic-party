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

export function changeRoulette(current, action, identity, participants, history, now) {
 const host=identity.role==='host';
 if(action.type==='roulette-start'&&host&&!current){
  const options=[...new Map((Array.isArray(action.options)?action.options:[])
   .filter(option=>typeof option?.id==='string'&&option.id.length<=120&&typeof option?.name==='string'&&option.name.length<=100)
   .map(option=>[option.id,{id:option.id,name:option.name}])).values()];
  if(!options.length||!['game','playlist'].includes(action.kind))throw Error('Aucun choix compatible.');
  const unused=participants.filter(person=>!history.includes(person.id));
  const pool=unused.length?unused:participants;
  const player=action.mode==='vote'||action.mode==='automatic'||action.hostOnly?null:action.player?participants.find(person=>person.id===action.player):pool.length?pool[rouletteIndex(pool.length)]:null;
  if(action.mode!=='automatic'&&action.mode!=='vote'&&action.player&&!player)throw Error('Ce participant est déconnecté.');
  const animation=action.animation!==false;
  if(action.mode==='vote'){
   if(options.length>4)throw Error('Choisissez quatre options au maximum pour le vote.');
   const state={id:crypto.randomUUID(),kind:action.kind,mode:'vote',choices:options,
    optionsCount:options.length,tally:{},eligible:participants.map(person=>person.id),voted:[],animation,
    startAt:now,deadline:now+1000*Math.max(5,Math.min(60,Math.trunc(Number(action.seconds)||15))),
    stopAt:null,revealAt:null};
   return participants.length?state:finishVote(state,now);
  }
  const shouldWait=animation||action.mode==='participatory';
 return {id:crypto.randomUUID(),kind:action.kind,mode:action.mode||'participatory',player:player||null,animation,
   optionsCount:options.length,selected:options[rouletteIndex(options.length)],
   deadline:now+(shouldWait?(action.mode==='automatic'?3400:15000):0),startAt:now,stopAt:shouldWait?null:now,revealAt:shouldWait?null:now};
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

export function rouletteView(state, now=Date.now(), playerId) {
 if(!state)return null;
 const {selected,eligible,voted,...publicState}=state;
 const vote=eligible?{eligibleCount:eligible.length,voteCount:voted.length,
  canVote:eligible.includes(playerId)&&!voted.includes(playerId),hasVoted:voted.includes(playerId)}:{};
 return {...publicState,...vote,result:state.revealAt!==null&&state.revealAt<=now?selected:null};
}
