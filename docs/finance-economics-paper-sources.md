# 经济学论文信源与维护边界

本页记录首批扩展。后续新增的 21 条追踪流、16 篇已核对导读及正式期刊书目边界，见 [经济学论文第二批扩展](finance-paper-source-expansion.md)。

核查日期：2026-10-04（上海时间）。本轮为「论文」增加 7 个发布流，补充宏观经济、国际金融、贸易、劳动、产业与微观经济研究。原有 BIS 亚洲办公室中国研究继续保留；全球 BIS 工作论文流扩大覆盖范围，两者可能收录同一论文，应按原文链接判重。

这些来源用于发现研究问题、方法和作者结论。工作论文不等于已经通过期刊同行评审；由央行或国际机构发布也不等于机构政策立场。本站的核对范围是官方书目信息与公开摘要，没有下载论文 PDF、审查全部推导、复算估计或验证因果识别。发布时明确写出这一范围。

## 本轮发布流

下表的窗口大小是本次实测结果，不是永久条数或完整历史。7 个来源的初始采集间隔均为 1440 分钟，即每日检查一次；实际运行以「更多 → 信息源」中数据库的当前设置为准。

| 来源与稳定 ID | 官方入口与主要覆盖 | 本次窗口 / 首次回填 | 日期与作者精度 |
| --- | --- | --- | --- |
| 美联储 FEDS · `fed-feds` | [官方 RSS](https://www.federalreserve.gov/feeds/feds.xml)：宏观、预测方法、劳动、产业投资和金融 | 15 条 / 最多 5 条，近 12 个月 | 使用 RSS `pubDate` 的订阅发布时间；详情页引用日期可交叉核对到日。作者出现在订阅摘要开头及详情引用元数据，通用 RSS 采集器未自动写入完整作者栏，公开样本逐篇核对。 |
| 美联储 IFDP · `fed-ifdp` | [官方 RSS](https://www.federalreserve.gov/feeds/ifdp.xml)：汇率、国际宏观、贸易、跨国企业、债券供需和跨境资本 | 15 条 / 最多 4 条，近 12 个月 | 日期与作者处理同 FEDS；订阅时间不证明研究首次完成或论文版本修订的具体时刻。 |
| BIS 全球工作论文 · `bis-working-papers` | [官方列表](https://www.bis.org/publications/working-paper)：全球失衡、货币传导、银行准备金、跨境信贷、稳定币与供给冲击 | 首列表 12 条 / 最多 4 条，近 12 个月 | 卡片与 `citation_publication_date` 提供日级日期；详情预算每次最多 20 条。作者在官方详情引用元数据中，公开样本人工核对全作者。 |
| NBER · `nber-economics-working-papers` | [官方 RSS](https://www.nber.org/rss/new.xml)：广义经济学工作论文，包括货币与定价、劳动、人力资本、产业和经济研究方法 | RSS 43 条 / 首次最多 4 条，近 6 个月 | RSS 不含 `pubDate`；从详情页 `citation_publication_date` 补日级日期，每次最多补 50 个新链接，已知链接不重复读取。完整作者在原订阅标题中；不能把标题作者自动视为已经核验的作者栏。 |
| 世界银行 PRWP · `worldbank-policy-research-papers` | [官方系列入口](https://www.worldbank.org/en/research/brief/world-bank-policy-research-working-papers)与[官方 JSON 列表接口](https://search.worldbank.org/api/v3/wds?format=json&docty_exact=Policy%20Research%20Working%20Paper&lang_exact=English&srt=docdt&order=desc&rows=10)：发展经济学、贸易、生产网络、劳动与公共政策；包含中国研究 | 按文件日期倒序的近期 10 条 / 首次最多 10 条，近 6 个月 | API `docdt` 是官方文件日期，公开样本再用 OKR `dc.date.issued` 核对到日，不能据此声称具体发文时刻。API 完整作者对象保存在 `raw.officialMetadata.authors`，公开作者逐篇核对。 |
| 北大经济学院 · `pku-econ-working-papers` | [官方工作论文目录](https://econ.pku.edu.cn/kxyj/gzlw/index.htm)：资产定价、资本配置、产业转型、劳动、环境与经济史 | 首列表 19 条 / 首次最多 6 条，近 12 个月 | 列表及详情提供官网发布日期；详情预算每次最多 20 条。样本作者取官方公开摘要页，不推断论文的初稿或修订日期。本次目录最新日期为 2026-02-14。 |
| 北大国发院存档 · `pku-nsd-working-papers` | [官方英文工作论文目录](https://en.nsd.pku.edu.cn/publications/workingpaper/index.htm)：金融科技、信贷、银行风险、劳动与发展研究 | 首列表 20 条 / 首次最多 3 条，近 48 个月 | 官网日级发布日期；详情预算每次最多 20 条。样本作者取官方公开摘要页。本次所见最新条目为 **2023-03-20**，作为存档来源维护。 |

来源目录里的「中国」可以表示来源覆盖中国研究，文章的地域标签必须根据实际研究对象判断。不能把 NBER、世界银行或中国高校的全部论文自动标为中国研究；中国作者或中国机构身份也不等于研究对象在中国。

### 日期缺失、近期窗口与存档

NBER 首次回填的 4 条与每次最多 50 次详情补充是两个不同限制。最终配置扩大了详情预算，只读新链接的 HTML 书目元数据，已知链接不重复读取；仍不访问 PDF 或提取论文正文。初次小预算测试留下的未补日期材料须逐条补查官方书目并留核对记录，不能直接公开为新发布。后续 RSS 仍可能返回 43 条或其他数量，超出详情预算或详情读取失败的新链接可能只有标题、作者文字、摘要和原文地址，日期应保持未知。不能把采集时间、首次发现时间或列表顺序写成论文发布日期，也不能借页面更新时间代替。

北大国发院的 2023 年论文保留原日期和「存档」名称。一次重新采集成功只表示存档入口仍可用，不表示出现 2026 年新研究。低频目录原文较旧也不自动等于采集失败；最近成功采集时间与最新论文日期分别查看。

目前网页来源只核验一个列表窗口，RSS 只提供上游当前返回的窗口，世界银行接口只取近期 10 条；均未做完整历史扫描。BIS 全球目录按工作论文卡片识别，允许已核验的官方 `/publications/` 原文路径，不能仅按 `working-paper-` 路径前缀过滤，因为部分有效论文使用其他官方路径。北大经济学院使用证书正常的 `econ.pku.edu.cn`，不关闭 TLS 校验去兼容另一个证书域名不匹配的地址。

## 采集、核对与公开

7 个流均作为 `research` 来源维度维护，`first_party` 表示原始研究发布方，和内容是否正确、是否同行评审及是否官方政策三个问题分开。符合正式论文边界的条目归 `papers`；再按研究内容关联主题，不能仅凭机构或 `research` 维度把普通调查、数据表、讲话或新闻转述归为论文。

本批配置统一关闭 `fetchPublicContent`、`site_fulltext` 和 `syndicate_fulltext`。采集器仅保存书目、订阅/API 提供的短摘要和必要的官方元数据；详情读取仅补标题、日期与短摘要，不提取或保存完整论文正文，也不把 PDF 抓取纳入任务。北大目录没有配置自动保存摘要，公开导读来自逐篇阅读官方摘要页后的人工整理。

公开条目保留作者、原文链接、论文编号或 DOI（核到时），并写清研究对象、样本时期、主要方法与结论的适用条件。模型预测、反事实、回归或结构估计标为估算；作者解释与主张按实际内容标为观点。历史研究数据不改写成当前经济统计，论文讨论政策不改写成政策已经实施。

人工核验记录绑定当前原文版本，核对时间是本站核对时间。普通编辑、自动采集成功或模型摘要不能自动产生「已核对原文」记录；该记录也只证明所述书目及公开摘要与发布方一致，不代表已经核验完整论文、复算结果或确认投资价值。首次采集材料和超出核对范围的后续材料进入待审，采集成功不等于自动公开。

### 来源使用范围

- 美联储：官网一般信息原则上可归属引用和分发，但单独标示的第三方材料有独立权利；本批仍只使用书目和短导读，不放开全文。[官方声明](https://www.federalreserve.gov/disclaimer.htm)
- BIS：有限摘录需归属 BIS，并同时满足不超过 400 个英文词和原出版物 10% 的边界。中文导读标明非官方、BIS 不保证译文完整准确，并链接原文；本批未抓 PDF。[官方条款](https://www.bis.org/about/terms-conditions)
- NBER：作者保有工作论文版权；官网说明归属明确的短摘录以不超过两段为限。公开的是本站自撰短摘要与链接，不能把可见摘要或 RSS 当作 PDF 下载及全文转载授权。[官方媒体与引用说明](https://www.nber.org/media)
- 世界银行：D&R 元数据由官方 API 提供，论文再按 OKR 的逐篇许可核对。当前两篇中国研究样本均为 CC BY 3.0 IGO，不能推断其他作品都是同一许可；保留全作者、年份、原标题、World Bank、handle 和许可，并附非官方中文摘要及责任说明。[API 与开放库说明](https://www.worldbank.org/en/access-to-information/disclosure)、[OKR 使用条款](https://www.worldbank.org/ext/en/legal/terms-conditions/open-knowledge-repository)
- 北大两个目录：官网保留版权，没有发现本站全文再分发授权；只使用书目、本站自撰短导读及官方原文链接，论文 PDF 留在官网阅读。[经济学院目录](https://econ.pku.edu.cn/kxyj/gzlw/index.htm)、[国发院目录](https://en.nsd.pku.edu.cn/publications/workingpaper/index.htm)

## 本轮未启用的候选来源

| 候选来源 | 当前未启用原因与后续条件 |
| --- | --- |
| IZA Discussion Papers | 2026-03-13 的 LISER 条款对超出明确允许范围的系统性提取、再分发和改编要求事先书面授权；免费可读不等于允许定期系统采集，取得相应授权前不启用。[官方条款](https://www.iza.org/terms-and-conditions-of-use) |
| ECB Working Papers | [官方 RSS](https://www.ecb.europa.eu/rss/wppub.html)可读取，但链接直接指向 PDF，缺少完整作者；官方条款对具名工作论文的全部或部分转载另要求事先书面授权。本批不复用摘要或取 PDF，后续需单独明确使用范围和元数据方案。[版权说明](https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html) |
| Bank of England publications | [官方 RSS](https://www.bankofengland.co.uk/rss/publications)混有政策、统计与研究，当前配置不足以可靠隔离论文；一般资源的默认使用范围也不是本站公开再分发授权。后续需专门论文列表和合适的使用范围。[官方条款](https://www.bankofengland.co.uk/legal) |
| 人民银行工作论文 | [官网目录](https://www.pbc.gov.cn/en/3935690/3689029/index.html)可访问，但本次读取的 [robots.txt](https://www.pbc.gov.cn/robots.txt)对通用抓取声明禁采；本批未启用自动采集。工作论文也不代表人行立场。 |
| HKIMR 工作论文 | [官网目录](https://www.aof.org.hk/research/HKIMR/publications-and-research/working-papers)可访问，但本次 [robots.txt](https://www.aof.org.hk/robots.txt)有通用禁采声明，目录还需动态接口；本批未启用。 |
| 清华五道口年度论文发表目录 | 已查页面是年度发表成果汇总，不能直接作为逐篇原始论文发布流，也不能把其他研究报告自动认作论文。[本次目录页](https://www.pbcsf.tsinghua.edu.cn/info/1050/10537.htm) |
| IMF | 官方条款对系统性复制或下载及超出合理使用的大量再利用要求许可，本批继续不启用论文系统采集；统计数据的单独条款不能代替工作论文许可。[官方版权与使用说明](https://www.imf.org/en/about/copyright-and-terms) |

这些是本次接入范围内的具体限制，不能据此声称候选机构永远不可使用。后续取得权限或找到允许使用、能可靠识别论文的官方元数据入口时，重新核验再接入。

## 新增配置与后续维护

本批按上述 7 个新稳定 ID 追加 `industry/sources.json`，保留既有来源的名称、选择器、采集状态、频率与管理员修改。`scripts/seed.ts` 对已存在的来源执行 `ON CONFLICT (id) DO NOTHING`，可重复运行以添加缺失的新来源，不用于覆盖数据库内已保存的信源设置。主题同步与来源插入是独立行为，运行前查看所需范围。

部署后先看新来源是否采集成功、最新原文日期是否可靠，再逐篇核对样本并公开摘要。已有来源的调整在管理员编辑页进行，记录原因并保留版本检查；不要为了刷新新配置删除再建来源。原有精选保持原样，旧政策条目不因新增论文来源而批量改类。

实测私有证据位于 `.data/verification/economics-discovery/`：`official/` 保存 FEDS、IFDP、BIS 及候选许可检查；`institutes/` 保存 NBER、世界银行的配置、采集器结果、摘要样本与逐篇许可；`china/` 保存北大两个目录、日期和摘要样本。证据包含抓取观察时间和样本摘要页的 SHA-256，核对记录的范围均为书目与公开摘要。`.data/` 不提交到仓库，也不作为公开全文出口。

通用采集配置与「更多 → 信息源」维护方式见 [信源文档](sources.md)。
