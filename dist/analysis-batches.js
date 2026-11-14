import {abortableWait} from './ai-pacing.js?v=20261028-v34';

export function analysisBatches(rows){
 const batches=[];
 let batch=[],size=0;
 for(const row of rows){
  const cost=row.post.text.length+Math.min(1200,row.post.noteBody?.length||0);
  if(batch.length&&(batch.length===30||size+cost>18000)){
   batches.push(batch);batch=[];size=0;
  }
  batch.push(row);size+=cost;
 }
 if(batch.length)batches.push(batch);
 return batches;
}

export async function runAnalysisBatches(batches,{parallel,signal,send,failed,retrying,wait=abortableWait}){
 const queue=batches.map(batch=>({batch,attempt:0}));
 while(queue.length&&!signal.aborted){
  const wave=queue.splice(0,parallel);
  const outcomes=await Promise.allSettled(wave.map(({batch})=>send(batch)));
  if(signal.aborted)break;
  const retry=[];
  let delay=0;
  for(const [index,outcome] of outcomes.entries()){
   const {batch,attempt:previousAttempt}=wave[index];
   const errors=outcome.status==='fulfilled'?(outcome.value||[]):batch.map(row=>({row,error:outcome.reason}));
   if(!errors.length)continue;
   const error=errors[0].error, remaining=errors.map(item=>item.row);
   const attempt=remaining.length<batch.length?0:previousAttempt;
   if([401,402,403,503].includes(error.status)||(error.status===429&&(error.code==='HARD_LIMIT'||/额度|上限/.test(error.message)))){
    for(const item of errors)failed([item.row],item.error);
    throw error;
   }
   const throttled=error.status===429;
   if(throttled&&attempt<2){
    parallel=Math.max(1,Math.floor(parallel/2));
    delay=Math.max(delay,Math.min(65000,(error.retryAfterSeconds||10*(attempt+1))*1000));
    retry.push({batch:remaining,attempt:attempt+1});
   }else if(!throttled&&remaining.length>1){
    const half=Math.ceil(remaining.length/2);
    retry.push({batch:remaining.slice(0,half),attempt:0},{batch:remaining.slice(half),attempt:0});
   }else if(!throttled&&attempt<1){
    delay=Math.max(delay,2000);
    retry.push({batch:remaining,attempt:attempt+1});
   }else{
    for(const item of errors)failed([item.row],item.error);
    if(throttled)throw error;
   }
  }
  if(retry.length){
   queue.unshift(...retry);
   retrying?.(retry.reduce((count,{batch})=>count+batch.length,0));
   if(delay)await wait(delay,signal);
  }
 }
}


