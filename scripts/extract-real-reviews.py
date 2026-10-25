"""Reproducible extraction from CC BY 4.0 research PDF; no generated reviews."""
import re, json, hashlib
from pathlib import Path

base = Path(__file__).resolve().parents[1]
text = (base / 'research/source.txt').read_text(encoding='utf-8')
body = '\f'.join(text.split('\f')[:36])  # Chinese originals only, never translations
sections = [(2,'中国工业博物馆','7913346'),(8,'中国铁道博物馆（正阳门展馆）','4874'),(17,'云南铁路博物馆','5429762'),(26,'北京汽车博物馆','22071')]
pattern = re.compile(r'^LV\.[^\n]*?star\d[^\n]*\n(.*?)(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}:\d{2}',re.M|re.S)
rows,seen,rejected = [],set(),[]
for i,m in enumerate(pattern.finditer(body),1):
    page=body[:m.start()].count('\f')+1
    end_page=body[:m.end()].count('\f')+1
    section=next(s for s in reversed(sections) if s[0]<=page)
    raw=m.group(1)
    if 'LV.' in raw or 'Source:' in raw:
        rejected.append(i);continue  # Never combine reviews on ambiguous boundaries
    raw=re.sub(r'\n\s*\d+\s*(?=\n|\f)', '',raw)
    raw=raw.replace('\f','')
    content=re.sub(r'\s*\n\s*','',raw).strip()
    content=re.sub(r'\b1[3-9]\d{9}\b','[手机号已移除]',content)
    content=re.sub(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}','[邮箱已移除]',content)
    digest=hashlib.sha256(content.encode()).hexdigest()
    if digest in seen or len(content)<8:continue
    seen.add(digest)
    rows.append(dict(id=f'FS21677282-{i:03}',platform='马蜂窝（研究转录）',date=m.group(2),text=content,source='Figshare · 博物馆历史评论',analyzed=True,kind='visitor-review',museumName=section[1],sourceUrl=f'https://www.mafengwo.cn/poi/{section[2]}.html',evidenceUrl=f'https://ndownloader.figshare.com/files/38433161#page={page}',datasetUrl='https://doi.org/10.6084/m9.figshare.21677282',sourcePage=page,sourceEndPage=end_page,sourceRow=i,collectedAt='2026-10-25',license='CC BY 4.0',attribution='Juan Manuel Cano Sanchiz (2022), Comments posted by Chinese (Mafengwo) and foreign (TripAdvisor) visitors',provenance='公开研究附件中的中文原评转录；未独立验证原平台作者身份；移除昵称、合并换行、去重',textHash=digest))
out=base/'dist/real-reviews.json'
out.write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
(base/'dist/real-reviews.js').write_text('export const posts='+json.dumps(rows,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
manifest={'dataset':'Comments posted by Chinese (Mafengwo) and foreign (TripAdvisor) visitors','doi':'10.6084/m9.figshare.21677282','author':'Juan Manuel Cano Sanchiz','published':'2022-12-06','retrieved':'2026-10-25','license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','sourceFile':'https://ndownloader.figshare.com/files/38433161','sha256':hashlib.sha256((base/'research/source.pdf').read_bytes()).hexdigest(),'records':len(rows),'rejectedAmbiguous':rejected,'transformations':['只提取 PDF 第 2—36 页中文原文','剔除含多个评论头或跨章节边界不明确的记录','删除等级、昵称与评分头','合并 PDF 换行，删除页脚数字','文本哈希去重，去掉少于8字条目','脱敏手机号及邮箱；未改写或生成评论'],'limitations':['历史、非随机便利样本，不代表平台总体或当前需求','原平台链接为景点页面；逐条证据以 PDF 页码和记录序号定位','只使用作者公布的中文原文部分，不导入英文机器翻译或重复评论','数据集标注的许可不能独立证明每位评论者的授权，商业复用需另行核查']}
(base/'dist/provenance.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'records':len(rows),'rejected':rejected,'perMuseum':{s[1]:sum(r['museumName']==s[1] for r in rows) for s in sections}},ensure_ascii=True))
