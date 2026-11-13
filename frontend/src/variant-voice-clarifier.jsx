import React,{useContext,useEffect,useRef,useState} from 'react';
import {startRecording} from './recording.js';
import {request} from './accounts.jsx';
import {Locale} from './locale.js';

// This component asks about an unresolved catalogue choice. Speech alone never
// selects a product: the existing server-side /clarify endpoint validates it.
export default function VariantVoiceClarifier({taskId,index,language,enabled,startPaused=false,onReply,onError=()=>{}}){
 const appLanguage=useContext(Locale);
 const copy={en:{heading:'Choose a size or model',speaking:'Finder is explaining the available choices…',listening:'Listening for size, model or SKU…',transcribing:'Recognizing your answer…',checking:'Checking the exact catalogue variant…',review:'Check the available variants below.',default:'Say the size or SKU, or tap the matching option below.',heard:'Gnani heard',again:'Ask again by voice',manual:'Choose manually'},hi:{heading:'साइज़ या मॉडल चुनें',speaking:'फ़ाइंडर उपलब्ध विकल्प बता रहा है…',listening:'साइज़, मॉडल या एसकेयू सुन रहा है…',transcribing:'आपकी आवाज़ समझ रहा है…',checking:'कैटलॉग में सही विकल्प जाँच रहा है…',review:'नीचे दिए गए विकल्प जाँचें।',default:'साइज़ या एसकेयू बोलें या नीचे चुनें।',heard:'ग्नानी ने सुना',again:'फिर पूछें',manual:'खुद चुनें'},te:{heading:'సైజు లేదా మోడల్ ఎంచుకోండి',speaking:'ఫైండర్ అందుబాటులో ఉన్న ఎంపికలను చెబుతోంది…',listening:'సైజు, మోడల్ లేదా ఎస్ కే యూ వింటోంది…',transcribing:'మీ సమాధానాన్ని గుర్తిస్తోంది…',checking:'కేటలాగ్‌లో సరైన రకాన్ని చూస్తోంది…',review:'కింద ఉన్న ఎంపికలను పరిశీలించండి.',default:'సైజు లేదా ఎస్ కే యూ చెప్పండి, లేదా కింద ఎంచుకోండి.',heard:'గ్నాని విన్నది',again:'మళ్లీ అడగండి',manual:'నేనే ఎంచుకుంటాను'}}[appLanguage]||{heading:'Choose a size or model',speaking:'Finder is explaining the available choices…',listening:'Listening for size, model or SKU…',transcribing:'Recognizing your answer…',checking:'Checking the exact catalogue variant…',review:'Check the available variants below.',default:'Say the size or SKU, or tap below.',heard:'Gnani heard',again:'Ask again by voice',manual:'Choose manually'};
 const [status,Status]=useState('idle'),[heard,Heard]=useState(''),[manual,Manual]=useState(startPaused),[cycle,Cycle]=useState(0);
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
  <strong>{copy.heading}</strong>
  <p>{copy[status]||copy.default}</p>
  {heard&&<p><strong>{copy.heard}:</strong> <span lang={language}>{heard}</span></p>}
  {!['speaking','listening','transcribing','checking'].includes(status)&&<button type="button" onClick={()=>{Heard('');Manual(false);Cycle(n=>n+1)}}>🔊 {copy.again}</button>}
  <button type="button" onClick={()=>{Manual(true);Status('manual')}} disabled={manual}>{copy.manual}</button>
 </div>;
}
