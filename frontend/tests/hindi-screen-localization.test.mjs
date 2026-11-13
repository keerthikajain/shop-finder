import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {translate} from '../src/locale.js';

const screenLabels=[
 'Confirm search and begin picking','Confirm search by voice',
 'item(s) still need your choice before picking can start.',
 'Review unresolved items','Item not found',
 'This exact item is not in your saved catalogue. Check the name or size, or browse saved items. Nothing has been reported.',
 'This item was not found. Remove it to continue with the items we did find.',
 'Remove from worklist','Report missing item','Browse saved items',
 'Shelf guide','Choose an item to see where it is kept.',
 'Does this saved shelf location match?','Shelf matches','Wrong location',
 'Item details','Confirm picked item','Quantity not added yet',
 'units recorded here','Recent requests','At a glance','Recorded shelves',
 'Look for bin ','Schematic based on saved locations.','Confirm your request'
];

test('all labels observed in the Hindi picking screenshot are translated',()=>{
 for(const text of screenLabels){
  assert.notEqual(translate('hi',text),text,'Hindi translation missing for: '+text);
 }
});

test('static workspace and review labels do not silently fall back to English in Hindi',async()=>{
 const paths=['warehouse.jsx','store-workflow.jsx','warehouse-manage.jsx'];
 for(const filename of paths){
  const source=await readFile(new URL('../src/'+filename,import.meta.url),'utf8');
  const keys=[...source.matchAll(/\bt\(['"]([^'"]{3,240})['"]\)/g)].map(m=>m[1]);
  for(const key of keys){
   assert.notEqual(translate('hi',key),key,filename+': missing Hindi label: '+key);
  }
 }
});

test('shelf diagram and quantity status use translated labels, preserving stored item names',async()=>{
 const shelf=await readFile(new URL('../src/store-workflow.jsx',import.meta.url),'utf8');
 const workspace=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.match(shelf,/<Glyph name="pin"\/>\{t\('At a glance'\)\}/);
 assert.match(shelf,/\{t\('Shelf '\)\}\{s\}/);
 assert.match(shelf,/\{t\('Schematic based on saved locations\.'\)\}/);
 assert.match(workspace,/className="sf-location-check"/);
  assert.match(workspace,/Verify location \(optional\)/);
 assert.match(workspace,/line\.selected\.name/);
 assert.doesNotMatch(workspace,/<summary>\{t\('Recent requests'\)\}<\/summary>/);
});
