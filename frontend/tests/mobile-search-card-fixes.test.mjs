import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('mobile search microphone is centered with real Finder classes and unchanged dimensions',async()=>{
 const css=await readFile(new URL('../src/mobile-search-card-fixes.css',import.meta.url),'utf8');
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const entry=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.match(css,/@media \(max-width:700px\)/);
 assert.doesNotMatch(css,/@media \(min-width:/);
 assert.match(css,/\.wh-composer-actions > button\.wh-voice:not\(\.sf-mobile-speak\)/);
 assert.match(css,/display:grid;\s*place-items:center/);
 assert.match(css,/> \.wh-wave\s*\{\s*display:none/);
 assert.doesNotMatch(css,/height:74px|width:52px/);
 assert.match(ui,/className="wh-composer-actions"/);
 assert.match(ui,/className=\{'wh-voice '/);
 assert.ok(entry.indexOf("import './mobile-search-card-fixes.css';")>entry.indexOf("import './responsive-guardrails.css';"));
});

test('every phone worklist card including the last uses natural height and consistent actions',async()=>{
 const css=await readFile(new URL('../src/mobile-search-card-fixes.css',import.meta.url),'utf8');
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(css,/article\.wh-task:last-child:nth-child\(odd\):not\(:first-child\)/);
 assert.match(css,/grid-auto-rows:max-content/);
 assert.match(css,/height:auto;\s*min-height:0/);
 assert.match(css,/\.wh-task-footer > div/);
 assert.match(css,/grid-column:1 \/ -1/);
 assert.match(css,/min-height:44px/);
 assert.match(ui,/className="wh-work-grid"/);
 assert.match(ui,/className="wh-task-list"/);
 assert.match(ui,/className="wh-task-footer"/);
 assert.match(ui,/className="sf-location-check"/);
 assert.match(ui,/className="sf-item-report-link"/);
});
