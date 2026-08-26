"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import gsap from "gsap";
import {
  LuAlignCenterHorizontal, LuBox, LuChevronDown, LuChevronLeft, LuCopy, LuDoorOpen, LuEye, LuFlipHorizontal2, LuFolderOpen, LuLayers3,
  LuGrid2X2, LuLock, LuLockOpen, LuMoon, LuMove, LuPalette, LuPaperclip, LuRedo2, LuRotate3D, LuSave, LuScale, LuScissors, LuSlidersHorizontal, LuSparkles, LuSun, LuSunMedium, LuTrash2, LuUndo2,
} from "react-icons/lu";
import { IconMarkupFloor, IconMarkupRoof, IconMarkupWall, IconMarkupWindow } from "./MarkupIcons";
import GlassPanel from "@/components/common/GlassPanel";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { redoWerkzeug, undoWerkzeug } from "@/lib/werkzeugHistory";
import { buildFragBlob, downloadBlob, getCachedIfcBytes } from "@/lib/markupFragSave";
import { detectLoopsFromSegments } from "@/lib/linesLoopDetector";
import type { LayoutToolId, SelectedElementRef } from "@/lib/layoutDrawing";
import type { RenderMode } from "@/lib/types";
import type { MarkupViewPreset } from "@/lib/toolMarkup";
import ToolFloorsSection from "./ToolFloorsSection";
import MaterialEditorPanel from "./MaterialEditorPanel";
import ObjectSnapStrip from "./ObjectSnapStrip";
import LayoutPropertiesPanel from "./LayoutPropertiesPanel";

type PanelKey = "levels" | "materials" | LayoutToolId;
type Frame = { x: number; y: number; width: number; height: number };
type DockEdge = "top" | "bottom";

const TOOL_ITEMS: Array<{ id: PanelKey; label: string; icon: React.ReactNode }> = [
  { id: "levels", label: "Levels", icon: <LuLayers3 /> },
  { id: "wall", label: "Wall", icon: <IconMarkupWall /> },
  { id: "door", label: "Door", icon: <LuDoorOpen /> },
  { id: "window", label: "Window", icon: <IconMarkupWindow /> },
  { id: "roof", label: "Roof", icon: <IconMarkupRoof /> },
  { id: "floor", label: "Floor", icon: <IconMarkupFloor /> },
  { id: "lines", label: "Lines", icon: <span className="font-bold">L</span> },
  { id: "materials", label: "Materials", icon: <LuPalette /> },
];

const RENDER_MODES: Array<{ id: RenderMode; label: string; icon: React.ReactNode }> = [
  { id: "realistic", label: "Realistic", icon: <LuSparkles /> },
  { id: "fullColor", label: "Shaded", icon: <LuBox /> },
  { id: "light", label: "Light", icon: <LuSunMedium /> },
  { id: "wireframe", label: "Wireframe", icon: <LuGrid2X2 /> },
];

const defaultFrame = (): Frame => {
  if (typeof window === "undefined") return { x: 20, y: 88, width: 320, height: 280 };
  const tablet = window.innerWidth < 1100;
  const width = Math.min(330, window.innerWidth - 16);
  return tablet
    ? { x: Math.max(8, window.innerWidth - width - 8), y: 100, width, height: 248 }
    : { x: 20, y: 88, width: 320, height: 300 };
};

const compactWallFrame = (current: Frame): Frame => {
  if (typeof window === "undefined") return current;
  const width = Math.min(320, window.innerWidth - 16);
  return {
    ...current,
    x: Math.max(8, window.innerWidth - width - 8),
    y: Math.max(76, Math.min(current.y, window.innerHeight - 228)),
    width,
    height: Math.min(248, window.innerHeight - 84),
  };
};

const initialLandscapePanelHeight = () =>
  typeof window === "undefined"
    ? 280
    : Math.max(180, Math.min(window.innerHeight - 92, window.innerHeight * 0.4));

export default function WerkzeugWorkspaceChrome({
  onFile,
  onAttachDwgPdf,
  isLoadingModel,
}: {
  onFile: (file: File) => void;
  onAttachDwgPdf?: (file: File) => void;
  isLoadingModel: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fittedHeightRef = useRef(320);
  const fittedWidthRef = useRef(300);
  const resizingRef = useRef(false);
  const [panelKey, setPanelKey] = useState<PanelKey | null>("levels");
  const [collapsed] = useState(false);
  const [panelFrame, setPanelFrame] = useState<Frame>(defaultFrame);
  const [renderOpen, setRenderOpen] = useState(false);
  const [auxOpen, setAuxOpen] = useState<"views" | "scale" | "elements" | null>(null);
  const [auxPosition, setAuxPosition] = useState({ left: 8, top: 96 });
  const [dockEdge] = useState<DockEdge>("top");
  const [panelHidden, setPanelHidden] = useState(true);
  const [landscapePanelHeight, setLandscapePanelHeight] = useState(
    initialLandscapePanelHeight,
  );
  const [landscapePanelWidth, setLandscapePanelWidth] = useState(300);
  const [portraitPanelHeight, setPortraitPanelHeight] = useState(
    initialLandscapePanelHeight,
  );
  const [portraitPanelWidth, setPortraitPanelWidth] = useState(320);
  const [alignAxis, setAlignAxis] = useState<"x" | "y">("x");
  const [panelTab, setPanelTab] = useState<"properties" | "layout" | "type" | "materials">("properties");
  const [portrait, setPortrait] = useState(() => typeof window !== "undefined" && window.innerHeight > window.innerWidth);
  const armed = useLayoutDrawingStore((s) => s.armedLayoutTool);
  const walls = useLayoutDrawingStore((s) => s.walls);
  const doors = useLayoutDrawingStore((s) => s.doors);
  const windows = useLayoutDrawingStore((s) => s.windows);
  const slabs = useLayoutDrawingStore((s) => s.slabs);
  const columns = useLayoutDrawingStore((s) => s.columns);
  const beams = useLayoutDrawingStore((s) => s.beams);
  const selectedElements = useLayoutDrawingStore((s) => s.selectedElements);
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const lockedKeys = useLayoutDrawingStore((s) => s.lockedElementKeys);
  const renderMode = useAppStore((s) => s.renderMode);
  const colorTheme = useAppStore((s) => s.colorTheme);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const viewPreset = useToolMarkupStore((s) => s.viewPreset);
  const drawingScale = useLayoutDrawingStore((s) => s.drawingScale || "1:100");
  const setDrawingScale = useLayoutDrawingStore((s) => s.setDrawingScale);

  useEffect(() => {
    document.documentElement.dataset.werkzeugDock = dockEdge;
    window.dispatchEvent(new CustomEvent("werkzeug-ipad-toolbar-dock", { detail: dockEdge }));
    return () => { delete document.documentElement.dataset.werkzeugDock; };
  }, [dockEdge]);

  useEffect(() => {
    const updateOrientation = () => {
      setPortrait(window.innerHeight > window.innerWidth);
      setLandscapePanelHeight((height) =>
        Math.max(180, Math.min(height, window.innerHeight - 92)),
      );
      setPortraitPanelHeight((height) =>
        Math.max(180, Math.min(height, window.innerHeight - 48)),
      );
    };
    window.addEventListener("resize", updateOrientation);
    window.addEventListener("orientationchange", updateOrientation);
    return () => {
      window.removeEventListener("resize", updateOrientation);
      window.removeEventListener("orientationchange", updateOrientation);
    };
  }, []);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const content = contentRef.current;
    if (!panel || !content || panelHidden || collapsed) return;

    const fitToContent = () => {
      const contentHeight = content.scrollHeight;
      const chromeHeight = portrait ? 54 : 60;
      const viewportLimit = window.innerHeight - (portrait ? 48 : 92);
      const targetHeight = Math.max(
        140,
        Math.min(viewportLimit, contentHeight + chromeHeight),
      );
      fittedHeightRef.current = targetHeight;

      const first = content.firstElementChild as HTMLElement | null;
      const naturalWidth = first?.scrollWidth ?? content.scrollWidth;
      const widthLimit = Math.min(420, window.innerWidth - 16);
      const targetWidth = Math.max(
        240,
        Math.min(widthLimit, naturalWidth + 28),
      );
      fittedWidthRef.current = targetWidth;

      if (resizingRef.current) return;

      gsap.to(panel, {
        height: targetHeight,
        width: targetWidth,
        duration: 0.34,
        ease: "power3.inOut",
        overwrite: true,
        onComplete: () => {
          if (portrait) {
            setPortraitPanelHeight(targetHeight);
            setPortraitPanelWidth(targetWidth);
          }
          else {
            setLandscapePanelHeight(targetHeight);
            setLandscapePanelWidth(targetWidth);
          }
        },
      });
    };

    const frame = window.requestAnimationFrame(fitToContent);
    const observed = content.firstElementChild ?? content;
    const observer = new ResizeObserver(fitToContent);
    observer.observe(observed);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      gsap.killTweensOf(panel);
    };
  }, [collapsed, panelHidden, panelKey, panelTab, portrait]);

  useEffect(() => {
    const dismiss = () => {
      setRenderOpen(false);
      setAuxOpen(null);
    };
    window.addEventListener("werkzeug-dismiss-popovers", dismiss);
    return () => window.removeEventListener("werkzeug-dismiss-popovers", dismiss);
  }, []);

  const selectedWall = walls.find((item) => item.id === selectedWallId) ?? null;
  const selectedDoor = doors.find((item) => item.id === selectedDoorId) ?? null;
  const selectedWindow = windows.find((item) => item.id === selectedWindowId) ?? null;
  const selectedSlab = slabs.find((item) => item.id === selectedSlabId) ?? null;
  const selectedColumn = columns.find((item) => selectedElements.some((ref) => ref.kind === "column" && ref.id === item.id)) ?? null;
  const selectedBeam = beams.find((item) => selectedElements.some((ref) => ref.kind === "beam" && ref.id === item.id)) ?? null;
  const selectedRef: SelectedElementRef | null = selectedWall
    ? { kind: "wall", id: selectedWall.id }
    : selectedDoor ? { kind: "door", id: selectedDoor.id }
      : selectedWindow ? { kind: "window", id: selectedWindow.id }
        : selectedSlab ? { kind: "slab", id: selectedSlab.id }
          : selectedColumn ? { kind: "column", id: selectedColumn.id }
            : selectedBeam ? { kind: "beam", id: selectedBeam.id } : null;
  const locked = Boolean(selectedRef && lockedKeys.includes(`${selectedRef.kind}:${selectedRef.id}`));

  useEffect(() => useLayoutDrawingStore.subscribe((state, previous) => {
    const reveal = (key: PanelKey) => {
      const isPortrait = window.innerHeight > window.innerWidth;
      setPanelKey(key);
      setPanelTab("properties");
      setPanelHidden(false);
      if (!isPortrait) setPanelFrame(compactWallFrame);
    };
    if (state.selectedWallId !== previous.selectedWallId && state.selectedWallId) {
      reveal("wall");
    }
    else if (state.selectedDoorId !== previous.selectedDoorId && state.selectedDoorId) reveal("door");
    else if (state.selectedWindowId !== previous.selectedWindowId && state.selectedWindowId) reveal("window");
    else if (state.selectedSlabId !== previous.selectedSlabId && state.selectedSlabId) {
      const slab = state.slabs.find((item) => item.id === state.selectedSlabId);
      if (slab) reveal(slab.kind);
    }
    else if (state.selectedElements !== previous.selectedElements) {
      const structural = state.selectedElements.find((item) => item.kind === "column" || item.kind === "beam");
      if (structural) {
        reveal(structural.kind === "column" ? "column" : "beam");
      }
    }
  }), []);

  const frame = panelFrame;
  const updateFrame = (patch: Partial<Frame>) => {
    if (!panelKey) return;
    setPanelFrame((current) => ({ ...current, ...patch }));
  };
  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panelKey || (event.target as HTMLElement).closest("button,input")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = { x: event.clientX, y: event.clientY, frame };
    let latest = { x: event.clientX, y: event.clientY };
    const move = (next: PointerEvent) => {
      latest = { x: next.clientX, y: next.clientY };
      updateFrame({
        x: Math.max(8, Math.min(window.innerWidth - 100, start.frame.x + next.clientX - start.x)),
        y: Math.max(8, Math.min(window.innerHeight - 52, start.frame.y + next.clientY - start.y)),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      if (latest.x < 18 || latest.x > window.innerWidth - 18) setPanelHidden(true);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const beginLandscapeResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizingRef.current = true;
    gsap.killTweensOf(panelRef.current);
    const startY = event.clientY;
    const startHeight = landscapePanelHeight;
    let latestHeight = startHeight;
    const move = (next: PointerEvent) => {
      latestHeight = rubberBand(
        Math.max(180, startHeight + next.clientY - startY),
        fittedHeightRef.current,
      );
      setLandscapePanelHeight(latestHeight);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      resizingRef.current = false;
      if (latestHeight > fittedHeightRef.current) {
        springValue(latestHeight, fittedHeightRef.current, setLandscapePanelHeight);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const beginLandscapeDrawerGesture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizingRef.current = true;
    gsap.killTweensOf(panelRef.current);
    const startX = event.clientX;
    const startWidth = landscapePanelWidth;
    let latestWidth = startWidth;
    let dragged = false;
    const move = (next: PointerEvent) => {
      const delta = startX - next.clientX;
      if (Math.abs(delta) > 4) dragged = true;
      if (!dragged) return;
      setPanelHidden(false);
      latestWidth = rubberBand(
        Math.max(220, startWidth + delta),
        fittedWidthRef.current,
      );
      setLandscapePanelWidth(latestWidth);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      resizingRef.current = false;
      if (!dragged) setPanelHidden((hidden) => !hidden);
      else if (latestWidth > fittedWidthRef.current) {
        springValue(latestWidth, fittedWidthRef.current, setLandscapePanelWidth);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const beginPortraitDrawerGesture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizingRef.current = true;
    gsap.killTweensOf(panelRef.current);
    const startY = event.clientY;
    const startHeight = portraitPanelHeight;
    let latestHeight = startHeight;
    let dragged = false;
    const move = (next: PointerEvent) => {
      const delta = next.clientY - startY;
      if (Math.abs(delta) > 4) dragged = true;
      if (!dragged) return;
      setPanelHidden(false);
      latestHeight = rubberBand(
        Math.max(180, startHeight - delta),
        fittedHeightRef.current,
      );
      setPortraitPanelHeight(latestHeight);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      resizingRef.current = false;
      if (!dragged) setPanelHidden((hidden) => !hidden);
      else if (latestHeight > fittedHeightRef.current) {
        springValue(latestHeight, fittedHeightRef.current, setPortraitPanelHeight);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const activate = (id: PanelKey) => {
    const store = useLayoutDrawingStore.getState();
    const opening = panelKey !== id || panelHidden;
    if (opening && id === "wall") setPanelFrame(compactWallFrame);
    setPanelKey(opening ? id : null);
    window.dispatchEvent(new CustomEvent("werkzeug-level-highlight", { detail: opening && id === "levels" }));
    setPanelHidden(false);
    setPanelTab("properties");
    store.setArmedLayoutTool(id === "levels" || id === "materials" ? null : id);
    useToolMarkupStore.getState().setArmedTool(null);
  };
  const save = async () => {
    const markup = useToolMarkupStore.getState();
    const key = activeModelLabel || "model";
    const blob = await buildFragBlob({ modelKey: key, modelLabel: activeModelLabel, placements: markup.placements, notes: markup.notes, ifcBytes: getCachedIfcBytes(key) });
    downloadBlob(blob, `${activeModelLabel || "vstudio-model"}.frag`);
  };
  const viewItems: Array<{ label: string; value: MarkupViewPreset }> = [
    { label: "3D", value: "free" }, { label: "2D / Top", value: "top" },
    { label: "North", value: "north" }, { label: "South", value: "south" },
    { label: "East", value: "east" }, { label: "West", value: "west" },
  ];
  const toggleAux = (next: "views" | "scale" | "elements", anchor: HTMLElement) => {
    setRenderOpen(false);
    const rect = anchor.getBoundingClientRect();
    setAuxPosition({
      left: Math.max(8, Math.min(window.innerWidth - 158, rect.left)),
      top: Math.min(window.innerHeight - 230, rect.bottom + 7),
    });
    setAuxOpen((open) => open === next ? null : next);
  };
  const activeRenderMode =
    RENDER_MODES.find((mode) => mode.id === renderMode) ?? RENDER_MODES[0];
  const hasContextSelection = selectedElements.some((ref) =>
    ref.kind === "wall" || ref.kind === "door" || ref.kind === "window" ||
    ref.kind === "slab" || ref.kind === "column" || ref.kind === "beam",
  );
  const modifyTitle = selectedWallId ? "Modify | Walls"
    : selectedDoorId ? "Modify | Doors"
      : selectedWindowId ? "Modify | Windows"
        : selectedSlab ? `Modify | ${selectedSlab.kind === "roof" ? "Roofs" : "Floors"}`
          : selectedColumn ? "Modify | Columns"
            : selectedBeam ? "Modify | Beams" : "Modify";
  const activateTransform = (mode: "translate" | "rotate") => {
    useLayoutDrawingStore.getState().setArmedLayoutTool(null);
    useToolMarkupStore.getState().setTransformMode(mode);
  };
  const mirrorSelection = () => {
    const store = useLayoutDrawingStore.getState();
    const wall = store.walls.find((item) => item.id === store.selectedWallId);
    if (wall) {
      void store.mirrorSelected(
        { xMm: wall.startXmm, yMm: wall.startYmm },
        { xMm: wall.endXmm, yMm: wall.endYmm },
      );
      return;
    }
    const column = store.columns.find((item) => store.selectedElements.some((ref) => ref.kind === "column" && ref.id === item.id));
    const slab = store.slabs.find((item) => item.id === store.selectedSlabId);
    const centerX = column?.xMm ?? (slab ? (slab.minXmm + slab.maxXmm) / 2 : 0);
    void store.mirrorSelected(
      { xMm: centerX, yMm: -1_000_000 },
      { xMm: centerX, yMm: 1_000_000 },
    );
  };
  const copySelection = () => {
    const markup = useToolMarkupStore.getState();
    if (markup.selectedPlacementId) void markup.duplicatePlacement(markup.selectedPlacementId);
    else void useLayoutDrawingStore.getState().copySelected(100, 100);
  };
  return (
    <>
      <div data-dock={dockEdge} className="werkzeug-ipad-ribbons pointer-events-auto fixed z-[70]">
        <input ref={fileRef} type="file" accept=".ifc,.frag,.IFC,.FRAG" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) onFile(file); }} />
        <input ref={attachRef} type="file" accept=".dwg,.dxf,.pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) onAttachDwgPdf?.(file); }} />
        <div className="werkzeug-ipad-tool-ribbon">
          {TOOL_ITEMS.map((item) => {
            const active = (!panelHidden && panelKey === item.id) || armed === item.id;
            return <div key={item.id} className="contents"><button type="button" onClick={() => activate(item.id)} onDoubleClick={() => { setPanelKey(item.id); setPanelHidden(false); }} className={`werkzeug-tool-button ${active ? "is-active btn-v-yellow" : ""}`} aria-pressed={active} title={item.label}><span>{item.icon}</span><span className="werkzeug-tool-label">{item.label}</span></button>{item.id === "levels" && <>
              <div className="relative shrink-0"><button type="button" onClick={(event) => toggleAux("views", event.currentTarget)} className={`werkzeug-tool-button ${auxOpen === "views" ? "is-active btn-v-yellow" : ""}`}><LuEye /><span className="werkzeug-tool-label">Views</span><LuChevronDown /></button></div>
              <div className="relative shrink-0"><button type="button" onClick={(event) => toggleAux("scale", event.currentTarget)} className={`werkzeug-tool-button ${auxOpen === "scale" ? "is-active btn-v-yellow" : ""}`}><LuScale /><span className="werkzeug-tool-label">{drawingScale}</span><LuChevronDown /></button></div>
              <button type="button" onClick={() => attachRef.current?.click()} className="werkzeug-tool-button"><LuPaperclip /><span className="werkzeug-tool-label">Attach</span></button>
              <div className="relative shrink-0"><button type="button" onClick={(event) => toggleAux("elements", event.currentTarget)} className={`werkzeug-tool-button ${armed === "column" || armed === "beam" ? "is-active btn-v-yellow" : ""}`}><LuBox /><span className="werkzeug-tool-label">Elements</span><LuChevronDown /></button></div>
            </>}</div>;
          })}
        </div>
        {hasContextSelection && <div className="werkzeug-ipad-modify-ribbon" aria-label={modifyTitle}>
          <span className="werkzeug-ipad-modify-title">{modifyTitle}</span>
          <ModifyButton label="Move" icon={<LuMove />} onClick={() => activateTransform("translate")} />
          <ModifyButton label="Rotate" icon={<LuRotate3D />} onClick={() => activateTransform("rotate")} />
          <ModifyButton label={`Align ${alignAxis.toUpperCase()}`} icon={<LuAlignCenterHorizontal />} onClick={() => {
            void useLayoutDrawingStore.getState().alignSelected(alignAxis);
            setAlignAxis((axis) => axis === "x" ? "y" : "x");
          }} />
          <ModifyButton label="Mirror" icon={<LuFlipHorizontal2 />} onClick={mirrorSelection} />
          <ModifyButton label="Copy" icon={<LuCopy />} onClick={copySelection} />
          <ModifyButton label="Trim" icon={<LuScissors />} active={armed === "trim"} onClick={() => useLayoutDrawingStore.getState().setArmedLayoutTool(armed === "trim" ? null : "trim")} />
          <ModifyButton label="Delete" icon={<LuTrash2 />} danger onClick={() => void useLayoutDrawingStore.getState().deleteSelected()} />
        </div>}
        <div className="werkzeug-ipad-snap-ribbon"><ObjectSnapStrip compact showCount={false} /></div>
        <div className="werkzeug-ipad-action-ribbon">
        <div className="relative shrink-0">
          <button type="button" onClick={() => { setAuxOpen(null); setRenderOpen((open) => !open); }} aria-expanded={renderOpen} aria-haspopup="menu" className={`btn-yellow-border-hover flex h-11 items-center gap-1.5 rounded-xl border px-2.5 text-[10px] font-semibold ${renderOpen ? "btn-v-yellow" : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-body)]"}`}><span className="text-base">{activeRenderMode.icon}</span><span>{activeRenderMode.label}</span><LuChevronDown /></button>
          {renderOpen && <div role="menu" className="absolute right-0 top-[calc(100%+.4rem)] z-[125] grid w-52 grid-cols-2 gap-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-1.5 shadow-xl backdrop-blur-xl">{RENDER_MODES.map((mode) => <button key={mode.id} type="button" role="menuitemradio" aria-checked={renderMode === mode.id} onClick={() => { useAppStore.getState().setRenderMode(mode.id); setRenderOpen(false); }} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[9px] font-semibold transition-all ${renderMode === mode.id ? "btn-v-yellow border-transparent" : "btn-yellow-border-hover border-[var(--panel-divider)] text-[var(--text-muted)]"}`}><span className="text-base">{mode.icon}</span><span>{mode.label}</span></button>)}</div>}
        </div>
        <div className="relative flex shrink-0 items-center gap-1">
          <button type="button" disabled={isLoadingModel} onClick={() => fileRef.current?.click()} className="btn-yellow-border-hover werkzeug-icon-action" title="Open IFC or FRAG"><LuFolderOpen /><span>Open</span></button>
          <button type="button" onClick={() => void save()} className="btn-yellow-border-hover werkzeug-icon-action" title="Save FRAG"><LuSave /><span>Save</span></button>
          <button type="button" onClick={() => void undoWerkzeug()} className="btn-yellow-border-hover werkzeug-icon-action" title="Undo"><LuUndo2 /><span>Undo</span></button>
          <button type="button" onClick={() => void redoWerkzeug()} className="btn-yellow-border-hover werkzeug-icon-action" title="Redo"><LuRedo2 /><span>Redo</span></button>
          <button type="button" onClick={() => useAppStore.getState().setColorTheme(colorTheme === "dark" ? "light" : "dark")} className="werkzeug-theme-knob" title="Change theme">{colorTheme === "dark" ? <LuMoon /> : <LuSun />}</button>
        </div>
        </div>
      </div>

      {auxOpen && <div data-popup-surface className="werkzeug-ipad-popup werkzeug-ipad-popup-fixed" style={auxPosition}>{auxOpen === "views" ? viewItems.map((view) => <button key={view.value} className={viewPreset === view.value ? "is-active" : ""} onClick={() => { useToolMarkupStore.getState().setViewPreset(view.value); setAuxOpen(null); }}>{view.label}</button>) : auxOpen === "scale" ? (["1:20", "1:50", "1:100", "1:200", "1:500"] as const).map((scale) => <button key={scale} className={drawingScale === scale ? "is-active" : ""} onClick={() => { setDrawingScale(scale); setAuxOpen(null); }}>{scale}</button>) : (["column", "beam"] as const).map((kind) => <button key={kind} className={armed === kind ? "is-active" : ""} onClick={() => { activate(kind); setAuxOpen(null); }}><strong>{kind === "column" ? "▮" : "▬"}</strong><span className="capitalize">{kind}</span></button>)}</div>}

      {!panelKey && <button type="button" onClick={() => { setPanelKey("levels"); setPanelHidden(false); }} className={`werkzeug-ipad-panel-peek ${portrait ? "is-portrait" : "is-landscape"}`} aria-label="Show properties and layout options">{portrait ? <><LuSlidersHorizontal /><span>Properties</span><i aria-hidden="true" /><span>Layout</span></> : <LuChevronLeft />}</button>}
      {panelKey && <div ref={panelRef} data-orientation={portrait ? "portrait" : "landscape"} data-hidden={panelHidden ? "true" : "false"} className="werkzeug-ipad-context pointer-events-auto fixed z-[68]" style={portrait ? { right: 8, bottom: 8, width: portraitPanelWidth, maxWidth: "calc(100vw - 16px)", height: collapsed ? 48 : portraitPanelHeight } : { right: 0, top: "50%", width: landscapePanelWidth, height: collapsed ? 48 : landscapePanelHeight }}>
        <button type="button" onPointerDown={portrait ? beginPortraitDrawerGesture : beginLandscapeDrawerGesture} className="werkzeug-ipad-drawer-toggle" title={`${panelHidden ? "Show" : "Hide"} Properties / Layout`} aria-label={`${panelHidden ? "Show" : "Hide"} Properties and Layout drawer`}>{portrait ? <span className="werkzeug-ipad-portrait-grip" /> : <span className="werkzeug-ipad-landscape-grip" />}</button>
        <GlassPanel variant="panel" zIndex={68} fill preferCss wrapperClassName="werkzeug-ipad-context-surface h-full overflow-hidden rounded-xl">
          <div className="werkzeug-ipad-drawer-body flex h-full min-h-0 flex-col">
            <div onPointerDown={portrait ? beginDrag : undefined} className={`flex h-10 shrink-0 touch-none items-center justify-between border-b border-[var(--panel-divider)] px-2.5 ${portrait ? "cursor-move" : ""}`}>
              <span className="text-[11px] font-semibold capitalize text-[var(--text-strong)]">{TOOL_ITEMS.find((item) => item.id === panelKey)?.label ?? panelKey} options</span>
              <div className="flex items-center gap-1">
                {selectedRef && <button type="button" onClick={() => useLayoutDrawingStore.getState().toggleElementLock(selectedRef)} className="btn-yellow-border-hover flex h-9 w-9 items-center justify-center rounded-lg border border-transparent" title={locked ? "Unlock" : "Lock"}>{locked ? <LuLock /> : <LuLockOpen />}</button>}
              </div>
            </div>
            {!collapsed && <div ref={contentRef} className="werkzeug-ipad-panel-content min-h-0 flex-1 overflow-y-auto p-2 thin-scroll">{panelKey === "levels" || panelTab === "layout" ? <LevelsPanel /> : panelKey === "materials" || panelTab === "materials" ? <MaterialEditorPanel isOpen embedded onClose={() => panelKey === "materials" ? setPanelHidden(true) : setPanelTab("properties")} /> : <ToolContent panelKey={panelKey} locked={locked} tab={panelTab} />}</div>}
            {!collapsed && <>
              {!portrait && <button type="button" onPointerDown={beginLandscapeResize} className="werkzeug-ipad-height-resize absolute inset-x-0 bottom-0 z-20 h-5 touch-none cursor-ns-resize" aria-label="Drag down to increase options height"><span /></button>}
            </>}
          </div>
        </GlassPanel>
      </div>}
    </>
  );
}

function rubberBand(value: number, naturalLimit: number) {
  if (value <= naturalLimit) return value;
  const excess = value - naturalLimit;
  const resistance = 72;
  return naturalLimit + (excess * resistance) / (excess + resistance);
}

function springValue(
  from: number,
  to: number,
  update: (value: number) => void,
) {
  const proxy = { value: from };
  gsap.to(proxy, {
    value: to,
    duration: 0.72,
    ease: "elastic.out(1, 0.42)",
    overwrite: true,
    onUpdate: () => update(proxy.value),
    onComplete: () => update(to),
  });
}

function ModifyButton({
  label,
  icon,
  active = false,
  danger = false,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return <button type="button" className={`werkzeug-modify-button ${active ? "is-active btn-v-yellow" : ""} ${danger ? "is-danger" : ""}`} onClick={onClick} title={label}><span>{icon}</span><span>{label}</span></button>;
}

function LevelsPanel() {
  const viewItems: Array<{ label: string; value: MarkupViewPreset }> = [{ label: "3D", value: "free" }, { label: "Top", value: "top" }, { label: "N", value: "north" }, { label: "S", value: "south" }, { label: "O", value: "east" }, { label: "W", value: "west" }];
  const preset = useToolMarkupStore((s) => s.viewPreset);
  return <div className="space-y-1.5"><div className="grid grid-cols-6 gap-1 rounded-lg border border-[var(--panel-divider)] bg-transparent p-1">{viewItems.map((view) => <button key={view.value} onClick={() => useToolMarkupStore.getState().setViewPreset(view.value)} className={`min-h-8 rounded-md text-[10px] font-semibold ${preset === view.value ? "btn-v-yellow" : "btn-yellow-border-hover"}`}>{view.label}</button>)}</div><ToolFloorsSection className="werkzeug-ipad-levels" /></div>;
}

function ToolContent({ panelKey, locked, tab }: { panelKey: LayoutToolId; locked: boolean; tab: "properties" | "type" | "materials" }) {
  const store = useLayoutDrawingStore();
  const markup = useToolMarkupStore();
  const slab = store.slabs.find((item) => item.id === store.selectedSlabId && item.kind === panelKey);
  const field = "h-8 w-full rounded-md border border-[var(--panel-divider)] bg-transparent px-2 text-[11px] text-[var(--text-strong)] disabled:opacity-50";
  if (tab === "type") return <TypeOptions panelKey={panelKey} locked={locked} />;
  if (panelKey === "column" || panelKey === "beam") return <LayoutPropertiesPanel />;
  if ((panelKey === "floor" || panelKey === "roof") && store.sketchTargetKind === panelKey && !slab) {
    const loops = detectLoopsFromSegments(store.sketchLines);
    const openingCount = [...loops.nestedHoles.values()].reduce((sum, holes) => sum + holes.length, 0);
    return <div className="space-y-3"><div className="rounded-xl bg-blue-500/10 p-3 text-[11px] text-blue-600"><strong className="block uppercase tracking-wide">{panelKey} boundary sketch</strong><span>Draw one closed blue outer loop. Closed loops inside it become openings.</span></div><div className="grid grid-cols-2 gap-2"><div className="rounded-lg border border-[var(--panel-divider)] p-2"><span className="block text-[9px] text-[var(--text-muted)]">Closed loops</span><strong>{loops.closedLoops.length}</strong></div><div className="rounded-lg border border-[var(--panel-divider)] p-2"><span className="block text-[9px] text-[var(--text-muted)]">Openings</span><strong>{openingCount}</strong></div></div><label className="block text-[10px] font-semibold text-[var(--text-muted)]">Thickness (mm)<input className={field} type="number" min={50} value={store.draftSlabThicknessMm} onChange={(e) => store.setDraftSlabThicknessMm(Number(e.target.value))}/></label><div className="grid grid-cols-2 gap-2"><button type="button" disabled={!loops.isFullyClosed} className="btn-v-yellow col-span-2 min-h-11 rounded-xl px-3 text-xs disabled:opacity-40" onClick={() => void store.convertSketchToSlab(panelKey)}>Finish {panelKey}</button><button type="button" className="btn-yellow-border-hover min-h-10 rounded-lg border border-[var(--panel-divider)] px-2 text-[11px]" onClick={store.finishSketchLineDraw}>Finish chain</button><button type="button" className="btn-yellow-border-hover min-h-10 rounded-lg border border-[var(--panel-divider)] px-2 text-[11px]" onClick={store.clearSketchLines}>Clear</button></div></div>;
  }
  if ((panelKey === "floor" || panelKey === "roof") && slab) {
    const boundary = slab.boundary?.length ? slab.boundary : [{ xMm: slab.minXmm, yMm: slab.minYmm }, { xMm: slab.maxXmm, yMm: slab.minYmm }, { xMm: slab.maxXmm, yMm: slab.maxYmm }, { xMm: slab.minXmm, yMm: slab.maxYmm }];
    return <div className="space-y-3"><label className="block text-[10px] font-semibold text-[var(--text-muted)]">Thickness (mm)<input disabled={locked} type="number" value={slab.thicknessMm} onChange={(e) => void store.updateSlab(slab.id, { thicknessMm: Number(e.target.value) })} className={field}/></label><div className="grid grid-cols-2 gap-2"><button disabled={locked} type="button" onClick={() => store.beginSlabBoundaryEdit(slab.id)} className="btn-v-yellow min-h-11 rounded-xl px-3 text-xs">Edit vertices</button><button disabled={locked} type="button" onClick={() => store.beginSlabRedraw(slab.id)} className="btn-yellow-border-hover min-h-11 rounded-xl border border-[var(--panel-divider)] px-3 text-xs">Redraw boundary</button>{store.slabBoundaryEdit?.slabId === slab.id && <><button type="button" onClick={() => void store.commitSlabBoundaryEdit()} className="btn-v-yellow min-h-11 rounded-xl px-3 text-xs">Commit</button><button type="button" onClick={store.cancelSlabBoundaryEdit} className="btn-yellow-border-hover min-h-11 rounded-xl border border-[var(--panel-divider)] px-3 text-xs">Cancel</button></>}</div>{store.slabBoundaryEdit?.slabId === slab.id && <div className="space-y-2"><p className="text-[10px] text-[var(--text-muted)]">Boundary vertices · Escape restores the original polygon</p>{boundary.map((point, index) => <div key={index} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-2"><span className="text-[10px] text-[var(--text-muted)]">{index + 1}</span><input aria-label={`Vertex ${index + 1} X`} type="number" value={point.xMm} className={field} onChange={(e) => store.updateSlabBoundaryVertex(index, { ...point, xMm: Number(e.target.value) })}/><input aria-label={`Vertex ${index + 1} Y`} type="number" value={point.yMm} className={field} onChange={(e) => store.updateSlabBoundaryVertex(index, { ...point, yMm: Number(e.target.value) })}/></div>)}</div>}</div>;
  }
  if (panelKey === "lines") {
    const selectedLine = store.sketchLines.find((line) => line.id === store.selectedSketchLineId);
    const lineLength = selectedLine ? Math.hypot(selectedLine.endXmm - selectedLine.startXmm, selectedLine.endYmm - selectedLine.startYmm) : store.sketchDraw?.lengthMm;
    const lineAngle = selectedLine ? Math.atan2(selectedLine.endYmm - selectedLine.startYmm, selectedLine.endXmm - selectedLine.startXmm) * 180 / Math.PI : store.sketchDraw?.angleDeg;
    const totalLength = store.sketchLines.reduce((sum, line) => sum + Math.hypot(line.endXmm - line.startXmm, line.endYmm - line.startYmm), 0);
    return <div className="space-y-3"><div className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 p-2"><p className="text-[10px] font-bold uppercase tracking-wide text-yellow-500">{selectedLine ? "Selected sketch line" : store.sketchDraw ? "Drawing sketch line" : "Sketch line properties"}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{store.sketchDraw ? "Click to place the next point. Double-click or Finish to end the chain." : "Draw connected segments, then create a floor or roof from the boundary."}</p></div><div className="grid grid-cols-2 gap-2">{lineLength != null && <div className="rounded-lg border border-[var(--panel-divider)] p-2"><span className="block text-[9px] text-[var(--text-muted)]">Current length</span><strong className="font-mono text-xs text-[var(--text-strong)]">{Math.round(lineLength)} mm</strong></div>}{lineAngle != null && <div className="rounded-lg border border-[var(--panel-divider)] p-2"><span className="block text-[9px] text-[var(--text-muted)]">Angle</span><strong className="font-mono text-xs text-[var(--text-strong)]">{Math.round(lineAngle)}°</strong></div>}<div className="rounded-lg border border-[var(--panel-divider)] p-2"><span className="block text-[9px] text-[var(--text-muted)]">Segments</span><strong className="font-mono text-xs text-[var(--text-strong)]">{store.sketchLines.length}</strong></div><div className="rounded-lg border border-[var(--panel-divider)] p-2"><span className="block text-[9px] text-[var(--text-muted)]">Total length</span><strong className="font-mono text-xs text-[var(--text-strong)]">{Math.round(totalLength)} mm</strong></div></div>{selectedLine && <div className="grid grid-cols-2 gap-2">{[["Start X", selectedLine.startXmm], ["Start Y", selectedLine.startYmm], ["End X", selectedLine.endXmm], ["End Y", selectedLine.endYmm]].map(([label, value]) => <div key={label} className="rounded-lg border border-[var(--panel-divider)] p-2"><span className="block text-[9px] text-[var(--text-muted)]">{label}</span><span className="font-mono text-[11px] text-[var(--text-strong)]">{value} mm</span></div>)}</div>}<div className="grid grid-cols-2 gap-2"><button type="button" className="btn-v-yellow min-h-10 rounded-lg px-2 text-[11px]" onClick={() => void store.convertSketchToSlab("floor")}>Create floor</button><button type="button" className="btn-v-yellow min-h-10 rounded-lg px-2 text-[11px]" onClick={() => void store.convertSketchToSlab("roof")}>Create roof</button>{store.sketchDraw && <button type="button" className="btn-yellow-border-hover min-h-10 rounded-lg border border-[var(--panel-divider)] px-2 text-[11px]" onClick={store.finishSketchLineDraw}>Finish drawing</button>}{selectedLine && <button type="button" className="btn-yellow-border-hover min-h-10 rounded-lg border border-red-500/30 px-2 text-[11px] text-red-500" onClick={() => store.deleteSketchLine(selectedLine.id)}>Delete line</button>}<button type="button" className="btn-yellow-border-hover col-span-2 min-h-10 rounded-lg border border-[var(--panel-divider)] px-2 text-[11px]" onClick={store.clearSketchLines}>Clear drawing</button></div></div>;
  }
  if (panelKey === "wall") {
    const wall = store.walls.find((item) => item.id === store.selectedWallId);
    const baseLevelId = wall?.levelId ?? store.wallDraw?.levelId ?? store.draftWallBaseLevelId ?? markup.markupFloorId ?? store.levels[0]?.id ?? "";
    const base = store.levels.find((level) => level.id === baseLevelId);
    const topLevelId = wall?.topLevelId ?? store.draftWallTopLevelId ?? "";
    const constrainedTop = store.levels.find((level) => level.id === topLevelId);
    const height = wall?.heightMm ?? (constrainedTop && base ? constrainedTop.elevationMm - base.elevationMm : store.draftWallHeightMm);
    const updateBase = (levelId: string) => {
      const nextBase = store.levels.find((level) => level.id === levelId);
      if (wall) {
        const top = store.levels.find((level) => level.id === wall.topLevelId);
        void store.updateWall(wall.id, { levelId, ...(nextBase && top && top.elevationMm > nextBase.elevationMm ? { heightMm: top.elevationMm - nextBase.elevationMm } : {}) });
      } else {
        markup.setMarkupFloorId(levelId);
        store.setDraftWallBaseLevelId(levelId);
        if (store.wallDraw) store.finishWallDraw();
      }
    };
    const updateTop = (levelId: string) => {
      const top = store.levels.find((level) => level.id === levelId);
      if (wall) void store.updateWall(wall.id, { topLevelId: levelId || undefined, ...(base && top ? { heightMm: top.elevationMm - base.elevationMm } : {}) });
      else store.setDraftWallTopLevelId(levelId || null);
    };
    return <div className="space-y-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-yellow-500">{wall ? "Selected wall constraints" : "New wall constraints"}</p><div className="grid grid-cols-2 gap-2"><label className="block text-[9px] font-semibold text-[var(--text-muted)]">Base level<select disabled={locked} className={field} value={baseLevelId} onChange={(e) => updateBase(e.target.value)}>{store.levels.slice().sort((a,b) => a.elevationMm-b.elevationMm).map((level) => <option key={level.id} value={level.id}>{level.name} ({level.elevationMm} mm)</option>)}</select></label><label className="block text-[9px] font-semibold text-[var(--text-muted)]">Top level<select disabled={locked} className={field} value={topLevelId} onChange={(e) => updateTop(e.target.value)}><option value="">Unconnected</option>{store.levels.filter((level) => level.elevationMm > (base?.elevationMm ?? -Infinity)).sort((a,b) => a.elevationMm-b.elevationMm).map((level) => <option key={level.id} value={level.id}>{level.name} ({level.elevationMm} mm)</option>)}</select></label><label className="block text-[9px] font-semibold text-[var(--text-muted)]">Height (mm)<input disabled={locked} type="number" className={field} value={height} onChange={(e) => { const value = Math.max(50, Number(e.target.value)); if (wall) void store.updateWall(wall.id, { heightMm: value, topLevelId: undefined }); else { store.setDraftWallHeightMm(value); store.setDraftWallTopLevelId(null); } }}/></label><label className="block text-[9px] font-semibold text-[var(--text-muted)]">Thickness (mm)<input disabled={locked} type="number" className={field} value={wall?.thicknessMm ?? store.draftWallThicknessMm} onChange={(e) => wall ? void store.updateWall(wall.id, { thicknessMm: Number(e.target.value) }) : store.setDraftWallThicknessMm(Number(e.target.value))}/></label></div>{wall && <div className="grid grid-cols-2 gap-2">{(["startXmm", "startYmm", "endXmm", "endYmm"] as const).map((key) => <label key={key} className="block text-[9px] font-semibold text-[var(--text-muted)]">{{ startXmm: "Start X", startYmm: "Start Y", endXmm: "End X", endYmm: "End Y" }[key]} (mm)<input disabled={locked} type="number" className={field} value={wall[key]} onChange={(e) => void store.updateWall(wall.id, { [key]: Number(e.target.value) })}/></label>)}</div>}</div>;
  }
  if (panelKey === "door" && store.selectedDoorId) { const door = store.doors.find((item) => item.id === store.selectedDoorId); if (door) return <div className="space-y-3">{(["widthMm", "heightMm"] as const).map((key) => <label key={key} className="block text-[10px] font-semibold text-[var(--text-muted)]">{key === "widthMm" ? "Width" : "Height"} (mm)<input disabled={locked} type="number" className={field} value={door[key]} onChange={(e) => void store.updateDoor(door.id, { [key]: Number(e.target.value) })}/></label>)}</div>; }
  if (panelKey === "window" && store.selectedWindowId) { const windowItem = store.windows.find((item) => item.id === store.selectedWindowId); if (windowItem) return <div className="space-y-3">{(["widthMm", "heightMm", "sillHeightMm"] as const).map((key) => <label key={key} className="block text-[10px] font-semibold text-[var(--text-muted)]">{key === "widthMm" ? "Width" : key === "heightMm" ? "Height" : "Sill height"} (mm)<input disabled={locked} type="number" className={field} value={windowItem[key]} onChange={(e) => void store.updateWindow(windowItem.id, { [key]: Number(e.target.value) })}/></label>)}</div>; }
  return <div className="rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-3 text-xs text-[var(--text-muted)]">{locked ? "Element locked. Properties remain visible, editing is disabled." : `Select a ${panelKey} in the 3D view to edit its properties.`}</div>;
}

function TypeOptions({ panelKey, locked }: { panelKey: LayoutToolId; locked: boolean }) {
  const layout = useLayoutDrawingStore();
  const compactButton = "btn-yellow-border-hover min-h-10 rounded-lg border border-[var(--panel-divider)] px-2 text-[11px] font-semibold";
  if (panelKey === "lines") {
    const selected = layout.sketchLines.find((line) => line.id === layout.selectedSketchLineId);
    const style = selected ?? layout.draftSketchLineStyle;
    const update = (changes: Partial<typeof layout.draftSketchLineStyle>) => selected
      ? layout.updateSketchLine(selected.id, changes)
      : layout.setDraftSketchLineStyle(changes);
    const field = "h-9 w-full rounded-lg border border-[var(--panel-divider)] bg-transparent px-2 text-[11px] text-[var(--text-strong)]";
    return <div className="space-y-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{selected ? "Selected line style" : "New line style"}</p><div className="grid grid-cols-2 gap-2"><label className="text-[9px] font-semibold text-[var(--text-muted)]">Pattern<select className={field} value={style.pattern ?? "solid"} onChange={(event) => update({ pattern: event.target.value as "solid" | "dashed" | "dotted" | "dash-dot" })}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="dash-dot">Dash dot</option></select></label><label className="text-[9px] font-semibold text-[var(--text-muted)]">Thickness (px)<input className={field} type="number" min={0.5} max={12} step={0.5} value={style.thicknessPx ?? 1} onChange={(event) => update({ thicknessPx: Number(event.target.value) })}/></label><label className="text-[9px] font-semibold text-[var(--text-muted)]">Dash (mm)<input className={field} type="number" min={10} value={style.dashSizeMm ?? 250} onChange={(event) => update({ dashSizeMm: Number(event.target.value) })}/></label><label className="text-[9px] font-semibold text-[var(--text-muted)]">Gap (mm)<input className={field} type="number" min={10} value={style.gapSizeMm ?? 140} onChange={(event) => update({ gapSizeMm: Number(event.target.value) })}/></label><label className="col-span-2 text-[9px] font-semibold text-[var(--text-muted)]">Color<input className="mt-1 h-10 w-full rounded-lg border border-[var(--panel-divider)] bg-transparent p-1" type="color" value={style.color ?? "#374151"} onChange={(event) => update({ color: event.target.value })}/></label></div><p className="text-[10px] text-[var(--text-muted)]">Geometry and drawing actions remain in Properties.</p></div>;
  }
  const presets: Array<{ name: string; thickness?: number; width?: number; height?: number }> = panelKey === "door"
      ? [{ name: "Single 800", width: 800, height: 2100 }, { name: "Single 900", width: 900, height: 2100 }, { name: "Double 1800", width: 1800, height: 2100 }]
      : panelKey === "window"
        ? [{ name: "Single 900", width: 900, height: 1200 }, { name: "Double 1200", width: 1200, height: 1400 }, { name: "Wide 1800", width: 1800, height: 1400 }]
        : [{ name: panelKey === "roof" ? "Insulated roof 300" : "Generic floor 200", thickness: panelKey === "roof" ? 300 : 200 }];
  const apply = (preset: typeof presets[number]) => {
    if (locked) return;
    if (panelKey === "door" && layout.selectedDoorId && preset.width && preset.height) void layout.updateDoor(layout.selectedDoorId, { widthMm: preset.width, heightMm: preset.height });
    if (panelKey === "window" && layout.selectedWindowId && preset.width && preset.height) void layout.updateWindow(layout.selectedWindowId, { widthMm: preset.width, heightMm: preset.height });
    if ((panelKey === "floor" || panelKey === "roof") && layout.selectedSlabId && preset.thickness) void layout.updateSlab(layout.selectedSlabId, { thicknessMm: preset.thickness });
  };
  return <div className="space-y-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Type presets</p>{presets.map((preset) => <button disabled={locked} key={preset.name} onClick={() => apply(preset)} className={`${compactButton} flex w-full items-center justify-between bg-transparent text-left`}><span>{preset.name}</span><span className="text-[10px] text-[var(--text-muted)]">Apply</span></button>)}</div>;
}
