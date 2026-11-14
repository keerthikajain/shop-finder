import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('completed picking does not leave the guided voice panel mounted',async()=>{
  const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
  assert.match(src,/picking\.status!=='completed'&&\(picking\.status!=='ready'\|\|lookupMode==='guided'\)/);
  assert.match(src,/picking\.status==='active'&&nextPickIndex<0&&<div className="sf-picking-remaining"/);
  assert.match(src,/task\.lines\.every\(line=>line\.complete\|\|\['skipped','cancelled'\]\.includes\(line\.deferred_reason\)\)/);
  assert.match(src,/onClick=\{\(\)=>pickAction\('finish'\)\}/);
  assert.match(src,/pickingUiCopy\(appLanguage,'reviewItems'\)/);
});

test('short mobile picking text retains manual fallback and report safety',async()=>{
  const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
  const copy=await readFile(new URL('../src/picking-copy.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../src/responsive-guardrails.css',import.meta.url),'utf8');
  assert.doesNotMatch(src,/className="sf-report-step-note"/);
  assert.match(src,/pendingVoicePick&&<div className="sf-voice-pick-confirm"/);
  assert.match(src,/!task\.lines\.every\(line=>line\.complete\|\|\['skipped','cancelled'\]\.includes\(line\.deferred_reason\)\)/);
  assert.match(src,/picking\.status==='active'&&voice&&handsFree/);
  assert.match(copy,/remaining:'items to review',reviewItems:'Review items'/);
  assert.match(copy,/remaining:'సమీక్షించాల్సిన వస్తువులు'|remaining:'పరిశీలించాల్సిన వస్తువులు'/);
  assert.match(css,/\.sf-compact-app\.sf-find-page \.sf-picking-remaining/);
  assert.match(css,/font-weight:500/);
});
