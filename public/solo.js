import {QUIZ_CATEGORIES,categoryQuizSettings,prepareQuizQuestions} from './quiz.js';
import {THEMES,musicQuestions} from './catalog.js';
import {SoundDesk} from './audio.js';
import {normalizeQuizCredit} from './engine.js';
import {startSolo,answerSolo,nextSolo} from './solo-engine.js';
const root=document.querySelector('#solo'),desk=new SoundDesk();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=null,busy=false,message='',revision=0,settings={kind:'quiz',category:'all',count:10,theme:'fr',target:'title',effect:'normal'};
function stop(){revision++;desk.generation++;desk.stop();}
function select(name,items,value){return `<select name="${name}">${items.map(([id,label])=>`<option value="${id}" ${String(value)===String(id)?'selected':''}>${esc(label)}</option>`).join('')}</select>`;}
function render(){
 if(!state){root.innerHTML=`<section class="hero"><span class="eyebrow">VOTRE PETITE PAUSE DÉCLIC</span><h1>Un joueur.<br><em>Plein de déclics.</em></h1><p>Choisissez, répondez, découvrez votre score.<br>Sans compte et sans animateur.</p></section><form id="solo-setup" class="qcard solo-setup"><h2>À quoi joue-t-on ?</h2><label>Votre jeu${select('kind',[['quiz','💡 Quiz & culture'],['music','🎧 Blind test musical']],settings.kind)}</label>${settings.kind==='quiz'?`<label>Votre thème${select('category',[['all','🎲 Quiz général · tout mélanger'],...QUIZ_CATEGORIES.map(c=>[c.id,c.emoji+' '+c.title])],settings.category)}</label>`:`<label>Votre ambiance${select('theme',THEMES.map(([id,icon,title])=>[id,icon+' '+title]),settings.theme)}</label><label>À deviner${select('target',[['title','Le titre'],['artist','L’artiste']],settings.target)}</label><label>Une variante ?${select('effect',[['normal','Classique'],['fast','Accéléré'],['slow','Ralenti'],['chipmunk','Voix écureuil'],['reverse','À l’envers']],settings.effect)}</label><p class="help">Extraits Deezer · Internet et son nécessaires. Les titres disponibles peuvent varier.</p>`}<label>Durée de la partie${select('count',[[10,'10 questions'],[20,'20 questions']],settings.count)}</label><p class="help">30 secondes par question · 4 choix · 100 points par bonne réponse.</p>${message?`<p class="catalog-message" role="alert">${esc(message)}</p>`:''}<button class="btn primary full" type="submit" ${busy?'disabled':''}>${busy?'Préparation de votre partie…':'C’est parti ! →'}</button></form>`;return;}
 const q=state.questions[state.index];
 if(state.phase==='finished'){const good=state.results.filter(r=>r.correct).length;root.innerHTML=`<section class="qcard solo-finish"><div class="big-emoji">${good>=state.questions.length*.7?'🏆':'✨'}</div><span class="eyebrow">PARTIE TERMINÉE</span><h1>Bien joué !</h1><p class="solo-score">${state.score} points</p><p>${good} bonnes réponses sur ${state.questions.length}</p><div class="row"><button class="btn primary" data-solo="replay">Rejouer →</button><button class="btn ghost" data-solo="setup">Changer de thème</button></div></section>`;return;}
 const reveal=state.phase==='reveal',result=state.results.at(-1),credit=normalizeQuizCredit(q.credit);
 root.innerHTML=`<div class="row solo-meta"><span class="pill">Question ${state.index+1} / ${state.questions.length}</span><strong>${state.score} points</strong><button class="textbtn right" data-solo="setup">Quitter</button></div><section class="qcard solo-question"><span class="eyebrow">${settings.kind==='music'?'🎧 BLIND TEST':'💡 À VOUS DE JOUER'}</span><h1 tabindex="-1" id="solo-title">${esc(q.prompt)}</h1>${!reveal?'<p class="solo-timer" aria-label="Temps restant"><span id="solo-time">30</span> s</p>':''}<div class="options">${q.options.map((option,i)=>`<button class="option ${reveal&&option===q.answer?'solo-correct':reveal&&option===result.answer?'solo-wrong':''}" data-solo="answer" data-index="${i}" ${reveal?'disabled':''}><span class="letter">${'ABCD'[i]}</span>${esc(option)}${reveal&&option===q.answer?' ✓':''}</button>`).join('')}</div>${reveal?`<div class="solo-feedback" role="status"><h2>${result.correct?'🎉 Bonne réponse ! +100 points':result.answer===null?'⏱ Temps écoulé':'Une nouvelle chose à retenir !'}</h2><p>La bonne réponse : <strong>${esc(q.answer)}</strong>${q.artist?' · '+esc(q.artist):''}</p>${q.explanation?`<p>${esc(q.explanation)}</p>`:''}${credit?`<p class="mini"><a href="${esc(credit.source)}" target="_blank" rel="noopener noreferrer">${esc(credit.publisher)} · ${esc(credit.author)}</a> · <a href="${esc(credit.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(credit.license)}</a> · sélection adaptée</p>`:''}${q.provider?`<p class="mini"><a href="${esc(q.link)}" target="_blank" rel="noopener noreferrer">Extrait fourni par Deezer · écouter le titre ↗</a></p>`:''}<button class="btn primary full" data-solo="next">${state.index+1===state.questions.length?'Voir mon score 🏆':'Question suivante →'}</button></div>`:''}</section>`;
 document.querySelector('#solo-title')?.focus();tick();
}
function tick(){if(state?.phase!=='playing')return;const remaining=Math.max(0,Math.ceil((state.deadline-Date.now())/1000));const el=document.querySelector('#solo-time');if(el)el.textContent=remaining;if(!remaining){state=answerSolo(state,null);stop();render();}}
async function beginQuestion(){
 stop();const current=revision,q=state.questions[state.index];
 // Time starts after the audio has loaded, never while waiting for the network.
 if(q.audioUrl){state={...state,phase:'loading'};root.innerHTML='<div class="empty" role="status">🎧 Préparation de l’extrait…</div>';try{await desk.load(q,null,settings.effect);if(current!==revision)return;state={...state,phase:'playing',deadline:Date.now()+q.duration*1000};desk.play(q.duration);}catch(error){if(current!==revision)return;state=null;message=error.message+' Relancez une partie ou choisissez Quiz & culture.';stop();render();return;}}
 else state={...state,deadline:Date.now()+q.duration*1000};
 render();
}
async function launch(){if(busy)return;busy=true;message='';render();try{
 let questions;
 if(settings.kind==='music'){await desk.unlock();const response=await fetch('/api/music/selection?themes='+encodeURIComponent(settings.theme),{signal:AbortSignal.timeout(30000)}),data=await response.json();if(!response.ok)throw Error(data.error||'Les musiques sont indisponibles pour le moment.');questions=musicQuestions(data.tracks||[],{count:Number(settings.count),challenge:settings.target,explicit:false,difficulty:'balanced',mode:'phone',input:'qcm',duration:30});}
 else questions=await prepareQuizQuestions({...categoryQuizSettings(settings.category),count:Number(settings.count)});
 state=startSolo(questions.map(q=>({...q,duration:30})));await beginQuestion();
 }catch(error){state=null;message=error.message||'Impossible de préparer la partie. Réessayez.';}finally{busy=false;if(!state)render();}}
root.addEventListener('change',e=>{if(!e.target.name)return;settings[e.target.name]=e.target.value;if(e.target.name==='kind')render();});
root.addEventListener('submit',e=>{if(e.target.id!=='solo-setup')return;e.preventDefault();void launch();});
root.addEventListener('click',async e=>{const button=e.target.closest('[data-solo]');if(!button||button.disabled)return;const action=button.dataset.solo;
 if(action==='setup'){stop();state=null;message='';render();return;}
 if(action==='replay'){state=null;await launch();return;}
 if(action==='answer'&&state?.phase==='playing'){state=answerSolo(state,state.questions[state.index].options[Number(button.dataset.index)]);stop();render();return;}
 if(action==='next'&&state?.phase==='reveal'){state=nextSolo(state);if(state.phase==='finished'){stop();render();}else await beginQuestion();}
});
window.addEventListener('pagehide',stop);setInterval(tick,200);render();
