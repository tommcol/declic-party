// Coordinates follow the illuminated track on the TV artwork.
const track=[[17,22],[26,30],[37,40],[46,48],[55,55],[62,61],[69,67],[75,71],[80,74]];
function trackPoint(level,levels){
 const index=Math.max(0,Math.min(level/levels,1))*(track.length-1);
 const [x,y]=track[Math.floor(index)];
 const [nextX,nextY]=track[Math.ceil(index)];
 const fraction=index%1;
 return {x:x+(nextX-x)*fraction,y:y+(nextY-y)*fraction};
}
export function tyrolienMountain(g,esc,animate=true) {
  const points=g.teams.map((team,index)=>{
    const falling=team.eliminated&&(g.phase==='result'&&team.id===g.loser||g.phase==='attack'&&team.id===g.target);
    if(team.eliminated&&!falling)return '';
    const {x,y}=trackPoint(falling?g.levels:team.position,g.levels);
    const previous=trackPoint(team.position-1,g.levels);
    const climbing=g.phase==='result'&&team.id===g.loser||g.phase==='attack'&&team.id===g.target;
    const lane=index-(g.teams.length-1)/2;
    const label=`${team.name} · ${falling?'Éliminée':`Palier ${team.position}/${g.levels}`}`;
    return `<div class="ty-climber ${falling?'falling':climbing?'climbing':''} ${g.winner===team.id?'ty-winner':''}" aria-label="${esc(label)}" style="--x:${x}%;--y:${y}%;--lane:${lane};--from-x:${previous.x}%;--from-y:${previous.y}%;--team:${team.color}"><span aria-hidden="true">🧗</span><b>${esc(team.icon||'')} ${esc(team.name)}</b></div>`;
  }).join('');
  const steps=Array.from({length:g.levels+1},(_,i)=>{
    const {x,y}=trackPoint(i,g.levels);
    return `<span class="ty-step" aria-hidden="true" style="left:${x}%;bottom:${y}%">${i}</span>`;
  }).join('');
  return `<div class="ty-mountain ty-set ${animate?'':'ty-still'}" aria-label="Positions sur la montagne">${steps}${points}</div>`;
}

export function tyrolienScreen(g, role, esc, invite, code, draft={}, plan=null,teamManager='') {
  const host=role==='host', tv=role==='tv';
  const answering=role==='player'&&['answer','vote','listen'].includes(g.phase);
  const me=g.teams.find(team=>team.id===g.me?.team);
  const winner=g.teams.find(team=>team.id===g.winner);
  const turn={lobby:'En attendant les joueurs',listen:'Écoutez l’extrait',answer:'À vous de jouer',
    result:'Résultats de la manche',vote:'Bonus d’attaque',attack:'Attaque !',paused:'En pause',finished:'Fin de la partie'};
  const button=(action,label,value='')=>`<button class="btn ghost" data-action="ty-${action}" data-value="${esc(value)}">${label}</button>`;
  const info=g.winner&&g.phase==='finished'?`<h2>🏆 ${esc(winner?.name)} remporte la partie !</h2>`:`<h2>${turn[g.phase]}</h2>`;
  const mountain=tyrolienMountain(g,esc);
  const teamCards=`<div class="ty-teams">${g.teams.map(team=>{
    const row=g.results.find(item=>item.id===team.id);
    return `<div style="--team:${team.color}"><strong>${esc(team.icon||'')} ${esc(team.name)}</strong><small>${team.eliminated?'Éliminée':team.position===g.levels?'Au bord du précipice !':`Palier ${team.position}/${g.levels}`}${g.bonuses?` · Série ${team.streak}/4`:''}</small>${row?`<small>${row.correct}/${row.players} · ${Math.round(row.correct/Math.max(1,row.players)*100)} %</small>`:''}</div>`;
  }).join('')}</div>`;
  const choices=g.phase==='answer'&&g.question?`<p>${esc(g.question.prompt)}</p>${role==='player'?
    g.me?.answered?'<p>Réponse enregistrée ✓</p>':`<div class="options">${g.question.options.map(option=>button('answer',esc(option),option)).join('')}</div>`:''}`:'';
  const revealed=['result','vote','attack'].includes(g.phase)&&g.question?
    `<p>Bonne réponse <strong>${esc(g.question.answer)}</strong>${g.me?.answered?` · ${g.me.correct?'Bravo !':'Réponse incorrecte'}`:''}</p>`:'';
  const vote=g.phase==='vote'&&me?.id===g.beneficiary?`<p>Quelle équipe souhaitez-vous faire monter ?</p>${g.me.voted?'Vote enregistré ✓':g.teams.filter(team=>!team.eliminated&&team.id!==me.id).map(team=>button('vote',esc(team.name),team.id)).join('')}`:'';
  const setup=host&&g.phase==='lobby'?`<form id="ty-start-form"><div class="formgrid">
   <label>Paliers<input type="number" name="levels" value="${esc(draft.levels??6)}" min="4" max="15" required></label>
   <label>Temps de réponse en secondes<input type="number" name="seconds" value="${esc(draft.seconds??15)}" min="5" max="60" required></label>
   <label><input type="checkbox" name="bonuses" ${draft.bonuses===false?'':'checked'}> Bonus d’attaque</label>
   </div><p>36 extraits de démonstration. Écoutez les notes et répondez sur votre téléphone.</p>
   <button class="btn primary" type="submit" ${!plan||plan.groups.length>6||plan.unassigned.length||plan.groups.some(group=>!group.members.length)?'disabled':''}>Démarrer</button></form>`:'';
  const controls=host?`<div class="row ty-controls">
   <a class="btn ghost" target="_blank" rel="noopener" href="/tv?code=${esc(code)}">Écran TV ↗</a>
   ${g.phase==='paused'?button('resume','Reprendre'):['listen','answer','result','vote','attack'].includes(g.phase)?button('pause','Pause'):''}
   ${['listen','answer'].includes(g.phase)?button('replay','Réécouter')+button('skip','Passer l’extrait'):''}
   ${['result','attack'].includes(g.phase)?button('next','Continuer'):''}
   ${g.phase!=='finished'?button('stop','Terminer'):button('new-game','Choisir le jeu suivant')+button('home','Retour à l’accueil')}
  </div>`:'';
  const final=g.phase==='finished'?`<div class="ty-final">${winner?`<h3>Classement des équipes</h3><ol>${[winner.id,...g.eliminated.slice().reverse()].map(id=>`<li>${esc(g.teams.find(team=>team.id===id)?.name)}</li>`).join('')}</ol>`:''}<h3>Classement individuel</h3><ol>${g.scores.map(score=>`<li>${esc(score.name)} · ${score.points||0}/${score.played||0} bonne(s) réponse(s)</li>`).join('')}</ol></div>`:'';
  return `<main class="ty-screen ${tv?'ty-tv':''} ${answering?'ty-player-question':''}"><header><div><h1>Le Tyrolien</h1><span>${g.round?`Manche ${g.round}`:'Blind test par équipes'}</span></div>${g.nextAt?`<strong data-ty-clock>${Math.max(0,Math.ceil((g.nextAt-Date.now())/1000))} s</strong>`:''}</header>
    ${info}${teamManager}${setup}${g.phase==='lobby'&&(host||tv)?`<div class="ty-invite">${invite}</div>`:''}
    ${g.phase!=='lobby'&&(tv||host)?mountain:''}${me?`<p>${esc(me.name)} · ${g.me.points} pt${g.me.points===1?'':'s'}${me.eliminated?' · Continuez pour le classement individuel !':''}</p>`:''}
    ${choices}${host&&g.phase==='answer'?`<p>Réponse animateur <strong data-ty-answer>${esc(g.question.answer)}</strong> · ${g.answered} réponse(s)</p>`:''}${revealed}${vote}${g.phase==='attack'?`<p>${esc(g.teams.find(team=>team.id===g.target)?.name)} monte d’un palier.</p>`:''}${answering?'':teamCards}${final}${controls}</main>`;
}

export function mountainMoment(game) {
  const g=game.mountain;
  if(game.phase==='paused') return {kind:'pause',label:'Entracte alpin'};
  if(game.phase==='finished') return {kind:'podium',label:g.winner?'Victoire au Tyrolien':'Classement final',actor:g.winner};
  if(game.phase==='lobby') return {kind:'lobby',label:'Au pied de la montagne'};
  if(game.phase!=='reveal') return {kind:'listen',label:'À l’écoute'};
  if(g.phase==='vote') return {kind:'vote',label:'Bonus d’attaque',actor:g.beneficiary};
  const attacking=g.phase==='attack';
  const actor=attacking?g.target:g.loser;
  const team=g.teams.find(item=>item.id===actor);
  if(team?.eliminated) return {kind:'fall',label:'La chute',actor,attacker:attacking?g.beneficiary:null};
  if(attacking) return {kind:'attack',label:'Attaque',actor,attacker:g.beneficiary};
  if(team) return {kind:'climb',label:'Un palier de plus',actor};
  return {kind:'result',label:'Résultats de la manche'};
}

export function mountainPanel(game, role, esc, animate) {
  const g=game.mountain;
  if(!g?.teams.length) return '';
  const host=role==='host', tv=role==='tv', finished=game.phase==='finished';
  const team=g.teams.find(item=>item.id===g.team);
  const teamName=id=>esc(g.teams.find(item=>item.id===id)?.name);
  const position=item=>item.eliminated?'Éliminée':item.position===g.levels?'Au bord du précipice':`Palier ${item.position}/${g.levels}`;
  const moment=mountainMoment(game);
  const actor=teamName(moment.actor);
  const attacker=teamName(moment.attacker);
  const message={
    fall:attacker?`${attacker} attaque · ${actor} tombe`:`${actor} tombe et quitte la course par équipes`,
    attack:`${attacker} fait monter ${actor}`,
    vote:`${actor} choisit l’équipe à faire monter`,
    climb:`${actor} monte d’un palier`,
    podium:g.winner?`${actor} remporte la partie !`:'Classement des équipes',
    pause:'La manche reprend au signal de la régie.'
  }[moment.kind];
  const leaders=g.results[0];
  const tied=leaders?g.results.filter(row=>row.correct*leaders.players===leaders.correct*row.players &&
    row.totalTime*leaders.correct===leaders.totalTime*row.correct):[];
  const best=leaders?.correct&&tied.length===1?teamName(leaders.id):'';
  const clock=game.phase==='reveal'&&g.phase==='vote';
  const round=g.round||Math.max(1,g.roundsPlayed||0);
  const mapKey=JSON.stringify([game.phase,g.phase,round,g.loser,g.target,g.winner,animate,
    g.teams.map(item=>[item.id,item.position,item.eliminated,item.name,item.color,item.icon])]);
  const targets=g.teams.filter(item=>!item.eliminated&&item.id!==g.beneficiary);
  const vote=role==='player'&&g.phase==='vote'&&team?.id===g.beneficiary?`<div class="row">${g.voted?'Vote enregistré ✓':
    targets.map(item=>`<button class="btn ghost" data-action="mountain-vote" data-value="${esc(item.id)}">${teamName(item.id)}</button>`).join('')}</div>`:'';
  const leadersAtStop=g.winner?[g.winner]:g.teams.filter(item=>!item.eliminated).sort((a,b)=>a.position-b.position).map(item=>item.id);
  const order=[...leadersAtStop,...g.eliminated.slice().reverse()];
  const ranking=finished?`<h3>Classement des équipes</h3><div class="ty-podium">${order.map((id,i)=>
    `<div><strong>${g.winner?`${i+1}. `:''}${teamName(id)}${!g.winner&&leadersAtStop.includes(id)?' · En course à l’arrêt':''}</strong></div>`).join('')}</div>`:'';
  return `<section class="mountain-panel ${host?'mountain-desk':tv?'mountain-tv':''}">
    ${host||tv?`<header class="ty-live-header"><div><span class="eyebrow">LE TYROLIEN · MANCHE ${round}</span><h2>${moment.label}</h2></div>
     ${clock?`<div class="ty-vote-meter"><b data-ty-clock>${Math.max(0,Math.ceil((game.nextAt-Date.now())/1000))} s</b><span>${g.voteCount??Object.keys(g.votes||{}).length} / ${g.voteEligible??g.roster?.filter(player=>player.team===g.beneficiary).length??0} votes</span></div>`:''}</header>`:''}
    ${host||tv?`<div class="ty-live-map" data-moment="${moment.kind}" data-map-key="${esc(mapKey)}">
      ${tyrolienMountain(game.phase==='paused'?{...g,phase:null}:g,esc,animate&&!finished)}
      ${tv&&['climb','attack','fall','podium'].includes(moment.kind)?'<i class="ty-summit-flare" aria-hidden="true"></i>':''}
     </div>`:''}
    ${message?`<p class="ty-live-message" data-moment="${moment.kind}" role="status">${message}</p>`:''}
    ${clock?vote:''}
    ${host&&best&&game.phase==='reveal'?`<p class="ty-round-leader">Meilleure performance · <b>${best}</b></p>`:''}
    ${team?`<p class="ty-player-team" style="--team:${team.color}">${esc(team.icon)} ${teamName(team.id)} · ${position(team)}
    ${team.eliminated?' · Vous continuez pour le classement individuel !':''}</p>`:''}
    ${host||tv||finished?`<div class="ty-teams">${g.teams.map(item=>{
      const row=g.results.find(result=>result.id===item.id);
      const percent=row?Math.round(row.correct/Math.max(1,row.players)*100):null;
      const correct=percent===null?'':`<small>${row.correct}/${row.players} · ${percent} %${host&&row.correct?` · ${(row.totalTime/row.correct/1000).toFixed(2)} s en moyenne`:''}</small>
       <meter min="0" max="100" value="${percent}" aria-label="Réussite de ${teamName(item.id)}">${percent} %</meter>`;
      const members=host&&game.phase==='playing'?g.roster?.filter(player=>player.team===item.id):null;
      const received=members?.filter(player=>game.answers?.[player.id]?.attempts).length;
      const progress=members?`<small>${received} / ${members.length} réponses · ${members.length-received} en attente</small>`:'';
      const votes=host&&['vote','attack'].includes(g.phase)&&item.id!==g.beneficiary?`<small>${g.tallies?.[item.id]||0} vote(s)</small>`:'';
      return `<div style="--team:${item.color}"><strong>${esc(item.icon)} ${teamName(item.id)}</strong><small>${position(item)}${g.bonuses?` · Série ${item.streak}/4`:''}</small>${progress}${correct}${votes}</div>`;
    }).join('')}</div>`:''}
    ${ranking}</section>`;
}
