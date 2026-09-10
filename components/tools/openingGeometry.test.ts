import { describe, expect, it } from "vitest";
import * as THREE from "three";
import LayoutSceneLayer from "./LayoutSceneLayer";
import type { LayoutDoor, LayoutWall, LayoutWindow, WallCenterlineMm } from "@/lib/layoutDrawing";

const wall: LayoutWall = { id: "wall", projectId: "p", levelId: "l", startXmm: 0, startYmm: 0, endXmm: 4000, endYmm: 0, thicknessMm: 300, heightMm: 3000, createdAt: 0 };
const door: LayoutDoor = { id: "door", projectId: "p", wallId: "wall", positionMm: 2000, widthMm: 900, heightMm: 2100, hinge: "start", swing: 1, style: "wood", createdAt: 0 };
type GeometryHarness = {
  currentRenderMode: string;
  placeOpening(group: THREE.Group, wall: LayoutWall, position: number, width: number, height: number, elevation: number, sill: number, door?: LayoutDoor, window?: LayoutWindow): void;
  buildWallLayerGeometry(wall: LayoutWall, centerline: WallCenterlineMm, doors: LayoutDoor[], windows: LayoutWindow[], miter: undefined, offset: number, thickness: number, total: number): THREE.BufferGeometry;
};
const harness = () => Object.assign(Object.create(LayoutSceneLayer.prototype), { currentRenderMode: "light" }) as GeometryHarness;

describe("opening visibility", () => {
  it("shows metal window frames and glass from both wall faces", () => {
    const group = new THREE.Group();
    const window: LayoutWindow = { id: "window", projectId: "p", wallId: "wall", positionMm: 2000, widthMm: 1200, heightMm: 1400, sillHeightMm: 900, operation: "fixed", createdAt: 0 };
    harness().placeOpening(group, wall, 2000, 1200, 1400, 0, 900, undefined, window);
    group.updateMatrixWorld(true);
    const frame = group.getObjectByName("opening-frame") as THREE.Mesh;
    expect((frame.material as THREE.MeshPhysicalMaterial).metalness).toBeGreaterThan(0.5);
    for (const side of [-1, 1]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(2, 1.5, side), new THREE.Vector3(0, 0, -side));
      const hit = ray.intersectObject(group, true)[0]?.object as THREE.Mesh;
      expect((hit.material as THREE.MeshPhysicalMaterial).transmission).toBeGreaterThan(0.5);
    }
  });
  it("places a wood leaf at the wall face and exposes it from both sides", () => {
    const group = new THREE.Group();
    harness().placeOpening(group, wall, 2000, 900, 2100, 0, 0, door);
    group.updateMatrixWorld(true);
    const leaf = group.getObjectByName("opening-panel") as THREE.Mesh;
    const bounds = new THREE.Box3().setFromObject(leaf);
    expect(bounds.max.z).toBeCloseTo(0.15, 5);
    expect((leaf.material as THREE.MeshStandardMaterial).map).toBeTruthy();
    for (const side of [-1, 1]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(2, 1.5, side), new THREE.Vector3(0, 0, -side));
      expect(ray.intersectObject(group, true)[0]?.object.name).toBe("opening-panel");
    }
    const casings = group.getObjectByName("opening-box")!.children.filter((child) => child.name === "opening-casing");
    expect(casings).toHaveLength(2);
    expect(casings.every((child) => Math.abs(child.position.z) > 0.15)).toBe(true);
  });

  it("keeps the wall opening aligned when the joined start extends", () => {
    const centerline = { startXmm: -200, startYmm: 0, endXmm: 4000, endYmm: 0 };
    const geometry = harness().buildWallLayerGeometry(wall, centerline, [door], [], undefined, 0, 0.3, 0.3);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.position.set(1.9, 1.5, 0);
    mesh.updateMatrixWorld(true);
    for (const side of [-1, 1]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(2.4, 1, side), new THREE.Vector3(0, 0, -side));
      expect(ray.intersectObject(mesh)).toHaveLength(0);
    }
  });
});
