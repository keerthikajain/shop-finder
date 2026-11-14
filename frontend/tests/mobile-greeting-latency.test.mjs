import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {playWelcomeOnce,resumeWelcome,stopWelcome} from '../src/welcome-audio.js';

test('blocked mobile autoplay keeps Gnani audio and resumes on a direct gesture without another request',async()=>{
 const oldFetch=globalThis.fetch,oldAudio=globalThis.Audio;
 const oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL;
 let calls=0,plays=0,revokes=0;
 try{
  globalThis.fetch=async()=>{calls++;return {ok:true,blob:async()=>new Blob(['RIFF'])}};
  URL.createObjectURL=()=> 'blob:gnani-test';
  URL.revokeObjectURL=()=>{revokes++};
  globalThis.Audio=class{
   constructor(){this.onended=null;this.onerror=null}
   play(){plays++;return plays===1?Promise.reject(Object.assign(new Error('autoplay blocked'),{name:'NotAllowedError'})):Promise.resolve()}
   pause(){}
  };
  const controller=new AbortController();
  const playback={controller,audio:null,url:null,blocked:false,finished:false};
  const result=await playWelcomeOnce({
   url:'/api/voice/welcome',language:'en-IN',text:'Welcome',
   controller,playback,body:{language:'en-IN',hour:9},gnaniOnly:true
  });
  assert.equal(result,'blocked');
  assert.equal(playback.blocked,true);
  assert.equal(calls,1);
  assert.equal(resumeWelcome(playback),true);
  await Promise.resolve();
  assert.equal(calls,1);
  assert.equal(plays,2);
  assert.equal(playback.blocked,false);
  stopWelcome(playback);
  assert.equal(controller.signal.aborted,true);
  assert.equal(revokes,1);
  assert.equal(resumeWelcome(playback),false);
 }finally{
  globalThis.fetch=oldFetch;globalThis.Audio=oldAudio;
  URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;
 }
});

test('mobile recovery is limited to safe page interactions and keeps voice-workflow interruption',async()=>{
 const src=await readFile(new URL('../src/workspace-greeting.jsx',import.meta.url),'utf8');
 assert.match(src,/if\(interrupt\)return/);
 assert.match(src,/if\(interrupt\)stopGreeting\(\)/);
 assert.match(src,/if\(interactive\)\{stopGreeting\(\);return\}/);
 assert.match(src,/if\(playback\.blocked\)\{resumeWelcome\(playback\);return\}/);
 assert.match(src,/document\.addEventListener\('pointerdown',yieldToUser,true\)/);
 assert.doesNotMatch(src,/Hear greeting|Play greeting|Stop greeting/);
});

test('voice latency measurements are anonymous and bounded to an in-memory list',async()=>{
 const src=await readFile(new URL('../src/voice-performance.js',import.meta.url),'utf8');
 const guide=await readFile(new URL('../src/hands-free-picking.jsx',import.meta.url),'utf8');
 const workspace=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/const MAX_SAMPLES=60/);
 assert.match(src,/speech-end-to-transcript|recordVoiceTiming/);
 assert.doesNotMatch(src,/fetch\(|localStorage|sessionStorage|transcript:/);
 assert.match(guide,/recordVoiceTiming\('speech-end-to-transcript',transcriptionStart\)/);
 assert.match(guide,/noteVoiceRecognized\(\)/);
 assert.match(workspace,/recordVoiceTiming\('picking-audio-ready',ttsStart\)/);
 assert.match(workspace,/noteVoiceResponseStarted\(\)/);
});
