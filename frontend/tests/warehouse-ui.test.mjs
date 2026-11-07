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
 assert.match(source,/navigate\(moreReturn.current\)/);
 assert.doesNotMatch(source,/modal\?\.type==='menu'/);
});
test('mobile More keeps role-restricted tasks and direct access to primary sections',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(source,/owner&&<button type="button" onClick=\{\(\)=>navigate\('import'\)\}/);
 assert.match(source,/owner&&<button type="button" onClick=\{\(\)=>navigate\('business'\)\}/);
 assert.match(source,/onClick=\{\(\)=>navigate\('review'\)\}/);
 assert.match(source,/onClick=\{\(\)=>navigate\('account'\)\}/);
 assert.match(source,/className="sf-mobile-more"/);
});
