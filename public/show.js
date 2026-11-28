import {roundOutcome} from './engine.js';

const gameScenes = {
  blind: 'studio',
  progressive: 'laboratory',
  bingo: 'disco',
  timeline: 'chronology',
  coversQuiz: 'duel',
  soundtrack: 'cinema',
  covers: 'gallery',
  survival: 'arena',
  chain: 'chain',
};

export function normalizeLobbyPreview(stage, game) {
  if (stage === 'welcome') return {stage};
  if (['world', 'cast'].includes(stage) && (Object.hasOwn(gameScenes, game) || game === 'tyrolien')) {
    return {stage, game};
  }
  return null;
}

export function showScene(game, wheel, ceremony) {
  if (wheel || ceremony) return 'plateau';
  if (game?.showPreview && ['lobby', 'finished'].includes(game.phase)) {
    return game.showPreview.stage === 'welcome' ? 'plateau' : gameScenes[game.showPreview.game] || 'alpine-preview';
  }
  if (game?.tyrolien || game?.mountain || game?.musicGame === 'tyrolien') {
    return wheel || ceremony ? 'plateau' : '';
  }
  if (wheel || ceremony || !game || game.phase === 'paused' || game.phase === 'lobby' && !(game.questions?.length || game.question || game.total > 0)) {
    return 'plateau';
  }
  return game.settings?.chain ? 'chain' : gameScenes[game.musicGame] || ((game.timelineMode || game.settings?.timelineMode) ? 'chronology' : 'studio');
}

const sceneNames = {
  plateau: 'Salle principale',
  studio: 'Le Grand Studio',
  laboratory: 'Le Laboratoire du son',
  'alpine-preview': 'Le Tyrolien',
  disco: 'Studio 54',
  chronology: 'Le Chronoscope',
  duel: 'Battle Stage',
  cinema: 'Ciné Palace',
  gallery: 'Vinyl Factory',
  arena: 'Last One Standing',
  chain: 'Réaction'
};

export function showVenue(game, wheel, ceremony) {
  return sceneNames[showScene(game, wheel, ceremony)] || 'Le Tyrolien';
}

export function showRoundSummary(round) {
  const results = round?.results || [];
  const outcome=({result})=>roundOutcome(round?.question,result);
  const answered=results.filter(row=>outcome(row)!=='absent');
  const complete=answered.filter(row=>outcome(row)==='complete');
  const partial=answered.filter(row=>outcome(row)==='partial');
  const timed = complete.filter(({result}) => Number.isFinite(result.elapsed))
    .sort((left, right) => left.result.elapsed - right.result.elapsed);
  const middle = timed.length / 2;
  const median = timed.length ? (timed[Math.floor(middle)].result.elapsed +
    timed[Math.ceil(middle) - 1].result.elapsed) / 2 : null;
  const fastest = timed[0]?.result.elapsed;
  const slowest = timed.at(-1)?.result.elapsed;
  return {
    complete: complete.length,
    partial: partial.length,
    wrong: answered.length - complete.length - partial.length,
    absent: results.length - answered.length,
    median,
    mean:timed.length?timed.reduce((total,row)=>total+row.result.elapsed,0)/timed.length:null,
    fastest: timed.filter(({result}) => result.elapsed === fastest),
    slowest: slowest === fastest ? [] : timed.filter(({result}) => result.elapsed === slowest)
  };
}

const lobbySnapshots = new WeakMap();

export function updateLobbyArrivals(root, {room, game, reduced, avatarFor, onArrival}) {
  const lobby = game?.phase === 'lobby' && !game.tyrolien && !game.teamPlan?.gather;
  const layer = root.querySelector('.show-arrivals');
  if (!lobby || !layer) {
    lobbySnapshots.delete(root);
    layer?.replaceChildren();
    return;
  }
  const ids = new Set(game.teams.map(team => team.id));
  const previous = lobbySnapshots.get(root);
  const known=previous?.room===room?new Set([...previous.ids,...ids]):ids;
  lobbySnapshots.set(root, {room, ids:known});
  if (!previous || previous.room !== room || reduced) {
    layer.replaceChildren();
    return;
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const arrivals = game.teams.filter(team => !previous.ids.has(team.id));
  if (!arrivals.length) return;
  onArrival?.();
  const labels = arrivals.slice(0, 4).map(team => [avatarFor(team), team.name]);
  if (arrivals.length > 4) labels.push(['', '+ ' + (arrivals.length - 4) + ' arrivées']);
  labels.forEach(([avatar, name], index) => {
    while (layer.childElementCount >= 8) layer.firstElementChild.remove();
    const bubble = document.createElement('div');
    bubble.className = 'show-arrival';
    bubble.style.setProperty('--arrival-lane', index);
    if (avatar) {
      const portrait=document.createElement('span');
      portrait.className='show-arrival-portrait';
      portrait.dataset.avatarMotion='arrival';
      portrait.textContent=avatar;
      bubble.append(portrait);
    }
    const nickname=document.createElement('strong');
    nickname.textContent=name;
    bubble.append(nickname);
    layer.append(bubble);
    setTimeout(() => bubble.remove(), 3600);
  });
}

export function reactAvatars(root,motions){
  if(!root||root.classList.contains('no-show-animation')||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const pending=new Map(motions.slice(0,6).map(({id,motion})=>[String(id),motion]));
  if(!pending.size)return;
  for(const portrait of root.querySelectorAll('[data-avatar-player]')){
    const id=portrait.dataset.avatarPlayer;
    if(!pending.has(id))continue;
    portrait.dataset.avatarMotion=pending.get(id);
    pending.delete(id);
    setTimeout(()=>delete portrait.dataset.avatarMotion,1100);
    if(!pending.size)break;
  }
}

const playlistThemes = {
  '1950': 'vintage', '1960': 'retro-pop', '1970': 'mirrorball',
  '1980': 'synthwave', '1990': 'broadcast', '2000': 'chrome',
  '2010': 'festival', disco: 'mirrorball', rock: 'concert', dance: 'festival',
  rapus: 'street', rapfr: 'street', var: 'warm', fr: 'warm',
  cartoons: 'illustrated', disney: 'illustrated', films: 'cinematic',
  tv: 'cinematic', series: 'cinematic', shows: 'cinematic', ads: 'broadcast',
  summer: 'summer', pop: 'retro-pop', party: 'festival',
  latino: 'summer', reggae: 'summer', world: 'summer',
  instrumental: 'cinematic', noel: 'winter', 'decade-2020': 'modern',
};

export function playlistShowTheme(ids) {
  if (ids.length !== 1) return 'general';
  const [id] = ids;
  if (/^202[0-9]$/.test(id)) return 'modern';
  return Object.hasOwn(playlistThemes, id) ? playlistThemes[id] : 'general';
}

export function showBackdrop() {
  return `<div class="show-backdrop" aria-hidden="true">
    <div class="show-artwork"></div>
    <div class="show-arrivals"></div>
    <div class="show-wash"></div>
    <div class="show-floor"></div>
    <div class="show-set-piece show-set-piece-left"></div>
    <div class="show-set-piece show-set-piece-right"></div>
    <div class="show-wing show-wing-left"></div>
    <div class="show-wing show-wing-right"></div>
    <div class="show-wall"></div>
    <div class="show-podium"></div>
    <div class="show-beam show-beam-left"></div>
    <div class="show-beam show-beam-right"></div>
  </div>`;
}

export function updateShow(root, {role, game, wheel, ceremony, reduced}) {
  const scene = role === 'tv' || role === 'player' ? showScene(game, wheel, ceremony) : '';
  root.dataset.showScene = scene;
  root.dataset.showRole = role;
  root.dataset.showTheme = scene && scene !== 'plateau' ? game?.showTheme || 'general' : 'general';
  root.dataset.showPhase = game?.phase || 'lobby';
  root.classList.toggle('show-reduced', reduced);
  let backdrop = root.previousElementSibling;
  if (!backdrop?.classList.contains('show-backdrop')) {
    if (!scene || role !== 'tv') return;
    root.insertAdjacentHTML('beforebegin', showBackdrop());
    backdrop = root.previousElementSibling;
  }
  const previousScene = backdrop.dataset.showScene;
  backdrop.hidden = !scene || role !== 'tv';
  backdrop.dataset.showScene = scene;
  backdrop.dataset.showTheme = root.dataset.showTheme;
  backdrop.dataset.showPhase = root.dataset.showPhase;
  backdrop.classList.toggle('show-reduced', reduced);
  if (previousScene && scene && scene !== previousScene && !backdrop.hidden &&
      !reduced && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const animation of backdrop.getAnimations()) animation.cancel();
    backdrop.animate(
      [{opacity: .45, transform: 'scale(1.025)'}, {opacity: 1, transform: 'scale(1)'}],
      {duration: 620, easing: 'cubic-bezier(.2,.7,.2,1)'}
    );
  }
}

export function playShowCue(context,type,destination=context.destination){
  if(type==='applause'){
    const rate=context.sampleRate;
    const buffer=context.createBuffer(1,Math.floor(rate*1.5),rate);
    const samples=buffer.getChannelData(0);
    for(let clap=0;clap<90;clap++){
      const start=Math.floor(Math.random()*rate*1.35);
      const volume=.045*(1-start/samples.length);
      for(let i=0;i<rate*.035;i++)samples[start+i]+=(Math.random()*2-1)*volume*Math.exp(-i/(rate*.009));
    }
    const source=context.createBufferSource();
    source.buffer=buffer;
    source.connect(destination);
    source.onended=()=>source.disconnect();
    source.start();
    return;
  }
  if(type==='vinyl'){
    const rate=context.sampleRate;
    const buffer=context.createBuffer(1,Math.floor(rate*.22),rate);
    const samples=buffer.getChannelData(0);
    let previous=0;
    for(let i=0;i<samples.length;i++){
      const noise=(Math.random()*2-1)*.23;
      samples[i]=(noise-previous)*Math.exp(-i/(rate*.035));
      previous=noise;
    }
    const source=context.createBufferSource();
    source.buffer=buffer;
    source.connect(destination);
    source.onended=()=>source.disconnect();
    source.start();
  }
  const cues={
   vinyl:[[48,.04,.18],[60,.09,.25],[67,.14,.29]],
   'alpine-climb':[[55,0,.16],[67,.12,.22],[74,.25,.28]],
   'alpine-summit':[[72,0,.42],[84,.07,.55]],
   'alpine-attack':[[42,0,.25],[54,.13,.3]],
   'alpine-fall':[[60,0,.18],[53,.12,.22],[41,.24,.36]],
   'cinema-reveal':[[48,0,.24],[55,.07,.28],[67,.18,.38],[72,.3,.48]],
   'blind-reveal':[[43,0,.21],[55,.08,.23],[67,.17,.32],[74,.23,.43]],
   'battle-reveal':[[45,0,.2],[57,.09,.21],[69,.18,.4],[76,.19,.38]],
   'arena-reveal':[[40,0,.23],[52,.09,.32],[59,.19,.38]],
   'arena-replay':[[43,0,.22],[55,.08,.25],[67,.15,.26],[74,.23,.35]],
   arrival:[[55,0,.2],[67,.065,.2],[79,.14,.25]],
   streak:[[60,0,.14],[67,.07,.14],[72,.14,.2],[84,.24,.4]],
   tie:[[64,0,.22],[71,0,.22],[76,.16,.3],[83,.16,.3]],
   leader:[[45,0,.22],[57,.1,.2],[69,.2,.24],[81,.3,.42]],
   round:[[52,0,.25],[64,.13,.18],[71,.13,.18],[76,.26,.35]],
   final:[[36,0,.8],[48,0,.65],[60,.14,.28],[67,.23,.28],[72,.38,.55],[76,.38,.55],[79,.38,.56],[84,.64,.7]],
   start:[[48,0,.17],[60,.09,.18],[67,.2,.28]],
   tick:[[76,0,.09]],
   suspense:[[43,0,.44],[45,.5,.35],[47,.9,.36],[50,1.24,.26],[55,1.51,.45]],
   celebration:[[67,0,.2],[71,.12,.25],[74,.25,.33],[79,.4,.55],[83,.4,.55]],
   buzz:[[43,0,.11],[55,.035,.18]],
   correct:[[67,0,.13],[72,.07,.18],[76,.14,.22],[84,.23,.36]],
   wrong:[[55,0,.14],[49,.11,.22]],
   reveal:[[67,0,.14],[74,.085,.24]],
   podium:[[48,0,.32],[60,0,.23],[67,.13,.28],[72,.28,.5],[76,.28,.46],[84,.45,.58]]
  };
  for(const [note,delay,length] of cues[type]||[]){
   const oscillator=context.createOscillator(),gain=context.createGain();
   const at=context.currentTime+delay;
   oscillator.type=['wrong','buzz','start'].includes(type)?'triangle':'sine';
   oscillator.frequency.value=440*2**((note-69)/12);
   gain.gain.setValueAtTime(.0001,at);
   gain.gain.exponentialRampToValueAtTime(type==='podium'?.085:.12,at+.012);
   gain.gain.exponentialRampToValueAtTime(.0001,at+length);
   oscillator.connect(gain);
   gain.connect(destination);
   oscillator.start(at);
   oscillator.stop(at+length);
  }
 }

export function stageReaction(game, previousLeader) {
  const teams=game.teams||[];
  const ranked=[...teams].sort((a,b)=>Number(!!a.eliminated)-Number(!!b.eliminated)||b.score-a.score);
  const leader=ranked[0];
  const event=game.event;
  if(event.type==='start')return {kind:'start',label:'Place au jeu',players:[]};
  if(event.type==='podium'){
    const goal=game.settings?.bingo&&[...(game.bingoMilestones||[])]
      .filter(row=>!game.bingoFinishRows||row.rows===game.bingoFinishRows).sort((a,b)=>b.rows-a.rows)[0];
    const mountainWinner=game.mountain?.teams.find(team=>team.id===game.mountain.winner);
    const contenders=goal?ranked.filter(team=>goal.winners.includes(team.id)):ranked;
    const winners=mountainWinner?[mountainWinner]:contenders.filter(team=>team.score===contenders[0]?.score);
    return {kind:'podium',label:winners.length>1?'Victoire ex æquo':'Victoire',players:winners};
  }
  if(game.phase==='reveal'){
    const round=game.history?.at(-1);
    if(!round||round.index!==game.index)return null;
    const results=round.results||[];
    const scores=results.filter(row=>row.result.total>0).sort((a,b)=>b.result.total-a.result.total);
    const players=scores.map(row=>({...teams.find(team=>team.id===row.id),name:row.name,points:row.result.total}));
    const milestone=game.bingoMilestones?.filter(goal=>goal.index===game.index).at(-1);
    if(milestone)return {kind:'round',label:milestone.rows===1?'Première ligne !':milestone.rows===3?'Carton plein !':'Deux lignes !',
      players:ranked.filter(team=>milestone.winners.includes(team.id))};
    if(!players.length){
      const wrong=results.filter(row=>row.result.attempts&&row.result.correct!==true)
        .map(row=>teams.find(team=>team.id===row.id)).filter(Boolean);
      return wrong.length?{kind:'wrong',label:'Manche sans bonne réponse',players:wrong}:null;
    }
    if(scores.length>1&&scores[0].result.total===scores[1].result.total)
      return {kind:'tie',label:'Ex æquo sur la manche',players};
    if(previousLeader&&leader?.id!==previousLeader&&leader?.score>ranked[1]?.score)
      return {kind:'leader',label:'Nouveau leader',players:[leader,...players.filter(player=>player.name!==leader.name)]};
    if(players.some(player=>player.streak>=3))return {kind:'streak',label:'Série de bonnes réponses',players};
    return {kind:scores.length>1?'round':'correct',label:scores.length>1?'Les points de la manche':'Bonne réponse',players};
  }
  if(event.type==='wrong')return {kind:'wrong',label:'Mauvaise réponse',players:[]};
  if(event.type==='partial'){
    const player=teams.find(team=>team.id===event.team);
    if(player)return {kind:'correct',label:'Réponse partielle validée',players:[player]};
  }
  return null;
}
