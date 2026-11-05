import React,{useEffect,useRef,useState,useContext,createContext} from 'react';
import {useT} from './locale.js';

export const Feedback=createContext({error:'',notice:''});
export function Mark({large=false}){return <svg className={large?'sf-mark large':'sf-mark'} viewBox="0 0 48 48" aria-label="Shop Finder logo" role="img"><rect width="48" height="48" rx="15" fill="#6244c5"/><path d="M13 14h22v7H13zm0 13h14v7H13z" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round"/><path d="M34 27v8m-4-6v4m8-7v10" stroke="#b8f2d6" strokeWidth="2.7" strokeLinecap="round"/><circle cx="18" cy="17.5" r="1.3" fill="#cbbcff"/><circle cx="18" cy="30.5" r="1.3" fill="#cbbcff"/></svg>}
const paths={
 search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></>,mic:<><rect x="8" y="3" width="8" height="12" rx="4"/><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3m-4 0h8"/></>,
 box:<><path d="m3 7 9-4 9 4v11l-9 4-9-4zM3 7l9 4 9-4M12 11v11m-5-17 9 4"/></>,arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,check:<path d="m5 12 4 4L20 5"/>,close:<path d="m6 6 12 12M6 18 18 6"/>,
 pin:<><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/></>,grid:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
 upload:<><path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/></>,history:<><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2"/></>,user:<><circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/></>,
 sound:<><path d="m10 4-5 5H2v6h3l5 5zM14 8a6 6 0 0 1 0 8m4-12a11 11 0 0 1 0 16"/></>,scan:<><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 8v8m4-8v8m3-8v8m3-8v8"/></>,sun:<><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></>,moon:<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>,
 shirt:<path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4c0 4-8 4-8 0Z"/>,shoe:<><path d="M3 8v12h18v-5l-8-3-4-5-3 3zM3 16h18m-10-5 2-2m1 4 2-2"/></>,appliance:<><rect x="4" y="2" width="16" height="20" rx="3"/><circle cx="12" cy="14" r="5"/><path d="M4 7h16m-12-3h1m3 0h1"/></>,help:<><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3v2m-1 3h.01"/></>,logout:<><path d="M9 3H3v18h6m-1-9h13m-5-5 5 5-5 5"/></>,plus:<path d="M12 4v16M4 12h16"/>,edit:<><path d="m4 16 12-12 4 4L8 20H4zM13 7l4 4"/></>
};
export function Glyph({name,...props}){return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]||paths.box}</svg>}
export function Modal({title,children,onClose,wide=false}){
 const ref=useRef();const t=useT();const feedback=useContext(Feedback);useEffect(()=>{const old=document.activeElement;ref.current.showModal();return()=>{old?.focus?.()}},[]);
 return <dialog ref={ref} className={'wh-modal '+(wide?'wide':'')} onCancel={e=>{e.preventDefault();onClose()}}><div className="wh-modal-head"><h2>{title}</h2><button onClick={onClose} aria-label={t('Close')}><Glyph name="close"/></button></div>{feedback.error&&<p className="wh-alert error" role="alert">{t(feedback.error)}</p>}{feedback.notice&&<p className="wh-alert success" role="status">{t(feedback.notice)}</p>}{children}</dialog>
}
export function Place({location,compact=false}){const t=useT();return <div className={'wh-place '+(compact?'compact':'')}><div className="wh-place-path"><Glyph name="pin"/><span>{location.facility} / {location.zone} / {t('Aisle')} {location.aisle}</span></div><div className="wh-place-bins">{['rack','shelf','bin'].map(k=><div key={k}><small>{t(k[0].toUpperCase()+k.slice(1))}</small><b>{location[k]}</b></div>)}</div></div>}
export function Specs({item,labels={}}){const t=useT();return <div className="wh-specs">{Object.entries(item.specs).map(([k,v])=><span key={k}><small>{t(labels[k]||k)}</small> {v}{k==='power_w'?' W':k==='capacity_l'?' L':''}</span>)}</div>}
export function ItemArt({collection}){return <div className={'wh-art '+collection}><Glyph name={{clothing:'shirt',footwear:'shoe',appliances:'appliance',home:'box'}[collection]}/></div>}
export function ScanBox({onRead,onError}){
 const t=useT(),video=useRef(),control=useRef(),[camera,C]=useState(false),[value,V]=useState('');
 useEffect(()=>{let cancelled=false;let reader;let found=false;
  if(camera)import('@zxing/browser').then(async({BrowserMultiFormatReader})=>{reader=new BrowserMultiFormatReader();const ctl=await reader.decodeFromVideoDevice(undefined,video.current,(result)=>{if(result&&!found&&!cancelled){found=true;onRead(result.getText());C(false)}});if(cancelled)ctl.stop();else control.current=ctl}).catch(e=>{onError(e.message);C(false)});
  return()=>{cancelled=true;control.current?.stop();control.current=null}
 },[camera]);
 return <div className="wh-scan"><form onSubmit={e=>{e.preventDefault();onRead(value);V('')}}><label>{t('Scan or enter code')}<input autoFocus value={value} onChange={e=>V(e.target.value)} maxLength={150} required placeholder={t('USB scanner or label code')}/></label><button className="primary">{t('Check code')}</button></form><button onClick={()=>C(!camera)}><Glyph name="scan"/>{t(camera?'Stop camera':'Use camera')}</button>{camera&&<video ref={video} muted playsInline/>}<small>{t('Camera needs HTTPS or localhost and permission. USB scanners and manual entry also work.')}</small></div>
}
export function Label({value,name,subtitle}){
 const [image,I]=useState('');useEffect(()=>{let active=true;import('qrcode').then(({default:QR})=>QR.toDataURL(value,{width:220,margin:2,errorCorrectionLevel:'M'})).then(url=>{if(active)I(url)});return()=>{active=false}},[value]);
 return <div className="wh-label">{image&&<img src={image} alt={'QR: '+value}/>}<b>{name}</b><span>{subtitle}</span><code>{value}</code></div>
}
