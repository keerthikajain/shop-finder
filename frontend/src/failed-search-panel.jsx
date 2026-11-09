import React,{useEffect,useState} from 'react';
import {request} from './accounts.jsx';
import {useT} from './locale.js';
import {Glyph} from './warehouse-ui.jsx';

/** Owner-only insight panel: unknown phrases are not reports or auto-mappings. */
export default function FailedSearchPanel({collection,run,busy,onCatalogueChange}){
 const t=useT(),[entries,E]=useState([]),[products,P]=useState([]),[status,S]=useState('open');
 const [selected,SEL]=useState({}),[verified,V]=useState({}),[notes,N]=useState({});
 async function reload(){
  const [queries,items]=await Promise.all([
   request('/warehouse/failed-searches?collection='+encodeURIComponent(collection)+'&status='+status),
   request('/warehouse/items?collection=all')
  ]);
  E(queries);P(items);
 }
 useEffect(()=>{run(reload)},[collection,status]);
 const review=(entry,action)=>run(async()=>{
  const item=products.find(p=>p.collection+':'+p.sku===selected[entry.id]);
  if(action==='alias'&&!item)return;
  await request('/warehouse/failed-searches/'+entry.id+'/review',{
   method:'POST',
   body:JSON.stringify({action,collection:item?.collection||'',sku:item?.sku||'',revision:item?.revision??null,
                       verified:action==='alias'&&!!verified[entry.id],note:notes[entry.id]||''})
  });
  await reload();if(action==='alias')onCatalogueChange?.();
 });
 const openCount=entries.filter(e=>e.status==='open').length;
 return <div className="sf-search-intelligence">
  <div className="sf-search-intelligence-intro">
   <h3>{t('Unmatched searches')}</h3>
   <p>{t('Repeated unknown product names help improve your catalogue. No changes are made until you verify an exact product.')}</p>
   <small>{t('Search patterns are grouped without staff names or audio recordings. Retained for up to 90 days.')}</small>
  </div>
  <div className="sf-search-intelligence-toolbar">
   <label>{t('Review status')}
    <select aria-label={t('Unmatched search status')} value={status} onChange={e=>S(e.target.value)}>
     <option value="open">{t('Open')}</option><option value="resolved">{t('Resolved')}</option>
     <option value="dismissed">{t('Dismissed')}</option><option value="all">{t('All statuses')}</option>
    </select>
   </label>
   <span>{status==='open'?openCount:entries.length} {t('search patterns')}</span>
  </div>
  {entries.length?entries.map(entry=>{
   const item=products.find(p=>p.collection+':'+p.sku===selected[entry.id]);
   const isOpen=entry.status==='open';
   return <article className="sf-unknown-row" key={entry.id}>
    <div className="sf-unknown-heading">
     <div><strong>{entry.example}</strong><small>{t('Last searched')}: {new Date(entry.last_seen).toLocaleString()}</small></div>
     <span className="sf-unknown-count">{entry.hits} {t('searches')}</span>
    </div>
    <small>{t('Scope')}: {entry.scope} · {t('Status')}: {t(entry.status)}</small>
    {isOpen?<div className="sf-unknown-review">
     <label>{t('Link to a verified catalogue item')}
      <select value={selected[entry.id]||''} onChange={e=>{SEL(v=>({...v,[entry.id]:e.target.value}));V(v=>({...v,[entry.id]:false}))}}>
       <option value="">{t('Choose a product — no automatic match')}</option>
       {products.map(p=><option key={p.collection+':'+p.sku} value={p.collection+':'+p.sku}>{p.name} · {p.sku} ({p.collection})</option>)}
      </select>
     </label>
     {item&&<p className="sf-unknown-selection"><b>{item.name}</b> · {item.sku} · {t('Revision')} {item.revision}<br/>{t('Current aliases')}: {item.aliases.join(', ')||'—'}</p>}
     <label className="sf-unknown-confirm"><input type="checkbox" checked={!!verified[entry.id]} onChange={e=>V(v=>({...v,[entry.id]:e.target.checked}))}/>{t('I verified that this phrase refers to the exact selected product and variant.')}</label>
     <label>{t('Review note')}<input value={notes[entry.id]||''} maxLength={250} placeholder={t('Reason for approving or dismissing')} onChange={e=>N(v=>({...v,[entry.id]:e.target.value}))}/></label>
     <div className="sf-unknown-actions">
      <button type="button" className="primary" disabled={busy||!item||!verified[entry.id]} onClick={()=>review(entry,'alias')}><Glyph name="check"/>{t('Add verified alias')}</button>
      <button type="button" disabled={busy||(notes[entry.id]||'').trim().length<3} onClick={()=>review(entry,'dismiss')}>{t('Dismiss with note')}</button>
     </div>
    </div>:<div className="sf-unknown-done"><small>{t('Reviewed by')}: {entry.reviewed_by||'—'} · {entry.linked_sku||entry.review_note||'—'}</small></div>}
   </article>
  }):<p className="wh-empty">{t('No unmatched search patterns for this filter.')}</p>}
 </div>;
}
