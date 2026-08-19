/**
 * Lines Sketch & Loop Closure Detection for Floor / Roof conversion and nested holes.
 */

export type Point2D = { xMm: number; yMm: number };

export type Segment2D = {
  id?: string;
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
};

export type ClosedLoop = {
  points: Point2D[];
  areaSqMm: number;
  isClockwise: boolean;
};

export type LoopDetectionResult = {
  closedLoops: ClosedLoop[];
  outerLoops: ClosedLoop[];
  nestedHoles: Map<ClosedLoop, ClosedLoop[]>; // Outer loop -> inner hole loops
  isFullyClosed: boolean;
  gapPoints: Point2D[];
};

function distance(p1: Point2D, p2: Point2D): number {
  return Math.hypot(p1.xMm - p2.xMm, p1.yMm - p2.yMm);
}

function calculateSignedArea(points: Point2D[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].xMm * points[j].yMm;
    area -= points[j].xMm * points[i].yMm;
  }
  return area / 2;
}

export function isPointInsidePolygon(point: Point2D, vs: Point2D[]): boolean {
  const x = point.xMm, y = point.yMm;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].xMm, yi = vs[i].yMm;
    const xj = vs[j].xMm, yj = vs[j].yMm;
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Analyzes an array of segments to detect closed loops, nested hole loops, or open gaps.
 */
export function detectLoopsFromSegments(
  segments: Segment2D[],
  toleranceMm = 100
): LoopDetectionResult {
  if (segments.length < 3) {
    const gapPoints = segments.length > 0 
      ? [{ xMm: segments[0].startXmm, yMm: segments[0].startYmm }, { xMm: segments[segments.length - 1].endXmm, yMm: segments[segments.length - 1].endYmm }] 
      : [];
    return {
      closedLoops: [],
      outerLoops: [],
      nestedHoles: new Map(),
      isFullyClosed: false,
      gapPoints,
    };
  }

  // Build endpoint adjacency
  const remaining = [...segments];
  const closedLoops: ClosedLoop[] = [];
  const gapPoints: Point2D[] = [];

  while (remaining.length > 0) {
    const currentPath: Point2D[] = [
      { xMm: remaining[0].startXmm, yMm: remaining[0].startYmm },
      { xMm: remaining[0].endXmm, yMm: remaining[0].endYmm },
    ];
    remaining.shift();

    let extended = true;
    while (extended && remaining.length > 0) {
      extended = false;
      const head = currentPath[0];
      const tail = currentPath[currentPath.length - 1];

      // Check if tail is already closed to head
      if (distance(tail, head) <= toleranceMm && currentPath.length >= 3) {
        break;
      }

      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        const segStart: Point2D = { xMm: seg.startXmm, yMm: seg.startYmm };
        const segEnd: Point2D = { xMm: seg.endXmm, yMm: seg.endYmm };

        if (distance(tail, segStart) <= toleranceMm) {
          currentPath.push(segEnd);
          remaining.splice(i, 1);
          extended = true;
          break;
        } else if (distance(tail, segEnd) <= toleranceMm) {
          currentPath.push(segStart);
          remaining.splice(i, 1);
          extended = true;
          break;
        } else if (distance(head, segEnd) <= toleranceMm) {
          currentPath.unshift(segStart);
          remaining.splice(i, 1);
          extended = true;
          break;
        } else if (distance(head, segStart) <= toleranceMm) {
          currentPath.unshift(segEnd);
          remaining.splice(i, 1);
          extended = true;
          break;
        }
      }
    }

    const head = currentPath[0];
    const tail = currentPath[currentPath.length - 1];

    if (distance(head, tail) <= toleranceMm && currentPath.length >= 4) {
      // Clean polygon vertices
      const poly = currentPath.slice(0, -1);
      const signedArea = calculateSignedArea(poly);
      closedLoops.push({
        points: poly,
        areaSqMm: Math.abs(signedArea),
        isClockwise: signedArea < 0,
      });
    } else {
      // Path did not close — record gap points
      gapPoints.push(head, tail);
    }
  }

  // Sort loops by area descending (outermost first)
  closedLoops.sort((a, b) => b.areaSqMm - a.areaSqMm);

  const outerLoops: ClosedLoop[] = [];
  const nestedHoles = new Map<ClosedLoop, ClosedLoop[]>();

  for (const loop of closedLoops) {
    let parentOuter: ClosedLoop | null = null;

    // Check if this loop is inside any already established outer loop
    for (const outer of outerLoops) {
      const samplePt = loop.points[0];
      if (isPointInsidePolygon(samplePt, outer.points)) {
        parentOuter = outer;
        break;
      }
    }

    if (parentOuter) {
      const holes = nestedHoles.get(parentOuter) || [];
      holes.push(loop);
      nestedHoles.set(parentOuter, holes);
    } else {
      outerLoops.push(loop);
      nestedHoles.set(loop, []);
    }
  }

  const isFullyClosed = gapPoints.length === 0 && closedLoops.length > 0;

  return {
    closedLoops,
    outerLoops,
    nestedHoles,
    isFullyClosed,
    gapPoints,
  };
}
