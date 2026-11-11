// Play only server-approved Gnani readbacks. Audio bytes never expose the API key.
export async function playReviewAudio(endpoint,language){
 const controller=new AbortController();
 const response=await fetch('/api/warehouse/'+endpoint,{
  method:'POST',
  credentials:'same-origin',
  headers:{'Content-Type':'application/json','X-Shop-Request':'1'},
  body:JSON.stringify({language}),
  signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)])
 });
 if(!response.ok){
  let message='Voice playback unavailable. Review the location on screen.';
  try{const body=await response.json();message=body.detail||message}catch{}
  throw Error(message);
 }
 const url=URL.createObjectURL(await response.blob());
 const audio=new Audio(url);
 let closed=false;
 const stop=()=>{
  if(closed)return;
  closed=true;
  audio.pause();
  audio.removeAttribute('src');
  URL.revokeObjectURL(url);
 };
 audio.onended=stop;
 try{await audio.play()}catch(error){stop();throw error}
 return stop;
}
