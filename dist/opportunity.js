export const opportunityLabels=[
 '与馆藏或参观无关','明确拒绝或暂不考虑','泛文化兴趣或历史回顾',
 '对类别、年代或工艺感兴趣','关注具体展品或特征','对具体展品好奇',
 '想现场观看或体验','有条件考虑或询问参观信息','明确参观计划','已预约、购票或正在前往'
];
export const opportunityExamples=[
 '今天路好堵。','我不想再排队看展了。','以前去过，感觉不错。',
 '古代铸造技术挺有意思。','这面铜镜的纹样真特别。','铜镜上的纹样是怎么做的？',
 '真想现场看看这面铜镜。','周末能看到吗？需要预约吗？','这周六打算带孩子去看铜镜展。','已经预约了周六下午的场次。'
];
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
