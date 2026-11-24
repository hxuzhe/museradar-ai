import json,re,gzip,base64,sys
from pathlib import Path
rows=json.loads(Path(sys.argv[1]).read_text(encoding='utf8'))
patterns=[
(10,r'已经?预约|约好了|预约成功|买好票|已购票|已经?约了|准备.{0,8}去|打算.{0,8}去|计划.{0,8}去'),
(8,r'想去|想看|想参观|好想|一定要去|值得去|必去|带孩子|带娃|周末.{0,8}去'),
(5,r'怎么预约|如何预约|怎么进|如何进|能进去|可以进|能进吗|开放时间|几点|开门|闭馆|门票|讲解|预约|校外'),
(5,r'为什么|怎么做|如何制作|什么意思|什么年代|什么朝代|来历|好奇|想了解|铭文|小克鼎|蛋壳|黑陶|青铜|纹样'),
(4,r'请问|想问|想知道|求问|求解|文创|盖章|地铁|路线|停车|交通|参观|展品|文物')
]
candidates=[]
for i,r in enumerate(rows):
 t=r['text'].strip()
 if len(t)<6 or len(t)>450 or not r['date'] or not re.search(r'[\u4e00-\u9fff]',t):continue
 if re.search(r'私信|加微|加v|vx|代约|代预约|求赞|互关|置顶|带进|带入|谁带我|蹲|求带',t,re.I):continue
 if re.search(r'不想|不去|没兴趣|去不了|别去|不要去|不好看|不清楚|不知道|不记得',t):continue
 score=sum(w for w,p in patterns if re.search(p,t))
 if score<4:continue
 candidates.append((score,i,r))
bins={}
for x in sorted(candidates,key=lambda v:(-v[0],v[1])):
 bins.setdefault(x[2]['noteId'],[]).append(x)
picked=[]
while len(picked)<1000 and bins:
 for k in list(bins):
  picked.append(bins[k].pop(0))
  if not bins[k]:del bins[k]
  if len(picked)==1000:break
picked.sort(key=lambda x:x[1])
notes={r['noteId']:[r['noteTitle'],r['noteBody']] for _,_,r in picked}
payload=[[[r['text'],r['date'],r['noteId'],i] for _,i,r in picked],notes]
data=base64.b64encode(gzip.compress(json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode())).decode()
Path('server/xhs-curated.payload').write_text(data)
Path('dist/xhs-curated.js').write_text('export const curatedExampleIds='+json.dumps([i for _,i,_ in picked])+';\nexport const curatedExampleNotes='+str(len(notes))+';\n',encoding='utf8')
print('Eligible',len(candidates),'selected',len(picked),'notes',len(notes),'encoded',len(data))
