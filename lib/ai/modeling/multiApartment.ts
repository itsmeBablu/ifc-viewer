import type { AiAction } from "../schema";
import type { ResidentialParameters } from "./allocation";
import { allocateResidential } from "./allocation";
import { apartmentActions, apartmentSchema } from "./apartment";
import { homeDetails } from "./details";

/**
 * Deterministic multi-storey apartment-block compiler:
 * Supports Linear, L-shape (corner) and U-shape (courtyard) arrangements,
 * private balconies for each apartment, and a centralized common circulation core
 * with passenger lift and shared multi-flight stairs.
 */
export function multiApartmentActions(
  input: ResidentialParameters,
  id: string,
  groundId: string,
  baseElevationMm: number,
  heightMm: number,
  thicknessMm: number
): AiAction[] {
  const floors = input.apartmentFloors ?? 3;
  const units = input.apartmentsPerFloor ?? 4;
  const beds = input.bedroomsPerApartment ?? 2;
  if (floors < 1 || floors > 12 || units < 2 || units > 10 || beds < 1 || beds > 3) {
    throw new Error("Apartment blocks support 1–12 floors, 2–10 homes per floor and 1–3 bedrooms per home.");
  }

  const distribution = input.bedroomDistribution?.length ? input.bedroomDistribution : Array.from({ length: units }, () => beds);
  const unitArea = input.totalAreaM2 ? input.totalAreaM2 / (floors * units) : undefined;
  const unitSizes = distribution.slice(0, units).map(b => allocateResidential({ ...input, variant: "apartment" as const, bedrooms: b, totalAreaM2: unitArea }, heightMm, thicknessMm));
  while (unitSizes.length < units) unitSizes.push(unitSizes[unitSizes.length % unitSizes.length]);

  const unitWidth = Math.max(...unitSizes.map(u => u.widthMm));
  const unitDepth = Math.max(...unitSizes.map(u => u.depthMm));
  const gap = 300;
  const corridorDepth = 2200; // Common corridor running along units

  const isL = input.layoutStyle === "corner" || input.footprint === "l";
  const isU = input.layoutStyle === "courtyard" || input.footprint === "u";

  // Calculate unit placements based on geometry shape
  type UnitPlacement = { x: number; y: number; rotationDeg: number; unitIndex: number };
  const placements: UnitPlacement[] = [];

  let overallBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let corePos = { x: 0, y: 0 };

  if (isU) {
    // U-shaped Courtyard layout
    // Wing 1 (left wing along Y), Wing 2 (back wing along X), Wing 3 (right wing along Y)
    const leftCount = Math.max(1, Math.floor((units - 2) / 2));
    const rightCount = leftCount;
    const backCount = Math.max(1, units - leftCount - rightCount);

    const backWidth = backCount * (unitWidth + gap);
    const wingLength = Math.max(leftCount, rightCount) * (unitWidth + gap);

    // Back wing (facing south towards courtyard)
    for (let i = 0; i < backCount; i++) {
      placements.push({
        unitIndex: placements.length,
        x: (unitDepth + gap) + i * (unitWidth + gap),
        y: 0,
        rotationDeg: 0,
      });
    }

    // Left wing (extending along +Y)
    for (let i = 0; i < leftCount; i++) {
      placements.push({
        unitIndex: placements.length,
        x: 0,
        y: (unitDepth + gap) + i * (unitWidth + gap),
        rotationDeg: 90,
      });
    }

    // Right wing (extending along +Y)
    for (let i = 0; i < rightCount; i++) {
      placements.push({
        unitIndex: placements.length,
        x: (unitDepth + gap) + backWidth,
        y: (unitDepth + gap) + i * (unitWidth + gap),
        rotationDeg: 270,
      });
    }

    corePos = {
      x: (unitDepth + gap) + backWidth / 2 - 1700,
      y: unitDepth + 200,
    };

    overallBounds = {
      minX: 0,
      minY: 0,
      maxX: (unitDepth + gap) * 2 + backWidth,
      maxY: (unitDepth + gap) + wingLength,
    };
  } else if (isL) {
    // L-shaped Corner layout
    // Wing 1 along X-axis, Wing 2 along Y-axis
    const countX = Math.ceil(units * 0.55);
    const countY = units - countX;

    // Wing X
    for (let i = 0; i < countX; i++) {
      placements.push({
        unitIndex: i,
        x: (unitDepth + gap) + i * (unitWidth + gap),
        y: 0,
        rotationDeg: 0,
      });
    }

    // Wing Y (turning 90 degrees at corner)
    for (let i = 0; i < countY; i++) {
      placements.push({
        unitIndex: countX + i,
        x: 0,
        y: (unitDepth + gap) + i * (unitWidth + gap),
        rotationDeg: 90,
      });
    }

    corePos = {
      x: 400,
      y: 400,
    };

    overallBounds = {
      minX: 0,
      minY: 0,
      maxX: (unitDepth + gap) + countX * (unitWidth + gap),
      maxY: (unitDepth + gap) + countY * (unitWidth + gap),
    };
  } else {
    // Linear building
    const totalWidth = units * (unitWidth + gap) - gap;
    for (let i = 0; i < units; i++) {
      placements.push({
        unitIndex: i,
        x: i * (unitWidth + gap),
        y: 0,
        rotationDeg: 0,
      });
    }

    // Core in the middle of the building
    corePos = {
      x: totalWidth / 2 - 1700,
      y: unitDepth + 300,
    };

    overallBounds = {
      minX: 0,
      minY: 0,
      maxX: totalWidth,
      maxY: unitDepth + corridorDepth + 3600,
    };
  }

  const hasLift = input.lift !== false;
  const hasStairs = input.commonStairs !== false;
  const actions: AiAction[] = [];

  for (let floor = 0; floor < floors; floor++) {
    const levelId = floor === 0 ? groundId : `${id}:level:${floor}`;
    if (floor > 0) {
      actions.push({
        kind: "level",
        operation: "create",
        id: levelId,
        name: `Apartment floor ${floor + 1}`,
        elevationMm: baseElevationMm + floor * (heightMm + 200),
        heightMm,
      });
    }

    // Compile units on this floor
    for (const place of placements) {
      const unitIndex = place.unitIndex;
      const unit = unitSizes[unitIndex];
      const unitBeds = distribution[unitIndex] ?? beds;

      const item = apartmentSchema.parse({
        kind: "apartment_layout",
        id: `${id}:floor:${floor}:unit:${unitIndex}`,
        levelId,
        bedrooms: unitBeds,
        bedroomAreaM2: unit.bedroomAreaM2,
        livingAreaM2: input.livingAreaM2,
        kitchenAreaM2: input.kitchenAreaM2,
        bathroomAreaM2: input.bathroomAreaM2,
        heightMm,
        thicknessMm,
        xMm: place.x,
        yMm: place.y,
        furnished: input.furnished !== false,
        separateKitchen: input.separateKitchen ?? true,
        ensuiteBathrooms: input.ensuiteBathrooms ?? true,
        bathroomCount: input.bathroomCount,
        guestBathroom: input.guestBathroom,
        guestBathroomShower: input.guestBathroomShower,
        doorStyle: input.doorStyle,
        windowStyle: input.windowStyle,
        doubleEntranceDoor: input.doubleEntranceDoor,
        underfloorHeating: input.underfloorHeating,
        piping: input.piping,
        ducts: input.ducts,
        curtainFacade: input.curtainFacade,
        electrical: input.electrical,
        balcony: input.balcony && input.balcony !== "none" ? input.balcony : "front",
        layoutSeed: (input.layoutSeed ?? 0) + unitIndex * 73 + floor * 109,
      });

      // Include all unit actions, preserving private balcony slabs and railings!
      const unitActions = apartmentActions(item, { allocation: unit, entrance: unitIndex === 0 });
      actions.push(
        ...unitActions.filter(
          a => a.kind !== "roof" && (!a.id.endsWith(":floor") || a.id.includes(":balcony:"))
        )
      );
    }

    // Floor plate boundary tailored to footprint shape
    let floorPolygon: Array<{ xMm: number; yMm: number }> = [];
    if (isU) {
      const { maxX, maxY } = overallBounds;
      const innerLeft = unitDepth + gap;
      const innerRight = maxX - (unitDepth + gap);
      const innerBottom = unitDepth;
      floorPolygon = [
        { xMm: 0, yMm: 0 },
        { xMm: maxX, yMm: 0 },
        { xMm: maxX, yMm: maxY },
        { xMm: innerRight, yMm: maxY },
        { xMm: innerRight, yMm: innerBottom },
        { xMm: innerLeft, yMm: innerBottom },
        { xMm: innerLeft, yMm: maxY },
        { xMm: 0, yMm: maxY },
      ];
    } else if (isL) {
      const { maxX, maxY } = overallBounds;
      const cornerX = unitDepth + gap;
      const cornerY = unitDepth;
      floorPolygon = [
        { xMm: 0, yMm: 0 },
        { xMm: maxX, yMm: 0 },
        { xMm: maxX, yMm: cornerY },
        { xMm: cornerX, yMm: cornerY },
        { xMm: cornerX, yMm: maxY },
        { xMm: 0, yMm: maxY },
      ];
    } else {
      const { minX, minY, maxX, maxY } = overallBounds;
      floorPolygon = [
        { xMm: minX, yMm: minY },
        { xMm: maxX, yMm: minY },
        { xMm: maxX, yMm: maxY },
        { xMm: minX, yMm: maxY },
      ];
    }

    actions.push({
      kind: "floor",
      operation: "create",
      id: `${id}:floor:${floor}`,
      levelId,
      boundary: floorPolygon,
      thicknessMm: 200,
      elevationOffsetMm: 0,
      roofPreset: "flat",
      pitchDeg: 0,
    });

    // Central Vertical Circulation Core: Lift & Stairs
    const coreX = corePos.x;
    const coreY = corePos.y;
    const coreW = 3400;
    const coreD = 3200;

    // Core Enclosing Fire Walls
    actions.push({
      kind: "wall",
      operation: "create",
      id: `${id}:floor:${floor}:core-wall-n`,
      levelId,
      startXmm: coreX,
      startYmm: coreY,
      endXmm: coreX + coreW,
      endYmm: coreY,
      thicknessMm: 200,
      heightMm,
      wallType: "fire",
    });
    actions.push({
      kind: "wall",
      operation: "create",
      id: `${id}:floor:${floor}:core-wall-e`,
      levelId,
      startXmm: coreX + coreW,
      startYmm: coreY,
      endXmm: coreX + coreW,
      endYmm: coreY + coreD,
      thicknessMm: 200,
      heightMm,
      wallType: "fire",
    });
    actions.push({
      kind: "wall",
      operation: "create",
      id: `${id}:floor:${floor}:core-wall-s`,
      levelId,
      startXmm: coreX + coreW,
      startYmm: coreY + coreD,
      endXmm: coreX,
      endYmm: coreY + coreD,
      thicknessMm: 200,
      heightMm,
      wallType: "fire",
    });
    const westCoreWall = `${id}:floor:${floor}:core-wall-w`;
    actions.push({
      kind: "wall",
      operation: "create",
      id: westCoreWall,
      levelId,
      startXmm: coreX,
      startYmm: coreY + coreD,
      endXmm: coreX,
      endYmm: coreY,
      thicknessMm: 200,
      heightMm,
      wallType: "fire",
    });

    // Fire door entering circulation core
    actions.push({
      kind: "door",
      operation: "create",
      id: `${id}:floor:${floor}:core-door`,
      wallId: westCoreWall,
      positionMm: 1200,
      widthMm: 1000,
      heightMm: 2100,
      hinge: "start",
      swing: 1,
      style: "metal",
    });

    // Shared Passenger Lift Cabin (aligned across all storeys)
    if (hasLift) {
      actions.push({
        kind: "equipment",
        operation: "create",
        id: `${id}:floor:${floor}:lift`,
        levelId,
        familyId: "extras-lift",
        xMm: coreX + 900,
        yMm: coreY + 900,
        rotationDeg: 0,
        elevationMm: 0,
        widthMm: 1600,
        depthMm: 1600,
        heightMm,
      });
    }

    // Common Multi-flight Stairs & Intermediate Landing
    if (hasStairs && floor < floors - 1) {
      actions.push({
        kind: "floor",
        operation: "create",
        id: `${id}:floor:${floor}:stair-landing`,
        levelId,
        boundary: [
          { xMm: coreX + 1700, yMm: coreY + 300 },
          { xMm: coreX + 3100, yMm: coreY + 300 },
          { xMm: coreX + 3100, yMm: coreY + 1600 },
          { xMm: coreX + 1700, yMm: coreY + 1600 },
        ],
        thicknessMm: 180,
        elevationOffsetMm: 0,
        roofPreset: "flat",
        pitchDeg: 0,
      });

      actions.push({
        kind: "floor",
        operation: "create",
        id: `${id}:floor:${floor}:stair-landing-mid`,
        levelId,
        boundary: [
          { xMm: coreX + 1700, yMm: coreY + 1700 },
          { xMm: coreX + 3100, yMm: coreY + 1700 },
          { xMm: coreX + 3100, yMm: coreY + 2900 },
          { xMm: coreX + 1700, yMm: coreY + 2900 },
        ],
        thicknessMm: 180,
        elevationOffsetMm: Math.round(heightMm / 2),
        roofPreset: "flat",
        pitchDeg: 0,
      });
    }
  }

  // Uniformly apply facade curtain walls, electrical connections, and door/window styles
  return homeDetails(actions, input);
}
