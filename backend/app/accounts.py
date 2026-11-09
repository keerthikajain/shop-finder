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
  c.execute('CREATE INDEX IF NOT EXISTS login_attempt_bucket_time ON login_attempts(bucket,at)')
  # Existing accounts remain approved; public registrations start pending.
  from .registrations import migrate_registrations
  migrate_registrations(c)
  c.execute("""CREATE TABLE IF NOT EXISTS staff_invitations(
     id TEXT PRIMARY KEY,code_digest TEXT UNIQUE NOT NULL,
     created_by TEXT NOT NULL REFERENCES accounts(id),
     created_at REAL NOT NULL,expires_at REAL NOT NULL,
     used_by TEXT REFERENCES accounts(id),used_at REAL,revoked_at REAL
  )""")
  c.execute('CREATE INDEX IF NOT EXISTS staff_invites_expiry ON staff_invitations(expires_at)')
  c.execute("""CREATE TABLE IF NOT EXISTS account_events(
    id INTEGER PRIMARY KEY AUTOINCREMENT,actor_id TEXT,subject_id TEXT,
    action TEXT NOT NULL,at REAL NOT NULL
  )""")

def hash_password(password):
 salt=secrets.token_hex(16)
 return salt+':'+hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),600000).hex()
def check_password(password,stored):
 salt,expected=stored.split(':')
 return hmac.compare_digest(expected,hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),600000).hex())
def digest(value):return hashlib.sha256(value.encode()).hexdigest()

INVITE_TTL=24*60*60

def enforce_join_rate(path,request):
 now=time.time()
 peer=request.client.host if request.client else 'local'
 bucket='staff-join:'+digest(peer)
 with connect(path) as c:
  c.execute('BEGIN IMMEDIATE')
  c.execute('DELETE FROM login_attempts WHERE at<?',(now-900,))
  count=c.execute('SELECT count(*) FROM login_attempts WHERE bucket=?',(bucket,)).fetchone()[0]
  if count>=20:
   raise HTTPException(429,'Too many registration attempts. Try again in 15 minutes.',headers={'Retry-After':'900'})
  c.execute('INSERT INTO login_attempts(bucket,at) VALUES (?,?)',(bucket,now))

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
 ('/api/registrations/',30),
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
def public(row):
 result={k:row[k] for k in ['id','username','role','language','tour_done','active','display_name','phone','staff_code']}
 result['role']='manager' if row['role']=='staff' and row['access_level']=='manager' else row['role']
 result['approval_status']=row['approval_status']
 return result

class Login(BaseModel):
 model_config=ConfigDict(extra='forbid')
 username:str=Field(min_length=1,max_length=80,pattern=r'^[A-Za-z0-9_.-]+$')
 password:str=Field(min_length=1,max_length=128)
class SignIn(Login):
 role:Literal['owner','manager','staff']|None=None

class NewAccount(Login):
 password:str=Field(min_length=12,max_length=128)
 language:Literal['en','hi','bn','mr','gu','pa','kn','te','ta','ml']='en'
class StaffJoin(NewAccount):
 code:str=Field(min_length=24,max_length=100,pattern=r'^[A-Za-z0-9_-]+$')
class Preference(BaseModel):
 model_config=ConfigDict(extra='forbid')
 language:Literal['en','hi','bn','mr','gu','pa','kn','te','ta','ml']
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
   row=c.execute('SELECT a.* FROM accounts a JOIN account_sessions s ON a.id=s.user_id WHERE s.digest=? AND s.expires>? AND a.active=1 AND a.approval_status=?',(digest(token),time.time(),'approved')).fetchone()
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
   if request.url.path not in ('/api/health','/api/auth/login','/api/auth/status','/api/auth/join','/api/auth/register','/api/auth/logout'):
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
 def login(body:SignIn,request:Request,response:Response):
  name=body.username.lower();now=time.time();buckets=['user:'+name,'ip:'+(request.client.host if request.client else 'local')]
  with connect(path) as c:
   c.execute('DELETE FROM login_attempts WHERE at<?',(now-900,))
   for bucket in buckets:
    # A shared reverse-proxy IP can represent multiple real staff users.
    # Keep the per-username limit strict without making ten mistakes
    # against random accounts lock out an entire warehouse.
    limit=10 if bucket.startswith('user:') else 100
    if c.execute('SELECT count(*) FROM login_attempts WHERE bucket=?',(bucket,)).fetchone()[0]>=limit:
     raise HTTPException(429,'Too many attempts. Try again in 15 minutes.')
   row=c.execute('SELECT * FROM accounts WHERE username=?',(name,)).fetchone()
  valid=check_password(body.password,row['password_hash'] if row else dummy)
  if not row or not row['active'] or not valid or (body.role is not None and public(row)['role']!=body.role):
   with connect(path) as c:c.executemany('INSERT INTO login_attempts VALUES (?,?)',[(b,now) for b in buckets])
   raise HTTPException(401,'Incorrect username or password.')
  if row['approval_status']!='approved':
   raise HTTPException(403,'Account awaiting approval or unavailable. Contact your workspace administrator.')
  token=secrets.token_urlsafe(32)
  with connect(path) as c:
   c.execute('DELETE FROM account_sessions WHERE expires<? OR digest=?',(now,digest(request.cookies.get(COOKIE,''))))
   c.execute('INSERT INTO account_sessions VALUES (?,?,?)',(digest(token),row['id'],now+TTL))
   c.execute('DELETE FROM login_attempts WHERE bucket=?',('user:'+name,))
  response.set_cookie(COOKIE,token,httponly=True,samesite='strict',secure=os.getenv('SHOP_FINDER_SECURE_COOKIE')=='true' or request.url.scheme=='https',max_age=TTL,path='/')
  return public(row)
 @app.post('/api/auth/join',status_code=201)
 def join(body:StaffJoin,request:Request):
  enforce_join_rate(path,request)
  now=time.time()
  uid=secrets.token_hex(16)
  name=body.username.lower()
  password_hash=hash_password(body.password)
  with connect(path) as c:
   c.execute('BEGIN IMMEDIATE')
   invite=c.execute('SELECT * FROM staff_invitations WHERE code_digest=?',(digest(body.code),)).fetchone()
   if not invite or invite['expires_at']<=now or invite['used_at'] is not None or invite['revoked_at'] is not None:
    raise HTTPException(400,'Invalid or expired invitation code.')
   owner=c.execute("SELECT 1 FROM accounts WHERE id=? AND role='owner' AND active=1",(invite['created_by'],)).fetchone()
   if not owner:raise HTTPException(400,'Invalid or expired invitation code.')
   try:
    c.execute('INSERT INTO accounts(id,username,password_hash,role,language) VALUES (?,?,?,?,?)',
              (uid,name,password_hash,'staff',body.language))
   except sqlite3.IntegrityError:
    raise HTTPException(409,'This username is unavailable.')
   c.execute('UPDATE staff_invitations SET used_by=?,used_at=? WHERE id=?',(uid,now,invite['id']))
   c.execute('INSERT INTO account_events(actor_id,subject_id,action,at) VALUES (?,?,?,?)',(uid,uid,'staff_joined',now))
  return {'ok':True,'username':name,'role':'staff'}

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
  response.delete_cookie(COOKIE,path='/')
  with connect(path) as c:
   c.execute('INSERT INTO account_events(actor_id,subject_id,action,at) VALUES (?,?,?,?)',
             (uid,uid,'password_changed',time.time()))
  return {'ok':True}
 @app.get('/api/users')
 def users():
  with connect(path) as c:return [public(r) for r in c.execute('SELECT * FROM accounts ORDER BY username')]
 @app.post('/api/users')
 def create_user(body:NewAccount,request:Request):
  try:uid=add_account(path,body.username,body.password,language=body.language)
  except sqlite3.IntegrityError:raise HTTPException(409,'Username already exists.')
  with connect(path) as c:
   c.execute('INSERT INTO account_events(actor_id,subject_id,action,at) VALUES (?,?,?,?)',
             (request.state.user['id'],uid,'staff_created',time.time()))
   return public(c.execute('SELECT * FROM accounts WHERE id=?',(uid,)).fetchone())
 @app.patch('/api/users/{uid}')
 def update_user(uid:str,body:StaffUpdate,request:Request):
  with connect(path) as c:
   row=c.execute('SELECT * FROM accounts WHERE id=?',(uid,)).fetchone()
   if not row:raise HTTPException(404,'Unknown account.')
   if row['role']!='staff':raise HTTPException(403,'Only staff accounts can be managed here.')
   if body.active and row['approval_status']!='approved':raise HTTPException(409,'Review the pending registration before enabling access.')
   if body.active is not None:c.execute('UPDATE accounts SET active=? WHERE id=?',(int(body.active),uid))
   if body.password:c.execute('UPDATE accounts SET password_hash=? WHERE id=?',(hash_password(body.password),uid))
   c.execute('DELETE FROM account_sessions WHERE user_id=?',(uid,))
   c.execute('INSERT INTO account_events(actor_id,subject_id,action,at) VALUES (?,?,?,?)',
             (request.state.user['id'],uid,'staff_access_changed' if body.active is not None else 'staff_password_reset',time.time()))
  return {'ok':True}
 @app.post('/api/users/invitations',status_code=201)
 def create_invitation(request:Request):
  code=secrets.token_urlsafe(32)
  invitation_id=secrets.token_hex(12)
  now=time.time()
  with connect(path) as c:
   c.execute('INSERT INTO staff_invitations(id,code_digest,created_by,created_at,expires_at) VALUES (?,?,?,?,?)',
             (invitation_id,digest(code),request.state.user['id'],now,now+INVITE_TTL))
   c.execute('INSERT INTO account_events(actor_id,subject_id,action,at) VALUES (?,?,?,?)',
             (request.state.user['id'],None,'staff_invitation_created',now))
  return {'id':invitation_id,'code':code,'expires_at':now+INVITE_TTL}

 @app.get('/api/users/invitations')
 def list_invitations():
  with connect(path) as c:
   rows=c.execute('SELECT id,created_at,expires_at,used_at,revoked_at FROM staff_invitations ORDER BY created_at DESC LIMIT 50').fetchall()
  return [dict(x) for x in rows]

 @app.delete('/api/users/invitations/{invite_id}')
 def revoke_invitation(invite_id:str,request:Request):
  with connect(path) as c:
   c.execute('BEGIN IMMEDIATE')
   row=c.execute('SELECT used_at,revoked_at FROM staff_invitations WHERE id=?',(invite_id,)).fetchone()
   if not row:raise HTTPException(404,'Invitation not found.')
   if row['used_at'] is not None:raise HTTPException(409,'Invitation already used.')
   if row['revoked_at'] is None:
    now=time.time()
    c.execute('UPDATE staff_invitations SET revoked_at=? WHERE id=?',(now,invite_id))
    c.execute('INSERT INTO account_events(actor_id,subject_id,action,at) VALUES (?,?,?,?)',
              (request.state.user['id'],None,'staff_invitation_revoked',now))
  return {'ok':True}

 @app.get('/api/users/audit')
 def account_audit():
  with connect(path) as c:
   records=c.execute('SELECT action,at,actor_id,subject_id FROM account_events ORDER BY id DESC LIMIT 100').fetchall()
  return [dict(x) for x in records]

 # Registration review routes enforce owner/manager access individually.
 from .registrations import install_registration_routes
 install_registration_routes(app,path)
