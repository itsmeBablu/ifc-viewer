/** Domain view shown in header + presentation legend (synced). */
export type DataViewMode = "heizlast" | "luftung" | "kuhllast";

export type HeaderMode = DataViewMode | "editor";

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
