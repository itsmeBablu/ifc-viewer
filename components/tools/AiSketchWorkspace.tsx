"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { 
  FiMaximize2, FiMousePointer, FiSquare, FiCircle, FiType, FiLock, FiUnlock, 
  FiLayers, FiGrid, FiTrash2, FiCornerUpLeft, FiCornerUpRight, FiMove, FiPlus, 
  FiZoomIn, FiZoomOut, FiCheck, FiEdit2, FiEdit3, FiRotateCw 
} from "react-icons/fi";
import type { FloorSketch, ResidentialParameters, RoomUse, SketchPoint } from "@/lib/ai/modeling/allocation";
import { FOOTPRINTS, insidePolygon, inscribedRectangle, polygonArea } from "@/lib/ai/modeling/footprint";
import { resizeSketchLine, circularOutline, arcSegments, lineAngleDeg, rotateSketchLine } from "@/lib/ai/modeling/sketchEditing";
import { sketchRooms } from "@/lib/ai/modeling/sketch";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { componentPreset } from "@/lib/componentCatalog";

type Tool = "select" | "wall" | "freehand" | "arc" | "rectangle" | "circle" | "room" | "garden" | "pan";
type Pick = { index: number; interior: boolean; source: "current" | "below" | "project" };
const uses: RoomUse[] = ["bedroom", "living", "kitchen", "dining", "study", "bathroom", "corridor", "garage"];
const colors: Record<RoomUse, string> = {
  bedroom: "#60a5fa", living: "#facc15", kitchen: "#fb923c", dining: "#fbbf24", 
  study: "#818cf8", bathroom: "#c084fc", corridor: "#94a3b8", garage: "#64748b"
};
const tools: { id: Tool; name: string; icon: React.ReactNode }[] = [
  { id: "select", name: "Select", icon: <FiMousePointer/> },
  { id: "wall", name: "Wall / Line", icon: <FiEdit3/> },
  { id: "freehand", name: "Freehand", icon: <FiEdit2/> },
  { id: "arc", name: "Arc", icon: <span aria-hidden="true" className="ai-arc-icon"/> },
  { id: "rectangle", name: "Rectangle", icon: <FiSquare/> },
  { id: "circle", name: "Circle", icon: <FiCircle/> },
  { id: "garden", name: "Garden", icon: <span aria-hidden="true">&#127793;</span> },
  { id: "room", name: "Room name", icon: <FiType/> },
  { id: "pan", name: "Pan", icon: <FiMove/> }
];
const help: Record<Tool, string> = {
  select: "Click any wall line to inspect, edit length or adjust angle.",
  wall: "AutoCAD line: Click start, move cursor for live length & angle, click end. Draw open or connected walls.",
  freehand: "Pencil mode: Drag across canvas to sketch walls freely like a paint tool.",
  arc: "AutoCAD arc: Click start, click end, then move cursor to dynamically bend the live arc.",
  rectangle: "Click opposite corners to draw a rectangle wall outline.",
  circle: "Click centre, then radius for curved circular walls.",
  garden: "Paint garden space: Click opposite corners for an outdoor green zone.",
  room: "Click inside an enclosed room to set its name and use.",
  pan: "Drag to pan the drawing. Scroll or +/- to zoom, or click Fit."
};

export default function AiSketchWorkspace({
  parameters, onChange, onClose, disabled, building
}: {
  parameters: ResidentialParameters; 
  onChange: (p: ResidentialParameters) => void; 
  onClose: () => void; 
  disabled: boolean; 
  building?: ReturnType<typeof import("@/lib/ai/modeling/footprint").allocateBuilding> | null;
}) {
  const levels = useLayoutDrawingStore(s => s.levels),
        walls = useLayoutDrawingStore(s => s.walls),
        equipment = useLayoutDrawingStore(s => s.mepEquipment),
        slabs = useLayoutDrawingStore(s => s.slabs),
        columns = useLayoutDrawingStore(s => s.columns),
        ducts = useLayoutDrawingStore(s => s.ducts),
        pipes = useLayoutDrawingStore(s => s.pipes),
        doors = useLayoutDrawingStore(s => s.doors),
        windows = useLayoutDrawingStore(s => s.windows),
        roomsInProject = useLayoutDrawingStore(s => s.layoutRooms);
  const activeLevel = useToolMarkupStore(s => s.markupFloorId);

  const source = parameters.footprint === "drawn" ? parameters.footprintPoints ?? [] : FOOTPRINTS[parameters.footprint ?? "rectangle"];
  const seed: FloorSketch = {
    points: building?.polygon ?? source.map(p => ({
      xMm: p.x * (parameters.widthM ? parameters.widthM * 1000 : building?.allocation.internalWidthMm ?? 14000),
      yMm: p.y * (parameters.lengthM ? parameters.lengthM * 1000 : building?.allocation.internalDepthMm ?? 14000)
    })),
    lines: []
  };
  const sketches = parameters.sketches ?? Array.from({ length: parameters.variant === "duplex" ? 2 : 1 }, () => seed);

  const [floor, setFloor] = useState(0),
        [tool, setTool] = useState<Tool>("wall"),
        [below, setBelow] = useState(true),
        [anchors, setAnchors] = useState<SketchPoint[]>([]),
        [selected, setSelected] = useState<Pick | null>(null),
        [hover, setHover] = useState<string | null>(null),
        [length, setLength] = useState(""),
        [angleInput, setAngleInput] = useState(""),
        [error, setError] = useState(""),
        [pickLayer, setPickLayer] = useState<Pick["source"]>("current"),
        [projectVisible, setProjectVisible] = useState(true),
        [projectLevel, setProjectLevel] = useState(activeLevel ?? levels[0]?.id ?? ""),
        [zoom, setZoom] = useState(1),
        [pan, setPan] = useState({ x: 0, y: 0 }),
        [grid, setGrid] = useState(true),
        [orthogonal, setOrthogonal] = useState(true),
        [roomPoint, setRoomPoint] = useState<SketchPoint | null>(null),
        [roomName, setRoomName] = useState(""),
        [roomUse, setRoomUse] = useState<RoomUse>("bedroom"),
        [busy, setBusy] = useState(false),
        [past, setPast] = useState<FloorSketch[][]>([]),
        [future, setFuture] = useState<FloorSketch[][]>([]);

  // AutoCAD live drafting & paint states
  const [cursorPoint, setCursorPoint] = useState<SketchPoint | null>(null);
  const [snapPoint, setSnapPoint] = useState<SketchPoint | null>(null);
  const [freehandStroke, setFreehandStroke] = useState<SketchPoint[]>([]);
  const [isFreehandDragging, setIsFreehandDragging] = useState(false);

  const closeRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; y: number; pan: { x: number; y: number } } | null>(null);

  const current = sketches[Math.min(floor, sketches.length - 1)],
        previous = floor > 0 ? sketches[floor - 1] : null;
  const projectWalls = walls.filter(w => w.levelId === projectLevel);
  const projectPoints = projectVisible ? projectWalls.flatMap(w => [{ xMm: w.startXmm, yMm: w.startYmm }, { xMm: w.endXmm, yMm: w.endYmm }]) : [];
  const allPoints = [...sketches.flatMap(s => [...s.points, ...s.lines.flatMap(l => [l.start, l.end]), ...(s.gardens ?? []).flat()]), ...projectPoints];
  const minX = Math.min(0, ...allPoints.map(p => p.xMm)) - 1000,
        minY = Math.min(0, ...allPoints.map(p => p.yMm)) - 1000;
  const extent = Math.max(16000, Math.max(0, ...allPoints.map(p => p.xMm)) - minX, Math.max(0, ...allPoints.map(p => p.yMm)) - minY) + 1500,
        span = extent / zoom;
  const viewX = minX + (extent - span) / 2 + pan.x,
        viewY = minY + (extent - span) / 2 + pan.y;

  const change = (next: FloorSketch[], variant = parameters.variant) => {
    setPast(v => [...v.slice(-29), sketches]);
    setFuture([]);
    setError("");
    onChange({ ...parameters, variant, sketches: next });
  };
  const replace = (s: FloorSketch) => change(sketches.map((old, i) => i === floor ? s : old));
  const resetSelection = () => { setSelected(null); setAnchors([]); setRoomPoint(null); };

  const doUndo = () => {
    if (!past.length || disabled) return;
    const prev = past[past.length - 1];
    setFuture(v => [sketches, ...v]);
    setPast(v => v.slice(0, -1));
    setFloor(v => Math.min(v, prev.length - 1));
    onChange({ ...parameters, sketches: prev });
    resetSelection();
  };

  const doRedo = () => {
    if (!future.length || disabled) return;
    const next = future[0];
    setPast(v => [...v, sketches]);
    setFuture(v => v.slice(1));
    setFloor(v => Math.min(v, next.length - 1));
    onChange({ ...parameters, sketches: next });
    resetSelection();
  };

  useEffect(() => {
    const previousActive = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (anchors.length) { setAnchors([]); return; }
        if (selected) { resetSelection(); return; }
        onClose();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        doUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        doRedo();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previousActive?.focus();
    };
  }, [onClose, past, future, sketches, anchors, selected, disabled]);

  const lineFor = (pick: Pick) => {
    if (pick.source === "project") {
      const w = projectWalls[pick.index];
      return w ? { start: { xMm: w.startXmm, yMm: w.startYmm }, end: { xMm: w.endXmm, yMm: w.endYmm } } : null;
    }
    const s = pick.source === "below" ? previous : current;
    if (!s) return null;
    return pick.interior 
      ? s.lines[pick.index] 
      : s.points[pick.index] 
        ? { start: s.points[pick.index], end: s.points[(pick.index + 1) % s.points.length] } 
        : null;
  };

  const chooseLine = (index: number, interior: boolean, source: Pick["source"]) => {
    if (tool !== "select" || pickLayer !== source) return;
    const pick = { index, interior, source }, l = lineFor(pick);
    if (!l) return;
    setSelected(pick);
    setLength((Math.hypot(l.end.xMm - l.start.xMm, l.end.yMm - l.start.yMm) / 1000).toFixed(2));
    setAngleInput(lineAngleDeg(l.start, l.end).toFixed(1));
    setRoomPoint(null);
  };

  const getCanvasPoint = (event: React.MouseEvent<SVGSVGElement> | React.PointerEvent<SVGSVGElement>): SketchPoint | null => {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return null;
    const pt = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { xMm: pt.x, yMm: pt.y };
  };

  const resolvePoint = (raw: SketchPoint, withOrtho = true): { point: SketchPoint; snap: SketchPoint | null } => {
    let pt = {
      xMm: Math.max(0, Math.min(80000, Math.round(raw.xMm / 250) * 250)),
      yMm: Math.max(0, Math.min(80000, Math.round(raw.yMm / 250) * 250))
    };
    const candidates = [
      ...current.points,
      ...current.lines.flatMap(l => [l.start, l.end]),
      ...(below && previous ? [...previous.points, ...previous.lines.flatMap(l => [l.start, l.end])] : []),
      ...projectPoints
    ];
    const snap = candidates.reduce<SketchPoint | null>((best, p) =>
      Math.hypot(p.xMm - raw.xMm, p.yMm - raw.yMm) < span * 0.02 && (!best || Math.hypot(p.xMm - raw.xMm, p.yMm - raw.yMm) < Math.hypot(best.xMm - raw.xMm, best.yMm - raw.yMm))
        ? p : best,
      null
    );
    if (snap && snap.xMm >= 0 && snap.yMm >= 0 && snap.xMm <= 80000 && snap.yMm <= 80000) {
      return { point: snap, snap };
    }
    if (withOrtho && orthogonal && anchors.length && (tool === "wall" || tool === "arc")) {
      const a = anchors[anchors.length - 1];
      pt = Math.abs(pt.xMm - a.xMm) > Math.abs(pt.yMm - a.yMm) ? { ...pt, yMm: a.yMm } : { ...pt, xMm: a.xMm };
    }
    return { point: pt, snap: null };
  };

  const onPointerMoveCanvas = (event: React.PointerEvent<SVGSVGElement>) => {
    if (drag.current) {
      const rect = event.currentTarget.getBoundingClientRect(),
            scale = span / Math.min(rect.width, rect.height);
      setPan({
        x: drag.current.pan.x - (event.clientX - drag.current.x) * scale,
        y: drag.current.pan.y - (event.clientY - drag.current.y) * scale
      });
      return;
    }
    const raw = getCanvasPoint(event);
    if (!raw) return;

    if (tool === "freehand" && isFreehandDragging) {
      const { point } = resolvePoint(raw, false);
      const last = freehandStroke[freehandStroke.length - 1];
      if (!last || Math.hypot(point.xMm - last.xMm, point.yMm - last.yMm) >= 200) {
        setFreehandStroke(s => [...s, point]);
      }
      setCursorPoint(point);
      return;
    }

    const { point, snap } = resolvePoint(raw, true);
    setCursorPoint(point);
    setSnapPoint(snap);
  };

  const click = (event: React.MouseEvent<SVGSVGElement>) => {
    if (disabled || tool === "select" || tool === "pan" || tool === "freehand") return;
    const raw = getCanvasPoint(event);
    if (!raw) return;
    const { point } = resolvePoint(raw, true);

    try {
      if (tool === "room") {
        const room = sketchRooms(current).find(r => insidePolygon(point, r));
        if (!room) throw new Error("Click inside an enclosed room.");
        const label = current.labels?.find(l => insidePolygon(l.point, room));
        setRoomPoint(label?.point ?? point);
        setRoomName(label?.name ?? "");
        setRoomUse(label?.use ?? "bedroom");
        return;
      }

      if (!anchors.length) {
        setAnchors([point]);
        return;
      }

      const a = anchors[0];

      if (tool === "arc" && anchors.length === 1) {
        setAnchors([a, point]);
        return;
      }

      if (tool === "wall") {
        if (Math.hypot(point.xMm - a.xMm, point.yMm - a.yMm) < 300) {
          // Double clicked or closed wall segment: finish line chain
          setAnchors([]);
          return;
        }
        const newLine = { start: a, end: point };
        replace({ ...current, lines: [...current.lines, newLine] });
        // AutoCAD continuous polyline mode: anchor to new point
        setAnchors([point]);
        return;
      }

      if (tool === "arc") {
        const additions = arcSegments(a, anchors[1], point);
        replace({ ...current, lines: [...current.lines, ...additions] });
        setAnchors([]);
        return;
      }

      if (tool === "rectangle") {
        const x1 = Math.min(a.xMm, point.xMm), x2 = Math.max(a.xMm, point.xMm);
        const y1 = Math.min(a.yMm, point.yMm), y2 = Math.max(a.yMm, point.yMm);
        if (Math.abs(x2 - x1) < 1000 || Math.abs(y2 - y1) < 1000) throw new Error("Rectangle needs at least 1 m sides.");
        const rectLines = [
          { start: { xMm: x1, yMm: y1 }, end: { xMm: x2, yMm: y1 } },
          { start: { xMm: x2, yMm: y1 }, end: { xMm: x2, yMm: y2 } },
          { start: { xMm: x2, yMm: y2 }, end: { xMm: x1, yMm: y2 } },
          { start: { xMm: x1, yMm: y2 }, end: { xMm: x1, yMm: y1 } }
        ];
        replace({ ...current, lines: [...current.lines, ...rectLines] });
        setAnchors([]);
        return;
      }

      if (tool === "circle") {
        const radius = Math.hypot(point.xMm - a.xMm, point.yMm - a.yMm);
        if (radius < 1000) throw new Error("Circle radius must be at least 1 m.");
        const pts = circularOutline(a, radius);
        const circleLines = pts.map((p, i) => ({ start: p, end: pts[(i + 1) % pts.length] }));
        replace({ ...current, lines: [...current.lines, ...circleLines] });
        setAnchors([]);
        return;
      }

      if (tool === "garden") {
        const x = Math.min(a.xMm, point.xMm), y = Math.min(a.yMm, point.yMm),
              w = Math.abs(a.xMm - point.xMm), d = Math.abs(a.yMm - point.yMm);
        if (w < 1000 || d < 1000) throw new Error("Garden sides need at least 1 m.");
        const garden = [{ xMm: x, yMm: y }, { xMm: x + w, yMm: y }, { xMm: x + w, yMm: y + d }, { xMm: x, yMm: y + d }];
        // Gardens belong to the ground floor
        const targetFloor = 0;
        const groundSketch = sketches[targetFloor];
        const nextGround = { ...groundSketch, gardens: [...(groundSketch.gardens ?? []), garden] };
        change(sketches.map((s, i) => i === targetFloor ? nextGround : s));
        setAnchors([]);
        if (floor !== 0) setError("Garden added to Ground floor.");
        return;
      }

      setAnchors([]);
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the drawing.");
    }
  };

  const onPointerDownCanvas = (event: React.PointerEvent<SVGSVGElement>) => {
    if (tool === "pan") {
      drag.current = { x: event.clientX, y: event.clientY, pan };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (tool === "freehand") {
      const raw = getCanvasPoint(event);
      if (!raw) return;
      const { point } = resolvePoint(raw, false);
      setIsFreehandDragging(true);
      setFreehandStroke([point]);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onPointerUpCanvas = (event: React.PointerEvent<SVGSVGElement>) => {
    if (drag.current) {
      drag.current = null;
      return;
    }
    if (tool === "freehand" && isFreehandDragging) {
      setIsFreehandDragging(false);
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
      if (freehandStroke.length >= 2) {
        // Filter points for smooth wall segments of at least 300mm length
        const simplified: SketchPoint[] = [freehandStroke[0]];
        for (let i = 1; i < freehandStroke.length; i++) {
          const last = simplified[simplified.length - 1];
          if (Math.hypot(freehandStroke[i].xMm - last.xMm, freehandStroke[i].yMm - last.yMm) >= 300) {
            simplified.push(freehandStroke[i]);
          }
        }
        if (simplified.length >= 2) {
          const newLines = simplified.slice(1).map((end, i) => ({ start: simplified[i], end }));
          replace({ ...current, lines: [...current.lines, ...newLines] });
        }
      }
      setFreehandStroke([]);
    }
  };

  const locked = selected?.source === "current" && current.locks?.some(l => l.index === selected.index && l.interior === selected.interior);

  const applyLength = async () => {
    if (!selected) return;
    try {
      if (selected.source !== "project") {
        if (selected.source === "below") throw new Error("Copy the reference line into this floor before editing.");
        replace(resizeSketchLine(current, selected.index, selected.interior, Number(length) * 1000));
      } else {
        const w = projectWalls[selected.index], mm = Number(length) * 1000;
        if (w.curved) throw new Error("Edit curved project walls with the project arc tools.");
        if (!Number.isFinite(mm) || mm < 300 || mm > 80000) throw new Error("Length must be 0.3–80 m.");
        if (useLayoutDrawingStore.getState().lockedElementKeys.includes(`wall:${w.id}`)) throw new Error("This project wall is locked.");
        const old = Math.hypot(w.endXmm - w.startXmm, w.endYmm - w.startYmm);
        if (old < 1) throw new Error("Wall has no length.");
        setBusy(true);
        await useLayoutDrawingStore.getState().updateWall(w.id, {
          endXmm: w.startXmm + (w.endXmm - w.startXmm) * mm / old,
          endYmm: w.startYmm + (w.endYmm - w.startYmm) * mm / old
        });
        setError("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the wall.");
    } finally {
      setBusy(false);
    }
  };

  const applyAngle = async (targetAngleDeg?: number) => {
    if (!selected) return;
    const deg = targetAngleDeg ?? Number(angleInput);
    if (!Number.isFinite(deg)) { setError("Enter a valid angle in degrees."); return; }
    try {
      if (selected.source !== "project") {
        if (selected.source === "below") throw new Error("Copy reference line into this floor before editing.");
        replace(rotateSketchLine(current, selected.index, selected.interior, deg));
        setAngleInput(deg.toFixed(1));
        setError("");
      } else {
        const w = projectWalls[selected.index];
        if (w.curved) throw new Error("Curved project walls cannot be rotated directly.");
        const len = Math.hypot(w.endXmm - w.startXmm, w.endYmm - w.startYmm);
        const rad = deg * Math.PI / 180;
        setBusy(true);
        await useLayoutDrawingStore.getState().updateWall(w.id, {
          endXmm: Math.round(w.startXmm + len * Math.cos(rad)),
          endYmm: Math.round(w.startYmm + len * Math.sin(rad))
        });
        setAngleInput(deg.toFixed(1));
        setError("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update angle.");
    } finally {
      setBusy(false);
    }
  };

  const copySelected = () => {
    if (!selected) return;
    const l = lineFor(selected);
    if (!l) return;
    if (selected.source === "below" && !selected.interior && current.points.length === previous?.points.length) {
      if (current.locks?.length) { setError("Unlock outside lengths before copying."); return; }
      const points = current.points.map((p, i) => i === selected.index ? l.start : i === (selected.index + 1) % current.points.length ? l.end : p);
      replace({ ...current, points });
      setSelected({ ...selected, source: "current" });
    } else {
      if ([...current.lines, ...current.points.map((start, i) => ({ start, end: current.points[(i + 1) % current.points.length] }))].some(e => Math.hypot(e.start.xMm - l.start.xMm, e.start.yMm - l.start.yMm) < 1 && Math.hypot(e.end.xMm - l.end.xMm, e.end.yMm - l.end.yMm) < 1)) {
        setError("This line is already in the drawing.");
        return;
      }
      replace({ ...current, lines: [...current.lines, l] });
      setSelected({ source: "current", interior: true, index: current.lines.length });
    }
    setPickLayer("current");
  };

  const segment = (a: SketchPoint, b: SketchPoint, index: number, interior: boolean, source: Pick["source"], curvedPath?: string) => {
    const key = `${source}:${interior}:${index}`,
          active = selected?.source === source && selected.index === index && selected.interior === interior,
          highlight = hover === key,
          color = active ? "#16a34a" : highlight ? "#facc15" : source === "below" ? "#f59e0b" : source === "project" ? "#94a3b8" : interior ? "#a78bfa" : "#38bdf8",
          canPick = tool === "select" && pickLayer === source;
    const isLocked = source === "current" && current.locks?.some(l => l.index === index && l.interior === interior);
    const attrs = {
      stroke: color,
      strokeWidth: span * (source === "below" ? .005 : .003),
      strokeDasharray: source === "below" ? `${span * .012} ${span * .008}` : undefined,
      fill: "none",
      pointerEvents: "none" as const
    };
    const angle = lineAngleDeg(a, b).toFixed(0);
    return (
      <g key={key} className={highlight ? "ai-sketch-line-hover" : undefined}>
        {curvedPath ? <path d={curvedPath} {...attrs} /> : <line x1={a.xMm} y1={a.yMm} x2={b.xMm} y2={b.yMm} {...attrs} />}
        <text x={(a.xMm + b.xMm) / 2} y={(a.yMm + b.yMm) / 2 - span * .009} pointerEvents="none" fontSize={span * .013} textAnchor="middle" fill={color}>
          {(Math.hypot(b.xMm - a.xMm, b.yMm - a.yMm) / 1000).toFixed(1)} m · {angle}°{isLocked ? " · locked" : ""}
        </text>
        {canPick && (curvedPath ? (
          <path d={curvedPath} fill="none" stroke="transparent" strokeWidth={span * .018} onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} onClick={e => { e.stopPropagation(); chooseLine(index, interior, source); }} />
        ) : (
          <line x1={a.xMm} y1={a.yMm} x2={b.xMm} y2={b.yMm} stroke="transparent" strokeWidth={span * .018} onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} onClick={e => { e.stopPropagation(); chooseLine(index, interior, source); }} />
        ))}
      </g>
    );
  };

  const drawing = (s: FloorSketch, source: Pick["source"]) => (
    <g className={source === "below" ? "ai-sketch-below" : "ai-sketch-current"}>
      {s.points.length >= 3 && <polygon points={s.points.map(p => `${p.xMm},${p.yMm}`).join(" ")} fill={source === "below" ? "#f59e0b12" : "#38bdf80c"} stroke="none" pointerEvents="none" />}
      {source === "current" && s.labels?.map((label, i) => {
        const room = sketchRooms(s).find(r => insidePolygon(label.point, r));
        return (
          <g key={`room${i}`} pointerEvents="none">
            {room && <polygon points={room.map(p => `${p.xMm},${p.yMm}`).join(" ")} fill={`${colors[label.use]}25`} />}
            <text x={label.point.xMm} y={label.point.yMm} fontSize={span * .02} textAnchor="middle" fill="currentColor" fontWeight="600">{label.name}</text>
            {room && <text x={label.point.xMm} y={label.point.yMm + span * .025} fontSize={span * .014} fill="currentColor" textAnchor="middle">{(polygonArea(room) / 1e6).toFixed(1)} m² · {label.use}</text>}
          </g>
        );
      })}
      {s.points.map((a, i) => segment(a, s.points[(i + 1) % s.points.length], i, false, source))}
      {s.lines.map((l, i) => segment(l.start, l.end, i, true, source))}
      {source === "current" && s.points.map((p, i) => <circle key={`p${i}`} cx={p.xMm} cy={p.yMm} r={span * .004} fill="#38bdf8" pointerEvents="none" />)}
      {(s.gardens ?? []).map((g, i) => {
        const b = inscribedRectangle(g);
        return (
          <g key={`garden${i}`} pointerEvents="none">
            <polygon points={g.map(p => `${p.xMm},${p.yMm}`).join(" ")} fill="#22c55e28" stroke="#16a34a" strokeWidth={span * .002} strokeDasharray={`${span * .008} ${span * .004}`} />
            <text x={b.xMm + b.widthMm / 2} y={b.yMm + b.depthMm / 2} textAnchor="middle" fill="#16a34a" fontSize={span * .018} fontWeight="600">
              🌱 Garden · {(polygonArea(g) / 1e6).toFixed(1)} m²
            </text>
          </g>
        );
      })}
    </g>
  );

  const projectDrawing = (
    <g className="ai-sketch-project">
      {slabs.filter(s => s.levelId === projectLevel).map(s => <polygon key={s.id} points={(s.boundary ?? []).map(p => `${p.xMm},${p.yMm}`).join(" ")} fill="#94a3b808" stroke="#94a3b8" strokeWidth={span * .001} pointerEvents="none" />)}
      {equipment.filter(e => e.levelId === projectLevel).map(e => <g key={e.id} transform={`translate(${e.xMm} ${e.yMm}) rotate(${e.rotationDeg ?? 0})`} pointerEvents="none"><rect x={-(e.widthMm ?? 600) / 2} y={-(e.depthMm ?? 600) / 2} width={e.widthMm ?? 600} height={e.depthMm ?? 600} fill={`${e.color ?? "#94a3b8"}22`} stroke={e.color ?? "#94a3b8"} strokeWidth={span * .001} /><text fontSize={span * .009} textAnchor="middle" fill="currentColor">{componentPreset(e.familyId ?? "")?.name ?? e.category}</text></g>)}
      {columns.filter(c => c.levelId === projectLevel).map(c => <rect key={c.id} x={c.xMm - c.widthMm / 2} y={c.yMm - c.depthMm / 2} width={c.widthMm} height={c.depthMm} fill="#64748b" pointerEvents="none" />)}
      {[...ducts, ...pipes].filter(e => e.levelId === projectLevel).map(e => <line key={e.id} x1={e.startXmm} y1={e.startYmm} x2={e.endXmm} y2={e.endYmm} stroke={"diameterMm" in e ? "#14b8a6" : "#fb923c"} strokeWidth={span * .002} pointerEvents="none" />)}
      {projectWalls.map((w, i) => {
        const a = { xMm: w.startXmm, yMm: w.startYmm }, b = { xMm: w.endXmm, yMm: w.endYmm };
        let path: string | undefined;
        if (w.curved && w.arcRadiusMm && w.arcCenterXmm !== undefined && w.arcCenterYmm !== undefined) {
          const start = w.arcStartAngleDeg ?? 0, sweep = w.arcSweepDeg ?? ((w.arcEndAngleDeg ?? 0) - start),
                pts = Array.from({ length: 25 }, (_, idx) => {
                  const angle = (start + sweep * idx / 24) * Math.PI / 180;
                  return `${w.arcCenterXmm! + w.arcRadiusMm! * Math.cos(angle)},${w.arcCenterYmm! + w.arcRadiusMm! * Math.sin(angle)}`;
                });
          path = `M${pts.join(" L")}`;
        }
        return segment(a, b, i, false, "project", path);
      })}
      {[...doors, ...windows].filter(o => projectWalls.some(w => w.id === o.wallId)).map(o => {
        const w = projectWalls.find(w => w.id === o.wallId)!, len = Math.hypot(w.endXmm - w.startXmm, w.endYmm - w.startYmm), t = o.positionMm / len;
        return <circle key={o.id} cx={w.startXmm + (w.endXmm - w.startXmm) * t} cy={w.startYmm + (w.endYmm - w.startYmm) * t} r={span * .005} fill={"sillHeightMm" in o ? "#38bdf8" : "#fb923c"} pointerEvents="none" />;
      })}
      {roomsInProject?.filter(r => r.levelId === projectLevel).map(r => <text key={r.id} x={r.tagPosMm.xMm} y={r.tagPosMm.yMm} fontSize={span * .016} textAnchor="middle" fill="#94a3b8" pointerEvents="none">{r.name}</text>)}
    </g>
  );

  // AutoCAD Live Preview calculations
  let liveRubberband: React.ReactNode = null;
  if (anchors.length > 0 && cursorPoint) {
    const last = anchors[anchors.length - 1];
    const liveLen = (Math.hypot(cursorPoint.xMm - last.xMm, cursorPoint.yMm - last.yMm) / 1000).toFixed(2);
    const liveAngle = lineAngleDeg(last, cursorPoint).toFixed(1);

    if (tool === "wall") {
      liveRubberband = (
        <g pointerEvents="none">
          <line x1={last.xMm} y1={last.yMm} x2={cursorPoint.xMm} y2={cursorPoint.yMm} stroke="#38bdf8" strokeWidth={span * .003} strokeDasharray={`${span * .01} ${span * .006}`} />
          <g transform={`translate(${(last.xMm + cursorPoint.xMm) / 2} ${(last.yMm + cursorPoint.yMm) / 2 - span * .015})`}>
            <rect x={-span * .055} y={-span * .012} width={span * .11} height={span * .024} rx={span * .006} fill="#090d16eb" stroke="#38bdf8" strokeWidth={span * .001} />
            <text x={0} y={span * .005} textAnchor="middle" fill="#38bdf8" fontSize={span * .012} fontWeight="600">{liveLen} m · {liveAngle}°</text>
          </g>
        </g>
      );
    } else if (tool === "arc") {
      if (anchors.length === 1) {
        liveRubberband = (
          <g pointerEvents="none">
            <line x1={last.xMm} y1={last.yMm} x2={cursorPoint.xMm} y2={cursorPoint.yMm} stroke="#a78bfa" strokeWidth={span * .003} strokeDasharray={`${span * .01} ${span * .006}`} />
            <g transform={`translate(${(last.xMm + cursorPoint.xMm) / 2} ${(last.yMm + cursorPoint.yMm) / 2 - span * .015})`}>
              <rect x={-span * .055} y={-span * .012} width={span * .11} height={span * .024} rx={span * .006} fill="#090d16eb" stroke="#a78bfa" strokeWidth={span * .001} />
              <text x={0} y={span * .005} textAnchor="middle" fill="#a78bfa" fontSize={span * .012} fontWeight="600">Chord: {liveLen} m</text>
            </g>
          </g>
        );
      } else if (anchors.length === 2) {
        let pathD: string | null = null;
        try {
          const segs = arcSegments(anchors[0], anchors[1], cursorPoint);
          pathD = `M ${segs[0].start.xMm} ${segs[0].start.yMm} ` + segs.map(s => `L ${s.end.xMm} ${s.end.yMm}`).join(" ");
        } catch {
          pathD = null;
        }
        if (pathD) {
          liveRubberband = (
            <g pointerEvents="none">
              <path d={pathD} fill="none" stroke="#a78bfa" strokeWidth={span * .004} strokeDasharray={`${span * .01} ${span * .006}`} />
              <circle cx={cursorPoint.xMm} cy={cursorPoint.yMm} r={span * .006} fill="#a78bfa" />
              <g transform={`translate(${cursorPoint.xMm} ${cursorPoint.yMm - span * .02})`}>
                <rect x={-span * .04} y={-span * .012} width={span * .08} height={span * .024} rx={span * .006} fill="#090d16eb" stroke="#a78bfa" strokeWidth={span * .001} />
                <text x={0} y={span * .005} textAnchor="middle" fill="#a78bfa" fontSize={span * .012} fontWeight="600">Bend arc</text>
              </g>
            </g>
          );
        }
      }
    } else if (tool === "rectangle") {
      const rx = Math.min(last.xMm, cursorPoint.xMm), ry = Math.min(last.yMm, cursorPoint.yMm),
            rw = Math.abs(cursorPoint.xMm - last.xMm), rd = Math.abs(cursorPoint.yMm - last.yMm);
      liveRubberband = (
        <g pointerEvents="none">
          <rect x={rx} y={ry} width={rw} height={rd} fill="#38bdf814" stroke="#38bdf8" strokeWidth={span * .002} strokeDasharray={`${span * .01} ${span * .006}`} />
          <text x={rx + rw / 2} y={ry + rd / 2} textAnchor="middle" fill="#38bdf8" fontSize={span * .015} fontWeight="600">{(rw / 1000).toFixed(1)} m × {(rd / 1000).toFixed(1)} m</text>
        </g>
      );
    } else if (tool === "circle") {
      const rad = Math.hypot(cursorPoint.xMm - last.xMm, cursorPoint.yMm - last.yMm);
      liveRubberband = (
        <g pointerEvents="none">
          <circle cx={last.xMm} cy={last.yMm} r={rad} fill="#38bdf814" stroke="#38bdf8" strokeWidth={span * .002} strokeDasharray={`${span * .01} ${span * .006}`} />
          <line x1={last.xMm} y1={last.yMm} x2={cursorPoint.xMm} y2={cursorPoint.yMm} stroke="#38bdf8" strokeWidth={span * .0015} strokeDasharray={`${span * .008} ${span * .005}`} />
          <text x={(last.xMm + cursorPoint.xMm) / 2} y={(last.yMm + cursorPoint.yMm) / 2 - span * .01} textAnchor="middle" fill="#38bdf8" fontSize={span * .013}>R: {(rad / 1000).toFixed(1)} m</text>
        </g>
      );
    } else if (tool === "garden") {
      const gx = Math.min(last.xMm, cursorPoint.xMm), gy = Math.min(last.yMm, cursorPoint.yMm),
            gw = Math.abs(cursorPoint.xMm - last.xMm), gd = Math.abs(cursorPoint.yMm - last.yMm);
      const gArea = (gw * gd / 1e6).toFixed(1);
      liveRubberband = (
        <g pointerEvents="none">
          <rect x={gx} y={gy} width={gw} height={gd} fill="#22c55e28" stroke="#16a34a" strokeWidth={span * .002} strokeDasharray={`${span * .01} ${span * .006}`} />
          <text x={gx + gw / 2} y={gy + gd / 2} textAnchor="middle" fill="#16a34a" fontSize={span * .016} fontWeight="600">🌱 Garden · {gArea} m²</text>
        </g>
      );
    }
  }

  return createPortal(
    <div className="ai-sketch-overlay">
      <section role="dialog" aria-modal="true" aria-label="House drawing workspace" className="ai-sketch-workspace" onKeyDown={e => {
        if (e.key !== "Escape") e.stopPropagation();
        if (e.key === "Tab") {
          const targets = [...e.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled),select:not(:disabled),input:not(:disabled)")],
                first = targets[0], last = targets[targets.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }}>
        <header>
          <div className="ai-sketch-title">
            <span className="ai-sketch-title-icon"><FiMaximize2/></span>
            <div>
              <strong>Draw your building</strong>
              <small>AutoCAD 2D drafting · Freehand paint · Dimensions in metres & degrees</small>
            </div>
          </div>
          <div className="ai-sketch-top-actions">
            <button type="button" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={disabled || !past.length} onClick={doUndo}>
              <FiCornerUpLeft/> <span>Undo</span>
            </button>
            <button type="button" aria-label="Redo" title="Redo (Ctrl+Y)" disabled={disabled || !future.length} onClick={doRedo}>
              <FiCornerUpRight/> <span>Redo</span>
            </button>
            <button ref={closeRef} type="button" className="btn-v-yellow" onClick={onClose}>
              <FiCheck/> Done
            </button>
          </div>
        </header>

        <div className="ai-sketch-toolbar">
          <label>Building
            <select aria-label="Sketch building type" value={parameters.variant} disabled={disabled} onChange={e => change(e.target.value === "duplex" && sketches.length === 1 ? [current, { points: current.points, lines: [] }] : sketches, e.target.value as ResidentialParameters["variant"])}>
              <option value="apartment">Apartment</option>
              <option value="villa">Villa / house</option>
              <option value="duplex">Multi-storey house</option>
            </select>
          </label>
          <label>Floor / Level
            <select aria-label="Drawing floor" value={floor} onChange={e => {
              const nextFloor = Number(e.target.value);
              setFloor(nextFloor);
              resetSelection();
              setPickLayer("current");
              if (levels[nextFloor]) setProjectLevel(levels[nextFloor].id);
            }}>
              {sketches.map((_, i) => {
                const lvl = levels[i];
                const label = lvl ? `${lvl.name} (${(lvl.elevationMm / 1000).toFixed(1)}m)` : (i === 0 ? "Ground floor" : `Floor ${i}`);
                return <option key={i} value={i}>{label}</option>;
              })}
            </select>
          </label>
          <button type="button" disabled={disabled || sketches.length >= 4} onClick={() => {
            change([...sketches, { points: current.points, lines: [] }], "duplex");
            setFloor(sketches.length);
            resetSelection();
            if (levels[sketches.length]) setProjectLevel(levels[sketches.length].id);
          }}>
            <FiPlus/> Add floor
          </button>
          <label>
            <input type="checkbox" checked={below} onChange={e => { setBelow(e.target.checked); if (!e.target.checked) setPickLayer("current"); }} /> Floor below <span className="ai-sketch-legend">amber dashed</span>
          </label>
          <div className="ai-sketch-view-controls">
            <button type="button" aria-label="Zoom out" onClick={() => setZoom(v => Math.max(.5, v / 1.25))}><FiZoomOut/></button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" aria-label="Zoom in" onClick={() => setZoom(v => Math.min(4, v * 1.25))}><FiZoomIn/></button>
            <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Fit</button>
          </div>
        </div>

        <div className="ai-sketch-body">
          <div className={`ai-sketch-drawing ai-sketch-tool-${tool}`}>
            <svg
              viewBox={`${viewX} ${viewY} ${span} ${span}`}
              onClick={click}
              onPointerDown={onPointerDownCanvas}
              onPointerMove={onPointerMoveCanvas}
              onPointerUp={onPointerUpCanvas}
              onPointerCancel={() => { drag.current = null; setIsFreehandDragging(false); setFreehandStroke([]); }}
              aria-label="Editable 2D floor drawing"
              role="img"
            >
              <defs>
                <pattern id="ai-sketch-grid" width="1000" height="1000" patternUnits="userSpaceOnUse">
                  <path d="M1000 0H0V1000" fill="none" stroke="currentColor" strokeWidth="10" opacity=".1" />
                </pattern>
              </defs>
              <rect x={viewX} y={viewY} width={span} height={span} fill={grid ? "url(#ai-sketch-grid)" : "transparent"} />
              {projectVisible && projectDrawing}
              {below && previous && drawing(previous, "below")}
              {drawing(current, "current")}
              {/* AutoCAD Live previews */}
              {liveRubberband}
              {/* Freehand active stroke */}
              {isFreehandDragging && freehandStroke.length > 1 && (
                <polyline
                  points={freehandStroke.map(p => `${p.xMm},${p.yMm}`).join(" ")}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth={span * .004}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              )}
              {/* Snap indicator box (AutoCAD style) */}
              {snapPoint && (
                <g pointerEvents="none">
                  <rect
                    x={snapPoint.xMm - span * .007}
                    y={snapPoint.yMm - span * .007}
                    width={span * .014}
                    height={span * .014}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth={span * .002}
                  />
                  <text x={snapPoint.xMm} y={snapPoint.yMm - span * .012} textAnchor="middle" fill="#22c55e" fontSize={span * .011} fontWeight="bold">Snap</text>
                </g>
              )}
              {/* Anchors */}
              {anchors.map((a, i) => (
                <circle key={i} cx={a.xMm} cy={a.yMm} r={span * .007} fill="#facc15" stroke="#854d0e" strokeWidth={span * .001} pointerEvents="none" />
              ))}
              {roomPoint && <circle cx={roomPoint.xMm} cy={roomPoint.yMm} r={span * .005} fill="#facc15" pointerEvents="none" />}
            </svg>
            <div className="ai-sketch-canvas-note">
              {tool === "arc" 
                ? (anchors.length === 0 ? "Click start of arc" : anchors.length === 1 ? "Click end of arc" : "Move cursor and click to bend the live arc")
                : tool === "wall"
                  ? (anchors.length === 0 ? "Click start of wall line" : "Click end of wall line (Esc to finish chain)")
                  : tool === "freehand"
                    ? "Drag on canvas to sketch freehand walls"
                    : help[tool]}
              <span>250 mm snap · 1 m grid · Esc to cancel</span>
            </div>
          </div>

          <aside>
            <section className="ai-sketch-card">
              <h3>Drawing tools</h3>
              <div className="ai-sketch-toolbox">
                {tools.map(t => (
                  <button key={t.id} type="button" disabled={disabled} aria-pressed={tool === t.id} onClick={() => { setTool(t.id); resetSelection(); }}>
                    {t.icon}<span>{t.name}</span>
                  </button>
                ))}
              </div>
              <p>{help[tool]}</p>
              <div className="ai-sketch-checks">
                <label><input type="checkbox" checked={orthogonal} onChange={e => setOrthogonal(e.target.checked)} /> Ortho snap (90°)</label>
                <label><input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)} /><FiGrid/> Grid</label>
              </div>
            </section>

            {selected && (
              <section className="ai-sketch-card">
                <h3>{selected.source === "project" ? "Existing project wall" : selected.source === "below" ? "Reference line below" : "Selected line"}</h3>
                
                {/* Length edit */}
                <label>Length · metres
                  <input aria-label="Selected sketch line length in metres" type="number" step=".1" min=".3" max="80" value={length} disabled={!!locked || selected.source === "below"} onChange={e => setLength(e.target.value)} />
                </label>
                <button type="button" className="btn-v-yellow" disabled={disabled || busy || !!locked || selected.source === "below"} onClick={applyLength}>
                  {selected.source === "project" ? "Save project wall length" : "Apply length"}
                </button>

                {/* Angle edit */}
                <label>Angle · degrees (0° - 360°)
                  <input aria-label="Selected line angle in degrees" type="number" step="1" min="0" max="360" value={angleInput} disabled={!!locked || selected.source === "below"} onChange={e => setAngleInput(e.target.value)} />
                </label>
                <button type="button" className="btn-v-yellow" disabled={disabled || busy || !!locked || selected.source === "below"} onClick={() => applyAngle()}>
                  <FiRotateCw/> Apply angle
                </button>
                <div className="ai-sketch-angle-presets">
                  {[0, 45, 90, 135, 180, 270].map(deg => (
                    <button key={deg} type="button" disabled={disabled || busy || !!locked || selected.source === "below"} onClick={() => applyAngle(deg)}>
                      {deg}°
                    </button>
                  ))}
                </div>

                {selected.source === "current" ? (
                  <>
                    <button type="button" aria-pressed={!!locked} onClick={() => {
                      const l = lineFor(selected)!;
                      replace({
                        ...current,
                        locks: locked 
                          ? (current.locks ?? []).filter(v => v.index !== selected.index || v.interior !== selected.interior)
                          : [...(current.locks ?? []), { index: selected.index, interior: selected.interior, lengthMm: Math.hypot(l.end.xMm - l.start.xMm, l.end.yMm - l.start.yMm) }]
                      });
                    }}>
                      {locked ? <FiUnlock/> : <FiLock/>}{locked ? "Unlock length" : "Lock length"}
                    </button>
                    {selected.interior && (
                      <button type="button" disabled={disabled || !!locked} onClick={() => {
                        replace({
                          ...current,
                          lines: current.lines.filter((_, i) => i !== selected.index),
                          locks: current.locks?.filter(l => !l.interior || l.index !== selected.index).map(l => l.interior && l.index > selected.index ? { ...l, index: l.index - 1 } : l)
                        });
                        resetSelection();
                      }}>
                        <FiTrash2/> Delete wall
                      </button>
                    )}
                  </>
                ) : (
                  <button type="button" disabled={disabled} onClick={copySelected}>Copy line into this floor</button>
                )}
                {selected.source === "project" && <p>Edits update this wall in the project immediately.</p>}
              </section>
            )}

            {roomPoint && (
              <section className="ai-sketch-card">
                <h3>Name this room</h3>
                <label>Room name
                  <input aria-label="Closed room name" type="text" maxLength={60} value={roomName} placeholder="e.g. Master bedroom" onChange={e => {
                    setRoomName(e.target.value);
                    const name = e.target.value.toLowerCase();
                    const inferred = uses.find(u => name.includes(u)) ?? (/office|work/.test(name) ? "study" : /lounge|family/.test(name) ? "living" : /wc|toilet|shower/.test(name) ? "bathroom" : /hall|entry/.test(name) ? "corridor" : undefined);
                    if (inferred) setRoomUse(inferred);
                  }} />
                </label>
                <label>Room use
                  <select aria-label="Closed room use" value={roomUse} onChange={e => setRoomUse(e.target.value as RoomUse)}>
                    {uses.map(u => <option key={u} value={u}>{u[0].toUpperCase() + u.slice(1)}</option>)}
                  </select>
                </label>
                <button className="btn-v-yellow" type="button" disabled={disabled || !roomName.trim()} onClick={() => {
                  const room = sketchRooms(current).find(r => insidePolygon(roomPoint, r));
                  if (!room) { setError("Room is no longer closed."); return; }
                  replace({
                    ...current,
                    labels: [...(current.labels ?? []).filter(l => !insidePolygon(l.point, room)), { point: roomPoint, name: roomName.trim(), use: roomUse }]
                  });
                  setRoomPoint(null);
                }}>
                  Save room name
                </button>
              </section>
            )}

            <section className="ai-sketch-card">
              <h3>Shapes & Outlines</h3>
              <div className="ai-suggestion-row">
                {(["rectangle", "l", "u"] as const).map(s => (
                  <button key={s} type="button" disabled={disabled} onClick={() => {
                    if (current.locks?.length) { setError("Unlock lengths before replacing the shape."); return; }
                    const w = Math.max(4000, ...current.points.map(p => p.xMm)),
                          d = Math.max(4000, ...current.points.map(p => p.yMm));
                    replace({
                      ...current,
                      points: FOOTPRINTS[s].map(p => ({ xMm: p.x * w, yMm: p.y * d })),
                      lines: [], labels: [], locks: []
                    });
                    resetSelection();
                  }}>
                    {s === "rectangle" ? "Rectangle" : `${s.toUpperCase()} shape`}
                  </button>
                ))}
              </div>
              <p>Add walls using Wall / Line, Freehand or Arc. Rectangle & Circle tools add walls in those shapes.</p>
            </section>

            <section className="ai-sketch-card">
              <h3>Layers & references</h3>
              <label>Select lines from
                <select aria-label="Pick drawing layer" value={pickLayer} onChange={e => { setPickLayer(e.target.value as Pick["source"]); setTool("select"); resetSelection(); }}>
                  <option value="current">This floor</option>
                  <option value="below" disabled={!previous || !below}>Floor below</option>
                  <option value="project" disabled={!projectWalls.length || !projectVisible}>Existing project</option>
                </select>
              </label>
              <label>
                <input type="checkbox" checked={projectVisible} onChange={e => { setProjectVisible(e.target.checked); if (!e.target.checked) setPickLayer("current"); }} /> Show existing project
              </label>
              {levels.length > 0 && (
                <label>Project level
                  <select aria-label="Existing project level" value={projectLevel} onChange={e => { setProjectLevel(e.target.value); resetSelection(); }}>
                    {levels.map(l => <option key={l.id} value={l.id}>{l.name} ({(l.elevationMm / 1000).toFixed(1)}m)</option>)}
                  </select>
                </label>
              )}
              {floor > 0 && (
                <button type="button" disabled={disabled} onClick={() => {
                  if (current.locks?.length) { setError("Unlock lengths first."); return; }
                  replace({ ...current, points: previous!.points, lines: [], labels: [], locks: [] });
                  resetSelection();
                }}>
                  Copy outline from below
                </button>
              )}
            </section>

            <section className="ai-sketch-card">
              <h3>Clear & Reset</h3>
              <button type="button" disabled={disabled || !!current.locks?.length} onClick={() => {
                replace({ ...current, points: [], lines: [], labels: [], locks: [] });
                resetSelection();
                setTool("wall");
              }}>
                Clear this floor
              </button>
              {!!current.gardens?.length && (
                <button type="button" disabled={disabled} onClick={() => replace({ ...current, gardens: current.gardens?.slice(0, -1) })}>
                  Remove last garden
                </button>
              )}
            </section>

            {error && <p role="alert" className="ai-error">{error}</p>}
          </aside>
        </div>
      </section>
    </div>,
    document.body
  );
}
