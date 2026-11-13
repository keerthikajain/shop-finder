import React,{useEffect,useRef} from 'react';
import {playWelcomeOnce,stopWelcome} from './welcome-audio.js';
import {APP_GREETING_VOICE,greetingForApp} from './greeting-language.js';
const APP_LANGUAGE_BY_VOICE=Object.fromEntries(Object.entries(APP_GREETING_VOICE).map(([app,voice])=>[voice,app]));

// Use the staff member's saved display name when possible; never fabricate a guest name.
export function greetingName(user){
 if(!user||user.is_demo)return '';
 const candidate=String(user.display_name||user.username||'').trim().split(/\s+/u)[0]
  .replace(/[^\p{L}\p{M}\p{N}'-]/gu,'').slice(0,32);
 return candidate||'';
}

export function greetingMessage(user,language='en-IN',hour=new Date().getHours()){
 const appLanguage=APP_LANGUAGE_BY_VOICE[language]||language;
 return greetingForApp(appLanguage,hour,greetingName(user));
}

// Use authenticated Gnani speech (Riyaa on Timbre v3). Do not substitute
// a browser voice when provider audio is unavailable.
export default function WorkspaceGreeting({user,appLanguage='en',interrupt=false}){
 const language=APP_GREETING_VOICE[appLanguage]||'en-IN';
 const entryHour=useRef(new Date().getHours());
 const message=greetingForApp(appLanguage,entryHour.current,greetingName(user));
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
   body:{language,hour:entryHour.current},controller,playback,gnaniOnly:true
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
 // The greeting is audio-only; no banner competes with the search workspace.
 return null;
}
