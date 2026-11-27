import { DurableObject } from "cloudflare:workers";
import { LIBRARY_ARTISTS, LIBRARY_MASTER } from './library-master.js';

const librarySources = {
 fr20261106: 'Official Charts / SNEP, 6–12 novembre 2026',
 cherie: 'Chérie FM, titres diffusés',
 fun2021: 'Fun Radio, titres les plus diffusés en 2021',
 fortboyard: 'Le Monde, portrait de Paul Koulak (2021)'
};

const groups = [
 ['decades','Décennies & années','📀',[]],
 ['genres','Genres musicaux','🎧',[
  ['disco','Disco & Funk','🪩'],['rapus','Rap US & R&B','🎤'],['rapfr','Rap français','🎙️'],
  ['rock','Rock & Hard Rock','🎸'],['pop','Pop','🌍'],['dance','Dance & Électro','⚡'],['var','Variété française','🎶'],
  ['reggae','Reggae','🎵'],['world','Musiques du monde','🌎'],['instrumental','Musiques instrumentales','🎼']
 ]],
 ['screen','Cinéma & Télévision','🎬',[
  ['cartoons','Dessins animés','✏️'],['films','Films','🎬'],['series','Séries TV','📺'],['tv','Génériques TV','🎵'],
  ['shows','Émissions cultes','🎥'],['disney','Disney & Pixar','✨'],['ads','Publicités','📣']
 ]],
 ['party','Ambiance & Fête','🎉',[
  ['karaoke','Karaokés incontournables','🎤'],['party','Tubes de soirée','🪩'],['summer','Tubes de l’été','☀️']
 ]],
 ['themes','Thèmes originaux','🎛️',[
  ['duos','Duos célèbres','🎙️'],['covers','Reprises & Covers','🔁'],['forgotten','Hits oubliés','📻']
 ]],
 ['hits','Grands succès','⭐',[
  ['fr','Hits français','🇫🇷'],['intl','Hits internationaux','🌍'],['alltime','Tubes de tous les temps','🏆'],['mix','Toutes les musiques','🔀']
 ]],
 ['artists','Artistes','🎤',LIBRARY_ARTISTS]
];

const decadeId=decade=>decade<2020?String(decade):'decade-'+decade;

export function libraryGroups(year = new Date().getUTCFullYear()) {
 return groups.map(([id,name,icon,entries])=>{
  const playlists=entries.map(([id,name,icon])=>({id,name,icon}));
  if(id==='decades'){
   for(let decade=1900;decade<=year;decade+=10){
    playlists.push({id:decadeId(decade),name:'Années '+decade,icon:'📀'});
   }
   for(let current=1900;current<=year;current++){
    playlists.push({id:'year-'+current,name:String(current),icon:'📀'});
   }
  }
  return {id,name,icon,playlists};
 });
}

const normalizeLibraryText = value => value.normalize('NFKD')
 .replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();

let seedTracks;
let tracksById;
let tracksByPlaylist;
export function seedLibrary() {
 if(seedTracks)return seedTracks;
 const tracks=new Map();
 for(const [title,artist,year,playlists,work,source] of LIBRARY_MASTER){
  const id=normalizeLibraryText(artist)+'|'+normalizeLibraryText(title);
  const decade=year&&decadeId(year-year%10);
  const tags=playlists.filter(tag=>!year||!/^\d{4}$/.test(tag));
  if(year)tags.push(decade,'year-'+year);
  tracks.set(id,{id,title,artist,year:year||0,playlists:[...new Set(tags)],work,source});
 }
 tracksById=tracks;
 seedTracks=[...tracks.values()].sort((a,b)=>a.title.localeCompare(b.title,'fr')||a.id.localeCompare(b.id,'fr'));
 tracksByPlaylist=new Map();
 for(const track of seedTracks){
  track.search=normalizeLibraryText(track.title+' '+track.artist+' '+(track.work??''));
  for(const playlist of new Set([...track.playlists,'mix'])){
   if(!tracksByPlaylist.has(playlist))tracksByPlaylist.set(playlist,[]);
   tracksByPlaylist.get(playlist).push(track);
  }
 }
 return seedTracks;
}

const filterFamilies={
 origin:['fr','intl'],
 period:libraryGroups()[0].playlists.map(item=>item.id),
 genres:groups.find(group=>group[0]==='genres')[3].map(([id])=>id),
 artists:LIBRARY_ARTISTS.map(([id])=>id),
 themes:groups.filter(([id])=>['screen','party','themes','hits'].includes(id))
  .flatMap(group=>group[3].map(([id])=>id)).filter(id=>!['fr','intl','mix'].includes(id))
};
const validFilters=Object.fromEntries(Object.entries(filterFamilies).map(([key,ids])=>[key,new Set(ids)]));
const familyByPlaylist=new Map(Object.entries(filterFamilies).flatMap(([family,ids])=>ids.map(id=>[id,family])));
const playlistIds=new Set(libraryGroups().flatMap(group=>group.playlists.map(item=>item.id)));
const customId=id=>/^custom-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id);
const legacyYear=id=>/^20[2-9][0-9]$/.test(id)&&playlistIds.has('year-'+id)?'year-'+id:id;
const isPlaylist=id=>playlistIds.has(id)||customId(id);

export function parseLibraryFilters(input) {
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const filters={};
 for(const [family,values] of Object.entries(input)){
  const allowed=family==='base'?{size:1,has:isPlaylist}:validFilters[family];
  if(!allowed||!Array.isArray(values)||values.length>allowed.size||values.some(value=>typeof value!=='string'||!allowed.has(value)))return null;
  if(values.length)filters[family]=[...new Set(values)];
 }
 return filters;
}

export function libraryRouteParams(url) {
 const p=url.searchParams, offset=Number(p.get('offset')||0);
 const filters=parseLibraryFilters(Object.fromEntries(Object.keys(filterFamilies).map(key=>[key,p.getAll(key)])));
 const playlists=p.getAll('playlist').map(legacyYear);
 const sort=p.get('sort')||'title';
 if(!filters||playlists.some(id=>!isPlaylist(id))||!Number.isSafeInteger(offset)||offset<0||offset>100000||
    !['title','artist','year','year-desc'].includes(sort))return null;
 return {playlists,filters,offset,sort,query:normalizeLibraryText((p.get('q')||'').slice(0,100)),
  excluded:p.get('excluded')==='1'};
}

const libraryPage=30;

export class MusicLibrary extends DurableObject {
 constructor(ctx,env) {
  super(ctx,env);
  this.db=ctx.storage.sql;
  seedLibrary();
 }

 exclusions() {
  // Read exclusions from the previous catalogue as well as newly excluded tracks.
  const exists=this.db.exec("SELECT 1 FROM sqlite_master WHERE type='table' AND name='library_track'").toArray().length;
  if(!exists)return new Set();
  return new Set(this.db.exec('SELECT id FROM library_track WHERE excluded=1').toArray().map(row=>row.id));
 }

 savedPlaylists() {
  this.db.exec('CREATE TABLE IF NOT EXISTS library_playlist (id TEXT PRIMARY KEY, name TEXT NOT NULL, filters TEXT NOT NULL)');
  return this.db.exec('SELECT id,name,filters FROM library_playlist ORDER BY name').toArray()
   .map(row=>({...row,filters:JSON.parse(row.filters)}));
 }

 savePlaylist(name,filters) {
  if(typeof name!=='string'||!name.trim()||name.trim().length>80||!parseLibraryFilters(filters))return null;
  const existing=this.savedPlaylists();
  if(filters.base?.some(id=>customId(id)&&!existing.some(item=>item.id===id)))return null;
  const prior=existing.find(item=>item.name===name.trim()&&JSON.stringify(item.filters)===JSON.stringify(filters));
  if(prior)return prior;
  if(existing.length>=100)return null;
  const item={id:'custom-'+crypto.randomUUID(),name:name.trim(),filters};
  this.db.exec('INSERT INTO library_playlist (id,name,filters) VALUES (?,?,?)',item.id,item.name,JSON.stringify(filters));
  return item;
 }

 matches({playlists,filters}) {
  const needsSaved=[...playlists,...(filters.base||[])].some(customId);
  const saved=needsSaved?new Map(this.savedPlaylists().map(item=>[item.id,item.filters])):new Map();
  if([...playlists,...(filters.base||[])].some(id=>customId(id)&&!saved.has(id)))return null;
  const byId=id=>saved.has(id)?byFilters(saved.get(id)):track=>track.playlists.includes(id);
  const byFilters=selection=>{
   const families=Object.values(selection).map(ids=>ids.map(byId));
   return track=>families.every(family=>family.some(match=>match(track)));
  };
  const selectedFamilies=new Map();
  for(const id of playlists){
   if(id==='mix')continue;
   const family=familyByPlaylist.get(id)||id;
   const members=selectedFamilies.get(family)||[];
   members.push(byId(id));
   selectedFamilies.set(family,members);
  }
  const selected=[...selectedFamilies.values()];
  const extra=byFilters(filters);
  return seedTracks.filter(track=>selected.every(family=>family.some(match=>match(track)))&&extra(track));
 }

 summary() {
  const excluded=this.exclusions();
  const categories=libraryGroups().map(group=>({...group,playlists:group.playlists.map(playlist=>({
   ...playlist,references:(tracksByPlaylist.get(playlist.id)||[]).filter(track=>!excluded.has(track.id)).length,
   playable:null
  }))}));
  const saved=this.savedPlaylists();
  if(saved.length)categories.push({id:'custom',name:'Playlists personnalisées',icon:'🎛️',
   playlists:saved.map(item=>({...item,icon:'🎛️',references:this.matches({playlists:[],filters:item.filters})
    .filter(track=>!excluded.has(track.id)).length,playable:null}))});
  return {categories,references:categories.find(group=>group.id==='hits').playlists.find(item=>item.id==='mix').references,
   total:seedTracks.length,playable:null,filterFamilies,import:this.refresh()};
 }

 list(params) {
  const {offset,query,excluded,sort}=params;
  const exclusions=this.exclusions();
  const pool=this.matches(params);
  if(!pool)return null;
  const terms=query.split(' ').filter(Boolean);
  const matches=pool.filter(track=>exclusions.has(track.id)===excluded&&terms.every(term=>track.search.includes(term)));
  if(sort==='artist')matches.sort((a,b)=>a.artist.localeCompare(b.artist,'fr'));
  if(sort.startsWith('year'))matches.sort((a,b)=>Number(!a.year)-Number(!b.year)||
   (sort==='year'?a.year-b.year:b.year-a.year));
  const tracks=matches.slice(offset,offset+libraryPage).map(track=>({...this.describe(track),
   excluded:Number(excluded),available:null,audioStatus:'unknown'}));
  return {tracks,total:matches.length,next:offset+libraryPage<matches.length?offset+libraryPage:null,playable:null};
 }

 describe({id,title,artist,year,work,source,playlists}) {
  return {id,title,artist,year:year||null,work,source:librarySources[source]??source??null,
   genres:playlists.filter(tag=>validFilters.genres.has(tag)),
   origins:playlists.filter(tag=>validFilters.origin.has(tag)),playlists};
 }

 candidates(params) {
  const excluded=this.exclusions();
  return this.matches(params)?.filter(track=>!excluded.has(track.id)).map(track=>this.describe(track))??null;
 }

 setExcluded(id,excluded) {
  const track=tracksById.get(id);
  if(!track)return false;
  if(this.exclusions().has(id)===excluded)return true;
  this.db.exec(`
   CREATE TABLE IF NOT EXISTS library_track (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, artist TEXT NOT NULL,
    year INTEGER NOT NULL, work TEXT, source TEXT, search TEXT NOT NULL, excluded INTEGER NOT NULL DEFAULT 0
   )
  `);
  this.db.exec(`
   INSERT INTO library_track (id,title,artist,year,work,source,search,excluded) VALUES (?,?,?,?,?,?,?,?)
   ON CONFLICT(id) DO UPDATE SET excluded=excluded.excluded
  `,id,track.title,track.artist,track.year,track.work,track.source,track.search,Number(excluded));
  return true;
 }

 refresh() {
  return {version:LIBRARY_REVISION,cursor:seedTracks.length,total:seedTracks.length,finished:true};
 }

 // Alarms scheduled by the old importer can still be delivered after deployment.
 alarm() {}
}
