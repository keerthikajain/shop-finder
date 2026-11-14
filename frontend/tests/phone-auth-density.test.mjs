import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('compact auth rules are strictly phone-only and preserve the artwork',async()=>{
 const css=await readFile(new URL('../src/auth-mobile-restoration.css',import.meta.url),'utf8');
 const accounts=await readFile(new URL('../src/accounts.jsx',import.meta.url),'utf8');
 const section=css.slice(css.indexOf('/* Phone-only density tuning.'));
 assert.ok(section.startsWith('/* Phone-only density tuning.'));
 assert.match(section,/@media \(max-width:480px\)/);
 assert.match(section,/\.login-shell \.login-card \.sf-public-invite/);
 assert.match(section,/\.login-shell \.login-card \.sf-auth-fields input/);
 assert.match(section,/height:46px/);
 assert.doesNotMatch(section,/@media \(min-width:|@media \(max-width:760px\)/);
 assert.match(css,/\.login-shell \.sf-login-art img\s*\{[\s\S]*?filter:blur\(3px\)/);
 for(const selector of ['sf-public-invite','sf-demo-enter','sf-signin','sf-auth-footer','sf-auth-text-link']){
  assert.ok(accounts.includes(selector),selector+' must match a real component');
 }
});
