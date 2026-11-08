"""Security and framing regression tests for the authenticated live proxy.

Provider responses are simulated; these do not claim real Gnani latency,
websocket credentials, language accuracy or microphone behavior.
"""
import asyncio
import json
from collections import deque
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.accounts import add_account
from app.main import create_app
from app.streaming import provider_headers, MAX_BYTES, FRAME_BYTES


@pytest.fixture
def signed_in(tmp_path, monkeypatch):
    monkeypatch.setenv('GNANI_ENABLED', 'true')
    monkeypatch.setenv('GNANI_API_KEY', 'synthetic-not-a-real-key')
    monkeypatch.setenv('GNANI_STT_MODEL', 'prisma-v3.0')
    db = tmp_path / 'live.sqlite3'
    with TestClient(create_app(db, seed_demo=True)) as client:
        add_account(db, 'owner', 'ComplexOwnerPassword2026!', 'owner')
        login = client.post('/api/auth/login',
                            headers={'X-Shop-Request':'1'},
                            json={'username':'owner','password':'ComplexOwnerPassword2026!'})
        assert login.status_code == 200, login.text
        yield client


def test_provider_headers_never_put_secrets_in_url(monkeypatch):
    monkeypatch.setenv('GNANI_STT_MODEL', 'prisma-v3.0')
    monkeypatch.setenv('GNANI_API_KEY', 'not-a-real-key')
    headers = provider_headers('hi-en', 'codemix', True, ['बासमती चावल','Basmati rice'])
    assert headers['x-api-key-id']=='not-a-real-key'
    assert headers['lang_code']=='indic-auto'
    assert headers['x-model']=='prisma-v3.0'
    assert headers['x-sample-rate']=='16000'
    assert headers['x-language-candidates']=='hi-IN,en-IN'
    assert json.loads(headers['x-keywords'])==['बासमती चावल','Basmati rice']
    assert headers['x-keywords'].isascii()


@pytest.mark.parametrize('origin', [None,'https://attacker.example','http://testserver.evil.example'])
def test_live_proxy_refuses_missing_or_cross_site_origin(signed_in,origin):
    headers={} if origin is None else {'origin':origin}
    with pytest.raises(WebSocketDisconnect) as ex:
        with signed_in.websocket_connect('/api/voice/live',headers=headers):
            pass
    assert ex.value.code==1008


def test_live_proxy_requires_real_login(tmp_path,monkeypatch):
    monkeypatch.setenv('GNANI_ENABLED','true')
    monkeypatch.setenv('GNANI_API_KEY','synthetic-key')
    with TestClient(create_app(tmp_path/'no-login.sqlite3')) as client:
        with pytest.raises(WebSocketDisconnect) as ex:
            with client.websocket_connect('/api/voice/live',headers={'origin':'http://testserver'}):
                pass
        assert ex.value.code==1008


def test_live_proxy_disabled_without_key(signed_in,monkeypatch):
    monkeypatch.setenv('GNANI_ENABLED','false')
    with pytest.raises(WebSocketDisconnect) as ex:
        with signed_in.websocket_connect('/api/voice/live',headers={'origin':'http://testserver'}):
            pass
    assert ex.value.code==1013


def test_streaming_header_options_and_invalid_frame(signed_in,monkeypatch):
    import websockets.asyncio.client as clientlib
    connections=[]
    class Provider:
        def __init__(self):
            self.sent=[]
            connections.append(self)
        async def __aenter__(self):return self
        async def __aexit__(self,*args):pass
        async def recv(self):return json.dumps({'type':'connected'})
        async def send(self,data):self.sent.append(data)
        async def __aiter__(self):
            # Provider is quiet: only invalid-frame rejection should be tested.
            await asyncio.sleep(5)
            if False:yield ''
    def fake_connect(url,**kwargs):
        assert url=='wss://api.vachana.ai/stt/v3/stream'
        assert kwargs['additional_headers']['x-model']=='prisma-v3.0'
        assert kwargs['additional_headers']['x-api-key-id']=='synthetic-not-a-real-key'
        assert kwargs['additional_headers']['x-language-candidates']=='hi-IN,en-IN'
        return Provider()
    monkeypatch.setattr(clientlib,'connect',fake_connect)
    with signed_in.websocket_connect(
        '/api/voice/live?language=auto&style=transcribe&enhanced=true&collection=grocery&candidates=hi-IN,en-IN',
        headers={'origin':'http://testserver'}
    ) as ws:
        assert ws.receive_json()=={'type':'ready'}
        ws.send_bytes(b'x'*200)
        assert ws.receive_json()['type']=='error'
    assert connections and connections[0].sent==[]


def test_live_stream_segment_and_completion(signed_in,monkeypatch):
    import websockets.asyncio.client as clientlib
    connections=[]
    class Provider:
        def __init__(self):
            self.sent=[]
            self.queue=asyncio.Queue()
            connections.append(self)
        async def __aenter__(self):return self
        async def __aexit__(self,*args):
            await self.queue.put(None)
        async def recv(self):return json.dumps({'type':'connected'})
        async def send(self,chunk):
            self.sent.append(chunk)
            if len(self.sent)==1:
                await self.queue.put(json.dumps({'type':'transcript','text':'बासमती चावल पाँच किलो',
                                                 'detected_language_code':'hi-IN'}))
        async def __aiter__(self):
            while True:
                item=await self.queue.get()
                if item is None:break
                yield item
    def fake_connect(url,**kwargs):
        assert 'GNANI_API_KEY' not in url
        return Provider()
    monkeypatch.setattr(clientlib,'connect',fake_connect)
    with signed_in.websocket_connect(
        '/api/voice/live?language=auto&style=transcribe&collection=all',
        headers={'origin':'http://testserver'}
    ) as ws:
        assert ws.receive_json()['type']=='ready'
        ws.send_bytes(bytes(FRAME_BYTES))
        segment=ws.receive_json()
        assert segment['type']=='segment'
        assert segment['text']=='बासमती चावल पाँच किलो'
        ws.send_json({'type':'stop'})
        done=ws.receive_json()
        assert done['type']=='complete'
        assert done['transcript']=='बासमती चावल पाँच किलो'
        assert done['search_language']=='hi-IN'
    assert len(connections[0].sent)>=33
    assert all(len(frame)==FRAME_BYTES for frame in connections[0].sent)

def test_live_supported_languages_and_optional_hint_validation(monkeypatch):
 monkeypatch.setenv('GNANI_STT_MODEL','prisma-v3.0')
 monkeypatch.setenv('GNANI_API_KEY','test-not-a-secret')
 for language in voice.STT_LANGUAGES:
  headers=provider_headers(language,'transcribe',True,[])
  assert headers['lang_code']==language
 assert provider_headers('auto','transcribe',True,[])['lang_code']=='indic-auto'
 assert 'x-language-candidates' not in provider_headers('auto','transcribe',True,[])
 h=provider_headers('auto','transcribe',True,[],'ta-IN,kn-IN,en-IN')
 assert h['x-language-candidates']=='ta-IN,kn-IN,en-IN'
 with pytest.raises(ValueError):provider_headers('ta-IN','transcribe',True,[],'ta-IN,en-IN')
