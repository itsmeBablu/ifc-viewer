"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { 
  FiMaximize2, FiMousePointer, FiSquare, FiCircle, FiType, FiLock, FiUnlock, 
  FiLayers, FiGrid, FiTrash2, FiCornerUpLeft, FiCornerUpRight, FiMove, FiPlus, 
  FiZoomIn, FiZoomOut, FiCheck, FiEdit2, FiEdit3, FiRotateCw, FiX
} from "react-icons/fi";
import type { FloorSketch, ResidentialParameters, RoomUse, SketchPoint } from "@/lib/ai/modeling/allocation";
import { FOOTPRINTS, insidePolygon, inscribedRectangle, polygonArea } from "@/lib/ai/modeling/footprint";
import { resizeSketchLine, circularOutline, arcSegments, lineAngleDeg, rotateSketchLine } from "@/lib/ai/modeling/sketchEditing";
import { sketchRooms } from "@/lib/ai/modeling/sketch";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { componentPreset } from "@/lib/componentCatalog";

type Tool = "select" | "wall" | "freehand" | "arc" | "rectangle" | "circle" | "room" | "garden" | "pan";
type DrawMode = "walls" | "furniture" | "mep";
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
  select: "Click any line to select it. Then edit its length or angle in the sidebar, or click the lock icon on the line.",
  wall: "Click to place start, move cursor, click to place end. Draw continuous walls by chaining clicks. Press Escape to finish a chain.",
  freehand: "Hold and drag to sketch walls freely — like a pencil. Release to commit.",
  arc: "Click start → click end → move cursor to bend the live arc, then click to place.",
  rectangle: "Click two opposite corners to draw a rectangular outline.",
  circle: "Click the centre, then click to set the radius.",
  garden: "Click corner by corner to define a garden boundary. Double-click the last point to close the polygon.",
  room: "Click inside a fully enclosed room area to add a name and use tag.",
  pan: "Drag to pan the view. Scroll wheel or +/− to zoom, or click Fit to reset."
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

  // Determine total sketch floors: use the max of sketches.length and levels.length
  const totalFloors = Math.max(parameters.sketches?.length ?? 1, 1);
  const sketches = parameters.sketches ?? Array.from({ length: parameters.variant === "duplex" ? 2 : 1 }, () => seed);

  const [floor, setFloor] = useState(0), [drawMode, setDrawMode] = useState<DrawMode>("walls"),
        [tool, setTool] = useState<Tool>("wall"),
        [below, setBelow] = useState(true),
        [anchors, setAnchors] = useState<SketchPoint[]>([]),
        [selected, setSelected] = useState<Pick | null>(null),
        [hover, setHover] = useState<string | null>(null),
        [length, setLength] = useState(""),
        [angleInput, setAngleInput] = useState(""),
        [wallType, setWallType] = useState<"exterior"|"partition"|"fire"|"curtain">("partition"),
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

  // Inline length edit state (for selected line foreignObject input)
  const [inlineLen, setInlineLen] = useState("");
  const inlineLenRef = useRef<HTMLInputElement | null>(null);

  // AutoCAD live drafting & paint states
  const [cursorPoint, setCursorPoint] = useState<SketchPoint | null>(null);
  const [snapPoint, setSnapPoint] = useState<SketchPoint | null>(null);
  const [freehandStroke, setFreehandStroke] = useState<SketchPoint[]>([]);
  const [isFreehandDragging, setIsFreehandDragging] = useState(false);

  // Garden polygon building state
  const [gardenAnchors, setGardenAnchors] = useState<SketchPoint[]>([]);

  // Garden vertex drag state
  const [gardenDrag, setGardenDrag] = useState<{ gardenIdx: number; vertIdx: number } | null>(null);

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
  const addDetailLine = (line: {start:SketchPoint;end:SketchPoint}) => replace({...current,[drawMode === "mep" ? "mepLines" : "furnitureLines"]:[...(current[drawMode === "mep" ? "mepLines" : "furnitureLines"]??[]),line]});
  const resetSelection = () => { setSelected(null); setAnchors([]); setGardenAnchors([]); setRoomPoint(null); };

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
        // Escape never closes the workspace — it only cancels current action
        if (gardenAnchors.length) { setGardenAnchors([]); return; }
        if (anchors.length) { setAnchors([]); setCursorPoint(null); return; }
        if (selected) { resetSelection(); return; }
        // Do NOT call onClose() — user must click "Done"
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
  }, [onClose, past, future, sketches, anchors, gardenAnchors, selected, disabled]);

  // Sync inline length field when selection changes
  useEffect(() => {
    if (!selected) { setInlineLen(""); return; }
    const l = lineFor(selected);
    if (l) setInlineLen((Math.hypot(l.end.xMm - l.start.xMm, l.end.yMm - l.start.yMm) / 1000).toFixed(2));
  }, [selected]);

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
    setWallType(current.wallTypes?.find(w=>w.index===index&&w.interior===interior)?.type??(interior?"partition":"exterior"));
    setRoomPoint(null);
  };

  const getCanvasPoint = (event: React.MouseEvent<SVGSVGElement> | React.PointerEvent<SVGSVGElement>): SketchPoint | null => {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return null;
    const pt = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { xMm: pt.x, yMm: pt.y };
  };

  const getCanvasPointFromElement = (event: React.PointerEvent<SVGSVGElement>, svgEl: SVGSVGElement): SketchPoint | null => {
    const matrix = svgEl.getScreenCTM();
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
    // Handle garden vertex drag
    if (gardenDrag) {
      const raw = getCanvasPoint(event);
      if (!raw) return;
      const { point } = resolvePoint(raw, false);
      const gardens = current.gardens ?? [];
      const garden = [...gardens[gardenDrag.gardenIdx]];
      garden[gardenDrag.vertIdx] = point;
      const nextGardens = gardens.map((g, i) => i === gardenDrag.gardenIdx ? garden : g);
      // Live update without history push
      const next = sketches.map((s, i) => i === floor ? { ...s, gardens: nextGardens } : s);
      onChange({ ...parameters, sketches: next });
      return;
    }

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

      // Garden polygon mode: click-by-click corners
      if (tool === "garden") {
        const lastGarden = gardenAnchors[gardenAnchors.length - 1];
        if (lastGarden && Math.hypot(point.xMm - gardenAnchors[0].xMm, point.yMm - gardenAnchors[0].yMm) < span * 0.025 && gardenAnchors.length >= 3) {
          // Close polygon
          const garden = [...gardenAnchors];
          const targetFloor = 0;
          const groundSketch = sketches[targetFloor];
          const nextGround = { ...groundSketch, gardens: [...(groundSketch.gardens ?? []), garden] };
          change(sketches.map((s, i) => i === targetFloor ? nextGround : s));
          setGardenAnchors([]);
          if (floor !== 0) setError("Garden added to Ground floor.");
          return;
        }
        setGardenAnchors(g => [...g, point]);
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
          // Double clicked or too short: finish chain
          setAnchors([]);
          return;
        }
        const newLine = { start: a, end: point };
        if(drawMode === "walls") replace({ ...current, lines: [...current.lines, newLine] }); else addDetailLine(newLine);
        // AutoCAD continuous polyline: anchor to new point
        setAnchors([point]);
        return;
      }

      if (tool === "arc") {
        const additions = arcSegments(a, anchors[1], point);
        if(drawMode === "walls") replace({ ...current, lines: [...current.lines, ...additions] }); else additions.forEach(addDetailLine);
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
    // Commit garden vertex drag
    if (gardenDrag) {
      setGardenDrag(null);
      // Push to history
      setPast(v => [...v.slice(-29), sketches]);
      setFuture([]);
      return;
    }
    if (drag.current) {
      drag.current = null;
      return;
    }
    if (tool === "freehand" && isFreehandDragging) {
      setIsFreehandDragging(false);
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
      if (freehandStroke.length >= 2) {
        const simplified: SketchPoint[] = [freehandStroke[0]];
        for (let i = 1; i < freehandStroke.length; i++) {
          const last = simplified[simplified.length - 1];
          if (Math.hypot(freehandStroke[i].xMm - last.xMm, freehandStroke[i].yMm - last.yMm) >= 300) {
            simplified.push(freehandStroke[i]);
          }
        }
        if (simplified.length >= 2) {
          const newLines = simplified.slice(1).map((end, i) => ({ start: simplified[i], end }));
          if(drawMode === "walls") replace({ ...current, lines: [...current.lines, ...newLines] }); else newLines.forEach(addDetailLine);
        }
      }
      setFreehandStroke([]);
    }
  };

  // Double-click to close garden polygon
  const onDoubleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (tool === "garden" && gardenAnchors.length >= 3) {
      const garden = [...gardenAnchors];
      const targetFloor = 0;
      const groundSketch = sketches[targetFloor];
      const nextGround = { ...groundSketch, gardens: [...(groundSketch.gardens ?? []), garden] };
      change(sketches.map((s, i) => i === targetFloor ? nextGround : s));
      setGardenAnchors([]);
      if (floor !== 0) setError("Garden added to Ground floor.");
    }
  };

  const locked = selected?.source === "current" && current.locks?.some(l => l.index === selected.index && l.interior === selected.interior);

  const toggleLineLock = (index: number, interior: boolean) => {
    if (disabled) return;
    const isLocked = current.locks?.some(l => l.index === index && l.interior === interior);
    const pick = { index, interior, source: "current" as const };
    const l = lineFor(pick);
    if (!l) return;
    replace({
      ...current,
      locks: isLocked
        ? (current.locks ?? []).filter(v => v.index !== index || v.interior !== interior)
        : [...(current.locks ?? []), { index, interior, lengthMm: Math.hypot(l.end.xMm - l.start.xMm, l.end.yMm - l.start.yMm) }]
    });
  };

  const applyLength = async (lenVal?: string) => {
    if (!selected) return;
    const mm = Number(lenVal ?? length) * 1000;
    try {
      if (selected.source !== "project") {
        if (selected.source === "below") throw new Error("Copy the reference line into this floor before editing.");
        replace(resizeSketchLine(current, selected.index, selected.interior, mm));
      } else {
        const w = projectWalls[selected.index];
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

  // Render a line segment with inline lock icon and inline length input
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
    const midX = (a.xMm + b.xMm) / 2;
    const midY = (a.yMm + b.yMm) / 2;
    const lineLen = Math.hypot(b.xMm - a.xMm, b.yMm - a.yMm);
    const angle = lineAngleDeg(a, b).toFixed(0);
    const lockIconSize = span * .018;
    const lockIconY = midY - span * .022;

    return (
      <g key={key} className={highlight ? "ai-sketch-line-hover" : undefined}>
        {curvedPath ? <path d={curvedPath} {...attrs} /> : <line x1={a.xMm} y1={a.yMm} x2={b.xMm} y2={b.yMm} {...attrs} />}

        {/* Length + angle + lock indicator label */}
        <text x={midX} y={midY - span * .009} pointerEvents="none" fontSize={span * .012} textAnchor="middle" fill={color} opacity={0.85}>
          {(lineLen / 1000).toFixed(1)} m · {angle}°{isLocked ? " 🔒" : ""}
        </text>

        {/* Inline lock toggle icon — only visible for current-layer lines */}
        {source === "current" && !disabled && (
          <g
            className="ai-sketch-inline-lock"
            transform={`translate(${midX + span * .045} ${lockIconY})`}
            onClick={e => { e.stopPropagation(); toggleLineLock(index, interior); }}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={-lockIconSize * .6} y={-lockIconSize * .6}
              width={lockIconSize * 1.2} height={lockIconSize * 1.2}
              rx={lockIconSize * .25}
              fill={isLocked ? "#facc15" : "#1e293b"}
              stroke={isLocked ? "#854d0e" : "#475569"}
              strokeWidth={span * .001}
              opacity={0.88}
            />
            {isLocked ? (
              /* Locked icon */
              <g fill="none" stroke={isLocked ? "#854d0e" : "#94a3b8"} strokeWidth={span * .0025} strokeLinecap="round">
                <rect x={-lockIconSize * .28} y={-lockIconSize * .08} width={lockIconSize * .56} height={lockIconSize * .42} rx={lockIconSize * .06} fill={isLocked ? "#854d0e" : "#475569"} stroke="none" opacity={0.8}/>
                <path d={`M${-lockIconSize * .18} ${-lockIconSize * .08} v${-lockIconSize * .22} a${lockIconSize * .18} ${lockIconSize * .18} 0 0 1 ${lockIconSize * .36} 0 v${lockIconSize * .22}`}/>
              </g>
            ) : (
              /* Unlocked icon */
              <g fill="none" stroke="#94a3b8" strokeWidth={span * .0025} strokeLinecap="round">
                <rect x={-lockIconSize * .28} y={-lockIconSize * .08} width={lockIconSize * .56} height={lockIconSize * .42} rx={lockIconSize * .06} fill="#475569" stroke="none" opacity={0.6}/>
                <path d={`M${-lockIconSize * .18} ${-lockIconSize * .08} v${-lockIconSize * .22} a${lockIconSize * .18} ${lockIconSize * .18} 0 0 1 ${lockIconSize * .36} 0`}/>
              </g>
            )}
          </g>
        )}

        {/* Inline length input via foreignObject when line is selected */}
        {active && source === "current" && !isLocked && (
          <foreignObject
            x={midX - span * .07}
            y={midY + span * .005}
            width={span * .14}
            height={span * .05}
            className="ai-sketch-inline-input-fo"
          >
            <input
              type="number"
              step="0.1"
              min="0.3"
              max="80"
              value={inlineLen}
              aria-label="Edit line length in metres"
              className="ai-sketch-inline-input"
              onChange={e => { setInlineLen(e.target.value); setLength(e.target.value); }}
              onKeyDown={e => {
                if (e.key === "Enter") { e.preventDefault(); void applyLength(inlineLen); }
                else if (e.key === "Escape") { e.preventDefault(); setSelected(null); }
                e.stopPropagation();
              }}
              onClick={e => e.stopPropagation()}
              ref={inlineLenRef}
            />
          </foreignObject>
        )}

        {canPick && (curvedPath ? (
          <path d={curvedPath} fill="none" stroke="transparent" strokeWidth={span * .018} onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} onClick={e => { e.stopPropagation(); chooseLine(index, interior, source); }} />
        ) : (
          <line x1={a.xMm} y1={a.yMm} x2={b.xMm} y2={b.yMm} stroke="transparent" strokeWidth={span * .018} onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} onClick={e => { e.stopPropagation(); chooseLine(index, interior, source); }} />
        ))}
      </g>
    );
  };

  const drawing = (s: FloorSketch, src: Pick["source"]) => (
    <g className={src === "below" ? "ai-sketch-below" : "ai-sketch-current"}>
      {s.points.length >= 3 && <polygon points={s.points.map(p => `${p.xMm},${p.yMm}`).join(" ")} fill={src === "below" ? "#f59e0b12" : "#38bdf80c"} stroke="none" pointerEvents="none" />}
      {src === "current" && s.labels?.map((label, i) => {
        const room = sketchRooms(s).find(r => insidePolygon(label.point, r));
        return (
          <g key={`room${i}`} pointerEvents="none">
            {room && <polygon points={room.map(p => `${p.xMm},${p.yMm}`).join(" ")} fill={`${colors[label.use]}25`} />}
            <text x={label.point.xMm} y={label.point.yMm} fontSize={span * .02} textAnchor="middle" fill="currentColor" fontWeight="600">{label.name}</text>
            {room && <text x={label.point.xMm} y={label.point.yMm + span * .025} fontSize={span * .014} fill="currentColor" textAnchor="middle">{(polygonArea(room) / 1e6).toFixed(1)} m² · {label.use}</text>}
          </g>
        );
      })}
      {s.points.map((a, i) => segment(a, s.points[(i + 1) % s.points.length], i, false, src))}
      {s.lines.map((l, i) => segment(l.start, l.end, i, true, src))}
      {src === "current" && (s.furnitureLines ?? []).map((l, i) => <line key={`f${i}`} x1={l.start.xMm} y1={l.start.yMm} x2={l.end.xMm} y2={l.end.yMm} stroke="#f97316" strokeWidth={span*.004} opacity={.9} pointerEvents="none" />)}
      {src === "current" && (s.mepLines ?? []).map((l, i) => <line key={`m${i}`} x1={l.start.xMm} y1={l.start.yMm} x2={l.end.xMm} y2={l.end.yMm} stroke="#14b8a6" strokeWidth={span*.003} strokeDasharray={`${span*.009} ${span*.006}`} opacity={.95} pointerEvents="none" />)}
      {src === "current" && s.points.map((p, i) => <circle key={`p${i}`} cx={p.xMm} cy={p.yMm} r={span * .005} fill="#38bdf8" pointerEvents="none" />)}
      {/* Garden polygons with draggable vertices */}
      {(s.gardens ?? []).map((g, gi) => {
        const b = inscribedRectangle(g);
        return (
          <g key={`garden${gi}`}>
            <polygon
              points={g.map(p => `${p.xMm},${p.yMm}`).join(" ")}
              fill="#22c55e28"
              stroke="#16a34a"
              strokeWidth={span * .002}
              strokeDasharray={`${span * .008} ${span * .004}`}
              pointerEvents="none"
            />
            <text x={b.xMm + b.widthMm / 2} y={b.yMm + b.depthMm / 2} textAnchor="middle" fill="#16a34a" fontSize={span * .018} fontWeight="600" pointerEvents="none">
              🌱 {(polygonArea(g) / 1e6).toFixed(1)} m²
            </text>
            {/* Draggable garden vertices */}
            {src === "current" && g.map((vert, vi) => (
              <circle
                key={`gv${gi}-${vi}`}
                cx={vert.xMm}
                cy={vert.yMm}
                r={span * .008}
                fill="#16a34a"
                stroke="#fff"
                strokeWidth={span * .002}
                style={{ cursor: "grab" }}
                onPointerDown={e => {
                  e.stopPropagation();
                  setGardenDrag({ gardenIdx: gi, vertIdx: vi });
                  (e.currentTarget.closest("svg") as SVGSVGElement | null)?.setPointerCapture?.(e.pointerId);
                }}
              />
            ))}
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

  // AutoCAD Live Preview
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
            <rect x={-span * .07} y={-span * .014} width={span * .14} height={span * .028} rx={span * .006} fill="#090d16ee" stroke="#38bdf8" strokeWidth={span * .001} />
            <text x={0} y={span * .006} textAnchor="middle" fill="#38bdf8" fontSize={span * .013} fontWeight="600">{liveLen} m · {liveAngle}°</text>
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
    }
  }

  // Garden live polygon preview
  const gardenLivePreview = tool === "garden" && gardenAnchors.length > 0 && cursorPoint ? (
    <g pointerEvents="none">
      {/* Drawn corners so far */}
      <polyline
        points={[...gardenAnchors, cursorPoint].map(p => `${p.xMm},${p.yMm}`).join(" ")}
        fill="none"
        stroke="#16a34a"
        strokeWidth={span * .003}
        strokeDasharray={`${span * .01} ${span * .006}`}
      />
      {/* Closing line hint (when >= 3 corners) */}
      {gardenAnchors.length >= 3 && (
        <line x1={cursorPoint.xMm} y1={cursorPoint.yMm} x2={gardenAnchors[0].xMm} y2={gardenAnchors[0].yMm}
          stroke="#16a34a" strokeWidth={span * .0015} strokeDasharray={`${span * .006} ${span * .006}`} opacity={0.4} />
      )}
      {gardenAnchors.map((p, i) => (
        <circle key={i} cx={p.xMm} cy={p.yMm} r={span * .007}
          fill={i === 0 && gardenAnchors.length >= 3 ? "#22c55e" : "#16a34a"}
          stroke="#fff" strokeWidth={span * .0015} />
      ))}
      {gardenAnchors.length >= 3 && (
        <text x={gardenAnchors[0].xMm} y={gardenAnchors[0].yMm - span * .012}
          textAnchor="middle" fill="#22c55e" fontSize={span * .011} fontWeight="600">Click to close</text>
      )}
      <g transform={`translate(${cursorPoint.xMm} ${cursorPoint.yMm - span * .015})`}>
        <rect x={-span * .06} y={-span * .012} width={span * .12} height={span * .024} rx={span * .006} fill="#052e16ee" stroke="#16a34a" strokeWidth={span * .001} />
        <text x={0} y={span * .006} textAnchor="middle" fill="#22c55e" fontSize={span * .012} fontWeight="600">
          🌱 Corner {gardenAnchors.length + 1}{gardenAnchors.length >= 2 ? " · DblClick to close" : ""}
        </text>
      </g>
    </g>
  ) : null;

  // Build the floor label list — always show all project levels, padded
  const floorOptions = levels.length > 0
    ? levels.map((lvl, i) => {
        const hasSketch = i < sketches.length;
        const label = `${lvl.name} (${(lvl.elevationMm / 1000).toFixed(1)}m)${hasSketch ? "" : " — empty"}`;
        return <option key={lvl.id} value={i}>{label}</option>;
      })
    : sketches.map((_, i) => {
        const label = i === 0 ? "Ground floor" : `Floor ${i}`;
        return <option key={i} value={i}>{label}</option>;
      });

  const contextHint = (() => {
    if (tool === "garden") {
      if (gardenAnchors.length === 0) return "Click to place first garden corner";
      if (gardenAnchors.length < 3) return `Corner ${gardenAnchors.length + 1} — keep clicking to add corners`;
      return `${gardenAnchors.length} corners placed — click near the first to close, or double-click`;
    }
    if (tool === "arc") return anchors.length === 0 ? "Click start of arc" : anchors.length === 1 ? "Click end of arc" : "Move cursor and click to bend the live arc";
    if (tool === "wall") return anchors.length === 0 ? "Click to place first point of wall" : `${anchors.length} point(s) placed — click to continue · Esc to end chain`;
    if (tool === "freehand") return "Hold and drag to sketch walls freehand";
    if (tool === "select") return selected ? "Line selected — edit length/angle in sidebar or click the lock icon on the line" : "Click a line to select it";
    return help[tool];
  })();

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
        {/* Header */}
        <header>
          <div className="ai-sketch-title">
            <span className="ai-sketch-title-icon"><FiMaximize2/></span>
            <div>
              <strong>Draw your building</strong>
              <small>2D drafting · Click to draw walls · Lock dimensions · Add rooms &amp; gardens</small>
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

        {/* Toolbar */}
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
              // Auto-create missing sketch floors
              if (nextFloor >= sketches.length) {
                const padded = [...sketches];
                while (padded.length <= nextFloor) padded.push({ points: padded[0]?.points ?? [], lines: [] });
                onChange({ ...parameters, variant: padded.length > 1 ? "duplex" : parameters.variant, sketches: padded });
              }
            }}>
              {floorOptions}
            </select>
          </label>
          <button type="button" disabled={disabled || sketches.length >= 8} onClick={() => {
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

        {/* Main body */}
        <div className="ai-sketch-body">
          {/* Canvas */}
          <div className={`ai-sketch-drawing ai-sketch-tool-${tool}`}>
            <svg
              viewBox={`${viewX} ${viewY} ${span} ${span}`}
              onClick={click}
              onDoubleClick={onDoubleClick}
              onPointerDown={onPointerDownCanvas}
              onPointerMove={onPointerMoveCanvas}
              onPointerUp={onPointerUpCanvas}
              onPointerCancel={() => { drag.current = null; setIsFreehandDragging(false); setFreehandStroke([]); setGardenDrag(null); }}
              aria-label="Editable 2D floor drawing"
              role="img"
            >
              <defs>
                <pattern id="ai-sketch-grid" width="1000" height="1000" patternUnits="userSpaceOnUse">
                  <path d="M1000 0H0V1000" fill="none" stroke="currentColor" strokeWidth="14" opacity=".14" />
                </pattern>
                <pattern id="ai-sketch-grid-major" width="5000" height="5000" patternUnits="userSpaceOnUse">
                  <path d="M5000 0H0V5000" fill="none" stroke="currentColor" strokeWidth="20" opacity=".08" />
                </pattern>
              </defs>
              <rect x={viewX} y={viewY} width={span} height={span} fill={grid ? "url(#ai-sketch-grid)" : "transparent"} />
              {grid && <rect x={viewX} y={viewY} width={span} height={span} fill="url(#ai-sketch-grid-major)" />}
              {projectVisible && projectDrawing}
              {below && previous && drawing(previous, "below")}
              {drawing(current, "current")}
              {/* AutoCAD Live previews */}
              {liveRubberband}
              {/* Garden live preview */}
              {gardenLivePreview}
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
              {/* Snap indicator box */}
              {snapPoint && (
                <g pointerEvents="none">
                  <rect
                    x={snapPoint.xMm - span * .009}
                    y={snapPoint.yMm - span * .009}
                    width={span * .018}
                    height={span * .018}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth={span * .002}
                  />
                  <text x={snapPoint.xMm} y={snapPoint.yMm - span * .013} textAnchor="middle" fill="#22c55e" fontSize={span * .011} fontWeight="bold">SNAP</text>
                </g>
              )}
              {/* Wall anchors */}
              {anchors.map((a, i) => (
                <circle key={i} cx={a.xMm} cy={a.yMm} r={span * .008} fill="#facc15" stroke="#854d0e" strokeWidth={span * .0015} pointerEvents="none" />
              ))}
              {roomPoint && <circle cx={roomPoint.xMm} cy={roomPoint.yMm} r={span * .005} fill="#facc15" pointerEvents="none" />}
            </svg>

            {/* Status bar */}
            <div className="ai-sketch-canvas-note">
              {contextHint}
              <span>250 mm snap · 1 m grid · Esc cancels action</span>
            </div>
          </div>

          {/* Right sidebar */}
          <aside>
            <section className="ai-sketch-card ai-sketch-mode-card">
              <h3>Drafting mode</h3>
              <div className="ai-sketch-mode-tabs">
                {(["walls","furniture","mep"] as const).map(mode => <button key={mode} type="button" aria-pressed={drawMode===mode} onClick={()=>{setDrawMode(mode);setTool(mode==="walls"?"wall":"freehand");resetSelection();}}><span className={`ai-sketch-mode-dot ai-sketch-mode-${mode}`}/>{mode === "mep" ? "MEP lines" : mode[0].toUpperCase()+mode.slice(1)}</button>)}
              </div>
              <p>{drawMode === "walls" ? "Outer lines become walls; interior lines become partitions. Add doors, windows and room tags." : drawMode === "furniture" ? "Draw furniture footprints as orange reference lines. They are kept separate from walls." : "Draw MEP runs as teal dashed lines. They are kept separate from walls and rooms."}</p>
            </section>
            {/* Tool palette */}
            <section className="ai-sketch-card">
              <h3>Drawing tools</h3>
              <div className="ai-sketch-toolbox">
                {tools.map(t => (
                  <button key={t.id} type="button" disabled={disabled || drawMode !== "walls" && ["rectangle","circle","room","garden"].includes(t.id)} aria-pressed={tool === t.id} onClick={() => { setTool(t.id); resetSelection(); setGardenAnchors([]); }}>
                    {t.icon}<span>{t.name}</span>
                  </button>
                ))}
              </div>
              <p className="ai-sketch-help-text">{help[tool]}</p>
              <div className="ai-sketch-checks">
                <label><input type="checkbox" checked={orthogonal} onChange={e => setOrthogonal(e.target.checked)} /> Ortho (90°)</label>
                <label><input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)} /><FiGrid/> Grid</label>
              </div>
            </section>

            {/* Selected line editor */}
            {selected && (
              <section className="ai-sketch-card ai-sketch-card-selected">
                <h3>{selected.source === "project" ? "Existing project wall" : selected.source === "below" ? "Reference line below" : "Selected line"}</h3>
                
                {/* Length */}
                <div className="ai-sketch-field">
                  <label htmlFor="sk-length">Length (m)</label>
                  <div className="ai-sketch-field-row">
                    <input id="sk-length" aria-label="Selected sketch line length in metres" type="number" step=".1" min=".3" max="80" value={length} disabled={!!locked || selected.source === "below"} onChange={e => { setLength(e.target.value); setInlineLen(e.target.value); }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void applyLength(); } }} />
                    <button type="button" className="btn-v-yellow ai-sketch-apply-btn" disabled={disabled || busy || !!locked || selected.source === "below"} onClick={() => applyLength()}>
                      Apply
                    </button>
                  </div>
                </div>

                {/* Angle */}
                <div className="ai-sketch-field">
                  <label htmlFor="sk-angle">Angle (°)</label>
                  <div className="ai-sketch-field-row">
                    <input id="sk-angle" aria-label="Selected line angle in degrees" type="number" step="1" min="0" max="360" value={angleInput} disabled={!!locked || selected.source === "below"} onChange={e => setAngleInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void applyAngle(); } }} />
                    <button type="button" className="btn-v-yellow ai-sketch-apply-btn" disabled={disabled || busy || !!locked || selected.source === "below"} onClick={() => applyAngle()}>
                      <FiRotateCw/> Apply
                    </button>
                  </div>
                  <div className="ai-sketch-angle-presets">
                    {[0, 45, 90, 135, 180, 270].map(deg => (
                      <button key={deg} type="button" disabled={disabled || busy || !!locked || selected.source === "below"} onClick={() => applyAngle(deg)}>
                        {deg}°
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lock / delete / copy */}
                {selected.source === "current" ? (
                  <>
                    <div className="ai-sketch-field"><label htmlFor="sk-wall-type">Wall type</label><select id="sk-wall-type" aria-label="Selected wall type" value={wallType} onChange={e=>{const type=e.target.value as typeof wallType;setWallType(type);replace({...current,wallTypes:[...(current.wallTypes??[]).filter(w=>w.index!==selected.index||w.interior!==selected.interior),{index:selected.index,interior:selected.interior,type}]});}}><option value="exterior">Exterior wall</option><option value="partition">Partition wall</option><option value="fire">Fire-rated wall</option><option value="curtain">Curtain wall</option></select></div>
                    <button type="button" aria-pressed={!!locked} className={locked ? "btn-v-yellow" : undefined} onClick={() => {
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

            {/* Room name editor */}
            {roomPoint && (
              <section className="ai-sketch-card">
                <h3>Name this room</h3>
                <div className="ai-sketch-field">
                  <label htmlFor="sk-room-name">Room name</label>
                  <input id="sk-room-name" aria-label="Closed room name" type="text" maxLength={60} value={roomName} placeholder="e.g. Master bedroom" onChange={e => {
                    setRoomName(e.target.value);
                    const name = e.target.value.toLowerCase();
                    const inferred = uses.find(u => name.includes(u)) ?? (/office|work/.test(name) ? "study" : /lounge|family/.test(name) ? "living" : /wc|toilet|shower/.test(name) ? "bathroom" : /hall|entry/.test(name) ? "corridor" : undefined);
                    if (inferred) setRoomUse(inferred);
                  }} />
                </div>
                <div className="ai-sketch-field">
                  <label htmlFor="sk-room-use">Room use</label>
                  <select id="sk-room-use" aria-label="Closed room use" value={roomUse} onChange={e => setRoomUse(e.target.value as RoomUse)}>
                    {uses.map(u => <option key={u} value={u}>{u[0].toUpperCase() + u.slice(1)}</option>)}
                  </select>
                </div>
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

            {/* Shapes */}
            <section className="ai-sketch-card">
              <h3>Quick shapes</h3>
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
              <p>Add walls using Wall / Line, Freehand or Arc. Rectangle &amp; Circle tools add closed wall outlines.</p>
            </section>

            {/* Layers */}
            <section className="ai-sketch-card">
              <h3>Layers &amp; references</h3>
              <div className="ai-sketch-field">
                <label htmlFor="sk-pick-layer">Select lines from</label>
                <select id="sk-pick-layer" aria-label="Pick drawing layer" value={pickLayer} onChange={e => { setPickLayer(e.target.value as Pick["source"]); setTool("select"); resetSelection(); }}>
                  <option value="current">This floor</option>
                  <option value="below" disabled={!previous || !below}>Floor below</option>
                  <option value="project" disabled={!projectWalls.length || !projectVisible}>Existing project</option>
                </select>
              </div>
              <label className="ai-sketch-inline-label">
                <input type="checkbox" checked={projectVisible} onChange={e => { setProjectVisible(e.target.checked); if (!e.target.checked) setPickLayer("current"); }} /> Show existing project
              </label>
              {levels.length > 0 && (
                <div className="ai-sketch-field">
                  <label htmlFor="sk-proj-level">Project level</label>
                  <select id="sk-proj-level" aria-label="Existing project level" value={projectLevel} onChange={e => { setProjectLevel(e.target.value); resetSelection(); }}>
                    {levels.map(l => <option key={l.id} value={l.id}>{l.name} ({(l.elevationMm / 1000).toFixed(1)}m)</option>)}
                  </select>
                </div>
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

            {/* Clear */}
            <section className="ai-sketch-card">
              <h3>Clear &amp; Reset</h3>
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
