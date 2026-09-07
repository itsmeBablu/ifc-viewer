"use client";

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
  return <div className="space-y-3 text-xs">
    <strong>{isPlan ? "Floor plan" : preset === "free" ? "3D view" : preset === "section" ? "Section" : `Elevation · ${preset}`}</strong>
    {level && <label className="block">Level name<input aria-label="Level name" className={field} value={level.name} onChange={e => void layout.updateLevel(level.id, { name: e.target.value })}/></label>}
    <label className="block">Visual style<select className={field} value={isPlan && plan ? plan.visualStyle ?? "inherit" : renderMode} onChange={e => {
      const style = e.target.value as "realistic" | "light" | "wireframe" | "inherit";
      if (isPlan && plan) update({ visualStyle: style === "inherit" ? undefined : style });
      else if (style !== "inherit") useAppStore.getState().setRenderMode(style);
    }}>{isPlan && plan && <option value="inherit">Use workspace style ({renderMode})</option>}{["realistic", "light", "wireframe"].map(style => <option key={style} value={style}>{style}</option>)}</select></label>
    {plan && level && <>
      {!isPlan && <p className="text-[var(--text-muted)]">These range and visibility settings apply to {level.name}’s plan view.</p>}
      <strong className="block">View range · offsets from level (mm)</strong>
      {([['topMm', 'Top'], ['cutMm', 'Cut plane'], ['bottomMm', 'Bottom']] as const).map(([key, label]) => {
        const min = key === "topMm" ? plan.cutMm : key === "cutMm" ? plan.bottomMm : Math.min(-10000, plan.bottomMm);
        const max = key === "bottomMm" ? plan.cutMm : key === "cutMm" ? plan.topMm : Math.max(10000, plan.topMm);
        const change = (raw: string) => { if (!raw.trim()) return; const value = Number(raw); if (Number.isFinite(value)) update({ [key]: Math.max(min, Math.min(max, value)) }); };
        return <label key={key} className="block">{label}<div className="flex gap-2"><input aria-label={`${label} slider`} className="min-w-0 flex-1" type="range" min={min} max={max} step={10} value={plan[key]} onChange={e => change(e.target.value)}/><input aria-label={`${label} millimetres`} className={`${field} !w-24`} type="number" min={min} max={max} value={plan[key]} onChange={e => change(e.target.value)}/></div></label>;
      })}
      <p className="text-[10px] text-[var(--text-muted)]">Bottom ≤ Cut plane ≤ Top. View depth currently follows Bottom.</p>
      <fieldset className="space-y-1"><legend className="font-semibold">Model categories</legend>{[...categories].sort().map(category => <label key={category} className="flex gap-2"><input type="checkbox" checked={!plan.hiddenCategories.includes(category)} onChange={e => update({ hiddenCategories: e.target.checked ? plan.hiddenCategories.filter(c => c !== category) : [...plan.hiddenCategories, category] })}/>{category}</label>)}{!categories.size && <p>No model elements yet.</p>}</fieldset>
      <fieldset className="space-y-1"><legend className="font-semibold">CAD / PDF references</legend>{layout.underlays.filter(u => u.levelId === level.id).map(u => <label key={u.id} className="flex gap-2"><input type="checkbox" checked={!plan.hiddenUnderlayIds.includes(u.id)} onChange={e => update({ hiddenUnderlayIds: e.target.checked ? plan.hiddenUnderlayIds.filter(id => id !== u.id) : [...plan.hiddenUnderlayIds, u.id] })}/>{u.sourceName}</label>)}{!layout.underlays.some(u => u.levelId === level.id) && <p>No references attached to this level. Attach them from Layout.</p>}</fieldset>
    </>}
  </div>;
}
