import { DurableObject } from "cloudflare:workers";
import { LIBRARY_SEED, LIBRARY_SEED_VERSION } from './library-seed.js';
import { LIBRARY_ARTISTS, LIBRARY_MASTER } from './library-master.js';

const librarySources = {
 fr20261106: 'Official Charts / SNEP, 6–12 novembre 2026',
 cherie: 'Chérie FM, titres diffusés',
 fun2021: 'Fun Radio, titres les plus diffusés en 2021',
 fortboyard: 'Le Monde, portrait de Paul Koulak (2021)'
};

const groups = [
 ['decades','Décennies & années','📀',[
  ...[1960,1970,1980,1990,2000,2010].map(year=>[String(year), 'Années '+(year<2000?String(year).slice(2):year),'📀'])
 ]],
 ['genres','Genres musicaux','🎧',[
  ['disco','Disco & Funk','🪩'],['rapus','Rap US & R&B','🎤'],['rapfr','Rap français','🎙️'],
  ['rock','Rock & Hard Rock','🎸'],['pop','Pop internationale','🌍'],['dance','Dance & Électro','⚡'],['var','Variété française','🎶'],
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
  ['fr','Hits français','🇫🇷'],['intl','Hits internationaux','🌍'],['alltime','Tubes de tous les temps','🏆'],['mix','Mélange général','🔀']
 ]],
 ['artists','Artistes','🎤',LIBRARY_ARTISTS]
];

export function libraryGroups(year = new Date().getUTCFullYear()) {
 return groups.map(([id,name,icon,entries])=>{
  const playlists=entries.map(([id,name,icon])=>({id,name,icon}));
  if(id==='decades'){
   for(let current=2020;current<=year;current++){
    playlists.push({id:String(current),name:'Hits '+current,icon:'📀'});
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
 const existing=LIBRARY_SEED.split('\n').map(line=>{
  const [originalYear,rawArtist,title,tags,work,source]=line.split('|');
  const year=Number(originalYear), artist=rawArtist.trim();
  const id=normalizeLibraryText(artist)+'|'+normalizeLibraryText(title);
  const decade=year>=2020?year:year-year%10;
  const playlists=[...new Set([String(decade),...tags.split(','),'mix'])];
  return {id,title,artist,year,playlists,work:work||null,source:source??null};
 });
 const tracks=new Map(existing.map(track=>[track.id,track]));
 for(const [title,artist,year,playlists,work,source] of LIBRARY_MASTER){
  const id=normalizeLibraryText(artist)+'|'+normalizeLibraryText(title);
  const previous=tracks.get(id);
  tracks.set(id,{id,title,artist,year:year||previous?.year||0,
   playlists:[...new Set([...(previous?.playlists||[]),...playlists])],
   work:work||previous?.work||null,source:source||previous?.source||null});
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

export function libraryRouteParams(url) {
 const playlist=url.searchParams.get('playlist') || 'mix';
 const valid=libraryGroups().some(group=>group.playlists.some(item=>item.id===playlist));
 const offset=Number(url.searchParams.get('offset')||0);
 const query=normalizeLibraryText((url.searchParams.get('q')||'').slice(0,100));
 return valid&&Number.isSafeInteger(offset)&&offset>=0&&offset<=100000
  ? {playlist,offset,query,excluded:url.searchParams.get('excluded')==='1'} : null;
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

 summary() {
  const excluded=this.exclusions();
  const categories=libraryGroups().map(group=>({...group,playlists:group.playlists.map(
   playlist=>({...playlist,references:(tracksByPlaylist.get(playlist.id)||[]).filter(track=>!excluded.has(track.id)).length,playable:0})
  )}));
  return {categories,references:(tracksByPlaylist.get('mix')||[]).filter(track=>!excluded.has(track.id)).length,
   playable:0,import:this.refresh()};
 }

 list({playlist,offset,query,excluded}) {
  const exclusions=this.exclusions();
  const matches=(tracksByPlaylist.get(playlist)||[]).filter(track=>exclusions.has(track.id)===excluded&&track.search.includes(query));
  const tracks=matches.slice(offset,offset+libraryPage).map(({id,title,artist,year,work,source})=>({
   id,title,artist,year:year||null,work,source:librarySources[source]??source??null,
   excluded:Number(excluded),available:false,difficulty:null
  }));
  return {tracks,next:offset+libraryPage<matches.length?offset+libraryPage:null};
 }

 candidates(playlists) {
  const excluded=this.exclusions();
  const unique=new Map();
  for(const playlist of playlists){
   for(const track of tracksByPlaylist.get(playlist)||[]){
    if(!excluded.has(track.id))unique.set(track.id,track);
   }
  }
  return [...unique.values()].map(({id,title,artist,year,work})=>({id,title,artist,year,work}));
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
  return {version:LIBRARY_SEED_VERSION,cursor:seedTracks.length,total:seedTracks.length,finished:true};
 }

 // Alarms scheduled by the old importer can still be delivered after deployment.
 alarm() {}
}
