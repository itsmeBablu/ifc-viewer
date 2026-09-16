"use client";

import { useEffect, useRef, useState } from "react";
import { getSession } from "next-auth/react";
import { aiFingerprint, applyAiPlan, currentAiContext } from "@/lib/ai/execute";
import { describeAction, validatePlan } from "@/lib/ai/validate";
import { undoWerkzeug } from "@/lib/werkzeugHistory";
import type { AiContext, AiPlan } from "@/lib/ai/schema";
import { DEFAULT_AI_MODEL, isAiModelId, isAiMode, modelDetails, type AiModelId, type AiMode } from "@/lib/ai/models";
import { readAttachments, attachmentsSchema, MAX_REQUEST_BYTES, type AiAttachment } from "@/lib/ai/attachments";
import { idbClearAiChat, idbGetAiChat, idbPutAiChat, type AiChatTurn } from "@/lib/layoutDrawingDb";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import AiPlanPreview from "./AiPlanPreview";
import AiVoiceInput from "./AiVoiceInput";
import AiModelControls from "./AiModelControls";
import AiMessageContent from "./AiMessageContent";
import { LuArrowUp, LuCirclePlus, LuSparkles, LuUndo2 } from "react-icons/lu";

function savedPreference(key: string) {
  try { return typeof window === "undefined" ? null : localStorage.getItem(key); } catch { return null; }
}

export default function AiCommandPanel({ projectId: propProjectId }: { projectId?: string | null } = {}) {
  const storeProjectId = useLayoutDrawingStore(s => s.projectId);
  const projectId = propProjectId ?? storeProjectId ?? "default";
  const [model, setModel] = useState<AiModelId>(() => { const saved = savedPreference("ai-assistant-model"); return isAiModelId(saved) ? saved : DEFAULT_AI_MODEL; });
  const [mode, setMode] = useState<AiMode>(() => { const saved = savedPreference("ai-assistant-mode"); return isAiMode(saved) ? saved : "build"; });
  const selectedCount = useLayoutDrawingStore(s => s.selectedElements.length);
  const levelCount = useLayoutDrawingStore(s => s.levels.length);
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [history, setHistory] = useState<AiChatTurn[]>([]);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const historyLoaded = loadedProjectId === projectId;
  const [pending, setPending] = useState<{ plan: AiPlan; fingerprint: string; context: AiContext; model: AiModelId } | null>(null);
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
    try { localStorage.setItem("ai-assistant-model", model); localStorage.setItem("ai-assistant-mode", mode); } catch { /* Storage is optional. */ }
  }, [model, mode]);

  useEffect(() => {
    let active = true;
    void idbGetAiChat(projectId)
      .then(saved => {
        if (active) {
          setHistory(saved);
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

  const pushHistory = (item: AiChatTurn) => {
    setHistory(current => {
      const next = [...current, item].slice(-12);
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
    const stages = mode === "build" ? ["Reading your project", "Working through the layout", "Preparing your proposal"] : ["Reading your project", "Assessing the details", "Preparing recommendations"];
    let index = 0;
    setThinkingLabel(stages[index]);
    const timer = window.setInterval(() => {
      index = (index + 1) % stages.length;
      setThinkingLabel(stages[index]);
    }, 1400);
    return () => window.clearInterval(timer);
  }, [busy, mode]);
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
      const body = JSON.stringify({ command: submittedText, model, mode, context, attachments: submittedAttachments, history: history.slice(-12).map(({ role, text }) => ({ role, text })) });
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
      const responseModel = isAiModelId(result.model) ? result.model : model;
      let message: string;
      if (result.kind === "plan") {
        if (mode !== "build") throw new Error("Switch to Build to request a model preview. Review and Guide do not change geometry.");
        if (fingerprint !== aiFingerprint()) throw new Error("The project changed while AI was planning. Submit again with the current model.");
        const plan = validatePlan(result.plan, currentAiContext());
        setPending({ plan, fingerprint, context, model: responseModel }); message = `**Proposed — not applied**\n${plan.summary}${plan.rationale ? `\n\n${plan.rationale}` : ""}`;
      } else if ((result.kind === "clarification" || result.kind === "advice") && typeof result.message === "string" && result.message.trim()) message = result.message;
      else throw new Error("The AI response was not recognized.");
      pushHistory({ role: "assistant", text: message, model: responseModel, mode });
      setStatus(result.kind === "plan" ? "Review the proposed changes before applying." : "");
    } catch (e) {
      if (!mountedRef.current) return;
      const message = controller.signal.aborted
        ? "The AI took too long to respond. Try a smaller command or send it again."
        : e instanceof TypeError ? "AI could not connect. Check your connection and try again."
          : e instanceof Error && !e.name.includes("Zod") ? e.message : "AI could not produce a usable response. Try a smaller request.";
      pushHistory({ role: "assistant", text: message, model, mode });
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
      pushHistory({ role: "assistant", text: `Applied: ${pending.plan.summary}`, model: pending.model, mode: "build" });
      setPending(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save changes. Nothing was applied."); setStatus(""); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return (
    <div className="ai-command-panel flex flex-col flex-1 min-h-0 h-full overflow-hidden">
      <div
        ref={historyRef}
        className="ai-chat-history flex-1 min-h-0 overflow-y-auto pr-1 space-y-3"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversation"
      >
        {history.length === 0 && (
          <div className="ai-welcome-copy pt-1 pb-2">
            <span className="ai-sparkle-mark"><LuSparkles /></span>
            <div>
              <p className="text-sm font-semibold">Your design workspace</p>
              <p className="text-xs ai-text-muted">Describe a brief, review your layout, or ask how to model it.</p>
            </div>
          </div>
        )}
        {history.map((turn, i) => (
          <div key={i} className={turn.role === "user" ? "ai-message ai-message-user" : "ai-message ai-message-assistant"}>
            <span className="ai-message-label">
              {turn.role === "user" ? "You" : isAiModelId(turn.model) ? `${modelDetails(turn.model).label}${isAiMode(turn.mode) ? ` · ${turn.mode}` : ""}` : "Assistant"}
            </span>
            {turn.role === "assistant" ? <AiMessageContent text={turn.text} /> : <p>{turn.text}</p>}
          </div>
        ))}
        {failedCommand && (
          <button type="button" className="ai-text-button" disabled={busy} onClick={() => { setText(failedCommand); setFailedCommand(null); inputRef.current?.focus(); }}>
            Edit and resend last message
          </button>
        )}
        {busy && (
          <div className="ai-thinking" role="status" aria-live="polite">
            <span className="ai-thinking-avatar"><LuSparkles /></span>
            <span className="ai-thinking-copy"><strong>{thinkingLabel}</strong><small>{modelDetails(model).label}</small></span>
            <span className="ai-thinking-dots" aria-hidden="true"><i /><i /><i /></span>
          </div>
        )}
        {pending && (
          <div className="ai-plan-card space-y-3">
            <div className="flex items-center gap-2"><span className="ai-plan-icon"><LuSparkles /></span><h3 className="font-semibold">{pending.plan.summary}</h3></div>
            {pending.plan.assumptions.length > 0 && <><p>Assumptions to review:</p><ul className="list-inside list-disc text-xs">{pending.plan.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul></>}
            <AiPlanPreview plan={pending.plan} context={pending.context} />
            {pending.plan.nextSteps && pending.plan.nextSteps.length > 0 && <div className="ai-next-steps"><p className="font-medium">Next steps</p><ul>{pending.plan.nextSteps.map((step, i) => <li key={i}>{step}</li>)}</ul></div>}
            <ol className="max-h-48 list-inside list-decimal space-y-1 overflow-auto text-xs">{pending.plan.actions.map((a, i) => <li key={i}>{describeAction(a)}<details className="ml-3"><summary className="cursor-pointer ai-text-muted">All dimensions and properties</summary><dl className="grid grid-cols-[auto_1fr] gap-x-2">{Object.entries(a).map(([name, value]) => <div key={name} className="contents"><dt>{name}</dt><dd className="break-all">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl></details></li>)}</ol>
            {pending.plan.actions.some(a => a.kind === "delete") && <label className="flex gap-2"><input type="checkbox" checked={deleteApproved} onChange={e => setDeleteApproved(e.target.checked)} />I approve the listed deletions.</label>}
            <div className="flex gap-3"><button className="ai-apply-button" disabled={busy || (pending.plan.actions.some(a => a.kind === "delete") && !deleteApproved)} onClick={() => void apply()}>Apply {pending.plan.actions.length} actions</button><button className="ai-text-button" disabled={busy} onClick={() => { setPending(null); setStatus("Preview discarded. No changes applied."); }}>Discard</button></div>
          </div>
        )}
        {history.length === 0 && (
          <div className="ai-suggestion-row pt-1">
            {(mode === "build" ? ["Plan a three-bedroom house", "Furnish the living room"] : mode === "review" ? ["Review circulation and opening placement", "Check the selected elements"] : ["How do I turn a floor plan into 3D?", "Explain levels, walls and openings"]).map(suggestion => (
              <button key={suggestion} type="button" disabled={busy || !historyLoaded} onClick={() => { setText(suggestion); inputRef.current?.focus(); }}>{suggestion}</button>
            ))}
          </div>
        )}
        {error && <p role="alert" className="ai-error">{error}</p>}
        {status && !busy && <p role="status" aria-live="polite" className="ai-status-line">{status}</p>}
        {appliedFingerprint && (
          <button disabled={busy} className="ai-text-button" onClick={async () => { try { if (aiFingerprint() !== appliedFingerprint) throw new Error("The model changed after this batch. Use the editor's Undo to step back through later changes."); await undoWerkzeug(); setAppliedFingerprint(null); setStatus("AI batch undone."); } catch (e) { setError(e instanceof Error ? e.message : "Undo failed."); } }}>Undo AI batch</button>
        )}
      </div>

      <div className="ai-command-bottom shrink-0 pt-2 space-y-2">
        <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" multiple className="sr-only" aria-label="Attach plans or images" disabled={busy || reading} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; if (files.length) void attach(files); }} />
        {attachments.length > 0 && (
          <div className="ai-attachments">
            {attachments.map((file, index) => (
              <div className="ai-attachment" key={`${index}:${file.name}`}>
                <span aria-hidden="true">{file.mimeType === "application/pdf" ? "PDF" : "IMG"}</span>
                <span className="truncate">{file.name}</span>
                <button type="button" aria-label={`Remove ${file.name}`} disabled={busy || reading} onClick={() => setAttachments(items => items.filter((_, i) => i !== index))}>×</button>
              </div>
            ))}
            {reading && <p className="text-xs ai-text-muted">Reading files…</p>}
            <label className="flex items-center gap-2 text-xs ai-text-muted">
              <input type="checkbox" checked={includeAttachments} disabled={busy || reading} onChange={e => setIncludeAttachments(e.target.checked)} />
              Include files with next message
            </label>
          </div>
        )}

        <div className="flex items-center justify-between px-1 text-[10.5px] text-[var(--text-muted)]">
          <span>Context: {levelCount} {levelCount === 1 ? "level" : "levels"} · {selectedCount} selected</span>
          {limit && <span>{limit.remaining}/{limit.total} requests remaining</span>}
        </div>

        <form onSubmit={submit} className="ai-composer">
          <AiModelControls
            model={model}
            mode={mode}
            disabled={busy}
            onModel={setModel}
            onMode={next => { setMode(next); setPending(null); setStatus(""); }}
          />
          <label htmlFor="ai-command" className="sr-only">Your command or clarification</label>
          <textarea
            ref={inputRef}
            id="ai-command"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
            maxLength={4000}
            rows={2}
            disabled={busy || !historyLoaded}
            placeholder={busy ? "Waiting for a reply…" : mode === "build" ? "Describe what to build or change…" : mode === "review" ? "Ask to review layout or selection…" : "Ask how to model or use tools…"}
          />
          <div className="ai-composer-toolbar">
            <button type="button" className="ai-composer-add" title="Attach PDF or image" aria-label="Attach PDF or image" disabled={busy || reading || !historyLoaded} onClick={() => fileRef.current?.click()}>
              <LuCirclePlus />
            </button>
            <AiVoiceInput compact disabled={busy || !historyLoaded} onText={transcript => { if (!busyRef.current) setText(value => `${value}${value ? " " : ""}${transcript}`.slice(0, 4000)); }} />
            <span className="ai-composer-spacer" />
            <button type="button" className="ai-undo-conversation" title="Start new conversation" disabled={busy || reading || !historyLoaded} onClick={clearHistory}>
              <LuUndo2 />
            </button>
            <button type="submit" aria-label={busy ? "Working" : "Send command"} disabled={busy || reading || !historyLoaded || !text.trim()} className="ai-send-button">
              <LuArrowUp />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
