import * as THREE from "three";
import { endpointPoint, mepMismatch, mepOffset, mepRows, type MepKind, type MepNetwork, type MepSegment } from "@/lib/mepConnections";

const ownerTags = { duct: "layoutDuctId", pipe: "layoutPipeId", cabletray: "layoutCableTrayId", wire: "layoutWireId" };
const diameter = (row: MepSegment) => "diameterMm" in row ? row.diameterMm ?? 200 : "widthMm" in row ? row.widthMm : 8;

/** Derived fittings do not replace the endpoint graph. Trimming affects only the
 * rendered copies, so authoring endpoints and connection references stay exact. */
export function buildMepJointGeometry(state: MepNetwork, visible: (row: MepSegment) => boolean) {
  const group = new THREE.Group(); group.name = "mep-joints";
  const network: MepNetwork = { ...state, ducts: state.ducts.map(r => ({ ...r })), pipes: state.pipes.map(r => ({ ...r })), cableTrays: state.cableTrays.map(r => ({ ...r })), wires: state.wires.map(r => ({ ...r })) };
  const seen = new Set<string>();
  for (const kind of ["duct", "pipe", "cabletray", "wire"] as MepKind[]) {
    const originals = mepRows(kind, state), rendered = mepRows(kind, network);
    for (const source of originals) for (const endpoint of ["start", "end"] as const) {
      const link = source[endpoint === "start" ? "startConnection" : "endConnection"];
      if (!link || !visible(source)) continue;
      const target = mepRows(link.kind, state).find(r => r.id === link.id);
      const key = [`${source.id}:${endpoint}`, `${link.id}:${link.endpoint}`].sort().join("|");
      if (seen.has(key)) continue; seen.add(key);
      const p = endpointPoint(source, endpoint);
      const height = ((state.levels.find(l => l.id === source.levelId)?.elevationMm ?? 0) + mepOffset(source)) / 1000;
      const joint = new THREE.Vector3(p.xMm / 1000, height, p.yMm / 1000);
      const owner = new THREE.Group(); owner.userData[ownerTags[kind]] = source.id; owner.userData.isMepJoint = true; group.add(owner);
      const targetPoint = target && endpointPoint(target, link.endpoint);
      const disconnected = !target || !targetPoint || target.levelId !== source.levelId || Math.hypot(p.xMm - targetPoint.xMm, p.yMm - targetPoint.yMm, mepOffset(source) - mepOffset(target)) > 1;
      const warning = disconnected ? "Connection moved or target missing" : mepMismatch(source, target!);
      if (warning) {
        const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#facc15"; context.beginPath(); context.moveTo(32, 3); context.lineTo(61, 59); context.lineTo(3, 59); context.closePath(); context.fill();
        context.fillStyle = "#111827"; context.font = "bold 42px sans-serif"; context.textAlign = "center"; context.fillText("!", 32, 51);
        const material = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, depthWrite: false });
        const icon = new THREE.Sprite(material); icon.position.copy(joint).add(new THREE.Vector3(0, 0.15, 0)); icon.scale.setScalar(0.22); icon.userData.connectionWarning = warning; owner.add(icon);
        continue;
      }
      if (!target || !visible(target) || kind !== link.kind) continue;
      const otherA = endpointPoint(source, endpoint === "start" ? "end" : "start"), otherB = endpointPoint(target, link.endpoint === "start" ? "end" : "start");
      const a = new THREE.Vector3(otherA.xMm / 1000, height, otherA.yMm / 1000).sub(joint), b = new THREE.Vector3(otherB.xMm / 1000, height, otherB.yMm / 1000).sub(joint);
      const lengthA = a.length(), lengthB = b.length(); a.normalize(); b.normalize();
      const angle = a.angleTo(b);
      if (angle < 0.05 || Math.abs(Math.PI - angle) < 0.02) continue;
      const reach = Math.min(lengthA * 0.25, lengthB * 0.25, Math.max(0.08, (diameter(source) ?? 50) / 1000));
      if (reach < 0.01) continue;
      const start = joint.clone().addScaledVector(a, reach), end = joint.clone().addScaledVector(b, reach);
      const curve = new THREE.QuadraticBezierCurve3(start, joint, end);
      const rectangular = ("shape" in source && source.shape !== "round") || ("trayType" in source && source.trayType !== "conduit");
      let geometry: THREE.BufferGeometry;
      if (rectangular) {
        const width = ("widthMm" in source ? source.widthMm ?? 300 : 300) / 1000;
        const h = ("heightMm" in source ? source.heightMm ?? 200 : 200) / 1000;
        const positions: number[] = [], indices: number[] = [];
        for (let i = 0; i <= 16; i++) {
          const point = curve.getPoint(i / 16), tangent = curve.getTangent(i / 16), normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
          for (const [side, up] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
            const p = point.clone().addScaledVector(normal, side * width / 2); p.y += up * h / 2; positions.push(p.x, p.y, p.z);
          }
          if (i) for (let k = 0; k < 4; k++) { const a = (i - 1) * 4 + k, b = (i - 1) * 4 + (k + 1) % 4; indices.push(a, b, a + 4, b, b + 4, a + 4); }
        }
        geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
      } else geometry = new THREE.TubeGeometry(curve, 16, Math.max(0.004, (diameter(source) ?? 50) / 2000), 16, false);
      const fitting = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: source.color ?? (kind === "pipe" ? "#0ea5e9" : kind === "duct" ? "#38bdf8" : "#f59e0b"), roughness: 0.4, metalness: 0.25, side: THREE.DoubleSide }));
      fitting.name = "generated-elbow"; owner.add(fitting);
      for (const [row, endName, point] of [[rendered.find(r => r.id === source.id), endpoint, start], [rendered.find(r => r.id === target.id), link.endpoint, end]] as const) if (row) {
        if (endName === "start") { row.startXmm = point.x * 1000; row.startYmm = point.z * 1000; }
        else { row.endXmm = point.x * 1000; row.endYmm = point.z * 1000; }
      }
    }
  }
  return { group, network, dispose: () => { group.removeFromParent(); group.traverse(obj => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) obj.geometry.dispose();
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Sprite) for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) { if (material instanceof THREE.SpriteMaterial) material.map?.dispose(); material.dispose(); }
  }); } };
}
