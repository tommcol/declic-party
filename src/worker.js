import {createTyrolien,applyTyrolien,tyrolienView} from './tyrolien-room.js';
import { DurableObject } from 'cloudflare:workers';
import {createGame,applyAction,publicGame,normalizeQuizCredit,roundStatistics,BINGO_CARD_SIZE} from '../public/engine.js';
import {MusicLibrary,libraryRouteParams} from './library.js';
export {MusicLibrary};
import {musicRoute} from './catalog.js';
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
   const params=libraryRouteParams(url);
   return params?json({tracks:await library.candidates(params.playlist,50)}):json({error:'Playlist inconnue.'},400);
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
   if(url.pathname==='/api/health')return json({ok:true,version:'0.7.4'});
   if(req.method==='POST'&&url.pathname==='/api/rooms'){
    if(req.headers.get('Origin')!==url.origin)return json({error:'Origine refusée'},403);
    if(Number(req.headers.get('Content-Length'))>150000)return json({error:'Partie trop volumineuse'},413);
    const text=await boundedText(req,150000);if(text.length>150000)return json({error:'Partie trop volumineuse'},413);
    const data=JSON.parse(text);
    if(!validCode(data?.room)||!hostToken(data.token))return json({error:'Accès animateur refusé.'},403);
    if(data.game==='tyrolien'){
     const status=await env.ROOMS.getByName(data.room).prepareTyrolien(await digest(data.token));
     return status===200?json({code:data.room,token:data.token}):json({error:'Ouvrez une soirée active et terminez le jeu en cours.'},status);
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
      jokers:data.settings.jokers===true,autoNext:data.settings.autoNext===true
     };
    }
    const allowedTargets=['both','title','artist','cover','artistTitle','coverChoice','timeline','coversQuiz','soundtrack'];
    data.questions=data.questions.map(q=>({id:String(q.id).slice(0,80),universe:q.target==='soundtrack'?q.universe:'music',cutAt:q.kind==='lyrics'?q.cutAt:undefined,kind:['audio','image','question','lyrics'].includes(q.kind)?q.kind:'question',prompt:q.prompt,answer:q.answer,explanation:typeof q.explanation==='string'?q.explanation.slice(0,1500):undefined,theme:typeof q.theme==='string'?q.theme.slice(0,80):undefined,credit:normalizeQuizCredit(q.credit),aliases:(Array.isArray(q.aliases)?q.aliases:[]).filter(v=>typeof v==='string').slice(0,15).map(v=>v.slice(0,180)),options:q.options,year:q.target==='timeline'&&Number.isInteger(q.year)?q.year:undefined,timeline:q.target==='timeline'&&Array.isArray(q.timeline)?q.timeline.filter(v=>typeof v==='string').slice(0,3).map(v=>v.slice(0,180)):undefined,optionArtwork:q.target==='coverChoice'?q.optionArtwork:undefined,duration:q.duration,points:q.points,title:typeof q.title==='string'?q.title.slice(0,180):undefined,artist:typeof q.artist==='string'?q.artist.slice(0,180):undefined,titleAliases:(Array.isArray(q.titleAliases)?q.titleAliases:[]).filter(v=>typeof v==='string').slice(0,10).map(v=>v.slice(0,180)),artistAliases:(Array.isArray(q.artistAliases)?q.artistAliases:[]).filter(v=>typeof v==='string').slice(0,10).map(v=>v.slice(0,180)),target:allowedTargets.includes(q.target)?q.target:'title',emoji:typeof q.emoji==='string'?q.emoji.slice(0,80):undefined,artwork:typeof q.artwork==='string'&&/^https:\/\/[^/]+\.dzcdn\.net\//.test(q.artwork)?q.artwork:undefined,link:typeof q.link==='string'&&/^https:\/\/www\.deezer\.com\//.test(q.link)?q.link:undefined,provider:q.provider==='Deezer'?'Deezer':undefined}));
    const setup={questions:data.questions,input:['text','buzzer'].includes(data.input)?data.input:'qcm',settings:data.settings&&typeof data.settings==='object'?data.settings:{},effect:['normal','fast','slow','chipmunk','reverse','image'].includes(data.effect)?data.effect:'normal'};
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
 const attempts=new Map(room.tyrolien?[]:roundStatistics(history,room.teams).map(row=>[row.id,row]));
 for(const team of room.teams){
  const prior=totals[team.id]||{points:0,correct:0,played:0};
  const ty=room.tyrolien?.scores[team.id];
  const stats=attempts.get(team.id);
  const correct=ty?.points??stats?.correct??0;
  const played=room.tyrolien?(ty?.played||0):history.length;
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
 async schedule(room){
  const at=room.tyrolien?room.tyrolien.nextAt:room.phase==='playing'?room.endAt:room.nextAt;
  const alarm=Math.min(at||Infinity,room.expires||Infinity);
  if(Number.isFinite(alarm))await this.ctx.storage.setAlarm(alarm);
  else await this.ctx.storage.deleteAlarm();
 }
 async prepareTyrolien(hostHash){
  const current=await this.ctx.storage.get('room');
  if(!current||current.expires<=Date.now())return 404;
  if(current.hostHash!==hostHash)return 403;
  if(current.tyrolien&&current.phase!=='finished')return 200;
  if(!['lobby','finished'].includes(current.phase))return 409;
  const next={...current,questions:[],phase:'lobby',tyrolien:createTyrolien(),eveningTotals:eveningTotals(current),revision:(current.revision||0)+1};
  await this.ctx.storage.put('room',next);
  await this.schedule(next);
  this.broadcast(next);
  return 200;
 }
 async prepare(data,hostHash){
  const current=await this.ctx.storage.get('room');
  if(!current||current.expires<=Date.now())return 404;
  if(current.hostHash!==hostHash)return 403;
  if(!['lobby','finished'].includes(current.phase))return 409;
  const next={
   ...createGame(data.questions,current.teams,'phone',data.input,data.settings),
   teams:current.teams.map(({id,name,key,token})=>({id,name,key,token,score:0,streak:0})),
   eveningTotals:eveningTotals(current),effect:data.effect,hostHash,code:current.code,expires:current.expires,revision:(current.revision||0)+1
  };
  await this.ctx.storage.put('room',next);
  await this.schedule(next);
  this.broadcast(next);
  return 200;
 }
 async fetch(req){const room=await this.ctx.storage.get('room');if(!room||room.expires<Date.now())return json({error:'Cette partie est introuvable ou a expiré.'},404);if(this.ctx.getWebSockets().length>=CONNECTION_LIMIT)return json({error:'Salon complet'},429);if(this.ctx.upgradeWebSocket)return this.ctx.upgradeWebSocket(req);const [client,server]=Object.values(new WebSocketPair());this.ctx.acceptWebSocket(server);server.serializeAttachment({role:'guest',last:0,count:0});return new Response(null,{status:101,webSocket:client});}
 send(ws,data){try{ws.send(JSON.stringify(data));}catch{}}
 eveningRanking(s){
  const showCurrent=['paused','reveal','finished','result','vote','attack'].includes(s.phase);
  const totals=showCurrent?eveningTotals(s):s.eveningTotals;
  return Object.values(totals||{}).sort((left,right)=>right.points-left.points);
 }
 sendState(ws,s,a,eveningRanking){
  const state=s.tyrolien?tyrolienView(s,a.role,a.team):a.role==='host'
   ?{...s,hostHash:undefined}:publicGame(s,a.role==='player'?a.team:undefined);
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
  const ranking=this.eveningRanking(s);
  for(const ws of this.ctx.getWebSockets()){
   const identity=ws.deserializeAttachment();
   if(identity?.role==='host'||identity?.role==='tv'||
      (identity?.role==='player'&&(!respondingPlayer||identity.team===respondingPlayer))){
    this.sendState(ws,s,identity,ranking);
   }
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
 async webSocketMessage(ws,msg){
  try{
   if(typeof msg!=='string'||msg.length>20000)throw Error('Message invalide');
   const a=ws.deserializeAttachment()||{role:'guest',last:0,count:0};const now=Date.now();a.count=now-a.last<1000?a.count+1:1;a.last=now;ws.serializeAttachment(a);if(a.count>12)throw Error('Trop de demandes');
   const m=JSON.parse(msg);const hash=m.type==='host'&&hostToken(m.token)?await digest(m.token):null;let s=await this.ctx.storage.get('room');if(!s||s.expires<now)throw Error('Partie expirée');
   if(m.type==='host'){if(hash!==s.hostHash)throw Error('Accès animateur refusé');a.role='host';ws.serializeAttachment(a);this.sendState(ws,s,a);return;}
   if(m.type==='tv'){a.role='tv';ws.serializeAttachment(a);this.sendState(ws,s,a);return;}
   if(m.type==='join'){
    if(a.role==='player'){this.sendState(ws,s,a);return;}
    let t=typeof m.token==='string'?s.teams.find(t=>t.token===m.token):null;
    if(!t){if(s.phase!=='lobby')throw Error('La partie a commencé. Rejoignez la prochaine !');if(s.teams.length>=PLAYER_LIMIT)throw Error(PLAYER_LIMIT+' participants maximum');const name=String(m.name||'').trim().slice(0,24);if(!name)throw Error('Entrez un nom d’équipe');if(s.teams.some(t=>t.name.toLowerCase()===name.toLowerCase()))throw Error('Ce nom est déjà utilisé');t={id:crypto.randomUUID(),name,score:0,key:'',token:crypto.randomUUID()};s.teams.push(t);await this.ctx.storage.put('room',s);}
    a.role='player';a.team=t.id;ws.serializeAttachment(a);
    this.send(ws,{type:'session',id:t.id,token:t.token});
    this.broadcast(s,s.settings?.bingo||m.token&&t.token===m.token?t.id:undefined);
    return;
   }
   if(s.tyrolien){
    if(m.type==='ty-tick')throw Error('Action non autorisée');
    s=await this.updateTyrolien(m,a,now);
    this.broadcast(s,m.type==='ty-answer'||m.type==='ty-vote'?a.team:undefined);
    return;
   }
   const previous=s;
   if(m.type==='buzz'&&a.role==='player'&&s.input==='buzzer'){if(m.questionId!==s.questions[s.index]?.id)throw Error('Cette question est terminée');s=applyAction(s,{type:'buzz',team:a.team},now);}
   else if(['chain-bank','chain-vote'].includes(m.type)&&a.role==='player'&&s.settings?.chain){
    if(m.questionId!==s.questions[s.index]?.id)throw Error('Cette manche est terminée.');
    s=applyAction(s,{type:m.type,team:a.team,candidate:m.candidate},now);
   }
   else if(m.type==='bingo-mark'&&a.role==='player'&&s.settings?.bingo){
    if(m.questionId!==`bingo-round-${s.index}`)throw Error('Cet extrait est terminé.');
    s=applyAction(s,{type:m.type,team:a.team,song:m.song},now);
    if(s===previous)this.sendState(ws,s,a);
   }
   else if(m.type==='joker'&&a.role==='player'){
    if(m.questionId!==s.questions[s.index]?.id)throw Error('Cette manche est terminée.');
    s=applyAction(s,{type:'joker',team:a.team},now);
   }
   else if(m.type==='answer'&&a.role==='player'&&s.input!=='buzzer'){if(m.questionId!==s.questions[s.index]?.id)throw Error('Cette question est terminée');s=applyAction(s,{type:'answer',team:a.team,answer:m.answer,title:m.title,artist:m.artist},now);this.send(ws,{type:'received',accepted:!!s.answers[a.team]});}
   else if(a.role==='host'&&['play','pause','resume','reveal','next','adjust','judge','listen-more'].includes(m.type)){if(m.type==='play'&&s.teams.length<(s.settings?.chain?3:s.settings?.survival&&s.input==='qcm'?2:1))throw Error(s.settings?.chain?'Attendez au moins trois participants.':s.settings?.survival?'Attendez au moins deux participants.':'Attendez au moins une équipe.');s=applyAction(s,m,now);}
   else throw Error('Action non autorisée');
   if(s===previous)return;
   await this.ctx.storage.put('room',s);
   if(s.phase!==previous.phase||s.endAt!==previous.endAt||s.nextAt!==previous.nextAt)await this.schedule(s);
   if(m.type==='bingo-mark')this.broadcastBingoAnswer(s,a.team);
   else this.broadcast(s,['answer','joker','chain-vote'].includes(m.type)?a.team:undefined);
  }catch(e){this.send(ws,{type:'error',message:e.message});}
 }
 async updateTyrolien(action,identity,now){
  return this.ctx.storage.transaction(async tx=>{
   const latest=await tx.get('room');
   if(!latest?.tyrolien)throw Error('Le Tyrolien est terminé.');
   applyTyrolien(latest.tyrolien,action,identity,latest.teams,now);
   latest.phase=latest.tyrolien.phase;
   await tx.put('room',latest);
   const alarm=Math.min(latest.tyrolien.nextAt||Infinity,latest.expires||Infinity);
   if(Number.isFinite(alarm))await tx.setAlarm(alarm);
   else await tx.deleteAlarm();
   return latest;
  });
 }
 async alarm(){let s=await this.ctx.storage.get('room');if(!s)return;if(s.expires<=Date.now()){for(const ws of this.ctx.getWebSockets())ws.close(4001,'Partie expirée');await this.ctx.storage.deleteAll();return;}if(s.tyrolien){this.broadcast(await this.updateTyrolien({type:'ty-tick'},{role:'server'},Date.now()));return;}if(s.phase==='playing')s=applyAction(s,{type:'timeout'});else if(s.phase==='reveal'&&s.nextAt&&s.nextAt<=Date.now())s=applyAction(s,{type:'next'});await this.ctx.storage.put('room',s);this.broadcast(s);await this.schedule(s);}
 async webSocketClose(ws){
  if(ws.deserializeAttachment()?.role!=='player')return;
  const s=await this.ctx.storage.get('room');
  if(!s?.settings?.bingo||s.expires<=Date.now())return;
  for(const host of this.ctx.getWebSockets()){
   const identity=host.deserializeAttachment();
   if(identity?.role==='host')this.sendState(host,s,identity);
  }
 }
 webSocketError(ws){ws.close(1011,'Connexion interrompue');}
}
