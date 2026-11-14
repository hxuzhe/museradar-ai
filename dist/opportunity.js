export const opportunityLabels=['无需求或证据不足','泛兴趣或历史回顾','具体好奇','有到访意愿或在查条件','明确近期到访计划或已行动'];
export const opportunityExamples=['纯表情或明确不去','上次去过，还不错','小克鼎铭文讲了什么？','校外能预约吗？想看看小克鼎','约了这周六下午去'];
export function catalogCandidates(rows,resources){
 const text=rows.map(row=>row.text.toLowerCase()).join(' ');
 const terms=value=>String(value||'').toLowerCase().match(/[a-z][a-z0-9]{2,}|[\p{Script=Han}]{2,}/gu)||[];
 return resources.map(r=>{
  const names=[r.name,...String(r.aliases||'').split(/[、,，;；]/)].filter(Boolean);
  const hits=names.filter(name=>text.includes(name.toLowerCase())).length;
  const matches=terms([r.category,r.keywords].join(' ')).filter(term=>text.includes(term)).length;
  return {r,score:hits*10+matches};
 }).sort((a,b)=>b.score-a.score).slice(0,35).map(({r})=>({
  id:r.id,name:r.name,type:r.type,category:r.category,era:r.era,aliases:r.aliases,
  intro:String(r.intro||'').slice(0,450),keywords:r.keywords,scenes:r.scenes,
  conditions:r.conditions,limits:r.limits,memberIds:r.memberIds,start:r.start,end:r.end,theme:r.theme
 }));
}
