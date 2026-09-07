"use client";

import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { measurementGeometry, measurementLabel, type MeasurementKind } from "@/lib/measurementGeometry";
import ObjectSnapStrip from "./ObjectSnapStrip";

export default function MeasurementProperties() {
  const state = useToolMarkupStore();
  const modes: { id: MeasurementKind; label: string; help: string }[] = [
    { id: "distance", label: "Distance", help: "Pick start and end points. Measures the true 3D distance." },
    { id: "angle", label: "Angle", help: "Pick first point, angle vertex, then end point." },
    { id: "arc", label: "Arc length", help: "Pick start, a point on the arc, then end. Points must not lie on a straight line." },
  ];
  return <div className="space-y-2">
    <div className="grid grid-cols-3 gap-1" role="group" aria-label="Measurement mode">
      {modes.map((mode) => <button key={mode.id} type="button" aria-pressed={state.measurementKind === mode.id} onClick={() => state.setMeasurementKind(mode.id)} className={`rounded border px-1 py-1.5 text-[10px] font-semibold ${state.measurementKind === mode.id ? "border-sky-400 bg-sky-400/15 text-sky-500" : "border-[var(--panel-divider)]"}`}>{mode.label}</button>)}
    </div>
    <p className="text-[11px] text-[var(--text-muted)]">{modes.find((m) => m.id === state.measurementKind)?.help}</p>
    <p className="text-[10px] text-[var(--text-muted)]">{state.measureSecond ? "2 points picked" : state.measureDraft ? "1 point picked" : "Ready"} · Alt bypasses snaps · Esc cancels</p>
    <ObjectSnapStrip compact />
    {state.measureDraft && <button type="button" onClick={state.clearMeasureDraft} className="text-[10px] underline">Cancel current measurement</button>}
    <div className="space-y-1 border-t border-[var(--panel-divider)] pt-2">
      {state.measurements.map((m) => {
        const geometry = measurementGeometry(m.kind ?? "distance", [{ x: m.ax, y: m.ay, z: m.az }, { x: m.bx, y: m.by, z: m.bz }, ...(m.third ? [m.third] : [])]);
        return <div key={m.id} className="flex items-center justify-between gap-2 text-[10px]">
          <span>{m.kind === "arc" ? "Arc" : m.kind === "angle" ? "Angle" : "Distance"}: {geometry ? measurementLabel(geometry) : "Invalid points"}</span>
          <button type="button" aria-label="Delete measurement" onClick={() => state.removeMeasurement(m.id)} className="shrink-0 px-1 text-[var(--text-muted)] hover:text-red-500">×</button>
        </div>;
      })}
    </div>
  </div>;
}
