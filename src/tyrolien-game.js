import {applyAction, roundStatistics, targets} from '../public/engine.js';
import {rouletteIndex} from '../public/roulette.js';
import {resolveTyrolienRound, resolveTyrolienAttack} from './tyrolien.js';

export function mountainSettings(input) {
  return {
    levels: Math.min(15, Math.max(4, Math.trunc(Number(input?.levels) || 6))),
    bonuses: input?.bonuses !== false,
    teams: [],
    eliminated: [],
    results: [],
    roundsPlayed: 0
  };
}

export function startMountain(room, plan) {
  room.mountain.teams = plan.groups.map(group => ({...group, position:0, streak:0, eliminated:false}));
  room.mountain.roster = room.teams.map(({id}) => ({id, team:plan.assignments[id]}));
}

function updateMountain(room, result) {
  const mountain = room.mountain;
  for (const team of result.teams) {
    if (team.eliminated && !mountain.eliminated.includes(team.id)) mountain.eliminated.push(team.id);
  }
  mountain.teams = result.teams;
  mountain.winner = result.winner;
}

function attackMountain(room, now) {
  const mountain = room.mountain;
  const result = resolveTyrolienAttack(mountain.teams, mountain.beneficiary, mountain.roster, mountain.votes, mountain.levels);
  updateMountain(room, result);
  mountain.target = result.target;
  mountain.phase = 'attack';
  room.nextAt = result.winner || room.settings.autoHost || room.settings.autoNext ? now + 2300 : 0;
}

function nextMountainQuestion(room, now) {
  const mountain = room.mountain;
  const questions = room.questions;
  const previous = questions[room.index];
  let index = room.index + 1;
  if (index >= questions.length) {
    index = 0;
    for (let offset = questions.length - 1; offset > 0; offset--) {
      const pick = rouletteIndex(offset + 1);
      [questions[offset], questions[pick]] = [questions[pick], questions[offset]];
    }
    if (questions.length > 1 && (questions[0].sourceId || questions[0].id) === (previous.sourceId || previous.id)) {
      [questions[0], questions[1]] = [questions[1], questions[0]];
    }
  }
  const question = questions[index];
  const sourceId = question.sourceId || question.id;
  questions[index] = {...question, sourceId, id:crypto.randomUUID()};
  Object.assign(mountain, {phase:null, loser:null, target:null, beneficiary:null, results:[], votes:{}, round:(mountain.round || 1) + 1});
  return applyAction({...room, index, phase:'ready', nextAt:0}, {type:'play'}, now);
}

export function applyMountain(game, action, now) {
  const {type} = action;
  const question = game.questions[game.index];
  if (action.questionId && action.questionId !== question?.id) return game;
  if (game.phase === 'finished' || type === 'reveal' && game.phase === 'playing' && now < game.startAt) return game;
  if (['pause','resume'].includes(type) && game.mountain.phase && ['paused','reveal'].includes(game.phase)) {
    if (type === 'pause' && game.phase === 'reveal' && (!game.nextAt || now < game.nextAt)) {
      return {...game, phase:'paused', nextAt:0, revision:game.revision+1,
        mountain:{...game.mountain, pausedReveal:game.nextAt ? game.nextAt-now : 0}};
    }
    if (type === 'resume' && game.phase === 'paused' && game.mountain.pausedReveal !== undefined) {
      const {pausedReveal,...mountain}=game.mountain;
      return {...game, mountain, phase:'reveal', nextAt:pausedReveal ? now+pausedReveal : 0, revision:game.revision+1};
    }
  }
  if (game.mountain.pausedReveal !== undefined && type !== 'stop') return game;
  if (type === 'ty-vote') {
    const mountain = game.mountain;
    if (game.phase !== 'reveal' || mountain.phase !== 'vote' || now >= game.nextAt ||
        !mountain.roster.some(player => player.id === action.player && player.team === mountain.beneficiary) ||
        Object.hasOwn(mountain.votes, action.player) ||
        !mountain.teams.some(team => team.id === action.value && !team.eliminated && team.id !== mountain.beneficiary)) return game;
    return {...game, revision:game.revision + 1, mountain:{...mountain, votes:{...mountain.votes, [action.player]:action.value}}};
  }
  if (type === 'stop' || type === 'skip' && ['playing','paused'].includes(game.phase) ||
      ['next','ty-tick'].includes(type) && game.phase === 'reveal') {
    const room = structuredClone(game);
    const mountain = room.mountain;
    if (type === 'stop' || mountain.winner) {
      return {...room, phase:'finished', nextAt:0, pending:{}, revision:room.revision + 1, event:{type:'podium',id:crypto.randomUUID()}};
    }
    if (type === 'skip') return nextMountainQuestion(room, now);
    if (mountain.phase === 'vote' && type !== 'ty-tick') return game;
    if (mountain.phase === 'vote' || mountain.phase === 'result' && mountain.beneficiary &&
        mountain.teams.filter(team => !team.eliminated).length === 2) {
      attackMountain(room, now);
    } else if (mountain.phase === 'result' && mountain.beneficiary) {
      mountain.phase = 'vote';
      room.nextAt = now + 10000;
    } else {
      return nextMountainQuestion(room, now);
    }
    room.revision++;
    return room;
  }
  const room = applyAction(game, action, now);
  if (room === game || room.phase !== 'reveal' || game.phase === 'reveal') return room;
  const mountain = room.mountain;
  const answers = Object.fromEntries(Object.entries(room.answers).map(([id, answer]) => [
    id, {elapsed:answer.completedElapsed ?? answer.elapsed, correct:targets(question).every(part => answer.parts.includes(part))}
  ]));
  const result = resolveTyrolienRound(mountain.teams, mountain.roster, answers, mountain);
  updateMountain(room, result);
  Object.assign(mountain, {phase:'result', results:result.ranking, loser:result.loser, beneficiary:result.bonus, votes:{}});
  mountain.roundsPlayed++;
  const excess = room.history.length - 20;
  if (excess > 0) {
    const compacted = room.history.splice(0, excess);
    room.archivedStats = Object.fromEntries(roundStatistics(compacted, room.teams, room.archivedStats).map(row => [row.id,row]));
  }
  if (result.winner || result.bonus) room.nextAt ||= now + 5600;
  return room;
}

export function mountainView(room, role, playerId) {
  const {roster, votes, ...mountain} = room.mountain;
  const team = roster?.find(player => player.id === playerId)?.team;
  const host = role === 'host';
  return {...mountain, team, voteEligible:roster?.filter(player=>player.team===mountain.beneficiary).length, voted:!!votes?.[playerId], voteCount:Object.keys(votes || {}).length,
    tallies:host && votes ? Object.fromEntries(mountain.teams.map(team =>
      [team.id, Object.values(votes).filter(value => value === team.id).length])) : undefined};
}
