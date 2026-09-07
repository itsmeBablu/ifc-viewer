"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface ViewportAxesGizmoProps {
  cameraRef: React.RefObject<THREE.Camera | null>;
  onAlignAxis?: (axis: "x" | "y" | "z") => void;
}

interface AxisProjection {
  axis: "X" | "Y" | "Z";
  color: string;
  x: number;
  y: number;
  depth: number;
}

export default function ViewportAxesGizmo({ cameraRef, onAlignAxis }: ViewportAxesGizmoProps) {
  const [projections, setProjections] = useState<AxisProjection[]>([
    { axis: "X", color: "#ef4444", x: 26, y: 0, depth: 0 },
    { axis: "Y", color: "#22c55e", x: 0, y: -26, depth: 0 },
    { axis: "Z", color: "#3b82f6", x: -18, y: 18, depth: 0 },
  ]);

  const rafRef = useRef<number>(0);

  useEffect(() => {
    const vX = new THREE.Vector3(1, 0, 0);
    const vY = new THREE.Vector3(0, 1, 0);
    const vZ = new THREE.Vector3(0, 0, 1);
    const m = new THREE.Matrix3();
    const p = new THREE.Vector3();

    const update = () => {
      const camera = cameraRef.current;
      if (camera) {
        // Extract 3x3 rotational component of view matrix
        m.setFromMatrix4(camera.matrixWorldInverse);

        const radius = 24;
        const project = (v: THREE.Vector3, axis: "X" | "Y" | "Z", color: string): AxisProjection => {
          p.copy(v).applyMatrix3(m);
          return {
            axis,
            color,
            x: p.x * radius,
            y: -p.y * radius,
            depth: p.z,
          };
        };

        const list = [
          project(vX, "X", "#ef4444"),
          project(vY, "Y", "#22c55e"),
          project(vZ, "Z", "#3b82f6"),
        ];

        // Sort back-to-front so nearest axis is drawn on top
        list.sort((a, b) => a.depth - b.depth);
        setProjections(list);
      }
      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cameraRef]);

  const cx = 36;
  const cy = 36;

  return (
    <div
      className="pointer-events-auto absolute bottom-4 left-4 z-20 flex flex-col items-center select-none"
      title="XYZ Coordinate Axes (Always On)"
    >
      <div className="relative h-[72px] w-[72px] rounded-xl border border-white/20 bg-slate-950/40 backdrop-blur-md shadow-lg transition-transform hover:scale-105">
        <svg className="h-full w-full" viewBox="0 0 72 72">
          {/* Subtle origin ring */}
          <circle cx={cx} cy={cy} r="3" fill="#cbd5e1" opacity="0.8" />

          {projections.map((p) => {
            const endX = cx + p.x;
            const endY = cy + p.y;
            return (
              <g key={p.axis} className="cursor-pointer" onClick={() => onAlignAxis?.(p.axis.toLowerCase() as "x" | "y" | "z")}>
                {/* Axis Line */}
                <line
                  x1={cx}
                  y1={cy}
                  x2={endX}
                  y2={endY}
                  stroke={p.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* Endpoint Badge */}
                <circle
                  cx={endX}
                  cy={endY}
                  r="6.5"
                  fill={p.color}
                  className="transition-all hover:r-8"
                />
                {/* Axis Label */}
                <text
                  x={endX}
                  y={endY + 3.2}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="8"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  {p.axis}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Small XYZ tag */}
        <span className="absolute -top-1.5 -right-1.5 rounded-full border border-yellow-400/40 bg-yellow-400/20 px-1 py-0.2 font-mono text-[7px] font-bold text-yellow-400">
          XYZ
        </span>
      </div>
    </div>
  );
}
