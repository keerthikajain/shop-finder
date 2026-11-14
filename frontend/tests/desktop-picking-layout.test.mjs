import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('desktop picking layout fix cannot affect phone or tablet breakpoints',async()=>{
 const css=await readFile(new URL('../src/desktop-picking-layout.css',import.meta.url),'utf8');
 const main=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8');
 const workspace=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(css,/^\/\* Desktop-only repair/);
 assert.match(css,/@media \(min-width:1024px\)/);
 assert.doesNotMatch(css,/@media \(max-width:/);
 assert.match(css,/\.sf-guided-picking > \.sf-voice-guide\s*\{/);
 assert.match(css,/\.sf-guided-picking \.sf-voice-pick-confirm,/);
 assert.match(css,/position:static/);
 assert.match(css,/max-width:100%/);
 assert.match(css,/min-height:0/);
 assert.match(css,/\.sf-voice-pick-confirm ~ \.sf-guide-reply/);
 assert.ok(main.indexOf("import './desktop-picking-layout.css';")>main.indexOf("import './responsive-guardrails.css';"));
 assert.ok(main.indexOf("import './desktop-picking-layout.css';")>main.indexOf("import './auth-mobile-restoration.css';"));
 assert.match(workspace,/className="sf-voice-pick-confirm"/);
 assert.match(workspace,/className="sf-guided-toolbar"/);
});
