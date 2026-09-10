"use client";

import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";

export default function BoundarySketchOptions() {
  const edit = useLayoutDrawingStore(s => s.slabBoundaryEdit);
  const slab = useLayoutDrawingStore(s => edit ? s.slabs.find(item => item.id === edit.slabId) : null);
  const setTool = useLayoutDrawingStore(s => s.setBoundaryEditTool);
  if (!edit) return null;
  const hints = {
    modify: "Drag squares to move vertices. Select an edge, then drag its yellow endpoints to extend. Alt bypasses snapping.",
    trim: "Click two edges on the portions to keep. Both join at their intersection.",
    insert: "Click an edge to insert a vertex.",
    delete: "Click a vertex to remove it. Invalid changes are blocked.",
  };
  const selectedEdge = edit.selectedEdge;
  const edge = slab?.kind === "roof" && selectedEdge?.ring === 0
    ? (slab.edgeSlopes ?? []).find(item => item.edgeIdx === selectedEdge.index) ?? { edgeIdx: selectedEdge.index, isSloped: true, pitchDeg: 30 }
    : null;
  const setEdge = (patch: { isSloped?: boolean; pitchDeg?: number }) => {
    if (!slab || !edge) return;
    const count = slab.boundary?.length ?? 0;
    const slopes = Array.from({ length: count }, (_, index) => slab.edgeSlopes?.find(item => item.edgeIdx === index) ?? { edgeIdx: index, isSloped: true, pitchDeg: 30 });
    void useLayoutDrawingStore.getState().updateSlab(slab.id, { edgeSlopes: slopes.map(item => item.edgeIdx === edge.edgeIdx ? { ...item, ...patch } : item) });
  };
  return <div className="flex flex-wrap items-center gap-2 text-[11px]" aria-label="Boundary sketch tools">
    <strong className="text-pink-500">Edit Boundary</strong>
    {([["modify", "Modify"], ["trim", "Trim / Extend"], ["insert", "Insert vertex"], ["delete", "Remove vertex"]] as const).map(([tool, label]) =>
      <button key={tool} type="button" aria-pressed={edit.tool === tool} onClick={() => setTool(tool)} className={`rounded border px-2 py-1 ${edit.tool === tool ? "border-pink-500 bg-pink-500/20 text-pink-500" : "border-[var(--panel-divider)]"}`}>{label}</button>)}
    <button type="button" onClick={() => void useLayoutDrawingStore.getState().commitSlabBoundaryEdit()} className="rounded border border-emerald-500 px-2 py-1 text-emerald-500">Finish</button>
    <button type="button" onClick={() => useLayoutDrawingStore.getState().cancelSlabBoundaryEdit()} className="rounded border border-rose-500 px-2 py-1 text-rose-500">Cancel</button>
    <button type="button" onClick={() => useLayoutDrawingStore.getState().beginSlabRedraw(edit.slabId)} className="rounded border border-sky-400/60 px-2 py-1 text-sky-500" title="Replace this roof or floor with connected line segments">Redraw with lines</button>
    {slab?.kind === "roof" && <div className="flex items-center gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1">
      <span className="font-semibold text-amber-400">{edge ? `Edge ${(edge.edgeIdx ?? 0) + 1}` : "Select an edge"}</span>
      {edge && <><label className="flex items-center gap-1"><input type="checkbox" checked={edge.isSloped !== false} onChange={e => setEdge({ isSloped: e.target.checked })} /> slope</label><input aria-label="Selected roof edge angle" className="w-14 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1 py-0.5 text-right" type="number" min={0} max={85} step={1} value={edge.pitchDeg ?? 30} disabled={edge.isSloped === false} onChange={e => setEdge({ pitchDeg: Number(e.target.value) })} /><span>°</span></>}
    </div>}
    {slab?.kind === "floor" && <span className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-sky-500">Floor boundary · select lines and redraw; edge angles are disabled</span>}
    <span role="status" className={edit.error ? "text-rose-500" : "text-[var(--text-muted)]"}>{edit.error ?? hints[edit.tool]}</span>
  </div>;
}
