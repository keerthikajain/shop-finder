import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dialogueControl,voiceAction,actionPhrases,plausibleShelfSuggestion,reportSubmitCommand,unclearReportSubmit} from '../src/voice-review-commands.js';
import {reportVoiceCopy} from '../src/report-voice-copy.js';

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
 assert.ok(source.includes("if(control==='repeat')"));
 assert.ok(source.includes("if(control==='help')"));
 assert.ok(source.includes("copy(status==='paused'?'guideRetry':'guideStart')"));
 assert.ok(source.includes("copy('guideStop')"));
 assert.ok(source.includes("copy('pausedVoice')"));
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
 assert.ok(source.includes("return (await previewMove(true))?true:'retry'"));
 assert.ok(source.includes("const saved=await confirmMove();return saved?false:'retry';"));
 assert.ok(source.includes("const saved=await markResolved();return saved?false:'retry';"));
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
 assert.ok(source.includes("reportSubmitCommand(language,recognized)"));
 assert.ok(source.includes("voiceAction(language,'report_skip',recognized)"));
 assert.ok(source.includes("onActiveChange={SetGuidedActive}"));
 assert.ok(source.includes("disabled={busy||reason.trim().length<3}"));
 for(const lang of ['en-IN','hi-IN','hi-en','te-IN']){
  for(const action of ['report_send','report_skip']){
   assert.ok(actionPhrases(lang,action).length);
   assert.equal(voiceAction(lang,action,actionPhrases(lang,action)[0]),true);
   assert.equal(voiceAction(lang,action,'please '+actionPhrases(lang,action)[0]),false);
  }
 }
});

test('vague shelf suggestions never become assumed locations',()=>{
 for(const utterance of ['maybe','not sure','okay','i do not know','yes','पता नहीं','తెలియదు'])
  assert.equal(plausibleShelfSuggestion(utterance),false,utterance);
 for(const utterance of ['Rack C shelf 2','bin 07','near entrance','रैक बी शेल्फ तीन','ర్యాక్ సీ షెల్ఫ్ రెండు'])
  assert.equal(plausibleShelfSuggestion(utterance),true,utterance);
});

test('report commands are strict yet accept Stop Back-to-edit and Submit in all voice languages',()=>{
 const samples={
  'en-IN':['send report','back to edit','stop'],
  'hi-IN':['रिपोर्ट भेजो','वापस','रुको'],
  'hi-en':['report bhejo','back to edit','ruko'],
  'te-IN':['నివేదిక పంపండి','వెనక్కి','ఆపు']
 };
 for(const [language,[send,back,stop]] of Object.entries(samples)){
  assert.equal(reportSubmitCommand(language,send),true,language+' submit');
  assert.equal(dialogueControl(language,back),'back',language+' back');
  assert.equal(dialogueControl(language,stop),'stop',language+' stop');
  assert.equal(dialogueControl(language,'back to edit'),'back',language+' English fallback');
  assert.equal(dialogueControl(language,'stop'),'stop',language+' English fallback');
  assert.equal(reportSubmitCommand(language,'send report'),true,language+' safe code-switch');
  assert.equal(reportSubmitCommand(language,'send report I'),false,language+' unclear transcript');
  assert.equal(unclearReportSubmit(language,'send report I'),true,language+' ask rather than overwrite');
  assert.equal(unclearReportSubmit(language,send),false,language+' proper command');
  assert.equal(reportSubmitCommand(language,'please '+send),false,language+' unsafe fuzzy submit');
 }
});

test('all report UI and retry messages have voice-language translations',()=>{
 const keys=['defaultReason','paused','steps','tell','hint','record','recognized','edit',
  'shelf','sendForReview','retryReason','retryShelf','retryConfirm','guideStart','guideStop',
  'guideRepeat','speaking','listening','transcribing','processing','pausedVoice',
  'noWords','noSpeech','voiceFail','saveFailed'];
 for(const language of ['en-IN','hi-IN','hi-en','te-IN']){
  for(const key of keys){
   const text=reportVoiceCopy(language,key);
   assert.ok(text && text!==key,language+' '+key);
   if(language==='hi-IN')assert.match(text,/[\u0900-\u097f]/,key);
   if(language==='te-IN')assert.match(text,/[\u0c00-\u0c7f]/,key);
  }
 }
});

test('unrecognized report commands use short localized retries, never full readback in a loop',async()=>{
 const guide=await readFile(new URL('../src/guided-voice-turn.jsx',import.meta.url),'utf8');
 const report=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const backend=await readFile(new URL('../../backend/app/warehouse.py',import.meta.url),'utf8');
 assert.ok(guide.includes("if(outcome==='retry'&&retryStep){retryNarration.current=true}"));
 assert.ok(guide.includes("const endpoint=short?'voice/step-audio?step='+encodeURIComponent(retryStep)"));
 assert.ok(report.includes("retryStep={guideStage+'_retry'}"));
 assert.ok(report.includes("return saved?false:'retry'"));
 assert.ok(report.includes("const submittingRef=useRef(false),submittedRef=useRef(false)"));
 assert.ok(report.includes("if(submittedRef.current)return true"));
 assert.ok(report.includes("submittedRef.current=true"));
 assert.ok(report.includes("disabled={busy||reason.trim().length<3}"));
 for(const step of ['report_reason_retry','report_suggestion_retry','report_confirm_retry'])
  assert.ok(backend.includes("'"+step+"':("),step);
 assert.ok(backend.includes("not step.startswith('report_')"));
});

test('manual form and spoken guide cannot record a second report while submitting',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.ok(source.includes("if(submittedRef.current)return true"));
 assert.ok(source.includes("if(submittingRef.current||busy||reason.trim().length<3)return false"));
 assert.ok(source.includes("submittedRef.current=true"));
 assert.ok(source.includes("context=\"Automatic wrong-location report\" disabled={busy}"));
 assert.ok(source.includes("unclearReportSubmit(language,recognized)"));
 assert.ok(source.includes("unclearReportSubmit(language,transcript)"));
});

test('owner review and shelf corrections also use short per-step clarification in all languages',async()=>{
 const owner=await readFile(new URL('../src/warehouse-manage.jsx',import.meta.url),'utf8');
 const server=await readFile(new URL('../../backend/app/warehouse.py',import.meta.url),'utf8');
 assert.ok(owner.includes("context=\"Automatic owner location correction\" retryStep={guideStage+'_retry'}"));
 assert.ok(owner.includes("context=\"Automatic report verification\" retryStep={guideStage+'_retry'}"));
 assert.ok(owner.includes("if(step==='move_destination')return (await hearCorrection(text))?true:'retry'"));
 for(const step of ['review_outcome_retry','review_note_retry','review_confirm_retry',
  'move_destination_retry','move_reason_retry','move_preview_retry','move_confirm_retry'])
   assert.ok(server.includes("'"+step+"':("),step);
});
