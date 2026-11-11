import {cloudSVG} from './wordcloud.js?v=20261111-cloud';
import {migrateMuseumCase} from './data.js?v=20261111-nju';
import {opportunityExamples,opportunityLabels} from './opportunity.js';

const columns=['名称','年代','类别','详细介绍','馆藏编号','别名'];
const exhibitFields={name:'名称',era:'年代',category:'类别',intro:'详细介绍',accession:'馆藏编号',aliases:'别名',keywords:'关键词'};
const exhibitionFields={name:'展览名称',theme:'主题',intro:'简介',start:'开始日期',end:'结束日期',conditions:'参观条件',limits:'限制'};
export const isExhibit=r=>r.type==='展品';
const stop=new Set('this that these those with from which their there were have been also into about made found used and for the its are was'.split(' '));
export function exhibitKeywords(intro){
 const chinese=Intl.Segmenter?[...new Intl.Segmenter('zh',{granularity:'word'}).segment(intro)].filter(t=>t.isWordLike).map(t=>t.segment):[];
 const words=[...chinese.filter(w=>/^[\p{Script=Han}]{2,8}$/u.test(w)),...(intro.toLowerCase().match(/[a-z][a-z-]{2,}/g)||[]).filter(w=>!stop.has(w))];
 const counts=new Map();
 for(const word of words)counts.set(word,(counts.get(word)||0)+1);
 return [...counts].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([word])=>word).join('、');
}
export function parseExhibits(text,existing){
 const rows=[];
 let row=[],cell='',quoted=false;
 text=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n')+'\n';
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'&&(quoted||!cell)){
   if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
  }else if(!quoted&&(c===','||c==='\n')){
   row.push(cell.trim());cell='';
   if(c==='\n'){if(row.some(Boolean))rows.push(row);row=[];}
  }else cell+=c;
 }
 if(quoted)throw Error('CSV 有未闭合的引号');
 const header=rows.shift();
 if(!header||header.join(',')!==columns.join(','))throw Error('请使用网站提供的 CSV 模板和固定列顺序');
 const numbers=new Set(existing.filter(isExhibit).map(r=>r.accession?.toLowerCase()).filter(Boolean));
 const added=[],errors=[];
 rows.forEach((values,index)=>{
  const [name,era,category,intro,accession,aliases]=values;
  if(values.length!==columns.length||values.slice(0,4).some(v=>!v)){errors.push('第 '+(index+2)+' 行：缺少必填字段或列数有误');return;}
  if(accession&&numbers.has(accession.toLowerCase())){errors.push('第 '+(index+2)+' 行：馆藏编号重复');return;}
  if(accession)numbers.add(accession.toLowerCase());
  added.push({id:'R-'+crypto.randomUUID(),type:'展品',name,era,category,intro,accession,aliases,keywords:exhibitKeywords(intro)});
 });
 return {added,errors};
}
export const scoreGuide=()=>`<details class="panel"><summary>潜在参观机会 · 评分说明</summary><p>等级反映原文表达的参观机会。对展品好奇也可以成为推广线索。等级不能换算成到馆概率。</p><ol>${opportunityLabels.map((label,i)=>`<li><b>${label}</b> · ${opportunityExamples[i]}</li>`).join('')}</ol></details>`;
export function createCatalog({getState,client,esc,modal,persist,render,toast,download,editResource}){
 let word='',remoteVersion=null,remoteAccount=null;
 const keywords=r=>[...new Set(String(r.keywords||'').split(/[、,，;；\s]+/).filter(Boolean))];
 const image=r=>typeof r.image==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(r.image)?r.image:'';
 async function save(){await persist();render();}
 function markup(){
  const {resources}=getState(),exhibits=resources.filter(isExhibit),counts=new Map();
  for(const r of exhibits)for(const term of keywords(r))counts.set(term,(counts.get(term)||0)+1);
  const words=[...counts].sort((a,b)=>b[1]-a[1]);
  const tiles=items=>items.map(r=>`<article class="panel">${image(r)?`<img class="catalog-image" src="${image(r)}" alt="${esc(r.name)}">`:''}<h3>${esc(r.name)}</h3><p>${esc([r.type,r.era,r.category,r.theme].filter(Boolean).join(' · '))}</p><p>${esc(r.intro||'')}</p>${r.start?`<p>${esc(r.start)} 至 ${esc(r.end)}</p>`:''}${r.memberIds?.length?`<p>${esc(r.memberIds.map(id=>exhibits.find(x=>x.id===id)?.name).filter(Boolean).join('、'))}</p>`:''}<p class="muted">${esc(r.keywords||'')}</p>${/^https:\/\/(museum\.nju\.edu\.cn|www\.nju\.edu\.cn)\//.test(r.sourceUrl||'')?`<p><a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看资料来源 ↗</a></p>`:''}<button data-catalog="edit" data-id="${esc(r.id)}">编辑</button> <button data-catalog="delete" data-id="${esc(r.id)}">删除</button></article>`).join('');
  return `<section class="panel"><h3>账号同步</h3><p>登录个人 AI 账号后，可将馆藏和图片保存到云端。换设备后登录并读取云端馆藏。</p><button data-catalog="upload">保存到云端</button> <button data-catalog="download">读取云端</button></section>
   <section class="panel"><h3>展品关键词词云</h3><div class="catalog-cloud">${words.length?cloudSVG(words.map(([term,count])=>({word:term,count})),{catalog:true,selected:word}):'添加展品后显示关键词。'}</div>${word?`<p>筛选：${esc(word)} <button data-catalog="word">清除</button></p>`:''}</section>
   <section class="panel"><h3>展品 · ${exhibits.length} 件</h3><button data-catalog="new">添加展品</button> <button data-catalog="template">下载 CSV 模板</button> <button data-catalog="import">选择 CSV</button><input id="catalog-csv" type="file" accept=".csv,text/csv" hidden><div id="catalog-drop" tabindex="0">将展品 CSV 拖到这里</div></section>
   <div class="resource-grid">${tiles(exhibits.filter(r=>!word||keywords(r).includes(word)))}</div>
   <section class="panel"><h3>展览与活动</h3><button data-catalog="exhibition">新建展览</button> <button data-catalog="activity">添加活动</button></section><div class="resource-grid">${tiles(resources.filter(r=>!isExhibit(r)))}</div>`;
 }
 function editor(existing,exhibit){
  const state=getState(),r=existing||{id:'R-'+crypto.randomUUID(),type:exhibit?'展品':'展览'};
  const fields=exhibit?exhibitFields:exhibitionFields;
  const d=modal(`<form>${Object.entries(fields).map(([key,label])=>`<label>${label}${key==='intro'||key==='keywords'?`<textarea name="${key}" ${key==='intro'?'required':''}>${esc(r[key]||'')}</textarea>`:`<input name="${key}" type="${['start','end'].includes(key)?'date':'text'}" value="${esc(r[key]||'')}" ${['name','era','category','theme','start','end'].includes(key)?'required':''}>`}</label>`).join('')}
   ${exhibit?`<button type="button" data-extract>从介绍提取关键词</button><label>展品图片（PNG、JPEG 或 WebP，最大 500 KB）<input type="file" name="photo" accept="image/png,image/jpeg,image/webp"></label>${image(r)?'<label><input type="checkbox" name="removePhoto">移除图片</label>':''}`:`<fieldset><legend>勾选展品</legend><input type="search" placeholder="搜索展品" data-find><div>${state.resources.filter(isExhibit).map(item=>`<label data-exhibit="${esc(item.name)}"><input type="checkbox" name="members" value="${esc(item.id)}" ${r.memberIds?.includes(item.id)?'checked':''}>${esc(item.name)}</label>`).join('')}</div></fieldset>`}
   <button class="primary">保存</button></form>`,exhibit?'展品详情':'展览安排');
  const form=d.querySelector('form');
  form.querySelector('[data-extract]')?.addEventListener('click',()=>{form.elements.keywords.value=exhibitKeywords(form.elements.intro.value);});
  form.querySelector('[data-find]')?.addEventListener('input',e=>{for(const label of form.querySelectorAll('[data-exhibit]'))label.hidden=!label.dataset.exhibit.toLowerCase().includes(e.target.value.toLowerCase());});
  form.onsubmit=async e=>{
   e.preventDefault();
   try{
    const data=new FormData(form),next={...r};
    for(const key of Object.keys(fields))next[key]=String(data.get(key)||'').trim();
    if(exhibit){
     if(!next.name||!next.era||!next.category||!next.intro)throw Error('请填写名称、年代、类别和介绍');
     next.keywords||=exhibitKeywords(next.intro);
     if(next.accession&&state.resources.some(x=>x.id!==next.id&&isExhibit(x)&&x.accession?.toLowerCase()===next.accession.toLowerCase()))throw Error('馆藏编号重复');
     if(data.has('removePhoto')){delete next.image;delete next.imageId;}
     const file=data.get('photo');
     if(file?.size){
      if(file.size>500000||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('请选择 500 KB 以内的 PNG、JPEG 或 WebP');
      next.image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
      next.imageId=crypto.randomUUID();
     }
    }else{
     if(next.end<next.start)throw Error('结束日期不能早于开始日期');
     next.memberIds=data.getAll('members');
     if(!next.memberIds.length)throw Error('请至少勾选一件展品');
    }
    state.resources=existing?state.resources.map(x=>x.id===r.id?next:x):[...state.resources,next];
    await save();d.close();
   }catch(error){toast(error.message);}
  };
 }
 async function importFile(file){
  try{
   const {added,errors}=parseExhibits(await file.text(),getState().resources);
   const d=modal(`<p>可添加 ${added.length} 件，跳过 ${errors.length} 行。</p><ul>${added.slice(0,20).map(r=>`<li>${esc(r.name)} · ${esc(r.era)}</li>`).join('')}${errors.slice(0,30).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><button data-apply ${added.length?'':'disabled'}>确认导入</button>`,'展品导入预览');
   d.querySelector('[data-apply]').onclick=async()=>{getState().resources=[...getState().resources,...added];await save();d.close();};
  }catch(error){toast(error.message);}
 }
 async function sync(direction){
  const api=client(),account=api.personalAccount;
  if(!account)throw Error('请先登录个人 AI 账号');
  if(remoteAccount!==account.id){remoteAccount=account.id;remoteVersion=null;}
  const state=getState(),endpoint='/api/personal/catalog';
  const cloud=await api.request(endpoint);
  if(direction==='download'){
   if(!cloud.catalog)throw Error('这个账号还没有云端馆藏');
   if(!confirm('读取云端馆藏并替换此浏览器当前馆藏？'))return;
   const resources=[];
   for(const r of cloud.catalog.resources){
    const picture=r.imageId?await api.request(endpoint+'/image?id='+encodeURIComponent(r.imageId)):null;
    resources.push({...r,...(picture?{image:picture.image}:{})});
   }
   if(getState()!==state)throw Error('账号已切换，请重新读取');
   state.resources=resources;state.museum=cloud.catalog.museum;migrateMuseumCase(state);remoteVersion=cloud.version;
   await save();toast('已读取云端馆藏');return;
  }
  if(cloud.version!==remoteVersion&&cloud.catalog&&!confirm('云端已有馆藏。确认用当前馆藏替换？'))return;
  const resources=[];
  for(const {image:picture,...r} of state.resources){
   if(picture&&r.imageId)await api.request(endpoint+'/image',{id:r.imageId,image:picture});
   resources.push(r);
  }
  const result=await api.request(endpoint,{version:cloud.version,catalog:{museum:state.museum,resources}});
  remoteVersion=result.version;toast('馆藏与图片已保存到云端');
 }
 async function click(action,id){
  const state=getState(),r=state.resources.find(item=>item.id===id);
  if(action==='word'){word=id||'';render();return;}
  if(action==='new'||action==='exhibition'){editor(null,action==='new');return;}
  if(action==='activity'){editResource();return;}
  if(action==='edit'&&r){if(isExhibit(r)||r.memberIds)editor(r,isExhibit(r));else editResource(id);return;}
  if(action==='import'){document.querySelector('#catalog-csv').click();return;}
  if(action==='template'){download('MuseRadar-展品导入模板.csv','\uFEFF'+columns.join(',')+'\r\n','text/csv;charset=utf-8');return;}
  if(action==='upload'||action==='download'){await sync(action);return;}
  if(action==='delete'&&r){
   const uses=state.resources.filter(x=>x.memberIds?.includes(id));
   if(!confirm('删除「'+r.name+'」？'+(uses.length?'将同时从展览中移除：'+uses.map(x=>x.name).join('、'):'')))return;
   state.resources=state.resources.filter(x=>x.id!==id).map(x=>x.memberIds?.includes(id)?{...x,memberIds:x.memberIds.filter(v=>v!==id)}:x);
   await save();
  }
 }
 return {markup,click,importFile,reset:()=>{word='';remoteAccount=null;remoteVersion=null;}};
}
