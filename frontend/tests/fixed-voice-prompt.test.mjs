import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixedVoicePrompt} from '../src/fixed-voice-prompt.js';

test('repeating identical fixed guidance makes only one network synthesis request',async()=>{
 const previous=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response(new Blob(['audio-wave']),{status:200})};
 try{
  const first=await fixedVoicePrompt('help_pick','en-IN');
  const second=await fixedVoicePrompt('help_pick','en-IN');
  assert.equal(calls,1);
  assert.strictEqual(first,second);
 }finally{globalThis.fetch=previous}
});

test('the same prompt in different speech languages is not shared',async()=>{
 const previous=globalThis.fetch;
 const requests=[];
 globalThis.fetch=async(_url,options)=>{requests.push(JSON.parse(options.body).language);return new Response(new Blob(['audio']),{status:200})};
 try{
  await fixedVoicePrompt('pick_undo','en-IN');
  await fixedVoicePrompt('pick_undo','hi-IN');
  await fixedVoicePrompt('pick_undo','te-IN');
  assert.deepEqual(requests,['en-IN','hi-IN','te-IN']);
 }finally{globalThis.fetch=previous}
});

test('aborted playback does not cache a response or reuse cancelled audio',async()=>{
 const previous=globalThis.fetch;
 const controller=new AbortController();
 let calls=0;
 globalThis.fetch=async()=>{calls++;controller.abort();return new Response(new Blob(['audio']),{status:200})};
 try{
  await assert.rejects(fixedVoicePrompt('unknown_pick','en-IN',{signal:controller.signal}),{name:'AbortError'});
  const second=new AbortController();
  globalThis.fetch=async()=>{calls++;return new Response(new Blob(['audio']),{status:200})};
  await fixedVoicePrompt('unknown_pick','en-IN',{signal:second.signal});
  assert.equal(calls,2);
 }finally{globalThis.fetch=previous}
});

test('server errors are not cached or mistaken for successful audio',async()=>{
 const previous=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({detail:'Temporary voice outage'}),{status:503,headers:{'Content-Type':'application/json'}})};
 try{
  await assert.rejects(fixedVoicePrompt('review_note_retry','en-IN'),/Temporary voice outage/);
  await assert.rejects(fixedVoicePrompt('review_note_retry','en-IN'),/Temporary voice outage/);
  assert.equal(calls,2);
 }finally{globalThis.fetch=previous}
});

test('dynamic report readbacks stay uncached and the guide respects stop',async()=>{
 const src=await readFile(new URL('../src/guided-voice-turn.jsx',import.meta.url),'utf8');
 const app=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/if\(!promptEndpoint\|\|short\)/);
 assert.match(src,/blob=await response\.blob\(\)/);
 assert.match(src,/controller\.abort\(\)/);
 assert.match(src,/if\(cancelled\)return/);
 assert.match(app,/fixedVoicePrompt\(step,spokenLanguage,/);
 assert.match(app,/if\(serial!==playbackSerial\.current\)return/);
});
