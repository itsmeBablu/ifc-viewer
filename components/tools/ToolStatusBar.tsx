"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { LuBox, LuBuilding2, LuChevronDown, LuFootprints, LuGrid2X2, LuLayers3, LuMousePointer2, LuPaperclip, LuScale, LuSparkles, LuSunMedium } from "react-icons/lu";
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
type Popup = "attach" | "render" | "scale" | "level" | null;

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
    <div ref={rootRef} className="werkzeug-status-dock fixed bottom-3 left-1/2 z-40 flex h-10 w-[570px] max-w-[calc(100vw-24px)] -translate-x-1/2 items-center justify-center gap-0.5 rounded-[18px] px-1.5 select-none" aria-label="Viewer controls">
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
