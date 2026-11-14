import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('location audio explicitly hands back to microphone after it finishes',async()=>{
 const s=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const section=s.slice(s.indexOf('async function playPickGuidance('),s.indexOf('async function applyNextChoice('));
 assert.match(section,/audio\.current\.onended=\(\)=>\{/);
 assert.match(section,/if\(serial!==playbackSerial\.current\)return/);
 assert.match(section,/\['start','next','repeat'\]\.includes\(command\)/);
 assert.match(section,/!voiceFlowStopped\.current/);
 assert.match(section,/handsFree&&source\.picking\?\.status==='active'/);
 assert.match(section,/!manual&&page==='find'&&!modal\)VGP\(false\)/);
 assert.match(section,/audio\.current\.onerror=\(\)=>\{/);
 assert.match(section,/SP\(false\);VGP\(true\)/);
});
