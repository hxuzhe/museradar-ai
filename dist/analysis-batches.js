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
 const queue=batches.map(batch=>({batch,attempt:0,ready:0}));
 const active=new Set();
 const ceiling=parallel;
 let cooldown=0,streak=0,fatal;
 function handle({batch,attempt},errors){
  if(signal.aborted||!errors.length)return;
  const error=errors[0].error,remaining=errors.map(item=>item.row);
  if(remaining.length<batch.length)attempt=0;
  const throttled=error.status===429;
  const stop=[401,402,403,503].includes(error.status)||
   (throttled&&(attempt>=2||error.code==='HARD_LIMIT'||/额度|上限/.test(error.message)));
  if(stop){
   fatal??=error;
   for(const item of errors)failed([item.row],item.error);
   return;
  }
  if(throttled){
   const now=Date.now();
   if(now>=cooldown)parallel=Math.max(1,Math.floor(parallel/2));
   streak=0;
   cooldown=Math.max(cooldown,now+Math.max(1000,(error.retryAfterSeconds||10*(attempt+1))*1000));
   queue.unshift({batch:remaining,attempt:attempt+1,ready:0});
  }else if(remaining.length>1){
   const half=Math.ceil(remaining.length/2);
   queue.unshift({batch:remaining.slice(0,half),attempt:0,ready:0},{batch:remaining.slice(half),attempt:0,ready:0});
  }else if(!attempt){
   queue.push({batch:remaining,attempt:1,ready:Date.now()+2000});
  }else{
   failed(remaining,error);
   return;
  }
  retrying?.(remaining.length);
 }
 function start(job){
  const task=Promise.resolve().then(()=>send(job.batch)).then(errors=>{
   if(errors?.length)handle(job,errors);
   else if(Date.now()>=cooldown&&++streak>=parallel&&parallel<ceiling){parallel++;streak=0;}
  },error=>handle(job,job.batch.map(row=>({row,error})))).catch(error=>{fatal??=error;}).finally(()=>active.delete(task));
  active.add(task);
 }
 while(active.size||queue.length){
  if(fatal||signal.aborted){await Promise.all(active);break;}
  let index;
  while(active.size<parallel&&Date.now()>=cooldown&&(index=queue.findIndex(job=>job.ready<=Date.now()))!==-1){
   start(queue.splice(index,1)[0]);
  }
  if(active.size)await Promise.race(active);
  else if(queue.length)await wait(Math.max(cooldown,Math.min(...queue.map(job=>job.ready)))-Date.now(),signal);
 }
 if(fatal)throw fatal;
}
