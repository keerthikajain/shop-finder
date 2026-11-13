import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {APP_LANGUAGES} from '../src/locale-multilingual.js';
import {translate} from '../src/locale.js';

// Protect against the regression where a failed server save silently ends
// the owner voice conversation and leaves no automatic retry.
test('guided owner changes remain at confirmation when saving fails',async()=>{
 const src=await readFile(new URL('../src/warehouse-manage.jsx',import.meta.url),'utf8');
 assert.match(src,/const saved=await confirmMove\(\);return saved\?false:'retry';/);
 assert.match(src,/const saved=await markResolved\(\);return saved\?false:'retry';/);
 assert.doesNotMatch(src,/await confirmMove\(\);return false;/);
 assert.doesNotMatch(src,/await markResolved\(\);return false;/);
 assert.match(src,/try\{await onSave\(\)\}catch\(e\)/);
 assert.match(src,/try\{await reload\(\)\}catch\(e\)/);
});

test('product filter and recent-request labels use app localization',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(src,/<label>Product type<select/);
 assert.doesNotMatch(src,/<label>Brand<select/);
 assert.doesNotMatch(src,/<summary>Saved recent requests<\/summary>/);
 assert.match(src,/aria-label=\{t\('Product type'\)\}/);
 assert.match(src,/aria-label=\{t\('Brand'\)\}/);
 assert.match(src,/<summary>\{t\('Recent requests'\)\}<\/summary>/);
 for(const [locale] of APP_LANGUAGES){
  if(locale==='en')continue;
  for(const label of ['Product type','Brand','Recent requests']){
   assert.notEqual(translate(locale,label),label,locale+': '+label);
  }
 }
});


test('guided voice UI follows app locale but recognition keeps speech locale',async()=>{
 const src=await readFile(new URL('../src/guided-voice-turn.jsx',import.meta.url),'utf8');
 assert.match(src,/reportUiCopy\(appLanguage,key\)/);
 assert.match(src,/const appLanguage=useContext\(Locale\)/);
 assert.match(src,/dialogueControl\(language,transcript\)/);
 assert.match(src,/URLSearchParams\(\{language,style:'transcribe'/);
});
