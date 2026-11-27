import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const args=process.argv.slice(2);
const portIndex=args.indexOf('--port');
const port=portIndex<0 ? process.env.PORT||'3000' : args[portIndex+1];
if((args.length!==0&&(args.length!==2||portIndex<0))||
   !/^[0-9]+$/.test(port||'')||Number(port)<1||Number(port)>65535){
 throw Error('Usage : node dev.mjs [--port 3000]');
}

const require=createRequire(import.meta.url);
const wrangler=join(dirname(require.resolve('wrangler/package.json')),'bin/wrangler.js');
const cwd=fileURLToPath(new URL('.',import.meta.url));
await import('./build.mjs');

const server=spawn(process.execPath,[wrangler,'dev','--local','--ip','0.0.0.0',
 '--port',port,'--persist-to','.wrangler/state','--var','DECLIC_LOCAL:true',
 '--show-interactive-dev-session=false'],{
 cwd,stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false'}
});
for(const signal of ['SIGTERM','SIGINT']){
 process.once(signal,()=>server.kill(signal));
}
server.once('exit',(code,signal)=>{
 process.exitCode=code??(signal==='SIGINT'||signal==='SIGTERM'?0:1);
});
