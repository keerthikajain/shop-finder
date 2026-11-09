"""Public-judge signup uses the real warehouse app with isolated databases."""
import os
from fastapi.testclient import TestClient
from app.main import create_app
from app.challenge_workspaces import ChallengeDispatcher
from app.accounts import COOKIE

H={'X-Shop-Request':'1'}

def test_separate_judge_workspaces_use_real_owner_permissions_and_catalogues(monkeypatch,tmp_path):
 monkeypatch.setenv('SHOP_FINDER_CHALLENGE_SIGNUP','true')
 monkeypatch.setenv('SHOP_FINDER_CHALLENGE_DATA_DIR',str(tmp_path/'reviewers'))
 base=tmp_path/'root.sqlite3'
 root=create_app(base,seed_demo=False,challenge_root=True)
 app=ChallengeDispatcher(root,base)
 with TestClient(app) as first,TestClient(app) as second:
  start=first.get('/api/auth/status')
  assert start.status_code==200
  assert start.json()['signup_enabled'] is True
  assert start.json()['configured'] is True
  signed=first.post('/api/challenge/signup',headers=H,json={
   'username':'judge_one','password':'strong-judge-password-111','language':'en'})
  assert signed.status_code==200,signed.text
  assert signed.json()['role']=='owner'
  assert signed.json()['is_challenge'] is True
  assert COOKIE in first.cookies
  one=first.get('/api/warehouse/items?collection=all')
  assert one.status_code==200,one.text
  assert len(one.json())>=10
  original=one.json()[0]
  record={key:value for key,value in original.items() if key not in ('revision','updated_at','updated_by')}
  record.update({'sku':'REVIEW-OWN-991','name':'Reviewer exclusive sample part','barcode':'','synthetic':True})
  record['placements']=[{k:v for k,v in place.items() if k!='code'} for place in record['placements']]
  added=first.put('/api/warehouse/items',headers=H,json={'item':record,'revision':0,'reason':'test'})
  assert added.status_code==200,added.text
  assert any(x['sku']=='REVIEW-OWN-991' for x in first.get('/api/warehouse/items?collection=all').json())
  other=second.post('/api/challenge/signup',headers=H,json={
   'username':'judge_two','password':'strong-judge-password-222','language':'hi'})
  assert other.status_code==200,other.text
  assert other.json()['role']=='owner'
  distinct=second.get('/api/warehouse/items?collection=all')
  assert distinct.status_code==200
  assert not any(x['sku']=='REVIEW-OWN-991' for x in distinct.json())
  assert first.get('/api/warehouse/items?collection=all').status_code==200
  photo=first.post('/api/media',headers=H,content=b'\x89PNG\r\n\x1a\n-private-example-image')
  assert photo.status_code==200,photo.text
  photo_url=photo.json()['url']
  assert first.get(photo_url).status_code==200
  assert second.get(photo_url).status_code==404
  assert first.get('/api/users').status_code==200
  assert second.get('/api/users').status_code==200
  invitation=first.post('/api/users/invitations',headers=H)
  assert invitation.status_code==200,invitation.text
  with TestClient(app) as staff_browser:
   enrolled=staff_browser.post('/api/auth/join',headers=H,json={'code':invitation.json()['code'],
      'username':'worker_review_1','password':'strong-review-worker-abc','language':'en'})
   assert enrolled.status_code==201,enrolled.text
   signed_staff=staff_browser.post('/api/auth/login',headers=H,json={'username':'worker_review_1',
      'password':'strong-review-worker-abc'})
   assert signed_staff.status_code==200,signed_staff.text
   assert signed_staff.json()['role']=='staff'
   assert staff_browser.get('/api/warehouse/items?collection=all').status_code==200
   assert staff_browser.get('/api/users').status_code==403
  assert first.get('/api/auth/status').json()['user']['username']=='judge_one'
  assert second.get('/api/auth/status').json()['user']['username']=='judge_two'
  assert second.post('/api/auth/logout',headers=H).status_code==200
  signed_back=second.post('/api/auth/login',headers=H,json={'username':'judge_two','password':'strong-judge-password-222'})
  assert signed_back.status_code==200,signed_back.text
  assert second.get('/api/auth/status').json()['user']['username']=='judge_two'

def test_instant_try_is_private_owner_and_disabled_outside_challenge(monkeypatch,tmp_path):
 base=tmp_path/'root.sqlite3'
 root=create_app(base,seed_demo=False,challenge_root=True)
 app=ChallengeDispatcher(root,base)
 monkeypatch.delenv('SHOP_FINDER_CHALLENGE_SIGNUP',raising=False)
 with TestClient(app) as client:
  assert client.post('/api/challenge/try',headers=H).status_code==404
 monkeypatch.setenv('SHOP_FINDER_CHALLENGE_SIGNUP','true')
 monkeypatch.setenv('SHOP_FINDER_CHALLENGE_DATA_DIR',str(tmp_path/'instant'))
 with TestClient(app) as client:
  preview=client.post('/api/challenge/try',headers=H)
  assert preview.status_code==200,preview.text
  assert preview.json()['role']=='owner'
  assert preview.json()['is_challenge'] is True
  assert client.get('/api/warehouse/items?collection=all').status_code==200
  assert client.get('/api/users').status_code==200
