"use client";

/**
 * ViewerApp — main application composition root, rendered (via
 * ViewerAppClient) as the whole viewer page.
 *
 * Owns IFC model loading (registry entries, file picker, and drag-and-drop),
 * tracking progress/error state and disposing the previous model before
 * swapping in a new `shellGroup`/`rooms`/`floors` into useAppStore. Provides
 * that scene data to children via `ModelSceneContext`.
 *
 * Wires up HeaderActions, the left FloorsPanel / right LegendPanel-or-
 * ToolSidePanel collapsible side panels (desktop) and MobileCornerMenu /
 * PresentationMobileDock (mobile), Viewer3D, ViewerToolbar,
 * ViewerContextMenu, and RoomTooltip (hover + selection popups).
 *
 * Owns the global keyboard shortcuts: Ctrl/Cmd+O/N to open a file, W to
 * toggle Werkzeug (native IFC inspection) mode, B for Bauteil mode, H/L/K to
 * switch dataViewMode (heizlast/luftung/kuhllast), P to toggle presentation
 * view (with fullscreen), and 1-6 to apply a legend swatch preset.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import gsap from "gsap";
import type { Group } from "three";
import type { LoadedModel } from "@/lib/types";
import {
  disposeLoadedModel,
  loadIfcModel,
  type IfcSource,
} from "@/lib/ifcClient";
import { clearFloorSnapshots } from "@/lib/floorSnapshot";
import { debugLog } from "@/lib/debugLog";
import { getModelById } from "@/lib/modelRegistry";
import {
  hydratePanelState,
  persistModelId,
  useAppStore,
  TOOL_RIGHT_PANEL_PEEK_PX,
  clampToolRightPanelWidth,
} from "@/store/useAppStore";
import { ModelSceneContext } from "./ModelSceneContext";
import Viewer3D, { type Viewer3DHandle } from "./Viewer3D";
import RoomTooltip from "./RoomTooltip";
import LoadIfcButton from "../common/LoadIfcButton";
import HeaderActions from "../layout/HeaderActions";
import FloorsPanel from "../floors/FloorsPanel";
import LegendPanel from "../legend/LegendPanel";
import PresentationMobileDock from "../presentation/PresentationMobileDock";
import PresentationSidePanel from "../presentation/PresentationSidePanel";
import MobileCornerMenu from "../layout/MobileCornerMenu";
import ToolSidePanel from "../tool/ToolSidePanel";
import ToolTopBar from "../tool/ToolTopBar";
import ToolLeftPalette from "../tool/ToolLeftPalette";
import ToolModeCursorHud from "../tool/ToolModeCursorHud";
import WerkzeugEntryPanel from "../tool/WerkzeugEntryPanel";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import GlassPanel from "../common/GlassPanel";
import { GlassButton, IconAlert } from "../common/ui";
import ViewerToolbar from "./ViewerToolbar";
import ViewerContextMenu from "./ViewerContextMenu";
import { t } from "@/lib/i18n";
import {
  confirmLeaveWerkzeug,
  hasUnsavedWerkzeugWork,
} from "@/lib/werkzeugUnsaved";
import { redoWerkzeug, undoWerkzeug } from "@/lib/werkzeugHistory";
import { gsapDuration, gsapEase, animateSidebarPanel, animateSidebarContent, killGsap } from "@/lib/gsapMotion";
import { LEGEND_SWATCH_PRESETS } from "@/lib/legendSwatchPresets";
import {
  OPEN_IFC_FILE_EVENT,
  isTypingTarget,
} from "@/lib/viewerHotkeys";
import { cacheIfcBytes, parseFragFile } from "@/lib/markupFragSave";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import {
  idbPutNote,
  idbPutPlacement,
} from "@/lib/toolMarkupDb";
import { normalizeNote, normalizePlacement } from "@/lib/toolMarkup";
import GsapOverlay from "../common/GsapOverlay";
import SceneBusyOverlay from "../common/SceneBusyOverlay";
import SceneBusyCursor from "../common/SceneBusyCursor";
import LiquidGlassSpinner from "../common/LiquidGlassSpinner";
import ThemeTransition from "../common/ThemeTransition";
import ThemeHydration from "../common/ThemeHydration";
import { canHover } from "@/lib/canHover";

type LoadSource =
  | { kind: "registry"; modelId: string }
  | { kind: "file"; id: string; name: string; file: File };

function DragSnapHud() {
  const hint = useToolMarkupStore((s) => s.dragSnapHint);
  const wallDraw = useLayoutDrawingStore((s) => s.wallDraw);
  const wallHint =
    wallDraw?.cursor && wallDraw.lengthMm != null
      ? `${Math.round(wallDraw.lengthMm)} mm${
          wallDraw.angleDeg != null
            ? ` · ${wallDraw.angleDeg}°${wallDraw.angleSnapped ? " ✦" : ""}`
            : ""
        }`
      : null;
  const text = hint?.text ?? wallHint;
  if (!text) return null;
  const follow =
    hint?.clientX != null && hint?.clientY != null
      ? { left: hint.clientX + 14, top: hint.clientY - 28 }
      : null;
  return (
    <div
      className={`pointer-events-none fixed z-[37] tool-glass rounded-lg px-2.5 py-1 text-[11px] font-semibold tabular-nums ${
        wallDraw?.angleSnapped
          ? "text-sky-800"
          : "text-emerald-700"
      } ${follow ? "" : "top-[calc(4.25rem+env(safe-area-inset-top,0px))] left-1/2 -translate-x-1/2"}`}
      style={follow ?? undefined}
    >
      {text}
    </div>
  );
}

function SceneHoverTipHud() {
  const tip = useToolMarkupStore((s) => s.sceneHoverTip);
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none fixed z-[38] max-w-[16rem] -translate-x-1/2 -translate-y-full rounded-md bg-zinc-900/90 px-2 py-1 text-[10px] font-semibold tracking-wide text-white shadow-lg"
      style={{ left: tip.clientX, top: tip.clientY - 12 }}
    >
      {tip.text}
    </div>
  );
}

export default function ViewerApp() {
  const viewerRef = useRef<Viewer3DHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const rightContentRef = useRef<HTMLDivElement>(null);
  const leftAsideRef = useRef<HTMLElement>(null);
  const leftContentRef = useRef<HTMLDivElement>(null);
  const leftChevronRef = useRef<SVGSVGElement>(null);
  const rightAsideRef = useRef<HTMLElement>(null);
  const rightChevronRef = useRef<SVGSVGElement>(null);
  const leftPanelReady = useRef(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef<LoadedModel | null>(null);
  const loadSourceRef = useRef<LoadSource | null>(null);
  const [shellGroup, setShellGroup] = useState<Group | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [pointerOverViewer, setPointerOverViewer] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isDraggingIfc, setIsDraggingIfc] = useState(false);
  const [toolPanelResizing, setToolPanelResizing] = useState(false);
  const dragDepthRef = useRef(0);
  const toolResizeDragRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);

  const rooms = useAppStore((s) => s.rooms);
  const isLoadingModel = useAppStore((s) => s.isLoadingModel);
  const loadError = useAppStore((s) => s.loadError);
  const loadProgress = useAppStore((s) => s.loadProgress);
  const loadMessage = useAppStore((s) => s.loadMessage);
  const leftPanelOpen = useAppStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const selectedRoomId = useAppStore((s) => s.selectedRoomId);
  const isPresentationView = useAppStore((s) => s.isPresentationView);
  const toolMode = useAppStore((s) => s.toolMode);
  const toolRightPanelWidthPx = useAppStore((s) => s.toolRightPanelWidthPx);
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const pdfCaptureActive = useAppStore((s) => s.pdfCaptureActive);

  useEffect(() => {
    const label = activeModelLabel?.trim();
    document.title = label ? `IBV Viewer - ${label}` : "IBV Viewer";
  }, [activeModelLabel]);

  useEffect(() => {
    document.body.classList.toggle("pdf-capturing", pdfCaptureActive);
    return () => document.body.classList.remove("pdf-capturing");
  }, [pdfCaptureActive]);

  const setActiveModelId = useAppStore((s) => s.setActiveModelId);
  const setFloors = useAppStore((s) => s.setFloors);
  const setRooms = useAppStore((s) => s.setRooms);
  const setIsLoadingModel = useAppStore((s) => s.setIsLoadingModel);
  const setLoadError = useAppStore((s) => s.setLoadError);
  const setLoadProgress = useAppStore((s) => s.setLoadProgress);
  const clearModelData = useAppStore((s) => s.clearModelData);
  const setLeftPanelOpen = useAppStore((s) => s.setLeftPanelOpen);
  const setRightPanelOpen = useAppStore((s) => s.setRightPanelOpen);
  const setToolRightPanelWidthPx = useAppStore(
    (s) => s.setToolRightPanelWidthPx,
  );

  useEffect(() => {
    debugLog("ViewerApp", "mount", "info");
    hydratePanelState();
    try {
      localStorage.removeItem("ifc-viewer:lastModelId");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Phones in landscape are often ≥768 wide — keep compact UI when short.
      setIsDesktop(w >= 768 && h >= 560);
      setIsLandscape(w > h);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  // Presentation on mobile: don't leave the corner-menu dimmer open.
  // (store sets rightPanelOpen for desktop legend — that must not open the mobile menu.)
  useLayoutEffect(() => {
    if (isDesktop || !isPresentationView) return;
    setLeftPanelOpen(false);
    setRightPanelOpen(false);
  }, [isPresentationView, isDesktop, setLeftPanelOpen, setRightPanelOpen]);

  useEffect(() => {
    if (!toolMode) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedWerkzeugWork()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [toolMode]);

  useLayoutEffect(() => {
    const bar = progressBarRef.current;
    if (!bar || loadProgress < 0) return;
    gsap.to(bar, {
      width: `${Math.round(loadProgress * 100)}%`,
      duration: gsapDuration.progress,
      ease: gsapEase.ios,
    });
  }, [loadProgress]);

  useLayoutEffect(() => {
    if (!isDesktop || toolMode) return;
    const aside = leftAsideRef.current;
    if (!aside) return;
    const state = isPresentationView
      ? "hidden"
      : leftPanelOpen
        ? "open"
        : "peek";

    if (!leftPanelReady.current) {
      const width = aside.offsetWidth;
      const x =
        state === "open"
          ? 0
          : state === "peek"
            ? -(width - 20)
            : -(width + 24);
      gsap.set(aside, { x, opacity: state === "hidden" ? 0 : 1 });
      leftPanelReady.current = true;
    } else {
      // Fast: must clear out before a hovered header dropdown pops in above it.
      animateSidebarPanel(aside, state, { fast: true });
    }

    if (leftContentRef.current) {
      animateSidebarContent(
        leftContentRef.current,
        leftPanelOpen && !isPresentationView,
      );
    }
    if (leftChevronRef.current) {
      gsap.to(leftChevronRef.current, {
        rotation: leftPanelOpen ? 0 : 180,
        duration: gsapDuration.fast,
        ease: gsapEase.iosOut,
      });
    }
  }, [isDesktop, leftPanelOpen, isPresentationView, toolMode]);

  useLayoutEffect(() => {
    if (!isDesktop || !toolMode) return;
    const aside = rightAsideRef.current;
    if (!aside) return;
    // Drop any GSAP x from legend mode once when entering Werkzeug.
    killGsap(aside);
    gsap.set(aside, { clearProps: "transform,x" });
    aside.style.opacity = "1";
  }, [isDesktop, toolMode]);

  useLayoutEffect(() => {
    if (!isDesktop) return;
    const aside = rightAsideRef.current;
    if (!aside) return;

    // Werkzeug collapse uses React CSS transform — do not touch aside transform here.
    if (toolMode) {
      if (rightContentRef.current) {
        animateSidebarContent(rightContentRef.current, rightPanelOpen);
      }
      if (rightChevronRef.current) {
        gsap.to(rightChevronRef.current, {
          rotation: rightPanelOpen ? 0 : 180,
          duration: gsapDuration.fast,
          ease: gsapEase.iosOut,
        });
      }
      return;
    }

    const state = rightPanelOpen ? "open" : "peek";
    animateSidebarPanel(aside, state, { side: "right" });
    if (rightContentRef.current) {
      animateSidebarContent(rightContentRef.current, rightPanelOpen);
    }
    if (rightChevronRef.current) {
      gsap.to(rightChevronRef.current, {
        rotation: rightPanelOpen ? 0 : 180,
        duration: gsapDuration.fast,
        ease: gsapEase.iosOut,
      });
    }
  }, [isDesktop, rightPanelOpen, toolMode]);

  // Keep docked width inside the viewport when the window shrinks.
  useEffect(() => {
    if (!toolMode || !isDesktop) return;
    const onResize = () => {
      const current = useAppStore.getState().toolRightPanelWidthPx;
      setToolRightPanelWidthPx(
        clampToolRightPanelWidth(current, window.innerWidth),
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [toolMode, isDesktop, setToolRightPanelWidthPx]);

  const onToolPanelResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!toolMode || !rightPanelOpen) return;
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      toolResizeDragRef.current = {
        startX: e.clientX,
        startWidth: toolRightPanelWidthPx,
      };
      setToolPanelResizing(true);
    },
    [toolMode, rightPanelOpen, toolRightPanelWidthPx],
  );

  const onToolPanelResizePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = toolResizeDragRef.current;
      if (!drag) return;
      const dx = drag.startX - e.clientX;
      setToolRightPanelWidthPx(
        clampToolRightPanelWidth(drag.startWidth + dx, window.innerWidth),
      );
    },
    [setToolRightPanelWidthPx],
  );

  const onToolPanelResizePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!toolResizeDragRef.current) return;
      toolResizeDragRef.current = null;
      setToolPanelResizing(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    },
    [],
  );

  const runLoad = useCallback(
    async (source: LoadSource) => {
      loadSourceRef.current = source;
      debugLog(
        "ViewerApp",
        `runLoad — ${source.kind}`,
        "info",
        source.kind === "registry"
          ? { modelId: source.modelId }
          : { name: source.name, size: source.file.size },
      );

      const prevId = useAppStore.getState().activeModelId;
      if (prevId) clearFloorSnapshots(prevId);

      setIsLoadingModel(true);
      setLoadError(null);
      setLoadProgress(0, t(useAppStore.getState().uiLanguage, "starting"));
      clearModelData();
      setShellGroup(null);

      if (loadedRef.current) {
        disposeLoadedModel(loadedRef.current);
        loadedRef.current = null;
      }

      const label =
        source.kind === "registry"
          ? (getModelById(source.modelId)?.label ?? source.modelId)
          : source.name;
      const id = source.kind === "registry" ? source.modelId : source.id;
      setActiveModelId(
        id,
        label,
        source.kind === "file" ? source.file.size : null,
      );

      try {
        let ifcSource: IfcSource;
        if (source.kind === "registry") {
          const entry = getModelById(source.modelId);
          if (!entry) throw new Error(`Unknown model: ${source.modelId}`);
          ifcSource = entry.ifcPath;
          try {
            const res = await fetch(entry.ifcPath);
            if (res.ok) {
              const ab = await res.arrayBuffer();
              cacheIfcBytes(id, label, ab);
            }
          } catch {
            /* optional cache for .ifc merge export */
          }
        } else {
          ifcSource = source.file;
          const ab = await source.file.arrayBuffer();
          cacheIfcBytes(id, source.name, ab);
          ifcSource = ab;
        }

        const result = await loadIfcModel(ifcSource, (p) => {
          setLoadProgress(p.progress < 0 ? -1 : p.progress, p.message);
        });
        loadedRef.current = result;
        setFloors(result.floors);
        setRooms(result.rooms);
        // Auto-fit load + temperature legends to this IFC (dense where rooms
        // sit; reserve end color for ≤~10% outliers) and map Thermal Classic.
        useAppStore.getState().fitLegendToRooms(result.rooms);
        setShellGroup(result.shellGroup);
        if (source.kind === "registry") persistModelId(id);
        // Every load starts in Bauteil — the raw model before any data view.
        useAppStore.getState().setToolMode(false);
        useAppStore.getState().setBauteilMode(true);
        debugLog(
          "ViewerApp",
          `load success — rooms=${result.rooms.length} floors=${result.floors.length}`,
          "ok",
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t(useAppStore.getState().uiLanguage, "failedLoad");
        debugLog("ViewerApp", `load failed: ${message}`, "error", err);
        setLoadError(message);
        clearModelData();
        setShellGroup(null);
      } finally {
        setIsLoadingModel(false);
      }
    },
    [
      clearModelData,
      setActiveModelId,
      setFloors,
      setIsLoadingModel,
      setLoadError,
      setLoadProgress,
      setRooms,
    ],
  );


  const handleFile = useCallback(
    (file: File) => {
      debugLog(
        "ViewerApp",
        `file picked: ${file.name}`,
        "info",
        { size: file.size, type: file.type },
      );
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".frag")) {
        void (async () => {
          try {
            const { meta, ifcBytes } = await parseFragFile(file);
            const id = meta.modelKey || `frag-${Date.now()}`;
            if (ifcBytes && ifcBytes.byteLength > 0) {
              cacheIfcBytes(id, meta.modelLabel ?? file.name, ifcBytes);
              await runLoad({
                kind: "file",
                id,
                name: meta.modelLabel ?? file.name.replace(/\.frag$/i, ".ifc"),
                file: new File(
                  [Uint8Array.from(ifcBytes)],
                  meta.modelLabel ?? "model.ifc",
                ),
              });
            }
            for (const p of meta.placements) {
              await idbPutPlacement(normalizePlacement(p));
            }
            for (const n of meta.notes) {
              await idbPutNote(normalizeNote(n));
            }
            if (meta.layout) {
              const {
                idbPutLevel,
                idbPutWall,
                idbPutDoor,
                idbPutWindow,
                idbPutSlab,
                idbPutUnderlay,
              } = await import("@/lib/layoutDrawingDb");
              for (const l of meta.layout.levels) await idbPutLevel(l);
              for (const w of meta.layout.walls) await idbPutWall(w);
              for (const d of meta.layout.doors) await idbPutDoor(d);
              for (const w of meta.layout.windows) await idbPutWindow(w);
              for (const s of meta.layout.slabs ?? []) await idbPutSlab(s);
              for (const u of meta.layout.underlays ?? [])
                await idbPutUnderlay(u);
            }
            if (!ifcBytes || ifcBytes.byteLength === 0) {
              useAppStore
                .getState()
                .setActiveModelId(id, meta.modelLabel ?? file.name, null);
              if (meta.layout?.levels?.length) {
                useAppStore.getState().setFloors(
                  meta.layout.levels.map((l) => ({
                    id: l.id,
                    name: l.name,
                    elevation: l.elevationMm / 1000,
                    expressId: -1,
                    typicalHeight: l.heightMm / 1000,
                    isBuildingStory: true,
                  })),
                );
              }
            }
            await useToolMarkupStore.getState().loadForModel(id);
            await useLayoutDrawingStore
              .getState()
              .loadForProject(id, id.startsWith("empty:"));
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Failed to open .frag";
            setLoadError(message);
          }
        })();
        return;
      }
      const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      void runLoad({ kind: "file", id, name: file.name, file });
    },
    [runLoad, setLoadError],
  );

  const isIfcFile = useCallback((file: File) => {
    const name = file.name.toLowerCase();
    return (
      name.endsWith(".ifc") ||
      name.endsWith(".frag") ||
      file.type === "application/x-step" ||
      file.type === "application/octet-stream"
    );
  }, []);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (![...e.dataTransfer.types].includes("Files")) return;
    dragDepthRef.current += 1;
    setIsDraggingIfc(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingIfc(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setIsDraggingIfc(false);
      if (isLoadingModel) return;
      const files = e.dataTransfer?.files;
      if (!files?.length) return;
      const file =
        [...files].find((f) => isIfcFile(f)) ??
        [...files].find((f) => f.name.toLowerCase().endsWith(".ifc"));
      if (!file) {
        debugLog("ViewerApp", "drop ignored — not an IFC file", "warn");
        return;
      }
      handleFile(file);
    },
    [handleFile, isIfcFile, isLoadingModel],
  );

  const handleRetry = useCallback(() => {
    const src = loadSourceRef.current;
    debugLog("ViewerApp", "retry", "info", src?.kind);
    if (src) void runLoad(src);
  }, [runLoad]);

  useEffect(() => {
    return () => {
      if (loadedRef.current) {
        disposeLoadedModel(loadedRef.current);
        loadedRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const store = useAppStore.getState();

      if ((e.ctrlKey || e.metaKey) && (e.key === "o" || e.key === "O" || e.key === "n" || e.key === "N")) {
        e.preventDefault();
        window.dispatchEvent(new Event(OPEN_IFC_FILE_EVENT));
        return;
      }

      // Werkzeug undo / redo
      if (
        store.toolMode &&
        (e.ctrlKey || e.metaKey) &&
        !e.altKey
      ) {
        const k = e.key.toLowerCase();
        if (k === "z" && !e.shiftKey) {
          e.preventDefault();
          void undoWerkzeug();
          return;
        }
        if (k === "y" || (k === "z" && e.shiftKey)) {
          e.preventDefault();
          void redoWerkzeug();
          return;
        }
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      // W — Werkzeug (native IFC inspection). Same key toggles back out.
      if (key === "w") {
        e.preventDefault();
        const next = !store.toolMode;
        if (!next) {
          const msg = t(store.uiLanguage, "werkzeugSaveWork");
          if (!confirmLeaveWerkzeug(msg)) return;
        }
        if (next) store.setBauteilMode(false);
        store.setToolMode(next);
        if (next) store.setLeftPanelOpen(true);
        return;
      }
      if (key === "b") {
        e.preventDefault();
        if (store.toolMode) {
          const msg = t(store.uiLanguage, "werkzeugSaveWork");
          if (!confirmLeaveWerkzeug(msg)) return;
        }
        store.setToolMode(false);
        store.setBauteilMode(!store.bauteilMode);
        return;
      }
      if (key === "h") {
        e.preventDefault();
        if (store.toolMode) {
          const msg = t(store.uiLanguage, "werkzeugSaveWork");
          if (!confirmLeaveWerkzeug(msg)) return;
        }
        store.setToolMode(false);
        store.setBauteilMode(false);
        store.setDataViewMode("heizlast");
        return;
      }
      if (key === "l") {
        e.preventDefault();
        if (store.toolMode) {
          const msg = t(store.uiLanguage, "werkzeugSaveWork");
          if (!confirmLeaveWerkzeug(msg)) return;
        }
        store.setToolMode(false);
        store.setBauteilMode(false);
        store.setDataViewMode("luftung");
        return;
      }
      if (key === "k") {
        e.preventDefault();
        if (store.toolMode) {
          const msg = t(store.uiLanguage, "werkzeugSaveWork");
          if (!confirmLeaveWerkzeug(msg)) return;
        }
        store.setToolMode(false);
        store.setBauteilMode(false);
        store.setDataViewMode("kuhllast");
        return;
      }
      if (key === "p") {
        if (store.toolMode) return;
        e.preventDefault();
        const next = !store.isPresentationView;
        store.setPresentationView(next);
        const el = document.documentElement;
        void (async () => {
          try {
            if (next) {
              if (!document.fullscreenElement) await el.requestFullscreen();
            } else if (document.fullscreenElement) {
              await document.exitFullscreen();
            }
          } catch {
            // presentation still toggles without fullscreen
          }
        })();
        return;
      }

      if (/^[1-6]$/.test(key)) {
        const preset = LEGEND_SWATCH_PRESETS[Number(key) - 1];
        if (!preset) return;
        e.preventDefault();
        const mode =
          store.colorMode === "temperature"
            ? "temperature"
            : store.dataViewMode === "kuhllast"
              ? "kuhllast"
              : store.dataViewMode === "luftung"
                ? "luftung"
                : "heizlast";
        store.applyLegendSwatchPreset(mode, preset.id);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const sceneValue = useMemo(
    () => ({ shellGroup, rooms }),
    [shellGroup, rooms],
  );

  const handlePointerMove = useCallback((x: number, y: number) => {
    setPointer({ x, y });
    setPointerOverViewer(true);
  }, []);

  const handlePointerLeaveViewer = useCallback(() => {
    setPointerOverViewer(false);
  }, []);

  const activeModelId = useAppStore((s) => s.activeModelId);
  const hasModel =
    rooms.length > 0 || Boolean(shellGroup) || Boolean(activeModelId);
  const showEmptyCta =
    !hasModel && !isLoadingModel && !loadError && !toolMode;
  const showWerkzeugEntry =
    toolMode && !hasModel && !isLoadingModel && !loadError;
  const showError = Boolean(loadError) && !isLoadingModel;

  const progressLabel =
    loadProgress < 0
      ? loadMessage || t(uiLanguage, "working")
      : `${loadMessage || t(uiLanguage, "loading")} (${Math.round(Math.max(0, loadProgress) * 100)}%)`;

  const toolViewerRightInset =
    isDesktop && toolMode ? TOOL_RIGHT_PANEL_PEEK_PX : 0;

  return (
    <ModelSceneContext.Provider value={sceneValue}>
      <ThemeHydration />
      <ThemeTransition />
      <div
        ref={rootRef}
        className="relative h-dvh w-dvw overflow-hidden text-zinc-900"
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <HeaderActions
          onFile={handleFile}
          hasModel={hasModel}
          isLoadingModel={isLoadingModel}
        />

        <div
          className="fixed top-0 bottom-0 left-0 z-0"
          style={{
            right: toolViewerRightInset,
            transition: toolPanelResizing
              ? "none"
              : "right 220ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <Viewer3D
            ref={viewerRef}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeaveViewer}
            className="h-full w-full"
          />
        </div>

        <SceneBusyOverlay />
        <SceneBusyCursor
          x={pointer.x}
          y={pointer.y}
          active={pointerOverViewer}
        />

        <GsapOverlay
          show={isDraggingIfc && !isLoadingModel}
          className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/35 p-4 backdrop-blur-[2px] sm:p-6"
        >
          <GlassPanel
            variant="panel"
            zIndex={100}
            wrapperClassName="w-full max-w-[min(28rem,calc(100vw-2rem))]"
          >
            <div className="px-6 py-8 text-center">
              <p className="text-base font-semibold tracking-wide text-zinc-900">
                {t(uiLanguage, "dropIfc")}
              </p>
              <p className="mt-1.5 text-xs text-zinc-500">
                {t(uiLanguage, "dropIfcHint")}
              </p>
            </div>
          </GlassPanel>
        </GsapOverlay>

        <GsapOverlay
          show={isLoadingModel}
          className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6"
        >
          <GlassPanel
            variant="panel"
            zIndex={30}
            wrapperClassName="pointer-events-auto w-full max-w-[min(24rem,calc(100vw-2rem))]"
          >
            <div className="p-6">
              <div className="mb-3 flex items-center gap-3">
                <LiquidGlassSpinner
                  size="md"
                  srLabel={t(uiLanguage, "loadingModel")}
                />
                <p className="text-sm font-semibold tracking-wide text-zinc-800">
                  {t(uiLanguage, "loadingModel")}
                </p>
              </div>
              <p className="mb-3 text-xs font-medium text-zinc-500">
                {progressLabel}
              </p>
              {loadProgress >= 0 && (
                <div className="h-2 overflow-hidden rounded-full border border-amber-200/40 bg-amber-50/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]">
                  <div
                    ref={progressBarRef}
                    className="relative h-full overflow-hidden rounded-full border border-amber-200/60 bg-gradient-to-br from-amber-200/95 via-yellow-300/90 to-amber-400/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_8px_rgba(251,191,36,0.35)]"
                    style={{
                      width: `${Math.round(loadProgress * 100)}%`,
                    }}
                  >
                    <span
                      className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/55 to-transparent"
                      aria-hidden
                    />
                  </div>
                </div>
              )}
            </div>
          </GlassPanel>
        </GsapOverlay>

        <GsapOverlay
          show={showWerkzeugEntry}
          className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6"
        >
          <WerkzeugEntryPanel onFile={handleFile} />
        </GsapOverlay>

        <GsapOverlay
          show={showEmptyCta}
          className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6"
        >
          <GlassPanel
            variant="panel"
            zIndex={30}
            wrapperClassName="pointer-events-auto w-full max-w-[min(24rem,calc(100vw-2rem))]"
          >
            <div className="p-6 text-center">
              <p className="mb-1 text-sm font-semibold tracking-wide text-zinc-900">
                {t(uiLanguage, "noModel")}
              </p>
              <p className="mb-4 text-xs font-medium leading-relaxed text-zinc-500">
                {t(uiLanguage, "chooseIfc")}
              </p>
              <div className="flex justify-center">
                <LoadIfcButton onFile={handleFile} label={t(uiLanguage, "loadIfc")} />
              </div>
            </div>
          </GlassPanel>
        </GsapOverlay>

        <GsapOverlay
          show={showError}
          className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6"
        >
          <GlassPanel
            variant="panel"
            zIndex={30}
            wrapperClassName="pointer-events-auto w-full max-w-[min(28rem,calc(100vw-2rem))]"
          >
            <div className="p-6 text-center">
              <div className="mb-3 flex justify-center">
                <IconAlert />
              </div>
              <p className="mb-1 text-sm font-semibold tracking-wide text-zinc-900">
                {t(uiLanguage, "couldNotLoad")}
              </p>
              <p className="mb-4 text-xs font-medium leading-relaxed break-words text-zinc-500">
                {loadError}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <GlassButton variant="primary" onClick={handleRetry}>
                  {t(uiLanguage, "retry")}
                </GlassButton>
                <LoadIfcButton
                  onFile={handleFile}
                  variant="default"
                  label={t(uiLanguage, "loadOtherIfc")}
                />
              </div>
            </div>
          </GlassPanel>
        </GsapOverlay>

        {/* Hover popup — desktop pointer only; mobile uses selection popup */}
        {/* Hover popup — desktop pointer only; mobile uses selection popup.
            Werkzeug shows IFC properties in the inspector instead. */}
        {!toolMode && canHover() && !selectedRoomId && (
          <RoomTooltip x={pointer.x} y={pointer.y} />
        )}
        {!toolMode && selectedRoomId && (() => {
          const room = rooms.find((r) => r.id === selectedRoomId);
          if (!room) return null;
          return (
            <RoomTooltip
              room={room}
              anchor={{
                left: leftPanelOpen && !isPresentationView ? 380 : 24,
                top: 120,
              }}
            />
          );
        })()}
        <ViewerToolbar viewerRef={viewerRef} targetRef={rootRef} />
        {toolMode && <ToolTopBar />}
        {toolMode && <DragSnapHud />}
        {toolMode && <SceneHoverTipHud />}
        {toolMode && pointerOverViewer && (
          <ToolModeCursorHud x={pointer.x} y={pointer.y} />
        )}
        <ViewerContextMenu
          viewerRef={viewerRef}
          rootRef={rootRef}
          onLoadIfc={handleFile}
          loadDisabled={isLoadingModel}
        />

        {/* LEFT — Floors (analysis) or Werkzeug floating tool strip */}
        {isDesktop && toolMode && <ToolLeftPalette />}
        {isDesktop && !toolMode && (
          <aside
            ref={leftAsideRef}
            className={`fixed top-auto bottom-16 z-[35] flex h-[calc(100dvh-9.25rem)] max-h-[calc(100dvh-9.25rem)] w-[min(300px,calc(100vw-1.5rem))] flex-col sm:bottom-[4.5rem] sm:h-[calc(100dvh-9.5rem)] sm:max-h-[calc(100dvh-9.5rem)] md:left-4 md:w-[min(340px,calc(100vw-2rem))] lg:w-[min(360px,calc(100vw-2rem))] left-2 ${
              isPresentationView ? "pointer-events-none" : ""
            }`}
            aria-hidden={isPresentationView}
          >
            <GlassPanel
              variant="panel"
              zIndex={35}
              fill
              wrapperClassName="relative flex h-full min-h-0 flex-col overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                aria-label={
                  leftPanelOpen
                    ? t(uiLanguage, "hideFloors")
                    : t(uiLanguage, "showFloors")
                }
                className="absolute inset-y-0 right-0 z-10 flex w-5 items-center justify-center rounded-r-3xl bg-zinc-400/30 text-zinc-600 transition-colors duration-300 ease-out hover:bg-zinc-400/45"
              >
                <svg
                  ref={leftChevronRef}
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m15 6-6 6 6 6" />
                </svg>
              </button>
              <div
                ref={leftContentRef}
                className={`flex min-h-0 flex-1 flex-col overflow-hidden pr-5 ${
                  leftPanelOpen ? "" : "pointer-events-none"
                }`}
              >
                <FloorsPanel
                  viewerRef={viewerRef}
                  onFile={handleFile}
                  isLoadingModel={isLoadingModel}
                />
              </div>
            </GlassPanel>
          </aside>
        )}

        {/* RIGHT — Legend: bottom-aligned in basic view; top-right in presentation.
            Werkzeug: full-height docked panel; 3D viewport insets so nothing renders behind it. */}
        {isDesktop && (
          <aside
            ref={rightAsideRef}
            className={`fixed z-[35] flex flex-col pointer-events-auto ${
              toolMode
                ? "inset-y-0 right-0 h-dvh max-h-dvh overflow-hidden rounded-none"
                : `w-[min(18rem,calc(100vw-1.5rem))] md:w-[min(22rem,calc(100vw-2rem))] lg:w-[min(24rem,calc(100vw-2rem))] transition-[top,bottom,max-height] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] right-2 md:right-4 ${
                    isPresentationView
                      ? "top-32 bottom-auto max-h-[calc(100dvh-10.5rem)] md:top-36 lg:top-40"
                      : "top-auto bottom-16 max-h-[calc(100dvh-10.5rem)] sm:bottom-[4.5rem]"
                  }`
            }`}
            style={
              toolMode
                ? {
                    width: rightPanelOpen
                      ? toolRightPanelWidthPx
                      : TOOL_RIGHT_PANEL_PEEK_PX,
                    transition: toolPanelResizing
                      ? "none"
                      : "width 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                  }
                : undefined
            }
          >
            <GlassPanel
              variant="panel"
              zIndex={35}
              fill={toolMode}
              preferCss={toolMode}
              allowOverflow={!toolMode}
              wrapperStyle={
                toolMode
                  ? {
                      borderRadius: 0,
                      background: "var(--surface-muted)",
                    }
                  : undefined
              }
              wrapperClassName={
                toolMode
                  ? "relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden !rounded-none"
                  : "relative mb-2 max-h-[inherit] w-full min-w-0"
              }
              className={toolMode ? "tool-dock-panel !rounded-none" : ""}
            >
              {toolMode && rightPanelOpen && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={t(uiLanguage, "resizePanel")}
                  title={t(uiLanguage, "resizePanel")}
                  onPointerDown={onToolPanelResizePointerDown}
                  onPointerMove={onToolPanelResizePointerMove}
                  onPointerUp={onToolPanelResizePointerUp}
                  onPointerCancel={onToolPanelResizePointerUp}
                  className="absolute inset-y-0 left-0 z-20 w-1 -translate-x-full cursor-col-resize touch-none hover:bg-amber-400/35 active:bg-amber-400/50"
                />
              )}
              <button
                type="button"
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                aria-label={
                  toolMode
                    ? rightPanelOpen
                      ? t(uiLanguage, "hideIfcStructure")
                      : t(uiLanguage, "showIfcStructure")
                    : rightPanelOpen
                      ? t(uiLanguage, "hideLegend")
                      : t(uiLanguage, "showLegend")
                }
                className={`absolute inset-y-0 left-0 z-30 flex items-center justify-center bg-zinc-400/30 text-zinc-600 transition-colors duration-300 ease-out hover:bg-zinc-400/45 ${
                  toolMode
                    ? rightPanelOpen
                      ? "w-5 rounded-none"
                      : "w-full rounded-none"
                    : "w-5 rounded-l-3xl"
                }`}
              >
                <svg
                  ref={rightChevronRef}
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
              <div
                ref={rightContentRef}
                className={`w-full min-w-0 pl-5 pr-1 ${
                  toolMode
                    ? "flex min-h-0 flex-1 flex-col overflow-hidden pt-[calc(3.75rem+env(safe-area-inset-top,0px))]"
                    : "thin-scroll max-h-[calc(100dvh-10.5rem)] overflow-y-auto overscroll-contain"
                } ${rightPanelOpen ? "" : "pointer-events-none"}`}
              >
                {toolMode ? (
                  <ToolSidePanel
                    className="h-full flex-1"
                    onFile={handleFile}
                    isLoadingModel={isLoadingModel}
                  />
                ) : isPresentationView ? (
                  <PresentationSidePanel />
                ) : (
                  <LegendPanel />
                )}
              </div>
            </GlassPanel>
          </aside>
        )}

        {/* Mobile — more menu (hidden in presentation) + presentation legend dock */}
        {!isDesktop && (
          <>
            {!isPresentationView && (
              <MobileCornerMenu
                open={leftPanelOpen}
                onOpenChange={(open) => {
                  setLeftPanelOpen(open);
                  if (!open) setRightPanelOpen(false);
                }}
                title={toolMode ? t(uiLanguage, "tool") : t(uiLanguage, "model")}
                subtitle={activeModelLabel}
                onLoadIfc={handleFile}
                isLoadingModel={isLoadingModel}
                landscapeMobile={isLandscape}
              >
                {({ detailsOpen }) =>
                  toolMode ? (
                    <ToolSidePanel
                      className="h-[70dvh]"
                      onFile={handleFile}
                      isLoadingModel={isLoadingModel}
                    />
                  ) : (
                    <>
                      <FloorsPanel
                        viewerRef={viewerRef}
                        onFile={handleFile}
                        isLoadingModel={isLoadingModel}
                        mobileSheet
                        mobileDetailsOpen={detailsOpen}
                      />
                      <div className="mx-3 border-t border-zinc-300/50" />
                      <LegendPanel />
                    </>
                  )
                }
              </MobileCornerMenu>
            )}

            {isPresentationView && (
              <PresentationMobileDock
                align={isLandscape ? "right" : "center"}
                landscapeMobile={isLandscape}
              />
            )}
          </>
        )}
      </div>
    </ModelSceneContext.Provider>
  );
}

export { useModelScene } from "./ModelSceneContext";
