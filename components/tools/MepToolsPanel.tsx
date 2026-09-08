"use client";

import { useState } from "react";
import { LuWind, LuDroplets, LuZap, LuBox, LuSearch, LuCheck, LuMousePointer2, LuCable, LuPlus } from "react-icons/lu";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { COMPONENT_CATALOG } from "@/lib/componentCatalog";
import type { LayoutToolId } from "@/lib/layoutDrawing";

const disciplines = [
  { id: "all", label: "All", icon: LuBox },
  { id: "hvac", label: "HVAC", icon: LuWind },
  { id: "piping", label: "Piping", icon: LuDroplets },
  { id: "electrical", label: "Electrical", icon: LuZap },
] as const;
const routes = [
  { id: "duct", label: "Duct", hint: "Rigid air distribution", domain: "hvac", icon: LuWind },
  { id: "flex_duct", label: "Flex duct", hint: "Flexible connection", domain: "hvac", icon: LuWind },
  { id: "pipe", label: "Pipe", hint: "Water, heating & drainage", domain: "piping", icon: LuDroplets },
  { id: "cabletray", label: "Tray / conduit", hint: "Cable containment", domain: "electrical", icon: LuCable },
  { id: "wire", label: "Wire", hint: "Power, lighting & data", domain: "electrical", icon: LuZap },
] as const;
const field = "h-9 w-full rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-xs text-[var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-sky-400/50";
const card = "rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-overlay)]/40 p-3 space-y-3";

function NumberField({ label, value, onChange, min }: { label: string; value: number; onChange: (value: number) => void; min?: number }) {
  return <label className="space-y-1 block"><span className="text-[10px] text-[var(--text-muted)]">{label}</span><input className={field} type="number" min={min} value={value} onChange={e => { if (e.target.value !== "" && Number.isFinite(e.target.valueAsNumber)) onChange(e.target.valueAsNumber); }} /></label>;
}

export default function MepToolsPanel() {
  const s = useLayoutDrawingStore();
  const levelId = useToolMarkupStore(state => state.markupFloorId);
  const [search, setSearch] = useState("");
  const category = s.desktopMepCategory;
  const domain = category === "wiring" ? "electrical" : category;
  const tool = s.armedLayoutTool;
  const isDuct = tool === "duct" || tool === "flex_duct" || tool === "mep_placeholder";
  const isPipe = tool === "pipe", isTray = tool === "cabletray", isWire = tool === "wire";
  const drawing = s.ductDraw || s.pipeDraw || s.cableTrayDraw || s.wireDraw;
  const level = s.levels.find(l => l.id === levelId) ?? s.levels[0];
  const arm = (next: LayoutToolId) => { s.setMepModeActive(true); s.setArmedLayoutTool(next); };
  const finish = () => { s.cancelDuctDraw(); s.cancelPipeDraw(); s.cancelCableTrayDraw(); s.cancelWireDraw(); s.setArmedLayoutTool(null); };
  const fixtures = COMPONENT_CATALOG.filter(item => item.id.startsWith("mep-") &&
    (domain === "all" || domain === "components" || (domain === "hvac" ? item.room === "HVAC" : domain === "piping" ? ["Plumbing", "Heating"].includes(item.room) : item.room === "Electrical")) &&
    `${item.name} ${item.room}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 text-xs thin-scroll">
    <div className="rounded-xl border border-sky-400/25 bg-gradient-to-br from-sky-400/15 to-transparent p-3">
      <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[.16em] text-sky-400">MEP workspace</span><span className="truncate text-[10px] text-[var(--text-muted)]">{level?.name ?? "Choose a level"}</span></div>
      <p className="mt-2 text-base font-semibold text-[var(--text-strong)]">Route. Connect. Place.</p>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">Draw services and place equipment on the active level.</p>
    </div>
    <div className="grid grid-cols-4 gap-1" aria-label="MEP discipline">{disciplines.map(({id,label,icon:Icon}) => <button type="button" key={id} aria-pressed={domain === id} onClick={() => s.setDesktopMepCategory(id)} className={`flex flex-col items-center gap-1.5 rounded-xl border py-2.5 text-[10px] transition-colors ${domain === id ? "border-sky-400/60 bg-sky-400/15 text-sky-400" : "border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-overlay)]"}`}><Icon className="h-4 w-4"/>{label}</button>)}</div>
    <section className={card}><h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">01 / Draw a service</h3>
      <div className="grid grid-cols-2 gap-2">{routes.filter(r => domain === "all" || domain === "components" || r.domain === domain).map(({id,label,hint,icon:Icon}) => <button type="button" key={id} aria-pressed={tool === id} onClick={() => arm(id)} className={`rounded-lg border p-2.5 text-left transition-colors ${tool === id ? "border-sky-400 bg-sky-400/10 text-sky-400" : "border-[var(--panel-divider)] text-[var(--text-strong)] hover:border-sky-400/50"}`}><Icon className="mb-2 h-4 w-4"/><span className="block font-semibold">{label}</span><span className="mt-1 block text-[9px] leading-snug text-[var(--text-muted)]">{hint}</span></button>)}</div>
      <label className="flex items-center justify-between gap-2 text-[11px]"><span>Continuous run</span><input type="checkbox" checked={s.mepChainDrawing} onChange={e => s.setMepChainDrawing(e.target.checked)} className="accent-sky-400"/></label>
      <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">Click a start point, then each bend. Matching endpoints connect automatically; a connected end finishes the run. Duct and pipe fittings appear at junctions.</p>
      <button type="button" disabled={!drawing} onClick={finish} className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-400 px-3 py-2 font-semibold text-slate-950 disabled:opacity-35"><LuCheck/>Finish run</button>
    </section>
    {(isDuct || isPipe || isTray || isWire || tool === "equipment") && <section className={card}><h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Route & placement settings</h3>
      {isDuct && <><label className="block space-y-1"><span>Profile</span><select className={field} value={s.draftDuctShape} onChange={e => s.setDraftDuctShape(e.target.value as typeof s.draftDuctShape)}>{["round","rectangular","oval"].map(v => <option key={v}>{v}</option>)}</select></label><div className="grid grid-cols-2 gap-2">{s.draftDuctShape === "round" ? <NumberField label="Diameter (mm)" min={1} value={s.draftDuctDiameterMm} onChange={v => s.setDraftDuctSize(s.draftDuctWidthMm,s.draftDuctHeightMm,Math.max(1,v))}/> : <><NumberField label="Width (mm)" min={1} value={s.draftDuctWidthMm} onChange={v => s.setDraftDuctSize(Math.max(1,v),s.draftDuctHeightMm,s.draftDuctDiameterMm)}/><NumberField label="Height (mm)" min={1} value={s.draftDuctHeightMm} onChange={v => s.setDraftDuctSize(s.draftDuctWidthMm,Math.max(1,v),s.draftDuctDiameterMm)}/></>}</div><label className="block space-y-1"><span>Air system</span><select className={field} value={s.draftDuctSystem} onChange={e => s.setDraftDuctSystem(e.target.value as typeof s.draftDuctSystem)}>{["supply","return","extract","exhaust","outdoor"].map(v => <option key={v}>{v}</option>)}</select></label></>}
      {isPipe && <><NumberField label="Diameter (mm)" min={10} value={s.draftPipeDiameterMm} onChange={s.setDraftPipeDiameterMm}/><label className="block space-y-1"><span>Pipe system</span><select className={field} value={s.draftPipeSystem} onChange={e => s.setDraftPipeSystem(e.target.value as typeof s.draftPipeSystem)}>{["hydronic_supply","hydronic_return","domestic_cold","domestic_hot","sanitary_waste","fire_protection","gas"].map(v => <option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}</select></label></>}
      {isTray && <><label className="block space-y-1"><span>Containment type</span><select className={field} value={s.draftCableTrayType} onChange={e => s.setDraftCableTrayType(e.target.value as typeof s.draftCableTrayType)}>{["ladder","perforated","wire_mesh","conduit"].map(v => <option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}</select></label><div className="grid grid-cols-2 gap-2"><NumberField label={s.draftCableTrayType === "conduit" ? "Diameter (mm)" : "Width (mm)"} min={20} value={s.draftCableTrayWidthMm} onChange={s.setDraftCableTrayWidthMm}/>{s.draftCableTrayType !== "conduit" && <NumberField label="Height (mm)" min={20} value={s.draftCableTrayHeightMm} onChange={s.setDraftCableTrayHeightMm}/>}</div></>}
      {isWire && <><label className="block space-y-1"><span>Circuit</span><select className={field} value={s.draftWireSystem} onChange={e => s.setDraftWireSystem(e.target.value as typeof s.draftWireSystem)}>{["power","lighting","data","control"].map(v => <option key={v}>{v}</option>)}</select></label><label className="block space-y-1"><span>Wire gauge</span><input className={field} value={s.draftWireGauge} onChange={e => s.setDraftWireGauge(e.target.value)}/></label></>}
      {!isWire && <NumberField label="Elevation above level (mm)" value={isDuct ? s.draftDuctElevationMm : isPipe ? s.draftPipeElevationMm : isTray ? s.draftCableTrayElevationMm : s.draftEquipmentElevationMm} onChange={isDuct ? s.setDraftDuctElevationMm : isPipe ? s.setDraftPipeElevationMm : isTray ? s.setDraftCableTrayElevationMm : s.setDraftEquipmentElevationMm}/>}
      {drawing && <p className="text-[10px] text-[var(--text-muted)]">Changes apply to the next run. Finish this run to use new settings.</p>}
    </section>}
    <section className={card}><h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">02 / Fixtures & equipment</h3><label className="relative block"><LuSearch className="absolute left-2.5 top-3 text-[var(--text-muted)]"/><input aria-label="Search MEP fixtures" placeholder="Search fixtures…" value={search} onChange={e => setSearch(e.target.value)} className={`${field} pl-8`}/></label>
      <div className="space-y-1">{fixtures.map(item => <button type="button" key={item.id} aria-pressed={tool === "equipment" && s.draftComponentId === item.id} onClick={() => { s.chooseComponent(item.id); arm("equipment"); }} className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left ${tool === "equipment" && s.draftComponentId === item.id ? "border-sky-400/60 bg-sky-400/10" : "border-transparent hover:bg-[var(--surface-overlay)]"}`}><LuBox className="h-4 w-4 shrink-0 text-sky-400"/><span className="min-w-0 flex-1"><span className="block font-medium text-[var(--text-strong)]">{item.name}</span><span className="text-[9px] text-[var(--text-muted)]">{item.widthMm} × {item.depthMm} × {item.heightMm} mm</span></span><LuPlus className="shrink-0 text-[var(--text-muted)]"/></button>)}{!fixtures.length && <p className="py-3 text-[var(--text-muted)]">No matching fixtures.</p>}</div>
      <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">Click to place. Space rotates the fixture. Duct and pipe connectors snap to nearby open ends.</p>
    </section>
    <button type="button" onClick={finish} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--panel-divider)] p-2 text-[var(--text-muted)]"><LuMousePointer2/>Return to selection</button>
  </div>;
}
