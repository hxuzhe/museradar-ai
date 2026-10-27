import {analyze} from './engine.js';
import {themes} from './data.js';
export const levels=[{value:1,label:'一档 · 明确排斥',short:'明确排斥'},{value:2,label:'二档 · 意愿较弱',short:'意愿较弱'},{value:3,label:'三档 · 一般兴趣',short:'一般兴趣'},{value:4,label:'四档 · 潜在体验需求',short:'潜在需求'},{value:5,label:'五档 · 明确参观意愿',short:'明确意愿'}];
const fingerprintMemo=new WeakMap();
export function fingerprint(post,resources,museum){const old=fingerprintMemo.get(post);if(old&&old.resources===resources&&old.museum===museum&&old.text===post.text&&old.date===post.date&&old.kind===post.kind)return old.hash;let h=14695981039346656037n;for(const c of JSON.stringify([post.id,post.text,post.date,post.kind,resources,museum,'schema-v3.1'])){h^=BigInt(c.codePointAt(0));h=BigInt.asUintN(64,h*1099511628211n);}const hash=h.toString(16);fingerprintMemo.set(post,{resources,museum,text:post.text,date:post.date,kind:post.kind,hash});return hash;}
const ruleMemo=new WeakMap();
export function ruleAssessment(post,resources,museum){
 const key=fingerprint(post,resources,museum),cached=ruleMemo.get(post);if(cached?.key===key)return cached.value;
  const r=analyze(post,resources),t=post.text,history=['已经参观','历史评论/到访待核实'].includes(r.intent),irrelevant=r.intent==='无关内容',weak=/太贵|贵了|担心|犹豫|排队|不方便|expensive|worried|queue|crowd/i.test(t),level=history||irrelevant?null:r.intent==='负面/排斥'?1:r.intent==='明确参观计划'?5:r.intent==='潜在体验需求'?(weak?2:4):weak?2:3;
  const value={mode:'rules',fingerprint:fingerprint(post,resources,museum),model:'local-rules-v3',analyzedAt:new Date().toISOString(),level,sentiment:/不想|失望|差劲|太贵|不推荐|糟糕|disappoint|terrible|hate/i.test(t)?'负面':/喜欢|开心|推荐|精彩|值得|很棒|love|wonderful|great/i.test(t)?'正面':'中性',relevance:irrelevant?'无关':'相关',visitState:history?'已参观/历史反馈':level>=4?'未来需求':'未明确',theme:r.theme,needs:r.hits,evidence:r.hits.filter(x=>t.includes(x)).slice(0,5),reason:history?'历史反馈单独归类，不根据好评推断新的参观意愿':r.reasons[1],uncertainties:r.uncertainties,resourceIds:r.matches.map(x=>x.id),status:'success'};ruleMemo.set(post,{key,value});return value;
}
export function validateAssessment(value,post,resources,museum){
  if(!value||typeof value!=='object')throw Error('模型未返回有效对象');
  if(!['正面','负面','中性','混合','不确定'].includes(value.sentiment))throw Error('模型情绪字段无效');
  if(!['相关','无关','待核实'].includes(value.relevance)||!['已参观/历史反馈','未来需求','未明确'].includes(value.visitState))throw Error('模型意愿状态无效');
  if(![null,1,2,3,4,5].includes(value.level))throw Error('模型档位必须为 1—5 或 null');
  if(![...themes,'其他'].includes(value.theme))throw Error('模型主题不在允许范围');
  const strings=(v,n)=>{if(!Array.isArray(v)||v.length>n||v.some(x=>typeof x!=='string'||x.length>1500))throw Error('模型列表字段无效');return v;};
  const evidence=strings(value.evidence,8);if(evidence.some(s=>!s.trim()||!post.text.includes(s)))throw Error('模型证据不是原文片段，结果待重试');
  if(typeof value.reason!=='string'||!value.reason.trim()||value.reason.length>3000)throw Error('模型缺少判断解释');
  const resourceIds=strings(value.resourceIds,12);if(resourceIds.some(id=>!resources.some(r=>r.id===id)))throw Error('模型引用了不存在的馆藏资源');
  if(value.level!==null&&(value.relevance!=='相关'||value.visitState==='已参观/历史反馈'))throw Error('无关、待核实或历史反馈不能强制分档');
  if(value.level!==null&&!evidence.length)throw Error('意愿分档必须有原文证据');
  return {mode:'ai',model:'configured-model',status:'success',fingerprint:fingerprint(post,resources,museum),analyzedAt:new Date().toISOString(),level:value.level,sentiment:value.sentiment,relevance:value.relevance,visitState:value.visitState,theme:value.theme,reason:value.reason,evidence,needs:strings(value.needs,12),uncertainties:strings(value.uncertainties,12),resourceIds};
}
export function assessment(post,state){const a=state.assessments?.[post.id],fresh=a&&a.fingerprint===fingerprint(post,state.resources,state.museum);let out=fresh?a:null;
  if(state.mode==='rules')out=ruleAssessment(post,state.resources,state.museum);
  if(state.mode==='ai'&&out?.mode!=='ai')out=null;
  const review=state.reviews?.[post.id];if(review?.override&&review.fingerprint===fingerprint(post,state.resources,state.museum))out={...(out||{}),...review.override,mode:'human',reason:review.note,fingerprint:review.fingerprint,status:'success',evidence:review.evidence||[],resourceIds:out?.resourceIds||[],needs:out?.needs||[],uncertainties:out?.uncertainties||[],theme:review.override.theme||out?.theme||'其他'};
  return out;
}
export function selectRows(state,filters={}){return state.posts.map(post=>({post,a:assessment(post,state),review:state.reviews?.[post.id]?.status||'pending'})).filter(({post,a,review})=>{
  const key=(post.text+' '+post.id+' '+(post.threadTitle||'')).toLowerCase();
  return (!filters.search||key.includes(filters.search.toLowerCase()))&&(!filters.source||post.sourceId===filters.source||post.source===filters.source)&&(!filters.from||!!post.date&&post.date>=filters.from)&&(!filters.to||!!post.date&&post.date<=filters.to)&&(!filters.levels?.length||filters.levels.includes(a?.level))&&(!filters.sentiment||a?.sentiment===filters.sentiment)&&(!filters.theme||a?.theme===filters.theme)&&(!filters.review||review===filters.review)&&(!filters.special||(filters.special==='pending'?!a:filters.special==='past'?a?.visitState==='已参观/历史反馈':filters.special==='irrelevant'?a?.relevance==='无关':a?.relevance==='待核实'));
});}
export function cohortScope(state,filters={},days=90,includeHistory=false,now=Date.now()){
  const end=new Date(now).toISOString().slice(0,10),start=new Date(now-days*86400000).toISOString().slice(0,10),rows=selectRows(state,{...filters,from:filters.from&&filters.from>start?filters.from:start,to:filters.to&&filters.to<end?filters.to:end});
  const eligible=rows.filter(r=>r.review!=='rejected'),pending=eligible.filter(r=>!r.a),valid=eligible.filter(r=>r.a&&r.a.relevance==='相关'&&(includeHistory||r.a.visitState!=='已参观/历史反馈'));
  const groups=[...new Set(valid.map(r=>r.a.theme))].map(theme=>{const members=valid.filter(r=>r.a.theme===theme),distribution=levels.map(l=>({level:l.value,n:members.filter(r=>r.a.level===l.value).length})),resourceIds=[...new Set(members.flatMap(r=>r.a.resourceIds||[]))];
    return {id:theme,theme,name:theme+'需求群体',n:members.length,share:valid.length?Math.round(members.length/valid.length*100):0,members,distribution,resourceIds,history:members.filter(r=>r.a.visitState==='已参观/历史反馈').length,high:members.filter(r=>r.a.level>=4).length,unverified:members.filter(r=>['manual','imported'].includes(r.post.kind)).length};}).sort((a,b)=>b.n-a.n);
  return {rows,eligible,pending,valid,groups,excluded:rows.filter(r=>r.review==='rejected').length,unrelated:eligible.filter(r=>r.a?.relevance==='无关').length,uncertain:eligible.filter(r=>r.a?.relevance==='待核实').length,historical:eligible.filter(r=>r.a?.visitState==='已参观/历史反馈').length,start,end};
}
export const groupSignature=(g,state)=>JSON.stringify([g.members.map(r=>[r.post.id,r.a.fingerprint,r.a.level,r.a.mode,r.a.reason,r.a.evidence]),state.museum,state.resources]);
export function templatePlan(g,state){const rs=state.resources.filter(r=>g.resourceIds.includes(r.id));return `# ${g.name}宣传方案\n\n生成方式：本地模板演示（非 AI）\n样本：${g.n} 条；历史反馈 ${g.history} 条；来源未核实 ${g.unverified} 条。\n\n## 1. 机会与证据\n${g.members.slice(0,3).map(r=>`- [${r.post.id}] ${r.post.text.slice(0,350)}`).join('\n')}\n\n## 2. 目标需求\n围绕「${g.theme}」的表达开展需求验证，不推断年龄、收入或真实身份。\n\n## 3. 可用资源\n${rs.map(r=>`- ${r.name}：${r.intro}；条件：${r.conditions}；限制：${r.limits}`).join('\n')||'暂无匹配资源：先确认资源供给，暂不发布活动承诺。'}\n\n## 4. 内容切入点\n解释相关馆藏能提供什么体验，并把参与条件讲清楚。\n\n## 5. A/B 文案（待馆方确认）\nA：从${g.theme}出发，发现${state.museum.name}的文化体验。查看资源介绍与参与规则。\nB：把好奇变成一次探索。了解${rs[0]?.name||'馆内资源'}，确认开放与预约信息后再出发。\n\n## 6. 渠道与关键词\n渠道作为试验假设，不建立个人定向名单；关键词：${g.theme}、博物馆体验。\n\n## 7. 运营建议\n馆方审核资源、开放时间和活动条件后，小范围测试内容。宣传覆盖情况待核实。\n\n## 8. 验证指标\n内容点击率、详情页访问、报名转化率、实际到场率。当前无真实投放结果。\n\n证据成员：${g.members.map(r=>r.post.id).join('、')}`;}
