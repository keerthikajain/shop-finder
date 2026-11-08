"""Self-enrolment, authorization and manager review regression tests."""
import time, pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.accounts import add_account, COOKIE
from app.database import connect

HEAD={'X-Shop-Request':'1'}
PASSWORD='long-test-password-only-123'

@pytest.fixture
def env(tmp_path):
    db=tmp_path/'self_register.sqlite3'
    with TestClient(create_app(db,seed_demo=False)) as owner:
        add_account(db,'boss',PASSWORD,role='owner')
        add_account(db,'employee',PASSWORD)
        yield owner,db

def login(c,username='boss',password=PASSWORD,role=None):
    body={'username':username,'password':password}
    if role:body['role']=role
    return c.post('/api/auth/login',headers=HEAD,json=body)

def setup_code(c):
    r=c.post('/api/registrations/workspace-code',headers=HEAD)
    assert r.status_code==201,r.text
    assert r.json()['code'].startswith('SF-')
    return r.json()['code']

def register(c,code,username,**additional):
    return c.post('/api/auth/register',headers=HEAD,json={
      'code':code,'username':username,'password':PASSWORD,
      'display_name':'New Worker','language':'hi',**additional})

def test_public_signup_requires_owner_enabled_code_and_approval(env):
    c,db=env
    assert c.post('/api/auth/register',headers=HEAD,json={'code':'SF-'+('x'*32),'username':'a','password':PASSWORD,'display_name':'A'}).status_code==400
    assert login(c).status_code==200
    code=setup_code(c)
    settings=c.get('/api/registrations/workspace-code').json()
    assert settings['enabled'] and settings['configured'] and 'code' not in settings
    with connect(db) as d:
        assert d.execute('SELECT code_digest FROM registration_workspace WHERE id=1').fetchone()[0]!=code
    c.post('/api/auth/logout',headers=HEAD)
    wrong=register(c,'SF-'+('x'*32),'newhire')
    assert wrong.status_code==400
    p=register(c,code,'newhire')
    assert p.status_code==201,p.text
    assert p.json()['status']=='pending'
    with connect(db) as d:
        r=d.execute("SELECT active,approval_status,password_hash,role FROM accounts WHERE username='newhire'").fetchone()
        assert r['active']==0 and r['approval_status']=='pending' and r['role']=='staff' and PASSWORD not in r['password_hash']
    assert login(c,'newhire').status_code!=200
    assert c.get('/api/warehouse/meta').status_code==401
    assert c.get('/api/registrations/pending').status_code==401
    assert c.get('/api/users').status_code==401
    assert register(c,code,'esc',role='owner').status_code==422
    assert login(c).status_code==200
    q=c.get('/api/registrations/pending')
    assert q.status_code==200 and len(q.json())==1 and q.json()[0]['username']=='newhire'
    assert 'password_hash' not in str(q.json())
    id=q.json()[0]['id']
    ok=c.post('/api/registrations/pending/'+id+'/approve',headers=HEAD)
    assert ok.status_code==200,ok.text
    assert c.post('/api/registrations/pending/'+id+'/approve',headers=HEAD).status_code==409
    c.post('/api/auth/logout',headers=HEAD)
    assert login(c,'newhire',role='staff').status_code==200
    assert c.get('/api/warehouse/meta').status_code==200
    assert c.get('/api/users').status_code==403
    assert c.get('/api/registrations/workspace-code').status_code==403
    assert c.get('/api/registrations/pending').status_code==403
    c.post('/api/auth/logout',headers=HEAD)
    with TestClient(create_app(db,seed_demo=False)) as restarted:
        assert login(restarted,'newhire',role='staff').status_code==200

def test_workplace_code_rotation_and_disable_revokes_old_code(env):
    c,db=env
    assert login(c).status_code==200
    first=setup_code(c)
    second=setup_code(c)
    assert first!=second
    with TestClient(create_app(db,seed_demo=False)) as guest:
        assert register(guest,first,'old').status_code==400
        assert register(guest,second,'valid').status_code==201
    disabled=c.patch('/api/registrations/workspace-code',headers=HEAD,json={'enabled':False})
    assert disabled.status_code==200
    with TestClient(create_app(db,seed_demo=False)) as guest:
        assert register(guest,second,'disabled').status_code==400
    assert c.patch('/api/registrations/workspace-code',headers=HEAD,json={'enabled':True}).status_code==200
    with TestClient(create_app(db,seed_demo=False)) as guest:
        assert register(guest,second,'enabledagain').status_code==201
    assert first not in str(c.get('/api/users/audit').json())
    assert second not in str(c.get('/api/users/audit').json())

def test_manager_promotion_requires_owner_password_and_can_only_review(env):
    c,db=env
    assert login(c).status_code==200
    code=setup_code(c)
    with TestClient(create_app(db,seed_demo=False)) as guest:
        assert register(guest,code,'candidate').status_code==201
    with connect(db) as d:
        staff_id=d.execute("SELECT id FROM accounts WHERE username='employee'").fetchone()[0]
    url='/api/registrations/managers/'+staff_id
    assert c.patch(url,headers=HEAD,json={'grant_manager':True,'owner_password':'wrong'}).status_code==403
    result=c.patch(url,headers=HEAD,json={'grant_manager':True,'owner_password':PASSWORD})
    assert result.status_code==200,result.text
    assert result.json()['role']=='manager'
    assert c.patch(url,headers=HEAD,json={'grant_manager':True,'owner_password':PASSWORD}).status_code==409
    c.post('/api/auth/logout',headers=HEAD)
    assert login(c,'employee',role='staff').status_code==401
    assert login(c,'employee',role='manager').status_code==200
    assert c.get('/api/registrations/pending').status_code==200
    assert c.get('/api/users').status_code==403
    assert c.post('/api/registrations/workspace-code',headers=HEAD).status_code==403
    assert c.patch(url,headers=HEAD,json={'grant_manager':False,'owner_password':PASSWORD}).status_code==403
    pending=c.get('/api/registrations/pending').json()
    assert len(pending)==1
    result=c.post('/api/registrations/pending/'+pending[0]['id']+'/approve',headers=HEAD)
    assert result.status_code==200
    assert c.post('/api/registrations/pending/'+pending[0]['id']+'/reject',headers=HEAD).status_code==409
    assert c.get('/api/warehouse/meta').status_code==200
    c.post('/api/auth/logout',headers=HEAD)
    assert login(c).status_code==200
    assert c.patch(url,headers=HEAD,json={'grant_manager':False,'owner_password':PASSWORD}).status_code==200
    c.post('/api/auth/logout',headers=HEAD)
    assert login(c,'employee',role='manager').status_code==401
    assert login(c,'employee',role='staff').status_code==200
    assert c.get('/api/registrations/pending').status_code==403

def test_rejection_and_legacy_user_management_cannot_activate_pending(env):
    c,db=env
    assert login(c).status_code==200
    code=setup_code(c)
    with TestClient(create_app(db,seed_demo=False)) as guest:
        assert register(guest,code,'rejected').status_code==201
        assert register(guest,code,'notyethired').status_code==201
    pend=c.get('/api/registrations/pending').json()
    ids={x['username']:x['id'] for x in pend}
    assert c.patch('/api/users/'+ids['notyethired'],headers=HEAD,json={'active':True}).status_code==409
    assert c.patch('/api/registrations/managers/'+ids['notyethired'],headers=HEAD,json={'grant_manager':True,'owner_password':PASSWORD}).status_code==409
    rej=c.post('/api/registrations/pending/'+ids['rejected']+'/reject',headers=HEAD)
    assert rej.status_code==200
    with connect(db) as d:
        row=d.execute("SELECT active,approval_status FROM accounts WHERE username='rejected'").fetchone()
        assert row['active']==0 and row['approval_status']=='rejected'
    c.post('/api/auth/logout',headers=HEAD)
    assert login(c,'rejected').status_code!=200
    assert c.get('/api/products').status_code==401
    assert c.post('/api/registrations/pending/'+ids['notyethired']+'/approve',headers=HEAD).status_code==401

def test_staff_cannot_view_pending_or_rotate_code_and_registration_is_limited(env):
    c,db=env
    assert login(c,'employee').status_code==200
    assert c.get('/api/registrations/pending').status_code==403
    assert c.post('/api/registrations/workspace-code',headers=HEAD).status_code==403
    assert c.patch('/api/registrations/workspace-code',headers=HEAD,json={'enabled':True}).status_code==403
    c.post('/api/auth/logout',headers=HEAD)
    for i in range(20):
        assert register(c,'SF-'+('x'*32),'spam'+str(i)).status_code==400
    assert register(c,'SF-'+('x'*32),'spamoverflow').status_code==429

def test_registration_config_is_private_and_request_origin_checked(env):
    c,db=env
    assert login(c).status_code==200
    code=setup_code(c)
    c.post('/api/auth/logout',headers=HEAD)
    denied=c.post('/api/auth/register',headers={**HEAD,'Origin':'https://evil.invalid'},json={
      'code':code,'username':'crossorigin','password':PASSWORD,'display_name':'Bad'})
    assert denied.status_code==403
    assert c.post('/api/auth/register',json={'code':code,'username':'noheader','password':PASSWORD,'display_name':'Bad'}).status_code==403
    assert c.get('/api/registrations/workspace-code').status_code==401
