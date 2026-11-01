import {QUESTION_BANKS,QUIZ_CATEGORIES} from './question-bank.js';
export {QUESTION_BANKS,QUIZ_CATEGORIES};
const fold=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function quizCatalogue({category='',query=''}={}){const term=fold(query.trim());return QUESTION_BANKS.filter(b=>(!category||b.category===category)&&fold(b.title+' '+QUIZ_CATEGORIES.find(c=>c.id===b.category)?.title).includes(term)).sort((a,b)=>a.title.localeCompare(b.title,'fr'));}
export const QUESTION_COUNT=QUESTION_BANKS.reduce((n,b)=>n+b.count,0);
export const quizThemes=universe=>QUESTION_BANKS.filter(b=>!universe||b.universe===universe);
const packs=new Map(),pending=new Map();
export function categoryQuizSettings(id){const category=QUIZ_CATEGORIES.find(c=>c.id===id);if(!category)return undefined;return {source:'bank',quizScope:'category',quizCategory:id,quizThemes:[],quizLevel:'all',universe:id==='music'?'music':id==='cinema'?'film':'quiz',challenge:'title',effect:'normal'};}
const selected=config=>config.quizScope==='category'?QUESTION_BANKS.filter(b=>b.category===config.quizCategory):quizThemes(config.universe).filter(b=>(config.quizThemes||[]).includes(b.id));
export const quizAvailableCount=config=>selected(config).reduce((n,b)=>n+(!config.quizLevel||config.quizLevel==='all'?b.count:b.levels[config.quizLevel]||0),0);
export async function loadQuizThemes(config,fetcher=fetch){
 await Promise.all(selected(config).map(async bank=>{
  if(packs.has(bank.id))return;
  if(pending.has(bank.id))return pending.get(bank.id);
  const request=(async()=>{
   const response=await fetcher(bank.url);if(!response.ok)throw Error('Impossible de charger le thème « '+bank.title+' ». Réessayez.');
   const data=await response.json(),rows=data.questions;
   if(data.id!==bank.id||!Array.isArray(rows)||rows.length!==bank.count||new Set(rows.map(q=>q.id)).size!==rows.length||rows.some(q=>q.theme!==bank.id||q.universe!==bank.universe||typeof q.prompt!=='string'||typeof q.answer!=='string'||!Array.isArray(q.options)||q.options.length!==4||new Set(q.options).size!==4||!q.options.includes(q.answer)))throw Error('Le thème « '+bank.title+' » a changé. Actualisez la page puis réessayez.');
   packs.set(bank.id,rows);
  })();pending.set(bank.id,request);try{await request;}finally{pending.delete(bank.id);}
 }));
}
const shuffle=items=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
export function quizPool(config){return selected(config).flatMap(b=>packs.get(b.id)||[]).filter(q=>!config.quizLevel||config.quizLevel==='all'||q.level===config.quizLevel);}
export function quizQuestions(config){const pool=quizPool(config),limit=Math.max(1,Math.min(100,Number(config.count)||10));let result;
 if(config.quizScope==='category'){const byTheme=new Map();for(const q of pool){if(!byTheme.has(q.theme))byTheme.set(q.theme,[]);byTheme.get(q.theme).push(q);}const groups=shuffle([...byTheme.values()]).map(shuffle);result=[];while(result.length<limit&&groups.some(g=>g.length))for(const group of groups){if(group.length&&result.length<limit)result.push(group.pop());}}
 else result=shuffle(pool).slice(0,limit);
 return result.map(q=>({...q,options:shuffle(q.options),credit:{...q.credit}}));
}
