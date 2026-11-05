// Rendering contracts for identity/specification safety. These are not browser tests.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const frontend = fileURLToPath(new URL('..', import.meta.url));
const temporary = await mkdtemp(path.join(tmpdir(), 'shop-finder-render-'));
after(() => rm(temporary, {recursive: true, force: true}));
const bundle = path.join(temporary, 'render.cjs');
await build({
  stdin: {contents: `import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {ProductCard, PartDetails, Results} from './src/components.jsx';
    import {EvidenceEditor} from './src/evidence-editor.jsx';
    import {Locale} from './src/locale.js';
    import {AccountSettings} from './src/accounts.jsx';
    import {Tour,canAdvanceTour} from './src/tour.jsx';
    export {canAdvanceTour};
    export const localized = product => renderToStaticMarkup(<Locale.Provider value="hi"><Results products={[product]} canEdit={false} onEdit={()=>{}}/></Locale.Provider>);
    export const settings = role => renderToStaticMarkup(<Locale.Provider value="hi"><AccountSettings user={{role,language:'hi',username:'worker'}}/></Locale.Provider>);
    export const tour = () => renderToStaticMarkup(<Locale.Provider value="hi"><Tour query="" voiceReady={false}/></Locale.Provider>);
    export const results = (products,selected=null) => renderToStaticMarkup(<Results products={products} selected={selected} onSelect={()=>{}} onEdit={()=>{}} onClose={()=>{}}/>);
    export const editor = draft => renderToStaticMarkup(<EvidenceEditor draft={draft} onChange={()=>{}}/>);
    export const card = product => renderToStaticMarkup(<ProductCard product={product} active={false} onSelect={()=>{}}/>);
    export const details = product => renderToStaticMarkup(<PartDetails product={product} onEdit={()=>{}} onClose={()=>{}}/>);`,
    loader: 'jsx', resolveDir: frontend},
  outfile: bundle, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
});
const {card, details, results, editor, localized, settings, tour, canAdvanceTour} = (await import(pathToFileURL(bundle).href)).default;
const products = JSON.parse(await readFile(new URL('../../data/sample_catalogue.json', import.meta.url), 'utf8'));
const text = html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

test('all 20 synthetic catalogue fixtures render with exact IDs, provenance and connectors', () => {
  assert.equal(products.length, 20);
  for (const p of products) {
    const output = text(card(p));
    assert.ok(output.includes(p.part_number), p.id);
    for (const key of ['rack','shelf','box']) assert.ok(output.includes(String(p.location[key])), p.id+' '+key);
    assert.ok(output.includes('Demo location'), p.id);
    assert.ok(output.includes('Synthetic · Unverified'), p.id);
    assert.ok(output.includes(p.connector_type || 'Connector not recorded'), p.id);
    const selected = text(details(p));
    assert.ok(selected.includes('Fictional demo location'), p.id);
    assert.ok(selected.includes('Compatibility is not verified'), p.id);
  }
});

test('capacitance values and dimensional precision keep their units', () => {
  const p = structuredClone(products[0]);
  p.specifications = {capacitance_uf: 2.5, voltage_v: 450, cutoff_c: 184};
  p.dimensions = {tube_outer_diameter_inch: 0.25, outer_diameter_mm: 22};
  const first = text(details(p));
  assert.ok(first.includes('2.5 µF'));
  assert.ok(first.includes('450 V'));
  assert.ok(first.includes('184 °C'));
  assert.ok(first.includes('0.25 in'));
  assert.ok(first.includes('22 mm'));
  p.specifications.capacitance_uf = 3.15;
  const second = text(card(p));
  assert.ok(second.includes('3.15 µF'));
  assert.ok(!second.includes('2.5 µF'));
});

test('unselected panel does not invent a part or a location', () => {
  const output = details(null);
  assert.ok(!output.includes('location-tile'));
  assert.ok(!output.includes('SYN-'));
  assert.ok(output.includes('Select a part'));
});

test('catalogue content is escaped rather than interpreted as HTML', () => {
  const p = structuredClone(products[0]);
  p.name = '<img src=x onerror=alert(1)>';
  p.aliases = ['<script>alert(1)</script>'];
  for (const output of [card(p), details(p)]) {
    assert.ok(!output.includes('<img'));
    assert.ok(!output.includes('<script>'));
    assert.ok(output.includes('&lt;img'));
  }
});

test('single result avoids duplicate panels; multiple matches retain Back navigation',()=>{
 const single=results([products[0]],products[0]);
 assert.equal(single.split('class="location-panel"').length-1,1);
 assert.ok(!single.includes('class="part-card'));
 assert.ok(single.includes('Specifications and additional details'));
 assert.ok(!single.includes('Back to results'));
 const multi=results(products.slice(0,2),products[0]);
 assert.equal((multi.match(/class="part-card/g)||[]).length,2);
 assert.ok(multi.includes('Back to results'));
});
test('staff forms expose add/remove controls and unit labels without JSON',()=>{
 const p=structuredClone(products[7]);p.dimensions={};
 const html=editor(p);
 for(const label of ['Capacitance (µF)','Voltage (V)','Add dimension','Other field…','Remove Capacitance (µF)']) assert.ok(html.includes(label),label);
 assert.ok(!html.includes('JSON'));
 p.is_synthetic=false;
 const real=editor(p);
 assert.ok(real.includes('Catalogue source / page / reference'));
 assert.ok(real.includes('Checked by'));
});

test('Hindi interface retains identifiers and hides owner actions for staff',()=>{
 const html=localized(products[7]);
 assert.ok(html.includes('रैक'));
 assert.ok(html.includes('बॉक्स'));
 assert.ok(html.includes('SYN-008'));
 assert.ok(html.includes('2.5 µF'));
 assert.ok(!html.includes('Edit / review as staff'));
 assert.ok(!html.includes('रिकॉर्ड संपादित / जाँचें'));
 assert.ok(html.includes('जाँच के लिए भेजें'));
 assert.ok(!settings('staff').includes('कर्मचारी खाता बनाएँ'));
 assert.ok(settings('owner').includes('कर्मचारी खाता बनाएँ'));
 assert.ok(tour().includes('बोलने की भाषा चुनें'));
});

test('tour waits for input, matching results and selection without making provider calls',()=>{
 assert.equal(canAdvanceTour(1,'  ',null,null),false);
 assert.equal(canAdvanceTour(1,'fan',null,null),true);
 assert.equal(canAdvanceTour(2,'fan',{candidates:[]},null),false);
 assert.equal(canAdvanceTour(2,'fan',{candidates:[{id:'a'}]},null),true);
 assert.equal(canAdvanceTour(3,'fan',{candidates:[{id:'a'},{id:'b'}]},null),false);
 assert.equal(canAdvanceTour(3,'fan',{candidates:[{id:'a'},{id:'b'}]},{id:'a'}),true);
});
