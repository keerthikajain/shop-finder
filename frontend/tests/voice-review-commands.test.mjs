import test from 'node:test';
import assert from 'node:assert/strict';
import {actionPhrases,voiceAction,reviewVoiceChoice,dialogueControl} from '../src/voice-review-commands.js';

test('explicit spoken undo works across release voice languages',()=>{
 for(const language of ['en-IN','hi-IN','hi-en','te-IN']){
  const phrase=actionPhrases(language,'undo')[0];
  assert.ok(phrase);
  assert.equal(voiceAction(language,'undo',phrase),true);
  assert.equal(voiceAction(language,'undo',phrase+' please'),false);
  assert.equal(voiceAction(language,'undo','found it'),false);
 }
});

test('verification outcome selection is strict and never resolves by itself',()=>{
 for(const language of ['en-IN','hi-IN','hi-en','te-IN']){
  assert.equal(reviewVoiceChoice(language,actionPhrases(language,'original')[0]),'confirmed_original');
  assert.equal(reviewVoiceChoice(language,actionPhrases(language,'unconfirmed')[0]),'unconfirmed');
  assert.equal(reviewVoiceChoice(language,'rack B shelf 2'),null);
  assert.equal(reviewVoiceChoice(language,actionPhrases(language,'cancel')[0]),'cancel');
 }
});

test('review saving and moving require distinct explicit phrases',()=>{
 for(const language of ['en-IN','hi-IN','hi-en','te-IN']){
  assert.equal(voiceAction(language,'move',actionPhrases(language,'review')[0]),false);
  assert.equal(voiceAction(language,'review',actionPhrases(language,'move')[0]),false);
  assert.equal(voiceAction(language,'move',actionPhrases(language,'move')[0]),true);
  assert.equal(voiceAction(language,'review',actionPhrases(language,'review')[0]),true);
 }
});

test('speech punctuation and whitespace do not change an exact command',()=>{
 assert.equal(voiceAction('en-IN','undo','  Undo last confirmation!  '),true);
 assert.equal(voiceAction('en-IN','undo','please undo last confirmation'),false);
 assert.equal(voiceAction('en-IN','move','confirm location change and delete everything'),false);
});


test('normal phrasing and mixed Telugu Hindi scripts work for safe voice controls',()=>{
 for(const [lang,phrase,expected] of [
  ['te-IN','location दोबारा बताओ','repeat'],
  ['te-IN','लोकेशन दोबारा बताओ।','repeat'],
  ['te-IN','location మళ్లీ చెప్పండి','repeat'],
  ['hi-en','location दोबारा बताओ','repeat'],
  ['hi-IN','लोकेशन दोबारा बताओ','repeat'],
  ['te-IN','హెల్ప్','help'],
  ['hi-IN','हेल्प','help'],
  ['te-IN','స్టాప్','stop']
 ]){
  assert.equal(dialogueControl(lang,phrase),expected,lang+': '+phrase);
 }
});

test('no approximate owner approval or untrusted extra speech is executed',()=>{
 for(const lang of ['en-IN','hi-IN','hi-en','te-IN']){
  for(const phrase of ['please confirm location change and delete all','confirm review maybe','yes but no','report it and save','location दोबारा बताओ and confirm']){
   assert.equal(voiceAction(lang,'move',phrase),false);
   assert.equal(voiceAction(lang,'review',phrase),false);
   assert.equal(voiceAction(lang,'report_send',phrase),false);
  }
 }
 assert.equal(dialogueControl('te-IN','location दोबारा बताओ and confirm'),null);
});
