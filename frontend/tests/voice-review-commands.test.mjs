import test from 'node:test';
import assert from 'node:assert/strict';
import {actionPhrases,voiceAction,reviewVoiceChoice} from '../src/voice-review-commands.js';

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
