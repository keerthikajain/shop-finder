import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {APP_LANGUAGES} from '../src/locale.js';
import {APP_GREETING_VOICE,PUBLIC_GREETING,greetingForApp} from '../src/greeting-language.js';

test('every app language has a calm welcome and a supported Gnani voice locale',()=>{
 for(const [app] of APP_LANGUAGES){
  assert.ok(APP_GREETING_VOICE[app],app+': no voice locale');
  assert.ok(PUBLIC_GREETING[app],app+': no fixed greeting');
  assert.ok(PUBLIC_GREETING[app].length<95,app+': greeting is too long');
  assert.doesNotMatch(PUBLIC_GREETING[app],/[!！]/);
 }
 assert.equal(PUBLIC_GREETING.en,'Hi, welcome to Finder.');
 assert.equal(PUBLIC_GREETING.hi,'नमस्ते, फाइंडर में आपका स्वागत है।');
});

test('workspace greeting stays calm and follows the selected APP language',()=>{
 assert.match(greetingForApp('en',8,'Keerthi'),/^Good morning, Keerthi\./);
 assert.match(greetingForApp('hi',19,'Keerthi'),/^शुभ संध्या, Keerthi\./);
 assert.match(greetingForApp('te',8,'Keerthi'),/^శుభోదయం, Keerthi\./);
 assert.match(greetingForApp('kn',13,'Keerthi'),/^ನಮಸ್ಕಾರ, Keerthi\./);
 for(const [app] of APP_LANGUAGES){
  for(const hour of [9,15,20]){
   const phrase=greetingForApp(app,hour,'Worker');
   assert.match(phrase,/Worker/);
   assert.doesNotMatch(phrase,/[!！]/);
   assert.ok(phrase.length<115,app+': workspace greeting is too long');
  }
  assert.equal(greetingForApp(app,8,''),PUBLIC_GREETING[app]);
 }
});

test('sign-in uses the app language on change and no browser voice replaces Gnani',async()=>{
 const account=await readFile(new URL('../src/accounts.jsx',import.meta.url),'utf8');
 const audio=await readFile(new URL('../src/welcome-audio.js',import.meta.url),'utf8');
 assert.match(account,/APP_GREETING_VOICE\[language\]/);
 assert.match(account,/welcomeAttempted\.current===language/);
 assert.match(account,/\[ready,configured,language\]/);
 assert.match(account,/gnaniOnly:true/);
 assert.match(audio,/if\(!gnaniOnly\)localVoice/);
 assert.doesNotMatch(account,/GNANI_API_KEY|GNANI_TTS_VOICE/);
});

test('workspace greeting follows app language and does not change picking speech language',async()=>{
 const app=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const workspace=await readFile(new URL('../src/workspace-greeting.jsx',import.meta.url),'utf8');
 assert.match(app,/<WorkspaceGreeting user=\{user\} appLanguage=\{appLanguage\}/);
 assert.match(workspace,/APP_GREETING_VOICE\[appLanguage\]/);
 assert.match(workspace,/gnaniOnly:true/);
 assert.match(workspace,/if\(attempted\.current\)return/);
 assert.match(workspace,/if\(interrupt\)stopGreeting\(\)/);
 assert.doesNotMatch(workspace,/voiceLanguage=\{/);
});
