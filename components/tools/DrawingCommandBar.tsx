"use client";
import { useState } from "react";
import { useDrawingInteractionStore } from "@/store/useDrawingInteractionStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { LuCheck, LuX } from "react-icons/lu";

export default function DrawingCommandBar() {
  const tool = useLayoutDrawingStore((s) => s.armedLayoutTool);
  const editingSlabId = useLayoutDrawingStore((s) => s.editingSlabId);
  const sketchTargetKind = useLayoutDrawingStore((s) => s.sketchTargetKind);
  const sketchLines = useLayoutDrawingStore((s) => s.sketchLines);
  const state = useDrawingInteractionStore();
  const [error, setError] = useState<string | null>(null);

  if (tool !== "wall" && tool !== "lines") return null;

  const isBoundaryMode = Boolean(editingSlabId || sketchTargetKind);
  const modeLabel = state.busy
    ? "Saving…"
    : state.navigating
    ? "Navigate"
    : editingSlabId
    ? `Edit ${sketchTargetKind === "roof" ? "Roof" : "Floor"} Boundary`
    : sketchTargetKind
    ? `Draw ${sketchTargetKind === "roof" ? "Roof" : "Floor"}`
    : tool === "wall"
    ? "Draw walls"
    : "Draw lines";

  const handleFinish = async () => {
    setError(null);
    if (isBoundaryMode) {
      window.dispatchEvent(new CustomEvent("werkzeug-drawing-reset"));
      const res = await useLayoutDrawingStore.getState().convertSketchToSlab(sketchTargetKind || "floor");
      if (!res.success && res.error) {
        setError(res.error);
      }
    } else {
      window.dispatchEvent(new CustomEvent("werkzeug-drawing-reset"));
    }
  };

  const handleCancel = () => {
    setError(null);
    window.dispatchEvent(new CustomEvent("werkzeug-drawing-reset"));
    const store = useLayoutDrawingStore.getState();
    if (editingSlabId || store.slabBoundaryEdit) {
      store.cancelSlabBoundaryEdit();
    } else {
      store.setArmedLayoutTool(null);
      store.setSketchTargetKind(null);
    }
  };

  return (
    <div className="drawing-command-bar flex items-center gap-1.5" role="toolbar" aria-label="Drawing actions">
      <span className="text-[11px] font-semibold leading-none">{modeLabel}</span>
      {isBoundaryMode && (
        <span className="rounded bg-yellow-500/20 px-1 py-0.5 text-[9px] font-bold text-yellow-400 leading-none">
          {sketchLines.length} {sketchLines.length === 1 ? "line" : "lines"}
        </span>
      )}
      <button
        type="button"
        disabled={state.busy}
        aria-pressed={state.navigating}
        onClick={() => useDrawingInteractionStore.setState({ navigating: !state.navigating })}
      >
        {state.navigating ? "Draw" : "Pan / zoom"}
      </button>
      <button
        type="button"
        className={isBoundaryMode ? "border-emerald-500 text-emerald-400 hover:bg-emerald-500/20 font-semibold" : ""}
        disabled={isBoundaryMode ? sketchLines.length < 3 || state.busy : !state.hasPoints || state.busy}
        onClick={() => void handleFinish()}
      >
        <LuCheck className="inline h-3.5 w-3.5 mr-1" />
        Finish (✓)
      </button>
      <button
        type="button"
        className={isBoundaryMode ? "border-rose-500 text-rose-400 hover:bg-rose-500/20" : ""}
        disabled={state.busy}
        onClick={handleCancel}
      >
        <LuX className="inline h-3.5 w-3.5 mr-1" />
        Cancel (✕)
      </button>
      {error && (
        <span className="text-[10px] font-semibold text-rose-400 max-w-xs truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
