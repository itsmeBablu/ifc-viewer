"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createDictation, speechConstructor, type SpeechScope } from "@/lib/ai/speech";

const subscribe = () => () => {};
const supportedInBrowser = () => typeof window !== "undefined" && window.isSecureContext && !!speechConstructor(window as unknown as SpeechScope);

export default function AiVoiceInput({ disabled, onText }: { disabled: boolean; onText: (text: string) => void }) {
  const supported = useSyncExternalStore(subscribe, supportedInBrowser, () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState("en-US");
  const current = useRef<ReturnType<typeof createDictation> | null>(null);
  useEffect(() => () => current.current?.dispose(), []);
  useEffect(() => { if (disabled) current.current?.stop(); }, [disabled]);
  function toggle() {
    if (listening) { current.current?.stop(); return; }
    try {
      current.current?.dispose();
      setError("");
      current.current = createDictation(window as unknown as SpeechScope, language, onText, setError, () => setListening(false));
      setListening(true); current.current.start();
    } catch (e) { setListening(false); setError(e instanceof Error ? e.message : "Could not start dictation. Type your command instead."); }
  }
  return <div className="space-y-1">
    {supported ? <div className="flex items-center gap-2">
      <button type="button" disabled={disabled} aria-pressed={listening} onClick={toggle} className="rounded-lg border border-zinc-600 px-3 py-2 disabled:opacity-40">{listening ? "Stop dictation" : "Dictate command"}</button>
      <select aria-label="Dictation language" value={language} disabled={listening || disabled} onChange={e => setLanguage(e.target.value)} className="rounded bg-zinc-900 p-2"><option value="en-US">English</option><option value="de-DE">Deutsch</option></select>
    </div> : <p className="text-xs text-zinc-400">Voice input is unavailable here. Text commands are fully supported.</p>}
    <p className="text-xs text-zinc-400">{listening ? "Listening…" : "Dictation fills the text box. Review it, then Send. Browser speech services may process audio online."}</p>
    {error && <p role="alert" className="text-red-300">{error}</p>}
  </div>;
}
