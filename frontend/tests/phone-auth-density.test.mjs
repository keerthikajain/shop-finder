import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('phone sign-in remains compact while illustration and desktop layout are preserved',async()=>{
 const css=await readFile(new URL('../src/auth-mobile-restoration.css',import.meta.url),'utf8');
 const accounts=await readFile(new URL('../src/accounts.jsx',import.meta.url),'utf8');
 const compact=css.slice(css.indexOf('/* Compact phone onboarding:'));
 assert.ok(compact.startsWith('/* Compact phone onboarding:'));
 assert.match(compact,/@media \(max-width:480px\)/);
 assert.match(compact,/\.login-shell \.login-card \.sf-auth-fields input\s*\{[\s\S]*?height:46px/);
 assert.match(compact,/\.login-shell \.login-card \.sf-auth-fields \.sf-signin\s*\{[\s\S]*?height:46px/);
 assert.match(compact,/\.login-shell \.login-card \.sf-public-invite\s*\{[\s\S]*?gap:10px/);
 assert.match(compact,/\.login-shell \.login-card \.sf-public-invite > button\.sf-demo-enter\s*\{[\s\S]*?min-height:46px/);
 assert.doesNotMatch(compact,/@media \(min-width:/);
 assert.match(accounts,/className="sf-public-invite"/);
 assert.match(accounts,/className="sf-demo-enter"/);
 assert.match(css,/\.login-shell \.sf-login-art img\s*\{[\s\S]*?filter:blur\(3px\)/);
});
