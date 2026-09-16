"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { LuMessageCircle, LuSparkles, LuX } from "react-icons/lu";
import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import AiCommandPanel from "./AiCommandPanel";

function AssistantPanel({ close }: { close: () => void }) {
  const { data: session, status } = useSession();
  const [error, setError] = useState("");
  const projectId = useLayoutDrawingStore(s => s.projectId);
  const panelRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!panelRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(panelRef.current, { autoAlpha: 0, y: 22, scale: 0.94, transformOrigin: "bottom right" }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.42, ease: "power3.out" });
      gsap.fromTo("[data-ai-stagger]", { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.28, stagger: 0.045, delay: 0.12, ease: "power2.out" });
    }, panelRef);
    return () => ctx.revert();
  }, []);
  return (
    <section ref={panelRef} aria-label="AI modeling assistant" className="ai-chat-panel fixed bottom-20 right-3 z-[100] max-h-[75dvh] w-[min(420px,calc(100vw-24px))] overflow-auto rounded-[26px] p-4 text-sm shadow-xl">
      <div data-ai-stagger className="ai-chat-header mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className="ai-chat-status-dot" /><div><h2 className="font-semibold tracking-tight">3D visualizer assistance</h2><p className="text-[10px] ai-text-muted">Plans, dimensions & spaces</p></div></div><button className="ai-chat-close" onClick={close} aria-label="Close AI assistant"><LuX /></button></div>
      {status === "loading" ? <p>Checking sign-in…</p> : !session?.user ? <>
        <p data-ai-stagger className="mb-3 ai-text-body">Sign in to create and edit your model with AI. Manual modeling is available without signing in.</p>
        <button data-ai-stagger className="ai-google-button" onClick={() => { void signIn("google").catch(() => setError("Could not start Google sign-in. Please try again.")); }}><LuSparkles /> Sign in with Google</button>
      </> : <><div data-ai-stagger className="ai-account-row"><span className="truncate">{session.user.name ?? session.user.email}</span><button className="shrink-0 underline hover:text-[var(--text-strong)]" onClick={() => void signOut()}>Sign out</button></div><div data-ai-stagger><AiCommandPanel key={`${session.user.id}:${projectId}`} projectId={projectId} /></div></>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

function AuthStatusGate({ close }: { close: () => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void fetch("/api/auth/status", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ configured?: boolean }> : Promise.reject(new Error("status")))
      .then((result) => { if (active) setConfigured(result.configured === true); })
      .catch(() => { if (active) setConfigured(false); });
    return () => { active = false; };
  }, []);
  if (configured === null) {
    return <section aria-label="AI modeling assistant" className="ai-chat-panel fixed bottom-20 right-3 z-[100] w-[min(420px,calc(100vw-24px))] rounded-[26px] p-4 text-sm"><p className="ai-chat-loading">Checking AI sign-in configuration…</p></section>;
  }
  if (!configured) {
    return <section aria-label="AI modeling assistant" className="ai-chat-panel fixed bottom-20 right-3 z-[100] w-[min(420px,calc(100vw-24px))] rounded-[26px] p-4 text-sm"><div className="ai-chat-header mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className="ai-chat-status-dot" /><h2 className="font-semibold">3D visualizer assistance</h2></div><button className="ai-chat-close" onClick={close} aria-label="Close AI assistant"><LuX /></button></div><p>Google sign-in is not configured on this server yet. Add <code>AUTH_SECRET</code>, <code>AUTH_GOOGLE_ID</code>, and <code>AUTH_GOOGLE_SECRET</code>, then restart the server. Manual modeling remains available.</p></section>;
  }
  return <SessionProvider><AssistantPanel close={close} /></SessionProvider>;
}

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const orbRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!orbRef.current || !ringRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.to(orbRef.current, { y: -3, rotation: 12, duration: 1.8, ease: "sine.inOut", repeat: -1, yoyo: true });
      gsap.to(ringRef.current, { rotation: 360, duration: 8, repeat: -1, ease: "none" });
    }, triggerRef);
    return () => ctx.revert();
  }, []);
  return <>
    <button ref={triggerRef} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Close AI assistant" : "Open AI assistant"} className="ai-orb-trigger fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-full px-3 py-2 text-left text-sm font-semibold shadow-xl">
      <span ref={ringRef} aria-hidden className="ai-orb-ring" />
      <span ref={orbRef} aria-hidden className="ai-orb-icon"><img src="/ai.svg" alt="" /></span>
      <span className="hidden sm:inline">3D visualizer</span><LuMessageCircle aria-hidden className="size-4" />
    </button>
    {open && <AuthStatusGate close={() => setOpen(false)} />}
  </>;
}
