import {classroomError} from './classroom-auth.mjs';

export async function personalCatalog(request,url,store,account,readBody){
 const key='catalog:'+account.id;
 if(url.pathname.endsWith('/image')){
  const input=request.method==='POST'?await readBody(request):null;
  const id=input?.id||url.searchParams.get('id');
  if(!/^[a-f0-9-]{36}$/i.test(id||''))throw classroomError('图片编号无效');
  const imageKey=key+':image:'+id;
  if(request.method==='GET'){
   const image=await store.get(imageKey);
   if(!image)throw classroomError('未找到图片',404);
   return image;
  }
  if(request.method==='POST'){
   if(typeof input.image!=='string'||input.image.length>667000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.image))throw classroomError('图片格式或大小无效');
   await store.update(imageKey,old=>old||{image:input.image});
   return {ok:true};
  }
 }
 if(request.method==='GET')return await store.get(key)||{version:0,catalog:null};
 if(request.method!=='POST')throw classroomError('接口不存在',404);
 const {version,catalog}=await readBody(request);
 if(!Number.isInteger(version)||typeof catalog?.museum?.name!=='string'||!Array.isArray(catalog.resources)||catalog.resources.length>5000)throw classroomError('馆藏数据格式无效');
 const ids=new Set();
 const exhibits=new Set(catalog.resources.filter(r=>r?.type==='展品').map(r=>r.id));
 for(const r of catalog.resources){
  if(typeof r?.id!=='string'||typeof r.name!=='string'||!r.name.trim()||ids.has(r.id)||r.image!==undefined)throw classroomError('馆藏记录无效或编号重复');
  ids.add(r.id);
  if(r.memberIds!==undefined&&(!Array.isArray(r.memberIds)||r.memberIds.some(id=>!exhibits.has(id))))throw classroomError('展览包含不存在的展品');
 }
 for(const id of new Set(catalog.resources.map(r=>r.imageId).filter(Boolean))){
  if(!/^[a-f0-9-]{36}$/i.test(id)||!await store.get(key+':image:'+id))throw classroomError('展品图片尚未保存');
 }
 const saved=await store.update(key,current=>{
  if((current?.version||0)!==version)throw classroomError('云端馆藏已更新，请读取最新版本再保存',409);
  return {version:version+1,catalog};
 });
 return {version:saved.version};
}
