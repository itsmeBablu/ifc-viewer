import type { FloorSketch, SketchPoint } from "./allocation";

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
  const next=interior?{...sketch,lines:sketch.lines.map((l,i)=>i===index?{...l,end}:l)}:{points:sketch.points.map(move),lines:sketch.lines.map(l=>({start:move(l.start),end:move(l.end)}))};
  if([...next.points,...next.lines.flatMap(l=>[l.start,l.end])].some(p=>p.xMm<0||p.yMm<0||p.xMm>80000||p.yMm>80000))throw new Error("This length moves a point outside the 80 m drawing workspace.");
  return next;
}
