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


/**
 * Opt-in Prisma V3 live speech segments. All browser audio goes through the
 * authenticated same-origin Shop Finder proxy; no Gnani credentials reach JS.
 * Server VAD emits finished utterance segments, not word-by-word predictions.
 */
export async function startLiveRecording({language='auto',style='transcribe',enhanced=true,collection='all',onSegment,onComplete,onError}) {
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Microphone unavailable. Use HTTPS or localhost.');
  const params=new URLSearchParams({language,style,enhanced:String(enhanced),collection});
  const url=(location.protocol==='https:'?'wss://':'ws://')+location.host+'/api/voice/live?'+params;
  let socket,stream,context,source,processor,timer,ended=false,stopping=false,opened=false;
  let accumulated='',samples=[],sum=0,count=0,phase=0;
  let sourceRate=48000;
  const release=()=>{
    clearTimeout(timer);
    if(processor){processor.onaudioprocess=null;processor.disconnect();}
    source?.disconnect();
    stream?.getTracks().forEach(track=>track.stop());
    context?.close().catch(()=>{});
    processor=null;source=null;stream=null;context=null;
  };
  const close=(cancel=false)=>{
    if(ended)return;
    ended=true;release();
    if(socket&&socket.readyState===WebSocket.OPEN){
      if(cancel)socket.send(JSON.stringify({type:'cancel'}));
      socket.close(1000);
    }
  };
  const sendFrame=()=>{
    if(socket?.readyState!==WebSocket.OPEN||ended)return;
    const bytes=new Uint8Array(1024),view=new DataView(bytes.buffer);
    for(let i=0;i<512;i++){let v=Math.max(-1,Math.min(1,samples[i]||0));view.setInt16(2*i,Math.round(v*(v<0?32768:32767)),true);}
    samples=samples.slice(512);
    socket.send(bytes);
  };
  const feed=(data)=>{
    if(ended||stopping)return;
    for(let i=0;i<data.length;i++){
      sum+=data[i];count++;phase+=16000;
      if(phase>=sourceRate){
        samples.push(sum/count);phase-=sourceRate;sum=0;count=0;
        if(samples.length>=512)sendFrame();
      }
    }
  };
  const handle={
    stop(cancel=false){
      if(ended||stopping)return;
      stopping=true;release();
      if(cancel){close(true);return;}
      if(socket?.readyState!==WebSocket.OPEN){close();onError(Error('Live voice disconnected. Try recorded voice.'));return;}
      if(samples.length){while(samples.length<512)samples.push(0);sendFrame();}
      socket.send(JSON.stringify({type:'stop'}));
    }
  };
  try{
    socket=new WebSocket(url);
    await new Promise((resolve,reject)=>{
      let settled=false;
      const settle=(err)=>{if(settled)return;settled=true;err?reject(err):resolve();};
      const connectionTimeout=setTimeout(()=>settle(Error('Live voice connection timed out. Use recorded voice.')),12000);
      socket.onmessage=event=>{
        let message;
        try{message=JSON.parse(event.data);}catch{return;}
        if(message.type==='ready'){opened=true;clearTimeout(connectionTimeout);settle();}
        else if(message.type==='segment'&&!ended){
          if(typeof message.text==='string'&&message.text.trim()){
            accumulated=[accumulated,message.text.trim()].filter(Boolean).join(' ');
            onSegment?.(accumulated,message.detected_language_code);
          }
        }else if(message.type==='complete'&&!ended){
          if(!stopping)return;
          close();
          const result=message.transcript||accumulated;
          if(result.trim())onComplete(result,message.search_language,message);
          else onError(Error('No speech detected. Try recorded voice.'));
        }else if(message.type==='error'&&!ended){
          close();clearTimeout(connectionTimeout);
          const error=Error(message.message||'Live voice unavailable.');
          if(!opened)settle(error);else onError(error);
        }
      };
      socket.onerror=()=>{if(ended)return;const err=Error('Live voice connection failed. Try recorded voice.');close();clearTimeout(connectionTimeout);if(!opened)settle(err);else onError(err);};
      socket.onclose=()=>{if(ended)return;close();clearTimeout(connectionTimeout);const err=Error('Live voice closed. Try recorded voice.');if(!opened)settle(err);else onError(err);};
    });
    if(ended)throw Error('Live voice ended before microphone started.');
    stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
    context=new AudioContext();
    await context.resume();
    sourceRate=context.sampleRate;
    source=context.createMediaStreamSource(stream);
    processor=context.createScriptProcessor(2048,1,1);
    processor.onaudioprocess=e=>feed(e.inputBuffer.getChannelData(0));
    source.connect(processor);
    processor.connect(context.destination);
    timer=setTimeout(()=>handle.stop(),28000);
    return handle;
  }catch(e){
    close(true);
    throw Error(e.name==='NotAllowedError'?'Microphone permission denied. Enable it or use text search.':e.message);
  }
}
