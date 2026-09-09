"use client";

import { useState } from "react";
import { LuCamera, LuDownload, LuX } from "react-icons/lu";
import { useViewDisplayStore } from "@/store/useViewDisplayStore";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useModelScene } from "./WerkzeugModelSceneContext";

export function enterRenderView() {
  const markup = useToolMarkupStore.getState();
  const layout = useLayoutDrawingStore.getState();
  if (layout.slabBoundaryEdit) return;
  layout.setArmedLayoutTool(null);
  layout.clearSelection();
  markup.setArmedTool(null);
  markup.setMeasureMode(false);
  markup.clearSelection();
  markup.setWalkthroughMode(false);
  markup.setQuadView(false);
  markup.setViewPreset("free");
  useAppStore.getState().setRenderMode("realistic");
  useViewDisplayStore.getState().setRenderPreview(true);
}

export default function RenderViewControls() {
  const enabled = useViewDisplayStore(s => s.renderPreview);
  const { captureViewport } = useModelScene();
  const [scale, setScale] = useState(2);
  const [error, setError] = useState("");
  const save = () => {
    const data = captureViewport?.({ scale });
    if (!data) { setError("Could not capture this view. Try a lower resolution."); return; }
    const link = document.createElement("a");
    link.href = data;
    link.download = `building-view-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    link.click();
    setError("");
  };
  return <div className="space-y-2 rounded-lg border border-[var(--panel-divider)] p-2">
    <button type="button" className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--glass-inset-bg)] px-2 py-2 text-xs font-semibold" onClick={() => enabled ? useViewDisplayStore.getState().setRenderPreview(false) : enterRenderView()}>
      {enabled ? <LuX /> : <LuCamera />}{enabled ? "Exit render view" : "Render view"}
    </button>
    <p className="text-[10px] text-[var(--text-muted)]">Real-time materials and lighting. Orbit to frame the model; render view hides drafting helpers.</p>
    <label className="flex items-center justify-between gap-2 text-xs">Image size<select aria-label="Image resolution" value={scale} onChange={e => setScale(Number(e.target.value))} className="rounded border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-1"><option value={1}>Viewport</option><option value={2}>2×</option><option value={3}>3×</option></select></label>
    <button type="button" disabled={!captureViewport} onClick={save} className="flex w-full items-center justify-center gap-2 rounded-md border border-[var(--panel-divider)] px-2 py-2 text-xs font-semibold disabled:opacity-40"><LuDownload />Save image (PNG)</button>
    {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
  </div>;
}
