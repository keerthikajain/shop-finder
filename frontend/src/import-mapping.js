const normalize=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases={
 sku:['sku','itemcode','productcode','itemid','productid','stockkeepingunit','partnumber','partno','articlecode'],
 collection:['collection','producttype','catalogue','catalog','itemtype','department'],
 name:['name','productname','itemname','product','itemdescription','productdescription','partname'],
 brand:['brand','brandname','manufacturer','make','maker'],
 category:['category','subcategory','itemcategory','productcategory','group'],
 barcode:['barcode','ean','upc','gtin','barcodevalue','barcodenumber'],
 aliases:['aliases','alternatenames','othernames','nicknames','localnames'],
 synthetic:['synthetic','demo','sample','issynthetic'],
 revision:['revision','version','recordrevision'],
 facility:['facility','warehouse','store','site','warehousecode','locationname'],
 floor:['floor','floorno','floornumber','level','storey'],
 zone:['zone','section','area','storagezone'],
 aisle:['aisle','aisleno','aislenumber','row'],
 rack:['rack','rackno','racknumber','rackid','storagerack'],
 shelf:['shelf','shelfno','shelfnumber','shelfid'],
 bin:['bin','binno','binnumber','binid','box','boxnumber','bincode'],
 quantity:['quantity','qty','stock','onhand','stockquantity','units','count'],
 colour:['colour','color'],size:['size','itemsize'],power_w:['powerw','power','wattage']
};
const sections=[
 {id:'identity',title:'Product details',description:'Name, item code, product type and other identifying details.',keys:['sku','name','collection','brand','category','barcode','aliases']},
 {id:'storage',title:'Storage location',description:'Tell your team where to find the item. Match at least one location column.',keys:['facility','floor','zone','aisle','rack','shelf','bin']},
 {id:'tracking',title:'Stock and tracking',description:'Quantities, revision protection and whether records are synthetic.',keys:['quantity','revision','synthetic']},
 {id:'specs',title:'Additional specifications',description:'Sizes, models, ratings and other category-specific fields.',keys:[]}
];
export function importSections(fields) {
 const known=new Set(sections.flatMap(s=>s.keys));
 return sections.map(s=>({...s,fields:s.id==='specs'?fields.filter(f=>!known.has(f)):s.keys.filter(k=>fields.includes(k))})).filter(s=>s.fields.length);
}
export function rankedColumns(field,columns) {
 const f=normalize(field), keys=new Set([f,...(aliases[field]||[]).map(normalize)]);
 return [...columns].map((column,index)=>{
   const c=normalize(column);
   let score=keys.has(c)?100:(c===f?100:0);
   if(!score&&c.length>=4&&f.length>=4&&(c.startsWith(f)||c.endsWith(f)))score=70;
   if(!score&&c.length>=5&&f.length>=5&&(f.startsWith(c)||f.endsWith(c)))score=60;
   return {column,score,index};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index);
}
export function getMappingIssues(mapping,required,locationFields) {
 const rows=Object.entries(mapping).filter(([,v])=>!!v);
 const used=new Map(),duplicates=[];
 for(const [field,column] of rows){
   if(used.has(column))duplicates.push({column,fields:[used.get(column),field]});
   else used.set(column,field);
 }
 return {missing:required.filter(f=>!mapping[f]),missingLocation:!locationFields.some(f=>mapping[f]),duplicates};
}
export function autoMatchColumns(fields,columns,serverMapping={}) {
 const result={},used=new Set();
 // Keep all unambiguous server suggestions, then add clear exact-header matches.
 for(const f of fields){
   const c=serverMapping[f];
   if(c&&columns.includes(c)&&!used.has(c)){result[f]=c;used.add(c);}
 }
 for(const f of fields){
   if(result[f])continue;
   const options=rankedColumns(f,columns).filter(x=>x.score>=100&&!used.has(x.column));
   if(options.length===1){result[f]=options[0].column;used.add(options[0].column);}
 }
 return result;
}
