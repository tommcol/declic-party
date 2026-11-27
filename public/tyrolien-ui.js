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

export function mountainPanel(game, role, esc, animate) {
  const g=game.mountain;
  if(!g?.teams.length) return '';
  const host=role==='host', tv=role==='tv', finished=game.phase==='finished';
  const team=g.teams.find(item=>item.id===g.team);
  const teamName=id=>esc(g.teams.find(item=>item.id===id)?.name);
  const position=item=>item.eliminated?'Éliminée':item.position===g.levels?'Au bord du précipice':`Palier ${item.position}/${g.levels}`;
  const event=g.phase==='attack'?`Attaque de ${teamName(g.beneficiary)} sur ${teamName(g.target)}`:
    g.phase==='vote'?`${teamName(g.beneficiary)} choisit sa cible`:g.loser?`${teamName(g.loser)} monte d’un palier`:'';
  const targets=g.teams.filter(item=>!item.eliminated&&item.id!==g.beneficiary);
  const vote=g.phase==='vote'&&team?.id===g.beneficiary?`<div class="row">${g.voted?'Vote enregistré ✓':
    targets.map(item=>`<button class="btn ghost" data-action="mountain-vote" data-value="${esc(item.id)}">${teamName(item.id)}</button>`).join('')}</div>`:'';
  const order=[...(g.winner?[g.winner]:[]),...g.eliminated.slice().reverse()];
  const ranking=finished?`<h3>Classement des équipes</h3><div class="ty-podium">${order.map((id,i)=>
    `<div><strong>${g.winner?i+1:g.teams.length-order.length+i+1}. ${teamName(id)}</strong></div>`).join('')}</div>`:'';
  return `<section class="mountain-panel ${host?'mountain-desk':tv?'mountain-tv':''}">
    <h2>${g.winner?`🏆 ${teamName(g.winner)} remporte la partie !`:'Le Tyrolien'}</h2>
    ${tv||host?tyrolienMountain(g,esc,animate):''}
    ${event&&game.phase==='reveal'?`<p role="status">${event}</p>`:''}
    ${g.phase==='vote'&&game.phase==='reveal'?`<p>${g.voteCount} vote(s) · <strong data-ty-clock></strong></p>${vote}`:''}
    ${team?`<p class="ty-player-team" style="--team:${team.color}">${esc(team.icon)} ${teamName(team.id)} · ${position(team)}
    ${team.eliminated?' · Vous continuez pour le classement individuel !':''}</p>`:''}
    ${host||tv||finished?`<div class="ty-teams">${g.teams.map(item=>{
      const row=g.results.find(result=>result.id===item.id);
      const correct=row?`<small>${row.correct}/${row.players} · ${Math.round(row.correct/Math.max(1,row.players)*100)} %${host&&row.correct?` · ${(row.totalTime/row.correct/1000).toFixed(2)} s en moyenne`:''}</small>`:'';
      const votes=host&&['vote','attack'].includes(g.phase)&&item.id!==g.beneficiary?`<small>${g.tallies?.[item.id]||0} vote(s)</small>`:'';
      return `<div style="--team:${item.color}"><strong>${esc(item.icon)} ${teamName(item.id)}</strong><small>${position(item)}${g.bonuses?` · Série ${item.streak}/4`:''}</small>${correct}${votes}</div>`;
    }).join('')}</div>`:''}
    ${ranking}</section>`;
}
