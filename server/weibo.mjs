import {classroomError} from './classroom-auth.mjs';

export async function readWeiboComments(env,store,input,fetchImpl){
 const id=input?.id,page=input?.page??1;
 if(typeof id!=='string'||!/^\d{10,20}$/.test(id)||!Number.isInteger(page)||page<1||page>20)throw classroomError('请输入有效的微博数字 ID 和页码');
 if(!env.WEIBO_CLI_ACCESS_TOKEN)throw classroomError('微博服务尚未配置',503);
 const base='https://open.weibo.com/cli/api';
 const headers={Authorization:'Bearer '+env.WEIBO_CLI_ACCESS_TOKEN,'Content-Type':'application/json'};
 const request=(path,init)=>fetchImpl(base+path,{headers,redirect:'error',signal:AbortSignal.timeout(15000),...init});
 const account=await request('/cli/whoami');
 if(!account.ok)throw classroomError('微博授权已失效或暂不可用',503);
 const profile=await account.json();
 if(profile.service_status?.kind!=='trial_active')throw classroomError('微博免费体验当前不可用',403);
 await store.update('weibo:trial-calls',value=>{
  if((value||0)>=4)throw classroomError('本站微博试用调用次数已用完',429);
  return (value||0)+1;
 });
 const response=await request('/cli/invoke',{method:'POST',body:JSON.stringify({group:'comments',action:'show/all',args:{id,page,count:50}})});
 if(!response.ok)throw classroomError(response.status===429?'微博接口额度已用完，请稍后再试':'微博未能返回评论，请检查博文 ID 或访问权限',response.status===429?429:502);
 const payload=await response.json();
 const comments=payload.result?.comments;
 if(!Array.isArray(comments))throw classroomError('微博返回的评论格式不正确',502);
 const sourceUrl='https://m.weibo.cn/detail/'+id;
 const rows=comments.flatMap(row=>{
  const body=typeof row.text_raw==='string'?row.text_raw:row.text;
  if(typeof body!=='string')return [];
  const text=body.replace(/<[^>]*>/g,' ').replace(/@[\p{L}\p{N}_-]+/gu,'').trim().slice(0,15000);
  if(!text)return [];
  const date=Date.parse(row.created_at);
  const key=String(row.idstr||row.id||'');
  if(!/^\d{1,25}$/.test(key))return [];
  return [{id:'weibo-'+key,text,date:Number.isFinite(date)?new Date(date+28800000).toISOString().slice(0,10):'',sourceUrl}];
 });
 return {rows,sourceUrl,page};
}
