import io,csv,json
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.accounts import add_account
from app.database import connect
from app.warehouse import demo_items,match,COLLECTIONS,parse_sheet

H={'X-Shop-Request':'1'}
PW='warehouse-test-password'
@pytest.fixture
def setup(tmp_path):
 path=tmp_path/'warehouse.sqlite3'
 with TestClient(create_app(path,seed_demo=True)) as c:
  add_account(path,'owner',PW,role='owner');add_account(path,'staff',PW)
  login(c);yield c,path
def login(c,name='owner'):
 r=c.post('/api/auth/login',headers=H,json={'username':name,'password':PW});assert r.status_code==200
def post(c,url,p=None):return c.post('/api/warehouse'+url,headers=H,json=p or {})
def search(c,q='Blue T-shirt',collection='clothing'):
 r=post(c,'/search',{'collection':collection,'query':q});assert r.status_code==200,r.text;return r.json()
def items(c,collection='clothing'):return c.get('/api/warehouse/items',params={'collection':collection}).json()
def clean(p):return {k:([{kk:vv for kk,vv in l.items() if kk!='code'} for l in v] if k=='placements' else v) for k,v in p.items() if k not in ['revision','updated_at','updated_by']}
def save(c,p,revision):return c.put('/api/warehouse/items',headers=H,json={'item':clean(p),'revision':revision,'reason':'Checked in test'})
def sheet(c,data,filename='items.csv'):
 r=c.post('/api/warehouse/imports?collection=clothing&filename='+filename,headers=H,content=data);assert r.status_code==200,r.text
 raw=r.json();r=post(c,'/imports/'+raw['token']+'/preview',{'mapping':{k:k for k in raw['columns']}});assert r.status_code==200,r.text;return r.json()

@pytest.mark.parametrize('pack',COLLECTIONS,ids=lambda p:p['id'])
def test_four_catalogues_and_bilingual_examples(pack):
 import re
 records=[p for p in demo_items() if p['collection']==pack['id']]
 assert len(records)==8
 for query in [pack['example'],pack['hint']]:
  for q in re.split(r'\s+(?:and|और)\s+',query):assert len(match(q,records,pack['id']))==1,q

def test_multi_item_ambiguity_no_guess_and_clarification(setup):
 c,path=setup;t=search(c,'blue T-shirt and black jeans size 32 and purple toaster')
 assert len(t['lines'])==3
 assert len(t['lines'][0]['candidates'])==2 and t['lines'][0]['selected'] is None
 assert t['lines'][1]['selected']['sku']=='CLO-004'
 assert t['lines'][2]['candidates']==[]
 r=post(c,f"/tasks/{t['id']}/clarify",{'line':0,'reply':'size M'})
 assert r.status_code==200,r.text
 assert r.json()['lines'][0]['selected']['sku']=='CLO-001'
 assert c.get('/api/warehouse/issues?collection=clothing').json()==[] # no automatic reports from searches

def test_hard_constraints_and_unknown_words_not_ignored(setup):
 c,_=setup
 for q in ['blue T-shirt size XXL','blue T-shirt waterproof','black jeans size 33','CLO-001 size XXL']:
  assert search(c,q)['lines'][0]['candidates']==[]
 assert search(c,'where is CLO-001')['lines'][0]['selected']['sku']=='CLO-001'
 assert search(c,'I need a blue t shirt in medium')['lines'][0]['selected']['sku']=='CLO-001'
 assert search(c,'मुझे नीली टीशर्ट एम चाहिए')['lines'][0]['selected']['sku']=='CLO-001'

def test_scan_order_mismatch_and_stale_record(setup):
 c,_=setup;t=search(c,'CLO-001');line=t['lines'][0];url=f"/tasks/{t['id']}/scan"
 assert post(c,url,{'line':0,'kind':'location','value':line['location']['code']}).status_code==409
 assert post(c,url,{'line':0,'kind':'product','value':'CLO-002'}).status_code==409
 assert post(c,url,{'line':0,'kind':'product','value':'CLO-001'}).json()['lines'][0]['product_scanned']
 assert post(c,url,{'line':0,'kind':'location','value':'BAD'}).status_code==409
 result=post(c,url,{'line':0,'kind':'location','value':line['location']['code']}).json()
 assert result['lines'][0]['complete'] and result['lines'][0]['confirmation']=='barcode'
 p=line['selected'];p['name']='Changed T-shirt';assert save(c,p,p['revision']).status_code==200
 assert post(c,url,{'line':0,'kind':'manual','value':'yes'}).status_code==409
 assert post(c,f"/tasks/{t['id']}/speak").status_code==409

def test_move_revision_confirmation_history_and_replay(setup):
 c,path=setup;p=items(c)[0];source=p['placements'][0];destination={k:v for k,v in source.items() if k!='code'};destination['rack']='Z'
 body={'collection':'clothing','sku':p['sku'],'revision':p['revision'],'source':source['code'],'destination':destination,'reason':'Physical shelf checked'}
 r=post(c,'/moves/preview',body);assert r.status_code==200,r.text;token=r.json()['token']
 assert next(x for x in items(c) if x['sku']==p['sku'])['placements'][0]['rack']==source['rack']
 result=post(c,'/moves/'+token+'/confirm');assert result.status_code==200,result.text
 assert result.json()['placements'][0]['rack']=='Z'
 assert post(c,'/moves/'+token+'/confirm').status_code==410
 h=c.get('/api/warehouse/history?collection=clothing').json()[0]
 assert h['actor']=='owner' and h['before']['placements'][0]['rack']==source['rack'] and h['after']['placements'][0]['rack']=='Z'
 with connect(path) as db:assert json.loads(db.execute('SELECT payload FROM wh_items WHERE collection=? AND sku=?',('clothing',p['sku'])).fetchone()[0])['placements'][0]['rack']=='Z'

def test_owner_only_mutations_and_private_sessions(setup):
 c,_=setup;t=search(c,'CLO-001');p=items(c)[0]
 data=c.get('/api/warehouse/export?collection=clothing').content;preview=sheet(c,data)
 login(c,'staff')
 assert save(c,p,p['revision']).status_code==403
 assert post(c,'/imports/'+preview['token']+'/confirm').status_code==403
 assert post(c,'/tasks/'+t['id']+'/scan',{'line':0,'kind':'manual','value':'yes'}).status_code==404
 assert c.get('/api/warehouse/history?collection=clothing').status_code==403
 assert post(c,'/issues',{'collection':'clothing','sku':p['sku'],'reason':'Location is empty'}).status_code==200
 assert search(c,'CLO-001')['lines'][0]['selected']

def test_import_roundtrip_no_deletion_and_conflict_atomicity(setup):
 c,_=setup;data=c.get('/api/warehouse/export?collection=clothing').content
 preview=sheet(c,data);assert preview['counts']['unchanged']==8 and not preview['errors']
 assert post(c,'/imports/'+preview['token']+'/confirm').status_code==200
 grid=list(csv.reader(io.StringIO(data.decode('utf-8-sig'))));grid[1][grid[0].index('rack')]='NEW'
 out=io.StringIO();w=csv.writer(out);w.writerows(grid[:2]);preview=sheet(c,out.getvalue().encode())
 assert preview['counts']['update']==1
 p=next(p for p in items(c) if p['sku']==grid[1][0]);p['name']='Latest owner correction';assert save(c,p,p['revision']).status_code==200
 assert post(c,'/imports/'+preview['token']+'/confirm').status_code==409
 assert len(items(c))==8
 assert next(x for x in items(c) if x['sku']==p['sku'])['name']=='Latest owner correction'

def test_xlsx_export_preserves_text_and_imports(setup):
 c,_=setup
 data=c.get('/api/warehouse/export?collection=clothing&format=xlsx').content
 headers,grid=parse_sheet(data,'a.xlsx');assert grid[0]['bin'] in ['01','02','03','04','05','06','07','08']
 preview=sheet(c,data,'a.xlsx');assert preview['counts']['unchanged']==8

def test_bad_sheet_formulas_duplicate_sku_and_duplicate_barcode(setup):
 c,_=setup
 from openpyxl import Workbook
 b=Workbook();b.active.append(['sku','name']);b.active.append(['x','=1+1']);out=io.BytesIO();b.save(out)
 assert c.post('/api/warehouse/imports?collection=clothing&filename=x.xlsx',headers=H,content=out.getvalue()).status_code==422
 assert c.post('/api/warehouse/imports?collection=clothing&filename=x.csv',headers=H,content=b'sku,sku\na,b').status_code==422
 data=c.get('/api/warehouse/export?collection=clothing').content
 grid=list(csv.reader(io.StringIO(data.decode('utf-8-sig'))));grid[2][0]=grid[1][0]
 out=io.StringIO();csv.writer(out).writerows(grid);preview=sheet(c,out.getvalue().encode());assert preview['errors']
 assert post(c,'/imports/'+preview['token']+'/confirm').status_code==422

def test_multiple_locations_require_choice_and_imports_persist(setup):
 c,path=setup;p=next(x for x in items(c) if x['sku']=='CLO-001');extra=dict(p['placements'][0]);extra['bin']='99';p['placements'].append(extra)
 assert save(c,p,p['revision']).status_code==200
 t=search(c,'CLO-001');assert t['lines'][0]['selected'] is None and len(t['lines'][0]['candidates'])==1
 locations=t['lines'][0]['candidates'][0]['placements']
 result=post(c,'/tasks/'+t['id']+'/choose',{'line':0,'sku':'CLO-001','location':locations[1]['code']})
 assert result.json()['lines'][0]['location']['bin']=='99'
 with TestClient(create_app(path,seed_demo=True)) as restarted:
  login(restarted);assert len(next(x for x in items(restarted) if x['sku']=='CLO-001')['placements'])==2

def test_demo_flag_cannot_be_silently_changed(setup):
 c,_=setup;p=items(c)[0];p['synthetic']=False
 assert save(c,p,p['revision']).status_code==422

def test_voice_move_parser_does_not_save(setup):
 c,_=setup;p=items(c)[0];l=p['placements'][0]
 r=post(c,'/moves/parse',{'collection':'clothing','sku':p['sku'],'source':l['code'],'transcript':'rack Z shelf 7 bin 09'})
 assert r.status_code==200 and r.json()['destination']['bin']=='09'
 assert next(x for x in items(c) if x['sku']==p['sku'])['revision']==p['revision']

def test_old_export_cannot_overwrite_newer_changes(setup):
 c,_=setup;old_export=c.get('/api/warehouse/export?collection=clothing').content
 p=items(c)[0];p['name']='New current name';assert save(c,p,p['revision']).status_code==200
 preview=sheet(c,old_export);assert any('stale' in e['message'] for e in preview['errors'])
 assert post(c,'/imports/'+preview['token']+'/confirm').status_code==422

def test_voice_response_uses_stored_locations_and_language(setup,monkeypatch):
 c,_=setup;captured={}
 async def fake_speak(text,language):captured.update(text=text,language=language);return b'RIFFtest'
 monkeypatch.setattr('app.warehouse.voice.speak',fake_speak)
 r=post(c,'/search',{'collection':'clothing','query':'CLO-001','language':'hi-IN'}).json()
 response=post(c,'/tasks/'+r['id']+'/speak')
 assert response.status_code==200 and response.headers['content-type']=='audio/wav'
 assert captured['language']=='hi-IN' and 'CLO-001' in captured['text'] and 'रैक A' in captured['text']

def test_catalogue_segmentation_without_conjunctions(setup):
 c,path=setup
 for query in ('red dress loafer table fan','table fan red dress and loafer'):
  task=search(c,query,'all')
  assert len(task['lines'])==3,task
  assert all(line['candidates'] for line in task['lines'])
 assert not search(c,'red dress unknownthing','all')['lines'][0]['candidates']

def test_warehouse_photo_persists_and_rejects_external_urls(setup):
 c,path=setup;p=items(c)[0]
 media=c.post('/api/media',headers={**H,'Content-Type':'image/png'},content=b'\x89PNG\r\n\x1a\nphoto-fixture').json()['url']
 p['photo_url']=media
 result=save(c,p,p['revision']);assert result.status_code==200,result.text
 saved=next(x for x in items(c) if x['sku']==p['sku'])
 assert saved['photo_url']==media
 saved['photo_url']='https://external.example/tracking.png'
 assert save(c,saved,saved['revision']).status_code==422
 login(c,'staff')
 assert c.post('/api/media',headers=H,content=b'bad').status_code==403
 assert c.get(media).status_code==200

def test_location_check_is_explicit_repeatable_and_not_a_report(setup):
 c,path=setup
 t=search(c,'CLO-001')
 assert t['lines'][0]['location_feedback'] is None
 assert t['lines'][0]['last_confirmed_at'] is None
 assert c.get('/api/warehouse/issues').json()==[]
 result=post(c,f"/tasks/{t['id']}/location-check",{'line':0})
 assert result.status_code==200,result.text
 line=result.json()['lines'][0]
 assert line['location_feedback']['status']=='correct'
 assert line['last_confirmed_at']
 assert post(c,f"/tasks/{t['id']}/location-check",{'line':0}).json()['lines'][0]['location_feedback']==line['location_feedback']
 assert c.get('/api/warehouse/issues').json()==[]
 with connect(path) as db:
  assert db.execute('SELECT count(*) FROM wh_location_checks').fetchone()[0]==1
 t2=search(c,'CLO-001')
 assert t2['lines'][0]['last_confirmed_at']==line['last_confirmed_at']
 assert t2['lines'][0]['complete'] is False

def test_wrong_location_report_only_on_submit_and_owner_move_resolves(setup):
 c,_=setup
 t=search(c,'CLO-001')
 line=t['lines'][0]
 src=line['location']
 assert c.get('/api/warehouse/issues').json()==[]
 payload={'kind':'wrong_location','collection':'clothing','sku':line['selected']['sku'],'location_code':src['code'],'reason':'Item not on the recorded shelf','suggested_location':'Rack Z'}
 issue=post(c,'/issues',payload)
 assert issue.status_code==200,issue.text
 assert issue.json()['status']=='open'
 assert post(c,'/issues',payload).json()['already_reported'] is True
 assert len(c.get('/api/warehouse/issues').json())==1
 assert search(c,'CLO-001')['lines'][0]['location_report_open'] is True
 p=line['selected'];destination={k:v for k,v in src.items() if k!='code'}
 destination['rack']='Z'
 preview=post(c,'/moves/preview',{'collection':'clothing','sku':p['sku'],'revision':p['revision'],'source':src['code'],'destination':destination,'reason':'Physically verified new shelf'})
 assert preview.status_code==200,preview.text
 moved=post(c,'/moves/'+preview.json()['token']+'/confirm')
 assert moved.status_code==200,moved.text
 issues=c.get('/api/warehouse/issues').json()
 assert len(issues)==1 and issues[0]['status']=='resolved'
 assert 'Verified new location' in issues[0]['note']
 new=search(c,'CLO-001')['lines'][0]
 assert new['location']['rack']=='Z'
 assert new['last_confirmed_at'] is None
 assert new['location_report_open'] is False

def test_location_feedback_does_not_allow_stale_or_ambiguous_items(setup):
 c,_=setup
 ambiguous=search(c,'blue T-shirt')
 assert post(c,f"/tasks/{ambiguous['id']}/location-check",{'line':0}).status_code==409
 t=search(c,'CLO-001')
 p=t['lines'][0]['selected']
 p['name']='Revised item name'
 assert save(c,p,p['revision']).status_code==200
 assert post(c,f"/tasks/{t['id']}/location-check",{'line':0}).status_code==409
