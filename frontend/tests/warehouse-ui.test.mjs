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
 assert.ok(src.includes("!meta.settings.configured&&!user.is_challenge&&page==='find'"));
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
 assert.match(source,/className="sf-item-report-link"/);
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
 assert.match(src,/id==='locations'&&\(voice\?<VoiceButton nav autoStop enabled=\{!busy\}/);
 assert.match(src,/if\(page!=='find'\)navigate\('find'\)/);
 assert.match(src,/Q\(text\);ST\(text\);DSL\(detected\);VQ\(true\);taskVoice.current=true/);
 // When voice is unavailable, the center shortcut becomes Scan (not a second Find).
 assert.match(src,/id==='locations'&&\(voice\?<VoiceButton nav autoStop enabled=\{!busy\}/);
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
test('appearance is controlled only from Settings, on both desktop and mobile',async()=>{
 const jsx=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(jsx,/className="wh-icon-button sf-header-theme"/);
 assert.match(jsx,/<span>\{t\('Appearance'\)\}<\/span>/);
 assert.match(jsx,/onClick=\{\(\)=>TH\(theme==='dark'\?'light':'dark'\)\}/);
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
 assert.match(src,/items\.some\(item=>item\.synthetic\)&&<p className="sf-catalogue-provenance"/);
 assert.doesNotMatch(src,/Public challenge preview · Fictional catalogue · No real stock changes/);
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

test('Prisma V3 keeps focus-language recognition settings behind a simple staff interface',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(src,/value="auto">Auto-detect/);
 assert.match(src,/style="transcribe"/);
 assert.match(src,/enhanced=\{prismaV3\}/);
 assert.doesNotMatch(src,/t\('Transcript style'\)/);
 assert.doesNotMatch(src,/t\('Gnani Prisma V3/);
 assert.doesNotMatch(src,/transcriptStyle,TS/);
 assert.match(src,/URLSearchParams\(\{language,style,enhanced:String\(enhanced\),collection\}\)/);
 assert.match(src,/onText\(result\.transcript,result\.search_language,result\)/);
 assert.match(src,/language,\s*brand:/);
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

test('report displays recognized voice text and keeps reporting separate from catalogue updates',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/className="sf-report-voice-panel"/);
 assert.match(src,/className="sf-report-transcript"/);
 assert.ok(src.includes("label={copy('record')}"));
 assert.match(src,/onText=\{voiceCommand\}/);
 assert.match(src,/onPartial=\{text=>\{H\(text\);HF\('listening'\)\}\}/);
 assert.match(src,/suggested_location:suggested\.trim\(\)/);
 assert.match(src,/kind:location\?'wrong_location':'general'/);
 assert.match(src,/pendingSubmit/);
});

test('Finder offers only English Hindi Hinglish and Telugu recognition modes',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const match=src.match(/const VOICE_INPUT_LANGUAGES=\[([\s\S]*?)\];/);
 assert.ok(match,'Voice-language options must be declared');
 for(const code of ['en-IN','hi-IN','hi-en','te-IN'])assert.ok(match[1].includes("['"+code+"'"),code);
 for(const code of ['kn-IN','ta-IN','ml-IN','mr-IN','bn-IN','gu-IN','pa-IN'])assert.ok(!match[1].includes("['"+code+"'"),code);
 assert.doesNotMatch(src,/<option value="auto">Auto-detect/);
 assert.match(src,/const ACTIVE_VOICE_CODES=new Set/);
 assert.match(src,/candidates=\{\[\]\}/);
});

test('setup guidance is limited to Find when workspace setup is unfinished',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/!meta\.settings\.configured&&!user\.is_challenge&&page==='find'/);
 assert.match(src,/owner&&<button onClick=\{\(\)=>navigate\('business'\)\}>Set up my store/);
 assert.doesNotMatch(src,/!meta\.settings\.configured&&!\['business','more','settings'\]\.includes\(page\)/);
});
test('catalogue label is not repeated as inert decoration on workspace pages',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/meta&&!\['find','account','business','more','settings'\]\.includes\(page\)/);
 assert.match(src,/aria-label=\{t\('Product type'\)\}/);
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
 assert.match(src,/async function resumePick\(id\)/);
 assert.match(src,/className="wh-panel sf-guided-picking"/);
 assert.match(src,/className="sf-picking-head"/);
 assert.match(src,/pickAction\('start'\)/);
 assert.match(src,/pickAction\('finish'\)/);
 assert.match(src,/!task\.lines\.every\(line=>line\.complete\|\|\['skipped','cancelled'\]\.includes\(line\.deferred_reason\)\)/);
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
 assert.match(src,/onText=\{transcript=>voicePickCommand\(transcript,task,true\)\}/);
 assert.match(src,/onCommand=\{transcript=>voicePickCommand\(transcript\)\}/);
 assert.match(src,/answer\.action==='verify'&&answer\.line!=null/);
 assert.match(src,/PV\(\{taskId:source\.id,line:answer\.line,sku:source\.lines\[answer\.line\]\?\.selected\?\.sku\}\)/);
 assert.match(src,/answer\.action==='report'&&answer\.line!=null/);
 assert.match(src,/D\(\{type:'report',item:selected\.selected,location:selected\.location,index:answer\.line,autoGuide:true\}\)/);
 assert.match(src,/answer\.action==='stop'/);
 assert.match(src,/if\(pendingVoicePick\)/);
  assert.match(src,/if\(response==='yes'\)/);
  assert.match(src,/if\(response==='no'\)/);
  assert.match(src,/current.selected\?\.sku!==pendingVoicePick.sku/);
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(css,/\.sf-voice-guide\{/);
});

test('native voice picking commands are wired for every supported input language',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const terms=await readFile(new URL('../src/picking-voice-phrases.js',import.meta.url),'utf8');
 const server=await readFile(new URL('../../backend/app/warehouse.py',import.meta.url),'utf8');
 assert.match(src,/PICKING_VOICE_LANGUAGES\.includes\(task\.language\)/);
 assert.match(src,/PICKING_VOICE_LANGUAGES\.includes\(next\.language\)/);
 assert.match(src,/\['verify','report','next'\]\.map\(action/);
 assert.match(src,/pickVoicePhrase\(task\.language,action\)/);
 assert.match(src,/pickingCommandLabel\(appLanguage,action\)/);
 assert.match(src,/sf-voice-guide-secondary/);
  assert.match(src,/sf-voice-details/);
  assert.doesNotMatch(src,/sayUndo/);
 assert.match(src,/voicePickCommand\(pickVoicePhrase\(task\.language,action\)\)/);
 for(const code of ['kn-IN','ta-IN','te-IN','ml-IN','mr-IN','bn-IN','gu-IN','pa-IN'])assert.ok(terms.includes('"'+code+'"'),code);
 assert.match(server,/voice_guide\.intent\(body\.transcript,task\['language'\]\)/);
 assert.match(src,/if\(answer\.action==='verify'&&answer\.line!=null\)\{PV\(/);
});

test('owner-only activity tab exposes unmatched-search review without modifying staff reports',async()=>{
 const manage=await readFile(new URL('../src/warehouse-manage.jsx',import.meta.url),'utf8');
 const panel=await readFile(new URL('../src/failed-search-panel.jsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(manage,/import FailedSearchPanel from '.\/failed-search-panel.jsx'/);
 assert.match(manage,/owner&&<button type="button" aria-pressed=\{tab==='unknowns'\}/);
  assert.match(manage,/sf-activity-overview/);
  assert.match(manage,/sf-activity-tabs/);
 assert.match(manage,/tab==='unknowns'&&owner\?<FailedSearchPanel/);
 assert.match(panel,/\/warehouse\/failed-searches\?/);
 assert.match(panel,/I verified that this phrase refers to the exact selected product and variant/);
 assert.match(panel,/action==='alias'&&!!verified\[entry.id\]/);
 assert.match(panel,/Add verified alias/);
 assert.match(panel,/Dismiss with note/);
 assert.match(css,/\.sf-search-intelligence\{/);
 assert.match(css,/\.sf-unknown-confirm input\{/);
});

test('voice picking is discoverable before starting and unmatched requests can be removed',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const server=await readFile(new URL('../../backend/app/warehouse.py',import.meta.url),'utf8');
 assert.match(ui,/picking.status!=='completed'&&<div className="sf-voice-guide"/);
 assert.match(ui,/All items are ready\. Confirm search once/);
 assert.match(ui,/picking.status==='active'&&voice&&handsFree&&!voiceGuidePaused&&!pickPaused/);
  assert.match(ui,/HandsFreePicking appLanguage=\{appLanguage\} enabled=/);
 assert.match(ui,/async function removeUnresolvedLine\(index\)/);
 assert.match(ui,/Remove from worklist/);
 assert.match(server,/def remove_unresolved_line\(tid:str,index:int,request:Request\)/);
});

test('locations present the recorded rack shelf and bin without repetitive starter labels',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const parts=await readFile(new URL('../src/warehouse-ui.jsx',import.meta.url),'utf8');
 assert.match(ui,/Browse saved items/);
 assert.match(ui,/friendlyPath\(l,!!p.synthetic\)/);
 assert.match(ui,/example=\{!!line.selected\?\.synthetic\}/);
 assert.match(parts,/example=false/);
 assert.doesNotMatch(parts,/Example shelf/);
 assert.doesNotMatch(ui,/Example products and shelves/);
});

test('synthetic provenance stays in catalogue and not in speech or picking screens',async()=>{
 const backend=await readFile(new URL('../../backend/app/warehouse.py',import.meta.url),'utf8');
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(ui,/className="sf-catalogue-provenance"/);
 assert.match(ui,/Locations in starter records are not physically verified/);
 assert.match(ui,/friendlyPath\(line\.location,!!line\.selected\?\.synthetic\)/);
 assert.match(ui,/friendlyPath\(guideLine\.location,!!guideLine\.selected\?\.synthetic\)/);
 assert.doesNotMatch(ui,/className="sf-location-navigator-levels"/);
 assert.doesNotMatch(backend,/Sample catalogue locations, not verified for your store/);
 assert.doesNotMatch(ui,/Sample catalogue: these shelf locations are illustrative/);
 assert.doesNotMatch(ui,/className="sf-sample-info"/);
 assert.match(backend,/p.get\('synthetic'\) and k=='facility'/);
});


test('only settings page exposes appearance control and manager empty state is actionable',async()=>{
 const warehouse=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const accounts=await readFile(new URL('../src/accounts.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(warehouse,/className="wh-icon-button sf-header-theme"/);
 assert.match(warehouse,/sf-settings-preferences/);
 assert.match(accounts,/managersEligible\.length===0/);
 assert.match(accounts,/No staff members are ready to become managers yet/);
 assert.match(accounts,/sf-staff-create/);
 assert.match(accounts,/owner_password:d\.get\('password'\)/);
});

test('public challenge preview has an explicit guest entry and feedback screen',async()=>{
 const accounts=await readFile(new URL('../src/accounts.jsx',import.meta.url),'utf8');
 const workspace=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(accounts,/Try Shop Finder/);
 assert.match(accounts,/demoEnabled&&<section/);
 assert.match(accounts,/request\('\/demo\/enter'/);
 assert.match(workspace,/user\.is_demo&&<section className="sf-preview-banner"/);
 assert.match(workspace,/request\('\/demo\/feedback'/);
 assert.match(workspace,/ownerFeedback\.map/);
});

test('a fully unmatched request does not show unusable picking commands and search stays responsive',async()=>{
 const jsx=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(jsx,/hasSearchCandidates\?<>/);
  assert.match(jsx,/picking\.status==='ready'&&lookupMode==='choice'/);
  assert.match(jsx,/\(picking\.status!=='ready'\|\|lookupMode==='guided'\)&&<section className="wh-panel sf-guided-picking"/);
 assert.match(jsx,/No items ready to pick/);
 assert.match(css,/\.sf-find-page \.wh-work-grid\{grid-template-columns:minmax\(0,1fr\) minmax\(0,280px\)\}/);
 assert.match(css,/@media\(max-width:900px\)/);
});

test('judge access uses a single account flow and a separate full-feature workspace',async()=>{
 const account=await readFile(new URL('../src/accounts.jsx',import.meta.url),'utf8');
 assert.match(account,/Create a free workspace/);
 assert.match(account,/Or explore instantly, without signing up/);
 assert.match(account,/challenge\/signup/);
 assert.match(account,/challenge\/try/);
 assert.match(account,/Your workspace data is kept separate from other workspaces/);
});

test('voice-first search requires transcript review before matching products',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\[voiceAutoSearch,VAS\]=useState\(true\)/);
 assert.doesNotMatch(source,/Search automatically after speaking/);
 assert.match(source,/Check or edit the transcript, then press Find items/);
 assert.match(source,/className="sf-search-details"/);
  assert.match(source,/className="sf-clear-query"/);
  assert.match(source,/aria-label=\{t\('Clear search'\)\}/);
  assert.match(source,/className="sf-search-details"/);
  assert.match(source,/handleModeVoiceError/);
  assert.doesNotMatch(source,/className="sf-unrecognized-voice"/);
 assert.match(source,/task\.query/);
 assert.match(source,/language,\s*brand:/);
 assert.doesNotMatch(source,/language:language==='auto'/);
 assert.doesNotMatch(source,/if\(fromVoice\&\&auto\)await speak\(result\)/);
  assert.match(source,/T\(result\)/);
  assert.doesNotMatch(source,/const next=await startIfReady\(result\)/);
});

test('voice-start picking requires exact, unambiguous speech in all five focus modes',async()=>{
 const {isStartPickingCommand}=await import('../src/picking-voice-phrases.js');
 for(const [language,phrase] of [['en-IN','start picking'],['hi-IN','पिकिंग शुरू करो'],['hi-en','picking shuru karo'],['kn-IN','ಪಿಕಿಂಗ್ ಪ್ರಾರಂಭಿಸಿ'],['te-IN','పికింగ్ ప్రారంభించండి']]){
  assert.equal(isStartPickingCommand(language,phrase),true,language);
  assert.equal(isStartPickingCommand(language,'not '+phrase),false,language);
  assert.equal(isStartPickingCommand(language,''),false,language);
 }
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(source,/PICKING_START_VOICE_LANGUAGES.includes\(task.language\)/);
 assert.match(source,/if\(!canStartPick\|\|busy\)/);
 assert.match(source,/await pickAction\('start'\)/);
});

test('search shows a review stage until the worker confirms the picking list',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/async function startIfReady\(result\)/);
 assert.doesNotMatch(source,/const next=await startIfReady\(result\)/);
 assert.match(source,/T\(result\)/);
 assert.match(source,/pendingModePrompt\.current=result\.id/);
 assert.match(source,/N\(result\.lines\.every\(line=>line\.selected&&line\.location\)\?lookupCopy\(appLanguage,'question'\):lookupCopy\(appLanguage,'resolve'\)\)/);
 assert.match(source,/Confirm search and begin picking/);
 assert.match(source,/Confirm search by voice/);
 assert.match(source,/await pickAction\('start'\)/);
 assert.match(source,/api\('\/tasks\/'\+task\.id\+'\/picking\/'\+kind/);
 assert.match(source,/if\(!canStartPick\|\|busy\)/);
 assert.match(source,/className="sf-visible-transcript"/);
 assert.match(source,/searchTranscript\&\&/);
});

test('hands-free picking is bounded and pauses while sound, modals or work is active',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const listener=await readFile(new URL('../src/hands-free-picking.jsx',import.meta.url),'utf8');
 const recording=await readFile(new URL('../src/recording.js',import.meta.url),'utf8');
 assert.match(source,/HandsFreePicking appLanguage=\{appLanguage\} enabled=\{!speechSwitching&&!busy&&!speaking&&!modal&&page==='find'\}/);
 assert.match(source,/\[handsFree,HF\]=useState\(true\)/);
 assert.match(source,/\[voiceGuidePaused,VGP\]=useState\(true\)/);
 assert.ok(source.includes("pickingUiCopy(appLanguage,voiceGuidePaused?'resume':'stop')"));
 assert.ok(source.includes("pickingUiCopy(appLanguage,voiceGuidePaused?'resume':'stop')"));
 assert.match(listener,/stopOnSilence:true/);
 assert.match(listener,/\.stop\(true\)/);
 assert.match(listener,/request\('\/voice\/transcribe\?'/);
 assert.match(recording,/if\(stopOnSilence\&\&!heardSpeech\)/);
 assert.match(recording,/now-lastSpeech>1350/);
});


test('voice confirmation requires a prior found-item request and explicitly named second response',async()=>{
 const {pickConfirmationIntent}=await import('../src/picking-confirmations.js');
 for(const [language,yes,no] of [
  ['en-IN','yes','no'],['hi-IN','हाँ','नहीं'],['hi-en','haan','nahi'],
  ['kn-IN','ಹೌದು','ಇಲ್ಲ'],['te-IN','అవును','కాదు']
 ]){
  assert.equal(pickConfirmationIntent(language,yes),'yes',language);
  assert.equal(pickConfirmationIntent(language,no),'no',language);
  assert.equal(pickConfirmationIntent(language,'not '+yes),'unknown',language);
 }
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(source,/if\(pendingVoicePick\)/);
 assert.match(source,/pickConfirmationIntent\(source.language,transcript\)/);
 assert.match(source,/source.id!==pendingVoicePick.taskId/);
 assert.match(source,/current.selected\?\.sku!==pendingVoicePick.sku/);
 assert.match(source,/kind:'manual',value:'confirmed'/);
 assert.match(source,/await progressAfterPick\(next,true\)/);
 assert.match(source,/await api\('\/tasks\/'\+next.id\+'\/picking\/finish'/);
 assert.match(source,/className="sf-voice-pick-confirm"/);
});

test('mobile picking UI stays compact without shrinking actionable controls',async()=>{
 const css=await readFile(new URL('../src/activity-settings-polish.css',import.meta.url),'utf8');
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/\.sf-compact-app \.wh-task h3\{font-size:16px/);
 assert.match(css,/\.sf-compact-app \.wh-panel \.wh-button,\.sf-compact-app \.wh-panel button\{min-height:40px/);
 assert.match(css,/\.sf-compact-app \.sf-voice-pick-confirm button\{min-height:42px/);
});


test('highlighted next pick follows the same shelf ordering as spoken guidance',async()=>{
 // The JSX source is not compiled by Node test runner; inspect the pure helper contract.
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(source,/export function nextPendingPickIndex\(lines=\[\]\)/);
 assert.match(source,/locationFields\.map\(field=>String\(line\.location\?\.\[field\]/);
 assert.match(source,/nextPickIndex=nextPendingPickIndex\(task\?\.lines\)/);
 assert.match(source,/const index=nextPendingPickIndex\(next\.lines\)/);
});

test('voice list confirmation uses exact speech in all five focus modes',async()=>{
 const {isStartPickingCommand}=await import('../src/picking-voice-phrases.js');
 for(const [locale,phrase] of [
  ['en-IN','confirm and start picking'],
  ['hi-IN','पुष्टि करके पिकिंग शुरू करो'],
  ['hi-en','confirm picking'],
  ['kn-IN','ದೃಢೀಕರಿಸಿ ಪಿಕಿಂಗ್ ಪ್ರಾರಂಭಿಸಿ'],
  ['te-IN','నిర్ధారించి పికింగ్ ప్రారంభించండి']
 ]){
  assert.equal(isStartPickingCommand(locale,phrase),true,locale);
  assert.equal(isStartPickingCommand(locale,'do not '+phrase),false,locale);
 }
});

test('spoken search waits for the worker to approve the proposed picking list',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(src,/picking.status==='ready'&&voice&&handsFree&&taskVoice.current&&canStartPick/);
 assert.match(src,/onText=\{voiceStartPicking\}/);
 assert.match(src,/onClick=\{\(\)=>pickAction\('start'\)\}/);
 assert.match(src,/All items are ready\. Confirm search once/);
 assert.match(src,/if\(!canStartPick\|\|busy\)/);
 assert.doesNotMatch(src,/async function startIfReady\(/);
});

test('completed picks do not show redundant shelf-check or pick verification actions',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
  assert.match(src,/<details className="sf-location-check"><summary>/);
  assert.match(src,/Verify location \(optional\)/);
  assert.match(src,/sf-item-report-link/);
  assert.doesNotMatch(src,/className="sf-guide-jump"/);
  assert.doesNotMatch(src,/line\.location\.quantity==null\?t\('Quantity not added yet'\)/);
  assert.match(src,/sf-location-navigator/);
  assert.match(src,/sf-location-navigator-path/);
  assert.doesNotMatch(src,/className="sf-location-navigator-levels"/);
  assert.match(src,/sf-route-details/);
  assert.doesNotMatch(src,/<ShelfGuide/);
  assert.match(src,/task\.lines\.indexOf\(line\)/);
 assert.match(src,/disabled=\{busy\|\|pickPaused\|\|picking\.status==='completed'\|\|line\.complete\|\|!!line\.deferred_reason\|\|line\.location_report_open\}/);
 assert.match(src,/line\.complete\?\(line\.confirmation==='barcode'\?'Scan confirmed':'Manually confirmed'\):line\.location_feedback/);
});
test('saved shelf moves reload catalogue and refresh search instead of clearing results',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const manager=await readFile(new URL('../src/warehouse-manage.jsx',import.meta.url),'utf8');
 assert.match(manager,/await api\('\/moves\/'\+preview\.token\+'\/confirm'/);
 assert.match(src,/onSave=\{async\(\)=>\{const previous=task\?\.query;D\(null\);await reload\(\);RV\(v=>v\+1\)/);
 assert.match(src,/await search\(previous,false\);N\(t\('Location saved\. Search results now show the updated shelf/);
});
test('recording button stays readable in contrast and no repeated actions on completed tasks',async()=>{
 const css=await readFile(new URL('../src/activity-settings-polish.css',import.meta.url),'utf8');
 assert.match(css,/\.sf-compact-app \.sf-guided-picking \.wh-voice\.recording/);
 assert.match(css,/background:#9c2850!important;color:#fff!important/);
 assert.match(css,/\.sf-pick-complete-message/);
});

test('review stage has a single microphone path and clears stale voice reply on a new search',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/PV\(null\);PN\(null\);VGC\(''\);VGT\(''\);stopVoiceFlow\(\)/);
 assert.match(src,/enabled=\{!busy&&canStartPick\} language=\{task.language\} label=\{t\('Confirm search by voice'\)\}/);
 assert.match(src,/onText=\{voiceStartPicking\}/);
 assert.doesNotMatch(src,/picking\.status==='ready'&&voice&&handsFree&&taskVoice\.current&&canStartPick/);
 assert.match(src,/picking.status==='active'&&voice&&handsFree&&!voiceGuidePaused&&!pickPaused&&<HandsFreePicking/);
 const {isStartPickingCommand}=await import('../src/picking-voice-phrases.js');
 assert.equal(isStartPickingCommand('en-IN','Confirm.'),true);
 assert.equal(isStartPickingCommand('hi-en','confirm'),true);
 assert.equal(isStartPickingCommand('en-IN','do not confirm'),false);
});


test('wrong-location handoff pauses pick capture and opens an editable report stage',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const listener=await readFile(new URL('../src/hands-free-picking.jsx',import.meta.url),'utf8');
 assert.match(source,/if\(answer\.action==='report'&&answer\.line!=null\)\{/);
 assert.match(source,/PV\(null\);VGP\(true\)/);
 assert.match(source,/D\(\{type:'report',item:selected\.selected,location:selected\.location,index:answer\.line,autoGuide:true\}\)/);
 assert.match(source,/return false; \/\/ The voice loop must not restart/);
 assert.doesNotMatch(source,/playPickGuidance\('report',source,answer\.line\)/);
 assert.match(listener,/if\(outcome===false\)\{shouldContinue=false;Status\('paused'\);\}/);
 assert.match(listener,/if\(!cancelled&&shouldContinue\)Next\(/);
 assert.ok(source.includes("{copy('paused')}"));
 assert.ok(source.includes("{copy('edit')}"));
 assert.ok(source.includes("{copy('hint')}"));
});
test('spoken report submission resumes the next eligible item only after report is saved',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.ok(source.includes("VGP(true);\n if(voice&&!voiceFlowStopped.current)await playFixedVoice('report_saved',language,true);\n D(null);"));
 assert.match(source,/await deferPick\(task,index,'reported'\)/);
 assert.match(source,/VGP\(!\(voice&&handsFree&&shouldResume\)\)/);
 assert.match(source,/reportResumeRef\.current=handsFree&&!voiceGuidePaused/);
 assert.match(source,/The item remains unconfirmed; Finder moved to the next available item/);
 assert.match(source,/onClose=\{\(\)=>\{reportResumeRef\.current=false;D\(null\);VGP\(true\)\}\}/);
 assert.ok(source.includes("pickingUiCopy(appLanguage,voiceGuidePaused?'resume':'stop')"));
 assert.ok(source.includes("pickingUiCopy(appLanguage,voiceGuidePaused?'resume':'stop')"));
});
test('pink disabled and recording buttons have readable, high-contrast foreground',async()=>{
 const css=await readFile(new URL('../src/product-polish.css',import.meta.url),'utf8');
 assert.match(css,/\.wh-app button\.wh-voice\.recording/);
 assert.match(css,/background:#922647!important/);
 assert.match(css,/color:#fff!important/);
 assert.match(css,/-webkit-text-fill-color:#fff!important/);
 assert.match(css,/button\.primary:disabled/);
 assert.match(css,/color:#594175!important/);
});

test('report mic waits until spoken guidance stops to avoid transcribing itself',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/function Report\(\{item,location,collection,userId,run,busy,speaking=false/);
 assert.ok(src.includes("VoiceButton key={language+'-'+(speechSwitching?'switching':'ready')} small autoStop enabled={!busy&&!speechSwitching&&!speaking&&!guidedActive}"));
 assert.match(src,/collection=\{modal\.item\.collection\} userId=\{user\.id\} autoGuide=\{!!modal\.autoGuide\} \{\.\.\.\{run,busy,voice,language,speaking\}\}/);
});

test('activity report card groups issue, shelf locations and resolution instead of wide scattered flex rows',async()=>{
 const source=await readFile(new URL('../src/warehouse-manage.jsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/activity-settings-polish.css',import.meta.url),'utf8');
 assert.ok(source.includes("function TeamReportCard({issue,owner,busy,voice,language,onError,onCorrectLocation,onSaved,run,reload})"));
 assert.match(source,/className="sf-team-report-header"/);
 assert.match(source,/className="sf-team-report-body"/);
 assert.match(source,/className="sf-team-report-locations"/);
 assert.match(source,/className="sf-team-report-resolution"/);
 assert.match(source,/className="sf-team-report-transcript"/);
 assert.match(source,/issues\.filter\(i=>!filter\|\|i\.status===filter\)\.map\(i=><TeamReportCard/);
 assert.match(css,/\.sf-compact-app \.wh-review-row\.sf-team-report-card\{/);
 assert.match(css,/@media\(max-width:700px\)/);
});
test('manager dictation writes actual recognized text into editable resolution note and shows errors',async()=>{
 const source=await readFile(new URL('../src/warehouse-manage.jsx',import.meta.url),'utf8');
 assert.match(source,/const recognized=String\(text\|\|''\)\.trim\(\)/);
 assert.match(source,/SetTranscript\(recognized\)/);
 assert.match(source,/SetNote\(recognized\.slice\(0,300\)\)/);
 assert.ok(source.includes("autoStop enabled={!busy&&!reviewSpeaking&&!guidedActive}"));
 assert.match(source,/onText=\{captureNote\}/);
 assert.match(source,/onError=\{message=>\{SetVoiceError/);
 assert.match(source,/role="alert"/);
 assert.match(source,/textarea rows=\{2\} value=\{note\}/);
 assert.ok(source.includes("if(!owner||!open||busy||reviewSpeaking||note.trim().length<3)return"));
 assert.ok(source.includes("await api('/issues/'+issue.id+'/resolve',payload)"));
 assert.match(source,/resolutionAction==='confirmed_original'/);
 assert.ok(source.includes("action:'confirmed_original',revision:current.revision"));
 assert.match(source,/action:'unconfirmed'/);
 assert.match(source,/Still unconfirmed/);
});

test('login workspace creation CTA remains legible on hover and focus',async()=>{
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 const account=await readFile(new URL('../src/accounts.jsx',import.meta.url),'utf8');
 assert.match(account,/className="sf-demo-enter" disabled=\{busy\} onClick=\{\(\)=>navigate\('signup'\)\}/);
 assert.match(css,/\.login-shell \.sf-public-invite button\.sf-demo-enter:hover:not\(:disabled\)/);
 assert.match(css,/\.login-shell \.sf-public-invite button\.sf-demo-enter:focus-visible:not\(:disabled\)/);
 assert.match(css,/background:#6020b3/);
 assert.match(css,/-webkit-text-fill-color:#fff/);
 assert.match(css,/\.sf-public-invite button\.sf-demo-enter:hover svg/);
});

test('welcome voice uses cached Gnani TTS without exposing a credential',async()=>{
 const account=await readFile(new URL('../src/accounts.jsx',import.meta.url),'utf8');
 assert.match(account,/PUBLIC_GREETING\[language\]\|\|PUBLIC_GREETING\.en/);
 assert.match(account,/playWelcomeOnce/);
 assert.match(account,/\/api\/welcome\/audio\?language=/);
 assert.match(account,/stopWelcome\(playback\)/);
 assert.doesNotMatch(account,/onClick=\{speakWelcome\}/);
 assert.match(account,/welcomeAttempted\.current=language/);
 assert.doesNotMatch(account,/GNANI_API_KEY/);
 assert.doesNotMatch(account,/GNANI_API_KEY/);
});

test('login illustration and form share one background across desktop and phone',async()=>{
 const account=await readFile(new URL('../src/accounts.jsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 assert.match(account,/className="sf-login-layout"/);
 assert.match(account,/className="sf-login-art"/);
 assert.match(account,/className="glass login-card"/);
 assert.match(css,/\.login-shell \.sf-login-layout\{\s*background:#f7f3fc/);
 assert.match(css,/@media \(max-width:760px\)\{[\s\S]*?\.login-shell \.sf-login-art\{\s*display:flex;\s*position:static/);
 assert.match(css,/@media \(max-width:480px\)\{[\s\S]*?\.login-shell \.sf-login-art\{display:flex/);
 assert.match(css,/\.login-shell \.login-card\{\s*display:block;\s*position:relative/);
});

test('sample shelf labels remain bounded, and the unnecessary Recent requests panel is removed',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const backend=await readFile(new URL('../../backend/app/warehouse.py',import.meta.url),'utf8');
 assert.doesNotMatch(ui,/<summary>\{t\('Recent requests'\)\}<\/summary>/);
 assert.doesNotMatch(ui,/className="wh-panel wh-session-card"/);
 assert.match(ui,/request\('\/warehouse\/tasks'\)/);
 assert.doesNotMatch(backend,/Sample catalogue locations, not verified for your store/);
 assert.doesNotMatch(backend,/\{'Example shelf/);
 assert.match(ui,/example=\{!!line.selected\?\.synthetic\}/);
 assert.match(ui,/Search details/);
 assert.match(ui,/Confirm search and begin picking/);
});


test('manual microphone can always stop recording even when a parent becomes unavailable',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/disabled=\{\(!stopping&&!enabled\)\|\|state==='starting'\}/);
 assert.match(src,/if\(state==='recording'\)\{S\('processing'\);ref\.current\?\.stop\(\);return\}/);
 assert.match(src,/\{stopOnSilence:autoStop\}/);
 assert.match(src,/aria-pressed=\{stopping\}/);
 assert.match(src,/transcription\.current\?\.abort\(\)/);
});

test('picking pause and resume persist progress while automatic listening starts only after confirmation',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const backend=await readFile(new URL('../../backend/app/warehouse.py',import.meta.url),'utf8');
 assert.match(src,/async function togglePickPause\(\)/);
 assert.match(src,/task\.picking\?\.paused\?'resume':'pause'/);
 assert.match(src,/className="sf-pick-pause-toggle"/);
 assert.ok(src.includes("pickingUiCopy(appLanguage,pickPaused?'resumePicking':'pause')"));
 assert.match(src,/\[handsFree,HF\]=useState\(true\)/);
 assert.match(src,/\[voiceGuidePaused,VGP\]=useState\(true\)/);
 assert.match(src,/onClick=\{\(\)=>\{if\(!voiceGuidePaused\)\{PV\(null\);stopVoiceFlow\(\);return\}/);
 assert.match(src,/disabled=\{busy\|\|pickPaused\|\|!task\.lines\.every\(line=>line\.complete\|\|\['skipped','cancelled'\]\.includes\(line\.deferred_reason\)\)\}/);
 assert.match(backend,/def pause_picking\(tid:str,request:Request\)/);
 assert.match(backend,/def resume_picking\(tid:str,request:Request\)/);
 assert.match(backend,/picking_state\(t\)\.get\('paused'\)/);
});

test('spoken answers guidance welcome and reports expose explicit stop buttons',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const account=await readFile(new URL('../src/accounts.jsx',import.meta.url),'utf8');
 assert.match(src,/function stopSpeech\(\)/);
 assert.match(src,/playbackSerial\.current\+\+/);
 assert.match(src,/audioRequest\.current\?\.abort\(\)/);
 assert.match(src,/onClick=\{\(\)=>speaking\?stopSpeech\(\):speak\(task\)\}/);
 assert.ok(src.includes("className=\"sf-voice-stop-audio\""));
  assert.ok(src.includes("onClick={stopVoiceFlow}"));
 assert.match(src,/className="sf-report-stop-audio" onClick=\{onStopSpeaking\}/);
 assert.doesNotMatch(account,/welcomeStatus==='speaking'\|\|welcomeStatus==='starting'/);
 assert.doesNotMatch(account,/\?'Stop welcome':'Hear welcome'/);
});


test('one explicit search confirmation starts first shelf narration and automatic listening',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/\[handsFree,HF\]=useState\(true\)/);
 assert.match(src,/const guided=voice&&PICKING_VOICE_LANGUAGES\.includes\(next\.language\)/);
 assert.match(src,/VGP\(!\(guided&&handsFree\)\)/);
 assert.match(src,/if\(guided\)await playPickGuidance\('start',next/);
 assert.match(src,/onClick=\{\(\)=>pickAction\('start'\)\}/);
 assert.match(src,/!busy&&!speaking&&!modal&&page==='find'/);
 assert.doesNotMatch(src,/if\(fromVoice&&auto\)await speak\(result\)/);
});

test('repeat, found it, no, and wrong-location keep the voice loop safe and conversational',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(src,/if\(answer\.action==='verify'&&answer\.line!=null\)/);
 assert.match(src,/if\(voice&&!voiceFlowStopped\.current\)await playPickGuidance\(answer\.action,source,answer\.line\?\?activeLine\)/);
 assert.match(src,/if\(response==='yes'\)/);
 assert.match(src,/if\(response==='no'\)/);
 assert.match(src,/deferPick\(source,index,'declined'\)/);
 assert.match(src,/await playPickGuidance\('repeat',source,pendingVoicePick\.line\)/);
 assert.match(src,/if\(responseCommand\.action==='repeat'\)/);
 assert.match(src,/if\(responseCommand\.action==='verify'\)/);
 assert.match(src,/if\(responseCommand\.action==='report'\)/);
 assert.match(src,/if\(answer\.action==='report'&&answer\.line!=null\)/);
 assert.match(src,/if\(voice&&!voiceFlowStopped\.current\)await playPickGuidance\(answer\.action,source/);
 assert.match(src,/if\(err\.name!=='AbortError'&&serial===playbackSerial\.current\)\{VGP\(true\)/);
});


test('first item announcement and automatic advance do not require clicking Next',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const server=await readFile(new URL('../../backend/app/warehouse.py',import.meta.url),'utf8');
 const guide=await readFile(new URL('../../backend/app/warehouse_voice_guide.py',import.meta.url),'utf8');
 assert.match(ui,/if\(guided\)await playPickGuidance\('start',next/);
 assert.match(server,/command:Literal\['start','next'/);
 assert.match(guide,/elif action=='start':/);
 assert.match(guide,/First item:/);
 assert.match(guide,/पहला सामान/);
 assert.match(guide,/మొదటి వస్తువు:/);
 assert.match(ui,/async function progressAfterPick\(next,completed\)/);
 assert.match(ui,/if\(!completed\|\|next\.picking\?\.status!=='active'/);
 assert.match(ui,/const index=nextPendingPickIndex\(next\.lines\)/);
 assert.match(ui,/if\(voice&&auto&&!voiceFlowStopped\.current\)await playPickGuidance\('next',next,index\)/);
 assert.match(ui,/line\.deferred_reason/);
});

test('denying or reporting leaves item unconfirmed and automatically chooses another',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const server=await readFile(new URL('../../backend/app/warehouse.py',import.meta.url),'utf8');
 const guide=await readFile(new URL('../../backend/app/warehouse_voice_guide.py',import.meta.url),'utf8');
 assert.match(ui,/async function deferPick\(source,line,reason\)/);
 assert.match(ui,/deferPick\(source,index,'declined'\)/);
 assert.match(ui,/deferPick\(task,index,'declined'\)/);
 assert.match(ui,/await deferPick\(task,index,'reported'\)/);
 assert.match(ui,/await onSave\(report\)/);
 assert.match(ui,/async function retryPick\(line\)/);
 assert.match(ui,/nextItemUi\(appLanguage,'retry'\)/);
 assert.match(ui,/!x\.line\.complete&&!x\.line\.deferred_reason/);
 assert.match(server,/def defer_picking\(tid:str,body:PickDefer,request:Request\)/);
 assert.match(server,/def retry_picking\(tid:str,body:PickRetry,request:Request\)/);
 assert.match(server,/Submit the wrong-location report before moving/);
 assert.match(server,/Retry this deferred item before confirming it/);
 assert.match(guide,/not line\.get\('deferred_reason'\)/);
 assert.match(guide,/Some items remain unconfirmed/);
});

test('voice picking keeps speaker and microphone turn-taking automatic but respects Stop',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const listener=await readFile(new URL('../src/hands-free-picking.jsx',import.meta.url),'utf8');
 assert.match(ui,/\[handsFree,HF\]=useState\(true\)/);
 assert.match(ui,/\[auto,AUTO\]=useState\(true\)/);
 assert.match(ui,/if\(guided\)await playPickGuidance\('start',next/);
 assert.match(ui,/if\(voice&&auto&&!voiceFlowStopped\.current\)await playPickGuidance\('next',next,index\)/);
 assert.match(ui,/if\(voice&&!voiceFlowStopped\.current\)await playPickGuidance\(answer\.action/);
 assert.match(ui,/if\(!voice\|\|!source\|\|\(!manual&&voiceFlowStopped\.current\)\)return/);
 assert.match(ui,/serial!==playbackSerial\.current\|\|\(!manual&&voiceFlowStopped\.current\)/);
 assert.match(ui,/audio\.current\.onended=\(\)=>\{if\(serial===playbackSerial\.current\)SP\(false\)\}/);
 assert.match(ui,/enabled=\{!speechSwitching&&!busy&&!speaking&&!modal&&page==='find'\}/);
 assert.match(ui,/function stopVoiceFlow\(\)/);
 assert.match(ui,/voiceFlowStopped\.current=true/);
 assert.match(ui,/if\(!voiceGuidePaused\)\{PV\(null\);stopVoiceFlow\(\);return\}/);
 assert.match(ui,/voiceFlowStopped\.current=false;VGP\(false\)/);
 assert.match(ui,/playPickGuidance\('repeat',task,activeLine,true\)/);
 assert.match(ui,/await playFixedVoice\(retryable\?'pick_later_ready':'pick_exceptions_done',next\.language,false,true\)/);
 assert.match(listener,/if\(!enabled\)\{Status\('paused'\);return;/);
 assert.match(listener,/if\(cancelled\)return/);
 assert.match(listener,/recorder\?\.stop\(true\)/);
});

test('blocked search confirmation leads directly to unresolved variant choices',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(ui,/disabled=\{busy\|\|!canStartPick\}/);
 assert.match(ui,/Review unresolved items/);
 assert.match(ui,/sf-pick-review-needed/);
 assert.match(ui,/findIndex\(line=>!line.selected\|\|!line.location\)/);
 assert.match(ui,/scrollIntoView\(\{behavior:'smooth',block:'center'\}\)/);
 assert.match(ui,/tabIndex=\{-1\} key=\{line.index\}/);
 assert.match(ui,/Finder will not guess a size or version/);
});


test('picking cards use the same responsive layout for paired and odd last results',async()=>{
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 const start=css.lastIndexOf('/* Consistent picking cards:');
 assert.ok(start>=0,'layout override must be present after earlier rules');
 const rules=css.slice(start);
 assert.match(rules,/\.sf-find-page \.wh-task-list>\.wh-task\{/);
 assert.match(rules,/grid-template-columns:104px minmax\(0,1fr\) auto/);
 assert.match(rules,/\.wh-task:last-child:nth-child\(odd\):not\(:first-child\) \.wh-item-meta/);
 assert.match(rules,/margin-left:0/);
 assert.match(rules,/\.wh-task \.wh-task-footer>div\{/);
 assert.match(rules,/width:auto/);
 assert.match(rules,/@media\(max-width:1180px\)/);
 assert.match(rules,/@media\(max-width:700px\)/);
 assert.match(rules,/grid-template-columns:84px minmax\(0,1fr\)/);
 assert.match(rules,/grid-column:1\/-1;grid-row:2/);
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(ui,/className=\{'wh-panel wh-task '/);
 assert.match(ui,/className="wh-task-footer"/);
});

test('reported location is distinguished from an unresolved variant and cannot be confirmed',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const server=await readFile(new URL('../../backend/app/warehouse.py',import.meta.url),'utf8');
 assert.match(ui,/unresolvedLines=task\?\.lines\.filter\(l=>!l.selected\|\|!l.location\)/);
 assert.match(ui,/reportedLines=task\?\.lines\.filter\(l=>l.location_report_open\)/);
 assert.match(ui,/eligibleLines=task\?\.lines\.filter\(l=>l.selected&&l.location&&!l.location_report_open\)/);
 assert.match(ui,/canStartPick=!!task\?\.lines\.length&&unresolvedLines\.length===0&&eligibleLines\.length>0/);
 assert.match(ui,/reported shelf location\(s\) are excluded from picking until owner review/);
 assert.match(ui,/Remove reported item from this worklist/);
 assert.match(ui,/!x\.line\.deferred_reason&&!x\.line\.location_report_open/);
 assert.match(ui,/disabled=\{busy\|\|pickPaused\|\|picking\.status==='completed'\|\|line\.complete\|\|!!line\.deferred_reason\|\|line\.location_report_open\}/);
 assert.match(server,/line\['deferred_reason'\]='reported'/);
 assert.match(server,/picking_check\(c,task,allow_deferred=True\)/);
 assert.match(server,/This location has an open report\. Owner verification is required before picking/);
});


test('speech language can change mid picking without losing state or accepting stale commands',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const backend=await readFile(new URL('../../backend/app/warehouse.py',import.meta.url),'utf8');
 assert.match(backend,/class TaskSpeechLanguage\(Strict\)/);
 assert.match(backend,/\/tasks\/\{tid\}\/speech-language/);
 assert.match(backend,/task\['language'\]=body\.language/);
 assert.match(backend,/return task_put\(c,task\)/);
 assert.match(src,/async function changeSpeechLanguage\(nextLanguage\)/);
 assert.match(src,/stopVoiceFlow\(\)/);
 assert.match(src,/SetModeListening\(false\)/);
 assert.match(src,/speechSwitchRef\.current/);
 assert.match(src,/source\.language!==task\?\.language/);
 assert.match(src,/nextPendingPickIndex\(next\.lines\)/);
 assert.match(src,/playPickGuidance\('repeat',next,index,true\)/);
 assert.match(src,/sf-picking-language/);
 assert.match(src,/sf-report-speech-language/);
 assert.match(src,/sf-review-speech-language/);
 assert.match(src,/disabled=\{speechSwitching\|\|busy\}/);
 assert.match(src,/Speech language changed\. Picking progress is saved\./);
 assert.doesNotMatch(src,/onChange=\{e=>\{L\(e\.target\.value\);DSL\(null\)\}\}/);
});

test('guided picking keeps voice controls, commands and session footer in separate responsive rows',async()=>{
 const ui=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/selected-design.css',import.meta.url),'utf8');
 const toolbar=ui.indexOf('className="sf-voice-toolbar"');
 const commands=ui.indexOf('className="sf-voice-command-row"');
 const choices=ui.indexOf('className="sf-voice-guide-choices"',commands);
 const secondary=ui.indexOf('className="sf-voice-guide-secondary"',choices);
 assert.ok(toolbar>0&&commands>toolbar&&choices>commands&&secondary>choices);
 assert.ok(ui.indexOf('className="sf-picking-language"',toolbar)<commands);
 assert.ok(ui.indexOf('className="sf-voice-guide-actions"',toolbar)<commands);
 assert.match(ui,/voiceGuideText&&!pendingVoicePick&&!pendingNextPick/);
 const rules=css.slice(css.lastIndexOf('/* Stable, explicitly grouped guided-picking controls.'));
 assert.match(rules,/\.sf-voice-toolbar\{/);
 assert.match(rules,/\.sf-voice-command-row\{/);
 assert.match(rules,/\.sf-picking-actions>div\{/);
 assert.match(rules,/\.wh-task:last-child:nth-child\(odd\):not\(:first-child\)\{/);
 assert.match(rules,/grid-column:auto;grid-row:auto/);
 assert.match(rules,/@media\(max-width:900px\)/);
 assert.match(rules,/grid-template-columns:minmax\(0,1fr\)/);
});
