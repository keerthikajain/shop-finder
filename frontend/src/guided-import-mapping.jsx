import React,{useState} from 'react';
import {importSections,rankedColumns,getMappingIssues,autoMatchColumns} from './import-mapping.js';
import {useT} from './locale.js';
import {locationFields} from './warehouse.jsx';
import './import-mapping.css';

export default function GuidedImportMapping({fields,upload,mapping,onChange,fieldLabel,required}) {
 const t=useT(),[expanded,E]=useState({}),[openSections,S]=useState({identity:true,storage:true,tracking:false,specs:false});
 const issues=getMappingIssues(mapping,required,locationFields);
 const mappedCount=fields.filter(f=>mapping[f]).length;
 const showExample=(column)=>{
   if(!column)return '';
   const values=(upload.sample||[]).map(row=>row[column]).filter(v=>v!==''&&v!=null).slice(0,2);
   return values.length?values.map(String).join(' · '):'No example value in the first rows';
 };
 const match=(field,value)=>onChange({...mapping,[field]:value});
 return <div className="sf-import-guided">
   <div className="sf-import-progress" role="status">
     <div><strong>{mappedCount} of {fields.length} fields mapped</strong><small>Suggested matches are preselected. Check the examples before continuing.</small></div>
     <button type="button" onClick={()=>{onChange(autoMatchColumns(fields,upload.columns,upload.suggested_mapping));E({})}}>Reset suggested matches</button>
   </div>
   {(issues.missing.length>0||issues.missingLocation||issues.duplicates.length>0)&&<div className="sf-import-issues" role="alert">
     <strong>Before previewing:</strong>
     {issues.missing.length>0&&<p>Required: {issues.missing.map(fieldLabel).join(', ')}</p>}
     {issues.missingLocation&&<p>Match at least one storage location column (such as Rack, Shelf or Bin).</p>}
     {issues.duplicates.map(({column,fields:used})=><p key={column}>“{column}” is assigned to both {used.map(fieldLabel).join(' and ')}. Choose a different source column.</p>)}
   </div>}
   {importSections(fields).map(section=><section className="sf-import-section" key={section.id}>
     <button className="sf-import-section-toggle" type="button" aria-expanded={!!openSections[section.id]} onClick={()=>S(v=>({...v,[section.id]:!v[section.id]}))}>
       <span><strong>{section.title}</strong><small>{section.description}</small></span>
       <span>{section.fields.filter(f=>mapping[f]).length}/{section.fields.length} mapped <span aria-hidden="true">{openSections[section.id]?'−':'+'}</span></span>
     </button>
     {openSections[section.id]&&<div className="sf-import-fields">
       {section.fields.map(field=>{
         const current=mapping[field]||'';
         const suggestions=rankedColumns(field,upload.columns).map(x=>x.column);
         const expandedAll=!!expanded[field];
         const visible=expandedAll?upload.columns:suggestions;
         const options=[...new Set([...visible,current].filter(Boolean))];
         const usedBy=Object.entries(mapping).find(([key,col])=>key!==field&&col===current)?.[0];
         const noSuggestions=suggestions.length===0;
         return <div className="sf-import-field" key={field}>
           <div className="sf-import-field-header">
             <label htmlFor={'sf-map-'+field}>{fieldLabel(field)}{required.includes(field)&&<span aria-hidden="true"> *</span>}</label>
             {current&&<span className={'sf-import-matched '+(usedBy?'conflict':'')}>{usedBy?'Already used':upload.suggested_mapping?.[field]===current?'Auto matched':'Selected'}</span>}
           </div>
           <select id={'sf-map-'+field} value={current} onChange={e=>match(field,e.target.value)} aria-invalid={!!usedBy} aria-describedby={'sf-map-help-'+field}>
             <option value="">Do not import</option>
             {options.map(column=>{
               const assigned=Object.entries(mapping).find(([key,col])=>key!==field&&col===column);
               return <option key={column} value={column} disabled={!!assigned&&!expandedAll&&column!==current}>{column}{assigned?' · used for '+fieldLabel(assigned[0]):''}</option>;
             })}
           </select>
           <div className="sf-import-field-foot" id={'sf-map-help-'+field}>
             <small>{current?'Excel example: '+showExample(current):noSuggestions?'No likely match found.':'Pick the matching Excel column.'}</small>
             <button type="button" aria-expanded={expandedAll} onClick={()=>E(v=>({...v,[field]:!v[field]}))}>{expandedAll?'Show suggestions':'All columns ('+upload.columns.length+')'}</button>
           </div>
         </div>;
       })}
     </div>}
   </section>)}
   <p className="sf-import-safe-note">{t('Required fields are marked *. Barcodes and codes should be stored as text in Excel to keep leading zeroes.')} Each Excel source column can map to only one destination field.</p>
 </div>;
}
