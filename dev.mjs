import {fileURLToPath} from 'node:url';
import {buildLocal} from './build.mjs';
import {createLocalServer} from './local/server.mjs';

const args=process.argv.slice(2);
const portIndex=args.indexOf('--port');
const port=portIndex<0 ? process.env.PORT||'3000' : args[portIndex+1];
if((args.length!==0&&(args.length!==2||portIndex<0))||
   !/^[0-9]+$/.test(port||'')||Number(port)<1||Number(port)>65535){
 throw Error('Usage : node dev.mjs [--port 3000]');
}

await buildLocal();
const {default:worker,PartyRoom,MusicLibrary}=await import('./dist/local-worker.mjs');
const directory=process.env.DECLIC_DATA_DIR||fileURLToPath(new URL('.declic-local/',import.meta.url));
const {server,close}=createLocalServer({worker,PartyRoom,MusicLibrary},directory);
server.listen(Number(port),'0.0.0.0',()=>console.log('Déclic Party — serveur local sur http://0.0.0.0:'+port));
server.on('error',async error=>{
 console.error(error.message);
 process.exitCode=1;
 await close();
});
let stopping=false;
for(const signal of ['SIGTERM','SIGINT']){
 process.on(signal,async()=>{
  if(stopping)return;
  stopping=true;
  await close();
 });
}
