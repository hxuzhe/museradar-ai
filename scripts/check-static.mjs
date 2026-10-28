import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const names=await readdir(new URL('../dist/',import.meta.url));
for(const name of ['index.html','app.js','engine.js','data.js','sources.js','evidence-ui.js','style.css','workspace.js','workspace.css','collectors.js','domain.js','ai-client.js','storage.js','ai-setup.js','public-ai-config.js','public-ai-ui.js','owner-ui.js','wordcloud.js','task-data.js','ai-pacing.js'])assert.ok(names.includes(name),'Missing static asset: '+name);
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
assert.ok(html.includes('./workspace.js')&&html.includes('./style.css'));
assert.ok(!html.includes('localhost'));
const {posts}=await import('../dist/data.js');assert.equal(posts.length,0);
console.log('PASS: static deployment assets and empty initial dataset; online task comments only.');
