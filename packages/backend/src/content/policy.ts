import { z } from "zod";
import type { PolicyFacts } from "@aihot/contracts/site";
import { ARTICLE_ID_PATTERN } from "@aihot/contracts/taxonomy";

const text = (max: number) => z.string().trim().min(1).max(max);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const at = new Date(value);
  return Number.isFinite(at.getTime()) && at.toISOString().slice(0, 10) === value;
}, "请输入有效日期 YYYY-MM-DD");
const url = z.string().url().max(2000).refine((value) => {
  const parsed = new URL(value);
  return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password;
}, "只允许公开 HTTP / HTTPS 原文链接");
const link = z.object({ title: text(300), url }).strict();

/** A document's process stage, legal effect and implementation evidence are independent. */
export const PolicyFactsSchema = z.object({
  sourceRevision: z.number().int().positive().optional(),
  verifiedAt: date.optional(),
  documentNumber: text(150).optional(),
  issuers: z.array(text(100)).max(20).default([]),
  documentType: text(60).optional(),
  region: text(60).optional(),
  stage: z.enum(["政策计划", "征求意见", "意见反馈", "正式文件", "配套细则"]).optional(),
  legalStatus: z.enum(["待生效", "现行", "部分失效", "已废止", "未知"]).optional(),
  legalStatusAsOf: date.optional(),
  implementationStatus: z.enum(["未核实", "已启动", "有执行证据", "已评估"]).optional(),
  issuedAt: date.optional(),
  effectiveAt: date.optional(),
  deadlines: z.array(z.object({ label: text(100), date }).strict()).max(20).default([]),
  scope: text(2000).optional(),
  keyPoints: z.array(text(1000)).max(30).default([]),
  attachments: z.array(link).max(30).default([]),
  relations: z.array(link.extend({ kind: text(60), articleId: z.string().regex(ARTICLE_ID_PATTERN).optional() }).strict()).max(50).default([]),
  changeNotes: z.array(text(1500)).max(30).default([]),
  evidenceNotes: z.array(text(1500)).max(30).default([]),
}).strict();

/** Tolerate an old projection but never expose malformed editor input. */
export function policyFacts(value: unknown): PolicyFacts | null {
  const parsed = PolicyFactsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Internal article relationships are resolved against the current public scope on detail reads. */
export function publicPolicyFacts(value: unknown): PolicyFacts | null {
  const facts = policyFacts(value);
  return facts ? { ...facts, relations: facts.relations.filter((relation) => !relation.articleId) } : null;
}
