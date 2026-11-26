import {resolveTyrolienRound, resolveTyrolienAttack} from './tyrolien.js';
import {practiceClips, selectMusicClips} from '../public/music-source.js';

const teamDefaults = [['Rouge','#e95358'],['Bleue','#387fe1'],['Verte','#329b70'],['Jaune','#e5ab30']];
const options = ['1', '2', '3', '4'];

export function createTyrolien() {
  return {phase:'lobby', levels:6, seconds:15, bonuses:true, teams:[], assignments:{},
    clips:[], index:-1, round:0, scores:{}, results:[], eliminated:[]};
}

export function tyrolienView(room, role, player) {
  const g = room.tyrolien;
  const host = role === 'host';
  const clip = practiceClips.find(item => item.id === g.clips[g.index]);
  const reveal = ['result','vote','attack','finished'].includes(g.phase);
  return {
    mode:'phone', phase:g.phase, revision:room.revision, questions:host ? [{}] : [],
    tyrolien:{
      phase:g.phase, levels:g.levels, seconds:g.seconds, bonuses:g.bonuses, teams:g.teams,
      round:g.round, nextAt:g.nextAt, winner:g.winner, loser:g.loser, target:g.target,
      beneficiary:g.beneficiary, results:g.results, eliminated:g.eliminated,
      participants:host ? room.teams.map(({id,name}) => ({id,name,team:g.assignments[id]})) : undefined,
      answered:Object.keys(g.answers || {}).length, votes:Object.keys(g.votes || {}).length,
      me:player ? {team:g.assignments[player], answered:Object.hasOwn(g.answers || {},player),
        correct:reveal ? g.answers?.[player]?.correct : undefined, voted:Object.hasOwn(g.votes || {},player),
        points:g.scores[player]?.points || 0} : undefined,
      question:clip ? {id:g.questionId, prompt:clip.prompt, options:g.options,
        answer:host || reveal ? clip.answer : undefined,
        audio:host ? {...clip, id:g.questionId} : undefined} : undefined,
      scores:g.phase==='finished' ? room.teams.map(({id,name}) => ({name,...g.scores[id]}))
        .sort((a,b)=>(b.points||0)-(a.points||0)||(a.elapsed||0)-(b.elapsed||0)) : undefined
    }
  };
}

function openRound(g, now) {
  if (g.index + 1 >= g.clips.length) {
    g.clips = selectMusicClips(practiceClips).map(item => item.id);
    g.index = -1;
  }
  g.index++;
  g.questionId = crypto.randomUUID();
  g.phase = 'listen';
  g.nextAt = now + 3900;
  g.options = selectMusicClips(options.map(value=>({id:value}))).map(item=>item.id);
  g.answers = {};
  g.votes = {};
  g.results = [];
  g.loser = g.target = g.beneficiary = null;
}

function attack(g, now) {
  const result = resolveTyrolienAttack(g.teams,g.beneficiary,g.roster,g.votes,g.levels);
  const before = g.teams.find(team=>team.id===result.target);
  g.teams = result.teams;
  g.target = result.target;
  if (before?.position === g.levels) g.eliminated.push(before.id);
  g.winner = result.winner;
  g.phase = 'attack';
  g.nextAt = now + 2300;
}

function advance(g, players, now) {
  if (!g.nextAt || now < g.nextAt) return;
  if (g.phase==='listen') {
    g.phase='answer';
    g.opened=now;
    g.nextAt=now+g.seconds*1000;
  } else if (g.phase==='answer') {
    const result = resolveTyrolienRound(g.teams,g.roster,g.answers,g);
    const before = g.teams.find(team=>team.id===result.loser);
    if (before?.position===g.levels) g.eliminated.push(before.id);
    g.teams=result.teams;
    g.results=result.ranking;
    g.loser=result.loser;
    g.winner=result.winner;
    g.beneficiary=result.bonus;
    for (const {id} of g.roster) {
      const answer=g.answers[id];
      const score=g.scores[id] ??= {points:0,elapsed:0,played:0};
      score.played++;
      if (answer?.correct) {
        score.points++;
        score.elapsed+=answer.elapsed;
      }
    }
    g.phase='result';
    g.nextAt=now+5600;
  } else if (g.phase==='result' && g.beneficiary && !g.winner) {
    if (g.teams.filter(t=>!t.eliminated).length===2) attack(g,now);
    else {g.phase='vote';g.nextAt=now+10000;}
  } else if (g.phase==='vote') {
    attack(g,now);
  } else if (g.winner) {
    g.phase='finished';
    g.nextAt=null;
  } else {
    g.round++;
    g.roster=players.map(({id})=>({id,team:g.assignments[id]}));
    openRound(g,now);
  }
}

export function applyTyrolien(g, action, identity, players, now) {
  const host=identity.role==='host';
  if (action.type==='ty-tick') return advance(g,players,now);
  if (host && action.type==='ty-start' && g.phase==='lobby') {
    const names=action.names;
    if (!Array.isArray(names)||names.length<2||names.length>4||players.length<names.length) {
      throw Error('Il faut au moins un joueur par équipe.');
    }
    if (!Number.isInteger(action.levels)||action.levels<4||action.levels>15||
        !Number.isInteger(action.seconds)||action.seconds<5||action.seconds>60) throw Error('Réglages invalides.');
    g.levels=action.levels;
    g.seconds=action.seconds;
    g.bonuses=action.bonuses!==false;
    g.teams=names.map((name,index)=>({id:String(index),name:String(name).trim().slice(0,24)||teamDefaults[index][0],
      color:teamDefaults[index][1], position:0, streak:0, eliminated:false}));
    const teamSizes = g.teams.map(() => 0);
    for (const {id} of players) {
      const chosen=action.assignments?.[id];
      if (!g.teams.some(team=>team.id===chosen))continue;
      g.assignments[id]=chosen;
      teamSizes[Number(chosen)]++;
    }
    g.roster=players.map(({id})=>{
      if (!Object.hasOwn(g.assignments,id)) {
        const smallest=teamSizes.indexOf(Math.min(...teamSizes));
        g.assignments[id]=String(smallest);
        teamSizes[smallest]++;
      }
      return {id,team:g.assignments[id]};
    });
    if (new Set(g.roster.map(p=>p.team)).size!==names.length) throw Error('Il faut au moins un joueur par équipe.');
    g.round=1;
    openRound(g,now);
    return;
  }
  if (host && action.type==='ty-stop' && g.phase!=='finished') {
    g.phase='finished';
    g.nextAt=null;
    return;
  }
  if (host && action.type==='ty-pause' && ['listen','answer','result','vote','attack'].includes(g.phase) && now<g.nextAt) {
    g.pausedPhase=g.phase;
    g.pausedAt=now;
    g.remaining=g.nextAt-now;
    g.phase='paused';
    g.nextAt=null;
    return;
  }
  if (host && action.type==='ty-resume' && g.phase==='paused') {
    g.phase=g.pausedPhase;
    g.nextAt=now+g.remaining;
    if (g.phase==='answer')g.opened+=now-g.pausedAt;
    return;
  }
  if (host && action.type==='ty-skip' && ['listen','answer'].includes(g.phase)) return openRound(g,now);
  if (host && action.type==='ty-next' && ['result','attack'].includes(g.phase)) {
    g.nextAt=now;
    return advance(g,players,now);
  }
  const id=identity.team;
  if (identity.role==='player' && action.type==='ty-answer' && g.phase==='answer' &&
      action.questionId===g.questionId && now<g.nextAt && g.roster.some(p=>p.id===id) &&
      !Object.hasOwn(g.answers,id) && options.includes(action.value)) {
    const clip=practiceClips.find(item=>item.id===g.clips[g.index]);
    g.answers[id]={correct:action.value===clip.answer,elapsed:now-g.opened};
    return;
  }
  if (identity.role==='player' && action.type==='ty-vote' && g.phase==='vote' &&
      action.questionId===g.questionId && now<g.nextAt && g.assignments[id]===g.beneficiary &&
      !Object.hasOwn(g.votes,id) && g.teams.some(t=>!t.eliminated&&t.id===action.value&&t.id!==g.beneficiary)) {
    g.votes[id]=action.value;
    return;
  }
  throw Error('Cette action est indisponible.');
}
