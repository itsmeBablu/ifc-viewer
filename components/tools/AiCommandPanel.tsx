"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSession } from "next-auth/react";
import { aiFingerprint, applyAiPlan, currentAiContext } from "@/lib/ai/execute";
import { describeAction, validatePlan } from "@/lib/ai/validate";
import { undoWerkzeug } from "@/lib/werkzeugHistory";
import type { AiContext, AiPlan } from "@/lib/ai/schema";
import { DEFAULT_AI_MODEL, isAiModelId, isAiMode, modelDetails, type AiModelId, type AiMode } from "@/lib/ai/models";
import { readAttachments, attachmentsSchema, MAX_REQUEST_BYTES, type AiAttachment } from "@/lib/ai/attachments";
import { idbClearAiChat, idbGetAiChat, idbPutAiChat, type AiChatTurn } from "@/lib/layoutDrawingDb";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import AiPlanPreview from "./AiPlanPreview";
import AiVoiceInput from "./AiVoiceInput";
import AiModelControls from "./AiModelControls";
import AiMessageContent from "./AiMessageContent";
import AiBuildingPresets from "./AiBuildingPresets";
import AiDrawingAttachments from "./AiDrawingAttachments";
import type { ResidentialParameters } from "@/lib/ai/modeling/allocation";
import type { DrawingReference } from "@/lib/ai/drawing";
import { LuArrowUp, LuCirclePlus, LuSparkles, LuUndo2, LuZap } from "react-icons/lu";

function savedPreference(key: string) {
  try { return typeof window === "undefined" ? null : localStorage.getItem(key); } catch { return null; }
}

function formatResetTime(resetTimestamp: number): string {
  if (!resetTimestamp || resetTimestamp <= 0) return "";
  const diffMs = resetTimestamp - Date.now();
  if (diffMs <= 0) return "resets now";
  const diffMinutes = Math.ceil(diffMs / 60000);
  if (diffMinutes < 60) return `resets in ${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  const remMinutes = diffMinutes % 60;
  if (remMinutes === 0) return `resets in ${diffHours}h`;
  return `resets in ${diffHours}h ${remMinutes}m`;
}

export default function AiCommandPanel({ projectId: propProjectId }: { projectId?: string | null } = {}) {
  const storeProjectId = useLayoutDrawingStore(s => s.projectId);
  const projectId = propProjectId ?? storeProjectId ?? "default";
  const [model, setModel] = useState<AiModelId>(() => { const saved = savedPreference("ai-assistant-model"); return isAiModelId(saved) ? saved : DEFAULT_AI_MODEL; });
  const [mode, setMode] = useState<AiMode>(() => { const saved = savedPreference("ai-assistant-mode"); return isAiMode(saved) ? saved : "build"; });
  const selectedCount = useLayoutDrawingStore(s => s.selectedElements.length);
  const levelCount = useLayoutDrawingStore(s => s.levels.length);
  const modelInventory = useLayoutDrawingStore(s => `${s.walls.length} walls · ${s.doors.length} doors · ${s.windows.length} windows · ${s.slabs.length} floors/roofs · ${s.mepEquipment.length} furniture/equipment · ${s.pipes.length} pipes · ${s.ducts.length} ducts · ${s.cableTrays.length} trays · ${s.columns.length} columns · ${s.beams.length} beams`);
  // Sketch summary for AI context
  const sketchSummary = useLayoutDrawingStore(s => {
    const params = (s as { residentialParameters?: { sketches?: Array<{ points: Array<{xMm:number;yMm:number}>; lines: Array<{start:{xMm:number;yMm:number};end:{xMm:number;yMm:number}}>; labels?: Array<{name:string;use:string}> }> } }).residentialParameters;
    const sketches = params?.sketches;
    if (!sketches?.length) return "";
    const parts: string[] = [`Sketch drawing: ${sketches.length} floor(s)`];
    sketches.forEach((sk, fi) => {
      const lvl = s.levels[fi];
      const floorLabel = lvl ? `${lvl.name} (${(lvl.elevationMm/1000).toFixed(1)}m)` : `Floor ${fi}`;
      const totalLines = sk.points.length + sk.lines.length;
      const allPts = [...sk.points, ...sk.lines.flatMap(l => [l.start, l.end])];
      const maxX = allPts.length ? Math.max(...allPts.map(p => p.xMm)) : 0;
      const maxY = allPts.length ? Math.max(...allPts.map(p => p.yMm)) : 0;
      const rooms = sk.labels?.map(l => `${l.name} (${l.use})`).join(", ") ?? "";
      parts.push(`  ${floorLabel}: ${totalLines} wall segments, approx ${(maxX/1000).toFixed(1)}m × ${(maxY/1000).toFixed(1)}m${rooms ? `, rooms: ${rooms}` : ""}`);
    });
    return parts.join("\n");
  });
  const [conversationKey,setConversationKey]=useState(0);
  const mepModeActive = useLayoutDrawingStore(s => s.mepModeActive);
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [residential, setResidential] = useState<ResidentialParameters | undefined>();
  const [drawingReference, setDrawingReference] = useState<DrawingReference | undefined>();
  const wallHeightMm = useLayoutDrawingStore(s => s.draftWallHeightMm);
  const wallThicknessMm = useLayoutDrawingStore(s => s.draftWallThicknessMm);
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
  const [usage, setUsage] = useState<{ inputTokens: number; outputTokens: number; thinkingTokens: number } | null>(null);
  const [, setTick] = useState(0);
  const [failedCommand, setFailedCommand] = useState<string | null>(null);
  const [deleteApproved, setDeleteApproved] = useState(false);
  const [appliedFingerprint, setAppliedFingerprint] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!busy) return;
    const block = (event: Event) => {
      if (!event.isTrusted) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const events = ["pointerdown", "pointerup", "click", "dblclick", "contextmenu", "keydown", "keyup", "wheel", "touchstart", "touchmove", "submit"];
    for (const name of events) window.addEventListener(name, block, { capture: true, passive: false });
    return () => { for (const name of events) window.removeEventListener(name, block, true); };
  }, [busy]);

  useEffect(() => {
    try { localStorage.setItem("ai-assistant-model", model); localStorage.setItem("ai-assistant-mode", mode); } catch { /* Storage is optional. */ }
  }, [model, mode]);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const fetchQuota = () => {
      void fetch("/api/ai-quota", { cache: "no-store" })
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (active && data && typeof data.remaining === "number") {
            setLimit({
              remaining: data.remaining,
              total: data.total ?? 1500,
              reset: data.reset ?? Date.now() + 24 * 60 * 60 * 1000,
            });
          }
        })
        .catch(() => {});
    };
    fetchQuota();
    const interval = setInterval(fetchQuota, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const livePromptTokens = useMemo(() => {
    if (!text.trim()) return 0;
    return Math.max(1, Math.ceil(text.trim().length / 3.8));
  }, [text]);

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
    const withTimestamp: AiChatTurn = { ...item, timestamp: item.timestamp ?? Date.now() };
    setHistory(current => {
      const next = [...current, withTimestamp].slice(-12);
      void idbPutAiChat(projectId, next).catch(() => setError("Chat could not be saved in this browser."));
      return next;
    });
  };

  const clearHistory = () => {
    setConversationKey(k=>k+1);
    setUsage(null);
    setHistory([]);
    setAttachments([]);
    setSourceFiles([]); setResidential(undefined); setDrawingReference(undefined);
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
    const scrollToBottom = () => {
      const container = historyRef.current;
      if (container) {
        container.scrollTo({
          top: history.length ? container.scrollHeight : 0,
          behavior: "smooth",
        });
      }
    };
    scrollToBottom();
    const raf = requestAnimationFrame(scrollToBottom);
    const timer = setTimeout(scrollToBottom, 80);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [history, busy]);

  useEffect(() => {
    const container = historyRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      if (!container.querySelector(".ai-building-options[open]")) container.scrollTop = container.scrollHeight;
    });
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
    if (busyRef.current || reading) return;
    setReading(true); setError("");
    try {
      if (attachments.length + files.length > 3) throw new Error("Choose up to 3 drawings. Remove one before adding another.");
      const added = await readAttachments(files); setAttachments(attachmentsSchema.parse([...attachments, ...added])); setSourceFiles([...sourceFiles, ...files]); setIncludeAttachments(true); setResidential(undefined); setDrawingReference(undefined);
      if (!text.trim()) setText("Create a layout from the uploaded floor plan.");
      if (model === "ollama-local") { setModel(DEFAULT_AI_MODEL); setStatus("Gemini selected for this drawing; Ollama supports text only."); }
    }
    catch (e) { setError(e instanceof Error && !e.name.includes("Zod") ? e.message : "Choose up to 3 PDF or image drawings, 20 MB each."); }
    finally { setReading(false); }
  }
  async function changePdfPage(index: number, page: number) {
    if (busyRef.current || reading || !sourceFiles[index]) return;
    setReading(true); setError("");
    try { const [file] = await readAttachments([sourceFiles[index]], page); setAttachments(attachmentsSchema.parse(attachments.map((old, i) => i === index ? file : old))); setDrawingReference(undefined); setIncludeAttachments(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not read that PDF page."); }
    finally { setReading(false); }
  }
  async function submit(event?: React.FormEvent, template?: {command:string;parameters:ResidentialParameters}) {
    event?.preventDefault();
    if (busyRef.current || reading || !historyLoaded || !(template?.command??text).trim()) return;
    useToolMarkupStore.getState().setQuadView(false);
    useToolMarkupStore.getState().setViewPreset("free");
    const submittedText = (template?.command??text).trim();
    const submittedResidential=template?.parameters??residential;
    const submittedAttachments = includeAttachments ? attachments : [];
    setText(""); setResidential(undefined); setFailedCommand(null); setIncludeAttachments(false);
      const remaining = Number(remainingHeader);
      const reset = Number(resetHeader);
      const total = Number(totalHeader);
      if (remainingHeader !== null && Number.isFinite(remaining)) {
        setLimit({
          total: Number.isFinite(total) && total > 0 ? total : 1500,
          remaining,
          reset: resetHeader !== null && Number.isFinite(reset) && reset > 0 ? reset : Date.now() + 24 * 60 * 60 * 1000,
        });
      }
      const result = await response.json().catch(() => { throw new Error("AI could not return a response. Please try again in a moment."); });
      if (!result || typeof result !== "object") throw new Error("AI returned an empty response. Please try again.");
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "The AI request failed.");
      if (result.usage && [result.usage.inputTokens, result.usage.outputTokens, result.usage.thinkingTokens].every((value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0)) setUsage(result.usage);
      if (controller.signal.aborted) return;
      const responseModel = isAiModelId(result.model) ? result.model : model;
      let message: string;
      if (result.kind === "plan") {
        if (mode !== "build") throw new Error("Switch to Build to request a model preview. Review and Guide do not change geometry.");
        if (fingerprint !== aiFingerprint()) throw new Error("The project changed while AI was planning. Submit again with the current model.");
        const plan = validatePlan(result.plan, currentAiContext());
        setThinkingLabel("Drawing live in 3D");
        await applyAiPlan(plan, fingerprint, true);
        setAppliedFingerprint(aiFingerprint());
        message = `**Applied in 3D**\n${plan.summary}${plan.rationale ? `\n\n${plan.rationale}` : ""}${plan.assumptions.length ? `\n\nAssumptions:\n${plan.assumptions.map(a => `- ${a}`).join("\n")}` : ""}`;
      } else if ((result.kind === "clarification" || result.kind === "advice") && typeof result.message === "string" && result.message.trim()) message = result.message;
      else throw new Error("The AI response was not recognized.");
      pushHistory({ role: "assistant", text: message, model: responseModel, mode });
      if (result.kind !== "plan" && submittedAttachments.length) setIncludeAttachments(true);
      setStatus(result.kind === "plan" ? "Changes saved. You can undo the complete AI batch." : "");
    } catch (e) {
      if (!mountedRef.current) return;
      const message = controller.signal.aborted
        ? "AI took too long to formulate this complex plan. You can try again or divide into smaller tasks."
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
    <div className="ai-command-panel flex flex-col flex-1 min-h-0 h-full overflow-hidden" onDragOver={e => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }} onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); if (!busyRef.current && historyLoaded) void attach(Array.from(e.dataTransfer.files)); } }}>
      {busy && <div className="fixed inset-x-0 top-3 z-[9999] pointer-events-none flex justify-center" role="status"><span className="rounded-xl bg-black/80 text-white px-4 py-2 text-sm">AI is working in 3D · Editing is locked</span></div>}
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
              <p className="text-xs ai-text-muted">Existing model · {levelCount} levels · {modelInventory}</p>
            </div>
          </div>
        )}
        {mode === "build" && !attachments.length && <AiBuildingPresets key={`${projectId}:${conversationKey}`} disabled={busy || reading || !historyLoaded} heightMm={wallHeightMm} thicknessMm={wallThicknessMm} onChoose={(command, parameters) => { setText(command); setResidential(parameters); }} onCreate={(command,parameters)=>void submit(undefined,{command,parameters})} />}
        {history.map((turn, i) => (
          <div
            key={i}
            className={`ai-message-row flex flex-col ${turn.role === "user" ? "items-end" : "items-start"}`}
          >
            <div className={`flex items-center gap-1.5 mb-1 px-1.5 text-[10px] font-semibold text-[var(--text-muted)] ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
              {turn.role === "assistant" && (
                <img src="/ai.svg" alt="" className="size-3.5 object-contain opacity-85" />
              )}
              <span>
                {turn.role === "user"
                  ? "You"
                  : isAiModelId(turn.model)
                  ? `${modelDetails(turn.model).label}${isAiMode(turn.mode) ? ` · ${turn.mode}` : ""}`
                  : "V Studio Assistant"}
              </span>
            </div>
            <div className={turn.role === "user" ? "ai-message ai-message-user" : "ai-message ai-message-assistant"}>
              {turn.role === "assistant" ? <AiMessageContent text={turn.text} /> : <p className="whitespace-pre-wrap">{turn.text}</p>}
              <div className="flex items-center justify-end mt-1.5 select-none -mb-0.5">
                <span className="text-[9px] opacity-60 font-mono tracking-tight text-[var(--text-muted)]">
                  {turn.timestamp
                    ? new Date(turn.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
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
        {history.length === 0 && mode !== "build" && (
          <div className="ai-suggestion-row pt-1">
            {(mode === "review" ? ["Review circulation and opening placement", "Check the selected elements"] : ["How do I turn a floor plan into 3D?", "Explain levels, walls and openings"]).map(suggestion => (
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
        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" multiple className="sr-only" aria-label="Attach plans or images" disabled={busy || reading} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; if (files.length) void attach(files); }} />
        {attachments.length > 0 && (
          <div className="ai-attachments">
            <AiDrawingAttachments key={attachments.map(a => `${a.name}:${a.pageNumber}`).join("|")} files={attachments} disabled={busy || reading} onPage={(index, page) => void changePdfPage(index, page)} onRemove={index => { setAttachments(items => items.filter((_, i) => i !== index)); setSourceFiles(items => items.filter((_, i) => i !== index)); setDrawingReference(undefined); }} onReference={setDrawingReference} />
            <label className="flex items-center gap-2 text-xs ai-text-muted">
              <input type="checkbox" checked={includeAttachments} disabled={busy || reading} onChange={e => setIncludeAttachments(e.target.checked)} />
              Include files with next message
            </label>
          </div>
        )}
        {reading && <p role="status" className="text-xs ai-text-muted">Preparing drawing preview…</p>}

        {/* Live Quota & Token Slider Bar — Single Line Layout */}
        {(() => {
          const totalQuota = limit?.total && limit.total > 0 ? limit.total : 1500;
          const remainingQuota = limit?.remaining ?? totalQuota;
          const quotaPct = Math.min(100, Math.max(0, Math.round((remainingQuota / totalQuota) * 100)));
          const resetText = limit?.reset ? formatResetTime(limit.reset) : "";

          return (
            <div className="ai-limits-bar flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-[10.5px]">
              {/* Left: Real-time token count */}
              <div
                className="flex items-center gap-1 shrink-0 font-semibold text-[var(--text-strong)]"
                title={livePromptTokens > 0 ? `Your message only: ~${livePromptTokens} tokens. Project context and tools also use input tokens.` : "The output limit is a ceiling, not tokens charged per request."}
              >
                <LuZap className={`size-3 shrink-0 ${mepModeActive ? "text-[#38bdf8]" : "text-amber-400"} ${livePromptTokens > 0 ? "animate-pulse" : ""}`} />
                <span>
                  {livePromptTokens > 0 ? (
                    <span className="font-mono text-[10px] tabular-nums">
                      ~{livePromptTokens} tok live
                    </span>
                  ) : (
                    <span>({modelDetails(model).maxOutputTokens.toLocaleString()} tokens)</span>
                  )}
                </span>
              </div>

              {/* Middle: Live Animated Slider Track */}
              <div className="relative flex-1 min-w-[50px] h-1.5 rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out relative ${
                    mepModeActive
                      ? "bg-gradient-to-r from-sky-500 via-[#38bdf8] to-cyan-300 shadow-[0_0_8px_rgba(56,189,248,0.55)]"
                      : "bg-gradient-to-r from-amber-500 via-[#facc15] to-yellow-200 shadow-[0_0_8px_rgba(250,204,21,0.55)]"
                  }`}
                  style={{ width: `${limit ? Math.max(3, quotaPct) : 0}%` }}
                >
                  <div className="ai-slider-shimmer" />
                  {/* Glowing Slider Thumb Indicator */}
                  <div
                    className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 size-2.5 rounded-full border border-white shadow-sm transition-all duration-700 ${
                      mepModeActive
                        ? "bg-[#38bdf8] shadow-[0_0_8px_#38bdf8]"
                        : "bg-[#facc15] shadow-[0_0_8px_#facc15]"
                    }`}
                  />
                </div>
              </div>

              {/* Right: Quota % and Reset Time */}
              <div className="flex items-center gap-1 shrink-0" title={limit ? `App requests (not Gemini quota): ${remainingQuota} of ${totalQuota} available` : "Checking app request allowance"}>
                <span
                  className={`font-mono font-extrabold text-[11px] transition-colors tabular-nums ${
                    mepModeActive ? "text-[#38bdf8]" : "text-amber-500 dark:text-[#facc15]"
                  }`}
                >
                  {limit ? `${quotaPct}%` : "…"}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] opacity-80 whitespace-nowrap">
                  app requests{resetText ? ` · ${resetText}` : ""}
                </span>
              </div>
            </div>
          );
        })()}
        {usage && <p className="ai-text-muted text-[10px] px-1">{usage.inputTokens === 0 && usage.outputTokens === 0 ? "Created from a template · 0 AI tokens" : `Last request: ${usage.inputTokens.toLocaleString()} input · ${usage.outputTokens.toLocaleString()} output${usage.thinkingTokens > 0 ? ` · ${usage.thinkingTokens.toLocaleString()} thinking` : ""} tokens`}</p>}


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
            onChange={e => { setText(e.target.value); setResidential(undefined); }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
            maxLength={4000}
            rows={2}
            disabled={busy || !historyLoaded}
            placeholder={busy ? "Waiting for a reply…" : mode === "build" ? "Describe walls, rooms, MEP ducting or piping to build…" : mode === "review" ? "Ask to review layout, MEP systems or selection…" : "Ask how to model or use tools…"}
          />
          <div className="ai-composer-toolbar">
            <button type="button" className="ai-composer-add" title="Attach PDF or image" aria-label="Attach PDF or image" disabled={busy || reading || !historyLoaded} onClick={() => fileRef.current?.click()}>
              <LuCirclePlus />
            </button>
          <AiVoiceInput compact disabled={busy || !historyLoaded} onText={transcript => { if (!busyRef.current) { setResidential(undefined); setText(value => `${value}${value ? " " : ""}${transcript}`.slice(0, 4000)); } }} />
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
