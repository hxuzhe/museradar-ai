import {classroomError} from './classroom-auth.mjs';

export async function readWeiboComments(env,store,input,fetchImpl){
 const query=typeof input?.query==='string'?input.query.trim():'';
 const from=input?.from||'',to=input?.to||'';
 const validDay=day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;
 if(!query||query.length>100||/[{}、“”]/.test(query))throw classroomError('请输入有效的微博关键词（最多 100 字）');
 if((from&&!validDay(from))||(to&&!validDay(to))||(from&&to&&from>to))throw classroomError('请选择有效的评论日期范围');
 const args={q:query,type:2,count:50,page:1};
 if(from)args.starttime=Date.parse(from+'T00:00:00+08:00')/1000;
 if(to)args.endtime=Date.parse(to+'T23:59:59+08:00')/1000;
 if(!env.WEIBO_CLI_ACCESS_TOKEN)throw classroomError('微博服务尚未配置',503);
 const base='https://open.weibo.com/cli/api';
 const headers={Authorization:'Bearer '+env.WEIBO_CLI_ACCESS_TOKEN,'Content-Type':'application/json'};
 const request=async(path,init)=>{try{return await fetchImpl(base+path,{headers,redirect:'manual',signal:AbortSignal.timeout(15000),...init});}catch{throw classroomError('Cloudflare 无法连接微博官方接口',502);}};
 const account=await request('/cli/whoami');
 if(!account.ok)throw classroomError('微博授权已失效或暂不可用',503);
 const profile=await account.json().catch(()=>null);
 if(profile?.service_status?.kind!=='trial_active')throw classroomError('微博免费体验当前不可用',403);
 await store.update('weibo:trial-search-calls',value=>{
  if((value||0)>=4)throw classroomError('本站微博试用调用次数已用完',429);
  return (value||0)+1;
 });
 const response=await request('/cli/invoke',{method:'POST',body:JSON.stringify({group:'search',action:'statuses/limited',args})});
 if(!response.ok)throw classroomError(response.status===429?'微博接口额度已用完，请稍后再试':'微博未能返回评论，请检查搜索权限或稍后重试',response.status===429?429:502);
 const payload=await response.json().catch(()=>null);
 const comments=(payload?.result?.comments??payload?.result?.statuses);
 if(!Array.isArray(comments))throw classroomError('微博返回的评论格式不正确',502);
 const rows=comments.flatMap(row=>{
  const body=typeof row.text_raw==='string'?row.text_raw:row.text;
  if(typeof body!=='string')return [];
  const text=body.replace(/<[^>]*>/g,' ').replace(/@[\p{L}\p{N}_-]+/gu,'').trim().slice(0,15000);
  if(!text)return [];
  const date=Date.parse(row.created_at);
  const key=String(row.idstr||row.id||'');
  const parent=String(row.status?.idstr||row.status?.id||row.in_reply_to_status_id||'');
  const sourceUrl=/^\d{10,20}$/.test(parent)?'https://m.weibo.cn/detail/'+parent:'';
  const day=Number.isFinite(date)?new Date(date+28800000).toISOString().slice(0,10):'';
  if((from||to)&&(!day||(from&&day<from)||(to&&day>to)))return [];
  if(!/^\d{1,25}$/.test(key))return [];
  return [{id:'weibo-'+key,text,date:day,sourceUrl}];
 });
 return {rows,returned:comments.length};
}

