const enc=new TextEncoder();
export const classroomDefaults={sessionHours:4,commentsPerSession:30,plansPerSession:1,summariesPerSession:20,requestsPerSession:40,dailyCalls:100,dailyTokens:500000,enabled:true};
export function classroomError(message,status=400){const e=Error(message);e.status=status;return e;}
function b64(bytes){return btoa(String.fromCharCode(...bytes));}
function bytes(value){return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
export async function digest(value){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value)))).replace(/[^a-zA-Z0-9]/g,'');}
export function randomToken(){return b64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export async function passwordRecord(password){if(typeof password!=='string'||password.length<8||password.length>128)throw classroomError('课堂密码须为 8—128 个字符');const salt=b64(crypto.getRandomValues(new Uint8Array(24))),iterations=100000,key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']),hash=b64(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:bytes(salt),iterations},key,256)));return {salt,iterations,hash};}
export async function verifyPassword(password,record){if(typeof password!=='string'||password.length>128||!record?.hash||record.iterations!==100000)return false;try{const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']),got=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:bytes(record.salt),iterations:record.iterations},key,256)),want=bytes(record.hash);if(got.length!==want.length)return false;let diff=0;for(let i=0;i<got.length;i++)diff|=got[i]^want[i];return diff===0;}catch{return false;}}
export class ClassroomService {
 constructor(store,settings){this.store=store;this.settings=settings;}
 async configuration(){const stored=await this.store.get('settings');const base={...classroomDefaults,...this.settings(),...stored};base.version=await digest(JSON.stringify(base.password));return base;}
 async login(password,ip='unknown',now=Date.now()){
  const config=await this.configuration();if(!config.enabled)throw classroomError('课堂 AI 已关闭，请联系老师',403);if(!config.password)throw classroomError('课堂密码尚未配置，请联系老师',503);
  const ipKey='login:'+await digest(ip+Math.floor(now/600000)),failed=await this.store.get(ipKey);if(failed?.n>=8)throw classroomError('密码错误次数较多，请十分钟后再试',429);
  if(!await verifyPassword(password,config.password)){await this.store.update(ipKey,old=>({n:(old?.n||0)+1,expires:now+600000}));throw classroomError('课堂密码不正确，请重新输入',401);}
  const token=randomToken(),key='session:'+await digest(token),session={id:crypto.randomUUID(),createdAt:now,expires:now+config.sessionHours*3600000,version:config.version,comments:0,plans:0,summaries:0,requests:0};await this.store.put(key,session);return {token,expiresAt:new Date(session.expires).toISOString(),limits:this.publicLimits(config)};
 }
 publicLimits(c){return {comments:c.commentsPerSession,plans:c.plansPerSession,summaries:c.summariesPerSession,requests:c.requestsPerSession};}
 async authenticate(token,now=Date.now()){if(!token||token.length>200)throw classroomError('请先输入课堂密码登录',401);const key='session:'+await digest(token),session=await this.store.get(key),config=await this.configuration();if(!config.enabled)throw classroomError('课堂 AI 已关闭，请联系老师',403);if(!session||session.expires<now||session.version!==config.version)throw classroomError('登录已过期或课堂密码已更新，请重新登录',401);return {key,session,config};}
 async consume(token,kind,amount=1){const info=await this.authenticate(token),field=({comments:'comments',plans:'plans',summaries:'summaries'})[kind],limit=({comments:info.config.commentsPerSession,plans:info.config.plansPerSession,summaries:info.config.summariesPerSession})[kind];if(!field)throw classroomError('操作类型无效');await this.store.update(info.key,session=>{if(session.requests>=info.config.requestsPerSession||session[field]+amount>limit)throw classroomError('本次登录的课堂用量已达上限，请联系老师',429);return {...session,[field]:session[field]+amount,requests:session.requests+1};});return info;}
 async usage(token){const {session,config}=await this.authenticate(token);return {expiresAt:new Date(session.expires).toISOString(),used:{comments:session.comments,plans:session.plans,summaries:session.summaries,requests:session.requests},limits:this.publicLimits(config)};}
 async logout(token){if(token)await this.store.remove('session:'+await digest(token));return {ok:true};}
 async reserve(tokens,now=Date.now()){const config=await this.configuration(),key='budget:'+new Date(now).toISOString().slice(0,10);if(!Number.isFinite(tokens)||tokens<0)throw classroomError('用量估算无效');await this.store.update(key,old=>{const row=old||{calls:0,tokens:0};if(!config.enabled||row.calls>=config.dailyCalls||row.tokens+tokens>config.dailyTokens)throw classroomError('课堂今日共享额度已达上限，请联系老师',429);return {calls:row.calls+1,tokens:row.tokens+tokens};});return {key,reserved:tokens};}
 async settle(reservation,usage){const actual=usage?.total_tokens;if(Number.isFinite(actual)&&actual>=0)await this.store.update(reservation.key,old=>({...old,tokens:Math.max(0,old.tokens-reservation.reserved+actual)}));}
 async adminUpdate(input){const current=await this.configuration(),next={password:current.password,enabled:typeof input.enabled==='boolean'?input.enabled:current.enabled};for(const key of ['commentsPerSession','plansPerSession','summariesPerSession','requestsPerSession','dailyCalls','dailyTokens']){const n=Number(input[key]??current[key]);if(!Number.isInteger(n)||n<0||n>10000000)throw classroomError('限额必须为有效非负整数');next[key]=n;}if(input.password)next.password=await passwordRecord(input.password);await this.store.put('settings',next);return {ok:true,enabled:next.enabled,limits:this.publicLimits({...current,...next})};}
}
export class MemoryClassroomStore {
 constructor(){this.rows=new Map();this.tail=Promise.resolve();}
 async get(key){await this.tail;return structuredClone(this.rows.get(key)||null);}
 async put(key,value){return this.update(key,()=>value);}
 async update(key,fn){const task=this.tail.then(()=>{const value=fn(structuredClone(this.rows.get(key)||null));this.rows.set(key,structuredClone(value));return value;});this.tail=task.catch(()=>{});return task;}
 async remove(key){await this.update(key,()=>null);}
}
