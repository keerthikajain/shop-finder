import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('terminal picking command outcomes are never passed to the audio endpoint',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(ui,/answer\.action==='done'\|\|answer\.action==='unresolved'/);
 assert.match(ui,/playableActions\.includes\(answer\.action\)/);
 assert.match(ui,/if\(!\['start','next','repeat','verify','report','stop','help','unknown'\]\.includes\(command\)/);
 assert.match(ui,/Number\.isInteger\(line\)&&line>=0&&line<source\.lines\.length&&line<=9/);
});
