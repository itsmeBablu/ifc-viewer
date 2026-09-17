import { furnitureParametersFor, evaluateFurniture } from "./parametricFurniture";
import * as THREE from "three";
import type { LayoutMepEquipment } from "./layoutDrawing";

/** Parametric furniture in metres, centered in plan with its base at local Y=0. */
export function createFurniture(item: Pick<LayoutMepEquipment, "familyId" | "widthMm" | "depthMm" | "heightMm" | "color" | "moduleWidthMm" | "furnitureParameters">, generatedPart = false) {
  const group = new THREE.Group();
  const parameters = generatedPart ? undefined : furnitureParametersFor(item);
  if (parameters) {
    for (const part of evaluateFurniture(parameters).parts) {
      const child = createFurniture({ ...part, color: item.color }, true);
      child.name = part.key;
      child.userData.parametricPart = part.key;
      child.position.set(part.xMm / 1000, part.elevationMm / 1000, part.yMm / 1000);
      child.rotation.y = part.rotationDeg * Math.PI / 180;
      group.add(child);
    }
    return group;
  }
  const id = item.familyId ?? "kitchen-base";
  const w = Math.max(0.1, (item.widthMm ?? 600) / 1000), d = Math.max(0.1, (item.depthMm ?? 600) / 1000), h = Math.max(0.1, (item.heightMm ?? 900) / 1000);
  const wood = new THREE.MeshStandardMaterial({ color: item.color ?? "#bb9167", roughness: 0.75 });
  const white = new THREE.MeshStandardMaterial({ color: "#e7e5e4", roughness: 0.65 });
  const fabric = new THREE.MeshStandardMaterial({ color: item.color ?? "#7c8c98", roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.4, metalness: 0.25 });
  const glass = new THREE.MeshStandardMaterial({ color: "#a5d5e8", transparent: true, opacity: 0.35, roughness: 0.15 });
  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, mat = wood) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(sx, 0.002), Math.max(sy, 0.002), Math.max(sz, 0.002)), mat);
    mesh.position.set(x, y, z); group.add(mesh); return mesh;
  };
  const cylinder = (x: number, y: number, z: number, radius: number, height: number, mat = dark) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 24), mat);
    mesh.position.set(x, y, z); group.add(mesh); return mesh;
  };
  const legs = (top: number) => { for (const x of [-1, 1]) for (const z of [-1, 1]) box(x * w * 0.4, top / 2, z * d * 0.4, w * 0.065, top, d * 0.065, dark); };
  if (id.startsWith("extras-car-")) {
    const paint = new THREE.MeshStandardMaterial({ color: item.color ?? "#2563eb", roughness: 0.28, metalness: 0.55 });
    const tire = new THREE.MeshStandardMaterial({ color: "#18181b", roughness: 0.9 });
    box(0, h * .34, 0, w, h * .32, d * .94, paint);
    box(0, h * .65, -d * .07, w * .84, h * .38, d * (id.endsWith("suv") ? .65 : id.endsWith("compact") ? .6 : .48), paint);
    box(0, h * .7, -d * .07, w * .86, h * .22, d * .4, dark);
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      const wheel = cylinder(side * w * .48, h * .19, end * d * .31, h * .19, w * .1, tire);
      wheel.rotation.z = Math.PI / 2;
      box(side * w * .31, h * .4, end * d * .475, w * .22, h * .09, .025, end > 0 ? white : fabric);
    }
    box(0, h * .24, d * .48, w * .48, h * .09, .03, dark);
    if(id.endsWith("sport")){box(0,h*.63,-d*.38,w*.92,h*.04,d*.1,paint);for(const side of[-1,1])box(side*w*.34,h*.55,-d*.38,w*.04,h*.16,d*.03,dark);}
  } else if (id === "extras-lift") {
    box(0, h / 2, 0, w, h, d, glass); box(0, h * .03, 0, w * .86, h * .06, d * .86, dark);
  } else if (id === "extras-roof-window") {
    box(0, h * .15, 0, w, h * .3, d, dark);
    box(0, h * .34, 0, w * .86, h * .04, d * .86, glass);
  } else if (id === "extras-lawn") {
    box(0, h / 2, 0, w, h, d, new THREE.MeshStandardMaterial({ color: item.color ?? "#6b9b45", roughness: 1 }));
  } else if (id.startsWith("extras-")) {
    const leaf = new THREE.MeshStandardMaterial({ color: item.color ?? (id==="extras-tree-flowering"?"#f9a8d4":id==="extras-lavender"?"#a78bfa":"#38834b"), roughness: 1 });
    const tree = id.startsWith("extras-tree") || id === "extras-palm";
    if (id === "extras-planter") cylinder(0, h * .15, 0, w * .42, h * .3, wood);
    if (tree) cylinder(0, h * .4, 0, w * .045, h * .8, wood);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), leaf);
    crown.position.y = tree ? h * .74 : h * .64;
    crown.scale.set(w * .5, h * (tree ? .26 : .36), d * .5);
    group.add(crown);
    if(id==="extras-flower-bed"||id==="extras-lavender"||id==="extras-tree-flowering"){
      const colors=id==="extras-tree-flowering"?[item.color??"#f9a8d4","#fce7f3","#fb7185"]:id==="extras-lavender"?[item.color??"#a78bfa","#c4b5fd"]:[item.color??"#fb7185","#facc15","#c084fc","#fda4af"];
      for(let i=0;i<12;i++){const angle=i*Math.PI*2/12,flower=new THREE.Mesh(new THREE.IcosahedronGeometry(Math.min(w,d)*.065,1),new THREE.MeshStandardMaterial({color:colors[i%colors.length],roughness:1}));flower.position.set(Math.cos(angle)*w*.35,h*(tree?.8:.85)+(i%3)*h*.035,Math.sin(angle)*d*.35);group.add(flower);}
    }
    if (id === "extras-palm") for (let i = 0; i < 8; i++) {
      const frond = box(0, h * .83, 0, w * .9, h * .025, d * .12, leaf);
      frond.rotation.y = i * Math.PI / 4;
      frond.rotation.z = .18;
    }
  } else if (id === "parametric-countertop") { box(0, h / 2, 0, w, h, d, white); }
  else if (id.startsWith("sofa") || id === "armchair") {
    legs(h * 0.18); box(0, h * 0.32, 0, w, h * 0.28, d, fabric);
    box(0, h * 0.7, -d * 0.4, w, h * 0.6, d * 0.2, fabric);
    for (const x of [-1, 1]) box(x * w * 0.45, h * 0.56, 0, w * 0.1, h * 0.4, d, fabric);
    const count = id === "sofa-3" ? 3 : id === "sofa-2" ? 2 : 1;
    for (let i = 0; i < count; i++) box(-w * 0.4 + w * 0.8 * (i + 0.5) / count, h * 0.49, d * 0.05, w * 0.8 / count - 0.012, h * 0.09, d * 0.7, white);
  } else if (id.startsWith("bed-")) {
    box(0, h * 0.2, 0, w, h * 0.4, d); box(0, h * 0.47, d * 0.015, w * 0.94, h * 0.14, d * 0.95, white);
    box(0, h * 0.5, -d * 0.475, w, h, d * 0.05);
    for (const x of id === "bed-double" ? [-0.24, 0.24] : [0]) box(x * w, h * 0.58, -d * 0.3, w * (id === "bed-double" ? 0.4 : 0.8), h * 0.08, d * 0.18, fabric);
  } else if (["dining-chair", "office-chair", "bar-stool"].includes(id)) {
    const seatY = id === "bar-stool" ? h * 0.95 : h * 0.48;
    legs(seatY); box(0, seatY, 0, w, h * 0.08, d, fabric);
    if (id !== "bar-stool") box(0, h * 0.76, -d * 0.45, w, h * 0.48, d * 0.1, fabric);
  } else if (["coffee-table", "desk", "dining-table", "round-table"].includes(id)) {
    if (id === "round-table") cylinder(0, h * 0.46, 0, Math.min(w, d) * 0.12, h * 0.92);
    else legs(h * 0.92);
    if (id === "round-table") { const top = cylinder(0, h * 0.96, 0, w / 2, h * 0.08, wood); top.scale.z = d / w; }
    else box(0, h * 0.96, 0, w, h * 0.08, d);
  } else if (id === "bath-tub") {
    box(0, h * 0.12, 0, w, h * 0.24, d, white);
    for (const x of [-1, 1]) box(x * w * 0.45, h * 0.6, 0, w * 0.1, h * 0.8, d, white);
    for (const z of [-1, 1]) box(0, h * 0.6, z * d * 0.45, w, h * 0.8, d * 0.1, white);
  } else if (id === "bath-shower") {
    box(0, h * 0.025, 0, w, h * 0.05, d, white);
    box(-w * 0.49, h * 0.5, 0, w * 0.02, h, d, glass); box(0, h * 0.5, -d * 0.49, w, h, d * 0.02, glass);
    cylinder(w * 0.35, h * 0.85, -d * 0.4, 0.02, h * 0.25);
  } else if (id === "bath-toilet" || id.includes("toilet") || id === "wc") {
    // Porcelain Toilet (WC): bowl, seat, rear cistern tank, and flush button
    box(0, h * 0.65, -d * 0.32, w * 0.9, h * 0.45, d * 0.28, white);
    box(0, h * 0.88, -d * 0.32, w * 0.94, h * 0.03, d * 0.31, white);
    cylinder(0, h * 0.905, -d * 0.32, 0.025, 0.015, dark);
    cylinder(0, h * 0.18, d * 0.05, w * 0.35, h * 0.35, white);
    const bowl = cylinder(0, h * 0.42, d * 0.1, w * 0.46, h * 0.24, white);
    bowl.scale.z = 1.25;
    const cavity = cylinder(0, h * 0.46, d * 0.1, w * 0.36, 0.14, glass);
    cavity.scale.z = 1.2;
    const seat = cylinder(0, h * 0.55, d * 0.1, w * 0.48, 0.025, white);
    seat.scale.z = 1.26;
  } else {
    const kitchenSet = ["kitchen-straight", "kitchen-l", "kitchen-island"].includes(id);
    const depth = id === "kitchen-l" ? Math.min(0.6, d * 0.45) : d;
    const moduleW = Math.max(0.3, (item.moduleWidthMm ?? 600) / 1000);
    const cabinet = (x: number, z: number, cw: number, cd: number, feature: string) => {
      box(x, h * 0.48, z, cw - 0.008, h * 0.88, cd, white);
      box(x, h * 0.04, z, cw * 0.92, h * 0.08, cd * 0.9, dark);
      box(x, h * 0.98, z, cw, h * 0.04, cd, wood);
      if (feature === "bookcase") {
        for (let i = 1; i < 6; i++) box(x, h * i / 6, z + cd * 0.49, cw * 0.92, h * 0.018, cd * 0.04, wood);
      } else {
        const rows = feature.includes("drawers") ? 3 : 1;
        for (let row = 0; row < rows; row++) {
          box(x, h * (0.1 + (row + 0.5) * 0.8 / rows), z + cd * 0.505, cw * 0.95, h * 0.8 / rows - 0.008, 0.015, feature.includes("fridge") ? dark : wood);
          box(x + cw * 0.25, h * (0.12 + (row + 0.75) * 0.8 / rows), z + cd * 0.525, Math.min(cw * 0.25, 0.15), 0.016, 0.025, dark);
        }
      }
      if (feature.includes("sink") || feature === "bath-vanity") {
        box(x, h * 1.002, z, cw * 0.6, 0.006, cd * 0.6, dark);
      }
      if (feature.includes("hob")) {
        box(x, h * 1.002, z, cw * 0.8, 0.006, cd * 0.75, dark);
        for (const bx of [-1, 1]) for (const bz of [-1, 1]) cylinder(x + bx * cw * 0.2, h * 1.008, z + bz * cd * 0.2, Math.min(cw, cd) * 0.1, 0.006, white);
        box(x, h * 0.46, z + cd * 0.52, cw * 0.8, h * 0.45, 0.018, dark);
      }
    };
    const count = kitchenSet ? Math.max(1, Math.min(24, Math.round(w / moduleW))) : id === "wardrobe" ? Math.max(1, Math.round(w / 0.6)) : 1;
    for (let i = 0; i < count; i++) cabinet(-w / 2 + (i + 0.5) * w / count, id === "kitchen-l" ? -d / 2 + depth / 2 : 0, w / count, depth, kitchenSet ? i === 1 ? "kitchen-sink" : i === count - 1 ? "kitchen-hob" : "kitchen-base" : id);
    if (id === "kitchen-l" && d > depth) {
      const count = Math.max(1, Math.min(24, Math.round((d - depth) / moduleW)));
      for (let i = 0; i < count; i++) cabinet(-w / 2 + depth / 2, -d / 2 + depth + (i + 0.5) * (d - depth) / count, depth, (d - depth) / count, "kitchen-base");
    }
  }
  group.traverse((object) => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
  // Materials not used by a family are disposed here; used ones belong to the group.
  const used = new Set<THREE.Material>(); group.traverse((o) => { if (o instanceof THREE.Mesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => used.add(m)); });
  for (const material of [wood, white, fabric, dark, glass]) if (!used.has(material)) material.dispose();
  return group;
}
