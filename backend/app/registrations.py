"""Workspace self-registration with explicit approval, single-organisation deployment."""
import secrets,sqlite3,time
from typing import Literal
from fastapi import HTTPException,Request
from pydantic import BaseModel,Field,ConfigDict
from .database import connect

def migrate_registrations(c):
    # Additive schema migration retains all existing users, sessions, and permissions.
    columns={r['name'] for r in c.execute('PRAGMA table_info(accounts)')}
    if 'approval_status' not in columns:
        c.execute("ALTER TABLE accounts ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved' CHECK(approval_status IN ('pending','approved','rejected'))")
    if 'access_level' not in columns:
        c.execute("ALTER TABLE accounts ADD COLUMN access_level TEXT NOT NULL DEFAULT 'staff' CHECK(access_level IN ('staff','manager'))")
    c.execute("""CREATE TABLE IF NOT EXISTS registration_workspace(
        id INTEGER PRIMARY KEY CHECK(id=1),
        code_digest TEXT,
        enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
        updated_by TEXT,
        updated_at REAL
    )""")
    c.execute("INSERT OR IGNORE INTO registration_workspace(id,enabled) VALUES (1,0)")
    c.execute("CREATE INDEX IF NOT EXISTS account_approval_lookup ON accounts(approval_status,active,username)")

class RegisterRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    code:str=Field(min_length=27,max_length=100,pattern=r'^SF-[A-Za-z0-9_-]{24,80}$')
    username:str=Field(min_length=1,max_length=80,pattern=r'^[A-Za-z0-9_.-]+$')
    password:str=Field(min_length=12,max_length=128)
    display_name:str=Field(min_length=1,max_length=80)
    language:Literal['en','hi','bn','mr','gu','pa','kn','te','ta','ml']='en'

class WorkspaceSetting(BaseModel):
    model_config=ConfigDict(extra='forbid')
    enabled:bool

class ManagerGrant(BaseModel):
    model_config=ConfigDict(extra='forbid')
    grant_manager:bool
    owner_password:str=Field(min_length=1,max_length=128)

def install_registration_routes(app,path):
    # Delayed import avoids import cycle with app.accounts.
    from .accounts import digest,hash_password,check_password,enforce_join_rate,public
    def reviewer(request):
        user=getattr(request.state,'user',None)
        if not user:raise HTTPException(401,'Sign in to continue.')
        if user['role'] not in ('owner','manager'):raise HTTPException(403,'Owner or manager approval required.')
        return user
    def owner_only(request):
        user=reviewer(request)
        if user['role']!='owner':raise HTTPException(403,'Owner access required.')
        return user
    def audit(c,actor,subject,action):
        c.execute('INSERT INTO account_events(actor_id,subject_id,action,at) VALUES (?,?,?,?)',
                  (actor,subject,action,time.time()))

    @app.post('/api/auth/register',status_code=201)
    def staff_register(body:RegisterRequest,request:Request):
        # Rate limiting is applied before comparing codes or hashing passwords.
        enforce_join_rate(path,request)
        from .accounts import digest as code_digest
        now=time.time()
        with connect(path) as c:
            c.execute('BEGIN IMMEDIATE')
            setting=c.execute('SELECT code_digest,enabled FROM registration_workspace WHERE id=1').fetchone()
            if not setting or not setting['enabled'] or not setting['code_digest'] or not secrets.compare_digest(setting['code_digest'],code_digest(body.code)):
                raise HTTPException(400,'Invalid workspace code or registration disabled.')
            approved_owner=c.execute("SELECT 1 FROM accounts WHERE role='owner' AND active=1 AND approval_status='approved' LIMIT 1").fetchone()
            if not approved_owner:raise HTTPException(403,'Workspace registration is unavailable.')
            uid=secrets.token_hex(16)
            try:
                c.execute('INSERT INTO accounts(id,username,password_hash,role,language,display_name,active,approval_status,access_level) VALUES (?,?,?,?,?,?,?,?,?)',
                          (uid,body.username.lower(),hash_password(body.password),'staff',body.language,body.display_name,0,'pending','staff'))
            except sqlite3.IntegrityError:
                raise HTTPException(409,'This username is unavailable.')
            audit(c,uid,uid,'staff_registration_requested')
        return {'status':'pending','message':'Your request was submitted. An owner or manager must approve it before you can sign in.'}

    @app.get('/api/registrations/workspace-code')
    def get_workspace_code(request:Request):
        owner_only(request)
        with connect(path) as c:
            row=c.execute('SELECT code_digest,enabled,updated_at FROM registration_workspace WHERE id=1').fetchone()
        return {'configured':bool(row['code_digest']),'enabled':bool(row['enabled']),'updated_at':row['updated_at']}

    @app.post('/api/registrations/workspace-code',status_code=201)
    def rotate_workspace_code(request:Request):
        owner=owner_only(request)
        # Display the code once. Rotating immediately invalidates the previous code.
        code='SF-'+secrets.token_urlsafe(24)
        now=time.time()
        with connect(path) as c:
            c.execute('BEGIN IMMEDIATE')
            c.execute('UPDATE registration_workspace SET code_digest=?,enabled=1,updated_by=?,updated_at=? WHERE id=1',
                      (digest(code),owner['id'],now))
            audit(c,owner['id'],None,'workspace_code_rotated')
        return {'code':code,'enabled':True,'message':'Share this code privately with employees. It will not be displayed again.'}

    @app.patch('/api/registrations/workspace-code')
    def change_workspace_code(body:WorkspaceSetting,request:Request):
        owner=owner_only(request)
        with connect(path) as c:
            c.execute('BEGIN IMMEDIATE')
            row=c.execute('SELECT code_digest FROM registration_workspace WHERE id=1').fetchone()
            if body.enabled and not row['code_digest']:
                raise HTTPException(409,'Generate the workspace code before enabling registration.')
            c.execute('UPDATE registration_workspace SET enabled=?,updated_by=?,updated_at=? WHERE id=1',
                      (int(body.enabled),owner['id'],time.time()))
            audit(c,owner['id'],None,'workspace_registration_enabled' if body.enabled else 'workspace_registration_disabled')
        return {'enabled':body.enabled}

    @app.get('/api/registrations/pending')
    def pending_registrations(request:Request):
        reviewer(request)
        with connect(path) as c:
            rows=c.execute("SELECT id,username,display_name,language,role,approval_status,active FROM accounts WHERE approval_status='pending' ORDER BY username LIMIT 200").fetchall()
        return [dict(row) for row in rows]

    def decide(uid,request,approved):
        actor=reviewer(request)
        with connect(path) as c:
            c.execute('BEGIN IMMEDIATE')
            target=c.execute('SELECT role,approval_status FROM accounts WHERE id=?',(uid,)).fetchone()
            if not target:raise HTTPException(404,'Registration not found.')
            if target['role']!='staff' or target['approval_status']!='pending':
                raise HTTPException(409,'Registration has already been reviewed or cannot be changed.')
            next_status='approved' if approved else 'rejected'
            c.execute("UPDATE accounts SET approval_status=?,active=?,access_level='staff' WHERE id=?",(next_status,int(approved),uid))
            c.execute('DELETE FROM account_sessions WHERE user_id=?',(uid,))
            audit(c,actor['id'],uid,'staff_registration_approved' if approved else 'staff_registration_rejected')
        return {'ok':True,'status':next_status}

    @app.post('/api/registrations/pending/{uid}/approve')
    def approve(uid:str,request:Request):
        return decide(uid,request,True)

    @app.post('/api/registrations/pending/{uid}/reject')
    def reject(uid:str,request:Request):
        return decide(uid,request,False)

    @app.patch('/api/registrations/managers/{uid}')
    def grant_manager(uid:str,body:ManagerGrant,request:Request):
        owner=owner_only(request)
        with connect(path) as c:
            c.execute('BEGIN IMMEDIATE')
            owner_record=c.execute('SELECT password_hash FROM accounts WHERE id=?',(owner['id'],)).fetchone()
            if not owner_record or not check_password(body.owner_password,owner_record['password_hash']):
                raise HTTPException(403,'Owner password confirmation failed.')
            target=c.execute('SELECT id,role,access_level,approval_status,active FROM accounts WHERE id=?',(uid,)).fetchone()
            if not target:raise HTTPException(404,'Staff account not found.')
            if target['role']!='staff' or target['approval_status']!='approved' or not target['active']:
                raise HTTPException(409,'Only active, approved staff can become managers.')
            desired='manager' if body.grant_manager else 'staff'
            if target['access_level']==desired:
                raise HTTPException(409,'Account already has this access level.')
            c.execute('UPDATE accounts SET access_level=? WHERE id=?',(desired,uid))
            c.execute('DELETE FROM account_sessions WHERE user_id=?',(uid,))
            audit(c,owner['id'],uid,'manager_access_granted' if body.grant_manager else 'manager_access_revoked')
            current=c.execute('SELECT * FROM accounts WHERE id=?',(uid,)).fetchone()
        return public(current)
