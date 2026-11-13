import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readWorkspaceSession,writeWorkspaceSession,clearWorkspaceSession,resumeModal,sanitizeWorkspaceSession} from '../src/workspace-resume.js';

function storage(){
 const entries=new Map();
 return {getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
}

test('a refresh restores only the same user and session pointer, not a stored task or audio',()=>{
 const store=storage();
 writeWorkspaceSession(store,'worker-A',{page:'find',collection:'all',query:'blue shoes',taskId:'task_A1234567890',activeLine:3,group:'location',lookupMode:'guided',password:'must-not-store'});
 const expected=readWorkspaceSession(store,'worker-A');
 assert.deepEqual(expected,{page:'find',collection:'all',query:'blue shoes',taskId:'task_A1234567890',activeLine:3,group:'location',lookupMode:'guided',modal:null});
 assert.equal(readWorkspaceSession(store,'worker-B'),null);
 assert.doesNotMatch(store.getItem('finder:workspace-resume:v1:worker-A'),/password|must-not-store/);
 clearWorkspaceSession(store,'worker-A');
 assert.equal(readWorkspaceSession(store,'worker-A'),null);
});

test('malformed, stale and out-of-range restore fields are safely discarded',()=>{
 const broken=sanitizeWorkspaceSession({page:'delete',collection:'../../etc',taskId:'!',activeLine:-3,group:'unknown',lookupMode:'unsafe',modal:{type:'scan',index:4}});
 assert.deepEqual(broken,{page:'find',collection:'all',query:'',taskId:null,activeLine:0,group:'request',lookupMode:'choice',modal:null});
 const store=storage();store.setItem('finder:workspace-resume:v1:x','invalid json');
 assert.equal(readWorkspaceSession(store,'x'),null);
});

test('scan and report dialogs recover only for server-verified valid lines',()=>{
 const task={picking:{status:'active',paused:false},lines:[{selected:{sku:'A'},location:{code:'L1'},complete:false},{selected:{sku:'B'},location:{code:'L2'},complete:true}]};
 assert.deepEqual(resumeModal({modal:{type:'scan',index:0}},task),{type:'scan',index:0});
 assert.equal(resumeModal({modal:{type:'scan',index:1}},task),null);
 assert.equal(resumeModal({modal:{type:'scan',index:9}},task),null);
 assert.deepEqual(resumeModal({modal:{type:'report',index:0}},task),{type:'report',index:0,item:task.lines[0].selected,location:task.lines[0].location});
 task.picking.paused=true;
 assert.equal(resumeModal({modal:{type:'scan',index:0}},task),null);
 task.picking.paused=false;
 task.lines[0].location_report_open=true;
 assert.equal(resumeModal({modal:{type:'scan',index:0}},task),null);
});

test('warehouse refresh reloads the authoritative task and pauses voice for deliberate resumption',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(ui,/readWorkspaceSession\(sessionStorage,user\.id\)/);
 assert.match(ui,/request\('\/warehouse\/tasks\/'\+encodeURIComponent\(snapshot\.taskId\)\)/);
 assert.match(ui,/writeWorkspaceSession\(sessionStorage,user\.id/);
 assert.match(ui,/restoreReady\.current=true/);
 assert.match(ui,/VGP\(true\);SetModeListening\(false\);SetLookupVoicePaused\(true\)/);
 assert.match(ui,/D\(resumeModal\(snapshot,serverTask\)\)/);
 assert.match(ui,/if\(n!==generation\.current\)return/);
});
