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
