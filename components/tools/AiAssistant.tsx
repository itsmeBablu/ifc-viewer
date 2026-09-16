"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { LuLogOut, LuSparkles, LuX } from "react-icons/lu";
import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import AiCommandPanel from "./AiCommandPanel";

function usePanelMorphAnimation(
  panelRef: React.RefObject<HTMLElement | null>,
  capRef: React.RefObject<HTMLElement | null>,
  getTriggerRect: () => DOMRect | null,
  onCloseComplete: () => void
) {

  const closingRef = useRef(false);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const targetRef = useRef({ x: 0, y: 0, width: 46, height: 46 });
  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    const panel = panelRef.current;
    if (!panel || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { onCloseComplete(); return; }
    timelineRef.current?.kill();
    const rect = panel.getBoundingClientRect();
    const trigger = getTriggerRect();
    const target = targetRef.current;
    if (trigger) {
      target.x = trigger.left - rect.left + Number(gsap.getProperty(panel, "x"));
      target.y = trigger.top - rect.top + Number(gsap.getProperty(panel, "y"));
    }
    const inner = panel.querySelector(".ai-chat-inner");
    gsap.set(inner, { width: rect.width - 2, height: rect.height - 2 });
    timelineRef.current = gsap.timeline({ onComplete: onCloseComplete })
      .to(panel.querySelectorAll("[data-ai-stagger]"), { autoAlpha: 0, duration: .12 }, 0)
      .to(panel, { ...target, borderRadius: target.width / 2, "--ai-glass-fill": "rgba(253,230,138,.65)", duration: .5, ease: "power3.inOut" }, .04);
    if (capRef.current) {
      const icon = capRef.current;
      const iconRect = icon.getBoundingClientRect();
      timelineRef.current.to(icon, { x: rect.left + target.width / 2 - iconRect.left - iconRect.width / 2,
        y: rect.top + target.height / 2 - iconRect.top - iconRect.height / 2, duration: .5, ease: "power3.inOut" }, .04);
    }
  };
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    closingRef.current = false;
    const ctx = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const rect = panel.getBoundingClientRect();
      const trigger = getTriggerRect();
      const target = { x: (trigger?.left ?? rect.right - 46) - rect.left, y: (trigger?.top ?? rect.bottom - 46) - rect.top,
        width: trigger?.width ?? 46, height: trigger?.height ?? 46 };
      targetRef.current = target;
      const inner = panel.querySelector(".ai-chat-inner");
      const icon = capRef.current;
      const iconRect = icon?.getBoundingClientRect();
      gsap.set(inner, { width: rect.width - 2, height: rect.height - 2 });
      gsap.set(panel, { ...target, borderRadius: target.width / 2, "--ai-glass-fill": "rgba(253,230,138,.65)" });
      if (icon && iconRect) gsap.set(icon, { x: rect.left + target.width / 2 - iconRect.left - iconRect.width / 2,
        y: rect.top + target.height / 2 - iconRect.top - iconRect.height / 2 });
      timelineRef.current = gsap.timeline()
        .to(panel, { x: 0, y: 0, width: rect.width, height: rect.height, borderRadius: 26,
          "--ai-glass-fill": "rgba(255,255,255,.82)", duration: .58, ease: "power3.inOut",
          onComplete: () => { gsap.set([panel, inner], { clearProps: "width,height" }); } }, 0)
        .fromTo(panel.querySelectorAll("[data-ai-stagger]"), { autoAlpha: 0, y: 8 },
          { autoAlpha: 1, y: 0, duration: .22, stagger: .025 }, .32);
      if (icon) timelineRef.current.to(icon, { x: 0, y: 0, duration: .58, ease: "power3.inOut" }, 0);
      gsap.to(panel.querySelector(".ai-light-beam"), { "--ai-beam-angle": "360deg", duration: 6, repeat: -1, ease: "none" });
    }, panelRef);
    return () => { timelineRef.current?.kill(); ctx.revert(); };
  }, [panelRef, capRef, getTriggerRect]);

  return { handleClose };
}

function AssistantPanel({
  getTriggerRect,
  onCloseComplete,
}: {
  getTriggerRect: () => DOMRect | null;
  onCloseComplete: () => void;
}) {
  const { data: session, status } = useSession();
  const [error, setError] = useState("");
  const projectId = useLayoutDrawingStore(s => s.projectId);
  const panelRef = useRef<HTMLElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { handleClose } = usePanelMorphAnimation(panelRef, capRef, getTriggerRect, onCloseComplete);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (userMenuOpen) {
          setUserMenuOpen(false);
        } else {
          handleClose();
        }
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [userMenuOpen, handleClose]);

  return (
    <section
      ref={panelRef}
      aria-label="AI modeling assistant"
      data-theme="light"
      data-discipline="arch"
      className="ai-chat-panel fixed bottom-20 right-3 z-[100] flex flex-col h-[min(650px,calc(100dvh-100px))] w-[min(440px,calc(100vw-24px))] rounded-[26px] text-sm shadow-2xl"
    >
      {/* Smooth rotating beam of light around perimeter */}
      <div className="ai-light-beam" aria-hidden="true" />
      <div className="ai-chat-inner flex h-full min-h-0 flex-col p-4">

      <div className="ai-chat-header shrink-0 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div ref={capRef} className="flex items-center justify-center shrink-0">
            <img src="/ai.svg" alt="" className="size-6 object-contain" />
          </div>
          <div data-ai-stagger>
            <h2 className="font-bold tracking-tight leading-tight text-sm text-[var(--text-strong)]">V Studio Assistant</h2>
            <p className="text-[10px] ai-text-muted">Design · Model · Review</p>
          </div>
        </div>
        <div data-ai-stagger className="flex items-center gap-1.5">
          {session?.user && (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(prev => !prev)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                title={session.user.name ?? session.user.email ?? "Account"}
                className="flex items-center justify-center rounded-full transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name ?? "User profile"}
                    referrerPolicy="no-referrer"
                    className="size-7.5 rounded-full object-cover border border-[var(--panel-divider)] shadow-sm"
                  />
                ) : (
                  <div className="size-7.5 rounded-full bg-amber-500/20 text-amber-500 font-bold text-xs flex items-center justify-center border border-amber-500/30">
                    {(session.user.name?.[0] ?? session.user.email?.[0] ?? "U").toUpperCase()}
                  </div>
                )}
              </button>
              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 z-[150] w-64 rounded-2xl border border-[var(--panel-divider)] bg-[var(--surface-card)] p-3 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  <div className="flex items-center gap-2.5 pb-2.5 border-b border-[var(--panel-divider)]">
                    {session.user.image ? (
                      <img
                        src={session.user.image}
                        alt={session.user.name ?? "User"}
                        referrerPolicy="no-referrer"
                        className="size-9 rounded-full object-cover border border-[var(--panel-divider)]"
                      />
                    ) : (
                      <div className="size-9 rounded-full bg-amber-500/20 text-amber-500 font-bold text-sm flex items-center justify-center border border-amber-500/30">
                        {(session.user.name?.[0] ?? session.user.email?.[0] ?? "U").toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs text-[var(--text-strong)] truncate">
                        {session.user.name || "User"}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] truncate">
                        {session.user.email}
                      </p>
                    </div>
                  </div>
                  <div className="py-2 space-y-1.5 border-b border-[var(--panel-divider)] text-[11px]">
                    <div className="flex items-center justify-between text-[var(--text-muted)]">
                      <span>Account</span>
                      <span className="flex items-center gap-1 font-medium text-emerald-500">
                        <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                        Connected
                      </span>
                    </div>
                    {session.user.id && (
                      <div className="flex items-center justify-between text-[var(--text-muted)]">
                        <span>User ID</span>
                        <span className="font-mono text-[10px] text-[var(--text-strong)] truncate max-w-[120px]">
                          {session.user.id}
                        </span>
                      </div>
                    )}
                    {projectId && (
                      <div className="flex items-center justify-between text-[var(--text-muted)]">
                        <span>Project</span>
                        <span className="font-mono text-[10px] text-[var(--text-strong)] truncate max-w-[120px]">
                          {projectId}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        void signOut();
                      }}
                      className="flex items-center gap-2 w-full py-1.5 px-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <LuLogOut className="size-3.5" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <button className="ai-chat-close" onClick={handleClose} aria-label="Close AI assistant">
            <LuX />
          </button>
        </div>
      </div>
      {status === "loading" ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="ai-chat-loading">Checking sign-in…</p>
        </div>
      ) : !session?.user ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <p data-ai-stagger className="mb-4 ai-text-body text-xs">
            Sign in to create and edit your model with AI. Manual modeling is available without signing in.
          </p>
          <button
            data-ai-stagger
            className="ai-google-button"
            onClick={() => {
              void signIn("google").catch(() => setError("Could not start Google sign-in. Please try again."));
            }}
          >
            <LuSparkles /> Sign in with Google
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col" data-ai-stagger>
          <AiCommandPanel key={`${session.user.id}:${projectId}`} projectId={projectId} />
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-400 mt-2 shrink-0">{error}</p>}
      </div>
    </section>
  );
}

function UnconfiguredPanel({
  getTriggerRect,
  onCloseComplete,
}: {
  getTriggerRect: () => DOMRect | null;
  onCloseComplete: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  const { handleClose } = usePanelMorphAnimation(panelRef, capRef, getTriggerRect, onCloseComplete);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

  return (
    <section
      ref={panelRef}
      aria-label="AI modeling assistant"
      data-theme="light"
      data-discipline="arch"
      className="ai-chat-panel fixed bottom-20 right-3 z-[100] w-[min(440px,calc(100vw-24px))] rounded-[26px] text-sm shadow-2xl"
    >
      {/* Smooth rotating beam of light around perimeter */}
      <div className="ai-light-beam" aria-hidden="true" />
      <div className="ai-chat-inner flex h-full min-h-0 flex-col p-4">

      <div className="ai-chat-header mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div ref={capRef} className="flex items-center justify-center shrink-0">
            <img src="/ai.svg" alt="" className="size-6 object-contain" />
          </div>
          <h2 data-ai-stagger className="font-bold tracking-tight leading-tight text-sm text-[var(--text-strong)]">V Studio Assistant</h2>
        </div>
        <div data-ai-stagger className="flex items-center gap-1.5">
          <button className="ai-chat-close" onClick={handleClose} aria-label="Close AI assistant">
            <LuX />
          </button>
        </div>
      </div>
      <p data-ai-stagger className="text-xs ai-text-body">
        Google sign-in is not configured on this server yet. Add <code>AUTH_SECRET</code>, <code>AUTH_GOOGLE_ID</code>, and <code>AUTH_GOOGLE_SECRET</code>, then restart the server. Manual modeling remains available.
      </p>
      </div>
    </section>
  );
}

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const triggerRectRef = useRef<DOMRect | null>(null);
  const orbRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);

  // Preflight auth configuration on mount so there is no flickering/re-morphing
  useEffect(() => {
    let active = true;
    void fetch("/api/auth/status", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ configured?: boolean }>) : Promise.reject(new Error("status"))))
      .then((result) => {
        if (active) setConfigured(result.configured === true);
      })
      .catch(() => {
        if (active) setConfigured(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (!orbRef.current || !ringRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.to(orbRef.current, { y: -3, rotation: 12, duration: 1.8, ease: "sine.inOut", repeat: -1, yoyo: true });
      gsap.to(ringRef.current, { rotation: 360, duration: 8, repeat: -1, ease: "none" });
    }, triggerRef);
    return () => ctx.revert();
  }, []);

  const handleOpen = () => {
    if (triggerRef.current) {
      triggerRectRef.current = triggerRef.current.getBoundingClientRect();
    }
    if (configured !== null) setOpen(true);
  };

  const handleCloseComplete = () => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  const getTriggerRect = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return rect;
    }
    return triggerRectRef.current;
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        aria-expanded={open}
        tabIndex={open ? -1 : 0}
        aria-label="Open AI assistant"
        data-discipline="arch"
        style={{
          opacity: open ? 0 : 1,
          pointerEvents: open ? "none" : "auto",
          transition: "opacity 0.08s ease",
        }}
        className="ai-orb-trigger fixed bottom-4 right-4 z-[100] items-center justify-center rounded-full shadow-xl flex"
      >
        <span ref={ringRef} aria-hidden className="ai-orb-ring" />
        <span ref={orbRef} aria-hidden className="ai-orb-icon"><img src="/ai.svg" alt="" /></span>
      </button>

      {open && configured !== false && (
        <SessionProvider>
          <AssistantPanel
            getTriggerRect={getTriggerRect}
            onCloseComplete={handleCloseComplete}
          />
        </SessionProvider>
      )}

      {open && configured === false && (
        <UnconfiguredPanel
          getTriggerRect={getTriggerRect}
          onCloseComplete={handleCloseComplete}
        />
      )}
    </>
  );
}
