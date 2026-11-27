export function rouletteIndex(length) {
 const limit=2**32-(2**32%length);
 const word=new Uint32Array(1);
 do crypto.getRandomValues(word); while(word[0]>=limit);
 return word[0]%length;
}

export function changeRoulette(current, action, identity, participants, history, now) {
 const host=identity.role==='host';
 if(action.type==='roulette-start'&&host&&(!current||current.revealAt<=now)){
  const options=[...new Map((Array.isArray(action.options)?action.options:[])
   .filter(option=>typeof option?.id==='string'&&option.id.length<=120&&typeof option?.name==='string'&&option.name.length<=100)
   .map(option=>[option.id,{id:option.id,name:option.name}])).values()];
  if(!options.length||!['game','playlist'].includes(action.kind))throw Error('Aucun choix compatible.');
  const unused=participants.filter(person=>!history.includes(person.id));
  const pool=unused.length?unused:participants;
  const player=action.player?participants.find(person=>person.id===action.player):pool.length?pool[rouletteIndex(pool.length)]:null;
  if(action.player&&!player)throw Error('Ce participant est déconnecté.');
  const animation=action.animation!==false;
  return {id:crypto.randomUUID(),kind:action.kind,player:player||null,animation,
   optionsCount:options.length,selected:options[rouletteIndex(options.length)],
   deadline:now+(animation?15000:0),startAt:now,stopAt:animation?null:now,revealAt:animation?null:now};
 }
 if(!current||action.id!==current.id)return current;
 if(action.type==='roulette-dismiss'&&host)return null;
 if(current.stopAt!==null)return current;
 const automatic=identity.role==='server';
 if(action.type==='roulette-stop'&&(host||automatic||identity.role==='player'&&current.player?.id===identity.team)){
  return {...current,stopAt:now,revealAt:now+2400};
 }
 return current;
}

export function rouletteView(state, now=Date.now()) {
 if(!state)return null;
 const {selected,...publicState}=state;
 return {...publicState,result:state.revealAt!==null&&state.revealAt<=now?selected:null};
}
