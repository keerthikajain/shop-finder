import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {lookupCopy} from '../src/lookup-mode-copy.js';
import {modeChoiceIntent} from '../src/lookup-mode.js';

test('the mode-choice transcript and interpreted result remain visible after selection',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/SetModeSpeechResult\(\{taskId:source\.id,transcript:String\(transcript\|\|''\)\.trim\(\),choice,language:source\.language\}\)/);
 assert.match(src,/modeSpeechResult\?\.taskId===task\.id/);
 assert.match(src,/modeSpeechResult\.transcript/);
 assert.match(src,/modeSpeechResult\.choice\?lookupCopy\(appLanguage,modeSpeechResult\.choice\):lookupCopy\(appLanguage,'notRecognizedChoice'\)/);
 assert.match(src,/data-voice-language=\{modeSpeechResult\.language\}/);
 assert.match(src,/SetModeSpeechResult\(null\);PV\(null\);VGC\(''\)/);
 assert.match(src,/modeChoiceIntent\(source\.language,transcript\)/);
});

test('Telugu diagnostic labels distinguish heard speech from interpretation',()=>{
 assert.equal(lookupCopy('te','heardChoice'),'గ్నాని విన్నది');
 assert.equal(lookupCopy('te','interpretedChoice'),'ఫైండర్ అర్థం చేసుకున్నది');
 assert.equal(lookupCopy('te','notRecognizedChoice'),'గుర్తించలేదు');
 assert.equal(lookupCopy('hi','heardChoice'),'ग्नानी ने सुना');
 assert.equal(modeChoiceIntent('te-IN','స్థానాలు మాత్రమే'),'locations');
 assert.equal(modeChoiceIntent('te-IN','సహాయం కావాలి'),'guided');
 assert.equal(modeChoiceIntent('te-IN','ఇది ఏమిటి'),null);
});