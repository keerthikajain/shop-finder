import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pickingCopy} from '../src/picking-copy.js';
import {pickConfirmationIntent} from '../src/picking-confirmations.js';
import {pickVoicePhrase} from '../src/picking-voice-phrases.js';

test('Hindi picking panel uses Hindi instructions at each stage, not English account copy',()=>{
 for(const key of ['heading','ready','active','paused','listening','speaking','confirmed','askYesNo','help','current','read','resume','stop','undo','finish','noMic']){
  const hi=pickingCopy('hi-IN',key),en=pickingCopy('en-IN',key);
  assert.ok(hi&&hi!==en,key);
  assert.match(hi,/[^\u0000-\u007f]/,key);
 }
 assert.equal(pickConfirmationIntent('hi-IN','हाँ'),'yes');
 assert.equal(pickConfirmationIntent('hi-IN','नहीं'),'no');
 assert.equal(pickVoicePhrase('hi-IN','verify'),'मिल गया');
 assert.equal(pickVoicePhrase('hi-IN','report'),'गलत जगह');
});

test('Hindi confirmation resumes the next guided item except after an explicit Stop',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.ok(source.includes("if(voice&&handsFree&&auto&&!voiceFlowStopped.current&&!next.picking?.paused)VGP(false)"));
 assert.ok(source.includes("if(voice&&auto&&!voiceFlowStopped.current)await playPickGuidance('next',next,index)"));
 assert.ok(source.includes("VGT(pickingUiCopy(appLanguage,'confirmed'))"));
 assert.ok(source.includes("onError={message=>{E(message)}} onCommand={transcript=>voicePickCommand(transcript)}"));
 assert.ok(source.includes("if(control==='stop'){PV(null);stopVoiceFlow()"));
 assert.ok(source.includes("VGP(true);PV(null);PN(null);AL(0)"));
});

test('HandsFreePicking pauses safely on errors and limits silence loops',async()=>{
 const source=await readFile(new URL('../src/hands-free-picking.jsx',import.meta.url),'utf8');
 assert.ok(source.includes('silenceRef=useRef(0)'));
 assert.ok(source.includes('silenceRef.current++<2')||source.includes('silenceRef.current<2'));
 assert.ok(source.includes('shouldContinue=false;stopWithError'));
 assert.ok(source.includes('stopWithError(pickingCopy(language,\'noMic\'))'));
 assert.ok(source.includes("onClick={()=>{silenceRef.current=0;Halt(false);Next(n=>n+1)}}"));
 assert.ok(source.includes("recorder?.stop(true)"));
});

test('Picking controls remain manual and more readable without hiding Hindi commands',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/product-polish.css',import.meta.url),'utf8');
 assert.ok(ui.includes('className="sf-voice-guide-choices"'));
 assert.ok(ui.includes("['verify','report','next'].map(action"));
  assert.ok(ui.includes('className="sf-voice-guide-secondary"'));
 assert.ok(ui.includes('pickingUiCopy(appLanguage,\'recognized\')'));
 assert.ok(ui.includes("pickPaused||voiceGuidePaused?'paused':speaking?'speaking':'listening'"));
 assert.ok(ui.includes('pickVoicePhrase(task.language,action)'));
 assert.ok(ui.includes('pickingCommandLabel(appLanguage,action)'));
 assert.ok(ui.includes('sf-voice-command-label'));
 assert.ok(css.includes('.sf-compact-app .sf-voice-guide-choices button'));
 assert.ok(css.includes('min-height:42px'));
 assert.ok(css.includes('button:focus-visible'));
});


test('Help button speaks when auto voice guide is paused without resuming microphone',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(ui,/if\(control==='help'\)\{[\s\S]*?playPickGuidance\('help',source,pendingVoicePick\?\.line\?\?activeLine,true\)/);
 assert.match(ui,/if\(!voice\|\|!source\|\|\(!manual&&voiceFlowStopped\.current\)\)return;/);
 assert.match(ui,/if\(source\.picking\?\.paused&&control!=='help'\)return;/);
 assert.match(ui,/if\(control==='stop'\)\{PV\(null\);stopVoiceFlow\(\)/);
 assert.doesNotMatch(ui,/if\(voice&&!voiceFlowStopped\.current\)await playPickGuidance\('help'/);
});
