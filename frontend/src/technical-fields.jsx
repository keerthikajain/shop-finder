import {useT} from './locale.js';
import React, {useState} from 'react';
import {fieldLabel, specLabels} from './components.jsx';

export function technicalLabel(key) {
 const known=specLabels[key];
 if(known)return known[0]+(known[1]?` (${known[1]})`:'');
 const units={mm:'mm',inch:'in',v:'V',a:'A',w:'W',uf:'µF',hz:'Hz',c:'°C',micron:'µm'};
 const suffix=key.split('_').at(-1);
 return units[suffix]?fieldLabel(key.slice(0,-suffix.length-1))+` (${units[suffix]})`:fieldLabel(key);
}
export function TechnicalFields({group,values,onChange}) {
 const t=useT();
 const [choice,setChoice]=useState(''),[name,setName]=useState(''),[unit,setUnit]=useState(''),[error,setError]=useState('');
 const dimensional=k=> /_(mm|inch)$/.test(k);
 const options=Object.keys(specLabels).filter(k=>(group==='dimensions'?dimensional(k):!dimensional(k)) && !(k in values));
 function add(){
  const key=choice==='custom'?name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'_').replace(/^_|_$/g,'')+(unit?'_'+unit:''):choice;
  if(!key){setError('Choose a field or enter a name.');return;}
  if(key in values){setError('This field already exists. Edit its value above.');return;}
  onChange({...values,[key]:''});setChoice('');setName('');setUnit('');setError('');
 }
 return <section className="technical-group"><h3>{t(fieldLabel(group))}</h3>
  {Object.entries(values).map(([key,value])=><div className="technical-row" key={key}><label>{t(technicalLabel(key))}<input value={value} onChange={e=>onChange({...values,[key]:e.target.value})}/></label><button type="button" className="secondary" aria-label={'Remove '+technicalLabel(key)} onClick={()=>{const next={...values};delete next[key];onChange(next);}}>{t("Remove")}</button></div>)}
  {!Object.keys(values).length&&<p className="field-help">{t('No fields recorded. Add a field below.')}</p>}
  <div className="technical-add"><label>{t(group==='dimensions'?'Add dimension':'Add specification')}<select value={choice} onChange={e=>{setChoice(e.target.value);setError('')}}><option value="">{t("Choose a field\u2026")}</option>{options.map(k=><option key={k} value={k}>{t(technicalLabel(k))}</option>)}<option value="custom">{t("Other field\u2026")}</option></select></label>
   {choice==='custom'&&<><label>{t("Field name")}<input value={name} placeholder="e.g. Shaft diameter" onChange={e=>setName(e.target.value)}/></label><label>{t("Unit")}<select value={unit} onChange={e=>setUnit(e.target.value)}><option value="">{t("No unit / text")}</option>{[['mm','mm'],['inch','in'],['v','V'],['a','A'],['w','W'],['uf','µF'],['hz','Hz'],['c','°C'],['micron','µm']].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label></>}
   <button type="button" className="secondary" onClick={add}>{t('+ Add field')}</button>
  </div>{error&&<p role="alert">{t(error)}</p>}
 </section>;
}
