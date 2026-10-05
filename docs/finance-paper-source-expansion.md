# 经济学论文信源扩展与验收

核查及验收日期：2026-10-04（上海时间）。本轮新增 21 个发布流：9 个原始研究发布或存储流，以及同一 Crossref 平台按 12 个期刊 ISSN 划分的书目流。前者来自上财期刊社、IAB、DIW、ADB、加拿大央行和 arXiv 共 6 个机构或存储平台；不能把系列数、期刊数当成独立一手机构数。

21 个新流首次实采均为 `health=ok`，新增待处理材料 111 条。逐篇核对后公开 16 条中文导读，论文公开量由 14 条增至 30 条；Crossref 和 DIW 本批仅保留待审书目。原有 8 个论文流继续保留，其维护说明见[经济学论文信源与维护边界](finance-economics-paper-sources.md)。

本站只核对官方书目与公开摘要，未下载或阅读论文 PDF、复算结果、审查全部推导或验证因果识别。工作论文、预印本、正式期刊文章分别标明；央行或国际机构发布的作者研究不直接视为机构政策立场。本轮没有模型调用、付费服务或推送，新增导读均为 `selected=false`，首页精选维持原有 7 条。

## 原始研究发布流

9 个流均为 `sourceDimension=research`、`first_party=true`，每日检查一次（`interval_minutes=1440`）。下表窗口是本次官方响应的条数，不代表完整历史或固定数量；首次上限限制初次回填，不是长期每日采集额度。实际运行设置以「更多 → 信息源」中的数据库配置为准。

| 来源 / 稳定 ID | 官方入口、论文类型与主要覆盖 | 实测列表窗口 / 首次上限 | 日期、作者与额外读取范围 |
| --- | --- | --- | --- |
| 财经研究 · `sufe-finance-economics-journal` | [官方 RSS](https://qks.sufe.edu.cn/J/CJYJ/RSSRecent/CN)；正式期刊文章，中国经济、劳动、公共财政、贸易及产业研究 | 11 条 / 最多 12 条，近 12 个月 | 使用逐篇 RSS `pubDate`，本批可与详情引用日期核到日。标题含订阅前缀时仅补详情标题，每次最多 20 条。RSS 未自动提供完整作者栏，公开样本逐篇核对作者。 |
| 外国经济与管理 · `sufe-foreign-economics-management-journal` | [官方 RSS](https://qks.sufe.edu.cn/J/WJGL/RSSRecent/CN)；正式期刊文章，企业财务、审计、技术创新、就业与跨国经营 | 原始 7 条，标题过滤后 4 条 / 最多 12 条，近 12 个月 | 日期、作者、标题补充同上。管理类内容混杂，仅保留配置中企业、审计、财务、技术创新、就业、人力与产业等关键词命中的候选，命中仍需内容复核。 |
| 上海财经大学学报 · `sufe-journal-economics` | [官方 RSS](https://qks.sufe.edu.cn/J/CDXB/RSSRecent/CN)；正式期刊文章，中国经济、劳动、财政和产业发展 | 10 条 / 最多 12 条，近 12 个月 | 日期、作者、标题补充同上。3 个期刊属于同一上财期刊社，分别维护发布流。 |
| 德国 IAB · `iab-labor-discussion-papers` | [官方讨论论文目录](https://iab.de/en/publications/iab-publications/iab-discussion-paper-en/)；劳动经济学工作论文，就业、劳动力供需与劳动市场政策 | 19 条 / 最多 6 条，近 12 个月 | 详情预算最多 20 条，从单篇 `ScholarlyArticle` 的 `datePublished` 补日级日期，排除网页模板日期；自动仅补书目，完整作者及导读人工核对。 |
| 德国 DIW Berlin · `diw-economics-discussion-papers` | [官方讨论论文目录](https://www.diw.de/en/diw_01.c.620265.en/publications/discussion_papers.html)；宏观、劳动、公共经济与计量工作论文 | 20 条 / 最多 8 条，近 12 个月配置 | 本批列表只有年份，发布日期保持未知；没有详情循环或自动摘要。未知日期不证明属于近 12 个月，本批不公开导读。 |
| 亚洲开发银行 · `adb-economics-working-papers` | [官方经济学工作论文目录](https://www.adb.org/publications/series/economics-working-papers)；亚洲发展、劳动、分配、贸易与家庭经济 | 10 条 / 最多 6 条，近 12 个月 | 列表提供日级日期，不保留模板时钟；自动仅书目，作者、单篇许可和导读人工核对。 |
| 加拿大央行 · `bank-canada-working-papers` | [官方工作论文 RSS](https://www.bankofcanada.ca/content_type/working-papers/feed/)；宏观、国际贸易、劳动、货币及计量研究 | 10 条 / 最多 6 条，近 12 个月 | RSS 发布时间可用，不据此推断初稿时间。作者位于专属 `cb:paper` 元数据，通用 RSS 作者栏未完整解析；本批公开样本人工核全作者。 |
| 加拿大央行 · `bank-canada-analytical-papers` | [官方分析论文 RSS](https://www.bankofcanada.ca/content_type/staff-analytical-paper/feed/)；经济金融分析论文，宏观、模型与金融研究 | 10 条 / 最多 6 条，近 12 个月 | 日期、作者处理同上；保留分析论文系列身份，不归作新出台政策或常规统计数据表。 |
| arXiv · `arxiv-economics-preprints` | [官方 Atom API](https://export.arxiv.org/api/query?search_query=cat:econ.EM+OR+cat:econ.GN&sortBy=submittedDate&sortOrder=descending&start=0&max_results=40)；`econ.EM`、`econ.GN` 计量与一般经济学预印本 | 最新 40 条 / 最多 6 条，近 3 个月 | 读取完整作者、首次提交和修订日期；论文身份去除 URL 的 `vN`，具体版本地址保留在官方元数据中。此分类查询不等于全部经济学或全部量化金融论文。 |

上财 RSS 的频道日期表示订阅生成时间，不能代替逐篇日期；期刊出版日期与在线发布日期分别记录，不猜哪一个是初稿日期。订阅中历史 HTTP 原文链接只对已核验的上财路径转换为 HTTPS，保留独立论文地址；不拼造论文详情链接。3 刊自动详情读取仅用于清理标题，不提取正文。

网页来源当前只读一个列表窗口；RSS 只读上游当前返回窗口。没有翻页扫描完整历史，窗口之外的旧论文或修订可能漏收。缺失作者、日期或摘要时保留未知，不用采集时间、页面模板日期或列表顺序补齐。

## Crossref 期刊书目

12 个流统一为 `sourceDimension=processed`、`first_party=false`、`tier=T2`。Crossref 是出版社提交书目的登记与分发平台，不是这些论文的作者或原始出版方。[官方 REST API 文档](https://www.crossref.org/documentation/retrieve-metadata/rest-api/)说明公开接口无需注册，书目与摘要的权利范围也应分开处理。

| 期刊 | ISSN | 稳定来源 ID |
| --- | --- | --- |
| American Economic Review | 0002-8282 | `crossref-journal-aer` |
| The Quarterly Journal of Economics | 0033-5533 | `crossref-journal-qje` |
| Journal of Political Economy | 0022-3808 | `crossref-journal-jpe` |
| Econometrica | 0012-9682 | `crossref-journal-econometrica` |
| The Review of Economic Studies | 0034-6527 | `crossref-journal-restud` |
| American Economic Journal: Applied Economics | 1945-7782 | `crossref-journal-aej-applied` |
| Journal of Labor Economics | 0734-306X | `crossref-journal-jle` |
| Journal of Development Economics | 0304-3878 | `crossref-journal-jde` |
| China Economic Review | 1043-951X | `crossref-journal-china-econ` |
| Journal of Economic Perspectives | 0895-3309 | `crossref-journal-jep` |
| Journal of Financial Economics | 0304-405X | `crossref-journal-jfe` |
| The Journal of Finance | 0022-1082 | `crossref-journal-jf` |

各流使用 `api.crossref.org/journals/{ISSN}/works`，过滤 `type:journal-article`，按 `published` 倒序，每次 20 条、每日一次，首次最多 4 条、近 12 个月。保存标题、DOI、作者对象、期刊、出版社、出版日期、许可及 `relation`、`update-to` 等元数据；公开原文链接采用 DOI。正式配置不请求 `abstract`，也不自动访问 DOI 跳转后的出版社详情或 PDF。

`published.date-parts` 只有完整且合法的 `[年, 月, 日]` 才生成日期，仅年或年月、空值和不可能的日期均保持未知；不猜 1 月 1 日或当月 1 日。出版社提交的出版日期可能是未来期次安排，`created`、`deposited` 是书目登记或存入时间，不能代替论文出版日期。未知日期候选可以进入待审书目，但不能称作近期新论文。

标题过滤压低勘误、撤稿、目录、编委和作者须知等噪声，不能证明剩余条目一定是研究文章。保留更正、撤稿及版本关系供核对；每条正式公开前仍需确认论文类型、作者、出版状态、原文许可与摘要。本批 12 流的材料均未公开为中文导读。

## 日期、版本与核验

arXiv 官方 API 的专属语义只在 `export.arxiv.org/api/query` 生效，不将第三方 Atom 订阅视为官方首次提交记录。官方条目的 `published` 表示首次提交，`updated` 表示最新修订，两者分开保存；首次提交缺失时不拿修订日期补齐。现代及旧式论文编号的 `/abs/` 版本 URL 去掉 `vN` 后判重，同一来源再次观察到的 `officialMetadata` 会刷新版本地址、完整作者及修订日期，避免多版本重复或旧元数据停留。[arXiv API 手册](https://info.arxiv.org/help/api/user-manual.html)

当前 arXiv 查询按首次提交时间取最新 40 条，旧论文在窗口之外的修订未必被发现。官方元数据刷新不等于已经重新阅读摘要，也不自动更新公开导读的核验范围；改动研究结论、作者或方法的版本须人工复核。

导读逐篇注明核对时间和「官方书目与公开摘要，未读全文」，保留作者、原题、原文链接、论文编号或 DOI。摘要说明研究对象、样本时期、方法、作者结论与适用范围；模型模拟、预测和反事实标为估算，作者解释标为观点，历史样本不能改写成当前经济数据。机构身份不决定研究地域，经济学论文标签也不把普通讲话、新闻、数据表或营销材料变成论文。

## 使用范围与请求限制

全部 21 流关闭 `fetchPublicContent`、`site_fulltext` 和 `syndicate_fulltext`。RSS/Atom 提供的书目与短摘要、JSON 书目以及必要的 HTML 书目元数据属于本轮读取范围；没有下载、解析、保存或转发完整论文。IAB、DIW、ADB 的自动列表配置不保存原摘要，公开导读来自人工阅读单篇公开摘要后的自撰说明。每篇许可须单独核对，免费阅读或官方订阅入口不等于全文再发布许可。

| 来源 | 已核查的官方规则与本轮边界 |
| --- | --- |
| 上财期刊社 | [财经研究订阅说明](https://qks.sufe.edu.cn/J/CJYJ/RSS/CN)、[外国经济与管理订阅说明](https://qks.sufe.edu.cn/J/WJGL/RSS/CN)、[学报订阅说明](https://qks.sufe.edu.cn/J/CDXB/RSS/CN)提供官方订阅入口；RSS 与页脚保留版权。本轮只用书目、自撰短导读和原文链接。[外国经济与管理介绍](https://qks.sufe.edu.cn/J/WJGL/About/CN)的免费浏览下载说明不作为全文转载依据。`robots.txt` 本次返回 HTML 错误页，不能视为明确授权。 |
| IAB | [官方法律与使用说明](https://iab.de/en/legal-notices-and-terms/)与逐篇许可分开核查。本批两篇样本的 DOI 登记许可为 CC BY-SA 4.0（[2606](https://doi.org/10.48720/IAB.DP.2606)、[2605](https://doi.org/10.48720/IAB.DP.2605)），导读保留作者、原题、IAB、许可和改写归属，并按该许可维护；不外推整个系列同许可。 |
| DIW | [官方法律说明](https://www.diw.de/en/diw_01.c.623806.en/pages/legal_details.html)保留一般版权；本轮仅书目标题链接，不再分发原摘要。[robots](https://www.diw.de/robots.txt)对允许的目录要求 20 秒请求间隔，禁止的 SOEPpapers 路径未接入；当前每日一个列表请求，没有详情循环。后续同域请求须合并限速。 |
| ADB | [官方使用条款](https://www.adb.org/terms-use)区分 CC BY 3.0 IGO、联合版权限制及保留版权材料，不能一概视为开放许可。本批[中国就业与不平等](https://www.adb.org/publications/more-jobs-widening-inequality-prc)、[吉尔吉斯共和国汇款与家庭韧性](https://www.adb.org/publications/remittances-household-resilience-kyrgyz-republic)单篇页面明确 CC BY 3.0 IGO；自撰导读保留作者、年份、原题、ADB、原文与许可，并说明属于非官方改写及责任范围。 |
| 加拿大央行 | [官方使用条款](https://www.bankofcanada.ca/terms/)允许在归属、修改说明、无背书等条件下使用央行拥有权利的内容；第三方材料、标志和钞票图像不据此授权。本轮书目及自撰短导读保留归属、改写说明和原文，不转载论文或标志，不绕过限速。 |
| arXiv | [官方 API 使用条款](https://info.arxiv.org/help/api/tou.html)允许程序读取描述性元数据，标题、摘要、作者等元数据采用 CC0；论文文件的版权与许可独立。API 要求全系统单连接、每 3 秒最多一次请求，本配置每日请求一次。`export.arxiv.org` 的 robots 禁止一般网页爬取，不能将专用 API 权限扩大为全站采集；如人工访问主站摘要页，另遵守主站 15 秒间隔。本轮不访问 PDF。 |
| Crossref | [官方 API 文档](https://www.crossref.org/documentation/retrieve-metadata/rest-api/)说明书目元数据一般可自由使用，但摘要可能有独立权利。本批正式查询排除摘要，仅登记书目；Crossref 元数据使用范围不授权采集或转发出版社论文。使用公开免费接口，未订阅付费 Metadata Plus。 |

## 本轮未接入的候选

| 候选 | 本次核查结果与未接入原因 |
| --- | --- |
| AEA 官网期刊 | [官网使用条款](https://www.aeaweb.org/terms-of-service/site)明确禁止机器人、爬虫及自动抓取内容；没有采集 AEA 官网论文。Crossref 登记书目是另一个平台的公开元数据来源，不据此获取 AEA 原摘要或论文。 |
| 纽约联储 Staff Reports | 旧 `staff_reports` 入口展示历史页面，不能当作当前发布流。[官方使用条款](https://www.newyorkfed.org/privacy/termsofuse)将 Staff Reports / Working Papers 限于个人或内部商业使用，禁止为商业目的分发；当前公开用途与逐篇边界仍需进一步核查，本轮未接。 |
| 旧金山联储 Working Papers | 声明的系列 RSS 本次为 404；网页书目可解析，但[站点使用规则](https://www.frbsf.org/site-policies/)的再发布许可排除以私人获利为目的的分发，第三方材料另核。技术可读不等于公开用途已经确认，本轮暂缓。 |
| 圣路易斯联储 Working Papers | 旧工作论文入口跳转至 Fed in Print 书目平台；尚需核查当前原始发布入口、身份与权利，不计作新的一手论文流。 |
| IFS / Cemmap | IFS 工作论文目录实测 403，未绕过；[IFS 版权说明](https://ifs.org.uk/copyright)的非商业许可不预设本站符合。Cemmap 目录可读，但[版权说明](https://cemmap.ac.uk/copyright/)涉及再发布许可；IFS/UCL 联合平台也不重复算作独立机构。 |
| IDOS | 专门讨论论文 RSS 实返混合类型并有重复域名链接；[官方法律说明](https://www.idos-research.de/en/legal-notice/)与单篇开放许可需分别处理，不把个别开放论文的许可外推整个订阅。 |
| 其他中国高校候选 | 清华部分目录只有 PDF 入口，缺少可直接核验的逐篇 HTML 作者与公开摘要；跨站 DOI/SSRN 材料尚未完成逐篇权利核查。人大部分请求连接失败，未关闭证书校验或绕过访问限制。未用年度成果汇总、新闻稿或旧存档凑成新增论文流。 |

其他上一轮候选和存档限制沿用[既有信源说明](finance-economics-paper-sources.md)。遇到验证码、登录限制、禁采规则或不明确的再发布范围，保持候选状态；不借代理、关闭 TLS 或替换身份绕过。

## 公开量与维护证据

本批公开的 16 条导读由上财 6 条、IAB 2 条、ADB 2 条、加拿大央行 4 条及 arXiv 2 条组成。原有 14 条论文导读逐栏保留，新增材料只在论文动态与对应主题中展示，精选标准、评分门槛和首页精选不变。

| 论文主题 | 验收时公开条数 |
| --- | --- |
| 宏观与货币 · `econ-macro` | 8 |
| 增长与生产率 · `econ-growth` | 8 |
| 就业与劳动 · `econ-labor` | 8 |
| 国际贸易 · `econ-trade` | 6 |
| 发展经济学 · `econ-development` | 6 |
| 计量方法 · `econ-econometrics` | 14 |

同一论文可关联多个主题，主题条数不能相加作为独立论文总量。验收时总信息源为 145 个，原有 124 个来源配置、78 个主题与 95 条公开内容逐栏未变，公开内容总量为 111 条；「新增待处理材料 111 条」与「公开总量 111 条」是两个独立计数，前者不等于全部已经公开。模型分析记录与付费回执均为 0。

私有核查产物位于 `.data/verification/papers-expansion-discovery/` 的 `china`、`labor-development`、`global-journals`、`crossref` 四组；保存配置、样本、官方响应路径及内容 hash、解析结果与许可核查证据。正式采集与公开验收保存在 `.data/verification/papers-expansion/public-proof.json`、`invariants.json`。这些文件不提交到仓库，不包含需要公开的凭证。

本轮类型检查、后端 653 项测试、网页 69 项测试、网页构建与站点 smoke 均通过。`health=ok` 只证明该次采集成功；目录旧、日期未知或近期无新论文须单独判断，不能包装为当日新研究。配置文件用于首次导入，已有来源不会被覆盖；修改频率、范围或许可时在管理页核实数据库设置，并重新试采与逐篇核对。
