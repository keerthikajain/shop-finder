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
  qty=re.search(r'(\d+(?:\.\d+)?)\s*(?:kg|g|ml|l|pack|count)',name,re.I)
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
