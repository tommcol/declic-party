export function openMusicLibrary(root, request, escape) {
 let category='', playlist='', query='', offset=0, excluded=false, summary=null;
 let generation=0, timer;
 const selectedPlaylists=new Map();
 const count=new Intl.NumberFormat('fr-FR');
 const button=(label, action, value='')=>
  `<button type="button" class="btn ghost" data-library="${action}" value="${escape(value)}">${label}</button>`;
 const card=(name,icon,detail,action,value)=>
  `<button type="button" class="theme-card music-library-card" data-library="${action}" value="${escape(value)}">
   <span aria-hidden="true">${icon}</span><strong>${escape(name)}</strong><small>${detail}</small>
  </button>`;
 const searchForm=()=>`<form class="music-library-search" aria-label="Recherche musicale">
  <input type="search" name="q" aria-label="Titre ou artiste" placeholder="Titre ou artiste" maxlength="100" value="${escape(query)}">
  <button class="btn primary">Rechercher</button>
 </form>`;
 const trackStatus=track=>track.available?'Extrait disponible':'Extrait en attente d’autorisation';

 function show(content) {
  root.innerHTML=`<section class="music-library">
   <div class="music-library-actions"><button type="button" class="btn ghost" data-action="home">← Accueil animateur</button>
   ${button('Ancien explorateur Deezer','legacy')}</div>
   <h1>Bibliothèque musicale</h1>${selectedPlaylists.size?`<div class="music-library-actions">
   <span>${[...selectedPlaylists.values()].map(escape).join(' · ')}</span>
   ${button('Utiliser pour un jeu','play-selection')}${button('Vider la sélection','clear-selection')}</div>`:''}${content}
  </section>`;
 }

 function progressMarkup(status) {
  if(!status)return '';
  if(status.finished)return `Dernière actualisation le ${new Date(status.finished).toLocaleString('fr-FR')}`;
  return `Importation en cours · ${status.cursor} / ${status.total} références traitées`;
 }

 async function load({focus=false}={}) {
  clearTimeout(timer);
  const current=++generation;
  try {
   summary=await request('/api/library');
   if(current!==generation||!root.isConnected)return;
   const selected=summary.categories.find(group=>group.id===category);
   const playlists=summary.categories.flatMap(group=>group.playlists);
   const mix=playlists.find(item=>item.id==='mix');
   const list=playlists.find(item=>item.id===playlist);
   const progress=progressMarkup(summary.import);
   const details=item=>`${count.format(item.playable)} jouable(s) · ${count.format(item.references)} référence(s)`;
   const toolbar=`<div class="music-library-actions">${button('Actualiser le catalogue','refresh')}
    <span role="status">${progress}</span></div>`;
   if(list){
    const params=new URLSearchParams({playlist,offset:String(offset),q:query,excluded:excluded?'1':'0'});
    const page=await request('/api/library/tracks?'+params);
    if(current!==generation||!root.isConnected)return;
    show(`${button(selected?'← '+escape(selected.name):'← Toutes les catégories','back')}
     <h2>${escape(list.name)}</h2><p>${details(list)}</p>
     ${button(selectedPlaylists.has(playlist)?'Retirer de la sélection':'Ajouter à la sélection','select-playlist',playlist)}${searchForm()}
     ${button(excluded?'Afficher les titres actifs':'Afficher les titres exclus','excluded')}
     <ul class="music-library-tracks">${page.tracks.map(track=>`
      <li><div><strong>${escape(track.title)}</strong><span>${escape(track.artist)}${track.year?' · '+track.year:''}
       ${track.work?' · '+escape(track.work):''}</span><small>${trackStatus(track)} · Difficulté à établir</small>
       ${track.source?`<small>${escape(track.source)}</small>`:''}</div>
       ${button(track.excluded?'Restaurer':'Exclure','toggle',track.id)}
      </li>`).join('')}</ul>
     ${page.tracks.length?'':'<p>Aucun titre dans cette sélection.</p>'}
     <div class="music-library-actions">${offset?button('← Précédent','page',String(Math.max(0,offset-30))):''}
      ${page.next!==null?button('Suivant →','page',String(page.next)):''}</div>${toolbar}`);
   }else if(selected){
    show(`${button('← Toutes les catégories','back')}<h2>${escape(selected.name)}</h2>
     <div class="theme-grid">${selected.playlists.map(item=>card(item.name,item.icon,details(item),'playlist',item.id)).join('')}</div>${toolbar}`);
   }else{
    show(`${searchForm()}<p>${details(summary)}</p>
     ${card(mix.name,mix.icon,details(mix),'playlist',mix.id)}
     <div class="theme-grid">${summary.categories.map(group=>card(group.name,group.icon,
      group.playlists.length+' playlists','category',group.id)).join('')}</div>${toolbar}`);
   }
   if(focus)root.querySelector('h2,h1')?.scrollIntoView({block:'nearest'});
   // During import keep the counters current without replacing an active input.
   if(summary.import&&!summary.import.finished){
    timer=setTimeout(async function poll(){
     if(current!==generation||!root.isConnected)return;
     try{
      const latest=await request('/api/library');
      if(current!==generation||!root.isConnected)return;
      const status=root.querySelector('[role="status"]');
      if(status)status.textContent=progressMarkup(latest.import);
      if(latest.import?.finished&&!root.contains(document.activeElement))await load();
      else if(!latest.import?.finished)timer=setTimeout(poll,1500);
     }catch{if(current===generation)timer=setTimeout(poll,3500);}
    },1500);
   }
  }catch(error){
   if(current===generation&&root.isConnected)show(`<p role="alert">${escape(error.message)}</p>${button('Réessayer','retry')}`);
  }
 }

 root.addEventListener('click',async event=>{
  const target=event.target.closest('[data-library]');
  if(!target||target.disabled)return;
  const action=target.dataset.library, value=target.value;
  if(action==='play-selection'){
   root.dispatchEvent(new CustomEvent('play-library-selection',{detail:[...selectedPlaylists],bubbles:true}));
   return;
  }
  if(action==='clear-selection')selectedPlaylists.clear();
  if(action==='select-playlist'){
   if(selectedPlaylists.has(value))selectedPlaylists.delete(value);
   else if(selectedPlaylists.size<5){
    const selected=summary.categories.flatMap(group=>group.playlists).find(entry=>entry.id===value);
    if(selected)selectedPlaylists.set(value,selected.name);
   }
  }
  if(action==='legacy'){
   root.dispatchEvent(new CustomEvent('legacy-music',{bubbles:true}));
   return;
  }
  if(action==='category'||action==='playlist'||action==='back'){
   if(action==='category')category=value;
   if(action==='playlist')playlist=value;
   if(action==='back'){
    if(playlist)playlist='';
    else category='';
   }
   query='';offset=0;excluded=false;
  }
  if(action==='page')offset=Number(value);
  if(action==='excluded'){excluded=!excluded;offset=0;}
  if(action==='refresh'||action==='toggle'){
   target.disabled=true;
   try{
    if(action==='refresh')await request('/api/library/refresh','POST');
    else await request('/api/library/tracks','PATCH',{id:value,excluded:!excluded});
   }catch(error){
    target.disabled=false;
    const alert=document.createElement('p');
    alert.role='alert';alert.textContent=error.message;target.after(alert);
    return;
   }
  }
  await load({focus:['category','playlist','back'].includes(action)});
 });
 root.addEventListener('submit',event=>{
  event.preventDefault();
  query=String(new FormData(event.target).get('q')).trim();
  playlist=playlist||'mix';offset=0;
  void load();
 });
 show('<p role="status">Chargement de la bibliothèque…</p>');
 void load();
}
