# 信源

信源在后台“信源”页管理：新建、试抓一次看看抓到什么、改频率、启停、看失败原因和最近的条目。首次启动时，`industry/sources.json` 里的示范信源会被导入。

## 六种信源

| 类型 | 适合 | 需要 |
|---|---|---|
| `rss` | 有 RSS / Atom 的博客、媒体、Substack、公众号转 RSS 服务 | 无 |
| `web_list` | 没有 RSS 的网页列表（新闻页、博客列表、更新日志） | 写选择器；按需配置 Jina Reader 渲染（按次计费） |
| `json_list` | 返回 JSON 的接口（GitHub Releases 等） | 写字段路径 |
| `x_search` | X（推特）账号 | SocialData 的 key，按请求计费 |
| `mp_account` | 微信公众号 | 极致了（Dajiala）的 key，按请求计费 |
| `external` | 你自己的脚本推送进来的内容 | `INGEST_TOKEN`，见下文 |

`json_list` 的地址或配置可能携带凭据，只跟随同源重定向（协议、主机和端口都相同）。若接口搬到另一个来源，请直接更新信源地址；不要依赖跨源跳转传递认证信息。

每种信源认哪些配置项写在 [`config-keys.ts`](../packages/backend/src/sources/config-keys.ts)。填了不认识的配置项，保存会被拒绝、抓取会直接失败并在后台显示原因，不会悄悄退回通用解析。


## 先预览，再创建

进入 `/admin/sources/new`，填写 ID、名称，选择类型，再把下文对应的 JSON 填入“采集配置（JSON）”。这里填的是配置对象，不要包上 `kind` 或 `config`。切换类型会重置配置，先选类型再粘贴。

`rss`、`web_list`、`json_list`、`x_search` 可以点“预览抓取”：显示条目总数和前 20 条的标题、原文链接、发布时间、摘要，不把条目存入文章库。检查抓到的是文章而不是导航，日期与原文一致，再点“创建”。预览不等于完成生产采集，也不经过后续详情补齐、精选和公开发布流程。

预览仍会发出抓取请求；X 和 Jina 预览也可能产生费用，经过付费回执和预算。`COLLECT_ENABLED=false` 只关闭后台自动采集，不能用它来保证手动预览不访问外部服务。下面的本地 HTML/JSON 示例不需要任何 API key。
### rss

```json
{ "feedUrl": "https://example.com/feed.xml" }
```

可选：`summaryIsBody`（订阅里的摘要就是全文）、`allowCategories` / `denyCategories`（按订阅里的分类过滤）。

### web_list

支持普通 CSS 选择器，`div` 列表也能采集。关键是 `itemSelector` 要选中**每条新闻**，而不是包住所有新闻的容器。例如：

```html
<div class="news-list">
  <div class="news-item">
    <h2><a href="/posts/first">第一条示例新闻</a></h2>
    <time datetime="2026-10-01T09:00:00+08:00">10 月 1 日</time>
  </div>
  <div class="news-item">
    <h2><a href="/posts/second">第二条示例新闻</a></h2>
    <time datetime="2026-10-01T10:00:00+08:00">10 月 1 日</time>
  </div>
</div>
```

对应配置（`example.com` 是占位地址，换成目标网页；可运行版本见[本地示例](#本地跑通-htmljson-示例)）：

```json
{
  "url": "https://example.com/news",
  "parseMode": "html",
  "itemSelector": ".news-list > .news-item",
  "linkSelector": "h2 a",
  "titleSelector": "h2 a",
  "publishedAtSelector": "time",
  "allowUrlPrefixes": ["https://example.com/posts/"]
}
```

- `itemSelector` 在整个页面找条目；`linkSelector`、`titleSelector` 在每个条目内取第一个匹配节点，也可以匹配条目自身。选 `.news-list` 只会得到一个容器，通常只取到第一条新闻；只写 `div` 又会混入嵌套容器。要选重复出现的新闻节点。
- 链接取自 `href`；`/posts/first` 等相对链接按列表 `url` 解析，也可用 `baseUrl` 指定基准地址。标题取节点文字。重复链接会合并，指向列表自身的链接通常会跳过。
- 日期在条目内查找 `publishedAtSelector`，依次读取 `datetime` 属性、`title` 属性、文字。没有时区的日期时间可用 `publishedAtUtcOffset`（默认 `+08:00`）；自带时区的时间保留原时区语义，纯 `YYYY-MM-DD` 按 UTC 零点读。
- 列表接口返回JSON中的HTML片段时，设 `jsonHtmlPath: "data.html"`，继续使用HTML选择器；字段缺失或不是非空字符串会明确失败。`baseUrl` 用于片段内的相对链接，`headers` 可设置官网列表请求需要的公开请求头；仍经过相同的地址、大小与重定向检查。
- `parseMode`：普通网页默认 `html`；`markdown` 按 Markdown 链接读；`docusaurus_changelog` 读更新日志标题。需要 Jina 时，显式把 `url` 写成 `https://r.jina.ai/https://目标站/路径` 并配置 `JINA_API_KEY`，不是抓不到就自动切换。Jina 默认返回 Markdown；要继续使用 CSS 选择器，显式设 `parseMode: "html"`。
- `detail`：列表缺日期、标题或摘要时抓详情页补齐（`publishedAtSelector`、`titleSelector`、`summarySelector` 等）。
- `allowUrlPrefixes` / `denyUrlPrefixes`：只收某些路径下的文章。
- `allowTitleRegex`：明确订阅的标题范围，例如法律目录仅收经济金融相关标题。不匹配的记录不会入库；它不代替入库后的相关性核对与精选判断。
- 深交所旧式规则列表可用 `adapter: "szse_rules"`。只读取每行官方脚本中的链接和标题字面值，不执行 `document.write` 或任意网页脚本。

### json_list

假设接口返回下面的结构，`itemsPath` 指向数组，其他字段路径相对**每个数组元素**填写。路径用点分隔，不是 JSONPath，不写 `$` 或 `[*]`。

```json
{
  "data": {
    "items": [
      {
        "id": "first",
        "title": "第一条示例新闻",
        "url": "https://example.com/posts/first",
        "summary": "第一条新闻的摘要。",
        "published_at": "2026-10-01T09:00:00+08:00"
      }
    ]
  }
}
```

对应配置：

```json
{
  "url": "https://example.com/api/news",
  "mode": "json_api",
  "itemsPath": "data.items",
  "titlePaths": ["title"],
  "urlTemplate": "{raw:url}",
  "summaryPaths": ["summary"],
  "publishedAtPath": "published_at",
  "externalIdPath": "id"
}
```

- 接口本身返回数组时，省略 `itemsPath`。`titlePaths`、`summaryPaths`、`authorPaths` 是候选路径数组，按顺序取第一个非空值，例如 `["title", "name"]`。
- 数据点需要组合指标、年份、数值和单位时，可用 `titleTemplate`、`summaryTemplate`；占位符与 `urlTemplate` 相同，例如 `"{raw:indicator.value}｜{raw:date}年：{raw:value}%"`。文字字段通常用 `raw:` 避免URL编码。显式标题模板引用的字段缺失或为 null 时跳过该记录，不用旧标题补成有效数据。统计年份不作发布时间；没有真实发布日期时保持 `publishedAt` 为空。
- 已有完整网址时用 `{raw:url}`；只有 slug 时可用 `https://example.com/posts/{slug}`。`{字段路径}` 会编码字段值，`{raw:字段路径}` 原样插入。接口混用相对与绝对链接时，配置 `baseUrl`：相对链接按此基准解析，绝对链接保留。未配置时模板应产出完整的 HTTP(S) 地址。
- POST JSON 请求使用 `bodyJson`；巨潮公告等表单接口使用 `method: "POST"` 与 `bodyForm`，其值只能为字符串、有限数字或布尔值。采集器按表单编码发送，保留空字符串、零与 false。两种请求体不能同时配置。
- 日期建议返回带时区的 ISO 字符串；数字时间戳分别设 `publishedAtUnit: "epoch_s"`（秒）或 `"epoch_ms"`（毫秒），`20261001` 这类日期设 `"yyyymmdd"`。
- 官方JSON返回 `2026-09-29 18:13:19` 这类无时区时间时，配置 `publishedAtUtcOffset: "+08:00"` 明确来源时区，避免随服务器时区改变。
- 缺少标题或无法生成链接的条目会跳过。非空数组全部映射失败时，会报 `no items mapped (check title/url paths)`；路径不是数组时，会报 `items path did not resolve to an array`。
- `rawPaths`：最多保存20个指定的官方元数据字段，例如法律目录中的 `bbbs`、`gbrq`、`sxrq`、`sxx`、`zdjgName`、`flxz`，存于材料 `raw.officialMetadata`。每次读取记录最新观察时间；元数据刷新不伪造正文修订，也不自动产生公开政策事实。

广期所仓单不是新闻列表，使用 `json_list` 专用 `adapter: "gfex_warehouse"`、官方仓单接口、`method: "POST"` 与 `bodyForm: { "variety": "lc" }`。按上海日期回查最近7个自然日，核对明细日期、单位及总分项，产出一条统计日资料；休市空值不产生零库存。统计日和品种用于判重，发布时间未知时保持空白，原文链接指向官网表格入口。它只涵盖已核验的碳酸锂仓单，不代表社会总库存或其他交易所品种。

### 有限分页与覆盖状态

`web_list` 和 `json_list` 可配置最多3页的近期窗口；缺少分页配置时只读一个已核验列表窗口。

`fetchPublicContent:false` 明确禁止额外读取和保存文章正文，优先于网页列表的默认取文、`detail` 和旧取文任务。`detail` 仍可补发布时间、标题与短摘要；RSS/API 已在响应中提供的内容可按原配置保留。省略或设为 `true` 时沿用默认取文行为。它与 `site_fulltext`（站内全文）及 `syndicate_fulltext`（全文再分发）是三个独立限制。

`config._aihot.sourceDimension` 可设为 `original`、`secondary`、`processed`、`research` 或 `signal`，分别表示原始发布、媒体转述、加工数据、研究解读与市场信号。它独立于 `first_party`、`tier` 和主栏目；`signal` 调查资料可用 `editorial` 审核进入动态，`hot_signal` 仍只作讨论热度证据。逐条内容性质与原文核验用经审计的 `informationProfile` 记录，必须绑定当前文章原文版本；普通人工编辑和模型摘要不自动产生核验记录。

```json
{ "pagination": { "pageParam": "pageIndex", "startPage": 1, "maxPages": 2, "pageSize": 18 } }
```

查询参数使用 `pageParam`；POST JSON 或表单的顶层页码使用 `bodyPageField`；静态分页地址使用同源 `urlTemplate`，如 `https://example.com/list_{page}.html`。首页无序号、后续从1开始的静态目录配置 `firstPageUrl` 和 `startPage: 0`，依次读取首页、`index_1`、`index_2`。地址不能跨源，防止携带请求头或请求体离开原站。空页或短页结束读取；达到页数上限或原站重复同一页时明确记录窗口受限。不得把近期窗口成功当成完整历史已经覆盖。

每次采集在 `fetch_runs` 中保存发现、新增、正文修订数、实际入库条目的官方日期范围和页数；未知日期保持空白。首次回灌上限与月份限制仍保留，失败不推进成功游标。公开 `/api/site/policy-sources` 区分未采集、正常、无新增、失败、暂停与采集过期，并分别报告已公开政策数和待复核材料数。最新原文日期与最近成功采集时间独立展示，低频更新来源不会因原文较旧而被当成采集失败。公开接口不暴露来源配置、密钥、未发布正文或原始错误响应。

`WORKER_MODE=collection` 仅处理普通官方HTTP列表和免费正文提取：调度和消费边界同时拒绝X、公众号与Jina付费任务。采集成功不自动公开；模型和外部推送仍由各自开关控制。

### 本地跑通 HTML/JSON 示例

仓库提供两份虚构示例：[news.html](examples/sources/news.html) 和 [news.json](examples/sources/news.json)，各有两条新闻。它们用于核对选择器和字段映射，不是运营信源；示例文章链接不提供正文。

在仓库根目录、Node.js 24.11 以上运行以下命令。服务只监听本机，只提供这两份文件；用 `Ctrl+C` 停止。

```bash
node --input-type=module -e '
import http from "node:http";
import { readFileSync } from "node:fs";
const files = {
  "/news.html": ["text/html; charset=utf-8", readFileSync("docs/examples/sources/news.html")],
  "/news.json": ["application/json", readFileSync("docs/examples/sources/news.json")]
};
http.createServer((req, res) => {
  const file = files[req.url];
  res.writeHead(file ? 200 : 404, { "content-type": file ? file[0] : "text/plain" });
  res.end(file ? file[1] : "Not found");
}).listen(8787, "127.0.0.1");'
```

在同一台机器上，按[非 Docker 部署方式](deploy.md#不用-docker)运行开发 API 和网页，保持采集、模型、飞书和 IndexNow 开关关闭，不启动 worker。仅为此次本机示例，在开发 API 进程设置 `ALLOW_PRIVATE_NETWORK_FETCH=true` 后重启；默认禁止抓内网地址，生产环境拒绝启用此项，验证后移除。若 API 在容器或另一台服务器，`127.0.0.1` 指向它自己，此命令的地址不能直接用于该部署。

分别选择 `web_list`、`json_list`，粘贴配置并点“预览抓取”，无需创建信源：

```json
{
  "url": "http://127.0.0.1:8787/news.html",
  "parseMode": "html",
  "itemSelector": ".news-list > .news-item",
  "linkSelector": "h2 a",
  "titleSelector": "h2 a",
  "publishedAtSelector": "time",
  "allowUrlPrefixes": ["http://127.0.0.1:8787/posts/"]
}
```

```json
{
  "url": "http://127.0.0.1:8787/news.json",
  "mode": "json_api",
  "itemsPath": "data.items",
  "titlePaths": ["title"],
  "urlTemplate": "http://127.0.0.1:8787/posts/{id}",
  "summaryPaths": ["summary"],
  "publishedAtPath": "published_at",
  "externalIdPath": "id"
}
```

两次都应显示 **2 条**，依次为下表内容。JSON 示例还显示对应摘要，HTML 示例没有配置摘要提取。预览 API 的日期是 UTC，后台界面按 `+08:00` 显示为 09:00 和 10:00。

| 标题 | 原文链接 | 预览 API 的 publishedAt |
|---|---|---|
| 第一条示例新闻 | `http://127.0.0.1:8787/posts/first` | `2026-10-01T01:00:00.000Z` |
| 第二条示例新闻 | `http://127.0.0.1:8787/posts/second` | `2026-10-01T02:00:00.000Z` |

可以把 HTML 的 `itemSelector` 暂改成 `.news-list` 对照：只会返回第一条。改回 `.news-list > .news-item` 后恢复两条，这就是“列表容器”和“每条新闻”的区别。

抓真实网页时先看原始 HTTP 响应中有没有新闻节点。普通 HTML 模式不执行 JavaScript；浏览器里看得到、响应里没有的内容，不能靠换一个 CSS 选择器生成。优先找 RSS 或 JSON 接口，或按需配置 Jina / 自己维护的外部采集。`no items matched (html)` 还可能是选择器不匹配、没有 `href` 或标题、链接被前缀规则过滤；先核对响应与配置，不必先更换采集器。

### x_search

这类信源使用 SocialData 搜索，不是把 X 个人主页 URL 填入网页列表。以 `https://x.com/SomeAccount` 为例，取用户名 `SomeAccount`，不要包含 `@` 或整段 URL：

```json
{ "query": "from:SomeAccount -filter:replies", "searchType": "Latest" }
```

`SomeAccount` 是占位用户名，换成你要关注的真实账号。`-filter:replies` 排除回复；`Latest` 按最新内容查找。

在后端运行环境的 `.env` 配置 `SOCIALDATA_API_KEY`，重启 API（预览）和 worker（定时采集）后生效；不要把 key 写进信源 JSON 或提交到仓库。先在后台“设置 → 预算”检查 SocialData 额度，再按需预览。未配置 key 会报 `SOCIALDATA_API_KEY is not configured`；服务拒绝请求或预算熔断时看后台错误原因。预览可能有付费请求，本文不要求用真实服务验证，结果取决于账号和服务当时的返回。

生产自动采集时，普通账号会被自动合并成一次搜索（每次最多二十几个账号），省请求数；单个信源的手动预览不是合并采集。

### mp_account

```json
{ "ghid": "gh_xxxxxxxx", "nickname": "公众号名称" }
```

每个公众号按它的抓取间隔检查一次（查列表按次计费），新文章的正文一并取回。

需要在后端 `.env` 配置 `DAJIALA_KEY`，`ghid` 换成公众号原始 ID。配置字段用上面的 `ghid` / `nickname`，不要写成 `biz` / `name`。当前 `mp_account` 不支持“预览抓取”；`external` 也不支持主动试抓，按下方推送接口接入。

## 在网站查看与编辑

「更多 → 信息源 → 查看与编辑信源」打开 `/sources`，可查看已接入来源（含暂停来源）的地址、来源类型、标签、采集状态、最近成功时间与公开条目数；支持搜索和组合筛选。隔离来源只在后台显示。

经济学论文来源、日期与作者处理、存档和摘要使用范围见 [经济学论文信源](finance-economics-paper-sources.md)和[第二批扩展与验收](finance-paper-source-expansion.md)。论文动态可按宏观与货币、增长与生产率、就业与劳动、国际贸易、发展经济学和计量方法浏览。

每个来源的「编辑」链接进入既有管理员详情页。可修改名称、来源地址、来源类型、标签、采集间隔和一手属性，暂停或恢复采集；选择器、分页与解析规则放在「高级采集设置」中。常用字段与高级配置同步，保留其他采集参数。保存仍检查版本并记录修改原因；登录后才能操作。

目录只提供公开显示字段，凭证、完整采集配置与原始错误不对外提供。它读取数据库里的当前设置，后台修改持久保存在数据库；`industry/sources.json` 是初始信源配置。

## 分级、参与方式与全文

- **分级** `tier`：`T1` 官方一手（官网、官方博客、机构）、`T1_5` 官方账号与准官方创作者、`T2` 媒体与个人、`EXCLUDE_MP` 不参与精选。入选门槛按分级不同（`industry/selection.ts`）。
- **参与方式** `participation_mode`：`editorial` 进精选和全部动态；`hot_signal` 不单独展示，只作为“大家在讨论什么”的热度证据；`isolated` 不进任何公开页面。
- **一手** `first_party`：来源是当事方自己。事件页会优先展示一手报道。
- **全文**：`site_fulltext` 决定站内能不能显示全文，`syndicate_fulltext` 决定全文 RSS 能不能带正文。两者**默认都关**，只显示摘要和原文链接；来源明确允许时再打开。公众号、付费墙内容不会因为技术上抓得到就获得全文展示。

## 抓取频率

每个信源有自己的抓取间隔。每天 04:20 会按近 7 天的产出自动调整：产出多的抓得勤，最短 15 分钟；免费信源最长 60 分钟，按次计费的信源最长 120–180 分钟。

抓取失败不推进位置，下次从同一处继续；连续失败的信源在后台标红，每周一会在运营群发一份信源周报（配置了飞书内部群时）。

## 规则：旧文不刷屏

首次发现时原文已经发布超过 48 小时的资料、新信源第一次导入的存量条目、标记为回灌的推送，都按原文时间归档：不进入“今天”，也不推送。这条规则所有入口共用，防止一次性导入历史内容刷屏。

## 外部推送接口

自己写脚本抓的内容，可以推进站里，走和普通采集一样的判重、精选和归组。

```
POST /api/ingest/items
Authorization: Bearer <INGEST_TOKEN>
Content-Type: application/json

{
  "sourceId": "my-crawler",
  "sourceName": "我的抓取脚本",
  "items": [
    { "title": "必填", "url": "必填", "publishedAt": "2026-10-01T08:00:00+08:00", "author": "可选" }
  ]
}
```

- `INGEST_TOKEN` 在 `.env` 里设置，至少 16 位；不设置时接口一律返回 401。
- 每次最多 50 条；每个客户端每分钟最多 10 次。
- `items` 中每条必须是 JSON 对象；包含 `null`、数组或其他非对象值时返回 400，且不会创建或更新信源，也不会写入条目。
- 返回 `{"ok": true, "created": <新建条数>}`。缺标题或网址的条目会被跳过，同一请求里重复的网址只取第一条。
- `sourceId` 不存在时会自动建一个 `external` 信源，默认不进公开页面：到后台把它的参与方式改成 `editorial` 才会出现在站上。
- 在后台暂停信源后，推送接口返回 409，不再接收新文章；恢复信源后可以继续推送。
- 条目的 `raw._aihot.backfill` 为 `true` 时按历史回灌处理（不进入“今天”、不推送）。

披露与数据信源、六个主题、有限采集窗口及统计口径见 [披露与数据信源维护](finance-disclosure-data-sources.md)。
