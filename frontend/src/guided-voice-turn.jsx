import React,{useContext,useEffect,useRef,useState} from 'react';
import {startRecording} from './recording.js';
import {request} from './accounts.jsx';
import {dialogueControl} from './voice-review-commands.js';
import {reportVoiceCopy} from './report-voice-copy.js';
import {Locale} from './locale.js';

/*
 * One owner voice turn at a time. Listen ONLY after Gnani finishes speaking.
 * Each stage is controlled by the owning form; this component never writes
 * catalogue data or treats a transcript as approval without parent validation.
 * A failed speaker, microphone or transcription always leaves manual inputs.
 */
export default function GuidedVoiceTurn({
 language='en-IN',stage,promptEndpoint=null,promptBody=null,retryStep=null,onTranscript,onBack,onStop,
 onError=()=>{},onActiveChange=()=>{},disabled=false,context='location review'
}){
 const appLanguage=useContext(Locale);
 const [active,SetActive]=useState(false),[cycle,Cycle]=useState(0);
 const [status,Status]=useState('idle'),[error,ErrorMessage]=useState('');
 const [heard,Heard]=useState('');
 const handlers=useRef({onTranscript,onBack,onStop,onError,onActiveChange}),promptBodyRef=useRef(promptBody);
 const stageRef=useRef(stage),silence=useRef(0),retryNarration=useRef(false);
 const uiLanguage=appLanguage==='hi'?'hi-IN':appLanguage==='te'?'te-IN':appLanguage==='en'?'en-IN':language;
 const copy=key=>reportVoiceCopy(uiLanguage,key);
 handlers.current={onTranscript,onBack,onStop,onError,onActiveChange};
 promptBodyRef.current=promptBody;
 stageRef.current=stage;
 useEffect(()=>{
  if(!active||disabled||!stage)return;
  let cancelled=false,recorder=null,audio=null,url=null;
  const controller=new AbortController();
  const cleanupAudio=()=>{
   if(audio){audio.onended=null;audio.onerror=null;audio.pause();audio.removeAttribute('src');audio=null}
   if(url){URL.revokeObjectURL(url);url=null}
  };
  const fail=(message)=>{
   if(cancelled)return;
   cleanupAudio();Status('paused');ErrorMessage(message);
   SetActive(false);handlers.current.onActiveChange(false);handlers.current.onError(message);
  };
  const nextTurn=(oldStage)=>{
   if(cancelled)return;
   // The owning form selects the next step, or we repeat only this step.
   // Never restart after a Stop or after a disposed recorder.
   if(stageRef.current===oldStage)Cycle(v=>v+1);
  };
  const listen=async()=>{
   if(cancelled)return;
   Status('listening');
   try{
    const handle=await startRecording(async blob=>{
     if(cancelled)return;
     Status('transcribing');
     try{
      const params=new URLSearchParams({language,style:'transcribe',enhanced:'true',collection:'all'});
      const result=await request('/voice/transcribe?'+params,{method:'POST',
       headers:{'Content-Type':'audio/wav'},body:blob,signal:controller.signal});
      if(cancelled)return;
      const transcript=String(result.transcript||'').trim();
      if(!transcript){fail(copy('noWords'));return}
      silence.current=0;Heard(transcript);
      const control=dialogueControl(language,transcript);
      if(control==='stop'){SetActive(false);handlers.current.onActiveChange(false);Status('stopped');handlers.current.onStop?.();return}
      if(control==='repeat'){retryNarration.current=false;nextTurn(stage);return}
      if(control==='help'){retryNarration.current=!!retryStep;nextTurn(stage);return}
      if(control==='back'){
       Status('processing');
       await handlers.current.onBack?.(stage);
       nextTurn(stage);return;
      }
      Status('processing');
      const outcome=await handlers.current.onTranscript(transcript,stage);
      if(cancelled)return;
      if(outcome===false){SetActive(false);handlers.current.onActiveChange(false);Status('idle');return}
      // A misunderstood command should NOT replay the entire report or review.
      // Use one short localized retry prompt, then listen at the same stage.
      if(outcome==='retry'&&retryStep){retryNarration.current=true}
      nextTurn(stage);
     }catch(e){
      if(!cancelled)fail(e.message||copy('voiceFail'));
     }
    },e=>{
     if(cancelled)return;
     if(e.message==='No speech detected.'&&silence.current++<1){
      if(retryStep)retryNarration.current=true;
      nextTurn(stage);return;
     }
     fail(e.message==='No speech detected.'?copy('noSpeech'):e.message);
    },{stopOnSilence:true});
    if(cancelled)handle.stop(true);
    else recorder=handle;
   }catch(e){fail(e.message||copy('micFail'))}
  };
  const narrate=async()=>{
   Status('speaking');ErrorMessage('');
   try{
    const short=retryNarration.current&&!!retryStep;
    retryNarration.current=false;
    const endpoint=short?'voice/step-audio?step='+encodeURIComponent(retryStep):
      promptEndpoint||'voice/step-audio?step='+encodeURIComponent(stage);
    const response=await fetch('/api/warehouse/'+endpoint,{
     method:'POST',credentials:'same-origin',
     headers:{'Content-Type':'application/json','X-Shop-Request':'1'},
     body:JSON.stringify({language,...(promptBodyRef.current||{})}),signal:controller.signal
    });
    if(!response.ok){
     const reason=await response.json().catch(()=>({}));
     throw Error(reason.detail||copy('voiceFail'));
    }
    if(cancelled)return;
    url=URL.createObjectURL(await response.blob());
    if(cancelled)return;
    audio=new Audio(url);
    audio.onended=()=>{cleanupAudio();listen()};
    audio.onerror=()=>fail(copy('audioFail'));
    await audio.play();
   }catch(e){
    if(!cancelled&&e.name!=='AbortError')
     fail(e.name==='NotAllowedError'?copy('playbackFail'):e.message);
   }
  };
  narrate();
  return ()=>{cancelled=true;controller.abort();recorder?.stop(true);cleanupAudio()};
 },[active,disabled,stage,promptEndpoint,retryStep,language,cycle]);

 function stop(){
  SetActive(false);handlers.current.onActiveChange(false);Status('stopped');handlers.current.onStop?.();
 }
 function start(){
  silence.current=0;retryNarration.current=false;ErrorMessage('');Heard('');SetActive(true);handlers.current.onActiveChange(true);Cycle(v=>v+1);
 }
 return <section className="sf-guided-owner-voice" aria-label={context}>
  <div className="sf-guided-owner-voice-actions">
   {!active?<button type="button" disabled={disabled} onClick={start}>{copy(status==='paused'?'guideRetry':'guideStart')}</button>:
    <button type="button" onClick={stop}>{copy('guideStop')}</button>}
   {active&&<button type="button" disabled={disabled} onClick={()=>{retryNarration.current=false;Cycle(v=>v+1)}}>{copy('guideRepeat')}</button>}
  </div>
  <small role="status" aria-live="polite">{active?(
   status==='speaking'?copy('speaking'):
   status==='listening'?copy('listening'):
   status==='transcribing'?copy('transcribing'):copy('processing')
  ):status==='stopped'?copy('stopped'):status==='paused'?copy('pausedVoice'):copy('optionalVoice')}</small>
  {heard&&<p className="sf-guided-owner-transcript"><strong>{copy('heard')}:</strong> {heard}</p>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
