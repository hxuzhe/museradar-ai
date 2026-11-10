import assert from 'node:assert/strict';
import {createClassroomWorker} from '../server/classroom-worker.mjs';
import {MemoryClassroomStore} from '../server/classroom-auth.mjs';
import {AIClient} from '../dist/ai-client.js';
import {loadWorkspace,saveWorkspace} from '../dist/storage.js';
import {museum,resources} from '../dist/data.js';

const sent=[];
const store=new MemoryClassroomStore();
const worker=createClassroomWorker({store,fetchImpl:async(url,options)=>{
  sent.push([String(url),options.headers.Authorization]);
  return {ok:true,json:async()=>({choices:[{message:{content:'{"results":[]}'}}]})};
}});
const env={PUBLIC_ACCESS:'1',MODEL_API_KEY:'unusable-guest-test-key',SESSION_SALT:'test',PERSONAL_AI_ENCRYPTION_KEY:'1a'.repeat(32)};
async function post(path,input,token=''){
  const response=await worker.fetch(new Request('https://test.example/api/'+path,{
    method:'POST',headers:{'cf-connecting-ip':'test-network',Authorization:'Bearer '+token},
    body:JSON.stringify(input)
  }),env);
  return {status:response.status,data:await response.json()};
}
const pin='064973';
assert.equal((await post('personal/register',{username:'wrong',password:pin})).status,400);
assert.equal((await post('personal/register',{username:'hxz1103',password:pin})).status,409);
const alice=await post('personal/register',{username:'AbC0123',password:pin});
assert.equal(alice.status,201);
assert.equal(alice.data.username,'abc0123');
assert.equal((await post('personal/register',{username:'abc0123',password:pin})).status,409);
assert.equal((await post('personal/login',{username:'abc0123',password:'890123'})).status,401);
const bob=await post('personal/register',{username:'def0123',password:pin});
assert.equal(bob.status,201);
const keyFor=suffix=>'sk-'+'FakeKeyTestOnly'.repeat(2)+suffix;
const input={posts:[{id:'test',text:'museum',kind:'public-discussion'}],museum,resources};
assert.equal((await post('analyze',input,alice.data.token)).status,409);
for(const [profile,suffix] of [[alice.data,'0001'],[bob.data,'0002']]){
  const updated=await post('personal/key',{key:keyFor(suffix)},profile.token);
  assert.equal(updated.status,200);
  assert.equal(updated.data.tail,suffix);
  assert.equal(JSON.stringify(await store.get('personal-user:'+profile.username)).includes(keyFor(suffix)),false);
  assert.equal(JSON.stringify(updated.data).includes(keyFor(suffix)),false);
  assert.equal((await post('analyze',input,profile.token)).status,200);
}
assert.deepEqual(sent.map(([,key])=>key),['Bearer '+keyFor('0001'),'Bearer '+keyFor('0002')]);
assert.ok(sent.every(([url])=>url.startsWith('https://api.deepseek.com/')));
const login=await post('personal/login',{username:'ABC0123',password:pin});
assert.equal(login.status,200);
assert.equal(login.data.id,alice.data.id);
assert.equal((await post('personal/logout',{},login.data.token)).status,200);
assert.equal((await post('analyze',input,login.data.token)).status,401);
assert.equal(sent.length,2);

const client=new AIClient('https://test.example',login.data.token);
client.publicAccess=true;
client.personalAccount=login.data;
const originalFetch=globalThis.fetch;
let requests=0;
globalThis.fetch=async(url,options)=>{
  requests++;
  return worker.fetch(new Request(url,options),env);
};
try{await assert.rejects(client.analyze(input.posts,resources,museum),{status:401});}
finally{globalThis.fetch=originalFetch;}
assert.equal(requests,1,'personal 401 must never open a guest session');

const local=new Map();
globalThis.localStorage={getItem:key=>local.get(key),setItem:(key,value)=>local.set(key,value)};
await saveWorkspace({posts:['guest']});
assert.equal(await loadWorkspace(alice.data.id),null);
await saveWorkspace({posts:['alice']},alice.data.id);
assert.deepEqual(await loadWorkspace(),{posts:['guest']});
assert.equal(await loadWorkspace(bob.data.id),null);
assert.deepEqual(await loadWorkspace(alice.data.id),{posts:['alice']});
console.log('PASS personal AI: credential isolation, hashed PIN, expired/revoked auth, no guest fallback and workspace separation. Stub only.');
