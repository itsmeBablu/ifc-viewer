import {
  heizlastToColor,
  kuhllastToColor,
  type ColorPaletteId,
  type CustomLegendColorMap,
} from "@/lib/colorMapping";
import type { DataViewMode } from "@/lib/dataViewMode";
import type { Room } from "@/lib/types";

/** Specific load (W/m²) for the active heating/cooling view. */
export function roomDensityLoad(
  room: Room,
  dataViewMode: DataViewMode,
): number {
  return dataViewMode === "kuhllast" ? room.coolLoad : room.heatLoad;
}

/** Absolute load (W) for the active heating/cooling view. */
export function roomAbsoluteLoad(
  room: Room,
  dataViewMode: DataViewMode,
): number | null {
  return dataViewMode === "kuhllast" ? room.kuhllast : room.heizlast;
}

export function roomLoadColor(
  room: Room,
  dataViewMode: DataViewMode,
  palette?: ColorPaletteId | string,
  heizlastRange?: number[],
  kuhllastRange?: number[],
  overrides?: CustomLegendColorMap,
): string {
  if (dataViewMode === "kuhllast") {
    return kuhllastToColor(room.coolLoad, palette, kuhllastRange, overrides);
  }
  return heizlastToColor(room.heatLoad, palette, heizlastRange, overrides);
}

export function isCoolingView(dataViewMode: DataViewMode): boolean {
  return dataViewMode === "kuhllast";
}
