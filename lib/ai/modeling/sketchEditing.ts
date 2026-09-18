import type { FloorSketch, SketchPoint } from "./allocation";

function checkSketchLocks(before: FloorSketch, next: FloorSketch) {
  for (const lock of before.locks ?? []) {
    const a = lock.interior ? next.lines[lock.index]?.start : next.points[lock.index];
    const b = lock.interior ? next.lines[lock.index]?.end : next.points[(lock.index + 1) % next.points.length];
    if (!a || !b || Math.abs(Math.hypot(b.xMm - a.xMm, b.yMm - a.yMm) - lock.lengthMm) > 1) throw new Error("Unlock the connected line to change its length.");
  }
  if ([...next.points, ...next.lines.flatMap(l => [l.start, l.end])].some(p => p.xMm < 0 || p.yMm < 0 || p.xMm > 80000 || p.yMm > 80000)) throw new Error("Keep the line inside the drawing workspace.");
  return next;
}

export function moveSketchLine(s: FloorSketch, index: number, interior: boolean, dxMm: number, dyMm: number): FloorSketch {
  const a = interior ? s.lines[index]?.start : s.points[index], b = interior ? s.lines[index]?.end : s.points[(index + 1) % s.points.length];
  if (!a || !b) throw new Error("Select a line to move.");
  const dx = b.xMm - a.xMm, dy = b.yMm - a.yMm, length2 = dx * dx + dy * dy;
  const move = (p: SketchPoint) => {
    const t = ((p.xMm - a.xMm) * dx + (p.yMm - a.yMm) * dy) / (length2 || 1);
    const onLine = t >= -.00001 && t <= 1.00001 && Math.hypot(p.xMm - a.xMm - t * dx, p.yMm - a.yMm - t * dy) < 1;
    return onLine ? { xMm: p.xMm + dxMm, yMm: p.yMm + dyMm } : p;
  };
  return checkSketchLocks(s, { ...s, points: s.points.map(move), lines: s.lines.map(l => ({ start: move(l.start), end: move(l.end) })) });
}

export function moveSketchEndpoint(s: FloorSketch, index: number, interior: boolean, endpoint: "start" | "end", point: SketchPoint): FloorSketch {
  const old = interior ? s.lines[index]?.[endpoint] : s.points[(index + (endpoint === "end" ? 1 : 0)) % s.points.length];
  if (!old) throw new Error("Choose a line endpoint.");
  const move = (p: SketchPoint) => Math.hypot(p.xMm - old.xMm, p.yMm - old.yMm) < 1 ? point : p;
  return checkSketchLocks(s, { ...s, points: s.points.map(move), lines: s.lines.map(l => ({ start: move(l.start), end: move(l.end) })) });
}

/** Snap dragged endpoints to nearby endpoints or onto an existing wall, including T junctions. */
export function snapSketchEndpoint(s: FloorSketch, raw: SketchPoint, exclude: SketchPoint, toleranceMm: number): SketchPoint {
  const edges = [...s.points.map((start, i) => ({ start, end: s.points[(i + 1) % s.points.length] })), ...s.lines];
  const candidates = edges.flatMap(l => [l.start, l.end]).filter(p => Math.hypot(p.xMm - exclude.xMm, p.yMm - exclude.yMm) > 1);
  for (const l of edges) {
    if (Math.hypot(l.start.xMm - exclude.xMm, l.start.yMm - exclude.yMm) < 1 || Math.hypot(l.end.xMm - exclude.xMm, l.end.yMm - exclude.yMm) < 1) continue;
    const dx = l.end.xMm - l.start.xMm, dy = l.end.yMm - l.start.yMm;
    const t = Math.max(0, Math.min(1, ((raw.xMm - l.start.xMm) * dx + (raw.yMm - l.start.yMm) * dy) / (dx * dx + dy * dy || 1)));
    candidates.push({ xMm: l.start.xMm + t * dx, yMm: l.start.yMm + t * dy });
  }
  return candidates.filter(p => Math.hypot(p.xMm - raw.xMm, p.yMm - raw.yMm) <= toleranceMm).sort((a, b) => Math.hypot(a.xMm - raw.xMm, a.yMm - raw.yMm) - Math.hypot(b.xMm - raw.xMm, b.yMm - raw.yMm))[0] ?? raw;
}

export function refreshSketchLayout(s: FloorSketch, revision: number): FloorSketch {
  for (let i = 0; i < s.lines.length; i++) {
    const l = s.lines[i], horizontal = Math.abs(l.end.xMm - l.start.xMm) > Math.abs(l.end.yMm - l.start.yMm);
    try {
      return moveSketchLine(s, i, true, horizontal ? 0 : (revision % 2 ? 150 : -150), horizontal ? (revision % 2 ? 150 : -150) : 0);
    } catch { /* Try another partition when connected lengths are locked. */ }
  }
  return s;
}

export function resizeSketchLine(sketch:FloorSketch,index:number,interior:boolean,lengthMm:number):FloorSketch {
  if(!Number.isFinite(lengthMm)||lengthMm<300||lengthMm>80000)throw new Error("Line length must be 0.3–80 m.");
  const a=interior?sketch.lines[index]?.start:sketch.points[index],b=interior?sketch.lines[index]?.end:sketch.points[(index+1)%sketch.points.length];
  if(!a||!b)throw new Error("Select a line first.");
  const old=Math.hypot(b.xMm-a.xMm,b.yMm-a.yMm);
  if(old<1)throw new Error("Choose a line with distinct endpoints.");
  const end={xMm:a.xMm+(b.xMm-a.xMm)*lengthMm/old,yMm:a.yMm+(b.yMm-a.yMm)*lengthMm/old};
  const move=(p:SketchPoint):SketchPoint=>{
    // Orthogonal outlines keep adjoining corners aligned; attached interior endpoints follow.
    if(!interior&&Math.abs(b.yMm-a.yMm)<1&&Math.abs(p.xMm-b.xMm)<1)return {...p,xMm:end.xMm};
    if(!interior&&Math.abs(b.xMm-a.xMm)<1&&Math.abs(p.yMm-b.yMm)<1)return {...p,yMm:end.yMm};
    return Math.hypot(p.xMm-b.xMm,p.yMm-b.yMm)<1?end:p;
  };
  const next=interior?{...sketch,lines:sketch.lines.map((l,i)=>i===index?{...l,end}:l)}:{...sketch,points:sketch.points.map(move),lines:sketch.lines.map(l=>({start:move(l.start),end:move(l.end)}))};
  for(const lock of sketch.locks??[]){
    const start=lock.interior?next.lines[lock.index]?.start:next.points[lock.index],finish=lock.interior?next.lines[lock.index]?.end:next.points[(lock.index+1)%next.points.length];
    if(!start||!finish||Math.abs(Math.hypot(finish.xMm-start.xMm,finish.yMm-start.yMm)-lock.lengthMm)>1)throw new Error("This edit changes a locked length. Unlock that line first.");
  }
  if([...next.points,...next.lines.flatMap(l=>[l.start,l.end])].some(p=>p.xMm<0||p.yMm<0||p.xMm>80000||p.yMm>80000))throw new Error("This length moves a point outside the 80 m drawing workspace.");
  return next;
}

/** Curves compile into bounded straight wall segments, matching the modeling contract. */
export function circularOutline(center:SketchPoint,radiusMm:number,count=24):SketchPoint[]{
  if(!Number.isFinite(radiusMm)||radiusMm<1000)throw new Error("Circle radius must be at least 1 m.");
  return Array.from({length:count},(_,i)=>({xMm:center.xMm+radiusMm*Math.cos(i*2*Math.PI/count),yMm:center.yMm+radiusMm*Math.sin(i*2*Math.PI/count)}));
}
export function arcSegments(start:SketchPoint,end:SketchPoint,bulge:SketchPoint){
  const ax=end.xMm-start.xMm,ay=end.yMm-start.yMm,bx=bulge.xMm-start.xMm,by=bulge.yMm-start.yMm,den=2*(ax*by-ay*bx);
  if(Math.abs(den)<1)throw new Error("Pick an arc bend away from the straight line.");
  const cx=start.xMm+(by*(ax*ax+ay*ay)-ay*(bx*bx+by*by))/den,cy=start.yMm+(ax*(bx*bx+by*by)-bx*(ax*ax+ay*ay))/den;
  const radius=Math.hypot(start.xMm-cx,start.yMm-cy),a=Math.atan2(start.yMm-cy,start.xMm-cx),b=Math.atan2(end.yMm-cy,end.xMm-cx),m=Math.atan2(bulge.yMm-cy,bulge.xMm-cx),positive=(v:number)=>(v+Math.PI*4)%(Math.PI*2);
  const sweep=positive(m-a)<=positive(b-a)?positive(b-a):positive(b-a)-Math.PI*2;
  const count=Math.min(12,Math.max(3,Math.ceil(Math.abs(sweep)*radius/1500)));
  const bend=sweep>0?positive(m-a):positive(m-a)-Math.PI*2,left=Math.max(1,Math.min(count-1,Math.round(count*bend/sweep)));
  const points=Array.from({length:count+1},(_,i)=>{const angle=i<=left?a+bend*i/left:a+bend+(sweep-bend)*(i-left)/(count-left);return {xMm:cx+radius*Math.cos(angle),yMm:cy+radius*Math.sin(angle)};});
  points[0]=start;points[left]=bulge;points[count]=end;
  if(points.some(p=>p.xMm<0||p.yMm<0||p.xMm>80000||p.yMm>80000))throw new Error("Arc extends outside the workspace.");
  return points.slice(1).map((end,i)=>({start:points[i],end}));
}

export function lineAngleDeg(start: SketchPoint, end: SketchPoint): number {
  const rad = Math.atan2(end.yMm - start.yMm, end.xMm - start.xMm);
  return ((rad * 180 / Math.PI) + 360) % 360;
}

export function rotateSketchLine(sketch: FloorSketch, index: number, interior: boolean, angleDeg: number): FloorSketch {
  if (!Number.isFinite(angleDeg)) throw new Error("Invalid angle.");
  const a = interior ? sketch.lines[index]?.start : sketch.points[index];
  const b = interior ? sketch.lines[index]?.end : sketch.points[(index + 1) % sketch.points.length];
  if (!a || !b) throw new Error("Select a line first.");
  const len = Math.hypot(b.xMm - a.xMm, b.yMm - a.yMm);
  if (len < 1) throw new Error("Line has no length.");
  const rad = angleDeg * Math.PI / 180;
  const end = { xMm: Math.round(a.xMm + len * Math.cos(rad)), yMm: Math.round(a.yMm + len * Math.sin(rad)) };
  if (end.xMm < 0 || end.yMm < 0 || end.xMm > 80000 || end.yMm > 80000) throw new Error("Rotated line endpoint moves outside workspace.");
  if (interior) {
    return { ...sketch, lines: sketch.lines.map((l, i) => i === index ? { ...l, end } : l) };
  } else {
    return { ...sketch, points: sketch.points.map((p, i) => i === (index + 1) % sketch.points.length ? end : p) };
  }
}
