import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {APP_LANGUAGES} from '../src/locale-multilingual.js';
import {translate} from '../src/locale.js';
import {uiLanguageCoverage} from '../src/locale-ui-coverage.js';

const core=[
 'Business setup','Activity','My profile','Full name','Phone number (optional)',
 'Staff reference (optional)','Your phone number is optional and visible only to you and the workspace owner.',
 'Profile saved.','Quick walkthrough','WORKSPACE','Owner workspace','Staff workspace',
 'Use at least 12 characters.','Create workspace','Create a free workspace',
 'Your workspace data is kept separate from other workspaces.',
 'Already have an account? Sign in','Explore Shop Finder',
 'Your workspace data is kept separate from other workspaces.',
 'Verify each worker\'s identity before approval. A workspace code alone never gives access.',
 'New workspace code (displayed only once)','Confirm owner password',
 'Generate a one-time code for a worker. It expires after 24 hours and cannot grant Owner access.',
 'New one-time code (copy and share privately)','Hide code',
 'Visitor feedback','View visitor suggestions','Leave guest workspace',
 'Review feedback from guest workspace visitors. Suggestions are not automatically applied.',
 'Voice search is enabled. Check your microphone from Find items before using it.',
 'Voice search is unavailable. You can still find items by typing.',
 'Create your own workspace to try the complete app, including importing products and setting up shelves.',
 'Feedback is welcome. Voice features need microphone permission and may be limited.',
 'You\'re using a temporary guest workspace. Changes here are not stored in a personal workspace.'
];
test('every supported app language localizes shared navigation and account essentials',()=>{
 for(const [language] of APP_LANGUAGES){
  if(language==='en')continue;
  for(const key of core){
   const localized=translate(language,key);
   assert.ok(localized&&localized!==key,`${language} missing: ${key}`);
  }
 }
 assert.equal(APP_LANGUAGES.length,10);
});
test('record values and identifiers are never translated automatically',()=>{
 for(const [language] of APP_LANGUAGES){
  assert.equal(translate(language,'CLO-001'),'CLO-001');
  assert.equal(translate(language,'Rack-43-Employee-Name'),'Rack-43-Employee-Name');
  assert.equal(translate(language,'Unknown product label'),'Unknown product label');
 }
});
test('localized copy is actually used by profile and workspace forms',async()=>{
 const src=await readFile(new URL('../src/accounts.jsx',import.meta.url),'utf8');
 for(const key of ['My profile','Full name','Phone number (optional)','Staff reference (optional)',
  'Your phone number is optional and visible only to you and the workspace owner.',
  'Create workspace','Create a free workspace','Use at least 12 characters.']){
  assert.ok(src.includes(`t('${key}')`),key);
 }
 assert.ok(src.includes('M(t(\'Profile saved.\'))'));
});
test('shared nav and visitor settings do not bypass app-language selection',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.ok(src.includes('>{t(name)}</span>'));
 for(const key of ['Visitor feedback','View visitor suggestions','Leave guest workspace',
  'Help us improve Shop Finder','Send feedback'])
  assert.ok(src.includes(`t('${key}')`),key);
 assert.ok(uiLanguageCoverage.hi['Business setup'].includes('व्यवसाय'));
 assert.ok(uiLanguageCoverage.te['Activity'].length>0);
});

test('signup, staff approvals, and manager access are translated in every app language',()=>{
 const keys=[
  'Create your workspace',
  'Organize your products, manage locations, and help your team find items faster.',
  'Find your team and start working in your shared workspace.',
  'Sign in to pick up where you left off.',
  'Choose approval managers',
  'Loading staff accounts…',
  'No staff members are ready to become managers yet.',
  'Approve pending staff requests above first.',
  'Enable a staff account below first.',
  'Create a staff account below or invite someone to join your store.',
  'Go to create staff account',
  'eligible staff member(s)',
  'Signed in as',
  'Or explore instantly, without signing up',
  'Explore Shop Finder without an account.',
  'Try Shop Finder',
  'Registration:',
 ];
 for(const [language] of APP_LANGUAGES){
  if(language==='en')continue;
  for(const key of keys)assert.notEqual(translate(language,key),key,language+': '+key);
 }
});
