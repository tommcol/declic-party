import {returnToLobby} from './engine.js';
import {playShowCue,playlistShowTheme,showRoundSummary,showScene,showVenue,stageReaction,updateLobbyArrivals,updateShow} from './show.js';
import {teamCards,teamGather,teamHost} from './team-ui.js';
import {changeRoulette,rouletteView,rouletteAdvanceAt} from './roulette.js';
import {tyrolienScreen,mountainPanel} from './tyrolien-ui.js';
import {openMusicLibrary} from './music-library.js';
import {THEMES,CHALLENGES,musicQuestions,shuffle,SPECIAL_TRACKS,matchSpecialTrack,specialQuestions} from './catalog.js';
import {randomUUID,createGame,applyAction,publicGame,DEMO,targets,gameSettings,isBuzzer,isProgressive,LISTEN_STEPS,audioRemaining,listeningLimit,roundStatistics,bingoProgress,bingoGrandWinners,BINGO_CARD_SIZE} from './engine.js';
import qrcode from './qrcode.js';
import {SoundDesk,storeBlob,getBlob} from './audio.js';
const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const defaultTeams=()=>['Les Disco','Les Rockstars','Les Paillettes','Les Incollables'].map((name,index)=>({id:String(index),name,key:String(index+1)}));
let config=read('declic.config',{universe:'music',mode:'phone',input:'qcm',effect:'normal',source:'demo',teams:defaultTeams()});
config.musicGame??='blind';
const gamePreferences=read('declic.gamePreferences',{});
let advancedOpen=false;
const gamePreferenceKeys=['input','source','challenge','effect','count','duration','difficulty','explicit','settings','timelineMode','timelineCount','soundtrackCategory','soundtrackChoices','coversDirection','mountainLevels','mountainAttacks'];
let invitationCode=null,invitationSvg='',tyrolienDraft={};
let teamWakeLock=null,teamWakePending=false,teamFullscreen=false,choosingWhileGathering=false;
const openTeamDetails=new Set();
const safeTeamPhases=['lobby','finished','paused'];

function myPlannedTeam(){
 return game?.teamPlan?.groups.find(group=>group.members.some(member=>member.id===teamId));
}
async function syncTeamWake(){
 const active=role==='player'&&game?.teamPlan?.gather&&safeTeamPhases.includes(game.phase);
 if(!active){
  if(teamWakeLock){void teamWakeLock.release().catch(()=>{});teamWakeLock=null;}
  if(teamFullscreen&&document.fullscreenElement===document.documentElement)void document.exitFullscreen().catch(()=>{});
  teamFullscreen=false;
  choosingWhileGathering=false;
  return;
 }
 if(!navigator.wakeLock||teamWakeLock||teamWakePending||document.visibilityState!=='visible')return;
 teamWakePending=true;
 try{
  const lock=await navigator.wakeLock.request('screen');
  teamWakeLock=lock;
  lock.addEventListener('release',()=>{if(teamWakeLock===lock)teamWakeLock=null;},{once:true});
  if(!game?.teamPlan?.gather)await lock.release();
 }catch{/* Le fond coloré reste visible même sans maintien de l’écran. */}
 finally{teamWakePending=false;}
}
document.addEventListener('visibilitychange',()=>void syncTeamWake());
function gatherIdentity(plan){
 const group=myPlannedTeam();
 return group?JSON.stringify([group.id,group.name,group.color,group.icon]):String(plan.open&&plan.mode==='free');
}
function previousTeamGames(){
 const entries=game?.teamResults||[];
 if(!entries.length)return '';
 return `<details class="qcard team-results"><summary>Résultats des jeux en équipes</summary>
 ${entries.map(entry=>`<h4>${esc(MUSIC_GAMES.find(([id])=>id===entry.game)?.[1]||'Jeu musical')}</h4>
 <ol>${entry.groups.map(group=>`<li>${esc(group.icon||'')} ${esc(group.name)} · ${group.score===undefined?`palier ${group.position}`:`${group.score} pts`}</li>`).join('')}</ol>`).join('')}</details>`;
}
function teamAdmin(){
 if(!game||game.mode!=='phone'||!safeTeamPhases.includes(game.phase))return '';
 const editable=game.phase!=='paused';
 return teamHost(game.teamPlan,{editable,tyrolien:view==='setup'?config.musicGame==='tyrolien':Boolean(game.tyrolien||game.mountain),
  participantCount:game.teamPlan?.total??game.teams?.length??game.tyrolien?.participants?.length??0,
  gatherable:true},esc).replace(/data-team-details="([^"]+)"/g,(match,key)=>openTeamDetails.has(key)?match+' open':match);
}
document.addEventListener('toggle',event=>{
 const key=event.target.dataset?.teamDetails;
 if(key&&event.target.isConnected){
  if(event.target.open)openTeamDetails.add(key);else openTeamDetails.delete(key);
 }
},true);

let custom=read('declic.library',[]), view='home', game=null, room=null, ws=null, role='host', teamId=null, connected=false, reconnect=null, auth=null, lastEvent=null, seenCount=null, countdown=-1, lastRevision=-1, assetUrls=new Map(), audioReady=false, soundTask=0, busy=false;
let catalogPool=read('declic.musicPool',{name:'',tracks:[],themeKey:''}),catalogResults={tracks:[],playlists:[]},catalogQuery='',catalogSearchType='tracks',catalogMessage='',audioError='',replyDraft={},audioSegment='';
const MUSIC_GAMES=[
 ['tyrolien','Le Tyrolien','Blind test en équipes, ascension et bonus d’attaque.'],
 ['bingo','Bingo musical','Identifiez les extraits et cochez votre grille de 16 chansons.'],
 ['timeline','Frise musicale','Placez le titre entre les chansons déjà datées.'],
 ['coversQuiz','Les reprises','Reliez la version originale et la reprise.'],
 ['soundtrack','Cinéma musical','Retrouvez le film, la série ou le générique TV.'],
 ['blind','Blind test','Retrouvez le titre ou l’artiste.'],
 ['progressive','Une seconde pour trouver','Écoutez 1, 2, 5 puis 10 secondes du même extrait.'],
 ['chain','Maillon faible','Sécurisez vos points et votez pour départager les joueurs.'],
 ['covers','La bonne pochette','Choisissez la pochette parmi quatre images.'],
 ['survival','Dernier survivant','Restez en jeu en répondant correctement. Deux participants minimum.']
];
const questionCount=value=>Math.max(5,Math.min(100,Math.trunc(Number(value)||5)));
const newDefaults={themes:['fr'],count:10,duration:30,difficulty:'balanced',challenge:'title',explicit:false,settings:gameSettings()};
for(const [key,value]of Object.entries(newDefaults))if(config[key]===undefined)config[key]=value;
config.count=questionCount(config.count);
config.settings=gameSettings(config.settings);if(config.version!==2||config.universe!=='music'||!['catalog','demo','custom'].includes(config.source)){
 Object.assign(config,{version:2,universe:'music',source:'catalog',challenge:'title'});
 write('declic.config',config);
}
const desk=new SoundDesk();
let arrivalSound=read('declic.arrivalSound',false);
let arrivalRoom=null, arrivalIds=new Set();
function trackArrivalSound(){
 const ids=new Set(game?.teams?.map(team=>team.id)||[]);
 if(room&&room===arrivalRoom&&game?.mode==='phone'&&game.phase==='lobby'&&arrivalSound&&desk.ctx?.state==='running'){
  if([...ids].some(id=>!arrivalIds.has(id)))playShowCue(desk.ctx,'arrival');
 }
 arrivalRoom=game?room:null;
 arrivalIds=ids;
}
function arrivalSoundButton(){
 return `<button class="btn ghost" data-action="arrival-sound" aria-pressed="${arrivalSound}">Son des arrivées · ${arrivalSound?'activé':'coupé'}</button>`;
}
desk.muted=read('declic.muted',false);
let activeEvening=null, eveningStatus='loading', changingEvening=false;
let wheel=null,localWheel=null,wheelTimer=null,wheelCelebration=null;
const wheelPrefs={avoidSongs:true,...read('declic.wheelFilters',{})};
let verifiedPlaylists=read('declic.verifiedPlaylists',{});
let eveningUsage={games:[],playlists:[],songs:[],spinners:[]};
const compatiblePlaylistId=id=>/^20[2-9][0-9]$/.test(id)?'year-'+id:id;
let selectedPlaylists=read('declic.playlistSelection',catalogPool.playlistIds||[]).map(compatiblePlaylistId),viewBeforeLibrary='home';
let libraryLaunch={}, playlistLoadedAt=0;
let playlistGroups=null, playlistRequest=null, playlistSearch='', playlistCategory='decades', playlistLetter='', playlistPage=0;
let favoritePlaylists=read('declic.playlistFavorites',[]).map(compatiblePlaylistId);
let recentPlaylists=read('declic.playlistRecent',[]).map(compatiblePlaylistId);
let surprisePending=false, ceremony=null;
let selectionPanel='', usbVoteChoice='', appliedWheel=null, playlistShortlist=null;
const selectionModes=[['manual','Manuel'],['automatic','Roulette automatique'],['participatory','Arrêt par un joueur'],['vote','Vote des participants']];
const preferredModes={game:'participatory',playlist:'participatory',...read('declic.selectionModes',{})};
let explicitPreference=read('declic.excludeExplicit',config.explicit!==true);
let showAnimations=read('declic.showAnimations',true);

let customQuestionCount=false;
const quickQuestionCounts=[5,10,15,20,30,50];
const wheelGameSelection=read('declic.wheelGames',[]);
const wheelSettings={player:'',animation:true,...read('declic.wheelPreferences',{})};
function playlistIndex(){
 return new Map((playlistGroups||[]).flatMap(group=>group.playlists).map(item=>[item.id,item]));
}
function loadPlaylistGroups(){
 if(playlistGroups||playlistRequest)return;
 playlistRequest=hostRequest('/api/library').then(data=>{playlistGroups=data.categories;playlistLoadedAt=Date.now();},()=>{playlistGroups=[];})
 .finally(()=>{playlistRequest=null;if(view==='setup')render();});
}
function togglePlaylistFavorite(id){
 favoritePlaylists=favoritePlaylists.includes(id)?favoritePlaylists.filter(value=>value!==id):[...favoritePlaylists,id];
 write('declic.playlistFavorites',favoritePlaylists);
}
function savePlaylistSelection(){
 write('declic.playlistSelection',selectedPlaylists);
}

function useEveningHistory(){
 if(!activeEvening)return;
 eveningUsage=read('declic.usage.'+activeEvening.code,{games:[],playlists:[],songs:[],spinners:[]});
}
function rememberUsage(key,values){
 if(!activeEvening)return;
 const combined=[...eveningUsage[key],...values];
 eveningUsage[key]=key==='spinners'?combined:[...new Set(combined)];
 write('declic.usage.'+activeEvening.code,eveningUsage);
}
let usbRevision=0, usbSave=null, usbRetry=null, usbQueue=[];
const colors=['#e9ddff','#ffdfc9','#e4f1bc','#ffd9e9','#d5ecff','#ffeaa9','#d1f3e7','#e7ddf6','#ffdbd3','#d9e7f8'];
const icons=['🪩','🎸','✨','⚡','🎬','🎤','🚀','🍿','🦄','🏆'];
let channel=new BroadcastChannel('declic-screen');
channel.onmessage=e=>{if(e.data.type==='ceremony'&&role==='tv'&&!room){showCeremony(e.data);return;}if(e.data.type==='request'&&ceremony&&role==='host')channel.postMessage({type:'ceremony',ranking:ceremony,animation:showAnimations});if(e.data.type==='roulette'&&role==='tv'&&!room){showWheel(e.data.wheel);return;}if(e.data.type==='request'&&role==='host'&&localWheel)channel.postMessage({type:'roulette',wheel:rouletteView(localWheel)});if(e.data.type==='ended'&&role==='tv'){game=null;ceremony=null;render();}if(e.data.type==='request'&&game&&role==='host')broadcastTV();if(e.data.type==='state'&&role==='tv'&&!room){
 const publicState=e.data.state;
 if(publicState.mode==='phone'&&publicState.roomCode){
  room=publicState.roomCode;auth={type:'tv'};connect();return;
 }
 game=publicState;void receive();
}};
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
function celebrate(){if(!showAnimations||role!=='host'&&game?.showAnimations===false||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const el=$('#confetti');el.innerHTML=Array.from({length:55},(_,i)=>`<i class="confetto" style="left:${Math.random()*100}%;background:${['#e2f889','#ff925b','#ffc6e0','#9f7af3','#79c5ed'][i%5]};animation-delay:${Math.random()*.5}s;animation-duration:${2+Math.random()}s;transform:rotate(${i*27}deg)"></i>`).join('');setTimeout(()=>el.replaceChildren(),4000);}
function saveConfig(){
 write('declic.config',config);
 if(config.musicGame){
  gamePreferences[config.musicGame]=Object.fromEntries(gamePreferenceKeys.map(key=>[key,config[key]]));
  write('declic.gamePreferences',gamePreferences);
 }
}
function brand(){return '<button class="brand" data-action="home" aria-label="Déclic Party, accueil"><span>ϟ</span>Déclic Party</button>';}
function header(){return `<header class="topbar">${brand()}<nav class="nav" aria-label="Navigation principale"><button class="${['home','setup','studio'].includes(view)?'active':''}" data-action="home">Accueil</button><button class="${view==='catalog'?'active':''}" data-action="v2-catalog">Les musiques</button><button class="${view==='help'?'active':''}" data-action="help">Comment jouer</button></nav></header>`;}
function footer(){return '<footer class="footer"><span>De la musique et des déclics.</span><span>Déclic ! · Le studio de vos soirées · v0.5</span></footer>';}
function savedMusicGame(key){
 const saved=read(key,null);
 return Array.isArray(saved?.questions)&&saved.questions.every(q=>q.universe==='music'||q.target==='soundtrack')?saved:null;
}
function selectedQuestions(){if(config.source==='catalog'&&Object.hasOwn(SPECIAL_TRACKS,config.musicGame))return [];if(config.universe==='music'&&config.challenge==='lyrics')return(config.source==='demo'?DEMO:custom).filter(q=>q.universe===config.universe&&q.kind==='lyrics').slice(0,config.count);if(config.source==='catalog'&&config.universe==='music')return musicQuestions(catalogPool.tracks,config.musicGame==='bingo'?{...config,count:BINGO_CARD_SIZE,challenge:config.challenge==='artist'?'artist':'title',difficulty:'balanced'}:config);return(config.source==='custom'?custom:DEMO).filter(q=>q.universe===config.universe).slice(0,config.count);}
function render(){
 if(role==='host')trackArrivalSound();
 void syncTeamWake();
 if(view==='setup'&&playlistGroups?.length&&Date.now()-playlistLoadedAt>60000)playlistGroups=null;
 if(view==='setup'&&!playlistGroups)loadPlaylistGroups();
 const a=$('#app');
 a.classList.toggle('no-show-animation',role==='host'?!showAnimations:game?.showAnimations===false);
 const reduced=a.classList.contains('no-show-animation');
 updateShow(a,{role,game,wheel,ceremony,reduced});
 if(role==='tv'&&a.previousElementSibling?.classList.contains('show-backdrop')){
  updateLobbyArrivals(a.previousElementSibling,{
   room,game:wheel||ceremony?null:game,reduced,avatarFor:team=>showAvatars[team.avatar]?.icon
  });
 }
 const plan=game?.teamPlan;
 if(plan?.gather&&safeTeamPhases.includes(game.phase)&&role==='player'){
  a.classList.add('party-interface');
  if(!myPlannedTeam()&&choosingWhileGathering&&plan.open&&plan.mode==='free')a.innerHTML=teamCards(plan,role,teamId,esc);
  else if(!a.querySelector('.team-gather')||a.querySelector('.team-gather').dataset.identity!==gatherIdentity(plan)){
   a.innerHTML=teamGather(plan,role,teamId,esc);
   a.querySelector('.team-gather').dataset.identity=gatherIdentity(plan);
  }
  return;
 }
 if(plan&&(role==='tv'||role==='player')&&(game.phase==='lobby'&&plan.open||game.phase==='finished'&&plan.open)&&!wheel&&!ceremony){
  a.classList.add('party-interface');
  a.innerHTML=teamCards(plan,role,teamId,esc);
  return;
 }
 if(role==='player'&&plan&&game.phase==='lobby'&&myPlannedTeam()&&!wheel){
  a.classList.add('party-interface');
  a.innerHTML=teamCards(plan,role,teamId,esc);
  return;
 }
 if(role==='tv'&&plan?.gather&&safeTeamPhases.includes(game.phase)&&!ceremony){
  a.classList.add('party-interface');
  a.innerHTML=teamGather(plan,role,teamId,esc);
  return;
 }
 if(role==='tv'&&ceremony){a.innerHTML=ceremonyMarkup();return;}
 a.classList.toggle('party-interface',role!=='host'||view!=='home');
 if($('#catalog-player'))desk.stop();
 if(view==='music-library'){
  if($('#official-music-library'))return;
  a.innerHTML=`<div class="shell"><main id="official-music-library"></main></div>`;
  const region=$('#official-music-library');
  region.addEventListener('legacy-music',()=>{view='catalog';render();});
  region.addEventListener('play-library-selection',event=>void prepareLibrarySelection(event.detail));
  openMusicLibrary(region,hostRequest,esc,{
   ...libraryLaunch,returnView:viewBeforeLibrary,favorites:()=>favoritePlaylists,
   favorite:togglePlaylistFavorite,isSelected:id=>selectedPlaylists.includes(id),
   select:(id,checked)=>{selectedPlaylists=checked?[...new Set([...selectedPlaylists,id])]:selectedPlaylists.filter(value=>value!==id);savePlaylistSelection();},
   invalidate:()=>{playlistGroups=null;},match:matchSpecialTrack,checkPreview
  });
  return;
 }
 const form=$('#answer-form');if(form&&currentQ()&&(!game.mountain||form.dataset.question===currentQ().id))replyDraft[form.dataset.question||currentQ().id]={...replyDraft[form.dataset.question||currentQ().id],...Object.fromEntries(new FormData(form))};
 if(wheel&&((role!=='host'&&view!=='join')||view==='setup')){
  a.innerHTML=role==='host'?'<div class="shell">'+header()+setupScreen()+'</div>':rouletteMarkup();
  return;
 }
 if(role==='host'&&view==='home'){a.innerHTML=home();return;}
 if(game?.tyrolien&&(role!=='host'||view==='studio')){
  const form=$('#ty-start-form');
  if(form)tyrolienDraft={...tyrolienDraft,...Object.fromEntries(new FormData(form)),bonuses:form.elements.bonuses.checked};
  a.innerHTML=tyrolienScreen(game.tyrolien,role,esc,invitationMarkup(),room,tyrolienDraft,game.teamPlan,role==='host'?teamAdmin()+previousTeamGames():'')+eveningRanking()+(role==='host'?'<div class="row"><button class="btn bad" data-action="leave-game">Retour au salon</button></div>'+(game.phase==='finished'?nextGameActions():''):'');
  return;
 }
 if(role==='tv'){
  const previousMap=a.querySelector('.ty-live-map');
  const previousRanks=new Map([...a.querySelectorAll('[data-score-id]')].map(node=>[node.dataset.scoreId,node.getBoundingClientRect()]));
  a.innerHTML=tvScreen();
  const nextMap=a.querySelector('.ty-live-map');
  if(previousMap&&nextMap&&previousMap.dataset.mapKey===nextMap.dataset.mapKey)nextMap.replaceWith(previousMap);
  if(!reduced&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
   for(const node of a.querySelectorAll('[data-score-id]')){
    const previous=previousRanks.get(node.dataset.scoreId);
    const current=node.getBoundingClientRect();
    if(previous&&(previous.x!==current.x||previous.y!==current.y))node.animate(
     [{transform:`translate(${previous.x-current.x}px,${previous.y-current.y}px)`},{transform:'none'}],
     {duration:650,easing:'cubic-bezier(.16,1,.3,1)'});
   }
  }
  return;
 }
 if(view==='join'){a.innerHTML=joinScreen();return;}
 if(role==='player'&&view!=='history'){a.innerHTML=phoneScreen();return;}
 const openRegieDetails=[...a.querySelectorAll('.regie-extra[open],.show-regie-stats[open]')]
  .map(details=>details.classList.contains('regie-extra')?'.regie-extra':'.show-regie-stats');
 const focusedSetupButton=a.querySelector('.game-setup button[data-action]:focus-visible');
 a.innerHTML=`<div class="shell">${header()}${view==='setup'?setupScreen():view==='catalog'?catalogScreen():view==='history'?historyScreen():view==='library'?library():view==='help'?help():view==='settings'?settingsScreen():studio()}${footer()}</div>`;
 for(const selector of openRegieDetails){const details=a.querySelector(selector);if(details)details.open=true;}
 if(view==='setup'&&focusedSetupButton){
  const {action,value,kind,key}=focusedSetupButton.dataset;
  const wasChip=focusedSetupButton.classList.contains('playlist-chip');
  const replacement=Array.from(a.querySelectorAll('.game-setup button[data-action]')).find(button=>
   button.dataset.action===action&&button.dataset.value===value&&button.dataset.kind===kind&&button.dataset.key===key
   &&button.classList.contains('playlist-chip')===wasChip);
  const fallback=wasChip||action==='playlist-clear' ? $('#setup-playlist-search') : null;
  (replacement||fallback)?.focus({preventScroll:!!replacement});
 }
 if(view==='studio')void prepareImage();
}
function library(){return `<main class="library"><div class="row"><div><span class="eyebrow">LA BOÎTE À IDÉES</span><h1>Vos questions. Votre ambiance.</h1><p class="help">Préparez vos extraits et vos indices. Les fichiers restent dans ce navigateur.</p></div><button class="btn primary right" data-action="new-question">＋ Nouvelle question</button></div><div class="row"><button class="btn ghost" data-action="export">Exporter les questions JSON</button><label class="btn ghost">Importer un JSON<input type="file" id="import-json" accept="application/json" hidden></label></div><div class="cards">${custom.filter(q=>q.universe==='music').map(q=>`<article class="qcard"><span class="badge">MUSIQUE · ${q.kind==='lyrics'?'PAROLES':q.kind==='audio'?'EXTRAIT':q.kind==='image'?'IMAGE':'QUESTION'}</span><div class="emoji" style="margin-top:16px">${q.kind==='audio'?'🎧':q.kind==='image'?'🖼️':'💡'}</div><h3>${esc(q.prompt)}</h3><p>Réponse : <strong>${esc(q.answer)}</strong><br>${q.duration} secondes · ${q.points} points</p><div class="row" style="margin-top:16px"><button class="textbtn" data-action="edit-question" data-value="${esc(q.id)}">Modifier</button><button class="textbtn right" data-action="delete-question" data-value="${esc(q.id)}">Retirer</button></div></article>`).join('')||'<div class="empty wide">La piste est à vous !<br>Ajoutez une première question pour créer votre blind test.</div>'}</div><div class="callout">Les réponses écrites acceptent les accents et la ponctuation indifféremment. Ajoutez des réponses alternatives dans l’éditeur. L’export JSON contient les questions, pas les fichiers audio ou images.</div></main>`;}
function help(){return `<main class="help-page"><span class="eyebrow">LA RECETTE D’UNE BONNE SOIRÉE</span><h1>Moins de réglages. Plus de jeu.</h1><div class="cards"><article class="qcard"><div class="emoji">🎛️</div><h3>1. Préparez</h3><p>Choisissez un jeu musical, un effet et votre sélection. Testez les questions de découverte ou importez vos extraits.</p></article><article class="qcard"><div class="emoji">⚡</div><h3>2. Faites buzzer</h3><p>En USB, l’animateur lance l’extrait. La première touche coupe le son. Bonne réponse : des points ! Mauvaise réponse : l’équipe est bloquée pour cette question et le son reprend.</p></article><article class="qcard"><div class="emoji">🏆</div><h3>3. Célébrez</h3><p>Révélez la réponse, affichez le classement et passez à la suite. La partie se termine par le podium.</p></article></div><div class="qcard" style="margin-top:20px"><h3>Le PC + la TV</h3><p>Cliquez sur « Écran public ». Déplacez cette fenêtre sur la TV et mettez-la en plein écran. Gardez les commandes sur le PC. Le son sort uniquement du PC animateur.</p><h3 style="margin-top:25px">Les buzzers USB</h3><p>Cette ébauche accepte les buzzers qui envoient une touche de clavier. Configurez une touche différente par équipe dans le studio. Les modèles qui se présentent uniquement comme des manettes nécessiteront une prise en charge supplémentaire. Le navigateur doit avoir le focus.</p><h3 style="margin-top:25px">Les téléphones</h3><p>Créez une partie en mode téléphones et partagez le lien ou le code. Choisissez « Buzzer · réponse orale » pour laisser l’animateur valider, ou QCM / écrit pour une correction automatique. La correction est automatique : titre et artiste sont indépendants. La rapidité et les séries peuvent ajouter chacune jusqu’à 50 points. Cinq essais maximum par manche écrite ; une seule réponse en QCM. Les points sont affichés à la révélation. Internet est nécessaire pour ce premier mode connecté.</p><h3 style="margin-top:25px">Vos fichiers et les effets</h3><p>Importez un MP3, WAV ou autre audio compatible avec votre navigateur, ou une image. Les effets accéléré, ralenti, écureuil et envers agissent sur l’audio. L’effet écureuil augmente la vitesse et la hauteur ensemble. L’image mystère révèle progressivement les détails. Pour compléter des paroles, choisissez le défi Paroles dans Mes questions, ajoutez votre extrait chanté et indiquez la coupure en secondes. La lecture originale s’arrête automatiquement au point choisi. Saisissez une phrase avec ___ et les mots attendus. Une démonstration instrumentale est disponible dans Découverte. Les paroles ne sont pas récupérées automatiquement.</p><h3 style="margin-top:25px">Écoute progressive</h3><p>Dans le studio, choisissez Écoute progressive. L’animateur propose 1, 2, 5 puis 10 secondes du même extrait. Les points de réponse passent à 100 %, 80 %, 60 %, puis 40 %. Le bonus de rapidité est désactivé pour ces questions. Chaque palier permet de retenter une réponse ; les points déjà gagnés restent acquis. Les autres types de questions conservent leurs règles normales.</p><h3 style="margin-top:25px">Ce qui arrive plus tard</h3><p>Le catalogue Deezer est connecté : recherche de titres et de playlists, thèmes à mélanger et extraits de 30 secondes maximum. Le QR code, les bandes-annonces vidéo, le réseau local sans Internet et les buzzers de type manette restent à venir.</p><p style="margin-top:20px">Utilisez des contenus que vous êtes autorisé à diffuser. Les parties connectées expirent après 24 heures. Les questions personnelles et les médias restent sur le PC ; seul le texte utile au jeu est partagé dans la partie.</p></div></main>`;}
function questionNumber(){
 return game?.mountain?String(game.mountain.round||1):`${game.index+1} / ${game.total||game.questions?.length||0}`;
}
function currentQ(){return game?.question||game?.questions?.[game.index];}
function sorted(){return [...(game?.teams||[])].sort((a,b)=>Number(!!a.eliminated)-Number(!!b.eliminated)||b.score-a.score);}
function timerMarkup(){return '<div class="timer"><span data-time>—</span><div class="timer-track"><div class="timer-fill" data-progress></div></div></div>';}
const bingoNames=['','Bingo','Double Bingo','Triple Bingo'];
const participantNames=ids=>ids.map(id=>esc(game.teams.find(t=>t.id===id)?.name)).join(' · ');
function bingoGrandWinner(){
 const winners=bingoGrandWinners(game.teams,game.bingoFinishRows?game.bingoMilestones.filter(goal=>goal.rows===game.bingoFinishRows):game.bingoMilestones);
 if(!winners.length)return '';
 return `<div class="show-bingo-winners"><span class="eyebrow">${game.bingoFinishRows===1?'Victoire sur la première ligne':winners.length===1?'Grand gagnant':'Grands gagnants ex æquo'}</span>
 <div class="show-bingo-cast">${winners.map(team=>`<div>${avatarBadge(team)||'<span class="show-avatar">🏆</span>'}<strong>${esc(team.name)}</strong><small>${team.score} pts</small></div>`).join('')}</div></div>`;
}
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
function showRoundAwards(){
 if(role!=='tv'||game.mountain||game.tyrolien||game.timelineMode||game.settings?.timelineMode)return '';
 const awards=(game.history?.at(-1)?.results||[]).filter(row=>row.result.total>0);
 awards.sort((a,b)=>b.result.total-a.result.total);
 if(!awards.length)return '';
 return `<ul class="show-awards" aria-label="Points gagnés">${awards.slice(0,4).map(row=>
  `<li>${avatarBadge(game.teams.find(player=>player.id===row.id))}<span>${esc(row.name)}</span><b>+${row.result.total} pts</b></li>`
 ).join('')}${awards.length>4?`<li>+ ${awards.length-4} autres</li>`:''}</ul>`;
}
function roundRecap(){
 const round=game.history?.at(-1);
 if(!round||game.mode!=='phone'||game.input==='buzzer')return '';
 const summary=showRoundSummary(round);
 const counts=[summary.complete+' correctes',summary.wrong+' incorrectes',summary.absent+' sans réponse'];
 if(summary.partial)counts.splice(1,0,summary.partial+' partielles');
 const names=rows=>rows.slice(0,3).map(row=>esc(row.name)).join(' · ')+
  (rows.length>3?' · + '+(rows.length-3):'');
 const distinction=(rows,label)=>rows.length
  ? `<span><b>${label}</b> ${names(rows)} · ${seconds(rows[0].result.elapsed)}</span>` : '';
 return `<div class="round-recap show-recap"><p>${counts.join(' · ')}</p>
 ${role==='tv'&&game.timelineMode?'':`<div class="show-round-distinction">${distinction(summary.fastest,'L’Éclair')}${distinction(summary.slowest,'La dernière bonne réponse')}</div>`}
 ${role==='host'&&summary.median!==null?`<p>Temps médian des bonnes réponses · ${seconds(summary.median)}</p>`:''}
 ${game.jokerAwards?`<p>🃏 ${game.jokerAwards} joker(s) débloqué(s)</p>`:''}${game.settings?.bingo?bingoAnnouncement():''}</div>`;
}
function grandSoirWelcome(){
 return '<div class="stage-content grand-welcome"><span class="eyebrow">DÉCLIC PARTY PRÉSENTE</span><h1>Grand Soir</h1><p>Le plateau ouvre ses portes</p></div>';
}
function stage(){if(!game)return grandSoirWelcome();const q=currentQ(),phase=game.phase,total=game.total||game.questions?.length||0;
 if(phase==='finished'&&game.settings?.bingo){
  const stats=game.bingoFinal||roundStatistics(game.history,game.teams);
  const recognition=[...stats].sort((a,b)=>b.correct-a.correct||(a.average??Infinity)-(b.average??Infinity));
  const winner=bingoGrandWinner();
  const speed=stats.filter(t=>t.correct).sort((a,b)=>a.average-b.average);
  return `<div class="stage-content"><span class="eyebrow">16 EXTRAITS · BINGO MUSICAL</span><h1>Résultats du Bingo</h1>${winner}${bingoAwards()}
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
 if(phase==='finished')return `<div class="stage-content"><span class="eyebrow">LE DERNIER MOT EST POUR VOUS</span><h1>Les champions du déclic !</h1><div class="podium">${sorted().slice(0,3).map((t,i)=>`<div><span style="font-size:35px">${['🏆','🥈','🥉'][i]}</span><strong>${avatarBadge(t)} ${esc(t.name)}</strong><span>${t.score} points</span></div>`).join('')}</div><p class="help">${game.mountain?.roundsPlayed??game.historyCount??game.history?.length??total} manches · Classement individuel</p></div>`;
 if(role==='tv'&&phase==='paused'&&!game.mountain){
  return '<div class="stage-content tv-entracte"><span class="eyebrow">GRAND SOIR</span><h1>Entracte</h1><p>La manche reprend au signal de la régie.</p></div>';
 }
 if(role==='tv'&&phase==='lobby'&&!q)return grandSoirWelcome();
 if(role==='tv'&&phase==='lobby'&&q&&game.musicGame){
  const selected=MUSIC_GAMES.find(([id])=>id===game.musicGame);
  if(selected){
   const [id,name,rules]=selected;
   const anchor=game.timelineCards?.[0]||game.settings?.timelineAnchor;
   return `<div class="stage-content tv-intro"><div class="stage-wave" aria-hidden="true">${homeIcon(id)}</div><h1>${name}</h1><p>${rules}</p>
   ${anchor?`<p>Morceau de départ · ${esc(anchor.title)} · ${anchor.year}</p>`:''}
   </div>`;
  }
 }
 if(phase==='lobby'&&(game.timelineMode||game.settings?.timelineMode)){
  const anchor=game.timelineCards?.[0]||game.settings?.timelineAnchor;
  return `<div class="stage-content"><h1>Morceau de départ</h1>${timelineList(anchor?[anchor]:[],[])}</div>`;
 }
 if(phase==='lobby')return `<div class="stage-content"><span class="eyebrow">PRÊTS À FAIRE LE DÉCLIC ?</span><div class="stage-wave" aria-hidden="true">${homeIcon('wave')}</div><h1>La soirée commence ici.</h1><p class="help">${game.mode==='phone'?'Scannez le QR code pour rejoindre la soirée.':'Installez vos équipes et testez vos touches !'}</p><p class="mini" style="color:#c4b2dc">${game.teams.length} équipe(s) · ${total} questions</p></div>`;
 const reveal=phase==='reveal',count=phase==='playing'&&Date.now()<game.startAt?Math.ceil((game.startAt-Date.now())/1000):0;const art=q?.artwork&&(q.target==='cover'||q.target!=='coverChoice'&&game.effect==='image'||reveal);
 return `<span class="counter">${game.mountain?'Manche '+questionNumber():game.index+1+' / '+total}</span><div class="stage-content"><span class="eyebrow">${q?.universe==='film'?'CINÉMA MUSICAL':'MUSIQUE'} · ${q?.kind==='lyrics'?'PAROLES À COMPLÉTER':q?.kind==='question'?'QUESTION':CHALLENGES.find(v=>v[0]===q?.target)?.[2]||'LE DÉFI'}</span>${role==='tv'&&game.mode==='phone'&&game.input!=='buzzer'&&phase==='playing'&&!game.mountain?`<p class="bingo-tv-count">${game.bingoAnswered??game.answered?.length??0} / ${game.teams.length} réponses</p>`:''}${count?`<h1 class="countdown">${count}</h1><p class="help">À vos marques…</p>`:`${reveal?'':`<h1>${esc(game.timelineMode||game.settings?.timelineMode?'Où placer cette chanson sur la frise ?':q?.prompt)}</h1>${q?.target==='artistTitle'?`<div class="artist-cue">${esc(q.artist||q.displayArtist)}</div>`:''}${art?`<img src="${esc(q.artwork)}" alt="Pochette à identifier" ${q.target==='cover'||game.effect==='image'?'data-mystery':''}>`:q?.mediaKey&&q.kind==='image'||q?.imageUrl?'<div data-image></div>':q?.emoji?`<div class="big-emoji" data-mystery>${esc(q.emoji)}</div>`:q?.kind==='audio'?'<div class="record" aria-hidden="true"></div>':''}${phase==='buzzed'?`<div class="buzz-banner">${avatarBadge(game.teams.find(t=>t.id===game.buzz))||'⚡'} ${esc(game.teams.find(t=>t.id===game.buzz)?.name)} a buzzé !</div>`:''}${phase==='paused'?'<div class="pause-banner">Ⅱ En pause · l’animateur garde la main</div>':''}`}${reveal?`<span class="eyebrow">LA RÉPONSE</span><h2>${esc(targets(q)[0]==='answer'&&q.target!=='coverChoice'&&q.target!=='timeline'?q.answer:q.title||q.answer)}${game.timelineMode&&Number.isInteger(q.year)?' · '+q.year:''}</h2>${art?`<img class="reveal-cover" src="${esc(q.artwork)}" alt="Pochette du titre révélé">`:''}${q.artist?`<p class="reveal-artist">${esc(q.artist)}</p>`:''}${questionExplanation(q)}${showRoundAwards()}${roundRecap()}${(game.timelineMode||game.settings?.timelineMode)==='collective'?timelineList(game.timelineCards):''}${timelineDistribution()}${(game.chainVote||game.chainVoting)?'<p>Vote en cours sur les téléphones.</p>':''}${q.provider?`<a class="source-credit" href="${esc(q.link)}" target="_blank" rel="noopener noreferrer">Extrait fourni par Deezer · écouter le titre ↗</a>`:''}`:phase==='ready'?'<p class="help">Une nouvelle question vous attend.</p>':''}${listeningMarkup()}${(game.timelineMode||game.settings?.timelineMode)==='collective'?timelineList(game.timelineCards):''}${!reveal&&!(game.timelineMode||game.settings?.timelineMode)&&game.input==='qcm'&&game.mode==='phone'&&q?.options?.length?`<div class="options ${q.optionArtwork?'cover-options':''}">${q.options.map((o,i)=>`<div class="option"><span class="letter">${'ABCDE'[i]}</span>${q.optionArtwork?`<img src="${esc(q.optionArtwork[i])}" alt="Pochette ${esc(o)}" width="160" height="160">`:esc(o)}</div>`).join('')}</div>`:''}${timerMarkup()}`}</div>`;
}
function publishCeremony(open){
 if(game?.mode==='usb'){
  const ranking=open?Object.values(usbEveningTotals(game)).sort((a,b)=>b.points-a.points):null;
  const message={type:'ceremony',ranking,animation:showAnimations};
  channel.postMessage(message);showCeremony(message);return;
 }
 if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'ceremony',open,animation:showAnimations}));
}
function showCeremony(message){
 ceremony=message.ranking;
 if(role==='tv')showAnimations=message.animation!==false;
 render();
 if(ceremony&&showAnimations){
  if(role==='tv')showTVReaction({kind:'final',label:'Les champions de la soirée',players:ceremony.slice(0,1)});
  if(role==='host')desk.jingle('final');
 }
}
function ceremonyMarkup(){
 const played=ceremony.filter(row=>row.played);
 const fastest=[...played].filter(row=>Number.isFinite(row.best)).sort((a,b)=>a.best-b.best)[0];
 const correct=[...played].sort((a,b)=>b.correct-a.correct)[0];
 return `<main class="tv-shell evening-ceremony"><section class="stage"><div class="stage-content"><h1>Le podium de la soirée</h1>
 <div class="podium">${played.slice(0,3).map((row,index)=>`<div><span>${['🏆','🥈','🥉'][index]}</span>${avatarBadge(row)}<strong>${esc(row.name)}</strong><span>${row.points} points</span></div>`).join('')}</div>
 ${fastest?`<p>Réponse éclair · ${esc(fastest.name)} · ${(fastest.best/1000).toFixed(2)} s</p>`:''}
 ${correct?`<p>Meilleur total de bonnes réponses · ${esc(correct.name)} · ${correct.correct}</p>`:''}
 <p>${played.reduce((total,row)=>total+row.correct,0)} bonnes réponses cumulées</p></div></section>
 <details class="control"><summary>Classement général</summary>${played.map((row,index)=>`<div class="leaderrow"><span>${index+1}</span><span>${esc(row.name)}</span><strong>${row.points} pts</strong></div>`).join('')}</details></main>`;
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
 const ranking=role==='host'&&game?.mode==='usb'?Object.values(usbEveningTotals(game)).sort((a,b)=>b.points-a.points):game?.eveningRanking;
 if(!ranking?.some(row=>row.played))return '';
 const podium=role==='tv';
 const rows=ranking.slice(0,podium?10:undefined);
 return `<details class="control" ${podium&&['paused','finished'].includes(game.phase)?'open':''}><summary>Classement de la soirée</summary>
 ${rows.map((row,index)=>`<div class="leaderrow"><span>${index+1}</span><span>${esc(row.name)}</span><span>${row.correct}/${row.played} bonnes · ${row.played?Math.round(100*row.correct/row.played):0} %</span><strong>${row.points} pts</strong></div>`).join('')}</details>`;
}
function randomTeamScores(){
 if(!game?.randomTeams?.length)return '';
 return `<section class="scorebar" aria-label="Classement des équipes">${game.randomTeams.map(group=>`<div class="scorecard" style="border-inline-start:4px solid ${group.color||'#ab82ec'}"><span>${esc(group.icon||'')} ${esc(group.name)}</span><strong>${group.score} pts</strong></div>`).join('')}</section>`;
}
function scorebar(){
 if(game?.phase!=='lobby'&&game?.randomTeams?.length)return randomTeamScores();
 if(game?.timelineMode&&game.phase!=='finished')return '';
 const lobby=game?.phase==='lobby';
 const people=sorted();
 const featured=people.slice(0,lobby?18:10);
 const gallery=lobby?people.slice(featured.length):[];
 const avatar=(player,index)=>avatarBadge(player)||`<span class="avatar" style="--team:${colors[index%10]}">${icons[index%10]}</span>`;
 return `<div class="scorebar${lobby?' show-lobby-cast':''}">${featured.map((player,index)=>
  `<div class="scorecard" data-score-id="${esc(player.id)}">${avatar(player,index)}<span>${esc(player.name)}</span>${lobby?'':`<strong>${player.score}</strong>`}</div>`).join('')}</div>
 ${gallery.length?`<div class="show-lobby-gallery" aria-label="Autres participants">${gallery.map((player,index)=>
  `<span title="${esc(player.name)}" aria-label="${esc(player.name)}">${avatar(player,index)}</span>`).join('')}</div>`:''}`;
}
function leaderboard(){return sorted().map((t,i)=>`<div class="leaderrow"><span class="rank">${i+1}</span>${avatarBadge(t)||`<span class="avatar">${icons[i%10]}</span>`}<span>${esc(t.name)}${t.eliminated?' <small>Éliminé</small>':''}${t.streak>1?` <small class="streak">🔥${t.streak}</small>`:''}</span><span class="pts">${t.score}</span></div>`).join('');}
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
 <h3>Victoires officielles</h3>${phase==='finished'?bingoGrandWinner():''}${bingoAwards()||'<p class="mini">Aucune étape remportée.</p>'}
 <h3>Journal des tirages</h3>
 <ol class="bingo-journal">${recaps.map(round=>`<li>Tirage ${round.index+1} · ${esc(round.question.title)}${(round.bingoProgressions||[]).filter(p=>p.previous<3).map(p=>` · ${participantNames([p.id])} (${bingoNames[Math.min(3,p.count)]})`).join('')}</li>`).join('')}</ol>
 </section>`;
}
function timelineControls(phase){
 if(!game.settings?.timelineMode)return '';
 if(phase==='lobby'){
  return `<button class="btn ghost full" data-action="timeline-anchor" ${busy?'disabled':''}>▶ Écouter le morceau de départ</button>`;
 }
 if(phase!=='playing')return '';
 const answered=game.teams.filter(team=>game.answers?.[team.id]?.attempts).length;
 return answered===game.teams.length&&answered>0
  ?'<button class="btn primary full" data-action="reveal">Tout le monde a répondu · Révéler</button>':'';
}
function nextGameActions(){
 return `<section class="qcard next-game-actions"><h2>Et maintenant ?</h2><div class="row">
 <button class="btn primary" data-action="surprise-total">✨ Surprise totale</button>
 <button class="btn ghost" data-action="roulette-game" data-value="automatic">Roulette du prochain jeu</button>
 <button class="btn ghost" data-action="roulette-game" data-value="vote">Vote pour le prochain jeu</button>
 <button class="btn ghost" data-action="new-game">Choisir le prochain jeu</button>
 ${game?.tyrolien?'':'<button class="btn ghost" data-action="replay-playlist">Rejouer avec une autre playlist</button>'}
 <button class="btn ghost" data-action="ceremony">Classement général · TV</button>
 <button class="btn ghost" data-action="end-evening">Terminer la soirée</button></div></section>`;
}
function hostRoundStatistics(){
 const stats=new Map(roundStatistics(game.history,game.teams,game.archivedStats).map(row=>[row.id,row]));
 if(!game.teams.length)return '';
 return `<details class="settings-details show-regie-stats"><summary>Suivi des participants</summary>
 <div class="bingo-table" tabindex="0"><table><thead><tr><th>Participant</th><th>Points</th><th>Bonnes</th><th>Fausses</th><th>Réussite</th><th>Dernier temps</th><th>Série</th></tr></thead>
 <tbody>${sorted().map(team=>{
  const row=stats.get(team.id);
  const played=row.correct+row.wrong+row.absent;
  const live=game.phase==='playing'?game.answers?.[team.id]:null;
  return `<tr><th scope="row">${avatarBadge(team)} ${esc(team.name)}${live?.attempts?' · répondu':''}</th><td>${team.score}</td><td>${row.correct}</td><td>${row.wrong}</td>
  <td>${played?Math.round(100*row.correct/played)+' %':'—'}</td><td>${seconds(live?.elapsed??row.last)}</td><td>${row.streak} / ${row.bestStreak}</td></tr>`;
 }).join('')}</tbody></table></div></details>`;
}
function hostRound(q,phase){
 const answered=Object.keys(game.answers||{}).length;
 return `<section class="qcard host-round">${game.mountain?mountainMarkup():''}
 <h2>${phase==='finished'?'Résultats de la partie':q?esc(q.prompt):'Soirée en attente'}</h2>
 ${q?`<p>Question ${questionNumber()} · ${answered} / ${game.teams.length} réponses</p>`:''}
 ${['playing','paused','buzzed'].includes(phase)?timerMarkup():''}
 ${game.mountain&&phase==='playing'? `<p>Extrait · ${esc(q.title||q.answer)}${q.artist?' — '+esc(q.artist):''}</p><p>En attente · ${game.teams.filter(player=>!game.answers[player.id]).map(player=>esc(player.name)).join(', ')||'Tout le monde a répondu'}</p>`:''}
 ${phase==='reveal'?roundRecap():''}
 ${phase==='finished'?leaderboard()+mountainStats():''}
  ${game.timelineMode&&phase==='reveal'?timelineDistribution():''}
 ${q?hostRoundStatistics():''}
 </section>`;
}
function mountainStats(){
 return game?.gameStatistics?.length?`<details class="settings-details"><summary>Statistiques de la partie</summary>
 ${game.gameStatistics.map(row=>`<p><strong>${esc(row.name)}</strong> · ${row.correct} bonnes · ${row.wrong} mauvaises · ${row.absent} absences
 ${row.average==null?'':`· ${(row.average/1000).toFixed(2)} s en moyenne`}</p>`).join('')}</details>`:'';
}
function mountainMarkup(){
 return mountainPanel(game,role,esc,showAnimations&&game.showAnimations!==false);
}
function showControlStatus(){
 const phase=game.phase;
 const venue=showVenue(game,wheel,ceremony);
 const statuses={lobby:'Accueil',ready:'Prêt à lancer',playing:'Manche en cours',paused:'Entracte',buzzed:'Buzz',reveal:'Révélation',finished:'Résultats'};
 return `<div class="show-control-status"><span class="eyebrow">À L’ANTENNE</span><strong>${venue}</strong><span>${statuses[phase]||''}</span></div>`;
}
function roundExitControls(phase, question){
 const active=!['lobby','finished'].includes(phase);
 const line=game.settings?.bingo&&game.bingoMilestones?.some(goal=>goal.rows===1);
 return `${active?`<button class="btn ghost full" data-action="stop"${line?' data-value="bingo-line"':''}>${line?'Sacrer le gagnant de la première ligne':'Terminer le jeu et afficher les résultats'}</button>`:''}
 ${active||question||phase==='finished'?'<button class="btn bad full" data-action="leave-game">Retour au salon</button>':''}`;
}
function regiePreview(){
 const scene=showScene(game,wheel,ceremony)||'tyrolien';
 const phase=game?.phase||'lobby';
 const current=game?publicGame(game):null;
 const question=current?.question;
 const reveal=phase==='reveal';
 const waiting=scene==='plateau'&&phase==='lobby';
 const title=phase==='paused'?'Entracte':phase==='finished'?'Résultats':
  reveal?(question?.title||question?.answer||showVenue(game,wheel,ceremony)):
  question?.prompt||showVenue(game,wheel,ceremony);
 return `<section class="regie-preview show-setup-preview" data-venue="${scene}" aria-label="Aperçu du plateau">
  <div class="regie-preview-top"><span class="eyebrow">● ${esc(showVenue(game,wheel,ceremony))}</span><span>APERÇU TV</span></div>
  ${waiting?grandSoirWelcome():`<div class="regie-preview-content"><h2>${esc(title)}</h2>
   ${phase==='playing'?timerMarkup():''}${reveal&&question?.artist?`<p>${esc(question.artist)}</p>`:''}</div>`}
  <div class="regie-preview-bottom">${waiting&&game?.mode==='phone'&&room?`<div class="regie-preview-qr">${invitationMarkup()}</div>`:'<span></span>'}
  <span>${game?.teams?.length||0} PARTICIPANT(S)</span></div>
 </section>`;
}
function regieCounters(){
 const answering=['playing','paused','reveal'].includes(game.phase);
 const answered=answering?Object.values(game.answers||{}).filter(answer=>answer?.attempts>0).length:'—';
 return `<div class="regie-counters"><div><b>${game.teams.length}</b><span>Participants</span></div><div><b>${answered}</b><span>Réponses</span></div></div>`;
}
function regieHeader(){
 return '<div class="row regie-top"><span class="eyebrow">DÉCLIC PARTY / GRAND SOIR</span><button class="btn ghost right" data-action="screen">▣ Écran TV</button></div>';
}
function automaticStudio(){
 const phase=game.phase;
 const status={
  lobby:'En attente des participants',ready:'Préparation de la prochaine manche',
  playing:'À vous de jouer',paused:'Partie en pause',reveal:'Réponse révélée sur la TV',finished:'Partie terminée'
 }[phase];
 const canPlay=phase==='ready'||phase==='lobby'&&game.teams.length>=Math.max(game.teamPlay?game.teamPlan?.groups.length||2:game.randomTeamCount||1,game.settings.survival?2:1);
 return `<main class="studio regie-studio">${regieHeader()}<div class="game-layout regie-layout">
 <div class="regie-monitor">${regiePreview()}</div><section class="control regie-controls">
 <h1>Régie du plateau</h1>${regieCounters()}${showControlStatus()}${arrivalSoundButton()}<h2>Je joue aussi</h2><p role="status">${status||''}</p>
 ${phase==='lobby'?`<div class="automatic-invite">${invitationMarkup()}<p>${game.teams.length} participant(s) · Rejoins la soirée sur ton téléphone.</p></div>${teamAdmin()}`:''}
 ${phase==='playing'?timerMarkup():''}
 <p class="help">Les réponses restent masquées ici. Garde cet onglet ouvert pour diffuser les extraits.</p>
 ${audioError?`<p role="alert">${esc(audioError)}</p>`:''}
 ${['lobby','ready'].includes(phase)?`<button class="btn primary" data-action="play" ${busy||!canPlay?'disabled':''}>${busy?'Chargement de l’extrait…':phase==='lobby'?'Démarrer la partie automatique':'Lancer la manche'}</button>`:''}
 ${phase==='playing'?'<button class="btn ghost" data-action="pause">Mettre en pause</button>':''}
 ${phase==='paused'?'<button class="btn primary" data-action="resume">Reprendre</button>':''}
 ${phase==='finished'?nextGameActions():roundExitControls(phase,currentQ())}
 </section></div></main>`;
}
function studio(){if(game?.settings?.autoHost)return automaticStudio();if(!game)return '<div class="empty">Aucune partie en cours.</div>';const q=currentQ(),ph=game.phase,wanted=q?targets(q):[],claimed=game.claimed||{};return `<main class="studio regie-studio">${regieHeader()}<div class="game-layout regie-layout">
 <div class="regie-monitor">${regiePreview()}${game.settings?.bingo?bingoDesk():hostRound(q,ph)}
 ${game.teamPlay||game.mountain||game.teamPlan||game.randomTeams?.length?`<details class="regie-extra"><summary>Équipes et résultats précédents</summary>${teamAdmin()}${previousTeamGames()}${randomTeamScores()}</details>`:''}</div>
 <aside class="control regie-controls"><h1>Régie du plateau</h1>${regieCounters()}${showControlStatus()}
 <div class="regie-sound">${arrivalSoundButton()}<button class="btn ghost" data-action="sound">${desk.muted?'Jingles coupés':'Jingles actifs'}</button></div>
 <h3>${ph==='lobby'?'Tout le monde est là ?':ph==='finished'?'Quelle soirée !':'À vous les commandes'}</h3>${game.mode==='phone'&&ph==='lobby'?`<p class="help">Partagez le code avec vos équipes :</p>${invitationMarkup()}<button class="btn ghost full" data-action="copy-link">Copier le lien d’invitation</button>`:''}${!['lobby','finished'].includes(ph)?`<div class="answerbox"><small>RÉPONSE · ANIMATEUR</small><strong>${esc(targets(q)[0]==='answer'&&q.target!=='coverChoice'&&q.target!=='timeline'?q.answer:q.title||q.answer)}</strong>${q.artist?`<br>${esc(q.artist)}`:''}</div>`:''}${timelineControls(ph)}${q&&['lobby','ready'].includes(ph)?`<button class="btn primary full" data-action="play" ${busy||game.mode==='phone'&&game.teams.length<(game.teamPlay?game.teamPlan?.groups.length||2:game.randomTeamCount|| (game.settings?.chain?3:game.settings?.survival?2:1))?'disabled':''}>${busy?'Chargement de l’extrait…':'▶ '+(ph==='lobby'&&game.settings?.timelineMode?'Lancer le premier extrait à placer':ph==='lobby'?'Lancer la partie':(q?.kind==='question'?'Afficher la question':'Lancer l’extrait'))}</button>`:''}${ph==='buzzed'?`${wanted.length===2?`<div class="judge-grid"><button class="btn good" data-action="v2-judge" data-value="title" ${claimed.title?'disabled':''}>✓ Titre</button><button class="btn good" data-action="v2-judge" data-value="artist" ${claimed.artist?'disabled':''}>✓ Artiste</button></div><button class="btn good full" data-action="good">✓ Les deux</button>`:'<button class="btn good full" data-action="good">✓ Bonne réponse</button>'}<button class="btn bad full" data-action="bad">✕ Mauvaise réponse</button>`:''}${isProgressive(game,q)&&['playing','paused'].includes(ph)&&(game.listenStep||0)<3?`<button class="btn lime full" data-action="listen-more">Écouter ${LISTEN_STEPS[(game.listenStep||0)+1]} secondes →</button>`:''}${ph==='playing'||game.mountain&&ph==='reveal'?'<button class="btn ghost full" data-action="pause">Ⅱ Mettre en pause</button>':''}${ph==='paused'?'<button class="btn lime full" data-action="resume">▶ Reprendre</button>':''}${!game.settings?.timelineMode&&game.mountain?.pausedReveal===undefined&&['playing','buzzed','paused'].includes(ph)?'<button class="btn ghost full" data-action="reveal">Révéler et terminer la manche</button>':''}${ph==='reveal'&&game.mountain?.phase!=='vote'?`<button class="btn primary full" data-action="next">${game.mountain?(game.mountain.winner?'Le podium 🏆':game.mountain.beneficiary&&game.mountain.phase==='result'?'Lancer l’attaque':'Question suivante →'):game.index+1>=(game.questions?.length||game.total)?'Le podium 🏆':game.settings?.timelineMode?'Extrait suivant →':'Question suivante →'}</button>${game.nextAt?`<p class="mini">La suite arrive automatiquement après ${game.settings?.autoNextSeconds||8} secondes.</p>`:''}`:''}${ph==='finished'||ph==='lobby'?'<button class="btn lime full" data-action="new-game">'+(q||ph==='finished'?'Choisir le jeu suivant':'Choisir le premier jeu')+'</button>':''}${game.mode==='phone'&&game.input!=='buzzer'&&ph==='playing'?`<p class="help">${Object.keys(game.answers||{}).length} / ${game.teams.length} équipe(s) ont répondu</p>`:''}${game.mountain&&game.mountain.pausedReveal===undefined&&['playing','paused'].includes(ph)?'<button class="btn ghost full" data-action="skip">Passer l’extrait</button>':''}${roundExitControls(ph,q)}${Object.keys(claimed).length?`<p class="mini">${claimed.title?'✓ Titre trouvé ':''}${claimed.artist?'✓ Artiste trouvé':''}</p>`:''}<div class="divider"></div><span class="eyebrow">LE CLASSEMENT</span>${leaderboard()}${eveningRanking()}${ph==='finished'?'<button class="btn ghost full" data-action="ceremony">Podium de la soirée · TV</button>':''}${game.teams.length?'<button class="textbtn" data-action="adjust">Ajuster un score</button>':''}${game.history?.length?'<button class="textbtn full" data-action="v2-history">Voir le détail des manches →</button>':''}</aside></div>${game.mode==='usb'?`<div class="keytips">${game.teams.map(t=>`<strong>[${esc(t.key)}]</strong> ${esc(t.name)}${game.blocked?.includes(t.id)?' · bloqué':''}`).join(' · ')}<br>Gardez la fenêtre du PC active pour recevoir les buzzers.</div>`:''}${audioError?`<div class="catalog-message">${esc(audioError)}</div>`:''}${q?.provider?'<p class="media-notice">Extrait Deezer diffusé par le PC animateur. Le titre complet est accessible après la révélation.</p>':''}${ph==='finished'?nextGameActions():''}</main>`;}
function showTVReaction(reaction){
 const stage=$('.tv-shell .stage');
 if(!stage||!reaction||game?.showAnimations===false||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 stage.animate([
  {boxShadow:'inset 0 0 0 transparent'},
  {boxShadow:`inset 0 0 5rem ${reaction.kind==='wrong'?'#ff8d8466':'#e7a74d88'}`},
  {boxShadow:'inset 0 0 0 transparent'}
 ],{duration:950,easing:'ease-out'});
}
function tvScreen(){return `<main class="tv-shell"><div class="row tv-toolbar">${brand()}<span class="right show-venue">GRAND SOIR · ${showVenue(game,wheel,ceremony)}</span><button class="btn" data-action="fullscreen">⛶ Plein écran</button></div><section class="stage ${game?.mountain?'mountain-stage':''} ${game?.phase==='playing'?'playing':''}">${game?.mountain?mountainMarkup():''}${stage()}
 ${game?.phase==='lobby'&&game.mode==='phone'&&room?`<aside class="show-tv-invite" aria-label="Rejoindre la soirée">${invitationMarkup()}<span>${game.teams.length} inscrit${game.teams.length===1?'':'s'}</span></aside>`:''}</section>${mountainStats()} ${scorebar()}${eveningRanking()}</main>`;}
const avatarCollections=[
 ['Les icônes du studio',[
  ['🪩','Boule disco'],['📼','Cassette'],['🔊','Enceinte'],['🎸','Guitare'],
  ['🎙️','Micro'],['🎧','Casque'],['📻','Radio'],['🎹','Clavier']
 ]],
 ['Les instruments',[
  ['🥁','Batterie'],['🎷','Saxophone'],['🎺','Trompette'],['🎻','Violon'],
  ['🪗','Accordéon'],['🪕','Banjo'],['🪘','Congas'],['🪇','Maracas']
 ]],
 ['Les stars du festival',[
  ['🕺','Danseur disco'],['💃','Danseuse de salsa'],['🤖','Robot DJ'],['👽','DJ cosmique'],
  ['🦄','Licorne pop'],['🦊','Renard rock'],['🐙','Poulpe percussionniste'],['🦜','Perroquet tropical']
 ]],
 ['Les coulisses du cinéma',[
  ['🎬','Clap'],['📽️','Projecteur'],['🍿','Pop-corn'],['🎭','Masques'],
  ['🎞️','Pellicule'],['🎩','Magicien'],['👻','Fantôme'],['🕵️','Détective']
 ]],
 ['Les effets de scène',[
  ['⚡','Éclair'],['🔥','Flamme'],['🚀','Fusée'],['🌈','Arc-en-ciel'],
  ['⭐','Étoile'],['🛸','Soucoupe'],['🎆','Feu d’artifice'],['🎉','Canon à confettis']
 ]]
];
const showAvatars=avatarCollections.flatMap(([collection,avatars],group)=>
 avatars.map(([icon,name])=>({icon,name,group}))
);
function avatarBadge(player){
 const avatar=showAvatars[player?.avatar];
 return avatar?`<span class="show-avatar" data-avatar="${player.avatar}" data-collection="${avatar.group}" role="img" aria-label="${avatar.name}">${avatar.icon}</span>`:'';
}
function avatarPicker(){
 return `<fieldset class="avatar-picker"><legend>Votre avatar · 40 choix</legend>
   <label><input type="radio" name="avatar" value="random" checked><span>Au hasard</span></label>
   ${avatarCollections.map(([name],group)=>`<details ${group===0?'open':''}>
    <summary>${name}</summary><div class="avatar-grid">
    ${showAvatars.map((avatar,index)=>avatar.group===group?
     `<label><input type="radio" name="avatar" value="${index}" aria-label="${avatar.name}"><span>${avatarBadge({avatar:index})}<small>${avatar.name}</small></span></label>`:'').join('')}
    </div></details>`).join('')}
 </fieldset>`;
}
function joinScreen(){return `<main class="phone-shell">${brand()}<div class="joincard"><span class="eyebrow">ON VOUS GARDAIT UNE PLACE</span><h1>Entrez dans la partie.</h1><p class="help">Votre prénom, le code de l’animateur et à vous de jouer.</p><form id="join-form"><label class="field-label" for="join-code">Code de la partie</label><input id="join-code" name="code" required minlength="8" maxlength="8" autocapitalize="characters" placeholder="EX. ABCD2345" value="${esc(room||'')}" autocomplete="off"><label class="field-label" for="join-name">Votre prénom ou nom d’équipe</label><input id="join-name" name="name" required maxlength="24" placeholder="Les rois du refrain" autocomplete="nickname">${avatarPicker()}<button class="btn primary full" type="submit" ${busy?'disabled':''}>${busy?'Connexion…':'Rejoindre la soirée →'}</button></form></div><p class="caption">Le son est diffusé dans la salle par l’animateur.<br>Gardez cet écran ouvert pendant la partie.</p></main>`;}
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
 return `<main class="phone-shell ${phase==='playing'?'phone-question phone-timeline':''}"><div class="row">${brand()}<span class="phone-game-label">${label}</span>${phoneScore()}</div><section class="stage"><div class="stage-content">
 <h1>${phase==='lobby'?'En attente de l’animateur':phase==='paused'?'Pause':phase==='reveal'?esc(q.title)+' · '+q.year:phase==='finished'?'Votre frise finale':'Placez la chanson'}</h1>
 ${phase==='playing'&&game.me?.attempts?'<p role="status">Réponse enregistrée.</p>':''}
 ${phase==='reveal'?`<p>${esc(q.artist||'')}</p><p role="status">${game.me?.attempts?(game.me.correct?'Bien placé !':'Placement incorrect'):'Sans réponse'}</p>`:''}
 ${timelineList(game.timelineCards,canAnswer?game.timelineSlots:[])}
 ${phase==='playing'?timerMarkup():''}
 ${result?`<p>Votre place · ${result.rank}</p><p>${result.correct} bonnes réponses sur ${result.total} · ${Math.round(100*result.correct/result.total)} %</p>`:''}
 </div></section>${game.mountain?mountainMarkup():''}${mountainStats()}${jokerPanel()}${eveningRanking()}</main>`;
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
 return `<main class="phone-shell bingo-phone ${phase==='playing'?'phone-question':''}"><div class="row">${brand()}<span class="phone-game-label">Bingo musical</span>${phoneScore()}</div>
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
 ${phase==='playing'?timerMarkup():''}
 ${ownProgress?`<p class="bingo-congrats" role="status">Bravo ! ${ownProgress.count} combinaison(s) complète(s)</p>`:phase==='reveal'?'<p role="status">'+(!game.me?.attempts?'Aucune réponse':game.me.correct?'Bonne réponse ✓':'Réponse incorrecte')+'</p>':''}`}</div></section>${eveningRanking()}</main>`;
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
function phoneScore(){
 const me=game?.teams?.find(t=>t.id===teamId);
 const team=game?.randomTeams?.find(group=>group.id===game.myRandomTeam)||game?.mountain?.teams.find(group=>group.id===game.mountain.team);
 return `<span class="phone-score">${avatarBadge(me)} <strong>${esc(me?.name||'Mon score')}</strong> · ${me?.score||0} pts${team?`<br>${esc(team.icon||'')} ${esc(team.name)} ${Number.isFinite(team.score)?'· '+team.score+' pts':''}`:''}</span>`;
}
function phoneScreen(){if(game?.timelineMode)return timelinePhone();if(game?.settings?.bingo)return bingoPhone();const q=currentQ(),me=game?.teams?.find(t=>t.id===teamId),ph=game?.phase,r=game?.me||{},parts=r.parts||[],locked=game?.input==='qcm'?(r.attempts||0)>=(game.joker?.retry?2:1):(r.attempts||0)>=5||q&&targets(q).every(p=>parts.includes(p));if(!game)return '<main class="phone-shell"><div class="empty">Connexion à la partie…</div></main>';const draft=replyDraft[q?.id]||{};return `<main class="phone-shell ${ph==='playing'?'phone-question':''}"><div class="row">${brand()}${phoneScore()}</div><span class="connection ${connected?'':'offline'}">${connected?'● Dans la partie':'○ Reconnexion en cours…'}</span><section class="stage"><div class="stage-content">${ph==='lobby'?'<div class="big-emoji">🙌</div><h1>Vous êtes dans la place !</h1><p class="help">L’animateur lance la partie dès que tout le monde est prêt.</p>':ph==='finished'?stage():ph==='reveal'?`<span class="eyebrow">LA BONNE RÉPONSE</span><h2>${esc(targets(q)[0]==='answer'&&!['coverChoice','timeline'].includes(q.target)?q.answer:q.title||q.answer)}</h2><p class="reveal-artist">${esc(q.artist||'')}</p><div class="round-points">+${r.total||0} points</div>${game.mountain?`<p>${r.correct?'Bonne réponse':r.attempts?'Réponse incorrecte':'Sans réponse'}</p>`:''}${scoreBreakdown(r)}${questionExplanation(q)}${q.provider?`<a class="source-credit" href="${esc(q.link)}" target="_blank" rel="noopener noreferrer">Écouter sur Deezer ↗</a>`:''}`:ph==='ready'?'<div class="big-emoji">👀</div><h1>La suite arrive…</h1>':ph==='paused'?'<div class="big-emoji">Ⅱ</div><h1>Petite pause.</h1><p class="help">On reprend avec l’animateur.</p>':Date.now()<game.startAt?`<h1 class="countdown">${Math.max(1,Math.ceil((game.startAt-Date.now())/1000))}</h1><p class="help">À vos marques…</p>`:`<span class="eyebrow">QUESTION ${questionNumber()}</span><h1>${esc(q.prompt)}</h1>${q.displayArtist?`<div class="artist-cue">${esc(q.displayArtist)}</div>`:''}${(q.target==='cover'||game.effect==='image')&&q.artwork?`<img src="${esc(q.artwork)}" alt="Pochette mystère" data-mystery>`:''}${listeningMarkup()}${game.input==='buzzer'?buzzerPanel():me?.eliminated&&!game.settings?.survival?'<p class="help">Vous êtes éliminé. Vous pouvez suivre la partie.</p>':locked?'<div class="big-emoji">✉️</div><p class="help">Réponse enregistrée. Verdict à la révélation !</p>':game.input==='qcm'?(q.target==='timeline'?timelineOptions(q):`<div class="options ${q.optionArtwork?'cover-options':''}">${q.options.map((o,i)=>`<button class="option" data-action="answer" data-value="${esc(o)}"><span class="letter">${'ABCDE'[i]}</span>${q.optionArtwork?`<img src="${esc(q.optionArtwork[i])}" alt="Pochette ${esc(o)}" width="160" height="160">`:esc(o)}</button>`).join('')}</div>`):q.musical?`<form id="answer-form" data-question="${esc(q?.id)}" class="music-reply">${targets(q).map(part=>`<label>${part==='title'?'Le titre':'L’artiste'} ${parts.includes(part)?'✓':''}<input name="${part}" aria-label="${part==='title'?'Titre':'Artiste'}" placeholder="${part==='title'?'Le titre du morceau…':'Le nom de l’artiste…'}" maxlength="180" value="${esc(draft[part]||'')}" ${parts.includes(part)?'disabled':''} autocomplete="off"></label>`).join('')}<button class="btn lime full" type="submit">Valider ma réponse →</button></form><p class="help">${parts.length?'✓ Réponse partielle validée. Continuez !':r.attempts?'Pas encore… Vous pouvez réessayer.':'Titre et artiste peuvent être validés séparément.'} · ${r.attempts||0}/5 essais</p>`:`<form id="answer-form" data-question="${esc(q?.id)}" class="textreply"><input name="answer" aria-label="Votre réponse" placeholder="Votre réponse…" value="${esc(draft.answer||'')}" maxlength="180" required autocomplete="off"><button class="btn lime" type="submit">→</button></form>`}${timerMarkup()}`}${game.settings?.survival&&Number.isInteger(me?.lives)?`<p class="help">${me.lives?'♥ '.repeat(me.lives).trim()+' · '+me.lives+' vie(s)':'Vous continuez pour le classement de la soirée.'}</p>`:''}${chainControls(me)}</div></section>${game.mountain?mountainMarkup():''}${mountainStats()}${jokerPanel()}${eveningRanking()}<div class="control" style="margin-top:20px"><span class="eyebrow">LE CLASSEMENT</span>${leaderboard()}${game.history?.length?'<button class="textbtn" data-action="v2-history">Le détail des manches →</button>':''}</div></main>`;}
function questionForm(q={}){const editing=!!q.id;modal(`<div class="top"><h2>${editing?'Modifier':'Créer'} une question</h2><button class="iconbtn" data-action="close-modal" aria-label="Fermer">×</button></div><form id="question-form" data-id="${esc(q.id||'')}"><div class="formgrid"><label>Type de défi<select name="kind"><option value="audio" ${q.kind==='audio'||!q.kind?'selected':''}>Extrait audio</option><option value="lyrics" ${q.kind==='lyrics'?'selected':''}>Paroles à compléter · audio avec coupure</option><option value="image" ${q.kind==='image'?'selected':''}>Image à deviner</option><option value="question" ${q.kind==='question'?'selected':''}>Question de musique</option></select></label><label class="wide">La question<input name="prompt" required maxlength="300" placeholder="Quel est le titre de cet extrait ?" value="${esc(q.prompt||'')}"></label><label class="wide">Coupure pour les paroles (secondes)<input name="cutAt" type="number" min="0.1" max="30" step="0.1" value="${q.cutAt||5}"><span class="mini">Type Paroles : lecture originale coupée ici, puis réponse orale, écrite ou QCM. Écrivez la phrase avec ___ dans la question. Ajoutez votre extrait chanté.</span></label><label class="wide">La bonne réponse<input name="answer" required maxlength="180" value="${esc(q.answer||'')}"></label><label>Titre musical (facultatif)<input name="title" value="${esc(q.title||'')}"></label><label>Artiste musical (facultatif)<input name="artist" value="${esc(q.artist||'')}"></label><label class="wide">Trois mauvaises réponses pour le QCM<textarea name="wrong" rows="3" required placeholder="Une réponse par ligne">${esc((q.options||[]).filter(o=>o!==q.answer).join('\n'))}</textarea></label><label class="wide">Autres réponses acceptées à l’écrit <span class="mini">(séparées par ;)</span><input name="aliases" value="${esc((q.aliases||[]).join('; '))}"></label><label>Durée (secondes)<input name="duration" type="number" min="5" max="90" value="${q.duration||30}" required></label><label>Points<input name="points" type="number" min="1" max="1000" value="${q.points||100}" required></label><label class="wide">Fichier audio ou image <span class="mini">· max. 30 Mo</span><input name="media" type="file" accept="audio/*,image/*"><span class="mini">${editing&&q.mediaKey?'Un fichier est déjà associé. Laissez vide pour le garder.':'Votre fichier reste sur ce PC.'}</span></label></div><button class="btn primary full" type="submit" style="margin-top:23px">Enregistrer la question</button></form>`);}
function modal(html){$('.dialog')?.remove();const d=document.createElement('div');d.className='dialog';d.innerHTML=`<div class="modal" role="dialog" aria-modal="true">${html}</div>`;document.body.append(d);d.querySelector('input,button')?.focus();}
function closeModal(){$('.dialog')?.remove();}
async function prepareImage(){const q=currentQ();if(!q)return;let url=q.imageUrl;if(!url&&q.mediaKey){if(!assetUrls.has(q.mediaKey)){const b=await getBlob(q.mediaKey);if(b?.type.startsWith('image/'))assetUrls.set(q.mediaKey,URL.createObjectURL(b));}url=assetUrls.get(q.mediaKey);}if(url&&$('[data-image]')){$('[data-image]').innerHTML=`<img src="${esc(url)}" alt="Image mystère à identifier" data-mystery>`;}}
function broadcastTV(){if(!game||role!=='host')return;const s=publicGame(game),q=currentQ();if(game.mode==='usb')s.eveningRanking=Object.values(usbEveningTotals(game)).sort((a,b)=>b.points-a.points);s.effect=game.effect||config.effect;s.roomCode=game.mode==='phone'?room:null;if(q?.mediaKey&&assetUrls.has(q.mediaKey)){s.question={...s.question,mediaKind:'image',imageUrl:assetUrls.get(q.mediaKey)};}channel.postMessage({type:'state',state:s});}
let lastShowLeader=null;
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
 const ev=game?.event;
 const reaction=ev&&ev.id!==lastEvent?stageReaction(game,lastShowLeader):null;
 if(game?.phase==='lobby')lastShowLeader=null;
 else if(game?.phase==='reveal')lastShowLeader=sorted()[0]?.score>0?sorted()[0].id:null;
 if(ev&&ev.id!==lastEvent){
  if(lastEvent&&game.settings?.bingo&&game.phase==='reveal'&&(
   role==='player'&&game.bingoProgressions?.some(p=>p.id===teamId)
  )){
   celebrate();
   if(role==='player'&&!matchMedia('(prefers-reduced-motion: reduce)').matches)navigator.vibrate?.(60);
  }
  const scored=game.phase==='reveal'&&(game.history?.at(-1)?.results||[]).some(row=>row.result.total>0);
  if(role==='player'&&(ev.type==='podium'||ev.type==='correct'&&ev.team===teamId))celebrate();
  if(role==='host'){
   const milestone=game.settings?.bingo&&game.phase==='reveal'&&game.bingoMilestones?.some(m=>m.index===game.index);
   const cue=game.mountain?.winner&&game.phase==='reveal'||milestone?'podium':
    game.mountain?.phase==='result'&&game.mountain.loser?'wrong':reaction?.kind||(scored?'correct':ev.type);
   if(game.phase!=='playing'||reaction)desk.jingle(cue);
  }
 }

 if(role==='host'&&game.phase!=='playing'&&!(game.phase==='lobby'&&desk.id===game.settings?.timelineAnchor?.id))desk.pause();
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
 if(role==='tv'&&reaction)showTVReaction(reaction);
 await prepareImage();if(role==='host'){broadcastTV();}
}
async function playTimelineAnchor(){
 const anchor=game?.settings?.timelineAnchor;
 if(!anchor||game.phase!=='lobby'||busy)return;
 const code=room;
 busy=true;
 render();
 try{
  await desk.unlock();
  const saved=read('declic.host',{});
  let clip=saved.room===code?saved.questions?.find(q=>q.id===anchor.id):null;
  if(!clip?.audioUrl&&!clip?.notes&&!clip?.mediaKey){
   const data=await apiJSON('/api/music/search?q='+encodeURIComponent(anchor.title+' '+anchor.artist));
   const track=matchSpecialTrack(data.tracks||[],anchor.title,anchor.artist);
   if(!track)throw Error('Extrait du morceau de départ indisponible.');
   clip={...anchor,audioUrl:'/api/music/preview/'+track.id};
  }
  if(room!==code||game.phase!=='lobby')return;
  audioReady=false;
  await desk.load(clip,clip.mediaKey?await getBlob(clip.mediaKey):null,'normal');
  if(room===code&&game.phase==='lobby'&&view==='studio'&&desk.buffer)desk.play(desk.buffer.duration);
 }catch(error){toast(error.message);}
 finally{busy=false;render();}
}
let audioLoading;
async function ensureAudio(q=currentQ()){
 if(!q||desk.id===q.id&&audioReady)return;
 if(audioLoading?.id===q.id)return audioLoading.promise;
 audioReady=false;
 audioError='';
 const track=q.provider==='Deezer'&&q.link?.match(/\/track\/(\d+)(?:[/?#]|$)/)?.[1];
 const loading={id:q.id,promise:(async()=>{
  await desk.load(!q.audioUrl&&track?{...q,audioUrl:'/api/music/preview/'+track}:q,
   q.mediaKey?await getBlob(q.mediaKey):null,q.kind==='lyrics'?'normal':game.effect||config.effect);
  if(desk.id!==q.id)return;
  if(q.kind==='lyrics'&&desk.buffer&&q.cutAt>=desk.buffer.duration)throw Error('La coupure doit précéder la fin du fichier audio. Modifiez la question.');
  audioReady=true;
 })()};
 audioLoading=loading;
 try{await loading.promise;}finally{if(audioLoading===loading)audioLoading=null;}
}
let autoAttempt=null;
async function startStudioRound(automatic=false){
 const question=currentQ(), code=room, phase=game?.phase;
 if(busy||!question||!['lobby','ready'].includes(phase))return;
 if(automatic){
  if(!game.settings.autoHost||phase!=='ready'||!connected||desk.ctx?.state!=='running'||autoAttempt===question.id)return;
  autoAttempt=question.id;
 }
 busy=true;render();
 try{
  if(!automatic)await desk.unlock();
  await ensureAudio(question);
  if(room!==code||game?.phase!==phase||currentQ()?.id!==question.id)return;
  if(automatic&&!connected){autoAttempt=null;return;}
  send({type:'play',...(game.settings?.bingo?{sourceDuration:desk.buffer?.duration}:{})});
 }catch(error){
  audioError=game?.settings?.autoHost?'Extrait indisponible. Utilise le bouton de lancement pour réessayer.':error.message;
  toast(audioError);
 }finally{busy=false;render();}
}
async function playTyrolienClip(){
 const clip=game?.tyrolien?.question?.audio;
 if(!clip)return;
 await desk.load(clip,null,'normal');
 if(game?.tyrolien?.question?.id===clip.id&&['listen','answer'].includes(game.tyrolien.phase)){
  desk.play(desk.buffer?.duration||0);
 }
}
function send(action){if(['answer','joker','buzz','listen-more','judge','bingo-mark','chain-bank','chain-vote','ty-vote'].includes(action.type)||game?.mountain&&['next','skip','reveal','pause','resume'].includes(action.type))action.questionId=currentQ()?.id;if(game?.mode==='phone'){if(!ws||ws.readyState!==WebSocket.OPEN){toast('Connexion interrompue. Attendez la reconnexion.');return;}ws.send(JSON.stringify(action));}else{const next=action.type==='leave-game'?returnToLobby(game,game.phase==='finished'?usbEveningTotals(game):game.eveningTotals):applyAction(game,action);if(next!==game){game=next;if(next.mode==='usb')queueUSB(next);if(action.type==='leave-game'){desk.stop();desk.id=null;}void receive();}}}
async function requestRoom(payload){
 const response=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
 const data=await response.json();
 if(!response.ok)throw Error(data.error);
 return data;
}
let resumeOnConnect=false;
function openHostRoom(data,questions,effect,nextView){
 resumeOnConnect=nextView==='resume';
 room=data.code;
 auth={type:'host',token:data.token};
 write('declic.host',{room,token:data.token,effect,questions});
 game=null;
 desk.stop();desk.id=null;audioReady=false;lastEvent=null;replyDraft={};
 view=resumeOnConnect?'studio':nextView;
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
  body:data===undefined?undefined:JSON.stringify(data),cache:'no-store',signal:AbortSignal.timeout(path.startsWith('/api/library/previews?')?25000:12000)
 });
 const result=await response.json();
 if(!response.ok)throw Object.assign(Error(result.error),{status:response.status});
 return result;
}
async function checkPreview(path){
 if(!/^\/api\/music\/preview\/\d{1,20}$/.test(path||''))throw Error('Extrait invalide.');
 const response=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(24000)});
 if(!response.ok||!response.body||!response.headers.get('content-type')?.startsWith('audio/')){
  await response.body?.cancel();
  throw Error('Extrait indisponible.');
 }
 const reader=response.body.getReader();
 try{
  const {value}=await reader.read();
  if(!value?.length)throw Error('Extrait vide.');
 }finally{await reader.cancel();}
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
  activeEvening=active;useEveningHistory();
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
 ceremony=null;
 clearTimeout(wheelTimer);wheel=null;localWheel=null;surprisePending=false;
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
  activeEvening=active;useEveningHistory();
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
   activeEvening=active;useEveningHistory();
   queueUSB(legacy);
   await flushUSB();
   localStorage.removeItem('declic.localGame');
   openUSB(legacy);
  }catch(error){toast(error.message);}
  return;
 }
 if(game&&room===activeEvening.code){view=game.phase==='finished'?'setup':game.tyrolien||game.questions.length?'studio':'setup';render();return;}
 const state=usbQueue.at(-1)?.state??activeEvening.usb?.state;
 if(state){openUSB(state);return;}
 const saved=read('declic.host',{});
 openHostRoom(activeEvening,saved.room===activeEvening.code?saved.questions:[],saved.effect,'resume');
}
function openUSB(state){
 clearTimeout(reconnect);
 if(ws){ws.onclose=null;ws.close();ws=null;}
 room=activeEvening.code;auth={type:'host',token:activeEvening.token};
 game=state;desk.id=null;audioReady=false;view=state.phase==='finished'?'setup':'studio';
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
function usbEveningTotals(state){
 const totals={...state.eveningTotals};
 if(!state.history?.length)return totals;
 for(const stats of roundStatistics(state.history,state.teams)){
  const prior=totals[stats.id]||{};
  const participant=state.teams.find(team=>team.id===stats.id);
  totals[stats.id]={id:stats.id,name:stats.name,avatar:participant.avatar,
   games:(prior.games||0)+1,points:(prior.points||0)+participant.score,
   correct:(prior.correct||0)+stats.correct,played:(prior.played||0)+state.history.length,
   best:Math.min(prior.best??Infinity,stats.best??Infinity)};
  if(!Number.isFinite(totals[stats.id].best))totals[stats.id].best=null;
 }
 return totals;
}
async function launch(){if(busy)return;busy=true;catalogMessage='';audioError='';render();
 try{
 const mountain=config.musicGame==='tyrolien';
 const demoMountain=mountain&&config.source==='demo';
 config.effect='normal';
 if(!demoMountain)config.source='catalog';
 if(config.challenge==='lyrics')config.challenge='title';
 config.explicit=!explicitPreference;
 const special=config.source==='catalog'&&Object.hasOwn(SPECIAL_TRACKS,config.musicGame)?config.musicGame:null;
 const chain=config.musicGame==='chain'&&config.source==='catalog'&&config.universe==='music';
 const bingo=config.musicGame==='bingo'&&config.source==='catalog'&&config.universe==='music';
 const survival=config.musicGame==='survival'&&config.source==='catalog'&&config.universe==='music';
 const covers=config.challenge==='coverChoice'&&config.source==='catalog'&&config.universe==='music';
 if((chain||special||bingo||survival||covers)&&(config.mode!=='phone'||config.input!=='qcm'))throw Error('Ce jeu se joue en QCM sur téléphone.');
 if(covers&&config.effect==='image')throw Error('Choisissez un autre effet pour garder la bonne pochette cachée.');
 if(!demoMountain&&selectedPlaylists.length){
  playlistGroups=(await hostRequest('/api/library')).categories;playlistLoadedAt=Date.now();
  const index=playlistIndex();
  const choices=selectedPlaylists.map(id=>index.get(id)||verifiedPlaylists[id]).filter(Boolean).map(item=>[item.id,item.name]);
  if(choices.length!==selectedPlaylists.length)throw Error('Une playlist sélectionnée est introuvable. Retirez-la puis réessayez.');
  await resolvePlaylistSelection(choices);
 }
 if(!special&&config.source==='catalog'&&config.universe==='music'&&(!catalogPool.tracks.length||config.catalogFrom!=='explorer'&&catalogPool.themeKey!==config.themes.join(',')))await loadThemes();
 const selection=special==='soundtrack'?(config.soundtrackCategory||'soundtrack'):special;
 let qs=demoMountain?DEMO.filter(q=>q.kind==='audio').map(q=>({...q,title:q.answer,artist:q.id==='m2'?'Ludwig van Beethoven':'Traditionnel',titleAliases:q.aliases,target:'title'})):selection?await loadSpecialQuestions(selection,selectedPlaylists.length>0):selectedQuestions();if(!qs.length)throw Error(covers?'Choisissez des titres issus d’au moins quatre albums différents.':config.challenge==='artistTitle'?'Il faut au moins 4 titres du même artiste pour ce défi. Recherchez un artiste dans Les musiques.':'Aucun contenu jouable dans cette sélection. Ajoutez des titres ou choisissez Découverte.');
 if(bingo){
  if(qs.length<BINGO_CARD_SIZE)throw Error('Choisissez au moins 16 chansons avec un extrait disponible.');
  qs=qs.map(q=>({...q,prompt:config.challenge==='artist'?'Retrouvez l’artiste sur votre grille.':'Retrouvez le titre sur votre grille.'}));
 }
 if(!special&&!bingo&&config.effect==='image'){qs=qs.filter(q=>q.kind==='image'||q.artwork);if(!qs.length)throw Error('Choisissez des questions avec une image ou des pochettes pour cet effet.');}
 const requested=special==='timeline'?Math.max(5,Number(config.timelineCount)||5)+1:bingo?BINGO_CARD_SIZE:config.count;
 if(!mountain&&qs.length<requested)throw Error(`La sélection contient ${qs.length} question(s) pour ${requested} demandées. Ajoutez des titres ou réduisez le nombre de questions.`);
 if(!availableGame(config.musicGame||'blind'))throw Error('Ce jeu nécessite des téléphones.');
 if(config.mode==='usb'){const keys=config.teams.map(t=>t.key.toLowerCase());if(keys.some(k=>!k.trim())||new Set(keys).size!==keys.length)throw Error('Attribuez une touche différente à chaque équipe.');if(config.teams.some(t=>!t.name.trim()))throw Error('Donnez un nom à chaque équipe.');}
 await desk.unlock();
 const questions=qs.map(q=>({...q,id:randomUUID(),duration:bingo||survival||special==='timeline'?30:Math.min(q.audioUrl?30:90,Math.max(config.duration,q.kind==='lyrics'?q.cutAt+5:0)),target:q.target,artwork:q.artwork}));
 if(!activeEvening)throw Error('Créez une soirée depuis l’accueil.');
 const showTheme=playlistShowTheme(config.source==='catalog'?(catalogPool.playlistIds||[]):[]);
 if(config.mode==='usb'){
  const state=createGame(questions,config.teams,'usb','text',config.settings);
  state.effect=config.effect;
  state.musicGame=config.musicGame;
  state.showAnimations=showAnimations;
  state.showTheme=showTheme;
  state.eveningTotals=game?.mode==='usb'?usbEveningTotals(game):{};
  queueUSB(state);openUSB(state);recordLaunch();return;
 }
 if(usbQueue.length)throw Error('Attendez la sauvegarde USB avant de changer de mode.');
 let timelineAnchor, timelineOpening;
 if(special==='timeline'){
  if(questions.length<6)throw Error('Il faut au moins six chansons datées et jouables, dont une pour commencer.');
  timelineOpening=questions.shift();
  const {id,title,artist,year}=timelineOpening;
  timelineAnchor={id,title,artist,year};
 }
 const clean=questions.map(({mediaKey,mediaType,notes,audioUrl,...q})=>q);
 const existing={room:activeEvening.code,token:activeEvening.token};
 const effect=bingo||special?'normal':config.effect;
 const data=await requestRoom({...existing,questions:clean,mountain:mountain?{levels:config.mountainLevels,bonuses:config.mountainAttacks!=='off'}:undefined,input:config.input,musicGame:config.musicGame,showAnimations,showTheme,teamPlay:sharedTeamsSelected(),randomTeamCount:sharedTeamsSelected()?game?.teamPlan?.groups.length||2:0,settings:{...config.settings,autoHost:config.settings.autoHost&&automaticChoicesAvailable(),survival,bingo,chain,timelineMode:timelineAnchor?(config.timelineMode||'collective'):undefined,timelineAnchor,listening:bingo||chain?'continuous':config.settings.listening},effect});
 if(activeEvening.usb?.state){
  const {revision}=await eveningRequest('PUT',{code:activeEvening.code,revision:usbRevision,id:randomUUID(),state:null});
  usbRevision=revision;activeEvening.usb={state:null,revision};
 }
 recordLaunch();
 openHostRoom(data,timelineOpening?[timelineOpening,...questions]:questions,effect,'studio');
 }catch(e){catalogMessage=e.message||'Impossible de préparer la partie.';toast(catalogMessage);setupStep='cast';view='setup';}finally{busy=false;render();}
}
let mountainRefresh=0;
function receiveMountainAnswer(message){
 if(!game?.mountain||game.phase!=='playing'||message.questionId!==currentQ()?.id||message.revision<=game.revision)return;
 game.answers[message.player]=message.result;
 game.revision=message.revision;
 if(!mountainRefresh)mountainRefresh=requestAnimationFrame(()=>{
  mountainRefresh=0;
  if(game?.mountain&&game.phase==='playing'&&view==='studio')render();
 });
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
 socket.onmessage=e=>{if(e.data==='pong')return;try{const m=JSON.parse(e.data);if(m.type==='team-plan'){if(game){game.teamPlan=m.teamPlan;render();}return;}if(m.type==='ceremony'){showCeremony(m);return;}if(m.type==='roulette'){showWheel(m.wheel);return;}if(m.type==='mountain-answer'){receiveMountainAnswer(m);return;}if(m.type==='bingo-answer'){receiveBingoAnswer(m);return;}if(m.type==='error'){busy=false;if(pendingBingo){pendingBingo=undefined;render();}toast(m.message);if(view==='join')render();if(/expir|introuvable|refus|commencé|déjà|maximum|Entrez/.test(m.message)){socket.onclose=null;socket.close();connected=false;}return;}if(m.type==='session'){teamId=m.id;sessionStorage.setItem('declic.player.'+room,JSON.stringify({id:m.id,token:m.token}));auth={type:'join',token:m.token};role='player';view='phone';busy=false;}if(m.type==='state'){game=m.state;wheel=game.roulette||null;if(role==='host'&&resumeOnConnect){resumeOnConnect=false;if(game.phase==='finished')view='setup';}if(game.tyrolien){void receive();return;}game.teams=game.teams.map(({id,name,score,key,streak,eliminated,lives,bingo,avatar})=>({id,name,score,key,streak,eliminated,lives,bingo,avatar}));if(role==='host'){if(!game.questions.length&&game.event?.type==='salon'){desk.stop();desk.id=null;}const saved=read('declic.host',{});if(saved.room===room){game.effect=saved.effect||game.effect;const originals=new Map(saved.questions?.map(q=>[q.id,q]));game.questions=game.questions.map(q=>({...originals.get(q.sourceId||q.id),...q}));}if(game.phase==='playing'&&audioLoading?.id!==currentQ()?.id&&(!audioReady||desk.id!==currentQ()?.id))void ensureAudio().catch(error=>{audioError=error.message;toast(error.message);render();});}void receive();}}catch{toast('Erreur de synchronisation.');}};
 socket.onclose=event=>{connected=false;busy=false;
 if(event.code===4001){
  if(role==='host'){if(!changingEvening){clearEvening();view='home';void loadEvening();}}
  else{sessionStorage.removeItem('declic.player.'+room);role='host';view='join';game=null;room=null;toast('Cette soirée est terminée.');render();}
  return;
 }if(view==='join'){toast('Partie introuvable ou indisponible. Vérifiez le code.');render();return;}render();reconnect=setTimeout(()=>connect(),2500);};socket.onerror=()=>{};
}
setInterval(()=>{if(ws?.readyState===WebSocket.OPEN)ws.send('ping');},25000);
setInterval(()=>{
 const now=Date.now();
 const voteClock=$('[data-vote-clock]');
 if(voteClock&&wheel)voteClock.textContent=Math.max(0,Math.ceil((wheel.deadline-now)/1000))+' s';
 if(!game)return;const ph=game.phase;
 if(role==='host'&&ph==='ready'&&game.settings?.autoHost)void startStudioRound(true);
 if(game.tyrolien){
  const clock=$('[data-ty-clock]');
  if(clock)clock.textContent=Math.max(0,Math.ceil((game.tyrolien.nextAt-now)/1000))+' s';
  return;
 }
 const mountainClock=$('[data-ty-clock]');
 if(mountainClock)mountainClock.textContent=Math.max(0,Math.ceil((game.nextAt-now)/1000))+' s';
 if(role==='host'&&game.mode==='usb'&&ph==='reveal'&&game.nextAt&&now>=game.nextAt){send({type:'next'});return;}
 if(ph==='playing'){
  if(role==='host'&&now>=game.startAt&&now<game.endAt){const heard=currentQ()?.trackId;if(heard&&!eveningUsage.songs.includes(heard))rememberUsage('songs',[heard]);}
  const n=Math.max(0,Math.ceil((game.startAt-now)/1000));if(seenCount!==n){const previous=seenCount;seenCount=n;if(n||previous>0){render();void prepareImage();}if(n&&role==='host'&&showAnimations&&n!==countdown){desk.jingle('tick');countdown=n;}}
  if(role==='host'&&audioReady&&desk.id===currentQ()?.id&&now>=game.startAt&&now<game.endAt){const segment=currentQ()?.id+':'+(game.listenStep||0);if(audioSegment!==segment){desk.stop();audioSegment=segment;}const left=audioRemaining(game,now);if(left>0)desk.play(left);else desk.pause();}
  if(now>=game.endAt&&role==='host'&&game.mode==='usb'){send({type:'timeout'});return;}
 }
 document.querySelectorAll('[data-listen-status]').forEach(el=>el.textContent=audioRemaining(game,now)>0?'♫ Écoutez…':'À vous de répondre !');updateBuzzer();
 const q=currentQ(),duration=(q?.duration||30)*1000,remaining=['buzzed','paused'].includes(ph)?game.remaining:Math.max(0,game.endAt-now), pct=ph==='playing'?Math.min(100,remaining/duration*100):ph==='reveal'?0:100;
 document.querySelectorAll('[data-time]').forEach(el=>el.textContent=ph==='playing'?(now<game.startAt?'Préparez-vous':Math.ceil(remaining/1000)+' s'):['buzzed','paused'].includes(ph)?'En pause':ph==='reveal'?'Réponse révélée':'À vous de jouer');document.querySelectorAll('[data-progress]').forEach(el=>el.style.width=pct+'%');
 document.querySelectorAll('[data-mystery]').forEach(el=>el.style.filter=((game.effect||config.effect)==='image'||q?.target==='cover')&&ph!=='reveal'?`blur(${ph==='playing'?Math.max(0,remaining/duration*22):22}px)`:'none');
},150);
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const act=b.dataset.action,v=b.dataset.value;
 try{
 if(act.startsWith('ty-')){
  if(act==='ty-home'){view='home';render();return;}
  if(act==='ty-new-game'){setupStep='game';view='setup';render();return;}
  if(act==='ty-replay'){await playTyrolienClip();return;}
  if(act==='ty-resume')await desk.unlock();
  if(act==='ty-stop'&&!window.confirm('Terminer la partie du Tyrolien ?'))return;
  send({type:act,value:v,questionId:game?.tyrolien?.question?.id});
  return;
 }
 if(act==='mountain-vote'){send({type:'ty-vote',value:v});return;}
 if(act==='skip'||act==='stop'){
  if(act==='stop'&&!window.confirm(v==='bingo-line'?'Terminer le Bingo et couronner le gagnant de la première ligne ?':'Terminer ce jeu et afficher les résultats ?'))return;
  send({type:act,bingoLine:v==='bingo-line'});return;
 }
 if(act==='leave-game'){
  if(!window.confirm(game.phase==='finished'?'Revenir au salon de la soirée ?':'Quitter ce jeu ? La partie en cours sera abandonnée. Les participants et les résultats précédents seront conservés.'))return;
  send({type:'leave-game',gameId:game.questions?.[0]?.id||null});
  return;
 }
 if(act==='close-modal'){closeModal();return;}
 if(act==='arrival-sound'&&role==='host'){
  if(!arrivalSound||desk.ctx?.state!=='running')await desk.unlock();
  arrivalSound=!arrivalSound;write('declic.arrivalSound',arrivalSound);
  if(arrivalSound)playShowCue(desk.ctx,'arrival');
  render();return;
 }
 if(act==='fullscreen'){if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();return;}
 if(act==='toggle-show'){showAnimations=!showAnimations;write('declic.showAnimations',showAnimations);render();return;}
 if(act==='ceremony'){await desk.unlock();publishCeremony(!ceremony);return;}
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
 if(act==='teams-config'){send({type:act,count:Number(v)});return;}
 if(act==='teams-mode'){send({type:act,mode:v});return;}
 if(act==='teams-open'){send({type:act,open:!game?.teamPlan?.open});return;}
 if(act==='teams-shuffle'){send({type:act});return;}
 if(act==='teams-choose'){choosingWhileGathering=false;send({type:act,group:v});return;}
 if(act==='teams-gather'){send({type:act,active:!game?.teamPlan?.gather});return;}
 if(act==='teams-pick-during-gather'){choosingWhileGathering=true;render();return;}
 if(act==='teams-fullscreen'){
  try{
   if(document.fullscreenElement){await document.exitFullscreen();teamFullscreen=false;}
   else if(document.documentElement.requestFullscreen){await document.documentElement.requestFullscreen();teamFullscreen=true;}
  }catch{/* L’affichage coloré fonctionne dans la fenêtre. */}
  return;
 }
 if(act==='music-game'){surprisePending=false;selectGame(v);return;}
 if(act==='setup-step'){
  setupStep=v;render();$('.game-setup h2')?.scrollIntoView({block:'nearest'});
  if(v==='music'&&surprisePending&&preferredModes.playlist!=='manual')await startWheel('playlist',preferredModes.playlist);
  return;
 }
 if(act==='playlist-toggle'){
  selectedPlaylists=selectedPlaylists.includes(v)?selectedPlaylists.filter(id=>id!==v):[...selectedPlaylists,v];
  if(!selectedPlaylists.length){config.catalogFrom='themes';saveConfig();}
  savePlaylistSelection();render();return;
 }
 if(act==='playlist-clear'){selectedPlaylists=[];config.catalogFrom='themes';savePlaylistSelection();saveConfig();render();return;}
 if(act==='playlist-favorite'){togglePlaylistFavorite(v);render();return;}
 if(act==='playlist-reload'){playlistGroups=null;loadPlaylistGroups();render();return;}
 if(act==='playlist-category'){
  playlistCategory=v;playlistSearch='';playlistLetter='';playlistPage=0;render();return;
 }
 if(act==='playlist-letter'){playlistLetter=v;playlistPage=0;render();return;}
 if(act==='playlist-page'){playlistPage+=Number(v);render();return;}
 if(act==='setup-choice'){
  const key=b.dataset.key;
  if(key==='challenge'){
   config.challenge=v;
   if(config.mode==='phone'&&v==='both'&&config.input==='qcm')config.input='text';
  }else if(key==='participation'||key==='randomTeamCount'||key==='timelineMode'||key==='soundtrackCategory'||key==='coversDirection'||key==='source'){
   config[key]=v;
  }
  if(key==='participation'&&sharedTeamsSelected()&&!game?.teamPlan&&game?.mode==='phone')send({type:'teams-config',count:2});
  saveConfig();render();return;
 }
 if(act==='question-count'){customQuestionCount=v==='custom';if(!customQuestionCount){config[config.musicGame==='timeline'?'timelineCount':'count']=questionCount(v);saveConfig();}render();return;}
 if(act==='replay-playlist'){
  view='setup';
  if(game?.musicGame)selectGame(game.musicGame);setupStep='music';render();
  $('.setup-music')?.scrollIntoView({block:'start'});return;
 }
 if(act==='selection-panel'){selectionPanel=selectionPanel===v?'':v;render();return;}
 if(act==='selection-mode'){
  const kind=b.dataset.kind;
  if(!['game','playlist'].includes(kind)||!selectionModes.some(([id])=>id===v))return;
  preferredModes[kind]=v;write('declic.selectionModes',preferredModes);render();return;
 }
 if(act==='surprise-total'){
  if(busy||wheel&&!wheel.result)return;
  if(view!=='setup'){view='setup';render();}
  surprisePending=true;
  const kind=preferredModes.game==='manual'?'playlist':'game';
  if(preferredModes[kind]==='manual'){surprisePending=false;toast('Choisis le jeu et la playlist, puis lance la partie.');return;}
  try{await startWheel(kind,preferredModes[kind]);}catch(error){surprisePending=false;throw error;}
  return;
 }
 if(act==='roulette-game'||act==='roulette-playlist'){
  if(busy||wheel&&!wheel.result)return;
  surprisePending=false;
  if(view!=='setup'){view='setup';render();}
  await startWheel(act.split('-')[1],v||'participatory');return;
 }
 if(act==='roulette-vote'){await wheelAction({type:act,id:wheel?.id,choice:v});return;}
 if(act==='usb-vote-choice'){usbVoteChoice=v;publishLocalWheel();return;}
 if(act==='roulette-stop'){await wheelAction({type:act,id:wheel?.id});return;}
 if(act==='roulette-dismiss'){surprisePending=false;await wheelAction({type:act,id:wheel?.id});return;}
 if(act==='roulette-retry'){await startWheel(wheel.kind,wheel.originMode||wheel.mode,playlistShortlist);return;}
 if(act==='roulette-confirm'){await confirmWheel();return;}
 if(act==='playlist-open'||act==='playlist-filters'){
  libraryLaunch=act==='playlist-open'?{playlist:v}:{dynamic:true};
  viewBeforeLibrary='setup';view='music-library';render();return;
 }
 if(act==='game-rules'){
  const [,name,description]=MUSIC_GAMES.find(([id])=>id===config.musicGame)||MUSIC_GAMES[5];
  const dialog=document.createElement('dialog');
  dialog.className='evening-dialog';
  dialog.setAttribute('aria-labelledby','setup-rules-title');
  dialog.innerHTML=`<h2 id="setup-rules-title">${name}</h2><p>${description}</p><form method="dialog"><button class="btn ghost">Fermer</button></form>`;
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  document.body.append(dialog);
  dialog.showModal();
  return;
 }
 if(act==='mode'){config.mode=v;if(!availableGame(config.musicGame)){config.musicGame='blind';config.challenge='title';}if(v==='phone'&&config.input==='qcm'&&config.challenge==='both')config.challenge='title';saveConfig();render();return;}
 if(act==='add-team'){const id=randomUUID();config.teams.push({id,name:'Équipe '+(config.teams.length+1),key:'1234567890'.split('').find(k=>!config.teams.some(t=>t.key===k))});saveConfig();render();return;}
 if(act==='remove-team'){config.teams.splice(Number(v),1);saveConfig();render();return;}
 if(act==='launch'){if(ceremony)publishCeremony(false);await launch();return;}
 if(act==='next'&&game?.settings?.timelineMode&&game.phase==='reveal'&&game.questions[game.index+1]){
  if(busy)return;
  busy=true;render();
  try{
   await ensureAudio(game.questions[game.index+1]);
   send({type:'timeline-next'});
  }catch(error){toast(error.message);}
  finally{busy=false;render();}
  return;
 }
 if(act==='timeline-anchor'){await playTimelineAnchor();return;}
 if(act==='new-game'){desk.stop();setupStep='game';view='setup';render();return;}
 if(act==='screen'){const tvCode=game?.mode==='usb'||activeEvening?.usb?.state?null:room||activeEvening?.code;const win=window.open(tvCode?'/tv?code='+encodeURIComponent(tvCode):'/tv','declic-public','width=1280,height=800');if(!win)toast('Autorisez les fenêtres pour ouvrir l’écran public.');return;}
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
 if(act==='play'){await startStudioRound();return;}
 if(['pause','resume','good','bad','reveal','next','listen-more'].includes(act)){
  await desk.unlock();
  send(act==='good'||act==='bad'?{type:'judge',correct:act==='good'}:{type:act});return;
 }
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
 if(e.target.id==='source'){config.source=e.target.value;if(config.challenge==='coverChoice')config.challenge='title';saveConfig();render();}
 if(e.target.id==='inputmode'){config.input=e.target.value;if(config.input==='qcm'&&config.challenge==='both')config.challenge='title';saveConfig();render();}
 if(e.target.id==='import-json')try{const file=e.target.files[0];if(!file)return;if(file.size>1e6)throw Error('Le JSON doit faire moins de 1 Mo.');const data=JSON.parse(await file.text());if(!Array.isArray(data.questions)||data.questions.length>100)throw Error('Le fichier doit contenir une liste de 100 questions maximum.');const imported=data.questions.map(q=>{if(q.universe!=='music'||!['audio','image','question','lyrics'].includes(q.kind)||typeof q.prompt!=='string'||q.prompt.length>300||typeof q.answer!=='string'||!q.answer.trim()||q.answer.length>180||!Array.isArray(q.options)||q.options.length!==4||q.options.some(o=>typeof o!=='string'||o.length>180)||!q.options.includes(q.answer)||!Number.isFinite(q.duration)||q.duration<5||q.duration>90||!Number.isFinite(q.points)||q.points<1||q.points>1000)throw Error('Une question est invalide. Aucun import effectué.');if(q.kind==='lyrics'&&(!Number.isFinite(q.cutAt)||q.cutAt<.1||q.cutAt>30||q.cutAt>=q.duration))throw Error('La coupure d’une question paroles est invalide.');return {cutAt:q.kind==='lyrics'?q.cutAt:undefined,id:randomUUID(),universe:q.universe,kind:q.kind,prompt:q.prompt,answer:q.answer,aliases:(Array.isArray(q.aliases)?q.aliases:[]).filter(x=>typeof x==='string').map(x=>x.slice(0,180)),options:q.options,duration:q.duration,points:q.points,emoji:typeof q.emoji==='string'?q.emoji.slice(0,80):undefined};});custom.push(...imported);write('declic.library',custom);render();toast('Questions importées. Réassociez les fichiers dans l’éditeur.');}catch(err){toast(err.message);}
});
document.addEventListener('submit',async e=>{const f=e.target;if(f.method==='dialog')return;e.preventDefault();const data=new FormData(f);
 if(f.id==='question-form')try{const answer=String(data.get('answer')).trim(),wrong=String(data.get('wrong')).split('\n').map(x=>x.trim()).filter(Boolean);if(!answer||wrong.length!==3||new Set([answer,...wrong].map(x=>x.toLowerCase())).size!==4)throw Error('Saisissez une bonne réponse et trois mauvaises réponses différentes.');const existing=custom.find(q=>q.id===f.dataset.id),id=existing?.id||randomUUID();let mediaKey=existing?.mediaKey,mediaType=existing?.mediaType;const file=data.get('media'),kind=data.get('kind');if(file?.size){if(file.size>30*1024*1024)throw Error('Le fichier doit faire moins de 30 Mo.');if(['audio','lyrics'].includes(kind)&&!file.type.startsWith('audio/'))throw Error('Choisissez un fichier audio pour ce type de question.');if(kind==='image'&&!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))throw Error('Choisissez une image JPG, PNG, WebP ou GIF.');mediaKey=id;mediaType=file.type;await storeBlob(id,file);if(assetUrls.has(id)){URL.revokeObjectURL(assetUrls.get(id));assetUrls.delete(id);}}if(['audio','lyrics'].includes(kind)&&(!mediaKey||!mediaType?.startsWith('audio/')))throw Error('Ajoutez un fichier audio.');if(kind==='image'&&(!mediaKey||!mediaType?.startsWith('image/')))throw Error('Ajoutez une image.');const cutAt=Number(data.get('cutAt'));if(kind==='lyrics'&&(!Number.isFinite(cutAt)||cutAt<.1||cutAt>30||cutAt>=Number(data.get('duration'))))throw Error('La coupure doit être comprise entre 0,1 et 30 s, avant la fin de la manche.');const options=[answer,...wrong];for(let i=3;i>0;i--){const j=Math.floor(Math.random()*(i+1));[options[i],options[j]]=[options[j],options[i]];}const q={id,universe:'music',kind,prompt:String(data.get('prompt')).trim(),answer,aliases:String(data.get('aliases')).split(';').map(x=>x.trim()).filter(Boolean),options,duration:Number(data.get('duration')),points:Number(data.get('points')),mediaKey,mediaType,cutAt:kind==='lyrics'?cutAt:undefined,title:String(data.get('title')||'').trim()||undefined,artist:String(data.get('artist')||'').trim()||undefined,target:'both'};custom=existing?custom.map(v=>v.id===id?q:v):[...custom,q];write('declic.library',custom);closeModal();render();toast('Question enregistrée !');}catch(err){toast(err.message);}
 if(f.id==='join-form'){const code=String(data.get('code')).trim().toUpperCase();if(!/^[A-Z2-9]{8}$/.test(code)){toast('Entrez le code de 8 caractères.');return;}room=code;history.replaceState(null,'','/join?code='+encodeURIComponent(room));const saved=readPlayerSession(room);const choice=data.get('avatar');const avatar=choice==='random'?Math.floor(Math.random()*showAvatars.length):Number(choice);auth={type:'join',name:String(data.get('name')).trim(),avatar,token:saved?.token};teamId=saved?.id;busy=true;render();connect();}
 if(f.id==='answer-form'){send({type:'answer',answer:String(data.get('answer')||'').trim(),title:String(data.get('title')||'').trim(),artist:String(data.get('artist')||'').trim()});}
 if(f.id==='adjust-form'){send({type:'adjust',team:data.get('team'),points:Number(data.get('points'))});closeModal();}
});
document.addEventListener('keydown',e=>{
 if(role==='host'&&localWheel?.stopAt===null&&!e.repeat&&!e.target.closest('input,textarea,select')){
  const person=config.teams.find(team=>team.id===localWheel.player?.id);
  if(localWheel.mode==='vote'){
   const voter=config.teams.find(team=>team.key.toLowerCase()===e.key.toLowerCase());
   if(voter){
    e.preventDefault();
    void wheelAction({type:'roulette-vote',id:localWheel.id,choice:usbVoteChoice},{role:'player',team:voter.id});
   }
   return;
  }
  if(person?.key.toLowerCase()===e.key.toLowerCase()){
   e.preventDefault();
   void wheelAction({type:'roulette-stop',id:localWheel.id},{role:'player',team:person.id});
   return;
  }
 }
 if(e.key==='Escape'){closeModal();return;}
 if(role!=='host'||view!=='studio'||game?.mode!=='usb'||e.repeat||e.target.closest('input,textarea,select')||$('.dialog'))return;
 const t=game.teams.find(t=>t.key.toLowerCase()===e.key.toLowerCase());if(!t)return;e.preventDefault();if(game.phase==='lobby'){toast(t.name+' : buzzer reconnu !');void desk.unlock().then(()=>desk.jingle('buzz'));return;}send({type:'buzz',team:t.id});
});
function catalogScreen(){return `<main class="library"><div class="row"><div><span class="eyebrow">LA BOÎTE À TUBES</span><h1>Trouvez les sons de votre soirée.</h1><p class="help">Recherche de titres et de playlists Deezer. Les extraits sont écoutés à la demande.</p></div><div class="row"><button class="btn primary" data-action="v2-use-catalog">Utiliser ma sélection →</button></div></div><form id="catalog-search" class="catalog-search"><input name="query" placeholder="Un artiste, un titre…" aria-label="Rechercher des musiques" value="${esc(catalogQuery)}" minlength="2" required maxlength="120"><select name="type" aria-label="Type de recherche"><option value="tracks" ${catalogSearchType==='tracks'?'selected':''}>Titres</option><option value="playlists" ${catalogSearchType==='playlists'?'selected':''}>Playlists</option></select><button class="btn primary" ${busy?'disabled':''}>Rechercher</button></form><form id="playlist-import" class="playlist-import"><label for="playlist-url">Ou collez le lien d’une playlist Deezer publique</label><div class="row"><input id="playlist-url" name="url" placeholder="https://www.deezer.com/fr/playlist/…" required><button class="btn ghost" ${busy?'disabled':''}>Importer</button></div></form>${catalogMessage?`<div class="catalog-message" role="status">${esc(catalogMessage)}</div>`:''}<div class="catalog-meta"><strong>${esc(catalogPool.name||'Ma sélection')} · ${catalogPool.tracks.length} titre(s)</strong><div class="row"><button class="textbtn" data-action="v2-add-all" ${!catalogResults.tracks?.length?'disabled':''}>＋ Tous les résultats</button><button class="textbtn" data-action="v2-clear-pool" ${!catalogPool.tracks.length?'disabled':''}>Vider la sélection</button></div></div><div id="catalog-player" class="callout hidden" role="status"><span></span> <button class="btn ghost" data-action="v2-stop-preview">■ Arrêter l’écoute</button></div><div class="track-list">${(catalogSearchType==='playlists'?catalogResults.playlists:catalogResults.tracks||[]).map(t=>catalogSearchType==='playlists'?`<article class="track-row"><img src="${esc(t.artwork||'')}" alt="" loading="lazy"><div><strong>${esc(t.title)}</strong><small>${esc(t.author||'')} · ${t.tracks||'?'} titres</small></div><button class="btn ghost" data-action="v2-playlist" data-value="${esc(t.id)}">Importer</button></article>`:trackRow(t)).join('')}</div>${!catalogResults.tracks?.length&&!catalogResults.playlists?.length?'<div class="empty">Recherchez un artiste ou chargez vos thèmes depuis le studio.<br>Votre sélection est conservée dans ce navigateur.</div>':''}${catalogPool.tracks.length?`<div class="sectiontitle"><h2>Dans votre sélection</h2><span class="badge">${catalogPool.tracks.length} TITRES</span></div><div class="track-list">${catalogPool.tracks.map(t=>trackRow(t,true)).join('')}</div>`:''}<div class="callout">La connexion musicale active est Deezer. Spotify et Apple Music ne sont pas connectés dans cette version. Les fichiers audio personnels restent disponibles dans « Mes questions ».</div></main>`;}
function trackRow(t,inPool=false){const added=catalogPool.tracks.some(v=>v.id===t.id);return `<article class="track-row"><img src="${esc(t.artwork||'')}" alt="" loading="lazy"><div><strong>${esc(t.title)}</strong><small>${esc(t.artist)} ${t.explicit?'<b class="explicit">E</b>':''}</small><a href="${esc(t.link)}" target="_blank" rel="noopener noreferrer">Sur Deezer ↗</a></div><button class="btn ghost" data-action="v2-preview" data-value="${esc(t.id)}" aria-label="Écouter ${esc(t.title)}">▶</button><button class="btn ${inPool?'ghost':added?'good':'primary'}" data-action="${inPool?'v2-remove-track':'v2-add-track'}" data-value="${esc(t.id)}" ${!inPool&&added?'disabled':''}>${inPool?'Retirer':added?'✓ Ajouté':'＋ Ajouter'}</button></article>`;}
function scoreBreakdown(r){const labels={title:'Titre',artist:'Artiste',answer:'Réponse',speed:'Rapidité',streak:'Série'};return `<div class="score-breakdown">${Object.entries(r.breakdown||{}).filter(([,v])=>v>0).map(([id,v])=>`<span>${labels[id]} <b>+${v}</b></span>`).join('')}</div>`;}
function historyScreen(){return `<main class="library"><div class="row"><div><span class="eyebrow">CHAQUE DÉCLIC COMPTE</span><h1>Le bilan de la soirée.</h1></div><button class="btn ghost right" data-action="v2-return">Revenir au jeu</button><button class="btn primary" data-action="v2-export-results">Exporter le bilan</button></div><div class="results-leaders">${leaderboard()}</div>${(game?.history||[]).map(h=>`<details class="round-history" open><summary><span class="step">${h.index+1}</span>${esc(h.question.title||h.question.answer)}${h.question.artist?' · '+esc(h.question.artist):''}</summary>${questionExplanation(h.question)}${h.results.map(t=>`<div class="history-team"><strong>${esc(t.name)}</strong><span>+${t.result.total||0} pts</span>${scoreBreakdown(t.result)}</div>`).join('')}</details>`).join('')||'<div class="empty">Le détail sera disponible après la première révélation.</div>'}</main>`;}
function persistPool(){write('declic.musicPool',catalogPool);}
async function prepareLibrarySelection(selection){
 if(busy||!selection.length)return;
 selectedPlaylists=[...new Set(selection.map(([id])=>id))];
 savePlaylistSelection();
 view='setup';
 render();
}
async function resolvePlaylistSelection(selection){
 const required=config.musicGame==='bingo'?BINGO_CARD_SIZE:config.musicGame==='timeline'?Math.max(5,Number(config.timelineCount)||5)+1:Number(config.count)||10;
 const settings={...config,count:required};
 const params=new URLSearchParams(selection.map(([id])=>['playlist',id]));
 const {tracks:references}=await hostRequest('/api/library/candidates?'+params);
 const candidates=references.filter(candidate=>Boolean(specialEntry(candidate)));
 if(candidates.length<required)throw Error(`Cette sélection contient ${candidates.length} titre(s) compatible(s) pour ${required} nécessaires.`);
 const known=new Map(Object.values(verifiedPlaylists).flatMap(playlist=>playlist.tracks)
  .filter(track=>track.referenceId).map(track=>[track.referenceId,track]));
 for(const candidate of candidates)if(candidate.preview)known.set(candidate.id,candidate.preview);
 const played=new Set(eveningUsage.songs);
 const fresh=[], heard=[];
 let failedBatches=0;
 const enough=tracks=>tracks.length>=required&&(fixedGameMusic()||musicQuestions(tracks,settings).length>=required);
 const ordered=shuffle(candidates).sort((a,b)=>
  Number(played.has(known.get(a.id)?.id))-Number(played.has(known.get(b.id)?.id))||
  Number(known.has(b.id))-Number(known.has(a.id)));
 const limit=Math.min(ordered.length,Math.max(48,required*3));
 for(let offset=0;offset<limit&&!enough(fresh);offset+=8){
  const batch=ordered.slice(offset,offset+8);
  const missing=batch.filter(candidate=>!known.has(candidate.id));
  const queries=new URLSearchParams(missing.map(({title,artist})=>['q',(title+' '+artist).slice(0,180)]));
  const preview=missing.length?await hostRequest('/api/library/previews?'+queries):null;
  if(preview){
   failedBatches=preview.results.every(result=>result===null)?failedBatches+1:0;
   if(failedBatches>=2)throw Error('Le fournisseur d’extraits est indisponible. Réessayez dans quelques instants.');
  }
  const matches=new Map(missing.map((candidate,index)=>[candidate.id,
   matchSpecialTrack(preview?.results[index]||[],candidate.title,candidate.artist)]));
  const checked=await Promise.allSettled(batch.map(async candidate=>{
   const hit=known.get(candidate.id)||matches.get(candidate.id);
   if(!hit||!config.explicit&&hit.explicit)return null;
   await checkPreview(hit.preview);
   return {...hit,referenceId:candidate.id,year:candidate.year,work:candidate.work,entry:specialEntry(candidate)};
  }));
  for(const result of checked){
   const track=result.status==='fulfilled'&&result.value;
   if(track)(wheelPrefs.avoidSongs&&played.has(track.id)?heard:fresh).push(track);
  }
 }
 const tracks=enough(fresh)?fresh:[...fresh,...heard];
 if(!enough(tracks))throw Error(limit<ordered.length?'Pas assez d’extraits vérifiés dans les titres testés. Réduisez le nombre de questions ou réessayez.':'Cette sélection ne contient pas assez d’extraits disponibles pour ce jeu.');
 const ids=selection.map(([id])=>id);
 const name=ids.length===1&&ids[0]==='mix'?'Toutes les musiques':selection.map(([,label])=>label).join(' + ');
 if(ids.length===1){
  const id=ids[0];
  const previous=verifiedPlaylists[id]?.tracks||[];
  verifiedPlaylists[id]={id,name,tracks:[...new Map([...previous,...tracks].map(track=>[track.id,track])).values()].slice(-150)};
  try{write('declic.verifiedPlaylists',verifiedPlaylists);}catch{/* Le cache reste disponible en mémoire. */}
 }
 catalogPool={name,tracks,themeKey:'',playlistIds:ids};
 config.catalogFrom='explorer';persistPool();saveConfig();
}
function specialEntry(candidate){
 const {title,artist,year,work,workUnconfirmed,playlists}=candidate;
 switch(config.musicGame){
  case 'timeline':return year?[title,artist,year]:null;
  case 'soundtrack':{
   const category=config.soundtrackCategory||'soundtrack';
   const tags=category==='soundtrack'?['films','disney']:category==='tvThemes'?['tv','series','shows','cartoons']:['films','disney','tv','series','shows','cartoons'];
   return work&&!workUnconfirmed&&tags.some(tag=>playlists.includes(tag))?[title,artist,work]:null;
  }
  case 'coversQuiz':{
   const original=config.coversDirection==='original';
   const key=value=>value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
   const pair=SPECIAL_TRACKS.coversQuiz.find(([name,cover,first])=>key(name)===key(title)&&key(original?first:cover)===key(artist));
   return pair?[title,artist,original?pair[1]:pair[2]]:null;
  }
  default:return [];
 }
}
async function loadSpecialQuestions(mode,fromLibrary=false){
 if(fromLibrary){
  const count=mode==='timeline'?Math.max(5,Number(config.timelineCount)||5)+1:Number(config.count)||10;
  return specialQuestions(mode,catalogPool.tracks.map(track=>({track,entry:track.entry})),{...config,count});
 }
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
 if(act==='v3-buzz'){if(showAnimations&&game?.showAnimations!==false&&!matchMedia('(prefers-reduced-motion: reduce)').matches)navigator.vibrate?.(30);send({type:'buzz'});return;}
 if(act==='v2-catalog'){view='catalog';render();}
 if(act==='music-library'){libraryLaunch={};viewBeforeLibrary=view;view='music-library';render();}
 if(act==='library-back'){playlistGroups=null;view=viewBeforeLibrary;render();}
 if(act==='v2-return'){view=role==='player'?'phone':'studio';render();}
 if(act==='v2-history'){if(role==='host'&&game?.settings?.autoHost&&game.phase!=='finished')return;view='history';render();}
 if(act==='v2-export-results'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({name:'Déclic !',date:new Date().toISOString(),teams:game.teams.map(({id,name,score})=>({id,name,score})),rounds:game.history},null,2)],{type:'application/json'}));a.download='declic-bilan.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
 if(act==='v2-theme'){if(config.challenge==='lyrics')config.challenge='title';if(config.themes.includes(v)){if(config.themes.length===1){toast('Gardez au moins une ambiance.');return;}config.themes=config.themes.filter(id=>id!==v);}else{if(config.themes.length>=3){toast('Vous pouvez mélanger jusqu’à trois ambiances.');return;}config.themes.push(v);}config.catalogFrom='themes';config.source='catalog';saveConfig();render();}
 if(act==='v2-challenge'){config.challenge=v;if(v==='lyrics')config.source='custom';if(!(['bingo','survival','blind'].includes(config.musicGame)&&['title','artist',...(config.musicGame==='blind'?['both']:[])].includes(v)))config.musicGame=null;if(v==='both'&&config.mode==='phone')config.input='text';saveConfig();render();}
 if(act==='v2-load-themes')await withBusy(loadThemes);
 if(act==='v2-use-catalog'){setupStep='music';if(!activeEvening){view='home';render();toast('Créez une soirée pour utiliser cette sélection.');return;}if(!catalogPool.tracks.length){toast('Ajoutez des titres ou importez une playlist.');return;}selectedPlaylists=[];savePlaylistSelection();config.catalogFrom='explorer';config.source='catalog';config.universe='music';saveConfig();view='setup';render();}
 if(act==='v2-add-track'){const t=catalogResults.tracks.find(t=>t.id===v);if(t&&!catalogPool.tracks.some(x=>x.id===v)){if(catalogPool.tracks.length>=100){toast('100 titres maximum par sélection.');return;}catalogPool={name:'Ma sélection',tracks:[...catalogPool.tracks,t],themeKey:''};config.catalogFrom='explorer';config.source='catalog';persistPool();saveConfig();render();}}
 if(act==='v2-remove-track'){catalogPool.tracks=catalogPool.tracks.filter(t=>t.id!==v);persistPool();render();}
 if(act==='v2-add-all'){const all=[...new Map([...catalogPool.tracks,...catalogResults.tracks].map(t=>[t.id,t])).values()].slice(0,100);catalogPool={name:'Ma sélection',tracks:all,themeKey:''};config.catalogFrom='explorer';persistPool();saveConfig();render();}
 if(act==='v2-clear-pool'){catalogPool={name:'',tracks:[],themeKey:''};persistPool();render();}
 if(act==='v2-playlist')await withBusy(()=>loadPlaylist(v));
 if(act==='v2-stop-preview'){desk.stop();$('#catalog-player')?.classList.add('hidden');}
 if(act==='v2-preview'){const t=[...(catalogResults.tracks||[]),...catalogPool.tracks].find(t=>t.id===v),player=$('#catalog-player');if(t&&player){player.classList.remove('hidden');player.querySelector('span').textContent='Chargement de '+t.title+'…';try{await desk.load({id:'preview-'+v,audioUrl:t.preview},null,'normal');if($('#catalog-player')!==player||player.classList.contains('hidden')||desk.id!=='preview-'+v)return;desk.play();if(desk.source)desk.source.loop=false;player.querySelector('span').textContent='♫ '+t.title+' · '+t.artist;}catch(err){player.querySelector('span').textContent=err.message;}}}
 if(act==='v2-judge'){await desk.unlock();send({type:'judge',correct:true,part:v});}
});
document.addEventListener('change',e=>{const el=e.target;if(el.dataset.config){const k=el.dataset.config;if(k==='answerTarget'){config.challenge=el.value;if(el.value==='both'&&config.mode==='phone'&&config.input==='qcm')config.input='text';saveConfig();render();return;}config[k]=k==='explicit'?!el.checked:k==='count'?questionCount(el.value):k==='timelineCount'?Math.min(SPECIAL_TRACKS.timeline.length-1,questionCount(el.value)):k==='duration'?Number(el.value):el.value;saveConfig();if(k==='count'||k==='timelineCount'){el.value=config[k];return;}if(k!=='explicit')render();}if(el.dataset.setting){const k=el.dataset.setting;config.settings[k]=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;config.settings=gameSettings(config.settings);saveConfig();if(['autoNext','autoHost','listening'].includes(k))render();}});
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
function selectGame(v){
  if(!availableGame(v))return;
  setupStep='rules';
  advancedOpen=false;customQuestionCount=false;
  Object.assign(config,{musicGame:v,universe:'music',source:'catalog',challenge:v==='covers'?'coverChoice':'title',effect:'normal',input:'qcm',
   count:10,duration:30,difficulty:'balanced',explicit:false,timelineMode:'collective',timelineCount:5,
   soundtrackCategory:'soundtrack',soundtrackChoices:4,coversDirection:'cover',settings:gameSettings()},gamePreferences[v]);
  if(!['blind','tyrolien'].includes(v)){config.input='qcm';config.source='catalog';}
 if(v==='progressive')config.settings={...config.settings,listening:'progressive'};
  config.explicit=!explicitPreference;saveConfig();render();
}
function fixedGameMusic(id=config.musicGame){
 return ['timeline','coversQuiz','soundtrack'].includes(id);
}
function recordLaunch(){
 if(config.musicGame)rememberUsage('games',[config.musicGame]);
 if(config.source==='catalog'&&config.catalogFrom==='explorer'&&selectedPlaylists.length){
  const ids=catalogPool.playlistIds||[];
  rememberUsage('playlists',ids);
  recentPlaylists=[...new Set([...ids,...recentPlaylists])].slice(0,12);
  write('declic.playlistRecent',recentPlaylists);
 }
}
function compatiblePlaylistGroups(settings=config, shortlist=selectedPlaylists){
 const required=settings.musicGame==='bingo'?BINGO_CARD_SIZE:settings.musicGame==='timeline'?Math.max(5,Number(settings.timelineCount)||5)+1:Number(settings.count)||10;
 return (playlistGroups||[]).map(group=>({...group,playlists:group.playlists.filter(item=>
  item.references>=required&&(!shortlist.length||shortlist.includes(item.id)))}))
  .filter(group=>group.playlists.length);
}
async function startWheel(kind,mode='participatory',shortlist=selectedPlaylists){
 if(!activeEvening)throw Error('Créez d’abord une soirée.');
 if(ceremony)publishCeremony(false);
 if(!playlistGroups?.length&&(kind==='playlist'||surprisePending&&preferredModes.playlist!=='manual')){
  playlistGroups=(await hostRequest('/api/library')).categories;playlistLoadedAt=Date.now();
 }
 const byCategory=kind==='playlist'&&!shortlist.length;
 const groups=kind==='playlist'?compatiblePlaylistGroups(config,shortlist):[];
 let options=kind==='game'?MUSIC_GAMES
  .filter(([id])=>availableGame(id))
  .filter(([id])=>!wheelGameSelection.length||wheelGameSelection.includes(id))
  .filter(([id])=>!surprisePending||preferredModes.playlist==='manual'||compatiblePlaylistGroups({...config,...gamePreferences[id],musicGame:id}).length)
  .filter(([id])=>id!=='survival'||(game?.teams?.length||0)>=2)
  .map(([id,name])=>({id,name})):byCategory?groups:groups.flatMap(group=>group.playlists);
 if(!options.length)throw Error(kind==='game'?'Aucun jeu compatible avec ces filtres.':'Aucune playlist assez fournie pour ce jeu.');
 if(wheel?.result)await wheelAction({type:'roulette-dismiss',id:wheel.id});
 await desk.unlock();
 playlistShortlist=kind==='playlist'?[...shortlist]:null;
 usbVoteChoice=options[0].id;
 const asOption=({id,name})=>({id,name});
 await wheelAction({type:'roulette-start',kind,mode,options:options.map(asOption),
  categories:byCategory?groups.map(({id,playlists})=>({id,playlists:playlists.map(asOption)})):undefined,
  seconds:wheelSettings.seconds,player:wheelSettings.player==='host'?'':wheelSettings.player,
  hostOnly:wheelSettings.player==='host',animation:showAnimations&&wheelSettings.animation});
}
async function confirmWheel(){
 const {result,kind,stage,id}=wheel||{};
 if(!result||stage==='category')return;
 await wheelAction({type:'roulette-dismiss',id});
 if(kind==='game'){
  if(preferredModes.playlist==='manual')surprisePending=false;
  return;
 }
 surprisePending=false;
 render();
}
async function wheelAction(action,identity={role:'host'}){
 if(config.mode!=='usb'||role!=='host'){
  if(ws?.readyState!==WebSocket.OPEN)throw Error('Attendez la connexion à la soirée.');
  ws.send(JSON.stringify(action));return;
 }
 const now=Date.now();
 const previous=localWheel;
 localWheel=changeRoulette(localWheel,action,identity,config.teams,eveningUsage.spinners,now);
 if(localWheel===previous)return;
 clearTimeout(wheelTimer);
 if(localWheel?.id!==previous?.id)usbVoteChoice=localWheel?.choices?.[0]?.id||'';
 if(localWheel?.stopAt===null){
  wheelTimer=setTimeout(()=>void wheelAction({type:'roulette-stop',id:localWheel?.id},{role:'server'}),Math.max(0,localWheel.deadline-now));
 }else if(localWheel){
  if(localWheel.player&&previous?.stopAt===null)rememberUsage('spinners',[localWheel.player.id]);
  const advanceAt=rouletteAdvanceAt(localWheel);
  if(advanceAt!==null){
   const id=localWheel.id;
   setTimeout(()=>void wheelAction({type:'roulette-advance',id},{role:'server'}),Math.max(0,advanceAt-now));
  }
  if(localWheel.revealAt>now)wheelTimer=setTimeout(publishLocalWheel,localWheel.revealAt-now);
 }
 publishLocalWheel();
}
function publishLocalWheel(){
 const state=rouletteView(localWheel);
 if(state?.mode==='vote')state.promptedChoice=usbVoteChoice;
 channel.postMessage({type:'roulette',wheel:state});
 showWheel(state);
}
function showWheel(state){
 if(role==='host'&&config.mode==='phone')channel.postMessage({type:'roulette',wheel:state});
 const previous=wheel;
 wheel=state;
 if(role==='host'&&state?.result&&state.stage!=='category'&&appliedWheel!==state.id){
  appliedWheel=state.id;
  if(state.kind==='game')selectGame(state.result.id);
  else {selectedPlaylists=[state.result.id];savePlaylistSelection();}
  if(state.optionsCount===1&&!state.category&&!state.animation){
   void confirmWheel().catch(error=>toast(error.message));
  }
 }
 render();
 if(role==='host'&&state?.animation&&state.stopAt===null&&previous?.id!==state.id)desk.jingle('tick');
 if(role==='host'&&state?.animation&&state.stopAt!==null&&previous?.stopAt===null)desk.jingle('tick');
 if(state?.result&&state.animation&&wheelCelebration!==state.id){
  wheelCelebration=state.id;
  celebrate();
  if(role==='host')desk.jingle('podium');
 }
}
function voteMarkup(){
 const voting=wheel.stopAt===null;
 const remaining=Math.max(0,Math.ceil((wheel.deadline-Date.now())/1000));
 const highest=Math.max(0,...Object.values(wheel.tally));
 const maximum=Math.max(1,highest);
 const question=wheel.kind==='game'?'Quel sera notre prochain jeu ?':wheel.stage==='category'?'Quelle ambiance musicale ?':'Quelle sera notre prochaine playlist ?';
 return `<section class="roulette-surfaces vote-surfaces ${role==='tv'?'roulette-tv':''}" aria-label="Vote">
 <h2>${question}</h2>
 ${voting?`<strong class="vote-clock" data-vote-clock>${remaining} s</strong>`:''}
 ${role!=='player'?`<p>${wheel.voteCount} / ${wheel.eligibleCount} votes · ${wheel.eligibleCount-wheel.voteCount} en attente</p>`:''}
 ${role==='player'&&voting&&wheel.hasVoted?'<p role="status">Vote enregistré ✓</p>':''}
 ${wheel.tiebreak&&!wheel.result?`<p>${wheel.voteCount?'Égalité · départage à la roulette':'Aucun vote · tirage au sort'}</p>${wheelVisual('slowing',wheel.choices.filter(item=>(wheel.tally[item.id]||0)===highest))}`:''}
 <div class="vote-options">${wheel.choices.map(item=>{
  const tally=wheel.tally[item.id]||0;
  const winner=wheel.result?.id===item.id;
  if(role==='player'&&voting&&wheel.canVote)return `<button class="btn ghost vote-option" data-action="roulette-vote" data-value="${esc(item.id)}">${esc(item.name)}</button>`;
  if(role==='player'&&voting)return '';
  if(role==='host'&&config.mode==='usb'&&voting)return `<button class="btn ghost" data-action="usb-vote-choice" data-value="${esc(item.id)}" aria-pressed="${usbVoteChoice===item.id}">${esc(item.name)} · ${tally}</button>`;
  const highlighted=role==='tv'&&wheel.promptedChoice===item.id;
  return `<div class="vote-result ${winner||highlighted?'vote-winner':''}"><strong>${esc(item.name)}</strong><span>${tally}</span><div class="vote-progress" style="--vote-share:${100*tally/maximum}%"></div></div>`;
 }).join('')}</div>
 ${wheel.result?`<p class="roulette-result" role="status">${esc(wheel.result.name)}</p>`:''}
 ${role==='host'? `${config.mode==='usb'&&voting?'<p>Choisis l’option ouverte, puis les équipes votent avec leur buzzer.</p>':''}
 <div class="row">${voting?'<button class="btn primary" data-action="roulette-stop">Clôturer le vote</button>':''}
 ${wheel.result&&wheel.stage!=='category'?'<button class="btn primary" data-action="roulette-confirm">Continuer</button><button class="btn ghost" data-action="roulette-retry">Relancer</button>':''}
 <button class="btn ghost" data-action="roulette-dismiss">${voting?'Annuler':'Fermer'}</button></div>`:''}
 </section>`;
}
const categoryStyle={
 decades:['#a63d85','📀'],genres:['#5043ab','🎧'],screen:['#195a9a','🎬'],
 party:['#984514','🎉'],themes:['#166b65','🎛️'],hits:['#79521b','⭐'],artists:['#94364e','🎤']
};
function wheelVisual(state,choices=wheel.choices||[]){
 if(role==='player'||!choices.length||choices.length===1)return '';
 const index=choices.findIndex(item=>item.id===wheel.result?.id);
 if(choices.length>9){
  const step=Math.floor(choices.length/8);
  const offset=wheel.startAt%choices.length;
  const display=Array.from({length:9},(_,i)=>choices[(offset+(i%8)*step)%choices.length]);
  return `<div class="wheel-reel ${state}" aria-hidden="true">${index>=0?`<strong>${esc(wheel.result.name)}</strong>`:
   `<div>${display.map(item=>`<strong>${esc(item.name)}</strong>`).join('')}</div>`}</div>`;
 }
 const step=360/choices.length;
 const rotation=index<0?0:-(index+.5)*step;
 const colors=Object.values(categoryStyle);
 const stops=choices.map((item,i)=>`${(categoryStyle[item.id]||colors[i%colors.length])[0]} ${i*step}deg ${(i+1)*step}deg`);
 return `<div class="wheel-frame" aria-hidden="true"><div class="wheel-face ${state}" style="--turn:${rotation}deg;--segments:conic-gradient(${stops.join(',')})">
  ${choices.map((item,i)=>`<div class="wheel-label" style="--angle:${(i+.5)*step}deg;--counter:${-(i+.5)*step-rotation}deg"><span>${categoryStyle[item.id]?.[1]||''} ${esc(item.name)}</span></div>`).join('')}
  <b class="wheel-hub">ϟ</b></div></div>`;
}
function rouletteMarkup(){
 if(wheel.mode==='vote')return voteMarkup();
 const canStop=wheel.stopAt===null&&(role==='host'||role==='player'&&wheel.player?.id===teamId);
 const state=wheel.result?'revealed':wheel.stopAt===null?'spinning':'slowing';
 return `<section class="roulette-surfaces ${role==='tv'?'roulette-tv':''}" aria-label="Roulette">
 <h2>${wheel.stage==='category'?'Roulette des catégories':role==='tv'?(wheel.kind==='game'?'Quel sera notre prochain jeu ?':'Quelle sera notre prochaine ambiance musicale ?'):(wheel.kind==='game'?'Roulette des jeux':'Roulette musicale')}</h2>
 ${wheel.player?`<p>${esc(wheel.player.name)}, c’est à toi de jouer ! Appuie sur STOP quand tu veux.</p>`:''}
 ${wheel.category?`<p class="wheel-category">${esc(wheel.category.name)}</p>`:''}
 ${wheelVisual(wheel.animation?state:'still')}
 <p class="roulette-result" role="status">${wheel.result?esc(wheel.result.name):state==='slowing'?'Résultat imminent…':`${wheel.optionsCount} choix en jeu`}</p>
 ${canStop?`<button class="btn primary roulette-stop" data-action="roulette-stop">${role==='host'?'Arrêter la roulette':'STOP'}</button>`:''}
 ${role==='host'?`<div class="row">${wheel.result&&wheel.stage!=='category'?'<button class="btn primary" data-action="roulette-confirm">Continuer</button><button class="btn ghost" data-action="roulette-retry">Relancer</button>':''}<button class="btn ghost" data-action="roulette-dismiss">Fermer</button></div>`:''}</section>`;
}
function availableGame(id){
 return config.mode==='phone'||['blind','progressive'].includes(id);
}
function musicGames(){
 return `<section id="music-games"><h1>On joue à quoi ?</h1><div class="game-picker-grid">${MUSIC_GAMES.filter(([id])=>availableGame(id)).map(([id,name,description])=>
 `<button class="game-picker-card" data-action="music-game" data-value="${id}" aria-pressed="${config.musicGame===id}">
 <span class="game-picker-icon">${homeIcon(id)}</span><strong>${name}</strong><small>${description}</small></button>`).join('')}<button class="game-picker-card" data-action="selection-panel" data-value="game" aria-expanded="${selectionPanel==='game'}"><span class="game-picker-icon">🎲</span><strong>Roulette / Vote</strong></button><button class="game-picker-card" data-action="surprise-total"><span class="game-picker-icon">✨</span><strong>Surprise totale</strong></button></div>${selectionPanel==='game'?selectionControls('game'):''}</section>`;
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
 screen:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
 wave:'<path d="M3 10v4m4-7v10m5-14v18m5-14v10m4-7v4"/>',
 play:'<path d="m9 5 11 7-11 7z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 music:'<path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="18" cy="16" rx="3" ry="2"/>',
 history:'<path d="M3 12a9 9 0 1 1 2.6 6.4M3 5v7h7m2-5v5l3 2"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="m10 3-1 3-3 1-3-1-1 3 2 2v2l-2 2 1 3 3-1 3 1 1 3h4l1-3 3-1 3 1 1-3-2-2v-2l2-2-1-3-3 1-3-1-1-3z"/>',
 arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>'
};
function homeIcon(name){
 return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${homeIcons[name]??gameIcons[name]}</svg>`;
}
function homeCard(action,icon,label,detail='',{prominent=false,disabled=false}={}){
 return `<button type="button" class="host-card${prominent?' host-card-primary':''}" ${action?`data-action="${action}"`:''} ${disabled?'disabled':''}>
  <span class="host-card-icon">${homeIcon(icon)}</span>
  <span><strong>${label}</strong>${detail?`<small>${detail}</small>`:''}</span>
  ${disabled?'':`<span class="host-card-arrow">${homeIcon('arrow')}</span>`}
 </button>`;
}
function home(){
 const active=activeEvening||savedMusicGame('declic.localGame');
 const ready=eveningStatus==='ready'&&!changingEvening;
 const nextGame=activeEvening&&room===activeEvening.code&&game?.phase==='finished';
 const status=changingEvening?'updating':ready&&active?'active':eveningStatus;
 const statusText={
  updating:'Mise à jour de la soirée…',
  loading:'Récupération de la soirée…',
  error:'Impossible de vérifier la soirée active',
  active:'Soirée active',
  ready:'Aucune soirée active'
 }[status];
 return `<div class="host-home">
  <header class="host-top">
   <div class="host-brand"><span aria-hidden="true">${homeIcon('wave')}</span><div><strong>DÉCLIC PARTY</strong><small>LE GRAND SOIR</small></div></div>
   <div class="host-tools">
    <span class="host-status" data-status="${status}" role="status">${statusText}</span>
    ${status==='error'?'<button type="button" class="host-link" data-action="retry-evening">Réessayer</button>':''}
    <button type="button" class="host-tv" data-action="screen">${homeIcon('screen')} Écran TV</button>
   </div>
  </header>
  <main class="host-main">
   <section class="host-welcome" aria-labelledby="host-title">
    <p class="host-studio-label">LE STUDIO TV</p>
    <h1 id="host-title">Que la fête commence !</h1>
    <p>Bienvenue dans Le Grand Soir.</p>
   </section>
   <div class="host-actions">
    ${homeCard('create-evening','plus','Créer une soirée',active&&ready?'Démarrer une nouvelle soirée':'Choisir le premier jeu',{prominent:true,disabled:!ready})}
    ${homeCard(nextGame?'new-game':'resume-evening','play',nextGame?'Choisir le jeu suivant':'Reprendre une soirée',
      ready?(active?'Participants et scores conservés':'Aucune soirée à reprendre'):'En attente de vérification',
      {prominent:true,disabled:!ready||!active})}
   </div>
   <div class="host-secondary">
    ${homeCard('music-library','music','Bibliothèque musicale','',{disabled:changingEvening})}
    ${homeCard(null,'history','Historique des soirées','Indisponible',{disabled:true})}
    ${homeCard('settings','gear','Paramètres','',{disabled:changingEvening})}
   </div>
  </main>
  <footer class="host-join">
   <span>Vous êtes participant ? <a class="host-link" href="/join">Rejoindre une soirée ${homeIcon('arrow')}</a></span>
   ${ready&&activeEvening?'<button type="button" class="host-link host-end" data-action="end-evening">Terminer la soirée</button>':''}
  </footer>
 </div>`;
}
function settingsScreen(){
 return `<main class="library"><h1>Paramètres</h1>
  ${arrivalSoundButton()}<button class="btn ghost" data-action="sound" aria-pressed="${!desk.muted}">${desk.muted?'♪ Jingles coupés':'♫ Jingles actifs'}</button>
 </main>`;
}
function automaticChoicesAvailable(){
 return config.mode==='phone'&&['qcm','text'].includes(config.input)&&
  config.settings.listening!=='progressive'&&
  ['blind','covers','coversQuiz','soundtrack','survival','bingo','timeline','tyrolien'].includes(config.musicGame);
}
let setupStep='game';
function setupScreen(){
 const invite=room&&auth?.type==='host'&&config.mode==='phone';
 const fixedMusic=fixedGameMusic();
 return `<main class="game-setup" id="multiplayer">
 <div class="row setup-top-actions"><button class="btn ghost" data-action="${setupStep==='game'?'home':'setup-step'}" data-value="${{rules:'game',music:'rules',cast:'music'}[setupStep]||''}">← ${setupStep==='game'?'Retour à l’accueil':'Retour'}</button><button class="btn ghost right" data-action="screen">▣ Écran TV</button>${arrivalSoundButton()}</div>
 <details class="qcard"><summary>Paramètres de la soirée${invite?' et invitations':''}</summary>
 <button class="btn ghost" data-action="toggle-show" aria-pressed="${showAnimations}">${showAnimations?'Animations actives':'Animations coupées'}</button>
 ${eveningSettings()}${generalSelectionSettings()}${invite?`<div class="divider"></div>${invitationMarkup()}<div class="row"><button class="btn ghost" data-action="copy-link">Copier le lien</button><button class="btn ghost" data-action="screen">Écran public</button></div><p class="mini">${game?.teams?.length||game?.tyrolien?.participants?.length||0} participant(s)</p>`:''}
 </details>
 ${setupStep==='game'?musicGames():''}
 ${setupStep==='rules'?`<section class="qcard show-rules"><div class="show-setup-preview" data-venue="${showScene({musicGame:config.musicGame,phase:'ready'})||'tyrolien'}"><h2>${showVenue({musicGame:config.musicGame,phase:'ready'})}</h2></div><h2>Mode et règles · ${esc(MUSIC_GAMES.find(([id])=>id===config.musicGame)?.[1]||'Blind test')}</h2>
 ${fixedMusic?musicGameSettings():''}
 ${questionSetup()}
 ${participationSetup()}
 ${answerSetup()}
 <fieldset class="setup-choices auto-choice"><legend>Qui mène la partie ?</legend>
 ${automaticChoicesAvailable()?`<label><input type="checkbox" data-setting="autoHost" ${config.settings.autoHost?'checked':''}> Mode automatique · je joue aussi</label><p class="help">Après le lancement, les manches s’enchaînent. Les réponses restent masquées sur l’écran animateur. Rejoins la soirée avec ton téléphone.</p>`:'<p class="help">Ce mode nécessite un jeu compatible sur téléphone, avec réponses écrites ou QCM.</p>'}
 </fieldset>
 ${config.musicGame==='tyrolien'?`<div class="two-fields"><label>Paliers<input type="number" min="4" max="15" data-config="mountainLevels" value="${esc(config.mountainLevels||6)}"></label><label>Attaques<select data-config="mountainAttacks"><option value="on">Activées</option><option value="off" ${config.mountainAttacks==='off'?'selected':''}>Désactivées</option></select></label></div>`:''}
 <details class="settings-details" id="advanced-setup" ${advancedOpen?'open':''}><summary>Réglages avancés</summary>${setupAdvanced(fixedMusic)}</details>
 <button class="btn primary" data-action="setup-step" data-value="music">Entrer dans le décor →</button></section>`:''}
 ${setupStep==='music'?`<section class="setup-music">
 <div class="show-setup-preview" data-venue="${showScene({musicGame:config.musicGame,phase:'ready'})||'tyrolien'}"><h2>${showVenue({musicGame:config.musicGame,phase:'ready'})}</h2></div>
 <h2>On écoute quoi ?</h2>
 ${config.musicGame==='tyrolien'?choiceButtons('Source musicale','source',[['catalog','Playlists'],['demo','Découverte musicale']],config.source):''}
 ${config.musicGame==='tyrolien'&&config.source==='demo'?'<p>Mélodies de découverte de Déclic Party.</p>':playlistSetup()}
 <button class="btn primary" data-action="setup-step" data-value="cast">Voir les participants →</button></section>`:''}
 ${setupStep==='cast'?`<section class="qcard setup-launch">
 <h2>Participants</h2>
 <div class="row show-cast">${(config.mode==='phone'?game?.teams||[]:config.teams).map(team=>`<span>${avatarBadge(team)} ${esc(team.name)}</span>`).join('')||'<p>En attente des joueurs.</p>'}</div>
 ${config.mode==='phone'&&(sharedTeamsSelected()||config.musicGame==='tyrolien'||game?.teamPlan)?teamAdmin()+previousTeamGames():''}
 ${game?.phase==='finished'?`<button class="textbtn" data-action="ceremony">${ceremony?'Fermer le podium de la soirée':'Afficher le podium de la soirée'}</button>`:''}
 ${catalogMessage?`<p role="status">${esc(catalogMessage)}</p>`:''}
 <p class="mini">${esc(MUSIC_GAMES.find(([id])=>id===config.musicGame)?.[1]||'Jeu à choisir')} · ${esc(selectedPlaylists.map(id=>playlistIndex().get(id)?.name||verifiedPlaylists[id]?.name).filter(Boolean).join(', ')||(fixedMusic?'Sélection du jeu':'Ambiances par défaut'))}</p>
 <button class="btn primary full" data-action="launch"  ${busy?'disabled':''}>${busy?'Préparation des extraits…':'Lancer le jeu →'}</button>
 </section>`:''}${wheel?`<div class="setup-roulette-overlay">${rouletteMarkup()}</div>`:''}</main>`;
}
document.addEventListener('toggle',event=>{
 if(event.target.id==='advanced-setup')advancedOpen=event.target.open;
},true);
function generalSelectionSettings(){
 return `<div class="setup-options">
 <label class="checkboxline"><input type="checkbox" data-wheel-setting="explicit" ${explicitPreference?'checked':''}> Exclure les titres explicites</label>
 <label class="checkboxline"><input type="checkbox" data-wheel-filter="avoidSongs" ${wheelPrefs.avoidSongs?'checked':''}> Éviter les chansons déjà entendues</label>
 <label class="field-label">Durée du vote (secondes)<input type="number" min="5" max="60" value="${Number(wheelSettings.seconds)||15}" data-wheel-setting="seconds"></label>
 <label class="checkboxline"><input type="checkbox" data-wheel-setting="animation" ${wheelSettings.animation?'checked':''}> Animer les roulettes</label></div>`;
}
function selectionControls(kind){
 const players=config.mode==='usb'?config.teams:game?.roulettePlayers||[];
 return `<div class="selection-controls qcard">
 <div class="row">${selectionModes.map(([id,name])=>`<button class="btn ghost" data-action="selection-mode" data-kind="${kind}" data-value="${id}" aria-pressed="${preferredModes[kind]===id}">${name}</button>`).join('')}
 ${preferredModes[kind]!=='manual'?`<button class="btn primary" data-action="roulette-${kind}" data-value="${preferredModes[kind]}">Lancer le choix du jeu</button>`:''}</div>
 ${kind==='game'?`<details><summary>Choix du tirage ou du vote</summary>
 <p class="mini">Sans sélection, tous les jeux compatibles participent.</p><div class="setup-options">
 ${MUSIC_GAMES.filter(([id])=>availableGame(id)).map(([id,name])=>`<label class="checkboxline"><input type="checkbox" data-wheel-game="${id}" ${wheelGameSelection.includes(id)?'checked':''}> ${name}</label>`).join('')}</div></details>`:'<p class="mini">Coche les playlists pour limiter la sélection.</p>'}
 <details><summary>Préférences de ce choix</summary>
 <label class="field-label">Qui arrête la roue ?<select data-wheel-setting="player">
 <option value="">Un joueur au hasard</option><option value="host" ${wheelSettings.player==='host'?'selected':''}>L’animateur</option>
 ${players.map(({id,name})=>`<option value="${esc(id)}" ${wheelSettings.player===id?'selected':''}>${esc(name)}</option>`).join('')}</select></label>
 </details></div>`;
}
document.addEventListener('change',event=>{
 const field=event.target;
 const {wheelFilter,wheelGame,wheelSetting}=field.dataset;
 if(wheelFilter){wheelPrefs[wheelFilter]=field.checked;write('declic.wheelFilters',wheelPrefs);}
 if(wheelSetting==='explicit'){explicitPreference=field.checked;config.explicit=!explicitPreference;write('declic.excludeExplicit',explicitPreference);return;}
 if(wheelSetting){wheelSettings[wheelSetting]=field.type==='checkbox'?field.checked:field.value;write('declic.wheelPreferences',wheelSettings);}
 if(wheelGame){
  const index=wheelGameSelection.indexOf(wheelGame);
  if(field.checked&&index===-1)wheelGameSelection.push(wheelGame);
  if(!field.checked&&index>=0)wheelGameSelection.splice(index,1);
  write('declic.wheelGames',wheelGameSelection);
 }
});
function categoryPlaylists(){
 const entries=playlistIndex();
 if(playlistCategory==='favorites')return favoritePlaylists.map(id=>entries.get(id)).filter(Boolean);
 if(playlistCategory==='recent')return recentPlaylists.map(id=>entries.get(id)).filter(Boolean);
 return playlistGroups?.find(group=>group.id===playlistCategory)?.playlists||[];
}

function playlistSetup(){
 const mode=preferredModes.playlist;
 const emptySelection={
  manual:config.catalogFrom==='explorer'&&catalogPool.tracks.length
   ?'La sélection importée sera utilisée.' : 'Les ambiances par défaut seront utilisées.',
  automatic:'La roulette tire une catégorie, puis une playlist compatible.',
  participatory:'Le joueur désigné arrête la roulette pour choisir une catégorie, puis une playlist.',
  vote:'Les participants votent pour une catégorie, puis pour une playlist compatible.'
 }[mode];
 const entries=playlistIndex();
 const chosen=selectedPlaylists.map(id=>({id,name:id==='mix'?'Toutes les musiques':entries.get(id)?.name||verifiedPlaylists[id]?.name||id}));
 const categories=[...(playlistGroups||[]),{id:'favorites',name:'Favoris',icon:'★'},{id:'recent',name:'Récentes',icon:'◷'}];
 return `<div class="row playlist-modes">${selectionModes.map(([id,name])=>`<button class="btn ghost" data-action="selection-mode" data-kind="playlist" data-value="${id}" aria-pressed="${preferredModes.playlist===id}">${name}</button>`).join('')}
 ${preferredModes.playlist!=='manual'?`<button class="btn primary" data-action="roulette-playlist" data-value="${preferredModes.playlist}">Lancer le choix musical</button>`:''}</div>
 <div class="playlist-selected"><div class="row playlist-selected-header"><strong>Playlists sélectionnées · ${chosen.length}</strong>
 ${chosen.length>1&&mode==='manual'?'<small>Les catégories différentes se croisent.</small>':''}
 ${chosen.length?'<button class="textbtn" data-action="playlist-clear">Tout retirer</button>':''}</div>
 <div class="row">${chosen.map(({id,name})=>`<button class="playlist-chip" data-action="playlist-toggle" data-value="${esc(id)}" aria-label="Retirer ${esc(name)}"><span>${esc(name)}</span><span aria-hidden="true">×</span></button>`).join('')||`<p class="mini">${emptySelection}</p>`}</div></div>
 <button class="btn primary" data-action="playlist-filters">Créer une playlist par filtres</button>
 <label class="field-label">Rechercher une playlist<input id="setup-playlist-search" type="search" value="${esc(playlistSearch)}"></label>
 <div class="playlist-tabs" aria-label="Catégories musicales">${categories.map(({id,name,icon})=>`<button class="btn ghost" data-action="playlist-category" data-value="${id}" aria-pressed="${id===playlistCategory&&!playlistSearch}"><span aria-hidden="true">${esc(icon)}</span><span>${esc(name)}</span></button>`).join('')}</div>
 <button class="textbtn" data-action="playlist-open" data-value="mix">Consulter toutes les musiques</button>
 <div id="setup-playlist-results">${playlistResults()}</div>`;
}
function playlistTile(item){
 const pressed=selectedPlaylists.includes(item.id), favorite=favoritePlaylists.includes(item.id);
 return `<div class="playlist-choice" data-cover-theme="${playlistShowTheme([item.id])}"><button class="theme-card playlist-tile" data-action="playlist-open" data-value="${esc(item.id)}">
 <span class="playlist-icon" aria-hidden="true">${esc(item.icon)}</span><strong>${esc(item.name)}</strong>
 <small>${item.references} titres</small></button>
 <input class="playlist-checkbox" type="checkbox" data-playlist-id="${esc(item.id)}" aria-label="Jouer · ${esc(item.name)}" ${pressed?'checked':''}>
 <button class="iconbtn playlist-star" data-action="playlist-favorite" data-value="${esc(item.id)}" aria-label="Favori · ${esc(item.name)}" aria-pressed="${favorite}">${favorite?'★':'☆'}</button></div>`;
}
document.addEventListener('change',event=>{
 const id=event.target.dataset.playlistId;
 if(!id)return;
 selectedPlaylists=event.target.checked?[...new Set([...selectedPlaylists,id])]:selectedPlaylists.filter(value=>value!==id);
 if(!selectedPlaylists.length){config.catalogFrom='themes';saveConfig();}
 savePlaylistSelection();render();
});
function playlistResults(){
 if(!playlistGroups)return '<p>Chargement des playlists…</p>';
 if(!playlistGroups.length)return '<button class="btn ghost" data-action="playlist-reload">Réessayer de charger les playlists</button>';
 const normalize=value=>value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const words=normalize(playlistSearch).split(' ').filter(Boolean);
 const letter=item=>normalize(item.name).charAt(0).toUpperCase();
 const alphabetical=!words.length&&playlistCategory==='artists';
 const items=words.length?playlistGroups.flatMap(group=>group.playlists.filter(item=>
  words.every(word=>normalize([group.name,item.name,item.id].join(' ')).includes(word)))):categoryPlaylists();
 const letters=alphabetical?[...new Set(items.map(letter))].sort():[];
 const required=config.musicGame==='bingo'?BINGO_CARD_SIZE:config.musicGame==='timeline'?Number(config.timelineCount||5)+1:config.musicGame==='tyrolien'?1:Number(config.count)||10;
 const matches=(alphabetical&&playlistLetter?items.filter(item=>letter(item)===playlistLetter):items)
  .filter(item=>item.references==null||item.references>=required||selectedPlaylists.includes(item.id));
 if(alphabetical)matches.sort((a,b)=>a.name.localeCompare(b.name,'fr'));
 const size=36;
 const page=Math.min(playlistPage,Math.max(0,Math.ceil(matches.length/size)-1));
 return `${letters.length?`<div class="playlist-tabs" aria-label="Filtrer les artistes par initiale">${['',...letters].map(value=>`<button class="btn ghost" data-action="playlist-letter" data-value="${value}" aria-pressed="${value===playlistLetter}">${value||'Tous'}</button>`).join('')}</div>`:''}
 ${matches.length?`<div class="playlist-quick">${matches.slice(page*size,(page+1)*size).map(playlistTile).join('')}</div>`:'<p>Aucune playlist trouvée.</p>'}
 ${matches.length>size?`<div class="row"><button class="textbtn" data-action="playlist-page" data-value="-1" ${page===0?'disabled':''}>Précédent</button><span>${page+1} / ${Math.ceil(matches.length/size)}</span><button class="textbtn" data-action="playlist-page" data-value="1" ${(page+1)*size>=matches.length?'disabled':''}>Suivant</button></div>`:''}`;
}
document.addEventListener('input',event=>{
 if(event.target.id!=='setup-playlist-search')return;
 playlistSearch=event.target.value;
 playlistPage=0;
 $('#setup-playlist-results').innerHTML=playlistResults();
});
function questionSetup(){
 if(['bingo','tyrolien'].includes(config.musicGame))return config.musicGame==='bingo'?'<p>16 extraits · grille 4 × 4</p>':'';
 const timeline=config.musicGame==='timeline', key=timeline?'timelineCount':'count';
 const count=Number(config[key])||5;
 const max=timeline?SPECIAL_TRACKS.timeline.length-1:100;
 const custom=customQuestionCount||!quickQuestionCounts.includes(count);
 return `<h3>Combien de questions ?</h3><div class="question-picks">${quickQuestionCounts.filter(n=>n<=max).map(n=>`<button class="btn ghost" data-action="question-count" data-value="${n}" aria-pressed="${!custom&&n===count}">${n}</button>`).join('')}
 <button class="btn ghost" data-action="question-count" data-value="custom" aria-pressed="${custom}">Personnalisé</button></div>
 ${custom?`<label class="field-label">Nombre de questions<input type="number" min="5" max="${max}" value="${count}" data-config="${key}"></label>`:''}`;
}
function setupAdvanced(fixedMusic){
 const flexible=!config.musicGame||['blind','tyrolien'].includes(config.musicGame);
 return `${!fixedMusic?`<button class="textbtn" data-action="v2-catalog">Recherche et import musical</button>`:''}
 ${config.musicGame==='soundtrack'?`<label class="field-label">Propositions<select data-config="soundtrackChoices">${[2,3,4,5].map(n=>`<option value="${n}" ${n===Number(config.soundtrackChoices||4)?'selected':''}>${n}</option>`).join('')}</select></label>`:''}
 ${flexible&&config.mode==='phone'?inputSettings():''}${gameRules(flexible,fixedMusic)}`;
}
function supportsRandomTeams(){
 return config.mode==='phone'&&config.input!=='buzzer'&&['blind','covers','coversQuiz','soundtrack'].includes(config.musicGame);
}
function sharedTeamsSelected(){
 return config.musicGame==='tyrolien'||supportsRandomTeams()&&['team','random'].includes(config.participation);
}
function choiceButtons(label,key,choices,value){
 return `<fieldset class="setup-choices"><legend>${label}</legend><div class="row">${choices.map(([id,name])=>`<button class="btn ghost" data-action="setup-choice" data-key="${key}" data-value="${id}" aria-pressed="${String(value)===String(id)}">${name}</button>`).join('')}</div></fieldset>`;
}
function participationSetup(){
 if(config.musicGame==='tyrolien')return '<p>En équipes · jusqu’à six équipes</p>';
 if(config.musicGame==='survival')return '<p>En individuel</p>';
 if(config.mode==='usb')return '<p>En équipes · buzzers USB</p>';
 const supported=supportsRandomTeams();
 const choices=[['individual','Individuel'],['team','En équipes']];
 if(supported)choices.push(['shared-device','Un téléphone par équipe']);
 const selected=config.participation==='random'?'team':config.participation||'individual';
 return choiceButtons('Participants','participation',choices,selected)+
 (sharedTeamsSelected()?'<p class="mini">Un téléphone par joueur.</p>':selected==='team'||selected==='shared-device'?'<p class="mini">Un téléphone par équipe.</p>':'');
}
function answerSetup(){
 if(config.musicGame==='tyrolien'&&config.source==='demo')return '';
 const blind=!config.musicGame||['blind','tyrolien','progressive'].includes(config.musicGame);
 if(!blind&&!['bingo','survival'].includes(config.musicGame))return '';
 const options=[['title','Le titre'],['artist','L’artiste'],...(blind?[['both','Les deux']]:[])];
 return choiceButtons('Que faut-il retrouver ?','challenge',options,config.challenge);
}
function musicGameSettings(){
 if(config.musicGame==='timeline')return choiceButtons('Type de frise','timelineMode',[['collective','Collective'],['individual','Individuelle']],config.timelineMode||'collective');
 if(config.musicGame==='soundtrack')return choiceButtons('Extraits','soundtrackCategory',[['soundtrack','Films et séries'],['tvThemes','Génériques TV'],['allSoundtracks','Les deux']],config.soundtrackCategory||'soundtrack');
 if(config.musicGame==='coversQuiz')return choiceButtons('Version diffusée','coversDirection',[['cover','La reprise'],['original','L’original']],config.coversDirection||'cover');
 return '';
}

function eveningSettings(){return `<div class="segmented"><button data-action="mode" data-value="usb" class="${config.mode==='usb'?'active':''}">◉ Buzzers USB</button><button data-action="mode" data-value="phone" class="${config.mode==='phone'?'active':''}">▯ Téléphones</button></div><p class="help">${config.mode==='usb'?'Les équipes buzzent. Vous validez leurs réponses.':'Les participants rejoignent la soirée avec un code.'}</p>${config.mode==='phone'?'':`<span class="field-label">Les équipes · touches personnalisables</span>${config.teams.map((t,i)=>`<div class="teamrow"><span class="avatar" style="--team:${colors[i]}">${icons[i]}</span><input aria-label="Nom de l’équipe ${i+1}" data-team="${i}" value="${esc(t.name)}" maxlength="24"><input class="customkey" aria-label="Touche de l’équipe ${i+1}" data-key="${i}" value="${esc(t.key)}" maxlength="1"><button class="iconbtn" aria-label="Retirer l’équipe ${i+1}" data-action="remove-team" data-value="${i}" ${config.teams.length<=2?'disabled':''}>×</button></div>`).join('')}<button class="textbtn" data-action="add-team" ${config.teams.length>=10?'disabled':''}>＋ Ajouter une équipe</button>`}`;}
function inputSettings(){return `<label class="field-label" for="inputmode">Réponse sur téléphone</label><select id="inputmode">${config.musicGame==='tyrolien'?'':`<option value="buzzer" ${config.input==='buzzer'?'selected':''}>Buzzer · réponse orale</option>`}<option value="qcm" ${config.input==='qcm'?'selected':''}>QCM · 4 choix</option><option value="text" ${config.input==='text'?'selected':''}>Écrit · titre et artiste séparés</option></select>`;}
function gameRules(flexible,fixedMusic){return `${config.musicGame==='survival'?'<label class="field-label">Vies au départ<input type="number" min="1" max="5" data-setting="survivalLives" value="'+config.settings.survivalLives+'"></label>':''}${fixedMusic||['bingo','progressive','chain'].includes(config.musicGame)?'':`<label class="field-label">Écoute<select aria-label="Écoute" data-setting="listening"><option value="continuous" ${config.settings.listening!=='progressive'?'selected':''}>Extrait continu</option><option value="progressive" ${config.settings.listening==='progressive'?'selected':''}>Progressive · 1, 2, 5 puis 10 s</option></select></label><p class="mini">En progressif : 100 %, 80 %, 60 %, 40 % des points de réponse. Pas de bonus de rapidité. Seuls les défis audio utilisent ces paliers.</p>`}${['timeline','bingo'].includes(config.musicGame)?'':`<div class="two-fields"><label>Durée<select data-config="duration">${[10,15,20,30].map(n=>`<option value="${n}" ${config.duration===n?'selected':''}>${n} s</option>`).join('')}</select></label></div>`}<label class="field-label" for="difficulty">Sélection des titres</label><select id="difficulty" data-config="difficulty"><option value="easy" ${config.difficulty==='easy'?'selected':''}>Les plus populaires</option><option value="balanced" ${config.difficulty==='balanced'?'selected':''}>Un mélange équilibré</option><option value="hard" ${config.difficulty==='hard'?'selected':''}>Des titres moins connus</option></select><details class="settings-details"><summary>⚙ Points et déroulement</summary><label class="checkboxline"><input type="checkbox" data-setting="jokers" ${config.settings.jokers?'checked':''}> Activer les jokers de ce jeu</label><div class="two-fields"><label>Points titre<input type="number" min="1" max="1000" data-setting="titlePoints" value="${config.settings.titlePoints}"></label><label>Points artiste<input type="number" min="1" max="1000" data-setting="artistPoints" value="${config.settings.artistPoints}"></label></div><label class="checkboxline"><input type="checkbox" data-setting="speed" ${config.settings.speed?'checked':''}> Bonus de rapidité · jusqu’à 50 pts</label><label class="checkboxline"><input type="checkbox" data-setting="streak" ${config.settings.streak?'checked':''}> Bonus de série · jusqu’à 50 pts</label>${config.mode==='usb'||config.input==='buzzer'?`<label class="field-label">Après une mauvaise réponse<select data-setting="rebuzz">${[['round','Bloqué pour cette question'],['none','Rebuzz immédiat'],['3','Rebuzz après 3 secondes'],['5','Rebuzz après 5 secondes'],['10','Rebuzz après 10 secondes']].map(([id,name])=>`<option value="${id}" ${config.settings.rebuzz===id?'selected':''}>${name}</option>`).join('')}</select></label><label class="field-label">Reprise de la musique<select data-setting="resume"><option value="auto" ${config.settings.resume==='auto'?'selected':''}>Automatique après validation</option><option value="manual" ${config.settings.resume==='manual'?'selected':''}>Manuelle · je garde la main</option></select></label>`:''}<label class="checkboxline"><input type="checkbox" data-setting="autoNext" ${config.settings.autoNext?'checked':''}> Passer automatiquement à la question suivante</label>${config.settings.autoNext?`<label class="field-label">Délai avant la question suivante (secondes)<input type="number" min="3" max="60" data-setting="autoNextSeconds" value="${config.settings.autoNextSeconds}"></label>`:''}</details>`;}

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
 if(form.matches('[data-team-count],[data-team-move],[data-team-style]')){
  event.preventDefault();
  const data=new FormData(form);
  if(form.hasAttribute('data-team-count'))send({type:'teams-config',count:Number(data.get('count'))});
  else if(form.hasAttribute('data-team-move'))send({type:'teams-choose',player:data.get('player'),group:data.get('group')});
  else send({type:'teams-style',group:form.dataset.teamStyle,name:data.get('name'),color:data.get('color'),icon:data.get('icon')});
  return;
 }
 if(form.id!=='ty-start-form')return;
 event.preventDefault();
 const data=new FormData(form);
 try{
  await desk.unlock();
  send({type:'ty-start',levels:Number(data.get('levels')),seconds:Number(data.get('seconds')),bonuses:data.has('bonuses')});
 }catch(error){toast(error.message);}
});
