import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('all variant resolution paths defer spoken mode question until the UI is no longer busy',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(ui,/if\(busy\|\|!task\|\|pendingModePrompt\.current!==task\.id\)return/);
 assert.match(ui,/pendingModePrompt\.current=null;\s*void offerSearchMode\(task\)/);
 assert.match(ui,/\},\[busy,task\]\)/);
 assert.match(ui,/if\(next\.lines\.every\(x=>x\.selected&&x\.location\)\)pendingModePrompt\.current=next\.id/);
 assert.match(ui,/pendingModePrompt\.current=result\.id/);
 assert.match(ui,/if\(serial===modeChoiceSerial\.current&&played\)SetModeListening\(true\)/);
 assert.doesNotMatch(ui,/if\(next\.lines\.every\(x=>x\.selected&&x\.location\)\)void offerSearchMode\(next\)/);
});

test('voice question failure leaves manual mode selection and microphone available',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(ui,/return false;\s*\}finally\{/);
 assert.match(ui,/onClick=\{\(\)=>\{SetModeSpeechResult\(null\);chooseSearchMode\('guided'\)\}\}/);
 assert.match(ui,/onClick=\{\(\)=>\{SetModeSpeechResult\(null\);chooseSearchMode\('locations'\)\}\}/);
 assert.match(ui,/label=\{lookupCopy\(appLanguage,'speakChoice'\)\}/);
});

test('an odd final worklist card fills empty desktop width but mobile stays one column',async()=>{
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(css,/@media\(min-width:1181px\)\{/);
 assert.match(css,/\.sf-find-page \.wh-task-list>\.wh-task:last-child:nth-child\(odd\):not\(:first-child\)\{\s*grid-column:1 \/ -1/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:1180px\)/);
});
