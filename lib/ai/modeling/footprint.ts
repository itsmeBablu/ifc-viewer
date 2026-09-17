import { allocateResidential, type ResidentialParameters } from "./allocation";
import { validateBoundary } from "../validate";
import type { AiAction } from "../schema";
import { ShapeUtils,Vector2 } from "three";

type Point = { xMm: number; yMm: number };
export const FOOTPRINTS = {
  rectangle: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
  l: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: .65 }, { x: .65, y: .65 }, { x: .65, y: 1 }, { x: 0, y: 1 }],
  u: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: .75, y: 1 }, { x: .75, y: .7 }, { x: .25, y: .7 }, { x: .25, y: 1 }, { x: 0, y: 1 }],
};
export function polygonArea(points: Point[]) { return Math.abs(points.reduce((s, p, i) => { const q = points[(i + 1) % points.length]; return s + p.xMm * q.yMm - q.xMm * p.yMm; }, 0)) / 2; }
/** Parallel edge intersections keep user dimensions on the clear interior wall faces. */
export function offsetPolygon(points:Point[],distance:number):Point[]{
  const signed=points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p.xMm*q.yMm-q.xMm*p.yMm;},0),direction=signed>0?1:-1;
  return points.map((p,i)=>{
    const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length];
    const ax=p.xMm-prev.xMm,ay=p.yMm-prev.yMm,bx=next.xMm-p.xMm,by=next.yMm-p.yMm,al=Math.hypot(ax,ay),bl=Math.hypot(bx,by);
    const a={xMm:p.xMm+direction*ay/al*distance,yMm:p.yMm-direction*ax/al*distance},b={xMm:p.xMm+direction*by/bl*distance,yMm:p.yMm-direction*bx/bl*distance};
    const cross=ax*by-ay*bx;
    if(Math.abs(cross)<.001)return b;
    const scale=((b.xMm-a.xMm)*by-(b.yMm-a.yMm)*bx)/cross;
    const result={xMm:a.xMm+ax*scale,yMm:a.yMm+ay*scale};
    if(Math.hypot(result.xMm-p.xMm,result.yMm-p.yMm)>Math.abs(distance)*8)throw new Error("The outline has a very sharp corner. Widen that corner for usable walls.");
    return result;
  });
}
/** Triangulate first so clipping a concave outline never bridges its courtyard. */
export function polygonAroundOpening(points:Point[],hole:{x:number;y:number;w:number;d:number}):Point[][]{
  const triangles=ShapeUtils.triangulateShape(points.map(p=>new Vector2(p.xMm,p.yMm)),[]);
  const clip=(polygon:Point[],axis:"xMm"|"yMm",bound:number,less:boolean)=>{
    const output:Point[]=[];
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length],ai=less?a[axis]<=bound:a[axis]>=bound,bi=less?b[axis]<=bound:b[axis]>=bound;
      if(ai)output.push(a);
      if(ai!==bi){const f=(bound-a[axis])/(b[axis]-a[axis]);output.push({xMm:a.xMm+(b.xMm-a.xMm)*f,yMm:a.yMm+(b.yMm-a.yMm)*f});}
    }
    return output.filter((p,i)=>!output.slice(0,i).some(q=>Math.hypot(p.xMm-q.xMm,p.yMm-q.yMm)<.01));
  };
  const regions:Point[][][]=[[],[],[],[]];
  for(const indices of triangles){
    const triangle=indices.map(i=>points[i]);
    const middle=clip(clip(triangle,"yMm",hole.y,false),"yMm",hole.y+hole.d,true);
    const pieces=[clip(triangle,"yMm",hole.y,true),clip(triangle,"yMm",hole.y+hole.d,false),clip(middle,"xMm",hole.x,true),clip(middle,"xMm",hole.x+hole.w,false)];
    pieces.forEach((p,i)=>{if(p.length>=3&&polygonArea(p)>1)regions[i].push(p);});
  }
  const result:Point[][]=[];
  const equal=(a:Point,b:Point)=>Math.hypot(a.xMm-b.xMm,a.yMm-b.yMm)<.01;
  for(const region of regions){
    let merged=true;
    while(merged){merged=false;
      outer:for(let i=0;i<region.length;i++)for(let j=i+1;j<region.length;j++){
        const a=region[i],b=region[j];
        for(let ai=0;ai<a.length;ai++)for(let bi=0;bi<b.length;bi++)if(equal(a[ai],b[(bi+1)%b.length])&&equal(a[(ai+1)%a.length],b[bi])){
          region[i]=[...Array.from({length:a.length-1},(_,k)=>a[(ai+1+k)%a.length]),...Array.from({length:b.length-1},(_,k)=>b[(bi+1+k)%b.length])];
          region.splice(j,1);merged=true;break outer;
        }
      }
    }
    for(const raw of region){
      const p=raw.filter((b,i)=>{const a=raw[(i+raw.length-1)%raw.length],c=raw[(i+1)%raw.length];return Math.abs((b.xMm-a.xMm)*(c.yMm-b.yMm)-(b.yMm-a.yMm)*(c.xMm-b.xMm))>.01;});
      if(p.length>=3&&polygonArea(p)>=10001){validateBoundary(p);result.push(p);}
    }
  }
  return result;
}
export function insidePolygon(p: Point, points: Point[]) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j], b = points[i];
    const cross = (p.xMm-a.xMm)*(b.yMm-a.yMm)-(p.yMm-a.yMm)*(b.xMm-a.xMm);
    if (Math.abs(cross) < .01 && p.xMm >= Math.min(a.xMm,b.xMm)-.01 && p.xMm <= Math.max(a.xMm,b.xMm)+.01 && p.yMm >= Math.min(a.yMm,b.yMm)-.01 && p.yMm <= Math.max(a.yMm,b.yMm)+.01) return true;
    if ((a.yMm > p.yMm) !== (b.yMm > p.yMm) && p.xMm < (b.xMm-a.xMm)*(p.yMm-a.yMm)/(b.yMm-a.yMm)+a.xMm) inside = !inside;
  }
  return inside;
}
function rectangleInside(x: number, y: number, w: number, d: number, points: Point[]) {
  for (const px of [x,x+w/2,x+w]) for (const py of [y,y+d/2,y+d]) if (!insidePolygon({ xMm:px,yMm:py },points)) return false;
  // A polygon boundary must never cross the open interior of an inscribed rectangle.
  for (let i=0;i<points.length;i++) {
    const a=points[i],b=points[(i+1)%points.length];
    for (const p of [a,{ xMm:(a.xMm+b.xMm)/2,yMm:(a.yMm+b.yMm)/2 }]) if(p.xMm>x+.01&&p.xMm<x+w-.01&&p.yMm>y+.01&&p.yMm<y+d-.01) return false;
  }
  return true;
}
function inscribedRectangle(points: Point[]) {
  const xs=[...new Set(points.map(p=>p.xMm))].sort((a,b)=>a-b),ys=[...new Set(points.map(p=>p.yMm))].sort((a,b)=>a-b);
  // Extra grid coordinates allow a usable block inside diagonal, freely drawn outlines.
  for(let i=1;i<8;i++){xs.push(xs[0]+(Math.max(...xs)-xs[0])*i/8);ys.push(ys[0]+(Math.max(...ys)-ys[0])*i/8);}
  xs.sort((a,b)=>a-b);ys.sort((a,b)=>a-b);
  let best={ xMm:0,yMm:0,widthMm:0,depthMm:0 };
  for(let i=0;i<xs.length;i++)for(let j=i+1;j<xs.length;j++)for(let k=0;k<ys.length;k++)for(let l=k+1;l<ys.length;l++){
    const w=xs[j]-xs[i],d=ys[l]-ys[k];
    if(w*d<=best.widthMm*best.depthMm||w<1000||d<1000)continue;
    if(rectangleInside(xs[i],ys[k],w,d,points))best={ xMm:xs[i],yMm:ys[k],widthMm:w,depthMm:d };
  }
  if(!best.widthMm)throw new Error("Draw a wider footprint with usable room space.");
  return best;
}
export function allocateBuilding(input: ResidentialParameters, heightMm=3000, thicknessMm=200) {
  for(const [name,value,min,max]of [["Building width",input.widthM,4,80],["Building length",input.lengthM,4,80],["Garage width",input.garageWidthM,3,12],["Garage length",input.garageDepthM,5.5,15],["Garden area",input.gardenAreaM2,0,2000]]as const)if(value!==undefined&&(!Number.isFinite(value)||value<min||value>max))throw new Error(`${name} must be between ${min} and ${max}.`);
  if((input.footprint??"rectangle")==="rectangle" && input.widthM===undefined && input.lengthM===undefined) return { allocation:allocateResidential(input,heightMm,thicknessMm),polygon:null,block:null,extraAreaM2:0 };
  if((input.widthM===undefined)!==(input.lengthM===undefined))throw new Error("Enter both building width and length, or leave both automatic.");
  const shape=input.footprint??"rectangle";
  const source=shape==="drawn"?input.footprintPoints:FOOTPRINTS[shape];
  if(!source || source.length<3)throw new Error("Draw at least three outline corners and close the footprint.");
  const minX=Math.min(...source.map(p=>p.x)),maxX=Math.max(...source.map(p=>p.x)),minY=Math.min(...source.map(p=>p.y)),maxY=Math.max(...source.map(p=>p.y));
  if(maxX-minX<.05||maxY-minY<.05)throw new Error("The footprint needs usable width and length.");
  const normalized=source.map(p=>({ xMm:(p.x-minX)/(maxX-minX),yMm:(p.y-minY)/(maxY-minY) }));
  // Validation uses millimetres; scale unit coordinates before checking geometric tolerances.
  validateBoundary(normalized.map(p=>({xMm:p.xMm*10000,yMm:p.yMm*10000})));
  const floors=input.variant==="duplex"?2:1;
  const preferred=allocateResidential({...input,totalAreaM2:undefined},heightMm,thicknessMm).recommendedAreaM2;
  const ratio=polygonArea(normalized);
  let scale=Math.sqrt((input.totalAreaM2??preferred)*1e6/floors/ratio);
  let lastError="";
  for(let attempt=0;attempt<35;attempt++){
    const polygon=normalized.map(p=>({xMm:p.xMm*(input.widthM!==undefined?input.widthM*1000:scale),yMm:p.yMm*(input.lengthM!==undefined?input.lengthM*1000:scale)}));
    const total=polygonArea(polygon)*floors/1e6;
    if(input.totalAreaM2!==undefined&&input.widthM!==undefined&&Math.abs(total-input.totalAreaM2)>.1)throw new Error(`Width and length give ${total.toFixed(1)} m² internal area for this shape. Use that total or adjust the dimensions.`);
    const block=inscribedRectangle(polygon);
    try{
      const allocation=allocateResidential({...input,totalAreaM2:block.widthMm*block.depthMm*floors/1e6},heightMm,thicknessMm,block.widthMm);
      const extraAreaM2=total-allocation.totalAreaM2;
      return { allocation,polygon,block,extraAreaM2 };
    }catch(e){lastError=e instanceof Error?e.message:"Room sizes do not fit.";}
    if(input.totalAreaM2!==undefined||input.widthM!==undefined)break;
    scale*=1.06;
    if(scale>80000)break;
  }
  throw new Error(`Rooms do not fit inside this footprint. Increase width/length or total area. ${lastError}`);
}

/** Add the real outline and open the furnished room block into its additional living wings. */
export function applyFootprint(actions: AiAction[], polygon: Point[], xMm:number,yMm:number,thicknessMm:number,heightMm:number,levelId:string,prefix:string) {
  const world=offsetPolygon(polygon,thicknessMm/2).map(p=>({xMm:p.xMm+xMm,yMm:p.yMm+yMm}));
  const slabBoundary=offsetPolygon(polygon,thicknessMm).map(p=>({xMm:p.xMm+xMm,yMm:p.yMm+yMm}));
  validateBoundary(world);validateBoundary(slabBoundary);
  const result:AiAction[]=[];
  const hosts=new Map<string,{id:string;position:(n:number)=>number}>();
  for(let i=0;i<world.length;i++){
    const a=world[i],b=world[(i+1)%world.length],id=`${prefix}:outline:${i}`;
    result.push({kind:"wall",operation:"create",id,levelId,startXmm:a.xMm,startYmm:a.yMm,endXmm:b.xMm,endYmm:b.yMm,thicknessMm,heightMm});
    for(const wall of actions.filter((a):a is Extract<AiAction,{kind:"wall"}>=>a.kind==="wall"&& /:wall:[0-3]$/.test(a.id))){
      const dx=b.xMm-a.xMm,dy=b.yMm-a.yMm,len=Math.hypot(dx,dy);
      const s=((wall.startXmm-a.xMm)*dx+(wall.startYmm-a.yMm)*dy)/len,e=((wall.endXmm-a.xMm)*dx+(wall.endYmm-a.yMm)*dy)/len;
      // Main-block walls sit one half-thickness outside their clear rectangle.
      const dist=Math.abs((wall.startXmm-a.xMm)*dy-(wall.startYmm-a.yMm)*dx)/len;
      const endDist=Math.abs((wall.endXmm-a.xMm)*dy-(wall.endYmm-a.yMm)*dx)/len;
      if(dist<.1&&endDist<.1&&Math.min(s,e)>=-.1&&Math.max(s,e)<=len+.1)hosts.set(wall.id,{id,position:n=>s+(e>s?n:-n)});
    }
  }
  const exterior=new Set(actions.filter(a=>a.kind==="wall"&&/:wall:[0-3]$/.test(a.id)).map(a=>a.id));
  for(const action of actions){
    if(action.kind==="wall"&&exterior.has(action.id)){
      if(hosts.has(action.id))continue;
      // Bound bedroom sides, but allow the shared zone to flow into the outer wings.
      const divider=actions.find((a):a is Extract<AiAction,{kind:"wall"}>=>a.kind==="wall"&&a.id===action.id.replace(/:[0-3]$/,":4"));
      if(divider&&(action.startXmm===action.endXmm))result.push({...action,startYmm:Math.min(action.startYmm,action.endYmm),endYmm:divider.startYmm});
      else if(action.id.endsWith(":wall:0"))result.push(action);
      continue;
    }
    if((action.kind==="door"||action.kind==="window")&&exterior.has(action.wallId)){
      const host=hosts.get(action.wallId);
      if(host)result.push({...action,wallId:host.id,positionMm:host.position(action.positionMm)});
      continue;
    }
    if(action.kind==="floor"&&action.id.endsWith(":floor"))result.push({...action,boundary:slabBoundary});
    else if(action.kind==="roof")result.push({...action,boundary:slabBoundary});
    else result.push(action);
  }
  // Each sufficiently long outline edge receives daylight; skip occupied window hosts.
  for(let i=0;i<world.length;i++){
    const a=world[i],b=world[(i+1)%world.length],id=`${prefix}:outline:${i}`,length=Math.hypot(b.xMm-a.xMm,b.yMm-a.yMm);
    if(length>=3000&&!result.some(r=>(r.kind==="window"||r.kind==="door")&&r.wallId===id))result.push({kind:"window",operation:"create",id:`${prefix}:outline-window:${i}`,wallId:id,positionMm:length/2,widthMm:1200,heightMm:1200,sillHeightMm:900,operationType:"casement"});
  }
  if(!result.some(a=>a.kind==="door"&&a.wallId.includes(":outline:"))){
    const candidates=world.map((a,i)=>({i,length:Math.hypot(world[(i+1)%world.length].xMm-a.xMm,world[(i+1)%world.length].yMm-a.yMm)})).filter(a=>a.length>=3000);
    const edge=candidates[0];
    if(edge){const host=`${prefix}:outline:${edge.i}`;for(let i=result.length-1;i>=0;i--)if(result[i].kind==="window"&&(result[i] as Extract<AiAction,{kind:"window"}>).wallId===host)result.splice(i,1);result.push({kind:"door",operation:"create",id:`${prefix}:outline-entry`,wallId:host,positionMm:edge.length/2,widthMm:900,heightMm:2100,hinge:"start",swing:1,style:"wood"});}
  }
  return result;
}
