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

test('More offers scan as a task without unrelated filters or setup banners',async()=>{
 const src=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.ok(src.includes("['find','catalogue','locations'].includes(page)&&<button type=\"button\" className=\"sf-header-scan\""));
 assert.ok(src.includes("onClick={()=>D({type:'lookup'})}><span className=\"sf-more-icon\"><Glyph name=\"scan\"/>"));
 assert.ok(src.includes("meta&&!['find','account','business','more'].includes(page)"));
 assert.ok(src.includes("!meta.settings.configured&&!['business','more'].includes(page)"));
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
