"use client";
import { FOOTPRINTS } from "@/lib/ai/modeling/footprint";
import type { ResidentialParameters } from "@/lib/ai/modeling/allocation";
import { useCallback, useMemo, useState } from "react";
import { FiMaximize2 } from "react-icons/fi";
import AiSketchWorkspace from "./AiSketchWorkspace";
import { generateSubdividedLayout } from "@/lib/ai/modeling/subdivision";

type Point = { x: number; y: number };

export default function AiFootprintCanvas({
  parameters,
  onChange,
  disabled,
  building,
}: {
  parameters: ResidentialParameters;
  onChange: (p: ResidentialParameters) => void;
  disabled: boolean;
  building?: ReturnType<typeof import("@/lib/ai/modeling/footprint").allocateBuilding> | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const closeWorkspace = useCallback(() => setExpanded(false), []);
  const sketch = parameters.sketches?.[0];
  const shape = sketch
    ? "drawn"
    : parameters.footprint ?? "rectangle";
  const points = sketch?.points.length
    ? sketch.points.map((p) => ({
        x: p.xMm / Math.max(...sketch.points.map((p) => p.xMm), 1),
        y: p.yMm / Math.max(...sketch.points.map((p) => p.yMm), 1),
      }))
    : shape === "drawn"
    ? parameters.footprintPoints ?? []
    : FOOTPRINTS[shape];

  const spanX = Math.max(0.01, Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)));
  const spanY = Math.max(0.01, Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y)));

  const add = (e: React.MouseEvent<SVGSVGElement>) => {
    if (shape !== "drawn" || sketch || disabled || points.length >= 16) return;
    const b = e.currentTarget.getBoundingClientRect();
    const point = {
      x: Math.round(Math.max(0, Math.min(1, ((e.clientX - b.left) / b.width * 120 - 10) / 100)) * 20) / 20,
      y: Math.round(Math.max(0, Math.min(1, ((e.clientY - b.top) / b.height * 120 - 10) / 100)) * 20) / 20,
    };
    if (points.some((p) => p.x === point.x && p.y === point.y)) return;
    onChange({ ...parameters, footprintPoints: [...points, point] });
  };

  const svgPoints = (p: Point[]) => p.map((pt) => `${10 + pt.x * 100},${10 + pt.y * 100}`).join(" ");
  const allocation = building?.allocation;
  const w = building?.polygon
    ? Math.max(...building.polygon.map((p) => p.xMm))
    : allocation?.internalWidthMm ?? (parameters.widthM ? parameters.widthM * 1000 : 12000);
  const d = building?.polygon
    ? Math.max(...building.polygon.map((p) => p.yMm))
    : allocation?.internalDepthMm ?? (parameters.lengthM ? parameters.lengthM * 1000 : 10000);

  const subLayout = useMemo(() => {
    if (shape === "drawn" && !building?.polygon) return null;
    try {
      return generateSubdividedLayout(w, d, parameters);
    } catch {
      return null;
    }
  }, [w, d, parameters, shape, building]);

  return (
    <div className="ai-footprint-chooser">
      <button
        type="button"
        className="ai-expand-sketch"
        disabled={disabled}
        onClick={() => setExpanded(true)}
        aria-label="Expand drawing workspace"
        title="Expand drawing workspace"
      >
        <FiMaximize2 /> Expand 2D Workspace
      </button>
      {expanded && (
        <AiSketchWorkspace
          parameters={parameters}
          building={building}
          onChange={onChange}
          onClose={closeWorkspace}
          disabled={disabled}
        />
      )}
      <div className="ai-suggestion-row">
        {(["rectangle", "l", "u", "drawn"] as const).map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            aria-pressed={shape === s}
            onClick={() => onChange({ ...parameters, footprint: s, sketches: undefined })}
          >
            {s === "rectangle" ? "Rectangle" : s === "l" ? "L shape" : s === "u" ? "U shape" : "Draw outline"}
          </button>
        ))}
      </div>
      <svg
        className="ai-footprint-canvas"
        viewBox="0 0 120 120"
        role="img"
        aria-label={shape === "drawn" ? "Draw building footprint by clicking corners" : "Building footprint layout preview"}
        onClick={add}
      >
        <defs>
          <pattern id="ai-footprint-grid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M5 0H0V5" fill="none" stroke="currentColor" strokeWidth=".15" opacity=".25" />
          </pattern>
        </defs>
        <rect x="10" y="10" width="100" height="100" fill="url(#ai-footprint-grid)" />
        {points.length >= 3 ? (
          <polygon points={svgPoints(points)} fill="#60a5fa18" stroke="#60a5fa" strokeWidth="1.2" />
        ) : (
          <polyline points={svgPoints(points)} fill="none" stroke="#60a5fa" strokeWidth="1.2" />
        )}

        {/* Dynamic Subdivided Layout Rooms */}
        {subLayout && shape !== "drawn" && (
          <g>
            {subLayout.rooms.map((rm) => {
              const rx = 10 + (rm.xMm / w) * 100;
              const ry = 10 + (rm.yMm / d) * 100;
              const rw = (rm.widthMm / w) * 100;
              const rd = (rm.depthMm / d) * 100;
              const isLiving = rm.use === "living";
              const isKitchen = rm.use === "kitchen";
              const isBath = rm.use === "bathroom";
              const fill = isLiving
                ? "#f59e0b40"
                : isKitchen
                ? "#10b98140"
                : isBath
                ? "#c084fc44"
                : "#60a5fa44";
              const stroke = isLiving
                ? "#f59e0b"
                : isKitchen
                ? "#10b981"
                : isBath
                ? "#a855f7"
                : "#3b82f6";
              return (
                <g key={rm.id}>
                  <rect
                    x={rx}
                    y={ry}
                    width={rw}
                    height={rd}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth="0.4"
                    rx="0.5"
                  />
                  {rw > 12 && rd > 10 && (
                    <text
                      x={rx + rw / 2}
                      y={ry + rd / 2 - 1}
                      textAnchor="middle"
                      fontSize="3.2"
                      fontWeight="600"
                      fill="currentColor"
                    >
                      {rm.name.length > 14 ? rm.name.slice(0, 12) + "…" : rm.name}
                    </text>
                  )}
                  {rw > 12 && rd > 10 && (
                    <text
                      x={rx + rw / 2}
                      y={ry + rd / 2 + 2.8}
                      textAnchor="middle"
                      fontSize="2.4"
                      opacity="0.8"
                      fill="currentColor"
                    >
                      {rm.areaM2} m²
                    </text>
                  )}
                </g>
              );
            })}

            {/* Interior wall divisions */}
            {subLayout.interiorWalls.map((wall, i) => (
              <line
                key={`iw-${i}`}
                x1={10 + (wall.startX / w) * 100}
                y1={10 + (wall.startY / d) * 100}
                x2={10 + (wall.endX / w) * 100}
                y2={10 + (wall.endY / d) * 100}
                stroke="currentColor"
                strokeWidth="0.8"
                opacity="0.9"
              />
            ))}

            {/* Main Entrance Double Door Indicator */}
            {subLayout.entryDoor && (
              <g>
                <circle
                  cx={10 + (subLayout.entryDoor.positionMm / w) * 100}
                  cy={10}
                  r="1.8"
                  fill="#f59e0b"
                />
                <text
                  x={10 + (subLayout.entryDoor.positionMm / w) * 100}
                  y={7.5}
                  fontSize="2.6"
                  textAnchor="middle"
                  fill="#f59e0b"
                  fontWeight="bold"
                >
                  ENTRY 🚪
                </text>
              </g>
            )}
          </g>
        )}

        {/* Fallback preview for legacy or drawn outlines */}
        {allocation && (!subLayout || shape === "drawn") && (
          <g>
            <text x={60} y={60} textAnchor="middle" fontSize="4" fill="currentColor">
              Custom Drawn Floor
            </text>
          </g>
        )}

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={10 + p.x * 100} cy={10 + p.y * 100} r="1.6" fill="#2563eb" />
            {parameters.widthM && parameters.lengthM && points.length >= 3 && (
              <text
                x={10 + (p.x + points[(i + 1) % points.length].x) * 50}
                y={9 + (p.y + points[(i + 1) % points.length].y) * 50}
                fontSize="3.5"
                textAnchor="middle"
                fill="currentColor"
              >
                {Math.hypot(
                  ((p.x - points[(i + 1) % points.length].x) / spanX) * parameters.widthM,
                  ((p.y - points[(i + 1) % points.length].y) / spanY) * parameters.lengthM
                ).toFixed(1)}{" "}
                m
              </text>
            )}
          </g>
        ))}
      </svg>
      {sketch && (
        <p className="ai-text-muted">Custom floor drawing. Expand the workspace to edit lines, dimensions or floors.</p>
      )}
      {shape === "drawn" && !sketch && (
        <>
          <p className="ai-text-muted">
            Click corners in order (up to 16). The last edge closes automatically. Set the overall width and length below.
          </p>
          <div className="ai-suggestion-row">
            <button
              type="button"
              disabled={disabled || !points.length}
              onClick={() => onChange({ ...parameters, footprintPoints: points.slice(0, -1) })}
            >
              Undo corner
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...parameters, footprintPoints: [] })}
            >
              Clear outline
            </button>
          </div>
        </>
      )}
    </div>
  );
}
