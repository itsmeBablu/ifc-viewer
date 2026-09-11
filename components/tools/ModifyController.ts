import { isObjectVisibleInView } from "@/lib/viewVisibility";
import { useViewDisplayStore, viewDisplayKey } from "@/store/useViewDisplayStore";
import { joinRoof, roofWallProfile } from "@/lib/roofConnections";
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { useModifyStore } from "@/store/useModifyStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { alignmentTransform, collectRaycastCandidates, ownerOf, pickGeometry, safeExpandByObject, selectionKey, type GeometrySelection } from "@/lib/modifySelection";
import { currentModifySelection, expandedSelection, mirrorMatrix, placeGroup, splitElement, transformElements } from "@/lib/modifyOperations";
import { findGlobalSnap } from "@/lib/globalSnapping";
import { snapMeshMeasurement, screenSegmentPoint } from "@/lib/measurementSnap";

export function installModifyController(options: {
  canvas: HTMLCanvasElement;
  scene: THREE.Scene;
  camera: (x: number, y: number) => THREE.Camera | null;
  roots: () => THREE.Object3D[];
  controls: () => { enabled: boolean } | null;
}) {
  const { canvas, scene } = options;
  const rect = canvas.getBoundingClientRect();
  const initialCamera = options.camera(rect.left + rect.width / 2, rect.top + rect.height / 2);
  if (!initialCamera) return () => {};
  const tc = new TransformControls(initialCamera, canvas);
  tc.setSpace("world"); tc.setSize(0.42); tc.enabled = false;
  const pivot = new THREE.Object3D(), overlay = new THREE.Group(), helper = tc.getHelper();
  overlay.renderOrder = 9999;
  scene.add(pivot, overlay, helper); helper.visible = false;
  let mouse = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  let pointerDownPos: { x: number; y: number } | null = null;
  let pointerDownHit: GeometrySelection | null = null;
  let axisStart: THREE.Vector3 | null = null;
  let hover: GeometrySelection | null = null;
  let lastOverlay: [GeometrySelection | null, GeometrySelection | null, GeometrySelection | null] | null = null;
  let frame = 0, selectionSignature = "", previewing = false, controlsEnabled = true;
  let originalPivot = new THREE.Vector3(), originalRotation = new THREE.Quaternion();
  let originalObjects: { object: THREE.Object3D; matrix: THREE.Matrix4 }[] = [];
  let alt = false;
  const ray = new THREE.Raycaster(); ray.params.Line.threshold = 0.08;
  const block = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  const enabled = () => !useLayoutDrawingStore.getState().slabBoundaryEdit && !useLayoutDrawingStore.getState().armedLayoutTool && !useToolMarkupStore.getState().armedTool;
  const setMessage = (message: string | null) => { if (useModifyStore.getState().message !== message) useModifyStore.setState({ message }); };
  async function run(operation: () => Promise<unknown>) {
    if (useModifyStore.getState().busy) return;
    useModifyStore.setState({ busy: true, message: null });
    try { await operation(); hover = null; useModifyStore.setState({ selection: null }); }
    catch (e) { setMessage(e instanceof Error ? e.message : "The operation could not be saved."); }
    finally { useModifyStore.setState({ busy: false }); selectionSignature = ""; }
  }
  function viewport() {
    const full = canvas.getBoundingClientRect(), markup = useToolMarkupStore.getState();
    if (!markup.quadView) return full;
    return { left: full.left + (mouse.x >= full.left + full.width / 2 ? full.width / 2 : 0), top: full.top + (mouse.y >= full.top + full.height / 2 ? full.height / 2 : 0), width: full.width / 2, height: full.height / 2 };
  }
  function prepare() {
    const cam = options.camera(mouse.x, mouse.y); if (!cam) return null;
    const bounds = viewport();
    ray.setFromCamera(new THREE.Vector2((mouse.x - bounds.left) / bounds.width * 2 - 1, -(mouse.y - bounds.top) / bounds.height * 2 + 1), cam);
    tc.camera = cam;
    const full = canvas.getBoundingClientRect();
    tc.viewport = useToolMarkupStore.getState().quadView ? new THREE.Vector4(bounds.left - full.left, full.height - (bounds.top - full.top) - bounds.height, bounds.width, bounds.height) : null;
    return { cam, bounds, snapCanvas: { getBoundingClientRect: () => bounds } as HTMLCanvasElement };
  }
  function geometryPick() {
    const ctx = prepare(); if (!ctx) return null;
    const state = useModifyStore.getState();
    const level = state.tool === "joinRoof" ? (state.reference ? "face" : "edge") : state.tool === "mirror" && state.mirrorAxis === "pick" ? "edge" : state.tool === "align" && state.level === "element" ? "face" : state.level;
    const ms = useToolMarkupStore.getState();
    const visibility = useViewDisplayStore.getState().views[viewDisplayKey(ms.quadView ? ms.quadPresets[ms.quadActiveIndex] : ms.viewPreset, ms.markupFloorId, useLayoutDrawingStore.getState().activeSectionId)];
    const hit = pickGeometry(ray, options.roots(), ctx.cam, ctx.bounds, mouse.x, mouse.y, level, obj => isObjectVisibleInView(obj, visibility));
    if (hit?.kind === "line") {
      const layout = useLayoutDrawingStore.getState(), line = layout.sketchLines.find(l => l.id === hit.id);
      if (line && !line.curved) {
        const elevation = ((layout.levels.find(l => l.id === line.levelId)?.elevationMm ?? 0) + (line.elevationOffsetMm ?? 0)) / 1000;
        const a = new THREE.Vector3(line.startXmm / 1000, elevation, line.startYmm / 1000), b = new THREE.Vector3(line.endXmm / 1000, elevation, line.endYmm / 1000);
        const point = screenSegmentPoint(a, b, ctx.cam, ctx.bounds, mouse.x, mouse.y) ?? a;
        if (level === "vertex") {
          const endpoint = point.distanceToSquared(a) <= point.distanceToSquared(b) ? a : b;
          hit.geometry = { ...hit.geometry, kind: "vertex", point: endpoint.toArray(), points: [endpoint.toArray()] };
        } else hit.geometry = { ...hit.geometry, kind: "edge", point: point.toArray(), points: [a.toArray(), b.toArray()] };
      }
    }
    return hit;
  }
  function planPoint() {
    const ctx = prepare(); if (!ctx) return null;
    const layout = useLayoutDrawingStore.getState(), markup = useToolMarkupStore.getState();
    const level = layout.levels.find(l => l.id === markup.markupFloorId) ?? layout.levels[0];
    const elevation = (level?.elevationMm ?? 0) / 1000;
    const point = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -elevation), new THREE.Vector3());
    if (!point || alt) return point;
    const snap = findGlobalSnap({ clientPos: mouse, camera: ctx.cam, canvas: ctx.snapCanvas, levelId: level?.id, levelElevationMm: elevation * 1000,
      walls: layout.walls, slabs: layout.slabs, sketchLines: layout.sketchLines, gridLines: layout.gridLines, underlays: layout.underlays,
      activeModes: layout.planSnapModes, checkAutoClose: false,
    });
    return snap.snapped ? new THREE.Vector3(snap.worldMm.xMm / 1000, elevation, snap.worldMm.yMm / 1000) : point;
  }
  function selectedObjects() {
    const keys = new Set(expandedSelection(currentModifySelection()).map(selectionKey)), objects: THREE.Object3D[] = [];
    const layout = useLayoutDrawingStore.getState();
    for (const door of layout.doors) if (keys.has(`wall:${door.wallId}`)) keys.add(`door:${door.id}`);
    for (const win of layout.windows) if (keys.has(`wall:${win.wallId}`)) keys.add(`window:${win.id}`);
    for (const root of options.roots()) root.traverse(object => {
      const owner = ownerOf(object); if (!owner || !keys.has(selectionKey(owner))) return;
      const parent = object.parent ? ownerOf(object.parent) : null;
      if (!parent || selectionKey(parent) !== selectionKey(owner)) objects.push(object);
    });
    return objects;
  }
  function clearOverlay() {
    for (const child of overlay.children) {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Points) {
        child.geometry.dispose(); const mats = Array.isArray(child.material) ? child.material : [child.material]; mats.forEach(m => m.dispose());
      }
    }
    overlay.clear();
  }
  function highlight(selection: GeometrySelection | null, color: number) {
    if (!selection) return;
    const feature = selection.geometry, points = feature.points.map(p => new THREE.Vector3().fromArray(p));
    if (!points.length) return;
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    let object: THREE.Object3D;
    if (feature.kind === "face") object = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
    else if (feature.kind === "vertex") object = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size: 10, sizeAttenuation: false, depthTest: false }));
    else object = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, depthTest: false }));
    object.renderOrder = 9999; overlay.add(object);
  }
  function restorePreview() {
    for (const { object, matrix } of originalObjects) { matrix.decompose(object.position, object.quaternion, object.scale); object.updateMatrixWorld(true); }
    originalObjects = []; previewing = false;
    const controls = options.controls();
    if (controls) {
      const oc = controls as unknown as {
        state?: number;
        _pointers?: number[];
        _pointerPositions?: Record<number, unknown>;
      };
      if (oc.state !== undefined) oc.state = -1;
      if (Array.isArray(oc._pointers)) oc._pointers.length = 0;
      if (oc._pointerPositions) {
        for (const k of Object.keys(oc._pointerPositions)) delete oc._pointerPositions[Number(k)];
      }
      controls.enabled = controlsEnabled;
    }
  }
  function delta() {
    return new THREE.Matrix4().compose(pivot.position, pivot.quaternion, new THREE.Vector3(1, 1, 1))
      .multiply(new THREE.Matrix4().compose(originalPivot, originalRotation, new THREE.Vector3(1, 1, 1)).invert());
  }
  function change() {
    if (!previewing) return;
    if (tc.getMode() === "translate" && !alt) {
      const ctx = prepare(), layout = useLayoutDrawingStore.getState();
      const active = tc.axis ?? "XYZ";
      if (ctx) {
        const excluded = new Set(expandedSelection(currentModifySelection()).map(selectionKey));
        const result = findGlobalSnap({ clientPos: mouse, canvas: ctx.snapCanvas, camera: ctx.cam, levelElevationMm: originalPivot.y * 1000,
          walls: layout.walls.filter(row => !excluded.has(`wall:${row.id}`)), slabs: layout.slabs.filter(row => !excluded.has(`slab:${row.id}`)), sketchLines: layout.sketchLines.filter(row => !excluded.has(`line:${row.id}`)), gridLines: layout.gridLines, underlays: layout.underlays,
          activeModes: layout.planSnapModes, checkAutoClose: false, fromMm: { xMm: originalPivot.x * 1000, yMm: originalPivot.z * 1000 },
        });
        let point = result.snapped ? new THREE.Vector3(result.worldMm.xMm / 1000, pivot.position.y, result.worldMm.yMm / 1000) : null;
        if (!point) {
          const safeRoots = collectRaycastCandidates(options.roots());
          const hit = ray.intersectObjects(safeRoots, false).find(h => { const owner = ownerOf(h.object); return owner && !excluded.has(selectionKey(owner)); });
          if (hit) point = snapMeshMeasurement(hit.object, ctx.cam, ctx.snapCanvas, mouse.x, mouse.y, layout.planSnapModes, originalPivot, hit.instanceId)?.point ?? null;
        }
        if (point) {
          for (const axis of ["X", "Y", "Z"] as const) if (active.includes(axis)) pivot.position[axis.toLowerCase() as "x" | "y" | "z"] = point[axis.toLowerCase() as "x" | "y" | "z"];
        }
      }
    }
    const matrix = delta();
    for (const { object, matrix: original } of originalObjects) {
      const parentWorld = object.parent?.matrixWorld ?? new THREE.Matrix4();
      const local = parentWorld.clone().invert().multiply(matrix).multiply(parentWorld).multiply(original);
      local.decompose(object.position, object.quaternion, object.scale); object.updateMatrixWorld(true);
    }
  }
  function dragging(event: { value: unknown }) {
    if (event.value) {
      previewing = true; originalPivot = pivot.position.clone(); originalRotation = pivot.quaternion.clone();
      originalObjects = selectedObjects().map(object => { object.updateMatrix(); return { object, matrix: object.matrix.clone() }; });
      const controls = options.controls(); controlsEnabled = controls?.enabled ?? true; if (controls) controls.enabled = false;
    } else if (previewing) {
      const matrix = delta(), refs = currentModifySelection(); restorePreview();
      void run(() => transformElements(refs, matrix));
    }
  }
  tc.addEventListener("objectChange", change);
  tc.addEventListener("dragging-changed", dragging);
  function render() {
    frame = requestAnimationFrame(render);
    const state = useModifyStore.getState();
    if (!enabled()) { helper.visible = false; tc.enabled = false; clearOverlay(); lastOverlay = null; selectionSignature = ""; return; }
    if (!previewing) {
      const refs = expandedSelection(currentModifySelection());
      const signature = `${state.tool}:${refs.map(selectionKey).join(",")}:${useLayoutDrawingStore.getState().lastMutatedAt}`;
      // Keep the pivot in sync with live mesh geometry. A persisted move can
      // arrive after the selection signature was computed, leaving the gizmo
      // at its previous center until the next click.
      if (refs.length && (state.tool === "move" || state.tool === "rotate")) {
        const liveObjects = selectedObjects(), liveBounds = new THREE.Box3();
        liveObjects.forEach(object => safeExpandByObject(liveBounds, object));
        if (!liveBounds.isEmpty()) {
          const liveCenter = liveBounds.getCenter(new THREE.Vector3());
          if (liveCenter.distanceToSquared(pivot.position) > 1e-10) {
            pivot.position.copy(liveCenter);
            pivot.updateMatrixWorld(true);
          }
        }
      }
      if (signature !== selectionSignature) {
        selectionSignature = signature;
        const objects = selectedObjects(), bounds = new THREE.Box3();
        objects.forEach(o => safeExpandByObject(bounds, o));
        if (!bounds.isEmpty() && (state.tool === "move" || state.tool === "rotate")) {
          bounds.getCenter(pivot.position); pivot.quaternion.identity();
          tc.attach(pivot); tc.setMode(state.tool === "move" ? "translate" : "rotate");
          tc.showX = state.tool !== "rotate" || refs.every(r => r.kind === "placement");
          tc.showZ = tc.showX; tc.showY = true;
          tc.enabled = !state.busy; helper.visible = true;
        } else { tc.detach(); tc.enabled = false; helper.visible = false; }
      }
    }
    if (!lastOverlay || axisStart || lastOverlay[0] !== state.reference || lastOverlay[1] !== state.selection || lastOverlay[2] !== hover) {
      clearOverlay(); highlight(state.reference, 0xfacc15); highlight(state.selection, 0x38bdf8); highlight(hover, 0x22d3ee);
      lastOverlay = [state.reference, state.selection, hover];
    }
    if (axisStart) {
      const end = planPoint();
      if (end) overlay.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([axisStart, end]), new THREE.LineBasicMaterial({ color: 0xfacc15, depthTest: false })));
    }
  }
  function down(event: PointerEvent) {
    if (!event.isPrimary) return;
    if (!enabled() || event.button !== 0) return;
    mouse = { x: event.clientX, y: event.clientY }; alt = event.altKey;
    const state = useModifyStore.getState();
    if (tc.enabled && tc.axis) {
      const controls = options.controls();
      if (controls) controls.enabled = false;
      return;
    }
    const modalTools = ["mirror", "split", "joinRoof", "attachTop", "attachBase", "align"];
    if (!state.placingGroupId && !modalTools.includes(state.tool)) {
      pointerDownPos = { x: event.clientX, y: event.clientY };
      pointerDownHit = geometryPick();
      return;
    }
    block(event);
    if (state.placingGroupId) {
      const point = planPoint(); if (point) void run(() => placeGroup(state.placingGroupId!, point)); return;
    }
    if (state.tool === "mirror" && state.mirrorAxis === "draw") {
      const point = planPoint(); if (!point) return;
      if (!axisStart) { axisStart = point; setMessage("Pick the second mirror-axis point."); return; }
      const first = axisStart; axisStart = null;
      void run(() => transformElements(currentModifySelection(), mirrorMatrix(first, point), state.mirrorCopy)); return;
    }
    const hit = geometryPick();
    if (!hit) {
      if ((state.tool === "move" || state.tool === "select") && state.level === "element") {
        useLayoutDrawingStore.getState().clearSelection(); useToolMarkupStore.getState().selectPlacement(null);
        useModifyStore.setState({ selection: null }); return;
      }
      setMessage("Hover a visible face, edge or vertex, then click."); return;
    }
    if (state.tool === "joinRoof") {
      if (!state.reference) { useModifyStore.setState({ reference: hit, message: "Pick the target roof top face." }); return; }
      void run(async () => { const sourceObject = options.roots().flatMap(root => { const found: THREE.Mesh[] = []; root.traverse(o => { if (o instanceof THREE.Mesh && o.uuid === state.reference!.geometry.meshUuid) found.push(o); }); return found; })[0];
        if (!sourceObject) throw new Error("Select the source roof edge again.");
        await joinRoof(state.reference!, hit, sourceObject); useModifyStore.setState({ reference: null }); }); return;
    }
    if (state.tool === "attachTop" || state.tool === "attachBase") {
      void run(async () => {
        const layout = useLayoutDrawingStore.getState();
        const roof = layout.slabs.find(s => s.id === hit.id && (s.kind === "roof" || s.kind === "floor"));
        if (!roof) throw new Error("Select a roof or floor as the attachment target.");
        let mesh: THREE.Mesh | undefined;
        for (const root of options.roots()) root.traverse(o => { if (o instanceof THREE.Mesh && o.userData.layoutSlabId === roof.id) mesh = o; });
        if (!mesh) throw new Error("The roof or floor mesh is not available.");
        const walls = expandedSelection(currentModifySelection()).filter(r => r.kind === "wall").map(r => layout.walls.find(w => w.id === r.id)!).filter(Boolean);
        if (!walls.length) throw new Error("Select one or more walls before activating Attach Top/Base.");
        const findSlabMesh = (id?: string) => {
          let found: THREE.Mesh | undefined;
          if (id) for (const root of options.roots()) root.traverse(object => { if (object instanceof THREE.Mesh && object.userData.layoutSlabId === id) found = object; });
          return found;
        };
        for (const wall of walls) {
          if (layout.lockedElementKeys.includes(`wall:${wall.id}`)) throw new Error("Unlock the selected walls before attaching them.");
          roofWallProfile(wall, (layout.levels.find(l => l.id === wall.levelId)?.elevationMm ?? 0) + (wall.baseOffsetMm ?? 0), state.tool === "attachTop" ? mesh : findSlabMesh(wall.attachedTopRoofId), state.tool === "attachBase" ? mesh : findSlabMesh(wall.attachedBaseRoofId));
        }
        for (const wall of walls) await layout.updateWall(wall.id, state.tool === "attachTop" ? { attachedTopRoofId: roof.id } : { attachedBaseRoofId: roof.id });
      }); return;
    }
    if (state.tool === "align") {
      if (!state.reference) { useModifyStore.setState({ reference: hit, message: "Pick the target feature to align. Escape resets the reference." }); return; }
      if (expandedSelection([hit]).some(ref => selectionKey(ref) === selectionKey(state.reference!))) { setMessage("Pick a target outside the reference element or group."); return; }
      void run(() => transformElements([hit], alignmentTransform(state.reference!.geometry, hit.geometry))); return;
    }
    if (state.tool === "split") { void run(() => splitElement(hit, new THREE.Vector3().fromArray(hit.geometry.point))); return; }
    if (state.tool === "mirror") {
      if (hit.geometry.points.length !== 2) { setMessage("Pick a straight edge for the mirror axis."); return; }
      void run(() => transformElements(currentModifySelection(), mirrorMatrix(new THREE.Vector3().fromArray(hit.geometry.points[0]), new THREE.Vector3().fromArray(hit.geometry.points[1])), state.mirrorCopy)); return;
    }
    useLayoutDrawingStore.getState().selectElement(hit, event.shiftKey ? "toggle" : "replace");
    if (hit.kind === "placement") useToolMarkupStore.getState().selectPlacement(useLayoutDrawingStore.getState().selectedElements.some(ref => ref.kind === "placement" && ref.id === hit.id) ? hit.id : null);
    else useToolMarkupStore.getState().selectPlacement(null);
    useModifyStore.setState({ selection: hit, message: null, tool: state.tool === "select" ? "move" : state.tool });
  }
  function move(event: PointerEvent) {
    mouse = { x: event.clientX, y: event.clientY }; alt = event.altKey;
    const state = useModifyStore.getState();
    if (!enabled() || state.busy) return;
    if (previewing) {
      const ctx = prepare();
      if (ctx) tc.pointerMove({ x: (mouse.x - ctx.bounds.left) / ctx.bounds.width * 2 - 1, y: -(mouse.y - ctx.bounds.top) / ctx.bounds.height * 2 + 1, button: -1 } as PointerEvent);
      block(event); return;
    }
    prepare();
    hover = state.level !== "element" || state.tool === "align" || (state.tool === "mirror" && state.mirrorAxis === "pick") ? geometryPick() : null;
  }
  function stopLegacy(event: Event) {
    if (event.type === "pointerup") return;
    const state = useModifyStore.getState();
    const modalTools = ["mirror", "split", "joinRoof", "attachTop", "attachBase", "align"];
    if (enabled() && (state.placingGroupId || (modalTools.includes(state.tool) && state.level !== "element"))) {
      if (event instanceof MouseEvent && event.button !== 0) return;
      event.stopImmediatePropagation();
    }
  }
  function cancel() {
    if (previewing) { tc.reset(); restorePreview(); tc.dragging = false; tc.detach(); selectionSignature = ""; }
    axisStart = null;
    lastOverlay = null;
    const controls = options.controls();
    if (controls) {
      controls.enabled = true;
      const oc = controls as unknown as { state?: number; _pointers?: number[] };
      if (oc.state !== undefined && oc.state !== -1) oc.state = -1;
      if (Array.isArray(oc._pointers) && oc._pointers.length > 0) oc._pointers.length = 0;
    }
  }
  function key(event: KeyboardEvent) {
    if (!enabled() || (event.target as HTMLElement)?.closest("input,textarea,select,[contenteditable=true]")) return;
    const state = useModifyStore.getState();
    if (event.key === "Escape" && (state.tool !== "select" || state.reference || state.placingGroupId || previewing)) {
      block(event); cancel();
      if (state.reference) useModifyStore.setState({ reference: null, message: null });
      else { state.activate("select"); useModifyStore.setState({ placingGroupId: null }); }
    }
  }
  function onWindowPointerUp(event: PointerEvent) {
    if (pointerDownPos) {
      const dist = Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y);
      if (dist < 5) {
        const hit = pointerDownHit ?? geometryPick();
        const state = useModifyStore.getState();
        if (hit) {
          useLayoutDrawingStore.getState().selectElement(hit, event.shiftKey ? "toggle" : "replace");
          if (hit.kind === "placement") {
            useToolMarkupStore.getState().selectPlacement(
              useLayoutDrawingStore.getState().selectedElements.some((ref) => ref.kind === "placement" && ref.id === hit.id) ? hit.id : null,
            );
          } else {
            useToolMarkupStore.getState().selectPlacement(null);
          }
          useModifyStore.setState({ selection: hit, message: null, tool: "move" });
        } else if (state.level === "element" && state.selection) {
          useModifyStore.setState({ selection: null });
        }
      }
      pointerDownPos = null;
      pointerDownHit = null;
    }
    if (event.buttons === 0 || event.pointerType === "touch") {
      const controls = options.controls();
      if (controls) {
        if (!previewing && !controls.enabled) {
          controls.enabled = controlsEnabled;
        }
        const oc = controls as unknown as { state?: number; _pointers?: number[] };
        if (oc.state !== undefined && oc.state !== -1) oc.state = -1;
        if (Array.isArray(oc._pointers) && oc._pointers.length > 0) oc._pointers.length = 0;
      }
    }
  }
  canvas.addEventListener("pointerdown", down, true); canvas.addEventListener("pointermove", move, true);
  for (const name of ["pointerdown", "click", "dblclick"]) canvas.addEventListener(name, stopLegacy);
  canvas.addEventListener("pointercancel", cancel); window.addEventListener("blur", cancel); window.addEventListener("keydown", key, true);
  window.addEventListener("pointerup", onWindowPointerUp);
  const unsubscribe = useModifyStore.subscribe((state, prev) => { if (state.tool !== prev.tool || state.mirrorAxis !== prev.mirrorAxis) { cancel(); hover = null; } });
  frame = requestAnimationFrame(render);
  return () => {
    cancel(); unsubscribe(); cancelAnimationFrame(frame); clearOverlay(); tc.dispose(); scene.remove(pivot, overlay, helper);
    canvas.removeEventListener("pointerdown", down, true); canvas.removeEventListener("pointermove", move, true);
    for (const name of ["pointerdown", "click", "dblclick"]) canvas.removeEventListener(name, stopLegacy);
    canvas.removeEventListener("pointercancel", cancel); window.removeEventListener("blur", cancel); window.removeEventListener("keydown", key, true);
    window.removeEventListener("pointerup", onWindowPointerUp);
  };
}
