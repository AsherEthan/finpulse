# 金融脉搏 · FinPulse

面向投资研究的金融信息站：中国为主，兼顾全球，优先监管、央行、交易所、公司公告和原始研究。按主题追踪变化，保留原文、统计口径与核对记录，排除荐股、营销、传闻和无依据预测。

## 信息如何组织

| 栏目 | 关注的问题 |
| --- | --- |
| 披露与数据 | 公司披露了什么？经济、经营与统计数据发生了什么变化？ |
| 产业链 | 供需、产能、价格、库存、订单与交付如何传导？ |
| 政策 | 谁发布了什么规则？处于什么阶段，何时生效，有无执行证据？ |
| 资金流 | 信贷、基金、融资与跨境资金如何变化？区分存量、增量和净流量。 |
| 论文 | 经济学与金融研究提出了什么机制、证据和方法？区分工作论文、预印本与正式文章。 |

每条资料有一个主栏目，可关联多个标签与主题。「原始发布、媒体转述、加工数据、研究解读、市场信号」是另一组来源类型；一手属性、来源等级、内容性质与原文核验分别管理。

首页保留编辑精选；政策等栏目通过「动态」进入。采集、核对公开、进入精选是不同状态，新增信源不会自动改变精选。

## 信源与内容管理

- 「更多 → 信息源」：`/sources`，查看和筛选目录，管理员可编辑配置并检查采集状态；后台管理入口为 `/admin/sources`。
- 「动态」：`/all`，按栏目、主题、标签、来源类型、内容性质与原文核验筛选；政策入口为 `/all?category=policy`。
- 后台：`/admin`，进行试采、内容审核、政策事实编辑与运行诊断。
- Agent 接入：`/agent`，提供 RSS、公开 API、MCP 与 Markdown 入口。

截至 2026-10-04，配置目录包含 **145 个发布流**，覆盖监管与央行、交易所、公司披露、统计机构、国际组织、媒体和经济学研究。一个机构可有多个发布流，这个数量不等于独立机构数，也不证明来源一直可用。采集有时间和数量窗口，受限来源见 [限制目录](industry/source-limitations.json)。

默认只公开自撰摘要、标签和原文链接，不转载来源全文。原文核验绑定所读版本；原文变更后需要重新核对。「已核对原文」不代表独立审计底层数据，论文摘要核对也不代表读完全文或复算研究。

## 本机启动

需要 Node.js **24.11 以上**以及 Docker Compose。没有本机 Node 或需要直接连接 PostgreSQL 时，见 [部署说明](docs/deploy.md)。

```bash
git clone https://github.com/AsherEthan/finpulse.git
cd finpulse
node scripts/init-env.ts
```

初始化会生成 `.env`、随机密钥与管理员密码，不覆盖已有 `.env`。先在 `.env` 中将对应配置改为以下值，再启动；`.env.example` 继承框架的采集与模型开启值，不是关闭状态的预览配置。

```dotenv
COLLECT_ENABLED=false
MODEL_CALLS_ENABLED=false
FEISHU_CONTENT_PUSH_ENABLED=false
FEISHU_INTERNAL_ENABLED=false
INDEXNOW_SUBMIT_ENABLED=false
```

```bash
docker compose up -d --build
```

打开 <http://localhost:3000>，后台密码在 `.env` 的 `ADMIN_PASSWORD` 中。首次启动导入主题与信源目录。**仓库不包含本机运行数据库、已审核内容、采集文件或密钥，新安装不会自动拥有本机预览的精选和导读。**

需要开始免费的公开信源采集时，在 `.env` 中修改末尾已有的有效赋值，并添加缺少的配置；不要只取消前面的注释示例。然后重建 worker 容器以加载配置：

```dotenv
WORKER_MODE=collection
COLLECT_ENABLED=true
MODEL_CALLS_ENABLED=false
JINA_BODY_FALLBACK=false
```

```bash
docker compose up -d --force-recreate worker
```

此模式只执行公开 HTTP 采集及提取，新资料进入待审核队列，不自动公开、生成评分或加入精选。同一数据库只运行一种 worker 模式。完整模型流水线需另行配置模型、预算与编辑标准，见 [政策工作流](docs/finance-policy-workflow.md) 和 [精选与校准](docs/selection.md)。

## 文档与开发

| 文档 | 内容 |
| --- | --- |
| [披露与数据](docs/finance-disclosure-data-sources.md) | 公司、宏观与统计来源及口径 |
| [产业链](docs/finance-industry-chain-sources.md) | 行业来源、传导关系与覆盖边界 |
| [政策来源](docs/finance-policy-sources.md) / [政策工作流](docs/finance-policy-workflow.md) | 政策维度、版本、执行证据与审核 |
| [持续追踪](docs/finance-source-tracking.md) | 资金流、来源类型与核验管理 |
| [经济学论文](docs/finance-economics-paper-sources.md) / [扩展验收](docs/finance-paper-source-expansion.md) | 论文目录、书目窗口、作者归属与许可 |
| [信源配置](docs/sources.md) / [行业定制](docs/customize.md) | 采集器、配置字段、分类与提示词 |
| [部署](docs/deploy.md) / [架构](docs/architecture.md) | 运行、升级、备份与公开读取层 |

技术栈：Node.js、TypeScript、React Router、Fastify、PostgreSQL、pg-boss、Tailwind CSS。网站请求不触发模型调用；付费调用统一经过回执与预算限制。AI 专属榜单和重置监控已关闭。

开发前读 [AGENTS.md](AGENTS.md)。类型检查、网页构建与测试、后端测试和站点 smoke 的运行要求见该文件；后端测试必须使用独立空测试库，库名以 `_test` 或 `_ci` 结尾。2026-10-04 验收通过类型检查、653 项后端测试、69 项网页测试、网页构建和站点 smoke，详见论文扩展验收记录。

公开部署前按实际运营方式确认 `industry/pages/` 中的条款与隐私说明，并配置正式站点地址与运行服务。

## 来源与许可

本项目基于 [KKKKhazix/AIHOT](https://github.com/KKKKhazix/AIHOT) 的行业信息站框架改造，保留原作者归属。代码采用 [MIT 许可证](LICENSE)，第三方字体和资产说明见 [NOTICE](NOTICE)。新闻、数据和论文的权利独立于代码许可；书目接口可用不等于获准转载论文全文。本站使用「金融脉搏」品牌；内部沿用的 `@aihot/*` 包名用于代码兼容。
