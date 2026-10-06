import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getRawDb } from "@/db";
import { MAX_ACCOUNT_BYTES, MAX_RECORDS, parseBackup, validateExperiment } from "@/lib/experiments";

export const dynamic = "force-dynamic";
const noCache = { "Cache-Control": "no-store" };

async function authenticatedUser(request: Request, mutation = false) {
  if (mutation) {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return null;
  }
  return getChatGPTUser();
}

function unavailable(error: unknown) {
  console.error("Experiment storage failed", error);
  return Response.json({ error: "记录服务暂时不可用。你的输入仍保留，请稍后重试。" }, { status: 503, headers: noCache });
}

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return Response.json({ error: "登录后可读取和保存测试记录。" }, { status: 401, headers: noCache });
  try {
    const { results } = await getRawDb().prepare("SELECT id, model, prompt, output, created_at AS createdAt FROM experiments WHERE user_id = ? ORDER BY created_at DESC, id DESC").bind(user.userId).all();
    return Response.json({ records: results }, { headers: noCache });
  } catch (error) { return unavailable(error); }
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request, true);
  if (!user) return Response.json({ error: "请先登录，再保存记录。" }, { status: 401 });
  let records;
  try {
    const body = await request.text();
    if (body.length > 12_000_000) throw new Error("文件过大，请分批导入。");
    const payload = JSON.parse(body);
    records = "records" in payload ? parseBackup(payload) : [validateExperiment(payload)];
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "记录格式不正确。" }, { status: 400 });
  }
  try {
    const db = getRawDb();
    const existing = await db.prepare("SELECT id, length(CAST(model AS BLOB)) + length(CAST(prompt AS BLOB)) + length(CAST(output AS BLOB)) AS bytes FROM experiments WHERE user_id = ?").bind(user.userId).all<{ id: string; bytes: number }>();
    const ids = new Set(existing.results.map((row) => row.id));
    const fresh = records.filter((record) => !ids.has(record.id));
    if (existing.results.length + fresh.length > MAX_RECORDS) return Response.json({ error: `最多保存 ${MAX_RECORDS} 条记录，请先导出备份再整理。` }, { status: 409 });
    const bytes = (record: typeof fresh[number]) => new TextEncoder().encode(record.model + record.prompt + record.output).length;
    if (existing.results.reduce((total, row) => total + row.bytes, 0) + fresh.reduce((total, row) => total + bytes(row), 0) > MAX_ACCOUNT_BYTES) return Response.json({ error: "记录总内容超过 10 MB，请先导出备份再整理。" }, { status: 409 });
    const inserted = fresh.length ? await db.batch(fresh.map((record) => db.prepare("INSERT OR IGNORE INTO experiments (id, user_id, model, prompt, output, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM experiments WHERE user_id = ?) < ? AND (SELECT COALESCE(SUM(length(CAST(model AS BLOB)) + length(CAST(prompt AS BLOB)) + length(CAST(output AS BLOB))), 0) FROM experiments WHERE user_id = ?) + ? <= ?").bind(record.id, user.userId, record.model, record.prompt, record.output, record.createdAt, user.userId, MAX_RECORDS, user.userId, bytes(record), MAX_ACCOUNT_BYTES))) : [];
    const added = inserted.reduce((total, result) => total + (result.meta.changes || 0), 0);
    if (added < fresh.length) return Response.json({ error: `已保存 ${added} 条记录，其余可能已由另一个标签页保存或达到存储上限。请刷新后重试。` }, { status: 409, headers: noCache });
    return Response.json({ added }, { status: 201, headers: noCache });
  } catch (error) { return unavailable(error); }
}

export async function DELETE(request: Request) {
  const user = await authenticatedUser(request, true);
  if (!user) return Response.json({ error: "请先登录。" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || id.length > 200) return Response.json({ error: "请选择要删除的记录。" }, { status: 400 });
  try {
    await getRawDb().prepare("DELETE FROM experiments WHERE id = ? AND user_id = ?").bind(id, user.userId).run();
    return Response.json({ deleted: true }, { headers: noCache });
  } catch (error) { return unavailable(error); }
}
