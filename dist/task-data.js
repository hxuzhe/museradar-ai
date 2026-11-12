const textKey=p=>p.text.trim().replace(/\s+/g,' ').toLowerCase();
const isHistorical=p=>p.kind==='visitor-review'||/^FS21677282-/.test(p.id)||/Figshare/i.test(p.source||'');
function prune(state,removed){
 const ids=new Set(removed);state.posts=state.posts.filter(p=>!ids.has(p.id));
 for(const name of ['assessments','reviews','errors'])for(const id of ids)delete state[name]?.[id];
 state.audit=(state.audit||[]).filter(row=>!ids.has(row.id));
 for(const [id,plan]of Object.entries(state.plans||{}))if((plan.memberIds||[]).some(member=>ids.has(member)))delete state.plans[id];
 if(removed.length){state.aiTask=null;state.selectedGroup='';}
 for(const task of state.tasks||[])if(task.postIds)task.postIds=task.postIds.filter(id=>!ids.has(id));
}
const retiredSources=new Set(['hn','se-travel','se-history','HN Search','Hacker News','Travel Stack Exchange','History Stack Exchange']);
export function removeRetiredCommunityData(state){
 const removed=state.posts.filter(post=>post.kind!=='imported'&&post.kind!=='manual'&&(
  retiredSources.has(post.sourceId)||retiredSources.has(post.source)||retiredSources.has(post.platform)||/^(?:HN-\d+|SE-(?:travel|history)-\d+)$/.test(post.id)
 )).map(post=>post.id);
 if(removed.length)prune(state,removed);
 const retiredTasks=new Set((state.tasks||[]).filter(task=>retiredSources.has(task.source)).map(task=>task.id));
 if(retiredTasks.size)state.tasks=state.tasks.filter(task=>!retiredTasks.has(task.id));
 if(retiredTasks.has(state.filters?.taskId))delete state.filters.taskId;
 if(retiredSources.has(state.filters?.source))delete state.filters.source;
 return removed.length;
}
export function prepareTaskData(state){
 const removed=state.posts.filter(isHistorical).map(p=>p.id);prune(state,removed);state.tasks||=[];
 for(const task of state.tasks){if(Array.isArray(task.postIds))continue;
  const terms=(task.query||'').toLowerCase().split(/\s+/).filter(Boolean);
  task.postIds=state.posts.filter(p=>p.kind==='public-discussion'&&p.sourceId===task.source&&(!task.from||p.date>=task.from)&&(!task.to||p.date<=task.to)&&(!p.collectedAt||!task.createdAt||p.collectedAt>=task.createdAt)&&(task.source!=='hn'||terms.every(term=>(p.text+' '+(p.threadTitle||'')).toLowerCase().includes(term)))).map(p=>p.id);
  task.membership='legacy-estimated';
 }
 for(const p of state.posts)if(!state.tasks.some(t=>t.postIds.includes(p.id)))p.retainedOutsideTasks=true;
 if(!state.liveDataOnly){state.filters={};state.scopeDays=90;state.includeHistory=false;state.liveDataOnly=true;}
 return removed.length;
}
export function attachTaskRows(task,incoming,allPosts){
 const byId=new Map(allPosts.map(p=>[p.id,p])),byText=new Map(allPosts.map(p=>[textKey(p),p])),ids=new Set(task.postIds||[]);
 for(const row of incoming){const canonical=byId.get(row.id)||byText.get(textKey(row));if(canonical)ids.add(canonical.id);}
 return {...task,postIds:[...ids],membership:task.membership==='legacy-estimated'?'legacy-estimated':'exact'};
}
export function taskRemoval(state,id){
 const task=state.tasks.find(t=>t.id===id);if(!task)return {removedIds:[],shared:0};const others=new Set(state.tasks.filter(t=>t.id!==id).flatMap(t=>t.postIds||[])),members=new Set(task.postIds||[]),rows=state.posts.filter(p=>members.has(p.id));
 return {removedIds:rows.filter(p=>!others.has(p.id)&&!p.retainedOutsideTasks).map(p=>p.id),shared:rows.filter(p=>others.has(p.id)||p.retainedOutsideTasks).length};
}
export function deleteTask(state,id){const result=taskRemoval(state,id);state.tasks=state.tasks.filter(t=>t.id!==id);prune(state,result.removedIds);if(state.filters?.taskId===id)delete state.filters.taskId;return result;}
