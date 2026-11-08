import os,secrets,json,time
from datetime import datetime,timezone
from fastapi import HTTPException,Header,Depends,Request,Response
from pydantic import BaseModel,Field
from .database import connect,get_product,list_products
from .schemas import Product,Verification
from .services.matching import search
from .services import voice
from .warehouse import rows as warehouse_rows
from .services.language import LANGUAGES, response_text, followup_constraints

class Resolve(BaseModel):
    product_id:str|None=None
    note:str=Field(min_length=1,max_length=1000)
class Verify(BaseModel):
    verification:Verification
class Clarify(BaseModel):
    reply: str | None = Field(default=None,max_length=500)
    session_id:str
    constraints:dict=Field(default_factory=dict)

# A local shared staff credential, never a Gnani credential. No writes if unset.
def staff(request:Request,x_staff_token:str=Header(default='')):
    if request.app.state.accounts_required:
        if not getattr(request.state,'user',None):raise HTTPException(401,'Please log in.')
        return request.state.user['id']
    expected=os.getenv('SHOP_FINDER_STAFF_TOKEN','')
    if len(expected)<24:raise HTTPException(503,'Configure a staff token of at least 24 characters on the backend.')
    if not secrets.compare_digest(x_staff_token,expected):raise HTTPException(401,'Staff access required.')
    return 'local-staff'

def install(app,path,SearchRequest,Constraints):
    sessions={}
    def process(query,constraints,candidate_ids=None,language='en-IN',user_id=None):
        started=time.perf_counter()
        products=list_products(path)
        if candidate_ids is not None:products=[p for p in products if p.id in candidate_ids]
        r=search(products,query,constraints)
        if not r['candidates']:
            with connect(path) as c:c.execute('INSERT INTO unresolved_questions(query,reason) VALUES (?,?)',(query,r['message']))
        now=time.time()
        for key in list(sessions):
            if sessions[key]['expires']<now:del sessions[key]
        if len(sessions)>=500:del sessions[next(iter(sessions))]
        sid=secrets.token_urlsafe(24)
        ids=[p['id'] for p in r['candidates']]
        sessions[sid]={'query':query,'constraints':constraints,'ids':ids,'expires':now+1800,'message':r['message'],'language':language,'user_id':user_id['id'] if user_id else None}
        r['session_id']=sid
        r['clarification_options']={}
        if len(ids)>0:
            ps=[p for p in products if p.id in ids]
            for key in ['part_number','connector_type']:
                r['clarification_options'][key]=sorted({getattr(p,key) for p in ps if getattr(p,key)})
        chosen=[p for p in products if p.id in ids]
        r['language']=language
        r['spoken_text']=response_text(chosen,language)
        r['search_ms']=round((time.perf_counter()-started)*1000,2)
        sessions[sid]['spoken_text']=r['spoken_text']
        return r
    app.state.process_search=process

    @app.post('/api/clarify')
    def clarify(body:Clarify,request:Request):
        s=sessions.get(body.session_id)
        if not s or s['expires']<time.time() or (app.state.accounts_required and s.get('user_id')!=request.state.user['id']):raise HTTPException(410,'Search expired; start again.')
        try:new=Constraints.model_validate(body.constraints).model_dump(exclude_none=True)
        except ValueError:raise HTTPException(422,'Invalid clarification fields.')
        if body.reply:
            parsed=followup_constraints(body.reply)
            if parsed is None:raise HTTPException(422,'Reply not understood. Read an exact part number, rating with units, or connector; or use the specification fields.')
            for k,v in parsed.items():
                if isinstance(v,dict):
                    target=new.setdefault(k,{})
                    if any(f in target and str(target[f])!=str(value) for f,value in v.items()):raise HTTPException(409,'Reply conflicts with specification fields.')
                    target.update(v)
                elif k in new and new[k]!=v:raise HTTPException(409,'Reply conflicts with specification fields.')
                else:new[k]=v
        merged=json.loads(json.dumps(s['constraints']))
        for k,v in new.items():
            if isinstance(v,dict):
                old=merged.setdefault(k,{})
                if any(f in old and str(old[f])!=str(value) for f,value in v.items()):raise HTTPException(409,'Conflicting specification; start a new search.')
                old.update(v)
            else:
                if k in merged and merged[k]!=v:raise HTTPException(409,'Conflicting specification; start a new search.')
                merged[k]=v
        return process(s['query'],merged,s['ids'],s['language'],getattr(request.state,'user',None))

    @app.post('/api/products',dependencies=[Depends(staff)])
    def create(p:Product):
        if p.verification.status=='verified':raise HTTPException(422,'Create unverified, then perform evidence review.')
        with connect(path) as c:
            if c.execute('SELECT 1 FROM products WHERE id=?',(p.id,)).fetchone():raise HTTPException(409,'ID already exists.')
            c.execute('INSERT INTO products VALUES (?,?,?,?,?)',(p.id,p.appliance_category,int(p.is_synthetic),p.verification.status,p.model_dump_json()))
        return p

    @app.put('/api/products/{product_id}',dependencies=[Depends(staff)])
    def update(product_id:str,p:Product,actor=Depends(staff)):
        old=get_product(path,product_id)
        if not old:raise HTTPException(404,'Unknown product.')
        if p.id!=product_id or p.is_synthetic!=old.is_synthetic:raise HTTPException(422,'Identity and synthetic provenance cannot be changed.')
        p.verification=Verification(status='needs_review')
        p.updated_at=datetime.now(timezone.utc);p.created_at=old.created_at
        with connect(path) as c:
            c.execute('UPDATE products SET category=?,verification_status=?,payload=? WHERE id=?',(p.appliance_category,'needs_review',p.model_dump_json(),p.id))
            c.execute('INSERT INTO verification_events(product_id,staff_id,action,evidence_json) VALUES (?,?,?,?)',(p.id,actor,'edited_verification_invalidated','[]'))
        return p

    @app.post('/api/products/{product_id}/verify',dependencies=[Depends(staff)])
    def verify(product_id:str,body:Verify,actor=Depends(staff)):
        p=get_product(path,product_id)
        if not p:raise HTTPException(404,'Unknown product.')
        raw=p.model_dump();raw['verification']=body.verification.model_dump()
        if body.verification.status!='verified':raise HTTPException(422,'Verification status must be verified.')
        try:p=Product.model_validate(raw)
        except ValueError:raise HTTPException(422,'Verification requires authentic data and evidence for every technical field. Synthetic records cannot be verified.')
        with connect(path) as c:
            c.execute('UPDATE products SET verification_status=?,payload=? WHERE id=?',('verified',p.model_dump_json(),p.id))
            c.execute('INSERT INTO verification_events(product_id,staff_id,action,evidence_json) VALUES (?,?,?,?)',(p.id,actor,'verified',body.verification.model_dump_json()))
        return p

    @app.get('/api/unresolved',dependencies=[Depends(staff)])
    def unresolved():
        with connect(path) as c:return [dict(r) for r in c.execute('SELECT * FROM unresolved_questions ORDER BY id DESC LIMIT 200')]

    @app.post('/api/unresolved/{qid}/resolve',dependencies=[Depends(staff)])
    def resolve(qid:int,body:Resolve):
        if body.product_id and not get_product(path,body.product_id):raise HTTPException(422,'Unknown linked product.')
        with connect(path) as c:
            if not c.execute('SELECT 1 FROM unresolved_questions WHERE id=?',(qid,)).fetchone():raise HTTPException(404,'Unknown question.')
            c.execute("UPDATE unresolved_questions SET status='resolved',product_id=?,resolution_note=? WHERE id=?",(body.product_id,body.note,qid))
        return {'status':'resolved'}

    @app.post('/api/voice/transcribe',dependencies=[Depends(staff)])
    async def transcribe(request:Request,language:str='en-IN',style:str='transcribe',enhanced:bool=True,collection:str='all',candidates:str=''):
        if language not in (*voice.STT_LANGUAGES,'hi-en','auto'):raise HTTPException(422,'Language not enabled.')
        voice.parse_language_candidates(candidates)
        if style not in ('verbatim','transcribe','codemix','transliterate'):
            raise HTTPException(422,'Transcript style not supported.')
        if collection not in ('all','clothing','footwear','appliances','home','grocery'):
            raise HTTPException(422,'Unknown product type.')
        data=bytearray()
        async for chunk in request.stream():
            data.extend(chunk)
            if len(data)>6_000_000:raise HTTPException(413,'Audio too large.')
        # Inventory context remains on the authenticated backend. Only bounded product
        # names and aliases are provided as STT accuracy hints, never shelf locations.
        keywords=[]
        if voice.stt_model()=='prisma-v3.0':
            with connect(path) as c:
                candidates=warehouse_rows(c,collection)
            for item in candidates:
                for name in [item['name'],item.get('brand',''),*item.get('aliases',[])]:
                    name=str(name).strip()
                    if name and name not in keywords and '<|' not in name and '|>' not in name:
                        keywords.append(name)
                    if len(keywords)>=80:break
                if len(keywords)>=80:break
        started=time.perf_counter()
        result=await voice.transcribe_details(bytes(data),language,output_style=style,
                                               enhanced=enhanced,keywords=keywords,language_candidates=candidates)
        return {**result,'provider':'Gnani '+('Prisma V3.0' if result['model']=='prisma-v3.0' else 'Prisma V2.5'),
                'language':language,'stt_ms':round((time.perf_counter()-started)*1000,2),
                'experimental':language in ('hi-en','auto')}

    @app.post('/api/voice/speak/{session_id}',dependencies=[Depends(staff)])
    async def speak(session_id:str,request:Request):
        s=sessions.get(session_id)
        if not s or s['expires']<time.time() or (app.state.accounts_required and s.get('user_id')!=request.state.user['id']):raise HTTPException(410,'Search expired.')
        return Response(await voice.speak(s['spoken_text'],s['language']),media_type='audio/wav')
