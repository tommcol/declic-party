// The room supplies server timestamps and authenticated participant IDs.
export function rankTyrolienTeams(teams, roster, answers) {
  const rows = teams.filter(team => !team.eliminated).map(team => {
    const members = roster.filter(player => player.team === team.id);
    const correct = members.map(player => answers[player.id]).filter(answer => answer?.correct);
    return {
      id: team.id,
      players: members.length,
      correct: correct.length,
      totalTime: correct.reduce((total, answer) => total + answer.elapsed, 0)
    };
  });
  return rows.sort(compareTeams);
}

function compareTeams(a, b) {
  const percentage = b.correct * Math.max(1, a.players) - a.correct * Math.max(1, b.players);
  if (percentage || !a.correct || !b.correct) return percentage;
  return a.totalTime * b.correct - b.totalTime * a.correct;
}

export function moveTyrolien(team, levels) {
  if (team.eliminated) return team;
  const position = team.position + 1;
  return { ...team, position, eliminated: position > levels };
}

export function resolveTyrolienRound(teams, roster, answers, { levels, bonuses }) {
  const ranking = rankTyrolienTeams(teams, roster, answers);
  const first = ranking[0];
  const last = ranking.at(-1);
  const winner = ranking.length > 1 && compareTeams(first, ranking[1]) !== 0 ? first.id : null;
  const loser = ranking.length > 1 && compareTeams(ranking.at(-2), last) !== 0 ? last.id : null;
  const moved = teams.map(team => team.id === loser ? moveTyrolien(team, levels) : team);
  const active = moved.filter(team => !team.eliminated);
  if (active.length <= 1) {
    return { teams: moved, ranking, loser, winner: active[0]?.id ?? null, bonus: null };
  }
  const updated = moved.map(team => ({
    ...team,
    streak: bonuses && !team.eliminated && team.id === winner ? (team.streak || 0) + 1 : 0
  }));
  return { teams: updated, ranking, loser, winner: null, bonus: updated.find(team => team.streak === 4)?.id ?? null };
}

export function resolveTyrolienAttack(teams, beneficiary, roster, votes, levels, random = Math.random) {
  const owner = teams.find(team => team.id === beneficiary && !team.eliminated && team.streak === 4);
  const targets = teams.filter(team => !team.eliminated && team.id !== beneficiary);
  if (!owner || !targets.length) return { teams, target: null, winner: null };
  const eligible = roster.filter(player => player.team === beneficiary);
  const counts = targets.map(team => ({
    id: team.id,
    votes: eligible.filter(player => votes[player.id] === team.id).length
  }));
  const best = Math.max(...counts.map(target => target.votes));
  const tied = counts.filter(target => target.votes === best);
  const target = tied.length === 1 ? tied[0].id : tied[Math.floor(random() * tied.length)].id;
  const updated = teams.map(team => {
    if (team.id === target) return moveTyrolien(team, levels);
    return team.id === beneficiary ? { ...team, streak: 0 } : team;
  });
  const active = updated.filter(team => !team.eliminated);
  return { teams: updated, target, winner: active.length === 1 ? active[0].id : null };
}
