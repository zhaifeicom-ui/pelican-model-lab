"use client";

import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import { Beaker, Check, CodeXml, Copy, Download, Eye, FileJson, FlaskConical, LayoutGrid, Loader2, Plus, Search, SlidersHorizontal, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/sonner";
import { OutputPreview } from "./output-preview";
import { DEFAULT_PROMPT, MAX_OUTPUT_LENGTH, MAX_RECORDS, extractOutput, parseBackup, type Experiment } from "@/lib/experiments";
import { DEMO_SVG } from "@/lib/demo";

function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function date(value: string) { return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }); }

async function api(method: string, payload?: unknown, id?: string) {
  const response = await fetch(`/api/experiments${id ? `?id=${encodeURIComponent(id)}` : ""}`, { method, headers: payload ? { "Content-Type": "application/json" } : undefined, body: payload ? JSON.stringify(payload) : undefined });
  const data = await response.json() as { error?: string; records: Experiment[]; added: number };
  if (!response.ok) throw new Error(data.error || "操作失败，请稍后重试。");
  return data;
}

export function ModelLab({ signedIn }: { signedIn: boolean }) {
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [output, setOutput] = useState("");
  const [records, setRecords] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(signedIn);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Experiment | null>(null);
  const [deleting, setDeleting] = useState<Experiment | null>(null);
  const [clearDraft, setClearDraft] = useState(false);
  const [section, setSection] = useState("workbench");
  const [view, setView] = useState("preview");
  const fileInput = useRef<HTMLInputElement>(null);
  const draftId = useRef<string | null>(null);
  const deferredOutput = useDeferredValue(output);
  const extracted = extractOutput(deferredOutput);
  const displayedOutput = deferredOutput.trim() ? deferredOutput : DEMO_SVG;
  const comparison = records.filter((record) => selected.includes(record.id));
  const visibleRecords = records.filter((record) => {
    const kind = extractOutput(record.output)?.kind || "TEXT";
    return (filter === "all" || kind === filter) && `${record.model} ${record.prompt} ${record.output}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  });

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    setLoading(true);
    try { const data = await api("GET"); setRecords(data.records); setLoadError(""); }
    catch (error) { setLoadError(error instanceof Error ? error.message : "无法读取记录。"); }
    finally { setLoading(false); }
  }, [signedIn]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Drafts are device-local; saved experiments use the account's database.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("pelican-draft-v1");
      if (stored) {
        const draft = JSON.parse(stored);
        if (typeof draft.model === "string" && typeof draft.prompt === "string" && typeof draft.output === "string" && draft.output.length <= MAX_OUTPUT_LENGTH) {
          setModel(draft.model); setPrompt(draft.prompt); setOutput(draft.output);
        }
      }
    } catch { /* A draft cache is optional. */ }
  }, []);

  function updateDraft(next: { model?: string; prompt?: string; output?: string }) {
    const value = { model: next.model ?? model, prompt: next.prompt ?? prompt, output: next.output ?? output };
    setModel(value.model); setPrompt(value.prompt); setOutput(value.output);
    draftId.current = null;
    try { sessionStorage.setItem("pelican-draft-v1", JSON.stringify(value)); } catch { /* Keep input in memory when storage is unavailable. */ }
  }

  async function copy(content: string) {
    try { await navigator.clipboard.writeText(content); toast.success("已复制"); }
    catch { toast.error("无法使用剪贴板，请手动选择并复制。"); }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!signedIn) { toast.error("请先登录，草稿会留在当前标签页。"); return; }
    setBusy(true);
    draftId.current ??= crypto.randomUUID();
    const record = { id: draftId.current, model, prompt, output, createdAt: new Date().toISOString() };
    try { await api("POST", record); toast.success("测试记录已保存"); await refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "保存失败"); }
    finally { setBusy(false); }
  }

  async function importRecords(file: File | undefined) {
    if (!file) return;
    if (!signedIn) { toast.error("请先登录，再导入记录。"); return; }
    if (file.size > 64_000_000) { toast.error("文件过大，请选择小于 64 MB 的 JSON 备份。"); return; }
    setBusy(true);
    let added = 0;
    try {
      const imported = parseBackup(JSON.parse(await file.text()));
      for (let start = 0; start < imported.length; start += 4) {
        const result = await api("POST", { version: 1, records: imported.slice(start, start + 4) });
        added += result.added;
      }
      toast.success(`已导入 ${added} 条记录，已有记录不会重复导入。`);
      await refresh();
    } catch (error) { toast.error(`${added ? `已导入 ${added} 条。` : ""}${error instanceof Error ? error.message : "导入失败"} 可重新导入，已保存的记录不会重复。`); await refresh(); }
    finally { setBusy(false); }
  }

  async function removeRecord() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api("DELETE", undefined, deleting.id);
      setRecords((items) => items.filter((record) => record.id !== deleting.id));
      setSelected((ids) => ids.filter((id) => id !== deleting.id));
      toast.success("记录已删除"); setDeleting(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "删除失败"); }
    finally { setBusy(false); }
  }

  function toggleCompare(id: string) {
    if (selected.includes(id)) setSelected((ids) => ids.filter((item) => item !== id));
    else if (selected.length < 3) setSelected((ids) => [...ids, id]);
    else toast.info("一次最多并排查看 3 条记录。");
  }

  return <div className="lab-app">
    <Toaster theme="light" position="bottom-right" />
    <header className="masthead">
      <a className="brand" href="/" aria-label="鹈鹕实验室首页"><img src="/favicon.svg" width="40" height="40" alt="" /><span>鹈鹕实验室<small>PELICAN MODEL LAB</small></span></a>
      <div className="header-actions"><span className="header-note">观察输出，保留每一次实验。</span><a className="github-link" href="https://github.com/zhaifeicom-ui/pelican-model-lab" target="_blank" rel="noreferrer">GitHub</a>{!signedIn && <Button asChild><a href="/signin-with-chatgpt?return_to=%2F" target="_top">登录保存记录</a></Button>}</div>
    </header>
    <main className="lab-main">
      <div className="page-intro"><div><div className="eyebrow"><FlaskConical size={15} /> THE PELICAN EXPERIMENT</div><h1>同一个问题，不同的想象。</h1><p>把模型的回答放到这里，让一只骑车的鹈鹕成为可回看的实验。</p></div><div className="intro-caption"><span>01 / 观察</span><span>02 / 记录</span><span>03 / 比较</span></div></div>
      <Tabs value={section} onValueChange={setSection} className="main-tabs">
        <div className="navigation-row"><TabsList variant="line"><TabsTrigger value="workbench"><Beaker />实验台</TabsTrigger><TabsTrigger value="records"><LayoutGrid />测试记录 <span className="count">{records.length}</span></TabsTrigger></TabsList><span className="storage-caption">{signedIn ? "记录保存在你的账号下" : "可先预览，登录后保存"}</span></div>
        <TabsContent value="workbench">
          <div className="workbench">
            <section className="input-panel">
              <div className="panel-heading"><h2><span className="step">01</span>新建实验</h2><Button variant="ghost" size="sm" disabled={busy || !output.trim()} onClick={() => setClearDraft(true)}><Plus />清空输入</Button></div>
              <form onSubmit={save} className="experiment-form">
                <div className="field"><label htmlFor="model">模型名称 <span>必填</span></label><Input id="model" placeholder="例如 Claude、GPT、Gemini…" value={model} maxLength={100} required onChange={(event) => updateDraft({ model: event.target.value })} /></div>
                <div className="field"><div className="field-label"><label htmlFor="prompt">提示词</label><Button variant="ghost" size="sm" type="button" onClick={() => void copy(prompt)}><Copy />复制提示词</Button></div><Textarea id="prompt" className="prompt-input" value={prompt} maxLength={10_000} required onChange={(event) => updateDraft({ prompt: event.target.value })} /><p className="field-hint">把提示词发给模型，再将完整回答粘贴到下方。</p></div>
                <div className="field output-field"><div className="field-label"><label htmlFor="output">模型原始回答</label><Button variant="ghost" size="sm" type="button" disabled={Boolean(output.trim())} onClick={() => updateDraft({ model: "手绘示例（非模型输出）", output: DEMO_SVG })}>载入示例</Button></div><Textarea id="output" className="code-input" placeholder={'在这里粘贴完整回答…\n\n支持 SVG、HTML 和 Markdown 代码块。\n说明文字也会保留在原始记录中。'} value={output} maxLength={MAX_OUTPUT_LENGTH} required onChange={(event) => updateDraft({ output: event.target.value })} /><div className="output-meta"><span>{output.trim() ? extracted ? <><Check size={13} />识别到 {extracted.kind}</> : "将保留为原始文本" : "等待模型回答"}</span><span>{output.length.toLocaleString()} / 250,000</span></div></div>
                <div className="form-footer"><span>保存模型、提示词、全文与时间</span><Button className="save-button" type="submit" disabled={busy || !model.trim() || !prompt.trim() || !output.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Plus />}保存测试</Button></div>
              </form>
            </section>
            <section className="preview-panel">
              <div className="panel-heading"><h2><span className="step">02</span>输出预览</h2><span className="format-badge">{output.trim() ? extracted?.kind || "TEXT" : "SVG 示例"}</span></div>
              <Tabs value={view} onValueChange={setView} className="preview-tabs"><div className="preview-toolbar"><TabsList><TabsTrigger value="preview"><Eye />渲染</TabsTrigger><TabsTrigger value="source"><CodeXml />提取代码</TabsTrigger></TabsList><Button variant="ghost" size="sm" disabled={!extracted} onClick={() => extracted && download(extracted.code, `pelican.${extracted.kind.toLowerCase()}`, "text/plain;charset=utf-8")}><Download />下载代码</Button></div><TabsContent value="preview"><div className="preview-canvas"><OutputPreview output={displayedOutput} title="当前回答的隔离预览" /></div></TabsContent><TabsContent value="source"><pre className="source-view">{extracted?.code || (output.trim() ? "未找到可渲染代码；原文会完整保存。" : DEMO_SVG)}</pre></TabsContent></Tabs>
              <div className="preview-caption"><span>{output.trim() ? "预览来自当前输入" : "手绘 SVG 演示 · 非模型测试结果"}</span><span>脚本与外部资源已禁用</span></div>
              <div className="experiment-note"><FlaskConical size={21} /><div><strong>一个小实验，很多种答案。</strong><p>这里展示模型的实际输出，不评分，也不自动判断模型能力。并排观察，保留你自己的发现。</p></div></div>
            </section>
          </div>
        </TabsContent>
        <TabsContent value="records">
          <div className="records-heading"><div><h2>每一次输出，都有迹可循。</h2><p>原始回答和提示词一起保存。选择 2–3 条记录，并排观察。</p></div><div className="record-tools"><Button variant="outline" disabled={busy || !signedIn} onClick={() => fileInput.current?.click()}><Upload />导入</Button><Button variant="outline" disabled={busy || loading || Boolean(loadError) || !records.length} onClick={() => download(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records }, null, 2), `pelican-records-${new Date().toISOString().slice(0, 10)}.json`, "application/json")}><Download />导出全部</Button><input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(event) => { void importRecords(event.target.files?.[0]); event.target.value = ""; }} /></div></div>
          <div className="filters"><div className="search-field"><Search size={17} /><Input aria-label="搜索测试记录" placeholder="搜索模型、提示词或回答…" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="format-filters" role="group" aria-label="按输出格式筛选"><SlidersHorizontal size={16} />{[["all", "全部"], ["SVG", "SVG"], ["HTML", "HTML"], ["TEXT", "文本"]].map(([value, label]) => <Button key={value} variant={filter === value ? "secondary" : "ghost"} size="sm" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</Button>)}</div><span className="record-limit">{records.length} / {MAX_RECORDS} 条</span></div>
          {comparison.length > 0 && <section className="comparison"><div className="comparison-heading"><h3>并排观察 <span>{comparison.length} / 3</span></h3><Button variant="ghost" size="sm" onClick={() => setSelected([])}><X />取消选择</Button></div>{comparison.length === 1 && <p className="comparison-hint">再选一条记录，即可比较。</p>}<div className="comparison-grid" style={{ gridTemplateColumns: `repeat(${comparison.length}, minmax(0, 1fr))` }}>{comparison.map((record) => <article key={record.id}><div className="compare-title"><strong>{record.model}</strong><Button variant="ghost" size="icon-sm" aria-label={`取消比较 ${record.model}`} onClick={() => toggleCompare(record.id)}><X /></Button></div><OutputPreview output={record.output} title={`${record.model} 比较预览`} compact /><p className="compare-prompt">{record.prompt}</p><span className="date">{date(record.createdAt)}</span></article>)}</div></section>}
          {loading ? <div className="empty-state" role="status"><Loader2 className="animate-spin" /><p>正在读取测试记录…</p></div> : loadError ? <div className="empty-state" role="alert"><FileJson size={32} /><h3>暂时无法读取记录</h3><p>{loadError}</p><Button variant="outline" onClick={() => void refresh()}>重新读取</Button></div> : visibleRecords.length === 0 ? <div className="empty-state"><FlaskConical size={38} /><h3>{records.length ? "没有符合条件的记录" : "你的第一只鹈鹕，还在路上。"}</h3><p>{records.length ? "试试其他关键词或输出格式。" : signedIn ? "从实验台粘贴一份回答，保存后会出现在这里。" : "你可以先在实验台预览，登录后保存和读取记录。"}</p><Button variant="outline" onClick={() => { if (records.length) { setQuery(""); setFilter("all"); } else setSection("workbench"); }}>{records.length ? "清除筛选" : "开始一次实验"}</Button></div> : <div className="record-grid">{visibleRecords.map((record) => <article className={`record-card${selected.includes(record.id) ? " selected" : ""}`} key={record.id}><div className="record-card-top"><span className="format-badge">{extractOutput(record.output)?.kind || "TEXT"}</span><label className="compare-checkbox"><Checkbox checked={selected.includes(record.id)} onCheckedChange={() => toggleCompare(record.id)} aria-label={`并排查看 ${record.model}`} />并排查看</label></div><button className="record-preview-button" aria-label={`查看 ${record.model} 的完整记录`} onClick={() => setDetail(record)}><div className="thumbnail"><OutputPreview output={record.output} title={`${record.model} 缩略预览`} compact /></div></button><div className="record-card-body"><h3>{record.model}</h3><p>{record.prompt}</p><div className="record-card-footer"><span className="date">{date(record.createdAt)}</span><div><Button variant="ghost" size="icon-sm" aria-label={`查看 ${record.model} 的记录`} onClick={() => setDetail(record)}><Eye /></Button><Button variant="ghost" size="icon-sm" disabled={busy} aria-label={`删除 ${record.model} 的记录`} onClick={() => setDeleting(record)}><Trash2 /></Button></div></div></div></article>)}</div>}
        </TabsContent>
      </Tabs>
      <footer className="site-footer"><span>鹈鹕实验室 · 看见模型的不同</span><a href="https://simonwillison.net/2024/Oct/25/pelicans-on-a-bicycle/" target="_blank" rel="noreferrer">关于鹈鹕自行车实验</a></footer>
    </main>
    <Dialog open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetail(null); }}><DialogContent className="detail-dialog"><DialogHeader><DialogTitle>{detail?.model}</DialogTitle><DialogDescription>{detail && new Date(detail.createdAt).toLocaleString("zh-CN")} · 完整测试记录</DialogDescription></DialogHeader>{detail && <><div className="detail-prompt"><strong>提示词</strong><p>{detail.prompt}</p></div><Tabs defaultValue="preview"><TabsList><TabsTrigger value="preview">预览</TabsTrigger><TabsTrigger value="raw">原始回答</TabsTrigger></TabsList><TabsContent value="preview"><OutputPreview output={detail.output} title={`${detail.model} 完整输出`} /></TabsContent><TabsContent value="raw"><pre className="raw-output">{detail.output}</pre></TabsContent></Tabs><div className="detail-actions"><Button variant="outline" onClick={() => void copy(detail.output)}><Copy />复制原文</Button><Button variant="outline" onClick={() => download(detail.output, `pelican-${detail.id}.txt`, "text/plain;charset=utf-8")}><Download />下载原文</Button></div></>}</DialogContent></Dialog>
    <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open && !busy) setDeleting(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除这条测试记录？</AlertDialogTitle><AlertDialogDescription>将删除“{deleting?.model}”的原始回答和提示词。删除后无法恢复，可先导出备份。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>保留记录</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busy} onClick={(event) => { event.preventDefault(); void removeRecord(); }}>{busy ? "正在删除…" : "删除记录"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={clearDraft} onOpenChange={setClearDraft}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>清空当前输入？</AlertDialogTitle><AlertDialogDescription>当前草稿会被清空，已保存的测试记录仍会保留。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>继续编辑</AlertDialogCancel><AlertDialogAction onClick={() => { updateDraft({ model: "", prompt: DEFAULT_PROMPT, output: "" }); setView("preview"); }}>清空输入</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
