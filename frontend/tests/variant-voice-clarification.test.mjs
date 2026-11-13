import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('variant clarification runs before mode selection and retains manual choice',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(ui,/!line\.selected&&line\.candidates\?\.length>1/);
 assert.match(ui,/line\.index===firstVoiceClarification/);
 assert.match(ui,/VariantVoiceClarifier/);
 assert.match(ui,/api\('\/tasks\/'\+task\.id\+'\/clarify'/);
 assert.match(ui,/if\(next\.lines\.every\(x=>x\.selected&&x\.location\)\)pendingModePrompt\.current=next\.id/);
 assert.match(ui,/<Clarification key=/);
});

test('spoken clarification does not save a pick or select a guessed SKU',async()=>{
 const src=await readFile(new URL('../src/variant-voice-clarifier.jsx',import.meta.url),'utf8');
 assert.match(src,/clarification-audio/);
 assert.match(src,/voice\/transcribe/);
 assert.match(src,/await callback\.current\(text\)/);
 assert.match(src,/recorder\?\.stop\(true\)/);
 assert.doesNotMatch(src,/\/scan|\/picking\/start|\/items\b/);
 assert.match(src,/Manual\(true\)/);
});

test('recorded speech allows 1350ms pauses to capture full phrases',async()=>{
 const src=await readFile(new URL('../src/recording.js',import.meta.url),'utf8');
 assert.match(src,/heardSpeech&&now-lastSpeech>1350&&now-startedAt>800/);
 assert.match(src,/if\(speechFrames>=3\)heardSpeech=true/);
});
