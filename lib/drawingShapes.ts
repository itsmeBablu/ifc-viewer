import { computeArcFromThreePoints } from "./layoutDrawing";

export type DrawingShape = "line" | "rectangle" | "circle" | "arc" | "pick-edge" | "pick-face";
export type DrawingPoint = { xMm: number; yMm: number };
export type DrawingSegment = {
  startXmm: number; startYmm: number; endXmm: number; endYmm: number;
  curved?: boolean; arcCenterXmm?: number; arcCenterYmm?: number;
  arcRadiusMm?: number; arcStartAngleDeg?: number; arcEndAngleDeg?: number;
  arcSweepDeg?: number;
};

export function drawingSegments(shape: DrawingShape, points: DrawingPoint[]): DrawingSegment[] {
  if (points.length < 2) return [];
  const [a, b, c] = points;
  const line = (p: DrawingPoint, q: DrawingPoint): DrawingSegment => ({ startXmm: p.xMm, startYmm: p.yMm, endXmm: q.xMm, endYmm: q.yMm });
  if (shape === "rectangle") {
    if (Math.abs(a.xMm - b.xMm) < 1 || Math.abs(a.yMm - b.yMm) < 1) return [];
    const corners = [a, { xMm: b.xMm, yMm: a.yMm }, b, { xMm: a.xMm, yMm: b.yMm }];
    return corners.map((p, i) => line(p, corners[(i + 1) % 4]));
  }
  if (shape === "circle") {
    const radius = Math.hypot(b.xMm - a.xMm, b.yMm - a.yMm);
    if (radius < 1) return [];
    // Four analytic arcs keep existing wall/line rendering and snapping compatible.
    return [0, 90, 180, 270].map((start) => {
      const at = (deg: number) => ({ xMm: a.xMm + radius * Math.cos(deg * Math.PI / 180), yMm: a.yMm + radius * Math.sin(deg * Math.PI / 180) });
      return { ...line(at(start), at(start + 90)), curved: true, arcCenterXmm: a.xMm, arcCenterYmm: a.yMm, arcRadiusMm: radius, arcStartAngleDeg: start, arcEndAngleDeg: start + 90, arcSweepDeg: 90 };
    });
  }
  if (shape === "arc") {
    if (!c) return [line(a, b)];
    const arc = computeArcFromThreePoints(a, c, b);
    if (!arc) return [];
    const angle = (p: DrawingPoint) => Math.atan2(p.yMm - arc.arcCenterYmm, p.xMm - arc.arcCenterXmm) * 180 / Math.PI;
    const positive = (degrees: number) => (degrees % 360 + 360) % 360;
    const start = angle(a), sweep = positive(angle(b) - start);
    const through = positive(angle(c) - start);
    const arcSweepDeg = through <= sweep ? sweep : sweep - 360;
    return [{ ...line(a, b), ...arc, arcStartAngleDeg: start, arcEndAngleDeg: start + arcSweepDeg, arcSweepDeg, curved: true }];
  }
  const last = points[points.length - 2], end = points[points.length - 1];
  return Math.hypot(end.xMm - last.xMm, end.yMm - last.yMm) >= 1 ? [line(last, end)] : [];
}

export function sampleDrawingSegment(segment: DrawingSegment): DrawingPoint[] {
  if (!segment.curved || segment.arcCenterXmm == null || segment.arcCenterYmm == null || segment.arcRadiusMm == null || segment.arcStartAngleDeg == null || segment.arcEndAngleDeg == null) {
    return [{ xMm: segment.startXmm, yMm: segment.startYmm }, { xMm: segment.endXmm, yMm: segment.endYmm }];
  }
  const sweep = segment.arcEndAngleDeg - segment.arcStartAngleDeg;
  const steps = Math.max(8, Math.ceil(Math.abs(sweep) / 5));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = (segment.arcStartAngleDeg! + sweep * i / steps) * Math.PI / 180;
    return { xMm: segment.arcCenterXmm! + segment.arcRadiusMm! * Math.cos(angle), yMm: segment.arcCenterYmm! + segment.arcRadiusMm! * Math.sin(angle) };
  });
}
