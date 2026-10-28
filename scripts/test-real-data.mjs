import assert from 'node:assert/strict';
import {resources,posts as initialPosts} from '../dist/data.js';
import {posts} from '../research/legacy-fixtures/real-reviews.js';
assert.equal(initialPosts.length,0,'the product starts without bundled historical reviews');
import {analyze,defaults} from '../dist/engine.js';
import {safeUrl,dedupe,fetchPublicComments} from '../dist/sources.js';
assert.equal(posts.length,256);
assert.equal(new Set(posts.map(p=>p.textHash)).size,256);
for(const post of posts){assert.ok(post.sourcePage&&post.sourceUrl&&post.datasetUrl&&post.date);assert.equal(post.kind,'visitor-review');assert.ok(!post.text.includes('LV.'));assert.ok(!post.text.includes('\uFFFD'));const result=analyze(post,resources);assert.ok(['已经参观','历史评论/到访待核实'].includes(result.intent));assert.equal(result.high,false);assert.equal(result.values[2],null);}
assert.equal(analyze(posts[0],resources,[0,0,0,0,0]).score,null);
assert.equal(analyze(posts[0],[]).matches.length,0);
assert.deepEqual(defaults,[25,30,15,20,10]);
assert.equal(dedupe(posts.slice(0,5),posts).duplicates,5);
assert.equal(safeUrl('javascript:alert(1)'),'');
assert.equal(safeUrl('https://example.com/evidence'),'https://example.com/evidence');
await assert.rejects(fetchPublicComments({query:'museum',fetchImpl:async()=>{throw Error('network unavailable');}}),/network unavailable/);
await assert.rejects(fetchPublicComments({query:'museum',fetchImpl:async()=>({ok:false,status:503})}),/503/);
const empty=await fetchPublicComments({query:'museum',fetchImpl:async()=>({ok:true,json:async()=>({hits:[],nbPages:0,nbHits:0})})});assert.equal(empty.items.length,0);
console.log('PASS: 256 source-backed records; historical exclusion; missing evidence; zero weights; dedupe; safe links; network failure never produces fallback comments.');
