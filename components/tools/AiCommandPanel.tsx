"use client";

import { useEffect, useRef, useState } from "react";
import { getSession } from "next-auth/react";
import { aiFingerprint, applyAiPlan, currentAiContext } from "@/lib/ai/execute";
import { describeAction, validatePlan } from "@/lib/ai/validate";
import { undoWerkzeug } from "@/lib/werkzeugHistory";
import type { AiContext, AiPlan } from "@/lib/ai/schema";
import type { CommandRequest } from "@/lib/ai/protocol";
import { readAttachments, attachmentsSchema, MAX_REQUEST_BYTES, type AiAttachment } from "@/lib/ai/attachments";
import { idbClearAiChat, idbGetAiChat, idbPutAiChat } from "@/lib/layoutDrawingDb";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import AiPlanPreview from "./AiPlanPreview";
import AiVoiceInput from "./AiVoiceInput";
import { LuArrowUp, LuCirclePlus, LuSparkles, LuUndo2 } from "react-icons/lu";

export default function AiCommandPanel({ projectId: propProjectId }: { projectId?: string | null } = {}) {
  const storeProjectId = useLayoutDrawingStore(s => s.projectId);
  const projectId = propProjectId ?? storeProjectId ?? "default";
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [history, setHistory] = useState<CommandRequest["history"]>([]);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const historyLoaded = loadedProjectId === projectId;
  const [pending, setPending] = useState<{ plan: AiPlan; fingerprint: string; context: AiContext } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [thinkingLabel, setThinkingLabel] = useState("Reading your project");
  const [limit, setLimit] = useState<{ remaining: number; total: number; reset: number } | null>(null);
  const [failedCommand, setFailedCommand] = useState<string | null>(null);
  const [deleteApproved, setDeleteApproved] = useState(false);
  const [appliedFingerprint, setAppliedFingerprint] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    let active = true;
    void idbGetAiChat(projectId)
      .then(saved => {
        if (active) {
          setHistory(saved as CommandRequest["history"]);
          setLoadedProjectId(projectId);
        }
      })
      .catch(() => {
        if (active) setLoadedProjectId(projectId);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  const pushHistory = (item: { role: "user" | "assistant"; text: string }) => {
    setHistory(current => {
      const next = [...current, item].slice(-12) as CommandRequest["history"];
      void idbPutAiChat(projectId, next).catch(() => setError("Chat could not be saved in this browser."));
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    setAttachments([]);
    setPending(null);
    setFailedCommand(null);
    setText("");
    setError("");
    setStatus("");
    void idbClearAiChat(projectId).catch(() => setError("Saved chat could not be cleared."));
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; requestRef.current?.abort(); };
  }, []);
  useEffect(() => {
    const container = historyRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [history, busy]);
  useEffect(() => {
    const container = historyRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => { container.scrollTop = container.scrollHeight; });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!busy) return;
    const stages = ["Reading your project", "Thinking through the layout", "Preparing a safe preview"];
    let index = 0;
    setThinkingLabel(stages[index]);
    const timer = window.setInterval(() => {
      index = (index + 1) % stages.length;
      setThinkingLabel(stages[index]);
    }, 1400);
    return () => window.clearInterval(timer);
  }, [busy]);
  async function attach(files: File[]) {
    setReading(true); setError("");
    try { const added = await readAttachments(files); setAttachments(attachmentsSchema.parse([...attachments, ...added])); setIncludeAttachments(true); }
    catch (e) { setError(e instanceof Error && !e.name.includes("Zod") ? e.message : "Choose up to 3 PDF or image files, 2.5 MB total."); }
    finally { setReading(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current || reading || !historyLoaded || !text.trim()) return;
    const submittedText = text.trim();
    const submittedAttachments = includeAttachments ? attachments : [];
    setText(""); setFailedCommand(null); setIncludeAttachments(false);
    busyRef.current = true; setBusy(true); setError(""); setStatus("Planning…"); setThinkingLabel("Reading your project"); setPending(null); setDeleteApproved(false); setAppliedFingerprint(null);
    pushHistory({ role: "user", text: submittedText });
    const controller = new AbortController(); requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 60_000);
    try {
      const context = currentAiContext();
      const fingerprint = aiFingerprint();
      const body = JSON.stringify({ command: submittedText, context, attachments: submittedAttachments, history: history.slice(-12) });
      if (new TextEncoder().encode(body).length > MAX_REQUEST_BYTES) throw new Error("This request is too large. Remove a file or use a smaller project.");
      const response = await fetch("/api/ai-command", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: controller.signal });
      const remainingHeader = response.headers.get("X-AI-Remaining");
      const resetHeader = response.headers.get("X-AI-Reset");
      const remaining = Number(remainingHeader);
      const reset = Number(resetHeader);
      if (remainingHeader !== null && Number.isFinite(remaining)) setLimit({ total: 10, remaining, reset: resetHeader !== null && Number.isFinite(reset) ? reset : 0 });
      const result = await response.json().catch(() => { throw new Error("AI could not return a response. Please try again in a moment."); });
      if (!result || typeof result !== "object") throw new Error("AI returned an empty response. Please try again.");
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "The AI request failed.");
      if (controller.signal.aborted) return;
      if (fingerprint !== aiFingerprint()) throw new Error("The project changed while AI was planning. Submit again with the current model.");
      let message: string;
      if (result.kind === "plan") {
        const plan = validatePlan(result.plan, currentAiContext());
        setPending({ plan, fingerprint, context }); message = `Proposed (not applied): ${plan.summary}`;
      } else if (result.kind === "clarification" && typeof result.message === "string") message = result.message;
      else throw new Error("The AI response was not recognized.");
      pushHistory({ role: "assistant", text: message });
      setStatus(result.kind === "plan" ? "Review the proposed changes before applying." : "");
    } catch (e) {
      if (!mountedRef.current) return;
      const message = controller.signal.aborted
        ? "The AI took too long to respond. Try a smaller command or send it again."
        : e instanceof TypeError ? "AI could not connect. Check your connection and try again."
          : e instanceof Error && !e.name.includes("Zod") ? e.message : "AI could not produce a usable response. Try a smaller request.";
      pushHistory({ role: "assistant", text: message });
      setFailedCommand(submittedText);
      if (submittedAttachments.length) setIncludeAttachments(true);
      setStatus("");
    }
    finally { window.clearTimeout(timeout); busyRef.current = false; if (mountedRef.current) { setBusy(false); requestAnimationFrame(() => inputRef.current?.focus()); } }
  }
  async function apply() {
    if (!pending || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setStatus("Validating and saving the approved actions…");
    try {
      if (!(await getSession())?.user?.id) throw new Error("Your session expired. Sign in again before applying AI changes.");
      await applyAiPlan(pending.plan, pending.fingerprint);
      setAppliedFingerprint(aiFingerprint());
      setStatus(`Applied ${pending.plan.actions.length} actions. You can undo the complete batch.`);
      pushHistory({ role: "assistant", text: `Applied: ${pending.plan.summary}` });
      setPending(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save changes. Nothing was applied."); setStatus(""); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <div className="ai-command-panel mt-3 space-y-4">
    {history.length === 0 && <div className="ai-welcome-copy"><span className="ai-sparkle-mark"><LuSparkles /></span><div><p className="text-base font-medium">What are we building today?</p><p className="text-xs ai-text-muted">Upload a plan with wall sizes, describe a space, or ask for a change.</p></div></div>}
    <div ref={historyRef} className="ai-chat-history" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation">{history.map((turn, i) => <div key={i} className={turn.role === "user" ? "ai-message ai-message-user" : "ai-message ai-message-assistant"}><span className="ai-message-label">{turn.role === "user" ? "You" : "3D visualizer"}</span><p>{turn.text}</p></div>)}</div>
    {failedCommand && <button type="button" className="ai-text-button" disabled={busy} onClick={() => { setText(failedCommand); setFailedCommand(null); inputRef.current?.focus(); }}>Edit and resend last message</button>}
    {busy && <div className="ai-thinking" role="status" aria-live="polite"><span className="ai-thinking-avatar"><LuSparkles /></span><span className="ai-thinking-copy"><strong>{thinkingLabel}</strong><small>Gemini is creating your preview</small></span><span className="ai-thinking-dots" aria-hidden="true"><i /><i /><i /></span></div>}
    {limit && <div className="ai-limit-bar" title="Up to 10 requests per 10 minutes" aria-label={`${limit.remaining} of ${limit.total} AI requests remaining`}><span>{limit.remaining}/{limit.total} requests remaining</span><span className="ai-limit-reset">{limit.reset ? `Resets ${new Date(limit.reset).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "10 min window"}</span></div>}
    {pending && <div className="ai-plan-card space-y-3">
      <div className="flex items-center gap-2"><span className="ai-plan-icon"><LuSparkles /></span><h3 className="font-semibold">{pending.plan.summary}</h3></div>
      {pending.plan.assumptions.length > 0 && <><p>Assumptions to review:</p><ul className="list-inside list-disc text-xs">{pending.plan.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul></>}
      <AiPlanPreview plan={pending.plan} context={pending.context} />
      <ol className="max-h-48 list-inside list-decimal space-y-1 overflow-auto text-xs">{pending.plan.actions.map((a, i) => <li key={i}>{describeAction(a)}<details className="ml-3"><summary className="cursor-pointer ai-text-muted">All dimensions and properties</summary><dl className="grid grid-cols-[auto_1fr] gap-x-2">{Object.entries(a).map(([name, value]) => <div key={name} className="contents"><dt>{name}</dt><dd className="break-all">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl></details></li>)}</ol>
      {pending.plan.actions.some(a => a.kind === "delete") && <label className="flex gap-2"><input type="checkbox" checked={deleteApproved} onChange={e => setDeleteApproved(e.target.checked)} />I approve the listed deletions.</label>}
      <div className="flex gap-3"><button className="ai-apply-button" disabled={busy || pending.plan.actions.some(a => a.kind === "delete") && !deleteApproved} onClick={() => void apply()}>Apply {pending.plan.actions.length} actions</button><button className="ai-text-button" disabled={busy} onClick={() => { setPending(null); setStatus("Preview discarded. No changes applied."); }}>Discard</button></div>
    </div>}
    <div className="ai-attachments">
      <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" multiple className="sr-only" aria-label="Attach plans or images" disabled={busy || reading} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; if (files.length) void attach(files); }} />
      {attachments.map((file, index) => <div className="ai-attachment" key={`${index}:${file.name}`}><span aria-hidden="true">{file.mimeType === "application/pdf" ? "PDF" : "IMG"}</span><span className="truncate">{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} disabled={busy || reading} onClick={() => setAttachments(items => items.filter((_, i) => i !== index))}>×</button></div>)}
      {reading && <p className="text-xs ai-text-muted">Reading files…</p>}
      {attachments.length > 0 && <label className="flex items-center gap-2 text-xs ai-text-muted"><input type="checkbox" checked={includeAttachments} disabled={busy || reading} onChange={e => setIncludeAttachments(e.target.checked)} />Include files with next message (uses more tokens)</label>}
    </div>
    <form onSubmit={submit} className="ai-composer">
      <label htmlFor="ai-command" className="sr-only">Your command or clarification</label>
      <textarea ref={inputRef} id="ai-command" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} maxLength={4000} rows={2} disabled={busy || !historyLoaded} placeholder={busy ? "Waiting for a reply…" : "Message the assistant…"} />
      <div className="ai-composer-toolbar"><button type="button" className="ai-composer-add" title="Attach PDF or image" aria-label="Attach PDF or image" disabled={busy || reading || !historyLoaded} onClick={() => fileRef.current?.click()}><LuCirclePlus /></button><AiVoiceInput compact disabled={busy || !historyLoaded} onText={transcript => { if (!busyRef.current) setText(value => `${value}${value ? " " : ""}${transcript}`.slice(0, 4000)); }} /><span className="ai-composer-spacer" /><button type="button" className="ai-undo-conversation" title="Start new conversation" disabled={busy || reading || !historyLoaded} onClick={clearHistory}><LuUndo2 /></button><button type="submit" aria-label={busy ? "Working" : "Send command"} disabled={busy || reading || !historyLoaded || !text.trim()} className="ai-send-button"><LuArrowUp /></button></div>
    </form>
    {history.length === 0 && <div className="ai-suggestion-row"><button type="button" disabled={busy || !historyLoaded} onClick={() => setText("Create a two-storey house with three bedrooms")}>Create a house</button><button type="button" disabled={busy || !historyLoaded} onClick={() => setText("Add furniture to the living room")}>Add furniture</button><button type="button" disabled={busy || !historyLoaded} onClick={() => setText("Place MEP equipment")}>Place MEP</button></div>}
    {error && <p role="alert" className="ai-error">{error}</p>}
    {status && !busy && <p role="status" aria-live="polite" className="ai-status-line">{status}</p>}
    {appliedFingerprint && <button disabled={busy} className="ai-text-button" onClick={async () => { try { if (aiFingerprint() !== appliedFingerprint) throw new Error("The model changed after this batch. Use the editor's Undo to step back through later changes."); await undoWerkzeug(); setAppliedFingerprint(null); setStatus("AI batch undone."); } catch (e) { setError(e instanceof Error ? e.message : "Undo failed."); } }}>Undo AI batch</button>}
  </div>;
}
