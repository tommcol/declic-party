import {readdir,readFile,writeFile} from 'node:fs/promises';
const base=new URL('../data/',import.meta.url),banks=[];
for(const folder of ['openquizzdb','qulture','learnclash']){
 for(const f of (await readdir(new URL(folder+'/',base))).filter(f=>f.endsWith('.json')).sort())banks.push(JSON.parse(await readFile(new URL(folder+'/'+f,base),'utf8')));
}
const ids=new Set();
for(const b of banks)for(const q of b.questions){
 if(ids.has(q.id)||q.theme!==b.id||q.universe!==b.universe||!q.credit?.author||!q.credit?.source||!['easy','medium','hard'].includes(q.level)||q.prompt.length>300||!q.answer||q.answer.length>180||q.options.length!==4||new Set(q.options).size!==4||!q.options.includes(q.answer)||q.options.some(o=>!o||o.length>180))throw Error('Invalid question: '+q.id);
 ids.add(q.id);
}
await writeFile(new URL('../public/question-bank.js',import.meta.url),'// Licensed French question selection. See data/SOURCES.md for authors, licences and adaptations.\nexport const QUESTION_BANKS = '+JSON.stringify(banks)+';\n');
console.log(`${ids.size} questions, ${banks.length} themes.`);
