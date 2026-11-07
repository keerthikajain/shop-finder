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
test('logo is labelled for assistive technology',()=>{assert.match(logo(),/aria-label="Shop Finder logo"/)});

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
 assert.ok(src.includes("!meta.settings.configured&&!['business','more','settings'].includes(page)"));
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
 assert.match(src,/Q\(text\);VQ\(true\);taskVoice.current=true/);
 assert.match(src,/Voice unavailable\. Open text search/);
 assert.doesNotMatch(src,/if\(page!=='find'\)\{navigate\('find'\);return\}/);
});
