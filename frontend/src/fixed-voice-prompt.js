// Only reusable, non-personal voice step prompts belong in this cache.
// Never cache readbacks containing item names, user notes, or live search results.
// A small per-tab LRU avoids repeated TTS requests without persistent audio storage.
const MAX_PROMPTS=24;
const prompts=new Map();

export async function fixedVoicePrompt(step,language,{signal}={}){
 if(!/^[a-z][a-z0-9_]*$/.test(step))throw Error('Invalid voice prompt.');
 const key=language+':'+step;
 if(signal?.aborted)throw new DOMException('Voice request cancelled.','AbortError');
 const existing=prompts.get(key);
 if(existing){
  prompts.delete(key);prompts.set(key,existing);
  return existing;
 }
 const response=await fetch('/api/warehouse/voice/step-audio?step='+encodeURIComponent(step),{
  method:'POST',credentials:'same-origin',
  headers:{'X-Shop-Request':'1','Content-Type':'application/json'},
  body:JSON.stringify({language}),signal
 });
 if(!response.ok){
  const body=await response.json().catch(()=>({}));
  throw Error(body.detail||'Voice reply unavailable. The saved result is shown on screen.');
 }
 const audio=await response.blob();
 if(signal?.aborted)throw new DOMException('Voice request cancelled.','AbortError');
 prompts.set(key,audio);
 if(prompts.size>MAX_PROMPTS)prompts.delete(prompts.keys().next().value);
 return audio;
}
