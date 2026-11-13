import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pickingCopy} from '../src/picking-copy.js';
import {pickVoicePhrase,isStartPickingCommand} from '../src/picking-voice-phrases.js';
import {pickConfirmationIntent} from '../src/picking-confirmations.js';
import {voiceAction,dialogueControl} from '../src/voice-review-commands.js';

const keys=['heading','active','ready','paused','listening','speaking','confirmed',
 'askYesNo','help','picked','progress','read','stopAudio','listen','resume','stop',
 'current','recognized','helpButton','secondary','undo','sayUndo','pause',
 'resumePicking','next','finish','stopped','noConfirm','verify','noMic',
 'yesPicked','noNext','retry','transcribing','noConfirmedUndo','backConfirm',
 'backItem','declined','unknown','reportHandoff','stopSaved'];

test('Hinglish and Telugu cover every picking message without English fallbacks',()=>{
 for(const lang of ['hi-en','te-IN']){
  for(const key of keys){
   const value=pickingCopy(lang,key);
   assert.ok(value && value!==key,lang+' '+key);
   assert.notEqual(value,pickingCopy('en-IN',key),lang+' '+key);
  }
 }
 assert.match(pickingCopy('hi-en','verify'),/haan/i);
 assert.match(pickingCopy('te-IN','verify'),/అవును/);
});

test('Hinglish examples, Telugu controls and confirmation grammar agree',()=>{
 assert.equal(pickVoicePhrase('hi-en','verify'),'mil gaya');
 assert.equal(pickVoicePhrase('hi-en','report'),'galat jagah');
 assert.equal(pickVoicePhrase('hi-en','repeat'),'location dobara batao');
 assert.equal(pickVoicePhrase('hi-en','next'),'agla item');
 assert.equal(pickConfirmationIntent('hi-en','haan'),'yes');
 assert.equal(pickConfirmationIntent('hi-en','nahi'),'no');
 assert.equal(pickConfirmationIntent('hi-en','हाँ'),'yes');
 assert.equal(pickVoicePhrase('te-IN','verify'),'దొరికింది');
 assert.equal(pickConfirmationIntent('te-IN','అవును'),'yes');
 assert.equal(pickConfirmationIntent('te-IN','కాదు'),'no');
 assert.equal(pickConfirmationIntent('te-IN','yes'),'unknown');
 assert.equal(isStartPickingCommand('hi-en','picking shuru karo'),true);
 assert.equal(isStartPickingCommand('te-IN','పికింగ్ ప్రారంభించండి'),true);
 assert.equal(isStartPickingCommand('te-IN','yes'),false);
});

test('Critical spoken actions require exact commands and preserve Stop',()=>{
 for(const lang of ['hi-en','te-IN']){
  assert.equal(dialogueControl(lang,lang==='hi-en'?'ruko':'ఆపు'),'stop');
  assert.equal(dialogueControl(lang,lang==='hi-en'?'help':'సహాయం'),'help');
  assert.equal(voiceAction(lang,'undo',lang==='hi-en'?'last pick undo karo':'చివరి నిర్ధారణ రద్దు చేయి'),true);
  assert.equal(voiceAction(lang,'move',lang==='hi-en'?'confirm location change':'కొత్త స్థానం నిర్ధారించు'),true);
  assert.equal(voiceAction(lang,'move','maybe changed shelf'),false);
 }
});

test('Picking workflow uses same next-item handoff in Hinglish and Telugu',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const recorder=await readFile(new URL('../src/hands-free-picking.jsx',import.meta.url),'utf8');
 assert.ok(src.includes("if(voice&&handsFree&&auto&&!voiceFlowStopped.current&&!next.picking?.paused)VGP(false)"));
 assert.ok(src.includes("if(voice&&auto&&!voiceFlowStopped.current)await playPickGuidance('next',next,index)"));
 assert.ok(src.includes("VGT(pickingUiCopy(appLanguage,'confirmed'))"));
 assert.ok(src.includes("pickingUiCopy(appLanguage,'yesPicked')"));
 assert.ok(src.includes("pickingUiCopy(appLanguage,'noNext')"));
 assert.ok(src.includes("pickingUiCopy(appLanguage,'reportHandoff')"));
 assert.ok(recorder.includes("status==='transcribing'?uiText('transcribing')"));
 assert.ok(recorder.includes("appLanguage?pickingUiCopy(appLanguage,key):pickingCopy(language,key)"));
 assert.ok(recorder.includes(">{pickingCopy(language,'retry')}</button>"));
});
