import {ClassroomService,classroomError,digest,randomToken,verifyPassword,passwordRecord} from './classroom-auth.mjs';
export const publicDefaults={requestsPerMinute:6,commentsPerNetworkDay:120,plansPerNetworkDay:6,sessionHours:4,commentsPerSession:30,plansPerSession:1,summariesPerSession:20,requestsPerSession:40,dailyCalls:100,dailyTokens:500000,concurrency:2,enabled:true};
export const publicDay=now=>new Date(now+8*3600000).toISOString().slice(0,10);
export class PublicAIService extends ClassroomService {
 constructor(store,settings,network,salt){super(store,settings);this.network=network||'shared-network';this.salt=salt;}
 async configuration(){return {...publicDefaults,...this.settings(),...await this.store.get('settings'),version:'public-v1'};}
 async networkKey(){if(!this.salt)throw classroomError('公开 AI 防护尚未配置',503);return digest(this.network+'|'+this.salt);}
 async issue(now=Date.now()){
  const config=await this.configuration();if(!config.enabled)throw classroomError('网站 AI 暂时关闭，请稍后再试',503);const network=await this.networkKey();
  await this.store.update('mint:'+network+':'+Math.floor(now/60000),old=>{if((old?.n||0)>=60)throw classroomError('此网络正在频繁刷新，请稍后再试',429);return {n:(old?.n||0)+1,expires:now+120000};});
  const token=randomToken(),session={id:crypto.randomUUID(),kind:'public',network,createdAt:now,expires:now+config.sessionHours*3600000,version:'public-v1',comments:0,plans:0,summaries:0,requests:0};await this.store.put('session:'+await digest(token),session);return {token,expiresAt:new Date(session.expires).toISOString(),limits:this.publicLimits(config),publicAccess:true};
 }
 async authenticate(token,now=Date.now()){
  if(!token||token.length>200)throw classroomError('访客连接需要更新，请重试',401);const key='session:'+await digest(token),session=await this.store.get(key),config=await this.configuration();if(!config.enabled)throw classroomError('网站 AI 暂时关闭，请稍后再试',503);if(!session||session.kind!=='public'||session.expires<now||session.network!==await this.networkKey())throw classroomError('访客会话已过期或网络发生变化，请重新连接',401);return {key,session,config};
 }
 async isAuthorized(session,config){return !!(session.authorizedVersion&&config.authorizedPassword&&session.authorizedVersion===await digest(JSON.stringify(config.authorizedPassword)));}
 async authorize(token,password,now=Date.now()){
  const {key,session,config}=await this.authenticate(token,now);if(!config.authorizedPassword)throw classroomError('授权模式尚未设置密码',503);
  const rateKey='authorize:'+await this.networkKey()+':'+Math.floor(now/600000);
  await this.store.update(rateKey,old=>{if((old?.n||0)>=8)throw classroomError('密码尝试较频繁，请十分钟后再试',429);return {n:(old?.n||0)+1,expires:now+600000};});
  if(!await verifyPassword(password,config.authorizedPassword))throw classroomError('授权密码不正确',403);
  const version=await digest(JSON.stringify(config.authorizedPassword));await this.store.update(key,row=>({...row,authorizedVersion:version}));return this.usage(token);
 }
 async deauthorize(token){const {key}=await this.authenticate(token);await this.store.update(key,row=>{const next={...row};delete next.authorizedVersion;return next;});return this.usage(token);}
 async usage(token){const {session,config}=await this.authenticate(token),authorized=await this.isAuthorized(session,config),limits=this.publicLimits(config);if(authorized)for(const field of ['comments','plans','summaries','requests','commentsPerNetworkDay','plansPerNetworkDay'])limits[field]=null;return {expiresAt:new Date(session.expires).toISOString(),accessMode:authorized?'authorized':'visitor',authorizationAvailable:!!config.authorizedPassword,used:{comments:session.comments,plans:session.plans,summaries:session.summaries,requests:session.requests},limits,dailyCalls:config.dailyCalls,dailyTokens:config.dailyTokens};}
 async consume(token,kind,amount=1,now=Date.now()){
  const info=await this.authenticate(token,now),network=await this.networkKey(),authorized=await this.isAuthorized(info.session,info.config);
  await this.store.update('rate:'+network+':'+Math.floor(now/60000),old=>{if((old?.n||0)>=info.config.requestsPerMinute)throw classroomError('此网络操作较频繁，请一分钟后再试',429);return {n:(old?.n||0)+1,expires:now+120000};});
  if(!authorized&&['comments','plans'].includes(kind))await this.store.update('network:'+network+':'+publicDay(now),old=>{const row=old||{comments:0,plans:0},limit=kind==='comments'?info.config.commentsPerNetworkDay:info.config.plansPerNetworkDay;if(row[kind]+amount>limit)throw classroomError('此网络今日体验额度已用完，请明日再试',429);return {...row,[kind]:row[kind]+amount};});
  const field=kind,limit=({comments:info.config.commentsPerSession,plans:info.config.plansPerSession,summaries:info.config.summariesPerSession})[kind];if(limit===undefined)throw classroomError('操作类型无效');
  await this.store.update(info.key,row=>{if(!row||row.expires<now)throw classroomError('访客会话已过期',401);if(!authorized&&(row.requests>=info.config.requestsPerSession||row[field]+amount>limit))throw classroomError('本次访客会话体验额度已达上限',429);return {...row,[field]:row[field]+amount,requests:row.requests+1};});return info;
 }
 async acquire(now=Date.now()){
  const c=await this.configuration(),id=crypto.randomUUID();await this.store.update('model-concurrency',old=>{const leases=(old?.leases||[]).filter(x=>x.expires>now);if(leases.length>=c.concurrency)throw classroomError('AI 正在处理其他访客的请求，请稍后重试',429);return {leases:[...leases,{id,expires:now+150000}]};});return id;
 }
 async release(id){await this.store.update('model-concurrency',old=>({leases:(old?.leases||[]).filter(x=>x.id!==id)}));}
 async reserve(tokens,now=Date.now()){
  const c=await this.configuration(),key='budget:'+publicDay(now);await this.store.update(key,old=>{const row=old||{calls:0,tokens:0};if(!c.enabled||row.calls>=c.dailyCalls||row.tokens+tokens>c.dailyTokens)throw classroomError('网站今日共享 AI 额度已用完，请明日再试',429);return {calls:row.calls+1,tokens:row.tokens+tokens};});return {key,reserved:tokens};
 }
 publicLimits(c){return {...super.publicLimits(c),requestsPerMinute:c.requestsPerMinute,commentsPerNetworkDay:c.commentsPerNetworkDay,plansPerNetworkDay:c.plansPerNetworkDay,concurrency:c.concurrency};}
 async adminUpdate(input){const current=await this.configuration(),next={...current,enabled:typeof input.enabled==='boolean'?input.enabled:current.enabled};delete next.password;delete next.version;if(input.authorizedPassword){next.authorizedPassword=await passwordRecord(input.authorizedPassword);}if(input.disableAuthorization===true)delete next.authorizedPassword;for(const key of Object.keys(publicDefaults).filter(k=>!['enabled','sessionHours'].includes(k))){const n=Number(input[key]??current[key]);if(!Number.isInteger(n)||n<0||n>10000000)throw classroomError('限额必须为非负整数');next[key]=n;}await this.store.put('settings',next);return {ok:true,enabled:next.enabled,limits:this.publicLimits(next)};}
}
