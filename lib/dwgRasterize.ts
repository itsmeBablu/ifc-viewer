/**
 * DWG → raster underlay image.
 * Expands INSERT blocks (doors/windows) and common entity types.
 */

import {
  compressCanvasImage,
  compressImageFile,
  type CompressedImage,
} from "./imageCompress";
import { rasterizePdfPage } from "./pdfRasterize";
import type { UnderlaySnapSegment } from "./referenceUnderlay";
import { strokesToSnapSegmentsUv } from "./underlaySnap";

type Pt = { x: number; y: number };
type Stroke = { points: Pt[] };

const DWG_MAX_EDGE = 4096;

function expandBounds(
  b: { minX: number; minY: number; maxX: number; maxY: number },
  x: number,
  y: number,
) {
  b.minX = Math.min(b.minX, x);
  b.minY = Math.min(b.minY, y);
  b.maxX = Math.max(b.maxX, x);
  b.maxY = Math.max(b.maxY, y);
}

function transformPt(
  p: Pt,
  origin: Pt,
  rotRad: number,
  sx: number,
  sy: number,
  insert: Pt,
): Pt {
  const lx = p.x - origin.x;
  const ly = p.y - origin.y;
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);
  return {
    x: insert.x + (lx * sx) * cos - (ly * sy) * sin,
    y: insert.y + (lx * sx) * sin + (ly * sy) * cos,
  };
}

function asPt(v: unknown): Pt | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { x?: unknown; y?: unknown };
  if (typeof o.x !== "number" || typeof o.y !== "number") return null;
  return { x: o.x, y: o.y };
}

function collectEntityStrokes(
  entities: Array<Record<string, unknown>>,
  blocks: Map<string, { base: Pt; entities: Array<Record<string, unknown>> }>,
  out: Stroke[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  xform: ((p: Pt) => Pt) | null,
  depth: number,
) {
  if (depth > 8) return;
  const map = (p: Pt) => (xform ? xform(p) : p);
  const addStroke = (pts: Pt[]) => {
    if (pts.length < 2) return;
    const mapped = pts.map(map);
    out.push({ points: mapped });
    for (const p of mapped) expandBounds(bounds, p.x, p.y);
  };

  for (const e of entities) {
    const type = String(e.type ?? "").toUpperCase();
    if (type === "LINE") {
      const s = asPt(e.startPoint);
      const t = asPt(e.endPoint);
      if (s && t) addStroke([s, t]);
    } else if (type === "LWPOLYLINE") {
      const verts = e.vertices as { x: number; y: number; bulge?: number }[] | undefined;
      if (verts?.length) {
        const pts: Pt[] = [];
        for (let i = 0; i < verts.length; i++) {
          const v = verts[i]!;
          pts.push({ x: v.x, y: v.y });
          const bulge = Number(v.bulge ?? 0);
          if (Math.abs(bulge) > 1e-8 && i < verts.length - 1) {
            const n = verts[i + 1]!;
            // Approximate bulge arc with segments
            const arc = bulgeArcPoints(
              { x: v.x, y: v.y },
              { x: n.x, y: n.y },
              bulge,
              12,
            );
            for (let k = 1; k < arc.length - 1; k++) pts.push(arc[k]!);
          }
        }
        if ((Number(e.flag) & 1) === 1 && pts[0]) pts.push({ ...pts[0] });
        addStroke(pts);
      }
    } else if (
      type === "POLYLINE" ||
      type === "POLYLINE_2D" ||
      type === "POLYLINE_3D"
    ) {
      const verts = (e.vertices ?? e.vertexs) as Pt[] | undefined;
      if (verts?.length) addStroke(verts.map((v) => ({ x: v.x, y: v.y })));
    } else if (type === "CIRCLE") {
      const c = asPt(e.center);
      const r = Number(e.radius ?? 0);
      if (c && r > 0) {
        const pts: Pt[] = [];
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * Math.PI * 2;
          pts.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
        }
        addStroke(pts);
      }
    } else if (type === "ARC") {
      const c = asPt(e.center);
      const r = Number(e.radius ?? 0);
      let a0 = Number(e.startAngle ?? 0);
      let a1 = Number(e.endAngle ?? 0);
      // Degrees if clearly outside typical radian range
      if (Math.abs(a0) > Math.PI * 2 + 0.5 || Math.abs(a1) > Math.PI * 2 + 0.5) {
        a0 = (a0 * Math.PI) / 180;
        a1 = (a1 * Math.PI) / 180;
      }
      if (c && r > 0) {
        if (a1 < a0) a1 += Math.PI * 2;
        const pts: Pt[] = [];
        const n = Math.max(12, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 64));
        for (let i = 0; i <= n; i++) {
          const a = a0 + ((a1 - a0) * i) / n;
          pts.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
        }
        addStroke(pts);
      }
    } else if (type === "ELLIPSE") {
      const c = asPt(e.center);
      const maj = asPt(e.majorAxisEndPoint);
      const ratio = Number(e.axisRatio ?? 0.5);
      if (c && maj) {
        const a = Math.hypot(maj.x, maj.y);
        const b = a * ratio;
        const rot = Math.atan2(maj.y, maj.x);
        const a0 = Number(e.startAngle ?? 0);
        const a1 = Number(e.endAngle ?? Math.PI * 2);
        const pts: Pt[] = [];
        const n = 64;
        for (let i = 0; i <= n; i++) {
          const t = a0 + ((a1 - a0) * i) / n;
          const lx = Math.cos(t) * a;
          const ly = Math.sin(t) * b;
          pts.push({
            x: c.x + lx * Math.cos(rot) - ly * Math.sin(rot),
            y: c.y + lx * Math.sin(rot) + ly * Math.cos(rot),
          });
        }
        addStroke(pts);
      }
    } else if (type === "SOLID" || type === "TRACE") {
      const c1 = asPt(e.corner1);
      const c2 = asPt(e.corner2);
      const c3 = asPt(e.corner3);
      const c4 = asPt(e.corner4) ?? c3;
      if (c1 && c2 && c3 && c4) addStroke([c1, c2, c4, c3, c1]);
    } else if (type === "SPLINE") {
      const cps = e.controlPoints as Pt[] | undefined;
      const fps = e.fitPoints as Pt[] | undefined;
      if (cps && cps.length >= 2) addStroke(cps.map((p) => ({ x: p.x, y: p.y })));
      else if (fps && fps.length >= 2)
        addStroke(fps.map((p) => ({ x: p.x, y: p.y })));
    } else if (type === "INSERT") {
      const name = String(e.name ?? "");
      const block = blocks.get(name.toUpperCase()) ?? blocks.get(name);
      const insert = asPt(e.insertionPoint);
      if (block && insert) {
        const sx = Number(e.xScale ?? 1) || 1;
        const sy = Number(e.yScale ?? 1) || 1;
        let rot = Number(e.rotation ?? 0);
        if (Math.abs(rot) > Math.PI * 2 + 0.5) rot = (rot * Math.PI) / 180;
        const nested = (p: Pt) => {
          const local = transformPt(p, block.base, rot, sx, sy, insert);
          return map(local);
        };
        collectEntityStrokes(
          block.entities,
          blocks,
          out,
          bounds,
          nested,
          depth + 1,
        );
      }
    }
  }
}

/** Bulge (tan of 1/4 included angle) between two polyline verts → arc samples. */
function bulgeArcPoints(a: Pt, b: Pt, bulge: number, segs: number): Pt[] {
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  if (chord < 1e-9 || Math.abs(bulge) < 1e-12) return [a, b];
  const sagitta = (bulge * chord) / 2;
  const radius = ((chord / 2) ** 2 + sagitta ** 2) / (2 * Math.abs(sagitta));
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const nx = -(b.y - a.y) / chord;
  const ny = (b.x - a.x) / chord;
  const d = radius - Math.abs(sagitta);
  const sign = bulge > 0 ? 1 : -1;
  const cx = mx + nx * d * sign;
  const cy = my + ny * d * sign;
  const a0 = Math.atan2(a.y - cy, a.x - cx);
  let a1 = Math.atan2(b.y - cy, b.x - cx);
  if (bulge > 0) {
    if (a1 < a0) a1 += Math.PI * 2;
  } else if (a1 > a0) {
    a1 -= Math.PI * 2;
  }
  const pts: Pt[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = a0 + ((a1 - a0) * i) / segs;
    pts.push({ x: cx + Math.cos(t) * radius, y: cy + Math.sin(t) * radius });
  }
  return pts;
}

function collectStrokesFromDb(db: {
  entities?: unknown[];
  tables?: {
    BLOCK_RECORD?: { entries?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
  };
}): {
  strokes: Stroke[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
} {
  const strokes: Stroke[] = [];
  const bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };

  const blocks = new Map<
    string,
    { base: Pt; entities: Array<Record<string, unknown>> }
  >();
  const br = db.tables?.BLOCK_RECORD;
  const entries = Array.isArray(br)
    ? br
    : ((br as { entries?: Array<Record<string, unknown>> } | undefined)
        ?.entries ?? []);
  // Also support object-map style
  const entryList =
    entries.length > 0
      ? entries
      : br && !Array.isArray(br)
        ? Object.values(br as Record<string, Record<string, unknown>>).filter(
            (v) => v && typeof v === "object" && "name" in v,
          )
        : [];

  for (const entry of entryList) {
    const name = String(entry.name ?? "");
    if (!name) continue;
    const base = asPt(entry.basePoint) ?? { x: 0, y: 0 };
    const ents = (entry.entities ?? []) as Array<Record<string, unknown>>;
    blocks.set(name.toUpperCase(), { base, entities: ents });
    blocks.set(name, { base, entities: ents });
  }

  const model = (db.entities ?? []) as Array<Record<string, unknown>>;
  collectEntityStrokes(model, blocks, strokes, bounds, null, 0);

  if (!Number.isFinite(bounds.minX)) {
    bounds.minX = 0;
    bounds.minY = 0;
    bounds.maxX = 1;
    bounds.maxY = 1;
  }
  return { strokes, bounds };
}

function strokesToCanvas(
  strokes: Stroke[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  maxEdge = DWG_MAX_EDGE,
): HTMLCanvasElement {
  const pad = 0.02;
  const bw = Math.max(1e-6, bounds.maxX - bounds.minX);
  const bh = Math.max(1e-6, bounds.maxY - bounds.minY);
  const aspect = bw / bh;
  let w: number;
  let h: number;
  if (aspect >= 1) {
    w = maxEdge;
    h = Math.max(1, Math.round(maxEdge / aspect));
  } else {
    h = maxEdge;
    w = Math.max(1, Math.round(maxEdge * aspect));
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = Math.max(1.25, maxEdge / 1600);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const mx = bounds.minX - bw * pad;
  const my = bounds.minY - bh * pad;
  const sx = w / (bw * (1 + pad * 2));
  const sy = h / (bh * (1 + pad * 2));

  for (const s of strokes) {
    if (s.points.length < 2) continue;
    ctx.beginPath();
    s.points.forEach((p, i) => {
      const x = (p.x - mx) * sx;
      const y = h - (p.y - my) * sy;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  return canvas;
}

async function rasterizeDwgWithLibreDwg(
  file: File,
): Promise<CompressedImage & { snapSegments: UnderlaySnapSegment[] }> {
  const { LibreDwg, Dwg_File_Type } = await import("@mlightcad/libredwg-web");
  const libredwg = await LibreDwg.create("/wasm/libredwg/");
  const buf = await file.arrayBuffer();
  const ptr = libredwg.dwg_read_data(buf, Dwg_File_Type.DWG);
  if (ptr == null) throw new Error("DWG parse failed");
  try {
    const db = libredwg.convert(ptr) as {
      entities?: unknown[];
      tables?: {
        BLOCK_RECORD?:
          | { entries?: Array<Record<string, unknown>> }
          | Array<Record<string, unknown>>;
      };
    };
    const { strokes, bounds } = collectStrokesFromDb(db);
    if (strokes.length === 0) {
      const thumb = libredwg.dwg_bmp(ptr);
      if (thumb?.data?.length) {
        const blob = new Blob([Uint8Array.from(thumb.data)], {
          type: "image/png",
        });
        const img = await compressImageFile(blob, DWG_MAX_EDGE);
        return { ...img, snapSegments: [] };
      }
      throw new Error("DWG has no drawable geometry");
    }
    const snapSegments = strokesToSnapSegmentsUv(strokes, bounds);
    const canvas = strokesToCanvas(strokes, bounds);
    const img = await compressCanvasImage(canvas, DWG_MAX_EDGE, 0.92);
    return { ...img, snapSegments };
  } finally {
    try {
      libredwg.dwg_free(ptr);
    } catch {
      /* ignore */
    }
  }
}

async function tryOdaConvert(
  file: File,
): Promise<(CompressedImage & { snapSegments?: UnderlaySnapSegment[] }) | null> {
  try {
    const fd = new FormData();
    fd.append("file", file, file.name);
    const res = await fetch("/api/convert-dwg", { method: "POST", body: fd });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    const blob = await res.blob();
    if (ct.includes("pdf") || blob.type.includes("pdf")) {
      return rasterizePdfPage(await blob.arrayBuffer());
    }
    if (ct.includes("image") || blob.type.startsWith("image/")) {
      return compressImageFile(blob, DWG_MAX_EDGE);
    }
    if (ct.includes("json")) {
      const json = await blob.text();
      const data = JSON.parse(json) as {
        strokes?: Stroke[];
        bounds?: { minX: number; minY: number; maxX: number; maxY: number };
      };
      if (data.strokes && data.bounds) {
        const snapSegments = strokesToSnapSegmentsUv(
          data.strokes,
          data.bounds,
        );
        const img = await compressCanvasImage(
          strokesToCanvas(data.strokes, data.bounds),
          DWG_MAX_EDGE,
          0.92,
        );
        return { ...img, snapSegments };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Convert a DWG file into a compressed JPEG underlay image + snap lines. */
export async function rasterizeDwg(
  file: File,
): Promise<CompressedImage & { snapSegments: UnderlaySnapSegment[] }> {
  const viaOda = await tryOdaConvert(file);
  if (viaOda) {
    return {
      ...viaOda,
      snapSegments: viaOda.snapSegments ?? [],
    };
  }
  return rasterizeDwgWithLibreDwg(file);
}
