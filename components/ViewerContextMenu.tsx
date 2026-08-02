"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { MdKeyboardArrowRight } from "react-icons/md";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import type { PageFormat } from "@/lib/presentationLayout";
import SliceHeightSlider from "./SliceHeightSlider";
import type { Viewer3DHandle } from "./Viewer3D";
import ModelText from "./ModelText";

type Props = {
  viewerRef: RefObject<Viewer3DHandle | null>;
  rootRef: RefObject<HTMLElement | null>;
  onLoadIfc: (file: File) => void;
  loadDisabled?: boolean;
};

type MenuState = {
  x: number;
  y: number;
};

type SidePanel = "save" | "floor" | null;

const ctxMenuSurface =
  "context-menu-surface presentation-menu-surface isolate overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-100/78 via-yellow-50/62 to-amber-200/48 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_32px_rgba(251,191,36,0.28)] backdrop-blur-md";

const ctxItemIdle =
  "flex w-full items-center justify-between gap-2 overflow-hidden rounded-xl border border-transparent px-2.5 py-2 text-left text-xs font-medium text-[var(--text-body)] transition-all duration-300 ease-out hover:border-amber-200/70 hover:bg-gradient-to-br hover:from-amber-200/95 hover:via-yellow-300/85 hover:to-amber-400/75 hover:text-amber-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)] disabled:opacity-40";

const ctxItemActive =
  "amber-gloss-surface overflow-hidden rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 font-semibold text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)]";

const ctxChipOn =
  "amber-gloss-surface overflow-hidden rounded-lg border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]";

const ctxChipOff =
  "presentation-chip-off overflow-hidden rounded-lg border border-transparent text-[var(--text-muted)] hover:border-amber-200/40 hover:bg-gradient-to-br hover:from-amber-200/95 hover:via-yellow-300/85 hover:to-amber-400/75 hover:text-amber-950";

const ctxToggleOn = "bg-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.55)]";
const ctxToggleOff = "ctx-toggle-off bg-amber-200/70";

const ctxLabel = "text-[10px] font-semibold tracking-wide text-[var(--text-muted)]";

const ctxPrimaryBtn =
  "w-full rounded-xl border border-amber-300/80 bg-gradient-to-br from-amber-300/95 via-yellow-200/88 to-amber-400/78 px-2 py-1.5 text-xs font-semibold text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.32)] disabled:opacity-40";

/**
 * Right-click context menu for the 3D canvas.
 */
export default function ViewerContextMenu({
  viewerRef,
  rootRef,
  onLoadIfc,
  loadDisabled,
}: Props) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const compareBothModes = useAppStore((s) => s.compareBothModes);
  const setCompareBothModes = useAppStore((s) => s.setCompareBothModes);
  const floors = useAppStore((s) => s.floors);
  const rooms = useAppStore((s) => s.rooms);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const setSelectedFloor = useAppStore((s) => s.setSelectedFloor);
  const isPresentationView = useAppStore((s) => s.isPresentationView);
  const presentationIsolate = useAppStore((s) => s.presentationIsolate);
  const presentationFloorId = useAppStore((s) => s.presentationFloorId);
  const setPresentationFloorIsolate = useAppStore(
    (s) => s.setPresentationFloorIsolate,
  );
  const setViewerContextMenuOpen = useAppStore(
    (s) => s.setViewerContextMenuOpen,
  );
  const activeModelId = useAppStore((s) => s.activeModelId);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const colorMode = useAppStore((s) => s.colorMode);
  const autoSceneBackground = useAppStore((s) => s.autoSceneBackground);
  const setAutoSceneBackground = useAppStore((s) => s.setAutoSceneBackground);
  const addSavedView = useAppStore((s) => s.addSavedView);

  const [menu, setMenu] = useState<MenuState | null>(null);
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [viewName, setViewName] = useState("");
  const [pageFormat, setPageFormat] = useState<PageFormat>("a4");
  const [toast, setToast] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const floorBtnRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Same floor list as Floors & rooms (prefer floors that have rooms). */
  const floorOptions = useMemo(() => {
    const sorted = [...floors].sort((a, b) => a.elevation - b.elevation);
    const withRooms = sorted.filter((f) =>
      rooms.some((r) => r.floorId === f.id),
    );
    return withRooms.length > 0 ? withRooms : sorted;
  }, [floors, rooms]);

  const activeIsolateFloorId =
    isPresentationView && presentationIsolate
      ? presentationFloorId
      : selectedFloor;

  const defaultSaveViewName = () => {
    if (isPresentationView) {
      const raw =
        activeModelLabel?.trim() || activeModelId?.trim() || "model";
      const base = raw.replace(/\.ifc$/i, "").trim() || "model";
      if (presentationIsolate) return `${base}_isolated view`;
      const modeTag =
        colorMode === "temperature" ? "Temperature" : "heizlast";
      return `${base}_${modeTag}`;
    }
    if (!selectedFloor) return "";
    return floors.find((f) => f.id === selectedFloor)?.name ?? "";
  };

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    onFs();
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onCtx = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !(target instanceof HTMLCanvasElement)) return;
      e.preventDefault();
      setViewerContextMenuOpen(true);
      setSidePanel(null);
      setViewName(defaultSaveViewName());
      setPageFormat("a4");
      setMenu({ x: e.clientX, y: e.clientY });
    };
    root.addEventListener("contextmenu", onCtx);
    return () => root.removeEventListener("contextmenu", onCtx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rootRef,
    floors,
    selectedFloor,
    isPresentationView,
    presentationIsolate,
    activeModelId,
    activeModelLabel,
    colorMode,
  ]);

  useEffect(() => {
    if (!menu) {
      setViewerContextMenuOpen(false);
      return;
    }
    setViewerContextMenuOpen(true);
    const onDoc = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenu(null);
      setSidePanel(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(null);
        setSidePanel(null);
      }
    };
    const id = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDoc, true);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onDoc, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, setViewerContextMenuOpen]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const close = () => {
    setMenu(null);
    setSidePanel(null);
    setViewerContextMenuOpen(false);
  };

  const toggleFullscreen = async () => {
    const el = rootRef.current ?? document.documentElement;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // ignore
    }
    close();
  };

  const commitSaveView = () => {
    const name = viewName.trim();
    if (!name || !viewerRef.current || !activeModelId) return;
    const pose = viewerRef.current.getCameraPose();
    addSavedView(name, pose.position, pose.target, { pageFormat });
    setToast(t(uiLanguage, "viewSavedOk"));
    close();
  };

  const isolateFloor = (floorId: string | null) => {
    if (isPresentationView) {
      setPresentationFloorIsolate(floorId);
    } else {
      setSelectedFloor(floorId);
    }
    close();
  };

  const itemCls = (opts?: { active?: boolean; open?: boolean }) => {
    if (opts?.active || opts?.open) {
      return `${ctxItemIdle} ${ctxItemActive}`;
    }
    return ctxItemIdle;
  };

  const portalRoot =
    (typeof document !== "undefined"
      ? ((document.fullscreenElement as HTMLElement | null) ?? document.body)
      : null) ?? document.body;

  /** Place flyout beside the triggering button, never clipped by glass overflow. */
  const flyoutStyle = (): CSSProperties | undefined => {
    const btn =
      sidePanel === "save"
        ? saveBtnRef.current
        : sidePanel === "floor"
          ? floorBtnRef.current
          : null;
    if (!btn || !menu) return undefined;
    const r = btn.getBoundingClientRect();
    const flyoutW = sidePanel === "save" ? 230 : 220;
    const openRight = r.right + 8 + flyoutW < window.innerWidth;
    return {
      position: "fixed",
      top: Math.min(r.top, window.innerHeight - 280),
      left: openRight ? r.right + 8 : undefined,
      right: openRight ? undefined : window.innerWidth - r.left + 8,
      zIndex: 132,
    };
  };

  const menuNode =
    menu &&
    createPortal(
      <div
        ref={menuRef}
        className="contents"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className="fixed z-[130]"
          style={{
            left: Math.min(menu.x, window.innerWidth - 240),
            top: Math.min(menu.y, window.innerHeight - 300),
          }}
          role="menu"
        >
          <div className={ctxMenuSurface}>
            <div className="min-w-[210px] p-1.5">
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={compareBothModes}
                className={itemCls()}
                onClick={() => {
                  setCompareBothModes(!compareBothModes);
                  close();
                }}
              >
                <span>{t(uiLanguage, "heizlastPlusTemp")}</span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    compareBothModes ? ctxToggleOn : ctxToggleOff
                  }`}
                />
              </button>

              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={autoSceneBackground}
                className={itemCls()}
                onClick={() => {
                  setAutoSceneBackground(!autoSceneBackground);
                  close();
                }}
              >
                <span>{t(uiLanguage, "seasonalBg")}</span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    autoSceneBackground ? ctxToggleOn : ctxToggleOff
                  }`}
                />
              </button>

              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={isFullscreen}
                className={itemCls()}
                onClick={() => void toggleFullscreen()}
              >
                <span>
                  {isFullscreen
                    ? t(uiLanguage, "exitFullscreen")
                    : t(uiLanguage, "fullscreen")}
                </span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isFullscreen ? ctxToggleOn : ctxToggleOff
                  }`}
                />
              </button>

              <button
                ref={saveBtnRef}
                type="button"
                role="menuitem"
                className={itemCls({ open: sidePanel === "save" })}
                disabled={!activeModelId}
                onClick={() =>
                  setSidePanel((p) => (p === "save" ? null : "save"))
                }
                aria-expanded={sidePanel === "save"}
              >
                <span>{t(uiLanguage, "saveView")}</span>
                <MdKeyboardArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              </button>

              <button
                ref={floorBtnRef}
                type="button"
                role="menuitem"
                className={itemCls({ open: sidePanel === "floor" })}
                onClick={() =>
                  setSidePanel((p) => (p === "floor" ? null : "floor"))
                }
                aria-expanded={sidePanel === "floor"}
              >
                <span>{t(uiLanguage, "isolateFloor")}</span>
                <MdKeyboardArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              </button>

              <div className="my-1 border-t border-amber-200/45 dark:border-[var(--panel-divider)]" />

              <button
                type="button"
                role="menuitem"
                className={itemCls()}
                disabled={loadDisabled}
                onClick={() => fileInputRef.current?.click()}
              >
                <span>{t(uiLanguage, "loadNewIfc")}</span>
              </button>
            </div>
          </div>
        </div>

        {sidePanel === "save" && (
          <div style={flyoutStyle()} className="fixed z-[132]">
            <div className={ctxMenuSurface}>
              <div className="w-56 space-y-2 p-2.5">
                <p className={`px-0.5 ${ctxLabel}`}>
                  {t(uiLanguage, "saveView")}
                </p>
                <input
                  autoFocus
                  type="text"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitSaveView();
                    if (e.key === "Escape") close();
                  }}
                  placeholder={t(uiLanguage, "viewName")}
                  className="glass-input w-full rounded-xl px-2.5 py-1.5 text-xs text-[var(--text-body)] outline-none focus:border-amber-300/70"
                />
                <p className={`px-0.5 ${ctxLabel}`}>
                  {t(uiLanguage, "pdfPageSize")}
                </p>
                <div className="grid grid-cols-5 gap-0.5">
                  {(["a4", "a3", "a2", "a1", "a0"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setPageFormat(f)}
                      className={`rounded-lg py-1 text-[10px] font-semibold uppercase transition-all duration-300 ease-out ${
                        pageFormat === f ? ctxChipOn : ctxChipOff
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="pt-1.5">
                  <SliceHeightSlider
                    floors={floors}
                    selectedFloor={selectedFloor}
                    disabled={isPresentationView || selectedFloor == null}
                  />
                </div>
                <button
                  type="button"
                  disabled={!viewName.trim() || !activeModelId}
                  onClick={commitSaveView}
                  className={ctxPrimaryBtn}
                >
                  {t(uiLanguage, "save")}
                </button>
              </div>
            </div>
          </div>
        )}

        {sidePanel === "floor" && (
          <div style={flyoutStyle()} className="fixed z-[132]">
            <div className={ctxMenuSurface}>
              <div className="max-h-64 min-w-[210px] overflow-y-auto p-1.5 thin-scroll">
                <p className={`mb-1 px-2 ${ctxLabel}`}>
                  {t(uiLanguage, "isolateFloor")}
                </p>
                <button
                  type="button"
                  role="menuitem"
                  className={itemCls({ active: activeIsolateFloorId == null })}
                  onClick={() => isolateFloor(null)}
                >
                  {t(uiLanguage, "showAllFloors")}
                </button>
                {floorOptions.length === 0 ? (
                  <p className="px-2.5 py-2 text-[11px] text-[var(--text-muted)]">
                    {t(uiLanguage, "noFloors")}
                  </p>
                ) : (
                  floorOptions.map((f) => {
                    const count = rooms.filter(
                      (r) => r.floorId === f.id,
                    ).length;
                    const active = activeIsolateFloorId === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        role="menuitem"
                        className={itemCls({ active })}
                        onClick={() => isolateFloor(f.id)}
                      >
                        <ModelText className="min-w-0 truncate">
                          {f.name}
                          {count > 0 ? ` (${count})` : ""}
                        </ModelText>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>,
      portalRoot,
    );

  const toastNode =
    toast &&
    createPortal(
      <div className="pointer-events-none fixed bottom-24 left-1/2 z-[140] -translate-x-1/2">
        <div className={ctxMenuSurface}>
          <p className="px-3.5 py-2 text-xs font-semibold text-[var(--text-strong)]">
            {toast}
          </p>
        </div>
      </div>,
      portalRoot,
    );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".ifc,application/x-step,application/octet-stream,.IFC"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          close();
          if (file) onLoadIfc(file);
        }}
      />
      {menuNode}
      {toastNode}
    </>
  );
}
