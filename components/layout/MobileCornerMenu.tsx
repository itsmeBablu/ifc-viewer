"use client";

/**
 * MobileCornerMenu — bottom-right "more" chip for compact/mobile layouts that
 * expands into a glass sheet housing the model title, IFC upload badge/menu,
 * and a details toggle, with arbitrary panel content passed in via `children`.
 *
 * Purely presentational/interaction shell: open/close and animation state
 * (GSAP scale/fade transitions for chip <-> sheet) are managed locally; the
 * open flag itself is controlled by the parent via `open`/`onOpenChange`.
 * Supports a landscape-phone docking layout via `useMobileLandscapeDockLayout`.
 */

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import gsap from "gsap";
import { CiCircleMore } from "react-icons/ci";
import { IoChevronDownSharp, IoChevronUp, IoClose } from "react-icons/io5";
import GlassPanel from "../common/GlassPanel";
import { t } from "@/lib/i18n";
import { gsapDuration, gsapEase, killGsap } from "@/lib/gsapMotion";
import { useAppStore } from "@/store/useAppStore";
import {
  mobileDockHeightCss,
  mobileLandscapeBottomClass,
  mobileLandscapeRightClass,
} from "@/lib/layoutTokens";
import { useMobileLandscapeDockLayout } from "@/lib/useMobileLandscapeDockLayout";

const CHIP = 36;

const yellowLiquid =
  "border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_14px_rgba(251,191,36,0.35)] backdrop-blur-md";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "Modell" — left label */
  title: string;
  /** IFC file name — yellow badge */
  subtitle?: string | null;
  onLoadIfc?: (file: File) => void;
  isLoadingModel?: boolean;
  /** Landscape phone — bottom-right sheet, grows up to viewport max. */
  landscapeMobile?: boolean;
  children: (api: { detailsOpen: boolean }) => ReactNode;
};

/**
 * Yellow liquid-glass “more” chip — bottom-right.
 * Header matches desktop: Modell | yellow IFC badge + details arrow.
 */
export default function MobileCornerMenu({
  open,
  onOpenChange,
  title,
  subtitle = null,
  onLoadIfc,
  isLoadingModel = false,
  landscapeMobile = false,
  children,
}: Props) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const [mounted, setMounted] = useState(open);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const chipBtnRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useLayoutEffect(() => {
    const backdrop = backdropRef.current;
    const sheet = sheetRef.current;
    const chip = chipBtnRef.current;
    if (!mounted) return;

    if (open) {
      if (backdrop) {
        killGsap(backdrop);
        gsap.fromTo(
          backdrop,
          { autoAlpha: 0 },
          {
            autoAlpha: 1,
            duration: gsapDuration.mobile,
            ease: gsapEase.mobile,
          },
        );
      }
      if (sheet) {
        killGsap(sheet);
        gsap.fromTo(
          sheet,
          { scale: 0.18, autoAlpha: 0, transformOrigin: "bottom right" },
          {
            scale: 1,
            autoAlpha: 1,
            duration: gsapDuration.mobile,
            ease: gsapEase.snap,
          },
        );
      }
      if (chip) {
        killGsap(chip);
        gsap.to(chip, {
          scale: 0.85,
          autoAlpha: 0,
          duration: gsapDuration.mobile * 0.55,
          ease: gsapEase.mobile,
          pointerEvents: "none",
        });
      }
      return;
    }

    if (backdrop) {
      killGsap(backdrop);
      gsap.to(backdrop, {
        autoAlpha: 0,
        duration: gsapDuration.mobile,
        ease: gsapEase.mobile,
        pointerEvents: "none",
      });
    }
    if (sheet) {
      killGsap(sheet);
      gsap.to(sheet, {
        scale: 0.18,
        autoAlpha: 0,
        transformOrigin: "bottom right",
        duration: gsapDuration.mobile,
        ease: gsapEase.mobile,
        pointerEvents: "none",
        onComplete: () => setMounted(false),
      });
    } else {
      setMounted(false);
    }
    if (chip) {
      killGsap(chip);
      gsap.to(chip, {
        scale: 1,
        autoAlpha: 1,
        duration: gsapDuration.mobile,
        ease: gsapEase.snap,
        pointerEvents: "auto",
      });
    }
    setModelMenuOpen(false);
  }, [open, mounted, landscapeMobile]);

  useLayoutEffect(() => {
    if (!modelMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current?.contains(target) ||
        badgeRef.current?.contains(target)
      ) {
        return;
      }
      setModelMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [modelMenuOpen]);

  const landscapeLayout = useMobileLandscapeDockLayout(landscapeMobile);
  const maxH = landscapeMobile
    ? landscapeLayout?.maxHeight ?? mobileDockHeightCss(true)
    : "min(calc(100dvh - 5.5rem - env(safe-area-inset-bottom, 0px)), 36rem)";
  const chipBox = { width: CHIP, height: CHIP };
  const ifcName = subtitle?.trim() || "—";

  return (
    <div
      className={`pointer-events-auto fixed z-[55] ${
        landscapeMobile
          ? `${mobileLandscapeRightClass} ${mobileLandscapeBottomClass}`
          : "right-2"
      }`}
      style={
        landscapeMobile
          ? undefined
          : { bottom: "calc(3.7rem + env(safe-area-inset-bottom, 0px))" }
      }
    >
      {mounted && (
        <button
          ref={backdropRef}
          type="button"
          aria-label={t(uiLanguage, "closePanels")}
          tabIndex={open ? 0 : -1}
          className="fixed inset-0 z-0 bg-zinc-900/28"
          style={{ visibility: "hidden" }}
          onClick={() => onOpenChange(false)}
        />
      )}

      <div className="relative z-10" style={chipBox}>
        {mounted && (
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={ifcName}
            className="absolute bottom-0 right-0 origin-bottom-right will-change-transform"
            style={{
              width: landscapeMobile
                ? "min(calc(100vw - 1.5rem), 24rem)"
                : "min(calc(100vw - 1.5rem), 22rem)",
              maxHeight: maxH,
              visibility: "hidden",
            }}
          >
            <GlassPanel
              variant="panel"
              zIndex={56}
              wrapperClassName="overflow-hidden rounded-[1.25rem]"
            >
              <div
                className="flex max-h-[inherit] flex-col overflow-hidden"
                style={{ maxHeight: maxH }}
              >
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/35 px-3 py-2">
                  <p className="shrink-0 text-[11px] font-medium tracking-wide text-zinc-500">
                    {title}
                  </p>
                  <div className="flex min-w-0 items-center gap-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".ifc,application/x-step,application/octet-stream,.IFC"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) onLoadIfc?.(file);
                      }}
                    />
                    <div className="relative max-w-[min(100%,11.5rem)]">
                      <div
                        ref={badgeRef}
                        className={`flex max-w-full items-center gap-0.5 rounded-full py-0.5 pl-2.5 pr-1 ${yellowLiquid}`}
                      >
                        <button
                          type="button"
                          disabled={isLoadingModel}
                          onClick={() => setModelMenuOpen((v) => !v)}
                          className="notranslate min-w-0 truncate text-[11px] font-semibold transition active:scale-[0.98] disabled:opacity-45"
                          translate="no"
                          aria-expanded={modelMenuOpen}
                          aria-label={ifcName}
                        >
                          {ifcName}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailsOpen((v) => !v)}
                          aria-label={
                            detailsOpen
                              ? "Hide model details"
                              : "Show model details"
                          }
                          aria-expanded={detailsOpen}
                          className="flex shrink-0 items-center justify-center rounded-full px-1 py-0.5 text-amber-950/80 transition hover:bg-amber-950/10"
                        >
                          {detailsOpen ? (
                            <IoChevronUp className="h-3 w-3" />
                          ) : (
                            <IoChevronDownSharp className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      {modelMenuOpen && (
                        <div
                          ref={menuRef}
                          className="absolute top-[calc(100%+0.35rem)] right-0 z-[70] w-max min-w-[10.5rem]"
                        >
                          <GlassPanel variant="control" zIndex={70}>
                            <div className="flex flex-col gap-1 p-1.5">
                              <button
                                type="button"
                                disabled={isLoadingModel || !onLoadIfc}
                                onClick={() => {
                                  setModelMenuOpen(false);
                                  fileInputRef.current?.click();
                                }}
                                className="rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-200/90 via-yellow-300/70 to-amber-400/55 px-2.5 py-1.5 text-left text-[11px] font-semibold text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition hover:brightness-105 disabled:opacity-45"
                              >
                                {t(uiLanguage, "loadOtherIfc")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setModelMenuOpen(false)}
                                className="rounded-xl border border-transparent px-2.5 py-1.5 text-left text-[11px] text-zinc-700 transition hover:border-white/55 hover:bg-white/40"
                              >
                                {t(uiLanguage, "cancel")}
                              </button>
                            </div>
                          </GlassPanel>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      aria-label={t(uiLanguage, "closePanels")}
                      className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-800 active:opacity-70"
                    >
                      <IoClose className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth">
                  {children({ detailsOpen })}
                </div>
              </div>
            </GlassPanel>
          </div>
        )}

        <button
          ref={chipBtnRef}
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-label={
            open ? t(uiLanguage, "closePanels") : t(uiLanguage, "showPanels")
          }
          className="absolute bottom-0 right-0 z-20 overflow-hidden rounded-full active:scale-95"
          style={chipBox}
        >
          <span
            className={`flex h-full w-full items-center justify-center ${yellowLiquid}`}
          >
            <CiCircleMore className="h-5 w-5" aria-hidden />
          </span>
        </button>
      </div>
    </div>
  );
}
