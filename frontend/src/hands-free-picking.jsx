import React,{useEffect,useRef,useState} from 'react';
import {startRecording} from './recording.js';
import {request} from './accounts.jsx';

/* The user grants microphone permission once. Each short, voice-activity-bounded
   utterance is transcribed on the authenticated backend. No recognition output
   directly modifies products, locations or stock. A pause/error stops listening. */
export default function HandsFreePicking({enabled,language,collection='all',onCommand,onError}){
 const [cycle,Next]=useState(0),[status,Status]=useState('idle'),[halted,Halt]=useState(false);
 const commandRef=useRef(onCommand),errorRef=useRef(onError);
 useEffect(()=>{commandRef.current=onCommand;errorRef.current=onError},[onCommand,onError]);
 useEffect(()=>{
  if(!enabled){Status('paused');return;}
  if(halted)return;
  let cancelled=false,recorder=null;
  Status('starting');
  startRecording(async blob=>{
   if(cancelled)return;
   Status('transcribing');
   try{
    const params=new URLSearchParams({language,style:'transcribe',enhanced:'true',collection});
    const result=await request('/voice/transcribe?'+params.toString(),{
     method:'POST',headers:{'Content-Type':'audio/wav'},body:blob
    });
    if(cancelled)return;
    if(result.transcript?.trim())await commandRef.current(result.transcript);
   }catch(e){
    if(!cancelled){Halt(true);Status('error');errorRef.current(e.message||'Voice command failed.');}
   }finally{
    if(!cancelled)Next(n=>n+1);
   }
  },e=>{
   if(cancelled)return;
   if(e.message==='No speech detected.'){Next(n=>n+1);return;}
   Halt(true);Status('error');errorRef.current(e.message);
  },{stopOnSilence:true}).then(r=>{
   if(cancelled)r.stop(true);
   else{recorder=r;Status('listening');}
  }).catch(e=>{
   if(cancelled)return;
   Halt(true);Status('error');errorRef.current(e.message||'Microphone unavailable.');
  });
  return ()=>{cancelled=true;recorder?.stop(true);};
 },[enabled,language,collection,cycle,halted]);
 return <div className="sf-hands-free-status" role="status" aria-live="polite">
  <span className={'sf-listen-dot '+(enabled&&!halted&&status==='listening'?'active':'')}/>
  <span>{halted?'Microphone paused after an error. Use the manual microphone or retry.':
   !enabled?'Voice listening paused.':
   status==='transcribing'?'Recognizing your command…':
   status==='listening'?'Listening for a picking command…':'Preparing microphone…'}</span>
  {halted&&<button type="button" onClick={()=>{Halt(false);Next(n=>n+1)}}>Retry voice</button>}
 </div>;
}
