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

@pytest.mark.parametrize('pack',[p for p in COLLECTIONS if p['id']!='grocery'],ids=lambda p:p['id'])
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

def test_clean_new_install_does_not_seed_synthetic_inventory_by_default(tmp_path, monkeypatch):
 monkeypatch.delenv('SHOP_FINDER_SEED_DEMO',raising=False)
 path=tmp_path/'production-fresh.sqlite3'
 with TestClient(create_app(path)) as app_client:
  add_account(path,'owner',PW,role='owner')
  login(app_client)
  response=app_client.get('/api/warehouse/items')
  assert response.status_code==200
  assert response.json()==[]
  assert app_client.get('/api/warehouse/meta').json()['collections'][0]['count']==0
 # Opt-in synthetic test mode is additive and existing records survive a clean restart.
 with TestClient(create_app(path,seed_demo=True)) as test_client:
  login(test_client)
  assert len(test_client.get('/api/warehouse/items').json())==32
 with TestClient(create_app(path)) as restarted:
  login(restarted)
  assert len(restarted.get('/api/warehouse/items').json())==32


@pytest.fixture
def grocery_catalogue(setup):
 """A real CSV import, not hardcoded search results or Gnani mocks."""
 c,_=setup
 records=[
  ['GRC-002','Basmati rice 5 kg bag','basmati|long grain rice|बासमती चावल','5 kg'],
  ['GRC-003','Basmati rice 10 kg bag','basmati|long grain rice|बासमती चावल','10 kg'],
  ['GRC-009','Toor dal 1 kg','tur dal|arhar dal|तूर दाल','1 kg'],
  ['GRC-024','Tea leaves 500 g','chai patti|चाय पत्ती','500 g'],
  ['GRC-017','White sugar 1 kg','cheeni|चीनी','1 kg'],
  ['GRC-027','Packaged drinking water 500 mL','water bottle|पानी की बोतल','500 ml'],
 ]
 headers=['sku','collection','name','brand','category','barcode','aliases',
          'synthetic','facility','zone','aisle','rack','shelf','bin','quantity','size']
 out=io.StringIO()
 w=csv.writer(out);w.writerow(headers)
 for n,(sku,name,aliases,size) in enumerate(records,1):
  w.writerow([sku,'grocery',name,'Warehouse Test', 'Grocery', 'TEST-'+sku,aliases,
              'true','Grocery Test Warehouse','Dry Goods','A01','R01','02',
              str(n).zfill(2),'20',size])
 result=c.post('/api/warehouse/imports?collection=grocery&filename=groceries.csv',
               headers=H,content=out.getvalue().encode('utf-8'))
 assert result.status_code==200,result.text
 uploaded=result.json()
 mapping={k:k for k in headers if k in uploaded['fields']}
 preview=post(c,f"/imports/{uploaded['token']}/preview",{'mapping':mapping})
 assert preview.status_code==200,preview.text
 assert preview.json()['counts']['create']==len(records),preview.text
 assert not preview.json()['errors'],preview.json()['errors']
 confirmed=post(c,f"/imports/{preview.json()['token']}/confirm")
 assert confirmed.status_code==200,confirmed.text
 return c

@pytest.mark.parametrize('language,query,sku',[
 ('en-IN','where is basmati rice 5 kg','GRC-002'),
 ('hi-IN','मुझे बासमती चावल पाँच किलो कहाँ मिलेगा','GRC-002'),
 ('hi-en','mujhe basmati chawal 5 kilo kidhar hai','GRC-002'),
 ('hi-IN','बासमती चावल ५ किलो चाहिए','GRC-002'),
 ('hi-en','basmati chawal das kilo kahan rakha hai','GRC-003'),
 ('hi-IN','तूर दाल एक किलो कहाँ है','GRC-009'),
 ('hi-en','toor daal ek kilo kidhar milega','GRC-009'),
 ('en-IN','tea leaves 500 g','GRC-024'),
 ('hi-IN','चाय पत्ती 500 ग्राम कहाँ रखी है','GRC-024'),
 ('hi-en','chai patti 500 gram kidhar hai','GRC-024'),
 ('hi-IN','चीनी एक किलो कहाँ है','GRC-017'),
 ('hi-en','cheeni ek kilo kidhar rakhi hai','GRC-017'),
 ('hi-IN','पानी की 500 मिलीलीटर बोतल','GRC-027'),
 ('hi-en','pani ki 500 ml bottle','GRC-027'),
])
def test_grocery_import_matches_english_hindi_hinglish_same_sku(grocery_catalogue,language,query,sku):
 c=grocery_catalogue
 response=post(c,'/search',{'collection':'grocery','query':query,'language':language})
 assert response.status_code==200,response.text
 lines=response.json()['lines']
 assert len(lines)==1,lines
 assert [p['sku'] for p in lines[0]['candidates']]==[sku],lines[0]
 assert lines[0]['selected']['sku']==sku
 assert lines[0]['location']['rack']=='R01'
 assert response.json()['language']==language

@pytest.mark.parametrize('language,query',[
 ('en-IN','basmati rice'),('hi-IN','बासमती चावल'),
 ('hi-en','basmati chawal kidhar hai')
])
def test_ambiguous_basmati_pack_requires_clarification(grocery_catalogue,language,query):
 c=grocery_catalogue
 line=post(c,'/search',{'collection':'grocery','query':query,'language':language}).json()['lines'][0]
 assert {p['sku'] for p in line['candidates']}=={'GRC-002','GRC-003'}
 assert line['selected'] is None
 assert line['location'] is None

@pytest.mark.parametrize('query',[
 'बासमती चावल आठ किलो', 'basmati chawal 8 kilo',
 'बासमती चावल एक्स्ट्रा स्पेशल', 'pani 750 ml bottle',
])
def test_unsupported_hindi_or_hinglish_detail_must_not_guess(grocery_catalogue,query):
 c=grocery_catalogue
 line=post(c,'/search',{'collection':'grocery','query':query,'language':'hi-en'}).json()['lines'][0]
 assert not line['candidates']
 assert line['selected'] is None

def test_multilingual_multiple_items_keep_independent_locations(grocery_catalogue):
 c=grocery_catalogue
 response=post(c,'/search',{'collection':'grocery',
                           'query':'तूर दाल १ किलो और चाय पत्ती ५०० ग्राम',
                           'language':'hi-IN'})
 assert response.status_code==200,response.text
 lines=response.json()['lines']
 assert [line['selected']['sku'] for line in lines]==['GRC-009','GRC-024']
 assert c.get('/api/warehouse/issues?collection=grocery').json()==[]


def test_grocery_category_is_distinct_and_enabled_by_owner(setup):
 c,_=setup
 meta=c.get('/api/warehouse/meta').json()
 grocery=next(p for p in meta['collections'] if p['id']=='grocery')
 assert grocery['name']=='Grocery Warehouse'
 assert grocery['hi']=='किराना गोदाम'
 assert grocery['count']==0
 assert grocery['fields']==['size','material','capacity_l','colour']
 assert len(meta['collections'])==5
 assert len(items(c,'home'))==8

 settings=c.get('/api/warehouse/settings').json()
 assert 'grocery' in settings['collections']
 original={k:v for k,v in settings.items() if k!='configured'}
 original['name']='Warehouse Five Types'
 original['collections']=['clothing','footwear','appliances','home']
 res=c.put('/api/warehouse/settings',headers=H,json=original)
 assert res.status_code==200,res.text
 # Older organisations retain their choice, rather than silently enabling a new type.
 assert 'grocery' not in c.get('/api/warehouse/settings').json()['collections']
 updated=c.get('/api/warehouse/settings').json()
 body={k:v for k,v in updated.items() if k!='configured'}
 body['collections'].append('grocery')
 res=c.put('/api/warehouse/settings',headers=H,json=body)
 assert res.status_code==200,res.text
 assert 'grocery' in c.get('/api/warehouse/settings').json()['collections']
 assert len(c.get('/api/warehouse/items?collection=home').json())==8

 product={'sku':'GRC-201','collection':'grocery','name':'Basmati rice 5 kg bag',
          'category':'Rice & grains','brand':'Warehouse Test',
          'aliases':['basmati chawal','बासमती चावल'],'barcode':'TEST-GROC-201',
          'specs':{'size':'5 kg','material':'Woven sack'},
          'placements':[{'facility':'Central Warehouse','zone':'Dry Staples',
                         'aisle':'A01','rack':'R01','shelf':'02','bin':'04','quantity':25}],
          'synthetic':True}
 saved=save(c,product,0)
 assert saved.status_code==200,saved.text
 result=search(c,'बासमती चावल ५ किलो','grocery')['lines'][0]
 assert result['selected']['sku']=='GRC-201'
 assert result['location']['rack']=='R01'
 assert len(c.get('/api/warehouse/items?collection=grocery').json())==1
 assert len(c.get('/api/warehouse/items?collection=home').json())==8
 assert c.get('/api/warehouse/export?collection=grocery').status_code==200

@pytest.mark.parametrize('language,utterance',[
 ('hi-IN','ब्राउन लोफर्स कहाँ हैं'),
 ('hi-IN','ब्राउन लोफर कहाँ है'),
 ('hi-IN','भूरे लोफर्स कहाँ रखे हैं'),
 ('hi-IN','मुझे ब्राउन लोफर्स साइज़ आठ चाहिए'),
 ('hi-en','brown lofers kidhar hain'),
 ('hi-en','mujhe brown loafers size 8 chahiye'),
 ('en-IN','where are the brown loafers'),
])
def test_brown_loafers_voice_transcripts_find_same_verified_item(setup,language,utterance):
 c,_=setup
 response=post(c,'/search',{'collection':'footwear','query':utterance,'language':language})
 assert response.status_code==200,response.text
 lines=response.json()['lines']
 assert len(lines)==1,lines
 assert [p['sku'] for p in lines[0]['candidates']]==['SHO-006'],lines[0]
 assert lines[0]['selected']['sku']=='SHO-006'
 assert lines[0]['location'] and lines[0]['location']['rack']
 assert c.get('/api/warehouse/issues?collection=footwear').json()==[]

@pytest.mark.parametrize('utterance',[
 'ब्राउन लोफर्स साइज़ 9 कहाँ हैं',
 'brown loafers size 9 kidhar hain',
 'नीले लोफर्स कहाँ हैं',
 'ब्राउन लोफर्स वाटरप्रूफ कहाँ हैं',
])
def test_footwear_speech_does_not_guess_wrong_variant(setup,utterance):
 c,_=setup
 result=post(c,'/search',{'collection':'footwear','query':utterance,'language':'hi-IN'})
 assert result.status_code==200,result.text
 line=result.json()['lines'][0]
 assert line['candidates']==[]
 assert line['selected'] is None
 assert line['location'] is None

def test_brown_loafers_search_still_works_across_all_enabled_categories(setup):
 c,_=setup
 result=post(c,'/search',{'collection':'all','query':'ब्राउन लोफर्स कहाँ हैं','language':'hi-IN'})
 assert result.status_code==200,result.text
 line=result.json()['lines'][0]
 assert line['selected'] and line['selected']['collection']=='footwear'
 assert line['selected']['sku']=='SHO-006'


# Systematic multilingual coverage: all four preloaded product catalogues,
# not just one observed Hindi query. Each candidate is checked against the
# entire category and both language modes, including distinct size/colour specs.
MULTILINGUAL_FIXTURE_QUERIES = {
 'CLO-001': ('नीली टीशर्ट साइज़ एम','neeli t shirt size m'),
 'CLO-002': ('नीली टीशर्ट साइज़ एल','neeli t shirt size l'),
 'CLO-003': ('सफेद टीशर्ट साइज़ एम','safed t shirt size m'),
 'CLO-004': ('काली जीन्स साइज़ 32','kali jeans size 32'),
 'CLO-005': ('काली जीन्स साइज़ 34','kali jeans size 34'),
 'CLO-006': ('हरी हुडी साइज़ एल','hari hoodie size l'),
 'CLO-007': ('बेज ट्राउजर्स साइज़ 32','beige trousers size 32'),
 'CLO-008': ('लाल ड्रेस साइज़ एस','lal dress size s'),
 'SHO-001': ('सफेद ट्रेनर्स साइज़ 7','safed trainers size 7'),
 'SHO-002': ('सफेद ट्रेनर्स साइज़ 8','safed trainers size 8'),
 'SHO-003': ('काली सैंडल साइज़ 6','kali sandals size 6'),
 'SHO-004': ('काली सैंडल साइज़ 7','kali sandals size 7'),
 'SHO-005': ('नीले रनिंग शूज साइज़ 9','neele running shoes size 9'),
 'SHO-006': ('ब्राउन लोफर्स साइज़ 8','brown loafers size 8'),
 'SHO-007': ('गुलाबी चप्पल साइज़ 5','gulabi chappal size 5'),
 'SHO-008': ('ग्रे ट्रेनर्स साइज़ 6','grey trainers size 6'),
 'APP-001': ('मिक्सर ग्राइंडर 750 वाट','mixer grinder 750 watt'),
 'APP-002': ('मिक्सर ग्राइंडर 500 वाट','mixer grinder 500 watt'),
 'APP-003': ('इलेक्ट्रिक केतली 1500 वाट','electric ketli 1500 watt'),
 'APP-004': ('इलेक्ट्रिक केतली 1800 वाट','electric ketli 1800 watt'),
 'APP-005': ('स्टीम इस्त्री 1200 वाट','steam istri 1200 watt'),
 'APP-006': ('टेबल पंखा 55 वाट','table pankha 55 watt'),
 'APP-007': ('टोस्टर 800 वाट','toaster 800 watt'),
 'APP-008': ('राइस कुकर 700 वाट','rice cooker 700 watt'),
 'HOM-001': ('स्टोरेज बॉक्स 20 लीटर','storage box 20 litre'),
 'HOM-002': ('स्टोरेज बॉक्स 40 लीटर','storage box 40 litre'),
 'HOM-003': ('सूती तौलिया','sooti toliya'),
 'HOM-004': ('स्टील पानी की बोतल एक लीटर','steel water bottle 1 litre'),
 'HOM-005': ('डिनर प्लेट सेट','dinner plate set'),
 'HOM-006': ('लॉन्ड्री बास्केट','laundry basket'),
 'HOM-007': ('सूती चादर','sooti chadar'),
 'HOM-008': ('कुशन कवर','cushion cover'),
}

@pytest.mark.parametrize('sku',MULTILINGUAL_FIXTURE_QUERIES)
def test_every_catalogue_item_matches_hindi_and_hinglish_with_variant_safety(sku):
 products=list(demo_items())
 item=next(p for p in products if p['sku']==sku)
 group=[p for p in products if p['collection']==item['collection']]
 # Corpus-level comparison catches an unintended second SKU for the same phrase.
 for text in MULTILINGUAL_FIXTURE_QUERIES[sku]:
  results=match(text,group,item['collection'])
  assert [p['sku'] for p in results]==[sku],(sku,text,[p['sku'] for p in results])

def test_imported_unfamiliar_item_requires_owner_provided_language_alias():
 products=[dict(sku='CUSTOM-01',collection='home',name='Ash gourd storage jar',
   category='Jars',brand='Local Manufacturer',
   aliases=['पेठा रखने का मर्तबान','petha rakhne ka martbaan'],
   barcode='TEST-CUSTOM-01',specs={'size':'large'},
   placements=[{'rack':'B','shelf':'02','bin':'04'}])]
 for phrase in ['पेठा रखने का मर्तबान','petha rakhne ka martbaan']:
  assert [p['sku'] for p in match(phrase,products,'home')]==['CUSTOM-01']
 assert match('साबुत राई का जार',products,'home')==[]

def test_multilingual_request_does_not_guess_unmatched_product_or_variant():
 products=list(demo_items())
 for text in ['नीली टीशर्ट साइज़ XXL','गलत ब्राउन लोफर्स 9','टेबल पंखा 999 वाट','नीली टीशर्ट waterproof']:
  result=match(text,products,'all')
  assert not result,(text,[p['sku'] for p in result])


# The complete 40-item grocery pilot, in both modes. This is a stand-in
# for imported names/aliases and tests the matching algorithm against the
# FULL catalogue, not one selected item. Physical placements are never inferred.
GROCERY_VOICE_CORPUS = [
 ('Sona masoori rice 5 kg bag','सोना मसूरी चावल 5 किलो','sona masoori chawal 5 kilo','sona masoori'),
 ('Basmati rice 5 kg bag','बासमती चावल 5 किलो','basmati chawal 5 kilo','basmati'),
 ('Basmati rice 10 kg bag','बासमती चावल 10 किलो','basmati chawal 10 kilo','basmati'),
 ('Whole wheat atta 5 kg','गेहूं का आटा 5 किलो','gehun ka atta 5 kilo','wheat flour'),
 ('Maida flour 1 kg','मैदा 1 किलो','maida 1 kilo','refined flour'),
 ('Rava semolina 1 kg','सूजी 1 किलो','suji 1 kilo','sooji'),
 ('Poha flattened rice 1 kg','पोहा 1 किलो','poha 1 kilo','avalakki'),
 ('Rolled oats 1 kg','ओट्स 1 किलो','oats 1 kilo','rolled oats'),
 ('Toor dal 1 kg','तूर दाल 1 किलो','toor dal 1 kilo','arhar dal'),
 ('Toor dal 5 kg','तूर दाल 5 किलो','toor dal 5 kilo','arhar dal'),
 ('Moong dal 1 kg','मूंग दाल 1 किलो','moong dal 1 kilo','yellow moong'),
 ('Urad dal 1 kg','उड़द दाल 1 किलो','urad dal 1 kilo','black gram'),
 ('Chana dal 1 kg','चना दाल 1 किलो','chana dal 1 kilo','split chickpea'),
 ('Kabuli chana 1 kg','काबुली चना 1 किलो','kabuli chana 1 kilo','chickpeas'),
 ('Rajma red kidney beans 1 kg','राजमा 1 किलो','rajma 1 kilo','kidney beans'),
 ('White sugar 1 kg','सफेद चीनी 1 किलो','safed cheeni 1 kilo','cheeni'),
 ('Iodised salt 1 kg','आयोडीन नमक 1 किलो','namak 1 kilo','iodised salt'),
 ('Turmeric powder 200 g','हल्दी पाउडर 200 ग्राम','haldi powder 200 gram','haldi'),
 ('Red chilli powder 200 g','लाल मिर्च पाउडर 200 ग्राम','lal mirch powder 200 gram','mirchi'),
 ('Coriander powder 200 g','धनिया पाउडर 200 ग्राम','dhania powder 200 gram','dhania'),
 ('Cumin seeds 100 g','जीरा दाना 100 ग्राम','jeera 100 gram','jeera'),
 ('Black pepper 100 g','काली मिर्च 100 ग्राम','kali mirch 100 gram','kali mirch'),
 ('Garam masala 100 g','गरम मसाला 100 ग्राम','garam masala 100 gram','mixed spice'),
 ('Tea leaves 500 g','चाय पत्ती 500 ग्राम','chai patti 500 gram','tea powder'),
 ('Instant coffee 100 g jar','इंस्टेंट कॉफी 100 ग्राम','instant coffee 100 gram','coffee'),
 ('Packaged drinking water 1 L','पानी की बोतल एक लीटर','pani ki botal ek litre','water bottle'),
 ('Packaged drinking water 500 mL','पानी की बोतल आधा लीटर','pani ki botal 500 ml','water bottle'),
 ('Mango fruit drink 1 L','आम का जूस एक लीटर','aam ka juice ek litre','mango juice'),
 ('Sunflower cooking oil 1 L','सूरजमुखी का तेल एक लीटर','surajmukhi ka tel ek litre','sunflower oil'),
 ('Mustard cooking oil 1 L','सरसों का तेल एक लीटर','sarson ka tel ek litre','mustard oil'),
 ('Instant noodles pack 70 g','इंस्टेंट नूडल्स 70 ग्राम','instant noodles 70 gram','noodles'),
 ('Salted potato chips 100 g','आलू चिप्स 100 ग्राम','aloo chips 100 gram','chips'),
 ('Masala namkeen 200 g','मसाला नमकीन 200 ग्राम','masala namkeen 200 gram','mixture'),
 ('Marie biscuits 250 g','मारी बिस्कुट 250 ग्राम','marie biscuits 250 gram','tea biscuits'),
 ('Oat cookies 200 g','ओट्स कुकीज़ 200 ग्राम','oats cookies 200 gram','oat biscuits'),
 ('Dishwashing liquid 500 mL','बर्तन धोने का साबुन 500 मिलीलीटर','bartan dhone ka sabun 500 ml','dish liquid'),
 ('Laundry detergent powder 1 kg','कपड़े धोने का पाउडर 1 किलो','kapde dhone ka powder 1 kilo','washing powder'),
 ('Floor cleaner 1 L','फर्श क्लीनर एक लीटर','farsh cleaner ek litre','floor cleaning liquid'),
 ('Kitchen tissue rolls 2 pack','किचन टिशू रोल्स दो पैक','kitchen tissue rolls 2 pack','paper towels'),
 ('Garbage bags 30-count roll','कचरे के बैग 30 रोल','kachre ke bag 30 roll','bin liners'),
]

def test_all_40_grocery_products_can_be_found_in_both_language_modes():
 assert len(GROCERY_VOICE_CORPUS)==40
 import re
 products=[]
 for index,(name,hindi,hinglish,alias) in enumerate(GROCERY_VOICE_CORPUS,1):
  qty=re.search(r'(\d+(?:\.\d+)?)[\s-]*(?:kg|g|ml|l|pack|count)',name,re.I)
  size=(qty.group(0) if qty else '')
  products.append({'collection':'grocery','sku':f'GRC-{index:03d}',
    'name':name,'category':'Grocery products','brand':'Warehouse test',
    'aliases':[alias],'barcode':f'TEST-GRC-{index:03d}',
    'specs':({'size':size,'capacity_l':'1'} if re.search(r'\b1\s*L\b',name) else {'size':size}) if size else {},
    'placements':[{'facility':'Warehouse','rack':'A','shelf':'02','bin':str(index).zfill(2)}]})
 for index,(name,hindi,hinglish,_) in enumerate(GROCERY_VOICE_CORPUS,1):
  sku=f'GRC-{index:03d}'
  for transcript in (hindi,hinglish):
   results=match(transcript,products,'grocery')
   assert [p['sku'] for p in results]==[sku],(sku,transcript,[p['sku'] for p in results])

def test_unrecognised_translated_product_never_invents_location():
 products=list(demo_items())
 for request in ['लेज़र प्रिंटर मशीन', 'mujhe unknown titanium device chahiye',
                 'ब्लैक जीन्स 55', 'चावल 50 किलो']:
  assert match(request,products,'all')==[]


def test_grocery_spelling_variant_and_trailing_punctuation_preserve_safe_matching():
 from app.warehouse_language import normal_query
 item={'collection':'grocery','sku':'GRC-001','name':'Sona masoori rice 5 kg bag',
       'category':'Rice','brand':'Test','aliases':[],'barcode':'','specs':{'size':'5 kg'},
       'placements':[{'facility':'Warehouse','rack':'A','shelf':'02'}]}
 assert [p['sku'] for p in match('Sona Masuri.',[item],'grocery')]==['GRC-001']
 assert [p['sku'] for p in match('sona masoori.',[item],'grocery')]==['GRC-001']
 assert match('Sona Masuri 10 kg',[item],'grocery')==[]
 assert normal_query('1.5 L')=='1.5 l'

@pytest.mark.parametrize('query,alias,language',[
 ('ಅಕ್ಕಿ ಎಲ್ಲಿ ಇದೆ','ಅಕ್ಕಿ','kn-IN'),
 ('அரிசி எங்கே உள்ளது','அரிசி','ta-IN'),
 ('బియ్యం ఎక్కడ ఉంది','బియ్యం','te-IN'),
 ('അരി എവിടെ ഉണ്ട്','അരി','ml-IN'),
 ('तांदूळ कुठे आहे','तांदूळ','mr-IN'),
 ('চাল কোথায় আছে','চাল','bn-IN'),
 ('ચોખા ક્યાં છે','ચોખા','gu-IN'),
 ('ਚਾਵਲ ਕਿੱਥੇ ਹੈ','ਚਾਵਲ','pa-IN'),
])
def test_native_script_alias_matches_only_verified_catalogue_language(setup,query,alias,language):
 c,_=setup
 item=next(p for p in items(c,'grocery') if p['sku']=='GRC-001') if items(c,'grocery') else None
 # Insert a synthetic catalogue record with its native-language alias. No
 # automatic product translation or SKU substitution is permitted.
 from app.warehouse import match
 record={'sku':'SAFE-001','collection':'grocery','name':'Rice','brand':'Test',
         'barcode':'SAFE-001','category':'Rice','aliases':[alias],
         'specs':{'size':'5 kg'}}
 found=match(query,[record],'grocery')
 assert [x['sku'] for x in found]==['SAFE-001']
 assert match('unknown '+query,[record],'grocery')==[]
 assert match(query,[{**record,'aliases':[]}],'grocery')==[]

@pytest.mark.parametrize('number,expected',[
 ('೧೨','12'),('१२','12'),('১২','12'),('૧૨','12'),
 ('੧੨','12'),('௧௨','12'),('౧౨','12'),('൧൨','12')
])
def test_indic_decimal_digits_normalized_without_losing_sku_info(number,expected):
 from app.warehouse_language import normal_query
 assert normal_query('pack '+number)== 'pack '+expected

def test_complex_native_script_tokens_preserve_combining_marks():
 from app.warehouse_language import tokens
 assert 'ಅಕ್ಕಿ' in tokens('ಅಕ್ಕಿ')
 assert 'அரிசி' in tokens('அரிசி')
 assert 'അരി' in tokens('അരി')
 assert 'ਬਿਆਨ' in tokens('ਬਿਆਨ')

@pytest.mark.parametrize('language,label',[
 ('kn-IN','ರ್ಯಾಕ್'),('ta-IN','ரேக்'),('te-IN','ర్యాక్'),
 ('ml-IN','റാക്ക്'),('bn-IN','র্যাক'),('mr-IN','रॅक'),
 ('gu-IN','રેક'),('pa-IN','ਰੈਕ')
])
def test_localized_display_text_is_separate_from_spoken_audio(language,label):
 from app.warehouse import display_task,speak_task
 product={'brand':'Test','name':'Rice','sku':'GRC-001','collection':'grocery'}
 location={'facility':'Main Warehouse','rack':'A01','shelf':'02','bin':'03'}
 task={'language':language,'lines':[{'query':'rice','candidates':[product],'selected':product,'location':location}]}
 displayed=display_task(task)
 spoken=speak_task(task)
 assert label+' A01' in displayed
 assert 'GRC-001' in displayed and 'Main Warehouse' in displayed
 assert label not in spoken
 assert 'rack A01' in spoken

@pytest.mark.parametrize('language',[
 'bn-IN','mr-IN','gu-IN','pa-IN','kn-IN','te-IN','ta-IN','ml-IN'
])
def test_localized_unknown_result_does_not_invent_a_location(language):
 from app.warehouse import display_task
 task={'language':language,'lines':[{'query':'not recorded','candidates':[],'selected':None,'location':None}]}
 text=display_task(task)
 assert 'not recorded' in text
 assert 'A01' not in text

@pytest.mark.parametrize('language,word',[
 ('kn-IN','ರ್ಯಾಕ್'),('ta-IN','ரேக்'),('te-IN','ర్యాక్'),
 ('ml-IN','റാക്ക്'),('bn-IN','র্যাক'),('mr-IN','रॅक'),
 ('gu-IN','રેક'),('pa-IN','ਰੈਕ')
])
def test_warehouse_speech_reads_localized_response_without_inventing_location(setup,monkeypatch,language,word):
 c,path=setup
 captured=[]
 async def fake_speak(text,lang):
  captured.append((text,lang))
  return b'RIFF'+b'0'*10
 monkeypatch.setattr('app.warehouse.voice.speak',fake_speak)
 result=post(c,'/search',{'query':'CLO-001','collection':'clothing','language':language}).json()
 assert result['display_text']!=result['spoken_text']
 assert result['lines'][0]['selected']['sku']=='CLO-001'
 r=c.post('/api/warehouse/tasks/'+result['id']+'/speak',headers=H)
 assert r.status_code==200
 assert captured
 text,lang=captured[0]
 assert lang==language
 assert text==result['display_text']
 assert word in text
 assert 'CLO-001' in text


def test_guided_picking_requires_resolved_items_and_locations(setup):
 c,_=setup
 t=search(c,'blue T-shirt and black jeans size 32')
 url='/tasks/'+t['id']+'/picking/start'
 assert post(c,url).status_code==409
 assert post(c,'/tasks/'+t['id']+'/picking/finish').status_code==409
 assert t['lines'][0]['selected'] is None
 resolved=post(c,'/tasks/'+t['id']+'/clarify',{'line':0,'reply':'size M'})
 assert resolved.status_code==200,resolved.text
 started=post(c,url)
 assert started.status_code==200,started.text
 assert started.json()['picking']['status']=='active'
 assert started.json()['picking']['started_at']
 assert post(c,url).json()['picking']['started_at']==started.json()['picking']['started_at']
 assert post(c,'/tasks/'+t['id']+'/choose',{'line':0,'sku':'CLO-001','collection':'clothing','location':resolved.json()['lines'][0]['location']['code']}).status_code==409
 assert post(c,'/tasks/'+t['id']+'/clarify',{'line':0,'reply':'size L'}).status_code==409

def test_guided_picking_requires_verified_items_and_keeps_stock_unchanged(setup):
 c,path=setup
 original=items(c)
 t=search(c,'CLO-001 and CLO-004')
 assert len(t['lines'])==2 and all(line['selected'] for line in t['lines'])
 assert post(c,'/tasks/'+t['id']+'/picking/start').status_code==200
 assert post(c,'/tasks/'+t['id']+'/picking/finish').status_code==409
 checked=post(c,'/tasks/'+t['id']+'/location-check',{'line':0})
 assert checked.status_code==200
 assert post(c,'/tasks/'+t['id']+'/picking/finish').status_code==409
 first=post(c,'/tasks/'+t['id']+'/scan',{'line':0,'kind':'manual','value':'confirmed'})
 assert first.status_code==200,first.text
 assert first.json()['lines'][0]['confirmation']=='manual'
 assert post(c,'/tasks/'+t['id']+'/picking/finish').status_code==409
 second=t['lines'][1]
 assert post(c,'/tasks/'+t['id']+'/scan',{'line':1,'kind':'location','value':second['location']['code']}).status_code==409
 assert post(c,'/tasks/'+t['id']+'/scan',{'line':1,'kind':'product','value':second['selected']['sku']}).status_code==200
 assert post(c,'/tasks/'+t['id']+'/scan',{'line':1,'kind':'location','value':second['location']['code']}).status_code==200
 finished=post(c,'/tasks/'+t['id']+'/picking/finish')
 assert finished.status_code==200,finished.text
 assert finished.json()['picking']['status']=='completed'
 assert finished.json()['picking']['completed_at']
 assert post(c,'/tasks/'+t['id']+'/picking/finish').json()['picking']==finished.json()['picking']
 assert post(c,'/tasks/'+t['id']+'/scan',{'line':0,'kind':'manual','value':'confirmed'}).status_code==409
 assert items(c)==original
 with TestClient(create_app(path,seed_demo=True)) as restarted:
  login(restarted)
  restored=restarted.get('/api/warehouse/tasks/'+t['id'])
  assert restored.status_code==200 and restored.json()['picking']==finished.json()['picking']

def test_guided_picking_stale_catalogue_and_wrong_scan_cannot_finish(setup):
 c,_=setup
 t=search(c,'CLO-001')
 assert post(c,'/tasks/'+t['id']+'/picking/start').status_code==200
 assert post(c,'/tasks/'+t['id']+'/scan',{'line':0,'kind':'manual','value':'maybe'}).status_code==422
 assert post(c,'/tasks/'+t['id']+'/scan',{'line':0,'kind':'product','value':'WRONG-SKU'}).status_code==409
 assert post(c,'/tasks/'+t['id']+'/picking/finish').status_code==409
 product=t['lines'][0]['selected'];product['name']='Updated product'
 assert save(c,product,product['revision']).status_code==200
 assert post(c,'/tasks/'+t['id']+'/scan',{'line':0,'kind':'manual','value':'confirmed'}).status_code==409
 assert post(c,'/tasks/'+t['id']+'/picking/finish').status_code==409

def test_guided_picking_uses_private_sessions_and_staff_can_pick(setup):
 c,_=setup
 owner_task=search(c,'CLO-001')
 login(c,'staff')
 assert c.get('/api/warehouse/tasks/'+owner_task['id']).status_code==404
 assert post(c,'/tasks/'+owner_task['id']+'/picking/start').status_code==404
 staff_task=search(c,'CLO-004')
 assert post(c,'/tasks/'+staff_task['id']+'/picking/start').status_code==200
 assert c.get('/api/warehouse/tasks/'+staff_task['id']).json()['picking']['status']=='active'
 assert post(c,'/tasks/'+staff_task['id']+'/scan',{'line':0,'kind':'manual','value':'confirmed'}).status_code==200
 assert post(c,'/tasks/'+staff_task['id']+'/picking/finish').status_code==200
 login(c,'owner')
 assert c.get('/api/warehouse/tasks/'+staff_task['id']).status_code==404

@pytest.mark.parametrize('spoken,expected',[
 ('next item','next'),('Next one','next'),('अगला सामान','next'),
 ('repeat location','repeat'),('जगह दोहराओ','repeat'),
 ('found it','verify'),('मिल गया','verify'),
 ('wrong shelf','report'),('गलत जगह','report'),
 ('stop','stop'),('रुको','stop'),('help','help'),
 ('not found','unknown'),('found it then next','unknown'),('finish picking','unknown'),
 ('confirmed','unknown'),('delete all products','unknown')
])
def test_pick_voice_command_grammar_is_strict(spoken,expected):
 from app.warehouse_voice_guide import intent
 assert intent(spoken)==expected

def test_voice_pick_guidance_no_state_mutation_and_explicit_verification(setup,monkeypatch):
 c,_=setup
 t=search(c,'CLO-001 and CLO-004')
 url='/tasks/'+t['id']+'/picking/command'
 assert post(c,url,{'transcript':'next item','line':0}).status_code==409
 assert post(c,'/tasks/'+t['id']+'/picking/start').status_code==200
 before=c.get('/api/warehouse/tasks/'+t['id']).json()
 r=post(c,url,{'transcript':'next item','line':0})
 assert r.status_code==200,r.text
 result=r.json()
 assert result['action']=='next' and result['line'] in (0,1)
 assert t['lines'][result['line']]['selected']['sku'] in result['text']
 assert 'rack' in result['text'].lower() or 'shelf' in result['text'].lower()
 for command,action in [('found it','verify'),('wrong location','report'),('repeat location','repeat'),
                        ('stop','stop'),('delete item','unknown')]:
  out=post(c,url,{'transcript':command,'line':result['line']})
  assert out.status_code==200,out.text
  assert out.json()['action']==action
 assert c.get('/api/warehouse/tasks/'+t['id']).json()==before
 assert c.get('/api/warehouse/issues').json()==[]
 assert post(c,'/tasks/'+t['id']+'/picking/finish').status_code==409
 # A speech assertion can open the verification UI but never completes the pick.
 assert not any(x['complete'] for x in before['lines'])

def test_voice_pick_guide_synthesizes_authenticated_text_only(setup,monkeypatch):
 c,_=setup
 t=search(c,'CLO-001')
 assert post(c,'/tasks/'+t['id']+'/picking/start').status_code==200
 spoken=[]
 async def fake_speak(text,language):
  spoken.append((text,language))
  return b'RIFF'+b'0'*20
 monkeypatch.setattr('app.warehouse.voice.speak',fake_speak)
 r=post(c,'/tasks/'+t['id']+'/picking/guide-audio',{'command':'repeat','line':0})
 assert r.status_code==200,r.text
 assert r.headers['content-type'].startswith('audio/wav')
 assert spoken and spoken[0][1]=='en-IN' and 'CLO-001' in spoken[0][0]
 assert r.headers['cache-control']=='no-store'
 assert c.get('/api/warehouse/tasks/'+t['id']).json()['lines'][0]['complete'] is False

def test_voice_pick_command_is_user_private_and_regional_supported(setup,monkeypatch):
 c,_=setup
 t=search(c,'CLO-001')
 assert post(c,'/tasks/'+t['id']+'/picking/start').status_code==200
 login(c,'staff')
 assert post(c,'/tasks/'+t['id']+'/picking/command',{'transcript':'next item'}).status_code==404
 assert post(c,'/tasks/'+t['id']+'/picking/guide-audio',{'command':'next'}).status_code==404
 login(c)
 regional=post(c,'/search',{'collection':'clothing','query':'CLO-001','language':'kn-IN'}).json()
 assert post(c,'/tasks/'+regional['id']+'/picking/start').status_code==200
 result=post(c,'/tasks/'+regional['id']+'/picking/command',{'transcript':'ಮುಂದಿನ ವಸ್ತು'})
 assert result.status_code==200,result.text
 assert result.json()['action']=='next'
 assert 'ರ್ಯಾಕ್' in result.json()['text']
 spoken=[]
 async def fake_speak(text,language):
  spoken.append((text,language))
  return b'RIFF'+b'0'*20
 monkeypatch.setattr('app.warehouse.voice.speak',fake_speak)
 audio=post(c,'/tasks/'+regional['id']+'/picking/guide-audio',{'command':'next'})
 assert audio.status_code==200,audio.text
 assert spoken[0][1]=='kn-IN'
 assert 'CLO-001' in spoken[0][0]

def test_voice_pick_commands_preserve_hindi_shelf_and_existing_revision_guard(setup):
 c,_=setup
 t=post(c,'/search',{'collection':'clothing','query':'CLO-001','language':'hi-IN'}).json()
 assert post(c,'/tasks/'+t['id']+'/picking/start').status_code==200
 result=post(c,'/tasks/'+t['id']+'/picking/command',{'transcript':'जगह दोहराओ','line':0})
 assert result.status_code==200
 assert result.json()['action']=='repeat'
 assert 'रैक' in result.json()['text']
 assert 'CLO-001' in result.json()['text']
 product=t['lines'][0]['selected']
 product['name']='Changed product'
 assert save(c,product,product['revision']).status_code==200
 assert post(c,'/tasks/'+t['id']+'/picking/command',{'transcript':'next item'}).status_code==409

@pytest.mark.parametrize('language', ['kn-IN','ta-IN','te-IN','ml-IN','mr-IN','bn-IN','gu-IN','pa-IN'])
def test_regional_voice_commands_are_exact_and_preserve_native_script(language):
 from app.warehouse_voice_languages import REGIONAL
 from app.warehouse_voice_guide import intent
 phrases=REGIONAL[language]['commands']
 for command,alternatives in phrases.items():
  for phrase in alternatives:
   assert intent(phrase,language)==command,(language,phrase,command)
   assert intent(phrase+'!',language)==command
 for unsupported in ('not found','next item then found it','finish picking','delete product','yes','confirmed',''):
  assert intent(unsupported,language)=='unknown',(language,unsupported)


@pytest.mark.parametrize('language', ['kn-IN','ta-IN','te-IN','ml-IN','mr-IN','bn-IN','gu-IN','pa-IN'])
def test_regional_voice_guidance_and_timbre_language_never_mutate_picks(setup,monkeypatch,language):
 from app.warehouse_voice_languages import REGIONAL
 c,_=setup
 task=post(c,'/search',{'collection':'clothing','query':'CLO-001','language':language}).json()
 assert post(c,'/tasks/'+task['id']+'/picking/start').status_code==200
 base=c.get('/api/warehouse/tasks/'+task['id']).json()
 url='/tasks/'+task['id']+'/picking/command'
 for command in ('next','repeat','verify','report','stop','help'):
  phrase=REGIONAL[language]['commands'][command][0]
  r=post(c,url,{'transcript':phrase,'line':0})
  assert r.status_code==200,r.text
  result=r.json()
  assert result['action']==command
  assert result['language']==language
  assert result['text']
  if command in ('next','repeat'):
   assert 'CLO-001' in result['text']
   assert REGIONAL[language]['labels'][4] in result['text']
  if command in ('report','verify'):
   assert result['line']==0
 # Even a perfect "found it" transcript must not complete the task.
 assert c.get('/api/warehouse/tasks/'+task['id']).json()==base
 assert post(c,'/tasks/'+task['id']+'/picking/finish').status_code==409
 assert c.get('/api/warehouse/issues').json()==[]
 spoken=[]
 async def fake_speak(text,locale):
  spoken.append((text,locale))
  return b'RIFF'+b'0'*24
 monkeypatch.setattr('app.warehouse.voice.speak',fake_speak)
 audio=post(c,'/tasks/'+task['id']+'/picking/guide-audio',{'command':'repeat','line':0})
 assert audio.status_code==200,audio.text
 assert audio.headers['content-type'].startswith('audio/wav')
 assert spoken[0][1]==language
 assert 'CLO-001' in spoken[0][0]
 assert REGIONAL[language]['labels'][4] in spoken[0][0]

def test_failed_search_intelligence_aggregates_only_genuine_unknowns(setup):
 c,_=setup
 assert c.get('/api/warehouse/failed-searches').json()==[]
 unknown='glimmer gizmo'
 assert search(c,unknown)['lines'][0]['candidates']==[]
 assert search(c,unknown.upper())['lines'][0]['candidates']==[]
 results=c.get('/api/warehouse/failed-searches').json()
 assert len(results)==1
 assert results[0]['hits']==2
 assert results[0]['example']==unknown
 assert results[0]['scope']=='clothing'
 assert 'actor' not in results[0] and 'user_id' not in results[0] and 'audio' not in results[0]
 assert c.get('/api/warehouse/issues').json()==[]
 # A restricted collection or brand search should not be reported if the real
 # catalogue already contains the requested SKU.
 search(c,'CLO-001',collection='home')
 assert len(c.get('/api/warehouse/failed-searches').json())==1
 # An ambiguous variant remains a clarification request, not an unknown name.
 search(c,'blue T-shirt')
 assert len(c.get('/api/warehouse/failed-searches').json())==1
 # Sensitive or overly long dictation is never saved to insight history.
 for phrase in ('name@example.com','http://example.com/part','9876543210','x'*120):
  search(c,phrase)
 assert len(c.get('/api/warehouse/failed-searches').json())==1


def test_failed_search_owner_only_and_verified_alias_improves_search(setup):
 c,path=setup
 search(c,'glimmer gizmo')
 hit=c.get('/api/warehouse/failed-searches').json()[0]
 p=next(p for p in items(c) if p['sku']=='CLO-001')
 endpoint=f"/failed-searches/{hit['id']}/review"
 payload={'action':'alias','collection':p['collection'],'sku':p['sku'],'revision':p['revision'],
          'verified':True,'note':'Physically checked labelled SKU CLO-001'}
 login(c,'staff')
 assert c.get('/api/warehouse/failed-searches').status_code==403
 assert post(c,endpoint,payload).status_code==403
 login(c)
 assert post(c,endpoint,{**payload,'verified':False}).status_code==422
 assert post(c,endpoint,{**payload,'revision':p['revision']+1}).status_code==409
 out=post(c,endpoint,payload)
 assert out.status_code==200,out.text
 assert out.json()['status']=='resolved'
 assert c.get('/api/warehouse/failed-searches').json()==[]
 assert c.get('/api/warehouse/failed-searches?status=resolved').json()[0]['linked_sku']=='CLO-001'
 matched=search(c,'glimmer gizmo')['lines'][0]
 assert matched['selected']['sku']=='CLO-001'
 updated=next(p for p in items(c) if p['sku']=='CLO-001')
 assert 'glimmer gizmo' in updated['aliases']
 assert updated['revision']==p['revision']+1
 assert post(c,endpoint,payload).status_code==409
 assert c.get('/api/warehouse/issues').json()==[]
 history=c.get('/api/warehouse/history?collection=clothing').json()
 assert history[0]['action']=='alias'
 with TestClient(create_app(path,seed_demo=True)) as restarted:
  login(restarted)
  assert 'glimmer gizmo' in next(i for i in items(restarted) if i['sku']=='CLO-001')['aliases']


def test_failed_search_dismissal_excludes_it_from_open_review(setup):
 c,_=setup
 search(c,'unknown plastic widget')
 row=c.get('/api/warehouse/failed-searches').json()[0]
 endpoint='/failed-searches/'+str(row['id'])+'/review'
 assert post(c,endpoint,{'action':'dismiss','note':'No'}).status_code==422
 resp=post(c,endpoint,{'action':'dismiss','note':'Not a stocked product'})
 assert resp.status_code==200,resp.text
 assert c.get('/api/warehouse/failed-searches').json()==[]
 dismissed=c.get('/api/warehouse/failed-searches?status=dismissed').json()[0]
 assert dismissed['status']=='dismissed'
 assert dismissed['review_note']=='Not a stocked product'
 assert post(c,endpoint,{'action':'dismiss','note':'Already done'}).status_code==409
 # Repeated requests are counted but a deliberately dismissed phrase stays dismissed.
 search(c,'unknown plastic widget')
 assert c.get('/api/warehouse/failed-searches').json()==[]
 assert c.get('/api/warehouse/failed-searches?status=dismissed').json()[0]['hits']==2


def test_failed_search_validation_and_match_ambiguity_not_autolinked(setup):
 c,_=setup
 search(c,'glimmer gizmo')
 row=c.get('/api/warehouse/failed-searches').json()[0]
 p=next(p for p in items(c) if p['sku']=='CLO-001')
 url=f"/failed-searches/{row['id']}/review"
 assert c.get('/api/warehouse/failed-searches?status=invalid').status_code==422
 assert c.get('/api/warehouse/failed-searches?collection=invalid').status_code==422
 # Force a second catalogue item to already recognize the same alias by
 # manipulating the verified catalogue through its normal owner endpoint.
 another=next(p for p in items(c) if p['sku']=='CLO-004')
 another['aliases']=[*another['aliases'],'glimmer gizmo']
 assert save(c,another,another['revision']).status_code==200
 result=post(c,url,{'action':'alias','collection':p['collection'],'sku':p['sku'],
                    'revision':p['revision'],'verified':True,'note':'Checked product'})
 assert result.status_code==409
 assert row['status']=='open'
 assert 'glimmer gizmo' not in next(x for x in items(c) if x['sku']=='CLO-001')['aliases']

def test_remove_unresolved_worklist_line_preserves_other_lines(setup):
 c,_=setup
 task=search(c,'Blue T-shirt and black jeans, 37')
 assert len(task['lines'])==3
 assert task['lines'][2]['selected'] is None
 before=items(c)
 deleted=c.delete('/api/warehouse/tasks/'+task['id']+'/lines/2',headers=H)
 assert deleted.status_code==200,deleted.text
 assert len(deleted.json()['lines'])==2
 assert [line['query'] for line in deleted.json()['lines']]==[line['query'] for line in task['lines'][:2]]
 assert items(c)==before
 assert c.delete('/api/warehouse/tasks/'+task['id']+'/lines/99',headers=H).status_code==422
 # A resolved product cannot be removed from the picker this way.
 resolved_index=next(i for i,line in enumerate(deleted.json()['lines']) if line['selected'])
 assert c.delete('/api/warehouse/tasks/'+task['id']+'/lines/'+str(resolved_index),headers=H).status_code==409

def test_unresolved_line_removal_is_blocked_after_pick_starts(setup):
 c,_=setup
 task=search(c,'CLO-001 and CLO-004, 37')
 assert len(task['lines'])==3
 assert c.delete('/api/warehouse/tasks/'+task['id']+'/lines/2',headers=H).status_code==200
 ready=c.get('/api/warehouse/tasks/'+task['id']).json()
 assert all(line.get('selected') and line.get('location') for line in ready['lines'])
 assert post(c,'/tasks/'+task['id']+'/picking/start').status_code==200
 assert c.delete('/api/warehouse/tasks/'+task['id']+'/lines/0',headers=H).status_code==409

def test_unresolved_last_request_requires_a_new_search(setup):
 c,_=setup
 task=search(c,'glimmer gizmo')
 assert task['lines'][0]['selected'] is None
 assert c.delete('/api/warehouse/tasks/'+task['id']+'/lines/0',headers=H).status_code==409

def test_telugu_mixed_search_question_normalized_without_guessing_item(setup):
 from app.warehouse_language import tokens
 assert tokens('blue jeans? ఎక్కడుంది?')=={'blue','jeans'}
 c,_=setup
 missing=post(c,'/search',{'collection':'clothing','query':'blue jeans? ఎక్కడుంది?','language':'te-IN'})
 assert missing.status_code==200
 assert missing.json()['lines'][0]['selected'] is None
 found=post(c,'/search',{'collection':'clothing','query':'black jeans ఎక్కడుంది','language':'te-IN'})
 assert found.status_code==200
 assert found.json()['lines'][0]['candidates']

@pytest.mark.parametrize('language,phrase',[
 ('en-IN','blue jeans where is it'),
 ('hi-IN','blue jeans कहाँ है'),
 ('kn-IN','blue jeans ಎಲ್ಲಿದೆ'),
 ('ta-IN','blue jeans எங்கிருக்கிறது'),
 ('te-IN','blue jeans ఎక్కడుంది'),
 ('ml-IN','blue jeans എവിടെയാണ്'),
 ('mr-IN','blue jeans कुठे आहे'),
 ('bn-IN','blue jeans কোথায় আছে'),
 ('gu-IN','blue jeans ક્યાં છે'),
 ('pa-IN','blue jeans ਕਿੱਥੇ ਹੈ'),
 ('hi-en','blue jeans kaha hai'),
])
def test_all_search_languages_location_request_keeps_product_constraints(setup,language,phrase):
 from app.warehouse_language import tokens
 # A location question is not itself a product attribute.
 assert tokens(phrase)=={'blue','jeans'},(language,phrase,tokens(phrase))
 c,_=setup
 result=post(c,'/search',{'collection':'clothing','query':phrase,'language':language})
 assert result.status_code==200,result.text
 assert len(result.json()['lines'])==1
 assert result.json()['lines'][0]['selected'] is None
 assert result.json()['lines'][0]['candidates']==[]

@pytest.mark.parametrize('language,phrase',[
 ('en-IN','black jeans where is it'),
 ('hi-IN','black jeans कहाँ है'),
 ('kn-IN','black jeans ಎಲ್ಲಿದೆ'),
 ('ta-IN','black jeans எங்கிருக்கிறது'),
 ('te-IN','black jeans ఎక్కడుంది'),
 ('ml-IN','black jeans എവിടെയാണ്'),
 ('mr-IN','black jeans कुठे आहे'),
 ('bn-IN','black jeans কোথায় আছে'),
 ('gu-IN','black jeans ક્યાં છે'),
 ('pa-IN','black jeans ਕਿੱਥੇ ਹੈ'),
 ('hi-en','black jeans kaha hai'),
])
def test_all_search_languages_find_real_items_without_guessing_size(setup,language,phrase):
 from app.warehouse_language import tokens
 assert tokens(phrase)=={'black','jeans'},(language,phrase,tokens(phrase))
 c,_=setup
 response=post(c,'/search',{'collection':'clothing','query':phrase,'language':language})
 assert response.status_code==200,response.text
 lines=response.json()['lines']
 assert len(lines)==1
 assert len(lines[0]['candidates'])==2
 assert lines[0]['selected'] is None # user must choose the size
