import {MAX_PARTICIPANTS,TYROLIEN_TEAMS,teamContrast} from './teams.js';

const steps=[2,3,4,5,6,8,10];
const labels={free:'Choix libre',auto:'Automatique',manual:'Manuelle'};
const style=group=>`--team-color:${group.color};--team-ink:${teamContrast(group.color)}`;

export function teamCards(plan,role,player,esc){
 const chosen=plan.groups.find(group=>group.members.some(member=>member.id===player));
 return `<section class="team-board ${role==='tv'?'team-board-tv':''}">
 <header><h2>${role==='tv'?'Les équipes':'Choisis ton équipe'}</h2>
 ${chosen?`<p class="team-confirm" style="${style(chosen)}">${esc(chosen.icon)} Tu joues avec ${esc(chosen.name)}</p>`:''}
 ${role==='player'&&(plan.mode!=='free'||!plan.open)?'<p>L’animateur prépare la répartition.</p>':''}</header>
 <div class="team-grid">${plan.groups.map(group=>{
  const remaining=group.capacity-group.members.length;
  const names=group.members.slice(0,6).map(member=>esc(member.name)).join(', ');
  const more=group.members.slice(6);
  return `<article class="team-card" style="${style(group)}">
   <h3><span aria-hidden="true">${esc(group.icon)}</span> ${esc(group.name)}</h3>
   <div><strong>${group.members.length} / ${group.capacity}</strong> joueurs</div>
   <progress aria-label="Places occupées" value="${group.members.length}" max="${group.capacity||1}"></progress>
   ${names?`<p>${names}</p>`:''}
   ${more.length?`<details><summary>+${more.length} autres</summary><p>${more.map(member=>esc(member.name)).join(', ')}</p></details>`:''}
   <p>${remaining?`${remaining} place${remaining===1?'':'s'} disponible${remaining===1?'':'s'}`:'Équipe complète'}</p>
   ${role==='player'&&plan.open&&plan.mode==='free'?`<button class="btn ghost" data-action="teams-choose" data-value="${group.id}" ${!remaining||chosen?.id===group.id?'disabled':''}>${chosen?.id===group.id?'Mon équipe':'Rejoindre'}</button>`:''}
  </article>`;
 }).join('')}</div></section>`;
}

export function teamGather(plan,role,player,esc){
 if(role==='tv')return teamCards(plan,role,player,esc);
 const group=plan.groups.find(item=>item.members.some(member=>member.id===player));
 return `<main class="team-gather" ${group?`style="${style(group)}"`:''}><span aria-hidden="true">${group?esc(group.icon):'♫'}</span>
 <h1>${group?esc(group.name):'Choisis ton équipe'}</h1>
 ${group?'':plan.open&&plan.mode==='free'?'<button class="btn ghost" data-action="teams-pick-during-gather">Voir les équipes</button>':'<p>L’animateur ouvre bientôt le choix des équipes.</p>'}
 <button class="team-fullscreen" data-action="teams-fullscreen" aria-label="Plein écran">⛶</button></main>`;
}

export function teamHost(plan,{editable,tyrolien,participantCount,gatherable},esc){
 const limit=tyrolien?TYROLIEN_TEAMS:MAX_PARTICIPANTS;
 const sizes=plan?.groups.map(group=>group.members.length)||[];
 const gap=sizes.length?Math.max(...sizes)-Math.min(...sizes):0;
 const eligible=plan?.groups.length>limit;
 return `<section class="team-admin qcard" data-team-admin>
  <div class="row"><h3>Équipes</h3>${plan&&gatherable?`<button class="btn ${plan.gather?'primary':'ghost'}" data-action="teams-gather" aria-pressed="${plan.gather}">${plan.gather?'Terminer le rassemblement':'Rassembler les équipes'}</button>`:''}</div>
  <p>${participantCount} participant(s)${plan?` · ${plan.groups.length} équipes · ${plan.unassigned.length} sans équipe`:''}</p>
  ${plan?.gather?'<p role="status">Rassemblement actif</p>':''}
  ${editable?`<div class="row">${steps.filter(n=>n<=limit).map(count=>`<button class="btn ghost" data-action="teams-config" data-value="${count}" aria-label="${count} équipes" aria-pressed="${plan?.groups.length===count}">${count}</button>`).join('')}</div>
   ${!tyrolien?`<form data-team-count class="row"><label>Nombre personnalisé <input name="count" type="number" min="2" max="${limit}" value="${plan?.groups.length||''}" required></label><button class="btn ghost">Appliquer</button></form>`:''}
   ${eligible?`<p role="status">Le Tyrolien accueille jusqu’à ${limit} équipes.</p>`:''}
  `:''}
  ${plan&&editable?`<div class="row">${Object.entries(labels).map(([id,label])=>`<button class="btn ghost" data-action="teams-mode" data-value="${id}" aria-pressed="${plan.mode===id}">${label}</button>`).join('')}
   <button class="btn ghost" data-action="teams-open" aria-pressed="${plan.open}">${plan.open?'Fermer le choix des équipes':'Ouvrir le choix des équipes'}</button>
   <button class="btn ghost" data-action="teams-shuffle">Répartir automatiquement</button></div>
   ${gap>1?`<p role="status">Écart actuel de ${gap} joueurs entre les équipes.</p>`:''}
   ${plan.unassigned.length?`<p>Sans équipe · ${plan.unassigned.slice(0,8).map(member=>esc(member.name)).join(', ')}${plan.unassigned.length>8?` et ${plan.unassigned.length-8} autres`:''}</p>`:''}
   <details data-team-details="roster"><summary>Composition et places</summary>${teamCards(plan,'host',null,esc).replace('<h2>Choisis ton équipe</h2>','')}</details>
   <details data-team-details="manual"><summary>Déplacer un joueur</summary><form data-team-move class="row">
    <label>Participant <select name="player" required><option value="">Choisir</option>${[...plan.unassigned,...plan.groups.flatMap(group=>group.members)].map(member=>`<option value="${esc(member.id)}">${esc(member.name)}</option>`).join('')}</select></label>
    <label>Équipe <select name="group"><option value="">Sans équipe</option>${plan.groups.map(group=>`<option value="${group.id}">${esc(group.name)} · ${group.members.length}/${group.capacity}</option>`).join('')}</select></label>
    <button class="btn ghost">Déplacer</button></form></details>
   <details data-team-details="style"><summary>Personnaliser les équipes</summary>
    <div class="team-grid">${plan.groups.map(group=>`<form class="team-card" style="${style(group)}" data-team-style="${group.id}">
     <label>Nom <input name="name" maxlength="24" value="${esc(group.name)}" required></label>
     <label>Couleur <input name="color" type="color" value="${group.color}"></label>
     <label>Icône <input name="icon" maxlength="16" value="${esc(group.icon)}" required></label>
     <button class="btn ghost">Enregistrer</button></form>`).join('')}</div></details>`:''}
 </section>`;
}
