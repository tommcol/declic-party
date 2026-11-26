const names = ['Rouge','Bleue','Verte','Jaune'];

export function tyrolienScreen(g, role, esc, invite, code, draft={}) {
  const host=role==='host', tv=role==='tv';
  const me=g.teams.find(team=>team.id===g.me?.team);
  const winner=g.teams.find(team=>team.id===g.winner);
  const turn={lobby:'En attendant les joueurs',listen:'Écoutez l’extrait',answer:'À vous de jouer',
    result:'Résultats de la manche',vote:'Bonus d’attaque',attack:'Attaque !',paused:'En pause',finished:'Fin de la partie'};
  const button=(action,label,value='')=>`<button class="btn ghost" data-action="ty-${action}" data-value="${esc(value)}">${label}</button>`;
  const info=g.winner&&g.phase==='finished'?`<h2>🏆 ${esc(winner?.name)} remporte la partie !</h2>`:`<h2>${turn[g.phase]}</h2>`;
  const points=g.teams.map(team=>{
    const x=13+Math.min(team.position,g.levels)/g.levels*67;
    const y=19+Math.min(team.position,g.levels)/g.levels*66;
    const falling=team.eliminated&&(g.phase==='result'&&team.id===g.loser||g.phase==='attack'&&team.id===g.target);
    if(team.eliminated&&!falling)return '';
    const previous=falling?g.levels:Math.max(0,team.position-1);
    const climbing=g.phase==='result'&&team.id===g.loser||g.phase==='attack'&&team.id===g.target;
    return `<div class="ty-climber ${falling?'falling':climbing?'climbing':''}" style="--x:${x}%;--y:${y}%;--lane:${Number(team.id)-1.5};--from-x:${13+previous/g.levels*67}%;--from-y:${19+previous/g.levels*66}%;--team:${team.color}"><span aria-hidden="true">🧑🏻‍🌾</span><b>${esc(team.name)}</b></div>`;
  }).join('');
  const mountain=`<div class="ty-mountain" role="img" aria-label="Positions sur la montagne"><div class="ty-slope"></div><div class="ty-sun"></div>${Array.from({length:g.levels+1},(_,i)=>`<span class="ty-step" style="left:${13+i/g.levels*67}%;bottom:${19+i/g.levels*66}%">${i}</span>`).join('')}${points}</div>`;
  const teamCards=`<div class="ty-teams">${g.teams.map(team=>{
    const row=g.results.find(item=>item.id===team.id);
    return `<div style="--team:${team.color}"><strong>${esc(team.name)}</strong><small>${team.eliminated?'Éliminée':team.position===g.levels?'Au bord du précipice !':`Palier ${team.position}/${g.levels}`}${g.bonuses?` · Série ${team.streak}/4`:''}</small>${row?`<small>${row.correct}/${row.players} · ${Math.round(row.correct/Math.max(1,row.players)*100)} %</small>`:''}</div>`;
  }).join('')}</div>`;
  const choices=g.phase==='answer'&&g.question?`<p>${esc(g.question.prompt)}</p>${role==='player'?
    g.me?.answered?'<p>Réponse enregistrée ✓</p>':`<div class="options">${g.question.options.map(option=>button('answer',esc(option),option)).join('')}</div>`:''}`:'';
  const revealed=['result','vote','attack'].includes(g.phase)&&g.question?
    `<p>Bonne réponse <strong>${esc(g.question.answer)}</strong>${g.me?.answered?` · ${g.me.correct?'Bravo !':'Réponse incorrecte'}`:''}</p>`:'';
  const vote=g.phase==='vote'&&me?.id===g.beneficiary?`<p>Quelle équipe souhaitez-vous faire monter ?</p>${g.me.voted?'Vote enregistré ✓':g.teams.filter(team=>!team.eliminated&&team.id!==me.id).map(team=>button('vote',esc(team.name),team.id)).join('')}`:'';
  const setup=host&&g.phase==='lobby'?`<form id="ty-start-form"><div class="formgrid">
   <label>Nombre d’équipes<select name="count">${[2,3,4].map(count=>`<option ${Number(draft.count)===count?'selected':''}>${count}</option>`).join('')}</select></label>
   <label>Paliers<input type="number" name="levels" value="${esc(draft.levels??6)}" min="4" max="15" required></label>
   <label>Temps de réponse en secondes<input type="number" name="seconds" value="${esc(draft.seconds??15)}" min="5" max="60" required></label>
   <label><input type="checkbox" name="bonuses" ${draft.bonuses===false?'':'checked'}> Bonus d’attaque</label>
   ${names.map((name,i)=>`<label>Équipe ${i+1}<input name="name-${i}" maxlength="24" value="${esc(draft['name-'+i]??name)}"></label>`).join('')}
   </div><p>36 extraits de démonstration. Écoutez les notes et répondez sur votre téléphone.</p><p>${g.participants.length} participant(s). Répartition automatique par défaut.</p>
   <div class="formgrid">${g.participants.map(({id,name})=>`<label>${esc(name)}<select name="team-${esc(id)}"><option value="">Automatique</option>${names.map((value,index)=>`<option value="${index}" ${draft['team-'+id]===String(index)?'selected':''}>${value}</option>`).join('')}</select></label>`).join('')}</div>
   <button class="btn primary" type="submit">Démarrer</button></form>`:'';
  const controls=host?`<div class="row ty-controls">
   <a class="btn ghost" target="_blank" rel="noopener" href="/tv?code=${esc(code)}">Écran TV ↗</a>
   ${g.phase==='paused'?button('resume','Reprendre'):['listen','answer','result','vote','attack'].includes(g.phase)?button('pause','Pause'):''}
   ${['listen','answer'].includes(g.phase)?button('replay','Réécouter')+button('skip','Passer l’extrait'):''}
   ${['result','attack'].includes(g.phase)?button('next','Continuer'):''}
   ${g.phase!=='finished'?button('stop','Terminer'):button('home','Retour à l’accueil')}
  </div>`:'';
  const final=g.phase==='finished'?`<div class="ty-final">${winner?`<h3>Classement des équipes</h3><ol>${[winner.id,...g.eliminated.slice().reverse()].map(id=>`<li>${esc(g.teams.find(team=>team.id===id)?.name)}</li>`).join('')}</ol>`:''}<h3>Classement individuel</h3><ol>${g.scores.map(score=>`<li>${esc(score.name)} · ${score.points||0}/${score.played||0} bonne(s) réponse(s)</li>`).join('')}</ol></div>`:'';
  return `<main class="ty-screen ${tv?'ty-tv':''}"><header><div><h1>Le Tyrolien</h1><span>${g.round?`Manche ${g.round}`:'Blind test par équipes'}</span></div>${g.nextAt?`<strong data-ty-clock>${Math.max(0,Math.ceil((g.nextAt-Date.now())/1000))} s</strong>`:''}</header>
    ${info}${setup}${g.phase==='lobby'&&(host||tv)?`<div class="ty-invite">${invite}</div>`:''}
    ${g.phase!=='lobby'&&(tv||host)?mountain:''}${me?`<p>${esc(me.name)} · ${g.me.points} pt${g.me.points===1?'':'s'}${me.eliminated?' · Continuez pour le classement individuel !':''}</p>`:''}
    ${choices}${host&&g.phase==='answer'?`<p>Réponse animateur <strong data-ty-answer>${esc(g.question.answer)}</strong> · ${g.answered} réponse(s)</p>`:''}${revealed}${vote}${g.phase==='attack'?`<p>${esc(g.teams.find(team=>team.id===g.target)?.name)} monte d’un palier.</p>`:''}${teamCards}${final}${controls}</main>`;
}
