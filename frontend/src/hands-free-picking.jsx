import React,{useEffect,useRef,useState} from 'react';
import {startRecording} from './recording.js';
import {request} from './accounts.jsx';
import {pickingCopy} from './picking-copy.js';

/* One microphone turn at a time. Never capture while Finder speaks.
   Stops after repeated silence/error; manual actions are always available. */
export default function HandsFreePicking({enabled,language,collection='all',onCommand,onError}){
 const [cycle,Next]=useState(0),[status,Status]=useState('idle'),[halted,Halt]=useState(false);
 const commandRef=useRef(onCommand),errorRef=useRef(onError),silenceRef=useRef(0);
 useEffect(()=>{commandRef.current=onCommand;errorRef.current=onError},[onCommand,onError]);
 useEffect(()=>{
  if(!enabled){Status('paused');return;}
  if(halted)return;
  let cancelled=false,recorder=null;
  const stopWithError=(message)=>{
   if(cancelled)return;
   Halt(true);Status('error');errorRef.current(message);
  };
  Status('starting');
  startRecording(async blob=>{
   if(cancelled)return;
   let shouldContinue=true;
   Status('transcribing');
   try{
    const params=new URLSearchParams({language,style:'transcribe',enhanced:'true',collection});
    const result=await request('/voice/transcribe?'+params.toString(),{
     method:'POST',headers:{'Content-Type':'audio/wav'},body:blob
    });
    if(cancelled)return;
    if(result.transcript?.trim()){
     silenceRef.current=0;
     const outcome=await commandRef.current(result.transcript);
     // Stop/report transitions own the handoff, not this recorder.
     if(outcome===false){shouldContinue=false;Status('paused');}
    }else if(++silenceRef.current>=2){
     shouldContinue=false;stopWithError(pickingCopy(language,'noMic'));
    }
   }catch(e){
    shouldContinue=false;stopWithError(e.message||pickingCopy(language,'noMic'));
   }finally{
    if(!cancelled&&shouldContinue)Next(n=>n+1);
   }
  },e=>{
   if(cancelled)return;
   if(e.message==='No speech detected.'){
    if(++silenceRef.current<2){Next(n=>n+1);return;}
    stopWithError(pickingCopy(language,'noMic'));return;
   }
   stopWithError(e.message||pickingCopy(language,'noMic'));
  },{stopOnSilence:true}).then(r=>{
   if(cancelled)r.stop(true);
   else{recorder=r;Status('listening');}
  }).catch(e=>stopWithError(e.message||pickingCopy(language,'noMic')));
  return ()=>{cancelled=true;recorder?.stop(true);};
 },[enabled,language,collection,cycle,halted]);
 const hint=halted?pickingCopy(language,'noMic'):
  !enabled?pickingCopy(language,'paused'):
  status==='transcribing'?pickingCopy(language,'transcribing'):
  status==='listening'?pickingCopy(language,'listening'):pickingCopy(language,'speaking');
 return <div className="sf-hands-free-status" role="status" aria-live="polite">
  <span className={'sf-listen-dot '+(enabled&&!halted&&status==='listening'?'active':'')} aria-hidden="true"/>
  <span>{hint}</span>
  {halted&&<button type="button" onClick={()=>{silenceRef.current=0;Halt(false);Next(n=>n+1)}}>{pickingCopy(language,'retry')}</button>}
 </div>;
}
