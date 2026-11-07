import asyncio
import json
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.database import seed, SEED, list_products, connect
from app.main import create_app
from app.schemas import Product
from app.services.catalogue import recommendation_allowed
from app.services.gnani_stt import MockPrisma, VoiceUnavailable
from app.services.gnani_tts import MockTimbre

@pytest.fixture
def records(): return json.loads(SEED.read_text())

@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path/'test.sqlite3',seed_demo=True,auth_required=False)) as c: yield c

def test_health_and_schema(client):
    assert client.get('/api/health').json()['product_count'] == 20
    assert client.get('/openapi.json').status_code == 404
    assert '/api/products' in client.app.openapi()['paths']

def test_categories_and_seed_provenance(client):
    rows=client.get('/api/products').json()
    assert len(rows)==20
    assert len({r['id'] for r in rows})==20
    assert len({r['appliance_category'] for r in rows})==6
    for r in rows:
        assert r['is_synthetic'] and r['verification']['status']=='unverified'
        assert not r['compatibility'] and r['manufacturer'] is None and r['model'] is None
        assert r['part_number'].startswith('SYN-')

@pytest.mark.parametrize('index',range(1,21))
def test_each_record_retrievable_but_never_recommended(client,index):
    response=client.get(f'/api/products/DEMO-{index:03}')
    assert response.status_code==200
    assert not recommendation_allowed(Product.model_validate(response.json()))

def test_filter_is_exact_and_rejects_unknown_category(client):
    assert len(client.get('/api/products?category=fan').json())==4
    assert client.get('/api/products?category=unknown').status_code==422

def test_unknown_id_and_injection_do_not_match(client):
    assert client.get('/api/products/DEMO-999').status_code==404
    assert client.get("/api/products/%27%20OR%201=1--").status_code==404

def test_no_catalogue_mutations_exposed(client):
    assert client.post('/api/products',json={'name':'change'}).status_code in (401,503)
    assert client.put('/api/products/DEMO-001',json={'name':'change'}).status_code in (401,503)

def test_seed_does_not_overwrite_staff_edits(tmp_path):
    db=tmp_path/'test.sqlite3'
    assert seed(db)==20
    with connect(db) as conn:
        row=json.loads(conn.execute("SELECT payload FROM products WHERE id='DEMO-001'").fetchone()[0])
        row['aliases'].append('staff-added nickname')
        conn.execute('UPDATE products SET payload=? WHERE id=?',(json.dumps(row),'DEMO-001'))
    assert seed(db)==0
    assert 'staff-added nickname' in list_products(db)[0].aliases

def test_invalid_seed_is_atomic(tmp_path,records):
    db=tmp_path/'test.sqlite3';seed(db)
    records[-1]['verification']['status']='verified'
    source=tmp_path/'bad.json';source.write_text(json.dumps(records))
    with pytest.raises(ValidationError):seed(db,source)
    assert len(list_products(db))==20

def test_duplicate_seed_ids_rejected(tmp_path,records):
    records[-1]['id']=records[0]['id']
    source=tmp_path/'bad.json';source.write_text(json.dumps(records))
    with pytest.raises(ValueError,match='Duplicate'):seed(tmp_path/'test.sqlite3',source)

def test_synthetic_cannot_be_marked_verified(records):
    records[0]['verification']['status']='verified'
    with pytest.raises(ValidationError):Product.model_validate(records[0])

def test_real_verification_requires_field_evidence(records):
    p=records[0];p['is_synthetic']=False;p['part_number_kind']='manufacturer'
    p['verification'].update(status='verified',verified_by='staff-1',verified_at='2026-10-24T08:30:00Z')
    with pytest.raises(ValidationError,match='Every populated'):Product.model_validate(p)

def test_synthetic_cannot_claim_real_model(records):
    records[0]['model']='Actual model'
    with pytest.raises(ValidationError):Product.model_validate(records[0])

def test_compatibility_requires_evidence(records):
    p=records[0];p['is_synthetic']=False
    p['compatibility']=[{'manufacturer':'Example','model':'X'}]
    with pytest.raises(ValidationError):Product.model_validate(p)

def test_capacitor_variants_remain_distinct(records):
    variants=[r for r in records if r['name']=='Fan run capacitor']
    assert len(variants)==3
    assert len({(v['specifications']['capacitance_uf'],v['specifications']['voltage_v'],v['connector_type']) for v in variants})==3

def test_seed_can_be_disabled(tmp_path):
    with TestClient(create_app(tmp_path/'empty.sqlite3',seed_demo=False,auth_required=False)) as c:
        assert c.get('/api/products').json()==[]

def test_mock_voice_never_fakes_a_transcript_or_audio():
    with pytest.raises(VoiceUnavailable):asyncio.run(MockPrisma().transcribe(b'fake','hi-IN'))
    with pytest.raises(VoiceUnavailable):asyncio.run(MockTimbre().synthesize('text','hi-IN'))

def test_capabilities_do_not_claim_unbuilt_work(client):
    c=client.get('/api/capabilities').json()
    assert c['search'] and c['clarification'] and c['staff_edit']
    assert c['prisma']=='disabled'

def test_search_identifier_and_rating_conflict(records):
    from app.services.matching import search
    ps=[Product.model_validate(r) for r in records]
    assert [p['id'] for p in search(ps,'SYN-008')['candidates']]==['DEMO-008']
    assert not search(ps,'SYN-008 450 V')['candidates']
    assert not search(ps,'SYN-008 DC')['candidates']
    assert not search(ps,'SYN-999')['candidates']
    assert search(ps,'substitute fan capacitor')['status']=='staff_review'
    assert len(search(ps,'fan condenser')['candidates'])==3
    assert not search(ps,'fan condenser')['recommendation_allowed']

@pytest.mark.parametrize('constraints,expected',[
    ({'connector_type':'2 wire leads'},['DEMO-008']),
    ({'connector_type':'2 spade terminals'},[]),
    ({'model':'unknown-model'},[]),
    ({'manufacturer':'unknown-maker'},[]),
    ({'dimensions':{'width_mm':99}},[]),
    ({'specifications':{'capacitance_uf':3.15}},[]),
])
def test_structured_constraints(client,constraints,expected):
    r=client.post('/api/search',json={'query':'SYN-008','constraints':constraints})
    assert r.status_code==200
    assert [p['id'] for p in r.json()['candidates']]==expected
    assert r.json()['recommendation_allowed'] is False

def test_search_validation(client):
    assert client.post('/api/search',json={'query':''}).status_code==422
    assert client.post('/api/search',json={'query':'fan','constraints':{'unsupported':'x'}}).status_code==422
