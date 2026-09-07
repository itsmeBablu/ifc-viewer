"use client";

import { useState } from "react";
import { COMPONENT_CATALOG, componentPreset, isArchitecturalComponent } from "@/lib/componentCatalog";
import type { LayoutMepEquipment } from "@/lib/layoutDrawing";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";

export function ComponentLibrary({ item, onChoose }: { item?: LayoutMepEquipment; onChoose?: () => void }) {
  const store = useLayoutDrawingStore();
  const [search, setSearch] = useState("");
  const [room, setRoom] = useState("All");
  const architecture = item ? isArchitecturalComponent(item.familyId) || item.category === "furniture" : !store.mepModeActive;
  const catalog = COMPONENT_CATALOG.filter((p) => architecture === isArchitecturalComponent(p.id));
  const rooms = [...new Set(catalog.map((p) => p.room))];
  return <div className="space-y-1.5">
    <div className="grid grid-cols-2 gap-1">
      <input aria-label="Find component" placeholder="Find component…" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-0 rounded border border-[var(--panel-divider)] bg-[var(--surface-card)] px-2 py-1.5 text-[11px]" />
      <select aria-label="Component room or system" value={room} onChange={(e) => setRoom(e.target.value)} className="min-w-0 rounded border border-[var(--panel-divider)] bg-[var(--surface-card)] px-1 text-[11px]"><option>All</option>{rooms.map((r) => <option key={r}>{r}</option>)}</select>
    </div>
    <div className="max-h-52 space-y-0.5 overflow-y-auto thin-scroll">
      {catalog.filter((p) => (room === "All" || p.room === room) && `${p.name} ${p.room}`.toLowerCase().includes(search.toLowerCase())).map((p) => <button type="button" key={p.id} aria-pressed={(item?.familyId ?? store.draftComponentId) === p.id} onClick={() => {
        if (item) void store.updateEquipment(item.id, { familyId: p.id, name: p.name, category: p.category, widthMm: p.widthMm, depthMm: p.depthMm, heightMm: p.heightMm });
        else store.chooseComponent(p.id);
        onChoose?.();
      }} className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[10px] ${(item?.familyId ?? store.draftComponentId) === p.id ? "bg-yellow-400/20 text-yellow-600" : "hover:bg-[var(--surface-overlay)]"}`}><span><strong className="block font-semibold">{p.name}</strong><span className="text-[9px] text-[var(--text-muted)]">{p.room}</span></span><span className="text-right font-mono text-[9px] text-[var(--text-muted)]">{p.widthMm} × {p.depthMm}<br/>{p.heightMm} mm high</span></button>)}
    </div>
  </div>;
}

export default function ComponentProperties({ item }: { item?: LayoutMepEquipment }) {
  const store = useLayoutDrawingStore();
  const markup = useToolMarkupStore();
  const preset = componentPreset(item?.familyId ?? store.draftComponentId);
  const isPlan = (markup.quadView ? markup.quadPresets[markup.quadActiveIndex] : markup.viewPreset) === "top";
  const currentLevel = store.levels.find((l) => l.id === markup.markupFloorId) ?? store.levels[0];
  const levelId = item?.levelId ?? (isPlan ? currentLevel?.id : store.componentPlacementLevelId) ?? "";
  const field = "h-7 w-full min-w-0 rounded border border-[var(--panel-divider)] bg-[var(--surface-card)] px-1.5 text-[11px] text-[var(--text-strong)]";
  const update = (patch: Partial<LayoutMepEquipment>) => { if (item) void store.updateEquipment(item.id, patch); };
  return <div className="space-y-2">
    <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{item ? "Component type" : store.mepModeActive ? "MEP components" : "Architectural components"}</p>
    <ComponentLibrary item={item} />
    <div className="space-y-1 border-t border-[var(--panel-divider)] pt-2">
      <label className="block text-[10px]">Base level<select aria-label="Component base level" className={field} value={levelId} disabled={!item && isPlan} onChange={(e) => item ? update({ levelId: e.target.value }) : useLayoutDrawingStore.setState({ componentPlacementLevelId: e.target.value || null })}><option value="">Select a level to place in 3D</option>{store.levels.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.elevationMm} mm</option>)}</select></label>
      {!item && !levelId && <p className="text-[10px] text-amber-600">Choose a base level before placing the component.</p>}
      <div className="grid grid-cols-2 gap-1.5">
        {([['Width', 'widthMm', 'draftComponentWidthMm'], ['Depth', 'depthMm', 'draftComponentDepthMm'], ['Height', 'heightMm', 'draftComponentHeightMm'], ['Base offset', 'elevationMm', 'draftEquipmentElevationMm']] as const).map(([label, key, draft]) => <label key={key} className="text-[10px]">{label} (mm)<input type="number" className={field} min={key === "elevationMm" ? undefined : 100} value={item?.[key] ?? store[draft]} onChange={(e) => { const value = Math.max(key === "elevationMm" ? -100000 : 100, Number(e.target.value)); if (item) update({ [key]: value }); else useLayoutDrawingStore.setState({ [draft]: value }); }} /></label>)}
        <label className="text-[10px]">Rotation (°)<input type="number" className={field} step={90} value={item?.rotationDeg ?? store.draftEquipmentRotationDeg} onChange={(e) => item ? update({ rotationDeg: Number(e.target.value) }) : store.setDraftEquipmentRotationDeg(Number(e.target.value))}/></label>
        <button type="button" className="self-end rounded border border-[var(--panel-divider)] px-1 py-1.5 text-[10px]" onClick={() => item ? update({ rotationDeg: ((item.rotationDeg ?? 0) + 90) % 360 }) : store.setDraftEquipmentRotationDeg((store.draftEquipmentRotationDeg + 90) % 360)}>Rotate 90° · Space</button>
        {preset?.id.startsWith("kitchen-") && <label className="col-span-2 text-[10px]">Kitchen module width (mm)<select className={field} value={item?.moduleWidthMm ?? store.draftComponentModuleMm} onChange={(e) => item ? update({ moduleWidthMm: Number(e.target.value) }) : useLayoutDrawingStore.setState({ draftComponentModuleMm: Number(e.target.value) })}>{[300, 400, 450, 500, 600, 800, 900].map((size) => <option key={size}>{size}</option>)}</select></label>}
      </div>
      {!item && <p className="text-[10px] text-[var(--text-muted)]">Click to place repeatedly. Space rotates 90°. Snap to walls and adjacent components; hold Alt for free placement.</p>}
      {item && <div className="flex gap-3 pt-1 text-[10px]"><button type="button" onClick={() => void store.duplicateEquipment(item.id)}>Duplicate</button><button type="button" onClick={() => void store.deleteEquipment(item.id)} className="text-red-500">Delete</button></div>}
    </div>
  </div>;
}
