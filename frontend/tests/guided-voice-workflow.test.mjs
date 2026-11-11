import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dialogueControl,voiceAction,actionPhrases} from '../src/voice-review-commands.js';

test('localized hands-free Help Back Repeat Stop recognize exact commands only',()=>{
 for(const language of ['en-IN','hi-IN','hi-en','te-IN']){
  for(const action of ['help','back','repeat','stop']){
   const phrase=actionPhrases(language,action)[0];
   assert.ok(phrase,language+' '+action);
   assert.equal(dialogueControl(language,phrase),action);
   assert.equal(dialogueControl(language,'please '+phrase),null);
  }
 }
 assert.equal(dialogueControl('en-IN','What should I say?'),'help');
 assert.equal(dialogueControl('en-IN','back'),'back');
 assert.equal(dialogueControl('en-IN','stop'),'stop');
 assert.equal(dialogueControl('en-IN','random shelf change'),null);
});

test('automatic owner guide narrates before opening mic and respects pause',async()=>{
 const source=await readFile(new URL('../src/guided-voice-turn.jsx',import.meta.url),'utf8');
 assert.ok(source.includes('audio.onended=()=>{cleanupAudio();listen()}'));
 assert.ok(source.includes("startRecording(async blob=>"));
 assert.ok(source.includes('if(!active||disabled||!stage)return'));
 assert.ok(source.includes('recorder?.stop(true)'));
 assert.ok(source.includes("if(control==='stop')"));
 assert.ok(source.includes("if(control==='back')"));
 assert.ok(source.includes("if(control==='repeat'||control==='help')"));
 assert.ok(source.includes('Start automatic voice guide'));
 assert.ok(source.includes('Retry voice guide'));
 assert.ok(source.includes('Voice paused. Your work is saved in this form.'));
});

test('owner review and correction integrate a single guided conversational state machine',async()=>{
 const source=await readFile(new URL('../src/warehouse-manage.jsx',import.meta.url),'utf8');
 assert.ok(source.includes("stage={guideStage}"));
 assert.ok(source.includes("context=\"Automatic report verification\""));
 assert.ok(source.includes("context=\"Automatic owner location correction\""));
 assert.ok(source.includes("onTranscript={guidedReviewAnswer}"));
 assert.ok(source.includes("onTranscript={guidedMoveAnswer}"));
 assert.ok(source.includes("guideStage==='review_outcome'"));
 assert.ok(source.includes("guideStage==='move_confirm'"));
 assert.ok(source.includes('onBack={guidedReviewBack}'));
 assert.ok(source.includes('onBack={guidedMoveBack}'));
 assert.ok(source.includes('onActiveChange={SetGuidedActive}'));
 assert.ok(source.includes("return !!(await previewMove(true))"));
 assert.ok(source.includes("await confirmMove();return false"));
 assert.ok(source.includes("await markResolved();return false"));
});

test('worker voice flow provides contextual help back and real saved announcements',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.ok(source.includes("const control=dialogueControl(source.language,transcript)"));
 assert.ok(source.includes("if(control==='help')"));
 assert.ok(source.includes("if(control==='back')"));
 assert.ok(source.includes("if(control==='stop')"));
 assert.ok(source.includes("await playFixedVoice('report_saved',language,true)"));
 assert.ok(source.includes("await playFixedVoice('pick_done',finished.language)"));
 assert.ok(source.includes("!x.line.stale_catalogue"));
 assert.ok(source.includes("audioEndResolve.current?.()"));
});


test('worker report is one guided voice workflow with optional manual verification',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.ok(source.includes("stage={guideStage} context=\"Automatic wrong-location report\""));
 assert.ok(source.includes("onTranscript={guidedReportAnswer}"));
 assert.ok(source.includes("onBack={guidedReportBack}"));
 assert.ok(source.includes("guideStage==='report_confirm'?'voice/report-preview-audio':null"));
 assert.ok(source.includes("voiceAction(language,'report_send',recognized)"));
 assert.ok(source.includes("voiceAction(language,'report_skip',recognized)"));
 assert.ok(source.includes("onActiveChange={SetGuidedActive}"));
 assert.ok(source.includes("disabled={busy||guidedActive||reason.trim().length<3}"));
 for(const lang of ['en-IN','hi-IN','hi-en','te-IN']){
  for(const action of ['report_send','report_skip']){
   assert.ok(actionPhrases(lang,action).length);
   assert.equal(voiceAction(lang,action,actionPhrases(lang,action)[0]),true);
   assert.equal(voiceAction(lang,action,'please '+actionPhrases(lang,action)[0]),false);
  }
 }
});
