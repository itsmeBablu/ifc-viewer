import * as THREE from "three";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { equipmentRoutePorts, equipmentRouteDefaults } from "@/lib/mepConnectorRouting";
import { mepEndpoints, mepRows, type MepSnapPoint, type MepKind } from "@/lib/mepConnections";

export type RouteHandle = { kind: MepKind; point: MepSnapPoint; levelId: string; label: string; defaults: Partial<ReturnType<typeof useLayoutDrawingStore.getState>>; objectId: string; connected?: boolean };

/** Screen-facing touch targets work with perspective, plan and all four viewports. */
export function installMepRouteHandles(options: {
  canvas: HTMLCanvasElement; camera: (x: number, y: number) => THREE.Camera | null;
  roots: () => THREE.Object3D[]; activate: (handle: RouteHandle) => void;
}) {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:37";
  host.setAttribute("aria-label", "MEP connectors: select a port to route from it");
  document.body.append(host);
  let frame = 0, signature = "";
  const buttons: { button: HTMLButtonElement; leader: HTMLDivElement; handle: RouteHandle; viewport: number }[] = [];
  function tick() {
    const s = useLayoutDrawingStore.getState(), markup = useToolMarkupStore.getState();
    const selectedEquipmentIds = new Set([
      ...s.selectedElements.filter(e => e.kind === "equipment").map(e => e.id),
      ...(s.selectedEquipmentId ? [s.selectedEquipmentId] : []),
    ]);
    const equipment = s.mepEquipment.filter(e => e.category !== "furniture" && selectedEquipmentIds.has(e.id));
    const handles: RouteHandle[] = !s.slabBoundaryEdit ? equipment.flatMap(e => equipmentRoutePorts(e, s, true).map(p => ({
      kind: p.kind, point: p.point, levelId: p.levelId, label: `${e.name ?? e.category}: ${p.label}`, defaults: equipmentRouteDefaults(p), objectId: e.id, connected: p.connected,
    }))) : [];
    if (!s.slabBoundaryEdit) for (const [kind, id] of [["duct", s.selectedDuctId], ["pipe", s.selectedPipeId], ["cabletray", s.selectedCableTrayId], ["wire", s.selectedWireId]] as const) {
      const row = mepRows(kind, s).find(r => r.id === id);
      if (!row) continue;
      const defaults: RouteHandle["defaults"] = "shape" in row ? { draftDuctShape: row.shape, draftDuctSystem: row.systemType, draftDuctWidthMm: row.widthMm ?? 300, draftDuctHeightMm: row.heightMm ?? 200, draftDuctDiameterMm: row.diameterMm ?? 200 }
        : "diameterMm" in row ? { draftPipeDiameterMm: row.diameterMm, draftPipeSystem: row.systemType }
        : "trayType" in row ? { draftCableTrayWidthMm: row.widthMm, draftCableTrayHeightMm: row.heightMm, draftCableTrayType: row.trayType }
        : { draftWireGauge: row.wireGauge ?? s.draftWireGauge, draftWireVoltage: row.voltage ?? 230, draftWireSystem: row.systemType ?? "power" };
      for (const point of mepEndpoints(kind, s, row.levelId).filter(p => p.mepEndpoint?.id === id)) handles.push({
        kind, point, levelId: row.levelId, label: `Continue ${kind} ${point.mepEndpoint!.endpoint}`, defaults, objectId: row.id,
      });
    }
    const next = JSON.stringify([s.projectId, markup.quadView, handles]);
    if (signature !== next) {
      signature = next; host.replaceChildren(); buttons.length = 0;
      for (const handle of handles) for (let viewport = 0; viewport < (markup.quadView ? 4 : 1); viewport++) {
        const button = document.createElement("button");
        button.type = "button"; button.title = `${handle.label} — click to route ${handle.kind}`;
        button.setAttribute("aria-label", button.title); button.dataset.mepRouteHandle = handle.kind;
        button.dataset.equipmentId = handle.objectId;
        button.dataset.connectorId = handle.point.equipmentConnector?.connectorId ?? "";
        button.disabled = Boolean(handle.connected);
        if (handle.connected) { button.title = `${handle.label} — connected`; button.setAttribute("aria-label", button.title); }
        const color = handle.kind === "duct" ? "#38bdf8" : handle.kind === "pipe" ? "#34d399" : "#facc15";
        button.style.cssText = `position:absolute;width:28px;height:28px;padding:0;transform:translate(-50%,-50%);border:2px solid ${color};border-radius:50%;background:#0f172add;color:${color};box-shadow:0 0 0 3px #0f172a66;cursor:crosshair;pointer-events:auto;touch-action:none;font:20px/1 sans-serif`;
        button.textContent = handle.connected ? "✓" : "+";
        const leader = document.createElement("div");
        leader.style.cssText = `position:absolute;width:1px;background:${color};pointer-events:none;opacity:.7`;
        button.addEventListener("pointerdown", e => e.stopPropagation());
        button.addEventListener("dblclick", e => { e.preventDefault(); e.stopPropagation(); });
        button.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); options.activate(handle); });
        host.append(leader, button); buttons.push({ button, leader, handle, viewport });
      }
    }
    const bounds = options.canvas.getBoundingClientRect();
    const visibleIds = new Set<string>();
    const visit = (object: THREE.Object3D) => {
      if (!object.visible) return;
      let identified = false;
      for (const key of ["layoutEquipmentId", "layoutDuctId", "layoutPipeId", "layoutCableTrayId", "layoutWireId"]) if (object.userData[key]) { visibleIds.add(object.userData[key]); identified = true; }
      if (identified) return;
      object.children.forEach(visit);
    };
    if (buttons.length) options.roots().filter(root => root.name === "layout-drawing-layer").forEach(visit);
    const placed: { x: number; y: number; viewport: number }[] = [];
    for (const { button, leader, handle, viewport } of buttons) {
      const rect = markup.quadView ? { left: bounds.left + viewport % 2 * bounds.width / 2, top: bounds.top + Math.floor(viewport / 2) * bounds.height / 2, width: bounds.width / 2, height: bounds.height / 2 } : bounds;
      const camera = options.camera(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const level = s.levels.find(l => l.id === handle.levelId);
      if (!camera || !level || !visibleIds.has(handle.objectId)) { button.hidden = true; leader.hidden = true; continue; }
      const p = new THREE.Vector3(handle.point.xMm / 1000, (level.elevationMm + (handle.point.elevationMm ?? 0)) / 1000, handle.point.yMm / 1000).project(camera);
      const x = rect.left + (p.x + 1) * rect.width / 2, y = rect.top + (1 - p.y) * rect.height / 2;
      button.hidden = !Number.isFinite(x + y) || p.z < -1 || p.z > 1 || x < rect.left + 14 || x > rect.left + rect.width - 14 || y < rect.top + 14 || y > rect.top + rect.height - 14;
      let handleY = y;
      while (placed.some(p => p.viewport === viewport && Math.hypot(p.x - x, p.y - handleY) < 32) && handleY < rect.top + rect.height - 46) handleY += 32;
      if (!button.hidden) placed.push({ x, y: handleY, viewport });
      button.style.left = `${x}px`; button.style.top = `${handleY}px`;
      leader.hidden = button.hidden || handleY === y;
      leader.style.left = `${x}px`; leader.style.top = `${y}px`; leader.style.height = `${handleY - y}px`;
    }
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(frame); host.remove(); };
}
