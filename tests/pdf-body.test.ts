import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { pdfBody } from '@aihot/backend/content/extract';

test('PDF disclosure retains all pages and escapes markup in the extracted body', async () => {
  const body = await pdfBody(readFileSync(new URL('./fixtures/disclosure.pdf', import.meta.url)));
  assert.equal(body?.via, 'pdf');
  assert.match(body!.text, /Revenue increased 12 percent/);
  assert.match(body!.text, /Second page/);
  assert.ok(!body!.html.includes('<script>'));
  assert.ok(body!.html.includes('&lt;script&gt;'));
});

test('invalid PDF data does not become a publishable body', async () => {
  await assert.rejects(pdfBody(Buffer.from('not a PDF')));
});
