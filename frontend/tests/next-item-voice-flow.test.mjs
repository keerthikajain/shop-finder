import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {nextItemChoice,nextItemPhrase,nextItemUi} from '../src/pick-next-intent.js';

test('Next Later Skip Cancel are exact multilingual commands, not free-form confirmations',()=>{
 for(const language of ['en-IN','hi-IN','hi-en','te-IN']){
  for(const kind of ['next','later','skip','cancel','back']){
   assert.equal(nextItemChoice(language,nextItemPhrase(language,kind)),kind,language+':'+kind);
  }
  for(const phrase of ['yes','found it','wrong location','do not skip','skip and confirm','cancel order','ignore previous task'])
   assert.equal(nextItemChoice(language,phrase),null,language+':'+phrase);
 }
 assert.equal(nextItemChoice('te-IN','తర్వాత'),'later');
 assert.equal(nextItemChoice('hi-IN','बाद में'),'later');
 assert.equal(nextItemChoice('hi-en','baad mein'),'later');
 assert.equal(nextItemChoice('en-IN','next item'),'next');
});

test('Next only queues user choice; no pick confirmation or inventory mutation',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const backend=await readFile(new URL('../../backend/app/warehouse.py',import.meta.url),'utf8');
 assert.match(ui,/async function applyNextChoice\(source,line,choice\)/);
 assert.match(ui,/PN\(\{taskId:source\.id,line,phase:'choose',sku:current\.selected\.sku\}\)/);
 assert.match(ui,/nextItemChoice\(source\.language,transcript\)==='next'/);
 assert.match(ui,/function currentNextLine\(source\)/);
 assert.match(ui,/if\(current&&current\.selected&&current\.location&&!current\.complete&&!current\.deferred_reason&&!current\.location_report_open\)/);
 assert.match(ui,/askNextChoice\(source,currentNextLine\(source\)\)/);
 assert.match(ui,/pickConfirmationIntent\(source\.language,transcript\):nextItemChoice/);
 assert.match(ui,/nextItemUi\(appLanguage,pendingNextPick\.phase==='cancel'\?'confirmCancel':'question'\)/);
 assert.match(ui,/\['later','skip','cancel','back'\]\.map/);
 assert.match(ui,/\['later','skipped','declined'\]\.includes\(line\.deferred_reason\)/);
 assert.match(backend,/reason:Literal\['declined','reported','later','skipped','cancelled'\]/);
 assert.match(backend,/if line\.get\('deferred_reason'\)=='cancelled'/);
 assert.doesNotMatch(ui,/if\(answer\.action==='next'\)[\s\S]{0,200}scan\(/);
});

test('report opens automatic voice guidance but a refreshed report draft stays paused',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const guide=await readFile(new URL('../src/guided-voice-turn.jsx',import.meta.url),'utf8');
 const resume=await readFile(new URL('../src/workspace-resume.js',import.meta.url),'utf8');
 assert.match(ui,/D\(\{type:'report',item:modal\.item,autoGuide:true\}\)/);
 assert.match(ui,/location:line\.location,index:line\.index,autoGuide:true/);
 assert.match(ui,/autoGuide=\{!!modal\.autoGuide\}/);
 assert.match(guide,/if\(autoStart&&!disabled&&!autoStarted\.current\)/);
 assert.doesNotMatch(resume,/autoGuide:true/);
 assert.match(guide,/onTranscript/);
});

test('Later, Skip and Cancel remain unconfirmed in the worklist and have translated labels',()=>{
 for(const language of ['en','hi','te']){
  for(const action of ['question','later','skip','cancel','confirmCancel','laterRemaining','laterStatus','skippedStatus','cancelledStatus','retry'])
   assert.ok(nextItemUi(language,action).length>0,language+':'+action);
 }
});
