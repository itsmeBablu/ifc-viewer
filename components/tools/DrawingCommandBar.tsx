"use client";
import { useDrawingInteractionStore } from "@/store/useDrawingInteractionStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";

export default function DrawingCommandBar() {
  const tool = useLayoutDrawingStore(s => s.armedLayoutTool);
  const state = useDrawingInteractionStore();
  if (tool !== "wall" && tool !== "lines") return null;
  return <div className="drawing-command-bar" role="toolbar" aria-label="Drawing actions">
    <span className="text-xs font-semibold">{state.busy ? "Saving…" : state.navigating ? "Navigate" : tool === "wall" ? "Draw walls" : "Draw lines"}</span>
    <button type="button" disabled={state.busy} aria-pressed={state.navigating} onClick={() => useDrawingInteractionStore.setState({ navigating: !state.navigating })}>{state.navigating ? "Draw" : "Pan / zoom"}</button>
    <button type="button" disabled={!state.hasPoints || state.busy} onClick={() => window.dispatchEvent(new CustomEvent("werkzeug-drawing-reset"))}>Finish</button>
    <button type="button" disabled={state.busy} onClick={() => { window.dispatchEvent(new CustomEvent("werkzeug-drawing-reset")); useLayoutDrawingStore.getState().setArmedLayoutTool(null); }}>Cancel</button>
  </div>;
}
