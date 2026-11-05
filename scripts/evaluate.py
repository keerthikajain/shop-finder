"""Typed candidate-set evaluation only; never a speech/compatibility benchmark."""
import sys,json,time
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'backend'))
from app.schemas import Product
from app.services.matching import search,normalize
products=[Product.model_validate(p) for p in json.loads((root/'data/sample_catalogue.json').read_text())]
rows=[]
for case in json.loads((root/'evaluation/queries.json').read_text()):
    start=time.perf_counter();actual=search(products,case['input']);ms=(time.perf_counter()-start)*1000
    expected=sorted(case['expected']['demo_candidate_ids']);ids=sorted(p['id'] for p in actual['candidates'])
    q=normalize(case['input']);baseline=sorted(p.id for p in products if q in (normalize(p.name),normalize(p.part_number or ''),normalize(p.id)))
    rows.append({'id':case['id'],'input':case['input'],'expected_candidate_ids':expected,'actual':actual,'candidate_set_pass':ids==expected,'baseline_candidate_ids':baseline,'baseline_candidate_set_pass':baseline==expected,'elapsed_ms':round(ms,3),'error_category':None if ids==expected else 'candidate_set_mismatch'})
summary={'type':'synthetic_typed_candidate_set_only','count':len(rows),'candidate_set_pass':sum(r['candidate_set_pass'] for r in rows),'baseline_pass':sum(r['baseline_candidate_set_pass'] for r in rows),'recommendations_issued':sum(r['actual']['recommendation_allowed'] for r in rows),'speech_tests':0,'limitations':['Development corpus, not held-out or real shop data','Measures candidate sets only; action wording not scored','Empty expected sets reward abstention; inspect failures and per-case results','No compatibility, safety or speech accuracy claim']}
(root/'evaluation/results/typed-evaluation.json').write_text(json.dumps({'summary':summary,'cases':rows},indent=2)+'\n');print(json.dumps(summary,indent=2))
