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

export default function AiCommandPanel() {
  const [text, setText] = useState("");
  const [history, setHistory] = useState<CommandRequest["history"]>([]);
  const [pending, setPending] = useState<{ plan: AiPlan; fingerprint: string; context: AiContext } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [deleteApproved, setDeleteApproved] = useState(false);
  const [appliedFingerprint, setAppliedFingerprint] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  useEffect(() => () => requestRef.current?.abort(), []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current || !text.trim()) return;
    busyRef.current = true; setBusy(true); setError(""); setStatus("Planning…"); setPending(null); setDeleteApproved(false); setAppliedFingerprint(null);
    const controller = new AbortController(); requestRef.current = controller;
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
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "AI request failed."); setStatus(""); }
    finally { busyRef.current = false; setBusy(false); }
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
  return <div className="mt-3 space-y-3">
    <p className="text-xs text-zinc-400">Describe your house or a change. Commands and model context go to Google Gemini. Projects stay in this browser.</p>
    <div className="space-y-2" aria-label="Conversation">{history.map((turn, i) => <p key={i} className={turn.role === "user" ? "rounded-lg bg-zinc-800 p-2" : "whitespace-pre-wrap p-2"}><strong>{turn.role === "user" ? "You: " : "AI: "}</strong>{turn.text}</p>)}</div>
    {pending && <div className="space-y-2 rounded-lg border border-zinc-700 p-2">
      <h3 className="font-semibold">{pending.plan.summary}</h3>
      {pending.plan.assumptions.length > 0 && <><p>Assumptions to review:</p><ul className="list-inside list-disc text-xs">{pending.plan.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul></>}
      <AiPlanPreview plan={pending.plan} context={pending.context} />
      <ol className="max-h-48 list-inside list-decimal space-y-1 overflow-auto text-xs">{pending.plan.actions.map((a, i) => <li key={i}>{describeAction(a)}<details className="ml-3"><summary className="cursor-pointer text-zinc-400">All dimensions and properties</summary><dl className="grid grid-cols-[auto_1fr] gap-x-2">{Object.entries(a).map(([name, value]) => <div key={name} className="contents"><dt>{name}</dt><dd className="break-all">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl></details></li>)}</ol>
      {pending.plan.actions.some(a => a.kind === "delete") && <label className="flex gap-2"><input type="checkbox" checked={deleteApproved} onChange={e => setDeleteApproved(e.target.checked)} />I approve the listed deletions.</label>}
      <div className="flex gap-3"><button className="rounded-lg bg-yellow-400 px-3 py-2 text-black disabled:opacity-40" disabled={busy || pending.plan.actions.some(a => a.kind === "delete") && !deleteApproved} onClick={() => void apply()}>Apply {pending.plan.actions.length} actions</button><button disabled={busy} onClick={() => { setPending(null); setStatus("Preview discarded. No changes applied."); }}>Discard</button></div>
    </div>}
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="ai-command" className="block">Your command or clarification</label>
      <textarea id="ai-command" value={text} onChange={e => setText(e.target.value)} maxLength={4000} rows={3} disabled={busy} placeholder="Create a house, or describe an edit…" className="w-full rounded-lg border border-zinc-600 bg-zinc-900 p-2 text-base" />
      <AiVoiceInput disabled={busy} onText={transcript => { if (!busyRef.current) setText(value => `${value}${value ? " " : ""}${transcript}`.slice(0, 4000)); }} />
      <div className="flex gap-3"><button type="submit" disabled={busy || !text.trim()} className="rounded-lg bg-white px-3 py-2 text-black disabled:opacity-40">{busy ? "Working…" : "Send"}</button><button type="button" disabled={busy} onClick={() => { setHistory([]); setPending(null); setError(""); setStatus(""); }}>New conversation</button></div>
    </form>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    <p role="status" aria-live="polite">{status}</p>
    {appliedFingerprint && <button disabled={busy} className="underline" onClick={async () => { try { if (aiFingerprint() !== appliedFingerprint) throw new Error("The model changed after this batch. Use the editor's Undo to step back through later changes."); await undoWerkzeug(); setAppliedFingerprint(null); setStatus("AI batch undone."); } catch (e) { setError(e instanceof Error ? e.message : "Undo failed."); } }}>Undo AI batch</button>}
  </div>;
}
