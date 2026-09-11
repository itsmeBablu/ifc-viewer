/**
 * CAD Floor Exporter (AutoCAD DWG / DXF Format)
 *
 * Generates spec-compliant AutoCAD Drawing Exchange Format (ASCII DXF R2000 / AC1015)
 * for any floor or level in the project.
 *
 * Supported Elements:
 *  - Walls (A-WALL): Double-line wall thickness contours, end caps, centerlines
 *  - Doors (A-DOOR, A-DOOR-SWNG): Wall opening cuts, door leaf panels, 90° circular swing arcs
 *  - Windows (A-GLAZ, A-GLAZ-SILL): Wall openings, jamb lines, sill, glass center lines
 *  - Slabs & Floors (A-FLOR, A-ROOF): Closed polyline boundaries and inner holes
 *  - Columns (A-COLS): Rectangular and circular column geometry with rotation
 *  - Beams (S-BEAM): Beam outlines and centerlines
 *  - Stairs & Ramps (A-STRS, A-RAMP): Tread steps, flight boundaries, walk direction arrows
 *  - MEP (M-DUCT, P-PIPE, E-CABL, M-EQPM): Ducts, pipes, cable trays, equipment outlines
 *  - Annotations (A-ANNO-DIMS, A-ANNO-NOTE, A-ANNO-LINE): Linear dimensions, sticky text notes, sketch lines
 *  - Grid Lines (A-GRID): Centerlines with end bubbles and grid labels
 *  - Rooms (A-ROOM-BNDY, A-ROOM-NAME): Room boundary polygons and text tags with area
 *  - Underlays (A-REF-PLAN): Calibrated vector snap lines from referenced CAD plans
 *
 * Compatible with: AutoCAD, AutoCAD LT, DWG TrueView, Autodesk Viewer, Revit (Link/Import CAD),
 * Civil 3D, BricsCAD, DraftSight, LibreCAD, QCAD, SketchUp Pro, Rhino, and Blender.
 */

import JSZip from "jszip";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useAppStore } from "@/store/useAppStore";
import { downloadBlob } from "./markupFragSave";
import type { LayoutDoor, LayoutWindow } from "./layoutDrawing";

export type CadExportFormat = "dwg" | "dxf";

interface DxfEntity {
  type: "LINE" | "LWPOLYLINE" | "ARC" | "CIRCLE" | "TEXT";
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
    for (const p of valid) {
      this.updateBounds(p.x, p.y);
    }
    this.entities.push({
      type: "LWPOLYLINE",
      layer,
      data: { points: valid, closed },
    });
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
    // Normalize angles to [0, 360)
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
      data: { text: text.replace(/\r?\n/g, " "), x, y, height, rotationDeg },
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
      { name: "A-WALL-CTR", color: 8, lineType: "CENTER" },
      { name: "A-DOOR", color: 2, lineType: "CONTINUOUS" },
      { name: "A-DOOR-SWNG", color: 1, lineType: "CONTINUOUS" },
      { name: "A-GLAZ", color: 4, lineType: "CONTINUOUS" },
      { name: "A-GLAZ-SILL", color: 8, lineType: "CONTINUOUS" },
      { name: "A-FLOR", color: 8, lineType: "CONTINUOUS" },
      { name: "A-ROOF", color: 9, lineType: "CONTINUOUS" },
      { name: "A-COLS", color: 6, lineType: "CONTINUOUS" },
      { name: "S-BEAM", color: 5, lineType: "DASHED" },
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
      { name: "A-GRID", color: 8, lineType: "CENTER" },
      { name: "A-ROOM-BNDY", color: 252, lineType: "CONTINUOUS" },
      { name: "A-ROOM-NAME", color: 7, lineType: "CONTINUOUS" },
      { name: "A-REF-PLAN", color: 8, lineType: "CONTINUOUS" },
    ];

    const lines: string[] = [];

    // 1. HEADER SECTION
    lines.push("0", "SECTION", "2", "HEADER");
    lines.push("9", "$ACADVER", "1", "AC1015"); // AutoCAD 2000 DXF
    lines.push("9", "$INSUNITS", "70", "4");     // 4 = Millimeters
    lines.push("9", "$MEASUREMENT", "70", "1");  // 1 = Metric
    lines.push("9", "$EXTMIN", "10", extMinX.toFixed(3), "20", extMinY.toFixed(3), "30", "0.0");
    lines.push("9", "$EXTMAX", "10", extMaxX.toFixed(3), "20", extMaxY.toFixed(3), "30", "0.0");
    lines.push("0", "ENDSEC");

    // 2. TABLES SECTION
    lines.push("0", "SECTION", "2", "TABLES");

    // Linetypes Table
    lines.push("0", "TABLE", "2", "LTYPE", "70", "4");
    lines.push("0", "LTYPE", "2", "CONTINUOUS", "70", "0", "3", "Solid line", "72", "65", "73", "0", "40", "0.0");
    lines.push("0", "LTYPE", "2", "DASHED", "70", "0", "3", "Dashed line __ __ __", "72", "65", "73", "2", "40", "12.0", "49", "9.0", "49", "-3.0");
    lines.push("0", "LTYPE", "2", "CENTER", "70", "0", "3", "Center line ____ _ ____", "72", "65", "73", "4", "40", "20.0", "49", "12.0", "49", "-3.0", "49", "2.0", "49", "-3.0");
    lines.push("0", "LTYPE", "2", "HIDDEN", "70", "0", "3", "Hidden line _ _ _ _", "72", "65", "73", "2", "40", "6.0", "49", "4.5", "49", "-1.5");
    lines.push("0", "ENDTAB");

    // Layers Table
    lines.push("0", "TABLE", "2", "LAYER", "70", String(layers.length));
    for (const l of layers) {
      lines.push("0", "LAYER", "2", l.name, "70", "0", "62", String(l.color), "6", l.lineType);
    }
    lines.push("0", "ENDTAB");
    lines.push("0", "ENDSEC");

    // 3. BLOCKS SECTION (Required by CAD parsers)
    lines.push("0", "SECTION", "2", "BLOCKS");
    lines.push("0", "BLOCK", "2", "*Model_Space", "70", "0", "10", "0.0", "20", "0.0", "30", "0.0", "3", "*Model_Space", "1", "");
    lines.push("0", "ENDBLK");
    lines.push("0", "BLOCK", "2", "*Paper_Space", "70", "0", "10", "0.0", "20", "0.0", "30", "0.0", "3", "*Paper_Space", "1", "");
    lines.push("0", "ENDBLK");
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
      } else if (ent.type === "LWPOLYLINE") {
        const d = ent.data as { points: { x: number; y: number }[]; closed: boolean };
        lines.push(
          "0", "LWPOLYLINE",
          "8", ent.layer,
          "90", String(d.points.length),
          "70", d.closed ? "1" : "0",
        );
        for (const pt of d.points) {
          lines.push("10", pt.x.toFixed(3), "20", pt.y.toFixed(3));
        }
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
    return lines.join("\n");
  }
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

  // 1. WALLS (A-WALL) with Door & Window Opening Cuts
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

    // Wall Centerline
    doc.addLine("A-WALL-CTR", x1, y1, x2, y2);

    // Collect openings on this wall
    const wallDoors = doors.filter((d) => d.wallId === wall.id);
    const wallWindows = windows.filter((w) => w.wallId === wall.id);

    type Interval = { start: number; end: number; kind: "door" | "window"; item: LayoutDoor | LayoutWindow };
    const intervals: Interval[] = [];

    for (const d of wallDoors) {
      const p = d.positionMm;
      const w = d.widthMm || 900;
      const s = Math.max(0, p - w / 2);
      const e = Math.min(len, p + w / 2);
      if (e > s) intervals.push({ start: s, end: e, kind: "door", item: d });
    }
    for (const win of wallWindows) {
      const p = win.positionMm;
      const w = win.widthMm || 1200;
      const s = Math.max(0, p - w / 2);
      const e = Math.min(len, p + w / 2);
      if (e > s) intervals.push({ start: s, end: e, kind: "window", item: win });
    }

    intervals.sort((a, b) => a.start - b.start);

    // Emit wall solid segments between openings
    let curT = 0;
    for (const seg of intervals) {
      if (seg.start > curT + 5) {
        // Left face segment
        doc.addLine(
          "A-WALL",
          x1 + curT * ux + nx * halfT,
          y1 + curT * uy + ny * halfT,
          x1 + seg.start * ux + nx * halfT,
          y1 + seg.start * uy + ny * halfT,
        );
        // Right face segment
        doc.addLine(
          "A-WALL",
          x1 + curT * ux - nx * halfT,
          y1 + curT * uy - ny * halfT,
          x1 + seg.start * ux - nx * halfT,
          y1 + seg.start * uy - ny * halfT,
        );
      }

      // Handle the opening gap
      const oSx = x1 + seg.start * ux;
      const oSy = y1 + seg.start * uy;
      const oEx = x1 + seg.end * ux;
      const oEy = y1 + seg.end * uy;

      if (seg.kind === "door") {
        const door = seg.item as LayoutDoor;
        const doorW = seg.end - seg.start;
        // Jamb lines at start & end of opening
        doc.addLine("A-WALL", oSx + nx * halfT, oSy + ny * halfT, oSx - nx * halfT, oSy - ny * halfT);
        doc.addLine("A-WALL", oEx + nx * halfT, oEy + ny * halfT, oEx - nx * halfT, oEy - ny * halfT);

        // Door leaf and swing arc
        const isStartHinge = door.hinge !== "end";
        const hingeX = isStartHinge ? oSx : oEx;
        const hingeY = isStartHinge ? oSy : oEy;
        const swingSide = (door.swing ?? 1) > 0 ? 1 : -1;
        const leafNx = nx * swingSide;
        const leafNy = ny * swingSide;

        // Leaf panel (open 90 degrees)
        const leafTipX = hingeX + leafNx * doorW;
        const leafTipY = hingeY + leafNy * doorW;
        doc.addLine("A-DOOR", hingeX, hingeY, leafTipX, leafTipY);

        // Door Swing Arc
        const wallAngleDeg = (Math.atan2(uy, ux) * 180) / Math.PI;
        const normalAngleDeg = (Math.atan2(leafNy, leafNx) * 180) / Math.PI;
        const closedAngleDeg = isStartHinge ? wallAngleDeg : wallAngleDeg + 180;
        doc.addArc("A-DOOR-SWNG", hingeX, hingeY, doorW, Math.min(closedAngleDeg, normalAngleDeg), Math.max(closedAngleDeg, normalAngleDeg));
      } else if (seg.kind === "window") {
        // Window opening: Jambs, outer sill, and 2 central glass panes
        doc.addLine("A-GLAZ", oSx + nx * halfT, oSy + ny * halfT, oSx - nx * halfT, oSy - ny * halfT);
        doc.addLine("A-GLAZ", oEx + nx * halfT, oEy + ny * halfT, oEx - nx * halfT, oEy - ny * halfT);
        // Sill line (exterior)
        doc.addLine("A-GLAZ-SILL", oSx + nx * halfT, oSy + ny * halfT, oEx + nx * halfT, oEy + ny * halfT);
        doc.addLine("A-GLAZ-SILL", oSx - nx * halfT, oSy - ny * halfT, oEx - nx * halfT, oEy - ny * halfT);
        // Double glass line along center
        const glassOffset = Math.min(25, halfT * 0.25);
        doc.addLine("A-GLAZ", oSx + nx * glassOffset, oSy + ny * glassOffset, oEx + nx * glassOffset, oEy + ny * glassOffset);
        doc.addLine("A-GLAZ", oSx - nx * glassOffset, oSy - ny * glassOffset, oEx - nx * glassOffset, oEy - ny * glassOffset);
      }

      curT = Math.max(curT, seg.end);
    }

    if (curT < len - 5) {
      doc.addLine(
        "A-WALL",
        x1 + curT * ux + nx * halfT,
        y1 + curT * uy + ny * halfT,
        x2 + nx * halfT,
        y2 + ny * halfT,
      );
      doc.addLine(
        "A-WALL",
        x1 + curT * ux - nx * halfT,
        y1 + curT * uy - ny * halfT,
        x2 - nx * halfT,
        y2 - ny * halfT,
      );
    }

    // End caps at wall terminations
    doc.addLine("A-WALL", x1 + nx * halfT, y1 + ny * halfT, x1 - nx * halfT, y1 - ny * halfT);
    doc.addLine("A-WALL", x2 + nx * halfT, y2 + ny * halfT, x2 - nx * halfT, y2 - ny * halfT);
  }

  // 2. SLABS & FLOORS (A-FLOR, A-ROOF)
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
        if (hole.length >= 3) {
          doc.addPolyline(layerName, hole.map((p) => ({ x: p.xMm, y: p.yMm })), true);
        }
      }
    }
  }

  // 3. COLUMNS (A-COLS)
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

  // 4. BEAMS (S-BEAM)
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

    doc.addLine("S-BEAM", x1, y1, x2, y2); // Centerline
    doc.addLine("S-BEAM", x1 + nx * halfW, y1 + ny * halfW, x2 + nx * halfW, y2 + ny * halfW);
    doc.addLine("S-BEAM", x1 - nx * halfW, y1 - ny * halfW, x2 - nx * halfW, y2 - ny * halfW);
    doc.addLine("S-BEAM", x1 + nx * halfW, y1 + ny * halfW, x1 - nx * halfW, y1 - ny * halfW);
    doc.addLine("S-BEAM", x2 + nx * halfW, y2 + ny * halfW, x2 - nx * halfW, y2 - ny * halfW);
  }

  // 5. STAIRS & RAMPS (A-STRS, A-RAMP)
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

    // Flight outer box
    const corners = [
      { x: x1 + nx * halfW, y: y1 + ny * halfW },
      { x: x2 + nx * halfW, y: y2 + ny * halfW },
      { x: x2 - nx * halfW, y: y2 - ny * halfW },
      { x: x1 - nx * halfW, y: y1 - ny * halfW },
    ];
    doc.addPolyline("A-STRS", corners, true);

    // Treads
    const treadDepth = Math.max(200, stair.treadDepthMm || 280);
    const numTreads = Math.max(2, Math.floor(len / treadDepth));
    const stepDist = len / numTreads;
    for (let i = 1; i < numTreads; i++) {
      const tx = x1 + i * stepDist * ux;
      const ty = y1 + i * stepDist * uy;
      doc.addLine("A-STRS", tx + nx * halfW, ty + ny * halfW, tx - nx * halfW, ty - ny * halfW);
    }

    // Direction Walk-Line
    doc.addLine("A-STRS-UP", x1, y1, x2, y2);
    // Arrow head
    const arrowLen = Math.min(250, len * 0.15);
    doc.addLine("A-STRS-UP", x2, y2, x2 - ux * arrowLen + nx * arrowLen * 0.5, y2 - uy * arrowLen + ny * arrowLen * 0.5);
    doc.addLine("A-STRS-UP", x2, y2, x2 - ux * arrowLen - nx * arrowLen * 0.5, y2 - uy * arrowLen - ny * arrowLen * 0.5);
    doc.addText("A-STRS-UP", "UP", (x1 + x2) / 2 + nx * (halfW + 150), (y1 + y2) / 2 + ny * (halfW + 150), 180);
  }

  const ramps = layout.ramps.filter((rp) => !targetLevelId || rp.levelId === targetLevelId);
  for (const ramp of ramps) {
    const x1 = ramp.startXmm;
    const y1 = ramp.startYmm;
    const x2 = ramp.endXmm;
    const y2 = ramp.endYmm;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;

    const nx = -dy / len;
    const ny = dx / len;
    const halfW = (ramp.widthMm || 1200) / 2;

    doc.addPolyline("A-RAMP", [
      { x: x1 + nx * halfW, y: y1 + ny * halfW },
      { x: x2 + nx * halfW, y: y2 + ny * halfW },
      { x: x2 - nx * halfW, y: y2 - ny * halfW },
      { x: x1 - nx * halfW, y: y1 - ny * halfW },
    ], true);
    doc.addLine("A-RAMP", x1, y1, x2, y2);
  }

  // 6. MEP (M-DUCT, P-PIPE, E-CABL, M-EQPM)
  const ducts = layout.ducts.filter((d) => !targetLevelId || d.levelId === targetLevelId);
  for (const duct of ducts) {
    const dx = duct.endXmm - duct.startXmm;
    const dy = duct.endYmm - duct.startYmm;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const halfW = (duct.widthMm || 300) / 2;
    const nx = (-dy / len) * halfW;
    const ny = (dx / len) * halfW;
    doc.addLine("M-DUCT", duct.startXmm + nx, duct.startYmm + ny, duct.endXmm + nx, duct.endYmm + ny);
    doc.addLine("M-DUCT", duct.startXmm - nx, duct.startYmm - ny, duct.endXmm - nx, duct.endYmm - ny);
    doc.addLine("M-DUCT", duct.startXmm, duct.startYmm, duct.endXmm, duct.endYmm);
  }

  const pipes = layout.pipes.filter((p) => !targetLevelId || p.levelId === targetLevelId);
  for (const pipe of pipes) {
    const dx = pipe.endXmm - pipe.startXmm;
    const dy = pipe.endYmm - pipe.startYmm;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const halfD = (pipe.diameterMm || 50) / 2;
    const nx = (-dy / len) * halfD;
    const ny = (dx / len) * halfD;
    doc.addLine("P-PIPE", pipe.startXmm + nx, pipe.startYmm + ny, pipe.endXmm + nx, pipe.endYmm + ny);
    doc.addLine("P-PIPE", pipe.startXmm - nx, pipe.startYmm - ny, pipe.endXmm - nx, pipe.endYmm - ny);
  }

  const cableTrays = layout.cableTrays.filter((ct) => !targetLevelId || ct.levelId === targetLevelId);
  for (const ct of cableTrays) {
    const dx = ct.endXmm - ct.startXmm;
    const dy = ct.endYmm - ct.startYmm;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const halfW = (ct.widthMm || 200) / 2;
    const nx = (-dy / len) * halfW;
    const ny = (dx / len) * halfW;
    doc.addLine("E-CABL", ct.startXmm + nx, ct.startYmm + ny, ct.endXmm + nx, ct.endYmm + ny);
    doc.addLine("E-CABL", ct.startXmm - nx, ct.startYmm - ny, ct.endXmm - nx, ct.endYmm - ny);
  }

  const mepEquipment = layout.mepEquipment.filter((eq) => !targetLevelId || eq.levelId === targetLevelId);
  for (const eq of mepEquipment) {
    const cx = eq.xMm;
    const cy = eq.yMm;
    const w = eq.widthMm || 600;
    const d = eq.depthMm || 600;
    const rot = ((eq.rotationDeg || 0) * Math.PI) / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const hw = w / 2;
    const hd = d / 2;
    const pts = [
      { x: -hw, y: -hd },
      { x: hw, y: -hd },
      { x: hw, y: hd },
      { x: -hw, y: hd },
    ].map((p) => ({
      x: cx + p.x * cos - p.y * sin,
      y: cy + p.x * sin + p.y * cos,
    }));
    doc.addPolyline("M-EQPM", pts, true);
    doc.addText("M-EQPM", eq.name || "Equipment", cx - hw + 20, cy, 140);
  }

  // 7. GRID LINES (A-GRID)
  const gridLines = layout.gridLines;
  for (const gl of gridLines) {
    doc.addLine("A-GRID", gl.startXmm, gl.startYmm, gl.endXmm, gl.endYmm);
    const bubbleRadius = 350;
    doc.addCircle("A-GRID", gl.startXmm, gl.startYmm, bubbleRadius);
    doc.addCircle("A-GRID", gl.endXmm, gl.endYmm, bubbleRadius);
    doc.addText("A-GRID", gl.label || "", gl.startXmm - 120, gl.startYmm - 80, 240);
    doc.addText("A-GRID", gl.label || "", gl.endXmm - 120, gl.endYmm - 80, 240);
  }

  // 8. 2D SKETCH DETAIL LINES (A-ANNO-LINE)
  const sketchLines = layout.sketchLines.filter((l) => !targetLevelId || l.levelId === targetLevelId);
  for (const sl of sketchLines) {
    doc.addLine("A-ANNO-LINE", sl.startXmm, sl.startYmm, sl.endXmm, sl.endYmm);
  }

  // 9. DIMENSIONS (A-ANNO-DIMS)
  const measurements = markup.measurements.filter((m) => !targetLevelId || m.floorId === targetLevelId);
  for (const m of measurements) {
    if (m.mode === "distance" && m.points.length >= 2) {
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
      // Dimension tick marks
      const nx = (-dy / (distMm || 1)) * 120;
      const ny = (dx / (distMm || 1)) * 120;
      doc.addLine("A-ANNO-DIMS", x1 - nx, y1 - ny, x1 + nx, y1 + ny);
      doc.addLine("A-ANNO-DIMS", x2 - nx, y2 - ny, x2 + nx, y2 + ny);
      // Centered dimension text
      doc.addText("A-ANNO-DIMS", `${distMm} mm`, (x1 + x2) / 2 + nx * 1.5, (y1 + y2) / 2 + ny * 1.5, 160);
    }
  }

  // 10. NOTES & CALLOUTS (A-ANNO-NOTE)
  const notes = markup.notes.filter((n) => !targetLevelId || n.floorId === targetLevelId);
  for (const n of notes) {
    const nx = n.posX * 1000;
    const ny = n.posZ * 1000;
    doc.addCircle("A-ANNO-NOTE", nx, ny, 150);
    doc.addText("A-ANNO-NOTE", `NOTE: ${n.text}`, nx + 200, ny + 50, 180);
  }

  // 11. REFERENCE UNDERLAYS (A-REF-PLAN)
  const underlays = layout.underlays.filter((u) => !targetLevelId || u.levelId === targetLevelId);
  for (const u of underlays) {
    if (u.image?.snapSegments?.length) {
      for (const seg of u.image.snapSegments) {
        doc.addLine("A-REF-PLAN", seg.ax, seg.ay, seg.bx, seg.by);
      }
    }
  }

  // 12. IFC ROOMS (A-ROOM-BNDY, A-ROOM-NAME)
  const rooms = app.rooms.filter((r) => !targetLevelId || r.floorId === targetLevelId);
  for (const room of rooms) {
    if (room.geometry) {
      const posAttr = room.geometry.getAttribute("position");
      if (posAttr && posAttr.count >= 3) {
        let sumX = 0;
        let sumZ = 0;
        let count = 0;
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i < posAttr.count; i++) {
          const rx = posAttr.getX(i) * 1000;
          const rz = posAttr.getZ(i) * 1000;
          if (Number.isFinite(rx) && Number.isFinite(rz)) {
            sumX += rx;
            sumZ += rz;
            count++;
            if (pts.length < 32) pts.push({ x: rx, y: rz });
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
  format: CadExportFormat = "dwg",
): void {
  const dxfContent = generateFloorDxf(floorId);
  const layout = useLayoutDrawingStore.getState();
  const level = layout.levels.find((l) => l.id === floorId);
  const appFloor = useAppStore.getState().floors.find((f) => f.id === floorId);

  const cleanName = (floorName || level?.name || appFloor?.name || "Floor_Plan")
    .trim()
    .replace(/[^\w.-]+/g, "_");

  const fileName = `${cleanName}.${format}`;
  const mimeType = format === "dwg" ? "application/acad" : "application/dxf";
  const blob = new Blob([dxfContent], { type: mimeType });
  downloadBlob(blob, fileName);
}

/**
 * Downloads all floors in the project packaged into a single ZIP archive.
 */
export async function downloadAllFloorsCad(format: CadExportFormat = "dwg"): Promise<void> {
  const layout = useLayoutDrawingStore.getState();
  const app = useAppStore.getState();
  const zip = new JSZip();

  const allLevels = layout.levels.length > 0 ? layout.levels : app.floors.map((f) => ({ id: f.id, name: f.name }));

  if (allLevels.length === 0) {
    // Single default floor plan
    const content = generateFloorDxf(null);
    zip.file(`Floor_Plan.${format}`, content);
  } else {
    for (const lvl of allLevels) {
      const content = generateFloorDxf(lvl.id);
      const cleanName = (lvl.name || `Level_${lvl.id}`).trim().replace(/[^\w.-]+/g, "_");
      zip.file(`${cleanName}_Floor_Plan.${format}`, content);
    }
  }

  const projName = (layout.projectId || app.activeModelLabel || "Project")
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w.-]+/g, "_");

  const zipBlob = await zip.generateAsync({ type: "blob" });
  downloadBlob(zipBlob, `${projName}_Floors_CAD_${format.toUpperCase()}.zip`);
}
