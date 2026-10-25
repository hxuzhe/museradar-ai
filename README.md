# MuseRadar AI · 真实评论版

MuseRadar 是一个可静态部署的中文观众需求工作台。当前使用真实公开研究评论和可按需查询的 HN 公开讨论；馆藏知识库仍为明确标注的虚构示例馆。分析仍为本地可解释规则，不是 LLM。

## 本次改进

读取参考站 https://signaldesk-tan3.onrender.com 的公开页面、app.js 与 client.js，借鉴公开来源读取、去重、证据复核与运行记录流程。没有获得或声称读取其完整服务器源码，也不依赖该站私有后端。

- 移除原 36 条编造评论、虚构平台样式与对应默认方案。使用新的浏览器存储键；旧版仅继承馆藏资料和资源，不继承评论。
- 内置 256 条中文真实历史评论，来自 4 家博物馆；离线可直接分析。
- 增加 HN Search 公开评论检索、原评时间筛选、50 条分页、去重与错误状态。没有中文博物馆实时平台 API；HN 为英文科技社区，不代表中国博物馆受众。
- 评论详情包含原始发布时间、采集时间、评论对象、原平台、研究 PDF 页码、记录序号、许可和处理说明。
- 人工复核可设为值得参考、暂不采用或待复核。暂不采用的内容不参与主题机会聚合；不篡改规则评分。
- 主题词云来自实际样本的词典命中条数，可以点击筛选。不是平台趋势。
- 营销方案使用当前筛选结果与原文来源，不将历史到访当成新观众意向。

## 评论来源与许可

Cano Sanchiz, Juan Manuel (2022). *Comments posted by Chinese (Mafengwo) and foreign (TripAdvisor) visitors*. Figshare. https://doi.org/10.6084/m9.figshare.21677282 。作者标注 CC BY 4.0，许可链接：https://creativecommons.org/licenses/by/4.0/ 。这是研究作者对已有平台评论的整理；系统未独立确认每位评论者的授权或身份，商业复用需进一步核查原平台及作者权利。

只提取 PDF 第 2—36 页的中文原评部分（马蜂窝），不混入英文机器翻译、TripAdvisor 部分或重复评论。4 家对象分别为中国工业博物馆、中国铁道博物馆正阳门展馆、云南铁路博物馆、北京汽车博物馆。每条原评日期以附件记录为准，数据采集日期为 2026-10-25；采集时间不替代发布时间。

处理：移除昵称/等级头；合并 PDF 换行；删除页脚数字；正文哈希去重；邮箱和手机号脱敏。没有改写、补写或翻译评论。景点链接不是逐条评论永久链接，单条证据请按附件 PDF 页码和记录序号核对。详细文件哈希、转换记录见 dist/provenance.json。研究原附件保留在 research/source.pdf。

复现：先用 pdftotext -layout research/source.pdf research/source.txt，再运行 python scripts/extract-real-reviews.py。输出 real-reviews.json、real-reviews.js、provenance.json。语法与业务检查运行 node scripts/test-real-data.mjs。

HN 实时入口：https://hn.algolia.com/api 。浏览器直接请求 search_by_date，仅取 comment 类型，排除招聘主题；移除 HTML、丢弃作者字段，保留原文链接、主题和时间；不作机器翻译。不缓存或打包第三方评论为内置数据，用户主动读取的数据只保存在当前浏览器。API 失败显示错误，不回退到编造评论。

## 分析口径

关键词主题和中英文词典匹配，非 Embedding；否定与意图规则可能误判。历史评论仅在原文有明确到访表达时标为已经参观，其余标为历史评论/到访待核实；无论出现“想去、推荐、值得”均不进入新观众高潜力名单。高潜力还要求公开讨论、有来源链接、原评在一年内、得分≥70、覆盖率≥70%、资源匹配且未被人工拒绝。手动文本、未核实导入不冒充真实公开来源。

默认五维权重 25/30/15/20/10。缺失维度不入分子分母；总权重为零时分数为空。时效依据实际运行日期；历史反馈不提供未来时间地点适配证据。需求信号分不是到访概率。机会指数：规模（30条封顶）20%、强度25%、契合25%、覆盖20%、预设执行便利10%。该指数仅供复核排序，不证明市场机会或当前宣传缺口。

历史评论只用于体验、教育内容及障碍的启发。原文提及的旧门票、旧开放时间等不是当前事实。所有跨馆资源匹配仍基于示例资源，需要针对真实馆重新核实。营销草稿为模板组合，A/B 面板为手工假设输入，不是实测投放。

## 导入 / 导出 / 部署

CSV/JSON 支持 id、text、date、platform、source、sourceUrl、evidenceUrl。text 必填，date 可空、有值时为有效 YYYY-MM-DD。只保留 http(s) 来源链接；导入标记为来源未核实，不接受文件自称已核验。额外身份字段丢弃；正文仍须导入者确认使用权限与脱敏。

localStorage 仅当前浏览器保留数据和复核，非数据库。真实 API 请求由用户触发；历史研究集是离线快照。可以导出样本、主题结果、方案和读取记录。

托管 dist/ 即可运行；没有构建依赖或 API Key。使用相对资源路径与 hash 路由，适合 GitHub Pages 仓库子路径。Sites 源码完整保留于本目录，可直接迁移，不依赖一键导出。后续真实中文平台授权采集、LLM、Embedding、数据库、密钥管理和多人协作仍需独立后端。

## GitHub → Render 部署

当前仓库： https://github.com/hxuzhe/museradar-ai （私有）

推荐部署为 Render Static Site。仓库内 render.yaml 已描述部署设置；也可以在 Render 的 New → Static Site 中选择本仓库。授权 Render GitHub App 时仅选择本仓库即可，无需开放其他仓库。

- Branch: main
- Build Command: npm run build
- Publish Directory: dist
- Environment Variables: 无需设置
- 费用：静态托管有免费额度；不要选择付费 Web Service 实例来运行本前端。

本版本无需安装依赖即可构建。npm run build 会运行真实数据与页面渲染检查，再验证部署资源完整性。npm run dev 可在本地预览。

全部 dist/ 文件沿用已有 MuseRadar 版本，迁移不改变界面、数据、评分或实时检索逻辑。网站换域名后，浏览器 localStorage 不会自动跨域迁移，因此原站上手动修改的馆藏、已保存方案、在线读取的评论和复核记录应先从原站导出；新站默认加载 256 条真实研究评论。

GitHub 仓库保留源码和来源附件。Render 只发布 dist/，不发布研究原 PDF、测试脚本、Git 历史或部署配置。Render 生成的实际 onrender.com 地址应以部署成功结果为准，不能仅凭服务名预先推断。

## 当前正式部署：GitHub Pages

按用户选择，现改为 GitHub Pages，不绑定 Render 支付卡。GitHub 已接受从此私有仓库启用 Pages。

网址： https://hxuzhe.github.io/museradar-ai/

main 分支更新后，Deploy MuseRadar to GitHub Pages 工作流先执行全部检查，再上传 dist 并部署。源码仓库保持私有，只有 dist 内网页资产通过网站公开。render.yaml 保留为未来可选配置，不代表已成功创建 Render 服务。

原 Render 尝试在支付卡身份验证处停止，没有绑定支付卡，也没有购买付费实例。本站使用与原 MuseRadar 相同的前端文件、256 条真实中文历史评论与 HN 公开检索；没有用 SignalDesk 的后端替换本项目逻辑。
