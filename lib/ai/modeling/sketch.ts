import type { FloorSketch,ResidentialParameters,SketchPoint } from "./allocation";
import { conceptStair } from "./allocation";
import { allocateBuilding,applyFootprint,insidePolygon,inscribedRectangle,offsetPolygon,polygonArea,polygonAroundOpening } from "./footprint";
import { apartmentActions,apartmentSchema } from "./apartment";
import { furnishFloor,outdoorActions,gardenActions } from "./furnishing";
import { arrangeRoom,type FurnitureRect } from "./roomFurniture";
import type { AiAction } from "../schema";
import { validateBoundary } from "../validate";
import { homeDetails } from "./details";

type Segment={start:SketchPoint;end:SketchPoint};
const cross=(a:SketchPoint,b:SketchPoint)=>a.xMm*b.yMm-a.yMm*b.xMm;
const minus=(a:SketchPoint,b:SketchPoint)=>({xMm:a.xMm-b.xMm,yMm:a.yMm-b.yMm});
const pointSegmentDistance=(p:SketchPoint,a:SketchPoint,b:SketchPoint)=>{const dx=b.xMm-a.xMm,dy=b.yMm-a.yMm,t=Math.max(0,Math.min(1,((p.xMm-a.xMm)*dx+(p.yMm-a.yMm)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.xMm-(a.xMm+t*dx),p.yMm-(a.yMm+t*dy));};
function intersection(a:Segment,b:Segment){const r=minus(a.end,a.start),s=minus(b.end,b.start),den=cross(r,s);if(Math.abs(den)<.001)return null;const t=cross(minus(b.start,a.start),s)/den,u=cross(minus(b.start,a.start),r)/den;return t>=-.00001&&t<=1.00001&&u>=-.00001&&u<=1.00001?{t,u,point:{xMm:a.start.xMm+t*r.xMm,yMm:a.start.yMm+t*r.yMm}}:null;}
export function sketchSegments(s:FloorSketch):Segment[]{return [...s.points.map((start,i)=>({start,end:s.points[(i+1)%s.points.length]})),...s.lines];}
/** Trim drafting overshoots at every crossing, including concave courtyard edges. */
export function clipSketchLines(s: FloorSketch): FloorSketch {
  if (s.points.length < 3) return s;
  const boundary = sketchSegments({ ...s, lines: [] });
  const lines = s.lines.flatMap(line => {
    const cuts = [...new Set([0, 1, ...boundary.flatMap(edge => {
      const hit = intersection(line, edge);
      return hit ? [Math.max(0, Math.min(1, hit.t))] : [];
    })])].sort((a, b) => a - b);
    const at = (t: number) => ({ xMm: line.start.xMm + (line.end.xMm - line.start.xMm) * t, yMm: line.start.yMm + (line.end.yMm - line.start.yMm) * t });
    return cuts.slice(1).flatMap((end, i) => {
      const start = cuts[i], mid = at((start + end) / 2);
      if (!insidePolygon(mid, s.points) || boundary.some(edge => pointSegmentDistance(mid, edge.start, edge.end) < .01)) return [];
      const a = at(start), b = at(end);
      return Math.hypot(b.xMm - a.xMm, b.yMm - a.yMm) >= 300 ? [{ start: a, end: b }] : [];
    });
  });
  // Remap metadata only for segments retained without splitting or trimming.
  const mapIndex = (index: number) => lines.findIndex(l => l.start.xMm === s.lines[index]?.start.xMm && l.start.yMm === s.lines[index]?.start.yMm && l.end.xMm === s.lines[index]?.end.xMm && l.end.yMm === s.lines[index]?.end.yMm);
  const remap = <T extends { interior: boolean; index: number }>(items: T[] | undefined) => items?.flatMap(item => {
    if (!item.interior) return [item];
    const index = mapIndex(item.index);
    return index < 0 ? [] : [{ ...item, index }];
  });
  return { ...s, lines, locks: remap(s.locks), wallTypes: remap(s.wallTypes) };
}
/** Joins hand-drawn endpoints into a shared CAD vertex, tolerating small pointer drift. */
export function normalizeSketchJunctions(s:FloorSketch, toleranceMm = 350): FloorSketch {
  const vertices: SketchPoint[] = [];
  const join = (p: SketchPoint) => {
    const existing = vertices.find(v => Math.hypot(v.xMm - p.xMm, v.yMm - p.yMm) <= toleranceMm);
    if (existing) return existing;
    const next = { xMm: Math.round(p.xMm / 50) * 50, yMm: Math.round(p.yMm / 50) * 50 };
    vertices.push(next); return next;
  };
  return { ...s, points: s.points.map(join), lines: s.lines.map(l => ({ start: join(l.start), end: join(l.end) })) };
}
export function ensureSketchBoundary(s:FloorSketch):FloorSketch {
  if (s.points.length >= 3) return s;
  if (!s.lines.length) return s;
  const xs = s.lines.flatMap(l => [l.start.xMm, l.end.xMm]);
  const ys = s.lines.flatMap(l => [l.start.yMm, l.end.yMm]);
  const pad = 1000;
  const minX = Math.max(0, Math.min(...xs) - pad), maxX = Math.min(80000, Math.max(...xs) + pad);
  const minY = Math.max(0, Math.min(...ys) - pad), maxY = Math.min(80000, Math.max(...ys) + pad);
  return {
    ...s,
    points: [
      { xMm: minX, yMm: minY },
      { xMm: maxX, yMm: minY },
      { xMm: maxX, yMm: maxY },
      { xMm: minX, yMm: maxY },
    ]
  };
}

export function validateSketches(sketches:FloorSketch[]){
  if(!sketches.length||sketches.length>8)throw new Error("Choose one to eight floors.");
  for(const [floor,rawS] of sketches.entries()){
    const s = clipSketchLines(ensureSketchBoundary(rawS));
    if (s.points.length >= 3) validateBoundary(s.points);
    for(const garden of s.gardens??[])validateBoundary(garden);
    const rooms=sketchRooms(s);
    for(const label of s.labels??[])if(!rooms.some(r=>insidePolygon(label.point,r)))throw new Error(`Floor ${floor}: room name ${label.name} must be inside a closed room.`);
    for(const lock of s.locks??[]){const a=lock.interior?s.lines[lock.index]?.start:s.points[lock.index],b=lock.interior?s.lines[lock.index]?.end:s.points[(lock.index+1)%s.points.length];if(!a||!b||Math.abs(Math.hypot(b.xMm-a.xMm,b.yMm-a.yMm)-lock.lengthMm)>1)throw new Error(`Floor ${floor}: a locked line has changed length.`);}

    const all=sketchSegments(s);
    for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
      if(j<s.points.length)continue;
      const a=all[i],b=all[j],r=minus(a.end,a.start),length=Math.hypot(r.xMm,r.yMm);
      if(Math.abs(cross(r,minus(b.start,a.start)))>.1||Math.abs(cross(r,minus(b.end,a.start)))>.1)continue;
      const t=(p:SketchPoint)=>((p.xMm-a.start.xMm)*r.xMm+(p.yMm-a.start.yMm)*r.yMm)/length;
      if(Math.min(length,Math.max(t(b.start),t(b.end)))-Math.max(0,Math.min(t(b.start),t(b.end)))>10)throw new Error(`Floor ${floor}: an interior line overlaps another wall.`);
    }
    for(const l of s.lines){
      if(Math.hypot(l.end.xMm-l.start.xMm,l.end.yMm-l.start.yMm)<300)throw new Error(`Floor ${floor}: interior lines need at least 0.3 m.`);
      const cuts=[0,1,...sketchSegments({...s,lines:[]}).flatMap(edge=>{const i=intersection(l,edge);return i?[i.t]:[];})].sort((a,b)=>a-b);
      for(const t of [...cuts,...cuts.slice(1).map((t,i)=>(t+cuts[i])/2)]){const point={xMm:l.start.xMm+(l.end.xMm-l.start.xMm)*t,yMm:l.start.yMm+(l.end.yMm-l.start.yMm)*t};if(!insidePolygon(point,s.points)&&Math.min(...s.points.map((p,i)=>pointSegmentDistance(point,p,s.points[(i+1)%s.points.length])))>300)throw new Error(`Floor ${floor}: an interior line extends outside the outline.`);}
    }
  }
}
/** Split intersections/T-junctions and walk directed half-edges to recover bounded rooms. */
export function sketchRooms(s:FloorSketch):SketchPoint[][]{
  const segments=sketchSegments(s),nodes=new Map<string,SketchPoint>(),neighbors=new Map<string,Set<string>>();
  const key=(p:SketchPoint)=>`${Math.round(p.xMm*100)},${Math.round(p.yMm*100)}`;
  segments.forEach((line,index)=>{
    const points=[{t:0,point:line.start},{t:1,point:line.end},...segments.flatMap((other,j)=>{const i=j===index?null:intersection(line,other);return i?[i]:[];})].sort((a,b)=>a.t-b.t);
    points.forEach(({point})=>nodes.set(key(point),point));
    for(let i=1;i<points.length;i++){const a=key(points[i-1].point),b=key(points[i].point);if(a===b)continue;if(!neighbors.has(a))neighbors.set(a,new Set());if(!neighbors.has(b))neighbors.set(b,new Set());neighbors.get(a)!.add(b);neighbors.get(b)!.add(a);}
  });
  const ordered=new Map([...neighbors].map(([id,set])=>{const p=nodes.get(id)!;return [id,[...set].sort((a,b)=>Math.atan2(nodes.get(a)!.yMm-p.yMm,nodes.get(a)!.xMm-p.xMm)-Math.atan2(nodes.get(b)!.yMm-p.yMm,nodes.get(b)!.xMm-p.xMm))];}));
  const visited=new Set<string>(),rooms:SketchPoint[][]=[];
  for(const [start,list]of ordered)for(const next of list){
    if(visited.has(`${start}>${next}`))continue;
    let a=start,b=next;const face:string[]=[];
    for(let step=0;step<segments.length*10;step++){
      const edge=`${a}>${b}`;if(visited.has(edge))break;visited.add(edge);face.push(a);
      const options=ordered.get(b)!,reverse=options.indexOf(a),c=options[(reverse-1+options.length)%options.length];a=b;b=c;if(a===start&&b===next)break;
    }
    // Dangling wall branches are not room boundaries; remove their out-and-back walk.
    let reduced=face;let change=true;while(change&&reduced.length>2){change=false;for(let i=0;i<reduced.length;i++)if(reduced[(i+reduced.length-1)%reduced.length]===reduced[(i+1)%reduced.length]){reduced=reduced.filter((_,j)=>j!==i&&j!==(i+1)%reduced.length);change=true;break;}}
    const polygon=reduced.map(id=>nodes.get(id)!);
    const signed=polygon.reduce((sum,p,i)=>sum+cross(p,polygon[(i+1)%polygon.length]),0);
    if(polygon.length>=3&&signed>20000){try{validateBoundary(polygon);rooms.push(polygon);}catch{/* A repeated spur is excluded from furnishing, while the wall remains. */}}
  }
  return rooms;
}

export function sketchActions(input:ResidentialParameters,id:string,groundId:string,baseElevation:number,height:number,thickness:number,x=0):AiAction[]{
  const sketches=(input.sketches??[]).map(s=>clipSketchLines(normalizeSketchJunctions(ensureSketchBoundary(s))));validateSketches(sketches);
  const actions:AiAction[]=[],stairs=conceptStair(height),floors=sketches.length;
  const automatic=sketches.map(s=>{
    if(s.lines.length||s.labels?.length)return null;
    const minX=Math.min(...s.points.map(p=>p.xMm)),minY=Math.min(...s.points.map(p=>p.yMm)),w=Math.max(...s.points.map(p=>p.xMm))-minX,d=Math.max(...s.points.map(p=>p.yMm))-minY;
    const bedrooms=Math.ceil(input.bedrooms/floors);
    return {minX,minY,brief:{...input,sketches:undefined,variant:floors>1?"duplex"as const:"apartment"as const,bedrooms,footprint:"drawn"as const,footprintPoints:s.points.map(p=>({x:(p.xMm-minX)/w,y:(p.yMm-minY)/d})),widthM:w/1000,lengthM:d/1000,totalAreaM2:undefined},building:allocateBuilding({...input,variant:floors>1?"duplex":"apartment",bedrooms,footprint:"drawn",footprintPoints:s.points.map(p=>({x:(p.xMm-minX)/w,y:(p.yMm-minY)/d})),widthM:w/1000,lengthM:d/1000,totalAreaM2:undefined},height,thickness)};
  });
  let stairRect:FurnitureRect|null=null;
  if(floors>1){
    const auto=automatic[0];
    if(auto){const layouts=automatic.filter((a):a is NonNullable<typeof a>=>!!a);stairRect={x:Math.max(...layouts.map(a=>a.minX+a.building.block!.xMm+a.building.allocation.bathroomWidthMm+300)),y:Math.max(...layouts.map(a=>a.minY+a.building.block!.yMm+a.building.allocation.corridorEndMm-thickness/2+75+1200)),w:stairs.widthMm,d:stairs.runMm+stairs.landingMm};}
    else{
      const living=sketchRooms(sketches[0]).sort((a,b)=>polygonArea(b)-polygonArea(a))[0];
      const block=inscribedRectangle(living??sketches[0].points);
      search:for(let y=block.yMm+300;y+stairs.runMm+stairs.landingMm<=block.yMm+block.depthMm-300;y+=500)for(let sx=block.xMm+300;sx+stairs.widthMm<=block.xMm+block.widthMm-300;sx+=500){
        const candidate={x:sx,y,w:stairs.widthMm,d:stairs.runMm+stairs.landingMm};
        if(sketches.every(s=>[0,.5,1].every(fx=>[0,.5,1].every(fy=>insidePolygon({xMm:sx+candidate.w*fx,yMm:y+candidate.d*fy},s.points)))&&!s.lines.some(l=>Math.max(l.start.xMm,l.end.xMm)>sx&&Math.min(l.start.xMm,l.end.xMm)<sx+candidate.w&&Math.max(l.start.yMm,l.end.yMm)>y&&Math.min(l.start.yMm,l.end.yMm)<y+candidate.d))){stairRect=candidate;break search;}
      }
    }
    if(!stairRect||!sketches.every(s=>[0,.5,1].every(fx=>[0,.5,1].every(fy=>insidePolygon({xMm:stairRect!.x+stairRect!.w*fx,yMm:stairRect!.y+stairRect!.d*fy},s.points)))))throw new Error("The floors need a common clear 2.55 m wide stair space. Align the outlines or enlarge the stair area.");
  }
  let remainingBeds=input.bedrooms;
  for(const [floor,s]of sketches.entries()){
    const levelId=floor?`${id}:level:${floor}`:groundId,prefix=`${id}:floor:${floor}`;
    if(floor)actions.push({kind:"level",operation:"create",id:levelId,name:`Floor ${floor}`,elevationMm:baseElevation+floor*stairs.riseMm,heightMm:height});
    const bedrooms=Math.min(remainingBeds,Math.ceil(input.bedrooms/floors));remainingBeds-=bedrooms;
    const auto=automatic[floor];
    if(auto){
      const a=auto.building.allocation,b=auto.building.block!,ox=x+auto.minX+b.xMm-thickness/2,oy=auto.minY+b.yMm-thickness/2;
      let layout=apartmentActions(apartmentSchema.parse({kind:"apartment_layout",id:prefix,levelId,bedrooms:Math.max(1,bedrooms),heightMm:height,thicknessMm:thickness,xMm:ox,yMm:oy,furnished:false}),{allocation:a,entrance:floor===0});
      layout.push(...furnishFloor({...input,variant:floors>1?"duplex":"apartment"},a,prefix,levelId,ox,oy,thickness,height,bedrooms,Boolean(floor),stairRect?{...stairRect,x:stairRect.x-(ox-x),y:stairRect.y-oy}:undefined));
      layout=applyFootprint(layout,s.points,x,0,thickness,height,levelId,prefix);actions.push(...layout.filter(a=>a.kind!=="floor"));
    }else{
      const edges=sketchSegments(s);
      edges.forEach((l,i)=>{const interior=i>=s.points.length,logicalIndex=interior?i-s.points.length:i,type=s.wallTypes?.find(w=>w.index===logicalIndex&&w.interior===interior)?.type??(interior?"partition":"exterior");actions.push({kind:"wall",operation:"create",id:`${prefix}:wall:${i}`,levelId,startXmm:x+l.start.xMm,startYmm:l.start.yMm,endXmm:x+l.end.xMm,endYmm:l.end.yMm,thicknessMm:interior?150:thickness,heightMm:height,...(type?{wallType:type}:{})});});
      (s.furnitureLines??[]).forEach((l,i)=>{const dx=l.end.xMm-l.start.xMm,dy=l.end.yMm-l.start.yMm,len=Math.hypot(dx,dy);actions.push({kind:"equipment",operation:"create",id:`${prefix}:furniture-sketch:${i}`,levelId,familyId:"furniture-line-marker",xMm:x+(l.start.xMm+l.end.xMm)/2,yMm:(l.start.yMm+l.end.yMm)/2,rotationDeg:Math.atan2(dy,dx)*180/Math.PI,elevationMm:0,widthMm:Math.max(100,len),depthMm:100,heightMm:50});});
      (s.mepLines??[]).forEach((l,i)=>actions.push({kind:"pipe",operation:"create",id:`${prefix}:mep-sketch:${i}`,levelId,startXmm:x+l.start.xMm,startYmm:l.start.yMm,endXmm:x+l.end.xMm,endYmm:l.end.yMm,diameterMm:28,elevationOffsetMm:-120,slopePercent:0,systemType:"hydronic_supply"}));
      (s.openings??[]).forEach((opening,i)=>{const edge=s.points.map((start,j)=>({start,end:s.points[(j+1)%s.points.length]})).map((edge,j)=>{const dx=edge.end.xMm-edge.start.xMm,dy=edge.end.yMm-edge.start.yMm,len=Math.hypot(dx,dy),t=Math.max(0,Math.min(1,((opening.point.xMm-edge.start.xMm)*dx+(opening.point.yMm-edge.start.yMm)*dy)/(len*len||1))),p={xMm:edge.start.xMm+t*dx,yMm:edge.start.yMm+t*dy};return {j,t,len,d:Math.hypot(p.xMm-opening.point.xMm,p.yMm-opening.point.yMm)};}).sort((a,b)=>a.d-b.d)[0];if(!edge)return;const wallId=`${prefix}:wall:${edge.j}`,positionMm=edge.t*edge.len;if(opening.kind==="window")actions.push({kind:"window",operation:"create",id:`${prefix}:sketch-window:${i}`,wallId,positionMm,widthMm:opening.widthMm,heightMm:1200,sillHeightMm:900,operationType:"casement"});else actions.push({kind:"door",operation:"create",id:`${prefix}:sketch-door:${i}`,wallId,positionMm,widthMm:opening.widthMm,heightMm:2200,hinge:"start",swing:1,style:opening.kind==="doubleDoor"?"double":"wood"});});
      const rooms=sketchRooms(s).sort((a,b)=>polygonArea(b)-polygonArea(a)),doors:SketchPoint[]=[];
      const roomLabel=(room:SketchPoint[])=>(s.labels??[]).find(l=>insidePolygon(l.point,room));
      const livingIndex=Math.max(0,rooms.findIndex(r=>roomLabel(r)?.use==="living"));
      let doorIndex=0;
      const door=(edge:number,position:number)=>{const l=edges[edge],length=Math.hypot(l.end.xMm-l.start.xMm,l.end.yMm-l.start.yMm);actions.push({kind:"door",operation:"create",id:`${prefix}:door:${doorIndex++}`,wallId:`${prefix}:wall:${edge}`,positionMm:position,widthMm:900,heightMm:2100,hinge:"start",swing:1,style:"wood"});doors.push({xMm:l.start.xMm+(l.end.xMm-l.start.xMm)*position/length,yMm:l.start.yMm+(l.end.yMm-l.start.yMm)*position/length});};
      const entry=edges.findIndex((l,i)=>i<s.points.length&&rooms[livingIndex]&&insidePolygon({xMm:(l.start.xMm+l.end.xMm)/2,yMm:(l.start.yMm+l.end.yMm)/2},rooms[livingIndex]));
      const links:{edge:number;position:number;a:number;b:number}[]=[];
      edges.forEach((l,i)=>{
        const dx=l.end.xMm-l.start.xMm,dy=l.end.yMm-l.start.yMm,length=Math.hypot(dx,dy);if(length<1500)return;
        if(i<s.points.length){
          if(!floor&&i===entry)door(i,length/2);
          const cuts=[...new Set([0,length,...edges.flatMap((other,j)=>{const p=j===i?null:intersection(l,other);return p?[p.t*length]:[];})])].sort((a,b)=>a-b);
          for(let j=1;j<cuts.length;j++){const position=(cuts[j]+cuts[j-1])/2;if(cuts[j]-cuts[j-1]>=2500&&(floor||i!==entry||Math.abs(position-length/2)>1300))actions.push({kind:"window",operation:"create",id:`${prefix}:window:${i}:${j}`,wallId:`${prefix}:wall:${i}`,positionMm:position,widthMm:1200,heightMm:1200,sillHeightMm:900,operationType:"casement"});}return;
        }
        const cuts=[...new Set([0,length,...edges.flatMap((other,j)=>{const p=j===i?null:intersection(l,other);return p?[p.t*length]:[];})])].sort((a,b)=>a-b);
        for(let j=1;j<cuts.length;j++){if(cuts[j]-cuts[j-1]<1500)continue;const position=(cuts[j]+cuts[j-1])/2,px=l.start.xMm+dx*position/length,py=l.start.yMm+dy*position/length;
          const a=rooms.findIndex(r=>insidePolygon({xMm:px+dy/length*100,yMm:py-dx/length*100},r)),b=rooms.findIndex(r=>insidePolygon({xMm:px-dy/length*100,yMm:py+dx/length*100},r));
          if(a>=0&&b>=0&&a!==b)links.push({edge:i,position,a,b});
        }
      });
      const connected=new Set([livingIndex]);let added=true;
      while(added){added=false;for(const link of links)if(connected.has(link.a)!==connected.has(link.b)){door(link.edge,link.position);connected.add(link.a);connected.add(link.b);added=true;}}
      if(connected.size<rooms.length)throw new Error(`Floor ${floor}: some rooms need a partition segment at least 1.5 m long to provide door access.`);
      if(input.furnished!==false){
        let beds=Math.max(0,bedrooms-rooms.filter(r=>roomLabel(r)?.use==="bedroom").length),index=0;
        rooms.forEach((room,i)=>{
          const b=inscribedRectangle(room),zone={x:b.xMm+thickness/2,y:b.yMm+thickness/2,w:b.widthMm-thickness,d:b.depthMm-thickness};
          const reserved:FurnitureRect[]=doors.filter(p=>insidePolygon(p,room)).map(p=>({x:p.xMm-650,y:p.yMm-1000,w:1300,d:2000}));
          if(stairRect)reserved.push(stairRect);
          const type=roomLabel(room)?.use??(i===livingIndex?"living":beds&&polygonArea(room)>=11e6?(beds--,"bedroom"):"bathroom");
          arrangeRoom(type,zone,reserved,(familyId,px,py,rotationDeg)=>actions.push({kind:"equipment",operation:"create",id:`${prefix}:furniture:${index++}`,levelId,familyId,xMm:x+px,yMm:py,rotationDeg,elevationMm:0}),input.bathFixture);
        });
        if(beds&&!s.labels?.length)throw new Error(`Floor ${floor}: draw enough enclosed rooms of at least 11 m² for ${bedrooms} bedrooms plus living space, or remove inside lines for an automatic layout.`);
      }
      if(input.underfloorHeating||input.piping&&input.piping!=="none"||input.ducts==="ceiling"){
        sketchRooms(s).forEach((room,ri)=>{
          const b=inscribedRectangle(room),left=b.xMm+350,right=b.xMm+b.widthMm-350,front=b.yMm+350,rear=b.yMm+b.depthMm-350;
          if(right<=left||rear<=front)return;
          if(input.underfloorHeating&&!["garage","corridor"].includes(roomLabel(room)?.use??"")){const path=[[left,rear],[left,front],[right,front],[right,rear]];for(let j=0;j<3;j++)actions.push({kind:"pipe",operation:"create",id:`${prefix}:heat:${ri}:${j}`,levelId,startXmm:x+path[j][0],startYmm:path[j][1],endXmm:x+path[j+1][0],endYmm:path[j+1][1],diameterMm:16,elevationOffsetMm:-80,slopePercent:0,systemType:j===2?"hydronic_return":"hydronic_supply"});}
          if(input.piping&&input.piping!=="none"&&(!s.labels?.length||["bathroom","kitchen","living"].includes(roomLabel(room)?.use??"")))for(const [j,systemType]of(["domestic_cold","domestic_hot"]as const).entries())actions.push({kind:"pipe",operation:"create",id:`${prefix}:water:${ri}:${j}`,levelId,startXmm:x+left,startYmm:rear-j*100,endXmm:x+right,endYmm:rear-j*100,diameterMm:22,elevationOffsetMm:input.piping==="underfloor"?-120:height-600,slopePercent:0,systemType});
          if(input.ducts==="ceiling"){const cx=(left+right)/2,cy=(front+rear)/2,exhaust=["bathroom","kitchen","garage"].includes(roomLabel(room)?.use??"");actions.push({kind:"duct",operation:"create",id:`${prefix}:duct:${ri}`,levelId,startXmm:x+left,startYmm:cy,endXmm:x+cx,endYmm:cy,shape:"rectangular",widthMm:150,heightMm:150,elevationOffsetMm:height-450,systemType:exhaust?"exhaust":"supply"},{kind:"equipment",operation:"create",id:`${prefix}:diffuser:${ri}`,levelId,familyId:exhaust?"mep-diffuser_extract":"mep-diffuser_supply",xMm:x+cx,yMm:cy,rotationDeg:0,elevationMm:height-550});}
        });
      }
    }
    const boundary=offsetPolygon(s.points,thickness).map(p=>({...p,xMm:p.xMm+x}));
    const pieces=floor&&stairRect?polygonAroundOpening(boundary,{...stairRect,x:stairRect.x+x}):[boundary];
    pieces.forEach((boundary,i)=>actions.push({kind:"floor",operation:"create",id:`${prefix}:slab:${i}`,levelId,boundary,thicknessMm:200,elevationOffsetMm:0,roofPreset:"flat",pitchDeg:0}));
    const rectangular = s.points.length === 4 && s.points.every((p,i) => Math.abs(p.xMm-s.points[(i+1)%4].xMm)<1 || Math.abs(p.yMm-s.points[(i+1)%4].yMm)<1);
    const roofPreset = !rectangular || !input.roofStyle || input.roofStyle === "modern-flat" ? "flat" : input.roofStyle === "german-gable" ? "gable" : input.roofStyle === "german-hip" ? "hip" : "shed";
    if(floor===floors-1&&(input.variant!=="apartment"||input.roofStyle))actions.push({kind:"roof",operation:"create",id:`${id}:roof`,levelId,boundary,thicknessMm:200,elevationOffsetMm:height,roofPreset,pitchDeg:roofPreset === "flat" ? 0 : roofPreset === "gable" ? 35 : 25});
    if(floor===floors-1&&input.variant!=="apartment")actions.push({kind:"equipment",operation:"create",id:`${prefix}:roof-window`,levelId,familyId:"extras-roof-window",xMm:x+(Math.min(...s.points.map(p=>p.xMm))+Math.max(...s.points.map(p=>p.xMm)))/2,yMm:(Math.min(...s.points.map(p=>p.yMm))+Math.max(...s.points.map(p=>p.yMm)))/2,rotationDeg:0,elevationMm:height+150,widthMm:1000,depthMm:1200,heightMm:120});
    if(floor<floors-1&&stairRect){
      const push=(sx:number,sy:number,w:number,d:number,top:number,j:string)=>actions.push({kind:"floor",operation:"create",id:`${prefix}:stair:${j}`,levelId,thicknessMm:top,elevationOffsetMm:top,roofPreset:"flat",pitchDeg:0,boundary:[{xMm:x+sx,yMm:sy},{xMm:x+sx+w,yMm:sy},{xMm:x+sx+w,yMm:sy+d},{xMm:x+sx,yMm:sy+d}]});
      for(let i=0;i<stairs.flightSteps-1;i++){push(stairRect.x,stairRect.y+i*stairs.treadMm,1200,stairs.treadMm,(i+1)*stairs.riserMm,`a${i}`);push(stairRect.x+1350,stairRect.y+(stairs.flightSteps-2-i)*stairs.treadMm,1200,stairs.treadMm,(stairs.flightSteps+i+1)*stairs.riserMm,`b${i}`);}
      push(stairRect.x,stairRect.y+stairs.runMm,stairs.widthMm,stairs.landingMm,stairs.riseMm/2,"landing");
    }
  }
  const ground=sketches[0].points;
  for(const [i,polygon]of(sketches[0].gardens??[]).entries()){const b=inscribedRectangle(polygon);actions.push(...gardenActions(`${id}:drawn-garden:${i}`,groundId,x+b.xMm,b.yMm,b.widthMm,b.depthMm));}
  if(input.variant!=="apartment" || (input.garage && input.garage!=="none") || input.gardenAreaM2)actions.push(...outdoorActions({...input,garage:input.garage??(input.variant==="apartment"?"none":"enclosed"),gardenAreaM2:sketches[0].gardens?.length?0:input.gardenAreaM2??(input.variant==="apartment"?0:40)},id,groundId,x,0,Math.max(...ground.map(p=>p.xMm)),Math.max(...ground.map(p=>p.yMm)),height));
  return homeDetails(actions, input);
}
