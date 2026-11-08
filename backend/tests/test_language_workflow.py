import asyncio
import io
import wave
import pytest
import httpx
from fastapi.testclient import TestClient
from app.main import create_app
from app.services import voice
from app.services.language import normalize_query,followup_constraints

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setenv('SHOP_FINDER_STAFF_TOKEN','t'*32)
    monkeypatch.delenv('GNANI_ENABLED',raising=False)
    with TestClient(create_app(tmp_path/'language.sqlite3',seed_demo=True,auth_required=False)) as c:yield c
H={'X-Staff-Token':'t'*32}

@pytest.mark.parametrize('query', ['fan capacitor','पंखे का कैपेसिटर कहाँ है','pankhe ka capacitor kidhar hai'])
def test_three_query_forms_retrieve_same_candidates(client,query):
    r=client.post('/api/search',json={'query':query,'language':'hi-IN'})
    assert r.status_code==200
    assert {p['id'] for p in r.json()['candidates']}=={'DEMO-008','DEMO-009','DEMO-010'}
    assert not r.json()['recommendation_allowed']
    assert 'रेटिंग' in r.json()['spoken_text']

@pytest.mark.parametrize('query', ['पंखे का कैपेसिटर २.५ माइक्रोफैराड','fan capacitor 2.5 uf'])
def test_rating_kept_exact(client,query):
    r=client.post('/api/search',json={'query':query,'language':'hi-IN','constraints':{'specifications':{'voltage_v':440}}}).json()
    assert [p['id'] for p in r['candidates']]==['DEMO-008']
    assert 'काल्पनिक' in r['spoken_text']
    assert 'रैक' in r['spoken_text'] and 'SYN-008' in r['spoken_text']

@pytest.mark.parametrize('query', ['पंखे का कैपेसिटर नहीं','पंखे का कैपेसिटर अनजानशब्द','fan capacitor 2.5 uf 3.15 uf'])
def test_unknown_or_conflicting_request_abstains(client,query):
    r=client.post('/api/search',json={'query':query,'language':'hi-IN'}).json()
    assert not r['candidates']
    assert not r['recommendation_allowed']
    assert 'स्टाफ' in r['spoken_text']

def test_voice_followup_retains_rating_and_language(client):
    r=client.post('/api/search',json={'query':'fan capacitor','language':'hi-IN','constraints':{'specifications':{'voltage_v':440}}}).json()
    r=client.post('/api/clarify',json={'session_id':r['session_id'],'reply':'२.५ माइक्रोफैराड'}).json()
    assert [p['id'] for p in r['candidates']]==['DEMO-008']
    assert r['language']=='hi-IN'
    bad=client.post('/api/clarify',json={'session_id':r['session_id'],'reply':'450 V'})
    assert bad.status_code==409
    assert client.post('/api/clarify',json={'session_id':r['session_id'],'reply':'any similar one'}).status_code==422
    assert client.post('/api/clarify',json={'session_id':r['session_id'],'reply':'3.15 uf'}).status_code==409

def test_conflict_between_reply_and_structured_fields(client):
    r=client.post('/api/search',json={'query':'fan capacitor'}).json()
    assert client.post('/api/clarify',json={'session_id':r['session_id'],'reply':'2.5 uf','constraints':{'specifications':{'capacitance_uf':3.15}}}).status_code==409

def wav(seconds=1):
    b=io.BytesIO()
    with wave.open(b,'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(16000);w.writeframes(b'\0\0'*16000*seconds)
    return b.getvalue()

@pytest.mark.parametrize('language,provider_language,selected_voice',[('en-IN','en-IN','Kaveri'),('hi-IN','hi-IN','Nalini'),('hi-en','indic-auto','Poorvi')])
def test_provider_contracts_and_session_bound_reply(client,monkeypatch,language,provider_language,selected_voice):
    calls=[]
    async def fake(endpoint,**kwargs):
        calls.append((endpoint,kwargs))
        if endpoint=='/stt/v3':return httpx.Response(200,json={'success':True,'transcript':'fan capacitor','model':'prisma-v3.0'})
        return httpx.Response(200,content=wav())
    monkeypatch.setattr(voice,'call',fake)
    r=client.post('/api/voice/transcribe?language='+language,headers=H,content=wav())
    assert r.status_code==200 and r.json()['stt_ms']>=0
    assert calls[0][1]['data']['language_code']==provider_language
    assert calls[0][1]['data']['model']=='prisma-v3.0'
    assert calls[0][1]['data']['format']=='transcribe'
    if language=='hi-en':assert calls[0][1]['data']['multi_lang_codes']=='hi-IN,en-IN'
    result=client.post('/api/search',json={'query':'SYN-008','language':language}).json()
    assert client.post('/api/voice/speak/'+result['session_id']).status_code==401
    audio=client.post('/api/voice/speak/'+result['session_id'],headers=H)
    assert audio.status_code==200
    body=calls[-1][1]['json']
    assert body['text']==result['spoken_text']
    assert body['voice']==selected_voice and body['language']==language and body['model']=='timbre-v2.5'

def test_bad_language_and_overlong_audio_rejected(client):
    assert client.post('/api/search',json={'query':'fan','language':'xx'}).status_code==422
    assert client.post('/api/voice/transcribe?language=xx',content=wav(),headers=H).status_code==422
    assert client.post('/api/voice/transcribe',content=wav(31),headers=H).status_code==422

def test_empty_or_wrong_model_transcript_is_not_silently_used(monkeypatch):
    for data in [{'success':True,'transcript':' '},{'success':True,'transcript':'fan','model':'prisma-v2.5'}]:
        async def fake(*args,**kwargs):return httpx.Response(200,json=data)
        monkeypatch.setattr(voice,'call',fake)
        with pytest.raises(Exception) as error:asyncio.run(voice.transcribe(wav(),'hi-IN'))
        assert error.value.status_code==502

def test_prisma_v3_auto_detect_and_codestyle_contract(client,monkeypatch):
 calls=[]
 async def fake(endpoint,**kwargs):
  calls.append(kwargs)
  return httpx.Response(200,json={'success':True,'transcript':'basmati rice 5 kg',
     'model':'prisma-v3.0','detected_language_code':'hi-IN'})
 monkeypatch.setattr(voice,'call',fake)
 response=client.post('/api/voice/transcribe?language=auto&style=codemix&enhanced=true&collection=grocery',
                      headers=H,content=wav())
 assert response.status_code==200,response.text
 j=response.json()
 assert j['transcript']=='basmati rice 5 kg'
 assert j['model']=='prisma-v3.0' and j['detected_language_code']=='hi-IN'
 assert j['search_language']=='hi-IN'
 form=calls[0]['data']
 assert form['model']=='prisma-v3.0'
 assert form['language_code']=='indic-auto'
 assert form['format']=='codemix' and 'multi_lang_codes' not in form
 assert 'topic' in form

def test_prisma_v3_hints_are_bounded_and_styles_validated():
 from app.services.voice import _stt_options
 options,model=_stt_options('hi-en','transcribe',True,
               ['Brown loafers','ब्राउन लोफर्स','Brown loafers']+['Product '+str(i) for i in range(200)])
 assert model=='prisma-v3.0'
 assert options['language_code']=='indic-auto'
 assert len(__import__('json').loads(options['keywords']))==80
 assert 'Brown loafers' in options['keywords']
 with pytest.raises(Exception) as e:_stt_options('auto','invalid style')
 assert e.value.status_code==422

def test_prisma_v25_explicit_rollback_blocks_v3_only_features(monkeypatch):
 monkeypatch.setenv('GNANI_STT_MODEL','prisma-v2.5')
 form,model=voice._stt_options('hi-IN','transcribe')
 assert model=='prisma-v2.5' and 'model' not in form
 assert form['language_code']=='hi-IN'
 with pytest.raises(Exception) as e:voice._stt_options('auto')
 assert e.value.status_code==422

def test_v3_truncated_audio_is_rejected(monkeypatch):
 async def fake(endpoint,**kwargs):
  return httpx.Response(200,json={'success':True,'transcript':'item',
                                  'model':'prisma-v3.0','truncated':True})
 monkeypatch.setattr(voice,'call',fake)
 with pytest.raises(Exception) as e:asyncio.run(voice.transcribe(wav(),'hi-IN'))
 assert e.value.status_code==502

@pytest.mark.parametrize('code',voice.STT_LANGUAGES)
def test_prisma_v3_accepts_all_ten_spoken_input_languages(monkeypatch,code):
 monkeypatch.setenv('GNANI_STT_MODEL','prisma-v3.0')
 form,model=voice._stt_options(code)
 assert model=='prisma-v3.0' and form['language_code']==code
 assert 'multi_lang_codes' not in form

def test_prisma_v3_optional_two_to_four_detection_hints_are_validated(monkeypatch):
 monkeypatch.setenv('GNANI_STT_MODEL','prisma-v3.0')
 form,_=voice._stt_options('auto',language_candidates='kn-IN,en-IN,hi-IN')
 assert form['language_code']=='indic-auto'
 assert form['multi_lang_codes']=='kn-IN,en-IN,hi-IN'
 for value in ('hi-IN','xx-IN,en-IN','hi-IN,hi-IN','hi-IN,en-IN,kn-IN,ta-IN,mr-IN'):
  with pytest.raises(Exception) as error:voice._stt_options('auto',language_candidates=value)
  assert error.value.status_code==422
 with pytest.raises(Exception) as error:voice._stt_options('kn-IN',language_candidates='kn-IN,en-IN')
 assert error.value.status_code==422

def test_auto_detection_keeps_kannada_code_and_warehouse_accepts_native_alias(client,monkeypatch):
 async def fake(endpoint,**kwargs):
  return httpx.Response(200,json={'success':True,'transcript':'ಮಿಕ್ಸರ್','model':'prisma-v3.0','detected_language_code':'kn-IN'})
 monkeypatch.setattr(voice,'call',fake)
 response=client.post('/api/voice/transcribe?language=auto&candidates=kn-IN,en-IN',headers=H,content=wav())
 assert response.status_code==200,response.text
 assert response.json()['detected_language_code']=='kn-IN'
 assert response.json()['search_language']=='kn-IN'
 assert client.post('/api/warehouse/search',json={'query':'nonexistent product','collection':'all','language':'kn-IN'},headers=H).status_code==200
 assert client.post('/api/voice/transcribe?language=auto&candidates=kn-IN',headers=H,content=wav()).status_code==422
