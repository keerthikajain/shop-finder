import React,{useEffect,useRef,useState} from 'react';
import {startRecording} from './recording.js';
import {request} from './accounts.jsx';

// This component asks about an unresolved catalogue choice. Speech alone never
// selects a product: the existing server-side /clarify endpoint validates it.
export default function VariantVoiceClarifier({taskId,index,language,enabled,onReply,onError=()=>{}}){
 const [status,Status]=useState('idle'),[heard,Heard]=useState(''),[manual,Manual]=useState(false),[cycle,Cycle]=useState(0);
 const callback=useRef(onReply),report=useRef(onError);
 callback.current=onReply;report.current=onError;
 useEffect(()=>{
  if(!enabled||manual)return;
  let cancelled=false,recorder=null,audio=null,url=null;
  const controller=new AbortController();
  async function begin(){
   try{
    Status('speaking');
    const response=await fetch('/api/warehouse/tasks/'+encodeURIComponent(taskId)+'/clarification-audio/'+index,{
     method:'POST',credentials:'same-origin',headers:{'X-Shop-Request':'1'},signal:controller.signal});
    if(!response.ok)throw Error('Voice clarification unavailable. Select a variant on screen.');
    const blob=await response.blob();
    if(cancelled)return;
    url=URL.createObjectURL(blob);
    audio=new Audio(url);
    await new Promise((resolve,reject)=>{
     audio.onended=resolve;
     audio.onerror=()=>reject(Error('Voice clarification playback failed.'));
     audio.play().catch(reject);
    });
    if(cancelled)return;
    Status('listening');
    recorder=await startRecording(async wav=>{
     if(cancelled)return;
     Status('transcribing');
     try{
      const params=new URLSearchParams({language,style:'transcribe',enhanced:'true',collection:'all'});
      const result=await request('/voice/transcribe?'+params,{method:'POST',headers:{'Content-Type':'audio/wav'},body:wav,signal:controller.signal});
      if(cancelled)return;
      const text=String(result.transcript||'').trim();
      Heard(text);
      if(!text){Status('retry');return;}
      Status('checking');
      await callback.current(text);
      if(!cancelled)Status('review');
     }catch(e){if(!cancelled&&e.name!=='AbortError'){Status('retry');report.current(e.message);}}
    },e=>{if(!cancelled){Status('retry');if(e.message!=='No speech detected.')report.current(e.message)}},{stopOnSilence:true});
    if(cancelled)recorder.stop(true);
   }catch(e){
    if(!cancelled&&e.name!=='AbortError'){Status('retry');report.current(e.message)}
   }
  }
  void begin();
  return ()=>{cancelled=true;controller.abort();recorder?.stop(true);if(audio){audio.onended=null;audio.onerror=null;audio.pause();audio.removeAttribute('src')}if(url)URL.revokeObjectURL(url)};
 },[enabled,manual,taskId,index,language,cycle]);
 return <div className="sf-voice-detail-transcript" role="status" aria-live="polite">
  <strong>{language==='te-IN'?'సైజు లేదా మోడల్ ఎంచుకోండి':language==='hi-IN'?'साइज़ या मॉडल चुनें':'Choose a size or model'}</strong>
  <p>{status==='speaking'?'Finder is explaining the available choices…':status==='listening'?'Listening for size, model or SKU…':status==='transcribing'?'Recognizing your answer…':status==='checking'?'Checking the exact catalogue variant…':status==='review'?'Check the available variants below.':'Say the size or SKU, or tap the matching option below.'}</p>
  {heard&&<p><strong>{language==='te-IN'?'గ్నాని విన్నది':language==='hi-IN'?'ग्नानी ने सुना':'Gnani heard'}:</strong> <span lang={language}>{heard}</span></p>}
  {status!=='speaking'&&status!=='listening'&&status!=='transcribing'&&status!=='checking'&&<button type="button" onClick={()=>{Heard('');Manual(false);Cycle(n=>n+1)}}>🔊 {language==='te-IN'?'మళ్లీ అడగండి':language==='hi-IN'?'फिर पूछें':'Ask again by voice'}</button>}
  <button type="button" onClick={()=>{Manual(true);Status('manual')}} disabled={manual}> {language==='te-IN'?'నేనే ఎంచుకుంటాను':language==='hi-IN'?'खुद चुनें':'Choose manually'} </button>
 </div>;
}
