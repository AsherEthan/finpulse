// Literal, XML-escaped CDATA wrappers should work like real CDATA, without a second HTML decode.
import assert from "node:assert/strict";
import http from "node:http";
import { after, test } from "node:test";
import { config } from "@aihot/backend/config";
import { escapeXml } from "@aihot/backend/lib/text";
import { fetchRss } from "@aihot/backend/sources/rss";

const body = `<p>Before <strong>bold</strong>, between <em>italic</em>, after.</p><p>${"The industrial production index and capacity utilization figures are preliminary estimates. ".repeat(5)}</p><p><a href="https://www.federalreserve.gov/releases/g17/20260918/default.htm">August 2026 report</a> &lt;img src=x onerror=alert(1)&gt;</p>`;
const literal = (html: string) => escapeXml(`<![CDATA[${html}]]>`);
const rss = (description: string) => `<rss version="2.0"><channel><title>Feed</title><item><title>Industrial production update</title><link>https://example.org/report</link><pubDate>Fri, 18 Sep 2026 13:15:00 GMT</pubDate><description>${description}</description></item></channel></rss>`;
const atom = (content: string) => `<feed xmlns="http://www.w3.org/2005/Atom"><id>urn:test:feed</id><title>Feed</title><entry><id>urn:test:entry</id><title>Industrial production update</title><updated>2026-09-18T13:15:00Z</updated><link href="https://example.org/report"/><content type="html">${content}</content></entry></feed>`;
const rdf = `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>G.17</title></channel>${["3951", "3942"].map((id, i) => `<item><title>G.17 Data for ${i ? "July" : "August"} 2026 are now available</title><link>http://www.federalreserve.gov/feeds/G17.html#${id}</link><description>${literal(i ? body.replace("August", "July").replace("20260918", "20260818") : body)}</description><dc:date>${i ? "2026-08-18" : "2026-09-18"}T09:15:00-04:00</dc:date></item>`).join("")}</rdf:RDF>`;
const pages: Record<string, string> = {
  "/rdf": rdf,
  "/rss-literal": rss(literal(body)),
  "/rss-cdata": rss(`<![CDATA[${body}]]>`),
  "/rss-mixed": rss(body),
  "/rdf-mixed": `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>G.17</title></channel><item><title>G.17 Data for August 2026 are now available</title><link>http://www.federalreserve.gov/feeds/G17.html#3951</link><description>First before.${body}Last after.</description><dc:date>2026-09-18T09:15:00-04:00</dc:date></item></rdf:RDF>`,
  "/atom-literal": atom(literal(body)),
  "/atom-html": atom(escapeXml(body)),
  "/atom-cdata": atom(`<![CDATA[${body}]]>`),
  "/incomplete": rss(escapeXml(`<![CDATA[${body}`)),
  "/separate": rss(escapeXml(`<![CDATA[${body}]]> outside <![CDATA[${body}]]>`)),
};
const requests: string[] = [];
const server = http.createServer((req, res) => {
  requests.push(req.url!);
  res.setHeader("content-type", "application/xml");
  res.end(pages[req.url!] ?? "<not-feed/>");
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const root = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const previousPrivateFetch = config.allowPrivateNetworkFetch;
config.allowPrivateNetworkFetch = true;
after(async () => {
  config.allowPrivateNetworkFetch = previousPrivateFetch;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function read(path: string, summaryIsBody = true) {
  return (await fetchRss({ config: { feedUrl: root + path, summaryIsBody, preserveUrlFragment: true }, participation_mode: "editorial" } as never)).candidates;
}

test("RDF escaped CDATA supplies only the feed body and keeps dated release links and distinct anchors", async () => {
  const before = requests.length;
  const items = await read("/rdf");
  assert.equal(items.length, 2);
  assert.equal(requests.length - before, 1, "reading the feed does not fetch its aggregate page");
  assert.deepEqual(items.map((item) => item.identityKey), ["url:https://federalreserve.gov/feeds/G17.html#3951", "url:https://federalreserve.gov/feeds/G17.html#3942"]);
  assert.equal(items[0]!.publishedAt!.toISOString(), "2026-09-18T13:15:00.000Z");
  assert.equal(items[0]!.bodyStatus, "ok");
  assert.match(items[0]!.bodyHtml!, /href="https:\/\/www\.federalreserve\.gov\/releases\/g17\/20260918\/default\.htm"/);
  assert.match(items[1]!.bodyHtml!, /href="https:\/\/www\.federalreserve\.gov\/releases\/g17\/20260818\/default\.htm"/);
  assert.doesNotMatch(items[1]!.bodyText!, /August/);
  assert.doesNotMatch(items[0]!.bodyHtml!, /\/current\/|<!\[CDATA\[|\]\]>/);
});

test("RSS literal CDATA matches real CDATA without decoding escaped markup into elements", async () => {
  const [literalItem] = await read("/rss-literal");
  const [realItem] = await read("/rss-cdata");
  assert.equal(literalItem!.bodyStatus, "ok");
  assert.equal(literalItem!.bodyHtml, realItem!.bodyHtml);
  assert.equal(literalItem!.bodyText, realItem!.bodyText);
  assert.equal(literalItem!.excerpt, realItem!.excerpt);
  assert.match(literalItem!.bodyHtml!, /&lt;img/);
  assert.doesNotMatch(literalItem!.bodyHtml!, /<img|onerror="/);
});

test("Atom literal CDATA keeps the same mixed content as escaped HTML and real CDATA", async () => {
  const [item] = await read("/atom-literal");
  assert.equal(item!.bodyStatus, "ok");
  assert.match(item!.bodyHtml!, /Before <strong>bold<\/strong>, between <em>italic<\/em>, after\./);
  for (const path of ["/atom-html", "/atom-cdata"]) {
    const [control] = await read(path);
    assert.equal(item!.bodyHtml, control!.bodyHtml);
    assert.equal(item!.bodyText, control!.bodyText);
  }
});

test("nested RSS HTML matches real CDATA and RDF mixed text stays in order without unsafe decoding", async () => {
  const [mixed] = await read("/rss-mixed");
  const [control] = await read("/rss-cdata");
  assert.equal(mixed!.bodyStatus, "ok");
  assert.equal(mixed!.bodyHtml, control!.bodyHtml);
  assert.equal(mixed!.bodyText, control!.bodyText);
  const [rdfItem] = await read("/rdf-mixed");
  assert.equal(rdfItem!.bodyStatus, "ok");
  assert.match(rdfItem!.bodyText!, /^First before\. Before bold\s*, between italic\s*, after\./);
  assert.match(rdfItem!.bodyText!, /Last after\.$/);
  assert.match(rdfItem!.bodyHtml!, /&lt;img/);
  assert.doesNotMatch(rdfItem!.bodyHtml!, /<img|<script|onerror="/);
  assert.match(rdfItem!.bodyHtml!, /\/g17\/20260918\/default\.htm/);
});

test("incomplete wrappers and separate CDATA sections do not become a confirmed feed body", async () => {
  for (const path of ["/incomplete", "/separate"]) {
    const [item] = await read(path);
    assert.equal(item!.bodyHtml, null);
    assert.equal(item!.bodyStatus, "pending");
  }
});

test("a cleaned RSS description remains a summary unless the source explicitly marks it as body", async () => {
  const [item] = await read("/rss-literal", false);
  assert.equal(item!.bodyHtml, null);
  assert.equal(item!.bodyStatus, "pending");
  assert.match(item!.excerpt!, /capacity utilization/);
  assert.doesNotMatch(item!.excerpt!, /<!\[CDATA\[|\]\]>/);
});
