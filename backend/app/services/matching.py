import re
from .language import normalize_query, has_unhandled_hindi
from decimal import Decimal, InvalidOperation
from rapidfuzz.fuzz import ratio

def normalize(text):
    text=normalize_query(text).casefold().replace('µ','u').replace('μ','u')
    for a,b in [('two point five','2.5'),('three point one five','3.15'),('microfarads','uf'),('microfarad','uf'),('volts','v'),('volt','v'),('watts','w'),('watt','w')]:text=text.replace(a,b)
    return re.sub(r'\s+',' ',text).strip()

def same(a,b):
    try:return Decimal(str(a))==Decimal(str(b))
    except InvalidOperation:return normalize(str(a))==normalize(str(b))

def search(products,query,constraints=None):
    q=normalize(query); constraints=constraints or {}
    def result(status,candidates=None,reason=''):
        return {'status':status,'candidates':candidates or [],'recommendation_allowed':False,'message':reason or 'Catalogue matches only. Confirm exact identity and specifications with staff; no compatibility is inferred.'}
    if not q or len(q)>500:return result('invalid_query')
    if has_unhandled_hindi(q):return result('staff_review',reason='Some Hindi words were not understood. Confirm the exact identifier and specifications with staff.')
    if re.search(r'\b(substitut\w*|interchangeable|fit|compatible|instead|not|nahi)\b',q):return result('staff_review',reason='This request needs staff review; no substitution or compatibility can be confirmed.')
    identifiers=re.findall(r'\b(?:syn|demo)-\d+\b',q)
    patterns=[(r'(\d+(?:\.\d+)?)\s*uf\b','capacitance_uf'),(r'(\d+(?:\.\d+)?)\s*v\b','voltage_v'),(r'(\d+(?:\.\d+)?)\s*w\b','power_w'),(r'(\d+(?:\.\d+)?)\s*a\b','current_a'),(r'(\d+(?:\.\d+)?)\s*(?:c|°c)\b','cutoff_c'),(r'(\d+)\s*teeth\b','teeth')]
    parsed={}; conflicts=False
    for pattern,key in patterns:
        vals=re.findall(pattern,q)
        if vals:
            if len(set(vals))>1:conflicts=True
            parsed[key]=vals[0]
    supplies=re.findall(r'\b(ac|dc)\b',q)
    if len(set(supplies))>1:conflicts=True
    if supplies:parsed['supply']=supplies[0]
    for k,v in parsed.items():
        if k in constraints.get('specifications',{}) and not same(v,constraints['specifications'][k]):conflicts=True
    if conflicts:return result('staff_review',reason='Conflicting specifications. Start a new request or ask staff to review.')
    specs={**parsed,**constraints.get('specifications',{})}
    retrieval=q
    for pattern,_ in patterns:retrieval=re.sub(pattern,' ',retrieval)
    retrieval=re.sub(r'\b(ac|dc|need|where|is|the|kidhar|hai)\b',' ',retrieval)
    retrieval=re.sub(r'\d+(?:\.\d+)?\s*mm\s+(?:outlet|width|height|length)\b',' ',retrieval)
    retrieval=normalize(retrieval)
    def exact_name(p):
        return any(n in q or (set(retrieval.split()) and set(retrieval.split()).issubset(set(n.split()))) for n in [normalize(p.name),*[normalize(a) for a in p.aliases]])
    exact_exists=any(exact_name(p) for p in products)
    candidates=[]
    connectors=['2 wire leads','2 spade terminals','2-pin keyed plug','2 flat terminals','4-pin keyed plug','axial leads']
    mentioned=[c for c in connectors if c in q]
    # Unsupported sizes/models must never be silently treated as validated.
    dimension_matches=re.findall(r'(\d+(?:\.\d+)?)\s*mm\s+(outlet|width|height|length)\b',q)
    for key in {k for _,k in dimension_matches}:
        if len({v for v,k in dimension_matches if k==key})>1:return result('staff_review',reason='Conflicting dimensions; ask staff to review.')
    parsed_dims={(('outlet_diameter' if key=='outlet' else key)+'_mm'):value for value,key in dimension_matches}
    checked_q=re.sub(r'\d+(?:\.\d+)?\s*mm\s+(?:outlet|width|height|length)\b',' ',q)
    unsupported=bool(re.search(r'\b\d+(?:\.\d+)?\s*(?:mm|cm|inch|inches)\b|\bmodel\b',checked_q))
    for p in products:
        names=[normalize(p.name),*[normalize(a) for a in p.aliases]]
        if identifiers:
            if not all(i in (normalize(p.id),normalize(p.part_number or '')) for i in identifiers):continue
            score=1.0
        else:
            score=1.0 if exact_name(p) else max(ratio(retrieval,n)/100 for n in names)
            if exact_exists and not exact_name(p):continue
            if score<.72:continue
        if any(k not in p.specifications or not same(p.specifications[k],v) for k,v in specs.items()):continue
        if any(normalize(p.connector_type or '')!=c for c in mentioned):continue
        if 'wire leads' in q and 'wire leads' not in normalize(p.connector_type or ''):continue
        if 'spade terminals' in q and 'spade terminals' not in normalize(p.connector_type or ''):continue
        mismatch=False
        for key,expected in constraints.items():
            if key in ('manufacturer','model','part_number','connector_type'):
                if getattr(p,key) is None or not same(getattr(p,key),expected):mismatch=True
            elif key in ('dimensions','specifications'):
                if any(k not in getattr(p,key) or not same(getattr(p,key)[k],v) for k,v in expected.items()):mismatch=True
            else:mismatch=True
        if any(k not in p.dimensions or not same(p.dimensions[k],v) for k,v in parsed_dims.items()):mismatch=True
        if mismatch:continue
        candidates.append({'id':p.id,'name':p.name,'score':round(score,3),'is_synthetic':p.is_synthetic})
    if unsupported:return result('staff_review',reason='Enter dimensions and model in the exact specification fields; free-text sizes/models are not validated.')
    candidates.sort(key=lambda p:(-p['score'],p['id']))
    return result('clarification_required' if candidates else 'unresolved',candidates)
