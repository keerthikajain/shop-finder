import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {modeChoiceIntent,modeChoicePhrases} from '../src/lookup-mode.js';

test('Telugu mode choice recognizes natural spoken replies and bounded STT variants',()=>{
 for(const phrase of ['పికింగ్ సహాయం','సహాయం కావాలి','పికింగ్ సహాయం కావాలి','వస్తువులు తీసుకోవడానికి సహాయం కావాలి','గైడెడ్ పికింగ్','పికింగ్ సహాయం కావాలీ','picking sahayam kavali','picking lo help kavali','पिकिंग में मदद चाहिए']){
  assert.equal(modeChoiceIntent('te-IN',phrase),'guided',phrase);
 }
 for(const phrase of ['స్థానాలు మాత్రమే','స్థానాలు మాత్రమే చెప్పండి','లొకేషన్ మాత్రమే','లొకేషన్ మాత్రమే చెప్పండి','స్థానాలు మాత్రమె','జస్ట్ లొకేషన్స్','just locations','locations matrame','location matrame cheppandi','सिर्फ लोकेशन']){
  assert.equal(modeChoiceIntent('te-IN',phrase),'locations',phrase);
 }
});

test('Telugu mode choice rejects mixed, negated, consequential or unrelated speech',()=>{
 for(const phrase of ['పికింగ్ వద్దు','స్థానాలు మాత్రమే కాదు','సహాయం కావాలి కానీ స్థానాలు మాత్రమే','yes','found it','wrong location','confirm','పికింగ్ ప్రారంభించండి మరియు స్టాక్ మార్చు','just locations and confirm']){
  assert.equal(modeChoiceIntent('te-IN',phrase),null,phrase);
 }
});

test('The Telugu prompt and microphone use the search task voice locale',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const backend=await readFile(new URL('../../backend/app/warehouse.py',import.meta.url),'utf8');
 assert.match(ui,/playFixedVoice\('choose_mode',next\.language,true,true\)/);
 assert.match(ui,/modeChoiceIntent\(source\.language,transcript\)/);
 assert.match(ui,/language=\{task\.language\} collection=\{collection\} onError=\{E\} onCommand=\{text=>handleModeSpeech\(text\)\}/);
 assert.match(backend,/పికింగ్ సహాయం కావాలి అనండి/);
 assert.equal(modeChoicePhrases('te-IN').locations,'స్థానాలు మాత్రమే');
});