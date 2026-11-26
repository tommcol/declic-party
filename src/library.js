import { DurableObject } from "cloudflare:workers";
import { LIBRARY_SEED, LIBRARY_SEED_VERSION } from './library-seed.js';

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
  ['rock','Rock & Hard Rock','🎸'],['pop','Pop internationale','🌍'],['dance','Dance & Électro','⚡'],['var','Variété française','🎶']
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
 ]]
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

export function seedLibrary() {
 return LIBRARY_SEED.split('\n').map(line=>{
  const [originalYear,rawArtist,title,tags,work,source]=line.split('|');
  const year=Number(originalYear), artist=rawArtist.trim();
  const id=normalizeLibraryText(artist)+'|'+normalizeLibraryText(title);
  const decade=year>=2020?year:year-year%10;
  const playlists=[...new Set([String(decade),...tags.split(','),'mix'])];
  return {id,title,artist,year,playlists,work:work||null,source:source??null};
 });
}

export function libraryRouteParams(url) {
 const playlist=url.searchParams.get('playlist') || 'mix';
 const valid=libraryGroups().some(group=>group.playlists.some(item=>item.id===playlist));
 const offset=Number(url.searchParams.get('offset')||0);
 const query=normalizeLibraryText((url.searchParams.get('q')||'').slice(0,100));
 return valid&&Number.isSafeInteger(offset)&&offset>=0&&offset<=100000
  ? {playlist,offset,query,excluded:url.searchParams.get('excluded')==='1'} : null;
}

const libraryPAGE = 30;
const libraryBATCH = 25;

export class MusicLibrary extends DurableObject {
 constructor(ctx,env) {
  super(ctx,env);
  this.db=ctx.storage.sql;
  this.db.exec(`
   CREATE TABLE IF NOT EXISTS library_track (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, artist TEXT NOT NULL,
    year INTEGER NOT NULL, work TEXT, source TEXT, search TEXT NOT NULL, excluded INTEGER NOT NULL DEFAULT 0
   );
   CREATE TABLE IF NOT EXISTS library_membership (
    playlist TEXT NOT NULL, track TEXT NOT NULL REFERENCES library_track(id),
    PRIMARY KEY (playlist, track)
   );
   CREATE INDEX IF NOT EXISTS library_membership_track ON library_membership(track);
   CREATE INDEX IF NOT EXISTS library_track_order ON library_track(title COLLATE NOCASE, id);
   CREATE TABLE IF NOT EXISTS library_import (
    only_row INTEGER PRIMARY KEY CHECK (only_row=1), version INTEGER NOT NULL,
    cursor INTEGER NOT NULL, total INTEGER NOT NULL, finished TEXT
   );
  `);
 }

 progress() {
  return this.db.exec('SELECT version, cursor, total, finished FROM library_import WHERE only_row=1')
   .toArray()[0]??null;
 }

 async summary() {
  if(this.progress()?.version!==LIBRARY_SEED_VERSION)await this.refresh();
  const counts=Object.fromEntries(this.db.exec(`
   SELECT playlist, COUNT(*) AS total FROM library_membership
   JOIN library_track ON track=id WHERE excluded=0 GROUP BY playlist
  `).toArray().map(row=>[row.playlist,row.total]));
  const categories=libraryGroups().map(group=>({...group,playlists:group.playlists.map(
   playlist=>({...playlist,references:counts[playlist.id]??0,playable:0})
  )}));
  return {categories,references:counts.mix??0,playable:0,import:this.progress()};
 }

 list({playlist,offset,query,excluded}) {
  const rows=this.db.exec(`
   SELECT id,title,artist,year,work,source,excluded FROM library_membership
   JOIN library_track ON track=id
   WHERE playlist=? AND excluded=? AND search LIKE ?
   ORDER BY title COLLATE NOCASE,id LIMIT ? OFFSET ?
  `,playlist,Number(excluded),'%'+query+'%',libraryPAGE+1,offset).toArray();
  return {tracks:rows.slice(0,libraryPAGE).map(row=>({...row,source:librarySources[row.source]??null,available:false,difficulty:null})),
   next:rows.length>libraryPAGE?offset+libraryPAGE:null};
 }

 setExcluded(id,excluded) {
  return this.db.exec('UPDATE library_track SET excluded=? WHERE id=? RETURNING id',
   Number(excluded),id).toArray().length>0;
 }

 async refresh(force=false) {
  const state=this.progress();
  if(!state||state.version!==LIBRARY_SEED_VERSION||force&&state.finished){
   const seeds=seedLibrary();
   this.db.exec(`
    INSERT INTO library_import VALUES (1,?,0,?,NULL)
    ON CONFLICT(only_row) DO UPDATE SET version=excluded.version,
    cursor=0,total=excluded.total,finished=NULL
   `,LIBRARY_SEED_VERSION,seeds.length);
  }
  if(!this.progress().finished){
   // A pending alarm also makes a first visit recoverable if the request disconnects.
   await this.ctx.storage.setAlarm(Date.now()+1000);
  }
  return this.progress();
 }

 async alarm() {
  const state=this.progress();
  if(!state||state.finished)return;
  const end=Math.min(state.cursor+libraryBATCH,state.total);
  if(end<state.total)await this.ctx.storage.setAlarm(Date.now()+1000);
  // Commit the batch and its cursor together. Replays preserve exclusions.
  this.ctx.storage.transactionSync(()=>{
   for(const track of seedLibrary().slice(state.cursor,end)){
    this.db.exec(`
     INSERT INTO library_track (id,title,artist,year,work,source,search) VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET title=excluded.title,artist=excluded.artist,
     year=excluded.year,work=excluded.work,source=excluded.source,search=excluded.search
    `,track.id,track.title,track.artist,track.year,track.work,track.source,
    normalizeLibraryText(track.title+' '+track.artist+' '+(track.work??'')));
    this.db.exec('DELETE FROM library_membership WHERE track=?',track.id);
    for(const playlist of track.playlists){
     this.db.exec('INSERT INTO library_membership VALUES (?,?)',playlist,track.id);
    }
   }
   this.db.exec('UPDATE library_import SET cursor=?,finished=? WHERE only_row=1',
    end,end===state.total?new Date().toISOString():null);
  });
 }
}
