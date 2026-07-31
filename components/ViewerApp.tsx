"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { ModelSceneContext } from "./ModelSceneContext";
import Viewer3D, { type Viewer3DHandle } from "./Viewer3D";
import RoomTooltip from "./RoomTooltip";
import LoadIfcButton from "./LoadIfcButton";
import HeaderActions from "./HeaderActions";
import FloorsPanel from "./FloorsPanel";
import LegendPanel from "./LegendPanel";
import PresentationMobileDock from "./PresentationMobileDock";
import PresentationSidePanel from "./PresentationSidePanel";
import MobileCornerMenu from "./MobileCornerMenu";
import GlassPanel from "./GlassPanel";
import { GlassButton, IconAlert } from "./ui";
import ViewerToolbar from "./ViewerToolbar";
import ViewerContextMenu from "./ViewerContextMenu";
import { pickHeizlastRangeFromLoads, pickKuhllastRangeFromLoads } from "@/lib/colorMapping";
import { t } from "@/lib/i18n";

type LoadSource =
  | { kind: "registry"; modelId: string }
  | { kind: "file"; id: string; name: string; file: File };

export default function ViewerApp() {
  const viewerRef = useRef<Viewer3DHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef<LoadedModel | null>(null);
  const loadSourceRef = useRef<LoadSource | null>(null);
  const [shellGroup, setShellGroup] = useState<Group | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [isDesktop, setIsDesktop] = useState(true);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isDraggingIfc, setIsDraggingIfc] = useState(false);
  const dragDepthRef = useRef(0);

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
  const uiLanguage = useAppStore((s) => s.uiLanguage);

  const setActiveModelId = useAppStore((s) => s.setActiveModelId);
  const setFloors = useAppStore((s) => s.setFloors);
  const setRooms = useAppStore((s) => s.setRooms);
  const setHeizlastRange = useAppStore((s) => s.setHeizlastRange);
  const setKuhllastRange = useAppStore((s) => s.setKuhllastRange);
  const setIsLoadingModel = useAppStore((s) => s.setIsLoadingModel);
  const setLoadError = useAppStore((s) => s.setLoadError);
  const setLoadProgress = useAppStore((s) => s.setLoadProgress);
  const clearModelData = useAppStore((s) => s.clearModelData);
  const setLeftPanelOpen = useAppStore((s) => s.setLeftPanelOpen);
  const setRightPanelOpen = useAppStore((s) => s.setRightPanelOpen);

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
        } else {
          ifcSource = source.file;
        }

        const result = await loadIfcModel(ifcSource, (p) => {
          setLoadProgress(p.progress < 0 ? -1 : p.progress, p.message);
        });
        loadedRef.current = result;
        setFloors(result.floors);
        setRooms(result.rooms);
        setHeizlastRange(
          pickHeizlastRangeFromLoads(result.rooms.map((r) => r.heatLoad)),
        );
        setKuhllastRange(
          pickKuhllastRangeFromLoads(result.rooms.map((r) => r.coolLoad)),
        );
        setShellGroup(result.shellGroup);
        if (source.kind === "registry") persistModelId(id);
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
      setHeizlastRange,
      setKuhllastRange,
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
      const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      void runLoad({ kind: "file", id, name: file.name, file });
    },
    [runLoad],
  );

  const isIfcFile = useCallback((file: File) => {
    const name = file.name.toLowerCase();
    return (
      name.endsWith(".ifc") ||
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

  const sceneValue = useMemo(
    () => ({ shellGroup, rooms }),
    [shellGroup, rooms],
  );

  const handlePointerMove = useCallback((x: number, y: number) => {
    setPointer({ x, y });
  }, []);

  const hasModel = rooms.length > 0 || Boolean(shellGroup);
  const showEmptyCta = !hasModel && !isLoadingModel && !loadError;
  const showError = Boolean(loadError) && !isLoadingModel;

  const progressLabel =
    loadProgress < 0
      ? loadMessage || t(uiLanguage, "working")
      : `${loadMessage || t(uiLanguage, "loading")} (${Math.round(Math.max(0, loadProgress) * 100)}%)`;

  return (
    <ModelSceneContext.Provider value={sceneValue}>
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

        <div className="fixed inset-0 z-0">
          <Viewer3D
            ref={viewerRef}
            onPointerMove={handlePointerMove}
            className="h-full w-full"
          />
        </div>

        {isDraggingIfc && !isLoadingModel && (
          <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/35 p-4 backdrop-blur-[2px] sm:p-6">
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
          </div>
        )}

        {isLoadingModel && (
          <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6">
            <GlassPanel
              variant="panel"
              zIndex={30}
              wrapperClassName="pointer-events-auto w-full max-w-[min(24rem,calc(100vw-2rem))]"
            >
              <div className="p-6">
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-7 w-7 animate-spin rounded-2xl border-2 border-amber-200/50 border-t-amber-500" />
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
                      className="relative h-full overflow-hidden rounded-full border border-amber-200/60 bg-gradient-to-br from-amber-200/95 via-yellow-300/90 to-amber-400/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_8px_rgba(251,191,36,0.35)] transition-all duration-300 ease-out"
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
          </div>
        )}

        {showEmptyCta && (
          <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6">
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
          </div>
        )}

        {showError && (
          <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6">
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
          </div>
        )}

        {/* One popup only: selection wins over hover */}
        {!selectedRoomId && (
          <RoomTooltip x={pointer.x} y={pointer.y} />
        )}
        {selectedRoomId && (() => {
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
        <ViewerContextMenu
          viewerRef={viewerRef}
          rootRef={rootRef}
          onLoadIfc={handleFile}
          loadDisabled={isLoadingModel}
        />

        {/* LEFT — Floors & Rooms (kept mounted but hidden in presentation so PDF export can restore framing) */}
        {isDesktop && (
          <aside
            className={`fixed top-14 bottom-16 z-[35] flex w-[min(300px,calc(100vw-1.5rem))] flex-col sm:top-16 sm:bottom-[4.5rem] md:w-[min(340px,calc(100vw-2rem))] lg:w-[min(360px,calc(100vw-2rem))] transition-[transform,opacity,left] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isPresentationView
                ? "left-2 pointer-events-none -translate-x-[calc(100%+1.5rem)] opacity-0 md:left-4"
                : leftPanelOpen
                  ? "left-2 pointer-events-auto translate-x-0 opacity-100 md:left-4"
                  : "left-0 pointer-events-auto translate-x-[calc(-100%+1.25rem)] opacity-100"
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
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className={`transition-transform duration-300 ease-out ${
                    leftPanelOpen ? "" : "rotate-180"
                  }`}
                >
                  <path d="m15 6-6 6 6 6" />
                </svg>
              </button>
              <div
                className={`flex min-h-0 flex-1 flex-col overflow-hidden pr-5 transition-opacity duration-300 ease-out ${
                  leftPanelOpen ? "opacity-100" : "opacity-0 pointer-events-none"
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
            Always size to content (max-height caps tall lists); never stretch empty. */}
        {isDesktop && (
          <aside
            className={`fixed z-[35] flex w-[min(18rem,calc(100vw-1.5rem))] flex-col md:w-[min(22rem,calc(100vw-2rem))] lg:w-[min(24rem,calc(100vw-2rem))] transition-[top,bottom,transform,opacity,max-height] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isPresentationView
                ? "top-32 bottom-auto max-h-[calc(100dvh-10.5rem)] md:top-36 lg:top-40"
                : "top-auto bottom-16 max-h-[calc(100dvh-10.5rem)] sm:bottom-[4.5rem]"
            } ${
              rightPanelOpen
                ? "right-2 pointer-events-auto translate-x-0 opacity-100 md:right-4"
                : "right-0 pointer-events-auto translate-x-[calc(100%-1.25rem)] opacity-100"
            }`}
          >
            <GlassPanel
              variant="panel"
              zIndex={35}
              fill={false}
              allowOverflow={false}
              wrapperClassName="relative mb-2 max-h-[inherit]"
            >
              <button
                type="button"
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                aria-label={
                  rightPanelOpen
                    ? t(uiLanguage, "hideLegend")
                    : t(uiLanguage, "showLegend")
                }
                className="absolute inset-y-0 left-0 z-10 flex w-5 items-center justify-center rounded-l-3xl bg-zinc-400/30 text-zinc-600 transition-colors duration-300 ease-out hover:bg-zinc-400/45"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className={`transition-transform duration-300 ease-out ${
                    rightPanelOpen ? "" : "rotate-180"
                  }`}
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
              <div
                className={`pl-5 transition-opacity duration-300 ease-out thin-scroll max-h-[calc(100dvh-10.5rem)] overflow-y-auto overscroll-contain ${
                  rightPanelOpen
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                {isPresentationView ? (
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
                title={t(uiLanguage, "model")}
                subtitle={activeModelLabel}
                onLoadIfc={handleFile}
                isLoadingModel={isLoadingModel}
              >
                {({ detailsOpen }) => (
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
                )}
              </MobileCornerMenu>
            )}

            {isPresentationView && (
              <PresentationMobileDock
                align={isLandscape ? "right" : "center"}
              />
            )}
          </>
        )}
      </div>
    </ModelSceneContext.Provider>
  );
}

export { useModelScene } from "./ModelSceneContext";
