import json,io,wave,asyncio
import pytest,httpx
from fastapi.testclient import TestClient
from fastapi import HTTPException
from app.main import create_app
from app.database import SEED
from app.services import voice

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setenv('SHOP_FINDER_STAFF_TOKEN','a'*32)
    monkeypatch.delenv('GNANI_ENABLED',raising=False)
    with TestClient(create_app(tmp_path/'db.sqlite3',auth_required=False)) as c:yield c
H={'X-Staff-Token':'a'*32}

def test_clarification_preserves_candidates_and_rejects_conflicts(client):
    first=client.post('/api/search',json={'query':'fan condenser','constraints':{'specifications':{'voltage_v':440}}}).json()
    assert len(first['candidates'])==2
    second=client.post('/api/clarify',json={'session_id':first['session_id'],'constraints':{'part_number':'SYN-008'}}).json()
    assert [p['id'] for p in second['candidates']]==['DEMO-008']
    r=client.post('/api/clarify',json={'session_id':second['session_id'],'constraints':{'specifications':{'voltage_v':450}}})
    assert r.status_code==409
    assert client.post('/api/clarify',json={'session_id':'bad','constraints':{}}).status_code==410

def test_unresolved_access_and_resolution(client):
    client.post('/api/search',json={'query':'absent magnetron'})
    assert client.get('/api/unresolved').status_code==401
    q=client.get('/api/unresolved',headers=H).json()[0]
    assert client.post(f"/api/unresolved/{q['id']}/resolve",headers=H,json={'note':'Not in catalogue','product_id':None}).status_code==200
    assert client.get('/api/unresolved',headers=H).json()[0]['status']=='resolved'

def test_edit_invalidates_verification_and_retains_provenance(client):
    p=client.get('/api/products/DEMO-008').json();p['aliases'].append('test alias')
    assert client.put('/api/products/DEMO-008',json=p).status_code==401
    r=client.put('/api/products/DEMO-008',headers=H,json=p)
    assert r.status_code==200 and r.json()['verification']['status']=='needs_review'
    p['is_synthetic']=False
    assert client.put('/api/products/DEMO-008',headers=H,json=p).status_code==422

def test_synthetic_verification_rejected(client):
    r=client.post('/api/products/DEMO-008/verify',headers=H,json={'verification':{'status':'verified','verified_by':'staff','verified_at':'2026-10-24T12:00:00Z','evidence':[]}})
    assert r.status_code==422

def test_create_duplicate_and_unknown_link(client):
    p=client.get('/api/products/DEMO-008').json()
    assert client.post('/api/products',headers=H,json=p).status_code==409
    p['id']='NEW-TEST'
    assert client.post('/api/products',headers=H,json=p).status_code==200
    assert client.get('/api/products/NEW-TEST').status_code==200
    assert client.post('/api/unresolved/999/resolve',headers=H,json={'note':'ok','product_id':'bad'}).status_code==422

def test_numeric_and_supply_conflicts(client):
    for q in ['SYN-008 440 V 450 V','SYN-008 AC DC','SYN-008 12 mm','SYN-008 model unknown','SYN-008 450 V','SYN-008 2 spade terminals']:
        r=client.post('/api/search',json={'query':q}).json()
        assert not r['candidates'] and not r['recommendation_allowed']

def wav():
    buf=io.BytesIO()
    with wave.open(buf,'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(16000);w.writeframes(b'\0\0'*16000)
    return buf.getvalue()

def test_voice_disabled_and_bad_audio(client):
    assert client.post('/api/voice/transcribe',headers=H,content=b'bad').status_code==422
    assert client.post('/api/voice/transcribe',headers=H,content=wav()).status_code==503
    assert client.post('/api/voice/transcribe',content=wav()).status_code==401

def test_voice_contract_without_network(monkeypatch):
    calls=[]
    async def fake(endpoint,**kwargs):
        calls.append((endpoint,kwargs))
        if endpoint=='/stt/v3':return httpx.Response(200,json={'success':True,'transcript':'fan condenser'})
        return httpx.Response(200,content=b'RIFFtest')
    monkeypatch.setattr(voice,'call',fake)
    assert asyncio.run(voice.transcribe(wav(),'en-IN'))=='fan condenser'
    assert asyncio.run(voice.speak('Synthetic demo')).startswith(b'RIFF')
    assert calls[0][1]['data']['language_code']=='en-IN'
    assert calls[1][1]['json']['model']=='timbre-v2.5'
    assert calls[1][1]['json']['audio_config']['container']=='wav'

def test_evaluation_regressions(client):
    for q,ids in [('2.5 uF 440 V fan capacitor',['DEMO-008']),('fridge rubber',['DEMO-006','DEMO-007']),('thermal fuse 216 C',['DEMO-017']),('RO valve 36 V DC wire leads',[])]:
        r=client.post('/api/search',json={'query':q}).json()
        assert [p['id'] for p in r['candidates']]==ids

def test_named_dimensions_are_hard_constraints(client):
    assert [p['id'] for p in client.post('/api/search',json={'query':'washing machine pump 30 W 22 mm outlet'}).json()['candidates']]==['DEMO-001']
    assert not client.post('/api/search',json={'query':'washing machine pump 30 W 24 mm outlet'}).json()['candidates']
