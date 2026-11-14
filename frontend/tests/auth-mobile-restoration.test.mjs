import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('mobile login uses oversized artwork behind the form, not an illustration banner',async()=>{
 const css=await readFile(new URL('../src/auth-mobile-restoration.css',import.meta.url),'utf8');
 const app=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8');
 const auth=await readFile(new URL('../src/accounts.jsx',import.meta.url),'utf8');
 assert.match(auth,/className="sf-login-layout"/);
 assert.match(auth,/className="sf-login-art"/);
 assert.match(auth,/className="glass login-card"/);
 assert.match(css,/@media \(max-width:760px\)/);
 assert.match(css,/\.login-shell \.sf-login-art\s*\{[\s\S]*?position:absolute/);
 assert.match(css,/\.login-shell \.sf-login-art img\s*\{[\s\S]*?filter:blur\(3px\)/);
 assert.match(css,/\.login-shell \.sf-login-art > div\s*\{\s*display:none/);
 assert.match(css,/\.login-shell \.login-card\s*\{[\s\S]*?z-index:1/);
 assert.match(css,/pointer-events:none/);
 assert.match(css,/prefers-reduced-transparency:reduce/);
 assert.ok(app.lastIndexOf("import './auth-mobile-restoration.css';")>app.lastIndexOf("import './selected-design.css';"));
 assert.ok(app.lastIndexOf("import './auth-mobile-restoration.css';")>app.lastIndexOf("import './responsive-guardrails.css';"));
});
