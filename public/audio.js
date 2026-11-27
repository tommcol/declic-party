export class SoundDesk {
 constructor(){this.ctx=null;this.source=null;this.buffer=null;this.offset=0;this.started=0;this.rate=1;this.muted=false;this.master=.75;this.id=null;this.generation=0;}
 async unlock(){if(!this.ctx)this.ctx=new AudioContext();if(this.ctx.state==='suspended')await this.ctx.resume();}
 async load(q,blob,effect){const generation=++this.generation;await this.unlock();this.stop();this.id=q.id;this.offset=0;this.rate=effect==='fast'?1.35:effect==='slow'?.7:effect==='chipmunk'?1.8:1;
  if(q.audioUrl){if(!/^\/api\/music\/preview\/\d{1,20}$/.test(q.audioUrl))throw Error('Source audio invalide');const response=await fetch(q.audioUrl,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Cet extrait ne peut pas être chargé. Choisissez un autre titre.');const reader=response.body.getReader(),chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024){await reader.cancel();throw Error('Extrait trop volumineux');}chunks.push(value);}const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}const decoded=await this.ctx.decodeAudioData(bytes.buffer);if(generation!==this.generation)return;this.buffer=decoded;}
  else if(blob){const decoded=await this.ctx.decodeAudioData(await blob.arrayBuffer());if(generation!==this.generation)return;this.buffer=decoded;}
  else if(q.notes){const sr=this.ctx.sampleRate,duration=q.notes.reduce((a,n)=>a+n[1],0)+.3;const b=this.ctx.createBuffer(1,Math.ceil(sr*duration),sr),d=b.getChannelData(0);let at=0;for(const [note,len] of q.notes){const hz=440*2**((note-69)/12);for(let i=0;i<len*sr;i++){const t=i/sr,e=Math.min(1,t/.012)*Math.exp(-t*3)*Math.min(1,(len-t)/.04);d[Math.floor(at*sr)+i]=Math.sin(2*Math.PI*hz*t)*e*.5+Math.sin(4*Math.PI*hz*t)*e*.1;}at+=len;}this.buffer=b;}
  else{this.buffer=null;return;}
  if(effect==='reverse'){const b=this.ctx.createBuffer(this.buffer.numberOfChannels,this.buffer.length,this.buffer.sampleRate);for(let c=0;c<b.numberOfChannels;c++)b.copyToChannel(this.buffer.getChannelData(c).slice().reverse(),c);this.buffer=b;}
 }
 play(limit=Infinity){if(!this.buffer||this.source||limit<=0)return;const s=this.ctx.createBufferSource(),g=this.ctx.createGain();s.buffer=this.buffer;s.loop=true;s.playbackRate.value=this.rate;g.gain.value=this.master;s.connect(g);g.connect(this.ctx.destination);s.start(0,this.offset%this.buffer.duration);if(Number.isFinite(limit))s.stop(this.ctx.currentTime+limit);this.started=this.ctx.currentTime;this.source=s;}
 pause(){if(this.source){this.offset+=(this.ctx.currentTime-this.started)*this.rate;this.source.stop();this.source.disconnect();this.source=null;}}
 stop(){this.pause();this.offset=0;}
 jingle(type){
  if(this.muted||!this.ctx)return;
  const cues={
   start:[[48,0,.17],[60,.09,.18],[67,.2,.28]],
   tick:[[76,0,.09]],
   buzz:[[43,0,.11],[55,.035,.18]],
   correct:[[67,0,.13],[72,.07,.18],[76,.14,.22],[84,.23,.36]],
   wrong:[[55,0,.14],[49,.11,.22]],
   reveal:[[67,0,.14],[74,.085,.24]],
   podium:[[48,0,.32],[60,0,.23],[67,.13,.28],[72,.28,.5],[76,.28,.46],[84,.45,.58]]
  };
  for(const [note,delay,length] of cues[type]||[]){
   const oscillator=this.ctx.createOscillator(),gain=this.ctx.createGain();
   const at=this.ctx.currentTime+delay;
   oscillator.type=['wrong','buzz','start'].includes(type)?'triangle':'sine';
   oscillator.frequency.value=440*2**((note-69)/12);
   gain.gain.setValueAtTime(.0001,at);
   gain.gain.exponentialRampToValueAtTime(type==='podium'?.085:.12,at+.012);
   gain.gain.exponentialRampToValueAtTime(.0001,at+length);
   oscillator.connect(gain);
   gain.connect(this.ctx.destination);
   oscillator.start(at);
   oscillator.stop(at+length);
  }
 }
}
export const mediaDB=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('declic-media',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
export async function storeBlob(id,blob){const db=await mediaDB();await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(blob,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}
export async function getBlob(id){const db=await mediaDB();return new Promise((resolve,reject)=>{const tx=db.transaction('files');const r=tx.objectStore('files').get(id);r.onsuccess=()=>{db.close();resolve(r.result);};r.onerror=()=>{db.close();reject(r.error);};});}
