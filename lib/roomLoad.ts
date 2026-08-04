import {
  heizlastToColor,
  kuhllastToColor,
  luftungToColor,
  type ColorPaletteId,
  type CustomLegendColorMap,
} from "@/lib/colorMapping";
import type { DataViewMode } from "@/lib/dataViewMode";
import type { Room } from "@/lib/types";
import { roomVentilationColorValue } from "@/lib/ventilation";

/** Specific load (W/m²) for the active heating/cooling view. */
export function roomDensityLoad(
  room: Room,
  dataViewMode: DataViewMode,
): number {
  if (dataViewMode === "luftung") {
    return roomVentilationColorValue(room);
  }
  return dataViewMode === "kuhllast" ? room.coolLoad : room.heatLoad;
}

/** Absolute load (W) for the active heating/cooling view. */
export function roomAbsoluteLoad(
  room: Room,
  dataViewMode: DataViewMode,
): number | null {
  if (dataViewMode === "luftung") {
    const w = room.ventilation.ventilationHeatLoss;
    return w > 0 ? w : null;
  }
  return dataViewMode === "kuhllast" ? room.kuhllast : room.heizlast;
}

/**
 * Temperature for coloring / legend by view.
 * Cooling uses Solar Computer summer analysis temps; heating uses setpoints.
 */
export function roomTemperatureForView(
  room: Room,
  dataViewMode: DataViewMode,
): number {
  if (dataViewMode === "kuhllast") {
    if (room.coolTemperature != null && room.coolTemperature > 0) {
      return room.coolTemperature;
    }
    // No cooling analysis for this room — keep out of summer band via setpoint fallback.
    return room.temperature;
  }
  return room.temperature;
}

export function roomLoadColor(
  room: Room,
  dataViewMode: DataViewMode,
  palette?: ColorPaletteId | string,
  heizlastRange?: number[],
  kuhllastRange?: number[],
  overrides?: CustomLegendColorMap,
  luftungRange?: number[],
): string {
  if (dataViewMode === "luftung") {
    return luftungToColor(
      roomVentilationColorValue(room),
      palette,
      luftungRange,
      overrides,
    );
  }
  if (dataViewMode === "kuhllast") {
    return kuhllastToColor(room.coolLoad, palette, kuhllastRange, overrides);
  }
  return heizlastToColor(room.heatLoad, palette, heizlastRange, overrides);
}

export function isCoolingView(dataViewMode: DataViewMode): boolean {
  return dataViewMode === "kuhllast";
}

export function isVentilationView(dataViewMode: DataViewMode): boolean {
  return dataViewMode === "luftung";
}
