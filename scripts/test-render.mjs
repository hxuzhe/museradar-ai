import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
for(const page of ['overview','dna','social','analysis','insights','studio']){
 const app={innerHTML:''};globalThis.location={hash:'#'+page,href:'https://museradar.example/'};globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
 globalThis.document={querySelector:s=>s==='#app'?app:null,querySelectorAll:()=>[]};globalThis.window={addEventListener:()=>{}};
 await import('../dist/app.js?render='+page);
 assert.ok(app.innerHTML.includes('真实评论'));
 assert.ok(!app.innerHTML.includes('Demo Data'));
 assert.ok(!app.innerHTML.includes('S001'));
 assert.ok(!app.innerHTML.includes('undefined'));
 if(page==='social')assert.ok(app.innerHTML.includes('256 条 / 4 家博物馆'));
 if(page==='analysis')assert.ok(app.innerHTML.includes('原文来源与边界'));
 for(const [,action] of app.innerHTML.matchAll(/data-action="([^"]+)"/g)){if(!action.startsWith('kpi'))assert.ok(source.includes("case '"+action+"':"),'Missing action handler: '+action);}
 console.log('PASS template and action coverage:',page,app.innerHTML.length);
}
