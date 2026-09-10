"use client";

import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { openingOrientationLabel, type OpeningOrientation } from "@/lib/openingOrientation";

export default function OpeningOrientationControls({ kind, draft = false }: { kind: "door" | "window"; draft?: boolean }) {
  const store = useLayoutDrawingStore();
  const item = kind === "door" ? store.doors.find(d => d.id === store.selectedDoorId) : store.windows.find(w => w.id === store.selectedWindowId);
  const value = draft ? store.draftOpeningOrientation[kind] : item;
  if (!value) return null;
  const update = (patch: Partial<OpeningOrientation>) => {
    if (draft) store.setDraftOpeningOrientation(kind, patch);
    else if (item) {
      if (kind === "door") void store.updateDoor(item.id, patch);
      else void store.updateWindow(item.id, patch);
    }
  };
  const supportsAngle = kind === "door"
    ? !["sliding", "garage"].includes((draft ? store.draftElementTypes.door?.doorStyle : store.doors.find(d => d.id === item?.id)?.style) ?? "wood")
    : (draft ? store.draftElementTypes.window?.windowOperation : store.windows.find(w => w.id === item?.id)?.operation) === "casement";
  return <div className={draft ? "flex items-center gap-2 whitespace-nowrap text-[10px]" : "rounded border border-[var(--panel-divider)] p-2 text-[10px] space-y-1.5"}>
    <p className="font-semibold">{openingOrientationLabel(value)}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="rounded border border-[var(--panel-divider)] px-2 py-1" onClick={() => update({ swing: value.swing === -1 ? 1 : -1 })}>Flip inside / outside</button>
      <button type="button" className="rounded border border-[var(--panel-divider)] px-2 py-1" onClick={() => update({ hinge: value.hinge === "end" ? "start" : "end" })}>Flip left / right</button>
    </div>
    {supportsAngle && <label className={draft ? "flex items-center gap-2" : "flex flex-col gap-1.5 border-t border-[var(--panel-divider)] pt-2"}>
      <span className="flex items-center justify-between font-semibold"><span>3D opening angle</span><span>{value.openingAngleDeg ?? 0}°</span></span>
      <div className="flex items-center gap-2">
        <input className="min-w-0 flex-1" aria-label={`${kind} opening angle`} type="range" min={0} max={120} step={5} value={value.openingAngleDeg ?? 0} onChange={e => update({ openingAngleDeg: Number(e.target.value) })} />
        <input className="w-14 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1 py-0.5 text-right" aria-label={`${kind} opening angle degrees`} type="number" min={0} max={120} step={5} value={value.openingAngleDeg ?? 0} onChange={e => update({ openingAngleDeg: Math.max(0, Math.min(120, Number(e.target.value) || 0)) })} />
        <span>°</span>
      </div>
    </label>}
    <p className="text-[var(--text-muted)]">{draft ? "Space: cycle" : "Space cycles facing and hinge. Inside/outside follows the wall direction."}</p>
  </div>;
}
