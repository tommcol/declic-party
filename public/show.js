const gameScenes = {
  blind: 'studio',
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
  return gameScenes[game.musicGame] || (game.settings?.chain ? 'chain' : 'studio');
}

const playlistThemes = {
  '1950': 'vintage', '1960': 'retro-pop', '1970': 'mirrorball',
  '1980': 'synthwave', '1990': 'broadcast', '2000': 'chrome',
  '2010': 'festival', disco: 'mirrorball', rock: 'concert', dance: 'festival',
  rapus: 'street', rapfr: 'street', var: 'warm', fr: 'warm',
  cartoons: 'illustrated', disney: 'illustrated', films: 'cinematic',
  tv: 'cinematic', series: 'cinematic', shows: 'cinematic', ads: 'broadcast',
  summer: 'summer', pop: 'retro-pop', party: 'festival',
  latino: 'summer', reggae: 'summer', noel: 'winter',
};

export function playlistShowTheme(ids) {
  if (ids.length !== 1) return 'general';
  const [id] = ids;
  if (/^202[0-9]$/.test(id)) return 'modern';
  return Object.hasOwn(playlistThemes, id) ? playlistThemes[id] : 'general';
}

export function showBackdrop() {
  return `<div class="show-backdrop" aria-hidden="true">
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
