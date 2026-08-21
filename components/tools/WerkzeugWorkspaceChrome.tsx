"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  LuChevronDown, LuChevronLeft, LuChevronRight, LuDoorOpen, LuEye, LuFolderOpen, LuLayers3,
  LuLock, LuLockOpen, LuMoon, LuPalette, LuRedo2, LuSave, LuSun, LuUndo2, LuX,
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
import type { MarkupViewPreset } from "@/lib/toolMarkup";
import ToolFloorsSection from "./ToolFloorsSection";
import MaterialEditorPanel from "./MaterialEditorPanel";
import ObjectSnapStrip from "./ObjectSnapStrip";

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

export default function WerkzeugWorkspaceChrome({
  onFile,
  isLoadingModel,
}: {
  onFile: (file: File) => void;
  isLoadingModel: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [panelKey, setPanelKey] = useState<PanelKey | null>(null);
  const [collapsed] = useState(false);
  const [panelFrame, setPanelFrame] = useState<Frame>(defaultFrame);
  const [renderOpen, setRenderOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [dockEdge] = useState<DockEdge>("top");
  const [panelHidden, setPanelHidden] = useState(false);
  const [panelTab, setPanelTab] = useState<"properties" | "type" | "materials">("properties");
  const armed = useLayoutDrawingStore((s) => s.armedLayoutTool);
  const walls = useLayoutDrawingStore((s) => s.walls);
  const doors = useLayoutDrawingStore((s) => s.doors);
  const windows = useLayoutDrawingStore((s) => s.windows);
  const slabs = useLayoutDrawingStore((s) => s.slabs);
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const lockedKeys = useLayoutDrawingStore((s) => s.lockedElementKeys);
  const renderMode = useAppStore((s) => s.renderMode);
  const colorTheme = useAppStore((s) => s.colorTheme);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const viewPreset = useToolMarkupStore((s) => s.viewPreset);

  useEffect(() => {
    document.documentElement.dataset.werkzeugDock = dockEdge;
    window.dispatchEvent(new CustomEvent("werkzeug-ipad-toolbar-dock", { detail: dockEdge }));
    return () => { delete document.documentElement.dataset.werkzeugDock; };
  }, [dockEdge]);

  const selectedWall = walls.find((item) => item.id === selectedWallId) ?? null;
  const selectedDoor = doors.find((item) => item.id === selectedDoorId) ?? null;
  const selectedWindow = windows.find((item) => item.id === selectedWindowId) ?? null;
  const selectedSlab = slabs.find((item) => item.id === selectedSlabId) ?? null;
  const selectedRef: SelectedElementRef | null = selectedWall
    ? { kind: "wall", id: selectedWall.id }
    : selectedDoor ? { kind: "door", id: selectedDoor.id }
      : selectedWindow ? { kind: "window", id: selectedWindow.id }
        : selectedSlab ? { kind: "slab", id: selectedSlab.id } : null;
  const locked = Boolean(selectedRef && lockedKeys.includes(`${selectedRef.kind}:${selectedRef.id}`));

  useEffect(() => useLayoutDrawingStore.subscribe((state, previous) => {
    if (state.selectedWallId !== previous.selectedWallId && state.selectedWallId) {
      setPanelFrame(compactWallFrame);
      setPanelKey("wall");
    }
    else if (state.selectedDoorId !== previous.selectedDoorId && state.selectedDoorId) setPanelKey("door");
    else if (state.selectedWindowId !== previous.selectedWindowId && state.selectedWindowId) setPanelKey("window");
    else if (state.selectedSlabId !== previous.selectedSlabId && state.selectedSlabId) {
      const slab = state.slabs.find((item) => item.id === state.selectedSlabId);
      if (slab) setPanelKey(slab.kind);
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
  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>, direction: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw") => {
    event.preventDefault();
    event.stopPropagation();
    const start = { x: event.clientX, y: event.clientY, frame };
    const move = (next: PointerEvent) => {
      const dx = next.clientX - start.x;
      const dy = next.clientY - start.y;
      const west = direction.includes("w"), east = direction.includes("e");
      const north = direction.includes("n"), south = direction.includes("s");
      let x = start.frame.x, y = start.frame.y, width = start.frame.width, height = start.frame.height;
      if (east) width = start.frame.width + dx;
      if (south) height = start.frame.height + dy;
      if (west) { width = start.frame.width - dx; x = start.frame.x + dx; }
      if (north) { height = start.frame.height - dy; y = start.frame.y + dy; }
      const minWidth = 220, minHeight = 140;
      if (width < minWidth) { if (west) x -= minWidth - width; width = minWidth; }
      if (height < minHeight) { if (north) y -= minHeight - height; height = minHeight; }
      if (x < 8) { if (west) width -= 8 - x; x = 8; }
      if (y < 8) { if (north) height -= 8 - y; y = 8; }
      if (x + width > window.innerWidth - 8) width = window.innerWidth - 8 - x;
      if (y + height > window.innerHeight - 8) height = window.innerHeight - 8 - y;
      updateFrame({ x, y, width, height });
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
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
  return (
    <>
      <div data-dock={dockEdge} className="werkzeug-ipad-ribbons pointer-events-auto fixed z-[70]">
        <input ref={fileRef} type="file" accept=".ifc,.frag,.IFC,.FRAG" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) onFile(file); }} />
        <div className="werkzeug-ipad-tool-ribbon">
          {TOOL_ITEMS.map((item) => {
            const active = panelKey === item.id || armed === item.id;
            return <button key={item.id} type="button" onClick={() => activate(item.id)} onDoubleClick={() => { setPanelKey(item.id); setPanelHidden(false); }} className={`werkzeug-tool-button ${active ? "is-active btn-v-yellow" : ""}`} aria-pressed={active} title={item.label}><span>{item.icon}</span><span className="werkzeug-tool-label">{item.label}</span></button>;
          })}
          <div className="werkzeug-ipad-snap-ribbon"><ObjectSnapStrip compact /></div>
        </div>
        <div className="werkzeug-ipad-action-ribbon">
        <div className="relative shrink-0">
          <button type="button" onClick={() => setRenderOpen((value) => !value)} className="btn-yellow-border-hover flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] px-3 text-[11px] font-semibold text-[var(--text-body)]"><span>{renderMode === "realistic" ? "Real" : renderMode === "light" ? "Light" : "Wireframe"}</span><LuChevronDown /></button>
          {renderOpen && <div className="absolute right-0 top-[calc(100%+.4rem)] w-36 rounded-xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-1 shadow-xl backdrop-blur-xl">{(["realistic", "light", "wireframe"] as const).map((mode) => <button key={mode} type="button" className="btn-yellow-border-hover block min-h-11 w-full rounded-lg border border-transparent px-2 text-left text-xs capitalize text-[var(--text-body)]" onClick={() => { useAppStore.getState().setRenderMode(mode); setRenderOpen(false); }}>{mode === "realistic" ? "Real" : mode}</button>)}</div>}
        </div>
        <div className="relative flex shrink-0 items-center gap-1">
          <button type="button" disabled={isLoadingModel} onClick={() => fileRef.current?.click()} className="btn-yellow-border-hover werkzeug-icon-action" title="Open IFC or FRAG"><LuFolderOpen /><span>Open</span></button>
          <button type="button" onClick={() => void save()} className="btn-yellow-border-hover werkzeug-icon-action" title="Save FRAG"><LuSave /><span>Save</span></button>
          <button type="button" onClick={() => void undoWerkzeug()} className="btn-yellow-border-hover werkzeug-icon-action" title="Undo"><LuUndo2 /><span>Undo</span></button>
          <button type="button" onClick={() => void redoWerkzeug()} className="btn-yellow-border-hover werkzeug-icon-action" title="Redo"><LuRedo2 /><span>Redo</span></button>
          <button type="button" onClick={() => useAppStore.getState().setColorTheme(colorTheme === "dark" ? "light" : "dark")} className="werkzeug-theme-knob" title="Change theme">{colorTheme === "dark" ? <LuMoon /> : <LuSun />}</button>
          <div className="relative"><button type="button" onClick={() => setViewOpen((value) => !value)} className="btn-yellow-border-hover werkzeug-icon-action" title="Views"><LuEye /><span className="font-bold">{viewPreset === "free" ? "3D" : viewPreset === "top" ? "2D" : viewPreset}</span><LuChevronDown /></button>{viewOpen && <div className="werkzeug-ipad-popup right-0">{viewItems.map((item) => <button key={item.value} className={viewPreset === item.value ? "is-active" : ""} onClick={() => { useToolMarkupStore.getState().setViewPreset(item.value); setViewOpen(false); }}>{item.label}</button>)}</div>}</div>
        </div>
        </div>
      </div>

      {panelKey && panelHidden && <button type="button" onClick={() => setPanelHidden(false)} className="werkzeug-ipad-panel-peek" style={{ left: frame.x + frame.width / 2 < window.innerWidth / 2 ? 6 : "auto", right: frame.x + frame.width / 2 >= window.innerWidth / 2 ? 6 : "auto", top: frame.y + frame.height / 2 < window.innerHeight / 2 ? 72 : "auto", bottom: frame.y + frame.height / 2 >= window.innerHeight / 2 ? 12 : "auto" }} aria-label={`Show ${panelKey} options`}>{frame.x < window.innerWidth / 2 ? <LuChevronRight /> : <LuChevronLeft />}</button>}
      {panelKey && !panelHidden && <div className="werkzeug-ipad-context pointer-events-auto fixed z-[68]" style={{ left: frame.x, top: frame.y, width: frame.width, height: collapsed ? 48 : frame.height }}>
        <GlassPanel variant="panel" zIndex={68} fill preferCss wrapperClassName="werkzeug-ipad-context-surface h-full overflow-hidden rounded-xl">
          <div className="flex h-full min-h-0 flex-col">
            <div onPointerDown={beginDrag} className="flex h-10 shrink-0 touch-none cursor-move items-center justify-between border-b border-[var(--panel-divider)] px-2.5">
              <span className="text-[11px] font-semibold capitalize text-[var(--text-strong)]">{panelKey} options</span>
              <div className="flex items-center gap-1">
                {selectedRef && <button type="button" onClick={() => useLayoutDrawingStore.getState().toggleElementLock(selectedRef)} className="btn-yellow-border-hover flex h-9 w-9 items-center justify-center rounded-lg border border-transparent" title={locked ? "Unlock" : "Lock"}>{locked ? <LuLock /> : <LuLockOpen />}</button>}
                <button type="button" onClick={() => setPanelHidden(true)} className="btn-yellow-border-hover flex h-9 w-9 items-center justify-center rounded-lg border border-transparent" title="Hide"><LuChevronRight /></button>
                <button type="button" onClick={() => setPanelKey(null)} className="btn-yellow-border-hover flex h-9 w-9 items-center justify-center rounded-lg border border-transparent" title="Close"><LuX /></button>
              </div>
            </div>
            {!collapsed && panelKey !== "levels" && panelKey !== "materials" && <div className="flex shrink-0 border-b border-[var(--panel-divider)] px-1">{(["properties", "type", "materials"] as const).map((tab) => <button key={tab} onClick={() => setPanelTab(tab)} className={`min-h-7 flex-1 border-b-2 text-[9px] font-semibold capitalize ${panelTab === tab ? "border-yellow-400 text-[var(--text-strong)]" : "border-transparent text-[var(--text-muted)]"}`}>{tab === "type" && panelKey === "lines" ? "Drawing" : tab}</button>)}</div>}
            {!collapsed && <div ref={contentRef} className="werkzeug-ipad-panel-content min-h-0 flex-1 overflow-y-auto p-2 thin-scroll">{panelKey === "levels" ? <LevelsPanel /> : panelKey === "materials" || panelTab === "materials" ? <MaterialEditorPanel isOpen embedded onClose={() => panelKey === "materials" ? setPanelKey(null) : setPanelTab("properties")} /> : <ToolContent panelKey={panelKey} locked={locked} tab={panelTab} />}</div>}
            {!collapsed && <>
              <button type="button" onPointerDown={(e) => beginResize(e, "n")} className="absolute inset-x-5 top-0 h-2 touch-none cursor-ns-resize" aria-label="Resize panel from top" />
              <button type="button" onPointerDown={(e) => beginResize(e, "s")} className="absolute inset-x-5 bottom-0 h-2 touch-none cursor-ns-resize" aria-label="Resize panel from bottom" />
              <button type="button" onPointerDown={(e) => beginResize(e, "w")} className="absolute inset-y-5 left-0 w-2 touch-none cursor-ew-resize" aria-label="Resize panel from left" />
              <button type="button" onPointerDown={(e) => beginResize(e, "e")} className="absolute inset-y-5 right-0 w-2 touch-none cursor-ew-resize" aria-label="Resize panel from right" />
              {(["nw", "ne", "sw", "se"] as const).map((direction) => <button key={direction} type="button" onPointerDown={(e) => beginResize(e, direction)} className={`absolute h-7 w-7 touch-none ${direction === "nw" ? "left-0 top-0 cursor-nwse-resize" : direction === "ne" ? "right-0 top-0 cursor-nesw-resize" : direction === "sw" ? "bottom-0 left-0 cursor-nesw-resize" : "bottom-0 right-0 cursor-nwse-resize"}`} aria-label={`Resize panel ${direction}`} />)}
              <span className="pointer-events-none absolute bottom-1 right-1 h-3 w-3 border-b-2 border-r-2 border-[var(--text-muted)]" />
            </>}
          </div>
        </GlassPanel>
      </div>}
    </>
  );
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
