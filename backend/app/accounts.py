"""Local accounts, revocable sessions and owner-managed staff access."""
import hashlib,hmac,secrets,time,sqlite3,os
from urllib.parse import urlsplit
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
  c.execute('CREATE TABLE IF NOT EXISTS api_rate_limits(bucket TEXT NOT NULL,at REAL NOT NULL)')
  c.execute('CREATE INDEX IF NOT EXISTS api_rate_bucket_time ON api_rate_limits(bucket,at)')

def hash_password(password):
 salt=secrets.token_hex(16)
 return salt+':'+hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),600000).hex()
def check_password(password,stored):
 salt,expected=stored.split(':')
 return hmac.compare_digest(expected,hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),600000).hex())
def digest(value):return hashlib.sha256(value.encode()).hexdigest()

# Throttle expensive provider and mutating endpoints per authenticated account.
# A persistent SQLite bucket works across the single-worker deployments this
# application supports. Login failure throttling remains separate below.
RATE_RULES=(
 ('/api/voice/',20),
 ('/api/warehouse/tasks/',120),
 ('/api/warehouse/search',120),
 ('/api/search',120),
 ('/api/warehouse/imports',12),
 ('/api/warehouse/stock/',120),
 ('/api/warehouse/moves/',60),
 ('/api/warehouse/items',60),
 ('/api/warehouse/settings',30),
 ('/api/auth/profile',30),
 ('/api/users',30),
 ('/api/auth/password',20),
 ('/api/media',20),
 ('/api/warehouse/issues',60),
 ('/api/reports',60),
)
def rate_bucket(route):
 if route.endswith('/speak'):
  return '/api/voice/speak',20
 for prefix,limit in RATE_RULES:
  if route.startswith(prefix):
   return prefix,limit
 return None

def enforce_rate(path,uid,route):
 rule=rate_bucket(route)
 if not rule:return
 prefix,limit=rule
 now=time.time()
 bucket=digest(uid+':'+prefix)
 # BEGIN IMMEDIATE serializes limit checks and inserts between app workers.
 with connect(path) as c:
  c.execute('BEGIN IMMEDIATE')
  c.execute('DELETE FROM api_rate_limits WHERE at<?',(now-60,))
  count=c.execute('SELECT count(*) FROM api_rate_limits WHERE bucket=?',(bucket,)).fetchone()[0]
  if count>=limit:raise HTTPException(429,'Too many requests. Try again in one minute.')
  c.execute('INSERT INTO api_rate_limits(bucket,at) VALUES (?,?)',(bucket,now))

SECURITY_HEADERS={
 'X-Content-Type-Options':'nosniff',
 'X-Frame-Options':'DENY',
 'Referrer-Policy':'same-origin',
 'Cross-Origin-Resource-Policy':'same-origin',
 'X-Permitted-Cross-Domain-Policies':'none',
 'Permissions-Policy':'camera=(self), microphone=(self), geolocation=()',
 'Content-Security-Policy':("default-src 'self'; base-uri 'none'; object-src 'none'; "
  "frame-ancestors 'none'; form-action 'self'; script-src 'self'; "
  "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
  "font-src 'self' data:; connect-src 'self' ws: wss:; media-src 'self' blob:"),
}

def apply_security_headers(response,request):
 for key,value in SECURITY_HEADERS.items():response.headers[key]=value
 if request.url.path.startswith('/api/'):response.headers['Cache-Control']='no-store'
 if request.url.scheme=='https' or os.getenv('SHOP_FINDER_SECURE_COOKIE')=='true':
  response.headers['Strict-Transport-Security']='max-age=31536000'
 return response

def body_within_limit(request):
 value=request.headers.get('content-length')
 if value is None:return True
 try:
  size=int(value)
 except ValueError:return False
 route=request.url.path
 limit=(6_000_000 if route=='/api/voice/transcribe' else
        4_000_000 if route=='/api/warehouse/imports' else
        3_000_000 if route=='/api/media' else 1_000_000)
 return 0<=size<=limit

def origin_valid(request):
 origin=request.headers.get('origin')
 if origin:
  try:
   parsed=urlsplit(origin)
   if parsed.scheme not in ('http','https') or parsed.netloc.lower()!=request.headers.get('host','').lower() or parsed.path not in ('','/') or parsed.query or parsed.fragment:return False
  except ValueError:return False
 if request.headers.get('sec-fetch-site','').lower()=='cross-site':return False
 return True
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
   if request.method not in ('GET','HEAD','OPTIONS') and not body_within_limit(request):
    return apply_security_headers(JSONResponse({'detail':'Request body exceeds its limit or has an invalid size.'},413),request)
   if request.method not in ('GET','HEAD','OPTIONS'):
    if request.headers.get('X-Shop-Request')!='1' or not origin_valid(request):
     return apply_security_headers(JSONResponse({'detail':'Request origin or header not allowed.'},403),request)
   user=current(request);request.state.user=user
   if request.url.path not in ('/api/health','/api/auth/login','/api/auth/status'):
    if not user:
     return apply_security_headers(JSONResponse({'detail':'Please log in.'},401),request)
    route=request.url.path
    warehouse_owner=(
     (route in ('/api/warehouse/settings','/api/warehouse/items') and request.method in ('PUT','PATCH','DELETE'))
     or route.startswith('/api/warehouse/imports')
     or route.startswith('/api/warehouse/moves/')
     or route=='/api/warehouse/history'
     or (route.startswith('/api/warehouse/issues/') and route.endswith('/resolve'))
    )
    owner_action=(route.startswith('/api/users') or (route=='/api/media' and request.method=='POST') or route.startswith('/api/unresolved') or (route.startswith('/api/products') and request.method!='GET') or warehouse_owner)
    if owner_action and user['role']!='owner':
     return apply_security_headers(JSONResponse({'detail':'Owner access required.'},403),request)
    if request.method not in ('GET','HEAD','OPTIONS'):
     try:enforce_rate(path,user['id'],route)
     except HTTPException as error:
      return apply_security_headers(JSONResponse({'detail':error.detail},error.status_code,headers={'Retry-After':'60'}),request)
  response=await call_next(request)
  return apply_security_headers(response,request)
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
