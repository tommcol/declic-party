import {playShowCue} from './show.js';

function lobbyInstrumental(context) {
 const beats=[48,55,59,64,45,52,55,60,50,57,60,65,43,50,53,59];
 const beat=.55;
 const sampleRate=context.sampleRate;
 const buffer=context.createBuffer(1,Math.round(beats.length*beat*sampleRate),sampleRate);
 const samples=buffer.getChannelData(0);
 beats.forEach((note,index)=>{
  const frequency=440*2**((note-69)/12);
  const start=Math.round(index*beat*sampleRate);
  const duration=Math.round(beat*sampleRate);
  for(let offset=0;offset<duration&&start+offset<samples.length;offset++){
   const seconds=offset/sampleRate;
   const angle=2*Math.PI*frequency*seconds;
   const envelope=Math.min(1,seconds/.045,(beat-seconds)/.08)*Math.exp(-3*seconds);
   samples[start+offset]=envelope*(.7*Math.sin(angle)+.2*Math.sin(2*angle)+.06*Math.sin(4*angle));
  }
 });
 return buffer;
}

export class SoundDesk {
 constructor(){this.ctx=null;this.source=null;this.buffer=null;this.offset=0;this.started=0;this.rate=1;this.muted=false;this.master=.75;this.ambience=.5;this.effects=.7;this.id=null;this.generation=0;}
 async unlock(){if(!this.ctx)this.ctx=new AudioContext();if(this.ctx.state==='suspended')await this.ctx.resume();}
 setLevel(channel,value){
  if(!Number.isFinite(value))return;
  const level=Math.max(0,Math.min(1,value));
  if(channel==='excerpt'){
   this.master=level;
   if(this.excerptGain)this.excerptGain.gain.value=level;
  }else if(channel==='ambience'){
   this.ambience=level;
   const gain=this.lobbyVoice?.gain.gain;
   if(gain){gain.cancelScheduledValues(this.ctx.currentTime);gain.value=level*.14;}
  }else if(channel==='effects'){
   this.effects=level;
   if(this.effectGain)this.effectGain.gain.value=level;
  }
 }
 setLobbyAmbience(active){
  if(!active){
   if(!this.lobbyVoice)return;
   const {source,gain}=this.lobbyVoice;
   const now=this.ctx.currentTime;
   gain.gain.cancelAndHoldAtTime(now);
   gain.gain.linearRampToValueAtTime(0,now+.12);
   source.stop(now+.12);
   this.lobbyVoice=null;
   return;
  }
  if(this.ctx?.state!=='running'||this.lobbyVoice)return;
  const source=this.ctx.createBufferSource();
  const gain=this.ctx.createGain();
  source.buffer=this.lobbyBuffer??=lobbyInstrumental(this.ctx);
  source.loop=true;
  gain.gain.setValueAtTime(0,this.ctx.currentTime);
  gain.gain.linearRampToValueAtTime(this.ambience*.14,this.ctx.currentTime+.35);
  source.connect(gain);
  gain.connect(this.ctx.destination);
  source.onended=()=>{source.disconnect();gain.disconnect();};
  source.start();
  this.lobbyVoice={source,gain};
 }
 async load(q,blob,effect){const generation=++this.generation;await this.unlock();if(generation!==this.generation)return;this.stop();this.buffer=null;this.id=q.id;this.offset=0;this.rate=effect==='fast'?1.35:effect==='slow'?.7:effect==='chipmunk'?1.8:1;
  if(q.audioUrl){if(!/^\/api\/music\/preview\/\d{1,20}$/.test(q.audioUrl))throw Error('Source audio invalide');const response=await fetch(q.audioUrl,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Cet extrait ne peut pas être chargé. Choisissez un autre titre.');const reader=response.body.getReader(),chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024){await reader.cancel();throw Error('Extrait trop volumineux');}chunks.push(value);}const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}const decoded=await this.ctx.decodeAudioData(bytes.buffer);if(generation!==this.generation)return;this.buffer=decoded;}
  else if(blob){const decoded=await this.ctx.decodeAudioData(await blob.arrayBuffer());if(generation!==this.generation)return;this.buffer=decoded;}
  else if(q.notes){const sr=this.ctx.sampleRate,duration=q.notes.reduce((a,n)=>a+n[1],0)+.3;const b=this.ctx.createBuffer(1,Math.ceil(sr*duration),sr),d=b.getChannelData(0);let at=0;for(const [note,len] of q.notes){const hz=440*2**((note-69)/12);for(let i=0;i<len*sr;i++){const t=i/sr,e=Math.min(1,t/.012)*Math.exp(-t*3)*Math.min(1,(len-t)/.04);d[Math.floor(at*sr)+i]=Math.sin(2*Math.PI*hz*t)*e*.5+Math.sin(4*Math.PI*hz*t)*e*.1;}at+=len;}this.buffer=b;}
  else{this.buffer=null;return;}
  if(effect==='reverse'){const b=this.ctx.createBuffer(this.buffer.numberOfChannels,this.buffer.length,this.buffer.sampleRate);for(let c=0;c<b.numberOfChannels;c++)b.copyToChannel(this.buffer.getChannelData(c).slice().reverse(),c);this.buffer=b;}
 }
 play(limit=Infinity){if(!this.buffer||this.source||limit<=0)return;this.setLobbyAmbience(false);const s=this.ctx.createBufferSource(),g=this.ctx.createGain();s.buffer=this.buffer;s.loop=true;s.playbackRate.value=this.rate;g.gain.value=this.master;s.connect(g);g.connect(this.ctx.destination);s.start(0,this.offset%this.buffer.duration);if(Number.isFinite(limit))s.stop(this.ctx.currentTime+limit);this.started=this.ctx.currentTime;this.source=s;this.excerptGain=g;}
 pause(){if(this.source){this.offset+=(this.ctx.currentTime-this.started)*this.rate;this.source.stop();this.source.disconnect();this.excerptGain?.disconnect?.();this.source=null;this.excerptGain=null;}}
 stop(){this.pause();this.offset=0;}
 jingle(type,{preview=false}={}){
  if((this.muted&&!preview)||!this.ctx)return;
  if(!this.effectGain){
   this.effectGain=this.ctx.createGain();
   this.effectGain.gain.value=this.effects;
   this.effectGain.connect(this.ctx.destination);
  }
  playShowCue(this.ctx,type,this.effectGain);
 }
}
export const mediaDB=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('declic-media',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
export async function storeBlob(id,blob){const db=await mediaDB();await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(blob,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}
export async function getBlob(id){const db=await mediaDB();return new Promise((resolve,reject)=>{const tx=db.transaction('files');const r=tx.objectStore('files').get(id);r.onsuccess=()=>{db.close();resolve(r.result);};r.onerror=()=>{db.close();reject(r.error);};});}
