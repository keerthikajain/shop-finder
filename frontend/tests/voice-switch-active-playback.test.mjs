import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('switching speech language during playback repeats location automatically',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(ui,/const wasSpeaking=speaking/);
 assert.match(ui,/const wasVoiceTurnActive=wasSpeaking\|\|\(!voiceGuidePaused&&!voiceFlowStopped\.current\)/);
 assert.match(ui,/const shouldReplay=wasVoiceTurnActive&&!pickPaused/);
 assert.match(ui,/if\(previous&&shouldReplay&&!modal&&page==='find'&&voice\)/);
 assert.match(ui,/await api\('\/tasks\/'\+current\.id\+'\/speech-language',\{language:nextLanguage\}\)/);
 assert.match(ui,/await playPickGuidance\('repeat',next,index,true\)/);
 assert.match(ui,/if\(played&&shouldResumeHandsFree\)VGP\(false\)/);
});
test('language switch respects deliberate pause and avoids duplicate handoff',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(ui,/const shouldResumeHandsFree=handsFree&&shouldReplay/);
 assert.match(ui,/if\(!ACTIVE_VOICE_CODES\.has\(nextLanguage\)\|\|busy\|\|speechSwitchRef\.current/);
 assert.match(ui,/speechSwitchRef\.current=true;SetSpeechSwitching\(true\)/);
 assert.match(ui,/stopVoiceFlow\(\)/);
 assert.match(ui,/finally\{speechSwitchRef\.current=false;SetSpeechSwitching\(false\)\}/);
 assert.match(ui,/enabled=\{!speechSwitching&&!busy&&!speaking&&!modal&&page==='find'\}/);
});
