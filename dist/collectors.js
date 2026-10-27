/** Public comment adapters. No synthetic fallback, no author tracking. */
export const communities = [
  {id:'hn', name:'Hacker News', note:'英语技术社区 · 评论正文匹配关键词', scope:'HN Search 索引内的公开评论'},
  {id:'se-travel', name:'Travel Stack Exchange', note:'旅行问答社区 · 匹配问题下的评论（不含回答评论）', scope:'关键词匹配问题下的公开评论'},
  {id:'se-history', name:'History Stack Exchange', note:'历史问答社区 · 匹配问题下的评论（不含回答评论）', scope:'关键词匹配问题下的公开评论'}
];
export const stripHTML = value => {
  if(typeof DOMParser!=='undefined') return new DOMParser().parseFromString(String(value||''),'text/html').body.textContent?.replace(/\s+/g,' ').trim()||'';
  return String(value||'').replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&(amp|lt|gt|quot|apos|nbsp);/g,(_,n)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[n]).replace(/\s+/g,' ').trim();
};
export const redact = s => s.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[邮箱已隐去]').replace(/(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/g,'[电话已隐去]');
export function dateRange(from='',to='',now=Date.now()) {
  const valid = s => /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
  if((from&&!valid(from))||(to&&!valid(to)))throw Error('请选择有效起止日期');
  const start=from?Math.floor(Date.parse(from+'T00:00:00Z')/1000):0,end=to?Math.floor(Date.parse(to+'T23:59:59Z')/1000):Math.floor(now/1000);
  if(start>end)throw Error('开始日期不能晚于结束日期');
  return {start,end:Math.min(end,Math.floor(now/1000))};
}
export function newCollection({source,query,from='',to=''},now=Date.now()) {
  if(!communities.some(x=>x.id===source))throw Error('请选择已支持的社区');
  if(!query?.trim())throw Error('请输入检索关键词，公开社区建议使用英文 museum');
  const range=dateRange(from,to,now);
  return {id:crypto.randomUUID(),source,query:query.trim(),from,to,...range,status:'ready',createdAt:new Date(now).toISOString(),pages:0,received:0,added:0,duplicates:0,excluded:0,error:'',partialReasons:[],cursor:source==='hn'?{windows:[{lo:range.start,hi:range.end,page:0}]}:{phase:'search',page:1,questions:[],questionIndex:0,commentPage:1},nextRequestAt:0,complete:false};
}
async function json(url,fetchImpl,signal){
  const timeout=AbortSignal.timeout(25000),response=await fetchImpl(url,{signal:signal?AbortSignal.any([signal,timeout]):timeout,credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('公开接口返回 HTTP '+response.status+'；保留进度，可稍后重试');
  const data=await response.json();if(data.error_id)throw Error(data.error_message||'公开接口拒绝请求');return data;
}
function publicRow({id,text,source,date,url,title='',attribution=''}) {
  return {id,text:redact(stripHTML(text)),source:communities.find(s=>s.id===source).name,platform:communities.find(s=>s.id===source).name,sourceId:source,sourceUrl:url,evidenceUrl:url,date:new Date(date*1000).toISOString().slice(0,10),publishedAt:new Date(date*1000).toISOString(),collectedAt:new Date().toISOString(),threadTitle:stripHTML(title),kind:'public-discussion',language:'en',analyzed:false,provenance:'公开接口原始评论；移除 HTML 与作者身份字段；联系方式隐去；未翻译或生成正文',license:source==='hn'?'原作者内容；使用遵守原平台条款':'原评论适用的 CC BY-SA 版本请见原文修订记录',attribution};
}
export async function fetchCollectionPage(task,{fetchImpl=fetch,signal}={}) {
  if(task.complete)return {task,items:[]};
  const next=structuredClone(task),c=next.cursor;let data,items=[],received=0,url,done=false;
  if(task.source==='hn') {
    const w=c.windows[0];if(!w)throw Error('缺少分页断点');
    url=new URL('https://hn.algolia.com/api/v1/search_by_date');url.searchParams.set('query',task.query);url.searchParams.set('tags','comment');url.searchParams.set('hitsPerPage','100');url.searchParams.set('page',String(w.page));url.searchParams.set('numericFilters',`created_at_i>=${w.lo},created_at_i<=${w.hi}`);
    data=await json(url,fetchImpl,signal);if(!Array.isArray(data.hits)||!Number.isInteger(data.nbPages))throw Error('HN 返回了无效的分页信息');
    // Partition before consuming a capped result window; no skipped time boundaries.
    if(data.nbHits>1000&&w.page===0&&w.lo<w.hi){const mid=Math.floor((w.lo+w.hi)/2);c.windows.splice(0,1,{lo:w.lo,hi:mid,page:0},{lo:mid+1,hi:w.hi,page:0});}
    else {
      received=data.hits.length;
      items=data.hits.filter(h=>h.comment_text&&Number.isFinite(h.created_at_i)&&h.created_at_i>=task.start&&h.created_at_i<=task.end).map(h=>publicRow({id:'HN-'+h.objectID,text:h.comment_text,source:'hn',date:h.created_at_i,url:'https://news.ycombinator.com/item?id='+encodeURIComponent(h.objectID),title:h.story_title}));
      if(data.nbHits>1000&&w.lo===w.hi&&!next.partialReasons.includes('同一秒命中量超过 HN 可访问窗口'))next.partialReasons.push('同一秒命中量超过 HN 可访问窗口');
      if(w.page+1<data.nbPages&&received){w.page++;}else c.windows.shift();
    }
    done=!c.windows.length;
  } else {
    const site=task.source==='se-travel'?'travel':'history';
    if(c.phase==='search'){
      url=new URL('https://api.stackexchange.com/2.3/search/advanced');Object.entries({site,q:task.query,pagesize:100,page:c.page,sort:'creation',order:'desc',filter:'default',todate:task.end}).forEach(([k,v])=>url.searchParams.set(k,String(v)));
      data=await json(url,fetchImpl,signal);if(!Array.isArray(data.items)||typeof data.has_more!=='boolean')throw Error('社区检索返回无效分页信息');
      for(const q of data.items)if(!c.questions.some(x=>x.id===q.question_id))c.questions.push({id:q.question_id,title:stripHTML(q.title)});
      if(data.has_more)c.page++;else{c.phase='comments';c.commentPage=1;}
    }else{
      const batch=c.questions.slice(c.questionIndex,c.questionIndex+30);
      if(!batch.length){next.complete=true;next.status=next.partialReasons.length?'partial':'complete';return {task:next,items:[]};}
      url=new URL('https://api.stackexchange.com/2.3/questions/'+batch.map(x=>x.id).join(';')+'/comments');Object.entries({site,pagesize:100,page:c.commentPage,sort:'creation',order:'asc',fromdate:task.start,todate:task.end,filter:'withbody'}).forEach(([k,v])=>url.searchParams.set(k,String(v)));
      data=await json(url,fetchImpl,signal);if(!Array.isArray(data.items)||typeof data.has_more!=='boolean')throw Error('社区评论返回无效分页信息');received=data.items.length;
      items=data.items.filter(x=>x.body&&x.creation_date>=task.start&&x.creation_date<=task.end).map(x=>publicRow({id:`SE-${site}-${x.comment_id}`,text:x.body,source:task.source,date:x.creation_date,url:`https://${site}.stackexchange.com/questions/${x.post_id}#comment${x.comment_id}_${x.post_id}`,title:batch.find(q=>q.id===x.post_id)?.title,attribution:'Stack Exchange 原作者；署名及许可版本见原评论链接'}));
      if(data.has_more)c.commentPage++;else{c.questionIndex+=batch.length;c.commentPage=1;}
      done=c.questionIndex>=c.questions.length;
    }
    next.quota=data.quota_remaining;
    next.nextRequestAt=Date.now()+Math.max(1100,(data.backoff||0)*1000);
    if(data.quota_remaining===0&&!done){next.status='partial';next.error='公开接口当日额度已用尽，请恢复额度后继续';}
    if(c.phase==='comments'&&!c.questions.length)done=true;
  }
  items=items.filter(x=>x.text.length>=3);next.pages++;next.received+=received;next.excluded+=received-items.length;next.lastUrl=url.href;next.updatedAt=new Date().toISOString();next.complete=done;next.status=done?(next.partialReasons.length?'partial':'complete'):next.status==='partial'?'partial':'running';
  next.nextRequestAt=Math.max(next.nextRequestAt||0,Date.now()+400);return {task:next,items};
}
export function mergeRows(incoming,existing) {
  const ids=new Set(existing.map(p=>p.id)),texts=new Set(existing.map(p=>p.text.trim().replace(/\s+/g,' ').toLowerCase()));let duplicates=0;const items=[];
  for(const p of incoming){const key=p.text.trim().replace(/\s+/g,' ').toLowerCase();if(ids.has(p.id)||texts.has(key)){duplicates++;continue;}items.push(p);ids.add(p.id);texts.add(key);}return {items,duplicates};
}
