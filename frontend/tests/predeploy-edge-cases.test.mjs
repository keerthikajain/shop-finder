import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {reportSubmitCommand,unclearReportSubmit,voiceAction} from '../src/voice-review-commands.js';

test('recording cancellation prevents late transcripts after navigating or switching languages',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(source,/if\(state==='processing'\)\{/);
 assert.match(source,/generation\.current\+\+;transcription\.current\?\.abort\(\)/);
 assert.match(source,/if\(turn===generation\.current&&!controller\.signal\.aborted\)onText/);
 assert.match(source,/\},\[language,collection\]\)/);
 assert.match(source,/disabled=\{\(!stopping&&!enabled\)\|\|state==='starting'\}/);
});
test('guided voice cancels pending narration and recognition when locale or step changes',async()=>{
 const src=await readFile(new URL('../src/guided-voice-turn.jsx',import.meta.url),'utf8');
 assert.match(src,/controller\.abort\(\)/);
 assert.match(src,/recorder\?\.stop\(true\)/);
 assert.match(src,/\[active,disabled,stage,promptEndpoint,retryStep,language,cycle\]/);
 assert.match(src,/reportUiCopy\(appLanguage,key\)/);
});
test('consequential voice commands do not accept approximate or contradictory commands',()=>{
 for(const language of ['en-IN','hi-IN','hi-en','te-IN']){
  assert.equal(reportSubmitCommand(language,'random nonsense'),false);
  assert.equal(voiceAction(language,'move','change shelf maybe'),false);
  assert.equal(voiceAction(language,'review','save anything'),false);
  assert.equal(voiceAction(language,'move','stop'),false);
 }
});
test('reports and picking use explicit server persistence rather than local optimistic confirmation',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const backend=await readFile(new URL('../../backend/app/warehouse.py',import.meta.url),'utf8');
 assert.match(ui,/request\('\/warehouse\/tasks\/'.*?\)/s);
 assert.match(ui,/submittedRef\.current=true/);
 assert.match(backend,/def task_get\(c,tid,u\)/);
 assert.match(backend,/stale_catalogue/);
 assert.match(backend,/BEGIN IMMEDIATE/);
});


test('unfinished report drafts can be restored after refresh without auto-submission',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/sessionStorage\.getItem\(draftKey\)/);
 assert.match(src,/sessionStorage\.setItem\(draftKey/);
 assert.match(src,/sessionStorage\.removeItem\(draftKey\)/);
 assert.match(src,/userId=\{user\.id\}/);
 assert.match(src,/submittedRef\.current=true/);
 assert.match(src,/if\(submittedRef\.current\)return true/);
});


test('hands-free picking aborts previous speech request on Stop or language change',async()=>{
 const src=await readFile(new URL('../src/hands-free-picking.jsx',import.meta.url),'utf8');
 assert.match(src,/const transcription=new AbortController\(\)/);
 assert.match(src,/signal:transcription\.signal/);
 assert.match(src,/cancelled=true;transcription\.abort\(\)/);
 assert.match(src,/\[enabled,language,collection,cycle,halted\]/);
});


test('report retry keeps one request identity until a confirmed save',async()=>{
 const client=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const server=await readFile(new URL('../../backend/app/warehouse.py',import.meta.url),'utf8');
 assert.match(client,/draft\?\.request_id/);
 assert.match(client,/request_id:requestId/);
 assert.match(server,/body\.request_id/);
 assert.match(server,/wh_issue_request_unique/);
 assert.match(server,/already_reported/);
});
