// 金融脉搏：论文单列；其他资料按事件主线归类，一手性另由来源标记体现。
export const CATEGORIES = [
  {
    "key": "first-hand",
    "label": "披露与数据",
    "section": "披露与数据",
    "guide": "公司整体财务、治理、重大交易与综合宏观统计，包括完整财报、金融机构经营与风险指标、就业人口、居民收支、教育养老等公共服务统计、普通数据表及无明确政策、资金或供需主线的日常调查发布。统计公报不因名称或官方身份归为政策，毕业人数不等于新增就业，资产余额不等于资金净流入。符合正式论文边界的资料归 papers；具体产销、订单、库存、价格、产能事实归 supply-chain；政策规则及明确关联政策的执行归 policy；融资、申赎、跨境资金与流动性事实归 capital-flow。公告或数据只是材料形式，一手性是独立来源属性。"
  },
  {
    "key": "supply-chain",
    "label": "产业链",
    "section": "产业链",
    "guide": "围绕最终产品或服务的上中下游供需、产销、订单履约、价格、库存、产能利用、成本、利润传导与资本开支。公司产销快报、交付公告和商业合同进度按这些经营事实归类；区分计划、签约、交付、验收、收入确认与回款，不因公告形式归入披露与数据。"
  },
  {
    "key": "policy",
    "label": "政策",
    "section": "政策",
    "guide": "政策计划、草案、意见反馈、正式文件、配套细则、自律规则、监管与司法适用；以及原文明确关联政策或公共投资的采购合同、项目审批、资金公示、审计整改与绩效评估。区分发布与生效、预算与支付、审批与投产。常规财报、一般统计与商业订单不因来自官方而归入政策。"
  },
  {
    "key": "capital-flow",
    "label": "资金流",
    "section": "资金流",
    "guide": "融资、信贷、社融、基金申赎、跨境资金与流动性投放，回答资金从哪里来、流向哪里；持仓和余额标明存量或变化口径。价格涨跌与成交额不等于资金净流入，企业综合财报中的现金流不自动归本栏。"
  },
  {
    "key": "papers",
    "label": "论文",
    "section": "论文",
    "guide": "正式学术期刊论文、工作论文，以及作者、研究问题、方法和结论明确的机构研究报告。涵盖中国经济、宏观与货币、增长与生产率、就业劳动、国际贸易、发展经济学和经济计量。符合此边界的原始研究材料先归 papers，再用货币、产业或经济学主题标签关联；估计、模型情景和作者观点不等于已实现金融事件。媒体转述与观点、普通调查发布、指数、数据库及数据表不自动归论文，研究机构身份和来源维度 research 也不作为论文依据。"
  }
] as const;
export const ITEM_TYPES = ["policy_release", "corporate_disclosure", "capital_flow", "supply_chain", "research_paper", "opinion_analysis", "tutorial_explainer"] as const;
export const CATEGORY_TAGS = ["政策/监管", "公告/财报", "资金流", "产业链", "研究/数据", "分析/解读", "方法/口径", "其他"] as const;
export const POLICY_TOPICS = [
  { slug: "policy-macro", name: "综合宏观", tag: "宏观政策" },
  { slug: "policy-monetary", name: "货币政策", tag: "货币政策" },
  { slug: "policy-fiscal", name: "财政政策", tag: "财政政策" },
  { slug: "policy-tax", name: "税收政策", tag: "税收政策" },
  { slug: "policy-regulation", name: "金融监管", tag: "金融监管" },
  { slug: "policy-industry", name: "产业政策", tag: "产业政策" },
  { slug: "policy-property", name: "房地产政策", tag: "房地产政策" },
  { slug: "policy-trade", name: "贸易政策", tag: "贸易政策" },
  { slug: "policy-cross-border", name: "跨境政策", tag: "跨境政策" },
] as const;
export const POLICY_TAG_GROUPS = [
  { name: "发布阶段", tags: ["政策计划", "征求意见", "意见反馈", "正式文件", "配套细则"] },
  { name: "效力相关标签", tags: ["已生效", "暂缓实施", "修订废止"] },
  { name: "执行与验证", tags: ["自律规则", "政策执行", "政策评估", "采购合同", "项目审批", "审计整改", "司法适用", "监管执法"] },
  { name: "政策工具与事项", tags: ["并购审查", "出口管制", "制裁", "关税", "资金公示", "预算决算", "环评受理", "拟审批", "审批决定", "会议纪要"] },
  { name: "地区范围", tags: ["中国", "全球", "地方政策"] },
] as const;
export const SUPPLY_CHAIN_TOPICS = [
  { slug: "energy", name: "能源与有色", tag: "能源" },
  { slug: "chain-auto-battery", name: "汽车与动力电池", tag: "汽车与动力电池" },
  { slug: "chain-semiconductor", name: "半导体", tag: "半导体" },
  { slug: "chain-solar-power", name: "光伏与电力", tag: "光伏与电力" },
  { slug: "chain-consumption-property", name: "消费与地产", tag: "消费与地产" },
  { slug: "chain-infrastructure", name: "基建与工程", tag: "基建与工程" },
] as const;
export const CAPITAL_FLOW_TOPICS = [
  { slug: "liquidity", name: "信贷与流动性", tag: "信贷/社融" },
  { slug: "fund-public", name: "公募基金", tag: "公募基金" },
  { slug: "fund-private", name: "私募基金", tag: "私募基金" },
  { slug: "fund-private-asset-management", name: "私募资管", tag: "私募资管" },
  { slug: "cross-border-capital", name: "跨境资金", tag: "跨境资本" },
] as const;
export const CAPITAL_FLOW_TAG_GROUPS = [
  { name: "资金口径", tags: ["存量", "增量", "净流量"] },
  { name: "统计周期", tags: ["周度", "月度", "季度", "年度"] },
  { name: "地区范围", tags: ["中国", "全球"] },
] as const;
export const SUPPLY_CHAIN_TAG_GROUPS = [
  { name: "产业环节", tags: ["上游原料", "中游制造", "下游应用"] },
  { name: "经营指标", tags: ["价格", "产量", "销量", "订单", "库存", "产能", "利用率", "成本", "资本开支", "利润", "经营现金流"] },
  { name: "事实状态", tags: ["已实现", "计划/设计", "管理层指引", "机构预测", "调查指数"] },
  { name: "履约阶段", tags: ["招标", "中标", "签约", "交付", "验收", "计费", "收入确认", "回款"] },
  { name: "统计周期", tags: ["日度", "周度", "旬度", "月度", "季度", "年度"] },
] as const;
export const DISCLOSURE_TOPICS = [
  { slug: "disclosure-reports", name: "公司财报", tag: "财报" },
  { slug: "disclosure-macro", name: "宏观与物价", tag: "宏观统计" },
  { slug: "disclosure-labor", name: "就业与人口", tag: "就业与人口" },
  { slug: "disclosure-households", name: "居民收支", tag: "居民收支" },
  { slug: "disclosure-financial", name: "金融机构经营", tag: "金融机构经营" },
  { slug: "disclosure-social", name: "公共服务", tag: "公共服务统计" },
] as const;
export const ECONOMICS_TOPICS = [
  { slug: "econ-macro", name: "宏观与货币", tag: "宏观经济" },
  { slug: "econ-growth", name: "增长与生产率", tag: "经济增长" },
  { slug: "econ-labor", name: "就业与劳动", tag: "就业与劳动" },
  { slug: "econ-trade", name: "国际贸易", tag: "国际贸易" },
  { slug: "econ-development", name: "发展经济学", tag: "发展经济学" },
  { slug: "econ-econometrics", name: "计量方法", tag: "计量方法" },
] as const;
export const TOPIC_TAGS = [...new Set([
  "货币政策", "财政政策", "监管执法", "银行", "证券", "保险", "债券", "股票", "基金/ETF", "房地产", "能源", "有色金属", "半导体", "新能源", "消费", "跨境资本", "流动性", "信贷/社融", "财报", "供需/库存", "市场信心",
  "汽车与动力电池", "汽车", "动力电池", "光伏与电力", "光伏", "电力", "消费与地产", "论文",
  ...ECONOMICS_TOPICS.map(t => t.tag),
  ...DISCLOSURE_TOPICS.map(t => t.tag),
  ...SUPPLY_CHAIN_TOPICS.map(t => t.tag), ...CAPITAL_FLOW_TOPICS.map(t => t.tag), ...CAPITAL_FLOW_TAG_GROUPS.flatMap(g => g.tags),
  ...POLICY_TOPICS.map(t => t.tag), ...POLICY_TAG_GROUPS.flatMap(g => g.tags), ...SUPPLY_CHAIN_TAG_GROUPS.flatMap(g => g.tags),
])] as const;
export const ENTITY_TAGS = ["中国人民银行","中国证监会","金融监管总局","国家外汇管理局","国家统计局","上交所","深交所","港交所","香港金管局","美联储","欧洲央行","财政部","国家发展改革委","工业和信息化部","商务部","国家税务总局","市场监管总局","生态环境部","审计署","最高人民法院","全国公共资源交易平台","深圳工信局","深圳财政局","交易商协会","基金业协会","美国工业与安全局","美国财政部OFAC","美国贸易代表办公室"] as const;
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {"政策": "政策/监管", "监管": "政策/监管", "公告": "公告/财报", "资金流向": "资金流", "供需": "产业链", "研究": "研究/数据", "观点": "分析/解读", "教程": "方法/口径"};
export const CATEGORY_BY_ITEM_TYPE: Readonly<Record<string, string>> = {"policy_release": "政策/监管", "corporate_disclosure": "公告/财报", "capital_flow": "资金流", "supply_chain": "产业链", "research_paper": "研究/数据", "opinion_analysis": "分析/解读", "tutorial_explainer": "方法/口径"};
export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[] }> = {
  "mof": {"name":"财政部","displayTag":"财政部","aliases":["财政部","Ministry of Finance"]},
  "ndrc": {"name":"国家发展改革委","displayTag":"国家发展改革委","aliases":["国家发展和改革委员会","国家发展改革委","发改委","NDRC"]},
  "miit": {"name":"工业和信息化部","displayTag":"工业和信息化部","aliases":["工业和信息化部","工信部","MIIT"]},
  "mofcom": {"name":"商务部","displayTag":"商务部","aliases":["商务部","MOFCOM"]},
  "sat": {"name":"国家税务总局","displayTag":"国家税务总局","aliases":["国家税务总局","税务总局"]},
  "samr": {"name":"市场监管总局","displayTag":"市场监管总局","aliases":["国家市场监督管理总局","市场监管总局","SAMR"]},
  "mee": {"name":"生态环境部","displayTag":"生态环境部","aliases":["生态环境部","Ministry of Ecology and Environment"]},
  "audit": {"name":"审计署","displayTag":"审计署","aliases":["审计署","National Audit Office"]},
  "court": {"name":"最高人民法院","displayTag":"最高人民法院","aliases":["最高人民法院","最高法","Supreme People's Court"]},
  "ggzy": {"name":"全国公共资源交易平台","displayTag":"全国公共资源交易平台","aliases":["全国公共资源交易平台"]},
  "szgxj": {"name":"深圳工信局","displayTag":"深圳工信局","aliases":["深圳市工业和信息化局","深圳工信局"]},
  "szfb": {"name":"深圳财政局","displayTag":"深圳财政局","aliases":["深圳市财政局","深圳财政局"]},
  "nafmii": {"name":"交易商协会","displayTag":"交易商协会","aliases":["中国银行间市场交易商协会","交易商协会","NAFMII"]},
  "amac": {"name":"基金业协会","displayTag":"基金业协会","aliases":["中国证券投资基金业协会","基金业协会","AMAC"]},
  "bis": {"name":"美国工业与安全局","displayTag":"美国工业与安全局","aliases":["美国工业与安全局","Bureau of Industry and Security"]},
  "ofac": {"name":"美国财政部OFAC","displayTag":"美国财政部OFAC","aliases":["美国财政部OFAC","Office of Foreign Assets Control","OFAC"]},
  "ustr": {"name":"美国贸易代表办公室","displayTag":"美国贸易代表办公室","aliases":["美国贸易代表办公室","Office of the United States Trade Representative","USTR"]},
  "pbc": {
    "name": "中国人民银行",
    "displayTag": "中国人民银行",
    "aliases": [
      "中国人民银行",
      "人民银行",
      "PBOC"
    ]
  },
  "csrc": {
    "name": "中国证监会",
    "displayTag": "中国证监会",
    "aliases": [
      "中国证监会",
      "证监会",
      "CSRC"
    ]
  },
  "nfra": {
    "name": "金融监管总局",
    "displayTag": "金融监管总局",
    "aliases": [
      "国家金融监督管理总局",
      "金融监管总局",
      "NFRA"
    ]
  },
  "safe": {
    "name": "国家外汇管理局",
    "displayTag": "国家外汇管理局",
    "aliases": [
      "国家外汇管理局",
      "外汇局",
      "SAFE"
    ]
  },
  "stats": {
    "name": "国家统计局",
    "displayTag": "国家统计局",
    "aliases": [
      "国家统计局",
      "NBS"
    ]
  },
  "sse": {
    "name": "上交所",
    "displayTag": "上交所",
    "aliases": [
      "上海证券交易所",
      "上交所",
      "SSE"
    ]
  },
  "szse": {
    "name": "深交所",
    "displayTag": "深交所",
    "aliases": [
      "深圳证券交易所",
      "深交所",
      "SZSE"
    ]
  },
  "hkex": {
    "name": "港交所",
    "displayTag": "港交所",
    "aliases": [
      "香港交易所",
      "港交所",
      "HKEX"
    ]
  },
  "hkma": {
    "name": "香港金管局",
    "displayTag": "香港金管局",
    "aliases": [
      "香港金融管理局",
      "香港金管局",
      "HKMA"
    ]
  },
  "fed": {
    "name": "美联储",
    "displayTag": "美联储",
    "aliases": [
      "美联储",
      "Federal Reserve",
      "FOMC"
    ]
  },
  "ecb": {
    "name": "欧洲央行",
    "displayTag": "欧洲央行",
    "aliases": [
      "欧洲央行",
      "European Central Bank",
      "ECB"
    ]
  }
};
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "mof", name: "财政部", patterns: [/财政部|Ministry of Finance/i] },
  { id: "ndrc", name: "国家发展改革委", patterns: [/国家发展和改革委员会|国家发展改革委|发改委|NDRC/i] },
  { id: "miit", name: "工业和信息化部", patterns: [/工业和信息化部|工信部|MIIT/i] },
  { id: "mofcom", name: "商务部", patterns: [/商务部|MOFCOM/i] },
  { id: "sat", name: "国家税务总局", patterns: [/国家税务总局|税务总局/i] },
  { id: "samr", name: "市场监管总局", patterns: [/国家市场监督管理总局|市场监管总局|SAMR/i] },
  { id: "mee", name: "生态环境部", patterns: [/生态环境部|Ministry of Ecology and Environment/i] },
  { id: "audit", name: "审计署", patterns: [/审计署|National Audit Office/i] },
  { id: "court", name: "最高人民法院", patterns: [/最高人民法院|最高法|Supreme People's Court/i] },
  { id: "ggzy", name: "全国公共资源交易平台", patterns: [/全国公共资源交易平台/i] },
  { id: "szgxj", name: "深圳工信局", patterns: [/深圳市工业和信息化局|深圳工信局/i] },
  { id: "szfb", name: "深圳财政局", patterns: [/深圳市财政局|深圳财政局/i] },
  { id: "nafmii", name: "交易商协会", patterns: [/中国银行间市场交易商协会|交易商协会|NAFMII/i] },
  { id: "amac", name: "基金业协会", patterns: [/中国证券投资基金业协会|基金业协会|AMAC/i] },
  { id: "bis", name: "美国工业与安全局", patterns: [/美国工业与安全局|Bureau of Industry and Security/i] },
  { id: "ofac", name: "美国财政部OFAC", patterns: [/美国财政部OFAC|Office of Foreign Assets Control|OFAC/i] },
  { id: "ustr", name: "美国贸易代表办公室", patterns: [/美国贸易代表办公室|Office of the United States Trade Representative|USTR/i] },
  { id: "pbc", name: "中国人民银行", patterns: [/中国人民银行|人民银行|PBOC/i] },
  { id: "csrc", name: "中国证监会", patterns: [/中国证监会|证监会|CSRC/i] },
  { id: "nfra", name: "金融监管总局", patterns: [/国家金融监督管理总局|金融监管总局|NFRA/i] },
  { id: "safe", name: "国家外汇管理局", patterns: [/国家外汇管理局|外汇局|SAFE/i] },
  { id: "stats", name: "国家统计局", patterns: [/国家统计局|NBS/i] },
  { id: "sse", name: "上交所", patterns: [/上海证券交易所|上交所|SSE/i] },
  { id: "szse", name: "深交所", patterns: [/深圳证券交易所|深交所|SZSE/i] },
  { id: "hkex", name: "港交所", patterns: [/香港交易所|港交所|HKEX/i] },
  { id: "hkma", name: "香港金管局", patterns: [/香港金融管理局|香港金管局|HKMA/i] },
  { id: "fed", name: "美联储", patterns: [/美联储|Federal\ Reserve|FOMC/i] },
  { id: "ecb", name: "欧洲央行", patterns: [/欧洲央行|European\ Central\ Bank|ECB/i] },
];
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [{"entityId": "pbc", "domains": ["pbc.gov.cn"]}, {"entityId": "csrc", "domains": ["csrc.gov.cn"]}, {"entityId": "nfra", "domains": ["nfra.gov.cn"]}, {"entityId": "safe", "domains": ["safe.gov.cn"]}, {"entityId": "stats", "domains": ["stats.gov.cn"]}, {"entityId": "sse", "domains": ["sse.com.cn"]}, {"entityId": "szse", "domains": ["szse.cn"]}, {"entityId": "hkex", "domains": ["hkex.com.hk"]}, {"entityId": "hkma", "domains": ["hkma.gov.hk"]}, {"entityId": "fed", "domains": ["federalreserve.gov"]}, {"entityId": "ecb", "domains": ["ecb.europa.eu"]}, {"entityId": "mof", "domains": ["mof.gov.cn"]}, {"entityId": "ndrc", "domains": ["ndrc.gov.cn"]}, {"entityId": "miit", "domains": ["miit.gov.cn"]}, {"entityId": "mofcom", "domains": ["mofcom.gov.cn"]}, {"entityId": "sat", "domains": ["chinatax.gov.cn"]}, {"entityId": "samr", "domains": ["samr.gov.cn"]}, {"entityId": "mee", "domains": ["mee.gov.cn"]}, {"entityId": "audit", "domains": ["audit.gov.cn"]}, {"entityId": "court", "domains": ["court.gov.cn"]}, {"entityId": "ggzy", "domains": ["ggzy.gov.cn"]}, {"entityId": "szgxj", "domains": ["gxj.sz.gov.cn"]}, {"entityId": "szfb", "domains": ["szfb.sz.gov.cn"]}, {"entityId": "nafmii", "domains": ["nafmii.org.cn"]}, {"entityId": "amac", "domains": ["amac.org.cn"]}, {"entityId": "bis", "domains": ["bis.gov"]}, {"entityId": "ofac", "domains": ["ofac.treasury.gov"]}, {"entityId": "ustr", "domains": ["ustr.gov"]}];
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [];
