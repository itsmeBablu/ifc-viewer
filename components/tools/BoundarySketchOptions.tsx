"use client";

import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";

export default function BoundarySketchOptions() {
  const edit = useLayoutDrawingStore(s => s.slabBoundaryEdit);
  const setTool = useLayoutDrawingStore(s => s.setBoundaryEditTool);
  if (!edit) return null;
  const hints = {
    modify: "Drag squares to move vertices. Select an edge, then drag its yellow endpoints to extend. Alt bypasses snapping.",
    trim: "Click two edges on the portions to keep. Both join at their intersection.",
    insert: "Click an edge to insert a vertex.",
    delete: "Click a vertex to remove it. Invalid changes are blocked.",
  };
  return <div className="flex flex-wrap items-center gap-2 text-[11px]" aria-label="Boundary sketch tools">
    <strong className="text-pink-500">Edit Boundary</strong>
    {([["modify", "Modify"], ["trim", "Trim / Extend"], ["insert", "Insert vertex"], ["delete", "Remove vertex"]] as const).map(([tool, label]) =>
      <button key={tool} type="button" aria-pressed={edit.tool === tool} onClick={() => setTool(tool)} className={`rounded border px-2 py-1 ${edit.tool === tool ? "border-pink-500 bg-pink-500/20 text-pink-500" : "border-[var(--panel-divider)]"}`}>{label}</button>)}
    <button type="button" onClick={() => void useLayoutDrawingStore.getState().commitSlabBoundaryEdit()} className="rounded border border-emerald-500 px-2 py-1 text-emerald-500">Finish</button>
    <button type="button" onClick={() => useLayoutDrawingStore.getState().cancelSlabBoundaryEdit()} className="rounded border border-rose-500 px-2 py-1 text-rose-500">Cancel</button>
    <span role="status" className={edit.error ? "text-rose-500" : "text-[var(--text-muted)]"}>{edit.error ?? hints[edit.tool]}</span>
  </div>;
}
