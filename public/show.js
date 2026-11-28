const gameScenes = {
  blind: 'studio',
  progressive: 'studio',
  bingo: 'disco',
  timeline: 'chronology',
  coversQuiz: 'duel',
  soundtrack: 'cinema',
  covers: 'gallery',
  survival: 'arena',
  chain: 'chain',
};

export function showScene(game, wheel, ceremony) {
  if (game?.tyrolien || game?.mountain || game?.musicGame === 'tyrolien') {
    return wheel || ceremony ? 'plateau' : '';
  }
  if (wheel || ceremony || !game || ['lobby', 'paused', 'finished'].includes(game.phase)) {
    return 'plateau';
  }
  return game.settings?.chain ? 'chain' : gameScenes[game.musicGame] || 'studio';
}

const sceneNames = {
  plateau: 'Salle principale',
  studio: 'Le Grand Studio',
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
  const answered = results.filter(({result}) => result.attempts > 0);
  const complete = answered.filter(({result}) => result.correct === true);
  const partial = answered.filter(({result}) => result.correct !== true && result.parts?.length);
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
    fastest: timed.filter(({result}) => result.elapsed === fastest),
    slowest: slowest === fastest ? [] : timed.filter(({result}) => result.elapsed === slowest)
  };
}

const lobbySnapshots = new WeakMap();

export function updateLobbyArrivals(root, {room, game, reduced, avatarFor}) {
  const lobby = game?.phase === 'lobby' && !game.tyrolien && !game.teamPlan?.gather;
  const layer = root.querySelector('.show-arrivals');
  if (!lobby || !layer) {
    lobbySnapshots.delete(root);
    layer?.replaceChildren();
    return;
  }
  const ids = new Set(game.teams.map(team => team.id));
  const previous = lobbySnapshots.get(root);
  lobbySnapshots.set(root, {room, ids});
  if (!previous || previous.room !== room || reduced) {
    layer.replaceChildren();
    return;
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const arrivals = game.teams.filter(team => !previous.ids.has(team.id));
  if (!arrivals.length) return;
  const labels = arrivals.slice(0, 4).map(team => [avatarFor(team), team.name]);
  if (arrivals.length > 4) labels.push(['', '+ ' + (arrivals.length - 4) + ' arrivées']);
  labels.forEach(([avatar, name], index) => {
    while (layer.childElementCount >= 8) layer.firstElementChild.remove();
    const bubble = document.createElement('span');
    bubble.className = 'show-arrival';
    bubble.style.setProperty('--arrival-lane', index);
    bubble.textContent = avatar ? avatar + ' ' + name : name;
    layer.append(bubble);
    setTimeout(() => bubble.remove(), 3600);
  });
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

export function playShowCue(context,type){
  const cues={
   start:[[48,0,.17],[60,.09,.18],[67,.2,.28]],
   tick:[[76,0,.09]],
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
   gain.connect(context.destination);
   oscillator.start(at);
   oscillator.stop(at+length);
  }
 }
