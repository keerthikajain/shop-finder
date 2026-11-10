import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../src/'+path,import.meta.url),'utf8');

test('business setup includes accessible optional settings card and no missing close',async()=>{
 const src=await read('store-workflow.jsx');
 assert.match(src,/<details className="sf-advanced-settings">/);
 assert.match(src,/<summary><span><strong>\{t\('Additional specifications & staff permissions'\)\}/);
 assert.match(src,/<small>\{t\('Optional settings for product details and team access\.'\)\}/);
 assert.match(src,/<div className="sf-advanced-body">/);
 assert.match(src,/edit product information\.'\)\}<\/p><\/div><\/details>/);
 assert.match(src,/const t=useT\(\);/);
});

test('advanced setup card is styled for mobile, keyboard and reduced motion',async()=>{
 const css=await read('product-polish.css');
 assert.match(css,/\.sf-advanced-settings>summary:focus-visible/);
 assert.match(css,/\.sf-advanced-settings\[open\]>summary svg/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css, /prefers-reduced-motion/);
 const entry=await read('main.jsx');
 assert.match(entry,/import '\.\/product-polish\.css';/);
});

test('staff facing copy does not expose release operations or debug instructions',async()=>{
 const workspace=await read('warehouse.jsx');
 const account=await read('accounts.jsx');
 assert.doesNotMatch(workspace,/Gnani configured\. Verify microphone and speech playback before release\./);
 assert.doesNotMatch(workspace,/Training catalogue — synthetic records/);
 assert.match(workspace,/className="sf-catalogue-provenance"/);
 assert.doesNotMatch(workspace,/Example products and shelves — replace them with your own items before use/);
 assert.match(account,/This workspace is not set up yet\./);
 assert.doesNotMatch(account,/Run scripts\/start_local\.py in the terminal to create the first owner account/);
});

test('Hindi translation contains the updated business setup and operational messages',async()=>{
 const translations=await read('warehouse-hi.js');
 for(const s of ['Additional specifications & staff permissions','Sample catalogue — fictional records','Start building your catalogue.','Sign in to Shop Finder','Business name','Business type','Voice search is enabled.']) {
   assert.ok(translations.includes("'"+s),s+' must be translated');
 }
});
