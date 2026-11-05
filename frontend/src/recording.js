export function encodeWav(chunks, sourceRate) {
  const length=chunks.reduce((sum,c)=>sum+c.length,0);
  if(!length)throw Error('No audio captured. Check microphone permissions and try again.');
  const source=new Float32Array(length);let offset=0;
  for(const chunk of chunks){source.set(chunk,offset);offset+=chunk.length;}
  const rate=16000, count=Math.min(Math.floor(length*rate/sourceRate),28*rate);
  const buffer=new ArrayBuffer(44+count*2),view=new DataView(buffer);
  const str=(pos,text)=>[...text].forEach((c,i)=>view.setUint8(pos+i,c.charCodeAt(0)));
  str(0,'RIFF');view.setUint32(4,36+count*2,true);str(8,'WAVE');str(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  str(36,'data');view.setUint32(40,count*2,true);
  // Average source intervals to limit aliasing when reducing sample rate.
  for(let i=0;i<count;i++){let sum=0,n=0;const begin=Math.floor(i*sourceRate/rate),end=Math.max(begin+1,Math.floor((i+1)*sourceRate/rate));for(let j=begin;j<end&&j<source.length;j++){sum+=source[j];n++;}const v=Math.max(-1,Math.min(1,sum/(n||1)));view.setInt16(44+i*2,v*(v<0?32768:32767),true);}
  return new Blob([buffer],{type:'audio/wav'});
}
export async function startRecording(onComplete,onError) {
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Microphone unavailable. Open the app on localhost or HTTPS.');
  let stream,context,source,processor,timer,stopped=false;const chunks=[];
  function release(){clearTimeout(timer);if(processor){processor.onaudioprocess=null;processor.disconnect()}source?.disconnect();stream?.getTracks().forEach(t=>t.stop());context?.close().catch(()=>{});}
  function stop(cancel=false){if(stopped)return;stopped=true;const rate=context?.sampleRate;release();if(cancel)return;try{onComplete(encodeWav(chunks,rate))}catch(e){onError(e)}}
  try{stream=await navigator.mediaDevices.getUserMedia({audio:true});context=new AudioContext();await context.resume();source=context.createMediaStreamSource(stream);processor=context.createScriptProcessor(4096,1,1);processor.onaudioprocess=e=>chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));source.connect(processor);processor.connect(context.destination);timer=setTimeout(()=>stop(),28000);return {stop};}
  catch(e){release();throw Error(e.name==='NotAllowedError'?'Microphone permission denied. Allow it in the browser or type your question.':e.message)}
}
