import { arrangeRoom } from "./roomFurniture";
import type { AiAction } from "../schema";
import type { ResidentialParameters, allocateResidential } from "./allocation";

type Allocation = ReturnType<typeof allocateResidential>;
type Rect = { x:number;y:number;w:number;d:number };
export function furnishFloor(input:ResidentialParameters, a:Allocation, id:string,levelId:string,xMm:number,yMm:number,t:number,heightMm:number,actualBedrooms:number,upper=false,stairOverride?:Rect):AiAction[]{
  const actions:AiAction[]=[];let index=0;
  const add=(familyId:string,x:number,y:number,rotationDeg=0,elevationMm=0)=>actions.push({kind:"equipment",operation:"create",id:`${id}:component:${index++}`,levelId,familyId,xMm:xMm+x,yMm:yMm+y,rotationDeg,elevationMm});
  for(let i=0;i<a.bays;i++){
    const start=t/2+i*(a.roomWidthMm+150);
    const room={x:start,y:t/2,w:a.roomWidthMm,d:a.roomDepthMm};
    if(input.furnished!==false){
      const occupied:Rect[]=[{x:start+a.roomWidthMm/2-600,y:t/2+a.roomDepthMm-1000,w:1200,d:1000}];
      arrangeRoom(i<actualBedrooms?"bedroom":"study",room,occupied,add);
    }
    if(input.underfloorHeating){
      const left=start+350,right=start+a.roomWidthMm-350,front=t/2+350,rear=t/2+a.roomDepthMm-350;
      const corridor=(a.bedroomEndMm+a.corridorEndMm)/2;
      const points=[[left,corridor-100],[left,rear],[left,front],[right,front],[right,rear],[right,corridor+100]];
      for(let j=0;j<points.length-1;j++)actions.push({kind:"pipe",operation:"create",id:`${id}:heating:${i}:${j}`,levelId,startXmm:xMm+points[j][0],startYmm:yMm+points[j][1],endXmm:xMm+points[j+1][0],endYmm:yMm+points[j+1][1],diameterMm:16,elevationOffsetMm:-80,slopePercent:0,systemType:j>=3?"hydronic_return":"hydronic_supply"});
    }
  }
  const serviceY=a.corridorEndMm+75;
  if(input.furnished!==false){
    const bath={x:t/2,y:serviceY,w:a.bathroomWidthMm,d:a.bathroomDepthMm};
    const occupied:Rect[]=[{x:bath.x+bath.w/2-550,y:bath.y,w:1100,d:950}];
    arrangeRoom("bathroom",bath,occupied,add);
    const zone={x:t/2+a.bathroomWidthMm+150,y:serviceY,w:a.internalWidthMm-a.bathroomWidthMm-150,d:a.serviceDepthMm};
    const used:Rect[]=[{x:a.widthMm-t/2-1550,y:serviceY,w:1100,d:1000}];
    if(input.variant==="duplex")used.push(stairOverride??{x:t/2+a.bathroomWidthMm+300,y:serviceY+1200,w:a.stair.widthMm,d:a.stair.runMm+a.stair.landingMm});
    arrangeRoom("living",zone,used,add);
  }
  const corridorY=(a.bedroomEndMm+a.corridorEndMm)/2;
  if(input.underfloorHeating){
    for(const [j,systemType]of(["hydronic_supply","hydronic_return"]as const).entries())actions.push({kind:"pipe",operation:"create",id:`${id}:heating:trunk:${j}`,levelId,startXmm:xMm+t/2+300,startYmm:yMm+corridorY+(j?100:-100),endXmm:xMm+a.widthMm-t/2-300,endYmm:yMm+corridorY+(j?100:-100),diameterMm:28,elevationOffsetMm:-80,slopePercent:0,systemType});
    add("mep-heating-manifold",t/2+300,corridorY,0,200);
  }
  if(input.ducts==="ceiling"){
    const z=heightMm-450;
    actions.push({kind:"duct",operation:"create",id:`${id}:duct:trunk`,levelId,startXmm:xMm+t/2+300,startYmm:yMm+corridorY,endXmm:xMm+a.widthMm-t/2-300,endYmm:yMm+corridorY,shape:"rectangular",widthMm:300,heightMm:200,elevationOffsetMm:z,systemType:"supply"});
    for(let i=0;i<a.bays;i++){
      const x=t/2+i*(a.roomWidthMm+150)+a.roomWidthMm/2,y=t/2+a.roomDepthMm/2;
      actions.push({kind:"duct",operation:"create",id:`${id}:duct:branch:${i}`,levelId,startXmm:xMm+x,startYmm:yMm+corridorY,endXmm:xMm+x,endYmm:yMm+y,shape:"rectangular",widthMm:150,heightMm:150,elevationOffsetMm:z,systemType:"supply"});
      add("mep-diffuser_supply",x,y,0,z-100);
    }
    add("mep-fan_coil",t/2+750,corridorY,0,z-250);
  }
  if(input.piping&&input.piping!=="none"){
    const z=input.piping==="underfloor"?-120:heightMm-600;
    const kitchenX=a.widthMm-t/2-1000,bathX=t/2+a.bathroomWidthMm/2;
    for(const [j,systemType]of(["domestic_cold","domestic_hot"]as const).entries()){
      const y=serviceY+400+j*100;
      actions.push({kind:"pipe",operation:"create",id:`${id}:water:${j}`,levelId,startXmm:xMm+bathX,startYmm:yMm+y,endXmm:xMm+kitchenX,endYmm:yMm+y,diameterMm:22,elevationOffsetMm:z,slopePercent:0,systemType});
    }
    if(input.furnished===false){add("mep-sink",kitchenX,serviceY+600);add("mep-toilet",bathX,serviceY+a.bathroomDepthMm-500);}
  }
  if(input.underfloorHeating&&!upper)add("mep-heat_pump",t/2+a.bathroomWidthMm+800,serviceY+400);
  return actions;
}

export function outdoorActions(input:ResidentialParameters,id:string,levelId:string,x:number,y:number,width:number,depth:number,heightMm:number):AiAction[]{
  const actions:AiAction[]=[];
  const rectangle=(x:number,y:number,w:number,d:number)=>[{xMm:x,yMm:y},{xMm:x+w,yMm:y},{xMm:x+w,yMm:y+d},{xMm:x,yMm:y+d}];
  if(input.garage&&input.garage!=="none"){
    const gx=x+width+800,gy=y,w=(input.garageWidthM??3.5)*1000,d=(input.garageDepthM??6)*1000;
    const boundary=rectangle(gx,gy,w,d);
    actions.push({kind:"floor",operation:"create",id:`${id}:garage:floor`,levelId,boundary,thicknessMm:200,elevationOffsetMm:0,roofPreset:"flat",pitchDeg:0});
    actions.push({kind:"roof",operation:"create",id:`${id}:garage:roof`,levelId,boundary,thicknessMm:150,elevationOffsetMm:heightMm,roofPreset:"flat",pitchDeg:0});
    if(input.garage==="enclosed"){
      boundary.forEach((a,i)=>{const b=boundary[(i+1)%4];actions.push({kind:"wall",operation:"create",id:`${id}:garage:wall:${i}`,levelId,startXmm:a.xMm,startYmm:a.yMm,endXmm:b.xMm,endYmm:b.yMm,thicknessMm:200,heightMm});});
      actions.push({kind:"door",operation:"create",id:`${id}:garage:door`,wallId:`${id}:garage:wall:0`,positionMm:w/2,widthMm:Math.min(5000,w-600),heightMm:2200,hinge:"start",swing:1,style:"garage"});
    }else boundary.forEach((p,i)=>actions.push({kind:"column",operation:"create",id:`${id}:garage:post:${i}`,levelId,xMm:p.xMm,yMm:p.yMm,profile:"rect",widthMm:200,depthMm:200,heightMm}));
    actions.push({kind:"equipment",operation:"create",id:`${id}:garage:car`,levelId,familyId:"extras-car-sedan",xMm:gx+w/2,yMm:gy+d/2,rotationDeg:0,elevationMm:0,color:"#2563eb"});
  }
  const area=input.gardenAreaM2??0;
  if(area>0)actions.push(...gardenActions(id,levelId,x,y+depth+1000,width,area*1e6/width));
  return actions;
}

export function gardenActions(id:string,levelId:string,x:number,y:number,width:number,depth:number):AiAction[]{
  const actions:AiAction[]=[{kind:"equipment",operation:"create",id:`${id}:garden:lawn`,levelId,familyId:"extras-lawn",xMm:x+width/2,yMm:y+depth/2,widthMm:width,depthMm:depth,heightMm:50,rotationDeg:0,elevationMm:-100}];
  if(depth>=1000&&width>=1000){
    const crown=Math.min(3200,depth-200,width/3);
    for(const [i,px]of([x+crown/2+100,x+width-crown/2-100].entries()))actions.push({kind:"equipment",operation:"create",id:`${id}:garden:tree:${i}`,levelId,familyId:i?"extras-tree-flowering":"extras-tree",xMm:px,yMm:y+depth-crown/2-100,widthMm:crown,depthMm:crown,heightMm:Math.max(2500,crown*1.6),rotationDeg:0,elevationMm:-50,color:i?"#f9a8d4":"#38834b"});
    for(let i=0;i<3;i++)actions.push({kind:"equipment",operation:"create",id:`${id}:garden:plant:${i}`,levelId,familyId:i===1?"extras-flower-bed":"extras-shrub",xMm:x+width*(i+1)/4,yMm:y+450,widthMm:Math.min(900,width/5),depthMm:Math.min(700,depth/3),heightMm:i===1?450:700,rotationDeg:0,elevationMm:-50,color:["#65a30d","#fb7185","#a855f7"][i]});
  }
  return actions;
}
