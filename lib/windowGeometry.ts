import * as THREE from "three";
import type { LayoutWindow } from "./layoutDrawing";

/** Local X spans the opening, Y starts at the sill, Z distinguishes sash tracks. */
export function createOperableWindow(operation: NonNullable<LayoutWindow["operation"]>, width: number, height: number, frame: THREE.Material, glass: THREE.Material) {
  const group = new THREE.Group(); group.name = `window-${operation}`;
  const rail = Math.min(0.045, width / 10, height / 10);
  const box = (parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, material = frame) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); parent.add(mesh);
  };
  const sash = (x: number, y: number, z: number, w: number, h: number) => {
    const part = new THREE.Group(); part.position.set(x, y, z); group.add(part);
    box(part, 0, 0, 0, Math.max(0.01, w - 2 * rail), Math.max(0.01, h - 2 * rail), 0.012, glass);
    for (const sign of [-1, 1]) {
      box(part, sign * (w - rail) / 2, 0, 0, rail, h, 0.045);
      box(part, 0, sign * (h - rail) / 2, 0, w, rail, 0.045);
    }
    return part;
  };
  if (operation === "fixed") {
    box(group, 0, height / 2, 0, width, height, 0.016, glass);
  } else if (operation === "single-hung" || operation === "double-hung") {
    if (operation === "double-hung") sash(0, height * 0.75, -0.025, width, height / 2);
    else {
      box(group, 0, height * 0.75, -0.025, width - rail, height / 2 - rail, 0.012, glass);
      box(group, 0, height / 2, -0.025, width, rail * 0.6, 0.025);
    }
    sash(0, height * 0.25, 0.025, width, height / 2);
    box(group, 0, height * 0.45, 0.065, width * 0.18, rail * 0.5, 0.03);
    if (operation === "double-hung") box(group, 0, height * 0.55, 0.005, width * 0.18, rail * 0.5, 0.03);
    for (const side of [-1, 1]) box(group, side * (width / 2 - rail / 3), height / 2, 0, rail / 3, height, 0.1);
  } else if (operation === "sliding") {
    sash(-width * 0.245, height / 2, -0.028, width * 0.51, height);
    sash(width * 0.245, height / 2, 0.028, width * 0.51, height);
    for (const y of [rail / 2, height - rail / 2]) box(group, 0, y, 0, width, rail / 2, 0.12);
    box(group, rail, height / 2, 0.065, rail / 2, height * 0.12, 0.025);
  } else {
    const leaf = sash(0, height / 2, 0, width, height);
    // A slightly open hinged sash makes its depth/hinge operation readable in 3D.
    const pivot = new THREE.Group(); pivot.position.set(-width / 2, height / 2, 0);
    group.remove(leaf); leaf.position.set(width / 2, 0, 0); pivot.add(leaf); group.add(pivot); pivot.rotation.y = -Math.PI / 12;
    box(leaf, width / 2 - rail * 1.4, 0, 0.04, rail / 2, 0.12, 0.025);
    for (const y of [-height * 0.3, height * 0.3]) box(pivot, 0, y, 0, rail, 0.08, 0.055);
  }
  return group;
}
