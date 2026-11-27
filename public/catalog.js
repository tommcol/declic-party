import {normalize,randomUUID} from './engine.js';
export const THEMES=[['fr','🇫🇷','Variété française','Des classiques aux refrains récents'],['pop','🎸','Pop & rock','Les voix et les riffs incontournables'],['dance','🪩','Disco & dance','De quoi faire danser la salle'],['rap','🎤','Rap français','Flow, refrains et générations'],['eighties','📼','Les années 80','Une sélection de titres de cette décennie'],['family','🌈','En famille','Petits et grands dans la même équipe']];
export const CHALLENGES=[['title','🎵','Le titre'],['artist','🎤','L’artiste'],['both','⚡','Titre + artiste'],['cover','🖼️','Pochette mystère'],['artistTitle','💿','Parmi ses titres'],['mix','🎲','Surprise !']];
export function shuffle(values){const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export const cleanTitle=s=>String(s).replace(/\s*\((?:.*?remaster.*?|.*?version.*?|.*?edition.*?)\)\s*/gi,' ').replace(/\s*-\s*(?:remaster|radio edit).*$/i,'').trim();
// The year belongs to the recording listed here, not to a later reissue.
export const SPECIAL_TRACKS={
 timeline:[
  ['I Want to Hold Your Hand','The Beatles',1963],['Respect','Aretha Franklin',1967],
  ['Bohemian Rhapsody','Queen',1975],['Dancing Queen','ABBA',1976],
  ['Billie Jean','Michael Jackson',1982],['Take On Me','a-ha',1985],
  ['Smells Like Teen Spirit','Nirvana',1991],['Wannabe','Spice Girls',1996],
  ['Crazy in Love','Beyoncé',2003],['Umbrella','Rihanna',2007],
  ['Rolling in the Deep','Adele',2010],['Get Lucky','Daft Punk',2013],
  ['Shape of You','Ed Sheeran',2017],['Blinding Lights','The Weeknd',2019],
  ['Flowers','Miley Cyrus',2023]
 ],
 coversQuiz:[
  ['Hallelujah','Jeff Buckley','Leonard Cohen'],['I Will Always Love You','Whitney Houston','Dolly Parton'],
  ['Nothing Compares 2 U','Sinéad O’Connor','The Family'],['Girls Just Want to Have Fun','Cyndi Lauper','Robert Hazard'],
  ['Tainted Love','Soft Cell','Gloria Jones'],['I Love Rock ’n’ Roll','Joan Jett & The Blackhearts','The Arrows'],
  ['The Man Who Sold the World','Nirvana','David Bowie'],['Valerie','Mark Ronson','The Zutons'],
  ['Respect','Aretha Franklin','Otis Redding'],['Killing Me Softly With His Song','Fugees','Lori Lieberman'],
  ['Twist and Shout','The Beatles','The Top Notes'],['All Along the Watchtower','Jimi Hendrix','Bob Dylan']
 ],
 tvThemes:[
  ['I’ll Be There for You','The Rembrandts','Friends'],
  ['Game of Thrones','Ramin Djawadi','Game of Thrones'],
  ['Stranger Things','Kyle Dixon','Stranger Things'],
  ['Pokémon Theme','Jason Paige','Pokémon','Pokémon Theme-New Studio Recording'],
  ['The Simpsons Theme','Danny Elfman','Les Simpson','"The Simpsons" Main Title Theme'],
  ['The X-Files Theme','Mark Snow','X-Files','Materia Primoris: The X-Files Theme (Main Title)'],
  ['Where Everybody Knows Your Name','Gary Portnoy','Cheers'],
  ['The Fresh Prince of Bel-Air','DJ Jazzy Jeff & The Fresh Prince','Le Prince de Bel-Air'],
  ['I Don’t Want to Wait','Paula Cole','Dawson'],
  ['California','Phantom Planet','Newport Beach'],
  ['Teardrop','Massive Attack','Dr House'],
  ['Boss of Me','They Might Be Giants','Malcolm'],
  ['Love and Marriage','Frank Sinatra','Mariés, deux enfants'],
  ['Goldorak','Noam','Goldorak','Goldorak (Générique original de la série TV)'],
  ['Capitaine Flam','Richard Simon','Capitaine Flam','Capitaine Flam: La chevauchée du Capitaine Flam'],
  ['Boogie Body','Rock the Factory','C’est pas sorcier']
 ],
 soundtrack:[
  ['My Heart Will Go On','Céline Dion','Titanic'],['Eye of the Tiger','Survivor','Rocky III'],
  ['Ghostbusters','Ray Parker Jr.','SOS Fantômes'],['Footloose','Kenny Loggins','Footloose'],
  ['A Thousand Miles','Vanessa Carlton','FBI : Fausses blondes infiltrées'],
  ['You’ve Got a Friend in Me','Randy Newman','Toy Story'],
  ['I’ll Be There for You','The Rembrandts','Friends'],
  ['Game of Thrones','Ramin Djawadi','Game of Thrones'],
  ['Stranger Things','Kyle Dixon','Stranger Things'],
  ['Shallow','Lady Gaga','A Star Is Born'],
  ['Happy','Pharrell Williams','Moi, moche et méchant 2'],
  ['(I’ve Had) The Time of My Life','Bill Medley','Dirty Dancing']
 ]
};
export function matchSpecialTrack(tracks,title,artist,alternateTitle){
 const titles=[title,alternateTitle].filter(Boolean).map(normalize);
 const artistKey=normalize(artist);
 return tracks.find(t=>t.preview&&titles.includes(normalize(cleanTitle(t.title)))&&normalize(t.artist).startsWith(artistKey));
}
export function specialQuestions(mode,entries,config){
 const soundtrack=['soundtrack','tvThemes','allSoundtracks'].includes(mode);
 const sources=mode==='allSoundtracks'?[...SPECIAL_TRACKS.soundtrack,...SPECIAL_TRACKS.tvThemes]:SPECIAL_TRACKS[mode];
 const choiceIndex=mode==='coversQuiz'&&config.coversDirection==='original'?1:2;
 const values=[...new Set([...sources.map(entry=>entry[choiceIndex]),...entries.map(item=>item.entry[2])])];
 const out=[];
 for(const {track,entry} of shuffle(entries)){
  const [title,artist,value]=entry;
  let prompt,answer,options,timeline;
  if(mode==='timeline'){
   const anchors=shuffle(SPECIAL_TRACKS.timeline.filter(row=>row!==entry)).slice(0,3).sort((a,b)=>a[2]-b[2]);
   timeline=anchors.map(row=>row[0]+' · '+row[2]);
   options=['A','B','C','D'];
   answer=options[anchors.filter(row=>row[2]<value).length];
   prompt='Où placer « '+title+' » sur la frise ?';
  }else{
   answer=value;
   const choiceCount=soundtrack?Math.min(5,Math.max(2,Number(config.soundtrackChoices)||4)):4;
   options=shuffle([answer,...shuffle(values.filter(v=>v!==answer)).slice(0,choiceCount-1)]);
   prompt=mode==='coversQuiz'?(config.coversDirection==='original'?'Qui a interprété la reprise ?':'Qui a interprété la version originale ?'):'À quel film, série, dessin animé ou émission appartient cette musique ?';
  }
  if(mode==='tvThemes')prompt='À quelle série, émission ou dessin animé appartient ce générique ?';
  out.push({id:randomUUID(),universe:soundtrack?'film':'music',kind:'audio',
   target:soundtrack?'soundtrack':mode,prompt,answer,options,timeline,title,artist,year:mode==='timeline'?value:undefined,
   explanation:mode==='timeline'?title+' — '+artist+' ('+value+').':title+' — '+artist+'.',
   audioUrl:track.preview,duration:config.duration,points:100,provider:'Deezer',link:track.link});
 }
 return out.slice(0,config.count);
}
export function musicQuestions(tracks,config){
 let pool=tracks.filter(t=>t.id&&t.title&&t.artist&&t.preview&&(config.explicit!==false||!t.explicit));const seen=new Set();pool=pool.filter(t=>{const k=normalize(t.artist+cleanTitle(t.title));if(seen.has(k))return false;seen.add(k);return true;});
 if(config.difficulty==='easy')pool.sort((a,b)=>(b.rank||0)-(a.rank||0));else if(config.difficulty==='hard')pool.sort((a,b)=>(a.rank||0)-(b.rank||0));else pool=shuffle(pool);
 if(config.musicGame==='bingo'){
  const labels=new Set();
  pool=shuffle(pool).filter(track=>{
   const label=normalize(config.challenge==='artist'?track.artist:cleanTitle(track.title));
   if(labels.has(label))return false;
   labels.add(label);
   return true;
  });
 }
 if(config.challenge==='coverChoice'){
  pool=pool.filter(t=>t.artwork);
  const covers=[...new Set(pool.map(t=>t.artwork))];
  if(covers.length<4)return [];
 }
 const count=Number(config.count)||10;const chosen=shuffle(pool.slice(0,config.difficulty==='balanced'?pool.length:Math.max(count,Math.ceil(pool.length/2)))).slice(0,count),out=[];
 for(const [index,t] of chosen.entries()){
  let target=config.challenge||'title';if(target==='mix'){const variants=['title','artist','cover'];if(config.mode==='usb'||config.input==='text')variants.push('both');target=variants[index%variants.length];}
  if(target==='both'&&config.mode==='phone'&&config.input==='qcm')target='title';
  if(target==='coverChoice'){
   const distractors=shuffle([...new Set(pool.map(v=>v.artwork))].filter(url=>url!==t.artwork)).slice(0,3);
   const optionArtwork=shuffle([t.artwork,...distractors]);
   const options=['A','B','C','D'];
   out.push({id:randomUUID(),trackId:t.id,universe:'music',kind:'audio',target,
    prompt:'Quelle pochette correspond à cet extrait ?',title:cleanTitle(t.title),artist:t.artist,
    answer:options[optionArtwork.indexOf(t.artwork)],options,optionArtwork,
    duration:Math.min(30,Number(config.duration)||30),points:100,artwork:t.artwork,
    audioUrl:t.preview,provider:'Deezer',link:t.link});
   continue;
  }
  const peers=pool.filter(v=>normalize(v.artist)===normalize(t.artist));if(target==='artistTitle'&&new Set(peers.map(v=>normalize(cleanTitle(v.title)))).size<4)continue;
  if(target==='cover'&&!t.artwork)continue;
  const title=cleanTitle(t.title),artist=t.artist,artistTarget=['artist','cover'].includes(target),answer=artistTarget?artist:title;
  const source=artistTarget?pool.map(v=>v.artist):(target==='artistTitle'?peers:pool).map(v=>cleanTitle(v.title));
  const alternatives=[...new Map(source.filter(v=>normalize(v)!==normalize(answer)).map(v=>[normalize(v),v])).values()];
  const fallback=artistTarget?['Queen','Stromae','ABBA','Michael Jackson','Céline Dion','Daft Punk']:['La Vie en rose','Billie Jean','Dancing Queen','Get Lucky','Imagine'];
  const candidates=target==='artistTitle'?alternatives:[...alternatives,...fallback];const wrong=shuffle([...new Map(candidates.filter(v=>normalize(v)!==normalize(answer)).map(v=>[normalize(v),v])).values()]).slice(0,3);if(wrong.length<3)continue;
  const prompts={title:'Quel est le titre de cet extrait ?',artist:'Qui interprète cet extrait ?',both:'Retrouvez le titre et l’artiste.',cover:'À quel artiste appartient cette pochette ?',artistTitle:'Quel titre de cet artiste écoutez-vous ?'};
  out.push({id:randomUUID(),trackId:t.id,universe:'music',kind:'audio',target,prompt:prompts[target],title,artist,titleAliases:[t.title],artistAliases:artist.split(/,| & | feat\.? /i).map(v=>v.trim()).filter(Boolean),answer,options:shuffle([answer,...wrong]),duration:Math.min(30,Number(config.duration)||30),points:100,artwork:t.artwork,audioUrl:t.preview,provider:'Deezer',link:t.link});
 }
 return out;
}
