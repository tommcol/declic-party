// Original, synthesized practice clips. No external provider or recording is required.
export const practiceClips = Array.from({length: 36}, (_, index) => {
  const counts = [1, 2, 3, 4];
  const answer = 1 + index % 4;
  const root = 48 + index % 12;
  const melody = [0, 4 + index % 3, 7, 2, 5, 9 - index % 4];
  return {
    id: 'practice-' + index,
    prompt: 'Combien de notes aiguës entendez-vous à la fin ?',
    options: counts.map(String),
    answer: String(answer),
    notes: [...melody.map(note => [root + note, .26]), [root, .52],
      ...Array.from({length: answer}, () => [root + 24, .36])]
  };
});

export function selectMusicClips(clips, random = Math.random) {
  const pool = [...new Map(clips.map(clip => [clip.id, clip])).values()];
  for (let index = pool.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [pool[index], pool[other]] = [pool[other], pool[index]];
  }
  return pool;
}
