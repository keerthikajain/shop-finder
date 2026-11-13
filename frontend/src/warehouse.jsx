import React,{useContext,useEffect,useRef,useState} from 'react';
import {AccountSettings,request} from './accounts.jsx';
import {useT,Locale,APP_LANGUAGES} from './locale.js';
import {PICKING_VOICE_LANGUAGES,PICKING_START_VOICE_LANGUAGES,pickVoicePhrase,isStartPickingCommand} from './picking-voice-phrases.js';
import {startRecording,startLiveRecording} from './recording.js';
import HandsFreePicking from './hands-free-picking.jsx';
import VariantVoiceClarifier from './variant-voice-clarifier.jsx';
import {modeChoiceIntent,lookupVoiceIntent,modeChoicePhrases} from './lookup-mode.js';
import {lookupCopy} from './lookup-mode-copy.js';
import GuidedVoiceTurn from './guided-voice-turn.jsx';
import WorkspaceGreeting from './workspace-greeting.jsx';
import {pickConfirmationIntent} from './picking-confirmations.js';
import {voiceAction,actionPhrases,dialogueControl,plausibleShelfSuggestion,reportSubmitCommand,unclearReportSubmit} from './voice-review-commands.js';
import {fixedVoicePrompt} from './fixed-voice-prompt.js';
import {pickingUiCopy,pickingCommandLabel,pickingUiTip,reportUiCopy,reportUiTip,spokenYesNo} from './voice-ui-copy.js';
import {getThemePreference,resolveTheme} from './theme.js';
import {Mark,Glyph,Modal,Place,Specs,ItemArt,ScanBox,Label,Feedback} from './warehouse-ui.jsx';
import {ImportPanel,ItemEditor,MoveEditor,ReviewPanel} from './warehouse-manage.jsx';
import {BusinessSetup,StockEditor,ShelfGuide} from './store-workflow.jsx';
import './warehouse.css';
import './store-workflow.css';
const api=(path,body,method='POST')=>request('/warehouse'+path,{method,body:JSON.stringify(body)});
// Focus-language release: keep legacy recognition code but show only selected modes.
const VOICE_INPUT_LANGUAGES=[
 ['en-IN','English'],['hi-IN','हिन्दी / Hindi'],['hi-en','Hinglish'],['te-IN','తెలుగు / Telugu']
];
const ACTIVE_VOICE_CODES=new Set(VOICE_INPUT_LANGUAGES.map(([code])=>code));
const VOICE_LANGUAGE_DEFAULT={en:'en-IN',hi:'hi-IN','hi-en':'hi-en',te:'te-IN'};
export const locationFields=['facility','floor','zone','aisle','rack','shelf','bin'];
export const pathText=(l,isStarter=false)=>locationFields.filter(k=>!(isStarter&&k==='facility')).map(k=>l?.[k]).filter(Boolean).join(' / ');
export function nextPendingPickIndex(lines=[]){
 const entries=lines.map((line,index)=>({line,index})).filter(x=>!x.line.complete&&!x.line.deferred_reason&&!x.line.location_report_open&&!x.line.stale_catalogue);
 const key=line=>locationFields.map(field=>String(line.location?.[field]||'').toLocaleLowerCase()).join('\u0001');
 entries.sort((a,b)=>{
  const left=key(a.line),right=key(b.line);
  return (left<right?-1:left>right?1:0)||a.index-b.index;
 });
 return entries[0]?.index??-1;
}
const friendlyPath=(l,isStarter=false)=>pathText(l,isStarter);
export const cleanItem=p=>({sku:p.sku,collection:p.collection,name:p.name,category:p.category,brand:p.brand||'',aliases:p.aliases,barcode:p.barcode,photo_url:p.photo_url||'',specs:p.specs,synthetic:p.synthetic,placements:p.placements.map(l=>({...Object.fromEntries(locationFields.map(k=>[k,l[k]||''])),quantity:l.quantity??null}))});
export function VoiceButton({language,enabled,onText,onError,onPartial,live=false,autoStop=false,small=false,nav=false,iconOnly=false,label='',style='transcribe',enhanced=true,collection='all',candidates=[]}){
 const t=useT(),ref=useRef(),transcription=useRef(null),generation=useRef(0),[state,S]=useState('idle');
 useEffect(()=>{S('idle');return ()=>{generation.current++;transcription.current?.abort();transcription.current=null;ref.current?.stop(true);ref.current=null}},[language,collection]);
 async function record(){
  // Stopping a transcription must discard its eventual response, not submit an old command.
  if(state==='processing'){
   generation.current++;transcription.current?.abort();transcription.current=null;S('idle');return;
  }
  if(state==='recording'){S('processing');ref.current?.stop();return}
  const turn=++generation.current;
  S('starting');
  try{
   if(live){
    const handle=await startLiveRecording({language,style,enhanced,collection,candidates,
     onSegment:(text,detected)=>{if(turn===generation.current)onPartial?.(text,detected)},
     onComplete:(text,detected,details)=>{if(turn!==generation.current)return;S('idle');onText(text,detected,details)},
     onError:e=>{if(turn!==generation.current)return;S('idle');onError(e.message)}});
    if(turn!==generation.current){handle.stop(true);return}
    ref.current=handle;S('recording');return;
   }
   const handle=await startRecording(async blob=>{
    if(turn!==generation.current)return;
    const controller=new AbortController();transcription.current=controller;S('processing');
    try{
     const params=new URLSearchParams({language,style,enhanced:String(enhanced),collection});
     if(candidates.length)params.set('candidates',candidates.join(','));
     const result=await request('/voice/transcribe?'+params.toString(),{method:'POST',headers:{'Content-Type':'audio/wav'},body:blob,signal:controller.signal});
     if(turn===generation.current&&!controller.signal.aborted)onText(result.transcript,result.search_language,result);
    }catch(e){if(turn===generation.current&&!controller.signal.aborted)onError(e.message)}
    finally{if(transcription.current===controller)transcription.current=null;if(turn===generation.current)S('idle')}
   },e=>{if(turn===generation.current){S('idle');onError(e.message)}},{stopOnSilence:autoStop});
   if(turn!==generation.current){handle.stop(true);return}
   ref.current=handle;S('recording');
  }catch(e){if(turn===generation.current){S('idle');onError(e.message)}}
 }
 const stopping=state==='recording'||state==='processing';
 return <button type="button" className={'wh-voice '+(small?'small ':'')+(nav?'sf-mobile-speak ':'')+(iconOnly?'icon-only ':'')+(state==='recording'?'recording':'')} aria-label={iconOnly?(stopping?t('Stop recording')+' — ':'')+t(label||'Speak'):t(stopping?'Stop recording':live?'Speak live':'Speak')} title={iconOnly?t(label||'Speak'):undefined} aria-pressed={stopping} disabled={(!stopping&&!enabled)||state==='starting'} onClick={record}><Glyph name="mic"/>{iconOnly?null:nav?<span>{t('Speak')}</span>:t(stopping?'Stop recording':live?'Speak live':label||'Speak')}{!nav&&!iconOnly&&<span className="wh-wave" aria-hidden="true">{Array.from({length:9},(_,i)=><i key={i} style={{height:6+(i*7)%17}}/>)}</span>}</button>;
}
export default function WarehouseApp({user,preferences,logout}){
 const t=useT(),appLanguage=useContext(Locale),owner=user.role==='owner';
 const [feedbackText,FB]=useState(''),[feedbackSent,FBS]=useState(false),[ownerFeedback,OF]=useState([]),[voiceGuideText,VGT]=useState(''),[voiceGuideCommand,VGC]=useState(''),[voiceGuidePaused,VGP]=useState(true),[meta,M]=useState(null),[items,I]=useState([]),[collection,C]=useState('all'),[page,P]=useState('find'),[brand,BR]=useState(''),[locationFilter,LF]=useState(''),[query,Q]=useState(''),[task,T]=useState(null),[recent,R]=useState([]),[busy,B]=useState(false),[error,E]=useState(''),[notice,N]=useState(''),[modal,D]=useState(null),[group,G]=useState('request'),[filter,F]=useState(''),[category,CAT]=useState(''),[language,L]=useState(()=>{const saved=localStorage.getItem('sf-voice-'+user.id);return ACTIVE_VOICE_CODES.has(saved)?saved:(VOICE_LANGUAGE_DEFAULT[user.language]||'en-IN')}),[liveMode,LM]=useState(false),[detectedSearchLanguage,DSL]=useState(null),[hintLanguages,HL]=useState([]),[auto,AUTO]=useState(true),[handsFree,HF]=useState(true),[pendingVoicePick,PV]=useState(null),[searchTranscript,ST]=useState(''),[voiceQuery,VQ]=useState(false),[tour,TOUR]=useState(user.tour_done?null:0),[theme,TH]=useState(()=>getThemePreference(localStorage)),[speaking,SP]=useState(false),[filtersOpen,FO]=useState(false),[sizeFilter,SZ]=useState(''),[activeLine,AL]=useState(0),[reviewNonce,RV]=useState(0),[lookupMode,SetLookupMode]=useState('choice'),[modeListening,SetModeListening]=useState(false),[lookupVoicePaused,SetLookupVoicePaused]=useState(false),[lookupSelection,SetLookupSelection]=useState(null),[lookupPending,SetLookupPending]=useState(null);
 const audio=useRef(),audioURL=useRef(),audioRequest=useRef(null),playbackSerial=useRef(0),voiceFlowStopped=useRef(false),reportResumeRef=useRef(false),generation=useRef(0),main=useRef(),taskVoice=useRef(false),pendingResume=useRef(null),audioEndResolve=useRef(null),modeChoiceSerial=useRef(0);
 const pack=collection==='all'?{id:'all',name:'Whole store',fields:[...new Set(meta?.collections.flatMap(c=>[...c.fields,...(meta.settings.custom_fields[c.id]||[])])||[])]}:meta?.collections.find(c=>c.id===collection),labels=meta?.field_labels||{},voice=!!meta?.voice,prismaV3=meta?.stt_model!=='prisma-v2.5';
 const invalidHints=false;
 const locationIsStarter=loc=>!!loc&&items.some(p=>p.synthetic&&p.placements.some(x=>x.code===loc.code));
 const discovery=collection==='all'?(meta?.collections||[]).map(c=>items.find(p=>p.collection===c.id)).filter(Boolean):items.slice(0,4);
 const exampleQuery=discovery.slice(0,2).map(p=>[p.brand,p.name,p.specs.size_uk?'size '+p.specs.size_uk:p.specs.size&&/^\w+$/.test(p.specs.size)?'size '+p.specs.size:'',p.specs.power_w?p.specs.power_w+' W':'',p.specs.capacity_l?p.specs.capacity_l+' L':''].filter(Boolean).join(' ')).join(' and ');
 useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)');const apply=()=>document.documentElement.dataset.theme=resolveTheme(theme,media.matches);apply();localStorage.setItem('shop-finder-theme',theme);media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply)},[theme]);
 useEffect(()=>{localStorage.setItem('sf-voice-'+user.id,language)},[language,user.language]);
 useEffect(()=>{let active=true;request('/warehouse/meta').then(x=>{if(active){M(x);if(owner&&!x.settings.configured&&!user.is_challenge){P('business');TOUR(null)}}}).catch(e=>E(e.message));return()=>{active=false;audioRequest.current?.abort();audio.current?.pause();if(audioURL.current)URL.revokeObjectURL(audioURL.current)}},[]);
 useEffect(()=>{const n=++generation.current;const restoring=pendingResume.current;if(restoring&&restoring.collection===collection){T(restoring);Q(restoring.query);G('location');AL(Math.max(0,restoring.lines.findIndex(l=>!l.complete)));pendingResume.current=null}else{T(null);Q('')}E('');F('');CAT('');BR('');LF('');SZ('');FO(false);D(null);audio.current?.pause();SP(false);localStorage.setItem('sf-collection',collection);request('/warehouse/items?collection='+collection).then(x=>{if(n===generation.current)I(x)}).catch(e=>E(e.message));request('/warehouse/tasks').then(R).catch(e=>E(e.message))},[collection]);
 async function run(fn){B(true);E('');N('');try{return await fn()}catch(e){E(e.message)}finally{B(false)}}
 async function reload(){I(await request('/warehouse/items?collection='+collection));M(await request('/warehouse/meta'));R(await request('/warehouse/tasks'))}
 function stopSpeech(){
  audioEndResolve.current?.();audioEndResolve.current=null;
  playbackSerial.current++;
  audioRequest.current?.abort();
  audioRequest.current=null;
  audio.current?.pause();
  audio.current=null;
  SP(false);
 }
 function stopVoiceFlow(){
  voiceFlowStopped.current=true;
  VGP(true);
  stopSpeech();
 }
 async function speak(result,lineIndex=null){
  if(!voice)return;
  stopSpeech();const serial=playbackSerial.current,controller=new AbortController();
  audioRequest.current=controller;SP(true);
  try{
   const endpoint='/api/warehouse/tasks/'+encodeURIComponent(result.id)+(lineIndex==null?'/speak':'/lookup-line-audio/'+lineIndex);
   const r=await fetch(endpoint,{method:'POST',headers:{'X-Shop-Request':'1'},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)])});
   if(!r.ok){const data=await r.json();throw Error(data.detail||'Voice playback failed.')}
   const blob=await r.blob();if(serial!==playbackSerial.current)return;
   if(audioURL.current)URL.revokeObjectURL(audioURL.current);
   audioURL.current=URL.createObjectURL(blob);audio.current=new Audio(audioURL.current);
   audio.current.onended=()=>{if(serial===playbackSerial.current)SP(false)};
   await audio.current.play();
  }catch(e){if(e.name!=='AbortError'&&serial===playbackSerial.current)E(e.name==='NotAllowedError'?'Tap Read answer to allow audio playback.':e.message);if(serial===playbackSerial.current)SP(false)}
  finally{if(audioRequest.current===controller)audioRequest.current=null}
 }
 async function playFixedVoice(step,spokenLanguage=language,waitForEnd=false,force=false){
  if(!voice||(!force&&voiceFlowStopped.current))return;
  stopSpeech();
  const serial=playbackSerial.current,controller=new AbortController();
  audioRequest.current=controller;SP(true);
  try{
   // Reuse only fixed wording: item-specific messages still request fresh audio.
   const blob=await fixedVoicePrompt(step,spokenLanguage,{
    signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)])
   });
   if(serial!==playbackSerial.current)return;
   if(audioURL.current)URL.revokeObjectURL(audioURL.current);
   audioURL.current=URL.createObjectURL(blob);audio.current=new Audio(audioURL.current);
   let done;
   const ended=new Promise(resolve=>{done=resolve});
   audioEndResolve.current=done;
   audio.current.onended=()=>{if(serial===playbackSerial.current)SP(false);done()};
   audio.current.onerror=()=>{if(serial===playbackSerial.current)SP(false);done()};
   await audio.current.play();
   if(waitForEnd)await ended;
  }catch(e){
   if(e.name!=='AbortError'&&serial===playbackSerial.current)E(e.message);
   if(serial===playbackSerial.current)SP(false);
  }finally{
   if(serial===playbackSerial.current){
    audioEndResolve.current=null;
    if(audioRequest.current===controller)audioRequest.current=null;
   }
  }
 }
 // Search results stay on screen until the user chooses a workflow.
 // No pick, stock update, or report is created by selecting a mode.
 async function offerSearchMode(next){
  const serial=++modeChoiceSerial.current;
  SetLookupMode('choice');SetModeListening(false);
  SetLookupPendingSafe(null);SetLookupSelection(null);SetLookupVoicePaused(false);
  const resolved=next.lines?.length&&next.lines.every(l=>l.selected&&l.location)&&
   next.lines.some(l=>l.selected&&l.location&&!l.location_report_open&&!l.complete);
  if(!resolved||!voice||!PICKING_VOICE_LANGUAGES.includes(next.language))return;
  await playFixedVoice('choose_mode',next.language,true,true);
  if(serial===modeChoiceSerial.current)SetModeListening(true);
 }
 function SetLookupPendingSafe(next){SetLookupPending(next)}
 async function chooseSearchMode(choice,source=task){
  if(!source||busy)return false;
  const ready=source.lines?.length&&source.lines.every(l=>l.selected&&l.location)&&
   source.lines.some(l=>l.selected&&l.location&&!l.location_report_open&&!l.complete);
  if(!ready){N(lookupCopy(appLanguage,'resolve'));return false}
  modeChoiceSerial.current++;SetModeListening(false);stopSpeech();
  if(choice==='guided'){
   SetLookupMode('guided');SetLookupPendingSafe(null);SetLookupVoicePaused(true);
   await pickAction('start');return false;
  }
  if(choice!=='locations')return false;
  const options=source.lines.map((line,index)=>({...line,index})).filter(x=>x.selected&&x.location&&!x.location_report_open);
  SetLookupMode('locations');SetLookupPendingSafe(null);
  SetLookupSelection(options.length===1?options[0].index:null);
  SetLookupVoicePaused(false);N(lookupCopy(appLanguage,'locationsHint'));
  if(voice)await speak(source);
  return false;
 }
 async function confirmLookupPick(approved,source=task){
  const pending=lookupPending;
  if(!pending||!source||pending.taskId!==source.id)return false;
  if(!approved){
   SetLookupPendingSafe(null);N(lookupCopy(appLanguage,'cancelled'));
   if(voice)await playFixedVoice('lookup_cancelled',source.language,false,true);
   return false;
  }
  await run(async()=>{
   const line=source.lines[pending.line];
   if(!line||line.selected?.sku!==pending.sku||line.complete||line.location_report_open)
    throw Error(lookupCopy(appLanguage,'resolve'));
   let next;
   try{
    next=await api('/tasks/'+source.id+'/scan',{line:pending.line,kind:'manual',value:'confirmed'});
   }catch(e){
    // A request may have committed but its response may have been lost.
    const current=await request('/warehouse/tasks/'+encodeURIComponent(source.id));
    if(!current.lines[pending.line]?.complete)throw e;
    next=current;
   }
   T(next);SetLookupPendingSafe(null);
   N(lookupCopy(appLanguage,'saved'));
   R(await request('/warehouse/tasks'));
   if(voice)await playFixedVoice('lookup_picked_saved',next.language,false,true);
  });
  return false;
 }
 async function undoLookupPick(source=task,index=lookupSelection){
  if(!source||index==null||index<0||!source.lines[index]?.complete){
   N(lookupCopy(appLanguage,'selectFirst'));return false;
  }
  await run(async()=>{
   const next=await api('/tasks/'+source.id+'/picking/undo',{line:index,reason:'Worker corrected a lookup-only pick confirmation'});
   T(next);SetLookupPendingSafe(null);
   N(t('Confirmation undone. This item is ready to verify again.'));
   R(await request('/warehouse/tasks'));
  });
  return false;
 }
 async function requestLookupPick(source=task,index=lookupSelection){
  if(!source||index==null||index<0||index>=source.lines.length){
   N(lookupCopy(appLanguage,'selectFirst'));
   if(voice)await playFixedVoice('lookup_select',source?.language||language,true,true);
   return true;
  }
  const line=source.lines[index];
  if(!line.selected||!line.location||line.location_report_open||line.complete){
   N(lookupCopy(appLanguage,line.location_report_open?'reportPending':'resolve'));return false;
  }
  SetLookupPendingSafe({taskId:source.id,line:index,sku:line.selected.sku});
  N(lookupCopy(appLanguage,'confirmPicked'));
  if(voice)await playFixedVoice('lookup_confirm',source.language,false,true);
  return false;
 }
 async function reportLookupLocation(source=task,index=lookupSelection){
  if(!source||index==null||index<0||index>=source.lines.length){
   N(lookupCopy(appLanguage,'selectFirst'));
   if(voice)await playFixedVoice('lookup_select',source?.language||language,true,true);
   return true;
  }
  const line=source.lines[index];
  if(!line.selected||!line.location){N(lookupCopy(appLanguage,'resolve'));return false}
  SetLookupVoicePaused(true);SetLookupPendingSafe(null);stopSpeech();
  D({type:'report',item:line.selected,location:line.location,index,autoGuide:true});
  return false;
 }
 async function handleModeSpeech(transcript,source=task){
  const choice=modeChoiceIntent(source?.language||language,transcript);
  if(!source)return false;
  VGC(transcript);
  if(choice)return chooseSearchMode(choice,source);
  N(lookupCopy(appLanguage,'unknown'));
  if(voice)await playFixedVoice('choose_mode',source.language,true,true);
  return true;
 }
 async function handleLookupSpeech(transcript,source=task){
  if(!source)return false;
  VGC(transcript);
  const intent=lookupVoiceIntent(source.language,transcript,source.lines);
  if(intent.action==='stop'){SetLookupVoicePaused(true);stopSpeech();N(lookupCopy(appLanguage,'paused'));return false}
  if(intent.action==='help'){
   N(lookupCopy(appLanguage,'voiceHint'));
   if(voice)await playFixedVoice('lookup_help',source.language,false,true);
   return true;
  }
  if(lookupPending){
   if(intent.action==='yes'||intent.action==='no')
    return confirmLookupPick(intent.action==='yes',source);
   if(intent.action==='repeat'){
    if(voice)await playFixedVoice('lookup_confirm',source.language,false,true);
    return true;
   }
   N(lookupCopy(appLanguage,'strictConfirmation'));return true;
  }
  if(intent.action==='guided')return chooseSearchMode('guided',source);
  if(intent.action==='undo')return undoLookupPick(source,lookupSelection);
  if(intent.action==='select'){
   const line=source.lines[intent.line];
   if(!line?.selected||!line?.location){N(lookupCopy(appLanguage,'resolve'));return true}
   SetLookupSelection(intent.line);N(lookupCopy(appLanguage,'modeSaved'));
   if(voice)await speak(source,intent.line);
   return true;
  }
  if(intent.action==='repeat'){
   if(voice)await speak(source,lookupSelection);
   return true;
  }
  if(intent.action==='verify')return requestLookupPick(source,lookupSelection);
  if(intent.action==='report')return reportLookupLocation(source,lookupSelection);
  N(lookupCopy(appLanguage,'unknown'));
  if(voice)await playFixedVoice('lookup_unknown',source.language,true,true);
  return true;
 }
 async function search(text=query,fromVoice=voiceQuery,global=false,spokenLanguage=null){
  PV(null);VGC('');VGT('');stopVoiceFlow();
  if(!fromVoice)ST('');
  await run(async()=>{
   const result=await api('/search',{
    collection:global?'all':collection,
    query:!global&&sizeFilter&&text.trim()&&!text.toLowerCase().includes('size '+String(sizeFilter).toLowerCase())?text+' size '+sizeFilter:text,
    language,
    brand:global?'':brand,location:global?'':locationFilter
   });
   taskVoice.current=fromVoice;
   P('find');VQ(false);AL(0);
   T(result);
   N(result.lines.every(line=>line.selected&&line.location)?lookupCopy(appLanguage,'question'):lookupCopy(appLanguage,'resolve'));
   if(global)N(t('Label lookup searched across all product types, brands and locations.'));
   R(await request('/warehouse/tasks'));
   // Ask for a workflow only when every product variant is identified.
   // An unresolved item must be chosen before voice mode selection begins.
   void offerSearchMode(result);
  });
 }
 function navigate(p){if(p===page)return;PV(null);modeChoiceSerial.current++;SetModeListening(false);SetLookupVoicePaused(true);stopVoiceFlow();P(p);E('');N('');D(null);if(p!=='find')TOUR(null);main.current?.focus();window.scrollTo(0,0)}
 function goBack(){navigate('more')}
 async function choose(line,p,l){await run(async()=>{const next=await api('/tasks/'+task.id+'/choose',{line,collection:p.collection,sku:p.sku,location:l.code});T(next);AL(line);N(lookupCopy(appLanguage,'modeSaved'));if(next.lines.every(x=>x.selected&&x.location))void offerSearchMode(next)})}
 async function progressAfterPick(next,completed){
  T(next);
  // A product barcode alone does not finish the pick: wait for shelf verification.
  if(!completed||next.picking?.status!=='active'||next.picking?.paused)return;
  const deferred=next.lines.filter(line=>line.deferred_reason&&!line.complete).length;
  const index=nextPendingPickIndex(next.lines);
  if(index<0){
   VGP(true);PV(null);AL(0);
   if(!deferred&&next.lines.every(line=>line.complete)){
    const finished=await api('/tasks/'+next.id+'/picking/finish',{});
    T(finished);N(t('All done! Your picking list is complete.'));
    if(voice&&auto&&!voiceFlowStopped.current)await playFixedVoice('pick_done',finished.language);
   }else{
    if(voice&&auto&&!voiceFlowStopped.current)await playPickGuidance('next',next,0);
    N(t('No more items to guide right now. Unconfirmed and reported items are saved for review. Retry an item manually when ready.'));
    VGT(t('Remaining items are not marked picked. You can retry deferred items or pause picking.'));
   }
   return;
  }
  AL(index);
  if(voice&&handsFree&&auto&&!voiceFlowStopped.current&&!next.picking?.paused)VGP(false);
  N(completed?pickingUiCopy(appLanguage,'confirmed'):t('Moving to the next item. The previous item is saved as unresolved.'));
  if(window.matchMedia('(max-width:700px)').matches)
   requestAnimationFrame(()=>document.getElementById('sf-picking-line-'+index)?.scrollIntoView({behavior:'smooth',block:'center'}));
  if(voice&&auto&&!voiceFlowStopped.current)await playPickGuidance('next',next,index);
 }
 async function deferPick(source,line,reason){
  const next=await api('/tasks/'+source.id+'/picking/defer',{line,reason});
  PV(null);
  await progressAfterPick(next,true);
  R(await request('/warehouse/tasks'));
 }
 async function retryPick(line){
  if(!task||busy||pickPaused)return;
  await run(async()=>{
   const next=await api('/tasks/'+task.id+'/picking/retry',{line});
   T(next);AL(line);PV(null);VGP(!(voice&&handsFree));
   N(t('Item returned to picking. Finder will repeat its saved location.'));
   if(voice&&auto&&!voiceFlowStopped.current)await playPickGuidance('repeat',next,line);
   R(await request('/warehouse/tasks'));
  });
 }
 async function undoPick(line){
  if(!task||line<0||busy)return;
  await run(async()=>{
   const next=await api('/tasks/'+task.id+'/picking/undo',{line,reason:'Worker corrected an accidental confirmation'});
   T(next);AL(line);PV(null);
   N(t('Confirmation undone. This item is ready to verify again.'));
   R(await request('/warehouse/tasks'));
   if(voice&&!voiceFlowStopped.current){
    await playFixedVoice('pick_undo',next.language,true);
    if(auto&&!voiceFlowStopped.current)await playPickGuidance('repeat',next,line);
   }
  });
 }
 async function scan(line,kind,value){await run(async()=>{const next=await api('/tasks/'+task.id+'/scan',{line,kind,value});D(null);PV(null);await progressAfterPick(next,kind!=='product');await reload()})}
 async function playPickGuidance(command,source=task,line=activeLine,manual=false){
  if(!voice||!source||(!manual&&voiceFlowStopped.current))return;
  stopSpeech();const serial=playbackSerial.current,controller=new AbortController();
  audioRequest.current=controller;SP(true);
  try{
   const response=await fetch('/api/warehouse/tasks/'+encodeURIComponent(source.id)+'/picking/guide-audio',{
    method:'POST',headers:{'X-Shop-Request':'1','Content-Type':'application/json'},
    body:JSON.stringify({command,line}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)])
   });
   if(!response.ok){const err=await response.json();throw Error(err.detail||'Spoken guidance unavailable.')}
   const blob=await response.blob();
   if(serial!==playbackSerial.current||(!manual&&voiceFlowStopped.current))return;
   if(audioURL.current)URL.revokeObjectURL(audioURL.current);
   audioURL.current=URL.createObjectURL(blob);
   audio.current=new Audio(audioURL.current);
   audio.current.onended=()=>{if(serial===playbackSerial.current)SP(false)};
   await audio.current.play();
  }catch(err){if(err.name!=='AbortError'&&serial===playbackSerial.current){VGP(true);E(err.name==='NotAllowedError'?t('Tap Read guidance to allow audio playback. Then start listening when ready.'):err.message)}if(serial===playbackSerial.current)SP(false)}
  finally{if(audioRequest.current===controller)audioRequest.current=null}
 }
 async function voicePickCommand(transcript,source=task,manualRequest=false){
  if(!source||!transcript?.trim())return;
  const control=dialogueControl(source.language,transcript);
  // Informational Help remains available while picking is paused.
  if(source.picking?.paused&&control!=='help')return;
  VGC(transcript);
  if(control==='stop'){PV(null);stopVoiceFlow();VGT(pickingUiCopy(appLanguage,'stopSaved'));return false}
  if(control==='help'){
   VGT(pendingVoicePick?pickingUiTip(appLanguage,'confirm'):pickingUiTip(appLanguage,'available'));
   // Help is explicitly requested. It must speak even when automatic
   // hands-free guidance is paused; do not resume listening or change picks.
   if(voice)await playPickGuidance('help',source,pendingVoicePick?.line??activeLine,true);
   return;
  }
  if(control==='repeat'){
   // A worker can explicitly request a repeat while automatic voice is paused.
   // Play one answer; do not restart hands-free listening or change pick progress.
   if(voice&&(!voiceFlowStopped.current||manualRequest))
    await playPickGuidance(pendingVoicePick?'verify':'repeat',source,pendingVoicePick?.line??activeLine,manualRequest);
   return;
  }
  if(control==='back'){
   if(pendingVoicePick){const previous=pendingVoicePick.line;PV(null);VGT(pickingUiCopy(appLanguage,'backConfirm'));if(voice&&!voiceFlowStopped.current)await playPickGuidance('repeat',source,previous);return}
   const previous=Math.max(0,activeLine-1);AL(previous);VGT(pickingUiCopy(appLanguage,'backItem'));
   if(voice&&!voiceFlowStopped.current)await playPickGuidance('repeat',source,previous);
   return;
  }
  if(voiceAction(source.language,'undo',transcript)){
   if(lastConfirmedIndex<0){VGT(pickingUiCopy(appLanguage,'noConfirmedUndo'));return}
   PV(null);
   await undoPick(lastConfirmedIndex);
   // The reader pauses the microphone during Gnani TTS and resumes after playback.
   // Returning false would strand HandsFreePicking in a stopped state.
   return;
  }
  if(pendingVoicePick){
   const response=pickConfirmationIntent(source.language,transcript);
   if(response==='no'){const index=pendingVoicePick.line;PV(null);VGT(pickingUiCopy(appLanguage,'declined'));await run(()=>deferPick(source,index,'declined'));return}
   if(response==='yes'){
    const current=source.lines[pendingVoicePick.line];
    if(source.id!==pendingVoicePick.taskId||!current||current.complete||current.selected?.sku!==pendingVoicePick.sku){
     PV(null);E(t('The picking list changed. Please check the item again.'));return;
    }
    PV(null);
    await run(async()=>{
     const next=await api('/tasks/'+source.id+'/scan',{line:pendingVoicePick.line,kind:'manual',value:'confirmed'});
     VGT(pickingUiCopy(appLanguage,'confirmed'));
     await progressAfterPick(next,true);
     R(await request('/warehouse/tasks'));
    });
    return;
   }
   // During confirmation, Repeat replays the question rather than losing the pending item.
   const responseCommand=await api('/tasks/'+source.id+'/picking/command',{transcript,line:pendingVoicePick.line});
   if(responseCommand.action==='repeat'){
    VGT(pickingUiTip(appLanguage,'confirm'));
    if(voice)await playPickGuidance('repeat',source,pendingVoicePick.line);
    return;
   }
   if(responseCommand.action==='verify'){
    VGT(pickingUiTip(appLanguage,'confirm'));
    if(voice)await playPickGuidance('verify',source,pendingVoicePick.line);
    return;
   }
   if(responseCommand.action==='stop'){
    PV(null);stopVoiceFlow();VGT(pickingUiCopy(appLanguage,'stopSaved'));
    return false;
   }
   if(responseCommand.action==='report'){
    const index=pendingVoicePick.line,selected=source.lines[index];
    reportResumeRef.current=handsFree&&!voiceGuidePaused;
    PV(null);VGP(true);
    if(selected?.selected){
     D({type:'report',item:selected.selected,location:selected.location,index});
     VGT(pickingUiCopy(appLanguage,'reportHandoff'));
     if(voice)await playPickGuidance('report',source,index);
    }
    return false;
   }
   VGT(pickingUiTip(appLanguage,'confirm'));
   if(voice)await playPickGuidance('verify',source,pendingVoicePick.line);
   return;
  }
  return await run(async()=>{
   const answer=await api('/tasks/'+source.id+'/picking/command',{transcript,line:activeLine});
   VGT(answer.action==='unknown'?pickingUiTip(appLanguage,'available'):pickingUiCopy(appLanguage,'active'));
   if(answer.line!=null)AL(answer.line);
   if(answer.action==='verify'&&answer.line!=null){PV({taskId:source.id,line:answer.line,sku:source.lines[answer.line]?.selected?.sku});VGT(pickingUiTip(appLanguage,'confirm'));}
   if(answer.action==='report'&&answer.line!=null){
    reportResumeRef.current=handsFree&&!voiceGuidePaused;
    PV(null);VGP(true); // Stop the pick microphone before changing to the report step.
    const selected=source.lines[answer.line];
    if(selected?.selected){
     D({type:'report',item:selected.selected,location:selected.location,index:answer.line});
     VGT(pickingUiCopy(appLanguage,'reportHandoff'));
     if(voice)await playPickGuidance('report',source,answer.line);
    }
    return false; // The voice loop must not restart for this command.
   }
   if(answer.action==='stop'){PV(null);stopVoiceFlow();VGT(pickingUiCopy(appLanguage,'stopSaved'));return false}
   if(voice&&!voiceFlowStopped.current)await playPickGuidance(answer.action,source,answer.line??activeLine);
  })
 }
 async function removeUnresolvedLine(index){
  if(!task||task.picking?.status!=='ready')return;
  await run(async()=>{
   const next=await request('/warehouse/tasks/'+encodeURIComponent(task.id)+'/lines/'+index,{method:'DELETE'});
   T(next);AL(prev=>Math.max(0,Math.min(prev>index?prev-1:prev,next.lines.length-1)));
   N(t('Unresolved request removed. Your other items are unchanged.'));
   R(await request('/warehouse/tasks'));
  });
 }
 async function voiceStartPicking(transcript){
  VGC(transcript);
  if(!isStartPickingCommand(task?.language,transcript)){N(t('Command not recognized. Say Start picking or use the Start picking button.'));return}
  if(!canStartPick||busy){N(t(unresolvedLines.length?'Choose or remove unresolved variants before starting.':'All recorded locations have open reports. Owner verification is required.'));return}
  await pickAction('start');
 }
 async function pickAction(kind){if(!task)return;if(kind==='start'){modeChoiceSerial.current++;SetModeListening(false);SetLookupMode('guided');SetLookupPendingSafe(null)}await run(async()=>{const next=await api('/tasks/'+task.id+'/picking/'+kind,{});T(next);G('location');if(kind==='start'){
  PV(null);AL(Math.max(0,nextPendingPickIndex(next.lines)));
  voiceFlowStopped.current=false;
  VGC('');VGT('');
  const guided=voice&&PICKING_VOICE_LANGUAGES.includes(next.language);
  VGP(!(guided&&handsFree));
  N(t('Search confirmed. Finder will read the first location, then listen for your command. Manual controls are always available.'));
  if(guided)await playPickGuidance('start',next,Math.max(0,nextPendingPickIndex(next.lines)));
 }else{VGP(true);VGT('');N(t('Picking completed. No stock quantities were changed.'));if(voice&&!voiceFlowStopped.current)await playFixedVoice('pick_done',next.language)}R(await request('/warehouse/tasks'))})}
 async function togglePickPause(){
  if(!task||task.picking?.status!=='active'||busy)return;
  stopVoiceFlow();PV(null);
  await run(async()=>{
   const action=task.picking?.paused?'resume':'pause';
   const next=await api('/tasks/'+task.id+'/picking/'+action,{});
   T(next);
   if(action==='resume'){
    voiceFlowStopped.current=false;
    const guided=voice&&PICKING_VOICE_LANGUAGES.includes(next.language);
    VGP(!(guided&&handsFree));
    N(t('Picking resumed. Finder will repeat the current shelf, then listen again.'));
    if(guided)await playPickGuidance('repeat',next,Math.max(0,nextPendingPickIndex(next.lines)));
   }else N(t('Picking paused. Your verified progress is saved.'));
   R(await request('/warehouse/tasks'));
  });
 }
 async function resumePick(id){stopVoiceFlow();await run(async()=>{const restored=await request('/warehouse/tasks/'+encodeURIComponent(id));if(restored.collection!==collection){pendingResume.current=restored;C(restored.collection)}else{T(restored);Q(restored.query);G('location');AL(Math.max(0,nextPendingPickIndex(restored.lines)))}P('find');N(t('Picking session restored.'))})}
 const firstVoiceClarification=task?.lines.findIndex(line=>!line.selected&&line.candidates?.length>1)??-1;
 const picking=task?.picking||{status:'ready'},pickPaused=!!picking.paused,hasSearchCandidates=!!task?.lines.some(l=>l.selected||l.candidates.length),verifiedCount=task?.lines.filter(l=>l.complete).length||0,unresolvedLines=task?.lines.filter(l=>!l.selected||!l.location)||[],reportedLines=task?.lines.filter(l=>l.location_report_open)||[],eligibleLines=task?.lines.filter(l=>l.selected&&l.location&&!l.location_report_open)||[],canStartPick=!!task?.lines.length&&unresolvedLines.length===0&&eligibleLines.length>0,nextPickIndex=nextPendingPickIndex(task?.lines);
 const lastConfirmedIndex=task?.lines.reduce((best,line,i)=>line.complete&&
   (best<0||String(line.confirmed_at||'')>=String(task.lines[best].confirmed_at||''))?i:best,-1)??-1;
 const selected=task?.lines.filter(l=>l.selected)||[],locations=[...new Map(items.flatMap(p=>p.placements.map(l=>[l.code,l]))).values()],filtered=items.filter(p=>(!category||p.category===category)&&(!filter||[p.sku,p.name,p.brand,p.category,p.barcode,...p.aliases,...Object.values(p.specs),...p.placements.map(pathText)].join(' ').toLowerCase().includes(filter.toLowerCase())));
 const sizeOptions=[...new Set(items.flatMap(p=>['size','size_uk','size_eu'].map(k=>p.specs?.[k]).filter(Boolean).map(String)))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const guideLine=task?.lines[activeLine]?.selected?task.lines[activeLine]:selected[0];
 let ordered=(task?.lines||[]).map((l,i)=>({...l,index:i}));if(group==='location')ordered.sort((a,b)=>pathText(a.location||{}).localeCompare(pathText(b.location||{}),undefined,{numeric:true}));if(group==='category')ordered.sort((a,b)=>(a.selected?.category||'').localeCompare(b.selected?.category||''));if(picking.status==='active')ordered.sort((a,b)=>Number(a.complete)-Number(b.complete)||pathText(a.location||{}).localeCompare(pathText(b.location||{}),undefined,{numeric:true})||a.index-b.index);
 const nav=[['find','search','Find items'],['catalogue','grid','Catalogue'],['locations','pin','Locations'],...(owner?[['import','upload','Import items'],['business','box','Business setup']]:[]),...(!user.is_demo?[['review','history','Activity']]:[]),...(user.is_demo?[['feedback','message-circle','Feedback']]:[]),['settings','user','Settings']];
 const guide=[['One search, your whole store','Search grocery, clothing, footwear, appliances and home essentials together. Product types are optional filters.','wh-packs'],['Ask in your own words','Tap Speak, say one or several items, then check the transcript and search. You can also type.','wh-search'],['Resolve the details','Choose the right size or variant. The app shows the location levels recorded by your team.','wh-results'],['Confirm at the shelf','Scan the item, then the shelf label. Report a mismatch; owners can review and correct it.','wh-results']];
 useEffect(()=>{document.querySelectorAll('.wh-tour-target').forEach(el=>el.classList.remove('wh-tour-target'));if(tour!==null){const el=document.getElementById(guide[tour][2]);el?.classList.add('wh-tour-target');el?.scrollIntoView({block:'nearest',behavior:'smooth'})}},[tour]);
 async function closeTour(){TOUR(null);await run(()=>preferences({tour_done:true}))}
 return <Feedback.Provider value={{error,notice}}><div className={"wh-app sf-compact-app "+(page==='find'?'sf-find-page ':'')+(!voice?'sf-voice-unavailable':'')}><a href="#wh-main" className="skip-link">{t('Skip to workspace')}</a><aside className="wh-sidebar"><a className="wh-brand" href="#" onClick={e=>{e.preventDefault();navigate('find')}}><Mark/><span>finder<small>{t('VOICE WORKSPACE')}</small></span></a><div className="wh-org"><span className="wh-avatar">{user.username.slice(0,1).toUpperCase()}</span><div><b>{meta?.settings.name||user.username}</b><small>{t(owner?'Owner workspace':'Staff workspace')}</small></div></div><small className="wh-nav-label">{t('WORKSPACE')}</small><nav>{nav.map(([id,icon,name])=><React.Fragment key={id}>{id==='locations'&&(voice?<VoiceButton nav autoStop enabled={!busy} live={prismaV3&&liveMode} onPartial={(text)=>{Q(text);ST(text);VQ(true)}} language={language} style="transcribe" enhanced={prismaV3} collection={collection} onText={(text,detected)=>{Q(text);ST(text);DSL(detected);VQ(true);taskVoice.current=true;if(page!=='find')navigate('find');N(t('Heard you. Check or edit the transcript, then press Find items to review the matching products.'))}} onError={E}/>:<button className="sf-mobile-speak" type="button" aria-label={t('Scan a label')} onClick={()=>D({type:'lookup'})}><Glyph name="scan"/><span>{t('Scan a label')}</span></button>)}<button data-mobile-hide={!['find','catalogue','locations'].includes(id)} aria-current={page===id?'page':undefined} onClick={()=>navigate(id)}><Glyph name={icon}/><span className="sf-nav-desktop-label">{t(name)}</span><span className="sf-nav-mobile-label">{t(id==='find'?'Find':name)}</span>{id==='find'&&<span className="wh-active-dot"/>}</button></React.Fragment>)}<button type="button" className="sf-mobile-more" aria-current={page==='more'||!['find','catalogue','locations'].includes(page)?'page':undefined} onClick={()=>navigate('more')}><Glyph name="grid"/><span>{t('More')}</span></button></nav><div className="wh-sidebar-bottom"><button onClick={()=>{P('find');TOUR(0)}}><Glyph name="help"/>{t('Quick walkthrough')}</button><button onClick={()=>run(logout)}><Glyph name="logout"/>{t('Log out')}</button><button className="sf-sidebar-account" onClick={()=>navigate('settings')}><span className="wh-avatar">{user.username.slice(0,1).toUpperCase()}</span><span><b>{user.username}</b><small>{t(owner?'Owner':'Staff')}</small></span><Glyph name="arrow"/></button><div className="wh-brand-note"><span className="wh-dot"/>{t('A place for everything.')}</div></div></aside>
 <div className="wh-main-wrap"><header className={"wh-topbar "+(page==='more'?'sf-topbar-more':'')}><div className="wh-mobile-brand"><Mark/><span className="sf-mobile-header-copy"><small>finder</small><strong role="heading" aria-level="1">{t(page==='more'?'More':nav.find(x=>x[0]===page)?.[2]||'Settings')}</strong></span></div><div className="wh-breadcrumb">{meta?.settings.name||t('Workspace')}{page!=='find'&&<><span>/</span><b>{t(page==='more'?'More':nav.find(x=>x[0]===page)?.[2]||'')}</b></>}</div><div className="wh-top-actions">{['find','catalogue','locations'].includes(page)&&<button type="button" className="sf-header-scan" aria-label={t('Scan a label')} onClick={()=>D({type:'lookup'})}><Glyph name="scan"/><span>{t('Scan a label')}</span></button>}<span className="wh-avatar small">{user.username.slice(0,1).toUpperCase()}</span></div></header>
 <main id="wh-main" ref={main} tabIndex={-1}><WorkspaceGreeting user={user} appLanguage={appLanguage} interrupt={!!task&&task.picking?.status==='active'&&!task.picking?.paused||speaking||!!modal}/>{['import','business','review','settings'].includes(page)&&<button className="sf-more-back sf-page-back" type="button" onClick={goBack}><Glyph name="arrow"/>{t('Back to previous page')}</button>}
 {page==='find'&&<section className="wh-page-heading"><div><span className="wh-eyebrow">{t('FIND YOUR FLOW')}</span><h1>{t(page==='find'?'Find your next item.':page==='catalogue'?'Your catalogue, connected.':page==='locations'?'A place for everything.':page==='import'?'From spreadsheet to shelf.':page==='review'?'Keep every location accurate.':page==='business'?'Built around your business.':page==='settings'?'Settings':page==='more'?'Your workspace tools.':'Your workspace, your way.')}</h1><p>{t(page==='find'?'Every category. One search.':page==='catalogue'?'Names, variants and storage locations in one place.':page==='locations'?'Browse your storage hierarchy and print shelf labels.':page==='import'?'Map your columns, review changes, then save.':page==='review'?'Resolve reports and see who changed what.':page==='business'?'Product types, storage labels and team permissions.':page==='settings'?'Manage your language and account.':page==='more'?'Everything else you need, in one place.':'Manage your language, password and team access.')}</p></div>{page!=='account'&&<div className="wh-context-count"><strong>{items.length}</strong><span>{t('catalogue items')}<small>{locations.length} {t('locations')}</small></span></div>}</section>}
 {page!=='find'&&page!=='more'&&<div className="sf-compact-page-title"><h1>{t(nav.find(x=>x[0]===page)?.[2]||'Settings')}</h1></div>}
 {meta&&!['find','account','business','more','settings'].includes(page)&&<div id="wh-packs" className="sf-search-filters"><label>{t('Product type')}<select aria-label={t('Product type')} value={collection} disabled={busy} onChange={e=>C(e.target.value)}><option value="all">{t('All types')}</option>{meta.collections.filter(c=>meta.settings.collections.includes(c.id)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label> {page==='find'&&<><label>{t('Brand')}<select aria-label={t('Brand')} value={brand} onChange={e=>BR(e.target.value)}><option value="">{t('All brands')}</option>{[...new Set(items.map(p=>p.brand).filter(Boolean))].sort().map(b=><option key={b}>{b}</option>)}</select></label><label>{t('Location filter')}<select aria-label={t('Location filter')} value={locationFilter} onChange={e=>LF(e.target.value)}><option value="">{t('Every location')}</option>{locations.map(l=><option key={l.code} value={l.code}>{pathText(l,locationIsStarter(l))}</option>)}</select></label></>}</div>}
 {error&&<div className="wh-alert error" role="alert"><b>{t('Could not complete that action.')}</b> {t(error)}<button onClick={()=>E('')} aria-label={t('Dismiss')}><Glyph name="close"/></button></div>}{notice&&<div className="wh-alert success" role="status">{notice}<button onClick={()=>N('')} aria-label={t('Dismiss')}><Glyph name="close"/></button></div>}
 {!meta?<div className="wh-empty">{t('Loading your workspace…')}</div>:<>
 {!meta.settings.configured&&!user.is_challenge&&page==='find'&&<div className="wh-alert"><span>{owner?'Add your business details and import your catalogue to set up recorded shelf locations.':'Ask your workspace owner to finish setting up the catalogue and locations.'}</span>{owner&&<button onClick={()=>navigate('business')}>Set up my store<Glyph name="arrow"/></button>}</div>}
 {page==='business'&&owner&&<BusinessSetup key={meta.settings.revision} settings={meta.settings} collections={meta.collections} {...{run,busy}} first={!meta.settings.configured} onSave={async()=>{C('all');await reload();navigate('find');N('Your workspace settings are saved.')}}/>}
 {page==='find'&&<><div className="wh-find-top"><section id="wh-search" className="wh-panel wh-ask"><div className="wh-panel-title"><span><Glyph name="mic"/>{t('Your voice, your workspace')}</span><button className="wh-scan-shortcut" onClick={()=>D({type:'lookup'})}><Glyph name="scan"/>{t('Scan a label')}</button></div><form onSubmit={e=>{e.preventDefault();search()}}><label className="sr-only" htmlFor="wh-query">{t('What are you looking for?')}</label><input type="search" id="wh-query" value={query} onChange={e=>{Q(e.target.value);ST('');VQ(false);DSL(null)}} maxLength={600} required placeholder={t('Speak to find an item, or type here')}/><div className="wh-composer-actions"><VoiceButton key={collection} autoStop enabled={voice&&!busy&&!invalidHints} live={prismaV3&&liveMode} candidates={[]} onPartial={(text)=>{Q(text);VQ(true)}} language={language} style="transcribe" enhanced={prismaV3} collection={collection} onText={(text,detected)=>{Q(text);ST(text);DSL(detected);VQ(true);N(t('Heard you. Check or edit the transcript, then press Find items to review the matching products.'))}} onError={E}/><label className="wh-voice-lang"><span className="sr-only">{t('Voice language')}</span><select aria-label={t('Voice language')} value={language} onChange={e=>{L(e.target.value);DSL(null)}}>{VOICE_INPUT_LANGUAGES.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label><button className="primary wh-search-submit" disabled={busy||!query.trim()}>{t(busy?'Working…':voiceQuery?'Find spoken items':'Find items')}<Glyph name="arrow"/></button></div></form>{searchTranscript&&<div className="sf-visible-transcript" role="status"><strong>{t('You said')}</strong><p>{searchTranscript}</p><small>{t('Speech recognized by Gnani Prisma. Check or edit the text above, then select Find items. Picking will not start until you confirm the matched products.')}</small></div>}<div className="wh-ask-bottom"><label><input type="checkbox" checked={voice&&auto} disabled={!voice} onChange={e=>AUTO(e.target.checked)}/>{t('Automatically speak the next item during picking')}</label><label><input type="checkbox" checked={voice&&handsFree} disabled={!voice} onChange={e=>{HF(e.target.checked);VGP(true)}}/>{t('Hands-free picking commands')}</label>{prismaV3&&voice&&<div className="sf-prisma-options"><label className="sf-live-mode"><input type="checkbox" checked={liveMode} onChange={e=>LM(e.target.checked)}/>{t('Live speech segments')}</label></div>}{!voice&&<small>{t('Voice search is unavailable. You can still type a request.')}</small>}</div>{false&&<details className="sf-voice-hints"><summary>{t('Expected languages (optional)')} · {hintLanguages.length?hintLanguages.length+' selected':'All 10'}</summary><p>{t('Leave all unchecked to identify any supported language. Or choose 2–4 likely languages to improve short recordings. Other languages may still be detected.')}</p><div className="sf-voice-hint-grid">{VOICE_INPUT_LANGUAGES.map(([code,name])=><label key={code}><input type="checkbox" checked={hintLanguages.includes(code)} disabled={busy||(!hintLanguages.includes(code)&&hintLanguages.length>=4)} onChange={e=>HL(old=>e.target.checked?[...old,code]:old.filter(x=>x!==code))}/>{name}</label>)}</div>{invalidHints&&<p className="sf-voice-hint-error" role="alert">{t('Choose two languages or clear all to use automatic detection.')}</p>}</details>}{!!exampleQuery&&<div className="wh-example"><small>{t('TRY ASKING')}</small><button disabled={busy} onClick={()=>{Q(exampleQuery);search(exampleQuery,false)}}>{exampleQuery}<Glyph name="arrow"/></button></div>}</section>{!task&&<details className="wh-panel wh-session-card" defaultOpen={!!task}><summary>{t('Recent requests')}</summary><div className="wh-panel-title"><span><Glyph name="history"/>{t('Recent requests')}</span><small>{t('Recent activity')}</small></div>{recent.filter(r=>collection==='all'||r.collection===collection).length?recent.filter(r=>collection==='all'||r.collection===collection).slice(0,3).map(r=><button className="wh-recent" key={r.id} onClick={()=>r.picking?.status==='active'?resumePick(r.id):(Q(r.query),search(r.query,false))}><span>{r.query}<small>{r.lines.length} {t('requested items')}</small></span><Glyph name="arrow"/></button>):<div className="wh-recent-empty"><div className="wh-orbit"><Mark large/></div><h3>{t('Ready when you are.')}</h3><p>{t('Your recent requests will appear here. Start with a name, size or item code.')}</p></div>}</details>}</div>
 <button type="button" className="sf-mobile-filter-toggle" aria-expanded={filtersOpen} aria-controls="wh-packs" onClick={()=>FO(v=>!v)}><Glyph name="grid"/>{t('Filters')} {filtersOpen?'−':'+'}</button>{meta&&<div id="wh-packs" className={'sf-search-filters '+(filtersOpen?'is-open':'')}><label>{t('Product type')}<select aria-label={t('Product type')} value={collection} disabled={busy} onChange={e=>C(e.target.value)}><option value="all">{t('All types')}</option>{meta.collections.filter(c=>meta.settings.collections.includes(c.id)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label> {page==='find'&&<><label>{t('Brand')}<select aria-label={t('Brand')} value={brand} onChange={e=>BR(e.target.value)}><option value="">{t('All brands')}</option>{[...new Set(items.map(p=>p.brand).filter(Boolean))].sort().map(b=><option key={b}>{b}</option>)}</select></label><label>{t('Size filter')}<select aria-label={t('Size filter')} value={sizeFilter} onChange={e=>SZ(e.target.value)}><option value="">{t('All sizes')}</option>{sizeOptions.map(sz=><option key={sz} value={sz}>{sz}</option>)}</select></label><label>{t('Location filter')}<select aria-label={t('Location filter')} value={locationFilter} onChange={e=>LF(e.target.value)}><option value="">{t('Every location')}</option>{locations.map(l=><option key={l.code} value={l.code}>{pathText(l,locationIsStarter(l))}</option>)}</select></label></>}</div>}
 <section id="wh-results" className="wh-results"><div className="wh-section-title"><div><span className="wh-eyebrow">{t(task?'YOUR WORK LIST':'EXPLORE THE WORKSPACE')}</span><h2>{task?<>{t('Your worklist')} <small className="sf-work-summary">{selected.length} {t('located')} · {task.lines.filter(l=>!l.selected&&l.candidates.length).length} {t('need a detail')} · {task.lines.filter(l=>!l.selected&&!l.candidates.length).length} {t('Not found')}</small></>:t(items.length?'Explore your catalogue':'Get your catalogue ready')}</h2></div>{task?<div className="wh-toolbar sf-worklist-controls"><select className="sf-worklist-order" aria-label={t('Group results')} value={group} onChange={e=>G(e.target.value)}><option value="request">{t('Request order')}</option><option value="category">{t('By category')}</option><option value="location">{t('By location')}</option></select><button disabled={!voice||(busy&&!speaking)} onClick={()=>speaking?stopSpeech():speak(task)}><Glyph name="sound"/>{t(speaking?'Stop audio':'Read answer')}</button></div>:items.length?<button className="sf-view-catalogue" onClick={()=>navigate('catalogue')}>{t('View catalogue')}<Glyph name="arrow"/></button>:null}</div>
 {task?<><div className="sf-request-review" role="status"><strong>{t('Confirm your request')}</strong><p>{task.query}</p><small>{t('Is this the item you meant? Check the matched products and locations below. To correct the request, edit the search above and select Find items again.')}</small></div><p className="wh-response" role="status">{task.display_text||task.spoken_text}</p>
 {hasSearchCandidates?<>
 {picking.status==='ready'&&lookupMode==='choice'&&<section className="wh-panel sf-lookup-mode" aria-label={lookupCopy(appLanguage,'heading')}>
  <h3>{lookupCopy(appLanguage,'heading')}</h3>
  <p>{lookupCopy(appLanguage,unresolvedLines.length?'resolve':'question')}</p>
  <div className="sf-lookup-actions">
   <button className="primary" type="button" disabled={busy||!canStartPick} onClick={()=>chooseSearchMode('guided')}><Glyph name="check"/>{lookupCopy(appLanguage,'guided')}</button>
   <button type="button" disabled={busy||!canStartPick} onClick={()=>chooseSearchMode('locations')}><Glyph name="pin"/>{lookupCopy(appLanguage,'locations')}</button>
  </div>
  {voice&&PICKING_VOICE_LANGUAGES.includes(task.language)&&canStartPick&&<>
   <p className="sf-lookup-phrase" role="status">{lookupCopy(appLanguage,'voiceHint')} <span lang={task.language==='hi-en'?'hi-Latn':task.language}>{modeChoicePhrases(task.language).guided} / {modeChoicePhrases(task.language).locations}</span></p>
   {modeListening?<div className="sf-lookup-voice"><HandsFreePicking appLanguage={appLanguage} enabled={!busy&&!speaking&&!modal&&page==='find'} language={task.language} collection={collection} onError={E} onCommand={text=>handleModeSpeech(text)}/><button type="button" onClick={()=>SetModeListening(false)}>{lookupCopy(appLanguage,'stopVoice')}</button></div>:
    <div className="sf-lookup-voice"><VoiceButton small autoStop enabled={!busy&&!speaking} language={task.language} onText={text=>handleModeSpeech(text)} onError={E} label={lookupCopy(appLanguage,'speakChoice')}/><button type="button" disabled={busy||speaking} onClick={()=>void offerSearchMode(task)}>{lookupCopy(appLanguage,'listen')}</button></div>}
  </>}
 </section>}
 {picking.status==='ready'&&lookupMode==='locations'&&<section className="wh-panel sf-lookup-mode" aria-label={lookupCopy(appLanguage,'locationsTitle')}>
  <h3>{lookupCopy(appLanguage,'locationsTitle')}</h3>
  <p>{lookupCopy(appLanguage,'locationsHint')}</p>
  <div className="sf-lookup-actions">
   <button type="button" disabled={busy} onClick={()=>speak(task)}><Glyph name="sound"/>{lookupCopy(appLanguage,'repeat')}</button>
   <button className="primary" type="button" disabled={busy||!canStartPick||nextPickIndex<0} onClick={()=>chooseSearchMode('guided')}><Glyph name="check"/>{lookupCopy(appLanguage,'startGuided')}</button>
  </div>
  {task.lines.filter(line=>line.selected&&line.location).length>1&&<div className="sf-lookup-items" aria-label={lookupCopy(appLanguage,'select')}>
   {task.lines.map((line,index)=>line.selected&&line.location?<button type="button" key={index} disabled={busy||!!lookupPending} aria-pressed={lookupSelection===index} onClick={()=>{SetLookupSelection(index);if(voice)void speak(task,index)}}>
    {line.selected.name} · {line.selected.sku}{line.complete?' ✓':''}
   </button>:null)}
  </div>}
  {lookupSelection!=null&&task.lines[lookupSelection]?.selected&&<div className="sf-lookup-selected">
   <strong>{lookupCopy(appLanguage,'selected')}: {task.lines[lookupSelection].selected.name} · {task.lines[lookupSelection].selected.sku}</strong>
   <p>{friendlyPath(task.lines[lookupSelection].location,!!task.lines[lookupSelection].selected.synthetic)}</p>
   <div className="sf-lookup-actions">
    <button type="button" disabled={busy||!!lookupPending||task.lines[lookupSelection].complete||task.lines[lookupSelection].location_report_open} onClick={()=>requestLookupPick()}>{lookupCopy(appLanguage,'markPicked')}</button>
    {task.lines[lookupSelection].complete&&<button type="button" disabled={busy} onClick={()=>undoLookupPick()}>{lookupCopy(appLanguage,'undo')}</button>}
    <button type="button" disabled={busy||!!lookupPending} onClick={()=>reportLookupLocation()}>{lookupCopy(appLanguage,'report')}</button>
    {owner&&<button type="button" disabled={busy} onClick={()=>D({type:'move',item:task.lines[lookupSelection].selected,location:task.lines[lookupSelection].location})}>{t('Correct location')}</button>}
    {(owner||meta?.settings?.staff_stock)&&<button type="button" disabled={busy} onClick={()=>D({type:'stock',item:task.lines[lookupSelection].selected,location:task.lines[lookupSelection].location})}>{lookupCopy(appLanguage,'updateStock')}</button>}
    <button type="button" disabled={busy} onClick={()=>speak(task,lookupSelection)}>{lookupCopy(appLanguage,'repeat')}</button>
   </div>
  </div>}
  {lookupSelection==null&&<p role="status">{lookupCopy(appLanguage,'selectFirst')}</p>}
  {lookupPending&&<div className="sf-lookup-confirm" role="status">
   <strong>{lookupCopy(appLanguage,'confirmPicked')}</strong>
   <span>{task.lines[lookupPending.line]?.selected?.name} · {task.lines[lookupPending.line]?.selected?.sku}</span>
   <p>{pickingUiTip(appLanguage,'speakHint')} <span lang={task.language==='hi-en'?'hi-Latn':task.language}>{spokenYesNo(task.language).join(' / ')}</span></p>
   <div className="sf-lookup-actions"><button className="primary" type="button" disabled={busy} onClick={()=>confirmLookupPick(true)}>{lookupCopy(appLanguage,'yes')}</button><button type="button" disabled={busy} onClick={()=>confirmLookupPick(false)}>{lookupCopy(appLanguage,'no')}</button></div>
  </div>}
  {voice&&PICKING_VOICE_LANGUAGES.includes(task.language)&&<>
   <div className="sf-lookup-voice">
    {!lookupVoicePaused?<HandsFreePicking appLanguage={appLanguage} enabled={!busy&&!speaking&&!modal&&page==='find'} language={task.language} collection={collection} onError={E} onCommand={text=>handleLookupSpeech(text)}/>:
      <VoiceButton small autoStop enabled={!busy&&!speaking} language={task.language} label={lookupCopy(appLanguage,'speakChoice')} onError={E} onText={text=>handleLookupSpeech(text)}/>}
    <button type="button" disabled={busy&&!speaking} onClick={()=>{if(speaking){stopSpeech();SetLookupVoicePaused(true)}else SetLookupVoicePaused(v=>!v)}}>{lookupCopy(appLanguage,lookupVoicePaused&&!speaking?'resumeVoice':'stopVoice')}</button>
    <button type="button" disabled={busy} onClick={()=>handleLookupSpeech(pickVoicePhrase(task.language,'help'))}>{lookupCopy(appLanguage,'help')}</button>
   </div>
   <small className="sf-lookup-phrase">{lookupCopy(appLanguage,'voiceHint')} <span lang={task.language==='hi-en'?'hi-Latn':task.language}>{pickVoicePhrase(task.language,'verify')} / {pickVoicePhrase(task.language,'report')} / {pickVoicePhrase(task.language,'repeat')}</span></small>
  </>}
 </section>}
 {(picking.status!=='ready'||lookupMode==='guided')&&<section className="wh-panel sf-guided-picking" aria-label={t('Guided picking')}>
  <div className="sf-picking-head"><div><span className="wh-eyebrow">{t('Guided picking')}</span><h3>{t(picking.status==='completed'?'Picking completed':pickPaused?'Picking paused':picking.status==='active'?'Picking in progress':'Ready to pick')}</h3><small>{pickingUiCopy(appLanguage,picking.status==='ready'?'ready':'active')}</small></div><b>{verifiedCount}/{task.lines.length}</b></div>
  <progress aria-label={t('Picking progress')} max={task.lines.length} value={verifiedCount}/>
  {lastConfirmedIndex>=0&&<div className="sf-picking-undo"><button type="button" disabled={busy||pickPaused} onClick={()=>undoPick(lastConfirmedIndex)}>{pickingUiCopy(appLanguage,'undo')}</button>{voice&&<VoiceButton small autoStop enabled={!busy&&!pickPaused&&!speaking} language={task.language} label={pickingUiCopy(appLanguage,'sayUndo')} onError={E} onText={text=>{if(voiceAction(task.language,'undo',text))undoPick(lastConfirmedIndex);else E(t('Say: ')+actionPhrases(task.language,'undo')[0])}}/>}</div>}
  {picking.status!=='completed'&&<div className="sf-voice-guide">
    {picking.status==='ready'&&<p className="sf-voice-guide-preview" role="status">{unresolvedLines.length>0?t('Choose or remove the unresolved variants below before starting. Finder will not guess a size or version.'):reportedLines.length>0?t('Reported shelf locations are skipped until verified. Confirm to guide the remaining items automatically.'):t('All items are ready. Confirm search once; Finder will speak the first location and then listen automatically.')}</p>}
   <div className="sf-voice-guide-heading"><strong>{pickingUiCopy(appLanguage,'heading')}</strong><small>{picking.status==='ready'?(unresolvedLines.length?t('Finish reviewing your choices to begin.'):reportedLines.length?t('Reported locations are skipped until checked.'):pickingUiCopy(appLanguage,'ready')):pendingVoicePick?pickingUiTip(appLanguage,'confirm'):pickingUiTip(appLanguage,'available')}</small></div>
   {PICKING_VOICE_LANGUAGES.includes(task.language)?<>
    <div className="sf-voice-guide-actions">
     
     {picking.status==='active'&&voice&&(!handsFree||voiceGuidePaused)&&<VoiceButton small autoStop enabled={!busy&&!speaking&&!pickPaused} language={task.language} onError={E} onText={transcript=>voicePickCommand(transcript,task,true)} label={pickingUiCopy(appLanguage,'listen')}/>}
     {picking.status==='active'&&voice&&handsFree&&!voiceGuidePaused&&!pickPaused&&<HandsFreePicking appLanguage={appLanguage} enabled={!busy&&!speaking&&!modal&&page==='find'} language={task.language} collection={collection} onError={message=>{E(message)}} onCommand={transcript=>voicePickCommand(transcript)}/>}
     <button type="button" disabled={picking.status!=='active'||(busy&&!speaking)||(!speaking&&(!voice||pickPaused))} onClick={()=>speaking?stopVoiceFlow():playPickGuidance('repeat',task,activeLine,true)}>{pickingUiCopy(appLanguage,speaking?'stopAudio':'read')}</button>
     {picking.status==='active'&&voice&&handsFree&&<button type="button" className="sf-voice-listen-toggle" aria-pressed={!voiceGuidePaused} disabled={voiceGuidePaused&&(busy||speaking||pickPaused)} onClick={()=>{if(!voiceGuidePaused){PV(null);stopVoiceFlow();return}voiceFlowStopped.current=false;VGP(false);if(task&&nextPickIndex>=0&&auto)playPickGuidance('repeat',task,nextPickIndex)}}>{pickingUiCopy(appLanguage,voiceGuidePaused?'resume':'stop')}</button>}
    </div>
    <small className="sf-voice-guide-spoken-hint">{pickingUiTip(appLanguage,'speakHint')}</small>
    <div className="sf-voice-guide-choices" aria-label={pickingUiCopy(appLanguage,'secondary')}>
    {['verify','report','repeat','next','stop','help'].map(action=><button key={action} type="button" disabled={action==='help'?(!voice||busy):(picking.status!=='active'||busy||pickPaused)} onClick={()=>action==='repeat'&&voiceFlowStopped.current?playPickGuidance('repeat',task,activeLine,true):voicePickCommand(pickVoicePhrase(task.language,action))}>
     <span className="sf-voice-command-label">{pickingCommandLabel(appLanguage,action)}</span>
     <small className="sf-voice-command-phrase" lang={task.language==='hi-en'?'hi-Latn':task.language}>{pickVoicePhrase(task.language,action)}</small>
    </button>)}
   </div>
   </>:<small>{t('This language is not supported for spoken picking commands. Use scanning or manual verification.')}</small>}
   {voiceGuideCommand&&<div className="sf-guide-transcript" role="status"><strong>{pickingUiCopy(appLanguage,'recognized')}:</strong> {voiceGuideCommand}</div>}{pendingVoicePick&&<div className="sf-voice-pick-confirm" role="status"><strong>{pickingUiTip(appLanguage,'confirm')}</strong><span>{task.lines[pendingVoicePick.line]?.selected?.name} · {task.lines[pendingVoicePick.line]?.selected?.sku}</span><p>{pickingUiTip(appLanguage,'speakHint')} <span lang={task.language==='hi-en'?'hi-Latn':task.language}>{spokenYesNo(task.language).join(' / ')}</span></p><div><button type="button" disabled={busy} onClick={()=>voicePickCommand(spokenYesNo(task.language)[0])}>{pickingUiCopy(appLanguage,'yesPicked')}</button><button type="button" disabled={busy} onClick={()=>{const index=pendingVoicePick.line;PV(null);VGT(pickingUiCopy(appLanguage,'declined'));run(()=>deferPick(task,index,'declined'))}}>{pickingUiCopy(appLanguage,'noNext')}</button></div></div>}
   {voiceGuideText&&<p className="sf-guide-reply" role="status">{voiceGuideText}</p>}{picking.status==='active'&&voice&&handsFree&&<small role="status">{pickingUiCopy(appLanguage,voiceGuidePaused?'paused':speaking?'speaking':'listening')}</small>}
  </div>}
  {picking.status==='ready'?<div className="sf-picking-actions"><button className="primary" type="button" disabled={busy||!canStartPick} onClick={()=>pickAction('start')}><Glyph name="check"/>{t('Confirm search and begin picking')}</button>{voice&&PICKING_START_VOICE_LANGUAGES.includes(task.language)&&<VoiceButton small autoStop enabled={!busy&&canStartPick} language={task.language} label={t('Confirm search by voice')} onError={E} onText={voiceStartPicking}/>} {!canStartPick&&unresolvedLines.length>0&&<div className="sf-pick-review-needed" role="status"><strong>{unresolvedLines.length} {t('item(s) still need your choice before picking can start.')}</strong><button type="button" disabled={busy} onClick={()=>{const index=task.lines.findIndex(line=>!line.selected||!line.location);if(index>=0){AL(index);document.getElementById('sf-picking-line-'+index)?.scrollIntoView({behavior:'smooth',block:'center'});document.getElementById('sf-picking-line-'+index)?.focus({preventScroll:true})}}}>{t('Review unresolved items')} <Glyph name="arrow"/></button></div>} {reportedLines.length>0&&<small className="sf-pick-reported-note" role="status">{reportedLines.length} {t('reported shelf location(s) are excluded from picking until owner review. They remain unconfirmed.')}</small>}{!canStartPick&&!unresolvedLines.length&&<small role="status">{t('No eligible items remain. Ask the owner to verify the reported locations.')}</small>}</div>:
   picking.status==='active'?<div className="sf-picking-actions"><span>{nextPickIndex<0?t(verifiedCount===task.lines.length?'All items verified. Finish the pick.':'No more pending picks. Review deferred items below.'):pickingUiCopy(appLanguage,'current')+': '+task.lines[nextPickIndex].selected.name+' · '+pathText(task.lines[nextPickIndex].location,!!task.lines[nextPickIndex].selected.synthetic)}</span><div><button type="button" className="sf-pick-pause-toggle" aria-pressed={pickPaused} disabled={busy} onClick={togglePickPause}>{pickingUiCopy(appLanguage,pickPaused?'resumePicking':'pause')}</button><button type="button" disabled={busy||pickPaused||nextPickIndex<0} onClick={()=>{AL(nextPickIndex);document.getElementById('sf-picking-line-'+nextPickIndex)?.scrollIntoView({behavior:'smooth',block:'center'})}}>{pickingUiCopy(appLanguage,'next')}</button><button className="primary" type="button" disabled={busy||pickPaused||verifiedCount!==task.lines.length} onClick={()=>pickAction('finish')}>{pickingUiCopy(appLanguage,'finish')}</button></div></div>:
   <p className="sf-picking-done">{t('All requested items were verified. Picking is recorded without changing stock.')}</p>}
 </section>}</>:<section className="wh-panel sf-no-picking-results" role="status"><h3>{t('No items ready to pick')}</h3><p>{t('We could not find a saved product for this request. Try another product name, browse the catalogue or ask the owner to add it. You can start picking when an item is found.')}</p></section>}
 <div className="wh-work-grid"><div className="wh-task-list">{ordered.map(line=><article id={'sf-picking-line-'+line.index} className={'wh-panel wh-task '+(line.complete?'complete':'')+(activeLine===line.index?' sf-task-active':'')+(!line.selected?' sf-task-unresolved':'')} tabIndex={-1} key={line.index}><div className="wh-task-heading">{(line.selected||line.candidates[0])&&<ItemArt collection={(line.selected||line.candidates[0]).collection} photo={(line.selected||line.candidates[0]).photo_url} name={(line.selected||line.candidates[0]).name}/> }<span className="wh-step">{line.complete?<Glyph name="check"/>:String(line.index+1).padStart(2,'0')}</span><div><small>{line.query}</small><h3>{line.selected?.name||t(line.candidates.length?'Choose the right variant':'Item not found')}</h3></div><span className={'wh-status '+(line.location_report_open?'amber':line.complete||line.location_feedback?.status==='correct'?'green':line.selected?'purple':'amber')}>{t(line.location_report_open?'Location reported':line.deferred_reason==='declined'?'Not confirmed — skipped':line.complete?(line.confirmation==='barcode'?'Scan confirmed':'Manually confirmed'):line.location_feedback?.status==='correct'?'Shelf location checked':line.selected?'Recorded location':line.candidates.length?'Needs a detail':'Not found')}</span></div>{line.selected?<><div className="wh-item-meta"><code>{line.selected.sku}</code><span>{line.selected.brand} · {meta.collections.find(c=>c.id===line.selected.collection)?.name}</span><Specs item={line.selected} labels={labels}/></div><Place location={line.location} example={!!line.selected?.synthetic}/>{line.deferred_reason&&picking.status==='active'&&<div className="sf-deferred-pick" role="status"><span>{t(line.deferred_reason==='reported'?'Reported — awaiting location verification. This item is not marked picked.':'Not confirmed. Finder is guiding you to the remaining items.')}</span>{line.deferred_reason==='declined'&&<button type="button" disabled={busy||pickPaused} onClick={()=>retryPick(line.index)}>{t('Retry this item')}</button>}</div>}<p className="sf-stock-badge">{line.location.quantity==null?t('Quantity not added yet'):line.location.quantity+' '+t('units recorded here')}</p>{!line.complete&&picking.status!=='completed'&&<div className="sf-location-check"><div className="sf-location-check-intro"><strong>{t('Does this saved shelf location match?')}</strong><small>{line.location_report_open?t('Location reported. Owner review pending.'):line.location_feedback?.status==='correct'?t('Shelf checked. Pick completion is recorded separately.'):line.last_confirmed_at?t('Last checked: ')+new Date(line.last_confirmed_at).toLocaleString():t('No reply needed if the recorded location looks right.')}</small></div><div className="sf-location-check-actions"><button type="button" className="sf-location-yes" disabled={busy||pickPaused||!!line.deferred_reason||line.location_report_open||line.location_feedback?.status==='correct'} onClick={()=>run(async()=>{const next=await api('/tasks/'+task.id+'/location-check',{line:line.index});T(next);N(t('Location checked for this visit.'))})}><Glyph name="check"/>{t('Shelf matches')}</button><button type="button" className="sf-location-wrong" disabled={busy||pickPaused} onClick={()=>{reportResumeRef.current=handsFree&&!voiceGuidePaused;VGP(true);D({type:'report',item:line.selected,location:line.location,index:line.index})}}><Glyph name="close"/>{t('Wrong location')}</button></div></div>}{line.complete&&<p className="sf-pick-complete-message" role="status">{t('Picked and verified. This item is complete.')}</p>}<div className="wh-task-footer"><button onClick={()=>D({type:'detail',item:line.selected})}>{t('Item details')}</button><button className="sf-guide-jump" type="button" aria-pressed={activeLine===line.index} onClick={()=>{AL(line.index);document.getElementById('sf-shelf-guide')?.scrollIntoView({behavior:'smooth',block:'nearest'})}}><Glyph name="pin"/>{t('Shelf guide')}</button>{!line.complete&&picking.status!=='completed'&&<div><button className="primary" disabled={busy||pickPaused||!!line.deferred_reason||line.location_report_open} onClick={()=>D({type:'scan',index:line.index})}><Glyph name="scan"/>{t('Confirm picked item')}</button></div>}</div>{picking.status==='ready'&&line.location_report_open&&task.lines.length>1&&<button type="button" className="wh-text-button" disabled={busy} onClick={()=>removeUnresolvedLine(line.index)}>{t('Remove reported item from this worklist')}</button>}{picking.status==='ready'&&line.candidates.length>1&&<button className="wh-text-button" onClick={()=>T({...task,lines:task.lines.map((l,i)=>i===line.index?{...l,selected:null}:l)})}>{t('Choose another variant')}</button>}</>:line.candidates.length?<div className="wh-candidates"><p>{t('Choose the correct size or version. We will not choose one for you.')}</p>{voice&&picking.status==='ready'&&line.index===firstVoiceClarification&&<VariantVoiceClarifier key={task.id+'-'+line.index} taskId={task.id} index={line.index} language={task.language} enabled={!busy&&page==='find'&&!modal} onError={E} onReply={reply=>run(async()=>{const next=await api('/tasks/'+task.id+'/clarify',{line:line.index,reply});T(next);if(next.lines.every(x=>x.selected&&x.location))void offerSearchMode(next);})}/>}<Clarification key={task.id+'-'+line.index} {...{voice,language,busy}} onError={E} onReply={reply=>run(async()=>{const next=await api('/tasks/'+task.id+'/clarify',{line:line.index,reply});T(next);if(next.lines.every(x=>x.selected&&x.location))void offerSearchMode(next);})}/>{line.candidates.map(p=><div className="wh-candidate" key={p.collection+':'+p.sku}><ItemArt collection={p.collection} photo={p.photo_url} name={p.name}/><div><small>{p.brand} · {meta.collections.find(c=>c.id===p.collection)?.name}</small><b>{p.name}</b><code>{p.sku}</code><Specs item={p} labels={labels}/><div className="wh-candidate-places">{p.placements.map(l=><button disabled={busy} key={l.code} onClick={()=>choose(line.index,p,l)}><Glyph name="pin"/>{friendlyPath(l,!!p.synthetic)}<Glyph name="arrow"/></button>)}</div></div></div>)}</div>:<div className="wh-no-match"><p>{items.length===0?t(owner?'No catalogue items are saved yet. In Import items, review the column mapping, select Preview changes, then Confirm import to save the spreadsheet.':'No catalogue items are available yet. Ask your owner to finish importing the spreadsheet.'):t('This exact item is not in your saved catalogue. Check the name or size, or browse saved items. Nothing has been reported.')}</p>{items.length===0&&owner&&<button type="button" disabled={busy} onClick={()=>navigate('import')}>{t('Go to Import items')}</button>}{picking.status==='ready'&&task.lines.length>1&&<div className="sf-unmatched-tools"><p>{/^\d+(?:[.\/-]\d+)?$/.test(line.query.trim())?t('This looks like a size rather than an item. Add it to the product name in your search, or remove it.'):t('This item was not found. Remove it to continue with the items we did find.')}</p><button type="button" disabled={busy} onClick={()=>removeUnresolvedLine(line.index)}>{t('Remove from worklist')}</button></div>}<button type="button" disabled={busy} onClick={()=>run(async()=>{const report=await api('/issues',{collection,sku:'',reason:('Missing catalogue item: '+line.query).slice(0,400),kind:'general'});N(t('Missing-item report sent to review.')+' #'+report.id)})}>{t('Report missing item')}</button><button type="button" onClick={()=>navigate('catalogue')}>{t('Browse saved items')}</button></div>}</article>)}</div><aside id="sf-shelf-guide" className="wh-route wh-panel"><div className="wh-panel-title"><span><Glyph name="pin"/>{t('Shelf guide')}</span></div><p>{t('Choose an item to see where it is kept.')}</p>{guideLine?.location&&<ShelfGuide location={guideLine.location} items={items}/>}
 {selected.length?Object.entries(selected.reduce((acc,l)=>{(acc[l.location.code]||=([])).push(l);return acc},{})).sort((a,b)=>pathText(a[1][0].location).localeCompare(pathText(b[1][0].location),undefined,{numeric:true})).map(([code,ls],i)=><div className="wh-stop" key={code}><span>{i+1}</span><div><b>{}{friendlyPath(ls[0].location,!!ls[0].selected?.synthetic)}</b>{ls.map(l=><p key={l.selected.collection+':'+l.selected.sku}>{l.complete?'✓ ':''}{l.selected.name} <code>{l.selected.sku}</code></p>)}</div></div>):<p>{t('Choose a variant to add its location here.')}</p>}<div className="wh-progress"><b>{verifiedCount}/{task.lines.length}</b><span>{t('items verified')}</span><progress max={task.lines.length} value={verifiedCount}/></div><small>{t('If an item is on a different shelf, tell the owner. Checking a shelf does not update item quantities.')}</small></aside>{task&&<details className="wh-panel wh-session-card" defaultOpen={!!task}><summary>{t('Recent requests')}</summary><div className="wh-panel-title"><span><Glyph name="history"/>{t('Recent requests')}</span><small>{t('Recent activity')}</small></div>{recent.filter(r=>collection==='all'||r.collection===collection).length?recent.filter(r=>collection==='all'||r.collection===collection).slice(0,3).map(r=><button className="wh-recent" key={r.id} onClick={()=>r.picking?.status==='active'?resumePick(r.id):(Q(r.query),search(r.query,false))}><span>{r.query}<small>{r.lines.length} {t('requested items')}</small></span><Glyph name="arrow"/></button>):<div className="wh-recent-empty"><div className="wh-orbit"><Mark large/></div><h3>{t('Ready when you are.')}</h3><p>{t('Your recent requests will appear here. Start with a name, size or item code.')}</p></div>}</details>}</div></>:<div className="wh-discovery">{!items.length&&<div className="wh-panel"><h3>{t('Start building your catalogue.')}</h3><p>{t(owner?'Import a spreadsheet or add your first item to start finding products.':'Ask the owner to add or import products and recorded locations.')}</p>{owner&&<button className="primary" onClick={()=>navigate('import')}>{t('Import items')}<Glyph name="arrow"/></button>}</div>}{discovery.map(p=><button key={p.collection+':'+p.sku} className="sf-catalogue-card" onClick={()=>{Q(p.sku);search(p.sku,false)}}><ItemArt collection={p.collection} photo={p.photo_url} name={p.name}/><div className="sf-catalogue-copy"><small>{p.brand} · {p.category}</small><b>{p.name}</b><Specs item={p} labels={labels}/><span className="sf-catalogue-location"><Glyph name="pin"/>{pathText(p.placements[0],!!p.synthetic)}</span></div><span className="sf-catalogue-action">{t('Find items')}<Glyph name="arrow"/></span></button>)}</div>}</section></>}
 {page==='catalogue'&&<section className="wh-panel wh-catalogue">{items.some(item=>item.synthetic)&&<p className="sf-catalogue-provenance"><strong>{t('Starter catalogue')}</strong> · {t('Locations in starter records are not physically verified. Import or verify your store records before operational picking.')}</p>}<div className="wh-toolbar"><label className="wh-filter"><Glyph name="search"/><input aria-label={t('Filter catalogue')} placeholder={t('Search name, size, SKU or location')} value={filter} onChange={e=>F(e.target.value)}/></label><select aria-label={t('Category')} value={category} onChange={e=>CAT(e.target.value)}><option value="">{t('All categories')}</option>{[...new Set(items.map(p=>p.category))].map(c=><option key={c}>{c}</option>)}</select><a className="wh-button" href={'/api/warehouse/export?collection='+collection+'&format=xlsx'}>{t('Export Excel')}</a>{owner&&<button className="primary" onClick={()=>D({type:'edit',item:null})}><Glyph name="plus"/>{t('Add item')}</button>}</div><div className="wh-table-wrap"><table><thead><tr><th>{t('Item')}</th><th>{t('Specifications')}</th><th>{t('Storage')}</th><th>{t('Last updated')}</th><th><span className="sr-only">{t('Open')}</span></th></tr></thead><tbody>{filtered.map(p=><tr key={p.collection+':'+p.sku}><td><div className="wh-table-item"><ItemArt collection={p.collection} photo={p.photo_url} name={p.name}/><div><b>{p.name}</b><small>{p.sku} · {p.category}{p.brand?' · '+p.brand:''}</small></div></div></td><td><Specs item={p} labels={labels}/></td><td>{p.placements.length>1?<b>{p.placements.length} {t('locations')}</b>:<><b>{pathText(p.placements[0],!!p.synthetic)}</b><small>{p.placements[0].quantity==null?t('Not counted'):p.placements[0].quantity+t(' units')}</small></>}</td><td><small>{new Date(p.updated_at).toLocaleDateString()}<br/>{p.updated_by}</small></td><td><button aria-label={t('Open')+' '+p.sku} onClick={()=>D({type:'detail',item:p})}><Glyph name="arrow"/></button></td></tr>)}</tbody></table>{!filtered.length&&<p className="wh-empty">{t('No items match this filter.')}</p>}</div><div className="wh-table-footer">{filtered.length} {t('items')}<span>{t('Recorded counts update only after a confirmed stock operation.')}</span></div></section>}
 {page==='locations'&&<><div className="wh-toolbar"><label className="wh-filter"><Glyph name="search"/><input placeholder={t('Filter locations')} aria-label={t('Filter locations')} value={filter} onChange={e=>F(e.target.value)}/></label></div><div className="wh-location-grid">{locations.filter(l=>pathText(l).toLowerCase().includes(filter.toLowerCase())).map(l=><article className="wh-panel" key={l.code}><Place location={l} example={items.some(p=>p.synthetic&&p.placements.some(x=>x.code===l.code))}/><div className="wh-location-items">{items.filter(p=>p.placements.some(x=>x.code===l.code)).map(p=><button key={p.collection+':'+p.sku} onClick={()=>D({type:'detail',item:p})}><b>{p.name}</b><small>{p.sku}</small><Glyph name="arrow"/></button>)}</div><button onClick={()=>D({type:'label',location:l})}><Glyph name="scan"/>{t('Shelf label')}</button></article>)}</div></>}
 {page==='import'&&owner&&<ImportPanel key={collection} {...{collection,pack,labels,run,busy,reload}} onSuccess={text=>N(t(text))}/>}
 {page==='review'&&<ReviewPanel key={collection+'-'+reviewNonce} {...{collection,owner,run,busy,language,voice}} onError={E} onSaved={result=>{if(voice)playFixedVoice(result.status==='resolved'?'review_verified_saved':'review_pending_saved',language,false,true)}} onCorrectLocation={issue=>{const item=items.find(p=>p.collection===issue.collection&&p.sku===issue.sku);const location=item?.placements.find(p=>p.code===issue.location_code);if(!item||!location){E(t('Recorded location changed. Refresh the catalogue before correcting.'));return}D({type:'move',item,location})}}/>}
 {page==='more'&&user.is_demo&&<section className="sf-preview-banner"><div><strong>Have feedback?</strong><p>{t('You can help us improve it.')}</p></div><button type="button" onClick={()=>navigate('feedback')}>Share feedback</button></section>}
 {page==='more'&&<section className="sf-more-page" aria-label={t('More')}>
  <div className="sf-more-intro"><span className="wh-eyebrow">{t('WORKSPACE TOOLS')}</span><h2>{t('More')}</h2><p>{t('Manage tools, reports and workspace settings.')}</p></div>
  <div className="sf-more-group"><h3>{t('Manage your work')}</h3>
    <div className="sf-more-list">
      <button type="button" onClick={()=>D({type:'lookup'})}><span className="sf-more-icon"><Glyph name="scan"/></span><span className="sf-more-copy"><strong>{t('Scan a label')}</strong><small>{t('Find an item or shelf using its code')}</small></span><Glyph name="arrow"/></button>
      {owner&&<button type="button" onClick={()=>navigate('import')}><span className="sf-more-icon"><Glyph name="upload"/></span><span className="sf-more-copy"><strong>{t('Import items')}</strong><small>{t('Add catalogue records from a spreadsheet')}</small></span><Glyph name="arrow"/></button>}
      {owner&&<button type="button" onClick={()=>navigate('business')}><span className="sf-more-icon"><Glyph name="box"/></span><span className="sf-more-copy"><strong>{t('Business setup')}</strong><small>{t('Manage product types and location labels')}</small></span><Glyph name="arrow"/></button>}
      <button type="button" onClick={()=>navigate('review')}><span className="sf-more-icon"><Glyph name="history"/></span><span className="sf-more-copy"><strong>{t('Activity')}</strong><small>{t('Review reports and recorded changes')}</small></span><Glyph name="arrow"/></button>
    </div>
  </div>
  <div className="sf-more-group"><h3>{t('Help and settings')}</h3>
    <div className="sf-more-list">
      <button type="button" onClick={()=>navigate('settings')}><span className="sf-more-icon"><Glyph name="user"/></span><span className="sf-more-copy"><strong>{t('Settings')}</strong><small>{t('App language, appearance, profile and team access')}</small></span><Glyph name="arrow"/></button>
      <button type="button" onClick={()=>{navigate('find');TOUR(0)}}><span className="sf-more-icon"><Glyph name="help"/></span><span className="sf-more-copy"><strong>{t('Quick walkthrough')}</strong><small>{t('Learn how to find and confirm items')}</small></span><Glyph name="arrow"/></button>
    </div>
  </div>
  <button type="button" className="sf-more-logout" disabled={busy} onClick={()=>run(logout)}><Glyph name="logout"/>{t('Log out')}</button>
</section>}
 {page==='feedback'&&user.is_demo&&<section className="sf-public-feedback wh-panel"><h2>{t('Help us improve Shop Finder')}</h2><p>Tell us what worked, what was confusing, or which language or voice command needs improvement. Do not share passwords, personal details or customer data.</p><form onSubmit={e=>{e.preventDefault();run(async()=>{await request('/demo/feedback',{method:'POST',body:JSON.stringify({comment:feedbackText})});FB('');FBS(true);N('Thanks! Your suggestion has been saved.')})}}><label htmlFor="sf-public-feedback">Your feedback</label><textarea id="sf-public-feedback" value={feedbackText} onChange={e=>FB(e.target.value)} minLength={10} maxLength={800} rows={5} placeholder="Example: Hindi speech worked, but I couldn't find the repeat-location button." required/><button className="primary" disabled={busy||feedbackText.trim().length<10}>{t('Send feedback')}</button></form>{feedbackSent&&<p role="status">Thanks for sharing your feedback.</p>}</section>}
 {page==='settings'&&owner&&!user.is_challenge&&<section className="sf-public-feedback wh-panel"><h2>{t('Visitor feedback')}</h2><p>{t('Review feedback from guest workspace visitors. Suggestions are not automatically applied.')}</p><button type="button" disabled={busy} onClick={()=>run(async()=>OF(await request('/demo/feedback')))}>{t('View visitor suggestions')}</button>{ownerFeedback.map(entry=><article key={entry.id}><p>{entry.comment}</p><small>{new Date(entry.created_at*1000).toLocaleString()}</small></article>)}</section>}
 {page==='settings'&&<section className="sf-settings-page"><div className="sf-more-group sf-settings-preferences"><h2>{t('App preferences')}</h2><p className="sf-voice-setting-status">{voice?t('Voice search is enabled. Check your microphone from Find items before using it.'):t('Voice search is unavailable. You can still find items by typing.')}</p><div className="sf-more-preference-row"><label htmlFor="sf-settings-language">{t('App language')}</label><select id="sf-settings-language" aria-label={t('App language')} disabled={busy} value={APP_LANGUAGES.some(([code])=>code===user.language)?user.language:'hi'} onChange={e=>run(()=>preferences({language:e.target.value}))}>{APP_LANGUAGES.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></div><div className="sf-more-preference-row"><span>{t('Appearance')}</span><button type="button" onClick={()=>TH(theme==='dark'?'light':'dark')}><Glyph name={theme==='dark'?'sun':'moon'}/>{t(theme==='dark'?'Light mode':'Dark mode')}</button></div></div>{user.is_demo?<div className="sf-public-settings"><p>{t("You're using a temporary guest workspace. Changes here are not stored in a personal workspace.")}</p><button type="button" onClick={logout}>{t('Leave guest workspace')}</button></div>:<AccountSettings {...{user,preferences,logout}} showLanguage={false}/>}</section>}
 </>}
 <footer className="wh-footer"><span><Mark/>finder</span></footer>
 </main></div>
 {tour!==null&&<aside className="wh-guide" role="region" aria-label={t('Quick walkthrough')}><span className="wh-eyebrow">{t('QUICK START')} {tour+1} / 4</span><h3>{t(guide[tour][0])}</h3><p>{t(guide[tour][1])}</p><div><button onClick={closeTour}>{t('Skip tour')}</button><button className="primary" onClick={()=>tour===3?closeTour():TOUR(tour+1)}>{t(tour===3?'Finish':'Next')}<Glyph name="arrow"/></button></div></aside>}
 
 {modal?.type==='detail'&&<Modal title={t('Item details')} onClose={()=>D(null)} wide><div className="wh-detail-heading"><ItemArt collection={modal.item.collection} photo={modal.item.photo_url} name={modal.item.name}/><div><span className="wh-eyebrow">{modal.item.brand} · {modal.item.category}</span><h2>{modal.item.name}</h2><code>{modal.item.sku}</code></div></div><Specs item={modal.item} labels={labels}/><h3>{t('Recorded locations')}</h3>{modal.item.placements.map(l=><div className="wh-detail-place" key={l.code}><Place location={l} example={!!modal.item.synthetic}/><p className="sf-stock-badge">{l.quantity==null?'Stock not counted':l.quantity+' units recorded'}</p>{(owner||meta.settings.staff_stock)&&<button onClick={()=>D({type:'stock',item:modal.item,location:l})}><Glyph name="box"/>Update stock</button>}<button onClick={()=>D({type:'label',item:modal.item,location:l})}><Glyph name="scan"/>{t('Labels')}</button>{owner&&<button onClick={()=>D({type:'move',item:modal.item,location:l})}><Glyph name="edit"/>{t('Correct location')}</button>}</div>)}<p><b>{t('Also known as')}: </b>{modal.item.aliases.join(', ')||'—'}</p><p><b>{t('Barcode')}: </b><code>{modal.item.barcode||'—'}</code></p><small>{t('Last updated')} {new Date(modal.item.updated_at).toLocaleString()} · {modal.item.updated_by} · {t('Revision')} {modal.item.revision}</small><div className="wh-modal-actions"><button onClick={()=>D({type:'report',item:modal.item})}>{t('Report issue')}</button>{owner&&<button className="primary" onClick={()=>D({type:'edit',item:modal.item})}>{t('Edit item')}<Glyph name="edit"/></button>}</div></Modal>}
 {modal?.type==='stock'&&<Modal title="Update recorded stock" onClose={()=>D(null)} wide><StockEditor {...{owner,locations,run,busy,voice,language}} fields={meta.settings.location_fields} item={modal.item} source={modal.location} onError={E} onSave={async()=>{D(null);T(null);await reload();N('Stock updated. The change is recorded in history.')}}/></Modal>}
 {modal?.type==='edit'&&<Modal title={t(modal.item?'Edit item':'Add item')} onClose={()=>D(null)} wide><ItemEditor item={modal.item} collection={modal.item?.collection||(collection==='all'?meta.settings.collections[0]:collection)} pack={meta.collections.find(c=>c.id===(modal.item?.collection||(collection==='all'?meta.settings.collections[0]:collection)))} collections={meta.collections.filter(c=>meta.settings.collections.includes(c.id))} settings={meta.settings} {...{labels,run,busy}} onSave={async()=>{D(null);await reload();N(t('Item saved.'))}}/></Modal>}
 {modal?.type==='move'&&<Modal title={t('Correct location')} onClose={()=>D(null)} wide><MoveEditor collection={modal.item.collection} fields={meta.settings.location_fields} {...{run,busy,language,voice}} item={modal.item} source={modal.location} onError={E} onSave={async()=>{const previous=task?.query;D(null);await reload();RV(v=>v+1);if(previous&&page==='find'){await search(previous,false);N(t('Location saved. Search results now show the updated shelf. Review the new list before picking.'))}else{T(null);N(t('Verified location saved and shown in future searches.'))}if(voice)await playFixedVoice('move_saved',language,false,true)}}/></Modal>}
 {modal?.type==='report'&&<Modal title={t('Report an issue')} onClose={()=>{reportResumeRef.current=false;D(null);VGP(true)}}><Report item={modal.item} location={modal.location} collection={modal.item.collection} userId={user.id} autoGuide={!!modal.autoGuide} {...{run,busy,voice,language,speaking}} onStopSpeaking={stopSpeech} onError={E} onSave={async report=>{
 const index=modal.index,active=task?.picking?.status==='active'&&!task.picking?.paused;
 const shouldResume=reportResumeRef.current;
 reportResumeRef.current=false;
 VGP(true);
 if(voice&&!voiceFlowStopped.current)await playFixedVoice('report_saved',language,true);
 D(null);
 if(index!=null&&active){
  VGP(!(voice&&handsFree&&shouldResume));
  await deferPick(task,index,'reported');
  N('Report #'+report.id+' sent to your manager. The item remains unconfirmed; Finder moved to the next available item.');
 }else{
  if(index!=null)T(prev=>prev?{...prev,lines:prev.lines.map((line,i)=>i===index?{...line,location_report_open:true}:line)}:prev);
  N('Report #'+report.id+' sent to your manager.');
 }
}}/></Modal>}
 {modal?.type==='scan'&&task&&<Modal title={t('Confirm picked item')} onClose={()=>D(null)}><ScanTask line={task.lines[modal.index]} onRead={value=>scan(modal.index,task.lines[modal.index].product_scanned?'location':'product',value)} onManual={()=>scan(modal.index,'manual','confirmed')} busy={busy} onError={E}/></Modal>}
 {modal?.type==='lookup'&&<Modal title={t('Scan a label')} onClose={()=>D(null)}><ScanBox onError={E} onRead={value=>{const location=locations.find(l=>l.code===value);D(null);if(location){P('locations');F(pathText(location))}else{const parts=value.split(':');Q(value);search(value,false,true)}}}/></Modal>}
 {modal?.type==='label'&&<Modal title={t('Print labels')} onClose={()=>D(null)} wide><div className="wh-print-area">{modal.item&&<Label value={'ITEM:'+modal.item.collection+':'+modal.item.sku} name={modal.item.name} subtitle={modal.item.sku+' · '+Object.values(modal.item.specs).join(' / ')}/>}<Label value={modal.location.code} name={t('Storage location')} subtitle={pathText(modal.location)}/></div><button className="primary" onClick={()=>window.print()}>{t('Print labels')}</button></Modal>}
 </div></Feedback.Provider>
}
function Report({item,location,collection,userId,run,busy,speaking=false,voice,language,autoGuide=false,onError,onStopSpeaking,onSave}){
 const t=useT(),appLanguage=useContext(Locale);
 // UI copy follows the app language. Actual voice input and TTS use language.
 const copy=key=>reportUiCopy(appLanguage,key);
 const draftKey='sf-report-draft-'+userId+'-'+collection+'-'+item.sku+'-'+(location?.code||'general');
 const readDraft=()=>{try{
  const stored=JSON.parse(sessionStorage.getItem(draftKey)||'null');
  return stored&&typeof stored.reason==='string'&&typeof stored.suggested==='string'&&Date.now()-stored.at<86400000?stored:null;
 }catch{return null}};
 const [draft]=useState(readDraft);
 const [requestId]=useState(()=>draft?.request_id||('report-'+(typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2))));
 const [reason,R]=useState(()=>draft?.reason??(location?reportUiCopy(appLanguage,'defaultReason'):''));
 const [suggested,S]=useState(draft?.suggested||''),[heard,H]=useState(''),[heardField,HF]=useState('');
 useEffect(()=>{try{sessionStorage.setItem(draftKey,JSON.stringify({reason,suggested,request_id:requestId,at:Date.now()}))}catch{}},[draftKey,reason,suggested,requestId]);
 const [pendingSubmit,PS]=useState(false),[guideStage,SetGuideStage]=useState('report_reason');
 const [guidedActive,SetGuidedActive]=useState(false);
 const submittingRef=useRef(false),submittedRef=useRef(false);
 async function submitReport(){
  if(submittedRef.current)return true; // Never create a second report after a successful save.
  if(submittingRef.current||busy||reason.trim().length<3)return false;
  submittingRef.current=true;
  try{
   const saved=await run(async()=>{
    const report=await api('/issues',{collection,sku:item.sku,reason:reason.trim(),kind:location?'wrong_location':'general',location_code:location?.code||'',suggested_location:suggested.trim(),request_id:requestId});
    submittedRef.current=true; // Server has committed the report, even if the next UI step fails.
    try{sessionStorage.removeItem(draftKey)}catch{}
    await onSave(report);
    return true;
   });
   if(!saved&&!submittedRef.current)onError(copy('saveFailed'));
   return !!saved||submittedRef.current;
  }finally{submittingRef.current=false}
 }
 async function guidedReportAnswer(text,step){
  const recognized=String(text||'').trim();
  if(step==='report_reason'){
   if(reportSubmitCommand(language,recognized)||unclearReportSubmit(language,recognized)||recognized.length<3){
    onError(copy('retryReason'));return 'retry';
   }
   R(recognized.slice(0,400));H(recognized);HF('reason');onError('');
   SetGuideStage(location?'report_suggestion':'report_confirm');return true;
  }
  if(step==='report_suggestion'){
   const skipping=voiceAction(language,'report_skip',recognized)||voiceAction('en-IN','report_skip',recognized);
   if(!skipping&&(unclearReportSubmit(language,recognized)||!plausibleShelfSuggestion(recognized))){
    onError(copy('invalidShelf'));return 'retry';
   }
   S(skipping?'':recognized.slice(0,200));H(recognized);HF('shelf');onError('');
   SetGuideStage('report_confirm');return true;
  }
  if(step==='report_confirm'){
   if(!reportSubmitCommand(language,recognized)){
    onError(reportUiTip(appLanguage,'submit')+' '+(actionPhrases(language,'report_send')[0]||''));return 'retry';
   }
   onError('');
   const saved=await submitReport();
   return saved?false:'retry';
  }
  return 'retry';
 }
 function guidedReportBack(step){
  onError('');
  if(step==='report_confirm')SetGuideStage(location?'report_suggestion':'report_reason');
  else if(step==='report_suggestion')SetGuideStage('report_reason');
  else onError(copy('firstStep'));
 }
 async function voiceCommand(text){
  const transcript=String(text||'').trim();
  if(!transcript)return;
  H(transcript);HF('command');
  const control=dialogueControl(language,transcript);
  if(control==='stop'||control==='back'){PS(false);return}
  if(pendingSubmit){
   const response=pickConfirmationIntent(language,transcript);
   if(response==='yes'){PS(false);await submitReport();return}
   if(response==='no'){PS(false);return}
   onError(copy('retryConfirm'));return;
  }
  if(unclearReportSubmit(language,transcript)){onError(copy('retryConfirm'));return}
  if(reportSubmitCommand(language,transcript)){
   if(reason.trim().length<3){onError(copy('missingReason'));return}
   PS(true);return;
  }
  if(voiceAction(language,'report_skip',transcript)){S('');HF('shelf');return}
  if(location&&plausibleShelfSuggestion(transcript)){S(transcript.slice(0,200));HF('shelf')}
  else{R(transcript.slice(0,400));HF('reason')}
  onError('');
 }
 return <div className="sf-report-flow">
 <p><b>{item.name}</b> · {item.sku}</p>
 {location&&<p>{t('Recorded location:')} <strong>{pathText(location)}</strong></p>}
 <div className="sf-report-step-note" role="status">
  <strong>{copy('paused')}</strong>
  <span>{copy('steps')}</span>
 </div>
 {voice&&<GuidedVoiceTurn language={language} stage={guideStage} context="Automatic wrong-location report" disabled={busy} autoStart={autoGuide}
  retryStep={guideStage+'_retry'}
  promptEndpoint={guideStage==='report_confirm'?'voice/report-preview-audio':null}
  promptBody={guideStage==='report_confirm'?{collection,sku:item.sku,reason,suggested_location:suggested,location_code:location?.code||''}:null}
  onTranscript={guidedReportAnswer} onBack={guidedReportBack} onActiveChange={SetGuidedActive} onError={onError}/>}
 {voice&&<div className="sf-report-voice-panel" aria-label={copy('reportTitle')}>
   <strong>{copy('tell')}</strong>
   <small>{copy('hint')}</small>
   {speaking&&<button type="button" className="sf-report-stop-audio" onClick={onStopSpeaking}>{copy('guideStop')}</button>}
   <VoiceButton small autoStop enabled={!busy&&!speaking&&!guidedActive} {...{language,onError}}
    label={copy('record')} onText={voiceCommand} onPartial={text=>{H(text);HF('listening')}}/>
   <div className="sf-report-transcript" role="status" aria-live="polite">
    <span>{copy('recognized')}</span>
    <p>{heard||copy('empty')}</p>
    {heardField==='reason'&&<small>{copy('reasonAdded')}</small>}
    {heardField==='shelf'&&<small>{copy('shelfAdded')}</small>}
   </div>
   {pendingSubmit&&<div className="sf-report-send-approval" role="status">
    <strong>{copy('sendQuestion')}</strong>
    <p>{reportUiTip(appLanguage,'confirm')} <span lang={language==='hi-en'?'hi-Latn':language}>{spokenYesNo(language).join(' / ')}</span></p>
    <button type="button" disabled={busy||submittingRef.current} onClick={submitReport}>{copy('send')}</button>
    <button type="button" onClick={()=>PS(false)}>{copy('notYet')}</button>
   </div>}
  </div>}
 <form onSubmit={e=>{e.preventDefault();submitReport()}}>
  <label>{copy('edit')}<textarea required minLength={3} maxLength={400} value={reason} onChange={e=>R(e.target.value)}/></label>
  {location&&<div className="sf-report-location"><label htmlFor="sf-report-location-input">{copy('shelf')}</label>
   <div className="sf-report-location-field"><input id="sf-report-location-input" value={suggested} maxLength={200}
    placeholder={copy('shelfPlaceholder')} onChange={e=>S(e.target.value)}/></div>
  </div>}
  <p>{copy('reportInfo')}</p>
  <button className="primary" disabled={busy||reason.trim().length<3}>{copy('sendForReview')}</button>
 </form></div>;
}
function ScanTask({line,onRead,onManual,busy,onError}){const t=useT();return <><p><b>{line.selected.name}</b> · {line.selected.sku}</p><Place location={line.location} example={!!line.selected?.synthetic}/><div className="wh-scan-steps"><span className={line.product_scanned?'done':''}>1. {t('Scan item')}{line.product_scanned&&' ✓'}</span><span className={line.complete?'done':''}>2. {t('Scan location')}{line.complete&&' ✓'}</span></div>{line.complete?<div className="wh-empty"><Glyph name="check"/><h3>{t('Item and location confirmed.')}</h3></div>:<><h3>{t(line.product_scanned?'Now scan the location label':'Scan the item label')}</h3><ScanBox key={line.product_scanned?'location':'product'} {...{onRead,onError}}/><button className="wh-text-button" disabled={busy} onClick={onManual}>{t('Picked and checked — confirm without scanner')}</button></>}</>}

function Clarification({voice,language,busy,onError,onReply}){const t=useT(),[reply,R]=useState(''),[heard,H]=useState(false);return <form className="wh-clarify" onSubmit={e=>{e.preventDefault();onReply(reply)}}><label>{t('Add a size, rating or SKU')}<input value={reply} onChange={e=>{R(e.target.value);H(false)}} maxLength={150} required placeholder={t('For example: size M')}/></label><VoiceButton small autoStop enabled={voice&&!busy} label={t('Speak size or SKU')} {...{language,onError}} onText={text=>{R(String(text||'').slice(0,150));H(true)}}/>{heard&&<small className="sf-voice-detail-transcript" role="status">{t('Recognized detail')}: <strong>{reply}</strong></small>}<button disabled={busy||!reply.trim()}>{t('Apply detail')}</button></form>}
