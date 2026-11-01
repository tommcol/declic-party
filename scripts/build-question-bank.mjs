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
const groups=JSON.parse(await readFile(new URL('quiz-categories.json',base),'utf8'));
const memberships=new Map(),groupIds=new Set();
for(const group of groups){if(groupIds.has(group.id)||!group.title||!group.packs.length)throw Error('Invalid category: '+group.id);groupIds.add(group.id);for(const id of group.packs){if(memberships.has(id)||!banks.some(b=>b.id===id))throw Error('Duplicate or unknown category pack: '+id);memberships.set(id,group.id);}}
if(banks.some(b=>!memberships.has(b.id)))throw Error('Every quiz pack needs a category');
const index=banks.map(({questions,...bank})=>({...bank,category:memberships.get(bank.id),count:questions.length,levels:Object.fromEntries(['easy','medium','hard'].map(level=>[level,questions.filter(q=>q.level===level).length])),url:'/quiz-packs/'+bank.id+'.json'}));
const categories=groups.map(({packs,...group})=>({...group,packCount:packs.length,questionCount:index.filter(b=>b.category===group.id).reduce((n,b)=>n+b.count,0)}));
await writeFile(new URL('../public/question-bank.js',import.meta.url),'// Quiz catalogue metadata only. Question packs are loaded on demand. See data/SOURCES.md.\nexport const QUIZ_CATEGORIES = '+JSON.stringify(categories)+';\nexport const QUESTION_BANKS = '+JSON.stringify(index)+';\n');
console.log(`${ids.size} questions, ${banks.length} subthemes, ${categories.length} categories.`);
