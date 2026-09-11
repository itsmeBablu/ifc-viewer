import * as THREE from "three";
import { constrainedDrawingPoint, mepRunKind, segmentDimensions } from "@/lib/drawingInteraction";
import { currentMepDrawing, cancelMepDrawing, placeMepPoint, changeMepDrawingLevel } from "./mepDrawingActions";
import { mepEndpoints, type MepSnapPoint } from "@/lib/mepConnections";
import { getEquipmentConnectors } from "@/lib/layoutDrawing";
import { snapElevatedEndpoints, type GlobalSnapType } from "@/lib/globalSnapping";
import { undoWerkzeug } from "@/lib/werkzeugHistory";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useDrawingInteractionStore } from "@/store/useDrawingInteractionStore";
import { drawingSegments, sampleDrawingSegment, type DrawingPoint, type DrawingSegment } from "@/lib/drawingShapes";
import { findGlobalSnap, worldMmToScreen } from "@/lib/globalSnapping";
import { meshDrawingEdges, nearestDrawingEdge, projectDrawingEdges } from "@/lib/drawingReferences";
import { underlaySnapSegmentsWorld } from "@/lib/underlaySnap";
import { snapMeshMeasurement } from "@/lib/measurementSnap";
import { collectRaycastCandidates } from "@/lib/modifySelection";

type Options = {
  canvas: HTMLCanvasElement;
  mepPreview?: (start: DrawingPoint | null, cursor: DrawingPoint | null, elevation: number) => void;
  camera: (x: number, y: number) => THREE.Camera | null;
  roots: () => THREE.Object3D[];
  controls: () => { enabled: boolean; enableRotate?: boolean } | null;
};

/** One evaluator drives the preview and committed geometry for mouse, Pencil and touch. */
export function installDrawingInteractionController(options: Options) {
  const { canvas } = options;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  Object.assign(svg.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "38" });
  svg.setAttribute("aria-label", "Live drawing dimensions and alignment guides");
  document.body.appendChild(svg);
  const hud = document.createElement("div");
  hud.className = "drawing-live-hud";
  hud.setAttribute("role", "status");
  document.body.appendChild(hud);
  const ray = new THREE.Raycaster();
  let points: DrawingPoint[] = [], generation = 0;
  let frame = 0, committedSteps = 0, lastBypass = false;
  const shapeNow = () => mepRunKind(useLayoutDrawingStore.getState().armedLayoutTool) ? "line" : useDrawingInteractionStore.getState().shape;
  let pointer: { id: number; x: number; y: number; touch: boolean } | null = null;
  let multiple = false, lastX = 0, lastY = 0, savedControls = true;
  let typedLength: number | null = null, typedAngle: number | null = null;
  const activePointers = new Set<number>();
  const enabled = () => {
    const s = useLayoutDrawingStore.getState();
    return (!s.slabBoundaryEdit || Boolean(s.editingSlabId)) && (s.armedLayoutTool === "wall" || s.armedLayoutTool === "lines" || Boolean(mepRunKind(s.armedLayoutTool)));
  };
  const block = (e: Event) => { e.preventDefault(); e.stopImmediatePropagation(); };
  const clear = () => { svg.replaceChildren(); hud.style.display = "none"; };
  const reset = () => { generation++; committedSteps = 0; points = []; cancelAnimationFrame(frame); frame = 0; cancelMepDrawing(); options.mepPreview?.(null, null, 0); typedLength = null; typedAngle = null; clear(); useDrawingInteractionStore.setState({ hasPoints: false, message: null, lengthMm: null, angleDeg: null }); };
  const restore = () => {
    const controls = options.controls();
    if (controls) {
      const isFree3D = useToolMarkupStore.getState().viewPreset === "free";
      if (controls.enableRotate !== undefined) controls.enableRotate = isFree3D;
      controls.enabled = savedControls;
    }
  };
  const release = () => {
    const id = pointer?.id; pointer = null;
    if (id != null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    restore();
  };
  function context(x: number, y: number) {
    const camera = options.camera(x, y); if (!camera) return null;
    const layout = useLayoutDrawingStore.getState(), markup = useToolMarkupStore.getState();
    const mep = currentMepDrawing();
    const level = layout.levels.find(l => l.id === mep.draw?.levelId) ?? layout.levels.find(l => l.id === markup.markupFloorId) ?? layout.levels.find(l => l.id === layout.draftWallBaseLevelId) ?? layout.levels[0];
    if (!level) return null;
    const bounds = canvas.getBoundingClientRect();
    const rect = markup.quadView ? { left: bounds.left + (x >= bounds.left + bounds.width / 2 ? bounds.width / 2 : 0), top: bounds.top + (y >= bounds.top + bounds.height / 2 ? bounds.height / 2 : 0), width: bounds.width / 2, height: bounds.height / 2 } : bounds;
    const snapCanvas = { getBoundingClientRect: () => rect } as HTMLCanvasElement;
    ray.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1), camera);
    const safeRoots = collectRaycastCandidates(options.roots());
    const hit = ray.intersectObjects(safeRoots, false).find(h => h.object instanceof THREE.Mesh && !h.object.userData.isLayoutGround && !h.object.userData.layoutUnderlayId && h.object.visible && visibleParents(h.object));
    const elevation = level.elevationMm + (mep.kind ? mep.offset : 0);
    const raw = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -elevation / 1000), new THREE.Vector3());
    return { camera, layout, markup, level, elevation, rect, snapCanvas, hit, raw };
  }
  function visibleParents(object: THREE.Object3D): boolean { return object.visible && (!object.parent || visibleParents(object.parent)); }
  function evaluate(x: number, y: number, bypass = false) {
    const ctx = context(x, y); if (!ctx) return null;
    const { camera, layout, level, snapCanvas, hit } = ctx;
    const state = useDrawingInteractionStore.getState(), shape = shapeNow();
    let picked: DrawingSegment[] = [];
    if (shape === "pick-edge" || shape === "pick-face") {
      if (shape === "pick-face" && hit) picked = projectDrawingEdges(meshDrawingEdges(hit, true));
      else {
        const segments = [...layout.walls, ...layout.sketchLines, ...layout.gridLines].filter(s => !("levelId" in s) || s.levelId === level.id);
        const edges: [THREE.Vector3, THREE.Vector3][] = [];
        for (const segment of segments) {
          const samples = sampleDrawingSegment(segment);
          for (let i = 1; i < samples.length; i++) edges.push([samples[i - 1], samples[i]].map(p => new THREE.Vector3(p.xMm / 1000, level.elevationMm / 1000, p.yMm / 1000)) as [THREE.Vector3, THREE.Vector3]);
        }
        for (const underlay of layout.underlays.filter(u => u.opacity > 0 && u.levelId === level.id && !level.planView?.hiddenUnderlayIds.includes(u.id))) {
          for (const s of underlaySnapSegmentsWorld(underlay)) edges.push([new THREE.Vector3(s.ax / 1000, level.elevationMm / 1000, s.ay / 1000), new THREE.Vector3(s.bx / 1000, level.elevationMm / 1000, s.by / 1000)]);
        }
        if (hit) edges.push(...meshDrawingEdges(hit));
        const edge = nearestDrawingEdge(edges, camera, ctx.rect, x, y, pointer?.touch ? 26 : 16);
        if (edge) picked = projectDrawingEdges([edge]);
      }
      return { ...ctx, point: null, picked, label: picked.length ? shape === "pick-face" ? "Face outline → active level" : "Pick edge / DWG" : "Move to an edge or planar face", guides: [] as [DrawingPoint, DrawingPoint][] };
    }
    if (!ctx.raw) return null;
    let point: MepSnapPoint = { xMm: ctx.raw.x * 1000, yMm: ctx.raw.z * 1000 }, label = "";
    let snapType: GlobalSnapType | null = null;
    const from = points.at(-1), guides: [DrawingPoint, DrawingPoint][] = [];
    if (!bypass) {
      const snap = findGlobalSnap({ clientPos: { x, y }, camera, canvas: snapCanvas, levelElevationMm: ctx.elevation, levelId: level.id,
        walls: layout.walls, slabs: layout.slabs, sketchLines: layout.sketchLines, gridLines: layout.gridLines, underlays: layout.underlays,
        activeModes: layout.planSnapModes, fromMm: from, inProgressPoints: points, checkAutoClose: shape === "line", tolerancePx: pointer?.touch ? 22 : 12 });
      if (snap.snapped) { point = snap.worldMm; label = snap.label ?? "Object snap"; snapType = snap.type; }
      else if (hit) {
        const meshSnap = snapMeshMeasurement(hit.object, camera, snapCanvas, x, y, layout.planSnapModes, from ? new THREE.Vector3(from.xMm / 1000, level.elevationMm / 1000, from.yMm / 1000) : null, hit.instanceId);
        if (meshSnap) { point = { xMm: meshSnap.point.x * 1000, yMm: meshSnap.point.z * 1000 }; label = meshSnap.label; }
      }
      const mep = currentMepDrawing();
      if (mep.kind) {
        const aperture = { camera, canvas: snapCanvas, clientPos: { x, y }, activeModes: layout.planSnapModes, tolerancePx: pointer?.touch ? 22 : 12 };
        const endpoint = snapElevatedEndpoints(mepEndpoints(mep.kind as "duct" | "pipe" | "cabletray" | "wire", layout, level.id, mep.offset), aperture);
        if (endpoint) { point = endpoint; label = "MEP endpoint"; snapType = "endpoint"; }
        else if (mep.kind === "duct" || mep.kind === "pipe") {
          const equipment = layout.mepEquipment.filter(e => e.levelId === level.id).flatMap(e => getEquipmentConnectors(e).filter(c => c.type === mep.kind && Math.abs(c.worldZmm - mep.offset) <= 25).map(c => ({ xMm: c.worldXmm, yMm: c.worldYmm, worldElevationMm: level.elevationMm + c.worldZmm })));
          const connector = snapElevatedEndpoints(equipment, aperture);
          if (connector) { point = connector; label = "Equipment connector"; snapType = "endpoint"; }
        }
      }
      if (!label && state.tracking) {
        const anchors = [...points, ...[...layout.walls, ...layout.sketchLines, ...layout.gridLines].filter(s => !("levelId" in s) || s.levelId === level.id).flatMap(s => [{ xMm: s.startXmm, yMm: s.startYmm }, { xMm: s.endXmm, yMm: s.endYmm }])];
        for (const axis of ["xMm", "yMm"] as const) {
          let best: DrawingPoint | null = null, distance = pointer?.touch ? 16 : 9;
          for (const anchor of anchors) {
            const candidate = { ...point, [axis]: anchor[axis] };
            const screen = worldMmToScreen(candidate.xMm, candidate.yMm, level.elevationMm, camera, snapCanvas);
            const d = Math.hypot(screen.clientX - x, screen.clientY - y);
            if (d < distance) { best = anchor; distance = d; }
          }
          if (best) { point = { ...point, [axis]: best[axis] }; guides.push([best, point]); label = label ? "Horizontal + vertical" : axis === "xMm" ? "Vertical alignment" : "Horizontal alignment"; }
        }
      }
      if (!label && ctx.markup.gridSnap) {
        const grid = ctx.markup.gridSize * 1000;
        if (grid > 0) point = { xMm: Math.round(point.xMm / grid) * grid, yMm: Math.round(point.yMm / grid) * grid };
        label = "Grid";
      }
    }
    if (from && (typedLength != null || typedAngle != null)) { point = constrainedDrawingPoint(from, point, typedLength, typedAngle); label = "Numeric constraint"; snapType = null; }
    return { ...ctx, point, picked, label, guides, snapType };
  }
  function preview(x: number, y: number, bypass = false) {
    clear(); const result = evaluate(x, y, bypass); if (!result) return null;
    const shape = shapeNow();
    const segments = result.picked.length ? result.picked : result.point && points.length ? drawingSegments(shape, [...points, result.point]) : [];
    const screen = (p: DrawingPoint) => worldMmToScreen(p.xMm, p.yMm, result.elevation, result.camera, result.snapCanvas);
    const path = (vertices: DrawingPoint[], dashed: boolean) => {
      const poly = document.createElementNS(svg.namespaceURI, "polyline");
      poly.setAttribute("points", vertices.map(p => { const s = screen(p); return `${s.clientX},${s.clientY}`; }).join(" "));
      poly.setAttribute("fill", "none"); poly.setAttribute("stroke", dashed ? "#e879f9" : "#38bdf8"); poly.setAttribute("stroke-width", "2");
      if (dashed) poly.setAttribute("stroke-dasharray", "6 5"); svg.appendChild(poly);
    };
    result.guides.forEach(g => path(g, true)); segments.forEach(s => path(sampleDrawingSegment(s), false));
    if (result.point) {
      const p = screen(result.point), marker = document.createElementNS(svg.namespaceURI, "path");
      const type = "snapType" in result ? result.snapType : null;
      const glyph = type === "endpoint" ? "M-5,-5H5V5H-5Z" : type === "midpoint" ? "M0,-6L6,5H-6Z" : type === "intersection" ? "M-5,-5L5,5M-5,5L5,-5" : type === "perpendicular" ? "M-6,5H5V-6M0,5V0H5" : "M-5,0a5,5 0 1,0 10,0a5,5 0 1,0 -10,0";
      marker.setAttribute("d", glyph); marker.setAttribute("transform", `translate(${p.clientX},${p.clientY})`);
      marker.setAttribute("fill", "none"); marker.setAttribute("stroke", type === "autoclose" ? "#34d399" : result.label ? "#e879f9" : "#38bdf8"); marker.setAttribute("stroke-width", "2"); svg.appendChild(marker);
    }
    if (currentMepDrawing().kind) options.mepPreview?.(points.at(-1) ?? null, result.point, result.elevation);
    const from = points.at(-1), to = result.point;
    const text = result.label || "Tap the first point";
    if (from && to) {
      const { lengthMm, angleDeg } = segmentDimensions(from, to);
      useDrawingInteractionStore.setState({ lengthMm: Math.round(lengthMm), angleDeg: Math.round(angleDeg * 10) / 10 });
      if (!hud.querySelector("input")) {
        hud.replaceChildren();
        for (const [label, unit] of [["Length", "mm"], ["Angle", "?"]]) {
          const wrap = document.createElement("label"), input = document.createElement("input");
          wrap.textContent = label + " "; input.type = "number"; input.setAttribute("aria-label", "Drawing " + label.toLowerCase());
          input.style.cssText = "width:74px;background:transparent;border:0;border-bottom:1px solid currentColor;color:inherit;font:inherit;pointer-events:auto";
          input.addEventListener("input", () => {
            const n = input.valueAsNumber;
            if (label === "Length") typedLength = Number.isFinite(n) && n > 0 ? n : null;
            else typedAngle = Number.isFinite(n) ? n : null;
            preview(lastX, lastY, lastBypass);
          });
          input.addEventListener("keydown", e => { if (e.key === "Enter") { block(e); void place(lastX, lastY, lastBypass); input.blur(); } else if (e.key === "Escape") { block(e); input.blur(); reset(); } });
          wrap.append(input, document.createTextNode(" " + unit + " ")); hud.appendChild(wrap);
        }
      }
      const inputs = hud.querySelectorAll("input");
      if (document.activeElement !== inputs[0]) inputs[0].value = String(Math.round(lengthMm));
      if (document.activeElement !== inputs[1]) inputs[1].value = String(Math.round(angleDeg * 10) / 10);
    }
    if (!from || !to) hud.textContent = text;
    hud.style.display = "block";
    hud.style.left = `${Math.max(8, Math.min(window.innerWidth - 310, x + 18))}px`;
    hud.style.top = `${Math.max(8, Math.min(window.innerHeight - 60, y - (pointer?.touch ? 84 : 48)))}px`;
    return result;
  }
  async function place(x: number, y: number, bypass: boolean) {
    if (useDrawingInteractionStore.getState().busy) return;
    const result = preview(x, y, bypass); if (!result) return;
    if (currentMepDrawing().kind && result.point) {
      useDrawingInteractionStore.setState({ busy: true });
      const hadStart = Boolean(currentMepDrawing().draw);
      try {
        await placeMepPoint(result.level.id, result.point);
        if (hadStart) committedSteps++;
        const next = currentMepDrawing().draw;
        points = next?.start ? [...points, next.start] : [];
        typedLength = null; typedAngle = null;
        useDrawingInteractionStore.setState({ hasPoints: points.length > 0 });
        preview(x, y, bypass);
      } catch (error) { useDrawingInteractionStore.setState({ message: String(error) }); }
      finally { useDrawingInteractionStore.setState({ busy: false }); }
      return;
    }
    const shape = shapeNow();
    const next = result.point ? [...points, result.point] : [];
    if (shape !== "pick-edge" && shape !== "pick-face" && (next.length < 2 || (shape === "arc" && next.length < 3))) {
      points = next; useDrawingInteractionStore.setState({ hasPoints: points.length > 0 }); return;
    }
    const segments = shape === "pick-edge" || shape === "pick-face" ? result.picked : drawingSegments(shape, next);
    if (!segments.length) { useDrawingInteractionStore.setState({ message: "No valid geometry here. Pick another point or edge." }); return; }
    const kind = result.layout.armedLayoutTool; if (kind !== "wall" && kind !== "lines") return;
    const token = generation;
    useDrawingInteractionStore.setState({ busy: true, message: null });
    try {
      await result.layout.commitDrawingSegments(kind, result.level.id, segments);
      committedSteps++;
      if (generation !== token) return;
      const closed = shape === "line" && next.length > 2 && Math.hypot(next[0].xMm - next.at(-1)!.xMm, next[0].yMm - next.at(-1)!.yMm) < 1;
      points = shape === "line" && !closed ? next : [];
      typedLength = null; typedAngle = null;
      useDrawingInteractionStore.setState({ hasPoints: points.length > 0 });
      preview(x, y, bypass);
    } catch (error) { useDrawingInteractionStore.setState({ message: error instanceof Error ? error.message : "Could not save drawing." }); }
    finally { useDrawingInteractionStore.setState({ busy: false }); }
  }
  function down(e: PointerEvent) {
    if (!enabled() || useDrawingInteractionStore.getState().navigating || e.button !== 0) return;
    activePointers.add(e.pointerId);
    if (activePointers.size > 1) {
      multiple = true;
      release();
      return;
    }
    multiple = false; pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType !== "mouse" };
    const controls = options.controls();
    savedControls = controls?.enabled ?? true;
    if (controls) {
      if (controls.enableRotate !== undefined) controls.enableRotate = false;
      else controls.enabled = false;
    }
    lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId); block(e); preview(e.clientX, e.clientY, e.altKey);
  }
  function move(e: PointerEvent) {
    if (!enabled() || useDrawingInteractionStore.getState().navigating) return;
    if (activePointers.size > 1) return;
    if (pointer && pointer.id !== e.pointerId) return;
    lastX = e.clientX; lastY = e.clientY; block(e);
    lastBypass = e.altKey;
    if (!multiple && !frame) frame = requestAnimationFrame(() => { frame = 0; preview(lastX, lastY, lastBypass); });
  }
  function up(e: PointerEvent) {
    activePointers.delete(e.pointerId);
    if (multiple && activePointers.size === 0) {
      multiple = false;
      clear();
      release();
      return;
    }
    if (!pointer || pointer.id !== e.pointerId) return;
    const inBounds = canvas.getBoundingClientRect();
    const valid = !multiple && e.clientX >= inBounds.left && e.clientX <= inBounds.right && e.clientY >= inBounds.top && e.clientY <= inBounds.bottom;
    block(e);
    cancelAnimationFrame(frame); frame = 0;
    if (valid) void place(e.clientX, e.clientY, e.altKey);
    release();
  }
  function cancel() { activePointers.clear(); multiple = false; release(); clear(); }
  async function undoPoint() {
    if (useDrawingInteractionStore.getState().busy || !points.length) return;
    useDrawingInteractionStore.setState({ busy: true });
    try {
      if (committedSteps > 0) { await undoWerkzeug(); committedSteps--; }
      points.pop();
      const mep = currentMepDrawing();
      if (mep.kind) {
        cancelMepDrawing();
        const last = points.at(-1), level = context(lastX, lastY)?.level;
        if (last && level) await placeMepPoint(level.id, last);
      }
      typedLength = null; typedAngle = null;
      useDrawingInteractionStore.setState({ hasPoints: points.length > 0 });
      preview(lastX, lastY, lastBypass);
    } finally { useDrawingInteractionStore.setState({ busy: false }); }
  }
  function finish() {
    if (useDrawingInteractionStore.getState().busy) return;
    const s = useLayoutDrawingStore.getState();
    reset();
    if (s.sketchTargetKind || s.editingSlabId) void s.convertSketchToSlab(s.sketchTargetKind ?? "floor").then(r => { if (!r.success) useDrawingInteractionStore.setState({ message: r.error ?? "Close the boundary first." }); });
  }
  function key(e: KeyboardEvent) {
    if (!enabled() || (e.target as HTMLElement)?.closest?.("input,textarea,select,[contenteditable=true]")) return;
    if (((e.key.toLowerCase() === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) || e.key === "Backspace") && points.length) { block(e); void undoPoint(); }
    else if (e.key === "Enter") { block(e); finish(); }
    else if (e.key === "Escape") { block(e); if (points.length) reset(); else useLayoutDrawingStore.getState().setArmedLayoutTool(null); }
  }
  function doubleClick(e: Event) { if (enabled()) { block(e); finish(); } }
  function swallow(e: Event) { if (enabled()) block(e); }
  // OrbitControls registered its down listener first. In navigation mode, let it
  // receive the event, then stop legacy placement handlers from disabling it.
  function navigationDown(e: PointerEvent) { if (enabled() && useDrawingInteractionStore.getState().navigating) e.stopImmediatePropagation(); }
  const unsub = useLayoutDrawingStore.subscribe((s, prev) => {
    if (s.armedLayoutTool !== prev.armedLayoutTool || s.projectId !== prev.projectId || s.sketchTargetKind !== prev.sketchTargetKind) { reset(); cancel(); }
    if (s.draftDrawMode !== prev.draftDrawMode) useDrawingInteractionStore.setState({ shape: s.draftDrawMode });
  });
  const unsubMarkup = useToolMarkupStore.subscribe((s, prev) => {
    if (s.markupFloorId !== prev.markupFloorId && currentMepDrawing().kind && s.markupFloorId) { changeMepDrawingLevel(s.markupFloorId); preview(lastX, lastY, lastBypass); }
    else if (s.markupFloorId !== prev.markupFloorId || s.viewPreset !== prev.viewPreset) { reset(); cancel(); }
  });
  const unsubDrawing = useDrawingInteractionStore.subscribe((s, prev) => {
    if (s.shape !== prev.shape) reset();
    if (s.navigating !== prev.navigating) { cancel(); if (!s.navigating) preview(lastX, lastY); }
  });
  const events = [["pointerdown", down], ["pointermove", move], ["pointerup", up], ["pointercancel", cancel], ["click", swallow], ["dblclick", doubleClick], ["contextmenu", swallow]] as const;
  events.forEach(([name, handler]) => canvas.addEventListener(name, handler as EventListener, true));
  canvas.addEventListener("pointerdown", navigationDown);
  window.addEventListener("keydown", key, true); window.addEventListener("blur", cancel); window.addEventListener("werkzeug-drawing-reset", reset); window.addEventListener("werkzeug-drawing-finish", finish); window.addEventListener("werkzeug-drawing-undo", undoPoint);
  return () => {
    cancel(); reset(); unsub(); unsubMarkup(); unsubDrawing(); svg.remove(); hud.remove();
    events.forEach(([name, handler]) => canvas.removeEventListener(name, handler as EventListener, true));
    canvas.removeEventListener("pointerdown", navigationDown);
    window.removeEventListener("keydown", key, true); window.removeEventListener("blur", cancel); window.removeEventListener("werkzeug-drawing-reset", reset); window.removeEventListener("werkzeug-drawing-finish", finish); window.removeEventListener("werkzeug-drawing-undo", undoPoint);
  };
}
