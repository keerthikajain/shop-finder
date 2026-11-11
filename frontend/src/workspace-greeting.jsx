import React,{useEffect,useRef} from 'react';
import './workspace-greeting.css';
import {playWelcomeOnce,stopWelcome} from './welcome-audio.js';

const VOICE_LOCALES={'en-IN':'en-IN','hi-IN':'hi-IN','hi-en':'hi-en','te-IN':'te-IN'};

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
   morning:`Good morning, ${first}welcome back to Finder! Let's make finding things easier!`,
   afternoon:`Good afternoon, ${first}welcome back to Finder! Let's make finding things easier!`,
   evening:`Good evening, ${first}welcome back to Finder! Let's make finding things easier!`
  },
  'hi-IN':{
   morning:`सुप्रभात, ${first}फाइंडर में फिर से स्वागत है। चलिए, आज का काम आसान बनाते हैं!`,
   afternoon:`नमस्कार, ${first}फाइंडर में फिर से स्वागत है। चलिए, आज का काम आसान बनाते हैं!`,
   evening:`शुभ संध्या, ${first}फाइंडर में फिर से स्वागत है। चलिए, आज का काम आसान बनाते हैं!`
  },
  'hi-en':{
   morning:`Good morning, ${first}Finder mein welcome back! Chaliye, aaj ka kaam aasan banate hain!`,
   afternoon:`Good afternoon, ${first}Finder mein welcome back! Chaliye, aaj ka kaam aasan banate hain!`,
   evening:`Good evening, ${first}Finder mein welcome back! Chaliye, aaj ka kaam aasan banate hain!`
  },
  'te-IN':{
   morning:`శుభోదయం, ${first}ఫైండర్‌కు మళ్లీ స్వాగతం! ఈ రోజు పని మరింత సులభంగా చేద్దాం!`,
   afternoon:`శుభ మధ్యాహ్నం, ${first}ఫైండర్‌కు మళ్లీ స్వాగతం! ఈ రోజు పని మరింత సులభంగా చేద్దాం!`,
   evening:`శుభ సాయంత్రం, ${first}ఫైండర్‌కు మళ్లీ స్వాగతం! ఈ రోజు పని మరింత సులభంగా చేద్దాం!`
  }
 };
 // Guest speech must not suggest the user has a named account.
 if(!name){
  const guest={
    'en-IN':"Hi there! Welcome to Finder. Let's make finding things easier!",
   'hi-IN':'नमस्ते! फाइंडर में आपका स्वागत है। चलिए, आज का काम आसान बनाते हैं!',
   'hi-en':'Hi there! Finder mein aapka welcome hai. Chaliye, aaj ka kaam aasan banate hain!',
   'te-IN':'నమస్కారం! ఫైండర్‌కు స్వాగతం. ఈ రోజు పని మరింత సులభంగా చేద్దాం!'
  };
  return guest[language]||guest['en-IN'];
 }
 return (text[language]||text['en-IN'])[time];
}

// Use authenticated Gnani speech (Riyaa on Timbre v3), then fall back to
// browser speech when the provider is disabled or the browser blocks playback.
export default function WorkspaceGreeting({user,voiceLanguage='en-IN',interrupt=false}){
 const language=VOICE_LOCALES[voiceLanguage]?voiceLanguage:'en-IN';
 const entryHour=useRef(new Date().getHours());
 const message=greetingMessage(user,language,entryHour.current);
 const attempted=useRef(false),activeSpeech=useRef(null);
 function stopGreeting(){
  if(activeSpeech.current)stopWelcome(activeSpeech.current);
  activeSpeech.current=null;
 }
 useEffect(()=>{
  if(attempted.current)return;
  attempted.current=true;
  if(interrupt)return;
  const controller=new AbortController();
  const playback={controller,audio:null,url:null};
  activeSpeech.current=playback;
  playWelcomeOnce({
   url:'/api/voice/welcome',language,text:message,
   body:{language,hour:entryHour.current},controller,playback
  });
 },[]);
 useEffect(()=>{if(interrupt)stopGreeting()},[interrupt]);
 // Give priority to search, recording, navigation and spoken picking commands.
 useEffect(()=>{
  const yieldToUser=()=>stopGreeting();
  document.addEventListener('pointerdown',yieldToUser,true);
  document.addEventListener('keydown',yieldToUser,true);
  return ()=>{
   document.removeEventListener('pointerdown',yieldToUser,true);
   document.removeEventListener('keydown',yieldToUser,true);
  };
 },[]);
 useEffect(()=>()=>stopGreeting(),[]);
 return <section className="sf-workspace-greeting" aria-label="Workspace greeting">
  <p>{message}</p>
 </section>;
}
