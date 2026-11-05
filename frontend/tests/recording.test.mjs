import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeWav} from '../src/recording.js';
test('48 kHz microphone becomes 16 kHz mono PCM WAV with correct duration',async()=>{
 const blob=encodeWav([new Float32Array(48000).fill(.5)],48000);
 const view=new DataView(await blob.arrayBuffer());
 assert.equal(view.getUint32(24,true),16000);assert.equal(view.getUint16(22,true),1);
 assert.equal(view.getUint16(34,true),16);assert.equal(view.getUint32(40,true),32000);
 assert.equal(view.getInt16(44,true),16383);
});
test('capture is capped at 28 seconds and empty input is rejected',async()=>{
 assert.throws(()=>encodeWav([],16000));
 const v=new DataView(await encodeWav([new Float32Array(16000*31)],16000).arrayBuffer());
 assert.equal(v.getUint32(40,true),16000*28*2);
});
