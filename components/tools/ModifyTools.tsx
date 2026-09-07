"use client";
import { useState } from "react";
import { useModifyStore, type ModifyTool } from "@/store/useModifyStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { currentModifySelection, refreshGroupDefinition, saveNamedGroup, transformElements } from "@/lib/modifyOperations";
import { selectionKey, type SelectionLevel } from "@/lib/modifySelection";
import { Matrix4 } from "three";

export function activateModifyTool(tool: ModifyTool) {
  // Changing modify modes must not erase the primary selection or the boundary session.
  useLayoutDrawingStore.setState({ armedLayoutTool: null });
  useToolMarkupStore.getState().setArmedTool(null);
  useModifyStore.getState().activate(tool);
}
export default function ModifyTools() {
  const state = useModifyStore();
  const groups = useLayoutDrawingStore(s => s.groups);
  const selection = useLayoutDrawingStore(s => s.selectedElements);
  const editingGroup = useLayoutDrawingStore(s => s.activeGroupId);
  const boundaryEdit = useLayoutDrawingStore(s => s.slabBoundaryEdit);
  const naming = state.requestGroupName;
  const setNaming = (requestGroupName: boolean) => useModifyStore.setState({ requestGroupName });
  const [name, setName] = useState("");
  const group = groups.find(g => selection.some(ref => g.elementRefs.some(r => selectionKey(r) === selectionKey(ref))));
  const report = async (work: () => Promise<unknown>) => {
    useModifyStore.setState({ busy: true, message: null });
    try { await work(); } catch (e) { useModifyStore.setState({ message: e instanceof Error ? e.message : "Operation failed." }); }
    finally { useModifyStore.setState({ busy: false }); }
  };
  if (boundaryEdit) return null;
  const button = "rounded-lg border border-[var(--panel-divider)] px-2 py-1 text-[11px] disabled:opacity-40";
  const hints: Record<ModifyTool, string> = {
    attachTop: "Select walls, then click the roof to attach their tops.",
    attachBase: "Select walls, then click the roof to attach their bases.",
    joinRoof: "Pick the source roof boundary edge, then the target roof top face.",
    select: "Pick elements, faces, edges or vertices. Shift adds to selection.",
    move: "Drag an axis arrow, or the center to move in the view plane. Alt bypasses snapping.",
    rotate: "Drag the rotation ring. Groups rotate together.",
    align: state.reference ? "Pick target features to align with the highlighted reference." : "Pick a reference face, edge or vertex first, then the target feature.",
    mirror: "Select elements. Pick an edge axis or draw the axis with two points.",
    split: "Click inside a wall or sketch line to split it into two elements.",
  };
  return <div className="flex flex-wrap items-center gap-1" aria-label="Modify toolkit">
    {(["select", "move", "rotate", "align", "mirror", "split"] as const).map(tool => <button key={tool} type="button" disabled={state.busy} aria-pressed={state.tool === tool} className={`${button} ${state.tool === tool ? "bg-yellow-400/20 text-yellow-500" : ""}`} onClick={() => activateModifyTool(tool)}>{tool[0].toUpperCase() + tool.slice(1)}</button>)}
    {([['attachTop', 'Attach Top'], ['attachBase', 'Attach Base'], ['joinRoof', 'Join Roof']] as const).map(([tool, label]) => <button key={tool} className={button} disabled={state.busy} onClick={() => activateModifyTool(tool)}>{label}</button>)}
    <button className={button} disabled={state.busy} onClick={() => void report(async () => {
      const layout = useLayoutDrawingStore.getState();
      for (const ref of currentModifySelection()) {
        if (ref.kind === "wall") await layout.updateWall(ref.id, { attachedTopRoofId: undefined, attachedBaseRoofId: undefined });
        const roof = layout.slabs.find(s => s.id === ref.id);
        if (roof?.roofJoin) {
          const boundary = roof.roofJoin.originalBoundary;
          await layout.updateSlab(roof.id, { boundary, roofJoin: undefined, minXmm: Math.min(...boundary.map(p => p.xMm)), maxXmm: Math.max(...boundary.map(p => p.xMm)), minYmm: Math.min(...boundary.map(p => p.yMm)), maxYmm: Math.max(...boundary.map(p => p.yMm)) });
        }
      }
    })}>Detach / Unjoin</button>
    <select aria-label="Selection level" value={state.level} onChange={e => useModifyStore.setState({ level: e.target.value as SelectionLevel, selection: null })} className={`${button} bg-[var(--surface-overlay)]`}>
      {(["element", "face", "edge", "vertex"] as const).map(level => <option key={level} value={level}>{level[0].toUpperCase() + level.slice(1)}</option>)}
    </select>
    {state.tool === "mirror" && <>
      <select aria-label="Mirror axis method" value={state.mirrorAxis} onChange={e => useModifyStore.setState({ mirrorAxis: e.target.value as "draw" | "pick" })} className={`${button} bg-[var(--surface-overlay)]`}><option value="draw">Draw axis</option><option value="pick">Pick axis</option></select>
      <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={state.mirrorCopy} onChange={e => useModifyStore.setState({ mirrorCopy: e.target.checked })} />Copy</label>
    </>}
    <button type="button" disabled={state.busy} className={button} onClick={() => void report(() => transformElements(currentModifySelection(), new Matrix4().makeTranslation(0.1, 0, 0.1), true))}>Copy</button>
    <button type="button" disabled={state.busy} className={button} onClick={() => { setNaming(!naming); setName(""); }}>Group</button>
    {naming && <form className="flex items-center gap-1" onSubmit={e => { e.preventDefault(); void report(async () => { await saveNamedGroup(name); setNaming(false); }); }}><input autoFocus aria-label="Group name" placeholder="Group name" value={name} onChange={e => setName(e.target.value)} className={`${button} w-28 bg-[var(--surface-overlay)]`} /><button type="submit" disabled={state.busy} className={button}>Save group</button><button type="button" onClick={() => setNaming(false)} className={button}>Cancel</button></form>}
    {group && !editingGroup && <><button type="button" className={button} onClick={() => useLayoutDrawingStore.getState().enterGroupEdit(group.id)}>Edit group</button><button type="button" className={button} onClick={() => void report(() => useLayoutDrawingStore.getState().ungroup(group.id))}>Ungroup</button></>}
    {editingGroup && <button type="button" className={button} onClick={() => void report(() => refreshGroupDefinition(editingGroup))}>Finish group</button>}
    {!!groups.length && <select aria-label="Place saved group" className={`${button} max-w-36 bg-[var(--surface-overlay)]`} value={state.placingGroupId ?? ""} onChange={e => { activateModifyTool("select"); useModifyStore.setState({ placingGroupId: e.target.value || null }); }}><option value="">Place group…</option>{groups.filter(g => g.isTemplate || !g.definitionId).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>}
    <span role="status" className={`max-w-lg text-[10px] ${state.message ? "text-amber-500" : "text-[var(--text-muted)]"}`}>{state.busy ? "Saving…" : state.message ?? (state.placingGroupId ? "Click in the plan to place the saved group. Escape exits." : hints[state.tool])}</span>
  </div>;
}
