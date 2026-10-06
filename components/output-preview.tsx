"use client";

import { useEffect, useState } from "react";
import { CodeXml } from "lucide-react";
import { createPreview, extractOutput } from "@/lib/experiments";

export function OutputPreview({ output, title, compact = false }: { output: string; title: string; compact?: boolean }) {
  const [document, setDocument] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setDocument("");
    setError("");
    const extracted = extractOutput(output);
    if (!extracted) { setError("未找到 SVG 或 HTML。原始回答仍可保存。"); return; }
    try { setDocument(createPreview(extracted)); }
    catch (error) { setError(error instanceof Error ? error.message : "无法预览这份回答。"); }
  }, [output]);
  if (error) return <div className="preview-empty" role="status"><CodeXml size={32} /><p>{error}</p></div>;
  if (!document) return <div className="preview-empty" role="status">正在准备预览…</div>;
  return <iframe key={document} className={`output-frame${compact ? " compact" : ""}`} title={title} srcDoc={document} sandbox="" referrerPolicy="no-referrer" />;
}
