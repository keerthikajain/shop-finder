"""Opt-in judge workspaces. Each reviewer gets the real application and its own SQLite DB.

Only enable on a dedicated challenge deployment with a persistent volume.
Normal installations retain the existing owner-and-staff authentication.
"""
import hashlib
import json
import os
import secrets
import sqlite3
import time
from functools import lru_cache
from http.cookies import SimpleCookie
from pathlib import Path

from fastapi import HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from .accounts import COOKIE, TTL, add_account, digest, initialize_accounts, public
from .database import initialize, seed
from .warehouse import initialize_warehouse

WORKSPACE_COOKIE='shop_workspace'
WEEK=7*86400
MAX_WORKSPACES=250

class JudgeSignup(BaseModel):
 model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
 username:str=Field(min_length=3,max_length=50,pattern=r'^[A-Za-z0-9_.-]+$')
 password:str=Field(min_length=12,max_length=128)
 language:str=Field(default='en',pattern=r'^(en|hi|kn|te|ta|ml|bn|mr|gu|pa)$')

def enabled():
 return os.getenv('SHOP_FINDER_CHALLENGE_SIGNUP','false').lower()=='true'

def root_dir(base):
 return Path(os.getenv('SHOP_FINDER_CHALLENGE_DATA_DIR',str(Path(base).parent/'reviewer_workspaces'))).resolve()

def ensure_registry(base):
 directory=root_dir(base)
 directory.mkdir(parents=True,exist_ok=True,mode=0o700)
 if os.name=='posix':os.chmod(directory,0o700)
 with sqlite3.connect(base) as c:
  c.execute('CREATE TABLE IF NOT EXISTS challenge_workspaces(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,created REAL NOT NULL,db_name TEXT UNIQUE NOT NULL)')
  c.execute('CREATE TABLE IF NOT EXISTS challenge_sessions(digest TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,expires REAL NOT NULL)')
  c.execute('CREATE TABLE IF NOT EXISTS challenge_users(username TEXT PRIMARY KEY,workspace_id TEXT NOT NULL)')
  c.execute('CREATE TABLE IF NOT EXISTS challenge_codes(digest TEXT PRIMARY KEY,workspace_id TEXT NOT NULL)')
  c.execute('CREATE TABLE IF NOT EXISTS challenge_attempts(ip TEXT NOT NULL,at REAL NOT NULL)')
  c.execute('CREATE INDEX IF NOT EXISTS challenge_session_expiry ON challenge_sessions(expires)')

def registry(base):
 c=sqlite3.connect(base)
 c.row_factory=sqlite3.Row
 return c

def safe_path(base,wid):
 # Paths come exclusively from a generated 32-character hex ID in our registry.
 if len(wid)!=32 or any(c not in '0123456789abcdef' for c in wid):return None
 p=(root_dir(base)/(wid+'.sqlite3')).resolve()
 return p if p.parent==root_dir(base) else None

def workspace_for_cookie(base,wid):
 p=safe_path(base,wid)
 if p is None:return None
 with registry(base) as c:
  row=c.execute('SELECT 1 FROM challenge_workspaces WHERE id=?',(wid,)).fetchone()
 return p if row and p.exists() else None

def username_workspace(base,username):
 with registry(base) as c:
  row=c.execute('SELECT workspace_id FROM challenge_users WHERE username=?',(username.lower(),)).fetchone()
 return row['workspace_id'] if row else None

def register_session(base,token,wid):
 with registry(base) as c:
  c.execute('INSERT OR REPLACE INTO challenge_sessions(digest,workspace_id,expires) VALUES (?,?,?)',(digest(token),wid,time.time()+TTL))

def _cookie(response,name,value,max_age):
 response.set_cookie(name,value,httponly=True,samesite='strict',secure=os.getenv('SHOP_FINDER_SECURE_COOKIE')=='true',max_age=max_age,path='/')

def _create(base,username,password,language,ip,quick=False):
 if not enabled():raise HTTPException(404,'Not available.')
 now=time.time()
 ensure_registry(base)
 with registry(base) as c:
  c.execute('BEGIN IMMEDIATE')
  c.execute('DELETE FROM challenge_attempts WHERE at<?',(now-3600,))
  key=digest(ip)
  count=c.execute('SELECT count(*) FROM challenge_attempts WHERE ip=?',(key,)).fetchone()[0]
  if count>=6:raise HTTPException(429,'Too many workspaces created. Try again later.')
  if c.execute('SELECT count(*) FROM challenge_workspaces').fetchone()[0]>=MAX_WORKSPACES:
   raise HTTPException(503,'New workspaces are temporarily unavailable.')
  if c.execute('SELECT 1 FROM challenge_users WHERE username=?',(username.lower(),)).fetchone():
   raise HTTPException(409,'That username is already taken.')
  c.execute('INSERT INTO challenge_attempts VALUES (?,?)',(key,now))
 wid=secrets.token_hex(16)
 db=safe_path(base,wid)
 if db is None:raise HTTPException(500,'Workspace setup failed.')
 try:
  initialize(db)
  initialize_accounts(db)
  initialize_warehouse(db,True)
  seed(db)
  uid=add_account(db,username,password,role='owner',language=language)
  with sqlite3.connect(db) as c:c.execute('UPDATE accounts SET is_challenge=1 WHERE id=?',(uid,))
  token=secrets.token_urlsafe(32)
  with sqlite3.connect(db) as c:
   c.execute('INSERT INTO account_sessions VALUES (?,?,?)',(digest(token),uid,now+TTL))
   c.row_factory=sqlite3.Row
   owner=c.execute('SELECT * FROM accounts WHERE id=?',(uid,)).fetchone()
  with registry(base) as c:
   c.execute('BEGIN IMMEDIATE')
   c.execute('INSERT INTO challenge_workspaces VALUES (?,?,?,?)',(wid,username.lower(),now,db.name))
   c.execute('INSERT INTO challenge_users VALUES (?,?)',(username.lower(),wid))
   c.execute('INSERT INTO challenge_sessions VALUES (?,?,?)',(digest(token),wid,now+TTL))
  return public(owner),token,wid
 except sqlite3.IntegrityError as e:
  db.unlink(missing_ok=True)
  raise HTTPException(409,'That username is unavailable.') from e
 except Exception:
  db.unlink(missing_ok=True)
  raise

def install_challenge_routes(app,base):
 ensure_registry(base)

 @app.post('/api/challenge/signup')
 def signup(body:JudgeSignup,request:Request,response:Response):
  ip=request.client.host if request.client else 'unknown'
  user,token,wid=_create(base,body.username,body.password,body.language,ip)
  _cookie(response,COOKIE,token,TTL)
  _cookie(response,WORKSPACE_COOKIE,wid,30*86400)
  return user

 @app.post('/api/challenge/try')
 def try_now(request:Request,response:Response):
  ip=request.client.host if request.client else 'unknown'
  user,token,wid=_create(base,'explore_'+secrets.token_hex(8),secrets.token_urlsafe(24),'en',ip,quick=True)
  _cookie(response,COOKIE,token,TTL)
  _cookie(response,WORKSPACE_COOKIE,wid,30*86400)
  return user

def parse_cookies(scope):
 jar=SimpleCookie()
 try:jar.load(next((v.decode('latin1') for k,v in scope.get('headers',[]) if k.lower()==b'cookie'),''))
 except Exception:return {}
 return {k:m.value for k,m in jar.items()}

def token_from_header(headers):
 jar=SimpleCookie()
 for k,v in headers:
  if k.lower()==b'set-cookie':
   try:jar.load(v.decode('latin1'))
   except Exception:pass
 return jar[COOKIE].value if COOKIE in jar else None

class ChallengeDispatcher:
 def __init__(self,root_app,base):
  self.root_app=root_app
  self.base=Path(base)
  self._apps={}

 def tenant(self,wid):
  if wid not in self._apps:
   from .main import create_app
   db=workspace_for_cookie(self.base,wid)
   if db is None:return None
   if len(self._apps)>=16:self._apps.pop(next(iter(self._apps)))
   self._apps[wid]=create_app(db_path=db,seed_demo=False)
  return self._apps[wid]

 async def __call__(self,scope,receive,send):
  if scope['type']!='http':
   return await self.root_app(scope,receive,send)
  route=scope.get('path','')
  if not route.startswith('/api/') or route.startswith('/api/challenge/'):
   return await self.root_app(scope,receive,send)
  cookies=parse_cookies(scope)
  wid=cookies.get(WORKSPACE_COOKIE)
  if not workspace_for_cookie(self.base,wid or ''):
   wid=None
  if not wid and cookies.get(COOKIE):
   with registry(self.base) as c:
    row=c.execute('SELECT workspace_id FROM challenge_sessions WHERE digest=? AND expires>?',(digest(cookies[COOKIE]),time.time())).fetchone()
   wid=row['workspace_id'] if row else None
  cached_body=None
  # A returning judge can sign in on a new browser without an existing cookie.
  if route in ('/api/auth/login','/api/auth/join','/api/auth/register') and scope.get('method')=='POST' and not wid:
   messages=[]
   while True:
    item=await receive()
    messages.append(item)
    if not item.get('more_body',False):break
   cached_body=b''.join(m.get('body',b'') for m in messages)
   try:
    data=json.loads(cached_body)
    if route=='/api/auth/login':
     username=data.get('username','')
     if isinstance(username,str):wid=username_workspace(self.base,username)
    else:
     code=data.get('code','')
     if isinstance(code,str):
      with registry(self.base) as c:
       found=c.execute('SELECT workspace_id FROM challenge_codes WHERE digest=?',(digest(code),)).fetchone()
      wid=found['workspace_id'] if found else None
   except (ValueError,TypeError,AttributeError):pass
  if not wid or not workspace_for_cookie(self.base,wid):
   if cached_body is not None:
    done=False
    async def replay():
     nonlocal done
     if not done:
      done=True
      return {'type':'http.request','body':cached_body,'more_body':False}
     return {'type':'http.disconnect'}
    receive=replay
   return await self.root_app(scope,receive,send)
  tenant=self.tenant(wid)
  if cached_body is not None:
   done=False
   async def replay():
    nonlocal done
    if not done:
     done=True
     return {'type':'http.request','body':cached_body,'more_body':False}
    return {'type':'http.disconnect'}
   receive=replay
  response_status=0
  response_body=[]
  async def capture(message):
   nonlocal response_status
   if message['type']=='http.response.start':
    response_status=message['status']
    headers=list(message.get('headers',[]))
    if route=='/api/auth/login' and response_status==200:
     token=token_from_header(headers)
     if token:
      register_session(self.base,token,wid)
      extra=SimpleCookie();extra[WORKSPACE_COOKIE]=wid
      extra[WORKSPACE_COOKIE]['path']='/'
      extra[WORKSPACE_COOKIE]['httponly']=True
      extra[WORKSPACE_COOKIE]['samesite']='Strict'
      extra[WORKSPACE_COOKIE]['max-age']=30*86400
      if os.getenv('SHOP_FINDER_SECURE_COOKIE')=='true':extra[WORKSPACE_COOKIE]['secure']=True
      headers.append((b'set-cookie',extra.output(header='').strip().encode('latin1')))
      message={**message,'headers':headers}
   if message['type']=='http.response.body' and scope.get('method')=='POST' and response_status in (200,201):
    if route in ('/api/users','/api/auth/join','/api/auth/register','/api/users/invitations','/api/registrations/workspace-code'):
     response_body.append(message.get('body',b''))
     if not message.get('more_body',False):
      try:
       payload=json.loads(b''.join(response_body))
       if route in ('/api/users','/api/auth/join','/api/auth/register'):
        name=payload.get('username','')
        if isinstance(name,str) and name:
         with registry(self.base) as c:c.execute('INSERT OR IGNORE INTO challenge_users VALUES (?,?)',(name.lower(),wid))
       else:
        code=payload.get('code','')
        if isinstance(code,str) and code:
         with registry(self.base) as c:c.execute('INSERT OR REPLACE INTO challenge_codes VALUES (?,?)',(digest(code),wid))
      except (ValueError,TypeError,AttributeError,sqlite3.Error):pass
   await send(message)
  return await tenant(scope,receive,capture)
