"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  LuChevronDown, LuChevronLeft, LuChevronRight, LuChevronUp, LuDoorOpen, LuEye, LuFolderOpen, LuLayers3,
  LuLock, LuLockOpen, LuMaximize2, LuMoon, LuPalette, LuRedo2, LuSave, LuSun, LuUndo2, LuX,
} from "react-icons/lu";
import { IconMarkupFloor, IconMarkupRoof, IconMarkupWall, IconMarkupWindow } from "./MarkupIcons";
import GlassPanel from "@/components/common/GlassPanel";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { redoWerkzeug, undoWerkzeug } from "@/lib/werkzeugHistory";
import { buildFragBlob, buildMarkupOnlyIfc, downloadBlob, getCachedIfcBytes, mergeMarkupIntoIfc } from "@/lib/markupFragSave";
import type { LayoutToolId, SelectedElementRef } from "@/lib/layoutDrawing";
import type { MarkupViewPreset } from "@/lib/toolMarkup";
import ToolFloorsSection from "./ToolFloorsSection";
import MaterialEditorPanel from "./MaterialEditorPanel";

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
  if (typeof window === "undefined") return { x: 20, y: 88, width: 340, height: 360 };
  const tablet = window.innerWidth < 1100;
  const width = Math.min(390, window.innerWidth - 24);
  return tablet
    ? { x: Math.max(12, (window.innerWidth - width) / 2), y: Math.max(90, window.innerHeight - 350), width, height: 300 }
    : { x: 20, y: 88, width: 340, height: 380 };
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
  const [collapsed, setCollapsed] = useState(false);
  const [panelFrame, setPanelFrame] = useState<Frame>(defaultFrame);
  const [renderOpen, setRenderOpen] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [dockEdge, setDockEdge] = useState<DockEdge>("top");
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
    if (state.selectedWallId !== previous.selectedWallId && state.selectedWallId) setPanelKey("wall");
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
    setPanelKey(opening ? id : null);
    window.dispatchEvent(new CustomEvent("werkzeug-level-highlight", { detail: opening && id === "levels" }));
    setCollapsed(false);
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
  const saveIfc = () => {
    const markup = useToolMarkupStore.getState();
    const key = activeModelLabel || "model";
    const cached = getCachedIfcBytes(key);
    const blob = cached
      ? mergeMarkupIntoIfc({ baseIfc: cached, placements: markup.placements, notes: markup.notes })
      : buildMarkupOnlyIfc({ modelLabel: activeModelLabel, placements: markup.placements, notes: markup.notes });
    downloadBlob(blob, `${activeModelLabel || "model"}-markup.ifc`);
  };
  const dockToolbar = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button,input")) return;
    const start = { x: event.clientX, y: event.clientY };
    const up = (next: PointerEvent) => {
      window.removeEventListener("pointerup", up);
      const y = next.clientY;
      const distances: Array<[DockEdge, number]> = [["top", y], ["bottom", window.innerHeight - y]];
      if (Math.hypot(next.clientX - start.x, next.clientY - start.y) > 16) setDockEdge(distances.sort((a, b) => a[1] - b[1])[0][0]);
    };
    window.addEventListener("pointerup", up);
  };
  const viewItems: Array<{ label: string; value: MarkupViewPreset }> = [
    { label: "3D", value: "free" }, { label: "2D / Top", value: "top" },
    { label: "North", value: "north" }, { label: "South", value: "south" },
    { label: "East", value: "east" }, { label: "West", value: "west" },
  ];
  const fitContent = () => updateFrame({ height: Math.min(window.innerHeight - frame.y - 12, Math.max(180, (contentRef.current?.scrollHeight ?? 260) + 54)) });

  return (
    <>
      <div data-dock={dockEdge} onPointerDown={dockToolbar} className="werkzeug-ipad-ribbons pointer-events-auto fixed z-[70] touch-none">
        <input ref={fileRef} type="file" accept=".ifc,.frag,.IFC,.FRAG" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) onFile(file); }} />
        <div className="werkzeug-ipad-tool-ribbon">
          {TOOL_ITEMS.map((item) => {
            const active = panelKey === item.id || armed === item.id;
            return <button key={item.id} type="button" onClick={() => activate(item.id)} onDoubleClick={() => { setPanelKey(item.id); setPanelHidden(false); }} className={`werkzeug-tool-button ${active ? "is-active btn-v-yellow" : ""}`} aria-pressed={active} title={item.label}><span>{item.icon}</span><span className="werkzeug-tool-label">{item.label}</span></button>;
          })}
        </div>
        <div className="werkzeug-ipad-action-ribbon">
        <div className="relative shrink-0">
          <button type="button" onClick={() => setRenderOpen((value) => !value)} className="btn-yellow-border-hover flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] px-3 text-[11px] font-semibold text-[var(--text-body)]"><span>{renderMode === "realistic" ? "Real" : renderMode === "light" ? "Light" : "Wireframe"}</span><LuChevronDown /></button>
          {renderOpen && <div className="absolute right-0 top-[calc(100%+.4rem)] w-36 rounded-xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-1 shadow-xl backdrop-blur-xl">{(["realistic", "light", "wireframe"] as const).map((mode) => <button key={mode} type="button" className="btn-yellow-border-hover block min-h-11 w-full rounded-lg border border-transparent px-2 text-left text-xs capitalize text-[var(--text-body)]" onClick={() => { useAppStore.getState().setRenderMode(mode); setRenderOpen(false); }}>{mode === "realistic" ? "Real" : mode}</button>)}</div>}
        </div>
        <div className="relative flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setFileMenuOpen((value) => !value)} className="btn-yellow-border-hover werkzeug-icon-action" title="Open or save"><LuFolderOpen /><span>File</span><LuChevronDown /></button>
          {fileMenuOpen && <div className="werkzeug-ipad-popup"><button disabled={isLoadingModel} onClick={() => { fileRef.current?.click(); setFileMenuOpen(false); }}><LuFolderOpen /> Open IFC / FRAG</button><button onClick={() => { void save(); setFileMenuOpen(false); }}><LuSave /> Save FRAG</button><button onClick={() => { saveIfc(); setFileMenuOpen(false); }}><LuSave /> Save IFC</button></div>}
          <button type="button" onClick={() => void undoWerkzeug()} className="btn-yellow-border-hover werkzeug-icon-action" title="Undo"><LuUndo2 /></button>
          <button type="button" onClick={() => void redoWerkzeug()} className="btn-yellow-border-hover werkzeug-icon-action" title="Redo"><LuRedo2 /></button>
          <button type="button" onClick={() => useAppStore.getState().setColorTheme(colorTheme === "dark" ? "light" : "dark")} className="werkzeug-theme-knob" title="Change theme">{colorTheme === "dark" ? <LuMoon /> : <LuSun />}</button>
          <div className="relative"><button type="button" onClick={() => setViewOpen((value) => !value)} className="btn-yellow-border-hover werkzeug-icon-action" title="Views"><LuEye /><span className="font-bold">{viewPreset === "free" ? "3D" : viewPreset === "top" ? "2D" : viewPreset}</span><LuChevronDown /></button>{viewOpen && <div className="werkzeug-ipad-popup right-0">{viewItems.map((item) => <button key={item.value} className={viewPreset === item.value ? "is-active" : ""} onClick={() => { useToolMarkupStore.getState().setViewPreset(item.value); setViewOpen(false); }}>{item.label}</button>)}</div>}</div>
        </div>
        </div>
      </div>

      {panelKey && panelHidden && <button type="button" onClick={() => setPanelHidden(false)} className="werkzeug-ipad-panel-peek" style={{ left: frame.x + frame.width / 2 < window.innerWidth / 2 ? 6 : "auto", right: frame.x + frame.width / 2 >= window.innerWidth / 2 ? 6 : "auto", top: frame.y + frame.height / 2 < window.innerHeight / 2 ? 72 : "auto", bottom: frame.y + frame.height / 2 >= window.innerHeight / 2 ? 12 : "auto" }} aria-label={`Show ${panelKey} options`}>{frame.x < window.innerWidth / 2 ? <LuChevronRight /> : <LuChevronLeft />}</button>}
      {panelKey && !panelHidden && <div className="werkzeug-ipad-context pointer-events-auto fixed z-[68]" style={{ left: frame.x, top: frame.y, width: frame.width, height: collapsed ? 48 : frame.height }}>
        <GlassPanel variant="panel" zIndex={68} fill wrapperClassName="h-full overflow-hidden rounded-2xl">
          <div className="flex h-full min-h-0 flex-col">
            <div onPointerDown={beginDrag} className="flex h-12 shrink-0 touch-none cursor-move items-center justify-between border-b border-[var(--panel-divider)] px-3">
              <span className="text-xs font-semibold capitalize text-[var(--text-strong)]">{panelKey} options</span>
              <div className="flex items-center gap-1">
                {selectedRef && <button type="button" onClick={() => useLayoutDrawingStore.getState().toggleElementLock(selectedRef)} className="btn-yellow-border-hover flex h-9 w-9 items-center justify-center rounded-lg border border-transparent" title={locked ? "Unlock" : "Lock"}>{locked ? <LuLock /> : <LuLockOpen />}</button>}
                <button type="button" onClick={fitContent} className="btn-yellow-border-hover flex h-9 w-9 items-center justify-center rounded-lg border border-transparent" title="Fit to content"><LuMaximize2 /></button>
                <button type="button" onClick={() => setCollapsed((value) => !value)} className="btn-yellow-border-hover flex h-9 w-9 items-center justify-center rounded-lg border border-transparent" title={collapsed ? "Expand" : "Collapse here"}>{collapsed ? <LuChevronDown /> : <LuChevronUp />}</button>
                <button type="button" onClick={() => setPanelHidden(true)} className="btn-yellow-border-hover flex h-9 w-9 items-center justify-center rounded-lg border border-transparent" title="Hide"><LuChevronRight /></button>
                <button type="button" onClick={() => setPanelKey(null)} className="btn-yellow-border-hover flex h-9 w-9 items-center justify-center rounded-lg border border-transparent" title="Close"><LuX /></button>
              </div>
            </div>
            {!collapsed && panelKey !== "levels" && panelKey !== "materials" && <div className="flex shrink-0 border-b border-[var(--panel-divider)] px-1">{(["properties", "type", "materials"] as const).map((tab) => <button key={tab} onClick={() => setPanelTab(tab)} className={`min-h-8 flex-1 border-b-2 text-[10px] font-semibold capitalize ${panelTab === tab ? "border-yellow-400 text-[var(--text-strong)]" : "border-transparent text-[var(--text-muted)]"}`}>{tab === "type" && panelKey === "lines" ? "Drawing" : tab}</button>)}</div>}
            {!collapsed && <div ref={contentRef} className="werkzeug-ipad-panel-content min-h-0 flex-1 overflow-y-auto p-1.5 thin-scroll">{panelKey === "levels" ? <LevelsPanel /> : panelKey === "materials" || panelTab === "materials" ? <MaterialEditorPanel isOpen embedded onClose={() => panelKey === "materials" ? setPanelKey(null) : setPanelTab("properties")} /> : <ToolContent panelKey={panelKey} locked={locked} tab={panelTab} />}</div>}
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
  const slab = store.slabs.find((item) => item.id === store.selectedSlabId && item.kind === panelKey);
  const field = "h-8 w-full rounded-md border border-[var(--panel-divider)] bg-transparent px-2 text-[11px] text-[var(--text-strong)] disabled:opacity-50";
  if (tab === "type") return <TypeOptions panelKey={panelKey} locked={locked} />;
  if ((panelKey === "floor" || panelKey === "roof") && slab) {
    const boundary = slab.boundary?.length ? slab.boundary : [{ xMm: slab.minXmm, yMm: slab.minYmm }, { xMm: slab.maxXmm, yMm: slab.minYmm }, { xMm: slab.maxXmm, yMm: slab.maxYmm }, { xMm: slab.minXmm, yMm: slab.maxYmm }];
    return <div className="space-y-3"><label className="block text-[10px] font-semibold text-[var(--text-muted)]">Thickness (mm)<input disabled={locked} type="number" value={slab.thicknessMm} onChange={(e) => void store.updateSlab(slab.id, { thicknessMm: Number(e.target.value) })} className={field}/></label><div className="grid grid-cols-2 gap-2"><button disabled={locked} type="button" onClick={() => store.beginSlabBoundaryEdit(slab.id)} className="btn-v-yellow min-h-11 rounded-xl px-3 text-xs">Edit vertices</button><button disabled={locked} type="button" onClick={() => store.beginSlabRedraw(slab.id)} className="btn-yellow-border-hover min-h-11 rounded-xl border border-[var(--panel-divider)] px-3 text-xs">Redraw boundary</button>{store.slabBoundaryEdit?.slabId === slab.id && <><button type="button" onClick={() => void store.commitSlabBoundaryEdit()} className="btn-v-yellow min-h-11 rounded-xl px-3 text-xs">Commit</button><button type="button" onClick={store.cancelSlabBoundaryEdit} className="btn-yellow-border-hover min-h-11 rounded-xl border border-[var(--panel-divider)] px-3 text-xs">Cancel</button></>}</div>{store.slabBoundaryEdit?.slabId === slab.id && <div className="space-y-2"><p className="text-[10px] text-[var(--text-muted)]">Boundary vertices · Escape restores the original polygon</p>{boundary.map((point, index) => <div key={index} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-2"><span className="text-[10px] text-[var(--text-muted)]">{index + 1}</span><input aria-label={`Vertex ${index + 1} X`} type="number" value={point.xMm} className={field} onChange={(e) => store.updateSlabBoundaryVertex(index, { ...point, xMm: Number(e.target.value) })}/><input aria-label={`Vertex ${index + 1} Y`} type="number" value={point.yMm} className={field} onChange={(e) => store.updateSlabBoundaryVertex(index, { ...point, yMm: Number(e.target.value) })}/></div>)}</div>}</div>;
  }
  if (panelKey === "wall" && store.selectedWallId) { const wall = store.walls.find((item) => item.id === store.selectedWallId); if (wall) { const length = Math.round(Math.hypot(wall.endXmm - wall.startXmm, wall.endYmm - wall.startYmm)); return <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">{(["thicknessMm", "heightMm", "startXmm", "startYmm", "endXmm", "endYmm"] as const).map((key) => <label key={key} className="block text-[9px] font-semibold text-[var(--text-muted)]">{{ thicknessMm: "Thickness", heightMm: "Height", startXmm: "Start X", startYmm: "Start Y", endXmm: "End X", endYmm: "End Y" }[key]} (mm)<input disabled={locked} type="number" className={field} value={wall[key]} onChange={(e) => void store.updateWall(wall.id, { [key]: Number(e.target.value) })}/></label>)}<label className="block text-[9px] font-semibold text-[var(--text-muted)]">Length (mm)<input readOnly className={field} value={length}/></label><label className="block text-[9px] font-semibold text-[var(--text-muted)]">Level<input readOnly className={field} value={store.levels.find((level) => level.id === wall.levelId)?.name ?? wall.levelId}/></label><label className="col-span-2 block text-[9px] font-semibold text-[var(--text-muted)]">Material<input readOnly className={field} value={wall.material ?? "Default wall material"}/></label></div>; } }
  if (panelKey === "door" && store.selectedDoorId) { const door = store.doors.find((item) => item.id === store.selectedDoorId); if (door) return <div className="space-y-3">{(["widthMm", "heightMm"] as const).map((key) => <label key={key} className="block text-[10px] font-semibold text-[var(--text-muted)]">{key === "widthMm" ? "Width" : "Height"} (mm)<input disabled={locked} type="number" className={field} value={door[key]} onChange={(e) => void store.updateDoor(door.id, { [key]: Number(e.target.value) })}/></label>)}</div>; }
  if (panelKey === "window" && store.selectedWindowId) { const windowItem = store.windows.find((item) => item.id === store.selectedWindowId); if (windowItem) return <div className="space-y-3">{(["widthMm", "heightMm", "sillHeightMm"] as const).map((key) => <label key={key} className="block text-[10px] font-semibold text-[var(--text-muted)]">{key === "widthMm" ? "Width" : key === "heightMm" ? "Height" : "Sill height"} (mm)<input disabled={locked} type="number" className={field} value={windowItem[key]} onChange={(e) => void store.updateWindow(windowItem.id, { [key]: Number(e.target.value) })}/></label>)}</div>; }
  return <div className="rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-3 text-xs text-[var(--text-muted)]">{locked ? "Element locked. Properties remain visible, editing is disabled." : `Select a ${panelKey} in the 3D view to edit its properties.`}</div>;
}

function TypeOptions({ panelKey, locked }: { panelKey: LayoutToolId; locked: boolean }) {
  const layout = useLayoutDrawingStore();
  const markup = useToolMarkupStore();
  const compactButton = "btn-yellow-border-hover min-h-10 rounded-lg border border-[var(--panel-divider)] px-2 text-[11px] font-semibold";
  if (panelKey === "lines") {
    const snaps = [
      ["Endpoint", markup.snapEndpoint, markup.setSnapEndpoint],
      ["Midpoint", markup.snapMidpoint, markup.setSnapMidpoint],
      ["Center", markup.snapCenter, markup.setSnapCenter],
      ["Intersection", markup.snapIntersection, markup.setSnapIntersection],
      ["Perpendicular", markup.snapPerpendicular, markup.setSnapPerpendicular],
      ["Extension", markup.snapExtension, markup.setSnapExtension],
    ] as const;
    return <div className="space-y-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Drawing aids</p><div className="grid grid-cols-2 gap-1.5"><button className={`${compactButton} ${markup.gridSnap ? "btn-v-yellow" : ""}`} onClick={() => markup.setGridSnap(!markup.gridSnap)}>Grid snap</button>{snaps.map(([label, value, setter]) => <button key={label} className={`${compactButton} ${value ? "btn-v-yellow" : ""}`} onClick={() => setter(!value)}>{label}</button>)}</div><div className="grid grid-cols-2 gap-1.5 pt-1"><button className="btn-v-yellow min-h-10 rounded-lg px-2 text-[11px]" onClick={() => void layout.convertSketchToSlab("floor")}>Create floor</button><button className="btn-v-yellow min-h-10 rounded-lg px-2 text-[11px]" onClick={() => void layout.convertSketchToSlab("roof")}>Create roof</button><button className={`${compactButton} col-span-2`} onClick={layout.clearSketchLines}>Clear drawing</button></div></div>;
  }
  const presets: Array<{ name: string; thickness?: number; width?: number; height?: number }> = panelKey === "wall"
    ? [{ name: "Interior 100", thickness: 100, height: 3000 }, { name: "Generic 200", thickness: 200, height: 3000 }, { name: "Exterior 300", thickness: 300, height: 3000 }]
    : panelKey === "door"
      ? [{ name: "Single 800", width: 800, height: 2100 }, { name: "Single 900", width: 900, height: 2100 }, { name: "Double 1800", width: 1800, height: 2100 }]
      : panelKey === "window"
        ? [{ name: "Single 900", width: 900, height: 1200 }, { name: "Double 1200", width: 1200, height: 1400 }, { name: "Wide 1800", width: 1800, height: 1400 }]
        : [{ name: panelKey === "roof" ? "Insulated roof 300" : "Generic floor 200", thickness: panelKey === "roof" ? 300 : 200 }];
  const apply = (preset: typeof presets[number]) => {
    if (locked) return;
    if (panelKey === "wall" && layout.selectedWallId && preset.thickness && preset.height) void layout.updateWall(layout.selectedWallId, { thicknessMm: preset.thickness, heightMm: preset.height });
    if (panelKey === "door" && layout.selectedDoorId && preset.width && preset.height) void layout.updateDoor(layout.selectedDoorId, { widthMm: preset.width, heightMm: preset.height });
    if (panelKey === "window" && layout.selectedWindowId && preset.width && preset.height) void layout.updateWindow(layout.selectedWindowId, { widthMm: preset.width, heightMm: preset.height });
    if ((panelKey === "floor" || panelKey === "roof") && layout.selectedSlabId && preset.thickness) void layout.updateSlab(layout.selectedSlabId, { thicknessMm: preset.thickness });
  };
  return <div className="space-y-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Type presets</p>{presets.map((preset) => <button disabled={locked} key={preset.name} onClick={() => apply(preset)} className={`${compactButton} flex w-full items-center justify-between bg-transparent text-left`}><span>{preset.name}</span><span className="text-[10px] text-[var(--text-muted)]">Apply</span></button>)}</div>;
}
