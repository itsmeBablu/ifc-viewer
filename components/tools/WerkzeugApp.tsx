"use client";

/**
 * WerkzeugApp — standalone Autodesk Revit-style BIM CAD Studio interface at /werkzeug.
 * Isolated from the heating / ventilation / cooling viewer on "/".
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
} from "@/store/useAppStore";
import { WerkzeugModelSceneContext } from "./WerkzeugModelSceneContext";
import WerkzeugViewer3D, {
  type WerkzeugViewer3DHandle,
} from "./WerkzeugViewer3D";
import VStudioErrorBoundary from "./VStudioErrorBoundary";
import LoadIfcButton from "@/components/common/LoadIfcButton";
import GlassPanel from "@/components/common/GlassPanel";
import { GlassButton, IconAlert } from "@/components/common/ui";
import WerkzeugWorkspaceChrome from "./WerkzeugWorkspaceChrome";
import DesktopIsland from "./DesktopIsland";
import ToolRibbon from "./ToolRibbon";
import ToolOptionsBar from "./ToolOptionsBar";
import ToolRightPanel from "./ToolRightPanel";
import ToolStatusBar from "./ToolStatusBar";
import RoomScheduleDialog from "./RoomScheduleDialog";
import SheetViewDialog from "./SheetViewDialog";
import WerkzeugContextMenu from "./WerkzeugContextMenu";
import ToolModeCursorHud from "./ToolModeCursorHud";
import WerkzeugEntryPanel from "./WerkzeugEntryPanel";
import MobileCornerMenu from "@/components/layout/MobileCornerMenu";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { t } from "@/lib/i18n";
import { hasUnsavedWerkzeugWork } from "@/lib/werkzeugUnsaved";
import { redoWerkzeug, undoWerkzeug } from "@/lib/werkzeugHistory";
import { gsapDuration, gsapEase } from "@/lib/gsapMotion";
import { isTypingTarget } from "@/lib/viewerHotkeys";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { formatLength } from "@/lib/unitFormat";
import GsapOverlay from "@/components/common/GsapOverlay";
import SceneBusyOverlay from "@/components/common/SceneBusyOverlay";
import SceneBusyCursor from "@/components/common/SceneBusyCursor";
import LiquidGlassSpinner from "@/components/common/LiquidGlassSpinner";
import ThemeTransition from "@/components/common/ThemeTransition";
import ThemeHydration from "@/components/common/ThemeHydration";
import { MATERIAL_DRAG_MIME } from "@/store/materialStore";

type LoadSource =
  | { kind: "registry"; modelId: string }
  | { kind: "file"; id: string; name: string; file: File };

function DragSnapHud() {
  const hint = useToolMarkupStore((s) => s.dragSnapHint);
  const wallDraw = useLayoutDrawingStore((s) => s.wallDraw);
  const unitSystem = useLayoutDrawingStore((s) => s.unitSystem);
  const wallHint =
    wallDraw?.cursor && wallDraw.lengthMm != null
      ? `${formatLength(wallDraw.lengthMm, unitSystem)}${
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
        wallDraw?.angleSnapped ? "text-sky-800" : "text-emerald-700"
      } ${follow ? "" : "top-[128px] left-1/2 -translate-x-1/2"}`}
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

export default function WerkzeugApp() {
  const viewerRef = useRef<WerkzeugViewer3DHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef<LoadedModel | null>(null);
  const loadSourceRef = useRef<LoadSource | null>(null);
  const [shellGroup, setShellGroup] = useState<Group | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [pointerOverViewer, setPointerOverViewer] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" && window.innerWidth >= 1100 && window.innerHeight >= 600,
  );
  const [isDraggingIfc, setIsDraggingIfc] = useState(false);
  const [roomScheduleOpen, setRoomScheduleOpen] = useState(false);
  const [sheetViewOpen, setSheetViewOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(320);
  const dragDepthRef = useRef(0);

  const rooms = useAppStore((s) => s.rooms);
  const isLoadingModel = useAppStore((s) => s.isLoadingModel);
  const loadError = useAppStore((s) => s.loadError);
  const loadProgress = useAppStore((s) => s.loadProgress);
  const loadMessage = useAppStore((s) => s.loadMessage);
  const activeModelId = useAppStore((s) => s.activeModelId);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const pdfCaptureActive = useAppStore((s) => s.pdfCaptureActive);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);

  const setActiveModelId = useAppStore((s) => s.setActiveModelId);
  const setFloors = useAppStore((s) => s.setFloors);
  const setRooms = useAppStore((s) => s.setRooms);
  const setIsLoadingModel = useAppStore((s) => s.setIsLoadingModel);
  const setLoadError = useAppStore((s) => s.setLoadError);
  const setLoadProgress = useAppStore((s) => s.setLoadProgress);
  const clearModelData = useAppStore((s) => s.clearModelData);
  const setLeftPanelOpen = useAppStore((s) => s.setLeftPanelOpen);
  const setRightPanelOpen = useAppStore((s) => s.setRightPanelOpen);

  // Layout Tool Store
  const setArmedLayoutTool = useLayoutDrawingStore((s) => s.setArmedLayoutTool);
  const projectId = useLayoutDrawingStore((s) => s.projectId);
  const mepModeActive = useLayoutDrawingStore((s) => s.mepModeActive);

  // Markup Tool Store
  const setArmedTool = useToolMarkupStore((s) => s.setArmedTool);

  useEffect(() => {
    document.title = activeModelLabel?.trim()
      ? `V Studio — ${activeModelLabel.trim()}`
      : "V Studio";
  }, [activeModelLabel]);

  useEffect(() => {
    document.body.classList.toggle("pdf-capturing", pdfCaptureActive);
    return () => document.body.classList.remove("pdf-capturing");
  }, [pdfCaptureActive]);

  useEffect(() => {
    document.body.classList.toggle("mep-mode-active", mepModeActive);
    return () => document.body.classList.remove("mep-mode-active");
  }, [mepModeActive]);

  useEffect(() => {
    if (!activeModelId) return;
    // Auto initialize project & default Erdgeschoss level so drawing/placement works instantly
    void useLayoutDrawingStore.getState().loadForProject(activeModelId, activeModelId.startsWith("empty:")).then(() => {
      const store = useLayoutDrawingStore.getState();
      if (store.levels.length === 0) {
        void store.addLevel({ name: "Erdgeschoss", elevationMm: 0, heightMm: 3000 });
      }
    });
  }, [activeModelId]);

  useEffect(() => {
    document.body.classList.add("werkzeug-active");
    hydratePanelState();
    useAppStore.getState().setToolMode(true);
    useAppStore.getState().setPresentationView(false);
    setRightPanelOpen(true);
    setLeftPanelOpen(false);
    return () => {
      document.body.classList.remove("werkzeug-active");
      useAppStore.getState().setToolMode(false);
    };
  }, [setLeftPanelOpen, setRightPanelOpen]);

  useEffect(() => {
    const dismissTransientUi = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-viewer-root]")) return;
      if (target.closest("button, input, select, textarea, [role='menu'], [data-popup-surface]")) return;
      window.dispatchEvent(new CustomEvent("werkzeug-dismiss-popovers"));
    };
    window.addEventListener("pointerdown", dismissTransientUi, true);
    return () => window.removeEventListener("pointerdown", dismissTransientUi, true);
  }, []);

  useEffect(() => {
    let candidate: { startedAt: number; points: Array<{ x: number; y: number }> } | null = null;
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) {
        candidate = null;
        return;
      }
      candidate = {
        startedAt: performance.now(),
        points: Array.from(event.touches).map((touch) => ({ x: touch.clientX, y: touch.clientY })),
      };
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!candidate || event.touches.length !== 2) return;
      const moved = Array.from(event.touches).some((touch, index) => {
        const start = candidate?.points[index];
        return !start || Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 12;
      });
      if (moved) candidate = null;
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (!candidate || event.touches.length !== 0) return;
      const isTap = performance.now() - candidate.startedAt <= 420;
      candidate = null;
      if (!isTap) return;
      event.preventDefault();
      window.dispatchEvent(new CustomEvent("werkzeug-dismiss-popovers"));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  useEffect(() => {
    const updateViewportMode = () => {
      setIsDesktop(window.innerWidth >= 1100 && window.innerHeight >= 600);
    };
    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);
    window.addEventListener("orientationchange", updateViewportMode);
    return () => {
      window.removeEventListener("resize", updateViewportMode);
      window.removeEventListener("orientationchange", updateViewportMode);
    };
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedWerkzeugWork()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Keyboard Shortcuts (W = Wall, D = Door, Esc = Cancel Selection, Ctrl+Z = Undo, Ctrl+Y = Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target && isTypingTarget(e.target)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redoWerkzeug();
        } else {
          undoWerkzeug();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redoWerkzeug();
        return;
      }

      if (e.key === "Escape") {
        const layout = useLayoutDrawingStore.getState();
        if (layout.slabBoundaryEdit) {
          layout.cancelSlabBoundaryEdit();
          return;
        }
        layout.finishWallDraw();
        layout.cancelSlabDraw();
        layout.cancelStairDraw();
        layout.cancelRampDraw();
        layout.finishSketchLineDraw();
        layout.clearTracePreview();
        layout.setArmedLayoutTool(null);
        layout.clearSelection();
        const markup = useToolMarkupStore.getState();
        markup.setArmedTool(null);
        markup.cancelPendingNote();
        markup.clearSelection();
        markup.setCubeDraw(null);
        markup.setDragSnapHint(null);
        useAppStore.getState().setSelectedElement(null);
        return;
      }

      if (e.key.toLowerCase() === "w" && !e.ctrlKey && !e.metaKey) {
        setArmedLayoutTool("wall");
        setArmedTool(null);
        return;
      }

      if (e.key.toLowerCase() === "d" && !e.ctrlKey && !e.metaKey) {
        setArmedLayoutTool("door");
        setArmedTool(null);
        return;
      }

      if (e.key.toLowerCase() === "t" && !e.ctrlKey && !e.metaKey) {
        setArmedLayoutTool("trim");
        setArmedTool(null);
        return;
      }

      if (e.key.toLowerCase() === "l" && !e.ctrlKey && !e.metaKey) {
        setArmedLayoutTool("lines");
        setArmedTool(null);
        return;
      }

      if (e.key.toLowerCase() === "c" && !e.ctrlKey && !e.metaKey) {
        setArmedLayoutTool("column");
        setArmedTool(null);
        return;
      }

      if (e.key.toLowerCase() === "b" && !e.ctrlKey && !e.metaKey) {
        setArmedLayoutTool("beam");
        setArmedTool(null);
        return;
      }

      if (e.key.toLowerCase() === "g" && !e.ctrlKey && !e.metaKey) {
        setArmedLayoutTool("grid");
        setArmedTool(null);
        return;
      }

      if (e.key.toLowerCase() === "s" && !e.ctrlKey && !e.metaKey) {
        setArmedLayoutTool("stair");
        setArmedTool(null);
        return;
      }

      if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey) {
        setArmedLayoutTool("ramp");
        setArmedTool(null);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    setArmedLayoutTool,
    setArmedTool,
  ]);

  useLayoutEffect(() => {
    const bar = progressBarRef.current;
    if (!bar || loadProgress < 0) return;
    gsap.to(bar, {
      width: `${Math.round(loadProgress * 100)}%`,
      duration: gsapDuration.progress,
      ease: gsapEase.ios,
    });
  }, [loadProgress]);

  const handlePointerMove = useCallback((x: number, y: number) => {
    setPointer({ x, y });
    setPointerOverViewer(true);
  }, []);

  const handlePointerLeaveViewer = useCallback(() => {
    setPointerOverViewer(false);
  }, []);

  const clearCurrent = useCallback(() => {
    if (loadedRef.current) {
      disposeLoadedModel(loadedRef.current);
      loadedRef.current = null;
    }
    setShellGroup(null);
    clearModelData();
    clearFloorSnapshots();
  }, [clearModelData]);

  const applySource = useCallback(
    async (source: LoadSource) => {
      loadSourceRef.current = source;
      clearCurrent();

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

      setIsLoadingModel(true);
      setLoadError(null);
      setLoadProgress(0);

      try {
        let ifcSource: IfcSource;
        if (source.kind === "registry") {
          const entry = getModelById(source.modelId);
          if (!entry) throw new Error(`Unknown model: ${source.modelId}`);
          ifcSource = entry.ifcPath;
        } else {
          ifcSource = source.file;
        }

        const result = await loadIfcModel(ifcSource, (p) => {
          setLoadProgress(p.progress < 0 ? -1 : p.progress, p.message);
        });

        loadedRef.current = result;
        setFloors(result.floors);
        setRooms(result.rooms);
        setShellGroup(result.shellGroup);
        if (source.kind === "registry") persistModelId(id);
        setIsLoadingModel(false);
        setTimeout(() => viewerRef.current?.fitVisible?.(), 100);
      } catch (err: any) {
        console.error(err);
        setLoadError(err?.message || "Failed to load model");
        setIsLoadingModel(false);
      }
    },
    [
      clearCurrent,
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
      applySource({
        kind: "file",
        id: `custom_${Date.now()}`,
        name: file.name,
        file,
      });
    },
    [applySource],
  );

  const handleRetry = useCallback(() => {
    if (loadSourceRef.current) {
      applySource(loadSourceRef.current);
    }
  }, [applySource]);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes(MATERIAL_DRAG_MIME)) {
      setIsDraggingIfc(false);
      return;
    }
    dragDepthRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDraggingIfc(true);
    }
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current--;
    if (dragDepthRef.current <= 0) {
      setIsDraggingIfc(false);
      dragDepthRef.current = 0;
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingIfc(false);
      dragDepthRef.current = 0;
      if (
        e.dataTransfer.types.includes(MATERIAL_DRAG_MIME) ||
        e.dataTransfer.getData("text/plain").startsWith("vstudio-material:")
      ) {
        return;
      }
      const file = e.dataTransfer.files?.[0];
      if (file && (file.name.endsWith(".ifc") || file.name.endsWith(".frag"))) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  const sceneValue = useMemo(() => ({ shellGroup, rooms }), [shellGroup, rooms]);

  const showWerkzeugEntry = !isLoadingModel && !loadError && rooms.length === 0 && !shellGroup && !projectId;
  const hasActiveWorkspace = Boolean(projectId || shellGroup);
  const showError = Boolean(loadError && !isLoadingModel);
  const progressLabel = loadMessage?.trim() || `${Math.round(loadProgress * 100)}%`;

  return (
    <WerkzeugModelSceneContext.Provider value={sceneValue}>
      <ThemeHydration />
      <ThemeTransition />
      <div
        ref={rootRef}
        className="werkzeug-compact-ui tool-chrome relative h-dvh w-dvw overflow-hidden bg-[var(--surface-base)] text-[var(--text-strong)] select-none"
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <div className={`contents werkzeug-preproject-tools ${hasActiveWorkspace ? "" : "is-disabled"}`} aria-disabled={!hasActiveWorkspace}>
        {isDesktop ? (
          <>
            <DesktopIsland />
            <ToolRibbon
              viewerRef={viewerRef}
              onFile={handleFile}
              isLoadingModel={isLoadingModel}
              onOpenRoomSchedule={() => setRoomScheduleOpen(true)}
              onOpenSheet={() => setSheetViewOpen(true)}
            />
            <ToolOptionsBar />
          </>
        ) : (
          <WerkzeugWorkspaceChrome
            onFile={handleFile}
            onAttachDwgPdf={(file) => {
              const layout = useLayoutDrawingStore.getState();
              const levelId = useToolMarkupStore.getState().markupFloorId ?? layout.levels[0]?.id;
              if (!levelId) return;
              void layout.addUnderlayFromFile(levelId, file).then((underlay) => {
                if (!underlay) return;
                layout.selectUnderlay(underlay.id);
                useToolMarkupStore.getState().setMarkupFloorId(levelId);
                useToolMarkupStore.getState().setViewPreset("top");
              });
            }}
            isLoadingModel={isLoadingModel}
          />
        )}
        </div>

        {/* 3D CAD Viewport Canvas — reflows on desktop when right panel is open */}
        <main
          className="fixed inset-y-0 left-0 z-0 bg-[#0c0d12] transition-[right] duration-200"
          style={{ right: isDesktop && rightPanelOpen ? panelWidth : 0 }}
        >
          <VStudioErrorBoundary fallbackTitle="3D Viewport Render Error">
            <WerkzeugViewer3D
              ref={viewerRef}
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeaveViewer}
              className="h-full w-full"
            />
          </VStudioErrorBoundary>
        </main>

        {isDesktop && (
          <ToolRightPanel
            onFile={handleFile}
            isLoadingModel={isLoadingModel}
            panelWidth={panelWidth}
            onPanelWidthChange={setPanelWidth}
            onOpenRoomSchedule={() => setRoomScheduleOpen(true)}
            onOpenSheet={(_sheetId) => setSheetViewOpen(true)}
          />
        )}

        <SceneBusyOverlay />
        <SceneBusyCursor
          x={pointer.x}
          y={pointer.y}
          active={pointerOverViewer}
        />

        {/* Room & Area Take-off Schedule Modal */}
        <RoomScheduleDialog isOpen={roomScheduleOpen} onClose={() => setRoomScheduleOpen(false)} />

        {/* Sheet Composition & Title Block Modal (Section 7) */}
        <SheetViewDialog isOpen={sheetViewOpen} onClose={() => setSheetViewOpen(false)} />

        {/* Bottom CAD Status Bar */}
        {isDesktop && <ToolStatusBar
          pointer={pointer}
          onAttachDwgPdf={(file) => {
            // DWG/PDF underlay attachment — full per-floor alignment wired in Section 11
            // For now, pass to the existing handleFile flow for IFC, or handle DWG separately
            const layout = useLayoutDrawingStore.getState();
            const levelId = useToolMarkupStore.getState().markupFloorId ?? layout.levels[0]?.id;
            if (!levelId) return;
            void layout.addUnderlayFromFile(levelId, file).then((underlay) => {
              if (!underlay) return;
              layout.selectUnderlay(underlay.id);
              useToolMarkupStore.getState().setMarkupFloorId(levelId);
              useToolMarkupStore.getState().setViewPreset("top");
            });
          }}
        />}

        {/* Drag Snap & Hover Tooltip HUDs */}
        <DragSnapHud />
        <SceneHoverTipHud />
        {pointerOverViewer && (
          <ToolModeCursorHud x={pointer.x} y={pointer.y} />
        )}

        {/* Context Menu on Right Click */}
        <WerkzeugContextMenu
          viewerRef={viewerRef}
          rootRef={rootRef}
          onLoadIfc={handleFile}
          loadDisabled={isLoadingModel}
        />

        {/* File Drag Drop Overlay */}
        <GsapOverlay
          show={isDraggingIfc && !isLoadingModel}
          className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/35 p-4 backdrop-blur-[2px]"
        >
          <GlassPanel variant="panel" zIndex={100}>
            <div className="px-6 py-8 text-center">
              <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {t(uiLanguage, "dropIfc")}
              </p>
            </div>
          </GlassPanel>
        </GsapOverlay>

        {/* Loading Model Modal */}
        <GsapOverlay
          show={isLoadingModel}
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <GlassPanel variant="panel" zIndex={50}>
            <div className="p-6">
              <div className="mb-3 flex items-center gap-3">
                <LiquidGlassSpinner size="md" srLabel={t(uiLanguage, "loadingModel")} />
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  {t(uiLanguage, "loadingModel")}
                </p>
              </div>
              <p className="mb-3 text-xs text-zinc-500">{progressLabel}</p>
              {loadProgress >= 0 && (
                <div className="h-2 overflow-hidden rounded-full bg-amber-50/50">
                  <div
                    ref={progressBarRef}
                    className="h-full rounded-full bg-gradient-to-br from-amber-200/95 to-amber-400/80"
                    style={{ width: `${Math.round(loadProgress * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </GlassPanel>
        </GsapOverlay>

        {/* Welcome / Empty Project Starter Panel */}
        <GsapOverlay
          show={showWerkzeugEntry}
          className="fixed inset-0 z-[90]"
        >
          <WerkzeugEntryPanel onFile={handleFile} />
        </GsapOverlay>

        {/* Error Modal */}
        <GsapOverlay show={showError} className="fixed inset-0 z-30 flex items-center justify-center p-4">
          <GlassPanel variant="panel" zIndex={30}>
            <div className="p-6 text-center">
              <IconAlert />
              <p className="mt-3 text-sm font-semibold">{t(uiLanguage, "couldNotLoad")}</p>
              <p className="mt-2 text-xs text-zinc-500">{loadError}</p>
              <div className="mt-4 flex justify-center gap-2">
                <GlassButton variant="primary" onClick={handleRetry}>
                  {t(uiLanguage, "retry")}
                </GlassButton>
                <LoadIfcButton onFile={handleFile} label={t(uiLanguage, "loadOtherIfc")} />
              </div>
            </div>
          </GlassPanel>
        </GsapOverlay>

      </div>
    </WerkzeugModelSceneContext.Provider>
  );
}

export { useModelScene } from "./WerkzeugModelSceneContext";
