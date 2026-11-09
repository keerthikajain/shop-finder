import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const frontend=fileURLToPath(new URL('..',import.meta.url));
const directory=await mkdtemp(path.join(tmpdir(),'warehouse-render-'));
after(()=>rm(directory,{recursive:true,force:true}));
const bundle=path.join(directory,'render.cjs');
await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {Place,Specs,Mark} from './src/warehouse-ui.jsx';import {Locale} from './src/locale.js';export const location=(p,language='en')=>renderToStaticMarkup(<Locale.Provider value={language}><Place location={p}/></Locale.Provider>);export const specs=p=>renderToStaticMarkup(<Specs item={p} labels={{size_uk:'Size (UK)',capacity_l:'Capacity (L)'}}/>);export const logo=()=>renderToStaticMarkup(<Mark/>);`,resolveDir:frontend,loader:'jsx'},bundle:true,platform:'node',format:'cjs',outfile:bundle,logLevel:'silent'});
const {location,specs,logo}=await import(pathToFileURL(bundle));
const place={facility:'Hub A',zone:'Footwear',aisle:'2',rack:'B',shelf:'4',bin:'008'};
test('warehouse location displays all six levels and preserves leading-zero bin codes',()=>{const html=location(place);for(const x of Object.values(place))assert.ok(html.includes(x));assert.match(html,/>008</)});
test('Hindi labels do not translate identifiers or stored location names',()=>{const html=location(place,'hi');assert.match(html,/गलियारा/);assert.match(html,/शेल्फ/);assert.match(html,/Hub A/);assert.match(html,/>008</)});
test('specifications keep size systems and units visible',()=>{const html=specs({specs:{size_uk:'7',capacity_l:'1.5'}});assert.match(html,/Size \(UK\)/);assert.match(html,/1.5 L/)});
test('catalogue text cannot inject HTML into location or specification surfaces',()=>{assert.ok(!location({...place,zone:'<img src=x onerror=alert(1)>'}).includes('<img'));assert.match(specs({specs:{size_uk:'<script>x</script>'}}),/&lt;script&gt;/)});
test('logo is labelled for assistive technology',()=>{assert.match(logo(),/aria-label="Finder logo"/)});

test('mobile More is a page with an explicit back path, not a blocking dialog',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(source,/onClick=\{\(\)=>navigate\('more'\)\}/);
 assert.match(source,/page==='more'&&<section className="sf-more-page"/);
 assert.match(source,/function goBack\(\)\{navigate\('more'\)\}/);
 assert.doesNotMatch(source,/modal\?\.type==='menu'/);
});
test('mobile More keeps role-restricted tasks and direct access to primary sections',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(source,/owner&&<button type="button" onClick=\{\(\)=>navigate\('import'\)\}/);
 assert.match(source,/owner&&<button type="button" onClick=\{\(\)=>navigate\('business'\)\}/);
 assert.match(source,/onClick=\{\(\)=>navigate\('review'\)\}/);
 assert.match(source,/onClick=\{\(\)=>navigate\('settings'\)\}/);
 assert.match(source,/className="sf-mobile-more"/);
});

test('More offers scan as a task without unrelated filters or setup banners',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.ok(src.includes("['find','catalogue','locations'].includes(page)&&<button type=\"button\" className=\"sf-header-scan\""));
 assert.ok(src.includes("onClick={()=>D({type:'lookup'})}><span className=\"sf-more-icon\"><Glyph name=\"scan\"/>"));
 assert.ok(src.includes("meta&&!['find','account','business','more','settings'].includes(page)"));
 assert.ok(src.includes("!meta.settings.configured&&page==='find'"));
});

test('mobile Find navigation keeps a compact label while desktop keeps the full label',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(source,/className="sf-nav-desktop-label"/);
 assert.match(source,/className="sf-nav-mobile-label"/);
 assert.match(source,/t\(id==='find'\?'Find':name\)/);
 assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
});
test('mobile discovery cards use compact two-column layout with a smaller image',async()=>{
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(css,/\.sf-find-page \.sf-catalogue-card\{\s*display:grid;grid-template-columns:104px minmax\(0,1fr\)/);
 assert.match(css,/\.sf-find-page \.sf-catalogue-card>\.sf-product-art\{[\s\S]*?height:112px/);
});

test('Find filters use labelled two-column controls on narrow phones',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(src,/aria-controls="wh-packs"/);
 assert.ok(src.includes("filtersOpen?'is-open':''"));
 assert.match(css,/\.sf-compact-app\.sf-find-page #wh-packs\.sf-search-filters\.is-open\{display:grid\}/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
test('mobile Speak remains contained by bottom nav and catalogue is still accessible',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(src,/className="sf-view-catalogue"/);
 assert.match(src,/onClick=\{\(\)=>navigate\('catalogue'\)\}/);
 assert.match(css,/\.sf-compact-app \.wh-sidebar nav \.sf-mobile-speak>span\{/);
 assert.match(css,/top:57px;bottom:auto/);
});

test('only pages opened from More have Back to More, not bottom navigation pages',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(source,/\['import','business','review','settings'\]\.includes\(page\)&&<button className="sf-more-back sf-page-back"/);
 assert.match(source,/onClick=\{goBack\}/);
 assert.match(source,/function navigate\(p\)/);
 assert.doesNotMatch(source,/pageHistory.current.push/);
 assert.match(source,/window.scrollTo\(0,0\)/);
 assert.doesNotMatch(source,/moreReturn.current/);
});
test('catalogue stays the same accessible table with responsive card styling',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const styles=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(source,/<section className="wh-panel wh-catalogue">/);
 assert.match(source,/<div className="wh-table-wrap"><table>/);
 assert.match(source,/aria-label=\{t\('Open'\)\+' '\+p.sku\}/);
 assert.match(styles,/\.sf-compact-app \.wh-catalogue \.wh-table-wrap tr\{/);
 assert.match(styles,/grid-template-columns:minmax\(0,1fr\) auto/);
 assert.match(styles,/\.sf-compact-app \.wh-catalogue \.wh-table-wrap td:nth-child\(2\)/);
 assert.match(styles,/\.sf-compact-app \.wh-catalogue \.wh-table-wrap \.wh-specs>span/);
});

test('location feedback is explicit and keeps no-answer searches out of review',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(source,/\/tasks\/'\+task.id\+'\/location-check'/);
 assert.match(source,/className="sf-location-yes"/);
 assert.match(source,/className="sf-location-wrong"/);
 assert.match(source,/location_report_open/);
 assert.match(source,/kind:location\?'wrong_location':'general'/);
});
test('More includes Settings with language, appearance and account controls',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(source,/page==='settings'&&<section className="sf-settings-page"/);
 assert.match(source,/id="sf-settings-language"/);
 assert.match(source,/showLanguage=\{false\}/);
 assert.match(source,/t\('Appearance'\)/);
 assert.doesNotMatch(source,/page==='account'&&<AccountSettings/);
});

test('one-tap mobile Speak starts a Gnani recording from any section',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/id==='locations'&&\(voice\?<VoiceButton nav enabled=\{!busy\}/);
 assert.match(src,/if\(page!=='find'\)navigate\('find'\)/);
 assert.match(src,/Q\(text\);DSL\(detected\);VQ\(true\);taskVoice.current=true/);
 // When voice is unavailable, the center shortcut becomes Scan (not a second Find).
 assert.match(src,/id==='locations'&&\(voice\?<VoiceButton nav enabled=\{!busy\}/);
 assert.match(src,/className="sf-mobile-speak" type="button" aria-label=\{t\('Scan a label'\)\}/);
 assert.match(src,/onClick=\{\(\)=>D\(\{type:'lookup'\}\)\}/);
 assert.doesNotMatch(src,/Voice unavailable\. Open text search/);
 assert.doesNotMatch(src,/if\(page!=='find'\)\{navigate\('find'\);return\}/);
});

test('secondary Back is available only in phone layout while desktop uses the sidebar',async()=>{
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 const jsx=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(jsx,/\['import','business','review','settings'\]\.includes\(page\)&&<button className="sf-more-back sf-page-back"/);
 assert.match(css,/@media \(min-width:701px\)\{\s*\.sf-compact-app \.sf-page-back\{display:none!important\}/);
 assert.match(css,/@media \(max-width:700px\)/);
});
test('authenticated header exposes working light and dark theme toggle on desktop and mobile',async()=>{
 const jsx=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(jsx,/className="wh-icon-button sf-header-theme"/);
 assert.match(jsx,/aria-pressed=\{theme==='dark'\}/);
 assert.match(jsx,/onClick=\{\(\)=>TH\(theme==='dark'\?'light':'dark'\)\}/);
 assert.match(css,/\.sf-compact-app \.wh-top-actions \.sf-header-theme\{/);
 assert.match(css,/display:inline-flex!important/);
});

test('account actions are grouped and logout is separate from staff creation',async()=>{
 const src=await readFile(new URL('../src/accounts.jsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(src,/className="sf-account-form sf-profile-form"/);
 assert.match(src,/className="sf-account-form sf-password-form"/);
 assert.match(src,/className="sf-account-form sf-staff-create-form"/);
 assert.match(src,/className="sf-account-footer"/);
 assert.match(src,/className="secondary sf-account-logout"/);
 assert.match(css,/\.sf-account-panel \.sf-account-form-actions/);
 assert.match(css,/\.sf-account-panel \.sf-account-footer/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\);gap:14px/);
});

test('production workspace chrome avoids status placeholders and broken account route',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(src,/>\{t\(voice\?'Voice configured':'Text mode'\)\}</);
 assert.match(src,/className="sf-sidebar-account" onClick=\{\(\)=>navigate\('settings'\)\}/);
 assert.match(src,/page==='more'\?'More':nav.find/);
 assert.match(src,/items\.some\(i=>i\.synthetic\)&&<small>/);
});
test('empty fresh catalogue offers a real owner import route',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/!items\.length&&<div className="wh-panel">/);
 assert.match(src,/t\('Start building your catalogue\.'\)/);
 assert.match(src,/onClick=\{\(\)=>navigate\('import'\)\}/);
});


test('Grocery Warehouse appears in the business setup and has its own imagery',async()=>{
 const catalogue=await readFile(new URL('../src/warehouse-ui.jsx',import.meta.url),'utf8');
 const business=await readFile(new URL('../src/store-workflow.jsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/store-workflow.css',import.meta.url),'utf8');
 assert.match(catalogue,/collection==='grocery'/);
 assert.match(catalogue,/grocery:<><path/);
 assert.match(business,/collections.map\(c=><label key=\{c.id\}/);
 assert.match(css,/grid-template-columns:repeat\(auto-fit,minmax\(155px,1fr\)\)/);
});

test('item editor and spreadsheet importer expose the multilingual alias workflow',async()=>{
 const source=await readFile(new URL('../src/warehouse-manage.jsx',import.meta.url),'utf8');
 assert.match(source,/Other names in any supported language/);
 assert.match(source,/Add the names workers actually say/);
 assert.match(source,/aliases:aliases\.split\(','\)/);
 assert.match(source,/separate with \|/);
});

test('Prisma V3 keeps automatic recognition settings behind a simple staff interface',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/value="auto">Auto-detect/);
 assert.match(src,/style="transcribe"/);
 assert.match(src,/enhanced=\{prismaV3\}/);
 assert.doesNotMatch(src,/t\('Transcript style'\)/);
 assert.doesNotMatch(src,/t\('Gnani Prisma V3/);
 assert.doesNotMatch(src,/transcriptStyle,TS/);
 assert.match(src,/URLSearchParams\(\{language,style,enhanced:String\(enhanced\),collection\}\)/);
 assert.match(src,/onText\(r\.transcript,r\.search_language,r\)/);
 assert.match(src,/language:language==='auto'\?\(detectedSearchLanguage\|\|'hi-en'\):language/);
});

test('Prisma V3 live voice is opt-in and retains recorded voice fallback',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const recording=await readFile(new URL('../src/recording.js',import.meta.url),'utf8');
 const vite=await readFile(new URL('../vite.config.js',import.meta.url),'utf8');
 assert.match(src,/liveMode,LM/);
 assert.match(src,/checked=\{liveMode\}/);
 assert.match(src,/startLiveRecording\(/);
 assert.match(src,/startRecording\(/);
 assert.match(src,/onPartial\?\.\(text,detected\)/);
 assert.match(src,/live=\{prismaV3&&liveMode\}/);
 assert.match(recording,/new WebSocket\(url\)/);
 assert.match(recording,/location\.host\+'\/api\/voice\/live/);
 assert.match(recording,/socket\.send\(bytes\)/);
 assert.doesNotMatch(recording,/GNANI_API_KEY/);
 assert.match(vite,/ws:true/);
});


test('empty catalogue search clearly explains that import requires confirmation',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/No catalogue items are saved yet/);
 assert.match(src,/Preview changes, then Confirm import/);
 assert.match(src,/Go to Import items/);
 assert.match(src,/task\.lines\.filter\(l=>!l\.selected&&!l\.candidates\.length\)\.length/);
});

test('worklist sort dropdown stays readable beside Read answer',async()=>{
  const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
  const css=await readFile(new URL('../src/control-alignment.css',import.meta.url),'utf8');
  assert.match(source,/className="wh-toolbar sf-worklist-controls"/);
  assert.match(source,/className="sf-worklist-order"/);
  assert.match(css,/\.sf-worklist-controls > \.sf-worklist-order\s*\{/);
  assert.match(css,/padding: 0 28px 0 12px !important/);
  assert.match(css,/height: 42px !important/);
  assert.match(css,/@media \(max-width: 480px\)/);
});

test('report supports optional shelf voice transcription without changing recorded location',async()=>{
  const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
  const css=await readFile(new URL('../src/control-alignment.css',import.meta.url),'utf8');
  assert.match(source,/className="sf-report-location-field"/);
  assert.match(source,/VoiceButton iconOnly small enabled=\{voice&&!busy\}/);
  assert.match(source,/label="Dictate suggested shelf location"/);
  assert.match(source,/S\(text.trim\(\).slice\(0,200\)\)/);
  assert.match(source,/suggested_location:suggested/);
  assert.match(source,/kind:location\?'wrong_location':'general'/);
  assert.match(source,/type="button" className=\{'wh-voice '/);
  assert.match(css,/\.sf-report-location-field > \.wh-voice\.icon-only/);
});

test('Prisma V3 offers ten selectable recognition languages and optional hints',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const recording=await readFile(new URL('../src/recording.js',import.meta.url),'utf8');
 assert.match(src,/const VOICE_INPUT_LANGUAGES=\[/);
 for(const code of ['en-IN','hi-IN','kn-IN','ta-IN','te-IN','ml-IN','mr-IN','bn-IN','gu-IN','pa-IN']){
  assert.ok(src.includes("['"+code+"'"),code);
 }
 assert.match(src,/Auto-detect \(10 languages\)/);
 assert.match(src,/candidates=\{language==='auto'\?hintLanguages:\[\]\}/);
 assert.match(src,/candidates\.join\(','\)/);
 assert.match(recording,/params\.set\('candidates',candidates\.join\(','\)\)/);
 assert.match(src,/hintLanguages\.length>=4/);
});

test('setup guidance is limited to Find when workspace setup is unfinished',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/!meta\.settings\.configured&&page==='find'/);
 assert.match(src,/owner&&<button onClick=\{\(\)=>navigate\('business'\)\}>Set up workspace/);
 assert.doesNotMatch(src,/!meta\.settings\.configured&&!\['business','more','settings'\]\.includes\(page\)/);
});
test('catalogue label is not repeated as inert decoration on workspace pages',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/meta&&!\['find','account','business','more','settings'\]\.includes\(page\)/);
 assert.match(src,/aria-label="Product type"/);
 assert.doesNotMatch(src,/className="sf-scope-note"/);
 assert.doesNotMatch(src,/t\('Your catalogue'\)/);
 assert.match(src,/\['catalogue','grid','Catalogue'\]/);
});
test('secondary page controls use consistent 44px touch targets without touching Find voice layout',async()=>{
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(css,/Secondary workspace controls share one comfortable touch size/);
 assert.match(css,/\.sf-compact-app:not\(\.sf-find-page\) > \.wh-main-wrap #wh-packs\.sf-search-filters > label > select/);
 assert.match(css,/\.sf-compact-app:not\(\.sf-find-page\) \.wh-toolbar > \.wh-filter > input/);
 assert.match(css,/\.sf-compact-app:not\(\.sf-find-page\) \.wh-toolbar > :is\(select,button,\.wh-button\)/);
 assert.match(css,/height:44px/);
});

test('mobile header names the active section and shows a single Find navigation action',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(src,/className="sf-mobile-header-copy"/);
 assert.match(src,/role="heading" aria-level="1"/);
 assert.match(src,/sf-voice-unavailable/);
 assert.match(src,/className="sf-mobile-speak" type="button" aria-label=\{t\('Scan a label'\)\}/);
 assert.doesNotMatch(src,/className="sf-mobile-speak"[^>]*onClick=\{\(\)=>\{navigate\('find'\)/);
 assert.match(css,/\.sf-compact-app \.sf-compact-page-title\{display:none\}/);
 assert.match(css,/\.sf-compact-app\.sf-voice-unavailable \.wh-top-actions \.sf-header-scan\{display:none\}/);
});

test('Finder settings expose ten interface languages with stored preferences',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/APP_LANGUAGES\.map\(\(\[code,name\]\)/);
 assert.match(src,/VOICE_LANGUAGE_DEFAULT\[user\.language\]/);
 assert.match(src,/id="sf-settings-language"/);
 const locale=await readFile(new URL('../src/locale-multilingual.js',import.meta.url),'utf8');
 for(const code of ['bn','mr','gu','pa','kn','te','ta','ml'])assert.match(locale,new RegExp('"'+code+'":'));
});

test('high-use owner approval and filter UI text passes through translation functions',async()=>{
 const account=await readFile(new URL('../src/accounts.jsx',import.meta.url),'utf8');
 const warehouse=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 for(const key of ['Staff registration requests','Approve','Reject','Refresh requests','Generate staff invitation','Self-registration']){
   assert.ok(account.includes("t('"+key+"')"),key);
 }
 for(const key of ['All types','All brands','All sizes','Every location']){
   assert.ok(warehouse.includes("t('"+key+"')"),key);
 }
});

test('warehouse uses translated display text without changing the spoken audio path',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/task\.display_text\|\|task\.spoken_text/);
 const backendText=await readFile(new URL('../../backend/app/warehouse.py',import.meta.url),'utf8');
 assert.match(backendText,/def display_task\(task\)/);
 assert.match(backendText,/t\['display_text'\]=display_task\(t\)/);
});

test('guided picking has explicit start, resume, verified progress, next stop and finish controls',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(src,/async function pickAction\(kind\)/);
 assert.match(src,/async function resumePick\(id\)/);
 assert.match(src,/tasks\/'\+task\.id\+'\/picking\/'\+kind/);
 assert.match(src,/r\.picking\?\.status==='active'\?resumePick\(r\.id\)/);
 assert.match(src,/className="wh-panel sf-guided-picking"/);
 assert.match(src,/className="sf-picking-head"/);
 assert.match(src,/pickAction\('start'\)/);
 assert.match(src,/pickAction\('finish'\)/);
 assert.match(src,/verifiedCount!==task\.lines\.length/);
 assert.match(src,/id=\{'sf-picking-line-'\+line\.index\}/);
 assert.match(src,/task\?\.lines\.filter\(l=>l\.complete\)\.length/);
 assert.match(css,/\.sf-guided-picking\{/);
 assert.match(css,/@media\(max-width:700px\)/);
});

test('voice-guided picking uses real Prisma transcript and Timbre audio with safe action handoff',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/async function voicePickCommand\(transcript/);
 assert.match(src,/async function playPickGuidance\(command/);
 assert.match(src,/\/picking\/command/);
 assert.match(src,/\/picking\/guide-audio/);
 assert.match(src,/onText=\{transcript=>voicePickCommand\(transcript\)\}/);
 assert.match(src,/answer\.action==='verify'&&answer\.line!=null/);
 assert.match(src,/D\(\{type:'scan',index:answer\.line\}\)/);
 assert.match(src,/answer\.action==='report'&&answer\.line!=null/);
 assert.match(src,/D\(\{type:'report',item:selected\.selected,location:selected\.location,index:answer\.line\}\)/);
 assert.match(src,/answer\.action==='stop'/);
 assert.doesNotMatch(src,/voicePickCommand\([^]*?kind:'manual',value:'confirmed'/);
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(css,/\.sf-voice-guide\{/);
});

test('native voice picking commands are wired for every supported input language',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const terms=await readFile(new URL('../src/picking-voice-phrases.js',import.meta.url),'utf8');
 const server=await readFile(new URL('../../backend/app/warehouse.py',import.meta.url),'utf8');
 assert.match(src,/PICKING_VOICE_LANGUAGES\.includes\(task\.language\)/);
 assert.match(src,/PICKING_VOICE_LANGUAGES\.includes\(next\.language\)/);
 assert.match(src,/pickVoicePhrase\(task\.language,'next'\)/);
 assert.match(src,/pickVoicePhrase\(task\.language,'repeat'\)/);
 assert.match(src,/pickVoicePhrase\(task\.language,'verify'\)/);
 assert.match(src,/pickVoicePhrase\(task\.language,'report'\)/);
 assert.match(src,/pickVoicePhrase\(task\.language,'stop'\)/);
 for(const code of ['kn-IN','ta-IN','te-IN','ml-IN','mr-IN','bn-IN','gu-IN','pa-IN'])assert.ok(terms.includes('"'+code+'"'),code);
 assert.match(server,/voice_guide\.intent\(body\.transcript,task\['language'\]\)/);
 assert.match(src,/if\(answer\.action==='verify'&&answer\.line!=null\)D\(\{type:'scan',index:answer\.line\}\)/);
});
