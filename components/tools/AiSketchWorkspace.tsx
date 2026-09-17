"use client";
import { useEffect,useRef,useState } from "react";
import { createPortal } from "react-dom";
import type { FloorSketch,ResidentialParameters,SketchPoint } from "@/lib/ai/modeling/allocation";
import { FOOTPRINTS } from "@/lib/ai/modeling/footprint";
import { resizeSketchLine } from "@/lib/ai/modeling/sketchEditing";

export default function AiSketchWorkspace({parameters,onChange,onClose,disabled,building}:{parameters:ResidentialParameters;onChange:(p:ResidentialParameters)=>void;onClose:()=>void;disabled:boolean;building?:ReturnType<typeof import("@/lib/ai/modeling/footprint").allocateBuilding>|null}){
  const source=parameters.footprint==="drawn"?parameters.footprintPoints??[]:FOOTPRINTS[parameters.footprint??"rectangle"];
  const seed:FloorSketch={points:building?.polygon??source.map(p=>({xMm:p.x*(parameters.widthM?parameters.widthM*1000:building?.allocation.internalWidthMm??14000),yMm:p.y*(parameters.lengthM?parameters.lengthM*1000:building?.allocation.internalDepthMm??14000)})),lines:[]};
  const sketches=parameters.sketches??Array.from({length:parameters.variant==="duplex"?2:1},()=>seed);
  const [floor,setFloor]=useState(0),[tool,setTool]=useState<"select"|"outline"|"interior">("select"),[below,setBelow]=useState(true),[anchor,setAnchor]=useState<SketchPoint|null>(null),[selected,setSelected]=useState<{index:number;interior:boolean}|null>(null),[length,setLength]=useState(""),[error,setError]=useState("");
  const closeRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;closeRef.current?.focus();const handler=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();};document.addEventListener("keydown",handler);return()=>{document.removeEventListener("keydown",handler);previous?.focus();};},[onClose]);
  const current=sketches[Math.min(floor,sketches.length-1)];
  const extent=Math.max(16000,...sketches.flatMap(s=>s.points.flatMap(p=>[p.xMm,p.yMm])))+2000;
  const replace=(s:FloorSketch)=>{setError("");onChange({...parameters,sketches:sketches.map((old,i)=>i===floor?s:old)});};
  const chooseLine=(index:number,interior:boolean)=>{if(tool!=="select")return;const a=interior?current.lines[index].start:current.points[index],b=interior?current.lines[index].end:current.points[(index+1)%current.points.length];setSelected({index,interior});setLength((Math.hypot(b.xMm-a.xMm,b.yMm-a.yMm)/1000).toFixed(2));};
  const click=(event:React.MouseEvent<SVGSVGElement>)=>{
    if(disabled||tool==="select")return;
    const rect=event.currentTarget.getBoundingClientRect();
    let point={xMm:Math.round(((event.clientX-rect.left)/rect.width*extent-500)/250)*250,yMm:Math.round(((event.clientY-rect.top)/rect.height*extent-500)/250)*250};
    point={xMm:Math.max(0,Math.min(80000,point.xMm)),yMm:Math.max(0,Math.min(80000,point.yMm))};
    // Snap to existing corners and line intersections, rather than only the grid.
    const candidates=[...current.points,...current.lines.flatMap(l=>[l.start,l.end])];
    const snap=candidates.find(p=>Math.hypot(p.xMm-point.xMm,p.yMm-point.yMm)<extent*.025);
    if(snap)point=snap;
    if(tool==="outline"){
      if(current.points.length>=32){setError("Use up to 32 outline corners.");return;}
      if(!current.points.some(p=>p.xMm===point.xMm&&p.yMm===point.yMm))replace({...current,points:[...current.points,point]});
    }else if(current.lines.length>=30)setError("Use up to 30 interior lines per floor.");
    else if(!anchor)setAnchor(point);
    else{if(Math.hypot(anchor.xMm-point.xMm,anchor.yMm-point.yMm)>=300)replace({...current,lines:[...current.lines,{start:anchor,end:point}]});setAnchor(null);}
  };
  const drawing=(s:FloorSketch,ghost=false)=><g className={ghost?"ai-sketch-below":"ai-sketch-current"} pointerEvents={ghost?"none":undefined}>
    {s.points.length>=3&&<polygon points={s.points.map(p=>`${p.xMm+500},${p.yMm+500}`).join(" ")} fill={ghost?"#f59e0b15":"#60a5fa18"} stroke="none"/>}
    {s.points.map((a,i)=>{const b=s.points[(i+1)%s.points.length];return <g key={i}><line x1={a.xMm+500} y1={a.yMm+500} x2={b.xMm+500} y2={b.yMm+500} stroke={ghost?"#f59e0b":selected?.index===i&&!selected.interior?"#22c55e":"#60a5fa"} strokeWidth={extent*(ghost ? .006 : .003)} strokeDasharray={ghost?`${extent*.012} ${extent*.008}`:undefined}/>{!ghost&&<line x1={a.xMm+500} y1={a.yMm+500} x2={b.xMm+500} y2={b.yMm+500} stroke="transparent" strokeWidth={extent*.018} onClick={e=>{if(tool==="select"){e.stopPropagation();chooseLine(i,false);}}}/>}<text x={(a.xMm+b.xMm)/2+500} y={(a.yMm+b.yMm)/2+350} fontSize={extent*.018} textAnchor="middle" fill={ghost?"#b45309":"currentColor"}>{(Math.hypot(b.xMm-a.xMm,b.yMm-a.yMm)/1000).toFixed(1)} m</text></g>;})}
    {s.lines.map((l,i)=><g key={`i${i}`}><line x1={l.start.xMm+500} y1={l.start.yMm+500} x2={l.end.xMm+500} y2={l.end.yMm+500} stroke={ghost?"#f59e0b":selected?.index===i&&selected.interior?"#22c55e":"#a78bfa"} strokeWidth={extent*(ghost ? .006 : .003)} strokeDasharray={ghost?`${extent*.012} ${extent*.008}`:undefined}/>{!ghost&&<line x1={l.start.xMm+500} y1={l.start.yMm+500} x2={l.end.xMm+500} y2={l.end.yMm+500} stroke="transparent" strokeWidth={extent*.018} onClick={e=>{if(tool==="select"){e.stopPropagation();chooseLine(i,true);}}}/>}</g>)}
  </g>;
  return createPortal(<div className="ai-sketch-overlay"><section role="dialog" aria-modal="true" aria-label="House drawing workspace" className="ai-sketch-workspace" onKeyDown={e=>{if(e.key!=="Escape")e.stopPropagation();if(e.key==="Tab"){const targets=[...e.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled),select:not(:disabled),input:not(:disabled)")],first=targets[0],last=targets[targets.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
    <header><strong>Draw your building</strong><button ref={closeRef} type="button" onClick={onClose}>Done · return to chat</button></header>
    <div className="ai-sketch-toolbar"><label>Building<select aria-label="Sketch building type" value={parameters.variant} disabled={disabled} onChange={e=>onChange({...parameters,variant:e.target.value as ResidentialParameters["variant"],sketches:e.target.value==="duplex"&&sketches.length===1?[current,{points:current.points,lines:[]}]:sketches})}><option value="apartment">Apartment</option><option value="villa">Villa / house</option><option value="duplex">Multi-storey house</option></select></label><label>Floor<select aria-label="Drawing floor" value={floor} onChange={e=>{setFloor(Number(e.target.value));setAnchor(null);setSelected(null);}}>{sketches.map((_,i)=><option key={i} value={i}>{i===0?"Ground floor":`Floor ${i}`}</option>)}</select></label><button type="button" disabled={disabled||sketches.length>=4} onClick={()=>{onChange({...parameters,variant:"duplex",sketches:[...sketches,{points:current.points,lines:[]}]});setFloor(sketches.length);setSelected(null);}}>Add floor</button><label><input type="checkbox" checked={below} onChange={e=>setBelow(e.target.checked)}/> Show floor below <span className="ai-sketch-legend">amber dashed</span></label></div>
    <div className="ai-sketch-body"><div className="ai-sketch-drawing"><svg viewBox={`0 0 ${extent} ${extent}`} preserveAspectRatio="none" onClick={click} aria-label="Editable floor drawing" role="img"><defs><pattern id="ai-sketch-grid" width="1000" height="1000" patternUnits="userSpaceOnUse"><path d="M1000 0H0V1000" fill="none" stroke="currentColor" strokeWidth="10" opacity=".12"/></pattern></defs><rect width={extent} height={extent} fill="url(#ai-sketch-grid)"/>{below&&floor>0&&drawing(sketches[floor-1],true)}{drawing(current)}{anchor&&<circle cx={anchor.xMm+500} cy={anchor.yMm+500} r={extent*.007} fill="#a78bfa"/>}</svg></div>
    <aside><div className="ai-suggestion-row">{(["select","outline","interior"]as const).map(t=><button key={t} type="button" aria-pressed={tool===t} onClick={()=>{setTool(t);setAnchor(null);}}>{t==="select"?"Select lines":t==="outline"?"Outside lines":"Inside lines"}</button>)}</div><p>Outside: click corners in order; closes automatically. Inside: click two endpoints. Select a line to enter its length. Blue is this floor; purple is an interior wall.</p>
      {selected&&<label>Selected line length · m<input aria-label="Selected sketch line length in metres" type="number" step=".1" min=".3" max="80" value={length} onChange={e=>setLength(e.target.value)}/><button type="button" disabled={disabled} onClick={()=>{try{replace(resizeSketchLine(current,selected.index,selected.interior,Number(length)*1000));}catch(e){setError(e instanceof Error?e.message:"Check the length.");}}}>Apply length</button></label>}
      <button type="button" disabled={disabled} onClick={()=>{replace(tool==="interior"?{...current,lines:[]}:{points:[],lines:[]});setSelected(null);setAnchor(null);}}>Draw this floor again</button><button type="button" disabled={disabled} onClick={()=>{replace(tool==="interior"?{...current,lines:current.lines.slice(0,-1)}:{...current,points:current.points.slice(0,-1)});setSelected(null);}}>Undo last line</button>
      {floor>0&&<button type="button" disabled={disabled} onClick={()=>replace({points:sketches[floor-1].points,lines:[]})}>Copy outline from below</button>}
      {error&&<p role="alert" className="ai-error">{error}</p>}<p>Draw interior partitions to control rooms. With only an outside outline, rooms are arranged automatically. Floors share the same drawing origin.</p>
    </aside></div>
  </section></div>,document.body);
}
