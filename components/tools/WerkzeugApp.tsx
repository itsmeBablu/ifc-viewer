"use client";

/**
 * WerkzeugApp — standalone Werkzeug interface at /werkzeug.
 * Isolated from the heating / ventilation / cooling viewer on "/".
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
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
import {
  TOOL_RIGHT_PANEL_PEEK_PX,
} from "./werkzeugLayout";
import { useWerkzeugUiStore } from "./werkzeugUiStore";
import { WerkzeugModelSceneContext } from "./WerkzeugModelSceneContext";
import WerkzeugViewer3D, {
  type WerkzeugViewer3DHandle,
} from "./WerkzeugViewer3D";
import LoadIfcButton from "@/components/common/LoadIfcButton";
import GlassPanel from "@/components/common/GlassPanel";
import { GlassButton, IconAlert } from "@/components/common/ui";
import WerkzeugToolbar from "./WerkzeugToolbar";
import WerkzeugContextMenu from "./WerkzeugContextMenu";
import WerkzeugHeader from "./WerkzeugHeader";
import ToolSidePanel from "./ToolSidePanel";
import ToolTopBar from "./ToolTopBar";
import ToolLeftPalette from "./ToolLeftPalette";
import ToolModeCursorHud from "./ToolModeCursorHud";
import WerkzeugEntryPanel from "./WerkzeugEntryPanel";
import MobileCornerMenu from "@/components/layout/MobileCornerMenu";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { t } from "@/lib/i18n";
import { hasUnsavedWerkzeugWork } from "@/lib/werkzeugUnsaved";
import { redoWerkzeug, undoWerkzeug } from "@/lib/werkzeugHistory";
import { gsapDuration, gsapEase, animateSidebarContent, killGsap } from "@/lib/gsapMotion";
import { OPEN_IFC_FILE_EVENT, isTypingTarget } from "@/lib/viewerHotkeys";
import { cacheIfcBytes, parseFragFile } from "@/lib/markupFragSave";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import {
  idbPutNote,
  idbPutPlacement,
} from "@/lib/toolMarkupDb";
import { normalizeNote, normalizePlacement } from "@/lib/toolMarkup";
import GsapOverlay from "@/components/common/GsapOverlay";
import SceneBusyOverlay from "@/components/common/SceneBusyOverlay";
import SceneBusyCursor from "@/components/common/SceneBusyCursor";
import LiquidGlassSpinner from "@/components/common/LiquidGlassSpinner";
import ThemeTransition from "@/components/common/ThemeTransition";
import ThemeHydration from "@/components/common/ThemeHydration";

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
        wallDraw?.angleSnapped ? "text-sky-800" : "text-emerald-700"
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

export default function WerkzeugApp() {
  const viewerRef = useRef<WerkzeugViewer3DHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const rightContentRef = useRef<HTMLDivElement>(null);
  const rightAsideRef = useRef<HTMLElement>(null);
  const rightChevronRef = useRef<SVGSVGElement>(null);
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
  const toolResizeDragRef = useRef<{ startX: number; startWidth: number } | null>(
    null,
  );

  const rooms = useAppStore((s) => s.rooms);
  const isLoadingModel = useAppStore((s) => s.isLoadingModel);
  const loadError = useAppStore((s) => s.loadError);
  const loadProgress = useAppStore((s) => s.loadProgress);
  const loadMessage = useAppStore((s) => s.loadMessage);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const toolRightPanelWidthPx = useWerkzeugUiStore((s) => s.toolRightPanelWidthPx);
  const setToolRightPanelWidthPx = useWerkzeugUiStore(
    (s) => s.setToolRightPanelWidthPx,
  );
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const pdfCaptureActive = useAppStore((s) => s.pdfCaptureActive);

  const setActiveModelId = useAppStore((s) => s.setActiveModelId);
  const setFloors = useAppStore((s) => s.setFloors);
  const setRooms = useAppStore((s) => s.setRooms);
  const setIsLoadingModel = useAppStore((s) => s.setIsLoadingModel);
  const setLoadError = useAppStore((s) => s.setLoadError);
  const setLoadProgress = useAppStore((s) => s.setLoadProgress);
  const clearModelData = useAppStore((s) => s.clearModelData);
  const setRightPanelOpen = useAppStore((s) => s.setRightPanelOpen);
  const setLeftPanelOpen = useAppStore((s) => s.setLeftPanelOpen);

  useEffect(() => {
    document.title = activeModelLabel?.trim()
      ? `IBV Werkzeug - ${activeModelLabel.trim()}`
      : "IBV Werkzeug";
  }, [activeModelLabel]);

  useEffect(() => {
    document.body.classList.toggle("pdf-capturing", pdfCaptureActive);
    return () => document.body.classList.remove("pdf-capturing");
  }, [pdfCaptureActive]);

  useEffect(() => {
    hydratePanelState();
    useAppStore.getState().setToolMode(true);
    useAppStore.getState().setPresentationView(false);
    setRightPanelOpen(true);
    setLeftPanelOpen(false);
    return () => {
      useAppStore.getState().setToolMode(false);
    };
  }, [setLeftPanelOpen, setRightPanelOpen]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedWerkzeugWork()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
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
    if (!isDesktop) return;
    const aside = rightAsideRef.current;
    if (!aside) return;
    killGsap(aside);
    gsap.set(aside, { clearProps: "transform,x" });
    aside.style.opacity = "1";
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
  }, [isDesktop, rightPanelOpen]);

  useEffect(() => {
    if (!isDesktop) return;
    const onResize = () => {
      setToolRightPanelWidthPx(
        toolRightPanelWidthPx,
        window.innerWidth,
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isDesktop, setToolRightPanelWidthPx, toolRightPanelWidthPx]);

  const onToolPanelResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!rightPanelOpen) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      toolResizeDragRef.current = {
        startX: e.clientX,
        startWidth: toolRightPanelWidthPx,
      };
      setToolPanelResizing(true);
    },
    [rightPanelOpen, toolRightPanelWidthPx],
  );

  const onToolPanelResizePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = toolResizeDragRef.current;
      if (!drag) return;
      const dx = drag.startX - e.clientX;
      setToolRightPanelWidthPx(
        drag.startWidth + dx,
        window.innerWidth,
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
            /* optional */
          }
        } else {
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
        setShellGroup(result.shellGroup);
        if (source.kind === "registry") persistModelId(id);

        useAppStore.getState().setToolMode(true);
        await useToolMarkupStore.getState().loadForModel(id);
        await useLayoutDrawingStore
          .getState()
          .loadForProject(id, id.startsWith("empty:"));
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : t(useAppStore.getState().uiLanguage, "failedLoad");
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
            useAppStore.getState().setToolMode(true);
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
      if (file) handleFile(file);
    },
    [handleFile, isIfcFile, isLoadingModel],
  );

  const handleRetry = useCallback(() => {
    const src = loadSourceRef.current;
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
      if ((e.ctrlKey || e.metaKey) && (e.key === "o" || e.key === "O" || e.key === "n" || e.key === "N")) {
        e.preventDefault();
        window.dispatchEvent(new Event(OPEN_IFC_FILE_EVENT));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === "z" && !e.shiftKey) {
          e.preventDefault();
          void undoWerkzeug();
          return;
        }
        if (k === "y" || (k === "z" && e.shiftKey)) {
          e.preventDefault();
          void redoWerkzeug();
        }
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
  const showWerkzeugEntry =
    !hasModel && !isLoadingModel && !loadError;
  const showError = Boolean(loadError) && !isLoadingModel;

  const progressLabel =
    loadProgress < 0
      ? loadMessage || t(uiLanguage, "working")
      : `${loadMessage || t(uiLanguage, "loading")} (${Math.round(Math.max(0, loadProgress) * 100)}%)`;

  const toolViewerRightInset = isDesktop ? TOOL_RIGHT_PANEL_PEEK_PX : 0;

  return (
    <WerkzeugModelSceneContext.Provider value={sceneValue}>
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
        <WerkzeugHeader onFile={handleFile} isLoadingModel={isLoadingModel} />

        <div
          className="fixed top-0 bottom-0 left-0 z-0"
          style={{
            right: toolViewerRightInset,
            transition: toolPanelResizing
              ? "none"
              : "right 220ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <WerkzeugViewer3D
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
          className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/35 p-4 backdrop-blur-[2px]"
        >
          <GlassPanel variant="panel" zIndex={100}>
            <div className="px-6 py-8 text-center">
              <p className="text-base font-semibold text-zinc-900">
                {t(uiLanguage, "dropIfc")}
              </p>
            </div>
          </GlassPanel>
        </GsapOverlay>

        <GsapOverlay
          show={isLoadingModel}
          className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-4"
        >
          <GlassPanel variant="panel" zIndex={30}>
            <div className="p-6">
              <div className="mb-3 flex items-center gap-3">
                <LiquidGlassSpinner size="md" srLabel={t(uiLanguage, "loadingModel")} />
                <p className="text-sm font-semibold text-zinc-800">
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

        <GsapOverlay
          show={showWerkzeugEntry}
          className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-4"
        >
          <WerkzeugEntryPanel onFile={handleFile} />
        </GsapOverlay>

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

        <WerkzeugToolbar viewerRef={viewerRef} targetRef={rootRef} />
        <ToolTopBar />
        <DragSnapHud />
        <SceneHoverTipHud />
        {pointerOverViewer && (
          <ToolModeCursorHud x={pointer.x} y={pointer.y} />
        )}
        <WerkzeugContextMenu
          viewerRef={viewerRef}
          rootRef={rootRef}
          onLoadIfc={handleFile}
          loadDisabled={isLoadingModel}
        />

        {isDesktop && <ToolLeftPalette />}

        {isDesktop && (
          <aside
            ref={rightAsideRef}
            className="pointer-events-auto fixed inset-y-0 right-0 z-[35] flex h-dvh max-h-dvh flex-col overflow-hidden rounded-none"
            style={{
              width: rightPanelOpen
                ? toolRightPanelWidthPx
                : TOOL_RIGHT_PANEL_PEEK_PX,
              transition: toolPanelResizing
                ? "none"
                : "width 220ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <GlassPanel
              variant="panel"
              zIndex={35}
              fill
              preferCss
              wrapperStyle={{ borderRadius: 0, background: "var(--surface-muted)" }}
              wrapperClassName="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden !rounded-none"
              className="tool-dock-panel !rounded-none"
            >
              {rightPanelOpen && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={t(uiLanguage, "resizePanel")}
                  onPointerDown={onToolPanelResizePointerDown}
                  onPointerMove={onToolPanelResizePointerMove}
                  onPointerUp={onToolPanelResizePointerUp}
                  onPointerCancel={onToolPanelResizePointerUp}
                  className="absolute inset-y-0 left-0 z-20 w-1 -translate-x-full cursor-col-resize touch-none hover:bg-amber-400/35"
                />
              )}
              <button
                type="button"
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                aria-label={
                  rightPanelOpen
                    ? t(uiLanguage, "hideIfcStructure")
                    : t(uiLanguage, "showIfcStructure")
                }
                className={`absolute inset-y-0 left-0 z-30 flex items-center justify-center bg-zinc-400/30 text-zinc-600 hover:bg-zinc-400/45 ${
                  rightPanelOpen ? "w-5" : "w-full"
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
                  aria-hidden
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
              <div
                ref={rightContentRef}
                className={`flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden pl-5 pr-1 pt-[calc(3.75rem+env(safe-area-inset-top,0px))] ${
                  rightPanelOpen ? "" : "pointer-events-none"
                }`}
              >
                <ToolSidePanel
                  className="h-full flex-1"
                  onFile={handleFile}
                  isLoadingModel={isLoadingModel}
                />
              </div>
            </GlassPanel>
          </aside>
        )}

        {!isDesktop && (
          <MobileCornerMenu
            open={rightPanelOpen}
            onOpenChange={setRightPanelOpen}
            title={t(uiLanguage, "tool")}
            subtitle={activeModelLabel}
            onLoadIfc={handleFile}
            isLoadingModel={isLoadingModel}
            landscapeMobile={isLandscape}
          >
            {() => (
              <ToolSidePanel
                className="h-[70dvh]"
                onFile={handleFile}
                isLoadingModel={isLoadingModel}
              />
            )}
          </MobileCornerMenu>
        )}
      </div>
    </WerkzeugModelSceneContext.Provider>
  );
}

export { useModelScene } from "./WerkzeugModelSceneContext";
