"""Security regressions for the single-organisation authenticated deployment."""
import os
import stat
from fastapi.testclient import TestClient
from app.main import create_app
from app.accounts import add_account
from app.database import connect

H={'X-Shop-Request':'1'}
PW='a-test-password-only-123'


def client(tmp_path):
    path=tmp_path/'secure.sqlite3'
    return TestClient(create_app(path,seed_demo=False)),path


def login(c,name='owner'):
    result=c.post('/api/auth/login',json={'username':name,'password':PW},headers=H)
    assert result.status_code==200,result.text


def test_public_health_is_minimal_and_rejected_responses_are_hardened(tmp_path):
    c,path=client(tmp_path)
    with c:
        add_account(path,'owner',PW,role='owner')
        r=c.get('/api/health')
        assert r.status_code==200
        assert r.json()['status']=='ok'
        assert 'product_count' not in r.json()
        assert 'database' not in r.json()
        assert "script-src 'self'" in r.headers['Content-Security-Policy']
        assert "frame-ancestors 'none'" in r.headers['Content-Security-Policy']
        assert r.headers['X-Frame-Options']=='DENY'
        assert r.headers['Cache-Control']=='no-store'
        denied=c.get('/api/users')
        assert denied.status_code==401
        assert 'Content-Security-Policy' in denied.headers
        login(c)
        assert 'product_count' in c.get('/api/health').json()


def test_cross_origin_and_missing_csrf_header_fail_closed(tmp_path):
    c,path=client(tmp_path)
    with c:
        add_account(path,'owner',PW,role='owner')
        assert c.post('/api/auth/login',json={'username':'owner','password':PW}).status_code==403
        denied=c.post('/api/auth/login',headers={**H,'Origin':'https://evil.invalid'},
                      json={'username':'owner','password':PW})
        assert denied.status_code==403
        assert 'Content-Security-Policy' in denied.headers
        assert c.post('/api/auth/login',headers={**H,'Sec-Fetch-Site':'cross-site'},
                      json={'username':'owner','password':PW}).status_code==403
        assert c.options('/api/auth/login',headers={'Origin':'https://evil.invalid',
                                                    'Access-Control-Request-Method':'POST'}).headers.get('Access-Control-Allow-Origin') is None
        login(c)
        assert c.put('/api/auth/preferences',headers={**H,'Origin':'https://evil.invalid'},
                     json={'language':'hi','tour_done':True}).status_code==403
        assert c.put('/api/auth/preferences',headers=H,
                     json={'language':'hi','tour_done':True}).status_code==200


def test_expensive_authenticated_search_requests_get_throttled(tmp_path):
    c,path=client(tmp_path)
    with c:
        add_account(path,'owner',PW,role='owner')
        login(c)
        # Rate limits are per account and endpoint, not per public IP address.
        with connect(path) as db:
            for _ in range(120):
                db.execute('INSERT INTO api_rate_limits(bucket,at) VALUES (?,?)',
                           ('unused',0))
        from app.accounts import digest
        import time
        with connect(path) as db:
            uid=db.execute("SELECT id FROM accounts WHERE username='owner'").fetchone()[0]
            db.execute('DELETE FROM api_rate_limits')
            for _ in range(120):
                db.execute('INSERT INTO api_rate_limits(bucket,at) VALUES (?,?)',
                           (digest(uid+':/api/warehouse/search'),time.time()))
        blocked=c.post('/api/warehouse/search',headers=H,json={'query':'motor'})
        assert blocked.status_code==429
        assert blocked.headers['Retry-After']=='60'
        assert 'Content-Security-Policy' in blocked.headers
        assert c.get('/api/warehouse/meta').status_code==200


def test_staff_is_denied_owner_routes_and_invalid_json(tmp_path):
    c,path=client(tmp_path)
    with c:
        add_account(path,'owner',PW,role='owner')
        add_account(path,'staff',PW)
        login(c,'staff')
        assert c.put('/api/warehouse/settings',headers=H,json={}).status_code==403
        assert c.put('/api/warehouse/items',headers=H,json={}).status_code==403
        assert c.post('/api/media',headers=H,content=b'not a photo').status_code==403
        assert c.get('/api/users').status_code==403
        assert c.post('/api/warehouse/imports?collection=appliances&filename=x.csv',
                      headers=H,content=b'sku,name\na,b').status_code==403


def test_sqlite_file_is_owner_only_on_unix(tmp_path):
    c,path=client(tmp_path)
    with c:
        if os.name=='posix':
            assert stat.S_IMODE(path.stat().st_mode)==0o600
