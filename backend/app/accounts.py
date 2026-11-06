"""Local accounts, revocable sessions and owner-managed staff access."""
import hashlib,hmac,secrets,time,sqlite3,os
from typing import Literal
from fastapi import HTTPException,Request,Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel,Field,ConfigDict
from .database import connect

COOKIE='shop_session'
TTL=12*60*60

def initialize_accounts(path):
 with connect(path) as c:
  c.execute("CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('owner','staff')),language TEXT NOT NULL DEFAULT 'en',tour_done INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1)")
  columns={row['name'] for row in c.execute('PRAGMA table_info(accounts)')}
  for name in ('display_name','phone','staff_code'):
   if name not in columns:c.execute(f"ALTER TABLE accounts ADD COLUMN {name} TEXT NOT NULL DEFAULT ''")
  c.execute('CREATE TABLE IF NOT EXISTS account_sessions(digest TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES accounts(id),expires REAL NOT NULL)')
  c.execute('CREATE TABLE IF NOT EXISTS login_attempts(bucket TEXT NOT NULL,at REAL NOT NULL)')

def hash_password(password):
 salt=secrets.token_hex(16)
 return salt+':'+hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),600000).hex()
def check_password(password,stored):
 salt,expected=stored.split(':')
 return hmac.compare_digest(expected,hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),600000).hex())
def digest(value):return hashlib.sha256(value.encode()).hexdigest()
def public(row):return {k:row[k] for k in ['id','username','role','language','tour_done','active','display_name','phone','staff_code']}

class Login(BaseModel):
 model_config=ConfigDict(extra='forbid')
 username:str=Field(min_length=1,max_length=80,pattern=r'^[A-Za-z0-9_.-]+$')
 password:str=Field(min_length=1,max_length=128)
class NewAccount(Login):
 password:str=Field(min_length=12,max_length=128)
 language:Literal['en','hi']='en'
class Preference(BaseModel):
 model_config=ConfigDict(extra='forbid')
 language:Literal['en','hi']
 tour_done:bool
class Profile(BaseModel):
 model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
 display_name:str=Field(min_length=1,max_length=80)
 phone:str=Field(default='',max_length=24,pattern=r'^[0-9+() .-]*$')
 staff_code:str=Field(default='',max_length=40,pattern=r'^[A-Za-z0-9_. -]*$')
class Password(BaseModel):
 old_password:str=Field(max_length=128)
 new_password:str=Field(min_length=12,max_length=128)
class StaffUpdate(BaseModel):
 model_config=ConfigDict(extra='forbid')
 active:bool|None=None
 password:str|None=Field(default=None,min_length=12,max_length=128)

def add_account(path,username,password,role='staff',language='en'):
 account=NewAccount(username=username,password=password,language=language)
 uid=secrets.token_hex(16)
 with connect(path) as c:c.execute('INSERT INTO accounts(id,username,password_hash,role,language) VALUES (?,?,?,?,?)',(uid,account.username.lower(),hash_password(password),role,language))
 return uid

def install_accounts(app,path,required=True):
 app.state.accounts_required=required
 dummy=hash_password(secrets.token_urlsafe(24))
 def current(request):
  token=request.cookies.get(COOKIE,'')
  with connect(path) as c:
   row=c.execute('SELECT a.* FROM accounts a JOIN account_sessions s ON a.id=s.user_id WHERE s.digest=? AND s.expires>? AND a.active=1',(digest(token),time.time())).fetchone()
  return public(row) if row else None
 @app.middleware('http')
 async def protect(request,call_next):
  if required and request.url.path.startswith('/api/'):
   if request.method not in ('GET','HEAD','OPTIONS') and request.headers.get('X-Shop-Request')!='1':return JSONResponse({'detail':'Request header required.'},403)
   user=current(request);request.state.user=user
   if request.url.path not in ('/api/health','/api/auth/login','/api/auth/status'):
    if not user:return JSONResponse({'detail':'Please log in.'},401)
    route=request.url.path
    owner_action=(route.startswith('/api/users') or (route=='/api/media' and request.method=='POST') or route.startswith('/api/unresolved') or (route.startswith('/api/products') and request.method!='GET'))
    if owner_action and user['role']!='owner':return JSONResponse({'detail':'Owner access required.'},403)
  response=await call_next(request)
  response.headers['X-Content-Type-Options']='nosniff'
  response.headers['X-Frame-Options']='DENY'
  response.headers['Referrer-Policy']='same-origin'
  response.headers['Permissions-Policy']='camera=(self), microphone=(self), geolocation=()'
  if request.url.path.startswith('/api/'):response.headers['Cache-Control']='no-store'
  return response
 @app.get('/api/auth/status')
 def status(request:Request):
  with connect(path) as c:configured=bool(c.execute('SELECT 1 FROM accounts WHERE role=\'owner\'').fetchone())
  return {'configured':configured,'user':current(request)}
 @app.post('/api/auth/login')
 def login(body:Login,request:Request,response:Response):
  name=body.username.lower();now=time.time();buckets=['user:'+name,'ip:'+(request.client.host if request.client else 'local')]
  with connect(path) as c:
   c.execute('DELETE FROM login_attempts WHERE at<?',(now-900,))
   for bucket in buckets:
    if c.execute('SELECT count(*) FROM login_attempts WHERE bucket=?',(bucket,)).fetchone()[0]>=10:raise HTTPException(429,'Too many attempts. Try again in 15 minutes.')
   row=c.execute('SELECT * FROM accounts WHERE username=?',(name,)).fetchone()
  valid=check_password(body.password,row['password_hash'] if row else dummy)
  if not row or not row['active'] or not valid:
   with connect(path) as c:c.executemany('INSERT INTO login_attempts VALUES (?,?)',[(b,now) for b in buckets])
   raise HTTPException(401,'Incorrect username or password.')
  token=secrets.token_urlsafe(32)
  with connect(path) as c:
   c.execute('DELETE FROM account_sessions WHERE expires<? OR digest=?',(now,digest(request.cookies.get(COOKIE,''))))
   c.execute('INSERT INTO account_sessions VALUES (?,?,?)',(digest(token),row['id'],now+TTL))
   c.execute('DELETE FROM login_attempts WHERE bucket=?',('user:'+name,))
  response.set_cookie(COOKIE,token,httponly=True,samesite='strict',secure=os.getenv('SHOP_FINDER_SECURE_COOKIE')=='true',max_age=TTL,path='/')
  return public(row)
 @app.post('/api/auth/logout')
 def logout(request:Request,response:Response):
  with connect(path) as c:c.execute('DELETE FROM account_sessions WHERE digest=?',(digest(request.cookies.get(COOKIE,'')),))
  response.delete_cookie(COOKIE,path='/');return {'ok':True}
 @app.put('/api/auth/preferences')
 def preferences(body:Preference,request:Request):
  with connect(path) as c:c.execute('UPDATE accounts SET language=?,tour_done=? WHERE id=?',(body.language,int(body.tour_done),request.state.user['id']))
  return current(request)
 @app.put('/api/auth/profile')
 def profile(body:Profile,request:Request):
  with connect(path) as c:
   c.execute('UPDATE accounts SET display_name=?,phone=?,staff_code=? WHERE id=?',(body.display_name,body.phone,body.staff_code,request.state.user['id']))
  return current(request)
 @app.post('/api/auth/password')
 def password(body:Password,request:Request,response:Response):
  uid=request.state.user['id']
  with connect(path) as c:row=c.execute('SELECT password_hash FROM accounts WHERE id=?',(uid,)).fetchone()
  if not check_password(body.old_password,row[0]):raise HTTPException(400,'Current password is incorrect.')
  with connect(path) as c:
   c.execute('UPDATE accounts SET password_hash=? WHERE id=?',(hash_password(body.new_password),uid));c.execute('DELETE FROM account_sessions WHERE user_id=?',(uid,))
  response.delete_cookie(COOKIE,path='/');return {'ok':True}
 @app.get('/api/users')
 def users():
  with connect(path) as c:return [public(r) for r in c.execute('SELECT * FROM accounts ORDER BY username')]
 @app.post('/api/users')
 def create_user(body:NewAccount):
  try:uid=add_account(path,body.username,body.password,language=body.language)
  except sqlite3.IntegrityError:raise HTTPException(409,'Username already exists.')
  with connect(path) as c:return public(c.execute('SELECT * FROM accounts WHERE id=?',(uid,)).fetchone())
 @app.patch('/api/users/{uid}')
 def update_user(uid:str,body:StaffUpdate):
  with connect(path) as c:
   row=c.execute('SELECT * FROM accounts WHERE id=?',(uid,)).fetchone()
   if not row:raise HTTPException(404,'Unknown account.')
   if row['role']!='staff':raise HTTPException(403,'Only staff accounts can be managed here.')
   if body.active is not None:c.execute('UPDATE accounts SET active=? WHERE id=?',(int(body.active),uid))
   if body.password:c.execute('UPDATE accounts SET password_hash=? WHERE id=?',(hash_password(body.password),uid))
   c.execute('DELETE FROM account_sessions WHERE user_id=?',(uid,))
  return {'ok':True}
