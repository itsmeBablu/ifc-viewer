"use client";

import RenderViewControls, { enterRenderView, exitRenderView } from "./RenderViewControls";
import { useViewDisplayStore, viewDisplayKey, EMPTY_VIEW_VISIBILITY } from "@/store/useViewDisplayStore";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { objectCategory, planViewSettings } from "@/lib/planView";
import { useModelScene } from "./WerkzeugModelSceneContext";

export default function ViewPropertiesPanel() {
  const layout = useLayoutDrawingStore();
  const markup = useToolMarkupStore();
  const renderMode = useAppStore(s => s.renderMode);
  const { shellGroup } = useModelScene();
  const preset = markup.quadView ? markup.quadPresets[markup.quadActiveIndex] : markup.viewPreset;
  const level = layout.levels.find(l => l.id === markup.markupFloorId);
  const plan = level ? planViewSettings(level) : null;
  const isPlan = preset === "top";
  const display = useViewDisplayStore();
  const viewKey = viewDisplayKey(preset, markup.markupFloorId, layout.activeSectionId);
  const visibility = display.views[viewKey] ?? EMPTY_VIEW_VISIBILITY;
  const field = "w-full rounded border border-[var(--panel-divider)] bg-transparent px-2 py-1 text-xs";
  const categories = new Set<string>();
  const collections = [
    ["Walls", layout.walls], ["Doors", layout.doors], ["Windows", layout.windows],
    ["Floors / Roofs", layout.slabs], ["Columns", layout.columns], ["Beams", layout.beams],
    ["Stairs", layout.stairs], ["Ramps", layout.ramps], ["Ducts", layout.ducts],
    ["Pipes", layout.pipes], ["Cable trays", layout.cableTrays],
    ["Equipment / Furniture", layout.mepEquipment], ["Wires", layout.wires], ["Lines", layout.sketchLines],
    ["Markup", markup.placements],
  ] as const;
  for (const [name, rows] of collections) if (rows.length) categories.add(name);
  shellGroup?.traverse(obj => { const category = objectCategory(obj.userData); if (category) categories.add(category); });
  const update = (patch: Partial<NonNullable<typeof plan>>) => {
    if (level && plan) void layout.updateLevel(level.id, { planView: { ...plan, ...patch } });
  };
  const categoryRows = (hidden: string[], toggle: (category: string) => void) => <fieldset className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 py-1">
    {[...categories].sort().map((category, index) => <span key={category} className="inline-flex items-center gap-1.5">
      {index > 0 && <span aria-hidden="true" className="font-semibold text-amber-400">|</span>}
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded px-1 py-1 transition-colors hover:bg-amber-500/10">
        <input type="checkbox" checked={!hidden.includes(category)} onChange={() => toggle(category)} className="size-3.5 accent-amber-500" />
        <span className="font-medium text-[var(--text-body)]">{category}</span>
      </label>
    </span>)}
    {!categories.size && <p className="px-1 py-2 text-[10px] text-[var(--text-muted)]">No model elements in this view.</p>}
  </fieldset>;
  return <div className="compact-properties space-y-3 rounded-xl bg-[var(--surface-base)]/20 p-1 text-xs">
    <p className="property-caption">{isPlan ? "Floor plan" : preset === "free" ? "3D view" : preset === "section" ? "Section" : `Elevation · ${preset}`}</p>
    {level && <label className="property-field"><span>Level</span><input aria-label="Level name" className={field} value={level.name} onChange={e => void layout.updateLevel(level.id, { name: e.target.value })}/></label>}
    <label className="property-field"><span>Visual style</span><select className={field} value={isPlan && plan ? plan.visualStyle ?? "inherit" : renderMode} onChange={e => {
      if (e.target.value === "render") { enterRenderView(); return; }
      exitRenderView();
      const style = e.target.value as "realistic" | "fullColor" | "light" | "wireframe" | "inherit";
      if (isPlan && plan) update({ visualStyle: style === "inherit" ? undefined : style });
      else if (style !== "inherit") useAppStore.getState().setRenderMode(style);
    }}>{isPlan && plan && <option value="inherit">Use workspace style ({renderMode})</option>}{["realistic", "fullColor", "light", "wireframe", "render"].map(style => <option key={style} value={style}>{style}</option>)}</select></label>
    <details open className="property-disclosure p-1"><summary className="mb-1 cursor-pointer font-semibold text-[var(--text-strong)]">Visibility in current view</summary>{categoryRows(visibility.hiddenCategories, category => display.toggleCategory(viewKey, category))}<button type="button" className="mt-1 rounded-lg border border-amber-400/50 px-3 py-1.5 text-[10px] font-semibold text-amber-500 transition-colors hover:bg-amber-500/10" onClick={() => display.reset(viewKey)}>Reset current view</button></details>
    {plan && level && <>
      {!isPlan && <p className="text-[var(--text-muted)]">These range and visibility settings apply to {level.name}’s plan view.</p>}
      <details className="property-disclosure"><summary>View range <span className="property-summary-value">mm</span></summary>
      {([['topMm', 'Top'], ['cutMm', 'Cut plane'], ['bottomMm', 'Bottom']] as const).map(([key, label]) => {
        const min = key === "topMm" ? plan.cutMm : key === "cutMm" ? plan.bottomMm : Math.min(-10000, plan.bottomMm);
        const max = key === "bottomMm" ? plan.cutMm : key === "cutMm" ? plan.topMm : Math.max(10000, plan.topMm);
        const change = (raw: string) => { if (!raw.trim()) return; const value = Number(raw); if (Number.isFinite(value)) update({ [key]: Math.max(min, Math.min(max, value)) }); };
        return <label key={key} className="property-field"><span>{label}</span><input aria-label={`${label} millimetres`} className={field} type="number" min={min} max={max} value={plan[key]} onChange={e => change(e.target.value)}/></label>;
      })}
      <p className="text-[10px] text-[var(--text-muted)]">Bottom ≤ Cut plane ≤ Top. View depth currently follows Bottom.</p>
      </details>
      <details className="property-disclosure rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-card)]/60 p-2 shadow-sm"><summary className="mb-2 cursor-pointer font-semibold text-[var(--text-strong)]">Model visibility <span className="property-summary-value">{categories.size}</span></summary>{categoryRows(plan.hiddenCategories, category => update({ hiddenCategories: plan.hiddenCategories.includes(category) ? plan.hiddenCategories.filter(item => item !== category) : [...plan.hiddenCategories, category] }))}</details>
      <details className="property-disclosure"><summary>CAD / PDF references</summary><fieldset className="space-y-1">{layout.underlays.filter(u => u.levelId === level.id).map(u => <label key={u.id} className="flex gap-2"><input type="checkbox" checked={!plan.hiddenUnderlayIds.includes(u.id)} onChange={e => update({ hiddenUnderlayIds: e.target.checked ? plan.hiddenUnderlayIds.filter(id => id !== u.id) : [...plan.hiddenUnderlayIds, u.id] })}/>{u.sourceName}</label>)}{!layout.underlays.some(u => u.levelId === level.id) && <p>No references attached to this level. Attach them from Layout.</p>}</fieldset></details>
    </>}
    <RenderViewControls />
  </div>;
}
