import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('all resolved picking cards retain the same location and footer surfaces',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(ui,/sf-task-reported/);
 assert.match(ui,/sf-task-skipped/);
 assert.match(ui,/line\.location_feedback\?\.status==='correct'\?t\('Shelf location checked'\)/);
  assert.match(ui,/className="sf-location-check"/);
 assert.match(ui,/line\.complete\|\|picking\.status==='completed'/);
 assert.match(ui,/t\(line\.complete\?'Picked and verified':'Confirm picked item'\)/);
 assert.match(css,/\.sf-find-page \.wh-task-list>\.wh-task/);
 assert.match(css,/\.sf-find-page \.wh-task \.sf-location-check\{/);
 assert.doesNotMatch(ui,/\{!line\.complete&&picking\.status!=='completed'&&<div className="sf-location-check"/);
});

test('recent requests panels are gone without changing persisted task storage',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(ui,/<summary>\{t\('Recent requests'\)\}<\/summary>/);
 assert.match(ui,/request\('\/warehouse\/tasks'\)/);
});

test('scanner ignores unrelated worklist notices and keeps focused manual and camera controls',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const modal=await readFile(new URL('../src/warehouse-ui.jsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(ui,/type==='lookup'&&<Modal title=\{t\('Scan a label'\)\} onClose=\{\(\)=>D\(null\)\} showNotice=\{false\}/);
 assert.match(ui,/type==='scan'&&task&&<Modal title=\{t\('Confirm picked item'\)\} onClose=\{\(\)=>D\(null\)\} showNotice=\{false\}/);
 assert.match(modal,/showNotice&&feedback\.notice/);
 assert.match(modal,/t\(camera\?'Stop camera':'Use camera'\)/); // Verify scanner still has camera/manual access
 assert.match(css,/\.wh-modal \.wh-scan form\{/);
 assert.match(css,/@media\(max-width:520px\)/);
});

test('picking narration does not wait for a Recent requests refresh',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(ui,/void request\('\/warehouse\/tasks'\)\.then\(R\)\.catch\(\(\)=>\{\}\)/);
 assert.match(ui,/if\(guided\)await playPickGuidance\('start'/);
});
