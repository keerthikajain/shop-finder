import React,{useState,useEffect} from 'react';
import {Mark,Glyph} from './warehouse-ui.jsx';
import {Locale,useT} from './locale.js';
export async function request(path,options={}){
 const r=await fetch('/api'+path,{signal:AbortSignal.timeout(45000),...options,headers:{'Content-Type':'application/json','X-Shop-Request':'1',...options.headers}});
 if(r.status===401&&path!='/auth/login')window.dispatchEvent(new Event('session-expired'));
 const data=await r.json();if(!r.ok)throw Error(typeof data.detail==='string'?data.detail:'Check the fields and try again.');return data;
}
export function AccountGate({children}){
 const [user,setUser]=useState(null),[ready,setReady]=useState(false),[configured,C]=useState(true),[language,L]=useState('en'),[error,E]=useState(''),[busy,B]=useState(false),[notice,N]=useState('');
 useEffect(()=>{const clear=()=>setUser(null);window.addEventListener('session-expired',clear);request('/auth/status').then(r=>{setUser(r.user);C(r.configured);if(r.user)L(r.user.language)}).catch(e=>E(e.message)).finally(()=>setReady(true));return()=>window.removeEventListener('session-expired',clear)},[]);
 async function preferences(patch){const next=await request('/auth/preferences',{method:'PUT',body:JSON.stringify({language:user.language,tour_done:!!user.tour_done,...patch})});setUser(next);L(next.language)}
 async function logout(){await request('/auth/logout',{method:'POST'});setUser(null)}
 return <Locale.Provider value={user?.language||language}>{user?children({user,preferences,logout}):<Login {...{ready,configured,language,L,error,busy,notice}} onJoin={async ({code,username,password})=>{B(true);E('');N('');try{await request('/auth/join',{method:'POST',body:JSON.stringify({code,username,password,language})});N('Staff account created. Sign in with your new credentials.')}catch(err){E(err.message);throw err}finally{B(false)}}} onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget);B(true);E('');N('');try{const next=await request('/auth/login',{method:'POST',body:JSON.stringify({username:data.get('username'),password:data.get('password'),role:data.get('role')||undefined})});setUser(next);L(next.language)}catch(err){E(err.message)}finally{B(false)}}}/>}</Locale.Provider>;
}
export function Login({ready,configured,language,L,error,busy,notice='',onSubmit,onJoin}){
 const t=useT();
 const [showPassword,setShowPassword]=useState(false),[mode,M]=useState('login'),[role,R]=useState('staff');
 const [joinError,JE]=useState('');
 // Keep sign-in neutral and consistent; theme preference applies inside the signed-in workspace.
 useEffect(()=>{document.documentElement.dataset.theme='light'},[]);
 return <main className="login-shell">
  <header className="sf-login-header">
   <div className="wh-brand"><Mark/><span>shopfinder</span></div>
  </header>
  <div className="sf-login-layout">
   <section className="sf-login-art" aria-label={t('Your workspace, within reach.')}>
    <img src="/art/workspace-login.webp" width="1254" height="1254" alt=""/>
    <div><h2>{t('Your workspace, within reach.')}</h2><p>{t('Find items. Know their place.')}</p></div>
   </section>
   <section className="glass login-card">
    <span className="sf-login-kicker">{t('Welcome back')}</span>
    <h1>{t('Sign in to Shop Finder')}</h1>
    <p>{t('Use your team account to continue.')}</p>
    <label className="sf-login-language">{t('App language')}<select value={language} onChange={e=>L(e.target.value)}><option value="en">English</option><option value="hi">हिन्दी</option></select></label>
    {ready&&configured&&<div className="sf-auth-modes" role="group" aria-label="Account access"><button type="button" aria-pressed={mode==='login'} onClick={()=>{M('login');JE('')}}>Sign in</button><button type="button" aria-pressed={mode==='join'} onClick={()=>{M('join');JE('')}}>Join as staff</button></div>}
    {!ready?<p role="status">{t('Loading…')}</p>:!configured?<p role="status">{t('This workspace is not set up yet. Ask the installer to create the first owner account.')}</p>:mode==='join'?
    <form className="sf-staff-join-form" onSubmit={e=>{e.preventDefault();if(!onJoin)return;const form=e.currentTarget,data=new FormData(form);Promise.resolve(onJoin({code:data.get('code'),username:data.get('username'),password:data.get('password')})).then(()=>{form.reset();M('login')}).catch(()=>{})}} aria-busy={busy}>
     <p className="sf-auth-helper">Enter your one-time invitation from the owner. Your account will have Staff permissions only.</p>
     <label>Staff invitation code<input name="code" autoComplete="off" required minLength={24} maxLength={100} pattern="[A-Za-z0-9_-]+" /></label>
     <label>{t('Username')}<input name="username" autoComplete="username" required maxLength={80} pattern="[A-Za-z0-9_.-]+" /></label>
     <label>Choose a password (12+ characters)<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/></label>
     <button className="primary full-width sf-signin" disabled={busy||!onJoin}>Create staff account<Glyph name="arrow"/></button>
     {joinError&&<p role="alert">{joinError}</p>}
    </form>:
    <form onSubmit={onSubmit} aria-busy={busy}>
     <fieldset className="sf-auth-role"><legend>Sign in as</legend><label><input type="radio" name="role" value="owner" checked={role==='owner'} onChange={()=>R('owner')}/> Owner</label><label><input type="radio" name="role" value="staff" checked={role==='staff'} onChange={()=>R('staff')}/> Staff</label></fieldset>
     <label>{t('Username')}<input name="username" autoComplete="username" placeholder={t('Enter username')} required maxLength={80}/></label>
     <label htmlFor="login-password">{t('Password')}</label>
     <div className="sf-password-field"><input id="login-password" name="password" type={showPassword?'text':'password'} autoComplete="current-password" placeholder={t('Enter password')} required maxLength={128}/><button type="button" aria-controls="login-password" aria-label={t(showPassword?'Hide password':'Show password')} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)}>{t(showPassword?'Hide':'Show')}</button></div>
     <button className="primary full-width sf-signin" disabled={busy}>{t(busy?'Working…':'Sign in')}<Glyph name="arrow"/></button>
    </form>}
    {error&&<p className="error" role="alert">{t(error)}</p>}
    {notice&&<p className="sf-auth-success" role="status">{t(notice)}</p>}
    <p className="quiet">{t('Need access? Ask your workspace owner.')}</p>
   </section>
  </div>
 </main>;
}

export function AccountSettings({user,preferences,logout,showLanguage=true}){
 const t=useT(),[users,U]=useState([]),[message,M]=useState(''),[busy,B]=useState(false),[invitations,IV]=useState([]),[newCode,NC]=useState('');
 const load=async()=>U(await request('/users'));
 const loadInvitations=async()=>IV(await request('/users/invitations'));
 useEffect(()=>{if(user.role==='owner'){load().catch(e=>M(e.message));loadInvitations().catch(e=>M(e.message))}},[user.role]);
 async function task(fn){B(true);M('');try{await fn()}catch(e){M(e.message)}finally{B(false)}}
 return <section className="glass editor-panel sf-account-panel"><h2>{t('My account')}</h2><p>{user.username} · {t(user.role)}</p><form className="sf-account-form sf-profile-form" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);task(async()=>{await request('/auth/profile',{method:'PUT',body:JSON.stringify(Object.fromEntries(data))});await preferences({});M('Profile saved.')})}}><h3>My profile</h3><p>Your phone number is optional and visible only to you and the workspace owner.</p><div className="formgrid"><label>Full name<input name="display_name" defaultValue={user.display_name||''} autoComplete="name" required maxLength={80}/></label><label>Phone number (optional)<input name="phone" type="tel" autoComplete="tel" defaultValue={user.phone||''} maxLength={24}/></label><label>Staff reference (optional)<input name="staff_code" defaultValue={user.staff_code||''} maxLength={40}/></label></div><div className="sf-account-form-actions"><button className="primary" disabled={busy}>Save profile</button></div></form>{showLanguage&&<><label>{t('App language')}<select value={user.language} disabled={busy} onChange={e=>task(()=>preferences({language:e.target.value}))}><option value="en">English</option><option value="hi">हिन्दी</option></select></label><p>{t('App language changes menus and guidance. Voice language is chosen separately on Ask.')}</p></>}<form className="sf-account-form sf-password-form" onSubmit={e=>{e.preventDefault();const form=e.currentTarget,data=new FormData(form);task(async()=>{await request('/auth/password',{method:'POST',body:JSON.stringify({old_password:data.get('old'),new_password:data.get('new')})});window.dispatchEvent(new Event('session-expired'))})}}><h3>{t('Change password')}</h3><div className="formgrid"><label>{t('Current password')}<input type="password" name="old" autoComplete="current-password" required/></label><label>{t('New password (12+ characters)')}<input type="password" name="new" autoComplete="new-password" minLength={12} maxLength={128} required/></label></div><div className="sf-account-form-actions"><button disabled={busy}>{t('Change password and log out')}</button></div></form>
 {user.role==='owner'&&<><h2 className="sf-account-section-title">{t('Staff accounts')}</h2><section className="sf-invite-panel" aria-label="Invite staff"><h3>Invite staff securely</h3><p>Generate a one-time code for a worker. It expires after 24 hours and cannot grant Owner access.</p><button type="button" disabled={busy} onClick={()=>task(async()=>{const result=await request('/users/invitations',{method:'POST'});NC(result.code);await loadInvitations();M('New invitation created. Share its code privately. It will not be shown again after leaving this page.')})}>Generate staff invitation</button>{newCode&&<div className="sf-invite-secret"><label htmlFor="sf-invite-code">New one-time code (copy and share privately)</label><input id="sf-invite-code" value={newCode} readOnly autoComplete="off"/><button type="button" onClick={()=>NC('')}>Hide code</button></div>}{invitations.filter(x=>!x.used_at&&!x.revoked_at&&x.expires_at>Date.now()/1000).map(x=><div className="sf-invite-row" key={x.id}><span>Unused invitation · Expires {new Date(x.expires_at*1000).toLocaleString()}</span><button type="button" disabled={busy} onClick={()=>task(async()=>{await request('/users/invitations/'+x.id,{method:'DELETE'});NC('');await loadInvitations();M('Invitation revoked.')})}>Revoke</button></div>)}</section><form className="sf-account-form sf-staff-create-form" onSubmit={e=>{e.preventDefault();const form=e.currentTarget,data=new FormData(form);task(async()=>{await request('/users',{method:'POST',body:JSON.stringify({username:data.get('username'),password:data.get('password'),language:data.get('language')})});form.reset();await load();M('Staff account created.')})}}><div className="formgrid"><label>{t('Username')}<input name="username" pattern="[A-Za-z0-9_.-]+" required maxLength={80}/></label><label>{t('Password (12+ characters)')}<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label><label>{t('App language')}<select name="language"><option value="en">English</option><option value="hi">हिन्दी</option></select></label></div><div className="sf-account-form-actions"><button className="primary" disabled={busy}>{t('Create staff account')}</button></div></form>{users.filter(u=>u.role==='staff').map(u=><article className="evidence-row" key={u.id}><b>{u.display_name||u.username}</b> <small>{u.username} · {u.staff_code} · {u.phone}</small> · {t(u.active?'Active':'Disabled')}<div className="actions"><button disabled={busy} onClick={()=>task(async()=>{await request('/users/'+u.id,{method:'PATCH',body:JSON.stringify({active:!u.active})});await load()})}>{t(u.active?'Disable access':'Enable access')}</button></div><form onSubmit={e=>{e.preventDefault();const form=e.currentTarget,data=new FormData(form);task(async()=>{await request('/users/'+u.id,{method:'PATCH',body:JSON.stringify({password:data.get('password')})});form.reset();M('Password reset. Existing sessions closed.')})}}><label>{t('New password (12+ characters)')}<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label><button disabled={busy}>{t('Reset staff password')}</button></form></article>)}</>}{message&&<p role="status" className="sf-account-status">{t(message)}</p>}<footer className="sf-account-footer"><span>{t('Signed in as')} <strong>{user.username}</strong></span><button className="secondary sf-account-logout" type="button" disabled={busy} onClick={()=>task(logout)}>{t('Log out')}</button></footer></section>;
}
