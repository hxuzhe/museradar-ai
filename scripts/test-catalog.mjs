import assert from 'node:assert/strict';
import {parseExhibits} from '../dist/catalog-ui.js';
import {catalogCandidates} from '../dist/opportunity.js';
import {validateAssessment} from '../dist/domain.js';
import {createClassroomWorker} from '../server/classroom-worker.mjs';
import {MemoryClassroomStore} from '../server/classroom-auth.mjs';

const {added,errors}=parseExhibits('名称,年代,类别,详细介绍,馆藏编号,别名\n铜镜,汉代,青铜器,"Bronze mirror, bird motif",001,mirror\n铜镜,汉代,青铜器,青铜纹样,001,',[]);
assert.equal(added.length,1);
assert.equal(errors.length,1);
assert.match(added[0].keywords,/bronze/);
const post={id:'review',text:'How was the bird motif made on this mirror?'};
const museum={name:'Example Museum'};
assert.equal(catalogCandidates([post],added)[0].id,added[0].id);
assert.equal(validateAssessment({level:6,sentiment:'中性',relevance:'相关',visitState:'未明确',theme:'工艺与制造技术',needs:['纹样工艺'],evidence:['bird motif'],reason:'对展品具体纹样好奇',uncertainties:[],resourceIds:[added[0].id]},post,added,museum).level,6);

const worker=createClassroomWorker({store:new MemoryClassroomStore()});
const env={PUBLIC_ACCESS:'1',SESSION_SALT:'test-salt',PERSONAL_AI_ENCRYPTION_KEY:'2a'.repeat(32)};
async function request(path,body,token=''){
 const response=await worker.fetch(new Request('https://example.test/api/personal/'+path,{
  method:body?'POST':'GET',headers:{Authorization:'Bearer '+token},
  ...(body?{body:JSON.stringify(body)}:{})
 }),env);
 return {status:response.status,data:await response.json()};
}
const first=(await request('register',{username:'abc1133',password:'097321'})).data;
const second=(await request('register',{username:'abc1134',password:'097321'})).data;
const id=crypto.randomUUID();
const image='data:image/png;base64,iVBORw0KGgo=';
assert.equal((await request('catalog/image',{id,image},first.token)).status,200);
const resources=[{...added[0],imageId:id},{id:'exhibition',name:'铜镜展',type:'展览',memberIds:[added[0].id]}];
assert.equal((await request('catalog',{version:0,catalog:{museum,resources}},first.token)).status,200);
const login=(await request('login',{username:'abc1133',password:'097321'})).data;
assert.deepEqual((await request('catalog',null,login.token)).data.catalog.resources,resources);
assert.equal((await request('catalog/image?id='+id,null,login.token)).data.image,image);
assert.equal((await request('catalog',null,second.token)).data.catalog,null);
assert.equal((await request('catalog/image?id='+id,null,second.token)).status,404);
assert.equal((await request('catalog',{version:0,catalog:{museum,resources}},first.token)).status,409);
console.log('PASS catalog CSV, score 6 evidence, cross-session catalog and image, account isolation and stale-write protection.');
