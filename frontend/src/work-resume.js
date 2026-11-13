// A refresh pointer only: the server remains the source of truth for each task.
// Never store catalogue snapshots, spoken audio, or inventory confirmations.
export const workResumeKey=userId=>'sf-work-resume-'+String(userId);

export function readWorkResume(storage,userId){
 try{
  const data=JSON.parse(storage.getItem(workResumeKey(userId))||'null');
  if(!data||data.version!==1||Date.now()-data.at>7*86400000)return null;
  if(data.taskId!==null&&(typeof data.taskId!=='string'||!data.taskId||data.taskId.length>120))return null;
  return {
   taskId:data.taskId||null,
   collection:typeof data.collection==='string'&&data.collection.length<80?data.collection:'all',
   page:typeof data.page==='string'&&['find','catalogue','locations','review','import','business','settings','more','feedback'].includes(data.page)?data.page:'find',
   query:typeof data.query==='string'?data.query.slice(0,600):'',
   lookupMode:['choice','guided','locations'].includes(data.lookupMode)?data.lookupMode:'choice',
   activeLine:Number.isInteger(data.activeLine)&&data.activeLine>=0?data.activeLine:0,
   group:['request','category','location'].includes(data.group)?data.group:'request',
   reportIndex:Number.isInteger(data.reportIndex)&&data.reportIndex>=0?data.reportIndex:null
  };
 }catch{return null}
}
export function writeWorkResume(storage,userId,data){
 try{
  storage.setItem(workResumeKey(userId),JSON.stringify({
   version:1,at:Date.now(),
   taskId:data.taskId||null,collection:data.collection||'all',page:data.page||'find',
   query:String(data.query||'').slice(0,600),lookupMode:data.lookupMode||'choice',
   activeLine:data.activeLine||0,group:data.group||'request',
   reportIndex:Number.isInteger(data.reportIndex)?data.reportIndex:null
  }));
 }catch{/* Storage may be blocked or full; the server still has the task. */}
}
export function clearWorkResume(storage,userId){
 try{storage.removeItem(workResumeKey(userId))}catch{}
}
