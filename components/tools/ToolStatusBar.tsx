"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  LuBox,
  LuBuilding2,
  LuChevronDown,
  LuEye,
  LuEyeOff,
  LuFocus,
  LuFootprints,
  LuGrid2X2,
  LuLayers3,
  LuMousePointer2,
  LuPaperclip,
  LuRotateCcw,
  LuScale,
  LuSparkles,
  LuSunMedium,
} from "react-icons/lu";
import type { RenderMode } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import ObjectSnapStrip from "./ObjectSnapStrip";
import HoverTip from "@/components/common/HoverTip";

const RENDER_MODES: { id: RenderMode; label: string }[] = [
  { id: "realistic", label: "Realistic" }, { id: "fullColor", label: "Shaded" },
  { id: "light", label: "Light" }, { id: "wireframe", label: "Wireframe" },
];
const renderModeIcon = (mode: RenderMode) => mode === "realistic" ? <LuSparkles /> : mode === "light" ? <LuSunMedium /> : mode === "wireframe" ? <LuGrid2X2 /> : <LuBox />;
type Popup = "attach" | "render" | "scale" | "level" | "visibility" | null;

export default function ToolStatusBar({ onAttachDwgPdf }: {
  pointer: { x: number; y: number };
  onAttachDwgPdf?: (file: File) => void;
  onAttachIfc?: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<Popup>(null);
  const drawingScale = useLayoutDrawingStore((s) => s.drawingScale || "1:100");
  const setDrawingScale = useLayoutDrawingStore((s) => s.setDrawingScale);
  const levels = useLayoutDrawingStore((s) => s.levels);
  const setArmedLayoutTool = useLayoutDrawingStore((s) => s.setArmedLayoutTool);
  const markupFloorId = useToolMarkupStore((s) => s.markupFloorId);
  const setMarkupFloorId = useToolMarkupStore((s) => s.setMarkupFloorId);
  const setViewPreset = useToolMarkupStore((s) => s.setViewPreset);
  const quadView = useToolMarkupStore((s) => s.quadView);
  const setQuadView = useToolMarkupStore((s) => s.setQuadView);
  const walkthroughMode = useToolMarkupStore((s) => s.walkthroughMode);
  const setWalkthroughMode = useToolMarkupStore((s) => s.setWalkthroughMode);
  const setArmedTool = useToolMarkupStore((s) => s.setArmedTool);
  const renderMode = useAppStore((s) => s.renderMode);
  const setRenderMode = useAppStore((s) => s.setRenderMode);
  const lighting = useAppStore((s) => s.lighting);
  const setLighting = useAppStore((s) => s.setLighting);
  const setSelectedFloor = useAppStore((s) => s.setSelectedFloor);

  // Visibility / Eye mode states
  const hiddenElementIds = useLayoutDrawingStore((s) => s.hiddenElementIds);
  const hiddenCategories = useLayoutDrawingStore((s) => s.hiddenCategories);
  const isolatedElementIds = useLayoutDrawingStore((s) => s.isolatedElementIds);
  const revealHiddenMode = useLayoutDrawingStore((s) => s.revealHiddenMode);
  const hideSelected = useLayoutDrawingStore((s) => s.hideSelected);
  const isolateSelected = useLayoutDrawingStore((s) => s.isolateSelected);
  const toggleHideCategory = useLayoutDrawingStore((s) => s.toggleHideCategory);
  const unhideAll = useLayoutDrawingStore((s) => s.unhideAll);
  const toggleRevealHiddenMode = useLayoutDrawingStore((s) => s.toggleRevealHiddenMode);

  const selectedElements = useLayoutDrawingStore((s) => s.selectedElements);
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const selectedDuctId = useLayoutDrawingStore((s) => s.selectedDuctId);
  const selectedPipeId = useLayoutDrawingStore((s) => s.selectedPipeId);
  const selectedCableTrayId = useLayoutDrawingStore((s) => s.selectedCableTrayId);
  const selectedEquipmentId = useLayoutDrawingStore((s) => s.selectedEquipmentId);
  const selectedStairId = useLayoutDrawingStore((s) => s.selectedStairId);
  const selectedRampId = useLayoutDrawingStore((s) => s.selectedRampId);

  const hasSelection = Boolean(
    selectedWallId ||
    selectedDoorId ||
    selectedWindowId ||
    selectedSlabId ||
    selectedDuctId ||
    selectedPipeId ||
    selectedCableTrayId ||
    selectedEquipmentId ||
    selectedStairId ||
    selectedRampId ||
    selectedElements.length > 0
  );
  const hasHidden = hiddenElementIds.size > 0 || hiddenCategories.size > 0 || isolatedElementIds !== null;

  useEffect(() => {
    if (!popup) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setPopup(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [popup]);

  const toggle = (next: Exclude<Popup, null>) => setPopup((current) => current === next ? null : next);
  const enterSelectMode = () => { setArmedLayoutTool(null); setArmedTool(null); };
  const toggleWalk = () => {
    const next = !walkthroughMode;
    setWalkthroughMode(next);
    if (next) {
      setRenderMode("realistic");
      setLighting({ elementTransparency: 1, color: 1, shadow: 0.88, indirectLight: 0.68 });
    }
  };
  const activeLevel = levels.find((level) => level.id === markupFloorId) ?? levels[0];
  const activeRenderMode = RENDER_MODES.find((mode) => mode.id === renderMode) ?? RENDER_MODES[0];
  const renderIcon = renderModeIcon(renderMode);

  return (
    <div ref={rootRef} className="werkzeug-status-dock fixed bottom-3 left-1/2 z-40 flex h-10 w-[610px] max-w-[calc(100vw-24px)] -translate-x-1/2 items-center justify-center gap-0.5 rounded-[18px] px-1.5 select-none" aria-label="Viewer controls">
      <DockButton icon={<LuMousePointer2 />} label="Select" hint="Exit the active tool and click a model element to select it." onClick={enterSelectMode} />
      <DockDivider />
      <div className="relative">
        <DockButton icon={<LuPaperclip />} label="Attach" hint="Attach a DWG or PDF reference to the active level." active={popup === "attach"} onClick={() => toggle("attach")} />
        {popup === "attach" && <Popover title="Attach reference">
          <input ref={fileRef} type="file" accept=".dwg,.dxf,.pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onAttachDwgPdf?.(file); setPopup(null); }} />
          <button type="button" className="dock-menu-row" onClick={() => fileRef.current?.click()}><LuPaperclip /><span><strong>DWG / PDF</strong><small className="block text-[10px] opacity-70">Attach to active level</small></span></button>
        </Popover>}
      </div>
      <DockButton icon={<LuFootprints />} label="Walk" hint="Enter a strongly rendered first-person WASD walkthrough." active={walkthroughMode} onClick={toggleWalk} />
      <div className="relative">
        <DockButton icon={renderIcon} label={activeRenderMode.label} dropdown hint="Choose Realistic, Shaded, Light, or Wireframe rendering." active={popup === "render"} onClick={() => toggle("render")} />
        {popup === "render" && <Popover title="Visual style" wide>
          <div className="werkzeug-segmented-control grid grid-cols-4 gap-1">{RENDER_MODES.map((mode) => <button key={mode.id} type="button" aria-pressed={renderMode === mode.id} className={`werkzeug-control-button flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[9px] font-semibold ${renderMode === mode.id ? "is-active btn-v-yellow btn-liquid-hover border-transparent" : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)]"}`} onClick={() => setRenderMode(mode.id)}><span className="text-sm">{renderModeIcon(mode.id)}</span><span>{mode.label}</span></button>)}</div>
          <DockSlider label="Mesh opacity" value={lighting.elementTransparency} onChange={(value) => setLighting({ elementTransparency: value })} />
          <DockSlider label="Space opacity" value={lighting.spaceTransparency} onChange={(value) => setLighting({ spaceTransparency: value })} />
          <DockSlider label="Color" value={lighting.color} onChange={(value) => setLighting({ color: value })} />
          <div className="mt-1 border-t border-[var(--panel-divider)] pt-2"><div className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]"><LuSunMedium /> Lighting</div><DockSlider label="Direct / shadow" value={lighting.shadow} onChange={(value) => setLighting({ shadow: value })} /><DockSlider label="Indirect light" value={lighting.indirectLight} onChange={(value) => setLighting({ indirectLight: value })} /></div>
        </Popover>}
      </div>

      {/* Eye Visibility & Isolate Menu */}
      <div className="relative">
        <DockButton
          icon={revealHiddenMode ? <LuEye className="text-pink-400" /> : hasHidden ? <LuEyeOff className="text-amber-400" /> : <LuEye />}
          label=""
          title="Visibility & Hide/Isolate"
          hint="Isolate or hide items, toggle category visibility, or reveal hidden elements."
          active={popup === "visibility" || revealHiddenMode}
          onClick={() => toggle("visibility")}
        />
        {popup === "visibility" && (
          <Popover title="Element Visibility & Isolate" wide>
            <div className="space-y-2">
              {/* Quick Actions: Hide / Isolate / Unhide */}
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={() => {
                    hideSelected();
                    setPopup(null);
                  }}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-1.5 text-[9px] font-semibold text-[var(--text-strong)] hover:border-yellow-400/50 disabled:opacity-40"
                  title="Hide currently selected element(s)"
                >
                  <LuEyeOff className="h-3.5 w-3.5" />
                  <span>Hide Select</span>
                </button>

                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={() => {
                    isolateSelected();
                    setPopup(null);
                  }}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-1.5 text-[9px] font-semibold text-[var(--text-strong)] hover:border-yellow-400/50 disabled:opacity-40"
                  title="Isolate selected element (hide all others)"
                >
                  <LuFocus className="h-3.5 w-3.5" />
                  <span>Isolate</span>
                </button>

                <button
                  type="button"
                  disabled={!hasHidden}
                  onClick={() => {
                    unhideAll();
                    setPopup(null);
                  }}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-1.5 text-[9px] font-semibold text-[var(--text-strong)] hover:border-yellow-400/50 disabled:opacity-40"
                  title="Restore and unhide all elements"
                >
                  <LuRotateCcw className="h-3.5 w-3.5" />
                  <span>Unhide All</span>
                </button>
              </div>

              {/* Reveal Hidden Elements Mode ("Show All Eye Mode") */}
              <button
                type="button"
                onClick={toggleRevealHiddenMode}
                className={`flex w-full items-center justify-between rounded-xl border p-2 text-[10px] font-semibold transition-all ${
                  revealHiddenMode
                    ? "border-pink-400 bg-pink-500/20 text-pink-300 shadow-[0_0_12px_rgba(236,72,153,0.35)]"
                    : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-strong)] hover:border-yellow-400/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-pink-400 animate-pulse" />
                  <div className="text-left">
                    <p className="font-bold">Reveal Hidden (Ghost Mode)</p>
                    <p className="text-[8.5px] text-[var(--text-muted)] font-normal">Show hidden 3D elements to inspect & unhide</p>
                  </div>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${revealHiddenMode ? "bg-pink-400 text-zinc-950" : "bg-white/10 text-[var(--text-muted)]"}`}>
                  {revealHiddenMode ? "ON" : "OFF"}
                </span>
              </button>

              {/* Categories */}
              <div className="border-t border-[var(--panel-divider)]/50 pt-1.5">
                <p className="mb-1 text-[8.5px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Category Visibility</p>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { id: "walls", label: "Walls" },
                    { id: "doors", label: "Doors" },
                    { id: "windows", label: "Windows" },
                    { id: "slabs", label: "Floors / Roofs" },
                    { id: "structural", label: "Columns / Beams" },
                    { id: "mep", label: "MEP Systems" },
                  ].map((cat) => {
                    const isHidden = hiddenCategories.has(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleHideCategory(cat.id)}
                        className={`flex items-center justify-between rounded-lg px-2 py-1 text-[9.5px] font-medium border transition-colors ${
                          isHidden
                            ? "border-red-400/40 bg-red-500/10 text-red-400"
                            : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-strong)] hover:border-yellow-400/40"
                        }`}
                      >
                        <span className="truncate">{cat.label}</span>
                        {isHidden ? <LuEyeOff className="h-3 w-3 shrink-0 text-red-400" /> : <LuEye className="h-3 w-3 shrink-0 text-[var(--text-muted)]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Popover>
        )}
      </div>

      <div className="relative">
        <DockButton icon={<LuScale />} label="" title={`Scale ${drawingScale}`} hint="Set the drawing and annotation scale." active={popup === "scale"} onClick={() => toggle("scale")} />
        {popup === "scale" && <Popover title="Drawing scale"><div className="flex max-h-56 flex-col gap-1 overflow-y-auto thin-scroll">{["1:20", "1:50", "1:100", "1:200", "1:500"].map((scale) => <button key={scale} type="button" onClick={() => { setDrawingScale(scale as "1:20" | "1:50" | "1:100" | "1:200" | "1:500"); setPopup(null); }} className={`w-full rounded-xl px-3 py-2 text-left text-xs font-semibold ${drawingScale === scale ? "btn-v-yellow btn-liquid-hover" : "btn-yellow-border-hover border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-body)]"}`}>{scale}</button>)}</div></Popover>}
      </div>
      <div className="relative">
        <DockButton icon={<LuBuilding2 />} label={activeLevel?.name ?? "Erdgeschoss"} hint="Switch the active drawing and attachment level." active={popup === "level"} onClick={() => toggle("level")} />
        {popup === "level" && <Popover title="Open floor plan"><div className="max-h-60 space-y-1 overflow-y-auto thin-scroll">{levels.map((level) => <button key={level.id} type="button" className={`dock-menu-row ${level.id === activeLevel?.id ? "btn-v-yellow btn-liquid-hover !font-bold" : ""}`} onClick={() => { setMarkupFloorId(level.id); setSelectedFloor(level.id); setViewPreset("top"); setPopup(null); }}><LuLayers3 /><span><strong>{level.name}</strong><small className="block text-[10px] opacity-70">2D floor plan · {level.elevationMm} mm</small></span></button>)}</div></Popover>}
      </div>
      <DockButton icon={<LuGrid2X2 />} label="Views" hint="Show Top, 3D, and elevation views together in one window." active={quadView} onClick={() => setQuadView(!quadView)} />
      <DockDivider />
      <HoverTip label="Object snaps" hint="Choose endpoint, midpoint, center, intersection, and other precision snaps." disabled={popup !== null}><ObjectSnapStrip compact iconOnly /></HoverTip>
    </div>
  );
}

function DockButton({ icon, label, title, hint, active = false, strong = false, dropdown = false, onClick }: { icon: ReactNode; label: string; title?: string; hint: string; active?: boolean; strong?: boolean; dropdown?: boolean; onClick: () => void }) {
  const tipLabel = label || title || "Viewer control";
  return <HoverTip label={tipLabel} hint={hint} disabled={active}><button type="button" aria-label={title ?? label} onClick={onClick} className={`werkzeug-dock-button flex h-8 shrink-0 items-center justify-center gap-1 rounded-xl border px-2 text-[9px] font-semibold transition ${active || strong ? "btn-v-yellow btn-liquid-hover border-transparent" : "btn-yellow-border-hover border-transparent bg-[var(--glass-inset-bg)] text-[var(--text-body)] hover:border-[var(--panel-divider)]"}`}><span className="text-[14px]">{icon}</span>{label && <span className="whitespace-nowrap">{label}</span>}{dropdown && <LuChevronDown className={`h-3 w-3 transition-transform ${active ? "rotate-180" : ""}`} />}</button></HoverTip>;
}
function DockDivider() { return <span className="mx-0.5 h-5 w-px shrink-0 bg-[var(--panel-divider)]" />; }
function Popover({ title, wide = false, children }: { title: string; wide?: boolean; children: ReactNode }) {
  return <div className={`absolute bottom-[calc(100%+10px)] left-1/2 z-50 -translate-x-1/2 rounded-[20px] border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-2.5 text-[var(--text-primary)] shadow-[inset_0_1px_0_var(--glass-specular),0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-2xl ${wide ? "w-72" : "w-52"}`}><p className="mb-2 px-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{title}</p>{children}</div>;
}
function DockSlider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const progress = `${Math.round(value * 100)}%`;
  return <label className="grid grid-cols-[92px_1fr_34px] items-center gap-2 py-1 text-[10px]"><span>{label}</span><input type="range" min={0} max={1} step={0.05} value={value} onChange={(event) => onChange(Number(event.target.value))} className="material-slider w-full" style={{ "--slider-progress": progress } as React.CSSProperties} /><span className="text-right font-mono text-[9px] font-semibold text-[var(--text-primary)]">{Math.round(value * 100)}%</span></label>;
}
