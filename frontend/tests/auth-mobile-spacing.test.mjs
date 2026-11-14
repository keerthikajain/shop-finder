import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('mobile login subtitle cannot expand into an empty flex-basis gap',async()=>{
 const css=await readFile(new URL('../src/auth-mobile-restoration.css',import.meta.url),'utf8');
 const auth=await readFile(new URL('../src/accounts.jsx',import.meta.url),'utf8');
 const legacy=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 const entry=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.match(legacy,/flex:1 1 185px/);
 assert.match(css,/\.login-shell \.login-card \.sf-auth-page-subtitle\s*\{[\s\S]*?flex:0 0 auto/);
 assert.match(css,/\.login-shell \.login-card \.sf-auth-welcome-row\s*\{[\s\S]*?height:auto/);
 assert.match(css,/\.login-shell \.login-card > \.sf-login-language\s*\{[\s\S]*?margin:0 0 16px/);
 assert.match(auth,/className="sf-auth-page-subtitle"/);
 assert.ok(entry.indexOf("import './auth-mobile-restoration.css';")>entry.indexOf("import './selected-design.css';"));
 // The chosen background visual must remain behind the form.
 assert.match(css,/\.login-shell \.sf-login-art\s*\{[\s\S]*?position:absolute/);
 assert.match(css,/\.login-shell \.sf-login-art img\s*\{[\s\S]*?filter:blur\(3px\)/);
});
