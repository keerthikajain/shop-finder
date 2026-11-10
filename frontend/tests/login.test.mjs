import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const frontend=fileURLToPath(new URL('..',import.meta.url));
const directory=await mkdtemp(path.join(tmpdir(),'shop-login-'));
after(()=>rm(directory,{recursive:true,force:true}));
const bundle=path.join(directory,'login.cjs');
await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {Login} from './src/accounts.jsx';import {Locale} from './src/locale.js';export const render=(props={},language='en')=>renderToStaticMarkup(<Locale.Provider value={language}><Login ready configured language={language} L={()=>{}} onSubmit={()=>{}} {...props}/></Locale.Provider>);`,resolveDir:frontend,loader:'jsx'},bundle:true,platform:'node',format:'cjs',outfile:bundle,logLevel:'silent'});
const {render}=await import(pathToFileURL(bundle));
test('login retains required credentials and a non-submit password toggle',()=>{
 const html=render();
 assert.match(html,/autoComplete="username"[^>]*required="" maxLength="80" name="username"/);
 assert.match(html,/type="password" autoComplete="current-password"[^>]*required="" maxLength="128" name="password"/);
 assert.match(html,/type="button" aria-controls="login-password" aria-label="Show password"/);
});
test('loading and unconfigured states never expose a login form',()=>{
 for(const props of [{ready:false},{configured:false}]){
  const html=render(props);assert.doesNotMatch(html,/<form/);assert.match(html,/role="status"/);
 }
});
test('busy and failed sign-in states remain accessible and error content is escaped',()=>{
 const html=render({busy:true,error:'<script>bad</script>'});
 assert.match(html,/aria-busy="true"/);assert.match(html,/disabled=""/);
 assert.match(html,/role="alert"/);assert.match(html,/&lt;script&gt;/);
});
test('Hindi login translates new labels while retaining credential field names',()=>{
 const html=render({},'hi');assert.match(html,/आपका स्वागत है/);
 assert.match(html,/name="username"/);assert.match(html,/पासवर्ड दिखाएँ/);
 assert.doesNotMatch(html,/Use your team account/);
});

test('sign-in is deliberately theme-neutral without a theme toggle',()=>{
 const html=render();
 assert.doesNotMatch(html,/sf-login-theme|aria-label="(?:Light mode|Dark mode)"/);
 assert.match(html,/class="sf-login-header"/);
 assert.match(html,/class="sf-login-layout"/);
});
test('sign-in keeps language and accessible password visibility controls',()=>{
 const html=render();
 assert.match(html,/class="sf-login-language"/);
 assert.match(html,/value="hi"/);
 assert.match(html,/aria-controls="login-password"/);
 assert.match(html,/aria-pressed="false"/);
});

test('sign in offers only account credentials, with role determined by the backend',()=>{
 const html=render();
 assert.match(html,/name="username"/);
 assert.match(html,/name="password"/);
 assert.doesNotMatch(html,/name="role"|Sign in as|type="radio"/);
 assert.match(html,/<h1>Welcome back<\/h1>/);
 assert.doesNotMatch(html,/Your role and permissions are identified automatically/);
 assert.doesNotMatch(html,/sf-auth-modes|aria-label="Account access"/);
 assert.match(html,/Join workspace/);
});

test('guided join screen keeps both registration paths without exposing them on sign-in',async()=>{
 const html=render();
 assert.doesNotMatch(html,/Staff invitation code|Request approval|Workspace code/);
 const source=await (await import('node:fs/promises')).readFile(new URL('../src/accounts.jsx',import.meta.url),'utf8');
 assert.match(source,/I have a workspace code/);
 assert.match(source,/I have a one-time invitation/);
 assert.match(source,/const handler=joinMethod==='workspace'\?onRegister:onJoin/);
 assert.match(source,/await handler\(\{code/);
 assert.match(source,/navigate\('login',\{clearFeedback:false\}\)/);
 assert.match(source,/setJoinMethod\(null\)/);
 assert.match(source,/autoComplete="new-password"/);
 assert.match(source,/aria-controls="sf-join-password"/);
 assert.match(source,/Your account will remain pending until approved/);
});

test('auth layout retains compact spacing and a soft illustrated mobile backdrop',async()=>{
 const styles=await (await import('node:fs/promises')).readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(styles,/Auth redesign: two entry paths/);
 assert.match(styles,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(styles,/\.sf-auth-fields\{display:grid;gap:14px/);
 assert.match(styles,/@media\(max-width:480px\)/);
});

test('login has Finder branding and a readable language control inside the form card',()=>{
 const html=render();
 assert.match(html,/<header class="sf-login-header">/);
 assert.match(html,/<span>finder<\/span>/);
 assert.doesNotMatch(html,/shopfinder/);
 assert.match(html,/<section[^>]*class="glass login-card"[^>]*>[\s\S]*?<h1>Welcome back<\/h1>[\s\S]*?<label class="sf-login-language">/);
 assert.match(html,/aria-label="App language"/);
 const header=html.split('</header>')[0];
 assert.doesNotMatch(header,/sf-login-language|<select/);
 assert.match(html,/<button[^>]*class="primary full-width sf-signin"[^>]*>Sign in/);
 assert.equal((html.match(/class="primary full-width sf-signin"/g)||[]).length,1);
 assert.doesNotMatch(html,/sf-login-kicker|sf-auth-modes/);
});
test('mobile art is faint, larger than the form and placed BEHIND its controls',async()=>{
 const styles=await (await import('node:fs/promises')).readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 const mobile=styles.slice(styles.indexOf('@media (max-width:760px){',styles.indexOf('/* Finder authentication: one shared desktop card')));
 assert.match(mobile,/\.login-shell \.sf-login-layout\{[\s\S]*?position:relative/);
 assert.match(mobile,/\.login-shell \.sf-login-art\{[\s\S]*?position:absolute/);
 assert.match(mobile,/\.login-shell \.sf-login-art\{[\s\S]*?opacity:\.30/);
 assert.match(mobile,/\.login-shell \.sf-login-art img\{[\s\S]*?width:112%/);
 assert.match(mobile,/\.login-shell \.login-card\{[\s\S]*?z-index:1/);
 assert.match(mobile,/\.login-shell \.login-card\{[\s\S]*?background:rgba\(255,255,255,\.92\)/);
 assert.match(mobile,/pointer-events:none/);
});

test('Finder appears in the browser title and installed app name',async()=>{
 const {readFile}=await import('node:fs/promises');
 const index=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const manifest=JSON.parse(await readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
 assert.match(index,/<title>Finder · Voice workspace<\/title>/);
 assert.equal(manifest.short_name,'Finder');
});

test('desktop login puts illustration AND form inside one shared shadow card',async()=>{
 const styles=await (await import('node:fs/promises')).readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 const latest=styles.slice(styles.indexOf('/* Finder authentication: one shared desktop card'));
 const desktop=latest.slice(0,latest.indexOf('@media (max-width:760px)'));
 assert.match(desktop,/@media \(min-width:761px\)/);
 assert.match(desktop,/\.login-shell \.sf-login-layout\{[\s\S]*?max-width:940px/);
 assert.match(desktop,/grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
 assert.match(desktop,/box-shadow:0 22px 54px/);
 assert.match(desktop,/overflow:hidden/);
 assert.match(desktop,/\.login-shell \.sf-login-art\{[\s\S]*?border-right:1px solid/);
 assert.match(desktop,/\.login-shell \.login-card\{[\s\S]*?border:0/);
 assert.match(desktop,/\.login-shell \.login-card\{[\s\S]*?box-shadow:none/);
 const html=render();
 assert.match(html,/class="sf-login-layout"><section class="sf-login-art"/);
 assert.match(html,/class="glass login-card"/);
});

test('login and registration expose all ten persistent interface languages',async()=>{
 const html=render();
 const expected=['en','hi','bn','mr','gu','pa','kn','te','ta','ml'];
 for(const code of expected)assert.match(html,new RegExp('value="'+code+'"'));
 assert.match(render({},'kn'),/ಮತ್ತೆ ಸ್ವಾಗತ/);
 assert.match(render({},'ta'),/மீண்டும் வரவேற்கிறோம்/);
 assert.match(render({},'bn'),/আবার স্বাগতম/);
 const file=await (await import('node:fs/promises')).readFile(new URL('../src/accounts.jsx',import.meta.url),'utf8');
 assert.match(file,/finder-app-language/);
 assert.match(file,/document\.documentElement\.lang/);
});

test('public welcome offers browser speech without requiring an API key or blocking login',async()=>{
 const html=render({signupEnabled:true});
 assert.doesNotMatch(html,/Hear welcome|Stop welcome/);
 assert.match(html,/Sign in to pick up where you left off\./);
 assert.doesNotMatch(html,/Welcome to Finder\. Your workspace is ready to explore\./);
 assert.doesNotMatch(html,/Welcome to Shop Finder\. Sign in to continue, or explore a workspace/);
 assert.match(html,/name="username"/);
 const src=await (await import('node:fs/promises')).readFile(new URL('../src/accounts.jsx',import.meta.url),'utf8');
 assert.match(src,/playWelcomeOnce/);
 assert.match(src,/\/api\/welcome\/audio\?language=/);
 assert.match(src,/stopWelcome\(playback\)/);
 assert.match(src,/welcomeAttempted\.current=true/);
 assert.match(src,/welcomeAttempted\.current=true/);
 assert.match(src,/url:'\/api\/welcome\/audio\?language='/);
 assert.doesNotMatch(src,/onClick=\{speakWelcome\}/);
 assert.doesNotMatch(src,/GNANI_API_KEY|\/voice\/speak/);
});

test('signup has a dedicated setup subtitle while welcome speech stays separate',async()=>{
 const signup=render({signupEnabled:true});
 assert.match(signup,/class="wh-brand"/);
 assert.match(signup,/class="sf-auth-welcome-row"/);
 assert.match(signup,/class="sf-auth-page-subtitle"/);
 assert.match(signup,/Sign in to pick up where you left off/);
 const src=await (await import('node:fs/promises')).readFile(new URL('../src/accounts.jsx',import.meta.url),'utf8');
 assert.match(src,/Set up your space, organize your items, and find everything with ease/);
 assert.match(src,/Hi there! Welcome to Finder/);
 assert.doesNotMatch(src,/<p>\{greeting\}<\/p>/);
 const css=await (await import('node:fs/promises')).readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(css,/\.login-shell \.sf-auth-welcome-row\{/);
 assert.match(css,/\.login-shell \.sf-login-header\{\s*justify-content:flex-start/);
 assert.match(css,/@media\(max-width:480px\)\{[\s\S]*?\.login-shell \.sf-auth-welcome-row\{/);
});
