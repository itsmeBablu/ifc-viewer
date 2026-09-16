"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const isClosingRef = useRef(false);
  const hasEnteredRef = useRef(false);

  const handleClose = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    if (!panelRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onCloseComplete();
      return;
    }
    const panel = panelRef.current;
    const panelRect = panel.getBoundingClientRect();
    const tr = getTriggerRect() ?? {
      left: panelRect.right - 46,
      top: panelRect.bottom - 46,
      width: 46,
      height: 46,
    };
    const deltaX = tr.left + tr.width / 2 - (panelRect.left + panelRect.width / 2);
    const deltaY = tr.top + tr.height / 2 - (panelRect.top + panelRect.height / 2);
    const initialScale = Math.max(0.08, Math.min(tr.width / panelRect.width, tr.height / panelRect.height));

    // Staggered text fade out
    gsap.to(panel.querySelectorAll("[data-ai-stagger]"), {
      autoAlpha: 0,
      y: 6,
      duration: 0.12,
      ease: "power2.in",
    });

    // Helmet cap icon flies back smoothly towards the corner button
    if (capRef.current) {
      const capRect = capRef.current.getBoundingClientRect();
      const capDeltaX = tr.left + tr.width / 2 - (capRect.left + capRect.width / 2);
      const capDeltaY = tr.top + tr.height / 2 - (capRect.top + capRect.height / 2);
      gsap.to(capRef.current, {
        x: capDeltaX,
        y: capDeltaY,
        scale: 1.25,
        rotation: -25,
        autoAlpha: 0.3,
        duration: 0.36,
        ease: "power3.inOut",
      });
    }

    // Panel collapses and morphs back into the circular orb
    gsap.to(panel, {
      x: deltaX,
      y: deltaY,
      scale: initialScale,
      borderRadius: 100,
      filter: "drop-shadow(0 0 18px rgba(250,204,21,0.75))",
      autoAlpha: 0,
      duration: 0.36,
      ease: "power3.inOut",
      onComplete: () => {
        onCloseComplete();
      },
    });
  };

  useLayoutEffect(() => {
    if (hasEnteredRef.current) return;
    hasEnteredRef.current = true;
    if (!panelRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const panel = panelRef.current;
    const panelRect = panel.getBoundingClientRect();
    const tr = getTriggerRect() ?? {
      left: panelRect.right - 46,
      top: panelRect.bottom - 46,
      width: 46,
      height: 46,
    };
    const deltaX = tr.left + tr.width / 2 - (panelRect.left + panelRect.width / 2);
    const deltaY = tr.top + tr.height / 2 - (panelRect.top + panelRect.height / 2);
    const initialScale = Math.max(0.08, Math.min(tr.width / panelRect.width, tr.height / panelRect.height));

    const ctx = gsap.context(() => {
      // Panel blossoms and expands from the bubble button
      gsap.fromTo(
        panel,
        {
          x: deltaX,
          y: deltaY,
          scale: initialScale,
          borderRadius: 100,
          autoAlpha: 0.2,
          filter: "drop-shadow(0 0 20px rgba(250,204,21,0.85))",
          transformOrigin: "center center",
        },
        {
          x: 0,
          y: 0,
          scale: 1,
          borderRadius: 26,
          autoAlpha: 1,
          filter: "drop-shadow(0 0 0px rgba(250,204,21,0))",
          duration: 0.46,
          ease: "power3.out",
        }
      );

      // Helmet cap icon smoothly flies from the trigger location straight to the header badge!
      if (capRef.current) {
        const capRect = capRef.current.getBoundingClientRect();
        const capDeltaX = tr.left + tr.width / 2 - (capRect.left + capRect.width / 2);
        const capDeltaY = tr.top + tr.height / 2 - (capRect.top + capRect.height / 2);
        gsap.fromTo(
          capRef.current,
          {
            x: capDeltaX,
            y: capDeltaY,
            scale: 1.3,
            rotation: 25,
            autoAlpha: 0.9,
          },
          {
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            autoAlpha: 1,
            duration: 0.48,
            ease: "power3.out",
          }
        );
      }

      gsap.fromTo(
        panel.querySelectorAll("[data-ai-stagger]"),
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.28, stagger: 0.04, delay: 0.14, ease: "power2.out" }
      );
    }, panelRef);
    return () => ctx.revert();
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
  const mepModeActive = useLayoutDrawingStore(s => s.mepModeActive);
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
      data-discipline={mepModeActive ? "mep" : "arch"}
      className="ai-chat-panel fixed bottom-20 right-3 z-[100] flex flex-col h-[min(650px,calc(100dvh-100px))] w-[min(440px,calc(100vw-24px))] overflow-hidden rounded-[26px] p-4 text-sm shadow-2xl"
    >
      <div data-ai-stagger className="ai-chat-header shrink-0 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            ref={capRef}
            className="ai-header-cap-badge flex items-center justify-center size-7.5 rounded-xl border border-[var(--ai-accent,#facc15)]/40 bg-[var(--ai-accent-bg,rgba(250,204,21,0.15))] shadow-[0_0_12px_var(--ai-accent-glow,rgba(250,204,21,0.25))] shrink-0"
          >
            <img src="/ai.svg" alt="" className="size-4.5 object-contain" />
          </div>
          <div>
            <h2 className="font-bold tracking-tight leading-tight text-sm text-[var(--text-strong)]">V Studio Assistant</h2>
            <p className="text-[10px] ai-text-muted">Design · Model · Review</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
  const mepModeActive = useLayoutDrawingStore(s => s.mepModeActive);
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
      data-discipline={mepModeActive ? "mep" : "arch"}
      className="ai-chat-panel fixed bottom-20 right-3 z-[100] w-[min(440px,calc(100vw-24px))] rounded-[26px] p-4 text-sm shadow-2xl"
    >
      <div data-ai-stagger className="ai-chat-header mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            ref={capRef}
            className="ai-header-cap-badge flex items-center justify-center size-7.5 rounded-xl border border-[var(--ai-accent,#facc15)]/40 bg-[var(--ai-accent-bg,rgba(250,204,21,0.15))] shadow-[0_0_12px_var(--ai-accent-glow,rgba(250,204,21,0.25))] shrink-0"
          >
            <img src="/ai.svg" alt="" className="size-4.5 object-contain" />
          </div>
          <h2 className="font-bold tracking-tight leading-tight text-sm text-[var(--text-strong)]">V Studio Assistant</h2>
        </div>
        <button className="ai-chat-close" onClick={handleClose} aria-label="Close AI assistant">
          <LuX />
        </button>
      </div>
      <p data-ai-stagger className="text-xs ai-text-body">
        Google sign-in is not configured on this server yet. Add <code>AUTH_SECRET</code>, <code>AUTH_GOOGLE_ID</code>, and <code>AUTH_GOOGLE_SECRET</code>, then restart the server. Manual modeling remains available.
      </p>
    </section>
  );
}

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const mepModeActive = useLayoutDrawingStore(s => s.mepModeActive);
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
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.to(triggerRef.current, {
          scale: 0.25,
          autoAlpha: 0,
          duration: 0.18,
          ease: "power2.in",
          onComplete: () => {
            setOpen(true);
          },
        });
        return;
      }
    }
    setOpen(true);
  };

  const handleCloseComplete = () => {
    setOpen(false);
    if (triggerRef.current) {
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.fromTo(
          triggerRef.current,
          { scale: 0.2, autoAlpha: 0, rotation: -30 },
          { scale: 1, autoAlpha: 1, rotation: 0, duration: 0.45, ease: "back.out(2)" }
        );
      } else {
        gsap.set(triggerRef.current, { autoAlpha: 1, scale: 1 });
      }
    }
  };

  const getTriggerRect = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return rect;
    }
    return triggerRectRef.current;
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        aria-expanded={open}
        aria-label="Open AI assistant"
        data-discipline={mepModeActive ? "mep" : "arch"}
        style={{ display: open ? "none" : "flex" }}
        className="ai-orb-trigger fixed bottom-4 right-4 z-[100] items-center justify-center rounded-full shadow-xl"
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
