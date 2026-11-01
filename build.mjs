import './scripts/build-question-bank.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const files=['index.html','style.css','app.js','engine.js','audio.js','catalog.js','quiz.js','question-bank.js'];
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8'};
const assets={};for(const f of files)assets['/'+f]={body:await readFile(new URL('public/'+f,import.meta.url),'utf8'),type:types[f.split('.').pop()]};
await writeFile(new URL('src/assets.generated.js',import.meta.url),'export const ASSETS = '+JSON.stringify(assets)+';\n');
// Deployable single-module bundle. No build dependency or secret is needed.
let worker=await readFile(new URL('src/worker.js',import.meta.url),'utf8');
worker=worker.replace("import {createGame,applyAction,publicGame,normalizeQuizCredit} from '../public/engine.js';",'').replace("import {musicRoute} from './catalog.js';",'').replace("import {ASSETS} from './assets.generated.js';",'');
const catalog=(await readFile(new URL('src/catalog.js',import.meta.url),'utf8')).replaceAll('export ','');
const engine=(await readFile(new URL('public/engine.js',import.meta.url),'utf8')).split('export const DEMO=')[0].replaceAll('export ','');
await mkdir(new URL('dist/',import.meta.url),{recursive:true});
await writeFile(new URL('dist/worker.mjs',import.meta.url),'const ASSETS='+JSON.stringify(assets)+';\n'+engine+'\n'+catalog+'\n'+worker);
console.log('Built Déclic ! — '+Object.keys(assets).length+' assets, standalone Worker bundle.');
