import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {posts} from '../dist/data.js';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),source=readFileSync(new URL('../dist/workspace.js',import.meta.url),'utf8'),data=readFileSync(new URL('../dist/data.js',import.meta.url),'utf8');
assert.ok(html.includes('./workspace.js'));assert.ok(!html.includes('src="./app.js'));assert.equal(posts.length,0);assert.ok(!data.includes("from './real-reviews.js'"));assert.ok(!source.includes("case 'samples':"));assert.ok(!source.includes("case 'history-demo':"));assert.ok(source.includes('删除任务及评论'));
console.log('PASS current entrypoint: zero preloaded comments, no historical dataset import or reload actions, task deletion available.');
