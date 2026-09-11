/**
 * CAD & PDF Floor Exporter (AutoCAD DWG / DXF & Architectural PDF)
 *
 * Generates true binary AutoCAD DWG files (AC1018 / AutoCAD 2004-2026),
 * spec-compliant AutoCAD DXF files (AC1009), and vector architectural PDFs
 * for any floor or level in the project.
 */

import JSZip from "jszip";
import { jsPDF } from "jspdf";
import {
  CadDocument,
  DwgWriter,
  Line,
  Circle,
  Arc,
  TextEntity,
  Layer,
  Color,
  ACadVersion,
  XYZ,
} from "@node-projects/acad-ts";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useAppStore } from "@/store/useAppStore";
import { downloadBlob } from "./markupFragSave";
import type { LayoutDoor, LayoutWindow } from "./layoutDrawing";

export type CadExportFormat = "dwg" | "dxf";

interface DxfEntity {
  type: "LINE" | "ARC" | "CIRCLE" | "TEXT";
  layer: string;
  data: Record<string, unknown>;
}

export class DxfDocument {
  private entities: DxfEntity[] = [];
  private minX = Infinity;
  private minY = Infinity;
  private maxX = -Infinity;
  private maxY = -Infinity;

  private updateBounds(x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.minX = Math.min(this.minX, x);
    this.minY = Math.min(this.minY, y);
    this.maxX = Math.max(this.maxX, x);
    this.maxY = Math.max(this.maxY, y);
  }

  addLine(layer: string, x1: number, y1: number, x2: number, y2: number) {
    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return;
    this.updateBounds(x1, y1);
    this.updateBounds(x2, y2);
    this.entities.push({
      type: "LINE",
      layer,
      data: { x1, y1, x2, y2 },
    });
  }

  addPolyline(layer: string, points: { x: number; y: number }[], closed = false) {
    if (points.length < 2) return;
    const valid = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (valid.length < 2) return;
    for (let i = 0; i < valid.length - 1; i++) {
      this.addLine(layer, valid[i].x, valid[i].y, valid[i + 1].x, valid[i + 1].y);
    }
    if (closed && valid.length > 2) {
      this.addLine(layer, valid[valid.length - 1].x, valid[valid.length - 1].y, valid[0].x, valid[0].y);
    }
  }

  addCircle(layer: string, cx: number, cy: number, radius: number) {
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || radius <= 0) return;
    this.updateBounds(cx - radius, cy - radius);
    this.updateBounds(cx + radius, cy + radius);
    this.entities.push({
      type: "CIRCLE",
      layer,
      data: { cx, cy, radius },
    });
  }

  addArc(layer: string, cx: number, cy: number, radius: number, startAngleDeg: number, endAngleDeg: number) {
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || radius <= 0) return;
    this.updateBounds(cx - radius, cy - radius);
    this.updateBounds(cx + radius, cy + radius);
    const s = ((startAngleDeg % 360) + 360) % 360;
    const e = ((endAngleDeg % 360) + 360) % 360;
    this.entities.push({
      type: "ARC",
      layer,
      data: { cx, cy, radius, startAngleDeg: s, endAngleDeg: e },
    });
  }

  addText(layer: string, text: string, x: number, y: number, height = 200, rotationDeg = 0) {
    if (!text || !Number.isFinite(x) || !Number.isFinite(y)) return;
    this.updateBounds(x, y);
    this.entities.push({
      type: "TEXT",
      layer,
      data: { text: text.replace(/[\r\n]+/g, " "), x, y, height, rotationDeg },
    });
  }

  toDxfString(): string {
    const extMinX = Number.isFinite(this.minX) ? Math.round(this.minX) : 0;
    const extMinY = Number.isFinite(this.minY) ? Math.round(this.minY) : 0;
    const extMaxX = Number.isFinite(this.maxX) ? Math.round(this.maxX) : 10000;
    const extMaxY = Number.isFinite(this.maxY) ? Math.round(this.maxY) : 10000;

    const layers: { name: string; color: number; lineType: string }[] = [
      { name: "0", color: 7, lineType: "CONTINUOUS" },
      { name: "A-WALL", color: 7, lineType: "CONTINUOUS" },
      { name: "A-WALL-CTR", color: 8, lineType: "CONTINUOUS" },
      { name: "A-DOOR", color: 2, lineType: "CONTINUOUS" },
      { name: "A-DOOR-SWNG", color: 1, lineType: "CONTINUOUS" },
      { name: "A-GLAZ", color: 4, lineType: "CONTINUOUS" },
      { name: "A-GLAZ-SILL", color: 8, lineType: "CONTINUOUS" },
      { name: "A-FLOR", color: 8, lineType: "CONTINUOUS" },
      { name: "A-ROOF", color: 9, lineType: "CONTINUOUS" },
      { name: "A-COLS", color: 6, lineType: "CONTINUOUS" },
      { name: "S-BEAM", color: 5, lineType: "CONTINUOUS" },
      { name: "A-STRS", color: 3, lineType: "CONTINUOUS" },
      { name: "A-STRS-UP", color: 3, lineType: "CONTINUOUS" },
      { name: "A-RAMP", color: 3, lineType: "CONTINUOUS" },
      { name: "M-DUCT", color: 4, lineType: "CONTINUOUS" },
      { name: "P-PIPE", color: 5, lineType: "CONTINUOUS" },
      { name: "E-CABL", color: 30, lineType: "CONTINUOUS" },
      { name: "M-EQPM", color: 2, lineType: "CONTINUOUS" },
      { name: "A-ANNO-DIMS", color: 3, lineType: "CONTINUOUS" },
      { name: "A-ANNO-NOTE", color: 7, lineType: "CONTINUOUS" },
      { name: "A-ANNO-LINE", color: 1, lineType: "CONTINUOUS" },
      { name: "A-GRID", color: 8, lineType: "CONTINUOUS" },
      { name: "A-ROOM-BNDY", color: 252, lineType: "CONTINUOUS" },
      { name: "A-ROOM-NAME", color: 7, lineType: "CONTINUOUS" },
      { name: "A-REF-PLAN", color: 8, lineType: "CONTINUOUS" },
    ];

    const lines: string[] = [];

    // 1. HEADER SECTION (AutoCAD R12 AC1009 format)
    lines.push("0", "SECTION", "2", "HEADER");
    lines.push("9", "$ACADVER", "1", "AC1009");
    lines.push("9", "$EXTMIN", "10", extMinX.toFixed(3), "20", extMinY.toFixed(3), "30", "0.0");
    lines.push("9", "$EXTMAX", "10", extMaxX.toFixed(3), "20", extMaxY.toFixed(3), "30", "0.0");
    lines.push("0", "ENDSEC");

    // 2. TABLES SECTION
    lines.push("0", "SECTION", "2", "TABLES");

    // Layers Table
    lines.push("0", "TABLE", "2", "LAYER", "70", String(layers.length));
    for (const l of layers) {
      lines.push("0", "LAYER", "2", l.name, "70", "0", "62", String(l.color), "6", "CONTINUOUS");
    }
    lines.push("0", "ENDTAB");
    lines.push("0", "ENDSEC");

    // 3. BLOCKS SECTION
    lines.push("0", "SECTION", "2", "BLOCKS");
    lines.push("0", "ENDSEC");

    // 4. ENTITIES SECTION
    lines.push("0", "SECTION", "2", "ENTITIES");
    for (const ent of this.entities) {
      if (ent.type === "LINE") {
        const d = ent.data as { x1: number; y1: number; x2: number; y2: number };
        lines.push(
          "0", "LINE",
          "8", ent.layer,
          "10", d.x1.toFixed(3),
          "20", d.y1.toFixed(3),
          "30", "0.0",
          "11", d.x2.toFixed(3),
          "21", d.y2.toFixed(3),
          "31", "0.0",
        );
      } else if (ent.type === "CIRCLE") {
        const d = ent.data as { cx: number; cy: number; radius: number };
        lines.push(
          "0", "CIRCLE",
          "8", ent.layer,
          "10", d.cx.toFixed(3),
          "20", d.cy.toFixed(3),
          "30", "0.0",
          "40", d.radius.toFixed(3),
        );
      } else if (ent.type === "ARC") {
        const d = ent.data as { cx: number; cy: number; radius: number; startAngleDeg: number; endAngleDeg: number };
        lines.push(
          "0", "ARC",
          "8", ent.layer,
          "10", d.cx.toFixed(3),
          "20", d.cy.toFixed(3),
          "30", "0.0",
          "40", d.radius.toFixed(3),
          "50", d.startAngleDeg.toFixed(2),
          "51", d.endAngleDeg.toFixed(2),
        );
      } else if (ent.type === "TEXT") {
        const d = ent.data as { text: string; x: number; y: number; height: number; rotationDeg: number };
        lines.push(
          "0", "TEXT",
          "8", ent.layer,
          "10", d.x.toFixed(3),
          "20", d.y.toFixed(3),
          "30", "0.0",
          "40", d.height.toFixed(2),
          "1", d.text,
        );
        if (d.rotationDeg !== 0) {
          lines.push("50", d.rotationDeg.toFixed(2));
        }
      }
    }
    lines.push("0", "ENDSEC");

    // 5. EOF
    lines.push("0", "EOF");
    return lines.join("\r\n") + "\r\n";
  }
}

/**
 * Builds a spec-compliant CadDocument instance for a given floor / level.
 */
export function buildCadDocument(floorId: string | null): CadDocument {
  const doc = new CadDocument();
  doc.header!.version = ACadVersion.AC1018; // AutoCAD 2004 binary DWG (supported by 2004-2026)

  const layout = useLayoutDrawingStore.getState();
  const markup = useToolMarkupStore.getState();
  const app = useAppStore.getState();

  const level = layout.levels.find((l) => l.id === floorId) ?? layout.levels[0];
  const targetLevelId = floorId ?? level?.id ?? null;

  // Setup Standard AIA CAD Layers
  const layerDefs: { name: string; color: number }[] = [
    { name: "A-WALL", color: 7 },
    { name: "A-WALL-CTR", color: 8 },
    { name: "A-DOOR", color: 2 },
    { name: "A-DOOR-SWNG", color: 1 },
    { name: "A-GLAZ", color: 4 },
    { name: "A-GLAZ-SILL", color: 8 },
    { name: "A-FLOR", color: 8 },
    { name: "A-ROOF", color: 9 },
    { name: "A-COLS", color: 6 },
    { name: "S-BEAM", color: 5 },
    { name: "A-STRS", color: 3 },
    { name: "A-STRS-UP", color: 3 },
    { name: "A-RAMP", color: 3 },
    { name: "M-DUCT", color: 4 },
    { name: "P-PIPE", color: 5 },
    { name: "E-CABL", color: 30 },
    { name: "M-EQPM", color: 2 },
    { name: "A-ANNO-DIMS", color: 3 },
    { name: "A-ANNO-NOTE", color: 7 },
    { name: "A-ANNO-LINE", color: 1 },
    { name: "A-GRID", color: 8 },
    { name: "A-ROOM-BNDY", color: 252 },
    { name: "A-ROOM-NAME", color: 7 },
    { name: "A-REF-PLAN", color: 8 },
  ];

  const layerMap = new Map<string, Layer>();
  for (const def of layerDefs) {
    const l = new Layer(def.name);
    try {
      l.color = new Color(def.color);
    } catch {
      // default color
    }
    doc.layers!.add(l);
    layerMap.set(def.name, l);
  }

  const addLine = (layerName: string, x1: number, y1: number, x2: number, y2: number) => {
    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return;
    const l = new Line();
    const lay = layerMap.get(layerName);
    if (lay) l.layer = lay;
    l.startPoint = new XYZ(x1, y1, 0);
    l.endPoint = new XYZ(x2, y2, 0);
    doc.entities!.add(l);
  };

  const addPolyline = (layerName: string, points: { x: number; y: number }[], closed = false) => {
    if (points.length < 2) return;
    const valid = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (valid.length < 2) return;
    for (let i = 0; i < valid.length - 1; i++) {
      addLine(layerName, valid[i].x, valid[i].y, valid[i + 1].x, valid[i + 1].y);
    }
    if (closed && valid.length > 2) {
      addLine(layerName, valid[valid.length - 1].x, valid[valid.length - 1].y, valid[0].x, valid[0].y);
    }
  };

  const addCircle = (layerName: string, cx: number, cy: number, radius: number) => {
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || radius <= 0) return;
    const c = new Circle();
    const lay = layerMap.get(layerName);
    if (lay) c.layer = lay;
    c.center = new XYZ(cx, cy, 0);
    c.radius = radius;
    doc.entities!.add(c);
  };

  const addArc = (layerName: string, cx: number, cy: number, radius: number, startDeg: number, endDeg: number) => {
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || radius <= 0) return;
    const a = new Arc();
    const lay = layerMap.get(layerName);
    if (lay) a.layer = lay;
    a.center = new XYZ(cx, cy, 0);
    a.radius = radius;
    a.startAngle = ((startDeg % 360) * Math.PI) / 180;
    a.endAngle = ((endDeg % 360) * Math.PI) / 180;
    doc.entities!.add(a);
  };

  const addText = (layerName: string, text: string, x: number, y: number, height = 200, rotDeg = 0) => {
    if (!text || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const t = new TextEntity();
    const lay = layerMap.get(layerName);
    if (lay) t.layer = lay;
    t.insertPoint = new XYZ(x, y, 0);
    t.value = text.replace(/[\r\n]+/g, " ");
    t.height = height;
    if (rotDeg !== 0) t.rotation = (rotDeg * Math.PI) / 180;
    doc.entities!.add(t);
  };

  // 1. WALLS with Door & Window Opening Cuts
  const walls = layout.walls.filter((w) => !targetLevelId || w.levelId === targetLevelId);
  const doors = layout.doors;
  const windows = layout.windows;

  for (const wall of walls) {
    const x1 = wall.startXmm;
    const y1 = wall.startYmm;
    const x2 = wall.endXmm;
    const y2 = wall.endYmm;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;

    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const halfT = (wall.thicknessMm || 200) / 2;

    addLine("A-WALL-CTR", x1, y1, x2, y2);

    const wallDoors = doors.filter((d) => d.wallId === wall.id);
    const wallWindows = windows.filter((w) => w.wallId === wall.id);

    type Interval = { start: number; end: number; kind: "door" | "window"; item: LayoutDoor | LayoutWindow };
    const intervals: Interval[] = [];

    for (const d of wallDoors) {
      const p = d.positionMm;
      const w = d.widthMm || 900;
      intervals.push({ start: Math.max(0, p - w / 2), end: Math.min(len, p + w / 2), kind: "door", item: d });
    }
    for (const win of wallWindows) {
      const p = win.positionMm;
      const w = win.widthMm || 1200;
      intervals.push({ start: Math.max(0, p - w / 2), end: Math.min(len, p + w / 2), kind: "window", item: win });
    }
    intervals.sort((a, b) => a.start - b.start);

    let curT = 0;
    for (const seg of intervals) {
      if (seg.start > curT + 5) {
        addLine(
          "A-WALL",
          x1 + curT * ux + nx * halfT,
          y1 + curT * uy + ny * halfT,
          x1 + seg.start * ux + nx * halfT,
          y1 + seg.start * uy + ny * halfT,
        );
        addLine(
          "A-WALL",
          x1 + curT * ux - nx * halfT,
          y1 + curT * uy - ny * halfT,
          x1 + seg.start * ux - nx * halfT,
          y1 + seg.start * uy - ny * halfT,
        );
      }

      const oSx = x1 + seg.start * ux;
      const oSy = y1 + seg.start * uy;
      const oEx = x1 + seg.end * ux;
      const oEy = y1 + seg.end * uy;

      if (seg.kind === "door") {
        const door = seg.item as LayoutDoor;
        const doorW = seg.end - seg.start;
        addLine("A-WALL", oSx + nx * halfT, oSy + ny * halfT, oSx - nx * halfT, oSy - ny * halfT);
        addLine("A-WALL", oEx + nx * halfT, oEy + ny * halfT, oEx - nx * halfT, oEy - ny * halfT);

        const isStartHinge = door.hinge !== "end";
        const hingeX = isStartHinge ? oSx : oEx;
        const hingeY = isStartHinge ? oSy : oEy;
        const swingSide = (door.swing ?? 1) > 0 ? 1 : -1;
        const leafNx = nx * swingSide;
        const leafNy = ny * swingSide;

        addLine("A-DOOR", hingeX, hingeY, hingeX + leafNx * doorW, hingeY + leafNy * doorW);

        const wallAngleDeg = (Math.atan2(uy, ux) * 180) / Math.PI;
        const normalAngleDeg = (Math.atan2(leafNy, leafNx) * 180) / Math.PI;
        const closedAngleDeg = isStartHinge ? wallAngleDeg : wallAngleDeg + 180;
        addArc("A-DOOR-SWNG", hingeX, hingeY, doorW, Math.min(closedAngleDeg, normalAngleDeg), Math.max(closedAngleDeg, normalAngleDeg));
      } else if (seg.kind === "window") {
        addLine("A-GLAZ", oSx + nx * halfT, oSy + ny * halfT, oSx - nx * halfT, oSy - ny * halfT);
        addLine("A-GLAZ", oEx + nx * halfT, oEy + ny * halfT, oEx - nx * halfT, oEy - ny * halfT);
        addLine("A-GLAZ-SILL", oSx + nx * halfT, oSy + ny * halfT, oEx + nx * halfT, oEy + ny * halfT);
        addLine("A-GLAZ-SILL", oSx - nx * halfT, oSy - ny * halfT, oEx - nx * halfT, oEy - ny * halfT);
        const glassOffset = Math.min(25, halfT * 0.25);
        addLine("A-GLAZ", oSx + nx * glassOffset, oSy + ny * glassOffset, oEx + nx * glassOffset, oEy + ny * glassOffset);
        addLine("A-GLAZ", oSx - nx * glassOffset, oSy - ny * glassOffset, oEx - nx * glassOffset, oEy - ny * glassOffset);
      }

      curT = Math.max(curT, seg.end);
    }

    if (curT < len - 5) {
      addLine("A-WALL", x1 + curT * ux + nx * halfT, y1 + curT * uy + ny * halfT, x2 + nx * halfT, y2 + ny * halfT);
      addLine("A-WALL", x1 + curT * ux - nx * halfT, y1 + curT * uy - ny * halfT, x2 - nx * halfT, y2 - ny * halfT);
    }

    addLine("A-WALL", x1 + nx * halfT, y1 + ny * halfT, x1 - nx * halfT, y1 - ny * halfT);
    addLine("A-WALL", x2 + nx * halfT, y2 + ny * halfT, x2 - nx * halfT, y2 - ny * halfT);
  }

  // 2. SLABS
  const slabs = layout.slabs.filter((s) => !targetLevelId || s.levelId === targetLevelId);
  for (const slab of slabs) {
    const layerName = slab.kind === "roof" ? "A-ROOF" : "A-FLOR";
    const pts = slab.boundary && slab.boundary.length >= 3
      ? slab.boundary.map((p) => ({ x: p.xMm, y: p.yMm }))
      : [
          { x: slab.minXmm, y: slab.minYmm },
          { x: slab.maxXmm, y: slab.minYmm },
          { x: slab.maxXmm, y: slab.maxYmm },
          { x: slab.minXmm, y: slab.maxYmm },
        ];
    addPolyline(layerName, pts, true);
    if (slab.holes) {
      for (const hole of slab.holes) {
        if (hole.length >= 3) addPolyline(layerName, hole.map((p) => ({ x: p.xMm, y: p.yMm })), true);
      }
    }
  }

  // 3. COLUMNS
  const columns = layout.columns.filter((c) => !targetLevelId || c.levelId === targetLevelId);
  for (const col of columns) {
    const cx = col.xMm;
    const cy = col.yMm;
    const w = col.widthMm || 400;
    const d = col.depthMm || w;
    const rotRad = ((col.rotationDeg || 0) * Math.PI) / 180;
    const cos = Math.cos(rotRad);
    const sin = Math.sin(rotRad);

    if (col.profile === "circle") {
      addCircle("A-COLS", cx, cy, w / 2);
    } else {
      const hw = w / 2;
      const hd = d / 2;
      const corners = [
        { x: -hw, y: -hd },
        { x: hw, y: -hd },
        { x: hw, y: hd },
        { x: -hw, y: hd },
      ].map((p) => ({
        x: cx + p.x * cos - p.y * sin,
        y: cy + p.x * sin + p.y * cos,
      }));
      addPolyline("A-COLS", corners, true);
    }
  }

  // 4. BEAMS
  const beams = layout.beams.filter((b) => !targetLevelId || b.levelId === targetLevelId);
  for (const beam of beams) {
    const x1 = beam.startXmm;
    const y1 = beam.startYmm;
    const x2 = beam.endXmm;
    const y2 = beam.endYmm;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const nx = -dy / len;
    const ny = dx / len;
    const halfW = (beam.widthMm || 200) / 2;
    addLine("S-BEAM", x1, y1, x2, y2);
    addLine("S-BEAM", x1 + nx * halfW, y1 + ny * halfW, x2 + nx * halfW, y2 + ny * halfW);
    addLine("S-BEAM", x1 - nx * halfW, y1 - ny * halfW, x2 - nx * halfW, y2 - ny * halfW);
    addLine("S-BEAM", x1 + nx * halfW, y1 + ny * halfW, x1 - nx * halfW, y1 - ny * halfW);
    addLine("S-BEAM", x2 + nx * halfW, y2 + ny * halfW, x2 - nx * halfW, y2 - ny * halfW);
  }

  // 5. STAIRS & RAMPS
  const stairs = layout.stairs.filter((st) => !targetLevelId || st.levelId === targetLevelId);
  for (const stair of stairs) {
    const x1 = stair.startXmm;
    const y1 = stair.startYmm;
    const x2 = stair.endXmm;
    const y2 = stair.endYmm;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const halfW = (stair.widthMm || 1000) / 2;

    addPolyline("A-STRS", [
      { x: x1 + nx * halfW, y: y1 + ny * halfW },
      { x: x2 + nx * halfW, y: y2 + ny * halfW },
      { x: x2 - nx * halfW, y: y2 - ny * halfW },
      { x: x1 - nx * halfW, y: y1 - ny * halfW },
    ], true);

    const treadDepth = Math.max(200, stair.treadDepthMm || 280);
    const numTreads = Math.max(2, Math.floor(len / treadDepth));
    const stepDist = len / numTreads;
    for (let i = 1; i < numTreads; i++) {
      const tx = x1 + i * stepDist * ux;
      const ty = y1 + i * stepDist * uy;
      addLine("A-STRS", tx + nx * halfW, ty + ny * halfW, tx - nx * halfW, ty - ny * halfW);
    }
    addLine("A-STRS-UP", x1, y1, x2, y2);
    const arrowLen = Math.min(250, len * 0.15);
    addLine("A-STRS-UP", x2, y2, x2 - ux * arrowLen + nx * arrowLen * 0.5, y2 - uy * arrowLen + ny * arrowLen * 0.5);
    addLine("A-STRS-UP", x2, y2, x2 - ux * arrowLen - nx * arrowLen * 0.5, y2 - uy * arrowLen - ny * arrowLen * 0.5);
    addText("A-STRS-UP", "UP", (x1 + x2) / 2 + nx * (halfW + 150), (y1 + y2) / 2 + ny * (halfW + 150), 180);
  }

  // 6. MEP (Ducts, Pipes, Cable Trays, Equipment)
  for (const duct of layout.ducts.filter((d) => !targetLevelId || d.levelId === targetLevelId)) {
    const dx = duct.endXmm - duct.startXmm;
    const dy = duct.endYmm - duct.startYmm;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const halfW = (duct.widthMm || 300) / 2;
    const nx = (-dy / len) * halfW;
    const ny = (dx / len) * halfW;
    addLine("M-DUCT", duct.startXmm + nx, duct.startYmm + ny, duct.endXmm + nx, duct.endYmm + ny);
    addLine("M-DUCT", duct.startXmm - nx, duct.startYmm - ny, duct.endXmm - nx, duct.endYmm - ny);
    addLine("M-DUCT", duct.startXmm, duct.startYmm, duct.endXmm, duct.endYmm);
  }

  for (const pipe of layout.pipes.filter((p) => !targetLevelId || p.levelId === targetLevelId)) {
    const dx = pipe.endXmm - pipe.startXmm;
    const dy = pipe.endYmm - pipe.startYmm;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const halfD = (pipe.diameterMm || 50) / 2;
    const nx = (-dy / len) * halfD;
    const ny = (dx / len) * halfD;
    addLine("P-PIPE", pipe.startXmm + nx, pipe.startYmm + ny, pipe.endXmm + nx, pipe.endYmm + ny);
    addLine("P-PIPE", pipe.startXmm - nx, pipe.startYmm - ny, pipe.endXmm - nx, pipe.endYmm - ny);
  }

  // 7. GRID LINES
  for (const gl of layout.gridLines) {
    addLine("A-GRID", gl.startXmm, gl.startYmm, gl.endXmm, gl.endYmm);
    const bubbleRadius = 350;
    addCircle("A-GRID", gl.startXmm, gl.startYmm, bubbleRadius);
    addCircle("A-GRID", gl.endXmm, gl.endYmm, bubbleRadius);
    addText("A-GRID", gl.label || "", gl.startXmm - 120, gl.startYmm - 80, 240);
    addText("A-GRID", gl.label || "", gl.endXmm - 120, gl.endYmm - 80, 240);
  }

  // 8. 2D SKETCH LINES
  for (const sl of layout.sketchLines.filter((l) => !targetLevelId || l.levelId === targetLevelId)) {
    addLine("A-ANNO-LINE", sl.startXmm, sl.startYmm, sl.endXmm, sl.endYmm);
  }

  // 9. DIMENSIONS
  for (const m of markup.measurements.filter((meas) => !targetLevelId || meas.floorId === targetLevelId)) {
    if (m.mode === "distance" && m.points && m.points.length >= 2) {
      const p1 = m.points[0];
      const p2 = m.points[1];
      const x1 = p1.x * 1000;
      const y1 = p1.z * 1000;
      const x2 = p2.x * 1000;
      const y2 = p2.z * 1000;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const distMm = Math.round(Math.hypot(dx, dy));
      addLine("A-ANNO-DIMS", x1, y1, x2, y2);
      const nx = (-dy / (distMm || 1)) * 120;
      const ny = (dx / (distMm || 1)) * 120;
      addLine("A-ANNO-DIMS", x1 - nx, y1 - ny, x1 + nx, y1 + ny);
      addLine("A-ANNO-DIMS", x2 - nx, y2 - ny, x2 + nx, y2 + ny);
      addText("A-ANNO-DIMS", `${distMm} mm`, (x1 + x2) / 2 + nx * 1.5, (y1 + y2) / 2 + ny * 1.5, 160);
    }
  }

  // 10. ROOM LABELS
  const rooms = app.rooms.filter((r) => !targetLevelId || r.floorId === targetLevelId);
  for (const room of rooms) {
    if (room.geometry) {
      const posAttr = room.geometry.getAttribute("position");
      if (posAttr && posAttr.count >= 3) {
        let sumX = 0;
        let sumZ = 0;
        let count = 0;
        for (let i = 0; i < posAttr.count; i++) {
          const rx = posAttr.getX(i) * 1000;
          const rz = posAttr.getZ(i) * 1000;
          if (Number.isFinite(rx) && Number.isFinite(rz)) {
            sumX += rx;
            sumZ += rz;
            count++;
          }
        }
        if (count > 0) {
          const avgX = sumX / count;
          const avgZ = sumZ / count;
          const roomLabel = room.name ? `${room.name} (${room.number || ""})` : `Room ${room.number || ""}`;
          addText("A-ROOM-NAME", roomLabel, avgX, avgZ, 200);
          if (room.heatLoad) {
            addText("A-ROOM-NAME", `Heat Load: ${room.heatLoad.toFixed(0)} W/m²`, avgX, avgZ - 250, 150);
          }
        }
      }
    }
  }

  return doc;
}

/**
 * Generates a true binary AutoCAD .dwg file buffer for the given floor.
 */
export function generateFloorDwgBuffer(floorId: string | null): Uint8Array {
  const doc = buildCadDocument(floorId);
  return DwgWriter.writeToBuffer(doc);
}

/**
 * Compiles a specific floor / level into a standard AutoCAD DXF document.
 */
export function generateFloorDxf(floorId: string | null): string {
  const doc = new DxfDocument();
  const layout = useLayoutDrawingStore.getState();
  const markup = useToolMarkupStore.getState();
  const app = useAppStore.getState();

  const level = layout.levels.find((l) => l.id === floorId) ?? layout.levels[0];
  const targetLevelId = floorId ?? level?.id ?? null;

  // 1. WALLS with Opening Cuts
  const walls = layout.walls.filter((w) => !targetLevelId || w.levelId === targetLevelId);
  const doors = layout.doors;
  const windows = layout.windows;

  for (const wall of walls) {
    const x1 = wall.startXmm;
    const y1 = wall.startYmm;
    const x2 = wall.endXmm;
    const y2 = wall.endYmm;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;

    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const halfT = (wall.thicknessMm || 200) / 2;

    doc.addLine("A-WALL-CTR", x1, y1, x2, y2);

    const wallDoors = doors.filter((d) => d.wallId === wall.id);
    const wallWindows = windows.filter((w) => w.wallId === wall.id);

    type Interval = { start: number; end: number; kind: "door" | "window"; item: LayoutDoor | LayoutWindow };
    const intervals: Interval[] = [];

    for (const d of wallDoors) {
      const p = d.positionMm;
      const w = d.widthMm || 900;
      intervals.push({ start: Math.max(0, p - w / 2), end: Math.min(len, p + w / 2), kind: "door", item: d });
    }
    for (const win of wallWindows) {
      const p = win.positionMm;
      const w = win.widthMm || 1200;
      intervals.push({ start: Math.max(0, p - w / 2), end: Math.min(len, p + w / 2), kind: "window", item: win });
    }
    intervals.sort((a, b) => a.start - b.start);

    let curT = 0;
    for (const seg of intervals) {
      if (seg.start > curT + 5) {
        doc.addLine("A-WALL", x1 + curT * ux + nx * halfT, y1 + curT * uy + ny * halfT, x1 + seg.start * ux + nx * halfT, y1 + seg.start * uy + ny * halfT);
        doc.addLine("A-WALL", x1 + curT * ux - nx * halfT, y1 + curT * uy - ny * halfT, x1 + seg.start * ux - nx * halfT, y1 + seg.start * uy - ny * halfT);
      }

      const oSx = x1 + seg.start * ux;
      const oSy = y1 + seg.start * uy;
      const oEx = x1 + seg.end * ux;
      const oEy = y1 + seg.end * uy;

      if (seg.kind === "door") {
        const door = seg.item as LayoutDoor;
        const doorW = seg.end - seg.start;
        doc.addLine("A-WALL", oSx + nx * halfT, oSy + ny * halfT, oSx - nx * halfT, oSy - ny * halfT);
        doc.addLine("A-WALL", oEx + nx * halfT, oEy + ny * halfT, oEx - nx * halfT, oEy - ny * halfT);

        const isStartHinge = door.hinge !== "end";
        const hingeX = isStartHinge ? oSx : oEx;
        const hingeY = isStartHinge ? oSy : oEy;
        const swingSide = (door.swing ?? 1) > 0 ? 1 : -1;
        const leafNx = nx * swingSide;
        const leafNy = ny * swingSide;

        doc.addLine("A-DOOR", hingeX, hingeY, hingeX + leafNx * doorW, hingeY + leafNy * doorW);

        const wallAngleDeg = (Math.atan2(uy, ux) * 180) / Math.PI;
        const normalAngleDeg = (Math.atan2(leafNy, leafNx) * 180) / Math.PI;
        const closedAngleDeg = isStartHinge ? wallAngleDeg : wallAngleDeg + 180;
        doc.addArc("A-DOOR-SWNG", hingeX, hingeY, doorW, Math.min(closedAngleDeg, normalAngleDeg), Math.max(closedAngleDeg, normalAngleDeg));
      } else if (seg.kind === "window") {
        doc.addLine("A-GLAZ", oSx + nx * halfT, oSy + ny * halfT, oSx - nx * halfT, oSy - ny * halfT);
        doc.addLine("A-GLAZ", oEx + nx * halfT, oEy + ny * halfT, oEx - nx * halfT, oEy - ny * halfT);
        doc.addLine("A-GLAZ-SILL", oSx + nx * halfT, oSy + ny * halfT, oEx + nx * halfT, oEy + ny * halfT);
        doc.addLine("A-GLAZ-SILL", oSx - nx * halfT, oSy - ny * halfT, oEx - nx * halfT, oEy - ny * halfT);
        const glassOffset = Math.min(25, halfT * 0.25);
        doc.addLine("A-GLAZ", oSx + nx * glassOffset, oSy + ny * glassOffset, oEx + nx * glassOffset, oEy + ny * glassOffset);
        doc.addLine("A-GLAZ", oSx - nx * glassOffset, oSy - ny * glassOffset, oEx - nx * glassOffset, oEy - ny * glassOffset);
      }

      curT = Math.max(curT, seg.end);
    }

    if (curT < len - 5) {
      doc.addLine("A-WALL", x1 + curT * ux + nx * halfT, y1 + curT * uy + ny * halfT, x2 + nx * halfT, y2 + ny * halfT);
      doc.addLine("A-WALL", x1 + curT * ux - nx * halfT, y1 + curT * uy - ny * halfT, x2 - nx * halfT, y2 - ny * halfT);
    }

    doc.addLine("A-WALL", x1 + nx * halfT, y1 + ny * halfT, x1 - nx * halfT, y1 - ny * halfT);
    doc.addLine("A-WALL", x2 + nx * halfT, y2 + ny * halfT, x2 - nx * halfT, y2 - ny * halfT);
  }

  // 2. SLABS
  const slabs = layout.slabs.filter((s) => !targetLevelId || s.levelId === targetLevelId);
  for (const slab of slabs) {
    const layerName = slab.kind === "roof" ? "A-ROOF" : "A-FLOR";
    const pts = slab.boundary && slab.boundary.length >= 3
      ? slab.boundary.map((p) => ({ x: p.xMm, y: p.yMm }))
      : [
          { x: slab.minXmm, y: slab.minYmm },
          { x: slab.maxXmm, y: slab.minYmm },
          { x: slab.maxXmm, y: slab.maxYmm },
          { x: slab.minXmm, y: slab.maxYmm },
        ];
    doc.addPolyline(layerName, pts, true);
    if (slab.holes) {
      for (const hole of slab.holes) {
        if (hole.length >= 3) doc.addPolyline(layerName, hole.map((p) => ({ x: p.xMm, y: p.yMm })), true);
      }
    }
  }

  // 3. COLUMNS
  const columns = layout.columns.filter((c) => !targetLevelId || c.levelId === targetLevelId);
  for (const col of columns) {
    const cx = col.xMm;
    const cy = col.yMm;
    const w = col.widthMm || 400;
    const d = col.depthMm || w;
    const rotRad = ((col.rotationDeg || 0) * Math.PI) / 180;
    const cos = Math.cos(rotRad);
    const sin = Math.sin(rotRad);

    if (col.profile === "circle") {
      doc.addCircle("A-COLS", cx, cy, w / 2);
    } else {
      const hw = w / 2;
      const hd = d / 2;
      const corners = [
        { x: -hw, y: -hd },
        { x: hw, y: -hd },
        { x: hw, y: hd },
        { x: -hw, y: hd },
      ].map((p) => ({
        x: cx + p.x * cos - p.y * sin,
        y: cy + p.x * sin + p.y * cos,
      }));
      doc.addPolyline("A-COLS", corners, true);
    }
  }

  // 4. BEAMS
  const beams = layout.beams.filter((b) => !targetLevelId || b.levelId === targetLevelId);
  for (const beam of beams) {
    const x1 = beam.startXmm;
    const y1 = beam.startYmm;
    const x2 = beam.endXmm;
    const y2 = beam.endYmm;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const nx = -dy / len;
    const ny = dx / len;
    const halfW = (beam.widthMm || 200) / 2;
    doc.addLine("S-BEAM", x1, y1, x2, y2);
    doc.addLine("S-BEAM", x1 + nx * halfW, y1 + ny * halfW, x2 + nx * halfW, y2 + ny * halfW);
    doc.addLine("S-BEAM", x1 - nx * halfW, y1 - ny * halfW, x2 - nx * halfW, y2 - ny * halfW);
    doc.addLine("S-BEAM", x1 + nx * halfW, y1 + ny * halfW, x1 - nx * halfW, y1 - ny * halfW);
    doc.addLine("S-BEAM", x2 + nx * halfW, y2 + ny * halfW, x2 - nx * halfW, y2 - ny * halfW);
  }

  // 5. STAIRS
  const stairs = layout.stairs.filter((st) => !targetLevelId || st.levelId === targetLevelId);
  for (const stair of stairs) {
    const x1 = stair.startXmm;
    const y1 = stair.startYmm;
    const x2 = stair.endXmm;
    const y2 = stair.endYmm;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const halfW = (stair.widthMm || 1000) / 2;

    doc.addPolyline("A-STRS", [
      { x: x1 + nx * halfW, y: y1 + ny * halfW },
      { x: x2 + nx * halfW, y: y2 + ny * halfW },
      { x: x2 - nx * halfW, y: y2 - ny * halfW },
      { x: x1 - nx * halfW, y: y1 - ny * halfW },
    ], true);

    const treadDepth = Math.max(200, stair.treadDepthMm || 280);
    const numTreads = Math.max(2, Math.floor(len / treadDepth));
    const stepDist = len / numTreads;
    for (let i = 1; i < numTreads; i++) {
      const tx = x1 + i * stepDist * ux;
      const ty = y1 + i * stepDist * uy;
      doc.addLine("A-STRS", tx + nx * halfW, ty + ny * halfW, tx - nx * halfW, ty - ny * halfW);
    }
    doc.addLine("A-STRS-UP", x1, y1, x2, y2);
    const arrowLen = Math.min(250, len * 0.15);
    doc.addLine("A-STRS-UP", x2, y2, x2 - ux * arrowLen + nx * arrowLen * 0.5, y2 - uy * arrowLen + ny * arrowLen * 0.5);
    doc.addLine("A-STRS-UP", x2, y2, x2 - ux * arrowLen - nx * arrowLen * 0.5, y2 - uy * arrowLen - ny * arrowLen * 0.5);
    doc.addText("A-STRS-UP", "UP", (x1 + x2) / 2 + nx * (halfW + 150), (y1 + y2) / 2 + ny * (halfW + 150), 180);
  }

  // 6. GRID LINES
  for (const gl of layout.gridLines) {
    doc.addLine("A-GRID", gl.startXmm, gl.startYmm, gl.endXmm, gl.endYmm);
    const bubbleRadius = 350;
    doc.addCircle("A-GRID", gl.startXmm, gl.startYmm, bubbleRadius);
    doc.addCircle("A-GRID", gl.endXmm, gl.endYmm, bubbleRadius);
    doc.addText("A-GRID", gl.label || "", gl.startXmm - 120, gl.startYmm - 80, 240);
    doc.addText("A-GRID", gl.label || "", gl.endXmm - 120, gl.endYmm - 80, 240);
  }

  // 7. SKETCH LINES
  for (const sl of layout.sketchLines.filter((l) => !targetLevelId || l.levelId === targetLevelId)) {
    doc.addLine("A-ANNO-LINE", sl.startXmm, sl.startYmm, sl.endXmm, sl.endYmm);
  }

  // 8. DIMENSIONS
  for (const m of markup.measurements.filter((meas) => !targetLevelId || meas.floorId === targetLevelId)) {
    if (m.mode === "distance" && m.points && m.points.length >= 2) {
      const p1 = m.points[0];
      const p2 = m.points[1];
      const x1 = p1.x * 1000;
      const y1 = p1.z * 1000;
      const x2 = p2.x * 1000;
      const y2 = p2.z * 1000;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const distMm = Math.round(Math.hypot(dx, dy));
      doc.addLine("A-ANNO-DIMS", x1, y1, x2, y2);
      const nx = (-dy / (distMm || 1)) * 120;
      const ny = (dx / (distMm || 1)) * 120;
      doc.addLine("A-ANNO-DIMS", x1 - nx, y1 - ny, x1 + nx, y1 + ny);
      doc.addLine("A-ANNO-DIMS", x2 - nx, y2 - ny, x2 + nx, y2 + ny);
      doc.addText("A-ANNO-DIMS", `${distMm} mm`, (x1 + x2) / 2 + nx * 1.5, (y1 + y2) / 2 + ny * 1.5, 160);
    }
  }

  // 9. ROOM LABELS
  const rooms = app.rooms.filter((r) => !targetLevelId || r.floorId === targetLevelId);
  for (const room of rooms) {
    if (room.geometry) {
      const posAttr = room.geometry.getAttribute("position");
      if (posAttr && posAttr.count >= 3) {
        let sumX = 0;
        let sumZ = 0;
        let count = 0;
        for (let i = 0; i < posAttr.count; i++) {
          const rx = posAttr.getX(i) * 1000;
          const rz = posAttr.getZ(i) * 1000;
          if (Number.isFinite(rx) && Number.isFinite(rz)) {
            sumX += rx;
            sumZ += rz;
            count++;
          }
        }
        if (count > 0) {
          const avgX = sumX / count;
          const avgZ = sumZ / count;
          const roomLabel = room.name ? `${room.name} (${room.number || ""})` : `Room ${room.number || ""}`;
          doc.addText("A-ROOM-NAME", roomLabel, avgX, avgZ, 200);
          if (room.heatLoad) {
            doc.addText("A-ROOM-NAME", `Heat Load: ${room.heatLoad.toFixed(0)} W/m²`, avgX, avgZ - 250, 150);
          }
        }
      }
    }
  }

  return doc.toDxfString();
}

/**
 * Downloads a single floor plan as an AutoCAD DWG or DXF file.
 */
export function downloadFloorCad(
  floorId: string | null,
  floorName?: string,
  format: CadExportFormat = "dxf",
): void {
  const layout = useLayoutDrawingStore.getState();
  const level = layout.levels.find((l) => l.id === floorId);
  const appFloor = useAppStore.getState().floors.find((f) => f.id === floorId);

  const cleanName = (floorName || level?.name || appFloor?.name || "Floor_Plan")
    .trim()
    .replace(/[^\w.-]+/g, "_");

  if (format === "dwg") {
    // Generate binary AutoCAD DWG file (AC1018)
    const dwgBuffer = generateFloorDwgBuffer(floorId);
    const blob = new Blob([dwgBuffer.buffer as ArrayBuffer], { type: "application/octet-stream" });
    downloadBlob(blob, `${cleanName}.dwg`);
  } else {
    // Generate spec-compliant AutoCAD ASCII DXF file (AC1009)
    const dxfContent = generateFloorDxf(floorId);
    const blob = new Blob([dxfContent], { type: "application/dxf" });
    downloadBlob(blob, `${cleanName}.dxf`);
  }
}

/**
 * Downloads multiple selected floors in CAD format.
 * If 1 floor is selected, downloads single file directly.
 * If multiple floors are selected, packages all into a single ZIP archive.
 */
export async function downloadSelectedFloorsCad(
  floorIds: string[],
  format: CadExportFormat = "dxf",
): Promise<void> {
  const layout = useLayoutDrawingStore.getState();
  const app = useAppStore.getState();

  const allLevels = layout.levels.length > 0
    ? layout.levels
    : app.floors.map((f) => ({ id: f.id, name: f.name }));

  const targetLevels = allLevels.filter((lvl) => floorIds.includes(lvl.id));
  const levelsToExport = targetLevels.length > 0 ? targetLevels : allLevels.slice(0, 1);

  if (levelsToExport.length === 1) {
    const single = levelsToExport[0];
    downloadFloorCad(single.id, single.name, format);
    return;
  }

  const zip = new JSZip();
  for (const lvl of levelsToExport) {
    const cleanName = (lvl.name || `Level_${lvl.id}`).trim().replace(/[^\w.-]+/g, "_");
    if (format === "dwg") {
      const dwgBytes = generateFloorDwgBuffer(lvl.id);
      zip.file(`${cleanName}_Floor_Plan.dwg`, dwgBytes);
    } else {
      const content = generateFloorDxf(lvl.id);
      zip.file(`${cleanName}_Floor_Plan.dxf`, content);
    }
  }

  const projName = (layout.projectId || app.activeModelLabel || "Project")
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w.-]+/g, "_");

  const zipBlob = await zip.generateAsync({ type: "blob" });
  downloadBlob(zipBlob, `${projName}_Selected_Floors_CAD_${format.toUpperCase()}.zip`);
}

/**
 * Downloads all floors in the project packaged into a single ZIP archive.
 */
export async function downloadAllFloorsCad(format: CadExportFormat = "dxf"): Promise<void> {
  const layout = useLayoutDrawingStore.getState();
  const app = useAppStore.getState();
  const allLevels = layout.levels.length > 0 ? layout.levels : app.floors.map((f) => ({ id: f.id, name: f.name }));
  const ids = allLevels.map((l) => l.id);
  await downloadSelectedFloorsCad(ids, format);
}

/**
 * Builds a vector architectural PDF page for a given floor / level.
 */
export function generateFloorPdfPage(
  floorId: string | null,
  doc?: jsPDF,
  isFirstPage = true,
): jsPDF {
  const layout = useLayoutDrawingStore.getState();
  const markup = useToolMarkupStore.getState();
  const app = useAppStore.getState();

  const level = layout.levels.find((l) => l.id === floorId) ?? layout.levels[0];
  const targetLevelId = floorId ?? level?.id ?? null;
  const levelName = level?.name || "Floor Plan";
  const elevationM = level ? (level.elevationMm / 1000).toFixed(2) : "0.00";
  const projectName = (layout.projectId || app.activeModelLabel || "Architectural Project")
    .replace(/\.[^.]+$/, "");

  // Page setup: A3 Landscape (420 x 297 mm)
  const pdf = doc || new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  if (!isFirstPage) {
    pdf.addPage("a3", "landscape");
  }

  const pageWidth = 420;
  const pageHeight = 297;
  const margin = 14;

  // 1. Title Block & Outer Frame (AIA architectural standard)
  pdf.setDrawColor(30, 41, 59);
  pdf.setLineWidth(0.6);
  pdf.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2);
  pdf.setLineWidth(0.2);
  pdf.rect(margin + 1.2, margin + 1.2, pageWidth - (margin + 1.2) * 2, pageHeight - (margin + 1.2) * 2);

  // Title Block in bottom right corner
  const tbW = 105;
  const tbH = 34;
  const tbX = pageWidth - margin - tbW;
  const tbY = pageHeight - margin - tbH;

  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(30, 41, 59);
  pdf.setLineWidth(0.35);
  pdf.rect(tbX, tbY, tbW, tbH, "FD");

  // Title block header band
  pdf.setFillColor(241, 245, 249);
  pdf.rect(tbX, tbY, tbW, 8, "FD");
  pdf.setTextColor(15, 23, 42);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(projectName.toUpperCase(), tbX + 4, tbY + 5.5);

  // Sheet contents in title block
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(levelName, tbX + 4, tbY + 16);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`Elevation: +${elevationM} m`, tbX + 4, tbY + 22);
  pdf.text(`Scale: 1:100 (Metric) · Date: ${new Date().toLocaleDateString()}`, tbX + 4, tbY + 28);

  // North Arrow at top-right
  const naX = pageWidth - margin - 16;
  const naY = margin + 18;
  pdf.setDrawColor(30, 41, 59);
  pdf.setLineWidth(0.4);
  pdf.circle(naX, naY, 6);
  pdf.setFillColor(30, 41, 59);
  pdf.triangle(naX, naY - 5.5, naX - 2.5, naY + 2, naX, naY, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(30, 41, 59);
  pdf.text("N", naX - 1.5, naY - 7.5);

  // 2. Compute Drawing Bounding Box
  const walls = layout.walls.filter((w) => !targetLevelId || w.levelId === targetLevelId);
  const slabs = layout.slabs.filter((s) => !targetLevelId || s.levelId === targetLevelId);
  const columns = layout.columns.filter((c) => !targetLevelId || c.levelId === targetLevelId);

  let bMinX = Infinity;
  let bMinY = Infinity;
  let bMaxX = -Infinity;
  let bMaxY = -Infinity;

  const trackPt = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    bMinX = Math.min(bMinX, x);
    bMinY = Math.min(bMinY, y);
    bMaxX = Math.max(bMaxX, x);
    bMaxY = Math.max(bMaxY, y);
  };

  for (const w of walls) {
    trackPt(w.startXmm, w.startYmm);
    trackPt(w.endXmm, w.endYmm);
  }
  for (const s of slabs) {
    trackPt(s.minXmm, s.minYmm);
    trackPt(s.maxXmm, s.maxYmm);
    if (s.boundary) {
      for (const p of s.boundary) trackPt(p.xMm, p.yMm);
    }
  }
  for (const col of columns) {
    trackPt(col.xMm, col.yMm);
  }

  if (!Number.isFinite(bMinX)) {
    bMinX = -5000;
    bMinY = -5000;
    bMaxX = 5000;
    bMaxY = 5000;
  }

  const pad = Math.max(1000, (bMaxX - bMinX) * 0.08);
  const boxW = (bMaxX - bMinX) + pad * 2;
  const boxH = (bMaxY - bMinY) + pad * 2;

  const printAreaX = margin + 8;
  const printAreaY = margin + 8;
  const printAreaW = pageWidth - margin * 2 - 16;
  const printAreaH = pageHeight - margin * 2 - 16;

  const scale = Math.min(printAreaW / boxW, printAreaH / boxH);
  const offsetX = printAreaX + (printAreaW - boxW * scale) / 2;
  const offsetY = printAreaY + (printAreaH - boxH * scale) / 2;

  const toX = (xMm: number) => offsetX + (xMm - (bMinX - pad)) * scale;
  const toY = (yMm: number) => offsetY + (boxH - (yMm - (bMinY - pad))) * scale;

  // 3. Draw Slabs
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.2);
  for (const s of slabs) {
    const pts = s.boundary && s.boundary.length >= 3
      ? s.boundary.map((p) => [toX(p.xMm), toY(p.yMm)])
      : [
          [toX(s.minXmm), toY(s.minYmm)],
          [toX(s.maxXmm), toY(s.minYmm)],
          [toX(s.maxXmm), toY(s.maxYmm)],
          [toX(s.minXmm), toY(s.maxYmm)],
        ];
    if (pts.length >= 3) {
      for (let i = 0; i < pts.length; i++) {
        const next = pts[(i + 1) % pts.length];
        pdf.line(pts[i][0], pts[i][1], next[0], next[1]);
      }
    }
  }

  // 4. Draw Walls
  const doors = layout.doors;
  const windows = layout.windows;
  pdf.setDrawColor(15, 23, 42);
  pdf.setLineWidth(0.45);

  for (const wall of walls) {
    const x1 = wall.startXmm;
    const y1 = wall.startYmm;
    const x2 = wall.endXmm;
    const y2 = wall.endYmm;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;

    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const halfT = (wall.thicknessMm || 200) / 2;

    const wallDoors = doors.filter((d) => d.wallId === wall.id);
    const wallWindows = windows.filter((w) => w.wallId === wall.id);
    type OpenInterval = { start: number; end: number; kind: "door" | "window"; item: LayoutDoor | LayoutWindow };
    const intervals: OpenInterval[] = [];

    for (const d of wallDoors) {
      const p = d.positionMm;
      const w = d.widthMm || 900;
      intervals.push({ start: Math.max(0, p - w / 2), end: Math.min(len, p + w / 2), kind: "door", item: d });
    }
    for (const win of wallWindows) {
      const p = win.positionMm;
      const w = win.widthMm || 1200;
      intervals.push({ start: Math.max(0, p - w / 2), end: Math.min(len, p + w / 2), kind: "window", item: win });
    }
    intervals.sort((a, b) => a.start - b.start);

    let cur = 0;
    for (const seg of intervals) {
      if (seg.start > cur + 5) {
        pdf.line(toX(x1 + cur * ux + nx * halfT), toY(y1 + cur * uy + ny * halfT), toX(x1 + seg.start * ux + nx * halfT), toY(y1 + seg.start * uy + ny * halfT));
        pdf.line(toX(x1 + cur * ux - nx * halfT), toY(y1 + cur * uy - ny * halfT), toX(x1 + seg.start * ux - nx * halfT), toY(y1 + seg.start * uy - ny * halfT));
      }

      const oSx = x1 + seg.start * ux;
      const oSy = y1 + seg.start * uy;
      const oEx = x1 + seg.end * ux;
      const oEy = y1 + seg.end * uy;

      if (seg.kind === "door") {
        pdf.setDrawColor(15, 23, 42);
        pdf.setLineWidth(0.35);
        pdf.line(toX(oSx + nx * halfT), toY(oSy + ny * halfT), toX(oSx - nx * halfT), toY(oSy - ny * halfT));
        pdf.line(toX(oEx + nx * halfT), toY(oEy + ny * halfT), toX(oEx - nx * halfT), toY(oEy - ny * halfT));

        const door = seg.item as LayoutDoor;
        const doorW = seg.end - seg.start;
        const isStartHinge = door.hinge !== "end";
        const hx = isStartHinge ? oSx : oEx;
        const hy = isStartHinge ? oSy : oEy;
        const swingSide = (door.swing ?? 1) > 0 ? 1 : -1;
        const lx = hx + nx * swingSide * doorW;
        const ly = hy + ny * swingSide * doorW;

        pdf.setDrawColor(180, 83, 9);
        pdf.setLineWidth(0.4);
        pdf.line(toX(hx), toY(hy), toX(lx), toY(ly));
      } else if (seg.kind === "window") {
        pdf.setDrawColor(15, 23, 42);
        pdf.setLineWidth(0.35);
        pdf.line(toX(oSx + nx * halfT), toY(oSy + ny * halfT), toX(oSx - nx * halfT), toY(oSy - ny * halfT));
        pdf.line(toX(oEx + nx * halfT), toY(oEy + ny * halfT), toX(oEx - nx * halfT), toY(oEy - ny * halfT));
        pdf.setDrawColor(14, 165, 233);
        pdf.setLineWidth(0.25);
        pdf.line(toX(oSx), toY(oSy), toX(oEx), toY(oEy));
      }

      cur = Math.max(cur, seg.end);
    }

    if (cur < len - 5) {
      pdf.setDrawColor(15, 23, 42);
      pdf.setLineWidth(0.45);
      pdf.line(toX(x1 + cur * ux + nx * halfT), toY(y1 + cur * uy + ny * halfT), toX(x2 + nx * halfT), toY(y2 + ny * halfT));
      pdf.line(toX(x1 + cur * ux - nx * halfT), toY(y1 + cur * uy - ny * halfT), toX(x2 - nx * halfT), toY(y2 - ny * halfT));
    }
  }

  // 5. Draw Columns
  pdf.setFillColor(15, 23, 42);
  pdf.setDrawColor(15, 23, 42);
  for (const col of columns) {
    const cx = toX(col.xMm);
    const cy = toY(col.yMm);
    const rw = (col.widthMm || 400) * scale;
    const rd = (col.depthMm || col.widthMm || 400) * scale;
    if (col.profile === "circle") {
      pdf.circle(cx, cy, rw / 2, "FD");
    } else {
      pdf.rect(cx - rw / 2, cy - rd / 2, rw, rd, "FD");
    }
  }

  // 6. Draw Grid Lines
  pdf.setDrawColor(148, 163, 184);
  pdf.setLineWidth(0.2);
  for (const gl of layout.gridLines) {
    pdf.line(toX(gl.startXmm), toY(gl.startYmm), toX(gl.endXmm), toY(gl.endYmm));
    const r = 350 * scale;
    pdf.circle(toX(gl.startXmm), toY(gl.startYmm), Math.max(2, r));
    pdf.circle(toX(gl.endXmm), toY(gl.endYmm), Math.max(2, r));
    if (gl.label) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(71, 85, 105);
      pdf.text(gl.label, toX(gl.startXmm) - 1, toY(gl.startYmm) + 1);
      pdf.text(gl.label, toX(gl.endXmm) - 1, toY(gl.endYmm) + 1);
    }
  }

  // 7. Draw Room Tags
  const rooms = app.rooms.filter((r) => !targetLevelId || r.floorId === targetLevelId);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(30, 41, 59);

  for (const room of rooms) {
    if (room.geometry) {
      const posAttr = room.geometry.getAttribute("position");
      if (posAttr && posAttr.count >= 3) {
        let sumX = 0;
        let sumZ = 0;
        let count = 0;
        for (let i = 0; i < posAttr.count; i++) {
          const rx = posAttr.getX(i) * 1000;
          const rz = posAttr.getZ(i) * 1000;
          if (Number.isFinite(rx) && Number.isFinite(rz)) {
            sumX += rx;
            sumZ += rz;
            count++;
          }
        }
        if (count > 0) {
          const tagX = toX(sumX / count);
          const tagY = toY(sumZ / count);
          const label = room.name || `Room ${room.number || ""}`;
          pdf.text(label, tagX, tagY, { align: "center" });
          if (room.heatLoad) {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(6.5);
            pdf.setTextColor(100, 116, 139);
            pdf.text(`${room.heatLoad.toFixed(0)} W/m²`, tagX, tagY + 3.5, { align: "center" });
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(8);
            pdf.setTextColor(30, 41, 59);
          }
        }
      }
    }
  }

  // 8. Draw Dimensions
  const measurements = markup.measurements.filter((m) => !targetLevelId || m.floorId === targetLevelId);
  for (const m of measurements) {
    if (m.mode === "distance" && m.points && m.points.length >= 2) {
      const p1 = m.points[0];
      const p2 = m.points[1];
      const x1 = toX(p1.x * 1000);
      const y1 = toY(p1.z * 1000);
      const x2 = toX(p2.x * 1000);
      const y2 = toY(p2.z * 1000);
      pdf.setDrawColor(217, 119, 6);
      pdf.setLineWidth(0.2);
      pdf.line(x1, y1, x2, y2);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      pdf.setTextColor(180, 83, 9);
      const distMm = Math.round(Math.hypot(p2.x - p1.x, p2.z - p1.z) * 1000);
      pdf.text(`${distMm} mm`, (x1 + x2) / 2, (y1 + y2) / 2 - 1, { align: "center" });
    }
  }

  return pdf;
}

/**
 * Downloads a single floor plan as a vector architectural PDF.
 */
export function downloadFloorPdf(floorId: string | null, floorName?: string): void {
  const pdf = generateFloorPdfPage(floorId, undefined, true);
  const layout = useLayoutDrawingStore.getState();
  const level = layout.levels.find((l) => l.id === floorId);
  const appFloor = useAppStore.getState().floors.find((f) => f.id === floorId);

  const cleanName = (floorName || level?.name || appFloor?.name || "Floor_Plan")
    .trim()
    .replace(/[^\w.-]+/g, "_");

  pdf.save(`${cleanName}_Architectural_Plan.pdf`);
}

/**
 * Downloads multiple selected floors as PDF.
 * If asZip is false, creates a multi-page PDF document.
 * If asZip is true, bundles each floor's individual PDF into a ZIP archive.
 */
export async function downloadSelectedFloorsPdf(
  floorIds: string[],
  asZip = false,
): Promise<void> {
  const layout = useLayoutDrawingStore.getState();
  const app = useAppStore.getState();

  const allLevels = layout.levels.length > 0
    ? layout.levels
    : app.floors.map((f) => ({ id: f.id, name: f.name }));

  const targetLevels = allLevels.filter((lvl) => floorIds.includes(lvl.id));
  const levelsToExport = targetLevels.length > 0 ? targetLevels : allLevels.slice(0, 1);

  const projName = (layout.projectId || app.activeModelLabel || "Project")
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w.-]+/g, "_");

  if (asZip) {
    const zip = new JSZip();
    for (const lvl of levelsToExport) {
      const pageDoc = generateFloorPdfPage(lvl.id, undefined, true);
      const pdfBlob = pageDoc.output("blob");
      const cleanName = (lvl.name || `Level_${lvl.id}`).trim().replace(/[^\w.-]+/g, "_");
      zip.file(`${cleanName}_Plan.pdf`, pdfBlob);
    }
    const zipBlob = await zip.generateAsync({ type: "blob" });
    downloadBlob(zipBlob, `${projName}_Selected_Floors_PDF.zip`);
  } else {
    let multiPdf: jsPDF | undefined;
    for (let i = 0; i < levelsToExport.length; i++) {
      multiPdf = generateFloorPdfPage(levelsToExport[i].id, multiPdf, i === 0);
    }
    if (multiPdf) {
      multiPdf.save(`${projName}_Floor_Plans_Set.pdf`);
    }
  }
}
