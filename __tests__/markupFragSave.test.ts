import { describe, it, expect } from "vitest";
import {
  buildFragBlob,
  parseFragFile,
  buildMarkupOnlyIfc,
  extractEmbeddedProjectData,
  mergeMarkupIntoIfc,
} from "../lib/markupFragSave";
import type { LayoutWall, LayoutSlab, LayoutColumn, LayoutDuct } from "../lib/layoutDrawing";

describe("markupFragSave — Project Persistence & Roundtrip", () => {
  const dummyWall: LayoutWall = {
    id: "wall-1",
    projectId: "proj-1",
    levelId: "level-1",
    startXmm: 0,
    startYmm: 0,
    endXmm: 6000,
    endYmm: 0,
    thicknessMm: 250,
    heightMm: 3000,
    createdAt: Date.now(),
  };

  const dummySlab: LayoutSlab = {
    id: "slab-1",
    projectId: "proj-1",
    levelId: "level-1",
    kind: "floor",
    minXmm: 0,
    minYmm: 0,
    maxXmm: 6000,
    maxYmm: 4000,
    thicknessMm: 200,
    elevationOffsetMm: 0,
    boundary: [
      { xMm: 0, yMm: 0 },
      { xMm: 6000, yMm: 0 },
      { xMm: 6000, yMm: 4000 },
      { xMm: 0, yMm: 4000 },
    ],
    createdAt: Date.now(),
  };

  const dummyColumn: LayoutColumn = {
    id: "col-1",
    projectId: "proj-1",
    levelId: "level-1",
    xMm: 3000,
    yMm: 2000,
    profile: "rect",
    widthMm: 400,
    depthMm: 400,
    heightMm: 3000,
    createdAt: Date.now(),
  };

  const dummyDuct: LayoutDuct = {
    id: "duct-1",
    projectId: "proj-1",
    levelId: "level-1",
    startXmm: 0,
    startYmm: 2000,
    endXmm: 6000,
    endYmm: 2000,
    shape: "rectangular",
    widthMm: 300,
    heightMm: 200,
    systemType: "supply",
    elevationMm: 2600,
    createdAt: Date.now(),
  };

  it("packs and unpacks .frag payload including all layout elements", async () => {
    const blob = buildFragBlob({
      modelKey: "test-model",
      modelLabel: "Test Model",
      placements: [
        {
          id: "place-1",
          modelKey: "test-model",
          type: "cube",
          posX: 1,
          posY: 0,
          posZ: 2,
          rotX: 0,
          rotY: 0,
          rotZ: 0,
          sizeX: 1,
          sizeY: 1,
          sizeZ: 1,
          color: "#ff0000",
          label: "Test Cube",
          floorId: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      notes: [
        {
          id: "note-1",
          modelKey: "test-model",
          text: "Check clearance",
          posX: 0,
          posY: 1,
          posZ: 0,
          author: "Tester",
          expressId: null,
          placementId: null,
          wallId: null,
          doorId: null,
          windowId: null,
          underlayId: null,
          elementName: null,
          floorId: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      layout: {
        walls: [dummyWall],
        slabs: [dummySlab],
        columns: [dummyColumn],
        ducts: [dummyDuct],
      },
    });

    expect(blob.size).toBeGreaterThan(64);

    const { meta, ifcBytes } = await parseFragFile(blob);
    expect(meta.modelKey).toBe("test-model");
    expect(meta.placements?.length).toBe(1);
    expect(meta.notes?.length).toBe(1);
    expect(meta.layout?.walls?.length).toBe(1);
    expect(meta.layout?.walls?.[0].id).toBe("wall-1");
    expect(meta.layout?.slabs?.length).toBe(1);
    expect(meta.layout?.columns?.length).toBe(1);
    expect(meta.layout?.ducts?.length).toBe(1);
    expect(ifcBytes).toBeNull();
  });

  it("generates ISO-10303-21 IFC file with swept solids and embedded project comment", async () => {
    const ifcBlob = buildMarkupOnlyIfc({
      modelLabel: "OfficeBuilding",
      placements: [],
      notes: [],
      layout: {
        walls: [dummyWall],
        slabs: [dummySlab],
        columns: [dummyColumn],
        ducts: [dummyDuct],
      },
    });

    const text = await ifcBlob.text();
    expect(text).toContain("ISO-10303-21;");
    expect(text).toContain("IFCWALLSTANDARDCASE");
    expect(text).toContain("IFCSLAB");
    expect(text).toContain("IFCCOLUMN");
    expect(text).toContain("IFCDUCTSEGMENT");
    expect(text).toContain("/* IBVIEWER_PROJECT_DATA:");
    expect(text).toContain("END-ISO-10303-21;");

    const extracted = extractEmbeddedProjectData(text);
    expect(extracted).not.toBeNull();
    expect(extracted?.layout?.walls?.length).toBe(1);
    expect(extracted?.layout?.walls?.[0].startXmm).toBe(0);
    expect(extracted?.layout?.slabs?.length).toBe(1);
    expect(extracted?.layout?.columns?.length).toBe(1);
    expect(extracted?.layout?.ducts?.length).toBe(1);
  });

  it("merges markup into existing IFC and embeds project data before ENDSEC", async () => {
    const baseIfc = "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\n#1=IFCPROJECT('guid',$,'P',$,$,$,$,$,$);\nENDSEC;\nEND-ISO-10303-21;";
    const enc = new TextEncoder();
    const mergedBlob = mergeMarkupIntoIfc({
      baseIfc: enc.encode(baseIfc),
      placements: [],
      notes: [],
      layout: {
        walls: [dummyWall],
      },
    });

    const mergedText = await mergedBlob.text();
    expect(mergedText).toContain("IFCWALLSTANDARDCASE");
    expect(mergedText).toContain("/* IBVIEWER_PROJECT_DATA:");
    expect(mergedText.endsWith("ENDSEC;\nEND-ISO-10303-21;")).toBe(true);

    const extracted = extractEmbeddedProjectData(mergedText);
    expect(extracted).not.toBeNull();
    expect(extracted?.layout?.walls?.length).toBe(1);
  });
});
