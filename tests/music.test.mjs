import {test} from 'node:test';import assert from 'node:assert/strict';
import {createGame,applyAction,publicGame,matches} from '../public/engine.js';
import {musicQuestions,SPECIAL_TRACKS,specialQuestions,matchSpecialTrack} from '../public/catalog.js';
const q={id:'song',universe:'music',kind:'audio',title:'Get Lucky',artist:'Daft Punk',artistAliases:['Daft Punk'],answer:'Get Lucky',target:'both',options:['Get Lucky','Imagine','Billie Jean','Dancing Queen'],duration:30,points:100};
const start=(mode='usb',settings={})=>applyAction(createGame([q],[{id:'a',name:'A'},{id:'b',name:'B'}],mode,'text',{speed:false,streak:false,...settings}),{type:'play'},0);
test('Titre puis artiste peuvent être trouvés par deux équipes, sans double attribution',()=>{let s=start();s=applyAction(s,{type:'buzz',team:'a'},5000);s=applyAction(s,{type:'judge',correct:true,part:'title'},5100);assert.equal(s.phase,'playing');assert.equal(s.pending.a,50);s=applyAction(s,{type:'buzz',team:'b'},6000);const invalid=applyAction(s,{type:'judge',correct:true,part:'title'},6100);assert.equal(invalid,s);s=applyAction(s,{type:'judge',correct:true,part:'artist'},6200);assert.equal(s.phase,'reveal');assert.equal(s.teams[0].score,50);assert.equal(s.teams[1].score,50);assert.equal(s.history.length,1);});
test('Reprise manuelle conserve le délai, une pause ne peut pas expirer',()=>{let s=start('usb',{resume:'manual'});s=applyAction(s,{type:'buzz',team:'a'},5000);const left=s.remaining;s=applyAction(s,{type:'judge',correct:false},10000);assert.equal(s.phase,'paused');assert.equal(applyAction(s,{type:'timeout'},999999),s);s=applyAction(s,{type:'resume'},50000);assert.equal(s.endAt,50000+left);});
test('Rebuzz différé bloque trois secondes puis autorise le même joueur',()=>{let s=start('usb',{rebuzz:'3'});s=applyAction(s,{type:'buzz',team:'a'},5000);s=applyAction(s,{type:'judge',correct:false},5100);assert.equal(applyAction(s,{type:'buzz',team:'a'},8099),s);s=applyAction(s,{type:'buzz',team:'a'},8100);assert.equal(s.buzz,'a');});
test('Réponses écrites indépendantes, petites fautes et soumissions répétées sans doublons',()=>{let s=start('phone');s=applyAction(s,{type:'answer',team:'a',artist:'daft pun'},5000);assert.deepEqual(s.answers.a.parts,['artist']);assert.equal(s.pending.a,50);s=applyAction(s,{type:'answer',team:'a',title:'getlucky',artist:'Daft Punk'},6000);assert.equal(s.pending.a,100);assert.equal(applyAction(s,{type:'answer',team:'a',title:'Get Lucky'},6500),s);s=applyAction(s,{type:'reveal'},7000);assert.equal(s.teams[0].score,100);});
test('Les fautes trop larges et réponses très courtes ne passent pas',()=>{assert.equal(matches('AB','ABBA'),false);assert.equal(matches('daftpunk','Daft Punk'),true);assert.equal(matches('daft pun','Daft Punk'),true);assert.equal(matches('Queen','Daft Punk'),false);});
test('Une réponse arrivée avec un ancien identifiant de manche est ignorée',()=>{const s=start('phone');assert.equal(applyAction(s,{type:'answer',team:'a',questionId:'old',artist:'Daft Punk'},5000),s);});
test('Une équipe ne voit que son propre résultat partiel avant révélation',()=>{let s=start('phone');s=applyAction(s,{type:'answer',team:'a',artist:'Daft Punk'},5000);const p=publicGame(s,'b');assert.equal(p.me,undefined);assert.ok(!JSON.stringify(p).includes('Get Lucky'));assert.ok(!JSON.stringify(p).includes('Daft Punk'));assert.equal(p.question.musical,true);assert.equal(p.teams[0].score,0);assert.deepEqual(publicGame(s,'a').me.parts,['artist']);});
test('Le bilan ne contient que les manches révélées et ne duplique pas les points',()=>{let s=start('phone');assert.equal(s.history.length,0);s=applyAction(s,{type:'answer',team:'a',title:'Get Lucky'},5000);s=applyAction(s,{type:'reveal'},6000);const once=s.teams[0].score;s=applyAction(s,{type:'reveal'},6100);assert.equal(s.history.length,1);assert.equal(s.teams[0].score,once);assert.equal(s.history[0].results[0].result.breakdown.title,50);});
test('Les bonus sont attribués une fois et une bonne manche incrémente la série',()=>{let s=start('phone',{speed:true,streak:true});s.teams[0].streak=2;s=applyAction(s,{type:'answer',team:'a',artist:'Daft Punk'},6000);const first=s.pending.a;s=applyAction(s,{type:'answer',team:'a',title:'Get Lucky'},7000);assert.equal(s.pending.a,first+50);s=applyAction(s,{type:'reveal'},8000);assert.equal(s.teams[0].streak,3);assert.equal(s.answers.a.breakdown.streak,20);assert.ok(s.answers.a.breakdown.speed<=50);});
test('Génération de QCM : bons artistes, quatre choix uniques, titre du même artiste',()=>{const tracks=Array.from({length:7},(_,i)=>({id:String(i),title:'Titre '+i,artist:i<5?'Artiste A':'Artiste B',preview:'/api/music/preview/'+(i+1),link:'https://www.deezer.com/track/1',artwork:'https://cdns-images.dzcdn.net/images/a.jpg'}));for(const challenge of ['artist','title','cover','artistTitle']){const qs=musicQuestions(tracks,{challenge,count:5,duration:30,mode:'phone',input:'qcm'});assert.ok(qs.length);for(const q of qs){assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.options.includes(q.answer));if(challenge==='artistTitle'){assert.equal(q.artist,'Artiste A');assert.ok(q.options.every(o=>/^Titre [0-4]$/.test(o)));}}}});

test('La bonne pochette : quatre albums, choix anonymes et correction de la lettre',()=>{
 const tracks=Array.from({length:5},(_,i)=>({
  id:String(i),title:'Titre '+i,artist:'Artiste '+i,preview:'/preview/'+i,
  artwork:'https://example.dzcdn.net/'+Math.min(i,3)
 }));
 const config={challenge:'coverChoice',difficulty:'balanced'};
 assert.deepEqual(musicQuestions(tracks.slice(0,3),config),[]);
 const [q]=musicQuestions(tracks,config);
 assert.equal(new Set(q.optionArtwork).size,4);
 assert.equal(q.optionArtwork[q.options.indexOf(q.answer)],q.artwork);
 let s=createGame([q],[{id:'a',name:'Alpha'}],'phone','qcm',{speed:false,streak:false});
 s.effect='image';
 s=applyAction(s,{type:'play'},1000);
 const visible=publicGame(s,'a').question;
 assert.deepEqual(visible.optionArtwork,q.optionArtwork);
 assert.equal(visible.artwork,undefined);
 assert.equal(visible.answer,undefined);
 assert.equal(visible.title,undefined);
 s=applyAction(s,{type:'answer',team:'a',answer:q.answer},5000);
 assert.equal(s.answers.a.total,100);
});

test('Jeux spécialisés : contrôle de l’interprète, réponse cachée et correction QCM',()=>{
 for(const mode of ['timeline','coversQuiz','soundtrack','tvThemes']){
  const entry=SPECIAL_TRACKS[mode][0];
  const [title,artist,value]=entry;
  const track={title,artist,preview:'/preview/123'};
  assert.equal(matchSpecialTrack([{...track,artist:'Autre interprète'},track],title,artist),track);
  const [question]=specialQuestions(mode,[{track,entry}],{duration:20,count:5});
  let s=createGame([question],[{id:'a',name:'Alpha'}],'phone','qcm',{speed:false,streak:false});
  s=applyAction(s,{type:'play'},1000);
  const visible=publicGame(s,'a').question;
  assert.equal(visible.answer,undefined);
  assert.equal(visible.explanation,undefined);
  assert.equal(visible.options.length,4);
  if(mode==='timeline'){
   const years=visible.timeline.map(label=>Number(label.split(' · ').at(-1)));
   assert.equal(question.answer,visible.options[years.filter(year=>year<value).length]);
  }else assert.equal(question.answer,value);
  s=applyAction(s,{type:'answer',team:'a',answer:question.answer},5000);
  assert.equal(s.answers.a.total,100);
 }
});


test('Génériques TV : les variantes de titre sont reconnues et le salon utilise le mode Cinéma musical',()=>{
 const entry=SPECIAL_TRACKS.tvThemes.find(row=>row[2]==='Les Simpson');
 const [title,artist,show,alternateTitle]=entry;
 const track={title:alternateTitle,artist,preview:'/preview/123'};
 assert.equal(matchSpecialTrack([track],title,artist,alternateTitle),track);
 const [q]=specialQuestions('tvThemes',[{track,entry}],{duration:20,count:5});
 assert.equal(q.target,'soundtrack');
 assert.equal(q.universe,'film');
 assert.equal(q.answer,show);
 assert.equal(new Set(q.options).size,4);
});
