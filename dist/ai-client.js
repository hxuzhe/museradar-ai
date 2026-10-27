export class AIClient {
 constructor(base='',token=''){this.base=base.replace(/\/$/,'');this.token=token;}
 async request(path,body,signal){
  if(!this.base)throw Error('AI 未连接：请在连接设置中填写后端地址；密钥只配置在服务端');
  const u=new URL(this.base);if(u.search||u.hash)throw Error('后端地址只填根地址，不要包含查询参数或密钥');if(u.username||u.password)throw Error('后端地址不能包含账号或密钥');if(u.protocol!=='https:'&&!(['localhost','127.0.0.1'].includes(u.hostname)&&u.protocol==='http:'))throw Error('后端必须使用 HTTPS；本机可使用 http://127.0.0.1');
  const r=await fetch(this.base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(this.token?{'Authorization':'Bearer '+this.token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(180000)]):AbortSignal.timeout(180000),credentials:'omit',referrerPolicy:'no-referrer'});
  let data;try{data=await r.json();}catch{throw Error('后端没有返回 JSON；检查地址和服务状态');}if(!r.ok){if(r.status===401&&this.publicAccess&&['/api/analyze','/api/summary','/api/plan','/api/public/usage'].includes(path)&&!this.refreshing){this.refreshing=true;try{const session=await this.request('/api/public/session',{});this.token=session.token;return await this.request(path,body,signal);}finally{this.refreshing=false;}}const e=Error(data.error||'后端请求失败 '+r.status);e.status=r.status;throw e;}return data;
 }
 config(){return this.request('/api/config');}
 configure(settings){return this.request('/api/config',settings);}
 test(){return this.request('/api/test-model',{});}
 status(){return this.request('/api/status');}
 analyze(posts,resources,museum,signal){return this.request('/api/analyze',{posts,resources,museum},signal);}
 summary(rows,resources,museum,signal){return this.request('/api/summary',{rows,resources,museum},signal);}
 plan(group,summaries,resources,museum,signal){return this.request('/api/plan',{group,summaries,resources,museum},signal);}
}
