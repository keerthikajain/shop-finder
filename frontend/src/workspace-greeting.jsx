import React,{useEffect,useRef,useState} from 'react';
import {Glyph} from './warehouse-ui.jsx';
import './workspace-greeting.css';

const VOICE_LOCALES={'en-IN':'en-IN','hi-IN':'hi-IN','hi-en':'en-IN','te-IN':'te-IN'};
const FEMALE_VOICE=/\b(zira|heera|veena|samantha|victoria|karen|tessa|moira|fiona|female|woman|aria|jenny|neerja|swara)\b/i;

// Use the staff member's saved display name when possible; never fabricate a guest name.
export function greetingName(user){
 if(!user||user.is_demo)return '';
 const candidate=String(user.display_name||user.username||'').trim().split(/\s+/u)[0]
  .replace(/[^\p{L}\p{M}\p{N}'-]/gu,'').slice(0,32);
 return candidate||'';
}

export function greetingMessage(user,language='en-IN',hour=new Date().getHours()){
 const name=greetingName(user);
 const time=hour<12?'morning':hour<17?'afternoon':'evening';
 const first=name?name+', ':'';
 const text={
  'en-IN':{
   morning:`Good morning, ${first}welcome back to Finder! Ready to find what you need?`,
   afternoon:`Good afternoon, ${first}welcome back to Finder! Ready to find what you need?`,
   evening:`Good evening, ${first}welcome back to Finder! Ready to find what you need?`
  },
  'hi-IN':{
   morning:`सुप्रभात, ${first}फाइंडर में फिर से स्वागत है। चलिए, ज़रूरी सामान ढूँढ़ते हैं।`,
   afternoon:`नमस्कार, ${first}फाइंडर में फिर से स्वागत है। चलिए, ज़रूरी सामान ढूँढ़ते हैं।`,
   evening:`शुभ संध्या, ${first}फाइंडर में फिर से स्वागत है। चलिए, ज़रूरी सामान ढूँढ़ते हैं।`
  },
  'hi-en':{
   morning:`Good morning, ${first}Finder mein welcome back! Chaliye jo chahiye woh dhoondhte hain.`,
   afternoon:`Good afternoon, ${first}Finder mein welcome back! Chaliye jo chahiye woh dhoondhte hain.`,
   evening:`Good evening, ${first}Finder mein welcome back! Chaliye jo chahiye woh dhoondhte hain.`
  },
  'te-IN':{
   morning:`శుభోదయం, ${first}ఫైండర్‌కు తిరిగి స్వాగతం! మీకు కావాల్సిన వస్తువులను వెతుకుదాం.`,
   afternoon:`శుభ మధ్యాహ్నం, ${first}ఫైండర్‌కు తిరిగి స్వాగతం! మీకు కావాల్సిన వస్తువులను వెతుకుదాం.`,
   evening:`శుభ సాయంత్రం, ${first}ఫైండర్‌కు తిరిగి స్వాగతం! మీకు కావాల్సిన వస్తువులను వెతుకుదాం.`
  }
 };
 // Guest speech must not suggest the user has a named account.
 if(!name){
  const guest={
   'en-IN':'Welcome to Finder! Ready to find what you need?',
   'hi-IN':'फाइंडर में स्वागत है। चलिए, ज़रूरी सामान ढूँढ़ते हैं।',
   'hi-en':'Finder mein welcome! Chaliye jo chahiye woh dhoondhte hain.',
   'te-IN':'ఫైండర్‌కు స్వాగతం! మీకు కావాల్సిన వస్తువులను వెతుకుదాం.'
  };
  return guest[language]||guest['en-IN'];
 }
 return (text[language]||text['en-IN'])[time];
}

// This lightweight welcome uses the browser's speech engine, as does the public
// login greeting; operational picking continues using authenticated Gnani speech.
export default function WorkspaceGreeting({user,voiceLanguage='en-IN',interrupt=false}){
 const language=VOICE_LOCALES[voiceLanguage]?voiceLanguage:'en-IN';
 const entryHour=useRef(new Date().getHours());
 const message=greetingMessage(user,language,entryHour.current);
 const storageKey='finder-auto-greeting-muted:'+user.id;
 const [muted,SetMuted]=useState(()=>{try{return localStorage.getItem(storageKey)==='true'}catch{return false}});
 const [status,SetStatus]=useState('idle');
 const attempted=useRef(false),activeSpeech=useRef(null),alive=useRef(true);
 function stopGreeting(){
  activeSpeech.current=null;
  try{window.speechSynthesis?.cancel()}catch{}
  if(alive.current)SetStatus('idle');
 }
 function speakGreeting(){
  if(status==='starting'||status==='speaking'){stopGreeting();return}
  if(interrupt)return; // Never start greeting over picking, report or other active speech.
  if(typeof window==='undefined'||!window.speechSynthesis||!window.SpeechSynthesisUtterance){
   SetStatus('unavailable');return;
  }
  try{
   window.speechSynthesis.cancel();
   const speech=new window.SpeechSynthesisUtterance(message);
   const locale=VOICE_LOCALES[language]||'en-IN';
   speech.lang=locale;
   const voices=window.speechSynthesis.getVoices?.()||[];
   const match=voices.find(v=>v.lang?.toLowerCase()===locale.toLowerCase()&&FEMALE_VOICE.test(v.name))
    ||voices.find(v=>v.lang?.toLowerCase().split('-')[0]===locale.split('-')[0]&&FEMALE_VOICE.test(v.name))
    ||voices.find(v=>v.lang?.toLowerCase()===locale.toLowerCase());
   if(match)speech.voice=match;
   speech.rate=0.94;speech.pitch=1.05;
   speech.onstart=()=>{if(alive.current&&activeSpeech.current===speech)SetStatus('speaking')};
   speech.onend=()=>{if(alive.current&&activeSpeech.current===speech){activeSpeech.current=null;SetStatus('done')}};
   speech.onerror=()=>{if(alive.current&&activeSpeech.current===speech){activeSpeech.current=null;SetStatus('unavailable')}};
   activeSpeech.current=speech;SetStatus('starting');
   window.speechSynthesis.speak(speech);
  }catch{activeSpeech.current=null;SetStatus('unavailable')}
 }
 useEffect(()=>{
  if(attempted.current)return;
  attempted.current=true;
  if(!muted&&!interrupt)speakGreeting(); // Autoplay may be blocked; Hear greeting remains available.
 },[]);
 useEffect(()=>{if(interrupt&&activeSpeech.current)stopGreeting()},[interrupt]);
 // The greeting yields as soon as the worker starts interacting with Finder;
 // the Hear greeting button is deliberately exempt.
 useEffect(()=>{
  const yieldToUser=event=>{
   if(event.target?.closest?.('.sf-workspace-greeting'))return;
   if(activeSpeech.current)stopGreeting();
  };
  document.addEventListener('pointerdown',yieldToUser,true);
  document.addEventListener('keydown',yieldToUser,true);
  return ()=>{
   document.removeEventListener('pointerdown',yieldToUser,true);
   document.removeEventListener('keydown',yieldToUser,true);
  };
 },[]);
 useEffect(()=>()=>{alive.current=false;activeSpeech.current=null;try{window.speechSynthesis?.cancel()}catch{}},[]);
 function setMuted(next){
  SetMuted(next);
  try{localStorage.setItem(storageKey,String(next))}catch{}
  if(next)stopGreeting();
 }
 return <section className="sf-workspace-greeting" aria-label="Workspace greeting">
  <div className="sf-workspace-greeting-copy">
   <span className="sf-workspace-greeting-icon" aria-hidden="true"><Glyph name="sound"/></span>
   <p>{message}</p>
  </div>
  <div className="sf-workspace-greeting-controls">
   <button type="button" className="sf-greeting-play" onClick={speakGreeting} disabled={interrupt} aria-label={status==='speaking'||status==='starting'?'Stop greeting':'Hear greeting'}>
    <Glyph name="sound"/>{status==='speaking'||status==='starting'?'Stop greeting':'Hear greeting'}
   </button>
   <label className="sf-greeting-mute"><input type="checkbox" checked={muted} onChange={e=>setMuted(e.target.checked)}/><span>Mute automatic greeting</span></label>
  </div>
 </section>;
}
