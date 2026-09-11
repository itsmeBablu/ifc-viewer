"use client";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { mepRunKind } from "@/lib/drawingInteraction";

export default function MepPlacementControls() {
  const s = useLayoutDrawingStore();
  const floorId = useToolMarkupStore(s => s.markupFloorId);
  const kind = mepRunKind(s.armedLayoutTool);
  if (!kind && s.armedLayoutTool !== "equipment") return null;
  const draw = kind === "duct" ? s.ductDraw : kind === "pipe" ? s.pipeDraw : kind === "cabletray" ? s.cableTrayDraw : kind === "wire" ? s.wireDraw : null;
  const level = s.levels.find(l => l.id === (draw?.levelId ?? floorId)) ?? s.levels[0];
  const offset = draw?.elevationOffsetMm ?? (kind === "duct" ? s.draftDuctElevationMm : kind === "pipe" ? s.draftPipeElevationMm : kind === "cabletray" ? s.draftCableTrayElevationMm : kind === "wire" ? s.draftWireElevationMm : s.draftEquipmentElevationMm);
  const change = kind === "duct" ? s.setDraftDuctElevationMm : kind === "pipe" ? s.setDraftPipeElevationMm : kind === "cabletray" ? s.setDraftCableTrayElevationMm : kind === "wire" ? s.setDraftWireElevationMm : s.setDraftEquipmentElevationMm;
  return <div className="mep-placement-controls flex flex-wrap items-center gap-2 text-xs" aria-label="MEP placement location">
    <label>Level <select aria-label="Placement level" value={level?.id ?? ""} onChange={e => useToolMarkupStore.getState().setMarkupFloorId(e.target.value)}>{s.levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
    <label>Offset (mm) <input aria-label="Placement offset above level (mm)" type="number" value={offset} onChange={e => { if (e.target.value !== "" && Number.isFinite(e.target.valueAsNumber)) change(e.target.valueAsNumber); }} /></label>
    <span>Absolute {(level?.elevationMm ?? 0) + offset} mm · {kind ? "Centerline" : "Base"}</span>
  </div>;
}
