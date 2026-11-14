import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('phone search microphone centers real SVG without changing its recording behavior',async()=>{
 const css=await readFile(new URL('../src/responsive-guardrails.css',import.meta.url),'utf8');
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const mobile=css.slice(css.lastIndexOf('/* Phone-only visual corrections:'));
 assert.ok(mobile.startsWith('/* Phone-only visual corrections:'));
 assert.match(mobile,/@media \(max-width:700px\)/);
 assert.match(mobile,/\.wh-composer-actions > button\.wh-voice > svg \{/);
 assert.match(mobile,/top:50%/);
 assert.match(mobile,/left:50%/);
 assert.match(mobile,/transform:translate\(-50%,-50%\)/);
 assert.match(mobile,/padding:0!important/);
 assert.doesNotMatch(mobile,/@media \(min-width:/);
 assert.match(ui,/className="wh-composer-actions"/);
 assert.match(ui,/<VoiceButton key=\{collection/);
});
test('only trailing odd worklist card uses compact phone override and preserves same card actions',async()=>{
 const css=await readFile(new URL('../src/responsive-guardrails.css',import.meta.url),'utf8');
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const mobile=css.slice(css.lastIndexOf('/* Phone-only visual corrections:'));
 assert.match(mobile,/\.wh-task:last-child:nth-child\(odd\):not\(:first-child\)/);
 assert.match(mobile,/display:flex!important/);
 assert.match(mobile,/justify-content:flex-start!important/);
 assert.match(mobile,/grid-template-rows:auto auto/);
 assert.match(mobile,/min-height:0!important/);
 assert.match(mobile,/\.wh-task-footer > div > button/);
 assert.match(ui,/className="wh-task-footer"/);
 assert.match(ui,/className="sf-location-check"/);
 assert.match(ui,/t\('Item details'\)/);
 assert.match(ui,/t\('Report issue'\)/);
 assert.match(ui,/t\(line\.complete\?'Picked and verified':'Confirm picked item'\)/);
});
