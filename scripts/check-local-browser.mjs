import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
import {buildLocal} from '../build.mjs';
import {createLocalServer} from '../local/server.mjs';
await buildLocal();
const runtime=await import('../dist/local-worker.mjs');
const temp=await mkdtemp(join(tmpdir(),'declic-qa-browser-'));
const app=createLocalServer({worker:runtime.default,PartyRoom:runtime.PartyRoom,MusicLibrary:runtime.MusicLibrary},temp);
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const origin='http://127.0.0.1:'+app.server.address().port;
const profile=join(temp,'chrome');
const browser=spawn(process.env.DECLIC_CHROMIUM||'chromium',['--no-sandbox','--headless','--disable-gpu','--disable-dev-shm-usage','--no-proxy-server','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
const key='a'.repeat(64);
const links=[];
const pauses=[];
const api=async(path,method='GET',data)=>{const r=await fetch(origin+path,{method,headers:{Origin:origin,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});assert.equal(r.status,200,await r.clone().text());return r.json();};
async function until(task,label,timeout=6000){
 const deadline=Date.now()+timeout;
 do{const value=await task();if(value)return value;await wait(60);}while(Date.now()<deadline);
 throw Error(label);
}
async function tab(port,name,width,height,mobile=false){
 const {webSocketDebuggerUrl}=await (await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
 const ws=new WebSocket(webSocketDebuggerUrl);links.push(ws);await once(ws,'open');
 let id=0;const pending=new Map();
 ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.id){const t=pending.get(m.id);pending.delete(m.id);m.error?t.reject(Error(m.error.message)):t.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')pauses.push([name,m.params.exceptionDetails.exception?.description]);});
 function call(method,params={}){return new Promise((resolve,reject)=>{const k=++id;pending.set(k,{resolve,reject});ws.send(JSON.stringify({id:k,method,params}));});}
 async function run(expression){const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description);return result.result.value;}
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
 const go=async path=>{await call('Page.navigate',{url:origin+path});await until(()=>run('document.readyState==="complete"'),'navigation '+name);};
 const has=text=>until(()=>run('document.body?.innerText.includes('+JSON.stringify(text)+')'),name+': '+text);
 const click=async s=>{await until(()=>run('(()=>{const b=document.querySelector('+JSON.stringify(s)+');if(!b||b.disabled)return false;b.click();return true})()'),name+': '+s);};
 return {run,go,has,click,call};
}
try{
 const port=await until(async()=>{try{return(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{return null;}},'Chrome startup');
 const {active:{code,token}}=await api('/api/evening','POST',{expected:null,id:crypto.randomUUID()});
 const [host,tv,mobile,tablet]=await Promise.all([tab(port,'régie',1440,900),tab(port,'TV',1920,1080),tab(port,'smartphone',390,844,true),tab(port,'tablette',768,1024,true)]);
 await host.go('/');await host.run('localStorage.setItem("declic.hostKey",'+JSON.stringify(JSON.stringify(key))+')');await host.go('/');
 await Promise.all([tv.go('/tv?code='+code),mobile.go('/join?code='+code),tablet.go('/join')]);
 await mobile.has('Rejoindre la soirée');await tablet.has('Rejoindre la soirée');
 await mobile.run(`document.querySelector("#join-name").value="Joueur mobile";document.querySelectorAll("[name=avatar]")[4].checked=true;document.querySelector("#join-form").requestSubmit();true`);
 await mobile.has('Vous êtes dans la place');await tv.has('Joueur mobile');
 await tablet.run('document.querySelector("#join-code").value='+JSON.stringify(code)+';document.querySelector("#join-name").value="Joueur tablette";document.querySelector("#join-form").requestSubmit();true');await tablet.has('Vous êtes dans la place');
 await host.click('[data-action=resume-evening]');
 const question={id:'qa-browser',kind:'question',target:'title',universe:'music',prompt:'Reconnaissez ce titre',title:'Titre test',artist:'Artiste test',answer:'Titre test',options:['Titre test','Faux'],points:100,duration:15};
 await api('/api/rooms','POST',{room:code,token,questions:[question],input:'qcm',musicGame:'blind'});
 await host.click('[data-action=play]');
 await tv.has('Reconnaissez ce titre');await mobile.has('Reconnaissez ce titre');
 await mobile.click('[data-action=answer][data-value="Titre test"]');
 await mobile.has('Réponse reçue');
 await host.click('[data-action=reveal]');await tv.has('Artiste test');await mobile.has('Votre choix');
 await host.click('[data-action=desk-tab][data-value=assistant]');await host.has('Assistant local');
 await host.click('[data-action=next]');
 await host.has('Bilan de la partie');
 assert.equal(await tv.run('getComputedStyle(document.querySelector(".podium > div:first-child")).color'),'rgb(255, 244, 219)');
 await host.click('[data-action=assistant-preview]');await host.has('Diffuser à la TV');
 await host.click('[data-action=assistant-air]');await tv.has('Bilan de la partie');
 const frames=[];
 for(const [width,height] of [[1920,1080],[3840,2160]]){
  await tv.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const m=await tv.run('({width:innerWidth,scroll:document.documentElement.scrollWidth,stage:!!document.querySelector(".tv-shell .stage")})');
  assert.equal(m.width,width);assert.ok(m.scroll<=width+2&&m.stage,JSON.stringify(m));
  await tv.call('Page.bringToFront');
  const samples=await tv.run(`new Promise(resolve=>{const deltas=[];let prev;function frame(now){if(prev!=null)deltas.push(now-prev);prev=now;if(deltas.length===60)resolve(deltas);else requestAnimationFrame(frame);} requestAnimationFrame(frame);})`);
  frames.push({width,height,median:samples.sort((a,b)=>a-b)[29],p95:samples[56]});
  if(width===1920&&process.env.DECLIC_QA_SCREENSHOT){const shot=await tv.call('Page.captureScreenshot',{format:'jpeg',quality:73});await writeFile(process.env.DECLIC_QA_SCREENSHOT,Buffer.from(shot.data,'base64'));}

 }
 const layout=await mobile.run('({width:innerWidth,scroll:document.documentElement.scrollWidth})');assert.ok(layout.scroll<=layout.width+2,JSON.stringify(layout));
 await mobile.call('Network.enable');
 await mobile.call('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await mobile.call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await mobile.go('/join?code='+code);await mobile.has('Joueur mobile');
 await api('/api/evening','DELETE',{expected:code});
 await host.click('[data-action=evening-archives]');await host.has('Historique des soirées');
 await host.click('[data-action=archive-open]');await host.has('Jeux et playlists');
 assert.deepEqual(pauses,[]);
 console.log(JSON.stringify({pass:true,chrome:158,devices:['1440x900','390x844','768x1024','1920x1080','3840x2160'],reveal:true,assistant:true,archive:true,frames}));
}finally{for(const ws of links)ws.close();browser.kill('SIGTERM');await app.close();await wait(250);await rm(temp,{recursive:true,force:true});}
