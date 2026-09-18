"use client";
import { useCallback, useId, useMemo, useState } from "react";
import { FiMaximize2 } from "react-icons/fi";
import { FOOTPRINTS, polygonArea } from "@/lib/ai/modeling/footprint";
import { residentialSketches } from "@/lib/ai/modeling/preview";
import { sketchRooms } from "@/lib/ai/modeling/sketch";
import type { ResidentialParameters } from "@/lib/ai/modeling/allocation";
import AiSketchWorkspace from "./AiSketchWorkspace";
import type { AiModelId } from "@/lib/ai/models";

export default function AiFootprintCanvas({ parameters, onChange, disabled, building, heightMm, thicknessMm, availableShapes, model, preferences, onPreferences, onRefresh }: {
  parameters: ResidentialParameters; onChange: (p: ResidentialParameters) => void; disabled: boolean;
  building?: ReturnType<typeof import("@/lib/ai/modeling/footprint").allocateBuilding> | null;
  heightMm: number; thicknessMm: number;
  availableShapes?: Array<"rectangle" | "l" | "u" | "drawn">;
  model?: AiModelId; preferences?: string; onPreferences?: (text: string) => void; onRefresh?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [floor, setFloor] = useState(0);
  const clipId = useId();
  const closeWorkspace = useCallback(() => setExpanded(false), []);
  const sketches = useMemo(() => {
    try { return residentialSketches(parameters, heightMm, thicknessMm); } catch { return []; }
  }, [parameters, heightMm, thicknessMm]);
  const sketch = sketches[Math.min(floor, Math.max(0, sketches.length - 1))];
  const shape = parameters.footprint ?? "rectangle";
  const raw = shape === "drawn" ? parameters.footprintPoints ?? [] : FOOTPRINTS[shape];
  const points = sketch?.points ?? raw.map(p => ({ xMm: p.x * 14000, yMm: p.y * 14000 }));
  const minX = Math.min(0, ...points.map(p => p.xMm)), minY = Math.min(0, ...points.map(p => p.yMm));
  const width = Math.max(1000, ...points.map(p => p.xMm - minX)), depth = Math.max(1000, ...points.map(p => p.yMm - minY));
  const span = Math.max(width, depth);
  const x = (n: number) => 10 + (n - minX) / span * 100;
  const y = (n: number) => 10 + (n - minY) / span * 100;
  const poly = (pts: typeof points) => pts.map(p => x(p.xMm) + "," + y(p.yMm)).join(" ");
  const rooms = sketch ? sketchRooms(sketch) : [];
  const open = () => {
    if (!parameters.sketches && sketches.length) onChange({ ...parameters, apartmentFloors: undefined, apartmentsPerFloor: undefined, bedroomsPerApartment: undefined, sketches, totalAreaM2: sketches.reduce((sum, s) => sum + polygonArea(s.points) / 1e6, 0) });
    setExpanded(true);
  };
  return <div className="ai-footprint-chooser">
    <button type="button" className="ai-expand-sketch" disabled={disabled} onClick={open}><FiMaximize2 /> Expand 2D workspace</button>
    {expanded && <AiSketchWorkspace parameters={parameters} building={building} onChange={onChange} onClose={closeWorkspace} disabled={disabled} model={model} preferences={preferences} onPreferences={onPreferences} onRefresh={onRefresh} />}
    <div className="ai-suggestion-row" role="group" aria-label="Building outline">
      {(["rectangle", "l", "u", "drawn"] as const).map(s => <button key={s} type="button" disabled={disabled || !!availableShapes && !availableShapes.includes(s)} className={availableShapes && !availableShapes.includes(s) ? "ai-choice-unavailable" : ""} title={availableShapes && !availableShapes.includes(s) ? "Try fewer bedrooms or a smaller garden to make room for this outline." : undefined} aria-pressed={shape === s}
        onClick={() => {
          onChange({ ...parameters, footprint: s, sketches: undefined, totalAreaM2: undefined, widthM: undefined, lengthM: undefined, footprintPoints: s === "drawn" ? [] : undefined });
          if (s === "drawn") setExpanded(true);
        }}>{s === "rectangle" ? "Rectangle" : s === "drawn" ? "Draw outline" : s.toUpperCase() + " shape"}</button>)}
    </div>
    {sketches.length > 1 && <div className="ai-suggestion-row" aria-label="Preview floor">{sketches.map((_, i) => <button key={i} type="button" aria-pressed={floor === i} onClick={() => setFloor(i)}>{i === 0 ? "Ground floor" : "Floor " + i}</button>)}</div>}
    <svg className="ai-footprint-canvas" viewBox="0 0 120 120" role="img" aria-label={shape.toUpperCase() + " residential floor plan"}>
      <defs><clipPath id={clipId}><polygon points={poly(points)} /></clipPath></defs>
      <polygon points={poly(points)} fill="#eff6ff" stroke="#334155" strokeWidth="1.4" />
      <g clipPath={"url(#" + clipId + ")"}>
        {rooms.map((room, i) => <polygon key={i} points={poly(room)} fill={["#dbeafe", "#fef3c7", "#dcfce7", "#f3e8ff"][i % 4]} stroke="#64748b" strokeWidth=".3" />)}
        {sketch?.lines.map((line, i) => <line key={i} x1={x(line.start.xMm)} y1={y(line.start.yMm)} x2={x(line.end.xMm)} y2={y(line.end.yMm)} stroke="#334155" strokeWidth=".8" />)}
        {sketch?.labels?.map((label, i) => <text key={i} x={x(label.point.xMm)} y={y(label.point.yMm)} textAnchor="middle" fontSize="2.6" fill="#1e293b">{label.name}</text>)}
      </g>
      {points.map((p, i) => <circle key={i} cx={x(p.xMm)} cy={y(p.yMm)} r="1" fill="#2563eb" />)}
    </svg>
    <p className="ai-text-muted">{parameters.sketches ? "Your drawing is saved here. Reopen to move walls, add partitions or rename rooms." : "Choose an outline, then open the workspace to adjust the displayed rooms."}</p>
  </div>;
}
