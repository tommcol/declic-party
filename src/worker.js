import {mountainSettings,startMountain,applyMountain,mountainView} from './tyrolien-game.js';
import {MAX_PARTICIPANTS,TYROLIEN_TEAMS,teamIdentity,teamCapacity,changeTeamPlan,fillTeams,startTeamPlan} from '../public/teams.js';
import {changeRoulette,rouletteView,rouletteIndex,rouletteAdvanceAt} from '../public/roulette.js';
import {applyTyrolien,tyrolienView} from './tyrolien-room.js';
import { DurableObject } from 'cloudflare:workers';
import {createGame,applyAction,publicGame,normalizeQuizCredit,roundStatistics,BINGO_CARD_SIZE} from '../public/engine.js';
import {MusicLibrary,libraryRouteParams} from './library.js';
export {MusicLibrary};
import {musicRoute,libraryPreviews} from './catalog.js';
import {ASSETS} from './assets.generated.js';
async function boundedText(req,max){const reader=req.body?.getReader();if(!reader)return '';const chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw Error('Partie trop volumineuse');}chunks.push(value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.byteLength;}return new TextDecoder().decode(bytes);}
const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const roomCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');
const PLAYER_LIMIT=300;
const CONNECTION_LIMIT=PLAYER_LIMIT+32;
const validCode=code=>typeof code==='string'&&/^[A-Z2-9]{8}$/.test(code);
const hostToken=token=>typeof token==='string'&&/^[0-9a-f-]{36}$/.test(token);
async function eveningRoute(req,env,url){
 const method=req.method;
 if(!['GET','POST','PUT','DELETE'].includes(method))return json({error:'Méthode non autorisée.'},405);
 if(method!=='GET'&&req.headers.get('Origin')!==url.origin)return json({error:'Origine refusée.'},403);
 const credential=req.headers.get('Authorization')?.match(/^Bearer ([0-9a-f]{64})$/)?.[1];
 if(!credential)return json({error:'Accès animateur refusé.'},403);
 let data={};
 if(method!=='GET'){
  try{data=JSON.parse(await boundedText(req,method==='PUT'?1000000:2048));}
  catch{return json({error:'Demande invalide ou trop volumineuse.'},400);}
  if(!data||typeof data!=='object')return json({error:'Demande invalide.'},400);
 }
 const result=await env.ROOMS.getByName('host:'+await digest(credential)).evening(method,data);
 return json(result.body,result.status);
}
async function libraryRoute(req,env,url){
 const credential=req.headers.get('Authorization')?.match(/^Bearer ([0-9a-f]{64})$/)?.[1];
 if(!credential)return json({error:'Accès animateur refusé.'},403);
 const library=env.MUSIC_LIBRARY.getByName(await digest(credential));
 if(req.method==='GET'){
  if(url.pathname==='/api/library')return json(await library.summary());
  if(url.pathname==='/api/library/candidates'){
   const ids=url.searchParams.getAll('playlist');
   const playlists=ids.length?ids:['mix'];
   const valid=playlists.every(id=>libraryRouteParams(new URL('/?playlist='+encodeURIComponent(id),url)));
   return valid?json({tracks:await library.candidates([...new Set(playlists)])}):json({error:'Playlist inconnue.'},400);
  }
  if(url.pathname==='/api/library/previews'){
   const queries=url.searchParams.getAll('q');
   if(!queries.length||queries.length>8||queries.some(q=>q.length<2||q.length>180))return json({error:'Recherche invalide.'},400);
   return json({results:await libraryPreviews(queries)});
  }
  if(url.pathname==='/api/library/tracks'){
   const params=libraryRouteParams(url);
   return params?json(await library.list(params)):json({error:'Recherche invalide.'},400);
  }
 }
 if(req.method==='POST'||req.method==='PATCH'){
  if(req.headers.get('Origin')!==url.origin)return json({error:'Origine refusée.'},403);
  if(req.method==='POST'&&url.pathname==='/api/library/refresh'){
   return json({import:await library.refresh(true)},202);
  }
  if(req.method==='PATCH'&&url.pathname==='/api/library/tracks'){
   let data;
   try{data=JSON.parse(await boundedText(req,2048));}
   catch{return json({error:'Demande invalide.'},400);}
   if(typeof data?.id!=='string'||data.id.length>360||typeof data.excluded!=='boolean'){
    return json({error:'Titre invalide.'},400);
   }
   return await library.setExcluded(data.id,data.excluded)
    ?json({ok:true}):json({error:'Titre introuvable.'},404);
  }
 }
 return json({error:'Route de bibliothèque inconnue.'},404);
}
export default {
 async fetch(req,env){
  try{
   const url=new URL(req.url);
   if(url.pathname==='/api/library'||url.pathname.startsWith('/api/library/'))return await libraryRoute(req,env,url);
   if(url.pathname==='/api/evening')return await eveningRoute(req,env,url);
   if(req.method==='GET'&&url.pathname.startsWith('/api/music/'))return musicRoute(req);
   if(url.pathname==='/api/health')return json({ok:true,version:'0.8.0'});
   if(req.method==='POST'&&url.pathname==='/api/rooms'){
    if(req.headers.get('Origin')!==url.origin)return json({error:'Origine refusée'},403);
    if(Number(req.headers.get('Content-Length'))>150000)return json({error:'Partie trop volumineuse'},413);
    const text=await boundedText(req,150000);if(text.length>150000)return json({error:'Partie trop volumineuse'},413);
    const data=JSON.parse(text);
    if(!validCode(data?.room)||!hostToken(data.token))return json({error:'Accès animateur refusé.'},403);
    const mountain=data.musicGame==='tyrolien';
    if(mountain){
     if(!Array.isArray(data.questions)||data.questions.some(q=>q?.kind!=='audio'||
        q.target!==undefined&&!['title','artist','both'].includes(q.target))||!['qcm','text'].includes(data.input)||
        data.input==='qcm'&&data.questions.some(q=>q.target==='both')){
      return json({error:'Choisissez des extraits musicaux et des réponses en QCM ou à l’écrit.'},400);
     }
     const {duration,titlePoints,artistPoints,speed,streak,jokers,listening,autoNext,autoNextSeconds}=data.settings||{};
     data.settings={duration,titlePoints,artistPoints,speed,streak,jokers,listening,autoNext,autoNextSeconds};
    }
    if(!Array.isArray(data.questions)||data.questions.length<1||data.questions.length>100)return json({error:'Choisissez entre 1 et 100 questions.'},400);
    if(data.questions.some(q=>q?.universe!=='music'&&!(q?.universe==='film'&&q.target==='soundtrack')))return json({error:'Choisissez un jeu musical.'},400);
    for(const q of data.questions){if(typeof q.answer!=='string'||!q.answer.trim()||q.answer.length>180||typeof q.prompt!=='string'||q.prompt.length>300||!Array.isArray(q.options)||q.options.length>(q.target==='soundtrack'?5:4)||q.options.some(o=>typeof o!=='string'||o.length>180)||!q.options.includes(q.answer)||!Number.isFinite(q.duration)||q.duration<5||q.duration>90||!Number.isFinite(q.points)||q.points<1||q.points>1000)return json({error:'Question invalide : vérifiez les réponses, les points et la durée.'},400);}
    if(data.questions.some(q=>q.kind==='lyrics'&&(!Number.isFinite(q.cutAt)||q.cutAt<.1||q.cutAt>30||q.cutAt>=q.duration)))return json({error:'Choisissez une coupure entre 0,1 et 30 secondes, avant la fin de la manche.'},400);
    const isCoverUrl=url=>typeof url==='string'&&url.length<=500&&/^https:\/\/[a-z0-9.-]+\.dzcdn\.net\//i.test(url);
    if(data.questions.some(q=>q.target==='coverChoice'&&(data.input!=='qcm'||!Array.isArray(q.optionArtwork)||q.optionArtwork.length!==4||q.options.join(',')!=='A,B,C,D'||new Set(q.optionArtwork).size!==4||!q.optionArtwork.every(isCoverUrl)||q.optionArtwork[q.options.indexOf(q.answer)]!==q.artwork)))return json({error:'Ce jeu nécessite quatre pochettes distinctes.'},400);
    if(data.settings?.chain&&(data.input!=='qcm'||data.settings.bingo===true||data.settings.survival===true||data.questions.length<4))return json({error:'Ce jeu nécessite au moins quatre questions en QCM.'},400);
    if(data.settings?.bingo&&(data.input!=='qcm'||data.settings.survival===true||data.questions.length!==BINGO_CARD_SIZE||data.questions.some(q=>q.kind!=='audio'||typeof q.title!=='string'||!q.title.trim()||typeof q.artist!=='string'||!q.artist.trim())||new Set(data.questions.map(q=>String(q.id).slice(0,80))).size!==data.questions.length))return json({error:'Le bingo nécessite 16 extraits distincts et un salon sur téléphone.'},400);
    if(data.settings?.timelineMode){
     const validModes=['collective','individual'];
     const anchor=data.settings.timelineAnchor;
     const validSong=song=>typeof song?.id==='string'&&song.id.length>0&&song.id.length<=80&&
      typeof song.title==='string'&&song.title.trim()&&song.title.length<=180&&
      typeof song.artist==='string'&&song.artist.trim()&&song.artist.length<=180&&
      Number.isInteger(song.year)&&song.year>=1900&&song.year<=new Date().getFullYear();
     if(!validModes.includes(data.settings.timelineMode)||data.input!=='qcm'||!validSong(anchor)||
        data.questions.length<5||data.questions.some(q=>q.target!=='timeline'||q.kind!=='audio'||!validSong(q))||
        new Set([anchor.id,...data.questions.map(q=>q.id)]).size!==data.questions.length+1){
      return json({error:'Choisissez au moins cinq extraits et une chanson de départ datés.'},400);
     }
     const {id,title,artist,year}=anchor;
     data.settings={
      timelineMode:data.settings.timelineMode,timelineAnchor:{id,title,artist,year},
      jokers:data.settings.jokers===true,autoNext:data.settings.autoNext===true,autoNextSeconds:data.settings.autoNextSeconds
     };
    }
    const allowedTargets=['both','title','artist','cover','artistTitle','coverChoice','timeline','coversQuiz','soundtrack'];
    data.questions=data.questions.map(q=>({id:String(q.id).slice(0,80),universe:q.target==='soundtrack'?q.universe:'music',cutAt:q.kind==='lyrics'?q.cutAt:undefined,kind:['audio','image','question','lyrics'].includes(q.kind)?q.kind:'question',prompt:q.prompt,answer:q.answer,explanation:typeof q.explanation==='string'?q.explanation.slice(0,1500):undefined,theme:typeof q.theme==='string'?q.theme.slice(0,80):undefined,credit:normalizeQuizCredit(q.credit),aliases:(Array.isArray(q.aliases)?q.aliases:[]).filter(v=>typeof v==='string').slice(0,15).map(v=>v.slice(0,180)),options:q.options,year:q.target==='timeline'&&Number.isInteger(q.year)?q.year:undefined,timeline:q.target==='timeline'&&Array.isArray(q.timeline)?q.timeline.filter(v=>typeof v==='string').slice(0,3).map(v=>v.slice(0,180)):undefined,optionArtwork:q.target==='coverChoice'?q.optionArtwork:undefined,duration:q.duration,points:q.points,title:typeof q.title==='string'?q.title.slice(0,180):undefined,artist:typeof q.artist==='string'?q.artist.slice(0,180):undefined,titleAliases:(Array.isArray(q.titleAliases)?q.titleAliases:[]).filter(v=>typeof v==='string').slice(0,10).map(v=>v.slice(0,180)),artistAliases:(Array.isArray(q.artistAliases)?q.artistAliases:[]).filter(v=>typeof v==='string').slice(0,10).map(v=>v.slice(0,180)),target:allowedTargets.includes(q.target)?q.target:'title',emoji:typeof q.emoji==='string'?q.emoji.slice(0,80):undefined,artwork:typeof q.artwork==='string'&&/^https:\/\/[^/]+\.dzcdn\.net\//.test(q.artwork)?q.artwork:undefined,link:typeof q.link==='string'&&/^https:\/\/www\.deezer\.com\//.test(q.link)?q.link:undefined,provider:q.provider==='Deezer'?'Deezer':undefined}));
    const randomTeamCount=Number.isInteger(data.randomTeamCount)&&data.randomTeamCount>=2&&data.randomTeamCount<=MAX_PARTICIPANTS&&
     !data.settings?.bingo&&!data.settings?.survival&&!data.settings?.timelineMode&&!data.settings?.chain&&data.input!=='buzzer'?data.randomTeamCount:0;
    const musicGame=['blind','bingo','timeline','coversQuiz','soundtrack','covers','survival','tyrolien'].includes(data.musicGame)?data.musicGame:undefined;
    const setup={mountain:mountain?mountainSettings(data.mountain):undefined,teamPlay:mountain||data.teamPlay===true&&Boolean(randomTeamCount),musicGame,showAnimations:data.showAnimations!==false,randomTeamCount,questions:data.questions,input:['text','buzzer'].includes(data.input)?data.input:'qcm',settings:data.settings&&typeof data.settings==='object'?data.settings:{},effect:['normal','fast','slow','chipmunk','reverse','image'].includes(data.effect)?data.effect:'normal'};
    const status=await env.ROOMS.getByName(data.room).prepare(setup,await digest(data.token));
    return status===200?json({code:data.room,token:data.token}):json({error:status===404?'Cette soirée a expiré. Créez une nouvelle soirée.':status===403?'Accès animateur refusé.':'Terminez le jeu en cours avant de changer de jeu.'},status);
   }
   const m=url.pathname.match(/^\/api\/rooms\/([A-Z2-9]{8})$/);
   if(m){if(req.headers.get('Upgrade')!=='websocket')return json({error:'Connexion WebSocket attendue'},426);if(req.headers.get('Origin')!==url.origin)return json({error:'Origine refusée'},403);return env.ROOMS.getByName(m[1]).fetch(req);}
   if(req.method!=='GET'&&req.method!=='HEAD')return new Response('Méthode non autorisée',{status:405});
   if(url.pathname==='/solo.html')return Response.redirect(new URL('/',url),302);
   const path=['/','/join','/tv'].includes(url.pathname)?'/index.html':url.pathname;
   const asset=ASSETS[path];if(!asset)return new Response('Introuvable',{status:404});
   return new Response(req.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':env.DECLIC_LOCAL==='true'?'no-store':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://*.dzcdn.net https://*.deezer.com; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"}});
  }catch(e){console.error(JSON.stringify({event:'request_error',message:e.message}));return json({error:'Impossible de traiter cette demande.'},500);}
 }
};
function eveningTotals(room){
 const totals={...room.eveningTotals};
 const history=room.history||[];
 const attempts=new Map(room.tyrolien?[]:roundStatistics(history,room.teams,room.archivedStats).map(row=>[row.id,row]));
 for(const team of room.teams){
  const prior=totals[team.id]||{points:0,correct:0,played:0};
  const ty=room.tyrolien?.scores[team.id];
  const stats=attempts.get(team.id);
  const correct=ty?.points??stats?.correct??0;
  const played=room.tyrolien?(ty?.played||0):(room.mountain?.roundsPlayed??history.length);
  const bestTimes=[prior.best,stats?.best].filter(Number.isFinite);
  totals[team.id]={id:team.id,name:team.name,
   games:(prior.games||0)+(played>0?1:0),
   jokersEarned:(prior.jokersEarned||0)+(team.joker?.earned?.length||0),
   jokersUsed:(prior.jokersUsed||0)+(team.joker?.used?.length||0),
   points:prior.points+(room.tyrolien?correct:(team.score||0)+(team.timelineBonus||0)),
   correct:prior.correct+correct,played:prior.played+played,
   wrong:(prior.wrong||0)+(stats?.wrong||0),absent:(prior.absent||0)+(stats?.absent||0),
   elapsed:(prior.elapsed||0)+(ty?.elapsed??stats?.elapsed??0),timed:(prior.timed||0)+(ty?.points??stats?.timed??0),
   best:bestTimes.length?Math.min(...bestTimes):null};
 }
 return totals;
}
export class PartyRoom extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));}
 // A host object stores one active room and a recoverable lifecycle operation.
 async evening(method,data){
  const run=(this.lifecycle||Promise.resolve()).then(()=>this.updateEvening(method,data));
  this.lifecycle=run.catch(()=>{});
  return run;
 }
 async updateEvening(method,data){
  const storage=this.ctx.storage, rooms=this.env.ROOMS;
  const reply=(body,status=200)=>({body,status});
  const conflict=()=>reply({error:'La soirée a changé dans un autre onglet. Rechargez son état.'},409);
  let active=await storage.get('active')||null;
  let pending=await storage.get('pending');
  if(pending){
   active=await this.finishEvening(pending);
  }
  if(method==='GET')return reply({active});
  if(method==='PUT'){
   if(!active||data.code!==active.code)return conflict();
   if(!Number.isSafeInteger(data.revision)||data.revision<0||(data.state!==null&&(data.state?.mode!=='usb'||!Array.isArray(data.state.questions)||!Array.isArray(data.state.teams)))){
    return reply({error:'Sauvegarde USB invalide.'},400);
   }
   const previous=active.usb;
   if(previous?.id===data.id)return reply({revision:previous.revision});
   if(!hostToken(data.id)||data.revision!==(previous?.revision||0))return conflict();
   active.usb={id:data.id,revision:data.revision+1,state:data.state};
   await storage.put('active',active);
   return reply({revision:active.usb.revision});
  }
  if(method==='POST'&&data.adopt){
   if(active)return reply({active});
   const {code,token}=data.adopt;
   if(!validCode(code)||!hostToken(token))return reply({error:'Accès animateur refusé.'},403);
   const hash=await digest(token);
   if(!await rooms.getByName(code).adoptRoom(hash))return reply({active:null});
   active={code,token};
   await storage.put('active',active);
   return reply({active});
  }
  if(method==='POST'&&active?.operation===data.id)return reply({active});
  if((active?.code||null)!==data.expected)return conflict();
  if(method==='DELETE'){
   if(!active)return reply({active:null});
   pending={old:{code:active.code,token:active.token},next:null};
  }else{
   if(!hostToken(data.id))return reply({error:'Identifiant de création invalide.'},400);
   let code=roomCode();
   while(code===active?.code)code=roomCode();
   pending={old:active&&{code:active.code,token:active.token},next:{code,token:crypto.randomUUID(),operation:data.id}};
  }
  await storage.put('pending',pending);
  return reply({active:await this.finishEvening(pending)});
 }
 async finishEvening(pending){
  const storage=this.ctx.storage, rooms=this.env.ROOMS;
  if(pending.next){
   const {code,token}=pending.next;
   const initialized=await rooms.getByName(code).initialize({questions:[],input:'qcm',effect:'normal',hostHash:await digest(token),code,managed:true});
   if(!initialized){
    await storage.delete('pending');
    throw Error('Code de soirée déjà utilisé.');
   }
  }
  if(pending.old){
   const {code,token}=pending.old;
   const status=await rooms.getByName(code).removeRoom(await digest(token));
   if(status===403)throw Error('Accès à la soirée précédente refusé.');
  }
  await storage.transaction(async tx=>{
   if(pending.next)await tx.put('active',pending.next);
   else await tx.delete('active');
   await tx.delete('pending');
  });
  return pending.next;
 }
 async initialize(data){
  const existing=await this.ctx.storage.get('room');
  if(existing)return data.managed&&existing.hostHash===data.hostHash;
  const expires=data.managed?undefined:Date.now()+86400000;
  await this.ctx.storage.put('room',{...createGame(data.questions,[],'phone',data.input,data.settings),effect:data.effect,hostHash:data.hostHash,code:data.code,expires});
  if(expires)await this.ctx.storage.setAlarm(expires);
  return true;
 }
 async adoptRoom(hostHash){
  const room=await this.ctx.storage.get('room');
  if(!room||room.expires<=Date.now()||room.hostHash!==hostHash)return false;
  delete room.expires;
  await this.ctx.storage.put('room',room);
  await this.schedule(room);
  return true;
 }
 async removeRoom(hostHash){
  const room=await this.ctx.storage.get('room');
  if(!room)return 404;
  if(room.hostHash!==hostHash)return 403;
  await this.ctx.storage.deleteAll();
  await this.ctx.storage.deleteAlarm();
  for(const ws of this.ctx.getWebSockets())ws.close(4001,'Soirée terminée');
  return 200;
 }
 async schedule(room,storage=this.ctx.storage){
  const at=room.tyrolien?room.tyrolien.nextAt:room.phase==='playing'?room.endAt:room.nextAt;
  const wheel=room.roulette;
  const wheelAlarm=wheel&&(wheel.stopAt===null?wheel.deadline:wheel.revealAt>Date.now()?wheel.revealAt:rouletteAdvanceAt(wheel));
  const alarm=Math.min(at||Infinity,room.expires||Infinity,wheelAlarm||Infinity);
  if(Number.isFinite(alarm))await storage.setAlarm(alarm);
  else await storage.deleteAlarm();
 }
 completedTeamGames(room){
  const history=room.teamResults||[];
  if(room.phase!=='finished')return history;
  if(room.tyrolien?.round||room.mountain?.teams.length){
   const ty=room.mountain||room.tyrolien;
   const order=[...(ty.winner?[ty.winner]:[]),...ty.eliminated.slice().reverse()];
   const offset=ty.teams.length-order.length;
   const groups=ty.teams.map(team=>({name:team.name,icon:team.icon,color:team.color,
    position:team.position,rank:order.includes(team.id)?offset+order.indexOf(team.id)+1:null}))
    .sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity));
   return [...history,{game:'tyrolien',groups}];
  }
  if(room.randomTeamAssignments)return [...history,{game:room.musicGame,groups:this.classicTeamScores(room)}];
  return history;
 }
 classicTeamScores(room){
  const groups=Array.from({length:room.randomTeamCount},(_,id)=>({name:'Équipe '+(id+1),...room.roundTeamIdentities?.[id],id,score:0}));
  for(const player of room.teams){
   const group=groups[room.randomTeamAssignments[player.id]];
   if(group)group.score+=player.score;
  }
  return groups.sort((left,right)=>right.score-left.score||left.id-right.id);
 }
 async prepare(data,hostHash){
  const prepared=await this.ctx.storage.transaction(async tx=>{
   const current=await tx.get('room');
   if(!current||current.expires<=Date.now())return {status:404};
   if(current.hostHash!==hostHash)return {status:403};
   if(!['lobby','finished'].includes(current.phase))return {status:409};
   const next={
    ...createGame(data.questions,current.teams,'phone',data.input,data.settings),
    teams:current.teams.map(({id,name,key,token})=>({id,name,key,token,score:0,streak:0})),
    teamPlan:current.teamPlan||(data.mountain?{groups:[teamIdentity(0),teamIdentity(1)],assignments:{},mode:'free',open:false,gather:false}:undefined),
    mountain:data.mountain,teamPlay:data.teamPlay,teamResults:this.completedTeamGames(current),
    musicGame:data.musicGame,showAnimations:data.showAnimations,randomTeamCount:data.randomTeamCount||undefined,roulettePlayers:current.roulettePlayers,eveningTotals:eveningTotals(current),effect:data.effect,hostHash,code:current.code,expires:current.expires,revision:(current.revision||0)+1
   };
   await tx.put('room',next);
   return {status:200,room:next};
  });
  if(prepared.room){await this.schedule(prepared.room);this.broadcast(prepared.room);}
  return prepared.status;
 }
 async fetch(req){const room=await this.ctx.storage.get('room');if(!room||room.expires<Date.now())return json({error:'Cette partie est introuvable ou a expiré.'},404);if(this.ctx.getWebSockets().length>=CONNECTION_LIMIT)return json({error:'Salon complet'},429);if(this.ctx.upgradeWebSocket)return this.ctx.upgradeWebSocket(req);const [client,server]=Object.values(new WebSocketPair());this.ctx.acceptWebSocket(server);server.serializeAttachment({role:'guest',last:0,count:0});return new Response(null,{status:101,webSocket:client});}
 send(ws,data){try{ws.send(JSON.stringify(data));}catch{}}
 eveningRanking(s){
  const showCurrent=['paused','reveal','finished','result','vote','attack'].includes(s.phase);
  const totals=showCurrent?eveningTotals(s):s.eveningTotals;
  return Object.values(totals||{}).sort((left,right)=>right.points-left.points);
 }
 sendState(ws,s,a,eveningRanking,teamPlan){
  const state=s.tyrolien?tyrolienView(s,a.role,a.team):a.role==='host'
   ?{...s,hostHash:undefined}:publicGame(s,a.role==='player'?a.team:undefined);
  if(s.mountain){
   state.mountain=mountainView(s,a.role,a.team);
   state.gameStatistics=s.phase==='finished'?roundStatistics(s.history,s.teams,s.archivedStats)
    .filter(row=>a.role!=='player'||row.id===a.team):undefined;
   delete state.archivedStats;
  }
  state.teamPlan=teamPlan??this.teamPlanView(s);
  state.teamPlay=s.teamPlay;
  state.roulette=rouletteView(s.roulette,Date.now(),a.team);
  state.musicGame=s.musicGame;
  state.showAnimations=s.showAnimations;
  if(s.randomTeamAssignments){
   state.randomTeams=this.classicTeamScores(s);
   state.myRandomTeam=s.randomTeamAssignments[a.team];
  }
  state.teamResults=['lobby','paused','finished'].includes(s.phase)&&(a.role==='host'||a.role==='tv')?s.teamResults:undefined;
  if(a.role==='host'&&['lobby','finished'].includes(s.phase)){
   state.roulettePlayers=this.rouletteParticipants(s);
  }
  if(a.role==='host'&&s.settings?.bingo){
   state.connectedPlayers=[...new Set(this.ctx.getWebSockets().map(socket=>socket.deserializeAttachment())
    .filter(identity=>identity?.role==='player').map(identity=>identity.team))];
  }
  if(a.role==='host'||a.role==='tv'||a.role==='player'&&['lobby','paused','finished'].includes(s.phase)){
   const ranking=eveningRanking||this.eveningRanking(s);
   if(a.role==='player'){
    const rank=ranking.findIndex(team=>team.id===a.team);
    if(rank>=0)state.eveningPersonal={...ranking[rank],rank:rank+1};
   }else state.eveningRanking=ranking;
  }
  if(!s.tyrolien&&a.role==='tv'){
   state.historyCount=state.history.length;
   state.history=state.history.slice(-1);
  }else if(!s.tyrolien&&a.role==='player'){
   state.history=state.history.map(round=>({...round,results:round.results.filter(result=>result.id===a.team)}));
  }
  this.send(ws,{type:'state',state});
 }
 broadcast(s,respondingPlayer){
  // Full phase broadcasts supersede pending lobby updates.
  if(!respondingPlayer)this.pendingTeams=null;
  const ranking=this.eveningRanking(s);
  const teamPlan=this.teamPlanView(s);
  for(const ws of this.ctx.getWebSockets()){
   const identity=ws.deserializeAttachment();
   if(identity?.role==='host'||identity?.role==='tv'||
      (identity?.role==='player'&&(!respondingPlayer||identity.team===respondingPlayer))){
    this.sendState(ws,s,identity,ranking,teamPlan);
   }
  }
 }
 broadcastMountainAnswer(room,player){
  const message={type:'mountain-answer',questionId:room.questions[room.index].id,revision:room.revision};
  for(const socket of this.ctx.getWebSockets()){
   const identity=socket.deserializeAttachment();
   if(identity?.role==='host')this.send(socket,{...message,player,result:room.answers[player]});
   else if(identity?.role==='player'&&identity.team===player)this.sendState(socket,room,identity);
  }
 }
 broadcastBingoAnswer(s,player){
  const count=Object.keys(s.answers).length;
  const result=s.answers[player];
  for(const socket of this.ctx.getWebSockets()){
   const identity=socket.deserializeAttachment();
   const message={type:'bingo-answer',index:s.index,revision:s.revision,count};
   if(identity?.role==='host')this.send(socket,{...message,player,result});
   else if(identity?.role==='tv')this.send(socket,message);
   else if(identity?.role==='player'&&identity.team===player){
    this.send(socket,{...message,me:{attempts:result.attempts,selectedSong:result.selectedSong}});
   }
  }
 }
 rouletteParticipants(room){
  const ids=new Set(this.ctx.getWebSockets().map(socket=>socket.deserializeAttachment())
   .filter(identity=>identity?.role==='player').map(identity=>identity.team));
  return room.teams.filter(team=>ids.has(team.id)).map(({id,name})=>({id,name}));
 }
 async updateRoulette(action, identity, now){
  const updated=await this.ctx.storage.transaction(async tx=>{
   const room=await tx.get('room');
   if(!room||!['lobby','finished'].includes(room.phase))throw Error('Terminez le jeu avant le tirage.');
   const previous=room.roulette;
   const next=changeRoulette(previous,action,identity,this.rouletteParticipants(room),room.roulettePlayers||[],now);
   if(next===previous)return null;
   room.roulette=next;
   if(next?.player&&next.stopAt!==null&&previous?.stopAt!==next.stopAt){
    room.roulettePlayers=[...(room.roulettePlayers||[]),next.player.id];
   }
   await tx.put('room',room);
   return room;
  });
  if(updated){
   if(action.type==='roulette-vote'&&updated.roulette.stopAt===null){
    // Individual votes only update the voter, the host and the TV.
    this.broadcastWheel(updated,identity.team);
   }else{
    this.broadcastWheel(updated);
    await this.schedule(updated);
   }
  }
 }
 broadcastWheel(room,respondingPlayer){
  const now=Date.now();
  for(const socket of this.ctx.getWebSockets()){
   const identity=socket.deserializeAttachment();
   if(identity?.role&&identity.role!=='guest'&&(!respondingPlayer||identity.role!=='player'||identity.team===respondingPlayer))this.send(socket,{type:'roulette',wheel:rouletteView(room.roulette,now,identity.team)});
  }
 }
 teamPlanView(room){
  return room.teamPlan&&['lobby','paused','finished'].includes(room.phase)?teamCapacity(room.teamPlan,room.teams):null;
 }
 publishTeams(room){
  this.pendingTeams=room;
  if(this.teamPushTimer)return;
  this.teamPushTimer=setTimeout(()=>{
   this.teamPushTimer=null;
   const latest=this.pendingTeams;
   this.pendingTeams=null;
   if(!latest)return;
   const payload=JSON.stringify({type:'team-plan',teamPlan:this.teamPlanView(latest)});
   for(const socket of this.ctx.getWebSockets()){
    const role=socket.deserializeAttachment()?.role;
    if(['host','tv','player'].includes(role)){
     try{socket.send(payload);}catch{}
    }
   }
  },100);
 }
 async joinParticipant(message,now){
  return this.ctx.storage.transaction(async tx=>{
   const room=await tx.get('room');
   if(!room||room.expires<=now)throw Error('Partie expirée');
   const existing=typeof message.token==='string'?room.teams.find(player=>player.token===message.token):null;
   if(existing)return {room,player:existing,joined:false};
   if(room.phase!=='lobby'&&!(room.teamPlan&&room.phase==='finished'))throw Error('La partie a commencé. Rejoignez la prochaine !');
   if(room.teams.length>=PLAYER_LIMIT)throw Error(PLAYER_LIMIT+' participants maximum');
   const name=String(message.name||'').trim().slice(0,24);
   if(!name)throw Error('Entrez votre prénom');
   if(room.teams.some(player=>player.name.toLowerCase()===name.toLowerCase()))throw Error('Ce nom est déjà utilisé');
   const player={id:crypto.randomUUID(),name,score:0,key:'',token:crypto.randomUUID()};
   room.teams.push(player);
   if(room.teamPlan?.open&&room.teamPlan.mode==='auto')fillTeams(room.teamPlan,room.teams);
   await tx.put('room',room);
   return {room,player,joined:true};
  });
 }
 async updateTeamPlan(action,identity,now){
  const room=await this.ctx.storage.transaction(async tx=>{
   const latest=await tx.get('room');
   if(!latest||latest.expires<=now)throw Error('Partie expirée');
   if(!changeTeamPlan(latest,action,identity))return null;
   await tx.put('room',latest);
   return latest;
  });
  if(room)this.publishTeams(room);
 }
 async startClassic(action,now){
  const room=await this.ctx.storage.transaction(async tx=>{
   const latest=await tx.get('room');
   if(!latest||latest.expires<=now||latest.phase!=='lobby'||latest.tyrolien)throw Error('Ce jeu n’est plus en attente.');
   const minimum=latest.settings?.chain?3:latest.settings?.survival&&latest.input==='qcm'?2:1;
   if(latest.teams.length<minimum)throw Error(`Attendez au moins ${minimum} participant(s).`);
   if(latest.mountain){
    startMountain(latest,startTeamPlan(latest,TYROLIEN_TEAMS));
   }else if(latest.teamPlay){
    const plan=startTeamPlan(latest);
    latest.randomTeamCount=plan.groups.length;
    latest.roundTeamIdentities=plan.groups.map(group=>({...group}));
    latest.randomTeamAssignments=Object.fromEntries(Object.entries(plan.assignments).map(([id,group])=>[id,Number(group)]));
   }else if(latest.randomTeamCount){
    if(latest.teams.length<latest.randomTeamCount)throw Error('Attendez au moins '+latest.randomTeamCount+' joueurs pour former les équipes.');
    const ids=latest.teams.map(player=>player.id);
    for(let index=ids.length-1;index>0;index--){
     const pick=rouletteIndex(index+1);
     [ids[index],ids[pick]]=[ids[pick],ids[index]];
    }
    latest.randomTeamAssignments=Object.fromEntries(ids.map((id,index)=>[id,index%latest.randomTeamCount]));
   }
   const next=applyAction(latest,action,now);
   if(next===latest)return null;
   if(next.teamPlan){next.teamPlan.gather=false;next.teamPlan.open=false;}
   await tx.put('room',next);
   await this.schedule(next,tx);
   return next;
  });
  if(room)this.broadcast(room);
 }
 async webSocketMessage(ws,msg){
  try{
   if(typeof msg!=='string'||msg.length>80000)throw Error('Message invalide');
   const a=ws.deserializeAttachment()||{role:'guest',last:0,count:0};const now=Date.now();a.count=now-a.last<1000?a.count+1:1;a.last=now;ws.serializeAttachment(a);if(a.count>12)throw Error('Trop de demandes');
   const m=JSON.parse(msg);
   if(['teams-config','teams-open','teams-mode','teams-shuffle','teams-style','teams-choose','teams-gather'].includes(m.type)){
    await this.updateTeamPlan(m,a,now);
    return;
   }
   const hash=m.type==='host'&&hostToken(m.token)?await digest(m.token):null;let s=await this.ctx.storage.get('room');if(!s||s.expires<now)throw Error('Partie expirée');
   if(m.type==='host'){if(hash!==s.hostHash)throw Error('Accès animateur refusé');a.role='host';ws.serializeAttachment(a);this.sendState(ws,s,a);return;}
   if(m.type==='tv'){a.role='tv';ws.serializeAttachment(a);this.sendState(ws,s,a);return;}
   if(m.type==='join'){
    if(a.role==='player'){this.sendState(ws,s,a);return;}
    const {room,player,joined}=await this.joinParticipant(m,now);
    a.role='player';a.team=player.id;ws.serializeAttachment(a);
    this.send(ws,{type:'session',id:player.id,token:player.token});
    if(joined){
     this.broadcast(room,player.id);
     if(room.teamPlan?.open||room.teamPlan?.gather)this.publishTeams(room);
    }else this.sendState(ws,room,a);
    return;
   }
   if(m.type==='play'&&a.role==='host'&&s.phase==='lobby'&&!s.tyrolien){
    await this.startClassic(m,now);
    return;
   }
   if(m.type==='ceremony'&&a.role==='host'&&['lobby','finished'].includes(s.phase)){
    const ranking=m.open?Object.values(eveningTotals(s)).sort((left,right)=>right.points-left.points):null;
    for(const socket of this.ctx.getWebSockets()){
     if(['host','tv'].includes(socket.deserializeAttachment()?.role))this.send(socket,{type:'ceremony',ranking,animation:m.animation!==false});
    }
    return;
   }
   if(['roulette-start','roulette-stop','roulette-dismiss','roulette-vote'].includes(m.type)){
    await this.updateRoulette(m,a,now);
    return;
   }
   if(s.tyrolien){
    if(m.type==='ty-tick')throw Error('Action non autorisée');
    s=await this.updateTyrolien(m,a,now);
    this.broadcast(s,m.type==='ty-answer'||m.type==='ty-vote'?a.team:undefined);
    return;
   }
   const result=await this.ctx.storage.transaction(async tx=>{
    s=await tx.get('room');
    if(!s||s.expires<=now||s.tyrolien)throw Error('Cette partie est indisponible.');
    const previous=s;
    const act=(action)=>s.mountain?applyMountain(s,action,now):applyAction(s,action,now);
    if(m.type==='buzz'&&a.role==='player'&&s.input==='buzzer'){if(m.questionId!==s.questions[s.index]?.id)throw Error('Cette question est terminée');s=act({type:'buzz',team:a.team});}
    else if(['chain-bank','chain-vote'].includes(m.type)&&a.role==='player'&&s.settings?.chain){
     if(m.questionId!==s.questions[s.index]?.id)throw Error('Cette manche est terminée.');
     s=act({type:m.type,team:a.team,candidate:m.candidate});
    }
    else if(m.type==='bingo-mark'&&a.role==='player'&&s.settings?.bingo){
     if(m.questionId!==`bingo-round-${s.index}`)throw Error('Cet extrait est terminé.');
     s=act({type:m.type,team:a.team,song:m.song});
    }
    else if(m.type==='joker'&&a.role==='player'){
     if(m.questionId!==s.questions[s.index]?.id)throw Error('Cette manche est terminée.');
     s=act({type:'joker',team:a.team});
    }
    else if(m.type==='answer'&&a.role==='player'&&s.input!=='buzzer'){if(m.questionId!==s.questions[s.index]?.id)throw Error('Cette question est terminée');s=act({type:'answer',team:a.team,answer:m.answer,title:m.title,artist:m.artist});}
    else if(m.type==='timeline-next'&&a.role==='host'&&s.settings?.timelineMode&&s.phase==='reveal'){
     s=act({type:'next'});
     if(s.phase==='ready')s=act({type:'play'});
    }
    else if(m.type==='ty-vote'&&a.role==='player'&&s.mountain){
     if(m.questionId!==s.questions[s.index]?.id)throw Error('Ce vote est terminé.');
     s=act({type:m.type,player:a.team,value:m.value});
    }
    else if(a.role==='host'&&(['play','pause','resume','reveal','next','adjust','judge','listen-more'].includes(m.type)||
       s.mountain&&['skip','stop'].includes(m.type)))s=act(m);
    else throw Error('Action non autorisée');

    if(s===previous)return {room:s,changed:false};
    if(s.teamPlan&&!['lobby','paused','finished'].includes(s.phase))s.teamPlan.gather=false;
    await tx.put('room',s);
    if(s.phase!==previous.phase||s.endAt!==previous.endAt||s.nextAt!==previous.nextAt)await this.schedule(s,tx);
    return {room:s,changed:true};
   });
   s=result.room;
   if(m.type==='answer')this.send(ws,{type:'received',accepted:!!s.answers[a.team]});
   if(!result.changed){
    if(m.type==='bingo-mark'||m.type==='ty-vote')this.sendState(ws,s,a);
    return;
   }
   if(m.type==='answer'&&s.mountain)this.broadcastMountainAnswer(s,a.team);
   else if(m.type==='bingo-mark')this.broadcastBingoAnswer(s,a.team);
   else this.broadcast(s,['answer','joker','chain-vote','ty-vote'].includes(m.type)?a.team:undefined);
  }catch(e){this.send(ws,{type:'error',message:e.message});}
 }
 async updateTyrolien(action,identity,now){
  return this.ctx.storage.transaction(async tx=>{
   const latest=await tx.get('room');
   if(!latest?.tyrolien)throw Error('Le Tyrolien est terminé.');
   if(action.type==='ty-start'&&identity.role==='host'&&latest.teamPlan&&latest.phase==='lobby'){
    const plan=startTeamPlan(latest,TYROLIEN_TEAMS);
    action={...action,names:plan.groups.map(group=>group.name),assignments:plan.assignments,teamIdentities:plan.groups};
   }
   applyTyrolien(latest.tyrolien,action,identity,latest.teams,now);
   if(latest.teamPlan&&!['lobby','paused','finished'].includes(latest.tyrolien.phase))latest.teamPlan.gather=false;
   latest.phase=latest.tyrolien.phase;
   await tx.put('room',latest);
   const alarm=Math.min(latest.tyrolien.nextAt||Infinity,latest.expires||Infinity);
   if(Number.isFinite(alarm))await tx.setAlarm(alarm);
   else await tx.deleteAlarm();
   return latest;
  });
 }
 async alarm(){
  let s=await this.ctx.storage.get('room');
  if(!s)return;
  const now=Date.now();
  if(s.expires<=now){
   for(const ws of this.ctx.getWebSockets())ws.close(4001,'Partie expirée');
   await this.ctx.storage.deleteAll();
   return;
  }
  const wheel=s.roulette;
  if(wheel&&wheel.stopAt===null&&wheel.deadline<=now){
   await this.updateRoulette({type:'roulette-stop',id:wheel.id},{role:'server'},now);
   return;
  }
  const advanceAt=rouletteAdvanceAt(wheel);
  if(advanceAt!==null&&advanceAt<=now){
   await this.updateRoulette({type:'roulette-advance',id:wheel.id},{role:'server'},now);
   return;
  }
  if(wheel?.revealAt!=null&&wheel.revealAt<=now)this.broadcastWheel(s);
  if(s.tyrolien?.nextAt&&s.tyrolien.nextAt<=now){
   this.broadcast(await this.updateTyrolien({type:'ty-tick'},{role:'server'},now));
   return;
  }
  const updated=await this.ctx.storage.transaction(async tx=>{
   const latest=await tx.get('room');
   if(!latest)return null;
   const type=latest.phase==='playing'&&latest.endAt<=now?'timeout':
    latest.phase==='reveal'&&latest.nextAt&&latest.nextAt<=now?(latest.mountain?'ty-tick':'next'):null;
   const next=type?(latest.mountain?applyMountain(latest,{type},now):applyAction(latest,{type},now)):latest;
   if(next!==latest)await tx.put('room',next);
   await this.schedule(next,tx);
   return next!==latest?next:null;
  });
  if(updated)this.broadcast(updated);
 }
 async webSocketClose(ws){
  if(ws.deserializeAttachment()?.role!=='player')return;
  const s=await this.ctx.storage.get('room');
  if(!s||s.expires<=Date.now())return;
  const wheel=s.roulette;
  if(wheel?.stopAt===null&&wheel.mode==='vote'&&!this.rouletteParticipants(s).some(person=>person.id===ws.deserializeAttachment().team)){
   await this.updateRoulette({type:'vote-presence',id:wheel.id},{role:'server'},Date.now());
   return;
  }
  if(wheel?.stopAt===null&&wheel.player?.id===ws.deserializeAttachment().team&&!this.rouletteParticipants(s).some(person=>person.id===wheel.player.id)){
   await this.updateRoulette({type:'roulette-stop',id:wheel.id},{role:'server'},Date.now());
  }
  if(!s.settings?.bingo&&!['lobby','finished'].includes(s.phase))return;
  for(const host of this.ctx.getWebSockets()){
   const identity=host.deserializeAttachment();
   if(identity?.role==='host')this.sendState(host,s,identity);
  }
 }
 webSocketError(ws){ws.close(1011,'Connexion interrompue');}
}
