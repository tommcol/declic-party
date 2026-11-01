import test from 'node:test';
import assert from 'node:assert/strict';
import {musicRoute} from '../src/catalog.js';

test('Une sélection à thème écarte les artistes sans rapport renvoyés par le fournisseur',async()=>{
 const previousFetch=globalThis.fetch,previousCaches=globalThis.caches;
 globalThis.caches={default:{match:async()=>undefined,put:async()=>{}}};
 globalThis.fetch=async input=>{
  const query=new URL(input).searchParams.get('q');
  assert.ok(!query.includes('artist:'));
  const artist=query.includes('Goldman')?'Jean-Jacques Goldman':query.includes('Gall')?'France Gall':query.includes('Dion')?'Céline Dion':'Stromae';
  const make=(id,name)=>({id,title:'Morceau '+id,artist:{name},preview:'https://cdn.dzcdn.net/preview/'+id+'.mp3',album:{cover_medium:'https://cdn-images.dzcdn.net/cover.jpg'}});
  return Response.json({data:[make(query.length,artist),make(999,'Artiste sans rapport')]});
 };
 try{const response=await musicRoute(new Request('https://declic.test/api/music/selection?themes=fr'));assert.equal(response.status,200);const body=await response.json();assert.equal(body.tracks.length,4);assert.ok(body.tracks.every(t=>t.artist!=='Artiste sans rapport'));}finally{globalThis.fetch=previousFetch;globalThis.caches=previousCaches;}
});

test('Le lecteur ne suit pas une redirection audio hors du CDN autorisé',async()=>{
 const previousFetch=globalThis.fetch,previousCaches=globalThis.caches;let calls=0;
 globalThis.caches={default:{match:async()=>undefined,put:async()=>{}}};
 globalThis.fetch=async(input,options)=>{calls++;if(String(input).startsWith('https://api.deezer.com'))return Response.json({id:1,title:'Titre',artist:{name:'Artiste'},preview:'https://cdn.dzcdn.net/preview.mp3'});assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://untrusted.example/audio.mp3'}});};
 try{const response=await musicRoute(new Request('https://declic.test/api/music/preview/1'));assert.equal(response.status,502);assert.equal(calls,2);assert.equal((await response.json()).diagnostic,undefined);}finally{globalThis.fetch=previousFetch;globalThis.caches=previousCaches;}
});
