import assert from "node:assert/strict";
import { test } from "node:test";
import { extractOutput, parseBackup, validateExperiment } from "../lib/experiments.ts";

const record = { id: "test-1", model: "Test model", prompt: "Draw a pelican", output: "Original answer", createdAt: "2026-10-06T12:00:00Z" };

test("extracts fenced SVG without dropping the saved answer", () => {
  const raw = 'Here it is:\n```svg\n<svg viewBox="0 0 100 100"><circle r="20"/></svg>\n```\nEnd of answer.';
  assert.deepEqual(extractOutput(raw), { kind: "SVG", code: '<svg viewBox="0 0 100 100"><circle r="20"/></svg>' });
  assert.equal(validateExperiment({ ...record, output: raw }).output, raw);
});

test("keeps full HTML documents and HTML fragments containing SVG", () => {
  const html = '<!doctype html><html><body><h1>Result</h1><svg></svg></body></html>';
  assert.deepEqual(extractOutput(`Explanation\n\`\`\`html\n${html}\n\`\`\``), { kind: "HTML", code: html });
  assert.equal(extractOutput('```html\n<div><svg></svg></div>\n```').kind, "HTML");
  assert.equal(extractOutput("An ordinary text answer"), null);
});

test("backup round trip preserves content and rejects malformed or duplicate records", () => {
  const backup = { version: 1, records: [record] };
  const restored = parseBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(restored[0].output, record.output);
  assert.equal(restored[0].createdAt, "2026-10-06T12:00:00.000Z");
  assert.throws(() => parseBackup({ version: 2, records: [record] }));
  assert.throws(() => parseBackup({ version: 1, records: [record, record] }));
  assert.throws(() => validateExperiment({ ...record, output: "x".repeat(250001) }));
  assert.throws(() => validateExperiment({ ...record, createdAt: "invalid" }));
});
