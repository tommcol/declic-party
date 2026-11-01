const THEMES={
 fr:{name:'Variété française',emoji:'🇫🇷',queries:['artist:"Jean-Jacques Goldman"','artist:"France Gall"','artist:"Céline Dion"','artist:"Stromae"']},
 pop:{name:'Pop & rock',emoji:'🎸',queries:['artist:"Queen"','artist:"Coldplay"','artist:"Michael Jackson"','artist:"ABBA"']},
 dance:{name:'Disco & dance',emoji:'🪩',queries:['artist:"Daft Punk"','artist:"Earth, Wind & Fire"','artist:"Dua Lipa"','artist:"Kool & The Gang"']},
 rap:{name:'Rap français',emoji:'🎤',queries:['artist:"MC Solaar"','artist:"IAM"','artist:"Orelsan"','artist:"Soprano"']},
 eighties:{name:'Les années 80',emoji:'📼',queries:['artist:"Indochine" track:"L’aventurier"','artist:"Jean-Jacques Goldman" track:"Quand la musique est bonne"','artist:"Michael Jackson" track:"Billie Jean"','artist:"a-ha" track:"Take On Me"','artist:"Eurythmics" track:"Sweet Dreams"','artist:"Europe" track:"The Final Countdown"','artist:"Vanessa Paradis" track:"Joe le taxi"','artist:"France Gall" track:"Ella, elle l’a"']},
 family:{name:'En famille',emoji:'🌈',queries:['artist:"Henri Dès"','artist:"Aldebert"','artist:"Kids United"','artist:"Le Roi Lion"']}
};
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const catalogError=()=>reply({error:'Le catalogue Deezer est momentanément indisponible. Vos questions et fichiers personnels restent disponibles.'},502);
async function deezer(path,params={}){
 const url=new URL('https://api.deezer.com'+path);for(const [k,v]of Object.entries(params))url.searchParams.set(k,String(v));
 const key=new Request(url),cache=caches.default;let response=await cache.match(key);
 if(!response){response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Catalogue indisponible');if(!response.headers.get('content-type')?.includes('json'))throw Error('Réponse non JSON');const raw=await boundedProviderBody(response,600000);const data=JSON.parse(raw);if(data.error)throw Error('Deezer '+String(data.error.type||'API')+': '+String(data.error.message||'indisponible').slice(0,140));await cache.put(key,new Response(raw,{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=300'}}));return data;}
 return response.json();
}
async function boundedProviderBody(response,max){const reader=response.body.getReader();let size=0;const chunks=[];try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw Error('Réponse trop grande');}chunks.push(value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(size);let at=0;for(const b of chunks){bytes.set(b,at);at+=b.byteLength;}return new TextDecoder().decode(bytes);}
function track(t){if(!t?.id||!t.preview||!t.artist?.name)return null;let preview;try{preview=new URL(t.preview);}catch{return null;}if(preview.protocol!=='https:'||!preview.hostname.endsWith('.dzcdn.net'))return null;return {id:String(t.id),title:String(t.title||'').slice(0,180),artist:String(t.artist.name).slice(0,180),artwork:t.album?.cover_medium||t.album?.cover_big||null,link:t.link||`https://www.deezer.com/track/${t.id}`,preview:'/api/music/preview/'+t.id,rank:Number(t.rank)||0,explicit:!!t.explicit_lyrics,provider:'Deezer'};}
const catalogKey=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function uniqueTracks(ts){const seen=new Set();return ts.filter(t=>{if(!t)return false;const key=(t.artist+' '+t.title.replace(/\s*[-(].*$/,'')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});}
export async function musicRoute(req){const url=new URL(req.url),path=url.pathname;
 try{
  if(path==='/api/music/themes')return reply({themes:Object.entries(THEMES).map(([id,t])=>({id,name:t.name,emoji:t.emoji}))});
  if(path==='/api/music/search'){
   const q=(url.searchParams.get('q')||'').trim().slice(0,120);if(q.length<2)return reply({tracks:[],playlists:[]});
   if(url.searchParams.get('type')==='playlists'){const d=await deezer('/search/playlist',{q,limit:12});return reply({playlists:(d.data||[]).map(p=>({id:String(p.id),title:p.title,artwork:p.picture_medium,author:p.user?.name,tracks:p.nb_tracks}))});}
   const d=await deezer('/search',{q,limit:40});return reply({tracks:uniqueTracks((d.data||[]).map(track))});
  }
  if(path==='/api/music/playlist'){
   const id=url.searchParams.get('id')||'';if(!/^\d{1,20}$/.test(id))return reply({error:'Lien Deezer invalide. Utilisez une playlist publique.'},400);
   const [info,data]=await Promise.all([deezer('/playlist/'+id),deezer('/playlist/'+id+'/tracks',{limit:100})]);return reply({name:info.title,tracks:uniqueTracks((data.data||[]).map(track)),total:data.total,limited:Number(data.total)>100});
  }
  if(path==='/api/music/selection'){
   const ids=(url.searchParams.get('themes')||'fr').split(',').filter(id=>THEMES[id]).slice(0,3);if(!ids.length)return reply({error:'Choisissez un thème.'},400);
   const queries=[...new Set(ids.flatMap(id=>THEMES[id].queries))];let tracks=[];
   for(let i=0;i<queries.length;i+=3){const batch=await Promise.allSettled(queries.slice(i,i+3).map(q=>deezer('/search',{q:q.replace(/artist:|track:/g,'').replaceAll('\"',''),limit:25})));for(let j=0;j<batch.length;j++){const r=batch[j];if(r.status==='fulfilled'){const query=queries[i+j],wantedArtist=query.match(/artist:"([^"]+)"/)?.[1],wantedTitle=query.match(/track:"([^"]+)"/)?.[1];const list=(r.value.data||[]).map(track).filter(t=>t&&(!wantedArtist||catalogKey(t.artist)===catalogKey(wantedArtist))&&(!wantedTitle||catalogKey(t.title).includes(catalogKey(wantedTitle))));tracks.push(...(ids.length===1&&ids[0]==='eighties'?list.slice(0,1):list));}}}
   tracks=uniqueTracks(tracks);if(!tracks.length)return catalogError();return reply({name:ids.map(id=>THEMES[id].name).join(' + '),tracks});
  }
  const preview=path.match(/^\/api\/music\/preview\/(\d{1,20})$/);
  if(preview){const t=await deezer('/track/'+preview[1]);const mapped=track(t);if(!mapped)return reply({error:'Cet extrait n’est plus disponible.'},404);let target=new URL(t.preview),remote;for(let hop=0;hop<4;hop++){if(target.protocol!=='https:'||!target.hostname.endsWith('.dzcdn.net'))throw Error('Redirection audio non reconnue');remote=await fetch(target,{signal:AbortSignal.timeout(15000),redirect:'manual'});if(remote.status<300||remote.status>=400)break;const location=remote.headers.get('Location');if(!location)throw Error('Redirection audio incomplète');target=new URL(location,target);}if(remote.status>=300&&remote.status<400)throw Error('Trop de redirections audio');if(!remote.ok)throw Error('CDN audio HTTP '+remote.status);return new Response(remote.body,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
  return reply({error:'Route musicale inconnue'},404);
 }catch(e){console.warn(JSON.stringify({event:'catalog_unavailable',message:e.message}));return reply({error:'Le catalogue Deezer est momentanément indisponible. Vos questions et fichiers personnels restent disponibles.'},502);}
}
