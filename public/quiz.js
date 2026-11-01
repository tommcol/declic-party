import {QUESTION_BANKS} from './question-bank.js';
export {QUESTION_BANKS};
export const QUESTION_COUNT=QUESTION_BANKS.reduce((n,b)=>n+b.questions.length,0);
export const quizThemes=universe=>QUESTION_BANKS.filter(b=>!universe||b.universe===universe);
const shuffle=items=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
export function quizPool(config){const ids=Array.isArray(config.quizThemes)?config.quizThemes:[];return quizThemes(config.universe).filter(b=>ids.includes(b.id)).flatMap(b=>b.questions).filter(q=>!config.quizLevel||config.quizLevel==='all'||q.level===config.quizLevel);}
export function quizQuestions(config){return shuffle(quizPool(config)).slice(0,Math.max(1,Math.min(100,Number(config.count)||10))).map(q=>({...q,options:shuffle(q.options),credit:{...q.credit}}));}
