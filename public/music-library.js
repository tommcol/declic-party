const normalizeSearch=value=>value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const screenTags=['films','series','cartoons','tv','shows','disney','ads'];
const format=new Intl.NumberFormat('fr-FR');
const familyNames={origin:'Origine',period:'Période',genres:'Genres',artists:'Artistes',themes:'Thèmes'};

export function openMusicLibrary(root, request, escape, options={}) {
 let summary, entries, category='', playlist=options.playlist||'', dynamic=Boolean(options.dynamic);
 let query='', sort='title', offset=0, excluded=false, filters={}, artistQuery='', letter='', categoryPage=0;
 let generation=0, timer;
 const previews=new Map();
 const favorites=options.favorites;
 const button=(label,action,value='',attributes='')=>
  `<button type="button" class="btn ghost" data-library="${action}" value="${escape(value)}" ${attributes}>${label}</button>`;
 const results=()=>root.querySelector('[data-library-results]');
 const label=id=>id==='fr'?'Français et francophone':id==='intl'?'International':entries.get(id)?.name||id;
 const chips=()=>Object.entries(filters).flatMap(([family,ids])=>ids.map(id=>
  button(escape(label(id))+' ×','remove-filter',family+':'+id))).join('');
 const params=()=>{
  const p=new URLSearchParams({offset:String(offset),q:query,sort,excluded:excluded?'1':'0'});
  if(playlist)p.set('playlist',playlist);
  for(const [family,ids] of Object.entries(filters))for(const id of ids)p.append(family,id);
  return p;
 };
 const trackStatus=track=>previews.get(track.id)?.message||'Extrait à vérifier';
 const pageControls=(previous,next,action)=>`<div class="row">${previous===null?'':button('← Précédent',action,String(previous))}
  ${next===null?'':button('Suivant →',action,String(next))}</div>`;
 const card=item=>`<div class="library-card">
  ${button(escape(item.icon)+' '+escape(item.name)+' · '+format.format(item.references),'playlist',item.id)}
  <label><input type="checkbox" data-library="choose" value="${escape(item.id)}" ${options.isSelected(item.id)?'checked':''}> Jouer</label>
  ${button(favorites().includes(item.id)?'★':'☆','favorite',item.id,
   `aria-label="Favori · ${escape(item.name)}" aria-pressed="${favorites().includes(item.id)}"`)}
 </div>`;

 function show() {
  const group=summary.categories.find(item=>item.id===category);
  const items=category==='favorites'?favorites().map(id=>entries.get(id)).filter(Boolean):group?.playlists;
  const list=entries.get(playlist);
  const browser=dynamic||list;
  root.innerHTML=`<section class="music-library">
   <div class="music-library-actions">
    <button type="button" class="btn ghost" data-action="library-back">← ${options.returnView==='setup'?'Configuration':'Accueil animateur'}</button>
    ${button('Catégories','home')}${button('Créer par filtres','dynamic')}
    ${button('Recherche et import Deezer','legacy')}
   </div>
   <h1>${escape(list?.name||(dynamic?'Playlist personnalisée':'Bibliothèque musicale'))}</h1>
   ${browser?`
    <div class="music-library-actions">
     ${button(dynamic?'Utiliser cette playlist':'Utiliser pour jouer','play',playlist,'disabled')}
     ${dynamic?'<input id="dynamic-name" maxlength="80" aria-label="Nom de la playlist" placeholder="Nom de la playlist">'+button('Enregistrer dans mes favoris','save',playlist,'disabled'):button(favorites().includes(playlist)?'★ Favori':'☆ Favori','favorite',playlist,`aria-pressed="${favorites().includes(playlist)}"`)}
    </div>
    ${filterMarkup()}
    <div class="music-library-actions">
     <input data-library="search" type="search" maxlength="100" aria-label="Titre ou artiste" placeholder="Titre ou artiste" value="${escape(query)}">
     <select data-library="sort" aria-label="Trier">${[['title','Titre A–Z'],['artist','Artiste A–Z'],['year','Année croissante'],['year-desc','Année décroissante']].map(([id,name])=>`<option value="${id}" ${sort===id?'selected':''}>${name}</option>`).join('')}</select>
     <label><input type="checkbox" data-library="excluded" ${excluded?'checked':''}> Titres exclus</label>
    </div>
    <div data-library-results aria-live="polite"></div>
    <audio data-library-audio controls hidden></audio>`:
    `<p>${format.format(summary.total)} références · Catalogue ${escape(summary.import.version)}</p>
     <div class="music-library-actions">${button('Toutes les musiques','playlist','mix')}
     ${summary.categories.map(item=>button(escape(item.icon)+' '+escape(item.name),'category',item.id)).join('')}
     ${button('★ Favoris','category','favorites')}</div>
     ${items?`<h2>${escape(group?.name||'Favoris')}</h2>
       ${category==='artists'?artistSearch(artistQuery):''}
       <div data-library-category></div>`:''}`}
   <p data-library-message role="status"></p>
  </section>`;
  if(items)showCategory();
  if(browser)void loadTracks();
 }

 function artistSearch(value) {
  return `<label>Rechercher un artiste <input type="search" data-library="artist-search" value="${escape(value)}"></label>
   <label>Initiale <select data-library="letter"><option value="">Toutes</option>
    ${[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(initial=>`<option ${letter===initial?'selected':''}>${initial}</option>`).join('')}</select></label>`;
 }

 function artistMatches(item) {
  const name=normalizeSearch(item.name);
  return name.includes(normalizeSearch(artistQuery))&&(!letter||name.startsWith(letter.toLowerCase()));
 }

 function showCategory() {
  const items=category==='favorites'?favorites().map(id=>entries.get(id)).filter(Boolean):
   summary.categories.find(item=>item.id===category)?.playlists||[];
  const matches=category==='artists'?items.filter(artistMatches).sort((a,b)=>a.name.localeCompare(b.name,'fr')):items;
  const limit=24;
  root.querySelector('[data-library-category]').innerHTML=`<div class="library-grid">${matches.slice(categoryPage,categoryPage+limit).map(card).join('')||'<p>Aucune playlist.</p>'}</div>
   ${pageControls(categoryPage?Math.max(0,categoryPage-limit):null,categoryPage+limit<matches.length?categoryPage+limit:null,'category-page')}`;
 }

 function artistChoices() {
  const ids=summary.filterFamilies.artists.filter(id=>artistMatches(entries.get(id))).sort((a,b)=>label(a).localeCompare(label(b),'fr'));
  return optionsList('artists',ids.slice(0,36))+(ids.length>36?'<small>Affinez la recherche ou choisissez une initiale.</small>':'');
 }

 function optionsList(family,ids) {
  return ids.map(id=>`<label><input type="checkbox" data-library="filter" data-family="${family}" value="${escape(id)}"
   ${filters[family]?.includes(id)?'checked':''}> ${escape(label(id))}</label>`).join('');
 }

 function filterMarkup() {
  return `<details class="library-filters" ${dynamic?'open':''}><summary>Filtres ${dynamic?'combinés':'de consultation'}</summary>
   <div class="row" data-library-chips>${chips()}</div>
   <div class="row">${button('Réinitialiser les filtres','reset')}${button('Consulter les chansons','results')}</div>
   <div class="library-filter-grid">${Object.entries(summary.filterFamilies).map(([family,ids])=>
    `<details><summary>${familyNames[family]}</summary>${family==='artists'?`${artistSearch(artistQuery)}
     <div class="library-filter-options" data-library-artists>${artistChoices()}</div>`:
     `<div class="library-filter-options">${optionsList(family,ids)}</div>`}</details>`).join('')}</div></details>`;
 }

 async function loadTracks() {
  if(!root.isConnected)return;
  const current=++generation;
  for(const control of root.querySelectorAll('[data-library="play"],[data-library="save"]'))control.disabled=true;
  try {
   const page=await request('/api/library/tracks?'+params());
   if(current!==generation||!results())return;
   for(const action of ['play','save']){
    const control=root.querySelector(`[data-library="${action}"]`);
    if(control)control.disabled=!page.total||excluded;
   }
   const verified=page.tracks.filter(track=>previews.get(track.id)?.url).length;
   results().innerHTML=`<p><strong>${format.format(page.total)} titre(s)</strong> · ${verified?
    verified+' extrait(s) vérifié(s) sur cette page':'Disponibilité audio à vérifier'}</p>
    ${page.total?'<ul class="music-library-tracks">'+page.tracks.map(track=>`<li>
     <div><strong>${escape(track.title)}</strong>
      ${track.playlists.some(tag=>screenTags.includes(tag))?`<small>Œuvre · ${escape(track.work ? track.work+(track.workUnconfirmed?' (lien à confirmer)':'') : 'Lien à confirmer')}</small>`:''}
      <span>${escape(track.artist)} · ${track.year||'Année inconnue'}</span>
      <small>${escape(track.genres.map(label).join(', ')||'Genre inconnu')} · ${escape(track.origins.map(label).join(', ')||'Origine inconnue')}</small>
      <small>${escape(trackStatus(track))}</small></div>
     <div class="row">${previews.get(track.id)?.url?button('Écouter','listen',track.id):button('Vérifier l’extrait','verify',track.id)}
      ${button(track.excluded?'Réintégrer':'Exclure','exclude',track.id)}</div></li>`).join('')+'</ul>':'<p>Aucun titre ne correspond à cette sélection.</p>'}
    ${pageControls(offset?Math.max(0,offset-30):null,page.next,'page')}`;
   currentTracks=page.tracks;
  }catch(error){if(current===generation&&results())results().textContent=error.message;}
 }
 let currentTracks=[];
 const message=value=>{const node=root.querySelector('[data-library-message]');if(node)node.textContent=value;};

 async function loadSummary() {
  summary=await request('/api/library');
  entries=new Map(summary.categories.flatMap(group=>group.playlists).map(item=>[item.id,item]));
 }

 function refreshFilters() {
  root.querySelector('[data-library-chips]').innerHTML=chips();
  root.querySelectorAll('[data-library="filter"]').forEach(input=>{input.checked=filters[input.dataset.family]?.includes(input.value)||false;});
  offset=0;
  void loadTracks();
 }

 async function verify(track) {
  const p=new URLSearchParams({q:(track.title+' '+track.artist).slice(0,180)});
  const {results:[hits]}=await request('/api/library/previews?'+p);
  if(hits===null)throw Error('Fournisseur audio indisponible.');
  const hit=options.match(hits,track.title,track.artist);
  if(!hit)return {message:'Extrait introuvable'};
  try{
   await options.checkPreview(hit.preview);
   return {message:'Extrait vérifié',url:hit.preview};
  }catch{return {message:'Extrait identifié, lecture indisponible'};}
 }

 root.addEventListener('click',async event=>{
  const target=event.target.closest('button[data-library]');
  if(!target||target.disabled)return;
  const {value,dataset:{library:action}}=target;
  try{
   if(action==='legacy'){root.dispatchEvent(new CustomEvent('legacy-music',{bubbles:true}));return;}
   if(['home','category','playlist','dynamic'].includes(action)){
    generation++;clearTimeout(timer);
    category=action==='category'?value:'';
    playlist=action==='playlist'?value:'';
    dynamic=action==='dynamic';query='';offset=0;categoryPage=0;artistQuery='';letter='';excluded=false;filters={};
    show();return;
   }
   if(action==='category-page'){categoryPage=Number(value);showCategory();return;}
   if(action==='page'){offset=Number(value);await loadTracks();return;}
   if(action==='results'){results().scrollIntoView({block:'start'});return;}
   if(action==='favorite'){
    options.favorite(value);
    if(playlist){
     const active=favorites().includes(value);
     target.textContent=active?'★ Favori':'☆ Favori';
     target.setAttribute('aria-pressed',String(active));
    }
    else showCategory();
    return;
   }
   if(action==='reset'||action==='remove-filter'){
    if(action==='reset')filters={};
    else{const [family,id]=value.split(':');filters[family]=filters[family].filter(tag=>tag!==id);}
    refreshFilters();return;
   }
   if(action==='listen'){
    const player=root.querySelector('[data-library-audio]');
    player.hidden=false;player.src=previews.get(value).url;
    await player.play();return;
   }
   target.disabled=true;
   if(action==='exclude'){
    await request('/api/library/tracks','PATCH',{id:value,excluded:!excluded});
    offset=0;
    options.invalidate();await loadTracks();
   }
   if(action==='verify'){
    const track=currentTracks.find(item=>item.id===value);
    if(track)previews.set(value,await verify(track));
    await loadTracks();
   }
   if(action==='play'||action==='save'){
    let item=entries.get(playlist);
    if(dynamic||Object.values(filters).some(ids=>ids.length)){
     const input=root.querySelector('#dynamic-name');
     const name=input?.value.trim()||Object.values(filters).flatMap(ids=>ids.map(label)).join(' · ').slice(0,80)||'Toutes les musiques';
     if(action==='save'&&!input?.value.trim()){input?.focus();throw Error('Donnez un nom à la playlist.');}
     const selectedFilters=structuredClone(filters);
     if(playlist&&playlist!=='mix'){
      // Preserve the base playlist as a separate intersection, including when a filter uses the same family.
      selectedFilters.base=[playlist];
     }
     const saved=await request('/api/library/playlists','POST',{name,filters:selectedFilters});
     item=saved.playlist;options.invalidate();
     if(action==='save')await loadSummary();
    }
    if(action==='save'){
     if(!favorites().includes(item.id))options.favorite(item.id);
     message('Playlist enregistrée dans les favoris.');
    }else if(item)root.dispatchEvent(new CustomEvent('play-library-selection',{detail:[[item.id,item.name]],bubbles:true}));
   }
  }catch(error){message(error.message);}
  finally{target.disabled=false;}
 });
 root.addEventListener('input',event=>{
  const input=event.target;
  if(input.dataset.library==='search'){
   query=input.value;offset=0;generation++;clearTimeout(timer);timer=setTimeout(loadTracks,150);
  }
  if(input.dataset.library==='artist-search'){
   artistQuery=input.value;categoryPage=0;
   if(category==='artists')showCategory();
   else root.querySelector('[data-library-artists]').innerHTML=artistChoices();
  }
 });
 root.addEventListener('change',event=>{
  const {dataset,value,checked}=event.target;
  if(dataset.library==='choose')options.select(value,checked);
  if(dataset.library==='letter'){
   letter=value;categoryPage=0;
   if(category==='artists')showCategory();
   else root.querySelector('[data-library-artists]').innerHTML=artistChoices();
  }
  if(dataset.library==='filter'){
   const family=dataset.family, prior=filters[family]||[];
   filters[family]=checked?[...prior,value]:prior.filter(id=>id!==value);
   refreshFilters();
  }
  if(dataset.library==='sort'||dataset.library==='excluded'){
   if(dataset.library==='sort')sort=value;
   else excluded=checked;
   offset=0;void loadTracks();
  }
 });
 root.textContent='Chargement de la bibliothèque…';
 void loadSummary().then(show,error=>{root.textContent=error.message;});
}
