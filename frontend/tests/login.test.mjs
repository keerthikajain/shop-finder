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

test('login header has one compact accessible language selector and no repeated sign-in tab',()=>{
 const html=render();
 assert.match(html,/<header class="sf-login-header">/);
 assert.match(html,/aria-label="App language"/);
 assert.match(html,/class="sf-login-language"/);
 assert.match(html,/<h1>Welcome back<\/h1>/);
 assert.equal((html.match(/>Sign in<\/button>/g)||[]).length,1);
 assert.doesNotMatch(html,/sf-login-kicker|sf-auth-modes/);
});
test('mobile login preserves the workspace illustration behind a readable form',async()=>{
 const css=await (await import('node:fs/promises')).readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(css,/Mobile auth and navigation polish/);
 assert.match(css,/\.login-shell \.sf-login-art\{[\s\S]*?position:absolute/);
 assert.match(css,/\.login-shell \.login-card\{[\s\S]*?background:rgba\(255,255,255,\.91\)/);
 assert.match(css,/\.sf-login-header \.sf-login-language select/);
});
