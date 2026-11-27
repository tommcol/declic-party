import {tyrolienScreen} from './tyrolien-ui.js';
import {openMusicLibrary} from './music-library.js';
import {THEMES,CHALLENGES,musicQuestions,shuffle,SPECIAL_TRACKS,matchSpecialTrack,specialQuestions} from './catalog.js';
import {randomUUID,createGame,applyAction,publicGame,DEMO,targets,gameSettings,isBuzzer,isProgressive,LISTEN_STEPS,audioRemaining,listeningLimit,roundStatistics,bingoProgress,BINGO_CARD_SIZE} from './engine.js';
import qrcode from './qrcode.js';
import {SoundDesk,storeBlob,getBlob} from './audio.js';
const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const defaultTeams=()=>['Les Disco','Les Rockstars','Les Paillettes','Les Incollables'].map((name,index)=>({id:String(index),name,key:String(index+1)}));
let config=read('declic.config',{universe:'music',mode:'phone',input:'qcm',effect:'normal',source:'demo',teams:defaultTeams()});
let invitationCode=null,invitationSvg='',tyrolienDraft={};
let custom=read('declic.library',[]), view='home', game=null, room=null, ws=null, role='host', teamId=null, connected=false, reconnect=null, auth=null, lastEvent=null, seenCount=null, countdown=-1, lastRevision=-1, assetUrls=new Map(), audioReady=false, soundTask=0, busy=false;
let catalogPool=read('declic.musicPool',{name:'',tracks:[],themeKey:''}),catalogResults={tracks:[],playlists:[]},catalogQuery='',catalogSearchType='tracks',catalogMessage='',audioError='',replyDraft={},audioSegment='';
const MUSIC_GAMES=[
 ['tyrolien','Le Tyrolien','Blind test en équipes, ascension et bonus d’attaque.'],
 ['bingo','Bingo musical','Identifiez les extraits et cochez votre grille de 16 chansons.'],
 ['timeline','Frise musicale','Placez le titre entre les chansons déjà datées.'],
 ['coversQuiz','Les reprises','Reliez la version originale et la reprise.'],
 ['soundtrack','Cinéma musical','Retrouvez le film, la série ou le générique TV.'],
 ['blind','Blind test','Retrouvez le titre ou l’artiste.'],
 ['covers','La bonne pochette','Choisissez la pochette parmi quatre images.'],
 ['survival','Dernier survivant','Restez en jeu en répondant correctement. Deux participants minimum.']
];
const newDefaults={themes:['fr'],count:10,duration:30,difficulty:'balanced',challenge:'title',explicit:false,settings:gameSettings()};
for(const [key,value]of Object.entries(newDefaults))if(config[key]===undefined)config[key]=value;
config.settings=gameSettings(config.settings);if(config.version!==2||config.universe!=='music'||!['catalog','demo','custom'].includes(config.source)){
 Object.assign(config,{version:2,universe:'music',source:'catalog',challenge:'title'});
 write('declic.config',config);
}
const desk=new SoundDesk();
desk.muted=read('declic.muted',false);
let activeEvening=null, eveningStatus='loading', changingEvening=false;
let usbRevision=0, usbSave=null, usbRetry=null, usbQueue=[];
const effects=[['normal','🎧','Classique','L’extrait original','#e6e1ff'],['fast','⏩','Accéléré','Tout va plus vite','#ffe3cd'],['slow','🐢','Ralenti','Prenez votre temps','#e4f3cb'],['chipmunk','🐿️','Voix écureuil','Aiguë et accélérée','#ffe2ef'],['reverse','↶','À l’envers','Les repères s’envolent','#deedff'],['image','▧','Image mystère','Du flou au déclic','#fbe9be']];
const colors=['#e9ddff','#ffdfc9','#e4f1bc','#ffd9e9','#d5ecff','#ffeaa9','#d1f3e7','#e7ddf6','#ffdbd3','#d9e7f8'];
const icons=['🪩','🎸','✨','⚡','🎬','🎤','🚀','🍿','🦄','🏆'];
let channel=new BroadcastChannel('declic-screen');
channel.onmessage=e=>{if(e.data.type==='ended'&&role==='tv'){game=null;render();}if(e.data.type==='request'&&game&&role==='host')broadcastTV();if(e.data.type==='state'&&role==='tv'&&!room){game=e.data.state;receive();}};
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
function celebrate(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const el=$('#confetti');el.innerHTML=Array.from({length:55},(_,i)=>`<i class="confetto" style="left:${Math.random()*100}%;background:${['#e2f889','#ff925b','#ffc6e0','#9f7af3','#79c5ed'][i%5]};animation-delay:${Math.random()*.5}s;animation-duration:${2+Math.random()}s;transform:rotate(${i*27}deg)"></i>`).join('');setTimeout(()=>el.replaceChildren(),4000);}
function saveConfig(){write('declic.config',config);}
function brand(){return '<button class="brand" data-action="home" aria-label="Déclic Party, accueil"><span>ϟ</span>Déclic Party</button>';}
function header(){return `<header class="topbar">${brand()}<nav class="nav" aria-label="Navigation principale"><button class="${['home','setup','studio'].includes(view)?'active':''}" data-action="home">Accueil</button><button class="${view==='catalog'?'active':''}" data-action="v2-catalog">Les musiques</button><button class="${view==='library'?'active':''}" data-action="library">Mes questions</button><button class="${view==='help'?'active':''}" data-action="help">Comment jouer</button></nav></header>`;}
function footer(){return '<footer class="footer"><span>De la musique et des déclics.</span><span>Déclic ! · Le studio de vos soirées · v0.5</span></footer>';}
function savedMusicGame(key){
 const saved=read(key,null);
 return Array.isArray(saved?.questions)&&saved.questions.every(q=>q.universe==='music'||q.target==='soundtrack')?saved:null;
}
function selectedQuestions(){if(config.source==='catalog'&&Object.hasOwn(SPECIAL_TRACKS,config.musicGame))return [];if(config.universe==='music'&&config.challenge==='lyrics')return(config.source==='demo'?DEMO:custom).filter(q=>q.universe===config.universe&&q.kind==='lyrics').slice(0,config.count);if(config.source==='catalog'&&config.universe==='music')return musicQuestions(catalogPool.tracks,config.musicGame==='bingo'?{...config,count:BINGO_CARD_SIZE,challenge:config.challenge==='artist'?'artist':'title',difficulty:'balanced'}:config);return(config.source==='custom'?custom:DEMO).filter(q=>q.universe===config.universe).slice(0,config.count);}
function render(){
 const a=$('#app');
 a.classList.toggle('party-interface',role!=='host'||view!=='home');
 if($('#catalog-player'))desk.stop();
 if(view==='music-library'){
  a.innerHTML=`<div class="shell"><main id="official-music-library"></main></div>`;
  const region=$('#official-music-library');
  region.addEventListener('legacy-music',()=>{view='catalog';render();});
  region.addEventListener('play-library-selection',event=>void prepareLibrarySelection(event.detail));
  openMusicLibrary(region,hostRequest,esc);
  return;
 }
 const form=$('#answer-form');if(form&&currentQ())replyDraft[form.dataset.question||currentQ().id]={...replyDraft[form.dataset.question||currentQ().id],...Object.fromEntries(new FormData(form))};
 if(role==='host'&&view==='home'){a.innerHTML=home();return;}
 if(game?.tyrolien){
  const form=$('#ty-start-form');
  if(form)tyrolienDraft={...tyrolienDraft,...Object.fromEntries(new FormData(form)),bonuses:form.elements.bonuses.checked};
  a.innerHTML=tyrolienScreen(game.tyrolien,role,esc,invitationMarkup(),room,tyrolienDraft)+eveningRanking();
  return;
 }
 if(role==='tv'){a.innerHTML=tvScreen();return;}
 if(view==='join'){a.innerHTML=joinScreen();return;}
 if(role==='player'&&view!=='history'){a.innerHTML=phoneScreen();return;}
 a.innerHTML=`<div class="shell">${header()}${view==='setup'?setupScreen():view==='catalog'?catalogScreen():view==='history'?historyScreen():view==='library'?library():view==='help'?help():view==='settings'?settingsScreen():studio()}${footer()}</div>`;
 if(view==='studio')void prepareImage();
}
function fullHome(){const qs=selectedQuestions();return `<div class="workspace"><main class="maincol"><section class="hero"><span class="eyebrow">LE JEU QUI MET LA SALLE EN MOUVEMENT</span><span class="tag">Prêts pour le déclic ?</span><h1>Les tubes passent.<br><em>À vous de jouer.</em></h1><p>Des jeux pour tous les goûts musicaux.<br>Vos équipes, vos règles, votre soirée.</p><div class="hero-art" aria-hidden="true"><div class="record"></div><span class="note">♫</span><span class="spark">✦</span></div></section><div class="sectiontitle"><h2><span class="step">1</span>Composez votre sélection</h2><small>Jusqu’à 3 ambiances à mélanger</small></div><div class="theme-grid">${THEMES.map(([id,icon,title,sub])=>`<button class="theme-card ${config.themes.includes(id)?'active':''}" data-action="v2-theme" data-value="${id}" aria-pressed="${config.themes.includes(id)}"><span>${icon}</span><strong>${title}</strong><small>${sub}</small>${config.themes.includes(id)?'<b>✓</b>':''}</button>`).join('')}</div><div class="catalog-banner"><div><strong>Vos prochains refrains sont ici.</strong><p>Recherchez un artiste, choisissez des titres ou importez une playlist Deezer.</p></div><button class="btn ghost" data-action="v2-catalog">Explorer les musiques ↗</button></div><div class="sectiontitle"><h2><span class="step">2</span>À vous de deviner…</h2></div><div class="challenge-grid">${[...CHALLENGES,['lyrics','🎙️','La suite des paroles'],...(config.challenge==='coverChoice'?[['coverChoice','💿','La bonne pochette']]:[])].filter(([id])=>id!=='both'||config.mode==='usb'||config.input!=='qcm').map(([id,icon,title])=>`<button class="challenge ${config.challenge===id?'active':''}" data-action="v2-challenge" data-value="${id}" aria-pressed="${config.challenge===id}"><span>${icon}</span>${title}</button>`).join('')}</div>${config.challenge==='lyrics'?'<div class="callout">Préparez votre extrait chanté, la coupure et les mots attendus. <button class="textbtn" data-action="v3-new-lyrics">Préparer une question paroles →</button></div>':''}<div class="sectiontitle"><h2><span class="step">3</span>Un grain de folie</h2><small>Appliqué aux extraits audio ou images</small></div><div class="effect-grid">${effects.map(([id,icon,title,sub,tint])=>`<button class="effect ${config.effect===id?'active':''}" data-action="effect" data-value="${id}" aria-pressed="${config.effect===id}"><span class="icon" style="--tint:${tint}">${icon}</span><strong>${title}</strong><small>${sub}</small></button>`).join('')}</div><div class="bottomstrip"><span>✦ <strong>Une soirée à votre image.</strong> Les questions et fichiers personnels restent disponibles.</span><button class="textbtn" data-action="library">Préparer mes questions ↗</button></div></main>${gameRules(qs)}</div>`;}
function library(){return `<main class="library"><div class="row"><div><span class="eyebrow">LA BOÎTE À IDÉES</span><h1>Vos questions. Votre ambiance.</h1><p class="help">Préparez vos extraits et vos indices. Les fichiers restent dans ce navigateur.</p></div><button class="btn primary right" data-action="new-question">＋ Nouvelle question</button></div><div class="row"><button class="btn ghost" data-action="export">Exporter les questions JSON</button><label class="btn ghost">Importer un JSON<input type="file" id="import-json" accept="application/json" hidden></label></div><div class="cards">${custom.filter(q=>q.universe==='music').map(q=>`<article class="qcard"><span class="badge">MUSIQUE · ${q.kind==='lyrics'?'PAROLES':q.kind==='audio'?'EXTRAIT':q.kind==='image'?'IMAGE':'QUESTION'}</span><div class="emoji" style="margin-top:16px">${q.kind==='audio'?'🎧':q.kind==='image'?'🖼️':'💡'}</div><h3>${esc(q.prompt)}</h3><p>Réponse : <strong>${esc(q.answer)}</strong><br>${q.duration} secondes · ${q.points} points</p><div class="row" style="margin-top:16px"><button class="textbtn" data-action="edit-question" data-value="${esc(q.id)}">Modifier</button><button class="textbtn right" data-action="delete-question" data-value="${esc(q.id)}">Retirer</button></div></article>`).join('')||'<div class="empty wide">La piste est à vous !<br>Ajoutez une première question pour créer votre blind test.</div>'}</div><div class="callout">Les réponses écrites acceptent les accents et la ponctuation indifféremment. Ajoutez des réponses alternatives dans l’éditeur. L’export JSON contient les questions, pas les fichiers audio ou images.</div></main>`;}
function help(){return `<main class="help-page"><span class="eyebrow">LA RECETTE D’UNE BONNE SOIRÉE</span><h1>Moins de réglages. Plus de jeu.</h1><div class="cards"><article class="qcard"><div class="emoji">🎛️</div><h3>1. Préparez</h3><p>Choisissez un jeu musical, un effet et votre sélection. Testez les questions de découverte ou importez vos extraits.</p></article><article class="qcard"><div class="emoji">⚡</div><h3>2. Faites buzzer</h3><p>En USB, l’animateur lance l’extrait. La première touche coupe le son. Bonne réponse : des points ! Mauvaise réponse : l’équipe est bloquée pour cette question et le son reprend.</p></article><article class="qcard"><div class="emoji">🏆</div><h3>3. Célébrez</h3><p>Révélez la réponse, affichez le classement et passez à la suite. La partie se termine par le podium.</p></article></div><div class="qcard" style="margin-top:20px"><h3>Le PC + la TV</h3><p>Cliquez sur « Écran public ». Déplacez cette fenêtre sur la TV et mettez-la en plein écran. Gardez les commandes sur le PC. Le son sort uniquement du PC animateur.</p><h3 style="margin-top:25px">Les buzzers USB</h3><p>Cette ébauche accepte les buzzers qui envoient une touche de clavier. Configurez une touche différente par équipe dans le studio. Les modèles qui se présentent uniquement comme des manettes nécessiteront une prise en charge supplémentaire. Le navigateur doit avoir le focus.</p><h3 style="margin-top:25px">Les téléphones</h3><p>Créez une partie en mode téléphones et partagez le lien ou le code. Choisissez « Buzzer · réponse orale » pour laisser l’animateur valider, ou QCM / écrit pour une correction automatique. La correction est automatique : titre et artiste sont indépendants. La rapidité et les séries peuvent ajouter chacune jusqu’à 50 points. Cinq essais maximum par manche écrite ; une seule réponse en QCM. Les points sont affichés à la révélation. Internet est nécessaire pour ce premier mode connecté.</p><h3 style="margin-top:25px">Vos fichiers et les effets</h3><p>Importez un MP3, WAV ou autre audio compatible avec votre navigateur, ou une image. Les effets accéléré, ralenti, écureuil et envers agissent sur l’audio. L’effet écureuil augmente la vitesse et la hauteur ensemble. L’image mystère révèle progressivement les détails. Pour compléter des paroles, choisissez le défi Paroles dans Mes questions, ajoutez votre extrait chanté et indiquez la coupure en secondes. La lecture originale s’arrête automatiquement au point choisi. Saisissez une phrase avec ___ et les mots attendus. Une démonstration instrumentale est disponible dans Découverte. Les paroles ne sont pas récupérées automatiquement.</p><h3 style="margin-top:25px">Écoute progressive</h3><p>Dans le studio, choisissez Écoute progressive. L’animateur propose 1, 2, 5 puis 10 secondes du même extrait. Les points de réponse passent à 100 %, 80 %, 60 %, puis 40 %. Le bonus de rapidité est désactivé pour ces questions. Chaque palier permet de retenter une réponse ; les points déjà gagnés restent acquis. Les autres types de questions conservent leurs règles normales.</p><h3 style="margin-top:25px">Ce qui arrive plus tard</h3><p>Le catalogue Deezer est connecté : recherche de titres et de playlists, thèmes à mélanger et extraits de 30 secondes maximum. Le QR code, les bandes-annonces vidéo, le réseau local sans Internet et les buzzers de type manette restent à venir.</p><p style="margin-top:20px">Utilisez des contenus que vous êtes autorisé à diffuser. Les parties connectées expirent après 24 heures. Les questions personnelles et les médias restent sur le PC ; seul le texte utile au jeu est partagé dans la partie.</p></div></main>`;}
function currentQ(){return game?.question||game?.questions?.[game.index];}
function sorted(){return [...(game?.teams||[])].sort((a,b)=>Number(!!a.eliminated)-Number(!!b.eliminated)||b.score-a.score);}
function timerMarkup(){return '<div class="timer"><span data-time>—</span><div class="timer-track"><div class="timer-fill" data-progress></div></div></div>';}
const bingoNames=['','Bingo','Double Bingo','Triple Bingo'];
const participantNames=ids=>ids.map(id=>esc(game.teams.find(t=>t.id===id)?.name)).join(' · ');
function bingoAwards(){
 return (game.bingoMilestones||[]).map(goal=>`<p><strong>${bingoNames[goal.rows]}</strong> · ${participantNames(goal.winners)}</p>`).join('');
}
function bingoAnnouncement(){
 const progress=game.bingoProgressions||[];
 if(!progress.length)return '';
 const highest=Math.min(3,Math.max(...progress.map(p=>p.count)));
 const ids=progress.filter(p=>Math.min(3,p.count)===highest&&p.previous<3).map(p=>p.id);
 if(!ids.length)return '';
 const official=game.bingoMilestones?.find(m=>m.rows===highest&&m.index===game.index)?.winners||[];
 return `<div class="bingo-announcement"><strong>${bingoNames[highest]} !</strong><p>${participantNames(ids.slice(0,12))}${ids.length>12?` et ${ids.length-12} autres`:''}</p>${official.length?'<small>Victoire officielle</small>':''}</div>`;
}
function roundRecap(){
 const round=game.history?.at(-1);
 if(!round||game.mode!=='phone'||game.input==='buzzer')return '';
 const answered=round.results.filter(team=>team.result.attempts>0);
 const correct=answered.filter(team=>team.result.correct).sort((a,b)=>a.result.elapsed-b.result.elapsed);
 const fastest=correct[0];

 const lives=game.settings?.survival?Array.from({length:6},(_,count)=>[count,game.teams.filter(t=>t.lives===count).length])
  .filter(([,players])=>players>0).map(([count,players])=>`<span>${count} vie(s) · ${players}</span>`).join(' · '):'';
 return `<div class="round-recap"><p>${correct.length} bonnes · ${answered.length-correct.length} mauvaises · ${game.teams.length-answered.length} sans réponse</p>
  ${fastest&&Number.isFinite(fastest.result.elapsed)?`<p>⚡ ${esc(fastest.name)} · ${(fastest.result.elapsed/1000).toFixed(2)} s</p>`:''}
  ${lives?`<p>${lives}</p>`:''}${game.jokerAwards?`<p>🃏 ${game.jokerAwards} joker(s) débloqué(s)</p>`:''}${game.settings?.bingo?bingoAnnouncement():''}</div>`;
}
function stage(){if(!game)return '<div class="empty">En attente de l’animateur…</div>';const q=currentQ(),phase=game.phase,total=game.total||game.questions?.length||0;
 if(phase==='finished'&&game.settings?.bingo){
  const stats=game.bingoFinal||roundStatistics(game.history,game.teams);
  const recognition=[...stats].sort((a,b)=>b.correct-a.correct||(a.average??Infinity)-(b.average??Infinity));
  const speed=stats.filter(t=>t.correct).sort((a,b)=>a.average-b.average);
  return `<div class="stage-content"><span class="eyebrow">16 EXTRAITS · BINGO MUSICAL</span><h1>Résultats du Bingo</h1>${bingoAwards()}
   <div class="podium">${recognition.slice(0,3).map(t=>`<div><strong>${esc(t.name)}</strong>${t.correct} bonnes réponses</div>`).join('')}</div>
   <p class="help">${speed.length?`Les plus rapides en moyenne · ${speed.slice(0,3).map(t=>`${esc(t.name)} (${seconds(t.average)})`).join(' · ')}`:''}</p></div>`;
 }
 if(phase==='finished'&&game.settings?.survival){
  const survivors=sorted().filter(t=>!t.eliminated);
  return `<div class="stage-content"><span class="eyebrow">DERNIER SURVIVANT</span><h1>${survivors.length===1?'🏆 '+esc(survivors[0].name):'Survivants ex æquo'}</h1>${survivors.length>1?`<p>${survivors.map(t=>esc(t.name)).join(' · ')}</p>`:''}<p class="help">${(game.historyCount??game.history.length)} manches jouées.</p></div>`;
 }
 if(phase==='finished'&&game.settings?.chain){
  const finalists=sorted().filter(t=>!t.eliminated);
  const winners=finalists.filter(t=>t.score===finalists[0]?.score);
  return `<div class="stage-content"><span class="eyebrow">MAILLON FAIBLE</span><h1>🏆 ${winners.map(t=>esc(t.name)).join(' · ')}</h1><p>${finalists[0]?.score||0} points sécurisés</p></div>`;
 }
 if(phase==='finished')return `<div class="stage-content"><span class="eyebrow">LE DERNIER MOT EST POUR VOUS</span><h1>Les champions du déclic !</h1><div class="podium">${sorted().slice(0,3).map((t,i)=>`<div><span style="font-size:35px">${['🏆','🥈','🥉'][i]}</span><strong>${esc(t.name)}</strong><span>${t.score} points</span></div>`).join('')}</div><p class="help">${total} manches. Bravo à toutes les équipes !</p></div>`;
 if(phase==='lobby')return `<div class="stage-content"><span class="eyebrow">PRÊTS À FAIRE LE DÉCLIC ?</span><div class="stage-wave" aria-hidden="true">${homeIcon('wave')}</div><h1>La soirée commence ici.</h1><p class="help">${game.mode==='phone'?`Rejoignez avec le code <strong style="color:var(--lime);font-size:27px;letter-spacing:4px">${esc(room)}</strong>`:'Installez vos équipes et testez vos touches !'}</p><p class="mini" style="color:#c4b2dc">${game.teams.length} équipe(s) · ${total} questions</p>${role==='tv'&&game.roomCode?invitationMarkup(game.roomCode):''}</div>`;
 const reveal=phase==='reveal',count=phase==='playing'&&Date.now()<game.startAt?Math.ceil((game.startAt-Date.now())/1000):0;const art=q?.artwork&&(q.target==='cover'||q.target!=='coverChoice'&&game.effect==='image'||reveal);
 return `<span class="counter">${game.index+1} / ${total}</span><div class="stage-content"><span class="eyebrow">${q?.universe==='film'?'CINÉMA MUSICAL':'MUSIQUE'} · ${q?.kind==='lyrics'?'PAROLES À COMPLÉTER':q?.kind==='question'?'QUESTION':CHALLENGES.find(v=>v[0]===q?.target)?.[2]||'LE DÉFI'}</span>${game.settings?.bingo&&phase==='playing'?`<p class="bingo-tv-count">${game.bingoAnswered??game.answered?.length??0} / ${game.teams.length} réponses</p>`:''}${count?`<h1 class="countdown">${count}</h1><p class="help">À vos marques…</p>`:`<h1>${esc(game.timelineMode||game.settings?.timelineMode?'Où placer cette chanson sur la frise ?':q?.prompt)}</h1>${q?.target==='artistTitle'?`<div class="artist-cue">${esc(q.artist||q.displayArtist)}</div>`:''}${art?`<img src="${esc(q.artwork)}" alt="Pochette à identifier" ${q.target==='cover'||game.effect==='image'?'data-mystery':''}>`:q?.mediaKey&&q.kind==='image'||q?.imageUrl?'<div data-image></div>':q?.emoji?`<div class="big-emoji" data-mystery>${esc(q.emoji)}</div>`:q?.kind==='audio'?'<div class="record" aria-hidden="true"></div>':''}${phase==='buzzed'?`<div class="buzz-banner">⚡ ${esc(game.teams.find(t=>t.id===game.buzz)?.name)} a buzzé !</div>`:''}${phase==='paused'?'<div class="pause-banner">Ⅱ En pause · l’animateur garde la main</div>':''}${reveal?`<span class="eyebrow">LA RÉPONSE</span><h2>${esc(targets(q)[0]==='answer'&&q.target!=='coverChoice'&&q.target!=='timeline'?q.answer:q.title||q.answer)}</h2>${q.artist?`<p class="reveal-artist">${esc(q.artist)}</p>`:''}${questionExplanation(q)}${roundRecap()}${timelineDistribution()}${(game.chainVote||game.chainVoting)?'<p>Vote en cours sur les téléphones.</p>':''}${q.provider?`<a class="source-credit" href="${esc(q.link)}" target="_blank" rel="noopener noreferrer">Extrait fourni par Deezer · écouter le titre ↗</a>`:''}`:phase==='ready'?'<p class="help">Une nouvelle question vous attend.</p>':''}${listeningMarkup()}${(game.timelineMode||game.settings?.timelineMode)==='collective'?timelineList(game.timelineCards):''}${!reveal&&!(game.timelineMode||game.settings?.timelineMode)&&game.input==='qcm'&&game.mode==='phone'&&q?.options?.length?`<div class="options ${q.optionArtwork?'cover-options':''}">${q.options.map((o,i)=>`<div class="option"><span class="letter">${'ABCDE'[i]}</span>${q.optionArtwork?`<img src="${esc(q.optionArtwork[i])}" alt="Pochette ${esc(o)}">`:esc(o)}</div>`).join('')}</div>`:''}${timerMarkup()}`}</div>`;
}
function eveningRanking(){
 if(role==='player'){
  const stats=game?.eveningPersonal;
  if(!stats?.played)return '';
  return `<details class="control"><summary>Mes statistiques de la soirée</summary><p>Place ${stats.rank} · ${stats.points} pts · ${stats.games} jeu(x)</p>
  <p>${stats.correct} bonnes réponses · ${Math.round(100*stats.correct/stats.played)} % de réussite</p>
  ${stats.best===null?'':`<p>Meilleur temps · ${(stats.best/1000).toFixed(2)} s</p>`}
  <p>${stats.jokersEarned} joker(s) obtenu(s) · ${stats.jokersUsed} utilisé(s)</p></details>`;
 }
 if(!game?.eveningRanking?.some(row=>row.played))return '';
 const podium=role==='tv';
 const rows=game.eveningRanking.slice(0,podium?10:undefined);
 return `<details class="control" ${podium&&['paused','finished'].includes(game.phase)?'open':''}><summary>Classement de la soirée</summary>
 ${rows.map((row,index)=>`<div class="leaderrow"><span>${index+1}</span><span>${esc(row.name)}</span><span>${row.correct}/${row.played} bonnes · ${row.played?Math.round(100*row.correct/row.played):0} %</span><strong>${row.points} pts</strong></div>`).join('')}</details>`;
}
function scorebar(){if(game?.timelineMode&&game.phase!=='finished')return '';return `<div class="scorebar">${sorted().slice(0,10).map((t,i)=>`<div class="scorecard"><span class="avatar" style="--team:${colors[i%10]}">${icons[i%10]}</span><span>${esc(t.name)}</span><strong>${t.score}</strong></div>`).join('')}</div>`;}
function leaderboard(){return sorted().map((t,i)=>`<div class="leaderrow"><span class="rank">${i+1}</span><span class="avatar" style="--team:${colors[(game.teams.findIndex(v=>v.id===t.id)+10)%10]}">${icons[(game.teams.findIndex(v=>v.id===t.id)+10)%10]}</span><span>${esc(t.name)}${t.eliminated?' <small>Éliminé</small>':''}${t.streak>1?` <small class="streak">🔥${t.streak}</small>`:''}</span><span class="pts">${t.score}</span></div>`).join('');}
const seconds=ms=>Number.isFinite(ms)?(ms/1000).toFixed(2)+' s':'—';
let bingoSort={column:0,direction:1};
let bingoSearch='';
const bingoColumns=['Participant','Connexion','Cochées','Restantes','Lignes','Colonnes','Combinaisons',
 'Cases avant la suite','Bonnes','Mauvaises','Sans réponse','Réussite','Dernière réponse','Moyenne',
 'Record','Plus rapide','Série en cours','Record de série','Points','Rang','Récompenses'];
function bingoRows(){
 const stats=new Map(roundStatistics(game.history,game.teams).map(t=>[t.id,t]));
 const connectedIds=new Set(game.connectedPlayers||[]);
 const rows=sorted().map((team,index)=>{
  const t=stats.get(team.id);
  const progress=team.bingo?bingoProgress(team.bingo):{rows:0,columns:0,total:0,remaining:4};
  const marks=team.bingo?.marked.length||0;
  return [team.name,connectedIds.has(team.id)?'En ligne':'Hors ligne',marks,16-marks,
   progress.rows,progress.columns,progress.total,progress.total===8?'—':progress.remaining,
   t.correct,t.wrong,t.absent,Math.round(100*t.correct/Math.max(1,t.correct+t.wrong+t.absent)),
   t.last,t.average,t.best,t.fastest,t.streak,t.bestStreak,team.score,index+1,
   (game.bingoMilestones||[]).filter(m=>m.winners.includes(team.id)).map(m=>bingoNames[m.rows]).join(', ')||'—'];
 });
 const {column,direction}=bingoSort;
 return rows.filter(row=>row[0].toLocaleLowerCase().includes(bingoSearch.toLocaleLowerCase()))
  .sort((a,b)=>direction*(typeof a[column]==='number'&&typeof b[column]==='number'?a[column]-b[column]:
   String(a[column]??'').localeCompare(String(b[column]??''),'fr')))
  .map(row=>`<tr>${row.map((value,index)=>`<td>${esc(index===11?value+' %':index>=12&&index<=14?seconds(value):value)}</td>`).join('')}</tr>`).join('');
}
function bingoDesk(){
 const q=currentQ(),phase=game.phase;
 const answers=Object.values(game.answers||{}).filter(answer=>answer.attempts);
 const correct=answers.filter(answer=>answer.correct);
 const fastest=Object.entries(game.answers||{}).filter(([,a])=>a.correct)
  .sort(([,a],[,b])=>a.elapsed-b.elapsed)[0];
 const total=game.teams.length;
 const draw=game.index+1;
 const recaps=[...(game.history||[])].reverse();
 return `<section class="control bingo-desk">
 <span class="eyebrow">BINGO MUSICAL · ${q?.target==='artist'?'ARTISTE':'TITRE'}</span>
 <h3>Tirage ${Math.min(draw,16)} / 16</h3>
 <p><strong>${esc(q?.title||'En attente')}</strong> · ${esc(q?.artist||'')}</p>
 <div class="bingo-clock">${timerMarkup()}</div>
 <div class="bingo-metrics"><span>Connectés <b>${game.connectedPlayers?.length||0}</b></span><span>Réponses <b>${answers.length} / ${total}</b></span>
 <span>En attente <b>${total-answers.length}</b></span><span>Correctes <b>${correct.length}</b></span>
 <span>Incorrectes <b>${answers.length-correct.length}</b></span><span>Réussite <b>${answers.length?Math.round(100*correct.length/answers.length):0} %</b></span>
 <span>Temps moyen <b>${seconds(correct.length?correct.reduce((sum,a)=>sum+a.elapsed,0)/correct.length:null)}</b></span>
 <span>Plus rapide <b>${fastest?participantNames([fastest[0]])+' · '+seconds(fastest[1].elapsed):'—'}</b></span></div>
 <h3>Participants</h3><input id="bingo-search" type="search" aria-label="Rechercher un participant" placeholder="Rechercher un participant" value="${esc(bingoSearch)}">
 <div class="bingo-table" tabindex="0" aria-label="Tableau des participants"><table><thead><tr>${bingoColumns.map((column,index)=>`<th scope="col" aria-sort="${index===bingoSort.column?(bingoSort.direction===1?'ascending':'descending'):'none'}"><button data-action="bingo-sort" data-value="${index}">${column}</button></th>`).join('')}</tr></thead>
 <tbody id="bingo-rows">${bingoRows()}</tbody></table></div>
 ${phase==='reveal'?bingoAnnouncement():''}
 <h3>Victoires officielles</h3>${bingoAwards()||'<p class="mini">Aucune étape remportée.</p>'}
 <h3>Journal des tirages</h3>
 <ol class="bingo-journal">${recaps.map(round=>`<li>Tirage ${round.index+1} · ${esc(round.question.title)}${(round.bingoProgressions||[]).filter(p=>p.previous<3).map(p=>` · ${participantNames([p.id])} (${bingoNames[Math.min(3,p.count)]})`).join('')}</li>`).join('')}</ol>
 </section>`;
}
function studio(){if(!game)return '<div class="empty">Aucune partie en cours.</div>';const q=currentQ(),ph=game.phase,wanted=q?targets(q):[],claimed=game.claimed||{};return `<main class="studio"><div class="row"><span class="eyebrow">LE STUDIO · ${game.mode==='usb'?'BUZZERS USB':'TÉLÉPHONES'}</span><span class="connection ${game.mode==='phone'&&!connected?'offline':''}">${game.mode==='phone'?(connected?'● Connecté':'○ Reconnexion…'):'● Partie sur ce PC'}</span><button class="btn ghost right" data-action="screen">▣ Écran public</button><button class="btn ghost" data-action="sound">${desk.muted?'♪ Jingles coupés':'♫ Jingles actifs'}</button></div><div class="game-layout">${game.settings?.bingo?bingoDesk():`<section class="stage ${ph==='playing'?'playing':''}" aria-live="polite">${stage()}</section>`}<aside class="control"><h3>${ph==='lobby'?'Tout le monde est là ?':ph==='finished'?'Quelle soirée !':'À vous les commandes'}</h3>${game.mode==='phone'&&ph==='lobby'?`<p class="help">Partagez le code avec vos équipes :</p>${invitationMarkup()}<button class="btn ghost full" data-action="copy-link">Copier le lien d’invitation</button>`:''}${!['lobby','finished'].includes(ph)?`<div class="answerbox"><small>RÉPONSE · ANIMATEUR</small><strong>${esc(targets(q)[0]==='answer'&&q.target!=='coverChoice'&&q.target!=='timeline'?q.answer:q.title||q.answer)}</strong>${q.artist?`<br>${esc(q.artist)}`:''}</div>`:''}${q&&['lobby','ready'].includes(ph)?`<button class="btn primary full" data-action="play" ${busy||game.mode==='phone'&&game.teams.length<(game.settings?.chain?3:game.settings?.survival?2:1)?'disabled':''}>${busy?'Chargement de l’extrait…':'▶ '+(ph==='lobby'?'Lancer la partie':(q?.kind==='question'?'Afficher la question':'Lancer l’extrait'))}</button>`:''}${ph==='buzzed'?`${wanted.length===2?`<div class="judge-grid"><button class="btn good" data-action="v2-judge" data-value="title" ${claimed.title?'disabled':''}>✓ Titre</button><button class="btn good" data-action="v2-judge" data-value="artist" ${claimed.artist?'disabled':''}>✓ Artiste</button></div><button class="btn good full" data-action="good">✓ Les deux</button>`:'<button class="btn good full" data-action="good">✓ Bonne réponse</button>'}<button class="btn bad full" data-action="bad">✕ Mauvaise réponse</button>`:''}${isProgressive(game,q)&&['playing','paused'].includes(ph)&&(game.listenStep||0)<3?`<button class="btn lime full" data-action="listen-more">Écouter ${LISTEN_STEPS[(game.listenStep||0)+1]} secondes →</button>`:''}${ph==='playing'?'<button class="btn ghost full" data-action="pause">Ⅱ Mettre en pause</button>':''}${ph==='paused'?'<button class="btn lime full" data-action="resume">▶ Reprendre la musique</button>':''}${!game.settings?.timelineMode&&['playing','buzzed','paused'].includes(ph)?'<button class="btn ghost full" data-action="reveal">Révéler et terminer la manche</button>':''}${ph==='reveal'?`<button class="btn primary full" data-action="next">${game.index+1>=(game.questions?.length||game.total)?'Le podium 🏆':'Question suivante →'}</button>${game.nextAt?'<p class="mini">La suite arrive automatiquement après 8 secondes.</p>':''}`:''}${ph==='finished'||ph==='lobby'?'<button class="btn lime full" data-action="new-game">'+(q?'Choisir un autre jeu':'Choisir le premier jeu')+'</button>':''}${game.mode==='phone'&&game.input!=='buzzer'&&ph==='playing'?`<p class="help">${Object.keys(game.answers||{}).length} / ${game.teams.length} équipe(s) ont répondu</p>`:''}${Object.keys(claimed).length?`<p class="mini">${claimed.title?'✓ Titre trouvé ':''}${claimed.artist?'✓ Artiste trouvé':''}</p>`:''}<div class="divider"></div><span class="eyebrow">LE CLASSEMENT</span>${leaderboard()}${eveningRanking()}${game.teams.length?'<button class="textbtn" data-action="adjust">Ajuster un score</button>':''}${game.history?.length?'<button class="textbtn full" data-action="v2-history">Voir le détail des manches →</button>':''}</aside></div>${game.mode==='usb'?`<div class="keytips">${game.teams.map(t=>`<strong>[${esc(t.key)}]</strong> ${esc(t.name)}${game.blocked?.includes(t.id)?' · bloqué':''}`).join(' · ')}<br>Gardez la fenêtre du PC active pour recevoir les buzzers.</div>`:''}${audioError?`<div class="catalog-message">${esc(audioError)}</div>`:''}${q?.provider?'<p class="media-notice">Extrait Deezer diffusé par le PC animateur. Le titre complet est accessible après la révélation.</p>':''}</main>`;}
function tvScreen(){return `<main class="tv-shell"><div class="row">${brand()}<span class="right">L’ÉCRAN DE LA SOIRÉE</span><button class="btn" data-action="fullscreen">⛶ Plein écran</button></div><section class="stage ${game?.phase==='playing'?'playing':''}">${stage()}</section> ${scorebar()}${eveningRanking()}</main>`;}
function joinScreen(){return `<main class="phone-shell">${brand()}<div class="joincard"><span class="eyebrow">ON VOUS GARDAIT UNE PLACE</span><h1>Entrez dans la partie.</h1><p class="help">Un nom d’équipe, le code de l’animateur et à vous de jouer.</p><form id="join-form"><label class="field-label" for="join-code">Code de la partie</label><input id="join-code" name="code" required minlength="8" maxlength="8" autocapitalize="characters" placeholder="EX. ABCD2345" value="${esc(room||'')}" autocomplete="off"><label class="field-label" for="join-name">Votre prénom ou nom d’équipe</label><input id="join-name" name="name" required maxlength="24" placeholder="Les rois du refrain" autocomplete="nickname"><button class="btn primary full" type="submit" ${busy?'disabled':''}>${busy?'Connexion…':'Rejoindre la soirée →'}</button></form></div><p class="caption">Le son est diffusé dans la salle par l’animateur.<br>Gardez cet écran ouvert pendant la partie.</p></main>`;}
function timelineList(cards=[],slots=[]){
 return `<ol class="music-timeline">${Array.from({length:cards.length+1},(_,index)=>{
  const card=cards[index],button=slots.includes(index)?`<button class="option" data-action="answer" data-value="${index}">Placer ici</button>`:'';
  if(!card&&!button)return '';
  return `<li>${button}${card?`<p><strong>${card.year}</strong> · ${esc(card.title)}<br><small>${esc(card.artist)}</small></p>`:''}</li>`;
 }).join('')}</ol>`;
}
const jokerLabels={
 double:['✖️ Double points','Double les points de votre prochaine bonne réponse.'],
 half:['🎯 50/50','Retire une partie des mauvaises propositions.'],
 retry:['🃏 Seconde chance','Permet une seconde réponse après une erreur.'],
 shield:['🛡️ Bouclier','Protège votre prochaine vie perdue.'],
 life:['❤️ Vie supplémentaire','Récupère une vie si vous êtes encore en course.'],
 decade:['📅 Indice décennie','Affiche la décennie de sortie du titre.']
};
function jokerPanel(){
 const joker=game.joker;
 if(!joker)return '';
 const description=jokerLabels[joker.held];
 const ready=game.phase==='playing'&&Date.now()>=game.startAt&&Date.now()<game.endAt;
 const available=ready&&(joker.held==='retry'?joker.canRetry:!game.me?.attempts);
 return `<aside class="control joker-panel" aria-label="Joker">
 ${joker.decade?`<p>Indice · années ${joker.decade}</p>`:''}
 ${description?`<strong>${description[0]}</strong><p>${description[1]}</p>
 <button class="btn lime" data-action="joker" ${available?'':'disabled'}>Utiliser mon joker</button>`:
 `<small>Joker · ${joker.correct}/4 bonnes de suite · ${joker.fastest}/2 premières places</small>`}
 </aside>`;
}
function timelinePhone(){
 const phase=game.phase,q=currentQ(),result=game.timelineResult;
 const canAnswer=phase==='playing'&&Date.now()>=game.startAt&&!game.me?.attempts;
 const label=game.timelineMode==='collective'?'Frise collective':'Frise individuelle';
 return `<main class="phone-shell"><div class="row">${brand()}<span class="phone-game-label">${label}</span></div><section class="stage"><div class="stage-content">
 <h1>${phase==='lobby'?'En attente de l’animateur':phase==='paused'?'Pause':phase==='reveal'?esc(q.title)+' · '+q.year:phase==='finished'?'Votre frise finale':'Placez la chanson'}</h1>
 ${phase==='playing'&&game.me?.attempts?'<p role="status">Réponse enregistrée.</p>':''}
 ${phase==='reveal'?'<p>'+esc(q.artist||'')+'</p>':''}
 ${timelineList(game.timelineCards,canAnswer?game.timelineSlots:[])}
 ${phase==='playing'?timerMarkup():''}
 ${result?`<p>Votre place · ${result.rank}</p><p>${result.correct} bonnes réponses sur ${result.total} · ${Math.round(100*result.correct/result.total)} %</p>`:''}
 </div></section>${jokerPanel()}${eveningRanking()}</main>`;
}
function timelineDistribution(){
 if(!game.distribution?.length)return '';
 return `<div class="round-recap">${game.distribution.map(row=>`<div class="leaderrow"><span>${row.correct} bonne(s)</span><meter min="0" max="${game.teams.length}" value="${row.players}"></meter><span>${row.players} joueur(s) · ${Math.round(100*row.players/game.teams.length)} %</span></div>`).join('')}</div>`;
}
function timelineOptions(q){
 if(q.timeline?.length!==3)return '';
 return `<ol class="music-timeline">${q.options.map((position,i)=>`<li><button class="option" data-action="answer" data-value="${esc(position)}">Placer ici</button>${i<3?`<p>${esc(q.timeline[i])}</p>`:''}</li>`).join('')}</ol>`;
}
let pendingBingo;
function bingoPhone(){
 const card=game.bingoCard,q=currentQ(),phase=game.phase;
 const countdown=phase==='playing'&&Date.now()<game.startAt;
 const selected=game.me?.selectedSong||(pendingBingo?.id===q?.id&&pendingBingo.song);
 const canMark=phase==='playing'&&!countdown&&!game.me?.attempts&&!selected;
 const target=game.settings.bingoTarget==='artist'?'artist':'title';
 const progress=card&&bingoProgress(card);
 const ownProgress=phase==='reveal'&&game.bingoProgressions?.find(p=>p.id===teamId);
 return `<main class="phone-shell bingo-phone"><div class="row">${brand()}<span class="phone-game-label">Bingo musical</span></div>
 <section class="stage"><div class="stage-content">${phase==='finished'?stage():!card?'<h1>En attente du tirage</h1>':`
 <h1>${countdown?'À vos marques…':phase==='reveal'?esc(q.title):phase==='paused'?'Pause':'Écoutez et choisissez'}</h1>
 <p class="help">${phase==='reveal'?esc(q.artist):selected?'Réponse verrouillée.':'Complétez des lignes ou des colonnes.'}</p>
 <p>${progress.total} / 8 combinaisons · ${card.marked.length} / 16 cases</p>
 <div class="bingo-card ${card.card.length===9?'bingo-card-legacy':''}">${card.card.map(song=>{
  const active=selected===song.id;
  const marked=card.marked.includes(song.id);
  const result=phase==='reveal'&&active?(game.me?.correct?'correct':'wrong'):'';
  const status=result||(phase==='reveal'&&q.id===song.id?'revealed':marked?'marked':active?'selected':'available');
  const icon={selected:'🔒',correct:'✓',wrong:'×',revealed:'✓',marked:'✓'}[status];
  return `<button class="option bingo-${status} ${progress.cells.includes(song.id)?'bingo-complete':''}" aria-pressed="${active||marked}" data-action="bingo-mark" data-value="${esc(song.id)}" ${canMark&&!marked?'':'disabled'}>${icon?`<span aria-hidden="true">${icon}</span>`:''}<strong>${esc(song[target])}</strong></button>`;
 }).join('')}</div>
 ${ownProgress?`<p class="bingo-congrats" role="status">Bravo ! ${ownProgress.count} combinaison(s) complète(s)</p>`:phase==='reveal'?'<p role="status">'+(!game.me?.attempts?'Aucune réponse':game.me.correct?'Bonne réponse ✓':'Réponse incorrecte')+'</p>':''}`}</div></section></main>`;
}
function chainControls(me){
 if(!game.settings?.chain||!me||me.eliminated)return '';
 if(game.phase==='reveal'&&game.chainVoting){
  const others=game.teams.filter(t=>!t.eliminated&&t.id!==teamId);
  return game.chainMyVote?'<p>Vote enregistré.</p>':`<h2>Qui quitte le jeu ?</h2><div class="options">${others.map(t=>`<button class="option" data-action="chain-vote" data-value="${esc(t.id)}">${esc(t.name)}</button>`).join('')}</div>`;
 }
 if(game.phase==='playing'&&Date.now()>=game.startAt){
  const points=game.chainUnbanked||0;
  return `<button class="btn ghost full" data-action="chain-bank" ${!points||game.me?.attempts?'disabled':''}>Sécuriser ${points} pts</button>`;
 }
 return '';
}
function phoneScreen(){if(game?.timelineMode)return timelinePhone();if(game?.settings?.bingo)return bingoPhone();const q=currentQ(),me=game?.teams?.find(t=>t.id===teamId),ph=game?.phase,r=game?.me||{},parts=r.parts||[],locked=game?.input==='qcm'?(r.attempts||0)>=(game.joker?.retry?2:1):(r.attempts||0)>=5||q&&targets(q).every(p=>parts.includes(p));if(!game)return '<main class="phone-shell"><div class="empty">Connexion à la partie…</div></main>';const draft=replyDraft[q?.id]||{};return `<main class="phone-shell"><div class="row">${brand()}<span class="pill right">${esc(me?.name||'Mon équipe')} · ${me?.score||0} pts</span></div><span class="connection ${connected?'':'offline'}">${connected?'● Dans la partie':'○ Reconnexion en cours…'}</span><section class="stage"><div class="stage-content">${ph==='lobby'?'<div class="big-emoji">🙌</div><h1>Vous êtes dans la place !</h1><p class="help">L’animateur lance la partie dès que tout le monde est prêt.</p>':ph==='finished'?stage():ph==='reveal'?`<span class="eyebrow">LA BONNE RÉPONSE</span><h2>${esc(targets(q)[0]==='answer'&&!['coverChoice','timeline'].includes(q.target)?q.answer:q.title||q.answer)}</h2><p class="reveal-artist">${esc(q.artist||'')}</p><div class="round-points">+${r.total||0} points</div>${scoreBreakdown(r)}${questionExplanation(q)}${q.provider?`<a class="source-credit" href="${esc(q.link)}" target="_blank" rel="noopener noreferrer">Écouter sur Deezer ↗</a>`:''}`:ph==='ready'?'<div class="big-emoji">👀</div><h1>La suite arrive…</h1>':ph==='paused'?'<div class="big-emoji">Ⅱ</div><h1>Petite pause.</h1><p class="help">On reprend avec l’animateur.</p>':Date.now()<game.startAt?`<h1 class="countdown">${Math.max(1,Math.ceil((game.startAt-Date.now())/1000))}</h1><p class="help">À vos marques…</p>`:`<span class="eyebrow">QUESTION ${game.index+1} / ${game.total}</span><h1>${esc(q.prompt)}</h1>${q.displayArtist?`<div class="artist-cue">${esc(q.displayArtist)}</div>`:''}${(q.target==='cover'||game.effect==='image')&&q.artwork?`<img src="${esc(q.artwork)}" alt="Pochette mystère" data-mystery>`:''}${listeningMarkup()}${game.input==='buzzer'?buzzerPanel():me?.eliminated&&!game.settings?.survival?'<p class="help">Vous êtes éliminé. Vous pouvez suivre la partie.</p>':locked?'<div class="big-emoji">✉️</div><p class="help">Réponse enregistrée. Verdict à la révélation !</p>':game.input==='qcm'?(q.target==='timeline'?timelineOptions(q):`<div class="options ${q.optionArtwork?'cover-options':''}">${q.options.map((o,i)=>`<button class="option" data-action="answer" data-value="${esc(o)}"><span class="letter">${'ABCDE'[i]}</span>${q.optionArtwork?`<img src="${esc(q.optionArtwork[i])}" alt="Pochette ${esc(o)}">`:esc(o)}</button>`).join('')}</div>`):q.musical?`<form id="answer-form" data-question="${esc(q?.id)}" class="music-reply">${targets(q).map(part=>`<label>${part==='title'?'Le titre':'L’artiste'} ${parts.includes(part)?'✓':''}<input name="${part}" aria-label="${part==='title'?'Titre':'Artiste'}" placeholder="${part==='title'?'Le titre du morceau…':'Le nom de l’artiste…'}" maxlength="180" value="${esc(draft[part]||'')}" ${parts.includes(part)?'disabled':''} autocomplete="off"></label>`).join('')}<button class="btn lime full" type="submit">Valider ma réponse →</button></form><p class="help">${parts.length?'✓ Réponse partielle validée. Continuez !':r.attempts?'Pas encore… Vous pouvez réessayer.':'Titre et artiste peuvent être validés séparément.'} · ${r.attempts||0}/5 essais</p>`:`<form id="answer-form" data-question="${esc(q?.id)}" class="textreply"><input name="answer" aria-label="Votre réponse" placeholder="Votre réponse…" value="${esc(draft.answer||'')}" maxlength="180" required autocomplete="off"><button class="btn lime" type="submit">→</button></form>`}${timerMarkup()}`}${game.settings?.survival&&Number.isInteger(me?.lives)?`<p class="help">${me.lives?'♥ '.repeat(me.lives).trim()+' · '+me.lives+' vie(s)':'Vous continuez pour le classement de la soirée.'}</p>`:''}${chainControls(me)}</div></section>${jokerPanel()}${eveningRanking()}<div class="control" style="margin-top:20px"><span class="eyebrow">LE CLASSEMENT</span>${leaderboard()}${game.history?.length?'<button class="textbtn" data-action="v2-history">Le détail des manches →</button>':''}</div></main>`;}
function questionForm(q={}){const editing=!!q.id;modal(`<div class="top"><h2>${editing?'Modifier':'Créer'} une question</h2><button class="iconbtn" data-action="close-modal" aria-label="Fermer">×</button></div><form id="question-form" data-id="${esc(q.id||'')}"><div class="formgrid"><label>Type de défi<select name="kind"><option value="audio" ${q.kind==='audio'||!q.kind?'selected':''}>Extrait audio</option><option value="lyrics" ${q.kind==='lyrics'?'selected':''}>Paroles à compléter · audio avec coupure</option><option value="image" ${q.kind==='image'?'selected':''}>Image à deviner</option><option value="question" ${q.kind==='question'?'selected':''}>Question de musique</option></select></label><label class="wide">La question<input name="prompt" required maxlength="300" placeholder="Quel est le titre de cet extrait ?" value="${esc(q.prompt||'')}"></label><label class="wide">Coupure pour les paroles (secondes)<input name="cutAt" type="number" min="0.1" max="30" step="0.1" value="${q.cutAt||5}"><span class="mini">Type Paroles : lecture originale coupée ici, puis réponse orale, écrite ou QCM. Écrivez la phrase avec ___ dans la question. Ajoutez votre extrait chanté.</span></label><label class="wide">La bonne réponse<input name="answer" required maxlength="180" value="${esc(q.answer||'')}"></label><label>Titre musical (facultatif)<input name="title" value="${esc(q.title||'')}"></label><label>Artiste musical (facultatif)<input name="artist" value="${esc(q.artist||'')}"></label><label class="wide">Trois mauvaises réponses pour le QCM<textarea name="wrong" rows="3" required placeholder="Une réponse par ligne">${esc((q.options||[]).filter(o=>o!==q.answer).join('\n'))}</textarea></label><label class="wide">Autres réponses acceptées à l’écrit <span class="mini">(séparées par ;)</span><input name="aliases" value="${esc((q.aliases||[]).join('; '))}"></label><label>Durée (secondes)<input name="duration" type="number" min="5" max="90" value="${q.duration||30}" required></label><label>Points<input name="points" type="number" min="1" max="1000" value="${q.points||100}" required></label><label class="wide">Fichier audio ou image <span class="mini">· max. 30 Mo</span><input name="media" type="file" accept="audio/*,image/*"><span class="mini">${editing&&q.mediaKey?'Un fichier est déjà associé. Laissez vide pour le garder.':'Votre fichier reste sur ce PC.'}</span></label></div><button class="btn primary full" type="submit" style="margin-top:23px">Enregistrer la question</button></form>`);}
function modal(html){$('.dialog')?.remove();const d=document.createElement('div');d.className='dialog';d.innerHTML=`<div class="modal" role="dialog" aria-modal="true">${html}</div>`;document.body.append(d);d.querySelector('input,button')?.focus();}
function closeModal(){$('.dialog')?.remove();}
async function prepareImage(){const q=currentQ();if(!q)return;let url=q.imageUrl;if(!url&&q.mediaKey){if(!assetUrls.has(q.mediaKey)){const b=await getBlob(q.mediaKey);if(b?.type.startsWith('image/'))assetUrls.set(q.mediaKey,URL.createObjectURL(b));}url=assetUrls.get(q.mediaKey);}if(url&&$('[data-image]')){$('[data-image]').innerHTML=`<img src="${esc(url)}" alt="Image mystère à identifier" data-mystery>`;}}
function broadcastTV(){if(!game||role!=='host')return;const s=publicGame(game),q=currentQ();s.effect=game.effect||config.effect;s.roomCode=game.mode==='phone'?room:null;if(q?.mediaKey&&assetUrls.has(q.mediaKey)){s.question={...s.question,mediaKind:'image',imageUrl:assetUrls.get(q.mediaKey)};}channel.postMessage({type:'state',state:s});}
async function receive(){
 if(role==='player'&&(game?.me?.attempts||game?.phase!=='playing'))pendingBingo=undefined;
 if(game?.tyrolien){
  render();
  const ty=game.tyrolien;
  if(role==='host'){
   if(ty.phase==='listen'&&ty.question?.id!==desk.id)void playTyrolienClip().catch(error=>toast(error.message));
   if(!['listen','answer'].includes(ty.phase)){desk.stop();if(ty.phase==='paused')desk.id=null;}
  }
  return;
 }
 const ev=game?.event;if(ev&&ev.id!==lastEvent){
  if(lastEvent&&game.settings?.bingo&&game.phase==='reveal'&&(
   role==='tv'&&game.bingoProgressions?.some(p=>p.previous<3)||
   role==='player'&&game.bingoProgressions?.some(p=>p.id===teamId)
  )){
   celebrate();
   if(role==='player'&&!matchMedia('(prefers-reduced-motion: reduce)').matches)navigator.vibrate?.(60);
  }
 if(['correct','podium'].includes(ev.type)||game.mode==='phone'&&game.phase==='reveal'&&Object.values(game.answers||{}).some(r=>r.total>0))celebrate();if(role==='host')desk.jingle(game.settings?.bingo&&game.phase==='reveal'&&game.bingoMilestones?.some(m=>m.index===game.index)?'podium':ev.type);}
 if(role==='host'&&game.phase!=='playing')desk.pause();
 lastEvent=ev?.id;seenCount=null;
 if(view!=='home'){
  const table=$('.bingo-table');
  const left=table?.scrollLeft,top=table?.scrollTop;
  const focused=document.activeElement;
  render();
  if(table&&$('.bingo-table')){
   $('.bingo-table').scrollLeft=left;
   $('.bingo-table').scrollTop=top;
   if(focused?.id==='bingo-search'){
    $('#bingo-search')?.focus({preventScroll:true});
   }
  }
 }
 await prepareImage();if(role==='host'){broadcastTV();}
}
async function ensureAudio(){const q=currentQ();if(!q)return;if(desk.id===q.id&&audioReady)return;audioReady=false;audioError='';const track=q.provider==='Deezer'&&q.link?.match(/\/track\/(\d+)(?:[/?#]|$)/)?.[1];await desk.load(!q.audioUrl&&track?{...q,audioUrl:'/api/music/preview/'+track}:q,q.mediaKey?await getBlob(q.mediaKey):null,q.kind==='lyrics'?'normal':game.effect||config.effect);if(q.kind==='lyrics'&&desk.buffer&&q.cutAt>=desk.buffer.duration)throw Error('La coupure doit précéder la fin du fichier audio. Modifiez la question.');audioReady=true;}
async function playTyrolienClip(){
 const clip=game?.tyrolien?.question?.audio;
 if(!clip)return;
 await desk.load(clip,null,'normal');
 if(game?.tyrolien?.question?.id===clip.id&&['listen','answer'].includes(game.tyrolien.phase)){
  desk.play(desk.buffer?.duration||0);
 }
}
function send(action){if(['answer','joker','buzz','listen-more','judge','bingo-mark','chain-bank','chain-vote'].includes(action.type))action.questionId=currentQ()?.id;if(game?.mode==='phone'){if(!ws||ws.readyState!==WebSocket.OPEN){toast('Connexion interrompue. Attendez la reconnexion.');return;}ws.send(JSON.stringify(action));}else{const next=applyAction(game,action);if(next!==game){game=next;if(next.mode==='usb')queueUSB(next);void receive();}}}
async function requestRoom(payload){
 const response=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
 const data=await response.json();
 if(!response.ok)throw Error(data.error);
 return data;
}
function openHostRoom(data,questions,effect,nextView){
 room=data.code;
 auth={type:'host',token:data.token};
 write('declic.host',{room,token:data.token,effect,questions});
 game=null;
 desk.stop();desk.id=null;audioReady=false;lastEvent=null;replyDraft={};
 view=nextView;
 connect();
}
function hostCredential(){
 let credential=read('declic.hostKey',null);
 if(!credential){
  credential=Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
  write('declic.hostKey',credential);
 }
 return credential;
}
async function hostRequest(path,method='GET',data){
 const credential=read('declic.hostKey',null)??(navigator.locks?await navigator.locks.request('declic.hostKey',hostCredential):hostCredential());
 const response=await fetch(path,{
  method,headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},
  body:data===undefined?undefined:JSON.stringify(data),cache:'no-store',signal:AbortSignal.timeout(12000)
 });
 const result=await response.json();
 if(!response.ok)throw Object.assign(Error(result.error),{status:response.status});
 return result;
}
const eveningRequest=(method,data)=>hostRequest('/api/evening',method,data);
async function loadEvening(){
 eveningStatus='loading';if(view==='home')render();
 try{
  let {active}=await eveningRequest();
  const legacy=savedMusicGame('declic.host');
  if(!active&&legacy?.token&&legacy?.room){
   ({active}=await eveningRequest('POST',{adopt:{code:legacy.room,token:legacy.token}}));
   if(!active)localStorage.removeItem('declic.host');
  }
  if(activeEvening?.code&&activeEvening.code!==active?.code)clearEvening();
  activeEvening=active;
  usbRevision=active?.usb?.revision||0;
  usbQueue=read('declic.usbPending',[]).filter(item=>item.code===active?.code);
  if(usbQueue.length)void flushUSB();
  eveningStatus='ready';
 }catch{eveningStatus='error';}
 if(view==='home')render();
}
window.addEventListener('storage',event=>{
 if(event.key==='declic.hostSessionChanged'&&view==='home'&&!changingEvening)void loadEvening();
});
function clearEvening(){
 clearTimeout(reconnect);clearTimeout(usbRetry);
 if(ws){ws.onclose=null;ws.close();ws=null;}
 game=null;room=null;auth=null;connected=false;usbRevision=0;usbQueue=[];
 for(const key of ['declic.host','declic.localGame','declic.usbPending'])localStorage.removeItem(key);
 desk.stop();desk.id=null;audioReady=false;lastEvent=null;replyDraft={};
 channel.postMessage({type:'ended'});
}
function eveningConfirmation(end=false){
 const dialog=document.createElement('dialog');
 dialog.className='evening-dialog';
 dialog.setAttribute('aria-labelledby','evening-dialog-title');
 dialog.setAttribute('aria-describedby','evening-dialog-message');
 dialog.innerHTML=`<h2 id="evening-dialog-title">${end?'Terminer la soirée ?':'Créer une nouvelle soirée ?'}</h2>
  <p id="evening-dialog-message">La soirée actuelle sera définitivement supprimée, ainsi que ses participants et ses scores.</p>
  <div class="evening-dialog-actions"><button type="button" data-action="cancel-evening" autofocus>Annuler</button>
  <button type="button" data-action="${end?'confirm-end':'confirm-evening'}">${end?'Terminer la soirée':'Nouvelle soirée'}</button></div>`;
 document.body.append(dialog);
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 dialog.showModal();
}
async function changeEvening(end=false){
 if(changingEvening||eveningStatus!=='ready')return;
 changingEvening=true;
 document.querySelector('.evening-dialog')?.close();
 render();
 const previous=activeEvening;
 const expected=previous?.code||null;
 const id=randomUUID();
 try{
  const {active}=await eveningRequest(end?'DELETE':'POST',{expected,id});
  clearEvening();
  config.teams=defaultTeams();saveConfig();
  activeEvening=active;
  write('declic.hostSessionChanged',id);
  if(active)openHostRoom(active,[],'normal','setup');
 }catch(error){
  toast(error.status===409?error.message:'Impossible de vérifier la modification. Vérifiez votre connexion.');
  await loadEvening();
 }finally{changingEvening=false;render();void flushUSB();}
}
async function resumeEvening(){
 if(changingEvening)return;
 await desk.unlock();
 if(!activeEvening){
  const legacy=savedMusicGame('declic.localGame');
  if(!legacy)return;
  try{
   const {active}=await eveningRequest('POST',{expected:null,id:randomUUID()});
   activeEvening=active;
   queueUSB(legacy);
   await flushUSB();
   localStorage.removeItem('declic.localGame');
   openUSB(legacy);
  }catch(error){toast(error.message);}
  return;
 }
 if(game&&room===activeEvening.code){view=game.questions.length?'studio':'setup';render();return;}
 const state=usbQueue.at(-1)?.state??activeEvening.usb?.state;
 if(state){openUSB(state);return;}
 const saved=read('declic.host',{});
 openHostRoom(activeEvening,saved.room===activeEvening.code?saved.questions:[],saved.effect,'studio');
}
function openUSB(state){
 clearTimeout(reconnect);
 if(ws){ws.onclose=null;ws.close();ws=null;}
 room=activeEvening.code;auth={type:'host',token:activeEvening.token};
 game=state;desk.id=null;audioReady=false;view='studio';
 if(game.phase==='playing')void ensureAudio().catch(error=>toast(error.message));
 void receive();
}
function queueUSB(state){
 if(!activeEvening)return;
 // Keep the in-flight write plus the newest state, including when temporarily offline.
 const first=usbQueue[0];
 const keep=first&&(usbSave||first.revision!==undefined)?[first]:[];
 usbQueue=[...keep,{code:activeEvening.code,id:randomUUID(),state}];
 write('declic.usbPending',usbQueue);
 void flushUSB();
}
function flushUSB(){
 if(usbSave||!usbQueue.length||changingEvening)return usbSave;
 clearTimeout(usbRetry);
 const item=usbQueue[0];
 item.revision??=usbRevision;
 write('declic.usbPending',usbQueue);
 usbSave=eveningRequest('PUT',item).then(({revision})=>{
  if(activeEvening?.code!==item.code||usbQueue[0]?.id!==item.id)return;
  usbRevision=revision;
  activeEvening.usb={state:item.state,revision};
  usbQueue.shift();
  write('declic.usbPending',usbQueue);
 }).catch(error=>{
  if(activeEvening?.code!==item.code)return;
  if(error.status===409){
   usbQueue=[];localStorage.removeItem('declic.usbPending');
   toast('La sauvegarde a changé dans un autre onglet. Revenez à l’accueil pour la recharger.');
   return;
  }
  toast('Sauvegarde USB en attente de connexion.');
  usbRetry=setTimeout(()=>{usbRetry=null;void flushUSB();},4000);
 }).finally(()=>{
  usbSave=null;
  if(!usbRetry&&usbQueue.length)void flushUSB();
 });
 return usbSave;
}
window.addEventListener('online',()=>{
 if(eveningStatus==='error'&&view==='home')void loadEvening();
 void flushUSB();
});
async function launch(){if(busy)return;busy=true;catalogMessage='';audioError='';render();
 try{
 const special=config.source==='catalog'&&Object.hasOwn(SPECIAL_TRACKS,config.musicGame)?config.musicGame:null;
 const chain=config.musicGame==='chain'&&config.source==='catalog'&&config.universe==='music';
 const bingo=config.musicGame==='bingo'&&config.source==='catalog'&&config.universe==='music';
 const survival=config.musicGame==='survival'&&config.source==='catalog'&&config.universe==='music';
 const covers=config.challenge==='coverChoice'&&config.source==='catalog'&&config.universe==='music';
 if((chain||special||bingo||survival||covers)&&(config.mode!=='phone'||config.input!=='qcm'))throw Error('Ce jeu se joue en QCM sur téléphone.');
 if(covers&&config.effect==='image')throw Error('Choisissez un autre effet pour garder la bonne pochette cachée.');
 if(!special&&config.source==='catalog'&&config.universe==='music'&&(!catalogPool.tracks.length||config.catalogFrom!=='explorer'&&catalogPool.themeKey!==config.themes.join(',')))await loadThemes();
 const selection=special==='soundtrack'?(config.soundtrackCategory||'soundtrack'):special;
 let qs=selection?await loadSpecialQuestions(selection):selectedQuestions();if(!qs.length)throw Error(covers?'Choisissez des titres issus d’au moins quatre albums différents.':config.challenge==='artistTitle'?'Il faut au moins 4 titres du même artiste pour ce défi. Recherchez un artiste dans Les musiques.':'Aucun contenu jouable dans cette sélection. Ajoutez des titres ou choisissez Découverte.');
 if(chain&&qs.length<4)throw Error('Choisissez au moins quatre extraits pour ce jeu.');
 if(bingo){
  if(qs.length<BINGO_CARD_SIZE)throw Error('Choisissez au moins 16 chansons avec un extrait disponible.');
  qs=qs.map(q=>({...q,prompt:config.challenge==='artist'?'Retrouvez l’artiste sur votre grille.':'Retrouvez le titre sur votre grille.'}));
 }
 if(!special&&!bingo&&config.effect==='image'){qs=qs.filter(q=>q.kind==='image'||q.artwork);if(!qs.length)throw Error('Choisissez des questions avec une image ou des pochettes pour cet effet.');}
 if(config.mode==='usb'){const keys=config.teams.map(t=>t.key.toLowerCase());if(keys.some(k=>!k.trim())||new Set(keys).size!==keys.length)throw Error('Attribuez une touche différente à chaque équipe.');if(config.teams.some(t=>!t.name.trim()))throw Error('Donnez un nom à chaque équipe.');}
 await desk.unlock();
 const questions=qs.map(q=>({...q,id:randomUUID(),duration:bingo||survival||special==='timeline'?30:Math.min(q.audioUrl?30:90,Math.max(config.duration,q.kind==='lyrics'?q.cutAt+5:0)),target:q.target,artwork:q.artwork}));
 if(!activeEvening)throw Error('Créez une soirée depuis l’accueil.');
 if(config.mode==='usb'){
  const state=createGame(questions,config.teams,'usb','text',config.settings);
  state.effect=config.effect;
  queueUSB(state);openUSB(state);return;
 }
 if(usbQueue.length)throw Error('Attendez la sauvegarde USB avant de changer de mode.');
 let timelineAnchor;
 if(special==='timeline'){
  if(questions.length<6)throw Error('Il faut au moins six chansons datées et jouables, dont une pour commencer.');
  const {id,title,artist,year}=questions.shift();
  timelineAnchor={id,title,artist,year};
 }
 const clean=questions.map(({mediaKey,mediaType,notes,audioUrl,...q})=>q);
 const existing={room:activeEvening.code,token:activeEvening.token};
 const effect=bingo||special?'normal':config.effect;
 const data=await requestRoom({...existing,questions:clean,input:config.input,settings:{...config.settings,survival,bingo,chain,timelineMode:timelineAnchor?(config.timelineMode||'collective'):undefined,timelineAnchor,listening:bingo||chain?'continuous':config.settings.listening},effect});
 if(activeEvening.usb?.state){
  const {revision}=await eveningRequest('PUT',{code:activeEvening.code,revision:usbRevision,id:randomUUID(),state:null});
  usbRevision=revision;activeEvening.usb={state:null,revision};
 }
 openHostRoom(data,questions,effect,'studio');
 }catch(e){catalogMessage=e.message||'Impossible de préparer la partie.';toast(catalogMessage);view='setup';}finally{busy=false;render();}
}
let bingoRefresh=0;
function receiveBingoAnswer(message){
 if(!game?.settings?.bingo||game.phase!=='playing'||message.index!==game.index)return;
 game.bingoAnswered=message.count;
 if(message.me){
  game.me=message.me;
  pendingBingo=undefined;
 }
 if(message.result)game.answers[message.player]=message.result;
 if(bingoRefresh)return;
 bingoRefresh=requestAnimationFrame(()=>{
  bingoRefresh=0;
  if(game?.settings?.bingo&&game.phase==='playing')void receive();
 });
}
function connect(){clearTimeout(reconnect);if(ws){ws.onclose=null;ws.close();}connected=false;ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/api/rooms/${room}`);const socket=ws;
 socket.onopen=()=>{connected=true;socket.send(JSON.stringify(auth));};
 socket.onmessage=e=>{if(e.data==='pong')return;try{const m=JSON.parse(e.data);if(m.type==='bingo-answer'){receiveBingoAnswer(m);return;}if(m.type==='error'){busy=false;if(pendingBingo){pendingBingo=undefined;render();}toast(m.message);if(view==='join')render();if(/expir|introuvable|refus|commencé|déjà|maximum|Entrez/.test(m.message)){socket.onclose=null;socket.close();connected=false;}return;}if(m.type==='session'){teamId=m.id;sessionStorage.setItem('declic.player.'+room,JSON.stringify({id:m.id,token:m.token}));auth={type:'join',token:m.token};role='player';view='phone';busy=false;}if(m.type==='state'){game=m.state;if(game.tyrolien){void receive();return;}game.teams=game.teams.map(({id,name,score,key,streak,eliminated,lives,bingo})=>({id,name,score,key,streak,eliminated,lives,bingo}));if(role==='host'){if(view==='studio'&&!game.questions.length)view='setup';const saved=read('declic.host',{});if(saved.room===room){game.effect=saved.effect||game.effect;game.questions=game.questions.map(q=>({...q,...saved.questions?.find(v=>v.id===q.id),duration:q.duration}));}if(game.phase==='playing'&&!audioReady)void ensureAudio().catch(error=>toast(error.message));}void receive();}}catch{toast('Erreur de synchronisation.');}};
 socket.onclose=event=>{connected=false;busy=false;
 if(event.code===4001){
  if(role==='host'){if(!changingEvening){clearEvening();view='home';void loadEvening();}}
  else{sessionStorage.removeItem('declic.player.'+room);role='host';view='join';game=null;room=null;toast('Cette soirée est terminée.');render();}
  return;
 }if(view==='join'){toast('Partie introuvable ou indisponible. Vérifiez le code.');render();return;}render();reconnect=setTimeout(()=>connect(),2500);};socket.onerror=()=>{};
}
setInterval(()=>{if(ws?.readyState===WebSocket.OPEN)ws.send('ping');},25000);
setInterval(()=>{
 if(!game)return;const now=Date.now(), ph=game.phase;
 if(game.tyrolien){
  const clock=$('[data-ty-clock]');
  if(clock)clock.textContent=Math.max(0,Math.ceil((game.tyrolien.nextAt-now)/1000))+' s';
  return;
 }if(role==='host'&&game.mode==='usb'&&ph==='reveal'&&game.nextAt&&now>=game.nextAt){send({type:'next'});return;}
 if(ph==='playing'){
  const n=Math.max(0,Math.ceil((game.startAt-now)/1000));if(seenCount!==n){const previous=seenCount;seenCount=n;if(n||previous>0){render();void prepareImage();}if(n&&role==='host'&&n!==countdown){desk.jingle('tick');countdown=n;}}
  if(role==='host'&&audioReady&&now>=game.startAt&&now<game.endAt){const segment=currentQ()?.id+':'+(game.listenStep||0);if(audioSegment!==segment){desk.stop();audioSegment=segment;}const left=audioRemaining(game,now);if(left>0)desk.play(left);else desk.pause();}
  if(now>=game.endAt&&role==='host'&&game.mode==='usb'){send({type:'timeout'});return;}
 }
 document.querySelectorAll('[data-listen-status]').forEach(el=>el.textContent=audioRemaining(game,now)>0?'♫ Écoutez…':'À vous de répondre !');updateBuzzer();
 const q=currentQ(),duration=(q?.duration||30)*1000,remaining=['buzzed','paused'].includes(ph)?game.remaining:Math.max(0,game.endAt-now), pct=ph==='playing'?Math.min(100,remaining/duration*100):ph==='reveal'?0:100;
 document.querySelectorAll('[data-time]').forEach(el=>el.textContent=ph==='playing'?(now<game.startAt?'Préparez-vous':Math.ceil(remaining/1000)+' s'):['buzzed','paused'].includes(ph)?'En pause':ph==='reveal'?'Réponse révélée':'À vous de jouer');document.querySelectorAll('[data-progress]').forEach(el=>el.style.width=pct+'%');
 document.querySelectorAll('[data-mystery]').forEach(el=>el.style.filter=((game.effect||config.effect)==='image'||q?.target==='cover')&&ph!=='reveal'?`blur(${ph==='playing'?Math.max(0,remaining/duration*22):22}px)`:'none');
},150);
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const act=b.dataset.action,v=b.dataset.value;
 try{
 if(act==='music-game'&&v==='tyrolien'){
  if(!activeEvening){toast('Créez d’abord une soirée.');return;}
  await desk.unlock();
  tyrolienDraft={};
  const data=await requestRoom({room:activeEvening.code,token:activeEvening.token,game:'tyrolien'});
  openHostRoom(data,[],'normal','studio');
  return;
 }
 if(act.startsWith('ty-')){
  if(act==='ty-home'){view='home';render();return;}
  if(act==='ty-replay'){await playTyrolienClip();return;}
  if(act==='ty-resume')await desk.unlock();
  if(act==='ty-stop'&&!window.confirm('Terminer la partie du Tyrolien ?'))return;
  send({type:act,value:v,questionId:game?.tyrolien?.question?.id});
  return;
 }
 if(act==='close-modal'){closeModal();return;}
 if(act==='fullscreen'){if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();return;}
 if(act==='sound'){desk.muted=!desk.muted;write('declic.muted',desk.muted);render();return;}
 if(act==='create-evening'){
  if(changingEvening||eveningStatus!=='ready')return;
  if(activeEvening||savedMusicGame('declic.localGame'))eveningConfirmation();
  else await changeEvening();
  return;
 }
 if(act==='end-evening'){eveningConfirmation(true);return;}
 if(act==='cancel-evening'){document.querySelector('.evening-dialog')?.close();return;}
 if(act==='confirm-evening'||act==='confirm-end'){await changeEvening(act==='confirm-end');return;}
 if(act==='retry-evening'){await loadEvening();return;}
 if(act==='resume-evening'){await resumeEvening();return;}
 if(act==='settings'){view='settings';render();return;}
 if(act==='home'){if(role!=='host'&&game)return;view='home';void loadEvening();return;}
 if(act==='library'||act==='help'){view=act;render();return;}
 if(act==='music-game'){
  const phoneOnly=Object.hasOwn(SPECIAL_TRACKS,v)||v==='covers'||v==='survival'||v==='bingo'||v==='chain';
  Object.assign(config,{musicGame:v,universe:'music',source:'catalog',challenge:v==='covers'?'coverChoice':'title',effect:'normal'});
  if(v==='bingo')config.count=BINGO_CARD_SIZE;
  else if(config.count===BINGO_CARD_SIZE)config.count=15;
  if(phoneOnly){config.mode='phone';config.input='qcm';}
  config.settings=gameSettings({...config.settings,listening:v==='seconds'?'progressive':'continuous'});
  saveConfig();render();$('#multiplayer')?.scrollIntoView();return;
 }
 if(act==='effect'){config.effect=v;saveConfig();render();return;}
 if(act==='mode'){config.mode=v;if(v==='phone'&&config.input==='qcm'&&config.challenge==='both')config.challenge='title';saveConfig();render();return;}
 if(act==='add-team'){const id=randomUUID();config.teams.push({id,name:'Équipe '+(config.teams.length+1),key:'1234567890'.split('').find(k=>!config.teams.some(t=>t.key===k))});saveConfig();render();return;}
 if(act==='remove-team'){config.teams.splice(Number(v),1);saveConfig();render();return;}
 if(act==='launch'){await launch();return;}
 if(act==='new-game'){desk.stop();view='setup';render();return;}
 if(act==='screen'){const win=window.open('/tv','declic-public','width=1280,height=800');if(!win)toast('Autorisez les fenêtres pour ouvrir l’écran public.');return;}
 if(act==='copy-link'){
  const link=new URL('/join?code='+room,location.origin).href;
  try{
   await navigator.clipboard.writeText(link);
   toast('Lien d’invitation copié !');
  }catch{
   window.prompt('Copiez le lien d’invitation :',link);
  }
  return;
 }
 if(act==='join-page'){location.assign('/join');return;}
 if(act==='new-question'){questionForm({universe:config.universe});return;}
 if(act==='edit-question'){questionForm(custom.find(q=>q.id===v));return;}
 if(act==='delete-question'){const q=custom.find(q=>q.id===v);modal(`<h2>Retirer cette question ?</h2><p class="help">${esc(q?.prompt)}</p><p class="mini">Vous pourrez la recréer ou la réimporter depuis votre export.</p><div class="row" style="margin-top:22px"><button class="btn ghost" data-action="close-modal">Garder</button><button class="btn primary" data-action="confirm-delete" data-value="${esc(v)}">Retirer</button></div>`);return;}
 if(act==='confirm-delete'){custom=custom.filter(q=>q.id!==v);write('declic.library',custom);closeModal();render();toast('Question retirée.');return;}
 if(act==='export'){const blob=new Blob([JSON.stringify({version:1,questions:custom.filter(q=>q.universe==='music')},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='declic-questions.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);return;}
 if(act==='adjust'){modal(`<div class="top"><h2>Ajuster un score</h2><button class="iconbtn" data-action="close-modal" aria-label="Fermer">×</button></div><form id="adjust-form"><label class="field-label" for="adjustteam">Équipe</label><select name="team" id="adjustteam">${game.teams.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select><label class="field-label" for="adjustpoints">Points à ajouter ou retirer</label><input id="adjustpoints" name="points" type="number" min="-1000" max="1000" value="100" required><button class="btn primary full" type="submit" style="margin-top:20px">Appliquer</button></form>`);return;}
 if(act==='chain-bank'||act==='chain-vote'){send({type:act,candidate:v});return;}
 if(act==='bingo-sort'){
  const column=Number(v);
  bingoSort={column,direction:bingoSort.column===column?-bingoSort.direction:1};
  render();return;
 }
 if(act==='bingo-mark'){
  if(ws?.readyState===WebSocket.OPEN&&Date.now()<game.endAt){
   pendingBingo={id:currentQ()?.id,song:v};
   render();
  }
  send({type:act,song:v});return;
 }

 if(act==='joker'){send({type:'joker'});return;}
 if(act==='answer'){if(Date.now()>=game.endAt){toast('Le temps est écoulé !');return;}send({type:'answer',answer:v});return;}
 if(['play','pause','resume','good','bad','reveal','next','listen-more'].includes(act)){await desk.unlock();if(act==='play'){if(!currentQ())return;busy=true;render();try{await ensureAudio();}catch(error){audioError=error.message;toast(audioError);return;}finally{busy=false;render();}}send(act==='good'||act==='bad'?{type:'judge',correct:act==='good'}:{type:act,...(act==='play'&&game.settings?.bingo?{sourceDuration:desk.buffer?.duration}:{})});return;}
 }catch(err){toast(err.message||'Cette action n’a pas pu être effectuée.');}
});
document.addEventListener('input',e=>{
 if(e.target.id==='bingo-search'){
  bingoSearch=e.target.value;
  $('#bingo-rows').innerHTML=bingoRows();
 }
});
document.addEventListener('input',e=>{if(e.target.dataset.team!==undefined){config.teams[Number(e.target.dataset.team)].name=e.target.value;saveConfig();}if(e.target.dataset.key!==undefined){config.teams[Number(e.target.dataset.key)].key=e.target.value.toLowerCase();saveConfig();}});
document.addEventListener('change',async e=>{
 if(e.target.id==='source'){config.source=e.target.value;config.musicGame=null;if(config.challenge==='coverChoice')config.challenge='title';saveConfig();render();}
 if(e.target.id==='inputmode'){config.input=e.target.value;if(config.input==='qcm'&&config.challenge==='both')config.challenge='title';saveConfig();render();}
 if(e.target.id==='import-json')try{const file=e.target.files[0];if(!file)return;if(file.size>1e6)throw Error('Le JSON doit faire moins de 1 Mo.');const data=JSON.parse(await file.text());if(!Array.isArray(data.questions)||data.questions.length>100)throw Error('Le fichier doit contenir une liste de 100 questions maximum.');const imported=data.questions.map(q=>{if(q.universe!=='music'||!['audio','image','question','lyrics'].includes(q.kind)||typeof q.prompt!=='string'||q.prompt.length>300||typeof q.answer!=='string'||!q.answer.trim()||q.answer.length>180||!Array.isArray(q.options)||q.options.length!==4||q.options.some(o=>typeof o!=='string'||o.length>180)||!q.options.includes(q.answer)||!Number.isFinite(q.duration)||q.duration<5||q.duration>90||!Number.isFinite(q.points)||q.points<1||q.points>1000)throw Error('Une question est invalide. Aucun import effectué.');if(q.kind==='lyrics'&&(!Number.isFinite(q.cutAt)||q.cutAt<.1||q.cutAt>30||q.cutAt>=q.duration))throw Error('La coupure d’une question paroles est invalide.');return {cutAt:q.kind==='lyrics'?q.cutAt:undefined,id:randomUUID(),universe:q.universe,kind:q.kind,prompt:q.prompt,answer:q.answer,aliases:(Array.isArray(q.aliases)?q.aliases:[]).filter(x=>typeof x==='string').map(x=>x.slice(0,180)),options:q.options,duration:q.duration,points:q.points,emoji:typeof q.emoji==='string'?q.emoji.slice(0,80):undefined};});custom.push(...imported);write('declic.library',custom);render();toast('Questions importées. Réassociez les fichiers dans l’éditeur.');}catch(err){toast(err.message);}
});
document.addEventListener('submit',async e=>{e.preventDefault();const f=e.target,data=new FormData(f);
 if(f.id==='question-form')try{const answer=String(data.get('answer')).trim(),wrong=String(data.get('wrong')).split('\n').map(x=>x.trim()).filter(Boolean);if(!answer||wrong.length!==3||new Set([answer,...wrong].map(x=>x.toLowerCase())).size!==4)throw Error('Saisissez une bonne réponse et trois mauvaises réponses différentes.');const existing=custom.find(q=>q.id===f.dataset.id),id=existing?.id||randomUUID();let mediaKey=existing?.mediaKey,mediaType=existing?.mediaType;const file=data.get('media'),kind=data.get('kind');if(file?.size){if(file.size>30*1024*1024)throw Error('Le fichier doit faire moins de 30 Mo.');if(['audio','lyrics'].includes(kind)&&!file.type.startsWith('audio/'))throw Error('Choisissez un fichier audio pour ce type de question.');if(kind==='image'&&!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))throw Error('Choisissez une image JPG, PNG, WebP ou GIF.');mediaKey=id;mediaType=file.type;await storeBlob(id,file);if(assetUrls.has(id)){URL.revokeObjectURL(assetUrls.get(id));assetUrls.delete(id);}}if(['audio','lyrics'].includes(kind)&&(!mediaKey||!mediaType?.startsWith('audio/')))throw Error('Ajoutez un fichier audio.');if(kind==='image'&&(!mediaKey||!mediaType?.startsWith('image/')))throw Error('Ajoutez une image.');const cutAt=Number(data.get('cutAt'));if(kind==='lyrics'&&(!Number.isFinite(cutAt)||cutAt<.1||cutAt>30||cutAt>=Number(data.get('duration'))))throw Error('La coupure doit être comprise entre 0,1 et 30 s, avant la fin de la manche.');const options=[answer,...wrong];for(let i=3;i>0;i--){const j=Math.floor(Math.random()*(i+1));[options[i],options[j]]=[options[j],options[i]];}const q={id,universe:'music',kind,prompt:String(data.get('prompt')).trim(),answer,aliases:String(data.get('aliases')).split(';').map(x=>x.trim()).filter(Boolean),options,duration:Number(data.get('duration')),points:Number(data.get('points')),mediaKey,mediaType,cutAt:kind==='lyrics'?cutAt:undefined,title:String(data.get('title')||'').trim()||undefined,artist:String(data.get('artist')||'').trim()||undefined,target:'both'};custom=existing?custom.map(v=>v.id===id?q:v):[...custom,q];write('declic.library',custom);closeModal();render();toast('Question enregistrée !');}catch(err){toast(err.message);}
 if(f.id==='join-form'){const code=String(data.get('code')).trim().toUpperCase();if(!/^[A-Z2-9]{8}$/.test(code)){toast('Entrez le code de 8 caractères.');return;}room=code;const saved=JSON.parse(sessionStorage.getItem('declic.player.'+room)||'null');auth={type:'join',name:String(data.get('name')).trim(),token:saved?.token};teamId=saved?.id;busy=true;render();connect();}
 if(f.id==='answer-form'){send({type:'answer',answer:String(data.get('answer')||'').trim(),title:String(data.get('title')||'').trim(),artist:String(data.get('artist')||'').trim()});}
 if(f.id==='adjust-form'){send({type:'adjust',team:data.get('team'),points:Number(data.get('points'))});closeModal();}
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){closeModal();return;}
 if(role!=='host'||view!=='studio'||game?.mode!=='usb'||e.repeat||e.target.closest('input,textarea,select')||$('.dialog'))return;
 const t=game.teams.find(t=>t.key.toLowerCase()===e.key.toLowerCase());if(!t)return;e.preventDefault();if(game.phase==='lobby'){toast(t.name+' : buzzer reconnu !');void desk.unlock().then(()=>desk.jingle('buzz'));return;}send({type:'buzz',team:t.id});
});
function catalogScreen(){return `<main class="library"><div class="row"><div><span class="eyebrow">LA BOÎTE À TUBES</span><h1>Trouvez les sons de votre soirée.</h1><p class="help">Recherche de titres et de playlists Deezer. Les extraits sont écoutés à la demande.</p></div><div class="row"><button class="btn ghost" data-action="library">Mes questions</button><button class="btn primary" data-action="v2-use-catalog">Utiliser ma sélection →</button></div></div><form id="catalog-search" class="catalog-search"><input name="query" placeholder="Un artiste, un titre…" aria-label="Rechercher des musiques" value="${esc(catalogQuery)}" minlength="2" required maxlength="120"><select name="type" aria-label="Type de recherche"><option value="tracks" ${catalogSearchType==='tracks'?'selected':''}>Titres</option><option value="playlists" ${catalogSearchType==='playlists'?'selected':''}>Playlists</option></select><button class="btn primary" ${busy?'disabled':''}>Rechercher</button></form><form id="playlist-import" class="playlist-import"><label for="playlist-url">Ou collez le lien d’une playlist Deezer publique</label><div class="row"><input id="playlist-url" name="url" placeholder="https://www.deezer.com/fr/playlist/…" required><button class="btn ghost" ${busy?'disabled':''}>Importer</button></div></form>${catalogMessage?`<div class="catalog-message" role="status">${esc(catalogMessage)}</div>`:''}<div class="catalog-meta"><strong>${esc(catalogPool.name||'Ma sélection')} · ${catalogPool.tracks.length} titre(s)</strong><div class="row"><button class="textbtn" data-action="v2-add-all" ${!catalogResults.tracks?.length?'disabled':''}>＋ Tous les résultats</button><button class="textbtn" data-action="v2-clear-pool" ${!catalogPool.tracks.length?'disabled':''}>Vider la sélection</button></div></div><div id="catalog-player" class="callout hidden" role="status"><span></span> <button class="btn ghost" data-action="v2-stop-preview">■ Arrêter l’écoute</button></div><div class="track-list">${(catalogSearchType==='playlists'?catalogResults.playlists:catalogResults.tracks||[]).map(t=>catalogSearchType==='playlists'?`<article class="track-row"><img src="${esc(t.artwork||'')}" alt="" loading="lazy"><div><strong>${esc(t.title)}</strong><small>${esc(t.author||'')} · ${t.tracks||'?'} titres</small></div><button class="btn ghost" data-action="v2-playlist" data-value="${esc(t.id)}">Importer</button></article>`:trackRow(t)).join('')}</div>${!catalogResults.tracks?.length&&!catalogResults.playlists?.length?'<div class="empty">Recherchez un artiste ou chargez vos thèmes depuis le studio.<br>Votre sélection est conservée dans ce navigateur.</div>':''}${catalogPool.tracks.length?`<div class="sectiontitle"><h2>Dans votre sélection</h2><span class="badge">${catalogPool.tracks.length} TITRES</span></div><div class="track-list">${catalogPool.tracks.map(t=>trackRow(t,true)).join('')}</div>`:''}<div class="callout">La connexion musicale active est Deezer. Spotify et Apple Music ne sont pas connectés dans cette version. Les fichiers audio personnels restent disponibles dans « Mes questions ».</div></main>`;}
function trackRow(t,inPool=false){const added=catalogPool.tracks.some(v=>v.id===t.id);return `<article class="track-row"><img src="${esc(t.artwork||'')}" alt="" loading="lazy"><div><strong>${esc(t.title)}</strong><small>${esc(t.artist)} ${t.explicit?'<b class="explicit">E</b>':''}</small><a href="${esc(t.link)}" target="_blank" rel="noopener noreferrer">Sur Deezer ↗</a></div><button class="btn ghost" data-action="v2-preview" data-value="${esc(t.id)}" aria-label="Écouter ${esc(t.title)}">▶</button><button class="btn ${inPool?'ghost':added?'good':'primary'}" data-action="${inPool?'v2-remove-track':'v2-add-track'}" data-value="${esc(t.id)}" ${!inPool&&added?'disabled':''}>${inPool?'Retirer':added?'✓ Ajouté':'＋ Ajouter'}</button></article>`;}
function scoreBreakdown(r){const labels={title:'Titre',artist:'Artiste',answer:'Réponse',speed:'Rapidité',streak:'Série'};return `<div class="score-breakdown">${Object.entries(r.breakdown||{}).filter(([,v])=>v>0).map(([id,v])=>`<span>${labels[id]} <b>+${v}</b></span>`).join('')}</div>`;}
function historyScreen(){return `<main class="library"><div class="row"><div><span class="eyebrow">CHAQUE DÉCLIC COMPTE</span><h1>Le bilan de la soirée.</h1></div><button class="btn ghost right" data-action="v2-return">Revenir au jeu</button><button class="btn primary" data-action="v2-export-results">Exporter le bilan</button></div><div class="results-leaders">${leaderboard()}</div>${(game?.history||[]).map(h=>`<details class="round-history" open><summary><span class="step">${h.index+1}</span>${esc(h.question.title||h.question.answer)}${h.question.artist?' · '+esc(h.question.artist):''}</summary>${questionExplanation(h.question)}${h.results.map(t=>`<div class="history-team"><strong>${esc(t.name)}</strong><span>+${t.result.total||0} pts</span>${scoreBreakdown(t.result)}</div>`).join('')}</details>`).join('')||'<div class="empty">Le détail sera disponible après la première révélation.</div>'}</main>`;}
function persistPool(){write('declic.musicPool',catalogPool);}
async function prepareLibrarySelection(selection){
 if(busy||!selection.length)return;
 busy=true;
 toast('Recherche des extraits disponibles…');
 try{
  const pages=await Promise.all(selection.map(([id])=>hostRequest('/api/library/candidates?playlist='+encodeURIComponent(id))));
  const candidates=shuffle([...new Map(pages.flatMap(page=>page.tracks).map(track=>[track.id,track])).values()]).slice(0,32);
  const tracks=[];
  for(let i=0;i<candidates.length;i+=4){
   const matches=await Promise.allSettled(candidates.slice(i,i+4).map(async candidate=>{
    const data=await apiJSON('/api/music/search?q='+encodeURIComponent(candidate.title+' '+candidate.artist));
    const hit=matchSpecialTrack(data.tracks||[],candidate.title,candidate.artist);
    return hit?{...hit,year:candidate.year,work:candidate.work}:null;
   }));
   for(const response of matches)if(response.status==='fulfilled'&&response.value)tracks.push(response.value);
  }
  if(!tracks.length)throw Error('Aucun extrait correspondant trouvé dans cette sélection. Essayez une autre playlist.');
  catalogPool={name:selection.map(([,name])=>name).join(' + '),tracks,themeKey:''};
  config.catalogFrom='explorer';
  config.source='catalog';
  persistPool();
  saveConfig();
  catalogMessage=`${tracks.length} extraits trouvés dans les playlists sélectionnées.`;
  view='setup';
  render();
 }catch(error){toast(error.message);}
 finally{busy=false;}
}
async function loadSpecialQuestions(mode){
 const entries=[];
 const selected=config.catalogFrom==='explorer'?catalogPool.tracks:[];
 if(mode==='timeline'&&selected.filter(track=>track.year>0).length>=6){
  const entries=selected.filter(track=>track.year>0).map(track=>({track,entry:[track.title,track.artist,track.year]}));
  return specialQuestions(mode,entries,{...config,count:Number(config.timelineCount||5)+1});
 }
 if(['soundtrack','tvThemes','allSoundtracks'].includes(mode)&&selected.filter(track=>track.work).length>=5){
  const entries=selected.filter(track=>track.work).map(track=>({track,entry:[track.title,track.artist,track.work]}));
  return specialQuestions(mode,entries,config);
 }
 const source=mode==='allSoundtracks'?[...SPECIAL_TRACKS.soundtrack,...SPECIAL_TRACKS.tvThemes]:SPECIAL_TRACKS[mode];
 const distinct=mode==='allSoundtracks'?[...new Map(source.map(entry=>[entry[2],entry])).values()]:source;
 const seeds=shuffle(distinct).map(entry=>{
  if(mode!=='coversQuiz'||config.coversDirection!=='original')return entry;
  const [title,cover,original]=entry;
  return [title,original,cover];
 });
 const needed=mode==='timeline'?Math.max(6,Number(config.timelineCount||5)+1):config.count;
 for(let i=0;i<seeds.length&&entries.length<needed;i+=3){
  const batch=await Promise.allSettled(seeds.slice(i,i+3).map(async entry=>{
   const [title,artist,,alternateTitle]=entry;
   const data=await apiJSON('/api/music/search?q='+encodeURIComponent(title+' '+artist));
   const track=matchSpecialTrack(data.tracks||[],title,artist,alternateTitle);
   return track?{entry,track}:null;
  }));
  for(const item of batch)if(item.status==='fulfilled'&&item.value)entries.push(item.value);
 }
 if(!entries.length)throw Error('Aucun extrait de cette sélection n’est disponible sur Deezer pour le moment.');
 return specialQuestions(mode,entries,{...config,count:needed});
}
async function apiJSON(path){const res=await fetch(path,{signal:AbortSignal.timeout(45000)});const data=await res.json();if(!res.ok)throw Error(data.error||'Le catalogue n’a pas répondu. Réessayez dans un instant.');return data;}
async function loadThemes(){catalogMessage='Recherche des extraits disponibles…';render();const key=config.themes.join(','),data=await apiJSON('/api/music/selection?themes='+encodeURIComponent(key));catalogPool={name:data.name,tracks:data.tracks,themeKey:key};config.catalogFrom='themes';config.source='catalog';persistPool();saveConfig();catalogMessage=`${data.tracks.length} titres avec un extrait disponible. Les titres seront mélangés au lancement.`;}
async function loadPlaylist(id){const data=await apiJSON('/api/music/playlist?id='+encodeURIComponent(id));if(!data.tracks.length)throw Error('Cette playlist ne contient pas d’extrait disponible. Essayez une autre sélection.');catalogPool={name:data.name,tracks:data.tracks,themeKey:''};config.catalogFrom='explorer';config.source='catalog';catalogResults={tracks:data.tracks,playlists:[]};catalogSearchType='tracks';persistPool();saveConfig();catalogMessage=`${data.tracks.length} titres jouables importés${data.limited?' parmi les 100 premiers de la playlist':''}.`;}
async function withBusy(task){if(busy)return;busy=true;render();try{await task();}catch(e){catalogMessage=e.message||'Impossible de charger cette sélection.';toast(catalogMessage);}finally{busy=false;render();}}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const act=b.dataset.action,v=b.dataset.value;
 if(view==='catalog'&&act!=='v2-preview'){desk.stop();$('#catalog-player')?.classList.add('hidden');}
 if(act==='v3-new-lyrics'){questionForm({universe:'music',kind:'lyrics',prompt:'Complétez : « … ___ ».'});return;}
 if(act==='v3-buzz'){send({type:'buzz'});return;}
 if(act==='v2-catalog'){view='catalog';render();}
 if(act==='music-library'){view='music-library';render();}
 if(act==='v2-return'){view=role==='player'?'phone':'studio';render();}
 if(act==='v2-history'){view='history';render();}
 if(act==='v2-export-results'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({name:'Déclic !',date:new Date().toISOString(),teams:game.teams.map(({id,name,score})=>({id,name,score})),rounds:game.history},null,2)],{type:'application/json'}));a.download='declic-bilan.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
 if(act==='v2-theme'){if(config.challenge==='lyrics')config.challenge='title';if(config.themes.includes(v)){if(config.themes.length===1){toast('Gardez au moins une ambiance.');return;}config.themes=config.themes.filter(id=>id!==v);}else{if(config.themes.length>=3){toast('Vous pouvez mélanger jusqu’à trois ambiances.');return;}config.themes.push(v);}config.catalogFrom='themes';config.source='catalog';saveConfig();render();}
 if(act==='v2-challenge'){config.challenge=v;if(v==='lyrics')config.source='custom';if(!(['bingo','survival','blind'].includes(config.musicGame)&&['title','artist',...(config.musicGame==='blind'?['both']:[])].includes(v)))config.musicGame=null;if(v==='both'&&config.mode==='phone')config.input='text';saveConfig();render();}
 if(act==='v2-load-themes')await withBusy(loadThemes);
 if(act==='v2-use-catalog'){if(!activeEvening){view='home';render();toast('Créez une soirée pour utiliser cette sélection.');return;}if(!catalogPool.tracks.length){toast('Ajoutez des titres ou importez une playlist.');return;}config.catalogFrom='explorer';config.source='catalog';config.universe='music';saveConfig();view='setup';render();}
 if(act==='v2-add-track'){const t=catalogResults.tracks.find(t=>t.id===v);if(t&&!catalogPool.tracks.some(x=>x.id===v)){if(catalogPool.tracks.length>=100){toast('100 titres maximum par sélection.');return;}catalogPool={name:'Ma sélection',tracks:[...catalogPool.tracks,t],themeKey:''};config.catalogFrom='explorer';config.source='catalog';persistPool();saveConfig();render();}}
 if(act==='v2-remove-track'){catalogPool.tracks=catalogPool.tracks.filter(t=>t.id!==v);persistPool();render();}
 if(act==='v2-add-all'){const all=[...new Map([...catalogPool.tracks,...catalogResults.tracks].map(t=>[t.id,t])).values()].slice(0,100);catalogPool={name:'Ma sélection',tracks:all,themeKey:''};config.catalogFrom='explorer';persistPool();saveConfig();render();}
 if(act==='v2-clear-pool'){catalogPool={name:'',tracks:[],themeKey:''};persistPool();render();}
 if(act==='v2-playlist')await withBusy(()=>loadPlaylist(v));
 if(act==='v2-stop-preview'){desk.stop();$('#catalog-player')?.classList.add('hidden');}
 if(act==='v2-preview'){const t=[...(catalogResults.tracks||[]),...catalogPool.tracks].find(t=>t.id===v),player=$('#catalog-player');if(t&&player){player.classList.remove('hidden');player.querySelector('span').textContent='Chargement de '+t.title+'…';try{await desk.load({id:'preview-'+v,audioUrl:t.preview},null,'normal');if($('#catalog-player')!==player||player.classList.contains('hidden')||desk.id!=='preview-'+v)return;desk.play();if(desk.source)desk.source.loop=false;player.querySelector('span').textContent='♫ '+t.title+' · '+t.artist;}catch(err){player.querySelector('span').textContent=err.message;}}}
 if(act==='v2-judge'){await desk.unlock();send({type:'judge',correct:true,part:v});}
});
document.addEventListener('change',e=>{const el=e.target;if(el.dataset.config){const k=el.dataset.config;config[k]=k==='explicit'?!el.checked:['count','duration'].includes(k)?Number(el.value):el.value;saveConfig();if(k!=='explicit')render();}if(el.dataset.setting){const k=el.dataset.setting;config.settings[k]=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;config.settings=gameSettings(config.settings);saveConfig();}});
document.addEventListener('submit',async e=>{const form=e.target;if(!['catalog-search','playlist-import'].includes(form.id))return;e.preventDefault();const data=new FormData(form);
 if(form.id==='catalog-search'){catalogQuery=String(data.get('query')).trim();catalogSearchType=data.get('type');catalogMessage='Recherche en cours…';await withBusy(async()=>{catalogResults=await apiJSON('/api/music/search?q='+encodeURIComponent(catalogQuery)+'&type='+catalogSearchType);catalogMessage=catalogSearchType==='playlists'?`${catalogResults.playlists.length} playlist(s) trouvée(s).`:`${catalogResults.tracks.length} titre(s) avec un extrait disponible.`;});}
 if(form.id==='playlist-import'){const value=String(data.get('url')).trim();let id=value;if(!/^\d+$/.test(id)){try{const u=new URL(value);if(!/(^|\.)deezer\.com$/.test(u.hostname))throw Error();id=u.pathname.match(/\/playlist\/(\d+)/)?.[1];}catch{id=null;}}if(!id){catalogMessage='Collez un lien complet de playlist Deezer publique (deezer.com/…/playlist/123). Les liens Spotify ne sont pas pris en charge.';render();return;}await withBusy(()=>loadPlaylist(id));}
});

function listeningMarkup(){const q=currentQ();if(!q||!['playing','paused','buzzed'].includes(game.phase))return '';if(isProgressive(game,q))return `<div class="listening-card"><strong>Écoute ${(game.listenStep||0)+1}/4 · ${LISTEN_STEPS[game.listenStep||0]} seconde(s)</strong><span>${[100,80,60,40][game.listenStep||0]} % des points de réponse</span><small data-listen-status></small></div>`;if(q.kind==='lyrics')return `<div class="listening-card"><strong>🎙️ La musique s’arrête… à vous de continuer !</strong><small data-listen-status></small></div>`;return '';}
function buzzerPanel(){return `<button class="phone-buzzer" data-action="v3-buzz" data-buzz-button disabled>⚡ BUZZ !</button><p class="help" data-buzz-status>Attendez le signal…</p>`;}
function updateBuzzer(){const button=$('[data-buzz-button]'),label=$('[data-buzz-status]');if(!button||!game)return;const now=Date.now(),blocked=game.blocked?.includes(teamId),wait=Math.ceil(((game.cooldowns?.[teamId]||0)-now)/1000),buzzed=game.phase==='buzzed',enabled=connected&&game.phase==='playing'&&now>=game.startAt&&now<game.endAt&&!blocked&&wait<=0;button.disabled=!enabled;label.textContent=buzzed?(game.buzz===teamId?'C’est à vous ! Répondez à voix haute.':(game.teams.find(t=>t.id===game.buzz)?.name||'Une équipe')+' a buzzé.'):blocked?'Votre équipe est bloquée pour cette question.':wait>0?'Rebuzz possible dans '+wait+' s.':enabled?'Appuyez puis donnez votre réponse à voix haute.':'Attendez le signal…';}

function questionExplanation(q){return q?.explanation?`<p>${esc(q.explanation)}</p>`:'';}
const gameIcons={
 tyrolien:'<path d="M2 20 9 8l4 7 3-5 6 10H2Zm1-8 17-8m-5 2 2 4"/>',
 bingo:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18"/>',
 timeline:'<path d="M3 12h18m-4-4 4 4-4 4M6 9v6m5-9v12"/>',
 coversQuiz:'<path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4"/>',
 soundtrack:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 3v18M17 3v18M3 9h4m10 0h4M3 15h4m10 0h4"/>',
 blind:'<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="12" width="5" height="8" rx="2"/><rect x="16" y="12" width="5" height="8" rx="2"/>',
 covers:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 survival:'<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>'
};
function musicGames(){
 const cards=MUSIC_GAMES.map(([id,name,description])=>{
  const selected=config.musicGame===id&&config.source==='catalog';
  return `<button class="game-picker-card" data-action="music-game" data-value="${id}" aria-pressed="${selected}">
   <span class="game-picker-icon">${homeIcon(id)}</span>
   <span class="game-picker-arrow">${homeIcon('arrow')}</span>
   <strong>${name}</strong><small>${description}</small>
  </button>`;
 }).join('');
 return `<section id="music-games"><h1>Choisir un jeu</h1><div class="game-picker-grid">${cards}</div></section>`;
}
function invitationMarkup(code=room){
 if(!code)return '';
 if(invitationCode!==code){
  const qr=qrcode(0,'M');
  qr.addData(location.origin+'/join?code='+code);
  qr.make();
  invitationSvg=qr.createSvgTag(4,16,'Scannez pour rejoindre la soirée');
  invitationCode=code;
 }
 return `<div class="answerbox room-code">${esc(code)}</div>${invitationSvg}`;
}
const homeIcons={
 wave:'<path d="M3 10v4m4-7v10m5-14v18m5-14v10m4-7v4"/>',
 play:'<path d="m9 5 11 7-11 7z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 music:'<path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="18" cy="16" rx="3" ry="2"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="m10 3-1 3-3 1-3-1-1 3 2 2v2l-2 2 1 3 3-1 3 1 1 3h4l1-3 3-1 3 1 1-3-2-2v-2l2-2-1-3-3 1-3-1-1-3z"/>',
 arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>'
};
function homeIcon(name){
 return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${homeIcons[name]??gameIcons[name]}</svg>`;
}
function homeCard(action,icon,label,detail='',primary=false){
 return `<button class="host-card${primary?' host-card-primary':''}" data-action="${action}" ${changingEvening?'disabled':''}>
  <span class="host-card-icon">${homeIcon(icon)}</span>
  <span><strong>${label}</strong>${detail?`<small>${detail}</small>`:''}</span>
  <span class="host-card-arrow">${homeIcon('arrow')}</span>
 </button>`;
}
function home(){
 const active=activeEvening||savedMusicGame('declic.localGame');
 const ready=eveningStatus==='ready';
 return `<div class="host-home">
  <header class="host-brand"><span>${homeIcon('wave')}</span> DÉCLIC PARTY</header>
  <main class="host-main">
   <section class="host-welcome">
    <div class="host-equalizer" aria-hidden="true">${Array.from({length:9},()=>'<i></i>').join('')}</div>
    <h1>Que la fête commence !</h1>
    <p>La musique rassemble, à vous de jouer.</p>
   </section>
   <div class="host-actions">
    ${changingEvening?'<p class="host-status" role="status">Mise à jour de la soirée…</p>':
      eveningStatus==='loading'?'<p class="host-status" role="status">Récupération de la soirée…</p>':
      eveningStatus==='error'?'<div class="host-status" role="status">Impossible de vérifier la soirée active. <button class="host-link" data-action="retry-evening">Réessayer</button></div>':
      active?homeCard('resume-evening','play','Reprendre la soirée','Soirée en cours',true):
      homeCard('create-evening','plus','Créer une soirée','C’est parti !',true)}
    <div class="host-secondary">
     ${ready&&active?homeCard('create-evening','plus','Créer une soirée'):''}
     ${homeCard('music-library','music','Bibliothèque musicale')}
     ${homeCard('settings','gear','Paramètres')}
    </div>
    ${ready&&activeEvening&&!changingEvening?'<button class="host-link host-end" data-action="end-evening">Terminer la soirée</button>':''}
   </div>
  </main>
  <footer class="host-join">Vous êtes participant ? <a class="host-link" href="/join">Rejoindre une soirée ${homeIcon('arrow')}</a></footer>
 </div>`;
}
function settingsScreen(){
 return `<main class="library"><h1>Paramètres</h1>
  <button class="btn ghost" data-action="sound" aria-pressed="${!desk.muted}">${desk.muted?'♪ Jingles coupés':'♫ Jingles actifs'}</button>
 </main>`;
}
function setupScreen(){
 const invite=room&&auth?.type==='host'&&config.mode==='phone';
 return `${invite?`<section class="qcard"><h2>Inviter les joueurs</h2>${invitationMarkup()}<div class="row"><button class="btn ghost" data-action="copy-link">Copier le lien</button><button class="btn ghost" data-action="screen">Écran public</button></div><p class="mini">${game?.teams.length||0} équipe(s) connectée(s)</p></section>`:''}<div id="multiplayer">${musicGames()}${fullHome()}</div>`;
}

function musicGameSettings(){
 if(config.musicGame==='timeline')return `<label class="field-label">Mode<select data-config="timelineMode">
 <option value="collective">Frise collective</option><option value="individual" ${config.timelineMode==='individual'?'selected':''}>Frise individuelle</option>
 </select></label><label class="field-label">Nombre d’extraits souhaité<input type="number" data-config="timelineCount" min="5" max="${SPECIAL_TRACKS.timeline.length-1}" value="${Math.min(SPECIAL_TRACKS.timeline.length-1,Math.max(5,Number(config.timelineCount)||5))}"></label>`;
 if(config.musicGame==='soundtrack')return `<label class="field-label">Sélection<select data-config="soundtrackCategory">
 <option value="soundtrack">Films et séries</option>
 <option value="tvThemes" ${config.soundtrackCategory==='tvThemes'?'selected':''}>Génériques TV</option>
 <option value="allSoundtracks" ${config.soundtrackCategory==='allSoundtracks'?'selected':''}>Films, séries et génériques TV</option>
 </select></label><label class="field-label">Propositions<select data-config="soundtrackChoices">${[2,3,4,5].map(n=>`<option value="${n}" ${n===Number(config.soundtrackChoices||4)?'selected':''}>${n}</option>`).join('')}</select></label>`;
 if(config.musicGame==='coversQuiz')return `<label class="field-label">Version diffusée<select data-config="coversDirection">
 <option value="cover">Écouter la reprise · trouver l’interprète original</option>
 <option value="original" ${config.coversDirection==='original'?'selected':''}>Écouter l’original · trouver l’interprète de la reprise</option>
 </select></label>`;
 return '';
}

function gameRules(qs){return `<aside class="sidebar"><span class="eyebrow">LE STUDIO</span><h2>Les règles du jeu</h2>${musicGameSettings()}<div class="segmented"><button data-action="mode" data-value="usb" class="${config.mode==='usb'?'active':''}">◉ Buzzers USB</button><button data-action="mode" data-value="phone" class="${config.mode==='phone'?'active':''}">▯ Téléphones</button></div><p class="help">${config.mode==='usb'?'Les équipes buzzent. Vous validez leurs réponses.':'Un code à partager : buzzer et répondre à voix haute, ou jouer en QCM et par écrit.'}</p>${config.mode==='phone'?`<label class="field-label" for="inputmode">Réponse sur téléphone</label><select id="inputmode"><option value="buzzer" ${config.input==='buzzer'?'selected':''}>Buzzer · réponse orale</option><option value="qcm" ${config.input==='qcm'?'selected':''}>QCM · 4 choix</option><option value="text" ${config.input==='text'?'selected':''}>Écrit · titre et artiste séparés</option></select>`:`<span class="field-label">Les équipes · touches personnalisables</span>${config.teams.map((t,i)=>`<div class="teamrow"><span class="avatar" style="--team:${colors[i]}">${icons[i]}</span><input aria-label="Nom de l’équipe ${i+1}" data-team="${i}" value="${esc(t.name)}" maxlength="24"><input class="customkey" aria-label="Touche de l’équipe ${i+1}" data-key="${i}" value="${esc(t.key)}" maxlength="1"><button class="iconbtn" aria-label="Retirer l’équipe ${i+1}" data-action="remove-team" data-value="${i}" ${config.teams.length<=2?'disabled':''}>×</button></div>`).join('')}<button class="textbtn" data-action="add-team" ${config.teams.length>=10?'disabled':''}>＋ Ajouter une équipe</button>`}<div class="divider"></div>${config.musicGame==='survival'?'<label class="field-label">Vies au départ<input type="number" min="1" max="5" data-setting="survivalLives" value="'+config.settings.survivalLives+'"></label>':''}<label class="field-label" for="source">Les contenus</label><select id="source">${config.challenge!=='lyrics'?`<option value="catalog" ${config.source==='catalog'?'selected':''}>Catalogue · extraits Deezer</option>`:''}<option value="custom" ${config.source==='custom'?'selected':''}>Mes questions personnelles</option><option value="demo" ${config.source==='demo'?'selected':''}>Découverte · démonstration</option></select>${config.source==='catalog'?`<p class="mini" style="margin-top:10px">${catalogPool.tracks.length?`${catalogPool.tracks.length} titres chargés · ${esc(catalogPool.name)}`:'Vos thèmes seront chargés au lancement.'}</p><button class="textbtn" data-action="v2-load-themes" ${busy?'disabled':''}>↻ Charger les thèmes choisis</button>`:`<p class="mini" style="margin-top:10px">${qs.length} questions disponibles dans cette sélection.</p>`}<label class="field-label">Écoute<select aria-label="Écoute" data-setting="listening"><option value="continuous" ${config.settings.listening!=='progressive'?'selected':''}>Extrait continu</option><option value="progressive" ${config.settings.listening==='progressive'?'selected':''}>Progressive · 1, 2, 5 puis 10 s</option></select></label><p class="mini">En progressif : 100 %, 80 %, 60 %, 40 % des points de réponse. Pas de bonus de rapidité. Seuls les défis audio utilisent ces paliers.</p><div class="two-fields"><label>${config.musicGame==='bingo'?'Extraits':'Questions'}<select data-config="count">${(config.musicGame==='bingo'?[BINGO_CARD_SIZE]:[5,10,15,20]).map(n=>`<option ${config.count===n?'selected':''}>${n}</option>`).join('')}</select></label><label>Durée<select data-config="duration">${[10,15,20,30].map(n=>`<option value="${n}" ${config.duration===n?'selected':''}>${n} s</option>`).join('')}</select></label></div><label class="field-label" for="difficulty">Sélection des titres</label><select id="difficulty" data-config="difficulty"><option value="easy" ${config.difficulty==='easy'?'selected':''}>Les plus populaires</option><option value="balanced" ${config.difficulty==='balanced'?'selected':''}>Un mélange équilibré</option><option value="hard" ${config.difficulty==='hard'?'selected':''}>Des titres moins connus</option></select><details class="settings-details"><summary>⚙ Points et déroulement</summary><label class="checkboxline"><input type="checkbox" data-setting="jokers" ${config.settings.jokers?'checked':''}> Activer les jokers de ce jeu</label><div class="two-fields"><label>Points titre<input type="number" min="1" max="1000" data-setting="titlePoints" value="${config.settings.titlePoints}"></label><label>Points artiste<input type="number" min="1" max="1000" data-setting="artistPoints" value="${config.settings.artistPoints}"></label></div><label class="checkboxline"><input type="checkbox" data-setting="speed" ${config.settings.speed?'checked':''}> Bonus de rapidité · jusqu’à 50 pts</label><label class="checkboxline"><input type="checkbox" data-setting="streak" ${config.settings.streak?'checked':''}> Bonus de série · jusqu’à 50 pts</label>${config.mode==='usb'||config.input==='buzzer'?`<label class="field-label">Après une mauvaise réponse<select data-setting="rebuzz">${[['round','Bloqué pour cette question'],['none','Rebuzz immédiat'],['3','Rebuzz après 3 secondes'],['5','Rebuzz après 5 secondes'],['10','Rebuzz après 10 secondes']].map(([id,name])=>`<option value="${id}" ${config.settings.rebuzz===id?'selected':''}>${name}</option>`).join('')}</select></label><label class="field-label">Reprise de la musique<select data-setting="resume"><option value="auto" ${config.settings.resume==='auto'?'selected':''}>Automatique après validation</option><option value="manual" ${config.settings.resume==='manual'?'selected':''}>Manuelle · je garde la main</option></select></label>`:''}<label class="checkboxline"><input type="checkbox" data-setting="autoNext" ${config.settings.autoNext?'checked':''}> Question suivante après 8 secondes</label><label class="checkboxline"><input type="checkbox" data-config="explicit" ${config.explicit===false?'checked':''}> Exclure les titres marqués explicites</label></details>${catalogMessage?`<div class="catalog-message" role="status">${esc(catalogMessage)}</div>`:''}<button class="btn primary full" data-action="launch" ${busy?'disabled':''}>${busy?'Préparation des extraits…':'Lancer la soirée →'}</button><p class="caption">${config.mode==='usb'?'2 à 10 équipes · clavier ou buzzer qui émule une touche':'Jusqu’à 300 participants · Internet nécessaire'}<br>${config.source==='catalog'?'Extraits de 30 s maximum. Disponibilité selon Deezer.':'Vos contenus personnels restent sur ce PC.'}</p></aside>`;}

const params=new URLSearchParams(location.search);
if(location.pathname==='/tv'){
 role='tv';view='tv';
 room=(params.get('code')||'').toUpperCase();
 if(/^[A-Z2-9]{8}$/.test(room)){auth={type:'tv'};connect();}
 else{room=null;channel.postMessage({type:'request'});}
}
else if(location.pathname==='/join'){
 view='join';room=(params.get('code')||'').toUpperCase();
 const saved=readPlayerSession(room);
 if(saved){role='player';view='phone';teamId=saved.id;auth={type:'join',token:saved.token};connect();}
}
function readPlayerSession(code){
 try{return JSON.parse(sessionStorage.getItem('declic.player.'+code)||'null');}
 catch{return null;}
}
render();
if(view==='home')void loadEvening();

document.addEventListener('submit',async event=>{
 const form=event.target;
 if(form.id!=='ty-start-form')return;
 event.preventDefault();
 const data=new FormData(form),count=Number(data.get('count'));
 const assignments=Object.fromEntries([...data].filter(([key,value])=>key.startsWith('team-')&&value)
  .map(([key,value])=>[key.slice(5),value]));
 try{
  await desk.unlock();
  send({type:'ty-start',names:Array.from({length:count},(_,index)=>data.get('name-'+index)),
   levels:Number(data.get('levels')),seconds:Number(data.get('seconds')),bonuses:data.has('bonuses'),assignments});
 }catch(error){toast(error.message);}
});
