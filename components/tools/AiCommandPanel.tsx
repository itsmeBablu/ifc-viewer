"use client";

import { useEffect, useRef, useState } from "react";
import { getSession } from "next-auth/react";
import { aiFingerprint, applyAiPlan, currentAiContext } from "@/lib/ai/execute";
import { describeAction, validatePlan } from "@/lib/ai/validate";
import { undoWerkzeug } from "@/lib/werkzeugHistory";
import type { AiContext, AiPlan } from "@/lib/ai/schema";
import type { CommandRequest } from "@/lib/ai/protocol";
import AiPlanPreview from "./AiPlanPreview";
import AiVoiceInput from "./AiVoiceInput";
import { LuArrowUp, LuCirclePlus, LuSparkles, LuUndo2 } from "react-icons/lu";

export default function AiCommandPanel() {
  const [text, setText] = useState("");
  const [history, setHistory] = useState<CommandRequest["history"]>([]);
  const [pending, setPending] = useState<{ plan: AiPlan; fingerprint: string; context: AiContext } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [thinkingLabel, setThinkingLabel] = useState("Reading your project");
  const [deleteApproved, setDeleteApproved] = useState(false);
  const [appliedFingerprint, setAppliedFingerprint] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  useEffect(() => () => requestRef.current?.abort(), []);
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
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current || !text.trim()) return;
    busyRef.current = true; setBusy(true); setError(""); setStatus("Planning…"); setThinkingLabel("Reading your project"); setPending(null); setDeleteApproved(false); setAppliedFingerprint(null);
    const controller = new AbortController(); requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 60_000);
    try {
      const context = currentAiContext();
      const fingerprint = aiFingerprint();
      const body = JSON.stringify({ command: text.trim(), context, history: history.slice(-12) });
      if (new TextEncoder().encode(body).length > 256_000) throw new Error("This project's AI context is too large. Use a smaller project for now.");
      const response = await fetch("/api/ai-command", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "The AI request failed.");
      if (controller.signal.aborted) return;
      if (fingerprint !== aiFingerprint()) throw new Error("The project changed while AI was planning. Submit again with the current model.");
      let message: string;
      if (result.kind === "plan") {
        const plan = validatePlan(result.plan, currentAiContext());
        setPending({ plan, fingerprint, context }); message = `Proposed (not applied): ${plan.summary}`;
      } else if (result.kind === "clarification" && typeof result.message === "string") message = result.message;
      else throw new Error("The AI response was not recognized.");
      setHistory([...history, { role: "user", text: text.trim() }, { role: "assistant", text: message }].slice(-12) as CommandRequest["history"]);
      setText(""); setStatus(result.kind === "plan" ? "Review the proposed changes before applying." : "Answer the question below to continue.");
    } catch (e) {
      if (controller.signal.aborted) setError("The AI took too long to respond. Try a smaller command or send it again.");
      else setError(e instanceof Error ? e.message : "AI request failed.");
      setStatus("");
    }
    finally { window.clearTimeout(timeout); busyRef.current = false; setBusy(false); }
  }
  async function apply() {
    if (!pending || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setStatus("Validating and saving the approved actions…");
    try {
      if (!(await getSession())?.user?.id) throw new Error("Your session expired. Sign in again before applying AI changes.");
      await applyAiPlan(pending.plan, pending.fingerprint);
      setAppliedFingerprint(aiFingerprint());
      setStatus(`Applied ${pending.plan.actions.length} actions. You can undo the complete batch.`);
      setHistory(h => [...h, { role: "assistant" as const, text: `Applied: ${pending.plan.summary}` }].slice(-12));
      setPending(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save changes. Nothing was applied."); setStatus(""); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <div className="ai-command-panel mt-3 space-y-4">
    <div className="ai-welcome-copy"><span className="ai-sparkle-mark"><LuSparkles /></span><div><p className="text-base font-medium">What are we building today?</p><p className="text-xs ai-text-muted">Describe a house, place an element, or ask for a change.</p></div></div>
    <div className="ai-chat-history" aria-label="Conversation">{history.map((turn, i) => <div key={i} className={turn.role === "user" ? "ai-message ai-message-user" : "ai-message ai-message-assistant"}><span className="ai-message-label">{turn.role === "user" ? "You" : "V Studio"}</span><p>{turn.text}</p></div>)}</div>
    {busy && <div className="ai-thinking" role="status" aria-live="polite"><span className="ai-thinking-avatar"><LuSparkles /></span><span className="ai-thinking-copy"><strong>{thinkingLabel}</strong><small>Gemini is creating your preview</small></span><span className="ai-thinking-dots" aria-hidden="true"><i /><i /><i /></span></div>}
    {pending && <div className="ai-plan-card space-y-3">
      <div className="flex items-center gap-2"><span className="ai-plan-icon"><LuSparkles /></span><h3 className="font-semibold">{pending.plan.summary}</h3></div>
      {pending.plan.assumptions.length > 0 && <><p>Assumptions to review:</p><ul className="list-inside list-disc text-xs">{pending.plan.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul></>}
      <AiPlanPreview plan={pending.plan} context={pending.context} />
      <ol className="max-h-48 list-inside list-decimal space-y-1 overflow-auto text-xs">{pending.plan.actions.map((a, i) => <li key={i}>{describeAction(a)}<details className="ml-3"><summary className="cursor-pointer ai-text-muted">All dimensions and properties</summary><dl className="grid grid-cols-[auto_1fr] gap-x-2">{Object.entries(a).map(([name, value]) => <div key={name} className="contents"><dt>{name}</dt><dd className="break-all">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl></details></li>)}</ol>
      {pending.plan.actions.some(a => a.kind === "delete") && <label className="flex gap-2"><input type="checkbox" checked={deleteApproved} onChange={e => setDeleteApproved(e.target.checked)} />I approve the listed deletions.</label>}
      <div className="flex gap-3"><button className="ai-apply-button" disabled={busy || pending.plan.actions.some(a => a.kind === "delete") && !deleteApproved} onClick={() => void apply()}>Apply {pending.plan.actions.length} actions</button><button className="ai-text-button" disabled={busy} onClick={() => { setPending(null); setStatus("Preview discarded. No changes applied."); }}>Discard</button></div>
    </div>}
    <form onSubmit={submit} className="ai-composer">
      <label htmlFor="ai-command" className="sr-only">Your command or clarification</label>
      <textarea id="ai-command" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} maxLength={4000} rows={3} disabled={busy} placeholder="Ask V Studio to create…" />
      <div className="ai-composer-toolbar"><button type="button" className="ai-composer-add" title="Add context" disabled={busy}><LuCirclePlus /></button><AiVoiceInput compact disabled={busy} onText={transcript => { if (!busyRef.current) setText(value => `${value}${value ? " " : ""}${transcript}`.slice(0, 4000)); }} /><span className="ai-composer-spacer" /><button type="button" className="ai-undo-conversation" title="Start new conversation" disabled={busy} onClick={() => { setHistory([]); setPending(null); setError(""); setStatus(""); }}><LuUndo2 /></button><button type="submit" aria-label={busy ? "Working" : "Send command"} disabled={busy || !text.trim()} className="ai-send-button"><LuArrowUp /></button></div>
    </form>
    <div className="ai-suggestion-row"><button type="button" disabled={busy} onClick={() => setText("Create a two-storey house with three bedrooms")}>Create a house</button><button type="button" disabled={busy} onClick={() => setText("Add furniture to the living room")}>Add furniture</button><button type="button" disabled={busy} onClick={() => setText("Place MEP equipment")}>Place MEP</button></div>
    {error && <p role="alert" className="ai-error">{error}</p>}
    <p role="status" aria-live="polite" className="ai-status-line">{status}</p>
    {appliedFingerprint && <button disabled={busy} className="ai-text-button" onClick={async () => { try { if (aiFingerprint() !== appliedFingerprint) throw new Error("The model changed after this batch. Use the editor's Undo to step back through later changes."); await undoWerkzeug(); setAppliedFingerprint(null); setStatus("AI batch undone."); } catch (e) { setError(e instanceof Error ? e.message : "Undo failed."); } }}>Undo AI batch</button>}
  </div>;
}
