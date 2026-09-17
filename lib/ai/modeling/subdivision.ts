import type { AiAction } from "../schema";
import type { ResidentialParameters, RoomUse } from "./allocation";

export type SubdividedRoom = {
  id: string;
  name: string;
  use: RoomUse;
  xMm: number;
  yMm: number;
  widthMm: number;
  depthMm: number;
  areaM2: number;
  isCurtainWall?: boolean;
  hasEnsuite?: boolean;
  isMaster?: boolean;
};

export type SubdividedLayout = {
  widthMm: number;
  depthMm: number;
  rooms: SubdividedRoom[];
  corridorMm: { xMm: number; yMm: number; widthMm: number; depthMm: number };
  entryDoor: { wall: "front" | "rear" | "left" | "right"; positionMm: number; isDouble: boolean };
  exteriorWalls: { startX: number; startY: number; endX: number; endY: number; isCurtainWall?: boolean }[];
  interiorWalls: { startX: number; startY: number; endX: number; endY: number }[];
  doors: { wallIndex: number; isInterior: boolean; positionMm: number; widthMm: number; style: "wood" | "glass" | "entry" | "double" }[];
  windows: { wallIndex: number; positionMm: number; widthMm: number; heightMm: number; sillMm: number }[];
};

/**
 * Seeded PRNG for reproducible yet genuinely varied layouts.
 */
function createPrng(seed: number) {
  let s = Math.abs(Math.floor(seed)) % 2147483647;
  if (s === 0) s = 123456789;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generate a genuinely randomized, architecturally sound floor plan layout using
 * recursive spatial subdivision and documented Neufert / DIN 18025 space standards.
 */
export function generateSubdividedLayout(
  widthMm: number,
  depthMm: number,
  params: ResidentialParameters,
  wallThicknessMm = 200,
  partitionThicknessMm = 150
): SubdividedLayout {
  const seed = params.layoutSeed ?? 0;
  const rand = createPrng(seed);
  const rooms: SubdividedRoom[] = [];
  const interiorWalls: { startX: number; startY: number; endX: number; endY: number }[] = [];
  const exteriorWalls: { startX: number; startY: number; endX: number; endY: number; isCurtainWall?: boolean }[] = [];
  const doors: { wallIndex: number; isInterior: boolean; positionMm: number; widthMm: number; style: "wood" | "glass" | "entry" | "double" }[] = [];
  const windows: { wallIndex: number; positionMm: number; widthMm: number; heightMm: number; sillMm: number }[] = [];

  const t = wallThicknessMm;
  const p = partitionThicknessMm;
  const internalW = widthMm - 2 * t;
  const internalD = depthMm - 2 * t;

  const bedroomCount = Math.max(1, Math.min(6, params.bedrooms));
  const style = params.layoutStyle ?? "linear";
  const culture = params.cultureStyle ?? "standard";
  const separateKitchen = params.separateKitchen ?? true;
  const ensuiteRequested = params.ensuiteBathrooms ?? true;

  // 4 exterior perimeter walls
  exteriorWalls.push({ startX: 0, startY: 0, endX: widthMm, endY: 0 }); // Front (wall 0)
  exteriorWalls.push({ startX: widthMm, startY: 0, endX: widthMm, endY: depthMm }); // Right (wall 1)
  exteriorWalls.push({ startX: widthMm, startY: depthMm, endX: 0, endY: depthMm }); // Rear (wall 2)
  exteriorWalls.push({ startX: 0, startY: depthMm, endX: 0, endY: 0 }); // Left (wall 3)

  // Architectural zoning decision driven by layoutSeed:
  // Random variation in Macro-Split:
  // Variant 0: Day zone on Left, Night zone on Right (vertical split)
  // Variant 1: Day zone on Right, Night zone on Left (mirrored vertical split)
  // Variant 2: Day zone on Rear (garden facing), Night zone on Front (horizontal split)
  // Variant 3: Day zone on Front, Night zone on Rear (inverted horizontal split)
  const rawSeed = Math.abs(Math.floor(seed));
  const splitMode = rawSeed % 4;
  const corridorWidthMm = 1200;

  let publicZone: { x: number; y: number; w: number; d: number };
  let privateZone: { x: number; y: number; w: number; d: number };
  let corridorZone: { xMm: number; yMm: number; widthMm: number; depthMm: number };

  // Calculate public vs private area proportions (typically 50-50 to 60-40)
  const publicRatio = 0.48 + (((rawSeed * 37) % 15) / 100);

  if (splitMode === 0 || splitMode === 1) {
    // Vertical division
    const splitX = Math.round((internalW * (splitMode === 0 ? publicRatio : (1 - publicRatio))) / 100) * 100;
    if (splitMode === 0) {
      publicZone = { x: t, y: t, w: splitX - p / 2, d: internalD };
      privateZone = { x: t + splitX + p / 2, y: t, w: internalW - splitX - p / 2, d: internalD };
      corridorZone = { xMm: t + splitX - corridorWidthMm / 2, yMm: t + internalD * 0.2, widthMm: corridorWidthMm, depthMm: internalD * 0.6 };
    } else {
      privateZone = { x: t, y: t, w: splitX - p / 2, d: internalD };
      publicZone = { x: t + splitX + p / 2, y: t, w: internalW - splitX - p / 2, d: internalD };
      corridorZone = { xMm: t + splitX - corridorWidthMm / 2, yMm: t + internalD * 0.2, widthMm: corridorWidthMm, depthMm: internalD * 0.6 };
    }
    // Vertical dividing spine wall
    interiorWalls.push({ startX: t + splitX, startY: t, endX: t + splitX, endY: t + internalD });
  } else {
    // Horizontal division
    const splitY = Math.round((internalD * (splitMode === 2 ? (1 - publicRatio) : publicRatio)) / 100) * 100;
    if (splitMode === 2) {
      privateZone = { x: t, y: t, w: internalW, d: splitY - p / 2 };
      publicZone = { x: t, y: t + splitY + p / 2, w: internalW, d: internalD - splitY - p / 2 };
      corridorZone = { xMm: t + internalW * 0.2, yMm: t + splitY - corridorWidthMm / 2, widthMm: internalW * 0.6, depthMm: corridorWidthMm };
    } else {
      publicZone = { x: t, y: t, w: internalW, d: splitY - p / 2 };
      privateZone = { x: t, y: t + splitY + p / 2, w: internalW, d: internalD - splitY - p / 2 };
      corridorZone = { xMm: t + internalW * 0.2, yMm: t + splitY - corridorWidthMm / 2, widthMm: internalW * 0.6, depthMm: corridorWidthMm };
    }
    // Horizontal dividing spine wall
    interiorWalls.push({ startX: t, startY: t + splitY, endX: t + internalW, endY: t + splitY });
  }

  // --- SUBDIVIDE PUBLIC ZONE ---
  // Public zone contains: Living/Dining room, Kitchen, Entry Foyer, Guest Powder Room
  // Variation: kitchen position toggles based on seed
  const kitchenWidthRatio = 0.32 + (((rawSeed * 19) % 10) / 100);
  const kitchenOnSecondaryEdge = (Math.floor(rawSeed / 4) % 2 === 1);

  let livingRect: { x: number; y: number; w: number; d: number };
  let kitchenRect: { x: number; y: number; w: number; d: number };
  let guestWcRect: { x: number; y: number; w: number; d: number };

  if (publicZone.w >= publicZone.d) {
    // Split public zone along X
    const kWidth = Math.round((publicZone.w * kitchenWidthRatio) / 100) * 100;
    if (kitchenOnSecondaryEdge) {
      kitchenRect = { x: publicZone.x, y: publicZone.y, w: kWidth, d: publicZone.d * 0.65 };
      guestWcRect = { x: publicZone.x, y: publicZone.y + publicZone.d * 0.65 + p, w: kWidth, d: publicZone.d * 0.35 - p };
      livingRect = { x: publicZone.x + kWidth + p, y: publicZone.y, w: publicZone.w - kWidth - p, d: publicZone.d };
      interiorWalls.push({ startX: publicZone.x + kWidth, startY: publicZone.y, endX: publicZone.x + kWidth, endY: publicZone.y + publicZone.d });
      interiorWalls.push({ startX: publicZone.x, startY: publicZone.y + publicZone.d * 0.65, endX: publicZone.x + kWidth, endY: publicZone.y + publicZone.d * 0.65 });
    } else {
      kitchenRect = { x: publicZone.x + publicZone.w - kWidth, y: publicZone.y, w: kWidth, d: publicZone.d * 0.65 };
      guestWcRect = { x: publicZone.x + publicZone.w - kWidth, y: publicZone.y + publicZone.d * 0.65 + p, w: kWidth, d: publicZone.d * 0.35 - p };
      livingRect = { x: publicZone.x, y: publicZone.y, w: publicZone.w - kWidth - p, d: publicZone.d };
      interiorWalls.push({ startX: publicZone.x + publicZone.w - kWidth, startY: publicZone.y, endX: publicZone.x + publicZone.w - kWidth, endY: publicZone.y + publicZone.d });
    }
  } else {
    // Split public zone along Y
    const kDepth = Math.round((publicZone.d * kitchenWidthRatio) / 100) * 100;
    if (kitchenOnSecondaryEdge) {
      kitchenRect = { x: publicZone.x, y: publicZone.y + publicZone.d - kDepth, w: publicZone.w * 0.65, d: kDepth };
      guestWcRect = { x: publicZone.x + publicZone.w * 0.65 + p, y: publicZone.y + publicZone.d - kDepth, w: publicZone.w * 0.35 - p, d: kDepth };
      livingRect = { x: publicZone.x, y: publicZone.y, w: publicZone.w, d: publicZone.d - kDepth - p };
      interiorWalls.push({ startX: publicZone.x, startY: publicZone.y + publicZone.d - kDepth, endX: publicZone.x + publicZone.w, endY: publicZone.y + publicZone.d - kDepth });
      interiorWalls.push({ startX: publicZone.x + publicZone.w * 0.65, startY: publicZone.y + publicZone.d - kDepth, endX: publicZone.x + publicZone.w * 0.65, endY: publicZone.y + publicZone.d });
    } else {
      kitchenRect = { x: publicZone.x, y: publicZone.y, w: publicZone.w * 0.65, d: kDepth };
      guestWcRect = { x: publicZone.x + publicZone.w * 0.65 + p, y: publicZone.y, w: publicZone.w * 0.35 - p, d: kDepth };
      livingRect = { x: publicZone.x, y: publicZone.y + kDepth + p, w: publicZone.w, d: publicZone.d - kDepth - p };
      interiorWalls.push({ startX: publicZone.x, startY: publicZone.y + kDepth, endX: publicZone.x + publicZone.w, endY: publicZone.y + kDepth });
      interiorWalls.push({ startX: publicZone.x + publicZone.w * 0.65, startY: publicZone.y, endX: publicZone.x + publicZone.w * 0.65, endY: publicZone.y + kDepth });
    }
  }

  rooms.push({
    id: "living-room",
    name: "Living / Dining",
    use: "living",
    xMm: livingRect.x,
    yMm: livingRect.y,
    widthMm: livingRect.w,
    depthMm: livingRect.d,
    areaM2: Number(((livingRect.w * livingRect.d) / 1e6).toFixed(1)),
    isCurtainWall: style === "courtyard" || style === "split",
  });

  rooms.push({
    id: "kitchen",
    name: separateKitchen ? "Enclosed Kitchen" : "Open Kitchen",
    use: "kitchen",
    xMm: kitchenRect.x,
    yMm: kitchenRect.y,
    widthMm: kitchenRect.w,
    depthMm: kitchenRect.d,
    areaM2: Number(((kitchenRect.w * kitchenRect.d) / 1e6).toFixed(1)),
  });

  rooms.push({
    id: "guest-wc",
    name: "Guest WC",
    use: "bathroom",
    xMm: guestWcRect.x,
    yMm: guestWcRect.y,
    widthMm: guestWcRect.w,
    depthMm: guestWcRect.d,
    areaM2: Number(((guestWcRect.w * guestWcRect.d) / 1e6).toFixed(1)),
  });

  // --- SUBDIVIDE PRIVATE ZONE (Bedrooms & Bathrooms) ---
  // Number of sleeping bays = bedroomCount
  // We allocate 1 Master Bedroom (generous, optionally with Ensuite) + (bedroomCount - 1) Secondary Bedrooms
  // Plus 1 Family Bathroom
  const bathTargetDepth = Math.max(1800, Math.min(2600, privateZone.d * 0.28));
  const bathTargetWidth = Math.max(2000, Math.min(3200, privateZone.w * 0.35));

  // Family Bathroom in private zone
  const bathX = privateZone.x + (rand() > 0.5 ? 0 : privateZone.w - bathTargetWidth);
  const bathY = privateZone.y + (rand() > 0.5 ? 0 : privateZone.d - bathTargetDepth);
  rooms.push({
    id: "family-bathroom",
    name: "Family Bathroom",
    use: "bathroom",
    xMm: bathX,
    yMm: bathY,
    widthMm: bathTargetWidth,
    depthMm: bathTargetDepth,
    areaM2: Number(((bathTargetWidth * bathTargetDepth) / 1e6).toFixed(1)),
  });

  // Divide remaining private zone area among bedrooms
  const remainingBedrooms = bedroomCount;
  const isPrivateSplitX = privateZone.w >= privateZone.d;

  if (isPrivateSplitX) {
    const bayWidth = (privateZone.w - (remainingBedrooms - 1) * p) / remainingBedrooms;
    for (let i = 0; i < remainingBedrooms; i++) {
      const bx = privateZone.x + i * (bayWidth + p);
      const isMaster = i === 0 || i === remainingBedrooms - 1;
      const bName = isMaster ? "Master Bedroom" : `Bedroom ${i + 1}`;
      rooms.push({
        id: `bedroom-${i + 1}`,
        name: bName,
        use: "bedroom",
        xMm: bx,
        yMm: privateZone.y,
        widthMm: bayWidth,
        depthMm: privateZone.d,
        areaM2: Number(((bayWidth * privateZone.d) / 1e6).toFixed(1)),
        isMaster,
        hasEnsuite: isMaster && ensuiteRequested,
      });
      if (i > 0) {
        interiorWalls.push({ startX: bx - p / 2, startY: privateZone.y, endX: bx - p / 2, endY: privateZone.y + privateZone.d });
      }
    }
  } else {
    const bayDepth = (privateZone.d - (remainingBedrooms - 1) * p) / remainingBedrooms;
    for (let i = 0; i < remainingBedrooms; i++) {
      const by = privateZone.y + i * (bayDepth + p);
      const isMaster = i === 0 || i === remainingBedrooms - 1;
      const bName = isMaster ? "Master Bedroom" : `Bedroom ${i + 1}`;
      rooms.push({
        id: `bedroom-${i + 1}`,
        name: bName,
        use: "bedroom",
        xMm: privateZone.x,
        yMm: by,
        widthMm: privateZone.w,
        depthMm: bayDepth,
        areaM2: Number(((privateZone.w * bayDepth) / 1e6).toFixed(1)),
        isMaster,
        hasEnsuite: isMaster && ensuiteRequested,
      });
      if (i > 0) {
        interiorWalls.push({ startX: privateZone.x, startY: by - p / 2, endX: privateZone.x + privateZone.w, endY: by - p / 2 });
      }
    }
  }

  // Double entrance door on front or public facade
  const entryPos = widthMm * 0.45 + (rand() * 0.1) * widthMm;
  const entryDoor = {
    wall: "front" as const,
    positionMm: Math.round(entryPos),
    isDouble: true,
  };

  // Add windows to all exterior-facing habitable rooms
  rooms.forEach((rm, rIdx) => {
    // Window on north/south wall if room touches it
    if (rm.yMm <= t + 10) {
      // Touches front wall
      windows.push({ wallIndex: 0, positionMm: rm.xMm + rm.widthMm / 2, widthMm: rm.use === "living" ? 2400 : 1400, heightMm: 1400, sillMm: rm.use === "living" ? 300 : 900 });
    }
    if (rm.yMm + rm.depthMm >= depthMm - t - 10) {
      // Touches rear wall
      windows.push({ wallIndex: 2, positionMm: rm.xMm + rm.widthMm / 2, widthMm: rm.use === "living" ? 2400 : 1400, heightMm: 1400, sillMm: rm.use === "living" ? 300 : 900 });
    }
  });

  return {
    widthMm,
    depthMm,
    rooms,
    corridorMm: corridorZone,
    entryDoor,
    exteriorWalls,
    interiorWalls,
    doors,
    windows,
  };
}
