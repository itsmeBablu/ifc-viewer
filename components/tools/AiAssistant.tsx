"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import gsap from "gsap";
import { LuLogOut, LuSparkles, LuX } from "react-icons/lu";
import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import AiCommandPanel from "./AiCommandPanel";

function animateAssistantIcon(icon: Element | null) {
  if (!icon) return;
  gsap.fromTo(icon, { y: 0, rotation: 0 }, {
    y: -3, rotation: 12, duration: 1.8, ease: "sine.inOut", repeat: -1, yoyo: true,
  }).totalTime(gsap.globalTimeline.time());
}

type PanelBox = { left: number; top: number; width: number; height: number };

function panelBounds() {
  const viewport = window.visualViewport;
  const left = (viewport?.offsetLeft ?? 0) + 8;
  const top = (viewport?.offsetTop ?? 0) + 8;
  return { left, top, right: left + (viewport?.width ?? window.innerWidth) - 16,
    bottom: top + (viewport?.height ?? window.innerHeight) - 16 };
}

const PANEL_LAYOUT_KEY = "vstudio:ai-assistant-window";

function fitPanelBox(box: PanelBox): PanelBox {
  const bounds = panelBounds();
  const width = Math.min(Math.max(300, box.width), bounds.right - bounds.left);
  const height = Math.min(Math.max(240, box.height), bounds.bottom - bounds.top);
  return { width, height, left: Math.max(bounds.left, Math.min(box.left, bounds.right - width)),
    top: Math.max(bounds.top, Math.min(box.top, bounds.bottom - height)) };
}

function readPanelLayout(): PanelBox | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PANEL_LAYOUT_KEY) ?? "null");
    if (!saved || ![saved.left, saved.top, saved.width, saved.height].every((value: unknown) => typeof value === "number" && Number.isFinite(value))
      || saved.width <= 0 || saved.height <= 0) return null;
    return fitPanelBox(saved);
  } catch { return null; }
}

function savePanelLayout(panel: HTMLElement) {
  const { left, top, width, height } = panel.getBoundingClientRect();
  try { localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify({ left, top, width, height })); } catch { /* Keep controls usable when storage is unavailable. */ }
}

function usePanelWindowControls(panelRef: React.RefObject<HTMLElement | null>, readyRef: React.RefObject<boolean>) {
  const positionedRef = useRef(false);
  const gestureRef = useRef<{ pointerId: number; x: number; y: number; edge: string; box: PanelBox } | null>(null);
  const applyBox = (box: PanelBox) => {
    positionedRef.current = true;
    if (panelRef.current) panelRef.current.dataset.aiPositioned = "true";
    gsap.set(panelRef.current, { ...box, right: "auto", bottom: "auto", maxHeight: "none" });
  };
  useLayoutEffect(() => {
    const saved = readPanelLayout();
    const panel = panelRef.current;
    if (!saved || !panel) return;
    positionedRef.current = true;
    panel.dataset.aiPositioned = "true";
    gsap.set(panel, { ...saved, right: "auto", bottom: "auto", maxHeight: "none" });
  }, [panelRef]);
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!readyRef.current || event.button !== 0 || gestureRef.current) return;
    const target = event.target as HTMLElement;
    const edge = target.closest<HTMLElement>("[data-ai-resize]")?.dataset.aiResize;
    if (!edge && (!target.closest(".ai-chat-header") || target.closest("button,input,a,[role='menu']"))) return;
    const rect = event.currentTarget.getBoundingClientRect();
    gestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      edge: edge ?? "move", box: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.manipulating = edge ? "resize" : "move";
    event.preventDefault();
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !readyRef.current) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    const box = gesture.box;
    if (gesture.edge === "move") {
      applyBox(fitPanelBox({ ...box, left: box.left + dx, top: box.top + dy }));
      return;
    }
    const bounds = panelBounds();
    const minWidth = Math.min(300, bounds.right - bounds.left);
    const minHeight = Math.min(240, bounds.bottom - bounds.top);
    let left = box.left, top = box.top, right = box.left + box.width, bottom = box.top + box.height;
    if (gesture.edge.includes("w")) left = Math.max(bounds.left, Math.min(box.left + dx, right - minWidth));
    if (gesture.edge.includes("e")) right = Math.min(bounds.right, Math.max(right + dx, left + minWidth));
    if (gesture.edge.includes("n")) top = Math.max(bounds.top, Math.min(box.top + dy, bottom - minHeight));
    if (gesture.edge.includes("s")) bottom = Math.min(bounds.bottom, Math.max(bottom + dy, top + minHeight));
    applyBox({ left, top, width: right - left, height: bottom - top });
  };
  const endGesture = () => {
    const panel = panelRef.current;
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (panel) {
      delete panel.dataset.manipulating;
      if (gesture && positionedRef.current) savePanelLayout(panel);
      if (gesture && panel.hasPointerCapture(gesture.pointerId)) panel.releasePointerCapture(gesture.pointerId);
    }
  };
  const onWindowKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!readyRef.current || event.target !== event.currentTarget || !event.key.startsWith("Arrow")) return;
    event.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const step = event.shiftKey ? 24 : 8;
    const dx = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
    const dy = event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0;
    const resizing = event.currentTarget.hasAttribute("data-ai-resize");
    const bounds = panelBounds();
    applyBox(fitPanelBox({ left: rect.left + (resizing ? 0 : dx), top: rect.top + (resizing ? 0 : dy),
      width: resizing ? Math.max(Math.min(300, bounds.right - bounds.left), rect.width + dx) : rect.width,
      height: resizing ? Math.max(Math.min(240, bounds.bottom - bounds.top), rect.height + dy) : rect.height }));
    savePanelLayout(panel);
  };
  useEffect(() => {
    const fit = () => {
      const panel = panelRef.current;
      if (!panel || !positionedRef.current || !readyRef.current) return;
      const rect = panel.getBoundingClientRect();
      const bounds = panelBounds();
      const width = Math.min(rect.width, bounds.right - bounds.left);
      const height = Math.min(rect.height, bounds.bottom - bounds.top);
      gsap.set(panel, { width, height, left: Math.max(bounds.left, Math.min(rect.left, bounds.right - width)),
        top: Math.max(bounds.top, Math.min(rect.top, bounds.bottom - height)) });
    };
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("scroll", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("scroll", fit);
    };
  }, [panelRef, readyRef]);
  return { windowEvents: { onPointerDown, onPointerMove, onPointerUp: endGesture,
    onPointerCancel: endGesture, onLostPointerCapture: endGesture }, onWindowKeyDown, endGesture };
}

function PanelResizeHandles({ onKeyDown }: { onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void }) {
  return <>{["n", "e", "s", "w", "ne", "nw", "sw"].map(edge =>
    <span key={edge} data-ai-resize={edge} className={"ai-resize-handle ai-resize-" + edge} aria-hidden="true" />)}
    <button type="button" data-ai-resize="se" className="ai-resize-handle ai-resize-se"
      aria-label="Resize AI assistant" title="Drag to resize, or use arrow keys" onKeyDown={onKeyDown}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 13 13 5M9 13l4-4" /></svg>
    </button></>;
}

function usePanelMorphAnimation(
  panelRef: React.RefObject<HTMLElement | null>,
  capRef: React.RefObject<HTMLElement | null>,
  triggerRef: React.RefObject<HTMLElement | null>,
  getTriggerRect: () => DOMRect | null,
  onCloseComplete: () => void
) {

  const closingRef = useRef(false);
  const readyRef = useRef(false);
  const { windowEvents, onWindowKeyDown, endGesture } = usePanelWindowControls(panelRef, readyRef);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    readyRef.current = false;
    endGesture();
    const panel = panelRef.current;
    const triggerEl = triggerRef.current;
    if (panel) {
      panel.style.overflow = "hidden";
      delete panel.dataset.aiReady;
    }
    if (!panel || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (triggerEl) {
        gsap.set(triggerEl, { opacity: 1, pointerEvents: "auto", clearProps: "opacity,pointerEvents" });
      }
      onCloseComplete();
      return;
    }
    timelineRef.current?.kill();
    gsap.killTweensOf(panel);
    if (triggerEl) gsap.killTweensOf(triggerEl);

    const rect = panel.getBoundingClientRect();
    const trigger = getTriggerRect() ?? rect;
    const inner = panel.querySelector<HTMLElement>(".ai-chat-inner");
    const icon = capRef.current;
    const iconRect = icon?.getBoundingClientRect();
    // Keep the current content layout even when closing midway through opening.
    if (inner && !inner.style.width) {
      gsap.set(inner, { width: panel.clientWidth, height: panel.clientHeight });
    }
    // Width/height must not move a right/bottom-anchored shell as it shrinks.
    gsap.set(panel, { left: rect.left, top: rect.top, right: "auto", bottom: "auto", x: 0, y: 0,
      width: rect.width, height: rect.height });

    const isMep = panel.getAttribute("data-discipline") === "mep" || (typeof document !== "undefined" && document.body.classList.contains("mep-mode-active"));
    const targetBoxShadow = isMep
      ? "inset 0 1px 0 rgba(255,255,255,.72), 0 6px 18px rgba(56,189,248,.3)"
      : "inset 0 1px 0 rgba(255,255,255,.72), inset 0 -1px 0 rgba(180,83,9,.12), 0 6px 18px rgba(251,191,36,.2)";

    const fadeOutElements = [
      ...Array.from(panel.querySelectorAll<HTMLElement>(".ai-resize-handle, .ai-light-beam, .ai-account-menu, [data-ai-stagger]")),
      ...Array.from(panel.querySelectorAll<HTMLElement>(".ai-chat-header button, .ai-chat-header h2, .ai-chat-header p")),
      ...Array.from(panel.querySelectorAll<HTMLElement>(".ai-chat-inner > *:not(.ai-chat-header)"))
    ].filter(el => el !== icon && !icon?.contains(el));

    const tl = gsap.timeline({
      onComplete: () => {
        if (triggerEl) {
          gsap.set(triggerEl, { opacity: 1, pointerEvents: "auto", clearProps: "opacity,pointerEvents" });
        }
        onCloseComplete();
      },
    });
    timelineRef.current = tl;

    tl.to(fadeOutElements, { autoAlpha: 0, duration: 0.12, ease: "power2.out" }, 0)
      .to(panel, {
        left: trigger.left,
        top: trigger.top,
        width: trigger.width,
        height: trigger.height,
        borderRadius: trigger.width / 2,
        "--ai-glass-fill": "rgba(255,255,255,.32)",
        "--ai-glass-tint": 1,
        boxShadow: targetBoxShadow,
        duration: 0.46,
        ease: "power3.inOut",
      }, 0.02);

    if (icon && iconRect) {
      const targetRelX = (trigger.width - iconRect.width) / 2;
      const currentRelX = iconRect.left - rect.left;
      const targetRelY = (trigger.height - iconRect.height) / 2;
      const currentRelY = iconRect.top - rect.top;
      tl.to(icon, {
        x: Number(gsap.getProperty(icon, "x")) + (targetRelX - currentRelX),
        y: Number(gsap.getProperty(icon, "y")) + (targetRelY - currentRelY),
        duration: 0.46,
        ease: "power3.inOut",
      }, 0.02);
    }

    if (triggerEl) {
      tl.fromTo(triggerEl,
        { opacity: 0, pointerEvents: "none" },
        { opacity: 1, pointerEvents: "auto", duration: 0.14, ease: "power2.out" },
        0.30
      );
    }
    tl.to(panel, {
      autoAlpha: 0,
      duration: 0.14,
      ease: "power2.in",
    }, 0.32);
  };

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    closingRef.current = false;
    readyRef.current = false;
    delete panel.dataset.aiReady;
    const ctx = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { readyRef.current = true; panel.dataset.aiReady = "true"; return; }
      animateAssistantIcon(capRef.current?.querySelector("img") ?? null);
      const rect = panel.getBoundingClientRect();
      const trigger = getTriggerRect() ?? rect;
      const inner = panel.querySelector(".ai-chat-inner");
      const icon = capRef.current;
      const iconRect = icon?.getBoundingClientRect();
      gsap.set(inner, { width: panel.clientWidth, height: panel.clientHeight });
      gsap.set(panel, { autoAlpha: 1, left: trigger.left, top: trigger.top, right: "auto", bottom: "auto",
        width: trigger.width, height: trigger.height, borderRadius: trigger.width / 2,
        "--ai-glass-fill": "rgba(255,255,255,.32)", "--ai-glass-tint": 1 });
      if (icon && iconRect) {
        gsap.set(icon, { x: trigger.width / 2 - (iconRect.left + iconRect.width / 2 - rect.left),
          y: trigger.height / 2 - (iconRect.top + iconRect.height / 2 - rect.top) });
      }
      timelineRef.current = gsap.timeline()
        .to(panel, { left: rect.left, top: rect.top, width: rect.width, height: rect.height, borderRadius: 26,
          "--ai-glass-fill": "rgba(255,255,255,.82)", "--ai-glass-tint": 0, duration: .58, ease: "power3.inOut",
          onComplete: () => {
            // Return sizing to CSS so viewport changes continue to reflow the chat.
            if (!panel.dataset.aiPositioned) {
              gsap.set(panel, { clearProps: "left,top,right,bottom,width,height,borderRadius,overflow" });
            } else {
              gsap.set(panel, fitPanelBox(rect));
              panel.style.overflow = "";
            }
            gsap.set(inner, { clearProps: "width,height" });
            readyRef.current = true;
            panel.dataset.aiReady = "true";
          } }, 0)
        .fromTo(panel.querySelectorAll("[data-ai-stagger]"), { autoAlpha: 0, y: 8 },
          { autoAlpha: 1, y: 0, duration: .22, stagger: .025 }, .32);
      if (icon) timelineRef.current.to(icon, { x: 0, y: 0, duration: .58, ease: "power3.inOut" }, 0);
      gsap.to(panel.querySelector(".ai-light-beam"), { "--ai-beam-angle": "360deg", duration: 6, repeat: -1, ease: "none" });
    }, panelRef);
    return () => {
      timelineRef.current?.kill();
      if (panelRef.current) gsap.killTweensOf(panelRef.current);
      if (triggerRef.current) gsap.killTweensOf(triggerRef.current);
      ctx.revert();
    };
  }, [panelRef, capRef, triggerRef, getTriggerRect]);

  return { handleClose, windowEvents, onWindowKeyDown };
}

function AssistantPanel({
  triggerRef,
  getTriggerRect,
  onCloseComplete,
}: {
  triggerRef: React.RefObject<HTMLButtonElement | null>;
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

  const { handleClose, windowEvents, onWindowKeyDown } = usePanelMorphAnimation(panelRef, capRef, triggerRef, getTriggerRect, onCloseComplete);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.closest?.(".ai-sketch-overlay, .ai-model-dropdown-menu")) return;
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

  // Automatically establish guest session if unauthenticated so AI chat is never blocked
  useEffect(() => {
    if (status === "unauthenticated") {
      void signIn("guest", { redirect: false }).catch(() => {});
    }
  }, [status]);

  return (
    <section
      ref={panelRef}
      {...windowEvents}
      aria-label="AI modeling assistant"
      data-theme="light"
      data-discipline={mepModeActive ? "mep" : "arch"}
      className="ai-chat-panel fixed bottom-20 right-3 z-[100] flex flex-col h-[min(650px,calc(100dvh-100px))] w-[min(460px,calc(100vw-24px))] rounded-[26px] text-sm shadow-2xl overflow-hidden"
    >
      {/* Smooth rotating beam of light around perimeter in v-Yellow or v-Blue */}
      <div className="ai-light-beam" aria-hidden="true" />
      <div className="ai-chat-inner flex h-full min-h-0 flex-col p-3">

      <div tabIndex={0} onKeyDown={onWindowKeyDown} title="Drag to move, or use arrow keys" className="ai-chat-header shrink-0 mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div ref={capRef} className="ai-orb-icon shrink-0">
            <img src="/ai.svg" alt="" className="size-6 object-contain" />
          </div>
          <div data-ai-stagger>
            <div className="flex items-center gap-1.5">
              <h2 className="font-extrabold tracking-tight leading-tight text-sm text-[var(--text-strong)]">V Studio Assistant</h2>
              <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Gemini
              </span>
            </div>
            <p className="text-[10px] text-zinc-400">Design · Model · Layout · MEP</p>
          </div>
        </div>
        <div data-ai-stagger className="relative z-[70] flex items-center gap-1.5">
          {session?.user && (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(prev => !prev)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                title={session.user.name ?? session.user.email ?? "Account"}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-400/30 hover:bg-amber-500/20 transition-all text-xs"
              >
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-[11px] font-medium text-amber-300 max-w-[90px] truncate">
                  {session.user.name || "Guest"}
                </span>
              </button>
              {userMenuOpen && (
                <div
                  role="menu"
                  className="ai-account-menu absolute right-0 top-full mt-2 z-[150] w-64 rounded-2xl border border-[var(--panel-divider)] bg-[var(--surface-card)] p-3 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150"
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
                      <div className="size-9 rounded-full bg-amber-500/20 text-amber-400 font-bold text-sm flex items-center justify-center border border-amber-500/30">
                        {(session.user.name?.[0] ?? session.user.email?.[0] ?? "G").toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs text-[var(--text-strong)] truncate">
                        {session.user.name || "Guest Architect"}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] truncate">
                        {session.user.email || "guest@vstudio.local"}
                      </p>
                    </div>
                  </div>
                  <div className="py-2 space-y-1.5 border-b border-[var(--panel-divider)] text-[11px]">
                    <div className="flex items-center justify-between text-[var(--text-muted)]">
                      <span>Status</span>
                      <span className="flex items-center gap-1 font-medium text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-400 inline-block" />
                        Active & Ready
                      </span>
                    </div>
                    {projectId && (
                      <div className="flex items-center justify-between text-[var(--text-muted)]">
                        <span>Project</span>
                        <span className="font-mono text-[10px] text-[var(--text-strong)] truncate max-w-[120px]">
                          {projectId}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="pt-2 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        void signIn("google");
                      }}
                      className="flex items-center gap-2 w-full py-1.5 px-2 rounded-xl text-xs font-semibold text-amber-400 hover:bg-amber-500/10 transition-colors"
                    >
                      <LuSparkles className="size-3.5" />
                      <span>Sign in with Google</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        void signOut();
                      }}
                      className="flex items-center gap-2 w-full py-1.5 px-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LuLogOut className="size-3.5" />
                      <span>Reset Session</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <button className="ai-chat-close flex items-center justify-center p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-zinc-100 transition-colors" onClick={handleClose} aria-label="Close AI assistant">
            <LuX className="size-4" />
          </button>
        </div>
      </div>
      {status === "loading" && !session?.user ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-4">
          <div className="size-6 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          <p className="ai-chat-loading text-xs text-amber-300/80 font-medium">Connecting AI Assistant…</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col" data-ai-stagger>
          <AiCommandPanel key={`${session?.user?.id ?? "guest"}:${projectId}`} projectId={projectId} />
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-400 mt-2 shrink-0">{error}</p>}
      </div>
      <PanelResizeHandles onKeyDown={onWindowKeyDown} />
    </section>
  );

}

function UnconfiguredPanel({
  triggerRef,
  getTriggerRect,
  onCloseComplete,
}: {
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  getTriggerRect: () => DOMRect | null;
  onCloseComplete: () => void;
}) {
  const mepModeActive = useLayoutDrawingStore(s => s.mepModeActive);
  const panelRef = useRef<HTMLElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  const { handleClose, windowEvents, onWindowKeyDown } = usePanelMorphAnimation(panelRef, capRef, triggerRef, getTriggerRect, onCloseComplete);

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
      {...windowEvents}
      aria-label="AI modeling assistant"
      data-theme="light"
      data-discipline={mepModeActive ? "mep" : "arch"}
      className="ai-chat-panel fixed bottom-20 right-3 z-[100] w-[min(440px,calc(100vw-24px))] rounded-[26px] text-sm shadow-2xl"
    >
      {/* Smooth rotating beam of light around perimeter */}
      <div className="ai-light-beam" aria-hidden="true" />
      <div className="ai-chat-inner flex h-full min-h-0 flex-col p-2.5">

      <div tabIndex={0} onKeyDown={onWindowKeyDown} title="Drag to move, or use arrow keys" className="ai-chat-header mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div ref={capRef} className="ai-orb-icon shrink-0">
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
      <PanelResizeHandles onKeyDown={onWindowKeyDown} />
    </section>
  );
}

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const mepModeActive = useLayoutDrawingStore(s => s.mepModeActive);
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
      animateAssistantIcon(orbRef.current?.querySelector("img") ?? null);
      gsap.to(ringRef.current, { rotation: 360, duration: 8, repeat: -1, ease: "none" });
    }, triggerRef);
    return () => ctx.revert();
  }, []);

  const handleOpen = useCallback(() => {
    if (triggerRef.current) {
      triggerRectRef.current = triggerRef.current.getBoundingClientRect();
      gsap.killTweensOf(triggerRef.current);
    }
    if (configured !== null) setOpen(true);
  }, [configured]);

  useEffect(() => {
    const onOpen = () => handleOpen();
    window.addEventListener("open-smart-building-generator", onOpen);
    return () => window.removeEventListener("open-smart-building-generator", onOpen);
  }, [handleOpen]);

  const handleCloseComplete = useCallback(() => {
    setOpen(false);
    if (triggerRef.current) {
      gsap.set(triggerRef.current, { clearProps: "opacity,pointerEvents" });
      triggerRef.current.focus({ preventScroll: true });
    }
  }, []);

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
        data-discipline={mepModeActive ? "mep" : "arch"}
        style={{
          opacity: open ? 0 : 1,
          pointerEvents: open ? "none" : "auto",
        }}
        className="ai-orb-trigger fixed bottom-4 right-4 z-[100] items-center justify-center rounded-full shadow-xl flex"
      >
        <span ref={ringRef} aria-hidden className="ai-orb-ring" />
        <span ref={orbRef} aria-hidden className="ai-orb-icon"><img src="/ai.svg" alt="" /></span>
      </button>

      {open && (
        <SessionProvider>
          <AssistantPanel
            triggerRef={triggerRef}
            getTriggerRect={getTriggerRect}
            onCloseComplete={handleCloseComplete}
          />
        </SessionProvider>
      )}
    </>
  );
}

