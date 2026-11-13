import pytest,time
from fastapi.testclient import TestClient
from app.main import create_app
from app.accounts import add_account,COOKIE
from app.database import connect
H={'X-Shop-Request':'1'}
PW='a-test-password-only-123'
@pytest.fixture
def setup(tmp_path):
 path=tmp_path/'accounts.sqlite3'
 with TestClient(create_app(path,seed_demo=True)) as c:
  add_account(path,'owner',PW,role='owner');add_account(path,'worker',PW,language='hi')
  yield c,path

def login(c,name='owner'):
 r=c.post('/api/auth/login',headers=H,json={'username':name,'password':PW});assert r.status_code==200,r.text;return r

def test_login_logout_cookie_and_no_token_bypass(setup):
 c,path=setup
 assert c.get('/api/products').status_code==401
 assert c.get('/api/products',headers={'X-Staff-Token':'a'*32}).status_code==401
 assert c.post('/api/auth/login',json={'username':'owner','password':PW}).status_code==403
 r=login(c);assert 'HttpOnly' in r.headers['set-cookie'] and 'SameSite=strict' in r.headers['set-cookie']
 token=c.cookies.get(COOKIE)
 with connect(path) as db:
  assert db.execute('SELECT password_hash FROM accounts').fetchone()[0]!=PW
  assert db.execute('SELECT digest FROM account_sessions').fetchone()[0]!=token
 assert c.get('/api/products').status_code==200
 assert c.post('/api/auth/logout',headers=H).status_code==200
 c.cookies.set(COOKIE,token);assert c.get('/api/products').status_code==401

def test_staff_permissions_reports_and_search_isolation(setup):
 c,path=setup;login(c)
 owner_search=c.post('/api/search',headers=H,json={'query':'SYN-008'}).json()
 c.post('/api/auth/logout',headers=H);login(c,'worker');p=c.get('/api/products/DEMO-008').json()
 for method,url,body in [('put','/api/products/DEMO-008',p),('post','/api/products',p),('post','/api/users',{'username':'evil','password':PW}),('post','/api/products/DEMO-008/verify',{})]:assert getattr(c,method)(url,headers=H,json=body).status_code==403
 assert c.get('/api/users').status_code==403 and c.get('/api/unresolved').status_code==403
 assert c.post('/api/media',headers=H,content=b'bad').status_code==403
 assert c.post('/api/clarify',headers=H,json={'session_id':owner_search['session_id']}).status_code==410
 assert c.post('/api/voice/speak/'+owner_search['session_id'],headers=H).status_code==410
 assert c.post('/api/reports',headers=H,json={'product_id':p['id'],'reason':'wrong_location','note':'Check shelf'}).status_code==200
 assert c.get('/api/products/DEMO-008').json()==p
 c.post('/api/auth/logout',headers=H);login(c)
 q=c.get('/api/unresolved').json()[0];assert q['product_id']==p['id'] and 'worker' in q['query']

def test_preferences_persist_and_language_validation(setup):
 c,path=setup;login(c)
 assert c.put('/api/auth/preferences',headers=H,json={'language':'hi','tour_done':True}).status_code==200
 assert c.put('/api/auth/preferences',headers=H,json={'language':'xx','tour_done':True}).status_code==422
 with TestClient(create_app(path,seed_demo=True)) as other:
  assert login(other).json()['language']=='hi'
  assert other.get('/api/auth/status').json()['user']['tour_done']==1

def test_owner_manages_staff_revokes_sessions(setup):
 c,path=setup
 with TestClient(create_app(path,seed_demo=True)) as worker:
  login(worker,'worker');token=worker.cookies.get(COOKIE)
 login(c)
 created=c.post('/api/users',headers=H,json={'username':'newstaff','password':PW,'language':'hi'});assert created.status_code==200 and created.json()['role']=='staff'
 assert c.post('/api/users',headers=H,json={'username':'evil','password':PW,'role':'owner'}).status_code==422
 staff=next(u for u in c.get('/api/users').json() if u['username']=='worker')
 assert c.patch('/api/users/'+staff['id'],headers=H,json={'active':False}).status_code==200
 c.cookies.clear();c.cookies.set(COOKIE,token);assert c.get('/api/products').status_code==401
 assert c.post('/api/auth/login',headers=H,json={'username':'worker','password':PW}).status_code==401

def test_password_change_and_expired_sessions(setup):
 c,path=setup;login(c)
 assert c.post('/api/auth/password',headers=H,json={'old_password':PW,'new_password':'new-test-password-123'}).status_code==200
 assert c.get('/api/products').status_code==401
 assert c.post('/api/auth/login',headers=H,json={'username':'owner','password':PW}).status_code==401
 assert c.post('/api/auth/login',headers=H,json={'username':'owner','password':'new-test-password-123'}).status_code==200
 with connect(path) as db:db.execute('UPDATE account_sessions SET expires=?',(time.time()-1,))
 assert c.get('/api/products').status_code==401

def test_login_throttling_and_photo_validation(setup):
 c,path=setup;login(c)
 assert c.post('/api/media',headers=H,content=b'<svg/>').status_code==422
 assert c.post('/api/media',headers=H,content=b'x'*3000001).status_code==413
 c.post('/api/auth/logout',headers=H)
 for _ in range(10):assert c.post('/api/auth/login',headers=H,json={'username':'unknown','password':'wrong'}).status_code==401
 assert c.post('/api/auth/login',headers=H,json={'username':'unknown','password':'wrong'}).status_code==429

def test_uploaded_photo_is_private_and_report_validation(setup):
 import base64
 c,path=setup;login(c)
 png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6S8AAAAASUVORK5CYII=')
 r=c.post('/api/media',headers=H,content=png);assert r.status_code==200
 url=r.json()['url'];assert c.get(url).content==png
 assert c.post('/api/reports',headers=H,json={'product_id':'missing','reason':'wrong_location'}).status_code==404
 assert c.post('/api/reports',headers=H,json={'product_id':'DEMO-008','reason':'other'}).status_code==422
 c.post('/api/auth/logout',headers=H);assert c.get(url).status_code==401

def test_profile_is_private_persistent_and_cannot_change_role(setup):
 c,path=setup;login(c,'worker')
 payload={'display_name':'Warehouse Worker','phone':'+91 90000 00000','staff_code':'W-01'}
 assert c.put('/api/auth/profile',headers=H,json={**payload,'role':'owner'}).status_code==422
 r=c.put('/api/auth/profile',headers=H,json=payload)
 assert r.status_code==200 and r.json()['role']=='staff'
 assert c.get('/api/users').status_code==403
 assert c.get('/api/auth/status').json()['user']['display_name']==payload['display_name']
 c.post('/api/auth/logout',headers=H);login(c)
 assert next(x for x in c.get('/api/users').json() if x['username']=='worker')['staff_code']=='W-01'

def test_report_confirmation_resolution_and_staff_isolation(setup):
 c,path=setup;login(c,'worker')
 report=c.post('/api/warehouse/issues',headers=H,json={'collection':'clothing','sku':'TEST','reason':'Check the recorded shelf'}).json()
 assert report['id'] and report['status']=='open'
 url=f"/api/warehouse/issues/{report['id']}/resolve"
 assert c.post(url,headers=H,json={'note':'Checked shelf'}).status_code==403
 c.post('/api/auth/logout',headers=H);login(c)
 assert c.post(url,headers=H,json={'note':'Checked shelf; location is correct.'}).status_code==200
 assert c.post(url,headers=H,json={'note':'Overwrite previous resolution'}).status_code==409
 c.post('/api/auth/logout',headers=H);login(c,'worker')
 row=next(x for x in c.get('/api/warehouse/issues').json() if x['id']==report['id'])
 assert row['resolved_at'] and row['resolved_by']=='owner' and row['status']=='resolved'
 add_account(path,'otherworker',PW)
 c.post('/api/auth/logout',headers=H);login(c,'otherworker')
 assert not c.get('/api/warehouse/issues').json()

def test_owner_invite_allows_one_staff_registration_without_role_escalation(setup):
 c,path=setup
 login(c)
 invite=c.post('/api/users/invitations',headers=H)
 assert invite.status_code==201,invite.text
 result=invite.json()
 code=result['code']
 assert len(code)>=24 and result['expires_at']>time.time()
 listed=c.get('/api/users/invitations').json()
 assert listed and 'code' not in listed[0]
 with connect(path) as db:
  assert db.execute('SELECT code_digest FROM staff_invitations WHERE id=?',(result['id'],)).fetchone()[0]!=code
 c.post('/api/auth/logout',headers=H)
 bad=c.post('/api/auth/join',headers=H,json={'code':code,'username':'newworker','password':PW,'role':'owner'})
 assert bad.status_code==422
 assert c.get('/api/users/invitations').status_code==401
 created=c.post('/api/auth/join',headers=H,json={'code':code,'username':'newworker','password':PW})
 assert created.status_code==201,created.text
 assert created.json()['role']=='staff'
 assert c.post('/api/auth/join',headers=H,json={'code':code,'username':'anotherworker','password':PW}).status_code==400
 assert c.post('/api/auth/login',headers=H,json={'username':'newworker','password':PW,'role':'owner'}).status_code==401
 logged=c.post('/api/auth/login',headers=H,json={'username':'newworker','password':PW,'role':'staff'})
 assert logged.status_code==200
 assert c.get('/api/users').status_code==403
 assert c.post('/api/users/invitations',headers=H).status_code==403
 c.post('/api/auth/logout',headers=H)
 with TestClient(create_app(path,seed_demo=True)) as restart:
  assert restart.post('/api/auth/login',headers=H,json={'username':'newworker','password':PW}).status_code==200

def test_invitation_expiration_revoke_and_nonowner_blocked(setup):
 c,path=setup
 login(c)
 old=c.post('/api/users/invitations',headers=H).json()
 with connect(path) as db:db.execute('UPDATE staff_invitations SET expires_at=? WHERE id=?',(time.time()-1,old['id']))
 assert c.post('/api/auth/join',headers=H,json={'code':old['code'],'username':'late','password':PW}).status_code==400
 fresh=c.post('/api/users/invitations',headers=H).json()
 assert c.delete('/api/users/invitations/'+fresh['id'],headers=H).status_code==200
 assert c.post('/api/auth/join',headers=H,json={'code':fresh['code'],'username':'revoked','password':PW}).status_code==400
 audits=c.get('/api/users/audit').json()
 assert old['code'] not in str(audits) and fresh['code'] not in str(audits)
 c.post('/api/auth/logout',headers=H)
 login(c,'worker')
 assert c.post('/api/users/invitations',headers=H).status_code==403
 assert c.get('/api/users/audit').status_code==403

def test_invitation_registration_rate_limit(setup):
 c,path=setup
 for i in range(20):
  assert c.post('/api/auth/join',headers=H,json={'code':'a'*43,'username':f'worker{i}','password':PW}).status_code==400
 assert c.post('/api/auth/join',headers=H,json={'code':'a'*43,'username':'nextworker','password':PW}).status_code==429

def test_logout_remains_idempotent_and_invalidates_all_sessions(setup):
 c,path=setup
 login(c)
 assert c.post('/api/auth/logout',headers=H).status_code==200
 assert c.post('/api/auth/logout',headers=H).status_code==200
 assert c.get('/api/users').status_code==401

@pytest.mark.parametrize('language', ['en','hi','bn','mr','gu','pa','kn','te','ta','ml'])
def test_staff_account_can_store_all_supported_interface_languages(tmp_path,language):
 from app.accounts import add_account
 from app.database import connect
 db=tmp_path/'languages.sqlite3'
 with TestClient(create_app(db,seed_demo=False)) as client:
  uid=add_account(db,'worker','staff-password-1234',language=language)
  with connect(db) as conn:
   assert conn.execute('SELECT language FROM accounts WHERE id=?',(uid,)).fetchone()['language']==language
  resp=client.post('/api/auth/login',headers=H,json={'username':'worker','password':'staff-password-1234'})
  assert resp.status_code==200,resp.text
  assert resp.json()['language']==language

def test_public_preview_is_off_by_default_and_cannot_be_entered(setup):
 c,_=setup
 assert c.get('/api/auth/status').json()['demo_enabled'] is False
 assert c.post('/api/demo/enter',headers=H).status_code==404

def test_demo_public_preview_permissions_and_feedback(setup,monkeypatch):
 c,_=setup
 monkeypatch.setenv('SHOP_FINDER_PUBLIC_DEMO','true')
 monkeypatch.setenv('SHOP_FINDER_SEED_DEMO','true')
 status=c.get('/api/auth/status').json()
 assert status['demo_enabled'] is True
 enter=c.post('/api/demo/enter',headers=H)
 assert enter.status_code==200,enter.text
 assert enter.json()['role']=='staff' and enter.json()['is_demo'] is True
 assert enter.json()['username'].startswith('visitor_')
 assert c.get('/api/warehouse/meta').status_code==200
 products=c.get('/api/warehouse/items?collection=all')
 assert products.status_code==200 and products.json()
 assert all(p['synthetic'] for p in products.json())
 found=c.post('/api/warehouse/search',headers=H,json={'collection':'clothing','query':'CLO-001','language':'en-IN'})
 assert found.status_code==200,found.text
 assert found.json()['lines'][0]['selected']['sku']=='CLO-001'
 task_id=found.json()['id']
 assert c.get('/api/warehouse/tasks/'+task_id).status_code==200
 assert c.post('/api/warehouse/tasks/'+task_id+'/picking/start',headers=H).status_code==200
 assert c.post('/api/warehouse/tasks/'+task_id+'/scan',headers=H,json={'line':0,'kind':'manual','value':'confirmed'}).status_code==200
 assert c.post('/api/warehouse/tasks/'+task_id+'/picking/finish',headers=H).status_code==200
 for method,url in [('get','/api/users'),('get','/api/warehouse/history'),('get','/api/warehouse/issues'),
                    ('post','/api/warehouse/issues'),('get','/api/demo/feedback'),
                    ('put','/api/warehouse/items'),('post','/api/warehouse/imports'),
                    ('post','/api/registrations/workspace-code'),('put','/api/auth/profile')]:
  resp=getattr(c,method)(url,headers=H)
  assert resp.status_code==403,(method,url,resp.text)
 too_short=c.post('/api/demo/feedback',headers=H,json={'comment':'Hi'})
 assert too_short.status_code==422
 ok=c.post('/api/demo/feedback',headers=H,json={'comment':'The preview was helpful. I want clearer buttons.'})
 assert ok.status_code==200,ok.text
 assert c.get('/api/demo/feedback').status_code==403
 login(c,'owner')
 review=c.get('/api/demo/feedback')
 assert review.status_code==200 and any('clearer buttons' in x['comment'] for x in review.json())

def test_guest_preview_not_available_when_non_synthetic_items_exist(setup,monkeypatch):
 from app.database import connect
 c,path=setup
 monkeypatch.setenv('SHOP_FINDER_PUBLIC_DEMO','true')
 monkeypatch.setenv('SHOP_FINDER_SEED_DEMO','true')
 with connect(path) as db:
  db.execute("UPDATE wh_items SET payload=json_set(payload,'$.synthetic',false) WHERE sku='CLO-001' AND collection='clothing'")
 assert c.get('/api/auth/status').json()['demo_enabled'] is False
 assert c.post('/api/demo/enter',headers=H).status_code==404


def test_gnani_public_welcome_fixed_text_cached_and_rate_limited(setup,monkeypatch):
 c,path=setup
 calls=[]
 monkeypatch.setattr('app.main.voice.ready',lambda:True)
 async def provider(text,language,*,voice_override=None):
  calls.append((text,language,voice_override))
  return b'RIFF-test-welcome-audio'
 monkeypatch.setattr('app.main.voice.speak',provider)
 # Login page can get only fixed language clips without a logged-in user.
 r=c.get('/api/welcome/audio?language=hi-IN')
 assert r.status_code==200,r.text
 assert r.headers['content-type'].startswith('audio/wav')
 assert r.content.startswith(b'RIFF')
 assert 'नमस्ते' in calls[-1][0]
 assert calls[-1][1:] == ('hi-IN','Riyaa')
 assert c.get('/api/welcome/audio?language=hi-IN').status_code==200
 assert len(calls)==1  # Fixed text is served from cache on later visits.
 assert c.get('/api/welcome/audio?language=unlisted').status_code==422
 assert c.get('/api/welcome/audio?language=kn-IN').status_code==200
 assert calls[-1][1]=='kn-IN'
 assert c.post('/api/voice/welcome',headers=H,json={'hour':9,'language':'en-IN'}).status_code==401
 # IP bucket persists regardless of the number of cached/static language clips.
 for i in range(7):
  assert c.get('/api/welcome/audio?language=en-IN').status_code==200
 assert c.get('/api/welcome/audio?language=en-IN').status_code==429


def test_gnani_private_welcome_uses_authenticated_account_name_and_local_hour(setup,monkeypatch):
 c,_=setup
 calls=[]
 monkeypatch.setattr('app.main.voice.ready',lambda:True)
 async def provider(text,language,*,voice_override=None):
  calls.append((text,language,voice_override))
  return b'RIFF-mock-wav'
 monkeypatch.setattr('app.main.voice.speak',provider)
 login(c,'owner')
 assert c.post('/api/voice/welcome',json={'hour':8,'language':'en-IN'}).status_code==403
 morning=c.post('/api/voice/welcome',headers=H,json={'hour':8,'language':'en-IN'})
 assert morning.status_code==200,morning.text
 assert calls[-1][1:] == ('en-IN','Riyaa')
 assert calls[-1][0].startswith('Good morning, owner.')
 assert morning.headers['cache-control']=='no-store'
 evening=c.post('/api/voice/welcome',headers=H,json={'hour':19,'language':'te-IN'})
 assert evening.status_code==200,evening.text
 assert 'శుభ సాయంత్రం' in calls[-1][0]
 assert calls[-1][2]=='Riyaa'
 assert c.post('/api/voice/welcome',headers=H,json={'hour':24,'language':'en-IN'}).status_code==422
 assert c.post('/api/voice/welcome',headers=H,json={'hour':9,'language':'auto'}).status_code==422


@pytest.mark.parametrize('language,phrase',[
 ('en-IN','Hi, welcome to Finder.'),
 ('hi-IN','नमस्ते, फाइंडर में आपका स्वागत है।'),
 ('bn-IN','নমস্কার, ফাইন্ডারে স্বাগতম।'),
 ('mr-IN','नमस्कार, फाइंडरमध्ये आपले स्वागत आहे.'),
 ('gu-IN','નમસ્તે, ફાઇન્ડરમાં આપનું સ્વાગત છે.'),
 ('pa-IN','ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਫਾਈਂਡਰ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ।'),
 ('kn-IN','ನಮಸ್ಕಾರ, ಫೈಂಡರ್‌ಗೆ ಸ್ವಾಗತ.'),
 ('te-IN','నమస్కారం, ఫైండర్‌కు స్వాగతం.'),
 ('ta-IN','வணக்கம், ஃபைண்டருக்கு வரவேற்கிறோம்.'),
 ('ml-IN','നമസ്കാരം, ഫൈൻഡറിലേക്ക് സ്വാഗതം.')
])
def test_public_greeting_uses_short_gnani_message_for_every_app_language(tmp_path,monkeypatch,language,phrase):
 calls=[]
 monkeypatch.setattr('app.main.voice.ready',lambda:True)
 async def provider(text,language,*,voice_override=None):
  calls.append((text,language,voice_override))
  return b'RIFF-greeting-wav'
 monkeypatch.setattr('app.main.voice.speak',provider)
 with TestClient(create_app(tmp_path/'greeting.sqlite3',seed_demo=False)) as c:
  response=c.get('/api/welcome/audio?language='+language)
  assert response.status_code==200,response.text
  assert calls==[(phrase,language,'Riyaa')]
  assert c.get('/api/welcome/audio?language='+language).status_code==200
  assert len(calls)==1


@pytest.mark.parametrize('language,hour,expected',[
 ('en-IN',8,'Good morning'),
 ('hi-IN',15,'नमस्कार'),
 ('bn-IN',20,'শুভ সন্ধ্যা'),
 ('mr-IN',8,'सुप्रभात'),
 ('gu-IN',20,'શુભ સાંજ'),
 ('pa-IN',14,'ਸਤ ਸ੍ਰੀ ਅਕਾਲ'),
 ('kn-IN',19,'ಶುಭ ಸಂಜೆ'),
 ('te-IN',19,'శుభ సాయంత్రం'),
 ('ta-IN',9,'காலை வணக்கம்'),
 ('ml-IN',12,'നമസ്കാരം')
])
def test_workspace_greeting_uses_authenticated_name_and_requested_app_locale(setup,monkeypatch,language,hour,expected):
 c,_=setup
 calls=[]
 monkeypatch.setattr('app.main.voice.ready',lambda:True)
 async def provider(text,language,*,voice_override=None):
  calls.append((text,language,voice_override))
  return b'RIFF-greeting'
 monkeypatch.setattr('app.main.voice.speak',provider)
 login(c)
 response=c.post('/api/voice/welcome',headers=H,json={'language':language,'hour':hour})
 assert response.status_code==200,response.text
 assert calls[-1][0].startswith(expected+', owner.')
 assert calls[-1][1:]==(language,'Riyaa')
