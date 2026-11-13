// Per-account, per-tab resume pointer. The database is authoritative for items,
// reports, picking confirmations and current location. Never store a task payload,
// audio or access token here.
const PAGES=new Set(['find','catalogue','locations','import','business','review','more','settings','feedback']);
const GROUPS=new Set(['request','category','location']);
const MODES=new Set(['choice','guided','locations']);
const COLLECTION=/^(?:all|[a-z0-9][a-z0-9_-]{0,63})$/i;
const key=userId=>'finder:workspace-resume:v1:'+String(userId);
export function sanitizeWorkspaceSession(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const clean={
  page:PAGES.has(value.page)?value.page:'find',
  collection:typeof value.collection==='string'&&COLLECTION.test(value.collection)?value.collection:'all',
  query:typeof value.query==='string'?value.query.slice(0,600):'',
  taskId:typeof value.taskId==='string'&&/^[A-Za-z0-9_-]{10,128}$/.test(value.taskId)?value.taskId:null,
  activeLine:Number.isInteger(value.activeLine)&&value.activeLine>=0&&value.activeLine<500?value.activeLine:0,
  group:GROUPS.has(value.group)?value.group:'request',
  lookupMode:MODES.has(value.lookupMode)?value.lookupMode:'choice',
  modal:null
 };
 // Reopen only recoverable, non-mutating UI. Never replay a pending confirmation.
 if(value.modal?.type==='scan'&&clean.taskId&&Number.isInteger(value.modal.index)&&value.modal.index>=0&&value.modal.index<500)
  clean.modal={type:'scan',index:value.modal.index};
 else if(value.modal?.type==='report'&&clean.taskId&&Number.isInteger(value.modal.index)&&value.modal.index>=0&&value.modal.index<500)
  clean.modal={type:'report',index:value.modal.index};
 else if(value.modal?.type==='lookup')clean.modal={type:'lookup'};
 return clean;
}
export function readWorkspaceSession(storage,userId){
 if(!storage||userId==null)return null;
 try{return sanitizeWorkspaceSession(JSON.parse(storage.getItem(key(userId))||'null'))}catch{return null}
}
export function writeWorkspaceSession(storage,userId,state){
 if(!storage||userId==null)return;
 try{const clean=sanitizeWorkspaceSession(state);if(clean)storage.setItem(key(userId),JSON.stringify(clean))}catch{}
}
export function clearWorkspaceSession(storage,userId){
 if(!storage||userId==null)return;
 try{storage.removeItem(key(userId))}catch{}
}
export function resumeModal(snapshot,task){
 const value=snapshot?.modal;
 if(!value)return null;
 if(value.type==='lookup')return {type:'lookup'};
 const line=task?.lines?.[value.index];
 if(!line?.selected||!line?.location||line?.complete)return null;
 if(value.type==='scan'&&task.picking?.status==='active'&&!task.picking?.paused&&!line.location_report_open&&!line.deferred_reason)
  return {type:'scan',index:value.index};
 if(value.type==='report')return {type:'report',index:value.index,item:line.selected,location:line.location};
 return null;
}
