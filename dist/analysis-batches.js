export function analysisBatches(rows){
 const batches=[];
 let batch=[],size=0;
 const costOf=row=>row.post.text.length+Math.min(1200,row.post.noteBody?.length||0);
 for(const row of [...rows].sort((a,b)=>costOf(a)-costOf(b))){
  const cost=costOf(row);
  if(batch.length&&(batch.length===30||size+cost>18000)){
   batches.push(batch);batch=[];size=0;
  }
  batch.push(row);size+=cost;
 }
 if(batch.length)batches.push(batch);
 return batches;
}

export async function runAnalysisBatches(batches,{parallel,signal,send,failed}){
 let next=0,fatal;
 async function worker(){
  while(!fatal&&!signal.aborted&&next<batches.length){
   const batch=batches[next++];
   try{
    const errors=await send(batch);
    for(const {row,error} of errors||[])failed([row],error);
   }catch(error){
    if(signal.aborted)break;
    failed(batch,error);
    if([401,402,403,503].includes(error.status)||
      (error.status===429&&(error.code==='HARD_LIMIT'||/额度|上限/.test(error.message))))fatal??=error;
   }
  }
 }
 await Promise.all(Array.from({length:Math.min(parallel,batches.length)},worker));
 if(fatal)throw fatal;
}
