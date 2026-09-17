"use client";
import { FOOTPRINTS } from "@/lib/ai/modeling/footprint";
import type { ResidentialParameters } from "@/lib/ai/modeling/allocation";
import { useCallback,useState } from "react";
import { FiMaximize2 } from "react-icons/fi";
import AiSketchWorkspace from "./AiSketchWorkspace";
type Point={x:number;y:number};
export default function AiFootprintCanvas({parameters,onChange,disabled,building}:{parameters:ResidentialParameters;onChange:(p:ResidentialParameters)=>void;disabled:boolean;building?:ReturnType<typeof import("@/lib/ai/modeling/footprint").allocateBuilding>|null}){
  const [expanded,setExpanded]=useState(false);
  const closeWorkspace=useCallback(()=>setExpanded(false),[]);
  const sketch=parameters.sketches?.[0];
  const shape=sketch?"drawn":parameters.footprint??"rectangle",points=sketch?.points.length?sketch.points.map(p=>({x:p.xMm/Math.max(...sketch.points.map(p=>p.xMm),1),y:p.yMm/Math.max(...sketch.points.map(p=>p.yMm),1)})):shape==="drawn"?parameters.footprintPoints??[]:FOOTPRINTS[shape];
  const spanX=Math.max(.01,Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x))),spanY=Math.max(.01,Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y)));
  const add=(e:React.MouseEvent<SVGSVGElement>)=>{
    if(shape!=="drawn"||sketch||disabled||points.length>=16)return;
    const b=e.currentTarget.getBoundingClientRect();
    const point={x:Math.round(Math.max(0,Math.min(1,((e.clientX-b.left)/b.width*120-10)/100))*20)/20,y:Math.round(Math.max(0,Math.min(1,((e.clientY-b.top)/b.height*120-10)/100))*20)/20};
    if(points.some(p=>p.x===point.x&&p.y===point.y))return;
    onChange({...parameters,footprintPoints:[...points,point]});
  };
  const svgPoints=(p:Point[])=>p.map(p=>`${10+p.x*100},${10+p.y*100}`).join(" ");
  const allocation=building?.allocation;
  const w=building?.polygon?Math.max(...building.polygon.map(p=>p.xMm)):allocation?.internalWidthMm??1,d=building?.polygon?Math.max(...building.polygon.map(p=>p.yMm)):allocation?.internalDepthMm??1;
  const bx=building?.block?.xMm??0,by=building?.block?.yMm??0;
  return <div className="ai-footprint-chooser">
    <button type="button" className="ai-expand-sketch" disabled={disabled} onClick={()=>setExpanded(true)} aria-label="Expand drawing workspace" title="Expand drawing workspace"><FiMaximize2/> Expand</button>
    {expanded&&<AiSketchWorkspace parameters={parameters} building={building} onChange={onChange} onClose={closeWorkspace} disabled={disabled}/>}
    <div className="ai-suggestion-row">{(["rectangle","l","u","drawn"]as const).map(s=><button key={s} type="button" disabled={disabled} aria-pressed={shape===s} onClick={()=>onChange({...parameters,footprint:s,sketches:undefined})}>{s==="rectangle"?"Rectangle":s==="l"?"L shape":s==="u"?"U shape":"Draw outline"}</button>)}</div>
    <svg className="ai-footprint-canvas" viewBox="0 0 120 120" role="img" aria-label={shape==="drawn"?"Draw building footprint by clicking corners":"Building footprint preview"} onClick={add}>
      <defs><pattern id="ai-footprint-grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="currentColor" strokeWidth=".15" opacity=".25"/></pattern></defs>
      <rect x="10" y="10" width="100" height="100" fill="url(#ai-footprint-grid)"/>
      {points.length>=3?<polygon points={svgPoints(points)} fill="#60a5fa33" stroke="#60a5fa" strokeWidth="1.5"/>:<polyline points={svgPoints(points)} fill="none" stroke="#60a5fa" strokeWidth="1.5"/>}
      {allocation&&shape!=="drawn"&&<g>{Array.from({length:allocation.bays},(_,i)=>{const x=10+(bx+i*(allocation.roomWidthMm+150))/w*100,y=10+by/d*100;return <g key={i}><rect x={x} y={y} width={allocation.roomWidthMm/w*100} height={allocation.roomDepthMm/d*100} fill="#60a5fa66" stroke="currentColor" strokeWidth=".25"/><text x={x+allocation.roomWidthMm/w*50} y={y+allocation.roomDepthMm/d*50} textAnchor="middle" fontSize="4" fill="currentColor">Bed / study</text></g>;})}<text x={10+(bx+allocation.internalWidthMm/2)/w*100} y={10+(by+allocation.roomDepthMm+750)/d*100} textAnchor="middle" fontSize="4" fill="currentColor">Corridor</text><rect x={10+bx/w*100} y={10+(by+allocation.roomDepthMm+1500)/d*100} width={allocation.bathroomWidthMm/w*100} height={allocation.bathroomDepthMm/d*100} fill="#c084fc55"/><text x={10+(bx+allocation.bathroomWidthMm+allocation.internalWidthMm)/2/w*100} y={10+(by+allocation.internalDepthMm-1000)/d*100} fontSize="4" textAnchor="middle" fill="currentColor">Living / kitchen</text></g>}
      {points.map((p,i)=><g key={i}><circle cx={10+p.x*100} cy={10+p.y*100} r="1.6" fill="#2563eb"/>{parameters.widthM&&parameters.lengthM&&points.length>=3&&<text x={10+(p.x+points[(i+1)%points.length].x)*50} y={9+(p.y+points[(i+1)%points.length].y)*50} fontSize="3.5" textAnchor="middle" fill="currentColor">{Math.hypot((p.x-points[(i+1)%points.length].x)/spanX*parameters.widthM,(p.y-points[(i+1)%points.length].y)/spanY*parameters.lengthM).toFixed(1)} m</text>}</g>)}
    </svg>
    {sketch&&<p className="ai-text-muted">Custom floor drawing. Expand the workspace to edit lines, dimensions or floors.</p>}
    {shape==="drawn"&&!sketch&&<><p className="ai-text-muted">Click corners in order (up to 16). The last edge closes automatically. Set the overall width and length below.</p><div className="ai-suggestion-row"><button type="button" disabled={disabled||!points.length} onClick={()=>onChange({...parameters,footprintPoints:points.slice(0,-1)})}>Undo corner</button><button type="button" disabled={disabled} onClick={()=>onChange({...parameters,footprintPoints:[]})}>Clear outline</button></div></>}
  </div>;
}
