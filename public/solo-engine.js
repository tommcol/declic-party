// A browser-local game: no room, account or host is required.
export function startSolo(questions, now=Date.now()) {
 if(!questions.length)throw Error('Aucune question disponible. Choisissez une autre sélection.');
 return {questions,index:0,phase:'playing',deadline:now+questions[0].duration*1000,score:0,results:[]};
}
export function answerSolo(state, answer, now=Date.now()) {
 if(state.phase!=='playing')return state;
 const q=state.questions[state.index],expired=now>=state.deadline;
 if(!expired&&answer!==null&&!q.options.includes(answer))return state;
 const correct=!expired&&answer===q.answer;
 return {...state,phase:'reveal',score:state.score+(correct?100:0),results:[...state.results,{id:q.id,answer:expired?null:answer,correct}]};
}
export function nextSolo(state, now=Date.now()) {
 if(state.phase!=='reveal')return state;
 const index=state.index+1;
 return index===state.questions.length?{...state,phase:'finished'}:{...state,index,phase:'playing',deadline:now+state.questions[index].duration*1000};
}
