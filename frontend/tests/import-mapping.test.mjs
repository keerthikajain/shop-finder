import test from 'node:test';
import assert from 'node:assert/strict';
import {autoMatchColumns,getMappingIssues,rankedColumns,importSections} from '../src/import-mapping.js';
const fields=['sku','name','collection','brand','category','barcode','facility','floor','zone','aisle','rack','shelf','bin','quantity','revision','synthetic','size'];
const locations=['facility','floor','zone','aisle','rack','shelf','bin'];
test('exact and common header aliases produce field-specific rankings',()=>{
 assert.equal(rankedColumns('rack',['Brand Name','Rack No','Shelf Number'])[0].column,'Rack No');
 assert.equal(rankedColumns('brand',['Rack No','Brand Name'])[0].column,'Brand Name');
 assert.deepEqual(rankedColumns('barcode',['Floor','Rack','Brand Name']),[]);
});
test('auto mapping respects server recommendations and never maps a source column twice',()=>{
 const cols=['Product Code','Product Name','Brand Name','Rack No','Shelf Number','Category','collection','Barcode'];
 const mapping=autoMatchColumns(fields,cols,{sku:'Product Code',name:'Product Name'});
 assert.equal(mapping.sku,'Product Code');
 assert.equal(mapping.name,'Product Name');
 assert.equal(mapping.brand,'Brand Name');
 assert.equal(mapping.rack,'Rack No');
 assert.equal(mapping.shelf,'Shelf Number');
 assert.equal(mapping.barcode,'Barcode');
 assert.equal(new Set(Object.values(mapping)).size,Object.values(mapping).length);
});
test('ambiguous exact aliases require review instead of an arbitrary choice',()=>{
 assert.equal(autoMatchColumns(['rack'],['Rack','Rack No']).rack,undefined);
});
test('required, location and duplicate mapping issues are found before preview',()=>{
 let v=getMappingIssues({sku:'Product Code',name:'Product Name',category:'Category'},['sku','name','category'],locations);
 assert.equal(v.missingLocation,true);
 assert.deepEqual(v.missing,[]);
 v=getMappingIssues({sku:'Code',name:'Code',rack:'Rack'},['sku','name','category'],locations);
 assert.deepEqual(v.missing,['category']);
 assert.equal(v.missingLocation,false);
 assert.equal(v.duplicates[0].column,'Code');
});
test('sections cover every destination field exactly once',()=>{
 const sections=importSections(fields);
 const seen=sections.flatMap(s=>s.fields);
 assert.deepEqual(new Set(seen),new Set(fields));
 assert.equal(seen.length,fields.length);
 assert.deepEqual(sections.map(s=>s.id),['identity','storage','tracking','specs']);
});
