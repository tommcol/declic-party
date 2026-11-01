import {readdir,readFile,writeFile} from 'node:fs/promises';
const folder=new URL('../data/openquizzdb/',import.meta.url);
const banks=await Promise.all((await readdir(folder)).filter(f=>f.endsWith('.json')).sort().map(async f=>JSON.parse(await readFile(new URL(f,folder),'utf8'))));
await writeFile(new URL('../public/question-bank.js',import.meta.url),'// Adapted French questions: OpenQuizzDB, CC BY-SA 4.0. See data/openquizzdb/NOTICE.md.\nexport const QUESTION_BANKS = '+JSON.stringify(banks)+';\n');
console.log(`${banks.reduce((n,b)=>n+b.questions.length,0)} questions, ${banks.length} themes.`);
