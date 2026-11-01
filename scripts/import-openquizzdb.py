import json,pathlib,re,html,unicodedata,collections,sys,subprocess
root=pathlib.Path(__file__).resolve().parent.parent
if len(sys.argv)!=2:raise SystemExit('Usage: python scripts/import-openquizzdb.py /path/to/Zeuh-OpenQuizzDB')
src=pathlib.Path(sys.argv[1]).resolve();folder=root/'data/openquizzdb'
if subprocess.check_output(['git','rev-parse','HEAD'],cwd=src,text=True).strip()!='a16819964d171e40e6652368fc562f3bd27d0c5b':raise SystemExit('Use the documented source revision a16819964d171e40e6652368fc562f3bd27d0c5b')
def clean(x):return ' '.join(html.unescape(str(x)).translate({0x92:0x2019,0x9c:0x153,0x8c:0x152}).split())
def norm(x):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',x).encode('ascii','ignore').decode().lower())
existing={};seen=set()
for d in [root/'data/openquizzdb',root/'data/qulture',root/'data/learnclash']:
 for f in d.glob('*.json'):
  b=json.loads(f.read_text());existing[b['id']]=b
  for q in b['questions']:seen.add(norm(q['prompt']))
originalIds={int(q['id'].split('-')[1]) for b in existing.values() for q in b['questions'] if q['id'].startswith('oqdb-')}
excludedPacks={43,58,106,110,131,162,164,167,172,175,179,199,206,223,225,229,235,239,246,248,270,365,393,403,541}
# Dated celebrity news is excluded at pack level. Historical sport seasons keep their explicit dates.
film={3,18,31,34,36,41,46,51,55,57,81,88,89,92,114,177,201,214,241,243,250,256,257,267,273}
music={29,62,85,95,103,194,197,236,238,269}
# These patterns identify time-sensitive, malformed or context-dependent questions, not factual truth.
patterns=[r'actuellement',r'\baujourd.hui\b',r'à ce jour',r'de nos jours',r'le plus récent',r'dernier album',r'dernière.*saison',r'depuis combien',r'quel âge',r'combien.*(?:vendu|brevet|disques|titres|millions|milliards|nombre d.espèces|épisodes|films|albums)',r'(?:détient|détentrice).*record',r'premier.*classement',r'jusqu.à présent',r'cours actuel',r'\d+\s*%.*(?:guéri|santé)',r'<[^>]*>',r'\?\s*\d+$']
blocked=re.compile('|'.join(patterns),re.I)
report={'date':'2026-11-01','sourceCommit':'a16819964d171e40e6652368fc562f3bd27d0c5b','sourceJsonFiles':0,'sourceQuestions':0,'addedQuestions':0,'addedPacks':0,'invalidJsonFiles':[],'excludedPacks':[],'excludedQuestions':[],'deduplicated':0}
for f in sorted((src/'data').glob('*.json'),key=lambda p:int(p.stem.split('_')[-1])):
 report['sourceJsonFiles']+=1;id=int(f.stem.split('_')[-1])
 try:d=json.loads(f.read_text())
 except Exception as e:report['invalidJsonFiles'].append(f.name);continue
 blocks=d['quizz'].get('fr',d['quizz']);blocks=blocks if isinstance(blocks,list) else [blocks]
 rows=[(level,row) for b in blocks for level,items in b.items() if level in ['débutant','confirmé','expert'] for row in items];report['sourceQuestions']+=len(rows)
 if id in originalIds:continue
 title=clean(d['thème']).split(' (')[0].strip()
 if id in excludedPacks or re.search(r'^(?:Actu people|People\s*:|Potins|La menace|COVID)',title,re.I):report['excludedPacks'].append({'id':id,'title':title,'reason':'actualité, santé, contenu adulte ou thème hors sélection'});continue
 slug='oq-'+str(id);universe='music' if id in music else 'film' if id in film else 'quiz';emoji='🎵' if universe=='music' else '🎬' if universe=='film' else '💡'
 credit={'publisher':'OpenQuizzDB','author':clean(d['rédacteur']),'source':f'https://github.com/Zeuh/OpenQuizzDB/blob/a16819964d171e40e6652368fc562f3bd27d0c5b/data/openquizzdb_{id}.json','license':'CC BY-SA 4.0','licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/'}
 qs=[];excluded=[]
 for level,row in rows:
  prompt=clean(row.get('question',''));answer=clean(row.get('réponse',''));options=[clean(o) for o in row.get('propositions',[])];reason=''
  if not prompt or len(prompt)>300 or not answer or len(answer)>180 or len(options)!=4 or len(set(norm(o) for o in options))!=4 or answer not in options or any(not o or len(o)>180 for o in options):reason='format QCM invalide'
  elif blocked.search(prompt):reason='formulation dépendante du temps ou mal formée'
  elif norm(prompt) in seen:reason='question déjà présente';report['deduplicated']+=1
  if reason:excluded.append(row['id']);report['excludedQuestions'].append({'pack':id,'id':row['id'],'reason':reason});continue
  q={'id':f'oqdb-{id}-{row["id"]}','universe':universe,'kind':'question','prompt':prompt,'answer':answer,'options':options,'explanation':clean(row.get('anecdote','')),'level':{'débutant':'easy','confirmé':'medium','expert':'hard'}[level],'emoji':emoji,'duration':30,'points':100,'theme':slug,'credit':credit}
  qs.append(q);seen.add(norm(prompt))
 if len(qs)<5:report['excludedPacks'].append({'id':id,'title':title,'reason':'moins de 5 questions après filtrage'});continue
 bank={'id':slug,'title':title,'originalTitle':clean(d['thème']),'universe':universe,'emoji':emoji,'credit':credit,'review':'source-archive','excludedOriginalIds':excluded,'questions':qs}
 (folder/(slug+'.json')).write_text(json.dumps(bank,ensure_ascii=False,indent=2)+'\n');report['addedQuestions']+=len(qs);report['addedPacks']+=1
if report['addedQuestions']:(root/'data/import-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print({k:v for k,v in report.items() if not isinstance(v,list)});print('Excluded packs',len(report['excludedPacks']),'Filtered questions',len(report['excludedQuestions']))
