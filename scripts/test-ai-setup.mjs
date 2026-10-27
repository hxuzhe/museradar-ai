import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createApp,configFromEnv,validateModelSettings,callModel} from '../server/index.mjs';
import {saveModelSettings,loadModelSettings} from '../server/settings-vault.mjs';
const dir=await mkdtemp(join(tmpdir(),'museradar-setup-'));
const operator=randomBytes(24).toString('hex'),key='test-only-nonexistent-model-key';let calls=0;
const config={...configFromEnv({}),dataDir:dir,uiConfig:true,accessToken:operator};
const fake=async(url,options)=>{calls++;const request=JSON.parse(options.body);assert.equal(url.hostname,'api.deepseek.com');assert.equal(options.headers.Authorization,'Bearer '+key);assert.equal(request.model,'deepseek-flash');assert.equal(request.thinking.type,'disabled');return {ok:true,json:async()=>({choices:[{message:{content:'{"ok":true}'}}],usage:{total_tokens:18}})};};
const server=createApp(config,{fetchImpl:fake});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const request=(path,body,auth=true,headers={})=>fetch(base+path,{method:body?'POST':'GET',headers:{...(auth?{Authorization:'Bearer '+operator}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
try{
 let response=await request('/api/config',null,false);assert.equal(response.status,401);response=await request('/api/config',{base:'https://api.deepseek.com',model:'deepseek-flash',key});assert.equal(response.status,200);assert.equal(calls,0,'saving configuration never calls a paid model');const saved=await response.json();assert.equal(saved.saved,true);assert.equal(JSON.stringify(saved).includes(key),false);
 response=await request('/api/config');const publicConfig=await response.json();assert.equal(publicConfig.hasKey,true);assert.equal(JSON.stringify(publicConfig).includes(key),false);assert.equal(publicConfig.base,'https://api.deepseek.com');
 response=await request('/api/test-model',{});assert.equal(response.status,200);const tested=await response.json();assert.equal(tested.ok,true);assert.equal(tested.usage.total_tokens,18);assert.equal(calls,1);
 response=await request('/api/status',null,false);const status=await response.json();assert.equal(status.configured,true);assert.equal(status.verified,undefined,'configuration is not a claim of successful model test');
 response=await request('/api/config',{base:'https://api.deepseek.com',model:'deepseek-flash',key:''});assert.equal(response.status,200,'blank key retains existing key for the same provider');
 assert.throws(()=>validateModelSettings({base:'http://example.org',model:'x',key}),/HTTPS/);assert.throws(()=>validateModelSettings({base:'https://api.deepseek.com/chat/completions',model:'x',key}),/根地址/);assert.throws(()=>validateModelSettings({base:'https://example.org/?key=secret',model:'x',key}),/密钥/);
 for(const [code,text]of [[401,'API Key'],[402,'余额'],[404,'模型名'],[429,'限流']])await assert.rejects(callModel(config,'json','test',async()=>({ok:false,status:code})),new RegExp(text));
 config.uiConfig=false;response=await request('/api/config');assert.equal(response.status,403,'remote settings are disabled unless explicitly enabled');
 config.localSetup=true;
 response=await request('/api/local-session',null,false,{'Sec-Fetch-Site':'cross-site'});assert.equal(response.status,403,'cross-site cannot read local operator token');
 response=await request('/api/local-session',null,false,{'Sec-Fetch-Site':'same-origin'});assert.equal(response.status,200);assert.equal((await response.json()).token,operator);
 response=await fetch(base+'/');assert.equal(response.status,200);assert.ok(response.headers.get('content-type').includes('text/html'));assert.ok((await response.text()).includes('workspace.js'));
 response=await fetch(base+'/.local/model-settings.dpapi');assert.equal(response.status,404,'credentials are never served as static assets');
 if(process.platform==='win32'){await saveModelSettings({...config,maxTokens:10000});const sealed=await readFile(join(dir,'model-settings.dpapi'),'utf8');assert.equal(sealed.includes(key),false);const fresh={dataDir:dir};assert.equal(await loadModelSettings(fresh),true);assert.equal(fresh.key,key);}
}finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
console.log('PASS visual AI setup: authenticated opt-in config, no paid calls on save, real-test distinction, no secret echo, friendly errors, same-origin local bootstrap, static isolation, Windows encrypted settings when available. Test-only credentials never leave the stub.');
