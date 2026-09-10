import { isMepSelectionLocked } from "./mepSelectionLock";
import * as THREE from "three";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { newLayoutId, type SelectedElementRef, type LayoutGroup } from "./layoutDrawing";
import * as db from "./layoutDrawingDb";
import { idbPutPlacement } from "./toolMarkupDb";
import { pushWerkzeugHistory } from "./werkzeugHistory";
import { selectionKey } from "./modifySelection";
import { validateBoundary, type BoundaryPoint } from "./boundaryEditing";

type Row = Record<string, unknown> & { id: string };
type LayoutState = ReturnType<typeof useLayoutDrawingStore.getState>;
const collections = {
  wall: "walls", door: "doors", window: "windows", slab: "slabs", column: "columns", beam: "beams",
  stair: "stairs", ramp: "ramps", line: "sketchLines", grid: "gridLines", duct: "ducts", pipe: "pipes", cabletray: "cableTrays", equipment: "mepEquipment", wire: "wires",
} as const;
type Kind = keyof typeof collections;
type Entry = { kind: SelectedElementRef["kind"]; row: Row };
export type GroupDefinition = Entry[];
const writers = {
  wall: db.idbPutWall, door: db.idbPutDoor, window: db.idbPutWindow, slab: db.idbPutSlab, column: db.idbPutColumn,
  beam: db.idbPutBeam, stair: db.idbPutStair, ramp: db.idbPutRamp, grid: db.idbPutGridLine,
  duct: db.idbPutDuct, pipe: db.idbPutPipe, cabletray: db.idbPutCableTray, equipment: db.idbPutMepEquipment, wire: db.idbPutWire,
  placement: idbPutPlacement,
  line: db.idbPutSketchLine,
};
function rows(kind: SelectedElementRef["kind"]): Row[] {
  if (kind === "placement") return useToolMarkupStore.getState().placements as unknown as Row[];
  return kind in collections ? useLayoutDrawingStore.getState()[collections[kind as Kind]] as unknown as Row[] : [];
}
export function currentModifySelection(): SelectedElementRef[] {
  const state = useLayoutDrawingStore.getState();
  const refs = [...state.selectedElements];
  if (!refs.length) for (const [kind, id] of [["wall", state.selectedWallId], ["door", state.selectedDoorId], ["window", state.selectedWindowId], ["slab", state.selectedSlabId], ["line", state.selectedSketchLineId], ["stair", state.selectedStairId], ["ramp", state.selectedRampId]] as const) {
    if (id) refs.push({ kind, id });
  }
  const id = useToolMarkupStore.getState().selectedPlacementId;
  if (id && !refs.some(r => r.kind === "placement" && r.id === id)) refs.push({ kind: "placement", id });
  return refs;
}
export function expandedSelection(refs: SelectedElementRef[]): SelectedElementRef[] {
  const state = useLayoutDrawingStore.getState(), result = new Map(refs.map(ref => [selectionKey(ref), ref]));
  for (const group of state.groups) {
    if (state.activeGroupId === group.id) continue;
    if (refs.some(ref => ref.kind === "group" && ref.id === group.id || group.elementRefs.some(member => selectionKey(member) === selectionKey(ref)))) {
      for (const ref of group.elementRefs) result.set(selectionKey(ref), ref);
      result.delete(`group:${group.id}`);
    }
  }
  return [...result.values()];
}
function entriesFor(refs: SelectedElementRef[]): Entry[] {
  const entries = refs.map(ref => {
    const row = rows(ref.kind).find(item => item.id === ref.id);
    if (!row) throw new Error(`The selected ${ref.kind} is unavailable.`);
    return { kind: ref.kind, row };
  });
  // Host transformations carry inserts without double-transforming their relative offsets.
  const wallIds = new Set(entries.filter(e => e.kind === "wall").map(e => e.row.id));
  for (const kind of ["door", "window"] as const) for (const row of rows(kind)) {
    if (wallIds.has(String(row.wallId)) && !entries.some(e => e.kind === kind && e.row.id === row.id)) entries.push({ kind, row });
  }
  return entries;
}
async function persist(entries: Entry[]) {
  await Promise.all(entries.map(({ kind, row }) => kind in writers ? (writers[kind as keyof typeof writers] as unknown as (row: Row) => Promise<void>)(row) : Promise.resolve()));
}
function publish(entries: Entry[], copy = false) {
  const patch: Partial<LayoutState> = {};
  for (const [kind, collection] of Object.entries(collections)) {
    const updates = entries.filter(e => e.kind === kind).map(e => e.row);
    if (!updates.length) continue;
    const existing = rows(kind as Kind);
    Object.assign(patch, { [collection]: copy ? [...existing, ...updates] : existing.map(row => updates.find(update => update.id === row.id) ?? row) });
  }
  useLayoutDrawingStore.setState({ ...patch, lastMutatedAt: Date.now() });
  const placements = entries.filter(e => e.kind === "placement").map(e => e.row);
  if (placements.length) useToolMarkupStore.setState({ placements: (copy ? [...rows("placement"), ...placements] : rows("placement").map(row => placements.find(p => p.id === row.id) ?? row)) as unknown as ReturnType<typeof useToolMarkupStore.getState>["placements"] });
}
const numeric = (row: Row, key: string, fallback = 0) => typeof row[key] === "number" ? row[key] as number : fallback;
function transformRow(entry: Entry, matrix: THREE.Matrix4, transformedWalls: Set<string>): Entry {
  const { kind } = entry, row: Row = structuredClone(entry.row);
  if (kind === "placement") {
    const local = new THREE.Matrix4().compose(new THREE.Vector3(numeric(row, "posX"), numeric(row, "posY"), numeric(row, "posZ")), new THREE.Quaternion().setFromEuler(new THREE.Euler(numeric(row, "rotX"), numeric(row, "rotY"), numeric(row, "rotZ"))), new THREE.Vector3(row.mirrored ? -1 : 1, 1, 1));
    const position = new THREE.Vector3(), q = new THREE.Quaternion(), scale = new THREE.Vector3();
    matrix.clone().multiply(local).decompose(position, q, scale);
    const rotation = new THREE.Euler().setFromQuaternion(q);
    Object.assign(row, { posX: position.x, posY: position.y, posZ: position.z, rotX: rotation.x, rotY: rotation.y, rotZ: rotation.z, mirrored: scale.x < 0, updatedAt: Date.now() });
    return { kind, row };
  }
  const up = new THREE.Vector3(0, 1, 0).transformDirection(matrix);
  if (up.distanceTo(new THREE.Vector3(0, 1, 0)) > 1e-6) throw new Error("This parametric element must stay upright. Pick parallel faces or plan edges.");
  const reflected = matrix.determinant() < 0;
  const dy = matrix.elements[13] * 1000;
  const point = (x: number, y: number) => {
    const p = new THREE.Vector3(x / 1000, 0, y / 1000).applyMatrix4(matrix);
    return { xMm: p.x * 1000, yMm: p.z * 1000 };
  };
  if (kind === "door" || kind === "window") {
    if (!transformedWalls.has(String(row.wallId))) {
      const wall = rows("wall").find(w => w.id === row.wallId);
      if (!wall || wall.curved) throw new Error("Select the curved host wall to transform this opening.");
      const a = new THREE.Vector2(numeric(wall, "startXmm"), numeric(wall, "startYmm")), b = new THREE.Vector2(numeric(wall, "endXmm"), numeric(wall, "endYmm"));
      const tangent = b.clone().sub(a).normalize(), center = a.clone().addScaledVector(tangent, numeric(row, "positionMm"));
      const transformed = point(center.x, center.y), offset = new THREE.Vector2(transformed.xMm, transformed.yMm).sub(a);
      const along = offset.dot(tangent), across = offset.x * -tangent.y + offset.y * tangent.x, half = numeric(row, "widthMm") / 2;
      if (Math.abs(across) > 1 || along < half || along > a.distanceTo(b) - half) throw new Error("The opening must stay within its host wall. Select the wall to move it elsewhere.");
      row.positionMm = along;
      if (kind === "window") row.sillHeightMm = numeric(row, "sillHeightMm") + dy;
      else if (Math.abs(dy) > 0.001) throw new Error("Doors stay at the host level; move the wall to change elevation.");
      const transformedDirection = new THREE.Vector3(tangent.x, 0, tangent.y).transformDirection(matrix);
      if (Math.abs(transformedDirection.x * -tangent.y + transformedDirection.z * tangent.x) > 1e-6) throw new Error("The opening must remain parallel to its host wall.");
      const reversed = transformedDirection.x * tangent.x + transformedDirection.z * tangent.y < 0;
      if (kind === "door") {
        if (reversed) row.hinge = row.hinge === "start" ? "end" : "start";
        if (reflected !== reversed) row.swing = -numeric(row, "swing", 1);
      }
      return { kind, row };
    }
    const host = rows("wall").find(w => w.id === row.wallId);
    if (reflected && host?.curved) {
      const sweep = THREE.MathUtils.euclideanModulo(numeric(host, "arcEndAngleDeg") - numeric(host, "arcStartAngleDeg"), 360) * Math.PI / 180;
      row.positionMm = sweep * numeric(host, "arcRadiusMm") - numeric(row, "positionMm");
      if (kind === "door") row.hinge = row.hinge === "start" ? "end" : "start";
    } else if (reflected && kind === "door") row.swing = -numeric(row, "swing", 1);
    return { kind, row };
  }
  for (const [x, y] of [["startXmm", "startYmm"], ["endXmm", "endYmm"], ["xMm", "yMm"], ["landingXmm", "landingYmm"], ["arcCenterXmm", "arcCenterYmm"]]) {
    if (typeof row[x] !== "number" || typeof row[y] !== "number") continue;
    const p = point(row[x] as number, row[y] as number); row[x] = p.xMm; row[y] = p.yMm;
  }
  if (kind === "slab") {
    const original = entry.row;
    const boundary = (original.boundary as BoundaryPoint[] | undefined) ?? [
      { xMm: numeric(original, "minXmm"), yMm: numeric(original, "minYmm") }, { xMm: numeric(original, "maxXmm"), yMm: numeric(original, "minYmm") },
      { xMm: numeric(original, "maxXmm"), yMm: numeric(original, "maxYmm") }, { xMm: numeric(original, "minXmm"), yMm: numeric(original, "maxYmm") },
    ];
    const transformed = boundary.map(p => point(p.xMm, p.yMm));
    const holes = ((original.holes as BoundaryPoint[][] | undefined) ?? []).map(loop => loop.map(p => point(p.xMm, p.yMm)));
    const invalid = validateBoundary([transformed, ...holes]); if (invalid) throw new Error(invalid);
    Object.assign(row, { boundary: transformed, holes, minXmm: Math.min(...transformed.map(p => p.xMm)), maxXmm: Math.max(...transformed.map(p => p.xMm)), minYmm: Math.min(...transformed.map(p => p.yMm)), maxYmm: Math.max(...transformed.map(p => p.yMm)), autoBoundaryFromWalls: false });
  }
  const direction = (degrees: number) => {
    const radians = degrees * Math.PI / 180, p = new THREE.Vector3(Math.cos(radians), 0, Math.sin(radians)).transformDirection(matrix);
    return Math.atan2(p.z, p.x) * 180 / Math.PI;
  };
  if ("rotationDeg" in row || kind === "column") row.rotationDeg = direction(numeric(row, "rotationDeg"));
  if (kind === "equipment") delete row.kitchenWallId;
  if (kind === "equipment" && reflected) row.mirrored = !row.mirrored;
  if (row.curved) {
    const start = direction(numeric(row, "arcStartAngleDeg")), end = direction(numeric(row, "arcEndAngleDeg"));
    row.arcStartAngleDeg = start; row.arcEndAngleDeg = end;
    // Wall arcs use a counterclockwise parameterization; reflection reverses it.
    if (kind === "wall" && reflected) {
      row.arcStartAngleDeg = end; row.arcEndAngleDeg = start;
      [row.startXmm, row.endXmm] = [row.endXmm, row.startXmm];
      [row.startYmm, row.endYmm] = [row.endYmm, row.startYmm];
    }
  }
  if (Math.abs(dy) > 0.001) {
    if (["slab", "beam", "line"].includes(kind)) row.elevationOffsetMm = numeric(row, "elevationOffsetMm") + dy;
    else if (["equipment", "duct", "pipe", "cabletray", "wire"].includes(kind)) row.elevationMm = numeric(row, "elevationMm", numeric(row, "elevationOffsetMm")) + dy;
    else if (["wall", "column"].includes(kind)) row.baseOffsetMm = numeric(row, "baseOffsetMm") + dy;
    else if (["stair", "ramp"].includes(kind)) { row.baseOffsetMm = numeric(row, "baseOffsetMm") + dy; row.topOffsetMm = numeric(row, "topOffsetMm") + dy; }
    else throw new Error("This level-bound element supports plan movement only. Change its level to move it vertically.");
  }
  // A moved standalone MEP run must not keep stale external connection claims.
  if (["duct", "pipe", "equipment"].includes(kind)) for (const key of ["startConnectorId", "endConnectorId", "connectedStartEquipmentId", "connectedEndEquipmentId", "connectedHostId"]) delete row[key];
  return { kind, row };
}
export async function transformElements(refs: SelectedElementRef[], matrix: THREE.Matrix4, copy = false): Promise<SelectedElementRef[]> {
  const state = useLayoutDrawingStore.getState();
  const expanded = expandedSelection(refs);
  if (!expanded.length) throw new Error("Select elements first.");
  if (expanded.some(ref => state.lockedElementKeys.includes(selectionKey(ref)))) throw new Error("The selection contains a locked element.");
  if (expanded.some(ref => isMepSelectionLocked(state, ref))) throw new Error("Architecture is locked in the current MEP view.");
  const activeGroup = state.groups.find(group => group.id === state.activeGroupId);
  if (activeGroup && expanded.some(ref => !activeGroup.elementRefs.some(member => selectionKey(member) === selectionKey(ref)))) throw new Error("Finish group editing before modifying elements outside this group.");
  const source = entriesFor(expanded), wallIds = new Set(source.filter(e => e.kind === "wall").map(e => e.row.id));
  if (source.some(entry => state.lockedElementKeys.includes(`${entry.kind}:${entry.row.id}`))) throw new Error("A hosted member of this selection is locked.");
  const result = source.map(entry => transformRow(entry, matrix, wallIds));
  const ids = new Map<string, string>();
  if (copy) {
    for (const entry of result) { const id = newLayoutId(entry.kind); ids.set(entry.row.id, id); entry.row.id = id; entry.row.createdAt = Date.now(); }
    for (const { row } of result) if (typeof row.wallId === "string") row.wallId = ids.get(row.wallId) ?? row.wallId;
  }
  pushWerkzeugHistory();
  await persist(result);
  publish(result, copy);
  const nextRefs = result.map(e => ({ kind: e.kind, id: e.row.id }));
  if (copy) {
    const groups: LayoutGroup[] = [];
    for (const group of state.groups) if (!group.isTemplate && group.elementRefs.length && group.elementRefs.every(ref => ids.has(ref.id))) {
      groups.push({ ...group, id: newLayoutId("group"), elementRefs: group.elementRefs.map(ref => ({ ...ref, id: ids.get(ref.id)! })), createdAt: Date.now() });
    }
    await Promise.all(groups.map(db.idbPutGroup));
    if (groups.length) useLayoutDrawingStore.setState(s => ({ groups: [...s.groups, ...groups] }));
  }
  useLayoutDrawingStore.getState().selectMultiple(nextRefs);
  useToolMarkupStore.getState().selectPlacement(nextRefs.find(ref => ref.kind === "placement")?.id ?? null);
  return nextRefs;
}
export function mirrorMatrix(a: THREE.Vector3, b: THREE.Vector3) {
  const direction = b.clone().sub(a); direction.y = 0;
  if (direction.length() < 0.001) throw new Error("Pick two distinct mirror-axis points.");
  const n = new THREE.Vector3(-direction.z, 0, direction.x).normalize(), d = n.dot(a);
  return new THREE.Matrix4().set(1 - 2 * n.x * n.x, 0, -2 * n.x * n.z, 2 * d * n.x, 0, 1, 0, 0, -2 * n.z * n.x, 0, 1 - 2 * n.z * n.z, 2 * d * n.z, 0, 0, 0, 1);
}
export async function splitElement(ref: SelectedElementRef, point: THREE.Vector3) {
  const state = useLayoutDrawingStore.getState();
  if (ref.kind !== "wall" && ref.kind !== "line") throw new Error("Split supports walls and sketch lines. Mesh face subdivision is a separate operation.");
  if (state.lockedElementKeys.includes(selectionKey(ref))) throw new Error("This element is locked.");
  if (state.mepModeActive && state.mepArchitectureLocked && ref.kind === "wall") throw new Error("Architecture is locked in the current MEP view.");
  const activeGroup = state.groups.find(group => group.id === state.activeGroupId);
  if (activeGroup && !activeGroup.elementRefs.some(member => selectionKey(member) === selectionKey(ref))) throw new Error("Select a member of the group being edited.");
  const original = rows(ref.kind).find(row => row.id === ref.id); if (!original) return;
  const a = new THREE.Vector2(numeric(original, "startXmm"), numeric(original, "startYmm")), b = new THREE.Vector2(numeric(original, "endXmm"), numeric(original, "endYmm"));
  const direction = b.clone().sub(a);
  let length = direction.length(), distance = new THREE.Vector2(point.x * 1000, point.z * 1000).sub(a).dot(direction) / length;
  let p = a.clone().addScaledVector(direction, distance / length), splitAngle: number | null = null;
  if (original.curved) {
    const start = numeric(original, "arcStartAngleDeg") * Math.PI / 180, end = numeric(original, "arcEndAngleDeg") * Math.PI / 180;
    let sweep = end - start;
    if (ref.kind === "wall") sweep = THREE.MathUtils.euclideanModulo(sweep, Math.PI * 2);
    else { while (sweep > Math.PI) sweep -= Math.PI * 2; while (sweep < -Math.PI) sweep += Math.PI * 2; }
    const cx = numeric(original, "arcCenterXmm"), cy = numeric(original, "arcCenterYmm"), radius = numeric(original, "arcRadiusMm");
    const angle = Math.atan2(point.z * 1000 - cy, point.x * 1000 - cx);
    const delta = THREE.MathUtils.euclideanModulo((angle - start) * Math.sign(sweep), Math.PI * 2);
    length = Math.abs(sweep) * radius; distance = delta * radius;
    splitAngle = (start + delta * Math.sign(sweep)) * 180 / Math.PI;
    p = new THREE.Vector2(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  }
  if (distance < 1 || distance > length - 1) throw new Error("Split inside the element, away from its endpoints.");
  const first = { ...original, endXmm: p.x, endYmm: p.y, ...(splitAngle != null ? { arcEndAngleDeg: splitAngle } : {}) }, second = { ...original, id: newLayoutId(ref.kind), startXmm: p.x, startYmm: p.y, ...(splitAngle != null ? { arcStartAngleDeg: splitAngle } : {}), createdAt: Date.now() };
  const inserts: Entry[] = [];
  if (ref.kind === "wall") for (const kind of ["door", "window"] as const) for (const row of rows(kind).filter(row => row.wallId === original.id)) {
    const center = numeric(row, "positionMm"), half = numeric(row, "widthMm") / 2;
    if (distance > center - half && distance < center + half) throw new Error("The split crosses an opening. Pick a point clear of doors and windows.");
    if (center > distance) inserts.push({ kind, row: { ...row, wallId: second.id, positionMm: center - distance } });
  }
  const groups = state.groups.map(group => group.elementRefs.some(member => selectionKey(member) === selectionKey(ref)) ? { ...group, elementRefs: [...group.elementRefs, { kind: ref.kind, id: second.id }] } : group);
  pushWerkzeugHistory();
  await persist([{ kind: ref.kind, row: first }, { kind: ref.kind, row: second }, ...inserts]);
  await Promise.all(groups.filter((g, i) => g !== state.groups[i]).map(db.idbPutGroup));
  publish([{ kind: ref.kind, row: first }, ...inserts]); publish([{ kind: ref.kind, row: second }], true);
  useLayoutDrawingStore.setState({ groups });
  state.selectMultiple([ref, { kind: ref.kind, id: second.id }]);
  useToolMarkupStore.getState().selectPlacement(null);
}
export async function saveNamedGroup(name: string) {
  const refs = expandedSelection(currentModifySelection()).map(({ kind, id }) => ({ kind, id }));
  if (refs.length < 2 && !(refs.length === 1 && refs[0].kind === "equipment" && useLayoutDrawingStore.getState().mepEquipment.find(e => e.id === refs[0].id)?.furnitureParameters)) throw new Error("Select at least two elements, or one parametric assembly, to group.");
  const state = useLayoutDrawingStore.getState();
  if (!name.trim()) throw new Error("Enter a group name.");
  if (refs.some(ref => state.groups.some(g => g.elementRefs.some(r => selectionKey(r) === selectionKey(ref))))) throw new Error("Ungroup existing members before creating another group.");
  const definition = structuredClone(entriesFor(refs));
  if (!state.projectId) throw new Error("Open a project before saving a group.");
  const template: LayoutGroup = { id: newLayoutId("group-type"), projectId: state.projectId, name: name.trim(), elementRefs: [], definition, isTemplate: true, createdAt: Date.now() };
  const group: LayoutGroup = { ...template, id: newLayoutId("group"), definitionId: template.id, isTemplate: false, elementRefs: refs };
  pushWerkzeugHistory(); await persist(definition); await Promise.all([db.idbPutGroup(template), db.idbPutGroup(group)]);
  useLayoutDrawingStore.setState(s => ({ groups: [...s.groups, template, group] }));
  state.selectMultiple(refs);
}
export async function refreshGroupDefinition(id: string) {
  const state = useLayoutDrawingStore.getState(), group = state.groups.find(g => g.id === id); if (!group) return;
  const updated = { ...group, definition: structuredClone(entriesFor(group.elementRefs)) };
  const template = state.groups.find(g => g.id === group.definitionId);
  const updatedTemplate = template ? { ...template, definition: updated.definition } : null;
  await db.idbPutGroup(updated); if (updatedTemplate) await db.idbPutGroup(updatedTemplate);
  useLayoutDrawingStore.setState({ groups: state.groups.map(g => g.id === id ? updated : updatedTemplate && g.id === updatedTemplate.id ? updatedTemplate : g), activeGroupId: null });
}
export async function placeGroup(id: string, point: THREE.Vector3) {
  const state = useLayoutDrawingStore.getState(), group = state.groups.find(g => g.id === id);
  if (!group) return;
  const source = structuredClone(group.definition ?? entriesFor(group.elementRefs));
  const centers = source.filter(e => !["door", "window"].includes(e.kind)).map(({ row }) => new THREE.Vector3(numeric(row, "posX", numeric(row, "xMm", numeric(row, "startXmm", numeric(row, "minXmm"))) / 1000), 0, numeric(row, "posZ", numeric(row, "yMm", numeric(row, "startYmm", numeric(row, "minYmm"))) / 1000)));
  const center = centers.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, centers.length));
  const matrix = new THREE.Matrix4().makeTranslation(point.x - center.x, 0, point.z - center.z);
  const walls = new Set(source.filter(e => e.kind === "wall").map(e => e.row.id));
  const result = source.map(entry => transformRow(entry, matrix, walls)), ids = new Map<string, string>();
  for (const entry of result) { const next = newLayoutId(entry.kind); ids.set(entry.row.id, next); entry.row.id = next; }
  for (const entry of result) if (typeof entry.row.wallId === "string") entry.row.wallId = ids.get(entry.row.wallId) ?? entry.row.wallId;
  const refs = result.map(e => ({ kind: e.kind, id: e.row.id }));
  const instance: LayoutGroup = { ...group, isTemplate: false, definitionId: group.isTemplate ? group.id : group.definitionId, id: newLayoutId("group"), elementRefs: refs, createdAt: Date.now() };
  pushWerkzeugHistory(); await persist(result); await db.idbPutGroup(instance);
  publish(result, true); useLayoutDrawingStore.setState(s => ({ groups: [...s.groups, instance] })); state.selectMultiple(refs);
  useToolMarkupStore.getState().selectPlacement(refs.find(ref => ref.kind === "placement")?.id ?? null);
}
