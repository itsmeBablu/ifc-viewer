"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { MdKeyboardArrowRight } from "react-icons/md";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import type { PageFormat } from "@/lib/presentationLayout";
import {
  capturePresentationAssets,
  pdfLegendFromStore,
} from "@/lib/pdfCapture";
import { exportPresentationPdf } from "@/lib/pdfExport";
import GlassPanel from "./GlassPanel";
import SliceHeightSlider from "./SliceHeightSlider";
import type { Viewer3DHandle } from "./Viewer3D";

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
  const activeModelId = useAppStore((s) => s.activeModelId);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const colorMode = useAppStore((s) => s.colorMode);
  const addSavedView = useAppStore((s) => s.addSavedView);

  const [menu, setMenu] = useState<MenuState | null>(null);
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [viewName, setViewName] = useState("");
  const [pageFormat, setPageFormat] = useState<PageFormat>("a4");
  const [toast, setToast] = useState<string | null>(null);
  const [pdfExporting, setPdfExporting] = useState(false);
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
    if (!menu) return;
    const onDoc = (e: MouseEvent) => {
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
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const close = () => {
    setMenu(null);
    setSidePanel(null);
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

  const downloadPresentationPdfNow = async () => {
    if (pdfExporting || !viewerRef.current || rooms.length === 0) return;
    setPdfExporting(true);
    close();
    try {
      const presentation = await capturePresentationAssets(viewerRef.current, {
        scale: 3,
      });
      const modelName =
        activeModelLabel?.replace(/\.ifc$/i, "").trim() ||
        activeModelId ||
        "IFC Model";
      exportPresentationPdf({
        modelName,
        presentation,
        legend: pdfLegendFromStore(),
        pageFormat,
      });
    } finally {
      setPdfExporting(false);
    }
  };

  const isolateFloor = (floorId: string | null) => {
    setSelectedFloor(floorId);
    close();
  };

  const itemCls =
    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-zinc-800 hover:bg-white/70 disabled:opacity-40";

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
      <div ref={menuRef} className="contents">
        <div
          className="fixed z-[130]"
          style={{
            left: Math.min(menu.x, window.innerWidth - 240),
            top: Math.min(menu.y, window.innerHeight - 300),
          }}
          role="menu"
        >
          <GlassPanel variant="control" zIndex={130}>
            <div className="min-w-[210px] p-1.5">
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={compareBothModes}
                className={itemCls}
                onClick={() => {
                  setCompareBothModes(!compareBothModes);
                  close();
                }}
              >
                <span>{t(uiLanguage, "heizlastPlusTemp")}</span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    compareBothModes ? "bg-sky-600" : "bg-zinc-300"
                  }`}
                />
              </button>

              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={isFullscreen}
                className={itemCls}
                onClick={() => void toggleFullscreen()}
              >
                <span>
                  {isFullscreen
                    ? t(uiLanguage, "exitFullscreen")
                    : t(uiLanguage, "fullscreen")}
                </span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isFullscreen ? "bg-sky-600" : "bg-zinc-300"
                  }`}
                />
              </button>

              <button
                ref={saveBtnRef}
                type="button"
                role="menuitem"
                className={itemCls}
                disabled={!activeModelId || pdfExporting || (isPresentationView && rooms.length === 0)}
                onClick={() => {
                  if (isPresentationView) {
                    void downloadPresentationPdfNow();
                    return;
                  }
                  setSidePanel((p) => (p === "save" ? null : "save"));
                }}
                aria-expanded={sidePanel === "save"}
              >
                <span>
                  {isPresentationView
                    ? t(uiLanguage, "downloadPresentation")
                    : t(uiLanguage, "saveView")}
                </span>
                {!isPresentationView && (
                  <MdKeyboardArrowRight className="h-4 w-4 shrink-0 text-zinc-500" />
                )}
              </button>

              <button
                ref={floorBtnRef}
                type="button"
                role="menuitem"
                className={itemCls}
                onClick={() =>
                  setSidePanel((p) => (p === "floor" ? null : "floor"))
                }
                aria-expanded={sidePanel === "floor"}
              >
                <span>{t(uiLanguage, "isolateFloor")}</span>
                <MdKeyboardArrowRight className="h-4 w-4 shrink-0 text-zinc-500" />
              </button>

              <div className="my-1 border-t border-zinc-300/50" />

              <button
                type="button"
                role="menuitem"
                className={itemCls}
                disabled={loadDisabled}
                onClick={() => fileInputRef.current?.click()}
              >
                <span>{t(uiLanguage, "loadNewIfc")}</span>
              </button>
            </div>
          </GlassPanel>
        </div>

        {sidePanel === "save" && (
          <div style={flyoutStyle()} className="fixed z-[132]">
            <GlassPanel variant="control" zIndex={132}>
              <div className="w-56 space-y-2 p-2.5">
                <p className="px-0.5 text-[10px] font-semibold tracking-wide text-zinc-500">
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
                  className="w-full rounded-xl border border-zinc-300/60 bg-white/70 px-2.5 py-1.5 text-xs outline-none focus:border-zinc-400"
                />
                <p className="px-0.5 text-[10px] font-medium text-zinc-500">
                  {t(uiLanguage, "pdfPageSize")}
                </p>
                <div className="grid grid-cols-5 gap-0.5">
                  {(["a4", "a3", "a2", "a1", "a0"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setPageFormat(f)}
                      className={`rounded-lg py-1 text-[10px] font-semibold uppercase ${
                        pageFormat === f
                          ? "bg-zinc-800 text-white"
                          : "bg-white/60 text-zinc-600 hover:bg-white/90"
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
                  className="w-full rounded-xl bg-zinc-800 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  {t(uiLanguage, "save")}
                </button>
              </div>
            </GlassPanel>
          </div>
        )}

        {sidePanel === "floor" && (
          <div style={flyoutStyle()} className="fixed z-[132]">
            <GlassPanel variant="control" zIndex={132}>
              <div className="max-h-64 min-w-[210px] overflow-y-auto p-1.5">
                <p className="mb-1 px-2 text-[10px] font-semibold tracking-wide text-zinc-500">
                  {t(uiLanguage, "isolateFloor")}
                </p>
                <button
                  type="button"
                  role="menuitem"
                  className={`${itemCls} ${
                    selectedFloor == null ? "bg-white/60 font-semibold" : ""
                  }`}
                  onClick={() => isolateFloor(null)}
                >
                  {t(uiLanguage, "showAllFloors")}
                </button>
                {floorOptions.length === 0 ? (
                  <p className="px-2.5 py-2 text-[11px] text-zinc-400">
                    {t(uiLanguage, "noFloors")}
                  </p>
                ) : (
                  floorOptions.map((f) => {
                    const count = rooms.filter(
                      (r) => r.floorId === f.id,
                    ).length;
                    const active = selectedFloor === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        role="menuitem"
                        className={`${itemCls} ${
                          active ? "bg-white/60 font-semibold" : ""
                        }`}
                        onClick={() => isolateFloor(f.id)}
                      >
                        <span className="min-w-0 truncate">
                          {f.name}
                          {count > 0 ? ` (${count})` : ""}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </GlassPanel>
          </div>
        )}
      </div>,
      portalRoot,
    );

  const toastNode =
    toast &&
    createPortal(
      <div className="pointer-events-none fixed bottom-24 left-1/2 z-[140] -translate-x-1/2">
        <GlassPanel variant="control" zIndex={140}>
          <p className="px-3.5 py-2 text-xs font-semibold text-zinc-800">
            {toast}
          </p>
        </GlassPanel>
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
