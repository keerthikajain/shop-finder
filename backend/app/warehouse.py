"""Persistent warehouse locator. Each installation is one organisation.

No generated inventory answers: matching uses stored names, aliases and specs.
Mutations use owner permissions, revision checks and a transactional audit trail.
"""
import csv,io,json,re,secrets,time,hashlib,zipfile
from datetime import datetime,timezone
from typing import Literal
from fastapi import HTTPException,Request,Response
from pydantic import BaseModel,Field,ConfigDict,field_validator,model_validator
from .database import connect
from .services import voice
from .warehouse_catalogue import COLLECTIONS,COLLECTION_MAP,LOCATION_FIELDS,FIELD_LABELS,demo_items

def now():return datetime.now(timezone.utc).isoformat()
def encode(x):return json.dumps(x,ensure_ascii=False,separators=(',',':'))
def norm(x):return re.sub(r'\s+',' ',str(x).lower().replace('t-shirt','tshirt').replace('t shirt','tshirt')).strip()
def loc_code(p):return 'LOC-'+hashlib.sha256(encode([norm(p[k]) for k in LOCATION_FIELDS]).encode()).hexdigest()[:14].upper()
def loc_text(p):return ' · '.join(p[k] for k in LOCATION_FIELDS)
def enrich(p):return {**p,'code':loc_code(p)}
def public(row):
 p=json.loads(row['payload']);return {**p,'revision':row['revision'],'updated_at':row['updated_at'],'updated_by':row['updated_by'],'placements':[enrich(x) for x in p['placements']]}

class Strict(BaseModel):model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
class Location(Strict):
 facility:str=Field(min_length=1,max_length=60)
 zone:str=Field(min_length=1,max_length=60)
 aisle:str=Field(min_length=1,max_length=30)
 rack:str=Field(min_length=1,max_length=30)
 shelf:str=Field(min_length=1,max_length=30)
 bin:str=Field(min_length=1,max_length=30)
class Item(Strict):
 sku:str=Field(pattern=r'^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$')
 collection:Literal['clothing','footwear','appliances','home']
 name:str=Field(min_length=2,max_length=120)
 category:str=Field(min_length=1,max_length=60)
 aliases:list[str]=Field(default_factory=list,max_length=20)
 barcode:str=Field(default='',max_length=100)
 specs:dict[str,str]=Field(default_factory=dict,max_length=12)
 placements:list[Location]=Field(min_length=1,max_length=20)
 synthetic:bool=False
 @model_validator(mode='after')
 def valid(self):
  if any(k not in COLLECTION_MAP[self.collection]['fields'] for k in self.specs):raise ValueError('Unknown specification for this collection.')
  if any(not v.strip() or len(v)>80 for v in self.specs.values()):raise ValueError('Specification values must be 1–80 characters.')
  if any(not a.strip() or len(a)>100 for a in self.aliases):raise ValueError('Aliases must be 1–100 characters.')
  if len({loc_code(p.model_dump()) for p in self.placements})!=len(self.placements):raise ValueError('Duplicate location.')
  self.sku=self.sku.upper();return self
class SaveItem(Strict):
 item:Item
 revision:int=Field(ge=0)
 reason:str=Field(min_length=3,max_length=300)
class Query(Strict):
 collection:Literal['clothing','footwear','appliances','home']
 query:str=Field(min_length=1,max_length=600)
 language:Literal['en-IN','hi-IN','hi-en']='en-IN'
class Choose(Strict):
 line:int=Field(ge=0,le=9)
 sku:str=Field(max_length=40)
 location:str=Field(max_length=50)
class Clarify(Strict):
 line:int=Field(ge=0,le=9)
 reply:str=Field(min_length=1,max_length=150)
class Scan(Strict):
 line:int=Field(ge=0,le=9)
 value:str=Field(min_length=1,max_length=150)
 kind:Literal['product','location','manual']
class Move(Strict):
 collection:str=Field(max_length=40)
 sku:str=Field(max_length=40)
 revision:int=Field(ge=1)
 source:str=Field(max_length=50)
 destination:Location
 reason:str=Field(min_length=3,max_length=300)
class MoveSpeech(Strict):
 collection:str=Field(max_length=40)
 sku:str=Field(max_length=40)
 source:str=Field(max_length=50)
 transcript:str=Field(min_length=3,max_length=500)
class Mapping(Strict):mapping:dict[str,str]=Field(max_length=30)
class Issue(Strict):
 collection:str=Field(max_length=40)
 sku:str=Field(default='',max_length=40)
 reason:str=Field(min_length=3,max_length=400)
class Resolve(Strict):note:str=Field(min_length=3,max_length=300)

def initialize_warehouse(path,demo=True):
 with connect(path) as c:
  c.executescript('''CREATE TABLE IF NOT EXISTS wh_items(collection TEXT NOT NULL,sku TEXT NOT NULL,barcode TEXT NOT NULL,payload TEXT NOT NULL,revision INTEGER NOT NULL,updated_at TEXT NOT NULL,updated_by TEXT NOT NULL,PRIMARY KEY(collection,sku));
  CREATE TABLE IF NOT EXISTS wh_events(id INTEGER PRIMARY KEY,collection TEXT,sku TEXT,action TEXT,actor TEXT,at TEXT,before_json TEXT,after_json TEXT,reason TEXT);
  CREATE TABLE IF NOT EXISTS wh_pending(id TEXT PRIMARY KEY,kind TEXT,owner TEXT,expires REAL,payload TEXT);
  CREATE TABLE IF NOT EXISTS wh_tasks(id TEXT PRIMARY KEY,owner TEXT,created REAL,payload TEXT);
  CREATE TABLE IF NOT EXISTS wh_issues(id INTEGER PRIMARY KEY,collection TEXT,sku TEXT,reason TEXT,actor TEXT,at TEXT,status TEXT DEFAULT 'open',note TEXT DEFAULT '');''')
  if demo:
   for p in demo_items():
    p=Item(**p).model_dump();c.execute('INSERT OR IGNORE INTO wh_items VALUES(?,?,?,?,1,?,?)',(p['collection'],p['sku'],p['barcode'],encode(p),now(),'Demo seed'))

def identity(request,owner=False):
 user=getattr(request.state,'user',None)
 if not user:raise HTTPException(401,'Please log in.')
 if owner and user['role']!='owner':raise HTTPException(403,'Owner access required.')
 return user
def rows(c,collection):return [public(r) for r in c.execute("SELECT * FROM wh_items WHERE collection=? ORDER BY json_extract(payload, '$.category'),json_extract(payload, '$.name'),sku",(collection,))]
def item_row(c,collection,sku):
 r=c.execute('SELECT * FROM wh_items WHERE collection=? AND sku=?',(collection,sku.upper())).fetchone()
 if not r:raise HTTPException(404,'Item not found.')
 return r
def write(c,p,revision,actor,reason,action='edit'):
 old=c.execute('SELECT * FROM wh_items WHERE collection=? AND sku=?',(p['collection'],p['sku'])).fetchone()
 if (old['revision'] if old else 0)!=revision:raise HTTPException(409,'This item changed after you opened it. Refresh and review the latest record.')
 if old and json.loads(old['payload'])['synthetic']!=p['synthetic']:raise HTTPException(422,'Demo status cannot be changed. Create a separate real record.')
 if p['barcode'] and c.execute('SELECT 1 FROM wh_items WHERE collection=? AND barcode=? AND sku!=?',(p['collection'],p['barcode'],p['sku'])).fetchone():raise HTTPException(409,'This barcode already belongs to another item in this collection.')
 at=now();c.execute('INSERT OR REPLACE INTO wh_items VALUES(?,?,?,?,?,?,?)',(p['collection'],p['sku'],p['barcode'],encode(p),revision+1,at,actor))
 c.execute('INSERT INTO wh_events(collection,sku,action,actor,at,before_json,after_json,reason) VALUES(?,?,?,?,?,?,?,?)',(p['collection'],p['sku'],action,actor,at,old['payload'] if old else None,encode(p),reason))
 return public(item_row(c,p['collection'],p['sku']))
def pending(c,kind,user,payload):
 c.execute('DELETE FROM wh_pending WHERE expires<?',(time.time(),));token=secrets.token_urlsafe(24)
 c.execute('INSERT INTO wh_pending VALUES(?,?,?,?,?)',(token,kind,user['id'],time.time()+1800,encode(payload)));return token
def get_pending(c,token,kind,user):
 r=c.execute('SELECT * FROM wh_pending WHERE id=? AND kind=? AND owner=? AND expires>?',(token,kind,user['id'],time.time())).fetchone()
 if not r:raise HTTPException(410,'Preview expired or already applied. Create a new preview.')
 return json.loads(r['payload'])

# Small, explicit vocabulary. Unsupported requests stay unresolved rather than inventing answers.
STOP=set('find where is are the a an i can do you have me please show need want get locate in stock size uk colour color power capacity of for mujhe chahiye kahan hai aur मुझे खोजो चाहिए चाहिये कहाँ है हैं और दिखाओ साइज वाट लीटर w l'.split())
TRANSLATIONS={'नीली':'blue','नीला':'blue','सफेद':'white','काली':'black','काला':'black','लाल':'red','सूती':'cotton','वाट':'w','लीटर':'l','साइज़':'size','साइज':'size','एम':'m','एल':'l'}
def normal_query(text):
 s=norm(text)
 replacements={'extra large':'xl','extra small':'xs','medium':'m','large':'l','small':'s','thirty two':'32','thirty four':'34','forty':'40','twenty':'20','one':'1','two':'2','three':'3','four':'4','five':'5','six':'6','seven':'7','eight':'8','nine':'9','एक':'1','दो':'2','तीन':'3','चार':'4','पांच':'5','पाँच':'5','छह':'6','सात':'7','आठ':'8','नौ':'9','बी':'b','सी':'c','tshirts':'tshirt','t-shirts':'tshirt','trainer':'trainers','sandal':'sandals','mixers':'mixer','kettles':'kettle','towels':'towel','boxes':'box'}
 for a,b in replacements.items():s=re.sub(r'(?<!\w)'+re.escape(a)+r'(?!\w)',b,s)
 for a,b in TRANSLATIONS.items():s=s.replace(a,b)
 return s
def tokens(text):return {x for x in re.findall(r'[\w.\u0900-\u097F]+',normal_query(text)) if x not in STOP}
def match(query,items,collection):
 q=normal_query(query)
 exact=[p for p in items if q in (norm(p['sku']),norm(p['barcode'])) and q]
 if exact:return exact
 codes=[p for p in items if re.search(r'(?<![\w-])'+re.escape(norm(p['sku']))+r'(?![\w-])',q)]
 if codes:
  items=codes
  for p in codes:q=re.sub(r'(?<![\w-])'+re.escape(norm(p['sku']))+r'(?![\w-])','',q)
  if not tokens(q):return codes
 qt=tokens(q);found=[]
 # Explicit numbers and sizes must appear in the stored specs, never be ignored.
 numeric=set(re.findall(r'(?<![\w.])\d+(?:\.\d+)?(?![\w.])',q))
 sizes=set(re.findall(r'\b(?:xs|s|m|l|xl|xxl)\b',q)) if collection=='clothing' else set()
 constraints={}
 for field,pattern in [('power_w',r'(\d+(?:\.\d+)?)\s*(?:w|watt|watts)\b'),('capacity_l',r'(\d+(?:\.\d+)?)\s*(?:l|litre|liter|litres|liters)\b')]:
  if m:=re.search(pattern,q):constraints[field]=m[1]
 size=re.search(r'(?:size|uk)\s*(\d+|xxl|xl|xs|s|m|l)\b',q)
 if size:constraints['size_uk' if collection=='footwear' else 'size']=size[1]
 colours={'blue','white','black','red','green','grey','brown','pink','beige','silver','clear'}&qt
 for p in items:
  names=tokens(' '.join([p['name'],p['category'],*p['aliases']]))
  spec_tokens=tokens(' '.join(p['specs'].values()))
  if not codes and not (qt&names):continue
  if numeric and not numeric<=set(re.findall(r'\d+(?:\.\d+)?',' '.join(p['specs'].values()))):continue
  if sizes and not sizes<=set(norm(v) for v in p['specs'].values()):continue
  if colours and norm(p['specs'].get('colour','')) not in colours:continue
  if any(norm(p['specs'].get(k,''))!=v for k,v in constraints.items()):continue
  # Every meaningful query word must be explained by catalogue names, aliases or specs.
  leftovers=qt-names-spec_tokens-set(['size','watt','watts','litre','litres','liter','liters'])
  if leftovers:continue
  found.append(p)
 return found
def speak_task(task):
 hi=task['language'] in ('hi-IN','hi-en');parts=[]
 for line in task['lines']:
  p=line.get('selected')
  if p:
   l=line['location'];parts.append(f"{p['name']}, {p['sku']}. "+(f"{l['facility']}, {l['zone']}, गलियारा {l['aisle']}, रैक {l['rack']}, शेल्फ {l['shelf']}, बिन {l['bin']}." if hi else f"{l['facility']}, {l['zone']}, aisle {l['aisle']}, rack {l['rack']}, shelf {l['shelf']}, bin {l['bin']}."))
  elif line['candidates']:parts.append((f"{line['query']}: कृपया सही आकार या प्रकार चुनें।" if hi else f"{line['query']}: choose the size or variant before going to a location."))
  else:parts.append((f"{line['query']}: सूची में नहीं मिला।" if hi else f"{line['query']}: no matching catalogue record."))
 if any(p.get('synthetic') for l in task['lines'] for p in l['candidates']):parts.insert(0,'यह डेमो डेटा है।' if hi else 'Demo data; locations are fictional.')
 return ' '.join(parts)[:2400]
def task_get(c,tid,u):
 r=c.execute('SELECT * FROM wh_tasks WHERE id=? AND owner=?',(tid,u['id'])).fetchone()
 if not r or time.time()-r['created']>86400:raise HTTPException(404,'Search session expired. Search again.')
 return json.loads(r['payload'])
def task_put(c,t):
 t['spoken_text']=speak_task(t);c.execute('UPDATE wh_tasks SET payload=? WHERE id=?',(encode(t),t['id']));return t
def current_line(c,t,index):
 if index>=len(t['lines']):raise HTTPException(422,'Invalid task line.')
 line=t['lines'][index];selected=line.get('selected')
 if not selected:raise HTTPException(409,'Choose an item and its location first.')
 p=public(item_row(c,t['collection'],selected['sku']))
 if p['revision']!=selected['revision']:raise HTTPException(409,'Catalogue changed. Search again before confirming this item.')
 return line,p

def parse_sheet(data,filename):
 if len(data)>4_000_000:raise HTTPException(413,'Use a spreadsheet smaller than 4 MB.')
 try:
  if filename.lower().endswith('.xlsx'):
   from openpyxl import load_workbook
   with zipfile.ZipFile(io.BytesIO(data)) as z:
    if sum(i.file_size for i in z.infolist())>25_000_000:raise ValueError('Expanded workbook is too large.')
    if any('vbaproject' in i.filename.lower() for i in z.infolist()):raise ValueError('Macros are not supported.')
   book=load_workbook(io.BytesIO(data),read_only=True,data_only=False)
   sheet=book.active;grid=[]
   for row in sheet.iter_rows():
    if len(grid)>1001:raise ValueError('Limit: 1,000 data rows.')
    if len(row)>40:raise ValueError('Limit: 40 columns.')
    if any(c.data_type=='f' for c in row):raise ValueError('Replace formulas with values before importing.')
    grid.append(['' if c.value is None else str(c.value).strip() for c in row])
   book.close()
  elif filename.lower().endswith('.csv'):
   grid=list(csv.reader(io.StringIO(data.decode('utf-8-sig'))))
  else:raise ValueError('Choose a .csv or .xlsx file.')
  if len(grid)>1001 or any(len(r)>40 for r in grid):raise ValueError('Limit: 1,000 rows and 40 columns.')
  if not grid or len(grid)<2:raise ValueError('Include a header and at least one data row.')
  headers=[x.strip() for x in grid[0]]
  if any(not h for h in headers) or len(headers)!=len(set(headers)):raise ValueError('Column names must be nonempty and unique.')
  if any(len(r)!=len(headers) for r in grid[1:] if any(r)):raise ValueError('Each row must have the same columns as the header.')
  return headers,[dict(zip(headers,r)) for r in grid[1:] if any(r)]
 except HTTPException:raise
 except Exception as e:raise HTTPException(422,str(e) if isinstance(e,ValueError) else 'Unable to read this spreadsheet. Export a plain CSV or XLSX and try again.')

def import_preview(c,raw,mapping):
 collection=raw['collection'];fields=['sku','name','category','barcode','aliases','synthetic','revision',*LOCATION_FIELDS,*COLLECTION_MAP[collection]['fields']]
 if any(k not in fields or v not in raw['columns'] for k,v in mapping.items()):raise HTTPException(422,'Unknown column mapping.')
 required=['sku','name','category',*LOCATION_FIELDS]
 if any(k not in mapping for k in required):raise HTTPException(422,'Map SKU, name, category and all six location fields.')
 grouped={};errors=[];expected={}
 for n,row in enumerate(raw['rows'],2):
  v={k:row.get(mapping.get(k,''),'').strip() for k in fields}
  try:
   if v['synthetic'].lower() not in ('','true','false','yes','no','1','0'):raise ValueError('Synthetic must be true or false.')
   p=Item(sku=v['sku'],collection=collection,name=v['name'],category=v['category'],barcode=v['barcode'],aliases=[a.strip() for a in v['aliases'].split('|') if a.strip()],specs={k:v[k] for k in COLLECTION_MAP[collection]['fields'] if v[k]},placements=[{k:v[k] for k in LOCATION_FIELDS}],synthetic=v['synthetic'].lower() in ('true','yes','1')).model_dump()
   revision=int(v['revision']) if v['revision'] else None
   if revision is not None and revision<0:raise ValueError('Revision cannot be negative.')
   if p['sku'] in expected and expected[p['sku']]!=revision:raise ValueError('Rows for one SKU have different revisions.')
   expected[p['sku']]=revision
   if p['sku'] in grouped:
    previous=grouped[p['sku']]
    if {k:x for k,x in previous.items() if k!='placements'}!={k:x for k,x in p.items() if k!='placements'}:raise ValueError('Same SKU has conflicting product details.')
    previous['placements']+=p['placements'];Item(**previous)
   else:grouped[p['sku']]=p
  except Exception as e:errors.append({'row':n,'message':str(e).split('\n')[0] if isinstance(e,ValueError) else 'Invalid row.'})
 seen={};changes=[]
 for p in grouped.values():
  if p['barcode'] and p['barcode'] in seen:errors.append({'row':0,'message':f"Barcode {p['barcode']} is repeated for different SKUs."})
  seen[p['barcode']]=p['sku']
  old=c.execute('SELECT * FROM wh_items WHERE collection=? AND sku=?',(collection,p['sku'])).fetchone()
  if expected[p['sku']] is not None and expected[p['sku']]!=(old['revision'] if old else 0):errors.append({'row':0,'message':f"{p['sku']}: exported revision is stale. Export the latest record and reconcile your changes."})
  other=c.execute('SELECT sku FROM wh_items WHERE collection=? AND barcode=? AND sku!=?',(collection,p['barcode'],p['sku'])).fetchone() if p['barcode'] else None
  if other:errors.append({'row':0,'message':f"Barcode already belongs to {other['sku']}."})
  if old and json.loads(old['payload'])['synthetic']!=p['synthetic']:errors.append({'row':0,'message':f"{p['sku']}: demo/real status cannot be changed by reimport."})
  if old and json.loads(old['payload'])==p:action='unchanged'
  else:action='update' if old else 'create'
  changes.append({'item':p,'revision':old['revision'] if old else 0,'action':action,'before':json.loads(old['payload']) if old else None})
 return {'changes':changes,'errors':errors,'counts':{k:sum(x['action']==k for x in changes) for k in ['create','update','unchanged']},'collection':collection}

def install_warehouse(app,path):
 @app.get('/api/warehouse/meta')
 def meta(request:Request):
  identity(request)
  with connect(path) as c:
   packs=[{**p,'count':c.execute('SELECT count(*) FROM wh_items WHERE collection=?',(p['id'],)).fetchone()[0]} for p in COLLECTIONS]
  return {'collections':packs,'location_fields':LOCATION_FIELDS,'field_labels':FIELD_LABELS,'voice':voice.ready()}
 @app.get('/api/warehouse/items')
 def items(request:Request,collection:str):
  identity(request)
  with connect(path) as c:return rows(c,collection)
 @app.put('/api/warehouse/items')
 def save(body:SaveItem,request:Request):
  u=identity(request,True)
  with connect(path) as c:
   c.execute('BEGIN IMMEDIATE');return write(c,body.item.model_dump(),body.revision,u['username'],body.reason)
 @app.post('/api/warehouse/search')
 def search(body:Query,request:Request):
  u=identity(request);queries=[q.strip(' .?!') for q in re.split(r'\s+(?:and|aur|और)\s+|[,;\n]',body.query,flags=re.I) if q.strip(' .?!')]
  if not 1<=len(queries)<=10:raise HTTPException(422,'Ask for 1–10 items at a time.')
  with connect(path) as c:
   all_items=rows(c,body.collection);lines=[]
   for q in queries:
    candidates=match(q,all_items,body.collection);p=candidates[0] if len(candidates)==1 else None
    l=p['placements'][0] if p and len(p['placements'])==1 else None
    lines.append({'query':q,'candidates':candidates,'selected':p if l else None,'location':l,'product_scanned':False,'complete':False,'confirmation':None})
    if not candidates:c.execute('INSERT INTO wh_issues(collection,sku,reason,actor,at) VALUES(?,?,?,?,?)',(body.collection,'','No match: '+q,u['username'],now()))
   tid=secrets.token_urlsafe(24);t={'id':tid,'collection':body.collection,'language':body.language,'query':body.query,'lines':lines};t['spoken_text']=speak_task(t)
   c.execute('DELETE FROM wh_tasks WHERE created<?',(time.time()-86400,));c.execute('INSERT INTO wh_tasks VALUES(?,?,?,?)',(tid,u['id'],time.time(),encode(t)))
   return t
 @app.get('/api/warehouse/tasks')
 def recent(request:Request):
  u=identity(request)
  with connect(path) as c:return [json.loads(r[0]) for r in c.execute('SELECT payload FROM wh_tasks WHERE owner=? AND created>? ORDER BY created DESC LIMIT 6',(u['id'],time.time()-86400))]
 @app.post('/api/warehouse/tasks/{tid}/choose')
 def choose(tid:str,body:Choose,request:Request):
  u=identity(request)
  with connect(path) as c:
   c.execute('BEGIN IMMEDIATE');t=task_get(c,tid,u)
   if body.line>=len(t['lines']):raise HTTPException(422,'Invalid task line.')
   line=t['lines'][body.line]
   if body.sku not in [p['sku'] for p in line['candidates']]:raise HTTPException(422,'Choose one of the matching candidates.')
   p=public(item_row(c,t['collection'],body.sku));l=next((l for l in p['placements'] if l['code']==body.location),None)
   if not l:raise HTTPException(409,'Location changed. Search again.')
   line.update(selected=p,location=l,product_scanned=False,complete=False,confirmation=None);return task_put(c,t)
 @app.post('/api/warehouse/tasks/{tid}/clarify')
 def clarify(tid:str,body:Clarify,request:Request):
  u=identity(request)
  with connect(path) as c:
   c.execute('BEGIN IMMEDIATE');t=task_get(c,tid,u)
   if body.line>=len(t['lines']):raise HTTPException(422,'Invalid task line.')
   line=t['lines'][body.line];ids={p['sku'] for p in line['candidates']}
   current=[p for p in rows(c,t['collection']) if p['sku'] in ids]
   exact=[p for p in current if norm(body.reply) in (norm(p['sku']),norm(p['barcode']))]
   candidates=exact or match(line['query']+' '+body.reply,current,t['collection'])
   if not candidates:raise HTTPException(422,'That detail does not match the available choices. Select a variant or search again.')
   p=candidates[0] if len(candidates)==1 else None;l=p['placements'][0] if p and len(p['placements'])==1 else None
   line.update(candidates=candidates,selected=p if l else None,location=l,product_scanned=False,complete=False,confirmation=None)
   return task_put(c,t)
 @app.post('/api/warehouse/tasks/{tid}/scan')
 def scan(tid:str,body:Scan,request:Request):
  u=identity(request)
  with connect(path) as c:
   c.execute('BEGIN IMMEDIATE');t=task_get(c,tid,u);line,p=current_line(c,t,body.line)
   if body.kind=='product':
    if body.value not in [p['sku'],p['barcode'],f"ITEM:{p['collection']}:{p['sku']}"]:raise HTTPException(409,'Different item scanned. Check the SKU and variant.')
    line['product_scanned']=True
   elif body.kind=='location':
    if not line['product_scanned']:raise HTTPException(409,'Scan the item first.')
    if body.value!=line['location']['code']:raise HTTPException(409,'Different location scanned. Check the shelf label.')
    line.update(complete=True,confirmation='barcode')
   else:line.update(complete=True,confirmation='manual')
   return task_put(c,t)
 @app.post('/api/warehouse/tasks/{tid}/speak')
 async def speech(tid:str,request:Request):
  u=identity(request)
  with connect(path) as c:
   t=task_get(c,tid,u)
   for i,l in enumerate(t['lines']):
    if l.get('selected'):current_line(c,t,i)
  audio=await voice.speak(t['spoken_text'],t['language']);return Response(audio,media_type='audio/wav')
 @app.post('/api/warehouse/moves/parse')
 def parse_move(body:MoveSpeech,request:Request):
  identity(request,True)
  with connect(path) as c:p=public(item_row(c,body.collection,body.sku))
  source=next((l for l in p['placements'] if l['code']==body.source),None)
  if not source:raise HTTPException(409,'Source location changed.')
  destination={k:source[k] for k in LOCATION_FIELDS};matched=False
  # Voice changes only named rack/shelf/bin; facility, zone, aisle remain explicit form fields.
  for key,word in [('rack','rack|रैक'),('shelf','shelf|शेल्फ'),('bin','bin|box|बिन|बॉक्स')]:
   m=re.search(r'(?:'+word+r')\s*([A-Za-z0-9-]+)',normal_query(body.transcript),re.I)
   if m:destination[key]=m[1].upper();matched=True
  if not matched:raise HTTPException(422,'Say “rack C shelf 2 bin 08”, or fill in the destination fields.')
  return {'destination':destination,'revision':p['revision'],'transcript':body.transcript}
 @app.post('/api/warehouse/moves/preview')
 def move_preview(body:Move,request:Request):
  u=identity(request,True)
  with connect(path) as c:
   r=item_row(c,body.collection,body.sku);p=public(r)
   if p['revision']!=body.revision:raise HTTPException(409,'Record changed. Reopen the item.')
   source=next((l for l in p['placements'] if l['code']==body.source),None)
   if not source:raise HTTPException(409,'Source location changed.')
   destination=body.destination.model_dump()
   if loc_code(destination) in [l['code'] for l in p['placements']]:raise HTTPException(422,'This location is already recorded.')
   payload=body.model_dump();token=pending(c,'move',u,payload)
   return {'token':token,'before':source,'after':enrich(destination),'sku':p['sku'],'name':p['name']}
 @app.post('/api/warehouse/moves/{token}/confirm')
 def move_confirm(token:str,request:Request):
  u=identity(request,True)
  with connect(path) as c:
   c.execute('BEGIN IMMEDIATE');b=get_pending(c,token,'move',u);p=json.loads(item_row(c,b['collection'],b['sku'])['payload'])
   p['placements']=[b['destination'] if loc_code(l)==b['source'] else l for l in p['placements']]
   Item(**p);result=write(c,p,b['revision'],u['username'],b['reason'],'move');c.execute('DELETE FROM wh_pending WHERE id=?',(token,));return result
 @app.post('/api/warehouse/imports')
 async def upload(request:Request,collection:str,filename:str):
  u=identity(request,True)
  if collection not in COLLECTION_MAP:raise HTTPException(422,'Choose a collection.')
  data=bytearray()
  async for chunk in request.stream():
   data.extend(chunk)
   if len(data)>4_000_000:raise HTTPException(413,'Use a spreadsheet smaller than 4 MB.')
  headers,grid=parse_sheet(bytes(data),filename);raw={'collection':collection,'columns':headers,'rows':grid}
  with connect(path) as c:token=pending(c,'sheet',u,raw)
  return {'token':token,'columns':headers,'sample':grid[:3],'row_count':len(grid)}
 @app.post('/api/warehouse/imports/{token}/preview')
 def preview_import(token:str,body:Mapping,request:Request):
  u=identity(request,True)
  with connect(path) as c:
   raw=get_pending(c,token,'sheet',u);preview=import_preview(c,raw,body.mapping);new=pending(c,'import',u,preview)
  return {**preview,'token':new}
 @app.post('/api/warehouse/imports/{token}/confirm')
 def confirm_import(token:str,request:Request):
  u=identity(request,True)
  with connect(path) as c:
   c.execute('BEGIN IMMEDIATE');p=get_pending(c,token,'import',u)
   if p['errors']:raise HTTPException(422,'Fix every import error before applying.')
   for ch in p['changes']:
    r=c.execute('SELECT revision FROM wh_items WHERE collection=? AND sku=?',(ch['item']['collection'],ch['item']['sku'])).fetchone()
    if (r[0] if r else 0)!=ch['revision']:raise HTTPException(409,'Catalogue changed since preview. Upload and review again; nothing was applied.')
   for ch in p['changes']:
    if ch['action']!='unchanged':write(c,ch['item'],ch['revision'],u['username'],'Spreadsheet import','import')
   c.execute('DELETE FROM wh_pending WHERE id=?',(token,));return {'applied':p['counts']}
 @app.get('/api/warehouse/export')
 def export(request:Request,collection:str,format:Literal['csv','xlsx']='csv',template:bool=False):
  identity(request)
  if collection not in COLLECTION_MAP:raise HTTPException(422,'Unknown collection.')
  fields=['sku','name','category','barcode','aliases','synthetic','revision',*LOCATION_FIELDS,*COLLECTION_MAP[collection]['fields']]
  with connect(path) as c:products=[] if template else rows(c,collection)
  data=[]
  for p in products:
   for l in p['placements']:
    row={**p,**l,**p['specs'],'aliases':'|'.join(p['aliases']),'synthetic':str(p['synthetic']).lower()}
    data.append([str(row.get(k,'')) for k in fields])
  if format=='xlsx':
   from openpyxl import Workbook
   book=Workbook();sheet=book.active;sheet.title='Items';sheet.append(fields)
   for row in data:sheet.append(row)
   for row in sheet:
    for cell in row:cell.data_type='s';cell.number_format='@'
   sheet.freeze_panes='A2';sheet.auto_filter.ref=sheet.dimensions
   out=io.BytesIO();book.save(out);content=out.getvalue();mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  else:
   out=io.StringIO();w=csv.writer(out);w.writerow(fields)
   for row in data:w.writerow(["'"+x if x.startswith(('=','+','-','@','\t','\r')) else x for x in row])
   content=out.getvalue().encode('utf-8-sig');mime='text/csv'
  return Response(content,media_type=mime,headers={'Content-Disposition':f'attachment; filename="{collection}-{ "template" if template else "catalogue"}.{format}"'})
 @app.get('/api/warehouse/history')
 def history(request:Request,collection:str):
  identity(request,True)
  with connect(path) as c:return [{**dict(r),'before':json.loads(r['before_json']) if r['before_json'] else None,'after':json.loads(r['after_json'])} for r in c.execute('SELECT * FROM wh_events WHERE collection=? ORDER BY id DESC LIMIT 100',(collection,))]
 @app.post('/api/warehouse/issues')
 def issue(body:Issue,request:Request):
  u=identity(request)
  with connect(path) as c:c.execute('INSERT INTO wh_issues(collection,sku,reason,actor,at) VALUES(?,?,?,?,?)',(body.collection,body.sku,body.reason,u['username'],now()))
  return {'ok':True}
 @app.get('/api/warehouse/issues')
 def issues(request:Request,collection:str):
  u=identity(request)
  with connect(path) as c:return [dict(r) for r in c.execute('SELECT * FROM wh_issues WHERE collection=? AND (?=\'owner\' OR actor=?) ORDER BY id DESC LIMIT 100',(collection,u['role'],u['username']))]
 @app.post('/api/warehouse/issues/{iid}/resolve')
 def resolve(iid:int,body:Resolve,request:Request):
  u=identity(request,True)
  with connect(path) as c:
   if not c.execute('SELECT 1 FROM wh_issues WHERE id=?',(iid,)).fetchone():raise HTTPException(404,'Report not found.')
   c.execute('UPDATE wh_issues SET status=\'resolved\',note=? WHERE id=?',(u['username']+': '+body.note,iid))
  return {'ok':True}
