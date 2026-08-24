"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { LuBox, LuBuilding2, LuFootprints, LuLayers3, LuMousePointer2, LuPaperclip, LuScale, LuSunMedium } from "react-icons/lu";
import type { RenderMode } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import ObjectSnapStrip from "./ObjectSnapStrip";

const RENDER_MODES: { id: RenderMode; label: string }[] = [
  { id: "realistic", label: "Realistic" }, { id: "fullColor", label: "Shaded" },
  { id: "light", label: "Light" }, { id: "wireframe", label: "Wireframe" },
];
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

  return (
    <div ref={rootRef} className="fixed bottom-3.5 left-1/2 z-40 flex h-12 w-[560px] max-w-[calc(100vw-24px)] -translate-x-1/2 items-center justify-center gap-1 rounded-[22px] border border-white/80 bg-white/78 px-2 text-zinc-700 shadow-[inset_0_1px_0_white,0_14px_42px_rgba(15,23,42,0.24)] backdrop-blur-2xl select-none" aria-label="Viewer controls">
      <DockButton icon={<LuMousePointer2 />} label="Select" onClick={enterSelectMode} />
      <DockDivider />
      <div className="relative">
        <DockButton icon={<LuPaperclip />} label="Attach" active={popup === "attach"} onClick={() => toggle("attach")} />
        {popup === "attach" && <Popover title="Attach reference">
          <input ref={fileRef} type="file" accept=".dwg,.dxf,.pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onAttachDwgPdf?.(file); setPopup(null); }} />
          <button type="button" className="dock-menu-row" onClick={() => fileRef.current?.click()}><LuPaperclip /><span><strong>DWG / PDF</strong><small>Attach to active level</small></span></button>
        </Popover>}
      </div>
      <DockButton icon={<LuFootprints />} label="Walk" active={walkthroughMode} strong onClick={toggleWalk} />
      <div className="relative">
        <DockButton icon={<LuBox />} label="Realistic" active={popup === "render"} onClick={() => toggle("render")} />
        {popup === "render" && <Popover title="Visual style" wide>
          <div className="grid grid-cols-4 gap-1">{RENDER_MODES.map((mode) => <button key={mode.id} type="button" className={`rounded-xl border px-1 py-2 text-[9px] font-semibold ${renderMode === mode.id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white/70 text-zinc-600 hover:bg-white"}`} onClick={() => setRenderMode(mode.id)}>{mode.label}</button>)}</div>
          <DockSlider label="Mesh opacity" value={lighting.elementTransparency} onChange={(value) => setLighting({ elementTransparency: value })} />
          <DockSlider label="Space opacity" value={lighting.spaceTransparency} onChange={(value) => setLighting({ spaceTransparency: value })} />
          <DockSlider label="Color" value={lighting.color} onChange={(value) => setLighting({ color: value })} />
          <div className="mt-1 border-t border-zinc-200/80 pt-2"><div className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400"><LuSunMedium /> Lighting</div><DockSlider label="Direct / shadow" value={lighting.shadow} onChange={(value) => setLighting({ shadow: value })} /><DockSlider label="Indirect light" value={lighting.indirectLight} onChange={(value) => setLighting({ indirectLight: value })} /></div>
        </Popover>}
      </div>
      <div className="relative">
        <DockButton icon={<LuScale />} label="" title={`Scale ${drawingScale}`} active={popup === "scale"} onClick={() => toggle("scale")} />
        {popup === "scale" && <Popover title="Drawing scale"><div className="grid grid-cols-2 gap-1">{["1:20", "1:50", "1:100", "1:200", "1:500"].map((scale) => <button key={scale} type="button" onClick={() => { setDrawingScale(scale as "1:20" | "1:50" | "1:100" | "1:200" | "1:500"); setPopup(null); }} className={`rounded-xl px-2 py-2 text-xs font-semibold ${drawingScale === scale ? "bg-zinc-900 text-white" : "bg-white/70 text-zinc-600 hover:bg-white"}`}>{scale}</button>)}</div></Popover>}
      </div>
      <div className="relative">
        <DockButton icon={<LuBuilding2 />} label={activeLevel?.name ?? "Level 1"} active={popup === "level"} onClick={() => toggle("level")} />
        {popup === "level" && <Popover title="Active level"><div className="max-h-60 space-y-1 overflow-y-auto thin-scroll">{levels.map((level) => <button key={level.id} type="button" className={`dock-menu-row ${level.id === activeLevel?.id ? "!bg-zinc-900 !text-white" : ""}`} onClick={() => { setMarkupFloorId(level.id); setSelectedFloor(level.id); setPopup(null); }}><LuLayers3 /><span><strong>{level.name}</strong><small>{level.elevationMm} mm</small></span></button>)}</div></Popover>}
      </div>
      <DockDivider />
      <ObjectSnapStrip compact iconOnly />
    </div>
  );
}

function DockButton({ icon, label, title, active = false, strong = false, onClick }: { icon: ReactNode; label: string; title?: string; active?: boolean; strong?: boolean; onClick: () => void }) {
  return <button type="button" title={title ?? label} onClick={onClick} className={`flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-2xl border px-2.5 text-[10px] font-semibold transition ${active ? "border-zinc-900 bg-zinc-900 text-white shadow-lg" : strong ? "border-amber-300 bg-gradient-to-br from-amber-300 to-orange-500 text-zinc-950 shadow-[0_6px_18px_rgba(245,158,11,0.34)] hover:brightness-105" : "border-transparent bg-white/35 text-zinc-700 hover:border-white hover:bg-white/85 hover:shadow-md"}`}><span className="text-[15px]">{icon}</span>{label && <span className="whitespace-nowrap">{label}</span>}</button>;
}
function DockDivider() { return <span className="mx-0.5 h-5 w-px shrink-0 bg-zinc-300/70" />; }
function Popover({ title, wide = false, children }: { title: string; wide?: boolean; children: ReactNode }) {
  return <div className={`absolute bottom-[calc(100%+10px)] left-1/2 z-50 -translate-x-1/2 rounded-[20px] border border-white/90 bg-white/88 p-2 text-zinc-700 shadow-[inset_0_1px_0_white,0_18px_48px_rgba(15,23,42,0.22)] backdrop-blur-2xl ${wide ? "w-72" : "w-48"}`}><p className="mb-2 px-1 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-400">{title}</p>{children}</div>;
}
function DockSlider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="grid grid-cols-[92px_1fr_34px] items-center gap-2 py-1 text-[10px]"><span>{label}</span><input type="range" min={0} max={1} step={0.05} value={value} onChange={(event) => onChange(Number(event.target.value))} className="accent-zinc-900" /><span className="text-right font-mono text-[9px] text-zinc-400">{Math.round(value * 100)}%</span></label>;
}
