import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { applyRenderPresentation, applyViewVisibility, isObjectVisibleInView } from "./viewVisibility";
import { EMPTY_VIEW_VISIBILITY, useViewDisplayStore, viewDisplayKey } from "../store/useViewDisplayStore";
import { applyFeatureWireframe } from "./featureWireframe";

describe("view display isolation", () => {
  it("hides a whole component including its children, then restores it", () => {
    const root = new Group(), wall = new Group(), face = new Mesh();
    wall.userData.layoutWallId = "wall-1";
    wall.add(face); root.add(wall);
    const visibility = { ...EMPTY_VIEW_VISIBILITY, hiddenCategories: ["Walls"] };
    const restore = applyViewVisibility([root], visibility);
    expect(wall.visible).toBe(false);
    expect(isObjectVisibleInView(face, visibility)).toBe(false);
    restore();
    expect(wall.visible).toBe(true);
    expect(isObjectVisibleInView(face, undefined)).toBe(true);
  });

  it("does not make previously hidden objects visible on restore", () => {
    const wall = new Group(); wall.userData.layoutWallId = "wall-1"; wall.visible = false;
    applyViewVisibility([wall], { ...EMPTY_VIEW_VISIBILITY, hiddenIds: ["wall-1"] })();
    expect(wall.visible).toBe(false);
  });

  it("applies isolated element filters to picking as well as rendering", () => {
    const root = new Group(), pipe = new Mesh(), wall = new Mesh();
    pipe.userData.layoutPipeId = "pipe-1"; wall.userData.layoutWallId = "wall-1";
    root.add(pipe, wall);
    const visibility = { ...EMPTY_VIEW_VISIBILITY, isolatedIds: ["pipe-1"] };
    expect(isObjectVisibleInView(pipe, visibility)).toBe(true);
    expect(isObjectVisibleInView(wall, visibility)).toBe(false);
    const restore = applyViewVisibility([root], visibility);
    expect(pipe.visible).toBe(true); expect(wall.visible).toBe(false);
    restore(); expect(wall.visible).toBe(true);
  });

  it("keeps floor and 3D filters independent and resettable", () => {
    useViewDisplayStore.setState({ views: {} });
    const plan = viewDisplayKey("top", "level-1"), model = viewDisplayKey("free", "level-1");
    useViewDisplayStore.getState().hide(model, ["wall-1"]);
    useViewDisplayStore.getState().toggleCategory(plan, "Pipes");
    expect(useViewDisplayStore.getState().views[model].hiddenCategories).toEqual([]);
    expect(useViewDisplayStore.getState().views[plan].hiddenIds).toEqual([]);
    useViewDisplayStore.getState().reset(model);
    expect(useViewDisplayStore.getState().views[plan].hiddenCategories).toEqual(["Pipes"]);
    expect(viewDisplayKey("top", "level-2")).not.toBe(plan);
  });

  it("restores drafting helpers after a render capture", () => {
    const root = new Group(), grid = new Group(), wall = new Mesh();
    grid.name = "3d-grid"; wall.userData.layoutWallId = "wall-1"; root.add(grid, wall);
    const restore = applyRenderPresentation([root], true);
    expect(grid.visible).toBe(false); expect(wall.visible).toBe(true);
    restore(); expect(grid.visible).toBe(true);
  });

  it("hides roofs independently of floors during rendering and restores them afterward", () => {
    const root = new Group(), roof = new Mesh(), floor = new Mesh();
    roof.userData.layoutSlabId = "roof"; roof.userData.renderCategory = "Roofs";
    floor.userData.layoutSlabId = "floor"; floor.userData.renderCategory = "Floors";
    root.add(roof, floor);
    const restore = applyRenderPresentation([root], true, ["Roofs"]);
    expect(roof.visible).toBe(false); expect(floor.visible).toBe(true);
    restore(); expect(roof.visible).toBe(true);
    useViewDisplayStore.setState({ renderPreview: true, renderHiddenCategories: ["Roofs"] });
    expect(isObjectVisibleInView(roof, undefined)).toBe(false);
    expect(isObjectVisibleInView(floor, undefined)).toBe(true);
    useViewDisplayStore.setState({ renderPreview: false, renderHiddenCategories: [] });
  });

  it("preserves glass opacity across repeated wireframe transitions", () => {
    const material = new MeshStandardMaterial({ transparent: true, opacity: 0.38 });
    const mesh = new Mesh(new BoxGeometry(), material);
    for (let i = 0; i < 3; i++) {
      const restore = applyFeatureWireframe([mesh], true);
      expect(material.visible).toBe(false);
      restore();
      expect(material.visible).toBe(true);
      expect(material.opacity).toBe(0.38);
      expect(material.transparent).toBe(true);
      expect(mesh.children.every(child => !child.visible)).toBe(true);
    }
  });
});
