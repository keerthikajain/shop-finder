import React,{useEffect,useRef,useState} from 'react';
import {startRecording} from './recording.js';
import {request} from './accounts.jsx';
import {dialogueControl} from './voice-review-commands.js';

/*
 * One owner voice turn at a time. Listen ONLY after Gnani finishes speaking.
 * Each stage is controlled by the owning form; this component never writes
 * catalogue data or treats a transcript as approval without parent validation.
 * A failed speaker, microphone or transcription always leaves manual inputs.
 */
export default function GuidedVoiceTurn({
 language='en-IN',stage,promptEndpoint=null,onTranscript,onBack,onStop,
 onError=()=>{},disabled=false,context='location review'
}){
 const [active,SetActive]=useState(false),[cycle,Cycle]=useState(0);
 const [status,Status]=useState('idle'),[error,ErrorMessage]=useState('');
 const [heard,Heard]=useState('');
 const handlers=useRef({onTranscript,onBack,onStop,onError});
 const stageRef=useRef(stage),silence=useRef(0);
 handlers.current={onTranscript,onBack,onStop,onError};
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
   SetActive(false);handlers.current.onError(message);
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
      if(!transcript){fail('No words recognized. You can retry or use the form.');return}
      silence.current=0;Heard(transcript);
      const control=dialogueControl(language,transcript);
      if(control==='stop'){SetActive(false);Status('stopped');handlers.current.onStop?.();return}
      if(control==='repeat'||control==='help'){nextTurn(stage);return}
      if(control==='back'){
       Status('processing');
       await handlers.current.onBack?.(stage);
       nextTurn(stage);return;
      }
      Status('processing');
      const outcome=await handlers.current.onTranscript(transcript,stage);
      if(cancelled)return;
      if(outcome===false){SetActive(false);Status('idle');return}
      nextTurn(stage);
     }catch(e){
      if(!cancelled)fail(e.message||'Voice recognition failed. Use retry or type instead.');
     }
    },e=>{
     if(cancelled)return;
     if(e.message==='No speech detected.'&&silence.current++<1){
      nextTurn(stage);return;
     }
     fail(e.message==='No speech detected.'?'I did not hear an answer. Retry voice or use the form.':e.message);
    },{stopOnSilence:true});
    if(cancelled)handle.stop(true);
    else recorder=handle;
   }catch(e){fail(e.message||'Microphone unavailable. Use the manual form.')}
  };
  const narrate=async()=>{
   Status('speaking');ErrorMessage('');
   try{
    const endpoint=promptEndpoint||'voice/step-audio?step='+encodeURIComponent(stage);
    const response=await fetch('/api/warehouse/'+endpoint,{
     method:'POST',credentials:'same-origin',
     headers:{'Content-Type':'application/json','X-Shop-Request':'1'},
     body:JSON.stringify({language}),signal:controller.signal
    });
    if(!response.ok){
     const reason=await response.json().catch(()=>({}));
     throw Error(reason.detail||'Voice guidance unavailable. Continue manually.');
    }
    if(cancelled)return;
    url=URL.createObjectURL(await response.blob());
    if(cancelled)return;
    audio=new Audio(url);
    audio.onended=()=>{cleanupAudio();listen()};
    audio.onerror=()=>fail('Audio playback failed. Try again or continue manually.');
    await audio.play();
   }catch(e){
    if(!cancelled&&e.name!=='AbortError')
     fail(e.name==='NotAllowedError'?'Tap Retry voice to allow playback, or use the form.':e.message);
   }
  };
  narrate();
  return ()=>{cancelled=true;controller.abort();recorder?.stop(true);cleanupAudio()};
 },[active,disabled,stage,promptEndpoint,language,cycle]);

 function stop(){
  SetActive(false);Status('stopped');handlers.current.onStop?.();
 }
 function start(){
  silence.current=0;ErrorMessage('');Heard('');SetActive(true);Cycle(v=>v+1);
 }
 return <section className="sf-guided-owner-voice" aria-label={context}>
  <div className="sf-guided-owner-voice-actions">
   {!active?<button type="button" disabled={disabled} onClick={start}>{status==='paused'?'Retry voice guide':'Start automatic voice guide'}</button>:
    <button type="button" onClick={stop}>Stop voice guide</button>}
   {active&&<button type="button" disabled={disabled} onClick={()=>Cycle(v=>v+1)}>Repeat instructions</button>}
  </div>
  <small role="status" aria-live="polite">{active?(
   status==='speaking'?'Finder is speaking. The microphone will open afterward.':
   status==='listening'?'Listening for your answer…':
   status==='transcribing'?'Recognizing your answer…':'Working on your answer…'
  ):status==='paused'?'Voice paused. Your work is saved in this form. Retry or continue manually.':
   'Voice is optional. All manual controls below still work.'}</small>
  {heard&&<p className="sf-guided-owner-transcript"><strong>Heard:</strong> {heard}</p>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
