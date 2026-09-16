/** Concept geometry in millimetres. Explicit project and prompt values win. */
export const BIM_DEFAULTS = {
  architectural: {
    wallHeightMm: 3000, exteriorWallThicknessMm: 300, interiorWallThicknessMm: 150,
    slabThicknessMm: 200, ceilingHeightMm: 2700, floorToFloorHeightMm: 3200,
    doorWidthMm: 900, doorHeightMm: 2100, doubleDoorWidthMm: 1800,
    windowWidthMm: 1200, windowHeightMm: 1200, sillHeightMm: 900,
    corridorWidthMm: 1200, staircaseWidthMm: 1000, roomMinimumAreaM2: 8,
    roofThicknessMm: 200, roofPreset: "flat", roofPitchDeg: 0,
  },
  mep: {
    ductWidthMm: 300, ductHeightMm: 200, ductDiameterMm: 250,
    pipeDiametersMm: [15, 22, 28, 35, 42, 54, 76, 108], heatingPipeDiameterMm: 28,
    waterPipeDiameterMm: 22, drainagePipeDiameterMm: 108, sprinklerPipeDiameterMm: 35,
    radiator: { widthMm: 1000, depthMm: 100, heightMm: 600, elevationMm: 150 },
    heater: { widthMm: 600, depthMm: 600, heightMm: 1600 },
    cooler: { widthMm: 1600, depthMm: 800, heightMm: 1200 },
    fcu: { widthMm: 900, depthMm: 600, heightMm: 250, elevationMm: 2400 },
    ahu: { widthMm: 2400, depthMm: 1200, heightMm: 1500 },
    diffuser: { widthMm: 300, depthMm: 300, heightMm: 100 },
    grille: { widthMm: 300, depthMm: 300, heightMm: 100 },
    sprinklerSpacingMm: 3000, sprinklerWallOffsetMm: 1500, ceilingServiceZoneMm: 300,
    ductElevationMm: 2600, pipeElevationMm: 2500, cableTrayElevationMm: 2500,
    equipmentClearanceMm: 600, drainageSlopePercent: 1,
  },
} as const;
