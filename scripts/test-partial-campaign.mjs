import assert from 'node:assert/strict';
import {museum,resources} from '../dist/data.js';
import {fingerprint,cohortScope} from '../dist/domain.js';
import {prepareTaskData} from '../dist/task-data.js';
import {curatedExampleIds} from '../dist/xhs-curated.js';
const posts=[
 {id:'analyzed',text:'好想看小克鼎',date:'2026-11-20',kind:'imported'},
 {id:'pending',text:'什么时候开放',date:'2026-11-20',kind:'imported'}
];
const saved={version:3,museum,resources,posts,mode:'ai',filters:{},assessments:{
 analyzed:{mode:'ai',level:4,sentiment:'正面',relevance:'相关',visitState:'未来需求',theme:'历史文化',matchStatus:'matched',resourceIds:[resources[0].id],evidence:['好想看小克鼎'],needs:[],reason:'想到访',fingerprint:fingerprint(posts[0],resources,museum)}
},reviews:{},tasks:[],plans:{},scopeDays:365,includeHistory:false,audit:[]};
const scope=cohortScope(saved,{matchStatus:'matched'},365,false,Date.parse('2026-11-24'));
assert.equal(scope.pending.length,1);
assert.equal(scope.groups[0].members.length,1);
assert.deepEqual(scope.groups[0].coverage,{eligible:2,analyzed:1,pending:1});
const removedId=Array.from({length:7318},(_,i)=>i).find(i=>!curatedExampleIds.includes(i));
const migrated=structuredClone(saved);
migrated.posts.push({id:'XHS-EXAMPLE-'+curatedExampleIds[0],text:'保留示例'}, {id:'XHS-EXAMPLE-'+removedId,text:'移除旧示例'});
migrated.assessments['XHS-EXAMPLE-'+removedId]={};
migrated.plans.old={memberIds:['XHS-EXAMPLE-'+removedId]};
prepareTaskData(migrated);
assert.equal(migrated.posts.length,3);
assert.equal(migrated.plans.old,undefined);
assert.equal(curatedExampleIds.length,1000);
assert.equal(new Set(curatedExampleIds).size,1000);

const app={innerHTML:''};
globalThis.location={hash:'#studio',href:'https://hxuzhe.github.io/museradar-ai/'};
globalThis.localStorage={getItem:key=>key==='museradar-workspace-v3'?JSON.stringify(saved):null,setItem:()=>{}};
globalThis.document={querySelector:s=>s==='#app'?app:null,addEventListener:()=>{}};
globalThis.window={addEventListener:()=>{}};
await import('../dist/workspace.js?partial-campaign-test');
assert.match(app.innerHTML,/另有 1 条待处理/);
assert.match(app.innerHTML,/<button data-act="generate" class="primary" >/);
assert.ok(!app.innerHTML.includes('必须完成或人工排除后再生成'));
console.log('PASS partial campaign generation enabled, coverage and curated migration.');
