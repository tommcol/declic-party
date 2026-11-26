import test from 'node:test';
import assert from 'node:assert/strict';
import { rankTyrolienTeams, moveTyrolien, resolveTyrolienRound, resolveTyrolienAttack } from '../src/tyrolien.js';

const team = (id, position = 0, streak = 0) => ({ id, position, streak, eliminated: false });
const player = (id, team) => ({ id, team });
const correct = elapsed => ({ correct: true, elapsed });

test('40 joueurs et quatre équipes sont comparés par pourcentage et temps moyen', () => {
  const teams = ['a', 'b', 'c', 'd'].map(id => team(id));
  const roster = teams.flatMap(({ id }) => Array.from({ length: 10 }, (_, i) => player(id + i, id)));
  const answers = Object.fromEntries(roster.filter(p => p.team !== 'd' && !p.id.endsWith('9'))
    .map(p => [p.id, correct(p.team === 'b' ? 100 : 200)]));
  const result = resolveTyrolienRound(teams, roster, answers, { levels: 6, bonuses: true });
  assert.deepEqual(result.ranking.map(row => row.id), ['b', 'a', 'c', 'd']);
  assert.equal(result.teams[3].position, 1);
});

test('équipes inégales à égalité parfaite et équipe éliminée', () => {
  const teams = [team('a', 0, 3), team('b'), { ...team('c'), eliminated: true }];
  const roster = [player('1', 'a'), player('2', 'b'), player('3', 'b'), player('4', 'c')];
  const answers = { 1: correct(100), 2: correct(90), 3: correct(110), 4: correct(1) };
  assert.equal(rankTyrolienTeams(teams, roster, answers).length, 2);
  const result = resolveTyrolienRound(teams, roster, answers, { levels: 6, bonuses: true });
  assert.equal(result.loser, null);
  assert.equal(result.bonus, null);
  assert.equal(result.teams[0].streak, 0);
});

test('sommet et chute sont des déplacements distincts avec 4, 6 ou 15 paliers', () => {
  for (const levels of [4, 6, 15]) {
    const summit = moveTyrolien(team('a', levels - 1), levels);
    assert.equal(summit.position, levels);
    assert.equal(summit.eliminated, false);
    assert.equal(moveTyrolien(summit, levels).eliminated, true);
  }
});

test('quatrième première place, double déplacement et victoire par attaque automatique', () => {
  const teams = [team('a', 0, 3), team('b', 5)];
  const roster = [player('1', 'a'), player('2', 'b')];
  const round = resolveTyrolienRound(teams, roster, { 1: correct(100) }, { levels: 6, bonuses: true });
  assert.equal(round.bonus, 'a');
  assert.equal(round.teams[1].position, 6);
  const attack = resolveTyrolienAttack(round.teams, round.bonus, roster, {}, 6);
  assert.equal(attack.target, 'b');
  assert.equal(attack.winner, 'a');
  assert.equal(attack.teams[0].streak, 0);
});

test('vote réservé, départage aléatoire et absence de vote', () => {
  const teams = [team('a', 0, 4), team('b'), team('c')];
  const roster = [player('1', 'a'), player('2', 'a'), player('3', 'b')];
  const attack = votes => resolveTyrolienAttack(teams, 'a', roster, votes, 6, () => 0.9);
  assert.equal(attack({ 1: 'b', 2: 'c', 3: 'b' }).target, 'c');
  assert.equal(attack({ 1: 'b', 3: 'c' }).target, 'b');
  assert.equal(attack({}).target, 'c');
});

test('aucun bonus si les bonus sont désactivés ou si la manche décide de la victoire', () => {
  const teams = [team('a', 0, 3), team('b', 6)];
  const roster = [player('1', 'a'), player('2', 'b')];
  const answers = { 1: correct(100) };
  assert.equal(resolveTyrolienRound(teams, roster, answers, { levels: 6, bonuses: true }).winner, 'a');
  const result = resolveTyrolienRound(teams, roster, answers, { levels: 15, bonuses: false });
  assert.equal(result.bonus, null);
  assert.equal(result.teams[0].streak, 0);
});
