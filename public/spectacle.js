export const SHOW_EFFECTS = Object.freeze({
  applause: 'Applaudissements',
  suspense: 'Suspense',
  celebration: 'Célébration',
  spotlight: 'Projecteurs',
  opening: 'Générique',
  podium: 'Podium',
  card: 'À l’antenne'
});

export function normalizeShowCue(message) {
  const {effect, title, detail} = message;
  if (!Object.hasOwn(SHOW_EFFECTS, effect)) return null;
  const text = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
  const heading = effect === 'card' ? text(title, 80) : effect === 'opening' ? 'Le Grand Soir' : SHOW_EFFECTS[effect];
  if (!heading) return null;
  return {
    type: 'spectacle',
    effect,
    title: heading,
    detail: ['card', 'podium'].includes(effect) ? text(detail, 160) : ''
  };
}
