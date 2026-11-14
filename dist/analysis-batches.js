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

export async function runAnalysisBatches(batches,{parallel,signal,send,failed,wait=abortableWait}){
 while(batches.length&&!signal.aborted){
  const wave=batches.splice(0,parallel);
  const outcomes=await Promise.allSettled(wave.map(batch=>send(batch)));
  if(signal.aborted)break;
  const retry=[];
  for(const [index,outcome] of outcomes.entries()){
   if(outcome.status==='fulfilled')continue;
   const batch=wave[index],error=outcome.reason;
   if((error.status===429||error.code==='MODEL_RATE_LIMIT')&&parallel>1){retry.push(batch);continue;}
   if(error.code==='MODEL_TRUNCATED'&&batch.length>1){
    const half=Math.ceil(batch.length/2);
    batches.unshift(batch.slice(0,half),batch.slice(half));continue;
   }
   failed(batch,error);
   if([401,403,429,503].includes(error.status)||error.code==='MODEL_RATE_LIMIT')throw error;
  }
  if(retry.length){
   parallel=Math.max(1,Math.floor(parallel/2));
   batches.unshift(...retry);
   await wait(5000,signal);
  }
 }
}
