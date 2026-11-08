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
 const html=render({},'hi');assert.match(html,/शॉप फाइंडर में साइन इन करें/);
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

test('login has server-verified owner/staff role choices and staff join mode',()=>{
 const html=render();
 assert.match(html,/name="role" value="owner"/);
 assert.match(html,/name="role"[^>]*value="staff"/);
 assert.match(html,/aria-label="Account access"/);
 assert.match(html,/One-time invite/);
});

test('staff self-registration and manager role are available without changing default login',()=>{
 const html=render();
 assert.match(html,/Request access/);
 assert.match(html,/One-time invite/);
 assert.match(html,/name="role"[^>]*value="manager"/);
 assert.match(html,/Sign in to Shop Finder/);
});
