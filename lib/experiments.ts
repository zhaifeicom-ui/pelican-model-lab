export const DEFAULT_PROMPT = "Generate an SVG of a pelican riding a bicycle";
export const MAX_OUTPUT_LENGTH = 250_000;
export const MAX_RECORDS = 200;
export const MAX_ACCOUNT_BYTES = 10_000_000;

export type Experiment = {
  id: string;
  model: string;
  prompt: string;
  output: string;
  createdAt: string;
};

export function validateExperiment(value: unknown): Experiment {
  if (!value || typeof value !== "object") throw new Error("记录格式不正确。");
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(record.id)) throw new Error("记录 ID 不正确。");
  if (typeof record.model !== "string" || !record.model.trim() || record.model.length > 100) throw new Error("模型名称需要 1–100 个字符。");
  if (typeof record.prompt !== "string" || !record.prompt.trim() || record.prompt.length > 10_000) throw new Error("提示词需要 1–10,000 个字符。");
  if (typeof record.output !== "string" || !record.output.trim() || record.output.length > MAX_OUTPUT_LENGTH) throw new Error("模型回答需要 1–250,000 个字符。");
  if (typeof record.createdAt !== "string" || !Number.isFinite(Date.parse(record.createdAt))) throw new Error("记录时间不正确。");
  return { id: record.id, model: record.model.trim(), prompt: record.prompt, output: record.output, createdAt: new Date(record.createdAt).toISOString() };
}

export function parseBackup(value: unknown): Experiment[] {
  if (!value || typeof value !== "object") throw new Error("请选择实验室导出的 JSON 文件。");
  const backup = value as Record<string, unknown>;
  if (backup.version !== 1 || !Array.isArray(backup.records)) throw new Error("不支持的备份格式，请使用版本 1 的实验室备份。");
  if (backup.records.length > MAX_RECORDS) throw new Error(`每份备份最多 ${MAX_RECORDS} 条记录。`);
  const records = backup.records.map(validateExperiment);
  if (new Set(records.map((record) => record.id)).size !== records.length) throw new Error("备份包含重复的记录 ID。");
  return records;
}

export type ExtractedOutput = { kind: "SVG" | "HTML"; code: string };

export function extractOutput(raw: string): ExtractedOutput | null {
  const fences = [...raw.matchAll(/```[^\r\n]*\r?\n([\s\S]*?)```/g)].map((match) => match[1].trim());
  for (const candidate of [...fences, raw.trim()]) {
    const html = candidate.match(/(?:<!doctype\s+html[^>]*>\s*)?<html\b[\s\S]*?<\/html\s*>/i);
    if (html) return { kind: "HTML", code: html[0] };
    const svg = candidate.match(/<svg\b[\s\S]*?<\/svg\s*>/i);
    // A fenced HTML fragment containing SVG is still an HTML result.
    if (svg && !/^<(?:div|main|section|style|body|article|header|footer|head)\b/i.test(candidate)) return { kind: "SVG", code: svg[0] };
    if (/^(?:<!doctype\s+html|<(?:div|main|section|style|body|article|header|footer|head|h[1-6]|p|canvas|table|button|ul|ol)\b)/i.test(candidate)) return { kind: "HTML", code: candidate };
  }
  return null;
}

// Only used inside a sandboxed iframe; raw answers never enter the parent DOM.
export function createPreview(result: ExtractedOutput): string {
  if (result.kind === "SVG") {
    const xml = new DOMParser().parseFromString(result.code, "image/svg+xml");
    if (xml.querySelector("parsererror")) throw new Error("SVG 标签不完整或格式有误；可以保存原文，修正后再预览。");
  }
  const doc = new DOMParser().parseFromString(result.code, "text/html");
  doc.querySelectorAll("script,iframe,object,embed,link,meta,base,form").forEach((node) => node.remove());
  doc.querySelectorAll("*").forEach((node) => {
    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on") || name === "srcdoc" || name === "action" ||
        (["href", "xlink:href", "src", "poster"].includes(name) && !value.startsWith("#") && !/^data:image\//i.test(value))) node.removeAttribute(attribute.name);
    }
  });
  if (result.kind === "SVG") {
    const svg = doc.querySelector("svg");
    if (svg && !svg.hasAttribute("viewBox")) {
      const width = svg.getAttribute("width") || "300";
      const height = svg.getAttribute("height") || "150";
      if (/^\d+(\.\d+)?(px)?$/.test(width) && /^\d+(\.\d+)?(px)?$/.test(height)) svg.setAttribute("viewBox", `0 0 ${parseFloat(width)} ${parseFloat(height)}`);
    }
  }
  const csp = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
  const styles = [...doc.head.querySelectorAll("style")].map((node) => node.outerHTML).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>html,body{margin:0;min-height:100%;}body{font-family:system-ui,sans-serif;}body>svg{display:block;width:100%;height:100vh;margin:auto;}*{box-sizing:border-box;}</style>${styles}</head><body>${doc.body.innerHTML}</body></html>`;
}
