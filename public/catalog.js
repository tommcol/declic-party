import {normalize} from './engine.js';
export const THEMES=[['fr','🇫🇷','Variété française','Des classiques aux refrains récents'],['pop','🎸','Pop & rock','Les voix et les riffs incontournables'],['dance','🪩','Disco & dance','De quoi faire danser la salle'],['rap','🎤','Rap français','Flow, refrains et générations'],['eighties','📼','Les années 80','Une sélection de titres de cette décennie'],['family','🌈','En famille','Petits et grands dans la même équipe']];
export const CHALLENGES=[['title','🎵','Le titre'],['artist','🎤','L’artiste'],['both','⚡','Titre + artiste'],['cover','🖼️','Pochette mystère'],['artistTitle','💿','Parmi ses titres'],['mix','🎲','Surprise !']];
export function shuffle(values){const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export const cleanTitle=s=>String(s).replace(/\s*\((?:.*?remaster.*?|.*?version.*?|.*?edition.*?)\)\s*/gi,' ').replace(/\s*-\s*(?:remaster|radio edit).*$/i,'').trim();
export function musicQuestions(tracks,config){
 let pool=tracks.filter(t=>t.id&&t.title&&t.artist&&t.preview&&(config.explicit!==false||!t.explicit));const seen=new Set();pool=pool.filter(t=>{const k=normalize(t.artist+cleanTitle(t.title));if(seen.has(k))return false;seen.add(k);return true;});
 if(config.difficulty==='easy')pool.sort((a,b)=>(b.rank||0)-(a.rank||0));else if(config.difficulty==='hard')pool.sort((a,b)=>(a.rank||0)-(b.rank||0));else pool=shuffle(pool);
 const count=Number(config.count)||10;const chosen=shuffle(pool.slice(0,config.difficulty==='balanced'?pool.length:Math.max(count,Math.ceil(pool.length/2)))).slice(0,count),out=[];
 for(const [index,t] of chosen.entries()){
  let target=config.challenge||'title';if(target==='mix'){const variants=['title','artist','cover'];if(config.mode==='usb'||config.input==='text')variants.push('both');target=variants[index%variants.length];}
  if(target==='both'&&config.mode==='phone'&&config.input==='qcm')target='title';
  const peers=pool.filter(v=>normalize(v.artist)===normalize(t.artist));if(target==='artistTitle'&&new Set(peers.map(v=>normalize(cleanTitle(v.title)))).size<4)continue;
  if(target==='cover'&&!t.artwork)continue;
  const title=cleanTitle(t.title),artist=t.artist,artistTarget=['artist','cover'].includes(target),answer=artistTarget?artist:title;
  const source=artistTarget?pool.map(v=>v.artist):(target==='artistTitle'?peers:pool).map(v=>cleanTitle(v.title));
  const alternatives=[...new Map(source.filter(v=>normalize(v)!==normalize(answer)).map(v=>[normalize(v),v])).values()];
  const fallback=artistTarget?['Queen','Stromae','ABBA','Michael Jackson','Céline Dion','Daft Punk']:['La Vie en rose','Billie Jean','Dancing Queen','Get Lucky','Imagine'];
  const candidates=target==='artistTitle'?alternatives:[...alternatives,...fallback];const wrong=shuffle([...new Map(candidates.filter(v=>normalize(v)!==normalize(answer)).map(v=>[normalize(v),v])).values()]).slice(0,3);if(wrong.length<3)continue;
  const prompts={title:'Quel est le titre de cet extrait ?',artist:'Qui interprète cet extrait ?',both:'Retrouvez le titre et l’artiste.',cover:'À quel artiste appartient cette pochette ?',artistTitle:'Quel titre de cet artiste écoutez-vous ?'};
  out.push({id:crypto.randomUUID(),universe:'music',kind:'audio',target,prompt:prompts[target],title,artist,titleAliases:[t.title],artistAliases:artist.split(/,| & | feat\.? /i).map(v=>v.trim()).filter(Boolean),answer,options:shuffle([answer,...wrong]),duration:Math.min(30,Number(config.duration)||30),points:100,artwork:t.artwork,audioUrl:t.preview,provider:'Deezer',link:t.link});
 }
 return out;
}
