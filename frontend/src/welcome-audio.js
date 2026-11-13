// Shared one-shot welcome: authenticated server-side Gnani Timbre (female Riyaa
// on v3) with a local speech fallback if the configured provider is unavailable.
// The caller owns the AbortController and must cancel on navigation or interaction.
const FEMALE_VOICE=/\b(zira|heera|veena|samantha|victoria|karen|tessa|moira|fiona|female|woman|aria|jenny|neerja|swara)\b/i;
const LOCALES={'en-IN':'en-IN','hi-IN':'hi-IN','hi-en':'en-IN','te-IN':'te-IN','kn-IN':'kn-IN'};

export function stopWelcome(playback){
 if(!playback)return;
 playback.controller.abort();
 try{playback.audio?.pause()}catch{}
 if(playback.url)URL.revokeObjectURL(playback.url);
 try{window.speechSynthesis?.cancel()}catch{}
}

function localVoice(text,language,controller){
 if(controller.signal.aborted||typeof window==='undefined'||!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;
 const locale=LOCALES[language]||'en-IN';
 try{
  window.speechSynthesis.cancel();
  const utterance=new window.SpeechSynthesisUtterance(text);
  utterance.lang=locale;utterance.rate=0.94;utterance.pitch=1.06;
  const voices=window.speechSynthesis.getVoices?.()||[];
  const voice=voices.find(v=>v.lang?.toLowerCase()===locale.toLowerCase()&&FEMALE_VOICE.test(v.name))
   ||voices.find(v=>v.lang?.toLowerCase().split('-')[0]===locale.split('-')[0]&&FEMALE_VOICE.test(v.name))
   ||voices.find(v=>v.lang?.toLowerCase()===locale.toLowerCase());
  if(voice)utterance.voice=voice;
  window.speechSynthesis.speak(utterance);
 }catch{/* Browser speech can be blocked by autoplay policies. */}
}

export async function playWelcomeOnce({url,language,text,controller,playback,body,gnaniOnly=false}){
 try{
  const request={signal:controller.signal};
  if(body){
   request.method='POST';
   request.headers={'Content-Type':'application/json','X-Shop-Request':'1'};
   request.body=JSON.stringify(body);
  }
  const response=await fetch(url,request);
  if(!response.ok)throw Error('Gnani welcome audio unavailable');
  const wav=await response.blob();
  if(controller.signal.aborted)return;
  const objectURL=URL.createObjectURL(wav);
  playback.url=objectURL;
  const audio=new Audio(objectURL);
  playback.audio=audio;
  const clear=()=>{
   if(playback.url===objectURL){URL.revokeObjectURL(objectURL);playback.url=null;}
   if(playback.audio===audio)playback.audio=null;
  };
  audio.onended=clear;
  audio.onerror=clear;
  await audio.play();
 }catch(error){
  if(controller.signal.aborted)return;
  try{playback.audio?.pause()}catch{}
  if(playback.url){URL.revokeObjectURL(playback.url);playback.url=null;}
  playback.audio=null;
  // Finder greetings must use Gnani's voice rather than a different browser voice.
  if(!gnaniOnly)localVoice(text,language,controller);
 }
}
