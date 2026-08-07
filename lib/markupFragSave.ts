import type { MarkupNote, MarkupPlacement } from "./toolMarkup";

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
    levels: import("./layoutDrawing").LayoutLevel[];
    walls: import("./layoutDrawing").LayoutWall[];
    doors: import("./layoutDrawing").LayoutDoor[];
    windows: import("./layoutDrawing").LayoutWindow[];
    underlays?: import("./referenceUnderlay").ReferenceUnderlay[];
    slabs?: import("./layoutDrawing").LayoutSlab[];
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

export function getCachedIfcBytes(
  modelKey: string | null,
): Uint8Array | null {
  if (!modelKey || !cachedIfc) return null;
  if (cachedIfc.modelKey !== modelKey && cachedIfc.label !== modelKey) {
    // Allow match by label: prefix
    if (!modelKey.includes(cachedIfc.label) && cachedIfc.modelKey !== modelKey) {
      return null;
    }
  }
  return cachedIfc.bytes;
}

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
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
  ifcBytes: Uint8Array | null;
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
  // Copy into fresh ArrayBuffers so BlobPart typing accepts them (TS 5.7+).
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

export async function parseFragFile(file: File): Promise<{
  meta: FragSavePayload;
  ifcBytes: Uint8Array | null;
}> {
  const buf = new Uint8Array(await file.arrayBuffer());
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

/**
 * Minimal IFC STEP writer for markup proxies only (no base model merge).
 * Full model+markup merge still needs the Python ifcopenshell service.
 */
export function buildMarkupOnlyIfc(opts: {
  modelLabel: string | null;
  placements: MarkupPlacement[];
  notes: MarkupNote[];
}): Blob {
  const lines: string[] = [];
  let id = 1;
  const next = () => id++;
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  lines.push("ISO-10303-21;");
  lines.push("HEADER;");
  lines.push("FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');");
  lines.push(
    `FILE_NAME('${esc(opts.modelLabel ?? "markup")}_markup.ifc','${new Date().toISOString()}',('ibviewer'),('ibviewer'),'ibviewer','ibviewer','');`,
  );
  lines.push("FILE_SCHEMA(('IFC4'));");
  lines.push("ENDSEC;");
  lines.push("DATA;");

  const app = next();
  lines.push(`#${app}=IFCAPPLICATION($,'ibviewer','ibviewer','1.0');`);
  const person = next();
  lines.push(`#${person}=IFCPERSON($,$,'Engineer',$,$,$,$,$);`);
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
  const units = next();
  const siLen = next();
  lines.push(`#${siLen}=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);`);
  lines.push(`#${units}=IFCUNITASSIGNMENT((#${siLen}));`);
  const project = next();
  lines.push(
    `#${project}=IFCPROJECT('${cryptoRandom()}',#${owner},'Markup Export',$,$,$,$,$,#${units});`,
  );

  for (const p of opts.placements) {
    const guid = cryptoRandom();
    const place = next();
    const axis = next();
    const loc = next();
    const dir = next();
    const axisDir = next();
    lines.push(`#${dir}=IFCDIRECTION((1.,0.,0.));`);
    lines.push(`#${axisDir}=IFCDIRECTION((0.,0.,1.));`);
    lines.push(
      `#${loc}=IFCCARTESIANPOINT((${p.posX.toFixed(6)},${p.posY.toFixed(6)},${p.posZ.toFixed(6)}));`,
    );
    lines.push(
      `#${axis}=IFCAXIS2PLACEMENT3D(#${loc},#${axisDir},#${dir});`,
    );
    lines.push(`#${place}=IFCLOCALPLACEMENT($,#${axis});`);
    const proxy = next();
    const label = esc(p.label ?? p.type);
    lines.push(
      `#${proxy}=IFCBUILDINGELEMENTPROXY('${guid}',#${owner},'${label}','${p.type} ${p.color}',$,#${place},$,$,.NOTDEFINED.);`,
    );
  }

  for (const n of opts.notes) {
    const guid = cryptoRandom();
    const place = next();
    const axis = next();
    const loc = next();
    const dir = next();
    const axisDir = next();
    lines.push(`#${dir}=IFCDIRECTION((1.,0.,0.));`);
    lines.push(`#${axisDir}=IFCDIRECTION((0.,0.,1.));`);
    lines.push(
      `#${loc}=IFCCARTESIANPOINT((${n.posX.toFixed(6)},${n.posY.toFixed(6)},${n.posZ.toFixed(6)}));`,
    );
    lines.push(
      `#${axis}=IFCAXIS2PLACEMENT3D(#${loc},#${axisDir},#${dir});`,
    );
    lines.push(`#${place}=IFCLOCALPLACEMENT($,#${axis});`);
    const ann = next();
    lines.push(
      `#${ann}=IFCANNOTATION('${guid}',#${owner},'Note','${esc(n.text)}',$,#${place},$,$);`,
    );
  }

  lines.push("ENDSEC;");
  lines.push("END-ISO-10303-21;");
  return new Blob([lines.join("\n")], { type: "application/x-step" });
}

/**
 * Merge markup proxies into a copy of the loaded IFC so the download keeps the
 * original building + placed shapes/notes. Proxies use simple extruded boxes.
 */
export function mergeMarkupIntoIfc(opts: {
  baseIfc: Uint8Array;
  placements: MarkupPlacement[];
  notes: MarkupNote[];
}): Blob {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(opts.baseIfc);
  let maxId = 0;
  for (const m of text.matchAll(/#(\d+)\s*=/g)) {
    const n = Number(m[1]);
    if (n > maxId) maxId = n;
  }
  let id = maxId + 1;
  const next = () => id++;
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const lines: string[] = [];

  const app = next();
  lines.push(`#${app}=IFCAPPLICATION($,'ibviewer','ibviewer','1.0');`);
  const person = next();
  lines.push(`#${person}=IFCPERSON($,$,'Engineer',$,$,$,$,$);`);
  const org = next();
  lines.push(`#${org}=IFCORGANIZATION($,'IBV',$,$,$);`);
  const personOrg = next();
  lines.push(`#${personOrg}=IFCPERSONANDORGANIZATION(#${person},#${org},$);`);
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

  for (const p of opts.placements) {
    const guid = cryptoRandom();
    const loc = next();
    const dir = next();
    const axisDir = next();
    const axis = next();
    const place = next();
    // IFC Z-up: map three.js Y-up (x,y,z) → (x,z,y)
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

  for (const n of opts.notes) {
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

  if (!opts.placements.length && !opts.notes.length) {
    return new Blob([Uint8Array.from(opts.baseIfc)], {
      type: "application/x-step",
    });
  }

  const insert = `\n${lines.join("\n")}\n`;
  const endIso = text.lastIndexOf("END-ISO-10303-21");
  const endSec = text.lastIndexOf("ENDSEC;", endIso >= 0 ? endIso : undefined);
  if (endSec < 0) {
    // Fallback: markup-only file
    return buildMarkupOnlyIfc({
      modelLabel: "merged",
      placements: opts.placements,
      notes: opts.notes,
    });
  }
  const merged = text.slice(0, endSec) + insert + text.slice(endSec);
  return new Blob([merged], { type: "application/x-step" });
}

function cryptoRandom(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 22).toUpperCase();
  }
  return Math.random().toString(36).slice(2, 24).toUpperCase();
}
