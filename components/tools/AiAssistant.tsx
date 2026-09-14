"use client";

import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { LuHardHat, LuMessageCircle } from "react-icons/lu";
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
    gsap.fromTo(panelRef.current, { autoAlpha: 0, y: 18, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: "back.out(1.5)" });
  }, []);
  return (
    <section ref={panelRef} aria-label="AI modeling assistant" className="ai-chat-panel liquid-glass-panel fixed bottom-20 right-3 z-[100] max-h-[75dvh] w-[min(420px,calc(100vw-24px))] overflow-auto rounded-[26px] p-4 text-sm text-white shadow-xl">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">AI modeling assistant</h2><button onClick={close} aria-label="Close AI assistant">Close</button></div>
      {status === "loading" ? <p>Checking sign-in…</p> : !session?.user ? <>
        <p className="mb-3">Sign in to create and edit your model with AI. Manual modeling is available without signing in.</p>
        <button className="rounded-lg bg-white px-4 py-2 text-black" onClick={() => { void signIn("google").catch(() => setError("Could not start Google sign-in. Please try again.")); }}>Sign in with Google</button>
      </> : <><p>Signed in as {session.user.name ?? session.user.email}.</p><button className="mt-2 underline" onClick={() => void signOut()}>Sign out</button><AiCommandPanel key={`${session.user.id}:${projectId}`} /></>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
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
      <span ref={capRef} aria-hidden className="ai-cap-icon"><LuHardHat /></span>
      <span className="hidden sm:inline">Ask V Studio</span><LuMessageCircle aria-hidden className="size-4" />
    </button>
    {open && <SessionProvider><AssistantPanel close={() => setOpen(false)} /></SessionProvider>}
  </>;
}
