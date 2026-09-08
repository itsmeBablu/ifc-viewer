"use client";

import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useDrawingInteractionStore } from "@/store/useDrawingInteractionStore";
import type { DrawingShape } from "@/lib/drawingShapes";

const shapes: { id: DrawingShape; label: string; glyph: string; hint: string }[] = [
  { id: "line", label: "Line", glyph: "╱", hint: "Tap the start and endpoint. Continue the chain or choose Finish." },
  { id: "rectangle", label: "Rectangle", glyph: "▭", hint: "Tap two opposite corners." },
  { id: "circle", label: "Circle", glyph: "○", hint: "Tap the center, then a point on the circle." },
  { id: "arc", label: "3-point arc", glyph: "◠", hint: "Tap the start, endpoint, then a point on the arc." },
  { id: "pick-edge", label: "Pick edge / DWG", glyph: "⌁", hint: "Tap an existing model edge, wall, line, or DWG vector segment to trace it." },
  { id: "pick-face", label: "Pick face outline", glyph: "▱", hint: "Tap a planar mesh face. Its boundary is projected onto the active level." },
];

export function DrawingModeSelect() {
  const shape = useDrawingInteractionStore(s => s.shape);
  const busy = useDrawingInteractionStore(s => s.busy);
  return <select aria-label="Toolbar drawing shape" className="h-8 rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-xs" disabled={busy} value={shape} onChange={event => {
    useDrawingInteractionStore.setState({ shape: event.target.value as DrawingShape, navigating: false });
    window.dispatchEvent(new CustomEvent("werkzeug-drawing-reset"));
  }}>{shapes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>;
}

export default function DrawingShapeOptions() {
  const armed = useLayoutDrawingStore(s => s.armedLayoutTool);
  const wall = useLayoutDrawingStore(s => s.selectedWallId);
  const line = useLayoutDrawingStore(s => s.selectedSketchLineId);
  const selected = useLayoutDrawingStore(s => s.selectedElements);
  const state = useDrawingInteractionStore();
  const kind = armed === "wall" || armed === "lines" ? armed : wall || selected.some(s => s.kind === "wall") ? "wall" : line || selected.some(s => s.kind === "line") ? "lines" : null;
  if (!kind) return null;
  return <section className="drawing-shape-options compact-properties" aria-label="Drawing shapes">
    <label className="property-field"><span>{armed === kind ? "Draw mode" : "Draw new"}</span>
      <select aria-label="Drawing shape" disabled={state.busy} value={armed === kind ? state.shape : ""} onChange={event => {
        useLayoutDrawingStore.getState().setArmedLayoutTool(kind);
        useDrawingInteractionStore.setState({ shape: event.target.value as DrawingShape, navigating: false, message: null });
        window.dispatchEvent(new CustomEvent("werkzeug-drawing-reset"));
      }}>
        {armed !== kind && <option value="" disabled>Choose shape…</option>}
        {shapes.map(shape => <option key={shape.id} value={shape.id}>{shape.label}</option>)}
      </select>
    </label>
    <details className="property-disclosure"><summary>Snapping &amp; help</summary>
      <label className="property-field"><span>Alignment</span><select aria-label="Alignment tracking" value={state.tracking ? "on" : "off"} onChange={e => useDrawingInteractionStore.setState({ tracking: e.target.value === "on" })}><option value="on">Horizontal / vertical</option><option value="off">Off</option></select></label>
      <p className="property-help">{shapes.find(s => s.id === state.shape)?.hint}</p>
    </details>
    {state.message && <p role="status" className="text-xs text-amber-500">{state.message}</p>}
  </section>;
}
