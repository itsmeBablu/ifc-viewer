"use client";

import { useMemo, useState } from "react";
import { LuBox, LuCheck, LuChevronRight, LuCircle, LuCylinder, LuGrip, LuLayers, LuMousePointer2, LuPalette, LuPlus, LuSearch, LuSparkles, LuTrash2, LuX } from "react-icons/lu";
import UnifiedButton from "@/components/common/UnifiedButton";
import GsapHeightAccordion from "@/components/common/GsapHeightAccordion";
import { getHatchCanvasTexture } from "@/lib/hatchPatterns";
import { renderMaterialPreview } from "@/lib/materialSpherePreview";
import { MATERIAL_DRAG_MIME, useMaterialStore, type HatchStyle, type MaterialDefinition, type MaterialPreviewShape } from "@/store/materialStore";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";

const HATCHES: { id: HatchStyle; label: string; glyph: string }[] = [
  ["solid", "Solid / none", "■"], ["horizontal", "Horizontal lines", "≡"], ["vertical", "Vertical lines", "|||"],
  ["diagonal", "Diagonal 45°", "///"], ["cross", "Diagonal cross", "XXX"], ["grid", "Square grid", "▦"],
  ["brick", "Running bond brick", "▤"], ["tile", "Ceramic tile", "▦"], ["checker", "Checker plate", "▩"],
  ["concrete", "Concrete aggregate", "∴"], ["dots", "Regular dots", "⠿"], ["sand", "Sand", "⠂"],
  ["earth", "Earth / fill", "≋"], ["steel", "Steel section", "╳"], ["zigzag", "Insulation", "〽"], ["wood", "Wood grain", "≋"],
].map(([id, label, glyph]) => ({ id: id as HatchStyle, label, glyph }));
const CATEGORIES = ["All", "Masonry", "Concrete", "Wood", "Glass", "Metal", "Finishes", "Custom"] as const;
const SHAPES: { id: MaterialPreviewShape; label: string; icon: React.ReactNode }[] = [
  { id: "sphere", label: "Sphere", icon: <LuCircle /> }, { id: "cube", label: "Box", icon: <LuBox /> },
  { id: "cylinder", label: "Cylinder", icon: <LuCylinder /> }, { id: "fabric", label: "Fabric", icon: <LuLayers /> },
];
const CLASS_DEFAULTS: Record<MaterialDefinition["category"], Partial<MaterialDefinition>> = {
  Masonry: { color: "#a0522d", roughness: .88, metalness: 0, opacity: 1, transmission: 0, clearcoat: 0, clearcoatRoughness: .3, ior: 1.52, bumpScale: .45, hatchStyle: "brick", hatchScaleMm: 250, tilingScale: 1 },
  Concrete: { color: "#878683", roughness: .86, metalness: .02, opacity: 1, transmission: 0, clearcoat: 0, clearcoatRoughness: .4, ior: 1.5, bumpScale: .35, hatchStyle: "concrete", hatchScaleMm: 200, tilingScale: 1 },
  Wood: { color: "#8b5a2b", roughness: .62, metalness: 0, opacity: 1, transmission: 0, clearcoat: .12, clearcoatRoughness: .35, ior: 1.5, bumpScale: .3, hatchStyle: "wood", hatchScaleMm: 180, tilingScale: 1 },
  Glass: { color: "#bae6fd", roughness: .06, metalness: 0, opacity: .38, transmission: .92, clearcoat: .25, clearcoatRoughness: .05, ior: 1.52, bumpScale: 0, hatchStyle: "solid", hatchScaleMm: 200, tilingScale: 1 },
  Metal: { color: "#94a3b8", roughness: .24, metalness: .92, opacity: 1, transmission: 0, clearcoat: .18, clearcoatRoughness: .12, ior: 1.5, bumpScale: .12, hatchStyle: "steel", hatchScaleMm: 150, tilingScale: 1 },
  Finishes: { color: "#f4f4f5", roughness: .78, metalness: 0, opacity: 1, transmission: 0, clearcoat: .08, clearcoatRoughness: .3, ior: 1.5, bumpScale: .12, hatchStyle: "solid", hatchScaleMm: 200, tilingScale: 1 },
  Custom: { roughness: .5, metalness: 0, opacity: 1, transmission: 0, clearcoat: 0, clearcoatRoughness: .1, ior: 1.5, bumpScale: .2, hatchStyle: "solid", hatchScaleMm: 200, tilingScale: 1 },
};
const field = "h-8 w-full rounded-xl border border-zinc-200 bg-white px-2 text-[11px] text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_2px_8px_rgba(15,23,42,.05)] outline-none backdrop-blur-xl focus:border-zinc-400";

function Slider({ label, value, min = 0, max = 1, step = .01, display, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; display?: string; onChange: (n: number) => void }) {
  const progress = `${Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))}%`;
  const isPercent = display === undefined;
  const suffix = isPercent ? "%" : display?.trim().endsWith("mm") ? "mm" : display?.trim().endsWith("×") ? "×" : "";
  const editableValue = isPercent ? Math.round(value * 100) : value;
  const editableMin = isPercent ? min * 100 : min, editableMax = isPercent ? max * 100 : max, editableStep = isPercent ? Math.max(1, step * 100) : step;
  const changeEditableValue = (raw: string) => {
    const next = Number(raw);
    if (!Number.isFinite(next)) return;
    onChange(Math.max(min, Math.min(max, isPercent ? next / 100 : next)));
  };
  return <label className="grid grid-cols-[92px_1fr_58px] items-center gap-2 text-[10px] text-zinc-700"><span>{label}</span><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="material-slider w-full" style={{ "--slider-progress": progress } as React.CSSProperties}/><span className="flex items-baseline justify-end font-mono text-[9px] font-semibold text-zinc-700"><input type="number" min={editableMin} max={editableMax} step={editableStep} value={editableValue} onChange={(e) => changeEditableValue(e.target.value)} className="w-10 appearance-none border-0 bg-transparent p-0 text-right font-mono text-[9px] font-semibold text-zinc-700 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" aria-label={`${label} value`}/>{suffix && <span className="ml-0.5">{suffix}</span>}</span></label>;
}
function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return <section className="border-b border-zinc-200 bg-white last:border-b-0">
    <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-2 px-1 py-2 text-left text-[10px] font-bold uppercase tracking-[.12em] text-[var(--text-body)] hover:text-amber-600 dark:hover:text-amber-300">
      <LuChevronRight className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-300 ${open ? "rotate-90" : "rotate-0"}`} />
      <span>{title}</span>
    </button>
    <GsapHeightAccordion open={open} contentKey={title} innerClassName="space-y-2 px-1 pb-3">
      {children}
    </GsapHeightAccordion>
  </section>;
}

export default function MaterialEditorPanel({ isOpen, onClose, embedded = false }: { isOpen: boolean; onClose: () => void; embedded?: boolean }) {
  const isDark = useAppStore((s) => s.colorTheme === "dark");
  const materials = useMaterialStore((s) => s.materials), selectedId = useMaterialStore((s) => s.selectedMaterialId);
  const select = useMaterialStore((s) => s.setSelectedMaterialId), add = useMaterialStore((s) => s.addMaterial);
  const update = useMaterialStore((s) => s.updateMaterial), remove = useMaterialStore((s) => s.deleteMaterial);
  const paintId = useMaterialStore((s) => s.paintMaterialId), setPaintId = useMaterialStore((s) => s.setPaintMaterialId);
  const wallId = useLayoutDrawingStore((s) => s.selectedWallId), slabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const doorId = useLayoutDrawingStore((s) => s.selectedDoorId), windowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedElements = useLayoutDrawingStore((s) => s.selectedElements);
  const columnId = selectedElements.find((item) => item.kind === "column")?.id;
  const beamId = selectedElements.find((item) => item.kind === "beam")?.id;
  const updateWall = useLayoutDrawingStore((s) => s.updateWall), updateSlab = useLayoutDrawingStore((s) => s.updateSlab);
  const updateDoor = useLayoutDrawingStore((s) => s.updateDoor), updateWindow = useLayoutDrawingStore((s) => s.updateWindow);
  const updateColumn = useLayoutDrawingStore((s) => s.updateColumn), updateBeam = useLayoutDrawingStore((s) => s.updateBeam);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All"), [search, setSearch] = useState("");
  const [shape, setShape] = useState<MaterialPreviewShape>("sphere");
  const filtered = useMemo(() => materials.filter((m) => (category === "All" || m.category === category || (category === "Custom" && !m.isPreset)) && (!search || `${m.name} ${m.category}`.toLowerCase().includes(search.toLowerCase()))), [materials, category, search]);
  const selected = materials.find((m) => m.id === selectedId) ?? filtered[0] ?? materials[0];
  if (!isOpen || !selected) return null;
  const patch = (p: Partial<MaterialDefinition>) => update(selected.id, p);
  const clone = () => select(add({ ...selected, name: `${selected.name} Copy`, category: "Custom", isPreset: false }).id);
  const assign = () => { const p = { material: selected.id, color: selected.color }; if (wallId) void updateWall(wallId, p); else if (slabId) void updateSlab(slabId, p); else if (doorId) void updateDoor(doorId, p); else if (windowId) void updateWindow(windowId, p); else if (columnId) void updateColumn(columnId, p); else if (beamId) void updateBeam(beamId, p); };
  const drag = (e: React.DragEvent, m: MaterialDefinition) => { e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData(MATERIAL_DRAG_MIME, m.id); e.dataTransfer.setData("text/plain", `vstudio-material:${m.id}`); select(m.id); };
  const preview = renderMaterialPreview(selected, shape, 144), hasSelection = Boolean(wallId || slabId || doorId || windowId || columnId || beamId);
  const hatchTexture = getHatchCanvasTexture(selected.hatchStyle, "#334155", selected.color, selected.hatchScaleMm ?? 200);
  const hatchCanvas =
    typeof HTMLCanvasElement !== "undefined" && hatchTexture?.image instanceof HTMLCanvasElement
      ? hatchTexture.image
      : null;
  const hatchUrl = hatchCanvas?.toDataURL() ?? null;
  const sampleSizePx = Math.max(12, Math.min(96, (selected.hatchScaleMm ?? 200) / Math.max(.1, selected.tilingScale ?? 1) / 4));

  if (embedded) return <div className="material-editor-embedded flex h-full min-h-0 flex-col overflow-hidden bg-white text-zinc-900">
    <div className="flex h-9 shrink-0 items-center justify-between border-b border-zinc-200 px-2"><div className="flex min-w-0 items-center gap-1.5"><LuPalette className="shrink-0 text-amber-500"/><span className="truncate text-[11px] font-bold">Materials</span><span className="truncate text-[9px] text-zinc-500">{selected.name}</span></div><div className="flex gap-1"><button onClick={clone} className="btn-liquid-amber flex h-7 w-7 items-center justify-center rounded-lg" title="Clone"><LuPlus/></button><button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200" title="Close"><LuX/></button></div></div>
    <div className="min-h-0 flex-1 overflow-y-auto p-1.5 thin-scroll">
      <div className="relative mb-1.5"><LuSearch className="absolute left-2 top-2 h-3 w-3 text-zinc-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search materials" className={`${field} pl-6`}/></div>
      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 thin-scroll">{filtered.map((m) => <button key={m.id} draggable onDragStart={(e) => drag(e, m)} onClick={() => select(m.id)} aria-label={`Select ${m.name}`} title={m.name} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border bg-white p-0 ${m.id === selected.id ? "border-amber-400 ring-2 ring-amber-300/60" : "border-transparent"}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={renderMaterialPreview(m, "sphere", 48)} alt="" className="h-11 w-11 shrink-0"/></button>)}</div>
      <div className="material-compact-preview grid grid-cols-[76px_1fr] gap-2 border-y border-zinc-200 py-2"><div className={`flex h-[76px] items-center justify-center rounded-lg border ${isDark ? "border-zinc-700 bg-zinc-950" : "border-zinc-200 bg-white"}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={renderMaterialPreview(selected, shape, 76)} alt="Preview" className="h-[70px] w-[70px]"/></div><div className="grid min-w-0 grid-cols-2 gap-1"><input value={selected.name} onChange={(e) => patch({ name: e.target.value })} className={`${field} col-span-2`}/><select value={selected.category} onChange={(e) => { const next = e.target.value as MaterialDefinition["category"]; patch({ ...CLASS_DEFAULTS[next], category: next }); }} className={field}>{CATEGORIES.slice(1).map((c) => <option key={c}>{c}</option>)}</select><input type="color" value={selected.color} onChange={(e) => patch({ color: e.target.value })} className="h-8 w-full rounded-lg border border-zinc-200 bg-white p-1"/><div className="material-shape-options col-span-2 grid grid-cols-4 gap-1">{SHAPES.map((s) => <button key={s.id} onClick={() => setShape(s.id)} title={s.label} className={`flex h-7 min-w-0 items-center justify-center rounded-md border p-0 text-xs ${shape === s.id ? "border-amber-400 bg-amber-100" : "border-zinc-200"}`}>{s.icon}</button>)}</div></div></div>
      <div className="space-y-1.5 py-2"><Slider label="Roughness" value={selected.roughness} onChange={(v) => patch({ roughness: v })}/><Slider label="Metalness" value={selected.metalness} onChange={(v) => patch({ metalness: v })}/><Slider label="Opacity" value={selected.opacity} min={.02} onChange={(v) => patch({ opacity: v })}/><Slider label="Transmission" value={selected.transmission ?? 0} onChange={(v) => patch({ transmission: v })}/><Slider label="Clearcoat" value={selected.clearcoat ?? 0} onChange={(v) => patch({ clearcoat: v })}/><Slider label="Bump" value={selected.bumpScale ?? .2} max={2} display={(selected.bumpScale ?? .2).toFixed(2)} onChange={(v) => patch({ bumpScale: v })}/></div>
      <div className="grid grid-cols-[74px_1fr] items-center gap-1.5 border-t border-zinc-200 py-2 text-[9px]"><span>Hatch</span><select value={selected.hatchStyle} onChange={(e) => patch({ hatchStyle: e.target.value as HatchStyle })} className={field}>{HATCHES.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}</select><span>Sample</span><div className="h-8 rounded-md border border-zinc-200" style={{ backgroundColor: selected.color, backgroundImage: hatchUrl ? `url(${hatchUrl})` : undefined, backgroundSize: hatchUrl ? `${sampleSizePx}px ${sampleSizePx}px` : undefined }}/><span className="col-span-2"><Slider label="Spacing" value={selected.hatchScaleMm ?? 200} min={25} max={2000} step={25} display={`${selected.hatchScaleMm ?? 200} mm`} onChange={(v) => patch({ hatchScaleMm: v })}/></span><span className="col-span-2"><Slider label="UV tiling" value={selected.tilingScale ?? 1} min={.1} max={10} step={.1} display={`${(selected.tilingScale ?? 1).toFixed(1)}Ã—`} onChange={(v) => patch({ tilingScale: v })}/></span></div>
    </div>
    <div className="grid shrink-0 grid-cols-2 gap-1 border-t border-zinc-200 bg-white p-1.5"><UnifiedButton size="sm" variant="primary" disabled={!hasSelection} onClick={assign} icon={<LuCheck/>}>Assign</UnifiedButton><UnifiedButton size="sm" variant="primary" onClick={() => setPaintId(paintId === selected.id ? null : selected.id)} icon={<LuSparkles/>}>{paintId === selected.id ? "Painting" : "Paint"}</UnifiedButton></div>
  </div>;

  return <div className={`${embedded ? "relative h-full min-h-0 w-full" : "absolute inset-0 max-[1100px]:fixed max-[1100px]:inset-3"} z-40 flex select-none flex-col overflow-hidden border-l border-zinc-200 bg-white text-zinc-900 shadow-2xl max-[1100px]:rounded-2xl max-[1100px]:border`} style={{ "--text-strong": "#18181b", "--text-body": "#3f3f46", "--text-muted": "#71717a", "--panel-divider": "rgba(161,161,170,.38)", "--glass-inset-bg": "rgba(255,255,255,.82)", "--popover-bg": "rgba(255,255,255,.94)" } as React.CSSProperties}>
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-3"><div className="flex items-center gap-2"><LuPalette className="text-amber-500"/><div><p className="text-xs font-bold">Slate Material Editor</p><p className="text-[9px] text-zinc-500">Physical material · Werkzeug scene</p></div></div><div className="flex gap-1"><button onClick={clone} className="btn-liquid-amber rounded-xl p-2" title="Clone"><LuPlus/></button>{!selected.isPreset && <button onClick={() => remove(selected.id)} className="rounded-xl border border-red-200 bg-white p-2 text-red-500 shadow-sm hover:bg-red-50" title="Delete"><LuTrash2/></button>}<button onClick={onClose} className="rounded-xl border border-zinc-200 bg-white p-2 text-zinc-500 shadow-sm hover:text-zinc-900" title="Close"><LuX/></button></div></header>
    <div className="min-h-0 flex-1 overflow-y-auto p-2.5 thin-scroll max-[1100px]:grid max-[1100px]:grid-cols-[minmax(260px,.85fr)_minmax(340px,1.15fr)] max-[1100px]:gap-3 max-[700px]:block">
      <div className="space-y-2.5 max-[1100px]:overflow-y-auto max-[1100px]:pr-1 thin-scroll">
        <Section title="Compact material slots"><div className="relative"><LuSearch className="absolute left-2 top-2 h-3.5 w-3.5 text-zinc-500"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search materials" className={`${field} pl-7`}/></div><div className="flex gap-1 overflow-x-auto pb-1 thin-scroll">{CATEGORIES.map((c) => <button key={c} onClick={() => setCategory(c)} className={`shrink-0 rounded-xl px-2 py-1 text-[9px] font-semibold ${category === c ? "btn-liquid-amber" : "border border-zinc-200 bg-white text-zinc-500 shadow-sm hover:text-zinc-900"}`}>{c}</button>)}</div>
          <div className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto pr-1 thin-scroll max-[1100px]:grid-cols-4 max-[700px]:grid-cols-3">{filtered.map((m) => <button key={m.id} draggable onDragStart={(e) => drag(e, m)} onClick={() => select(m.id)} className={`group relative min-w-0 rounded-xl border bg-white p-1.5 text-left ${m.id === selected.id ? "border-amber-400 shadow-[0_3px_12px_rgba(250,204,21,.2)]" : "border-zinc-200 shadow-sm hover:border-zinc-400"}`} title="Drag onto a 3D object"><LuGrip className="absolute right-1 top-1 h-3 w-3 text-zinc-400"/>{/* eslint-disable-next-line @next/next/no-img-element */}<img draggable={false} src={renderMaterialPreview(m, "sphere", 72)} alt="" className="pointer-events-none mx-auto h-12 w-12"/><span className="pointer-events-none block truncate text-[9px] font-semibold">{m.name}</span><span className="pointer-events-none block truncate text-[8px] text-zinc-500">{m.category}</span></button>)}</div><p className="flex items-center gap-1 text-[9px] text-zinc-500"><LuMousePointer2/>Drag a slot onto an object in the 3D view.</p></Section>
        <Section title="Material preview & general"><div className="grid grid-cols-[1fr_82px] gap-2"><div className={`flex min-h-32 items-center justify-center rounded-2xl border transition-colors duration-300 ${isDark ? "border-zinc-700 bg-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_8px_24px_rgba(0,0,0,.28)]" : "border-zinc-200 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,1),0_8px_24px_rgba(15,23,42,.08)]"}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={preview} alt="Material preview" className="h-28 w-28 object-contain drop-shadow-2xl"/></div><div className="grid grid-rows-4 gap-1">{SHAPES.map((s) => <button key={s.id} onClick={() => setShape(s.id)} className={`btn-liquid-amber flex min-h-7 items-center gap-1.5 rounded-xl px-2 text-[9px] ${shape === s.id ? "ring-2 ring-amber-400/60" : "opacity-70 grayscale-[.15]"}`}><span className="text-sm">{s.icon}</span>{s.label}</button>)}</div></div><div className="border-t border-zinc-200 pt-2"><div className="grid grid-cols-[1fr_110px] gap-2"><label className="text-[9px] text-zinc-500">Name<input value={selected.name} onChange={(e) => patch({ name: e.target.value })} className={field}/></label><label className="text-[9px] text-zinc-500">Class<select value={selected.category} onChange={(e) => { const next = e.target.value as MaterialDefinition["category"]; patch({ ...CLASS_DEFAULTS[next], category: next }); }} className={field}>{CATEGORIES.slice(1).map((c) => <option key={c}>{c}</option>)}</select></label></div><div className="mt-2 grid grid-cols-[44px_1fr] gap-2"><input type="color" value={selected.color} onChange={(e) => patch({ color: e.target.value })} className="h-9 w-11 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm"/><input value={selected.color.toUpperCase()} readOnly className={field}/></div></div></Section>
      </div>
      <div className="mt-2.5 space-y-2.5 max-[1100px]:mt-0 max-[1100px]:overflow-y-auto max-[1100px]:pr-1 thin-scroll max-[700px]:mt-2.5">
        <Section title="Physical material parameters"><Slider label="Roughness" value={selected.roughness} onChange={(v) => patch({ roughness: v })}/><Slider label="Metalness" value={selected.metalness} onChange={(v) => patch({ metalness: v })}/><Slider label="Opacity" value={selected.opacity} min={.02} onChange={(v) => patch({ opacity: v })}/><Slider label="Transmission" value={selected.transmission ?? 0} onChange={(v) => patch({ transmission: v })}/><Slider label="Clearcoat" value={selected.clearcoat ?? 0} onChange={(v) => patch({ clearcoat: v })}/><Slider label="Coat roughness" value={selected.clearcoatRoughness ?? .1} onChange={(v) => patch({ clearcoatRoughness: v })}/><Slider label="IOR" value={selected.ior ?? 1.5} min={1} max={2.5} display={(selected.ior ?? 1.5).toFixed(2)} onChange={(v) => patch({ ior: v })}/><Slider label="Bump" value={selected.bumpScale ?? .2} max={2} display={(selected.bumpScale ?? .2).toFixed(2)} onChange={(v) => patch({ bumpScale: v })}/><div className="grid grid-cols-[44px_1fr] gap-2"><input type="color" value={selected.emissive ?? "#000000"} onChange={(e) => patch({ emissive: e.target.value })} className="h-7 w-11 rounded-lg border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-1"/><Slider label="Emission" value={selected.emissiveIntensity ?? 0} max={5} display={(selected.emissiveIntensity ?? 0).toFixed(1)} onChange={(v) => patch({ emissiveIntensity: v })}/></div></Section>
        <Section title="Surface pattern / hatch"><label className="grid grid-cols-[92px_1fr] items-center gap-2 text-[10px]"><span>Pattern</span><select value={selected.hatchStyle} onChange={(e) => patch({ hatchStyle: e.target.value as HatchStyle })} className={field}>{HATCHES.map((h) => <option key={h.id} value={h.id}>{h.glyph}  {h.label}</option>)}</select></label><div className="grid grid-cols-[92px_1fr] items-center gap-2 text-[10px]"><span>Sample</span><div className="h-12 rounded-lg border border-[var(--panel-divider)]" style={{ backgroundColor: selected.color, backgroundImage: hatchUrl ? `url(${hatchUrl})` : undefined, backgroundSize: hatchUrl ? `${sampleSizePx}px ${sampleSizePx}px` : undefined }}/></div><Slider label="Spacing" value={selected.hatchScaleMm ?? 200} min={25} max={2000} step={25} display={`${selected.hatchScaleMm ?? 200} mm`} onChange={(v) => patch({ hatchScaleMm: v })}/><Slider label="UV tiling" value={selected.tilingScale ?? 1} min={.1} max={10} step={.1} display={`${(selected.tilingScale ?? 1).toFixed(1)}×`} onChange={(v) => patch({ tilingScale: v })}/></Section>
        <div className="sticky bottom-0 grid grid-cols-2 gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl"><UnifiedButton size="sm" variant="primary" disabled={!hasSelection} onClick={assign} icon={<LuCheck/>}>Assign selected</UnifiedButton><UnifiedButton size="sm" variant="primary" onClick={() => setPaintId(paintId === selected.id ? null : selected.id)} icon={<LuSparkles/>} className={paintId === selected.id ? "ring-2 ring-amber-400/70" : ""}>{paintId === selected.id ? "Painting active" : "Paint in view"}</UnifiedButton></div>
      </div>
    </div>
  </div>;
}
