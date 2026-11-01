import { DurableObject } from 'cloudflare:workers';
import {createGame,applyAction,publicGame,normalizeQuizCredit} from '../public/engine.js';
import {musicRoute} from './catalog.js';
import {ASSETS} from './assets.generated.js';
async function boundedText(req,max){const reader=req.body?.getReader();if(!reader)return '';const chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw Error('Partie trop volumineuse');}chunks.push(value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.byteLength;}return new TextDecoder().decode(bytes);}
const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export default {
 async fetch(req,env){
  try{
   const url=new URL(req.url);
   if(req.method==='GET'&&url.pathname.startsWith('/api/music/'))return musicRoute(req);
   if(url.pathname==='/api/health')return json({ok:true,version:'0.5.1'});
   if(req.method==='POST'&&url.pathname==='/api/rooms'){
    if(req.headers.get('Origin')!==url.origin)return json({error:'Origine refusée'},403);
    if(Number(req.headers.get('Content-Length'))>150000)return json({error:'Partie trop volumineuse'},413);
    const text=await boundedText(req,150000);if(text.length>150000)return json({error:'Partie trop volumineuse'},413);
    const data=JSON.parse(text);
    if(!Array.isArray(data.questions)||data.questions.length<1||data.questions.length>100)return json({error:'Choisissez entre 1 et 100 questions.'},400);
    for(const q of data.questions){if(typeof q.answer!=='string'||!q.answer.trim()||q.answer.length>180||typeof q.prompt!=='string'||q.prompt.length>300||!Array.isArray(q.options)||q.options.length>4||q.options.some(o=>typeof o!=='string'||o.length>180)||!q.options.includes(q.answer)||!Number.isFinite(q.duration)||q.duration<5||q.duration>90||!Number.isFinite(q.points)||q.points<1||q.points>1000)return json({error:'Question invalide : vérifiez les réponses, les points et la durée.'},400);}
    if(data.questions.some(q=>q.kind==='lyrics'&&(!Number.isFinite(q.cutAt)||q.cutAt<.1||q.cutAt>30||q.cutAt>=q.duration)))return json({error:'Choisissez une coupure entre 0,1 et 30 secondes, avant la fin de la manche.'},400);
    const allowedTargets=['both','title','artist','cover','artistTitle'];
    data.questions=data.questions.map(q=>({id:String(q.id).slice(0,80),universe:['film','quiz'].includes(q.universe)?q.universe:'music',cutAt:q.kind==='lyrics'?q.cutAt:undefined,kind:['audio','image','question','lyrics'].includes(q.kind)?q.kind:'question',prompt:q.prompt,answer:q.answer,explanation:typeof q.explanation==='string'?q.explanation.slice(0,1500):undefined,theme:typeof q.theme==='string'?q.theme.slice(0,80):undefined,credit:normalizeQuizCredit(q.credit),aliases:(Array.isArray(q.aliases)?q.aliases:[]).filter(v=>typeof v==='string').slice(0,15).map(v=>v.slice(0,180)),options:q.options,duration:q.duration,points:q.points,title:typeof q.title==='string'?q.title.slice(0,180):undefined,artist:typeof q.artist==='string'?q.artist.slice(0,180):undefined,titleAliases:(Array.isArray(q.titleAliases)?q.titleAliases:[]).filter(v=>typeof v==='string').slice(0,10).map(v=>v.slice(0,180)),artistAliases:(Array.isArray(q.artistAliases)?q.artistAliases:[]).filter(v=>typeof v==='string').slice(0,10).map(v=>v.slice(0,180)),target:allowedTargets.includes(q.target)?q.target:'title',emoji:typeof q.emoji==='string'?q.emoji.slice(0,80):undefined,artwork:typeof q.artwork==='string'&&/^https:\/\/[^/]+\.dzcdn\.net\//.test(q.artwork)?q.artwork:undefined,link:typeof q.link==='string'&&/^https:\/\/www\.deezer\.com\//.test(q.link)?q.link:undefined,provider:q.provider==='Deezer'?'Deezer':undefined}));
    const code=Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');
    const token=crypto.randomUUID();
    const result=await env.ROOMS.getByName(code).initialize({questions:data.questions,input:['text','buzzer'].includes(data.input)?data.input:'qcm',hostHash:await digest(token),code,settings:data.settings&&typeof data.settings==='object'?data.settings:{},effect:['normal','fast','slow','chipmunk','reverse','image'].includes(data.effect)?data.effect:'normal'});
    return result?json({code,token}):json({error:'Veuillez réessayer.'},409);
   }
   const m=url.pathname.match(/^\/api\/rooms\/([A-Z2-9]{8})$/);
   if(m){if(req.headers.get('Upgrade')!=='websocket')return json({error:'Connexion WebSocket attendue'},426);if(req.headers.get('Origin')!==url.origin)return json({error:'Origine refusée'},403);return env.ROOMS.getByName(m[1]).fetch(req);}
   if(req.method!=='GET'&&req.method!=='HEAD')return new Response('Méthode non autorisée',{status:405});
   const path=['/','/join','/tv'].includes(url.pathname)?'/index.html':url.pathname;
   const asset=ASSETS[path];if(!asset)return new Response('Introuvable',{status:404});
   return new Response(req.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://*.dzcdn.net https://*.deezer.com; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"}});
  }catch(e){console.error(JSON.stringify({event:'request_error',message:e.message}));return json({error:'Impossible de traiter cette demande.'},500);}
 }
};
export class PartyRoom extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));}
 async initialize(data){if(await this.ctx.storage.get('room'))return false;await this.ctx.storage.put('room',{...createGame(data.questions,[],'phone',data.input,data.settings),effect:data.effect,hostHash:data.hostHash,code:data.code,expires:Date.now()+86400000});await this.ctx.storage.setAlarm(Date.now()+86400000);return true;}
 async fetch(){const room=await this.ctx.storage.get('room');if(!room||room.expires<Date.now())return json({error:'Cette partie est introuvable ou a expiré.'},404);if(this.ctx.getWebSockets().length>=100)return json({error:'Salon complet'},429);const [client,server]=Object.values(new WebSocketPair());this.ctx.acceptWebSocket(server);server.serializeAttachment({role:'guest',last:0,count:0});return new Response(null,{status:101,webSocket:client});}
 send(ws,data){try{ws.send(JSON.stringify(data));}catch{}}
 broadcast(s){for(const ws of this.ctx.getWebSockets()){const a=ws.deserializeAttachment();if(a?.role==='host')this.send(ws,{type:'state',state:{...s,hostHash:undefined}});else if(a?.role==='player'||a?.role==='tv')this.send(ws,{type:'state',state:publicGame(s,a?.role==='player'?a.team:undefined)});}}
 async webSocketMessage(ws,msg){
  try{
   if(typeof msg!=='string'||msg.length>20000)throw Error('Message invalide');
   const a=ws.deserializeAttachment()||{role:'guest',last:0,count:0};const now=Date.now();a.count=now-a.last<1000?a.count+1:1;a.last=now;ws.serializeAttachment(a);if(a.count>12)throw Error('Trop de demandes');
   const m=JSON.parse(msg);let s=await this.ctx.storage.get('room');if(!s||s.expires<now)throw Error('Partie expirée');
   if(m.type==='host'){if(typeof m.token!=='string'||await digest(m.token)!==s.hostHash)throw Error('Accès animateur refusé');a.role='host';ws.serializeAttachment(a);this.send(ws,{type:'state',state:{...s,hostHash:undefined}});return;}
   if(m.type==='tv'){a.role='tv';ws.serializeAttachment(a);this.send(ws,{type:'state',state:publicGame(s,a?.role==='player'?a.team:undefined)});return;}
   if(m.type==='join'){
    if(a.role==='player'){this.send(ws,{type:'state',state:publicGame(s,a?.role==='player'?a.team:undefined)});return;}
    let t=typeof m.token==='string'?s.teams.find(t=>t.token===m.token):null;
    if(!t){if(s.phase!=='lobby')throw Error('La partie a commencé. Rejoignez la prochaine !');if(s.teams.length>=50)throw Error('50 équipes maximum');const name=String(m.name||'').trim().slice(0,24);if(!name)throw Error('Entrez un nom d’équipe');if(s.teams.some(t=>t.name.toLowerCase()===name.toLowerCase()))throw Error('Ce nom est déjà utilisé');t={id:crypto.randomUUID(),name,score:0,key:'',token:crypto.randomUUID()};s.teams.push(t);await this.ctx.storage.put('room',s);}
    a.role='player';a.team=t.id;ws.serializeAttachment(a);this.send(ws,{type:'session',id:t.id,token:t.token});this.broadcast(s);return;
   }
   if(m.type==='buzz'&&a.role==='player'&&s.input==='buzzer'){if(m.questionId!==s.questions[s.index]?.id)throw Error('Cette question est terminée');s=applyAction(s,{type:'buzz',team:a.team},now);}
   else if(m.type==='answer'&&a.role==='player'&&s.input!=='buzzer'){if(m.questionId!==s.questions[s.index]?.id)throw Error('Cette question est terminée');s=applyAction(s,{type:'answer',team:a.team,answer:m.answer,title:m.title,artist:m.artist},now);this.send(ws,{type:'received',accepted:!!s.answers[a.team]});}
   else if(a.role==='host'&&['play','pause','resume','reveal','next','adjust','judge','listen-more'].includes(m.type)){if(m.type==='play'&&!s.teams.length)throw Error('Attendez au moins une équipe');s=applyAction(s,m,now);}
   else throw Error('Action non autorisée');
   await this.ctx.storage.put('room',s);
   await this.ctx.storage.setAlarm(s.phase==='playing'?s.endAt:s.nextAt||s.expires);
   this.broadcast(s);
  }catch(e){this.send(ws,{type:'error',message:e.message});}
 }
 async alarm(){let s=await this.ctx.storage.get('room');if(!s)return;if(s.expires<=Date.now()){for(const ws of this.ctx.getWebSockets())ws.close(1000,'Partie expirée');await this.ctx.storage.deleteAll();return;}if(s.phase==='playing')s=applyAction(s,{type:'timeout'});else if(s.phase==='reveal'&&s.nextAt&&s.nextAt<=Date.now())s=applyAction(s,{type:'next'});await this.ctx.storage.put('room',s);this.broadcast(s);await this.ctx.storage.setAlarm(s.nextAt||s.expires);}
 webSocketError(ws){ws.close(1011,'Connexion interrompue');}
}
