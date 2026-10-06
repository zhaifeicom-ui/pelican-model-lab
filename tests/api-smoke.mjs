import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Only runs against the portable loopback development server and removes its own fixtures.
const origin = "http://127.0.0.1:5173";
const endpoint = `${origin}/api/experiments`;
const cookie = "__sites_local_auth=1";
const id = `smoke-${randomUUID()}`;
const record = { id, model: "API smoke fixture", prompt: "Test preservation", output: 'Explanation\n```svg\n<svg xmlns="http://www.w3.org/2000/svg"></svg>\n```\nTail', createdAt: new Date().toISOString() };
const headers = { Cookie: cookie, Origin: origin, "Content-Type": "application/json" };

try {
  assert.equal((await fetch(endpoint)).status, 401, "anonymous reads must be rejected");
  assert.equal((await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record) })).status, 401);
  assert.ok([401, 403].includes((await fetch(endpoint, { method: "POST", headers: { ...headers, Origin: "https://other.example" }, body: JSON.stringify(record) })).status), "cross-origin mutation must be rejected");
  assert.equal((await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ ...record, createdAt: "bad" }) })).status, 400);
  const created = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(record) });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).added, 1);
  const rows = (await (await fetch(endpoint, { headers: { Cookie: cookie } })).json()).records;
  assert.equal(rows.find((row) => row.id === id).output, record.output, "the entire answer must survive storage");
  const imported = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ version: 1, records: [record] }) });
  assert.equal(imported.status, 201);
  assert.equal((await imported.json()).added, 0, "importing a saved record must not duplicate it");
  const removed = await fetch(`${endpoint}?id=${id}`, { method: "DELETE", headers });
  assert.equal(removed.status, 200);
  const remaining = (await (await fetch(endpoint, { headers: { Cookie: cookie } })).json()).records;
  assert.equal(remaining.some((row) => row.id === id), false);
  console.log("API checks passed: authentication, origin checks, validation, save/load, idempotent import, and deletion.");
} finally {
  await fetch(`${endpoint}?id=${id}`, { method: "DELETE", headers });
}
