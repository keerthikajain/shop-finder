import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readWorkResume,writeWorkResume,clearWorkResume,workResumeKey} from '../src/work-resume.js';

function memoryStorage(){
 const values=new Map();
 return {getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
}

test('refresh pointer persists workflow context but not task data or audio',()=>{
 const storage=memoryStorage();
 const data={taskId:'task-123',collection:'all',page:'find',query:'fan size 55',lookupMode:'locations',activeLine:2,group:'location',reportIndex:1};
 writeWorkResume(storage,'worker-1',data);
 assert.deepEqual(readWorkResume(storage,'worker-1'),data);
 const raw=storage.getItem(workResumeKey('worker-1'));
 assert.doesNotMatch(raw,/selected|quantity|transcript|audio|confirmed_at|secret/i);
 assert.equal(readWorkResume(storage,'worker-2'),null);
 clearWorkResume(storage,'worker-1');
 assert.equal(readWorkResume(storage,'worker-1'),null);
});

test('invalid or outdated refresh pointers cannot restore unauthorized UI states',()=>{
 const storage=memoryStorage();
 const key=workResumeKey('worker-1');
 storage.setItem(key,JSON.stringify({version:1,at:Date.now()-8*86400000,taskId:'task-123'}));
 assert.equal(readWorkResume(storage,'worker-1'),null);
 storage.setItem(key,JSON.stringify({version:1,at:Date.now(),taskId:'task-123',page:'review',lookupMode:'unknown',activeLine:-8,group:'unknown'}));
 assert.deepEqual(readWorkResume(storage,'worker-1'),{taskId:'task-123',collection:'all',page:'review',query:'',lookupMode:'choice',activeLine:0,group:'request',reportIndex:null});
 storage.setItem(key,'{');
 assert.equal(readWorkResume(storage,'worker-1'),null);
});

test('refresh reloads real server work and safely pauses voice instead of restarting picking',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(ui,/request\('\/warehouse\/tasks\/'\+encodeURIComponent\(saved\.taskId\)\)/);
 assert.match(ui,/if\(restored\?\.id!==saved\.taskId/);
 assert.match(ui,/T\(restored\)/);
 assert.match(ui,/SetModeListening\(false\);SetLookupVoicePaused\(true\);VGP\(true\)/);
 assert.match(ui,/if\(saved\.reportIndex!==null&&reportLine\?\.selected&&reportLine\?\.location\)/);
 assert.match(ui,/workHydrated/);
 assert.match(ui,/writeWorkResume\(sessionStorage,user\.id/);
 assert.doesNotMatch(ui,/void restore\(\);[\s\S]{0,80}pickAction\('start'\)/);
});
