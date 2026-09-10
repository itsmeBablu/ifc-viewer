import type { MarkupNote, MarkupPlacement } from "./toolMarkup";
import { useLayoutDrawingStore } from "../store/useLayoutDrawingStore";
import { useToolMarkupStore } from "../store/useToolMarkupStore";

const MAGIC = "IBVF";
const VERSION = 1;

export type FragSavePayload = {
  format: "ibviewer-frag/1";
  savedAt: string;
  modelKey: string;
  modelLabel: string | null;
  placements: MarkupPlacement[];
  notes: MarkupNote[];
  layout?: {
    projectId?: string | null;
    levels?: import("./layoutDrawing").LayoutLevel[];
    walls?: import("./layoutDrawing").LayoutWall[];
    doors?: import("./layoutDrawing").LayoutDoor[];
    windows?: import("./layoutDrawing").LayoutWindow[];
    slabs?: import("./layoutDrawing").LayoutSlab[];
    columns?: import("./layoutDrawing").LayoutColumn[];
    beams?: import("./layoutDrawing").LayoutBeam[];
    stairs?: import("./layoutDrawing").LayoutStair[];
    ramps?: import("./layoutDrawing").LayoutRamp[];
    ducts?: import("./layoutDrawing").LayoutDuct[];
    pipes?: import("./layoutDrawing").LayoutPipe[];
    cableTrays?: import("./layoutDrawing").LayoutCableTray[];
    mepEquipment?: import("./layoutDrawing").LayoutMepEquipment[];
    wires?: import("./layoutDrawing").LayoutWire[];
    gridLines?: import("./layoutDrawing").LayoutGridLine[];
    groups?: import("./layoutDrawing").LayoutGroup[];
    wallTypes?: import("./layoutDrawing").WallType[];
    layoutRooms?: import("./layoutDrawing").LayoutRoom[];
    sketchLines?: import("./layoutDrawing").LayoutSketchLine[];
    underlays?: import("./referenceUnderlay").ReferenceUnderlay[];
  };
};

/** Keep last loaded IFC bytes so .frag can embed the source model. */
let cachedIfc: {
  modelKey: string;
  label: string;
  bytes: Uint8Array;
} | null = null;

export function cacheIfcBytes(
  modelKey: string,
  label: string,
  bytes: ArrayBuffer | Uint8Array,
): void {
  const copy =
    bytes instanceof Uint8Array
      ? bytes.slice()
      : new Uint8Array(bytes.slice(0));
  cachedIfc = { modelKey, label, bytes: copy };
}

export function setCachedIfcBytes(
  modelKey: string,
  bytes: ArrayBuffer | Uint8Array,
  label?: string,
): void {
  cacheIfcBytes(modelKey, label ?? modelKey, bytes);
}

export function getCachedIfcBytes(
  modelKey: string | null,
): Uint8Array | null {
  if (!modelKey || !cachedIfc) return null;
  if (cachedIfc.modelKey !== modelKey && cachedIfc.label !== modelKey) {
    if (!modelKey.includes(cachedIfc.label) && cachedIfc.modelKey !== modelKey) {
      return null;
    }
  }
  return cachedIfc.bytes;
}

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function collectProjectLayoutPayload(): FragSavePayload["layout"] {
  const layout = useLayoutDrawingStore.getState();
  return {
    projectId: layout.projectId,
    levels: layout.levels,
    walls: layout.walls,
    doors: layout.doors,
    windows: layout.windows,
    slabs: layout.slabs,
    columns: layout.columns,
    beams: layout.beams,
    stairs: layout.stairs,
    ramps: layout.ramps,
    ducts: layout.ducts,
    pipes: layout.pipes,
    cableTrays: layout.cableTrays,
    mepEquipment: layout.mepEquipment,
    wires: layout.wires,
    gridLines: layout.gridLines,
    groups: layout.groups,
    wallTypes: layout.wallTypes,
    layoutRooms: layout.layoutRooms,
    sketchLines: layout.sketchLines,
    underlays: layout.underlays,
  };
}

/**
 * Binary .frag container:
 * magic(4) + version(u16) + flags(u16) + metaLen(u32) + ifcLen(u32) + metaJson + ifcBytes
 */
export function buildFragBlob(opts: {
  modelKey: string;
  modelLabel: string | null;
  placements: MarkupPlacement[];
  notes: MarkupNote[];
  ifcBytes?: Uint8Array | null;
  layout?: FragSavePayload["layout"];
}): Blob {
  const meta: FragSavePayload = {
    format: "ibviewer-frag/1",
    savedAt: new Date().toISOString(),
    modelKey: opts.modelKey,
    modelLabel: opts.modelLabel,
    placements: opts.placements,
    notes: opts.notes,
    layout: opts.layout,
  };
  const metaBytes = encodeUtf8(JSON.stringify(meta));
  const ifcBytes = opts.ifcBytes ?? new Uint8Array(0);
  const header = new ArrayBuffer(16);
  const view = new DataView(header);
  for (let i = 0; i < 4; i++) view.setUint8(i, MAGIC.charCodeAt(i));
  view.setUint16(4, VERSION, true);
  view.setUint16(6, ifcBytes.length > 0 ? 1 : 0, true);
  view.setUint32(8, metaBytes.length, true);
  view.setUint32(12, ifcBytes.length, true);
  const metaPart = Uint8Array.from(metaBytes);
  const ifcPart = Uint8Array.from(ifcBytes);
  return new Blob([header, metaPart, ifcPart], {
    type: "application/octet-stream",
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function parseFragFile(source: File | Blob | ArrayBuffer | Uint8Array): Promise<{
  meta: FragSavePayload;
  ifcBytes: Uint8Array | null;
}> {
  let buf: Uint8Array;
  if (source instanceof Uint8Array) {
    buf = source;
  } else if (source instanceof ArrayBuffer) {
    buf = new Uint8Array(source);
  } else {
    buf = new Uint8Array(await source.arrayBuffer());
  }
  if (buf.byteLength < 16) throw new Error("Invalid .frag file");
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3),
  );
  if (magic !== MAGIC) throw new Error("Not an ibviewer .frag file");
  const metaLen = view.getUint32(8, true);
  const ifcLen = view.getUint32(12, true);
  const metaStart = 16;
  const metaEnd = metaStart + metaLen;
  const metaJson = new TextDecoder().decode(buf.subarray(metaStart, metaEnd));
  const meta = JSON.parse(metaJson) as FragSavePayload;
  const ifcBytes =
    ifcLen > 0 ? buf.subarray(metaEnd, metaEnd + ifcLen).slice() : null;
  return { meta, ifcBytes };
}

export function extractEmbeddedProjectData(ifcText: string): FragSavePayload | null {
  const marker = "/* IBVIEWER_PROJECT_DATA:";
  const idx = ifcText.lastIndexOf(marker);
  if (idx < 0) return null;
  const endIdx = ifcText.indexOf("*/", idx);
  if (endIdx < 0) return null;
  const raw = ifcText.slice(idx + marker.length, endIdx).trim();
  try {
    const decoded = decodeURIComponent(raw);
    return JSON.parse(decoded);
  } catch {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

function generateIfcEntities(
  next: () => number,
  subCtx: number,
  owner: number,
  placements: MarkupPlacement[],
  notes: MarkupNote[],
  layout?: FragSavePayload["layout"],
): string[] {
  const lines: string[] = [];
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  // 1. Walls
  for (const wall of layout?.walls ?? []) {
    const guid = cryptoRandom();
    const x1 = wall.startXmm / 1000;
    const y1 = wall.startYmm / 1000;
    const x2 = wall.endXmm / 1000;
    const y2 = wall.endYmm / 1000;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 0.001) continue;
    const dx = (x2 - x1) / len;
    const dy = (y2 - y1) / len;
    const z0 = ((layout?.levels?.find((l) => l.id === wall.levelId)?.elevationMm ?? 0) + (wall.baseOffsetMm ?? 0)) / 1000;
    const h = (wall.heightMm || 2800) / 1000;
    const thick = (wall.thicknessMm || 200) / 1000;

    const dir = next();
    const axisDir = next();
    const loc = next();
    const axis = next();
    const place = next();
    lines.push(`#${dir}=IFCDIRECTION((${dx.toFixed(6)},${dy.toFixed(6)},0.));`);
    lines.push(`#${axisDir}=IFCDIRECTION((0.,0.,1.));`);
    lines.push(`#${loc}=IFCCARTESIANPOINT((${x1.toFixed(6)},${y1.toFixed(6)},${z0.toFixed(6)}));`);
    lines.push(`#${axis}=IFCAXIS2PLACEMENT3D(#${loc},#${axisDir},#${dir});`);
    lines.push(`#${place}=IFCLOCALPLACEMENT($,#${axis});`);

    const p2 = next();
    const profPlace = next();
    const profile = next();
    const extrudeDir = next();
    const solidOrigin = next();
    const solidAxis = next();
    const solid = next();
    const shapeRep = next();
    const prodShape = next();
    lines.push(`#${p2}=IFCCARTESIANPOINT((0.,0.));`);
    lines.push(`#${profPlace}=IFCAXIS2PLACEMENT2D(#${p2},$);`);
    lines.push(`#${profile}=IFCRECTANGLEPROFILEDEF(.AREA.,$,#${profPlace},${len.toFixed(6)},${thick.toFixed(6)});`);
    lines.push(`#${extrudeDir}=IFCDIRECTION((0.,0.,1.));`);
    lines.push(`#${solidOrigin}=IFCCARTESIANPOINT((${ (len / 2).toFixed(6) },0.,0.));`);
    lines.push(`#${solidAxis}=IFCAXIS2PLACEMENT3D(#${solidOrigin},#${axisDir},#${dir});`);
    lines.push(`#${solid}=IFCEXTRUDEDAREASOLID(#${profile},#${solidAxis},#${extrudeDir},${h.toFixed(6)});`);
    lines.push(`#${shapeRep}=IFCSHAPEREPRESENTATION(#${subCtx},'Body','SweptSolid',(#${solid}));`);
    lines.push(`#${prodShape}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${shapeRep}));`);

    const wallId = next();
    lines.push(`#${wallId}=IFCWALLSTANDARDCASE('${guid}',#${owner},'${esc(wall.wallTypeId || "Basic Wall")}','Wall',$,#${place},#${prodShape},$,$);`);
  }

  // 2. Slabs
  for (const slab of layout?.slabs ?? []) {
    const guid = cryptoRandom();
    const b = slab.boundary;
    if (!b || b.length < 3) continue;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const pt of b) {
      if (pt.xMm < minX) minX = pt.xMm;
      if (pt.xMm > maxX) maxX = pt.xMm;
      if (pt.yMm < minY) minY = pt.yMm;
      if (pt.yMm > maxY) maxY = pt.yMm;
    }
    const cx = ((minX + maxX) / 2) / 1000;
    const cy = ((minY + maxY) / 2) / 1000;
    const w = Math.max(0.1, (maxX - minX) / 1000);
    const d = Math.max(0.1, (maxY - minY) / 1000);
    const z0 = ((layout?.levels?.find((l) => l.id === slab.levelId)?.elevationMm ?? 0) + (slab.elevationOffsetMm ?? 0)) / 1000;
    const thick = (slab.thicknessMm || 200) / 1000;

    const dir = next();
    const axisDir = next();
    const loc = next();
    const axis = next();
    const place = next();
    lines.push(`#${dir}=IFCDIRECTION((1.,0.,0.));`);
    lines.push(`#${axisDir}=IFCDIRECTION((0.,0.,1.));`);
    lines.push(`#${loc}=IFCCARTESIANPOINT((${cx.toFixed(6)},${cy.toFixed(6)},${z0.toFixed(6)}));`);
    lines.push(`#${axis}=IFCAXIS2PLACEMENT3D(#${loc},#${axisDir},#${dir});`);
    lines.push(`#${place}=IFCLOCALPLACEMENT($,#${axis});`);

    const p2 = next();
    const profPlace = next();
    const profile = next();
    const extrudeDir = next();
    const solidOrigin = next();
    const solidAxis = next();
    const solid = next();
    const shapeRep = next();
    const prodShape = next();
    lines.push(`#${p2}=IFCCARTESIANPOINT((0.,0.));`);
    lines.push(`#${profPlace}=IFCAXIS2PLACEMENT2D(#${p2},$);`);
    lines.push(`#${profile}=IFCRECTANGLEPROFILEDEF(.AREA.,$,#${profPlace},${w.toFixed(6)},${d.toFixed(6)});`);
    lines.push(`#${extrudeDir}=IFCDIRECTION((0.,0.,1.));`);
    lines.push(`#${solidOrigin}=IFCCARTESIANPOINT((0.,0.,0.));`);
    lines.push(`#${solidAxis}=IFCAXIS2PLACEMENT3D(#${solidOrigin},#${axisDir},#${dir});`);
    lines.push(`#${solid}=IFCEXTRUDEDAREASOLID(#${profile},#${solidAxis},#${extrudeDir},${thick.toFixed(6)});`);
    lines.push(`#${shapeRep}=IFCSHAPEREPRESENTATION(#${subCtx},'Body','SweptSolid',(#${solid}));`);
    lines.push(`#${prodShape}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${shapeRep}));`);

    const slabId = next();
    const slabType = slab.kind === "roof" ? ".ROOF." : ".FLOOR.";
    lines.push(`#${slabId}=IFCSLAB('${guid}',#${owner},'${esc(slab.kind === "roof" ? "Roof" : "Floor")}','${slab.kind}',$,#${place},#${prodShape},$,${slabType});`);
  }

  // 3. Columns
  for (const col of layout?.columns ?? []) {
    const guid = cryptoRandom();
    const cx = col.xMm / 1000;
    const cy = col.yMm / 1000;
    const z0 = ((layout?.levels?.find((l) => l.id === col.levelId)?.elevationMm ?? 0) + (col.baseOffsetMm || 0)) / 1000;
    const w = (col.widthMm || 300) / 1000;
    const d = (col.depthMm || 300) / 1000;
    const h = (col.heightMm || 3000) / 1000;

    const dir = next();
    const axisDir = next();
    const loc = next();
    const axis = next();
    const place = next();
    lines.push(`#${dir}=IFCDIRECTION((1.,0.,0.));`);
    lines.push(`#${axisDir}=IFCDIRECTION((0.,0.,1.));`);
    lines.push(`#${loc}=IFCCARTESIANPOINT((${cx.toFixed(6)},${cy.toFixed(6)},${z0.toFixed(6)}));`);
    lines.push(`#${axis}=IFCAXIS2PLACEMENT3D(#${loc},#${axisDir},#${dir});`);
    lines.push(`#${place}=IFCLOCALPLACEMENT($,#${axis});`);

    const p2 = next();
    const profPlace = next();
    const profile = next();
    const extrudeDir = next();
    const solidOrigin = next();
    const solidAxis = next();
    const solid = next();
    const shapeRep = next();
    const prodShape = next();
    lines.push(`#${p2}=IFCCARTESIANPOINT((0.,0.));`);
    lines.push(`#${profPlace}=IFCAXIS2PLACEMENT2D(#${p2},$);`);
    lines.push(`#${profile}=IFCRECTANGLEPROFILEDEF(.AREA.,$,#${profPlace},${w.toFixed(6)},${d.toFixed(6)});`);
    lines.push(`#${extrudeDir}=IFCDIRECTION((0.,0.,1.));`);
    lines.push(`#${solidOrigin}=IFCCARTESIANPOINT((0.,0.,0.));`);
    lines.push(`#${solidAxis}=IFCAXIS2PLACEMENT3D(#${solidOrigin},#${axisDir},#${dir});`);
    lines.push(`#${solid}=IFCEXTRUDEDAREASOLID(#${profile},#${solidAxis},#${extrudeDir},${h.toFixed(6)});`);
    lines.push(`#${shapeRep}=IFCSHAPEREPRESENTATION(#${subCtx},'Body','SweptSolid',(#${solid}));`);
    lines.push(`#${prodShape}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${shapeRep}));`);

    const colId = next();
    lines.push(`#${colId}=IFCCOLUMN('${guid}',#${owner},'Column','Structural',$,#${place},#${prodShape},$,$);`);
  }

  // 4. Beams
  for (const beam of layout?.beams ?? []) {
    const guid = cryptoRandom();
    const x1 = beam.startXmm / 1000;
    const y1 = beam.startYmm / 1000;
    const x2 = beam.endXmm / 1000;
    const y2 = beam.endYmm / 1000;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 0.001) continue;
    const dx = (x2 - x1) / len;
    const dy = (y2 - y1) / len;
    const z0 = ((layout?.levels?.find((l) => l.id === beam.levelId)?.elevationMm ?? 0) + (beam.elevationOffsetMm || 0)) / 1000;
    const w = (beam.widthMm || 200) / 1000;
    const d = (beam.depthMm || 400) / 1000;

    const dir = next();
    const axisDir = next();
    const loc = next();
    const axis = next();
    const place = next();
    lines.push(`#${dir}=IFCDIRECTION((${dx.toFixed(6)},${dy.toFixed(6)},0.));`);
    lines.push(`#${axisDir}=IFCDIRECTION((0.,0.,1.));`);
    lines.push(`#${loc}=IFCCARTESIANPOINT((${x1.toFixed(6)},${y1.toFixed(6)},${z0.toFixed(6)}));`);
    lines.push(`#${axis}=IFCAXIS2PLACEMENT3D(#${loc},#${axisDir},#${dir});`);
    lines.push(`#${place}=IFCLOCALPLACEMENT($,#${axis});`);

    const p2 = next();
    const profPlace = next();
    const profile = next();
    const extrudeDir = next();
    const solidOrigin = next();
    const solidAxis = next();
    const solid = next();
    const shapeRep = next();
    const prodShape = next();
    lines.push(`#${p2}=IFCCARTESIANPOINT((0.,0.));`);
    lines.push(`#${profPlace}=IFCAXIS2PLACEMENT2D(#${p2},$);`);
    lines.push(`#${profile}=IFCRECTANGLEPROFILEDEF(.AREA.,$,#${profPlace},${len.toFixed(6)},${w.toFixed(6)});`);
    lines.push(`#${extrudeDir}=IFCDIRECTION((0.,0.,1.));`);
    lines.push(`#${solidOrigin}=IFCCARTESIANPOINT((${ (len / 2).toFixed(6) },0.,0.));`);
    lines.push(`#${solidAxis}=IFCAXIS2PLACEMENT3D(#${solidOrigin},#${axisDir},#${dir});`);
    lines.push(`#${solid}=IFCEXTRUDEDAREASOLID(#${profile},#${solidAxis},#${extrudeDir},${d.toFixed(6)});`);
    lines.push(`#${shapeRep}=IFCSHAPEREPRESENTATION(#${subCtx},'Body','SweptSolid',(#${solid}));`);
    lines.push(`#${prodShape}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${shapeRep}));`);

    const beamId = next();
    lines.push(`#${beamId}=IFCBEAM('${guid}',#${owner},'Beam','Structural',$,#${place},#${prodShape},$,$);`);
  }

  // 5. Ducts & Pipes
  for (const duct of layout?.ducts ?? []) {
    const guid = cryptoRandom();
    const x1 = duct.startXmm / 1000;
    const y1 = duct.startYmm / 1000;
    const x2 = duct.endXmm / 1000;
    const y2 = duct.endYmm / 1000;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 0.001) continue;
    const dx = (x2 - x1) / len;
    const dy = (y2 - y1) / len;
    const z0 = ((layout?.levels?.find((l) => l.id === duct.levelId)?.elevationMm ?? 0) + (duct.elevationMm ?? duct.elevationOffsetMm ?? 2600)) / 1000;
    const w = (duct.widthMm || 300) / 1000;
    const h = (duct.heightMm || 200) / 1000;

    const dir = next();
    const axisDir = next();
    const loc = next();
    const axis = next();
    const place = next();
    lines.push(`#${dir}=IFCDIRECTION((${dx.toFixed(6)},${dy.toFixed(6)},0.));`);
    lines.push(`#${axisDir}=IFCDIRECTION((0.,0.,1.));`);
    lines.push(`#${loc}=IFCCARTESIANPOINT((${x1.toFixed(6)},${y1.toFixed(6)},${z0.toFixed(6)}));`);
    lines.push(`#${axis}=IFCAXIS2PLACEMENT3D(#${loc},#${axisDir},#${dir});`);
    lines.push(`#${place}=IFCLOCALPLACEMENT($,#${axis});`);

    const p2 = next();
    const profPlace = next();
    const profile = next();
    const extrudeDir = next();
    const solidOrigin = next();
    const solidAxis = next();
    const solid = next();
    const shapeRep = next();
    const prodShape = next();
    lines.push(`#${p2}=IFCCARTESIANPOINT((0.,0.));`);
    lines.push(`#${profPlace}=IFCAXIS2PLACEMENT2D(#${p2},$);`);
    lines.push(`#${profile}=IFCRECTANGLEPROFILEDEF(.AREA.,$,#${profPlace},${len.toFixed(6)},${w.toFixed(6)});`);
    lines.push(`#${extrudeDir}=IFCDIRECTION((0.,0.,1.));`);
    lines.push(`#${solidOrigin}=IFCCARTESIANPOINT((${ (len / 2).toFixed(6) },0.,0.));`);
    lines.push(`#${solidAxis}=IFCAXIS2PLACEMENT3D(#${solidOrigin},#${axisDir},#${dir});`);
    lines.push(`#${solid}=IFCEXTRUDEDAREASOLID(#${profile},#${solidAxis},#${extrudeDir},${h.toFixed(6)});`);
    lines.push(`#${shapeRep}=IFCSHAPEREPRESENTATION(#${subCtx},'Body','SweptSolid',(#${solid}));`);
    lines.push(`#${prodShape}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${shapeRep}));`);

    const ductId = next();
    lines.push(`#${ductId}=IFCDUCTSEGMENT('${guid}',#${owner},'Duct','HVAC',$,#${place},#${prodShape},$,$);`);
  }

  for (const pipe of layout?.pipes ?? []) {
    const guid = cryptoRandom();
    const x1 = pipe.startXmm / 1000;
    const y1 = pipe.startYmm / 1000;
    const x2 = pipe.endXmm / 1000;
    const y2 = pipe.endYmm / 1000;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 0.001) continue;
    const dx = (x2 - x1) / len;
    const dy = (y2 - y1) / len;
    const z0 = ((layout?.levels?.find((l) => l.id === pipe.levelId)?.elevationMm ?? 0) + (pipe.elevationMm ?? pipe.elevationOffsetMm ?? 2600)) / 1000;
    const r = ((pipe.diameterMm || 50) / 2) / 1000;

    const dir = next();
    const axisDir = next();
    const loc = next();
    const axis = next();
    const place = next();
    lines.push(`#${dir}=IFCDIRECTION((${dx.toFixed(6)},${dy.toFixed(6)},0.));`);
    lines.push(`#${axisDir}=IFCDIRECTION((0.,0.,1.));`);
    lines.push(`#${loc}=IFCCARTESIANPOINT((${x1.toFixed(6)},${y1.toFixed(6)},${z0.toFixed(6)}));`);
    lines.push(`#${axis}=IFCAXIS2PLACEMENT3D(#${loc},#${axisDir},#${dir});`);
    lines.push(`#${place}=IFCLOCALPLACEMENT($,#${axis});`);

    const p2 = next();
    const profPlace = next();
    const profile = next();
    const extrudeDir = next();
    const solidOrigin = next();
    const solidAxis = next();
    const solid = next();
    const shapeRep = next();
    const prodShape = next();
    lines.push(`#${p2}=IFCCARTESIANPOINT((0.,0.));`);
    lines.push(`#${profPlace}=IFCAXIS2PLACEMENT2D(#${p2},$);`);
    lines.push(`#${profile}=IFCCIRCLEPROFILEDEF(.AREA.,$,#${profPlace},${r.toFixed(6)});`);
    lines.push(`#${extrudeDir}=IFCDIRECTION((1.,0.,0.));`);
    lines.push(`#${solidOrigin}=IFCCARTESIANPOINT((0.,0.,0.));`);
    lines.push(`#${solidAxis}=IFCAXIS2PLACEMENT3D(#${solidOrigin},#${axisDir},#${dir});`);
    lines.push(`#${solid}=IFCEXTRUDEDAREASOLID(#${profile},#${solidAxis},#${extrudeDir},${len.toFixed(6)});`);
    lines.push(`#${shapeRep}=IFCSHAPEREPRESENTATION(#${subCtx},'Body','SweptSolid',(#${solid}));`);
    lines.push(`#${prodShape}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${shapeRep}));`);

    const pipeId = next();
    lines.push(`#${pipeId}=IFCPIPESEGMENT('${guid}',#${owner},'Pipe','Piping',$,#${place},#${prodShape},$,$);`);
  }

  // 6. Placements (3D shapes / components)
  for (const p of placements) {
    const guid = cryptoRandom();
    const loc = next();
    const dir = next();
    const axisDir = next();
    const axis = next();
    const place = next();
    const ix = p.posX;
    const iy = p.posZ;
    const iz = p.posY;
    const sx = Math.max(0.05, p.sizeX);
    const sy = Math.max(0.05, p.sizeZ);
    const sz = Math.max(0.05, p.sizeY);
    lines.push(`#${dir}=IFCDIRECTION((1.,0.,0.));`);
    lines.push(`#${axisDir}=IFCDIRECTION((0.,0.,1.));`);
    lines.push(
      `#${loc}=IFCCARTESIANPOINT((${ix.toFixed(6)},${iy.toFixed(6)},${(iz - sz / 2).toFixed(6)}));`,
    );
    lines.push(`#${axis}=IFCAXIS2PLACEMENT3D(#${loc},#${axisDir},#${dir});`);
    lines.push(`#${place}=IFCLOCALPLACEMENT($,#${axis});`);

    const p2 = next();
    const profilePlace = next();
    const profile = next();
    const extrudeDir = next();
    const solidOrigin = next();
    const solidAxis = next();
    const solid = next();
    const shapeRep = next();
    const prodShape = next();
    lines.push(`#${p2}=IFCCARTESIANPOINT((0.,0.));`);
    lines.push(`#${profilePlace}=IFCAXIS2PLACEMENT2D(#${p2},$);`);
    lines.push(
      `#${profile}=IFCRECTANGLEPROFILEDEF(.AREA.,$,#${profilePlace},${sx.toFixed(6)},${sy.toFixed(6)});`,
    );
    lines.push(`#${extrudeDir}=IFCDIRECTION((0.,0.,1.));`);
    lines.push(`#${solidOrigin}=IFCCARTESIANPOINT((0.,0.,0.));`);
    lines.push(
      `#${solidAxis}=IFCAXIS2PLACEMENT3D(#${solidOrigin},#${axisDir},#${dir});`,
    );
    lines.push(
      `#${solid}=IFCEXTRUDEDAREASOLID(#${profile},#${solidAxis},#${extrudeDir},${sz.toFixed(6)});`,
    );
    lines.push(
      `#${shapeRep}=IFCSHAPEREPRESENTATION(#${subCtx},'Body','SweptSolid',(#${solid}));`,
    );
    lines.push(`#${prodShape}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${shapeRep}));`);
    const proxy = next();
    const label = esc(p.label ?? p.type);
    lines.push(
      `#${proxy}=IFCBUILDINGELEMENTPROXY('${guid}',#${owner},'${label}','markup:${p.type}:${esc(p.color)}',$,#${place},#${prodShape},$,.NOTDEFINED.);`,
    );
  }

  // 7. Notes
  for (const n of notes) {
    const guid = cryptoRandom();
    const loc = next();
    const dir = next();
    const axisDir = next();
    const axis = next();
    const place = next();
    lines.push(`#${dir}=IFCDIRECTION((1.,0.,0.));`);
    lines.push(`#${axisDir}=IFCDIRECTION((0.,0.,1.));`);
    lines.push(
      `#${loc}=IFCCARTESIANPOINT((${n.posX.toFixed(6)},${n.posZ.toFixed(6)},${n.posY.toFixed(6)}));`,
    );
    lines.push(`#${axis}=IFCAXIS2PLACEMENT3D(#${loc},#${axisDir},#${dir});`);
    lines.push(`#${place}=IFCLOCALPLACEMENT($,#${axis});`);
    const ann = next();
    lines.push(
      `#${ann}=IFCANNOTATION('${guid}',#${owner},'Note','${esc(n.text.slice(0, 255))}',$,#${place},$,$);`,
    );
  }

  return lines;
}

/**
 * Full IFC STEP generator with walls, slabs, columns, beams, ducts, pipes, proxies, and embedded project state.
 */
export function buildMarkupOnlyIfc(opts: {
  modelLabel: string | null;
  placements: MarkupPlacement[];
  notes: MarkupNote[];
  layout?: FragSavePayload["layout"];
}): Blob {
  const lines: string[] = [];
  let id = 1;
  const next = () => id++;
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  lines.push("ISO-10303-21;");
  lines.push("HEADER;");
  lines.push("FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');");
  lines.push(
    `FILE_NAME('${esc(opts.modelLabel ?? "project")}.ifc','${new Date().toISOString()}',('ibviewer'),('ibviewer'),'ibviewer','ibviewer','');`,
  );
  lines.push("FILE_SCHEMA(('IFC4'));");
  lines.push("ENDSEC;");
  lines.push("DATA;");

  const app = next();
  lines.push(`#${app}=IFCAPPLICATION($,'ibviewer','ibviewer','1.0');`);
  const person = next();
  lines.push(`#${person}=IFCPERSON($,$,'Architect',$,$,$,$,$);`);
  const org = next();
  lines.push(`#${org}=IFCORGANIZATION($,'IBV',$,$,$);`);
  const personOrg = next();
  lines.push(
    `#${personOrg}=IFCPERSONANDORGANIZATION(#${person},#${org},$);`,
  );
  const owner = next();
  lines.push(
    `#${owner}=IFCOWNERHISTORY(#${personOrg},#${app},$,.ADDED.,$,$,$,${Math.floor(Date.now() / 1000)});`,
  );
  const siLen = next();
  lines.push(`#${siLen}=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);`);
  const units = next();
  lines.push(`#${units}=IFCUNITASSIGNMENT((#${siLen}));`);
  const project = next();
  lines.push(
    `#${project}=IFCPROJECT('${cryptoRandom()}',#${owner},'${esc(opts.modelLabel ?? "Project")}',$,$,$,$,$,#${units});`,
  );
  const ctx = next();
  lines.push(
    `#${ctx}=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,$,$);`,
  );
  const subCtx = next();
  lines.push(
    `#${subCtx}=IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,#${ctx},$,.MODEL_VIEW.,$);`,
  );

  const site = next();
  lines.push(`#${site}=IFCSITE('${cryptoRandom()}',#${owner},'Site',$,$,$,$,$,.ELEMENT.,$,$,$,$,$);`);
  const building = next();
  lines.push(`#${building}=IFCBUILDING('${cryptoRandom()}',#${owner},'Building',$,$,$,$,$,.ELEMENT.,$,$,$);`);

  // Generate building elements & markup
  const entityLines = generateIfcEntities(next, subCtx, owner, opts.placements, opts.notes, opts.layout);
  lines.push(...entityLines);

  // Embed metadata comment so opening this IFC in our viewer restores full parametric reworkability
  const metadata = JSON.stringify({
    format: "ibviewer-frag/1",
    savedAt: new Date().toISOString(),
    modelLabel: opts.modelLabel,
    placements: opts.placements,
    notes: opts.notes,
    layout: opts.layout,
  });
  lines.push(`/* IBVIEWER_PROJECT_DATA: ${encodeURIComponent(metadata)} */`);

  lines.push("ENDSEC;");
  lines.push("END-ISO-10303-21;");
  return new Blob([lines.join("\n")], { type: "application/x-step" });
}

/**
 * Merge layout elements and markup proxies into a copy of the loaded IFC so the download keeps the
 * original building + newly placed walls/shapes/notes.
 */
export function mergeMarkupIntoIfc(opts: {
  baseIfc: Uint8Array;
  placements: MarkupPlacement[];
  notes: MarkupNote[];
  layout?: FragSavePayload["layout"];
}): Blob {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(opts.baseIfc);
  let maxId = 0;
  for (const m of text.matchAll(/#(\d+)\s*=/g)) {
    const n = Number(m[1]);
    if (n > maxId) maxId = n;
  }
  let id = maxId + 1;
  const next = () => id++;
  const lines: string[] = [];

  const app = next();
  lines.push(`#${app}=IFCAPPLICATION($,'ibviewer','ibviewer','1.0');`);
  const person = next();
  lines.push(`#${person}=IFCPERSON($,$,'Architect',$,$,$,$,$);`);
  const org = next();
  lines.push(`#${org}=IFCORGANIZATION($,'IBV',$,$,$);`);
  const personOrg = next();
  lines.push(
    `#${personOrg}=IFCPERSONANDORGANIZATION(#${person},#${org},$);`,
  );
  const owner = next();
  lines.push(
    `#${owner}=IFCOWNERHISTORY(#${personOrg},#${app},$,.ADDED.,$,$,$,${Math.floor(Date.now() / 1000)});`,
  );
  const ctx = next();
  lines.push(
    `#${ctx}=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,$,$);`,
  );
  const subCtx = next();
  lines.push(
    `#${subCtx}=IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,#${ctx},$,.MODEL_VIEW.,$);`,
  );

  const entityLines = generateIfcEntities(next, subCtx, owner, opts.placements, opts.notes, opts.layout);
  lines.push(...entityLines);

  const metadata = JSON.stringify({
    format: "ibviewer-frag/1",
    savedAt: new Date().toISOString(),
    placements: opts.placements,
    notes: opts.notes,
    layout: opts.layout,
  });
  lines.push(`/* IBVIEWER_PROJECT_DATA: ${encodeURIComponent(metadata)} */`);

  const insert = `\n${lines.join("\n")}\n`;
  const endIso = text.lastIndexOf("END-ISO-10303-21");
  const endSec = text.lastIndexOf("ENDSEC;", endIso >= 0 ? endIso : undefined);
  if (endSec < 0) {
    return buildMarkupOnlyIfc({
      modelLabel: "merged",
      placements: opts.placements,
      notes: opts.notes,
      layout: opts.layout,
    });
  }
  const merged = text.slice(0, endSec) + insert + text.slice(endSec);
  return new Blob([merged], { type: "application/x-step" });
}

export type ExportDownloadOptions =
  | string
  | null
  | {
      modelKey?: string;
      modelLabel?: string;
      customFileName?: string;
    };

export function exportAndDownloadFrag(opts?: ExportDownloadOptions): Blob {
  const layout = useLayoutDrawingStore.getState();
  const markup = useToolMarkupStore.getState();
  const options = typeof opts === "object" && opts !== null ? opts : undefined;
  const preferredName =
    typeof opts === "string"
      ? opts
      : (options?.modelLabel ?? options?.modelKey ?? options?.customFileName);
  const key = preferredName || layout.projectId || markup.modelKey || "project";
  const baseName = (options?.customFileName ?? key)
    .replace(/\.(frag|ifc)$/i, "")
    .replace(/[^\w.-]+/g, "_");
  const ifcBytes =
    getCachedIfcBytes(key) ||
    getCachedIfcBytes(baseName) ||
    (options?.modelKey ? getCachedIfcBytes(options.modelKey) : null);
  const blob = buildFragBlob({
    modelKey: options?.modelKey ?? key,
    modelLabel: options?.modelLabel ?? preferredName ?? key,
    placements: markup.placements,
    notes: markup.notes,
    ifcBytes: ifcBytes ?? null,
    layout: collectProjectLayoutPayload(),
  });
  downloadBlob(blob, `${baseName}.frag`);
  return blob;
}

export function exportAndDownloadIfc(opts?: ExportDownloadOptions): Blob {
  const layout = useLayoutDrawingStore.getState();
  const markup = useToolMarkupStore.getState();
  const options = typeof opts === "object" && opts !== null ? opts : undefined;
  const preferredName =
    typeof opts === "string"
      ? opts
      : (options?.modelLabel ?? options?.modelKey ?? options?.customFileName);
  const key = preferredName || layout.projectId || markup.modelKey || "project";
  const baseName = (options?.customFileName ?? key)
    .replace(/\.(frag|ifc)$/i, "")
    .replace(/[^\w.-]+/g, "_");
  const cached =
    getCachedIfcBytes(key) ||
    getCachedIfcBytes(baseName) ||
    (options?.modelKey ? getCachedIfcBytes(options.modelKey) : null);
  const blob = cached
    ? mergeMarkupIntoIfc({
        baseIfc: cached,
        placements: markup.placements,
        notes: markup.notes,
        layout: collectProjectLayoutPayload(),
      })
    : buildMarkupOnlyIfc({
        modelLabel: baseName,
        placements: markup.placements,
        notes: markup.notes,
        layout: collectProjectLayoutPayload(),
      });
  downloadBlob(blob, `${baseName}.ifc`);
  return blob;
}

function cryptoRandom(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 22).toUpperCase();
  }
  return Math.random().toString(36).slice(2, 24).toUpperCase();
}
