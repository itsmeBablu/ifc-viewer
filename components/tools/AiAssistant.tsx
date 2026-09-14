"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { LuMessageCircle, LuSparkles, LuX } from "react-icons/lu";
import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import AiCommandPanel from "./AiCommandPanel";

function CivilHelmetIcon({ className = "" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 64 64" className={className} fill="none">
    <path d="M13 37.5C13 24.52 23.52 14 36.5 14S60 24.52 60 37.5V41H13v-3.5Z" fill="currentColor" opacity=".28" />
    <path d="M20 36.5V31c0-9.11 7.39-16.5 16.5-16.5S53 21.89 53 31v5.5" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M12 36.5h42c4.42 0 8 2.46 8 5.5s-3.58 5.5-8 5.5H10c-4.42 0-8-2.46-8-5.5s3.58-5.5 8-5.5h2Z" fill="currentColor" />
    <path d="M36.5 14.5v22M28.5 16.7c1.7 1.16 3.07 2.67 4.05 4.43M44.5 16.7a16.4 16.4 0 0 0-4.05 4.43" stroke="#fff7c2" strokeWidth="2.4" strokeLinecap="round" opacity=".9" />
    <path d="M22 47.5c.76 3.38 2.4 5.07 4.9 5.07h19.2c2.5 0 4.13-1.69 4.9-5.07" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}

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
    <section ref={panelRef} aria-label="AI modeling assistant" className="ai-chat-panel liquid-glass-panel fixed bottom-20 right-3 z-[100] max-h-[75dvh] w-[min(420px,calc(100vw-24px))] overflow-auto rounded-[26px] p-4 text-sm text-white shadow-xl">
      <div data-ai-stagger className="ai-chat-header mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className="ai-chat-status-dot" /><div><h2 className="font-semibold tracking-tight">V Studio copilot</h2><p className="text-[10px] text-white/55">Civil engineering assistant</p></div></div><button className="ai-chat-close" onClick={close} aria-label="Close AI assistant"><LuX /></button></div>
      {status === "loading" ? <p>Checking sign-in…</p> : !session?.user ? <>
        <p data-ai-stagger className="mb-3 text-white/70">Sign in to create and edit your model with AI. Manual modeling is available without signing in.</p>
        <button data-ai-stagger className="ai-google-button" onClick={() => { void signIn("google").catch(() => setError("Could not start Google sign-in. Please try again.")); }}><LuSparkles /> Sign in with Google</button>
      </> : <><p data-ai-stagger className="text-white/70">Signed in as {session.user.name ?? session.user.email}.</p><button data-ai-stagger className="mt-2 underline text-white/70 hover:text-white" onClick={() => void signOut()}>Sign out</button><div data-ai-stagger><AiCommandPanel key={`${session.user.id}:${projectId}`} /></div></>}
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
    return <section aria-label="AI modeling assistant" className="ai-chat-panel fixed bottom-20 right-3 z-[100] w-[min(420px,calc(100vw-24px))] rounded-[26px] p-4 text-sm text-white"><p className="ai-chat-loading">Checking AI sign-in configuration…</p></section>;
  }
  if (!configured) {
    return <section aria-label="AI modeling assistant" className="ai-chat-panel fixed bottom-20 right-3 z-[100] w-[min(420px,calc(100vw-24px))] rounded-[26px] p-4 text-sm text-white"><div className="ai-chat-header mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className="ai-chat-status-dot" /><h2 className="font-semibold">V Studio copilot</h2></div><button className="ai-chat-close" onClick={close} aria-label="Close AI assistant"><LuX /></button></div><p>Google sign-in is not configured on this server yet. Add <code>AUTH_SECRET</code>, <code>AUTH_GOOGLE_ID</code>, and <code>AUTH_GOOGLE_SECRET</code>, then restart the server. Manual modeling remains available.</p></section>;
  }
  return <SessionProvider><AssistantPanel close={close} /></SessionProvider>;
}

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const capRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!capRef.current || !ringRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.to(capRef.current, { y: -5, rotation: 3, duration: 1.8, ease: "sine.inOut", repeat: -1, yoyo: true });
      gsap.to(ringRef.current, { scale: 1.22, autoAlpha: 0, duration: 1.8, ease: "power1.out", repeat: -1 });
    }, triggerRef);
    return () => ctx.revert();
  }, []);
  return <>
    <button ref={triggerRef} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Close AI assistant" : "Open AI assistant"} className="ai-cap-trigger liquid-glass-pill fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-full px-3 py-2 text-left text-sm font-semibold text-zinc-950 shadow-xl">
      <span ref={ringRef} aria-hidden className="ai-cap-ring" />
      <span ref={capRef} aria-hidden className="ai-cap-icon"><CivilHelmetIcon /></span>
      <span className="hidden sm:inline">Ask V Studio</span><LuMessageCircle aria-hidden className="size-4" />
    </button>
    {open && <AuthStatusGate close={() => setOpen(false)} />}
  </>;
}
