// Import reviewed facts for existing material. Run without --apply to inspect the entire batch first.
// node --env-file=.env scripts/import-policy-facts.ts reviewed.json [--apply]
import { readFileSync } from "node:fs";
import { z } from "zod";
import { closeDb, sql } from "@aihot/backend/db";
import { overrideFields } from "@aihot/backend/admin/content";
import { PolicyFactsSchema } from "@aihot/backend/content/policy";
import { normalizeUrl } from "@aihot/backend/lib/url";
import { stopBoss } from "@aihot/backend/jobs/queue";

const filename = process.argv.slice(2).find((value) => !value.startsWith("--"));
if (!filename) throw new Error("Provide a reviewed JSON file; add --apply to save it");
const rows = z.array(z.object({
  url: z.url(),
  revision: z.number().int().positive(),
  policy: PolicyFactsSchema,
  reason: z.string().trim().min(1),
}).strict()).min(1).parse(JSON.parse(readFileSync(filename, "utf8")));

try {
  const checked = [];
  const identities = new Set<string>();
  for (const row of rows) {
    const matches = await sql<{ id: string; revision: number; title: string; version: number }[]>`
      SELECT a.id, a.revision, a.title, coalesce(o.version, 0) AS version
      FROM articles a LEFT JOIN editorial_overrides o ON o.article_id = a.id
      WHERE a.url IN (${row.url}, ${normalizeUrl(row.url)})`;
    if (matches.length !== 1) throw new Error(`Expected one existing article for ${row.url}`);
    const article = matches[0]!;
    if (article.revision !== row.revision) throw new Error(`Review is stale: ${article.id} revision ${article.revision}`);
    if (row.policy.sourceRevision !== undefined && row.policy.sourceRevision !== row.revision) throw new Error(`Fact revision does not match review: ${article.id}`);
    if (identities.has(article.id)) throw new Error(`Duplicate article in batch: ${article.id}`);
    identities.add(article.id);
    checked.push({ row, article });
  }
  for (const { row, article } of checked) {
    if (process.argv.includes("--apply")) {
      await overrideFields(article.id, { fields: { policy: { ...row.policy, sourceRevision: row.revision } }, reason: row.reason, version: article.version }, "policy-facts-import");
    }
    console.log(JSON.stringify({ id: article.id, title: article.title, applied: process.argv.includes("--apply") }));
  }
} finally {
  await stopBoss();
  await closeDb();
}
