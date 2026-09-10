import * as THREE from "three";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { findGlobalSnap, worldMmToScreen, type GlobalSnapResult } from "@/lib/globalSnapping";
import { moveBoundaryEdge, projectToEdge, slabBoundaryLoops, trimBoundaryCorner, validateBoundary, type BoundaryLoops, type BoundaryPoint } from "@/lib/boundaryEditing";

type Hit = { ring: number; index: number; kind: "vertex" | "edge" };
type Options = {
  canvas: HTMLCanvasElement;
  camera: (x: number, y: number) => THREE.Camera | null;
  controls: () => { enabled: boolean } | null;
};

/** Screen-space sketch overlay. Preview is local; the slab store changes only on release. */
export function installBoundarySketchEditor({ canvas, camera, controls }: Options) {
  const ns = "http://www.w3.org/2000/svg";
  const overlay = document.createElementNS(ns, "svg");
  overlay.setAttribute("aria-label", "Floor and roof boundary handles");
  Object.assign(overlay.style, { position: "fixed", pointerEvents: "none", zIndex: "30", overflow: "hidden" });
  document.body.appendChild(overlay);
  let selected: Hit | null = null, hover: Hit | null = null;
  let firstTrim: { hit: Hit; point: BoundaryPoint } | null = null;
  let snap: GlobalSnapResult | null = null;
  let drag: { hit: Hit; original: BoundaryLoops; preview: BoundaryLoops; from: BoundaryPoint; pointer: number; x: number; y: number; moved: boolean; endpointEdge: number | null } | null = null;
  let lastSession: object | null = null, lastTool = "", frame = 0;
  let enabledBeforeDrag: boolean | null = null;
  const initialBounds = canvas.getBoundingClientRect();
  let pointer = { x: initialBounds.left + initialBounds.width / 2, y: initialBounds.top + initialBounds.height / 2 };
  const ray = new THREE.Raycaster();
  const block = (e: Event) => { e.preventDefault(); e.stopImmediatePropagation(); };
  const error = (message: string | null) => {
    const state = useLayoutDrawingStore.getState(), edit = state.slabBoundaryEdit;
    if (edit && edit.error !== message) useLayoutDrawingStore.setState({ slabBoundaryEdit: { ...edit, error: message } });
  };
  function context(x = pointer.x, y = pointer.y) {
    const state = useLayoutDrawingStore.getState(), edit = state.slabBoundaryEdit;
    const slab = state.slabs.find(s => s.id === edit?.slabId);
    if (!edit || !slab) return null;
    const rect = canvas.getBoundingClientRect();
    const markup = useToolMarkupStore.getState();
    const quad = markup.quadView;
    const ix = x >= rect.left + rect.width / 2 ? 1 : 0, iy = y >= rect.top + rect.height / 2 ? 1 : 0;
    const preset = quad ? markup.quadPresets[iy * 2 + ix] : markup.viewPreset;
    // Boundary geometry lies on the level plane, so the same handles can be
    // projected into plan, axonometric, and perspective views. This keeps
    // editing consistent between 2D and 3D instead of silently disabling it.
    const bounds = { left: rect.left + (quad ? ix * rect.width / 2 : 0), top: rect.top + (quad ? iy * rect.height / 2 : 0), width: rect.width / (quad ? 2 : 1), height: rect.height / (quad ? 2 : 1) };
    const cam = camera(x, y);
    if (!cam) return null;
    const elevation = state.levels.find(l => l.id === slab.levelId)?.elevationMm ?? 0;
    const snapCanvas = { getBoundingClientRect: () => bounds } as HTMLCanvasElement;
    const project = (p: BoundaryPoint) => worldMmToScreen(p.xMm, p.yMm, elevation, cam, snapCanvas);
    ray.setFromCamera(new THREE.Vector2((x - bounds.left) / bounds.width * 2 - 1, -(y - bounds.top) / bounds.height * 2 + 1), cam);
    const world = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -elevation / 1000), new THREE.Vector3());
    return { state, edit, slab, cam, bounds, snapCanvas, elevation, project, point: world ? { xMm: world.x * 1000, yMm: world.z * 1000 } : null };
  }
  function pick(ctx: NonNullable<ReturnType<typeof context>>, x: number, y: number, edgesOnly = false): Hit | null {
    const loops = drag?.preview ?? slabBoundaryLoops(ctx.slab);
    let best: Hit | null = null, distance = 12;
    if (!edgesOnly) loops.forEach((loop, ring) => loop.forEach((p, index) => {
      const a = ctx.project(p), d = Math.hypot(a.clientX - x, a.clientY - y);
      if (d < distance) { distance = d; best = { ring, index, kind: "vertex" }; }
    }));
    if (best) return best;
    distance = 9;
    loops.forEach((loop, ring) => loop.forEach((p, index) => {
      const a = ctx.project(p), b = ctx.project(loop[(index + 1) % loop.length]);
      const dx = b.clientX - a.clientX, dy = b.clientY - a.clientY;
      const t = Math.max(0, Math.min(1, ((x - a.clientX) * dx + (y - a.clientY) * dy) / (dx * dx + dy * dy)));
      const d = Math.hypot(x - a.clientX - t * dx, y - a.clientY - t * dy);
      if (d < distance) { distance = d; best = { ring, index, kind: "edge" }; }
    }));
    return best;
  }
  const matches = (a: Hit | null, ring: number, index: number, kind: Hit["kind"]) => a?.ring === ring && a.index === index && a.kind === kind;
  function element(tag: string, attrs: Record<string, string | number>) {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    overlay.appendChild(node);
    return node;
  }
  function release() {
    const id = drag?.pointer;
    drag = null; snap = null;
    if (id != null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    const ctl = controls();
    if (ctl && enabledBeforeDrag != null) ctl.enabled = enabledBeforeDrag;
    enabledBeforeDrag = null;
  }
  function synchronizeSession(edit: NonNullable<ReturnType<typeof useLayoutDrawingStore.getState>["slabBoundaryEdit"]>) {
    // Run before hit-testing as well as rendering: a click can arrive before the
    // first animation frame after entering edit mode or switching sketch tools.
    if (edit.originalBoundary !== lastSession) {
      release(); selected = null; hover = null; firstTrim = null;
      lastSession = edit.originalBoundary;
    }
    if (lastTool !== edit.tool) {
      release(); firstTrim = null; lastTool = edit.tool;
    }
  }
  function render() {
    frame = requestAnimationFrame(render);
    const ctx = context();
    overlay.replaceChildren();
    if (!ctx) { overlay.style.display = "none"; if (drag) release(); return; }
    synchronizeSession(ctx.edit);
    Object.assign(overlay.style, { display: "block", left: `${ctx.bounds.left}px`, top: `${ctx.bounds.top}px`, width: `${ctx.bounds.width}px`, height: `${ctx.bounds.height}px` });
    const loops = drag?.preview ?? slabBoundaryLoops(ctx.slab);
    const xy = (p: BoundaryPoint) => { const q = ctx.project(p); return { x: q.clientX - ctx.bounds.left, y: q.clientY - ctx.bounds.top }; };

    // ── Edge + vertex rendering ──────────────────────────────────────────────
    loops.forEach((loop, ring) => {
      loop.forEach((p, index) => {
        const a = xy(p), b = xy(loop[(index + 1) % loop.length]);
        const active = matches(selected, ring, index, "edge") || matches(firstTrim?.hit ?? null, ring, index, "edge");
        const isHovered = matches(hover, ring, index, "edge");
        const stroke = active ? "#facc15" : isHovered ? "#22d3ee" : "#ec4899";
        const width = active ? 4 : isHovered ? 3 : 2;
        element("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke, "stroke-width": width });
        if (ctx.slab.kind === "roof" && ring === 0) {
          const slope = ctx.slab.edgeSlopes?.find(edge => edge.edgeIdx === index);
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          const pitch = slope?.isSloped === false ? "Flat" : `${slope?.pitchDeg ?? 30}°`;
          const angleLabel = element("text", { x: mx + 5, y: my - 5, fill: active ? "#facc15" : "#fef08a", "font-size": 11, "font-weight": "bold", "paint-order": "stroke", stroke: "#18181b", "stroke-width": 3, "stroke-linejoin": "round" });
          angleLabel.textContent = pitch;
        }
        // Midpoint dot on hovered edge — makes it obviously interactive
        if (isHovered && !active) {
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          element("circle", { cx: mx, cy: my, r: 4, fill: "#22d3ee", stroke: "#0e7490", "stroke-width": 1.5 });
        }
      });
      loop.forEach((p, index) => {
        const a = xy(p), endpoint = selected?.kind === "edge" && selected.ring === ring && (selected.index === index || (selected.index + 1) % loop.length === index);
        const active = endpoint || matches(selected, ring, index, "vertex");
        const size = active ? 11 : 8;
        element("rect", { x: a.x - size / 2, y: a.y - size / 2, width: size, height: size, fill: matches(hover, ring, index, "vertex") ? "#22d3ee" : active ? "#facc15" : "#fff", stroke: "#be185d", "stroke-width": 2 });
      });
    });

    // ── Unclosed / degenerate loop warning ───────────────────────────────────
    let hasOpenLoop = false;
    loops.forEach((loop) => {
      if (loop.length < 3) {
        hasOpenLoop = true;
        // Draw pulsing rose circles on every vertex in the broken loop
        loop.forEach((p) => {
          const a = xy(p);
          const circle = element("circle", { cx: a.x, cy: a.y, r: 7, fill: "#f43f5e", stroke: "#881337", "stroke-width": 2, opacity: 1 });
          // CSS animation via style attribute
          circle.setAttribute("style", "animation: boundary-open-pulse 1s ease-in-out infinite");
        });
      }
    });
    if (hasOpenLoop) {
      const bg = element("rect", { x: 8, y: 8, width: 230, height: 26, rx: 6, fill: "#1e1e2e", opacity: 0.82 });
      bg.setAttribute("aria-hidden", "true");
      const warn = element("text", { x: 18, y: 26, fill: "#f43f5e", "font-size": 13, "font-weight": "bold" });
      warn.textContent = "⚠ Boundary not closed — needs ≥ 3 vertices";
    }

    // ── Validation / move error label ────────────────────────────────────────
    const errMsg = ctx.edit.error;
    if (errMsg && !hasOpenLoop) {
      const bg2 = element("rect", { x: 8, y: 8, width: Math.min(errMsg.length * 6.5 + 20, ctx.bounds.width - 16), height: 24, rx: 5, fill: "#18181b", opacity: 0.75 });
      bg2.setAttribute("aria-hidden", "true");
      const errLabel = element("text", { x: 16, y: 25, fill: "#fbbf24", "font-size": 12 });
      errLabel.textContent = errMsg;
    }

    // ── Snap indicator ───────────────────────────────────────────────────────
    if (snap?.snapped) {
      const a = xy(snap.worldMm);
      const attrs = { stroke: "#22d3ee", "stroke-width": 2, fill: "none" };
      if (snap.type === "midpoint") element("path", { ...attrs, d: `M${a.x} ${a.y - 7}l7 13h-14Z` });
      else if (snap.type === "intersection") element("path", { ...attrs, d: `M${a.x - 6} ${a.y - 6}l12 12m0 -12l-12 12` });
      else if (snap.type === "perpendicular") element("path", { ...attrs, d: `M${a.x - 7} ${a.y - 7}v14h14m-14 -6h6v6` });
      else element("rect", { ...attrs, x: a.x - 6, y: a.y - 6, width: 12, height: 12 });
      const label = element("text", { x: a.x + 12, y: a.y - 12, fill: "#22d3ee", "font-size": 12 });
      label.textContent = snap.label ?? snap.type;
    }
    if (firstTrim) {
      const label = element("text", { x: 16, y: 28, fill: "#facc15", "font-size": 13 });
      label.textContent = "Trim/Extend: click the portion of the second edge to keep";
    }
  }
  function down(e: PointerEvent) {
    const s = useLayoutDrawingStore.getState();
    if (!s.slabBoundaryEdit || s.armedLayoutTool === "lines") return;
    if (e.button !== 0) return;
    if (drag && drag.pointer !== e.pointerId) { block(e); return; }
    pointer = { x: e.clientX, y: e.clientY };
    const ctx = context();
    block(e);
    if (!ctx?.point) { error("Edit boundary handles in a Top / plan view."); return; }
    synchronizeSession(ctx.edit);
    if (drag) return;
    const hit = pick(ctx, e.clientX, e.clientY, ctx.edit.tool === "trim" || ctx.edit.tool === "insert");
    if (!hit) { selected = null; firstTrim = null; ctx.state.setBoundarySelectedEdge(null); return; }
    if (hit.kind === "edge") ctx.state.setBoundarySelectedEdge(hit);
    const loops = slabBoundaryLoops(ctx.slab);
    if (ctx.edit.tool === "trim") {
      selected = hit;
      if (!firstTrim) { firstTrim = { hit, point: ctx.point }; error(null); return; }
      if (firstTrim.hit.ring !== hit.ring) { error("Select two edges of the same loop."); return; }
      const result = trimBoundaryCorner(loops[hit.ring], firstTrim.hit.index, firstTrim.point, hit.index, ctx.point);
      if (!result) { error("These portions cannot form a closed corner. Select the parts to keep."); firstTrim = null; return; }
      loops[hit.ring] = result;
      ctx.state.applySlabBoundaryLoops(loops); firstTrim = null; selected = null; ctx.state.setBoundarySelectedEdge(null);
      return;
    }
    if (ctx.edit.tool === "insert" || ctx.edit.tool === "delete") {
      if (ctx.edit.tool === "insert") loops[hit.ring].splice(hit.index + 1, 0, projectToEdge(ctx.point, loops[hit.ring][hit.index], loops[hit.ring][(hit.index + 1) % loops[hit.ring].length]));
      else if (hit.kind === "vertex") loops[hit.ring].splice(hit.index, 1);
      else return;
      ctx.state.applySlabBoundaryLoops(loops); selected = null; ctx.state.setBoundarySelectedEdge(null);
      return;
    }
    const endpointEdge = hit.kind === "vertex" && selected?.kind === "edge" && selected.ring === hit.ring &&
      (selected.index === hit.index || (selected.index + 1) % loops[hit.ring].length === hit.index) ? selected.index : null;
    if (endpointEdge == null) selected = hit;
    drag = { hit, original: loops, preview: loops, from: ctx.point, pointer: e.pointerId, x: e.clientX, y: e.clientY, moved: false, endpointEdge };
    canvas.setPointerCapture(e.pointerId);
    const ctl = controls(); if (ctl) { enabledBeforeDrag = ctl.enabled; ctl.enabled = false; }
    error(null);
  }
  function move(e: PointerEvent) {
    const s = useLayoutDrawingStore.getState();
    if (!s.slabBoundaryEdit || s.armedLayoutTool === "lines") return;
    if (drag && drag.pointer !== e.pointerId) { block(e); return; }
    pointer = { x: e.clientX, y: e.clientY };
    const ctx = context();
    if (!ctx) return;
    block(e);
    hover = pick(ctx, e.clientX, e.clientY);
    canvas.style.cursor = hover?.kind === "vertex" ? "crosshair" : hover ? "move" : "default";
    if (!drag || drag.pointer !== e.pointerId || !ctx.point) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 3) return;
    drag.moved = true;
    const { hit, original, from, endpointEdge } = drag;
    const loop = original[hit.ring], next = (hit.index + 1) % loop.length;
    const anchor = endpointEdge != null
      ? loop[hit.index === endpointEdge ? (endpointEdge + 1) % loop.length : endpointEdge]
      : hit.kind === "vertex" ? loop[(hit.index + loop.length - 1) % loop.length] : loop[hit.index];
    // Exclude moving edges from snapping; retain all stationary edges, including holes.
    const stationary = original.flatMap((ring, ri) => ring.flatMap((p, i) => {
      const j = (i + 1) % ring.length;
      const moving = ri === hit.ring && (i === hit.index || j === hit.index || (hit.kind === "edge" && (i === next || j === next)));
      return moving ? [] : [{ id: `boundary-${ri}-${i}`, projectId: ctx.slab.projectId, levelId: ctx.slab.levelId, createdAt: 0, startXmm: p.xMm, startYmm: p.yMm, endXmm: ring[j].xMm, endYmm: ring[j].yMm }];
    }));
    snap = e.altKey ? null : findGlobalSnap({ clientPos: { x: e.clientX, y: e.clientY }, canvas: ctx.snapCanvas, camera: ctx.cam, levelId: ctx.slab.levelId, levelElevationMm: ctx.elevation,
      walls: ctx.state.walls, slabs: ctx.state.slabs.filter(s => s.id !== ctx.slab.id), sketchLines: [...ctx.state.sketchLines, ...stationary], gridLines: ctx.state.gridLines, underlays: ctx.state.underlays,
      activeModes: ctx.state.planSnapModes, fromMm: anchor, checkAutoClose: false,
    });
    let target = snap?.snapped ? snap.worldMm : ctx.point;
    let candidate: BoundaryLoops;
    if (hit.kind === "edge") {
      const startOnEdge = projectToEdge(from, loop[hit.index], loop[next]);
      candidate = moveBoundaryEdge(original, hit.ring, hit.index, snap?.snapped ? startOnEdge : from, target);
    } else {
      if (endpointEdge != null) {
        target = projectToEdge(target, loop[endpointEdge], loop[(endpointEdge + 1) % loop.length]);
        if (snap?.snapped && Math.hypot(target.xMm - snap.worldMm.xMm, target.yMm - snap.worldMm.yMm) > 0.001) snap = null;
      }
      candidate = original.map(ring => ring.map(p => ({ ...p })));
      candidate[hit.ring][hit.index] = { ...target };
    }
    const invalid = validateBoundary(candidate);
    // Invalid moves snap back to the last valid preview and never reach the mesh/store.
    if (!invalid) drag.preview = candidate;
    else snap = null;
    error(invalid);
  }
  function up(e: PointerEvent) {
    const s = useLayoutDrawingStore.getState();
    if (!s.slabBoundaryEdit || s.armedLayoutTool === "lines") return;
    block(e);
    if (!drag || drag.pointer !== e.pointerId) return;
    if (drag.moved) useLayoutDrawingStore.getState().applySlabBoundaryLoops(drag.preview);
    release();
  }
  function cancel(e: Event) {
    if (drag && (!(e instanceof PointerEvent) || e.pointerId === drag.pointer)) { block(e); release(); }
  }
  function swallow(e: Event) { const s = useLayoutDrawingStore.getState(); if (s.slabBoundaryEdit && s.armedLayoutTool !== "lines") block(e); }
  function key(e: KeyboardEvent) {
    const s = useLayoutDrawingStore.getState();
    if (!s.slabBoundaryEdit || s.armedLayoutTool === "lines" || (e.target as HTMLElement)?.closest("input,textarea,[contenteditable=true]")) return;
    if (e.key === "Escape") {
      block(e);
      if (drag) release();
      else if (firstTrim) firstTrim = null;
      else useLayoutDrawingStore.getState().cancelSlabBoundaryEdit();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      block(e);
      const ctx = context();
      if (!drag && ctx && selected?.kind === "vertex") {
        const loops = slabBoundaryLoops(ctx.slab);
        loops[selected.ring].splice(selected.index, 1);
        ctx.state.applySlabBoundaryLoops(loops); selected = null;
      }
    }
  }
  const events = [["pointerdown", down], ["pointermove", move], ["pointerup", up], ["pointercancel", cancel], ["lostpointercapture", cancel], ["click", swallow], ["dblclick", swallow], ["contextmenu", swallow]] as const;
  for (const [name, fn] of events) canvas.addEventListener(name, fn as EventListener, true);
  window.addEventListener("keydown", key, true);
  window.addEventListener("blur", cancel);
  frame = requestAnimationFrame(render);
  return () => {
    release(); cancelAnimationFrame(frame); overlay.remove(); canvas.style.cursor = "";
    for (const [name, fn] of events) canvas.removeEventListener(name, fn as EventListener, true);
    window.removeEventListener("keydown", key, true); window.removeEventListener("blur", cancel);
  };
}
