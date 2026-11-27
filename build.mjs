import {pathToFileURL} from 'node:url';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const files=['index.html','style.css','app.js','engine.js','audio.js','catalog.js','qrcode.js','music-library.js','tyrolien-ui.js','roulette.js','teams.js','team-ui.js','show.js','show.css'];
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8'};
const assets={};for(const f of files)assets['/'+f]={body:await readFile(new URL('public/'+f,import.meta.url),'utf8'),type:types[f.split('.').pop()]};
assets['/tyrolien-plateau.webp']={
 body:(await readFile(new URL('public/tyrolien-plateau.webp',import.meta.url))).toString('base64'),
 type:'image/webp',base64:true
};
await writeFile(new URL('src/assets.generated.js',import.meta.url),'export const ASSETS = '+JSON.stringify(assets)+';\n');
// Deployable single-module bundle. No build dependency or secret is needed.
let worker=await readFile(new URL('src/worker.js',import.meta.url),'utf8');
worker=worker.replace("import {createGame,applyAction,publicGame,normalizeQuizCredit,roundStatistics,BINGO_CARD_SIZE} from '../public/engine.js';",'').replace("import {musicRoute,libraryPreviews} from './catalog.js';",'').replace("import {ASSETS} from './assets.generated.js';",'');
worker=worker.replace("import {MusicLibrary,libraryRouteParams} from './library.js';",'').replace('export {MusicLibrary};','');
const librarySeed=(await readFile(new URL('src/library-seed.js',import.meta.url),'utf8')).replaceAll('export ','');
const libraryMaster=(await readFile(new URL('src/library-master.js',import.meta.url),'utf8')).replace(/^export /gm,'');
const library=(await readFile(new URL('src/library.js',import.meta.url),'utf8'))
 .replace(/^import .*;$/gm,'');
worker=worker.replace(/^import .*roulette.js.*$/m,'').replace(/^import .*teams.js.*$/m,'');
worker=worker.replace(/^import .*from '\.\/tyrolien-(room|game).js';$/gm,'');
const tyrolien=(await Promise.all(['public/roulette.js','public/teams.js','public/music-source.js','src/tyrolien.js','src/tyrolien-room.js','src/tyrolien-game.js'].map(
 path=>readFile(new URL(path,import.meta.url),'utf8')
))).map(source=>source.replace(/^import .*;$/gm,'').replace(/^export /gm,'')).join('\n');
const catalog=(await readFile(new URL('src/catalog.js',import.meta.url),'utf8')).replaceAll('export ','');
const engine=(await readFile(new URL('public/engine.js',import.meta.url),'utf8')).split('export const DEMO=')[0].replaceAll('export ','');
await mkdir(new URL('dist/',import.meta.url),{recursive:true});
const bundle='const ASSETS='+JSON.stringify(assets)+';\n'+engine+'\n'+catalog+'\n'+tyrolien+'\n'+librarySeed+'\n'+libraryMaster+'\n'+library+'\n'+worker;
export async function buildLocal(){
 const localBundle=bundle.replace("import { DurableObject } from 'cloudflare:workers';",
  "import { DurableObject, WebSocketRequestResponsePair } from '../local/runtime.mjs';");
 await writeFile(new URL('dist/local-worker.mjs',import.meta.url),localBundle);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 await writeFile(new URL('dist/worker.mjs',import.meta.url),bundle);
 console.log('Built Déclic ! — '+Object.keys(assets).length+' assets, standalone Worker bundle.');
}
