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
 return <Locale.Provider value={user?.language||language}>{user?children({user,preferences,logout}):<Login {...{ready,configured,language,L,error,busy,notice}} onRegister={async ({code,username,password,display_name})=>{B(true);E('');N('');try{await request('/auth/register',{method:'POST',body:JSON.stringify({code,username,password,display_name,language})});N('Registration requested. An owner or manager must approve your account before you can sign in.')}catch(err){E(err.message);throw err}finally{B(false)}}} onJoin={async ({code,username,password})=>{B(true);E('');N('');try{await request('/auth/join',{method:'POST',body:JSON.stringify({code,username,password,language})});N('Staff account created. Sign in with your new credentials.')}catch(err){E(err.message);throw err}finally{B(false)}}} onClearFeedback={()=>{E('');N('')}} onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget);B(true);E('');N('');try{const next=await request('/auth/login',{method:'POST',body:JSON.stringify({username:data.get('username'),password:data.get('password')})});setUser(next);L(next.language)}catch(err){E(err.message)}finally{B(false)}}}/>}</Locale.Provider>;
}
export function Login({ready,configured,language,L,error,busy,notice='',onSubmit,onJoin,onRegister,onClearFeedback}){
 const t=useT();
 const [screen,setScreen]=useState('login');
 const [joinMethod,setJoinMethod]=useState(null);
 const [showPassword,setShowPassword]=useState(false);
 const joining=screen==='join';

 function navigate(next,{clearFeedback=true}={}){
  setScreen(next);
  setJoinMethod(null);
  setShowPassword(false);
  if(clearFeedback)onClearFeedback?.();
 }
 function chooseMethod(method){
  setJoinMethod(method);
  setShowPassword(false);
  onClearFeedback?.();
 }
 async function submitJoin(event){
  event.preventDefault();
  const form=event.currentTarget;
  const data=new FormData(form);
  const handler=joinMethod==='workspace'?onRegister:onJoin;
  if(!handler)return;
  try{
   if(joinMethod==='workspace'){
    await handler({code:data.get('code'),username:data.get('username'),display_name:data.get('display_name'),password:data.get('password')});
   }else{
    await handler({code:data.get('code'),username:data.get('username'),password:data.get('password')});
   }
   form.reset();
   navigate('login',{clearFeedback:false});
  }catch{
   // The account gate displays the server-provided, safely escaped error.
  }
 }

 const heading=joining?t('Join workspace'):t('Welcome back');
 const intro=joining&&!joinMethod?t('Choose how you would like to join your team.'):'';
 const codeLabel=joinMethod==='workspace'?t('Workspace code'):t('Staff invitation code');
 const joinWithWorkspace=joinMethod==='workspace';

 return <main className="login-shell">
  <header className="sf-login-header">
   <div className="wh-brand"><Mark/><span>shopfinder</span></div>
   <label className="sf-login-language">
    <span className="sr-only">{t('App language')}</span>
    <select aria-label={t('App language')} value={language} onChange={e=>L(e.target.value)}><option value="en">English</option><option value="hi">हिन्दी</option></select>
   </label>
  </header>
  <div className="sf-login-layout">
   <section className="sf-login-art" aria-label={t('Your workspace, within reach.')}>
    <img src="/art/workspace-login.webp" width="1254" height="1254" alt=""/>
    <div><h2>{t('Your workspace, within reach.')}</h2><p>{t('Find items. Know their place.')}</p></div>
   </section>
   <section className="glass login-card" aria-label={heading}>
    <h1>{heading}</h1>
    {intro&&<p className="sf-auth-intro">{intro}</p>}
    {!ready?<p role="status">{t('Loading…')}</p>:!configured?<p role="status">{t('This workspace is not set up yet. Ask the installer to create the first owner account.')}</p>:!joining?
    <form className="sf-auth-fields" onSubmit={onSubmit} aria-busy={busy}>
     <label htmlFor="sf-signin-username">{t('Username')}<input id="sf-signin-username" name="username" autoComplete="username" placeholder={t('Enter username')} required maxLength={80}/></label>
     <div className="sf-auth-password">
      <label htmlFor="login-password">{t('Password')}</label>
      <div className="sf-password-field"><input id="login-password" name="password" type={showPassword?'text':'password'} autoComplete="current-password" placeholder={t('Enter password')} required maxLength={128}/>
       <button type="button" aria-controls="login-password" aria-label={t(showPassword?'Hide password':'Show password')} aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)}>{t(showPassword?'Hide':'Show')}</button>
      </div>
     </div>
     <button className="primary full-width sf-signin" disabled={busy}>{t(busy?'Working…':'Sign in')}<Glyph name="arrow"/></button>
    </form>:!joinMethod?
    <div className="sf-join-choices" role="group" aria-label={t('Choose how to join')}>
     <button type="button" className="sf-join-option" onClick={()=>chooseMethod('workspace')}>
      <span className="sf-join-option-copy"><strong>{t('I have a workspace code')}</strong><small>{t('Request staff access. An owner or manager will review your request.')}</small></span>
      <Glyph name="arrow"/>
     </button>
     <button type="button" className="sf-join-option" onClick={()=>chooseMethod('invite')}>
      <span className="sf-join-option-copy"><strong>{t('I have a one-time invitation')}</strong><small>{t('Create a staff account using an invitation from your owner.')}</small></span>
      <Glyph name="arrow"/>
     </button>
     <p className="sf-auth-support">{t('Ask your workplace owner or manager how to join.')}</p>
    </div>:
    <div className="sf-join-form-wrap">
     <button className="sf-auth-back" type="button" onClick={()=>chooseMethod(null)}>{'← '}{t('Choose another method')}</button>
     <h2 className="sf-join-form-title">{t(joinWithWorkspace?'Request staff access':'Accept your invitation')}</h2>
     <p className="sf-auth-helper">{t(joinWithWorkspace?'Use the workplace code shared by your team. Your account will remain pending until approved.':'Use the private one-time code from your owner. The code expires after 24 hours.')}</p>
     <form className="sf-auth-fields sf-staff-join-form" onSubmit={submitJoin} aria-busy={busy}>
      <label htmlFor="sf-join-code">{codeLabel}<input id="sf-join-code" name="code" autoComplete="off" required minLength={joinWithWorkspace?27:24} maxLength={100} pattern={joinWithWorkspace?'SF-[A-Za-z0-9_-]{24,80}':'[A-Za-z0-9_-]+'} placeholder={t('Enter your code')}/></label>
      {joinWithWorkspace&&<label htmlFor="sf-join-name">{t('Full name')}<input id="sf-join-name" name="display_name" autoComplete="name" required maxLength={80} placeholder={t('Your name')}/></label>}
      <label htmlFor="sf-join-username">{t('Username')}<input id="sf-join-username" name="username" autoComplete="username" required maxLength={80} pattern="[A-Za-z0-9_.-]+" placeholder={t('Choose a username')}/></label>
      <div className="sf-auth-password">
       <label htmlFor="sf-join-password">{t('Password (12+ characters)')}</label>
       <div className="sf-password-field"><input id="sf-join-password" name="password" type={showPassword?'text':'password'} autoComplete="new-password" required minLength={12} maxLength={128} placeholder={t('Create a password')}/>
        <button type="button" aria-controls="sf-join-password" aria-label={t(showPassword?'Hide password':'Show password')} aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)}>{t(showPassword?'Hide':'Show')}</button>
       </div>
      </div>
      <button className="primary full-width sf-signin" disabled={busy||!(joinWithWorkspace?onRegister:onJoin)}>{t(busy?'Working…':joinWithWorkspace?'Request approval':'Create staff account')}<Glyph name="arrow"/></button>
     </form>
    </div>}
    {error&&<p className="error sf-auth-message" role="alert">{t(error)}</p>}
    {notice&&<p className="sf-auth-success sf-auth-message" role="status">{t(notice)}</p>}
    {ready&&configured&&<p className="quiet sf-auth-footer">{joining?t('Already have an account?'):t('New to the team?')} <button type="button" className="sf-auth-text-link" onClick={()=>navigate(joining?'login':'join')}>{t(joining?'Sign in':'Join workspace')}</button></p>}
   </section>
  </div>
 </main>;
}

export function AccountSettings({user,preferences,logout,showLanguage=true}){
 const t=useT(),[users,U]=useState([]),[message,M]=useState(''),[busy,B]=useState(false),[invitations,IV]=useState([]),[newCode,NC]=useState(''),[workspaceCode,WC]=useState(null),[displayCode,DC]=useState(''),[pending,PENDING]=useState([]);
 const load=async()=>U(await request('/users'));
 const loadInvitations=async()=>IV(await request('/users/invitations'));
 const loadPending=async()=>PENDING(await request('/registrations/pending'));
 const loadWorkspaceCode=async()=>WC(await request('/registrations/workspace-code'));
 useEffect(()=>{if(user.role==='owner'){load().catch(e=>M(e.message));loadInvitations().catch(e=>M(e.message));loadWorkspaceCode().catch(e=>M(e.message))}if(['owner','manager'].includes(user.role))loadPending().catch(e=>M(e.message))},[user.role]);
 async function task(fn){B(true);M('');try{await fn()}catch(e){M(e.message)}finally{B(false)}}
 return <section className="glass editor-panel sf-account-panel"><h2>{t('My account')}</h2><p>{user.username} · {t(user.role)}</p><form className="sf-account-form sf-profile-form" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);task(async()=>{await request('/auth/profile',{method:'PUT',body:JSON.stringify(Object.fromEntries(data))});await preferences({});M('Profile saved.')})}}><h3>My profile</h3><p>Your phone number is optional and visible only to you and the workspace owner.</p><div className="formgrid"><label>Full name<input name="display_name" defaultValue={user.display_name||''} autoComplete="name" required maxLength={80}/></label><label>Phone number (optional)<input name="phone" type="tel" autoComplete="tel" defaultValue={user.phone||''} maxLength={24}/></label><label>Staff reference (optional)<input name="staff_code" defaultValue={user.staff_code||''} maxLength={40}/></label></div><div className="sf-account-form-actions"><button className="primary" disabled={busy}>Save profile</button></div></form>{showLanguage&&<><label>{t('App language')}<select value={user.language} disabled={busy} onChange={e=>task(()=>preferences({language:e.target.value}))}><option value="en">English</option><option value="hi">हिन्दी</option></select></label><p>{t('App language changes menus and guidance. Voice language is chosen separately on Ask.')}</p></>}<form className="sf-account-form sf-password-form" onSubmit={e=>{e.preventDefault();const form=e.currentTarget,data=new FormData(form);task(async()=>{await request('/auth/password',{method:'POST',body:JSON.stringify({old_password:data.get('old'),new_password:data.get('new')})});window.dispatchEvent(new Event('session-expired'))})}}><h3>{t('Change password')}</h3><div className="formgrid"><label>{t('Current password')}<input type="password" name="old" autoComplete="current-password" required/></label><label>{t('New password (12+ characters)')}<input type="password" name="new" autoComplete="new-password" minLength={12} maxLength={128} required/></label></div><div className="sf-account-form-actions"><button disabled={busy}>{t('Change password and log out')}</button></div></form>
 {['owner','manager'].includes(user.role)&&<section className="sf-invite-panel sf-approvals" aria-label="Pending staff approvals"><h2>Staff registration requests</h2><p>Verify each worker's identity before approval. A workspace code alone never gives access.</p><button type="button" disabled={busy} onClick={()=>task(loadPending)}>Refresh requests</button>{pending.length===0?<p>No pending staff registrations.</p>:pending.map(u=><article className="sf-invite-row" key={u.id}><div><strong>{u.display_name||u.username}</strong><small> {u.username} · Awaiting approval</small></div><div className="sf-approval-actions"><button type="button" disabled={busy} onClick={()=>task(async()=>{await request('/registrations/pending/'+u.id+'/approve',{method:'POST'});await loadPending();if(user.role==='owner')await load();M('Staff approved. The worker can now sign in.')})}>Approve</button><button type="button" disabled={busy} onClick={()=>task(async()=>{await request('/registrations/pending/'+u.id+'/reject',{method:'POST'});await loadPending();M('Registration rejected.')})}>Reject</button></div></article>)}</section>}{user.role==='owner'&&<><h2 className="sf-account-section-title">{t('Staff accounts')}</h2><section className="sf-invite-panel sf-workspace-registration" aria-label="Workspace self-registration"><h3>Self-registration</h3><p>Workers can request access using one shared workplace code. Every account must still be approved. Keep the code private and rotate it if exposed.</p><p><strong>Registration:</strong> {workspaceCode?.configured?(workspaceCode.enabled?'Enabled':'Disabled'):'Not configured'}</p><div className="sf-registration-actions"><button type="button" disabled={busy} onClick={()=>task(async()=>{const res=await request('/registrations/workspace-code',{method:'POST'});DC(res.code);await loadWorkspaceCode();M('New code generated. Old workplace codes are invalidated. Share privately.')})}>{workspaceCode?.configured?'Rotate workspace code':'Generate workspace code'}</button>{workspaceCode?.configured&&<button type="button" disabled={busy} onClick={()=>task(async()=>{await request('/registrations/workspace-code',{method:'PATCH',body:JSON.stringify({enabled:!workspaceCode.enabled})});await loadWorkspaceCode();DC('');M('Registration setting updated.')})}>{workspaceCode?.enabled?'Disable registration':'Enable registration'}</button>}</div>{displayCode&&<div className="sf-invite-secret"><label htmlFor="sf-registration-secret">New workspace code (displayed only once)<input id="sf-registration-secret" value={displayCode} readOnly autoComplete="off"/></label><button type="button" onClick={()=>DC('')}>Hide code</button></div>}</section><section className="sf-invite-panel sf-manager-access" aria-label="Manager permissions"><h3>Assign approval managers</h3><p>Only owners may grant or revoke manager approval privileges. Confirm your owner password; manager sessions are revoked when access changes.</p>{users.filter(u=>u.role==='staff'||u.role==='manager').filter(u=>u.active&&u.approval_status==='approved').map(u=><form className="sf-manager-row" key={u.id} onSubmit={e=>{e.preventDefault();const form=e.currentTarget,d=new FormData(form);task(async()=>{await request('/registrations/managers/'+u.id,{method:'PATCH',body:JSON.stringify({grant_manager:u.role!=='manager',owner_password:d.get('password')})});form.reset();await load();M('Manager permissions updated. The employee must sign in again.')})}}><span>{u.display_name||u.username} · {u.role}</span><label>Confirm owner password<input type="password" name="password" required autoComplete="current-password"/></label><button disabled={busy}>{u.role==='manager'?'Revoke manager':'Make manager'}</button></form>)}</section><section className="sf-invite-panel" aria-label="Invite staff"><h3>Invite staff securely</h3><p>Generate a one-time code for a worker. It expires after 24 hours and cannot grant Owner access.</p><button type="button" disabled={busy} onClick={()=>task(async()=>{const result=await request('/users/invitations',{method:'POST'});NC(result.code);await loadInvitations();M('New invitation created. Share its code privately. It will not be shown again after leaving this page.')})}>Generate staff invitation</button>{newCode&&<div className="sf-invite-secret"><label htmlFor="sf-invite-code">New one-time code (copy and share privately)</label><input id="sf-invite-code" value={newCode} readOnly autoComplete="off"/><button type="button" onClick={()=>NC('')}>Hide code</button></div>}{invitations.filter(x=>!x.used_at&&!x.revoked_at&&x.expires_at>Date.now()/1000).map(x=><div className="sf-invite-row" key={x.id}><span>Unused invitation · Expires {new Date(x.expires_at*1000).toLocaleString()}</span><button type="button" disabled={busy} onClick={()=>task(async()=>{await request('/users/invitations/'+x.id,{method:'DELETE'});NC('');await loadInvitations();M('Invitation revoked.')})}>Revoke</button></div>)}</section><form className="sf-account-form sf-staff-create-form" onSubmit={e=>{e.preventDefault();const form=e.currentTarget,data=new FormData(form);task(async()=>{await request('/users',{method:'POST',body:JSON.stringify({username:data.get('username'),password:data.get('password'),language:data.get('language')})});form.reset();await load();M('Staff account created.')})}}><div className="formgrid"><label>{t('Username')}<input name="username" pattern="[A-Za-z0-9_.-]+" required maxLength={80}/></label><label>{t('Password (12+ characters)')}<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label><label>{t('App language')}<select name="language"><option value="en">English</option><option value="hi">हिन्दी</option></select></label></div><div className="sf-account-form-actions"><button className="primary" disabled={busy}>{t('Create staff account')}</button></div></form>{users.filter(u=>u.role==='staff').map(u=><article className="evidence-row" key={u.id}><b>{u.display_name||u.username}</b> <small>{u.username} · {u.staff_code} · {u.phone}</small> · {t(u.active?'Active':'Disabled')}<div className="actions"><button disabled={busy} onClick={()=>task(async()=>{await request('/users/'+u.id,{method:'PATCH',body:JSON.stringify({active:!u.active})});await load()})}>{t(u.active?'Disable access':'Enable access')}</button></div><form onSubmit={e=>{e.preventDefault();const form=e.currentTarget,data=new FormData(form);task(async()=>{await request('/users/'+u.id,{method:'PATCH',body:JSON.stringify({password:data.get('password')})});form.reset();M('Password reset. Existing sessions closed.')})}}><label>{t('New password (12+ characters)')}<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label><button disabled={busy}>{t('Reset staff password')}</button></form></article>)}</>}{message&&<p role="status" className="sf-account-status">{t(message)}</p>}<footer className="sf-account-footer"><span>{t('Signed in as')} <strong>{user.username}</strong></span><button className="secondary sf-account-logout" type="button" disabled={busy} onClick={()=>task(logout)}>{t('Log out')}</button></footer></section>;
}
