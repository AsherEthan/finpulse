import "./setup.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { nfraDocumentBody, nfraDocumentUrl } from "@aihot/backend/content/nfra";

test("NFRA document mapping accepts only official article pages and a numeric document id", () => {
  assert.equal(nfraDocumentUrl("https://www.nfra.gov.cn/cn/view/pages/rulesDetail.html?docId=1273763"), "https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1273763");
  assert.equal(nfraDocumentUrl("https://www.nfra.gov.cn/cn/view/pages/governmentDetail.html?docId=1273763&itemId=4215"), "https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1273763");
  for (const url of ["https://www.nfra.gov.cn.evil.example/cn/view/pages/rulesDetail.html?docId=1", "http://www.nfra.gov.cn/cn/view/pages/rulesDetail.html?docId=1", "https://www.nfra.gov.cn/cn/view/pages/rulesDetail.html?docId=https://localhost/", "https://www.nfra.gov.cn/other.html?docId=1"]) assert.equal(nfraDocumentUrl(url), null);
});

test("NFRA JSON yields only the document body through the normal sanitizer, never metadata or an empty template", () => {
  const paragraph = "本测试文件说明虚构的金融规则适用范围、执行步骤和报告义务。".repeat(12);
  const body = nfraDocumentBody({ data: { docClob: `<p>${paragraph}</p><script>steal()</script>`, docTitle: "METADATA-ONLY" } }, "https://www.nfra.gov.cn/cn/view/pages/rulesDetail.html?docId=1");
  assert.ok(body?.text.includes(paragraph));
  assert.ok(!body?.html.includes("steal") && !body?.text.includes("METADATA-ONLY"));
  for (const data of [null, {}, { data: { docClob: 42 } }, { data: { docClob: "" } }, { data: { docTitle: paragraph } }]) assert.equal(nfraDocumentBody(data, "https://www.nfra.gov.cn/"), null);
});
