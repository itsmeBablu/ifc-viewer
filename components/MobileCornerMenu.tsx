"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import GlassPanel from "./GlassPanel";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const DUR_MS = 400;

/** Three lines ↔ X morph (iOS-style). */
function MorphMenuIcon({ open }: { open: boolean }) {
  const bar =
    "absolute left-1/2 top-1/2 h-[1.5px] w-[14px] -translate-x-1/2 rounded-full bg-current transition-[transform,opacity] duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)]";
  return (
    <span className="relative mx-auto block h-4 w-4" aria-hidden>
      <span
        className={`${bar} ${
          open
            ? "-translate-y-1/2 rotate-45"
            : "-translate-y-[5px] rotate-0"
        }`}
      />
      <span
        className={`${bar} -translate-y-1/2 ${
          open ? "opacity-0 scale-x-50" : "opacity-100 scale-x-100"
        }`}
      />
      <span
        className={`${bar} ${
          open
            ? "-translate-y-1/2 -rotate-45"
            : "translate-y-[3.5px] rotate-0"
        }`}
      />
    </span>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
};

/**
 * Circular chip at bottom-right (above toolbar). Panel scales upward from it.
 */
export default function MobileCornerMenu({
  open,
  onOpenChange,
  title,
  children,
}: Props) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setShown(true));
      });
      return;
    }
    setShown(false);
    closeTimer.current = window.setTimeout(() => setMounted(false), DUR_MS);
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, [open]);

  return (
    <div
      className="pointer-events-auto fixed right-3 z-[55]"
      style={{
        bottom:
          "calc(4.15rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {(open || shown) && (
        <button
          type="button"
          aria-label={t(uiLanguage, "closePanels")}
          tabIndex={open ? 0 : -1}
          className="fixed inset-0 z-0 bg-zinc-900/28"
          style={{
            opacity: shown ? 1 : 0,
            pointerEvents: shown ? "auto" : "none",
            transition: `opacity ${DUR_MS}ms ${EASE}`,
          }}
          onClick={() => onOpenChange(false)}
        />
      )}

      <div className="relative z-10 h-11 w-11">
        {mounted && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="absolute bottom-0 right-0 origin-bottom-right will-change-transform"
            style={{
              width: "min(calc(100vw - 1.5rem), 22rem)",
              maxHeight:
                "min(calc(100dvh - 8.5rem - env(safe-area-inset-bottom, 0px)), 36rem)",
              transform: shown ? "scale(1)" : "scale(0.18)",
              opacity: shown ? 1 : 0,
              pointerEvents: shown ? "auto" : "none",
              transition: `transform ${DUR_MS}ms ${EASE}, opacity ${DUR_MS * 0.75}ms ${EASE}`,
            }}
          >
            <GlassPanel
              variant="panel"
              zIndex={56}
              wrapperClassName="overflow-hidden rounded-[1.35rem]"
            >
              <div
                className="flex flex-col overflow-hidden"
                style={{
                  maxHeight:
                    "min(calc(100dvh - 8.5rem - env(safe-area-inset-bottom, 0px)), 36rem)",
                }}
              >
                <div className="flex h-11 shrink-0 items-center border-b border-white/35 pr-1 pl-3.5">
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold tracking-wide text-zinc-800">
                    {title}
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    aria-label={t(uiLanguage, "closePanels")}
                    className="flex h-11 w-11 shrink-0 items-center justify-center text-zinc-800 active:opacity-70"
                  >
                    <MorphMenuIcon open />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth">
                  {children}
                </div>
              </div>
            </GlassPanel>
          </div>
        )}

        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-label={
            open ? t(uiLanguage, "closePanels") : t(uiLanguage, "showPanels")
          }
          className="absolute bottom-0 right-0 z-20 h-11 w-11"
          style={{
            opacity: shown ? 0 : 1,
            pointerEvents: shown ? "none" : "auto",
            transform: shown ? "scale(0.85)" : "scale(1)",
            transition: `opacity ${DUR_MS * 0.55}ms ${EASE}, transform ${DUR_MS}ms ${EASE}`,
          }}
        >
          <GlassPanel
            variant="control"
            zIndex={60}
            fill
            wrapperClassName="h-full w-full overflow-hidden !rounded-full"
            wrapperStyle={{ borderRadius: 9999 }}
          >
            <div className="flex h-full w-full items-center justify-center text-zinc-800">
              <MorphMenuIcon open={false} />
            </div>
          </GlassPanel>
        </button>
      </div>
    </div>
  );
}
