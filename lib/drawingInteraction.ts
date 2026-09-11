import type { LayoutToolId } from "./layoutDrawing";
import type { DrawingPoint } from "./drawingShapes";

export function mepRunKind(tool: LayoutToolId | null) {
  if (tool === "duct" || tool === "flex_duct" || tool === "mep_placeholder") return "duct";
  if (tool === "pipe" || tool === "cabletray" || tool === "wire") return tool;
  return null;
}

/** Apply constraints before both rendering and saving, including zero/negative angles. */
export function constrainedDrawingPoint(from: DrawingPoint, to: DrawingPoint, length: number | null, angle: number | null): DrawingPoint {
  const distance = length ?? Math.hypot(to.xMm - from.xMm, to.yMm - from.yMm);
  const radians = angle == null ? Math.atan2(to.yMm - from.yMm, to.xMm - from.xMm) : angle * Math.PI / 180;
  return { xMm: from.xMm + distance * Math.cos(radians), yMm: from.yMm + distance * Math.sin(radians) };
}

export function segmentDimensions(from: DrawingPoint, to: DrawingPoint) {
  return { lengthMm: Math.hypot(to.xMm - from.xMm, to.yMm - from.yMm), angleDeg: (Math.atan2(to.yMm - from.yMm, to.xMm - from.xMm) * 180 / Math.PI + 360) % 360 };
}
