// In-memory, anonymous timing samples for comparing Finder on phone and desktop.
// Contains no transcript, item, account, recording, or network address.
// Inspect window.__finderVoiceTimings in DevTools; samples never leave the browser.
const MAX_SAMPLES=60;
const now=()=>typeof performance!=='undefined'?performance.now():Date.now();

export function voiceClock(){return now()}
export function recordVoiceTiming(stage,startedAt){
 if(typeof window==='undefined'||!Number.isFinite(startedAt))return;
 const elapsedMs=Math.round(now()-startedAt);
 if(elapsedMs<0||elapsedMs>120000)return;
 const device=window.matchMedia?.('(max-width:700px)')?.matches?'mobile-layout':'desktop-layout';
 const samples=Array.isArray(window.__finderVoiceTimings)?window.__finderVoiceTimings:[];
 samples.push({stage,elapsedMs,device});
 if(samples.length>MAX_SAMPLES)samples.splice(0,samples.length-MAX_SAMPLES);
 window.__finderVoiceTimings=samples;
}
export function noteVoiceRecognized(){
 if(typeof window!=='undefined')window.__finderVoiceRecognizedAt=now();
}
export function noteVoiceResponseStarted(){
 if(typeof window==='undefined')return;
 const started=window.__finderVoiceRecognizedAt;
 window.__finderVoiceRecognizedAt=null;
 if(Number.isFinite(started))recordVoiceTiming('recognized-to-first-audio',started);
}
