/**
 * Header mode types and icons.
 *
 * `DataViewMode` (heizlast/luftung/kuhllast) is the domain view shown in
 * both the header and the presentation legend (kept in sync); `HeaderMode`
 * extends it with the non-data-view "editor" and "bauteil" header tabs.
 * `HEADER_MODE_ICON`/`DATA_VIEW_ICON` back the header's mode-switch menu.
 */

/** Domain view shown in header + presentation legend (synced). */
export type DataViewMode = "heizlast" | "luftung" | "kuhllast";

export type HeaderMode = DataViewMode | "editor" | "bauteil";

export const DATA_VIEW_MODES: DataViewMode[] = [
  "heizlast",
  "luftung",
  "kuhllast",
];

export const DATA_VIEW_ICON: Record<DataViewMode, string> = {
  heizlast: "/Heating.svg",
  luftung: "/ventilation.svg",
  kuhllast: "/cooling.svg",
};

export const HEADER_MODE_ICON: Record<HeaderMode, string> = {
  ...DATA_VIEW_ICON,
  editor: "/tool.svg",
  bauteil: "/bauteil.svg",
};

export function isDataViewMode(m: string): m is DataViewMode {
  return m === "heizlast" || m === "luftung" || m === "kuhllast";
}

/** Heizlast/Kühllast + Temperature dual view — not used in Lüftung. */
export function supportsCompareBothModes(mode: DataViewMode): boolean {
  return mode !== "luftung";
}

export function compareBothModesLabelKey(
  mode: DataViewMode,
): "heizlastPlusTemp" | "kuhllastPlusTemp" {
  return mode === "kuhllast" ? "kuhllastPlusTemp" : "heizlastPlusTemp";
}
