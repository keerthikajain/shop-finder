import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {APP_LANGUAGES} from '../src/locale.js';
import {pickingUiCopy,pickingCommandLabel,pickingUiTip,reportUiCopy,reportUiTip,spokenYesNo} from '../src/voice-ui-copy.js';
import {pickVoicePhrase} from '../src/picking-voice-phrases.js';
import {pickConfirmationIntent} from '../src/picking-confirmations.js';
import {dialogueControl} from '../src/voice-review-commands.js';

test('Hindi app headings and command buttons stay Hindi when speech is Telugu',()=>{
 assert.match(pickingUiCopy('hi','heading'),/[\u0900-\u097f]/);
 assert.match(pickingUiTip('hi','available'),/[\u0900-\u097f]/);
 assert.equal(pickingCommandLabel('hi','verify'),'मिल गया');
 assert.equal(pickingCommandLabel('hi','help'),'मदद');
 assert.equal(pickVoicePhrase('te-IN','verify'),'దొరికింది');
 assert.equal(pickVoicePhrase('te-IN','help'),'సహాయం');
 assert.equal(dialogueControl('te-IN',pickVoicePhrase('te-IN','help')),'help');
 assert.notEqual(pickingUiCopy('hi','heading'),pickingUiCopy('te','heading'));
});

test('app language and speech language can be selected independently',()=>{
 for(const [app] of APP_LANGUAGES){
  for(const action of ['verify','report','repeat','next','stop','help']){
   assert.ok(pickingCommandLabel(app,action).trim(),app+': '+action);
  }
 }
 for(const voice of ['en-IN','hi-IN','hi-en','te-IN']){
  for(const action of ['verify','report','repeat','next','stop','help']){
   assert.ok(pickVoicePhrase(voice,action),voice+': '+action);
  }
 }
 assert.match(pickingUiCopy('te','heading'),/[\u0c00-\u0c7f]/);
 assert.match(pickingUiCopy('hi','recognized'),/[\u0900-\u097f]/);
 assert.equal(pickingUiCopy('en','recognized'),'You said');
});

test('spoken yes and no hints match the actual strict picking confirmation parser',()=>{
 for(const language of ['en-IN','hi-IN','hi-en','te-IN','kn-IN']){
  const [yes,no]=spokenYesNo(language);
  assert.equal(pickConfirmationIntent(language,yes),'yes',language+': yes');
  assert.equal(pickConfirmationIntent(language,no),'no',language+': no');
 }
});

test('report interface follows app locale without affecting language of submitted voice',()=>{
 assert.match(reportUiCopy('hi','guideStart'),/[\u0900-\u097f]/);
 assert.match(reportUiCopy('te','guideStart'),/[\u0c00-\u0c7f]/);
 assert.match(reportUiTip('hi','submit'),/[\u0900-\u097f]/);
 assert.match(reportUiTip('te','confirm'),/[\u0c00-\u0c7f]/);
});

test('picking UI displays exact voice phrases without replacing parser language',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(source,/appLanguage=useContext\(Locale\)/);
 assert.match(source,/pickingCommandLabel\(appLanguage,action\)/);
 assert.match(source,/pickVoicePhrase\(task\.language,action\)/);
 assert.match(source,/voicePickCommand\(pickVoicePhrase\(task\.language,action\)\)/);
 assert.match(source,/pickingUiTip\(appLanguage,'speakHint'\)/);
 assert.match(source,/pickingUiCopy\(appLanguage,'recognized'\)/);
 assert.match(source,/spokenYesNo\(task\.language\)/);
 assert.match(source,/dialogueControl\(source\.language,transcript\)/);
 assert.match(source,/pickConfirmationIntent\(source\.language,transcript\)/);
 assert.match(source,/language=\{task\.language\}/);
 assert.doesNotMatch(source,/\{pickVoicePhrase\(task\.language,'verify'\)\}<\/button>/);
});

test('owner guide UI follows app language while TTS and STT retain speech language',async()=>{
 const source=await readFile(new URL('../src/guided-voice-turn.jsx',import.meta.url),'utf8');
 assert.match(source,/const appLanguage=useContext\(Locale\)/);
 assert.match(source,/reportUiCopy\(appLanguage,key\)/);
 assert.match(source,/body:JSON\.stringify\(\{language/);
 assert.match(source,/dialogueControl\(language,transcript\)/);
 assert.match(source,/new URLSearchParams\(\{language/);
 assert.match(source,/\[active,disabled,stage,promptEndpoint,retryStep,language,cycle\]/);
});

test('responsive command labels and voice-language hints are both visible',async()=>{
 const css=await readFile(new URL('../src/product-polish.css',import.meta.url),'utf8');
 assert.match(css,/\.sf-voice-command-label/);
 assert.match(css,/\.sf-voice-command-phrase/);
 assert.match(css,/\.sf-voice-guide-choices button:disabled/);
});
