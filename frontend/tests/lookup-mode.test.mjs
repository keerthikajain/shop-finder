import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {modeChoiceIntent,lookupVoiceIntent,modeChoicePhrases} from '../src/lookup-mode.js';
import {LOOKUP_UI,lookupCopy} from '../src/lookup-mode-copy.js';
import {APP_LANGUAGES} from '../src/locale.js';

test('four voice languages can select guided picking or locations without starting a pick',()=>{
 const cases=[
  ['en-IN','help me pick','just locations'],
  ['hi-IN','पिकिंग में मदद','सिर्फ जगह'],
  ['hi-en','picking mein help','sirf location'],
  ['te-IN','పికింగ్ సహాయం','స్థానాలు మాత్రమే']
 ];
 for(const [language,guided,locations] of cases){
  assert.equal(modeChoiceIntent(language,guided),'guided',language);
  assert.equal(modeChoiceIntent(language,locations),'locations',language);
  assert.equal(modeChoiceIntent(language,locations+' and confirm'),null,language);
  assert.equal(modeChoiceIntent(language,'yes'),null,language);
  assert.equal(modeChoiceIntent(language,'wrong location'),null,language);
  assert.ok(modeChoicePhrases(language).guided);
  assert.ok(modeChoicePhrases(language).locations);
 }
});

test('lookup voice navigation is forgiving for known mixed-script requests but not arbitrary approvals',()=>{
 const languages=[
  ['en-IN','found it','wrong location','repeat location'],
  ['hi-IN','मिल गया','गलत जगह','जगह दोहराओ'],
  ['hi-en','mil gaya','galat jagah','location दोबारा बताओ'],
  ['te-IN','దొరికింది','तप्पु स्थानम','location दोबारा बताओ']
 ];
 for(const [language,found,wrong,repeat] of languages){
  assert.equal(lookupVoiceIntent(language,found).action,'verify');
  assert.equal(lookupVoiceIntent(language,wrong).action,'report');
  assert.equal(lookupVoiceIntent(language,repeat).action,'repeat');
  assert.equal(lookupVoiceIntent(language,'yes but no').action,'unknown');
  assert.equal(lookupVoiceIntent(language,'please save shelf immediately').action,'unknown');
  assert.equal(lookupVoiceIntent(language,'report and confirm picked').action,'unknown');
 }
});

test('a voice selection must identify an exact SKU or an explicit valid item number',()=>{
 const lines=[{selected:{sku:'APP-004'}},{selected:{sku:'APP-008'}}];
 assert.deepEqual(lookupVoiceIntent('en-IN','item 2',lines),{action:'select',line:1});
 assert.deepEqual(lookupVoiceIntent('en-IN','APP-004',lines),{action:'select',line:0});
 assert.deepEqual(lookupVoiceIntent('hi-en','item 1',lines),{action:'select',line:0});
 assert.deepEqual(lookupVoiceIntent('te-IN','వస్తువు 2',lines),{action:'select',line:1});
 assert.deepEqual(lookupVoiceIntent('en-IN','item one',lines),{action:'select',line:0});
 assert.deepEqual(lookupVoiceIntent('hi-IN','आइटम दो',lines),{action:'select',line:1});
 assert.deepEqual(lookupVoiceIntent('hi-en','item two',lines),{action:'select',line:1});
 assert.deepEqual(lookupVoiceIntent('te-IN','ఐటెమ్ ఒకటి',lines),{action:'select',line:0});
 assert.deepEqual(lookupVoiceIntent('te-IN','ఐటెమ్ రెండు',lines),{action:'select',line:1});
 assert.equal(lookupVoiceIntent('en-IN','item 3',lines).action,'unknown');
 assert.equal(lookupVoiceIntent('en-IN','APP-009',lines).action,'unknown');
 assert.equal(lookupVoiceIntent('en-IN','rice cooker',lines).action,'unknown');
 const sameSkuInTwoCatalogues=[{selected:{collection:'appliances',sku:'SHARED-01'}},{selected:{collection:'grocery',sku:'SHARED-01'}}];
 assert.equal(lookupVoiceIntent('en-IN','SHARED-01',sameSkuInTwoCatalogues).action,'unknown');
});

test('all ten app languages have separate interface copy',()=>{
 const keys=Object.keys(LOOKUP_UI.en);
 for(const [language] of APP_LANGUAGES){
  for(const key of keys)assert.ok(lookupCopy(language,key),language+':'+key);
 }
 assert.equal(lookupCopy('hi','locations'),'सिर्फ जगह देखें');
 assert.equal(lookupCopy('en','guided'),'Guided picking');
 assert.equal(lookupCopy('te','locations'),'స్థానాలు మాత్రమే');
});

test('voice mode prompt and spoken location readback use bounded server generated Gnani audio',async()=>{
 const backend=await readFile(new URL('../../backend/app/warehouse.py',import.meta.url),'utf8');
 assert.match(backend,/'choose_mode':\(/);
 assert.match(backend,/'lookup_confirm':\(/);
 assert.match(backend,/'lookup_picked_saved':\(/);
 assert.match(backend,/lookup-line-audio\/\{index\}/);
 assert.match(backend,/line,item=current_line\(c,task,index\)/);
 assert.match(backend,/voice\.speak\(speech_text,task\['language'\]\)/);
});

test('search choice does not start picking; locations mode offers explicit confirmation and reporting',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(ui,/void offerSearchMode\(result\)/);
 assert.match(ui,/picking\.status==='ready'&&lookupMode==='choice'/);
 assert.match(ui,/modeChoiceIntent\(source\?\.language\|\|language,transcript\)/);
 assert.match(ui,/chooseSearchMode\('locations'\)/);
 assert.match(ui,/if\(choice==='guided'\)/);
 assert.match(ui,/await pickAction\('start'\)/);
 assert.match(ui,/SetLookupMode\('locations'\)/);
 assert.match(ui,/next=await api\('\/tasks\/'\+source\.id\+'\/scan',\{line:pending\.line,kind:'manual',value:'confirmed'\}\)/);
 assert.match(ui,/value:'confirmed'/);
 assert.match(ui,/SetLookupPendingSafe\(\{taskId:source\.id,line:index,sku:line\.selected\.sku\}\)/);
 assert.match(ui,/task\.lines\[lookupPending\.line\]/);
 assert.match(ui,/reportLookupLocation\(\)/);
 assert.match(ui,/autoGuide=\{!!modal\.autoGuide\}/);
});

test('voice-triggered reports auto-start existing guided review without implicit submission',async()=>{
 const form=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const voice=await readFile(new URL('../src/guided-voice-turn.jsx',import.meta.url),'utf8');
 assert.match(form,/D\(\{type:'report',item:line\.selected,location:line\.location,index,autoGuide:true\}\)/);
 assert.match(voice,/if\(autoStart&&!disabled&&!autoStarted\.current\)/);
 assert.match(form,/const saved=await submitReport\(\)/);
 assert.match(form,/return saved\?false:'retry'/);
});

test('locations mode never starts handsfree picking without an explicit choice',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(ui,/lookupMode==='locations'/);
 assert.match(ui,/lookupVoicePaused/);
 assert.match(ui,/lookupSelection==null/);
 assert.match(ui,/SetLookupSelection\(options\.length===1\?options\[0\]\.index:null\)/);
 assert.match(ui,/location_report_open/);
 assert.match(ui,/lookupVoiceIntent\(source\.language,transcript,source\.lines\)/);
});


test('speech listener displays status in app language while recognizing the selected voice language',async()=>{
 const component=await readFile(new URL('../src/hands-free-picking.jsx',import.meta.url),'utf8');
 const parent=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(component,/appLanguage=null/);
 assert.match(component,/appLanguage\?pickingUiCopy\(appLanguage,key\):pickingCopy\(language,key\)/);
 const callSites=parent.match(/<HandsFreePicking appLanguage=\{appLanguage\}/g)||[];
 assert.equal(callSites.length,3);
 assert.match(parent,/language=\{task\.language\}/);
});
test('when a pick is awaiting confirmation, the user cannot silently switch products',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(ui,/disabled=\{busy\|\|!!lookupPending\} aria-pressed=\{lookupSelection===index\}/);
 assert.match(ui,/if\(!pending\|\|!source\|\|pending\.taskId!==source\.id\)return false/);
 assert.match(ui,/line\.selected\?\.sku!==pending\.sku/);
});
test('lookup correction and stock changes still require the existing permissions',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(ui,/\{owner&&<button type="button" disabled=\{busy\} onClick=\{\(\)=>D\(\{type:'move'/);
 assert.match(ui,/\{\(owner\|\|meta\?\.settings\?\.staff_stock\)&&<button/);
 assert.match(ui,/autoGuide:true/);
 assert.match(ui,/lookupVoicePaused/);
});
