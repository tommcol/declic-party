import {rouletteIndex} from './roulette.js';

export const MAX_PARTICIPANTS=300;
export const TYROLIEN_TEAMS=6;

const identities=[
 ['Les Rouges','#c9344d','🔥'],['Les Bleus','#2460b7','🌊'],['Les Verts','#217752','🌿'],
 ['Les Jaunes','#e3af36','☀️'],['Les Violets','#7136a8','🔮'],['Les Oranges','#cf592b','⚡'],
 ['Les Roses','#b63b7c','🌸'],['Les Turquoises','#187e89','💎'],['Les Indigo','#424eb0','🌙'],
 ['Les Cuivres','#925637','🎸']
];

export function teamIdentity(index){
 const [name,color,icon]=identities[index]||[`Équipe ${index+1}`,generatedColor(index),`♫ ${index+1}`];
 return {id:String(index),name,color,icon};
}

function generatedColor(index){
 const hue=index*.61803398875;
 const light=index%2?.42:.54;
 const channel=n=>{
  const k=(n+12*hue)%12;
  const value=light-.56*Math.min(light,1-light)*Math.max(-1,Math.min(k-3,9-k,1));
  return Math.round(value*255).toString(16).padStart(2,'0');
 };
 return '#'+[0,8,4].map(channel).join('');
}

export function teamContrast(color){
 const rgb=color.slice(1).match(/../g).map(hex=>parseInt(hex,16)/255)
  .map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
 return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.179?'#000':'#fff';
}

export function teamCapacity(plan,players){
 const count=plan.groups.length;
 const base=Math.floor(players.length/count);
 let extra=players.length%count;
 const members=plan.groups.map(()=>[]);
 const unassigned=[];
 for(const {id,name} of players){
  const group=plan.assignments[id];
  (group===undefined?unassigned:members[Number(group)]||unassigned).push({id,name});
 }
 // Reserve the larger capacities for teams already using one of the extra places.
 const needsExtra=members.map(list=>list.length>base);
 extra-=needsExtra.filter(Boolean).length;
 const groups=plan.groups.map((group,index)=>{
  const larger=needsExtra[index]||extra>0;
  if(larger&&!needsExtra[index])extra--;
  return {...group,members:members[index],capacity:Math.max(members[index].length,base+Number(larger))};
 });
 return {groups,unassigned,total:players.length,mode:plan.mode,open:plan.open,gather:Boolean(plan.gather)};
}

export function fillTeams(plan,players,reset=false){
 if(reset)plan.assignments={};
 const pending=players.filter(player=>!Object.hasOwn(plan.assignments,player.id));
 for(let index=pending.length-1;index>0;index--){
  const pick=rouletteIndex(index+1);
  [pending[index],pending[pick]]=[pending[pick],pending[index]];
 }
 const {groups}=teamCapacity(plan,players);
 const available=groups.map(group=>group.capacity-group.members.length);
 for(const player of pending){
  const index=available.findIndex(slots=>slots>0);
  if(index>=0){plan.assignments[player.id]=groups[index].id;available[index]--;}
 }
}

export function changeTeamPlan(room,action,identity){
 const host=identity.role==='host';
 const editable=['lobby','finished'].includes(room.phase);
 const current=room.teamPlan;
 if(action.type==='teams-gather'){
  if(!host||!current||(!editable&&room.phase!=='paused'))throw Error('Rassemblement disponible à l’accueil, en pause et après le jeu.');
  if(current.gather===(action.active===true))return false;
  current.gather=action.active===true;
  return true;
 }
 if(!editable)throw Error('Les équipes sont verrouillées pendant le jeu.');
 if(action.type==='teams-config'&&host){
  const count=action.count;
  const limit=(room.tyrolien||room.mountain)&&room.phase==='lobby'?TYROLIEN_TEAMS:MAX_PARTICIPANTS;
  if(!Number.isInteger(count)||count<2||count>limit)throw Error(`Choisissez entre 2 et ${limit} équipes.`);
  if(current&&Object.values(current.assignments).some(id=>Number(id)>=count)){
   throw Error('Déplacez les joueurs des équipes à retirer avant de réduire leur nombre.');
  }
  room.teamPlan={groups:Array.from({length:count},(_,index)=>current?.groups[index]||teamIdentity(index)),
   assignments:current?.assignments||{},mode:current?.mode||'free',open:current?.open||false,gather:current?.gather||false};
  if(current?.mode==='auto'&&current.open)fillTeams(room.teamPlan,room.teams);
  return true;
 }
 if(!current)throw Error('L’animateur prépare les équipes.');
 if(action.type==='teams-open'&&host){
  current.open=action.open===true;
  if(current.open&&current.mode==='auto')fillTeams(current,room.teams);
  return true;
 }
 if(action.type==='teams-mode'&&host&&['free','auto','manual'].includes(action.mode)){
  current.mode=action.mode;
  if(action.mode==='auto')fillTeams(current,room.teams);
  return true;
 }
 if(action.type==='teams-shuffle'&&host){
  fillTeams(current,room.teams,true);
  return true;
 }
 if(action.type==='teams-style'&&host){
  const group=current.groups.find(item=>item.id===action.group);
  if(!group||typeof action.name!=='string'||!action.name.trim()||
   typeof action.color!=='string'||!/^#[0-9a-f]{6}$/i.test(action.color)||
   typeof action.icon!=='string'||!action.icon.trim())throw Error('Identité d’équipe invalide.');
  Object.assign(group,{name:action.name.trim().slice(0,24),color:action.color,icon:action.icon.trim().slice(0,16)});
  return true;
 }
 if(action.type==='teams-choose'&&(host||identity.role==='player'&&current.open&&current.mode==='free')){
  const player=host?action.player:identity.team;
  if(!room.teams.some(item=>item.id===player))throw Error('Participant introuvable.');
  if(current.assignments[player]===action.group)return false;
  if(host&&action.group===''){delete current.assignments[player];return true;}
  const group=teamCapacity(current,room.teams).groups.find(item=>item.id===action.group);
  if(!group||group.members.length>=group.capacity)throw Error('Cette équipe est complète. Choisissez une autre équipe.');
  current.assignments[player]=group.id;
  return true;
 }
 throw Error('Cette action est indisponible.');
}

export function startTeamPlan(room,limit=MAX_PARTICIPANTS){
 const plan=room.teamPlan;
 if(!plan||plan.groups.length>limit)throw Error(`Préparez entre 2 et ${limit} équipes.`);
 if(room.teams.length<plan.groups.length)throw Error('Attendez au moins un joueur par équipe.');
 if(plan.mode==='auto')fillTeams(plan,room.teams);
 const {groups,unassigned}=teamCapacity(plan,room.teams);
 if(unassigned.length)throw Error(`${unassigned.length} participant(s) doivent encore rejoindre une équipe.`);
 if(groups.some(group=>!group.members.length))throw Error('Il faut au moins un joueur par équipe.');
 plan.open=false;
 plan.gather=false;
 return plan;
}
