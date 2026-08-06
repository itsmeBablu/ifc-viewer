"use client";

import { create } from "zustand";
import type { ColorPaletteId } from "@/lib/colorMapping";
import {
  mapAnchorColorsToRange,
  mapHeatAnchorColorsToRange,
  resolveColorPalette,
  standardTemperatureOverrides,
  legendRangesFromRooms,
  type CustomLegendColors,
  type CustomLegendColorMap,
  type LegendColorMode,
} from "@/lib/colorMapping";
import {
  getLegendSwatchPreset,
  getTemperatureSwatchPreset,
  buildThermalClassicLegendColors,
  DEFAULT_LEGEND_SWATCH_PRESET_ID,
  DEFAULT_THERMAL_CLASSIC_PRESET_IDS,
  swatchColorsForMode,
} from "@/lib/legendSwatchPresets";
import {
  DEFAULT_HEIZLAST_RANGE,
  DEFAULT_KUHLLAST_RANGE,
  DEFAULT_LUFTUNG_RANGE,
  DEFAULT_TEMPERATURE_RANGE,
  DEFAULT_COOLING_TEMPERATURE_RANGE,
  parseLegendRange,
} from "@/lib/colorMapping";
import { listVisibleFloors } from "@/lib/floorFilter";
import type { DataViewMode } from "@/lib/dataViewMode";
import { roomVentilationZoneKey } from "@/lib/ventilation";
import {
  DEFAULT_SCENE_BG,
  getDefaultSceneBackground,
  getModeSkyPreset,
  SCENE_BACKGROUND_PRESETS,
} from "@/lib/sceneSky";
import type {
  ColorMode,
  Floor,
  RenderMode,
  Room,
  SavedView,
  SelectedElement,
} from "@/lib/types";

const LAST_MODEL_KEY = "ifc-viewer:lastModelId";
const LEFT_PANEL_KEY = "ifc-viewer:leftPanelOpen";
const RIGHT_PANEL_KEY = "ifc-viewer:rightPanelOpen";
const PALETTE_KEY = "ifc-viewer:colorPalette";
const BG_KEY = "ifc-viewer:sceneBackground";
const AUTO_BG_KEY = "ifc-viewer:autoSceneBackground";
const AUTO_FOCUS_KEY = "ifc-viewer:autoFocusSelection";
const THEME_KEY = "ifc-viewer:colorTheme";
const HEIZLAST_RANGE_KEY = "ifc-viewer:heizlastRange:v2";
const KUHLLAST_RANGE_KEY = "ifc-viewer:kuhllastRange:v2";
const LUFTUNG_RANGE_KEY = "ifc-viewer:luftungRange";
const TEMP_RANGE_KEY = "ifc-viewer:temperatureRange";
const COOL_TEMP_RANGE_KEY = "ifc-viewer:coolingTemperatureRange";
const CUSTOM_LEGEND_COLORS_KEY = "ifc-viewer:customLegendColors:v3";
const LEGEND_SWATCH_PRESET_KEY = "ifc-viewer:legendSwatchPresetId:v2";
const savedViewsKey = (modelId: string) => `ifc-viewer:savedViews:${modelId}`;

export { SCENE_BACKGROUND_PRESETS } from "@/lib/sceneSky";

const DEFAULT_BG = DEFAULT_SCENE_BG;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function loadSavedViews(modelId: string): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(savedViewsKey(modelId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedView[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedViews(modelId: string, views: SavedView[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(savedViewsKey(modelId), JSON.stringify(views));
  } catch {
    // ignore quota / private mode
  }
}

export function getPersistedModelId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LAST_MODEL_KEY);
  } catch {
    return null;
  }
}

export function persistModelId(modelId: string): void {
  if (typeof window === "undefined") return;
  if (modelId.startsWith("local-")) return;
  try {
    localStorage.setItem(LAST_MODEL_KEY, modelId);
  } catch {
    // ignore
  }
}

function readBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return raw === "1";
  } catch {
    return fallback;
  }
}

/** @deprecated use left/right panel keys */
export function getPersistedSidebarOpen(): boolean {
  return readBool(RIGHT_PANEL_KEY, false) || readBool(LEFT_PANEL_KEY, false);
}

type AppState = {
  activeModelId: string | null;
  activeModelLabel: string | null;
  activeModelFileSizeBytes: number | null;
  floors: Floor[];
  rooms: Room[];
  selectedFloor: string | null;
  selectedRoomId: string | null;
  hoveredRoom: Room | null;
  selectedElement: SelectedElement | null;
  /** Increments on each 3D scene pick (for left-panel auto Attributes). */
  scenePickToken: number;
  colorMode: ColorMode;
  /** Heating / ventilation / cooling — synced between header and legend. */
  dataViewMode: DataViewMode;
  activeColorPalette: ColorPaletteId;
  /** Legend Heizlast stop values (6–8). */
  heizlastRange: number[];
  /** Legend Kühllast stop values (6–8). */
  kuhllastRange: number[];
  /** Legend Lüftung heat-loss stop values (6–8). */
  luftungRange: number[];
  /** Legend temperature stop values (heating setpoint °C). */
  temperatureRange: number[];
  /** Legend cooling analysis temperature stops (°C) — Solar Computer MAX/operative. */
  coolingTemperatureRange: number[];
  /** User-edited swatch colors keyed by stop value string. */
  customLegendColors: CustomLegendColors;
  /** Last one-click swatch preset applied per legend mode. */
  legendSwatchPresetId: Record<LegendColorMode, string | null>;
  renderMode: RenderMode;
  lighting: {
    /** Opacity of IfcSpace / room color overlays (0–1). */
    spaceTransparency: number;
    /** Opacity of all other building elements / shell (0–1). */
    elementTransparency: number;
    color: number;
    shadow: number;
    indirectLight: number;
  };
  /** Hex color or preset id for the 3D scene background. */
  sceneBackground: string;
  /** When true, sky follows heating/cooling mode (+ day/night). Default off. */
  autoSceneBackground: boolean;
  /** When true, selecting a room/zone flies the camera (like Lüftung focus). Default off. */
  autoFocusSelection: boolean;
  /** True while PDF capture is running — hide chrome that must not appear in captures. */
  pdfCaptureActive: boolean;
  /** Presentation (exploded) vs basic imported view. */
  isPresentationView: boolean;
  /** selectedFloor restored when leaving presentation. */
  presentationPrevFloor: string | null;
  /** Floor focused in the presentation rooms list. */
  presentationFloorId: string | null;
  /** When true, show floor picker + room list in presentation panel. */
  presentationRoomsOpen: boolean;
  /** Stack (≤4 auto) vs side-by-side grid (≥5 auto). */
  presentationLayoutMode: import("@/lib/presentationLayout").PresentationLayoutMode;
  /** When true, only show presentationFloorId in 3D. */
  presentationIsolate: boolean;
  /** Show Heizlast + Temperature together (stacked on floor, side-by-side in presentation). */
  compareBothModes: boolean;
  /** Selected Nutzungszone in Lüftung view (floorId::zoneNumber::zoneName). */
  selectedVentilationZoneKey: string | null;
  /** Incremented when a ventilation zone is selected (camera fly). */
  ventilationZoneFocusToken: number;
  /** Incremented when UI requests camera focus on a room. */
  roomFocusToken: number;
  /** Incremented when an isolated floor changes (camera fit). */
  floorFocusToken: number;
  /** True while the 3D context menu is open — disables orbit controls. */
  viewerContextMenuOpen: boolean;
  /** Room filter for search/filter bar — null means no filter. */
  activeFilter: {
    minHeat?: number;
    maxHeat?: number;
    temperatures?: number[];
  } | null;
  sliceProgress: number;
  isLoadingModel: boolean;
  /** True while 3D scene recolors / rebuilds after mode changes. */
  sceneBusy: boolean;
  sceneBusySince: number | null;
  loadError: string | null;
  loadProgress: number;
  loadMessage: string;
  savedViews: SavedView[];
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  /** @deprecated alias of rightPanelOpen for older callers */
  sidebarOpen: boolean;
  headerExpanded: boolean;
  isHeaderCollapsed: boolean;
  uiLanguage: import("@/lib/i18n").UiLanguage;
  /** Day (light) vs night (dark) UI theme. */
  colorTheme: import("@/lib/themeColors").ColorTheme;

  /** Werkzeug — native IFC inspection view (structure tree instead of legend). */
  toolMode: boolean;
  /** Shading mode to restore when leaving Werkzeug. */
  toolPrevRenderMode: RenderMode | null;
  /** Space opacity to restore when leaving Werkzeug. */
  toolPrevSpaceTransparency: number | null;
  /** Element opacity to restore when leaving Werkzeug. */
  toolPrevElementTransparency: number | null;
  /** Express ids hidden via the IFC structure tree. Tool view only. */
  hiddenElementIds: Set<number>;
  /** Express ids kept visible when isolating; null means "no isolation". */
  isolatedElementIds: Set<number> | null;
  /** Express id picked in the tool view (tree or 3D) — drives the inspector. */
  toolSelectedExpressId: number | null;
  /** Incremented when the tool view should reveal + frame the selection. */
  toolRevealToken: number;

  setActiveModelId: (
    id: string | null,
    label?: string | null,
    fileSizeBytes?: number | null,
  ) => void;
  setFloors: (floors: Floor[]) => void;
  setRooms: (rooms: Room[]) => void;
  setSelectedFloor: (floorId: string | null) => void;
  setSelectedRoomId: (roomId: string | null) => void;
  setHoveredRoom: (room: Room | null) => void;
  setSelectedElement: (el: SelectedElement | null) => void;
  /** Bumped when the user picks an element in the 3D scene (not from UI lists). */
  bumpScenePickToken: () => void;
  setColorMode: (mode: ColorMode) => void;
  setDataViewMode: (mode: DataViewMode) => void;
  setActiveColorPalette: (id: ColorPaletteId) => void;
  setHeizlastRange: (values: number[]) => void;
  setKuhllastRange: (values: number[]) => void;
  setLuftungRange: (values: number[]) => void;
  setTemperatureRange: (values: number[]) => void;
  setCoolingTemperatureRange: (values: number[]) => void;
  /** Fit all legend ranges + Thermal Classic colors from loaded IFC rooms. */
  fitLegendToRooms: (rooms: Room[]) => void;
  setLegendStopColor: (
    mode: LegendColorMode,
    value: number,
    color: string,
  ) => void;
  resetLegendColors: (mode: LegendColorMode) => void;
  applyLegendSwatchPreset: (mode: LegendColorMode, presetId: string) => void;
  setRenderMode: (mode: RenderMode) => void;
  setLighting: (
    partial: Partial<{
      spaceTransparency: number;
      elementTransparency: number;
      color: number;
      shadow: number;
      indirectLight: number;
    }>,
  ) => void;
  setSceneBackground: (value: string, options?: { persist?: boolean }) => void;
  setAutoSceneBackground: (on: boolean) => void;
  setAutoFocusSelection: (on: boolean) => void;
  setPdfCaptureActive: (on: boolean) => void;
  setSliceProgress: (t: number) => void;
  setPresentationView: (active: boolean) => void;
  setPresentationFloorId: (floorId: string | null) => void;
  setPresentationRoomsOpen: (open: boolean) => void;
  setPresentationLayoutMode: (
    mode: import("@/lib/presentationLayout").PresentationLayoutMode,
  ) => void;
  setPresentationIsolate: (isolate: boolean) => void;
  setPresentationFloorIsolate: (floorId: string | null) => void;
  setSelectedVentilationZoneKey: (key: string | null) => void;
  requestRoomFocus: (roomId: string) => void;
  setViewerContextMenuOpen: (open: boolean) => void;
  setCompareBothModes: (on: boolean) => void;
  beginSceneBusy: () => void;
  endSceneBusy: () => void;
  showSceneBusyNow: () => void;
  setActiveFilter: (
    filter: {
      minHeat?: number;
      maxHeat?: number;
      temperatures?: number[];
    } | null,
  ) => void;
  setIsLoadingModel: (loading: boolean) => void;
  setLoadError: (error: string | null) => void;
  setLoadProgress: (progress: number, message?: string) => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setHeaderExpanded: (expanded: boolean) => void;
  setHeaderCollapsed: (collapsed: boolean) => void;
  toggleHeaderCollapsed: () => void;
  setUiLanguage: (lang: import("@/lib/i18n").UiLanguage) => void;
  setColorTheme: (theme: import("@/lib/themeColors").ColorTheme) => void;
  addSavedView: (
    name: string,
    position: [number, number, number],
    target: [number, number, number],
    opts?: { pageFormat?: import("@/lib/presentationLayout").PageFormat },
  ) => void;
  goToSavedView: (id: string) => SavedView | undefined;
  removeSavedView: (id: string) => void;
  clearModelData: () => void;

  setToolMode: (on: boolean) => void;
  /** Hide / show a whole subtree at once. */
  setElementsVisible: (expressIds: number[], visible: boolean) => void;
  /** Show only these ids (and clear any previous isolation when empty). */
  isolateElements: (expressIds: number[] | null) => void;
  resetElementVisibility: () => void;
  setToolSelectedExpressId: (expressId: number | null) => void;
  requestToolReveal: (expressId: number) => void;
};

function persistPanel(key: string, open: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, open ? "1" : "0");
  } catch {
    // ignore
  }
}

function initialPalette(): ColorPaletteId {
  if (typeof window === "undefined") return "standard";
  try {
    const raw = localStorage.getItem(PALETTE_KEY);
    if (
      raw === "softPastel" ||
      raw === "warmPastel" ||
      raw === "standard"
    ) {
      return raw;
    }
    if (raw === "dark") return "standard";
  } catch {
    // ignore
  }
  return "standard";
}

function persistCustomLegendColors(colors: CustomLegendColors) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_LEGEND_COLORS_KEY, JSON.stringify(colors));
  } catch {
    // ignore
  }
}

function persistLegendSwatchPresetIds(
  ids: Record<LegendColorMode, string | null>,
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LEGEND_SWATCH_PRESET_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

function initialCustomLegendColors(): CustomLegendColors {
  // Always Schnellpalette #1 (Thermal Classic) on startup.
  return buildThermalClassicLegendColors({
    heizlast: initialRange(HEIZLAST_RANGE_KEY, DEFAULT_HEIZLAST_RANGE),
    kuhllast: initialRange(KUHLLAST_RANGE_KEY, DEFAULT_KUHLLAST_RANGE),
    luftung: initialRange(LUFTUNG_RANGE_KEY, DEFAULT_LUFTUNG_RANGE),
    temperature: initialRange(TEMP_RANGE_KEY, DEFAULT_TEMPERATURE_RANGE),
  });
}

function initialLegendSwatchPresetIds(): Record<LegendColorMode, string | null> {
  return { ...DEFAULT_THERMAL_CLASSIC_PRESET_IDS };
}

function initialRange(key: string, fallback: number[]): number[] {
  if (typeof window === "undefined") return [...fallback];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [...fallback];
    return parseLegendRange(raw) ?? [...fallback];
  } catch {
    return [...fallback];
  }
}

function persistRange(key: string, values: number[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, values.join(","));
  } catch {
    // ignore
  }
}

function initialBackground(): string {
  if (typeof window === "undefined") return DEFAULT_BG;
  try {
    const raw = localStorage.getItem(BG_KEY);
    if (raw) {
      if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
      if (SCENE_BACKGROUND_PRESETS.some((p) => p.id === raw)) return raw;
    }
    return getDefaultSceneBackground(initialTheme());
  } catch {
    return getDefaultSceneBackground(initialTheme());
  }
}

function initialAutoSceneBackground(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(AUTO_BG_KEY) === "1";
  } catch {
    // ignore
  }
  return false;
}

function initialAutoFocusSelection(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(AUTO_FOCUS_KEY) === "1";
  } catch {
    // ignore
  }
  return false;
}

function initialTheme(): import("@/lib/themeColors").ColorTheme {
  if (typeof window === "undefined") return "light";
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    // ignore
  }
  return "light";
}

let sceneWorkDepth = 0;
/** Only show spinner if work lasts longer than this (avoids flash on quick updates). */
const SCENE_BUSY_SHOW_DELAY_MS = 200;
let sceneBusyShowTimer: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  activeModelId: null,
  activeModelLabel: null,
  activeModelFileSizeBytes: null,
  floors: [],
  rooms: [],
  selectedFloor: null,
  selectedRoomId: null,
  hoveredRoom: null,
  selectedElement: null,
  scenePickToken: 0,
  colorMode: "heizlast",
  dataViewMode: "heizlast",
  activeColorPalette: initialPalette(),
  heizlastRange: initialRange(HEIZLAST_RANGE_KEY, DEFAULT_HEIZLAST_RANGE),
  kuhllastRange: initialRange(KUHLLAST_RANGE_KEY, DEFAULT_KUHLLAST_RANGE),
  luftungRange: initialRange(LUFTUNG_RANGE_KEY, DEFAULT_LUFTUNG_RANGE),
  temperatureRange: initialRange(TEMP_RANGE_KEY, DEFAULT_TEMPERATURE_RANGE),
  coolingTemperatureRange: initialRange(
    COOL_TEMP_RANGE_KEY,
    DEFAULT_COOLING_TEMPERATURE_RANGE,
  ),
  customLegendColors: initialCustomLegendColors(),
  legendSwatchPresetId: initialLegendSwatchPresetIds(),
  renderMode: "fullColor",
  lighting: {
    spaceTransparency: 0.8,
    elementTransparency: 0.8,
    color: 1,
    shadow: 0.55,
    indirectLight: 0.45,
  },
  sceneBackground: initialBackground(),
  autoSceneBackground: initialAutoSceneBackground(),
  autoFocusSelection: initialAutoFocusSelection(),
  pdfCaptureActive: false,
  isPresentationView: false,
  presentationPrevFloor: null,
  presentationFloorId: null,
  presentationRoomsOpen: false,
  presentationLayoutMode: "stack",
  presentationIsolate: false,
  compareBothModes: false,
  selectedVentilationZoneKey: null,
  ventilationZoneFocusToken: 0,
  roomFocusToken: 0,
  floorFocusToken: 0,
  viewerContextMenuOpen: false,
  activeFilter: null,
  sliceProgress: 0.9,
  isLoadingModel: false,
  sceneBusy: false,
  sceneBusySince: null,
  loadError: null,
  loadProgress: 0,
  loadMessage: "",
  savedViews: [],
  leftPanelOpen: false,
  rightPanelOpen: false,
  sidebarOpen: false,
  headerExpanded: true,
  isHeaderCollapsed: false,
  uiLanguage: "de",
  colorTheme: initialTheme(),

  toolMode: false,
  toolPrevRenderMode: null,
  toolPrevSpaceTransparency: null,
  toolPrevElementTransparency: null,
  hiddenElementIds: new Set<number>(),
  isolatedElementIds: null,
  toolSelectedExpressId: null,
  toolRevealToken: 0,

  setActiveModelId: (id, label, fileSizeBytes) => {
    set({
      activeModelId: id,
      activeModelLabel: label ?? null,
      activeModelFileSizeBytes: fileSizeBytes ?? null,
      hiddenElementIds: new Set<number>(),
      isolatedElementIds: null,
      toolSelectedExpressId: null,
      selectedFloor: null,
      selectedRoomId: null,
      hoveredRoom: null,
      selectedElement: null,
      savedViews: id ? loadSavedViews(id) : [],
      loadError: null,
    });
  },

  setFloors: (floors) => set({ floors }),
  setRooms: (rooms) =>
    set({ rooms, selectedVentilationZoneKey: null, selectedRoomId: null }),
  setSelectedFloor: (floorId) => {
    const s = get();
    if (floorId === s.selectedFloor) return;
    set({
      selectedFloor: floorId,
      // Default Schnitthöhe near the top of the floor (90%)
      sliceProgress: 0.9,
      selectedRoomId: null,
      selectedElement: null,
      floorFocusToken: s.floorFocusToken + 1,
    });
  },
  setSelectedRoomId: (roomId) =>
    set(
      roomId
        ? { selectedRoomId: roomId, hoveredRoom: null }
        : { selectedRoomId: null, selectedElement: null, hoveredRoom: null },
    ),
  setHoveredRoom: (room) => set({ hoveredRoom: room }),
  setSelectedElement: (el) => set({ selectedElement: el }),
  bumpScenePickToken: () =>
    set({ scenePickToken: get().scenePickToken + 1 }),
  setColorMode: (mode) => {
    if (mode === get().colorMode) return;
    set({ colorMode: mode });
  },
  setDataViewMode: (mode) => {
    if (mode === get().dataViewMode) return;
    const s = get();
    const room = s.selectedRoomId
      ? s.rooms.find((r) => r.id === s.selectedRoomId)
      : null;
    const nextZone =
      mode === "luftung" && room ? roomVentilationZoneKey(room) : null;
    set({
      dataViewMode: mode,
      selectedVentilationZoneKey: mode === "luftung" ? nextZone : null,
      ...(mode === "luftung" ? { compareBothModes: false } : {}),
    });
    // Remap temperature swatches onto heating vs cooling analysis ranges.
    const presetId = get().legendSwatchPresetId.temperature;
    if (presetId) get().applyLegendSwatchPreset("temperature", presetId);
    // Autofocus preference persists across modes — re-apply to current selection.
    if (!s.autoFocusSelection) return;
    if (mode === "luftung" && nextZone) {
      set((st) => ({
        ventilationZoneFocusToken: st.ventilationZoneFocusToken + 1,
        selectedRoomId: s.selectedRoomId,
      }));
    } else if (s.selectedRoomId) {
      get().requestRoomFocus(s.selectedRoomId);
    }
  },
  setActiveColorPalette: (id) => {
    const palette = id === "dark" ? "standard" : id;
    if (palette === get().activeColorPalette) return;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(PALETTE_KEY, palette);
      } catch {
        // ignore
      }
    }
    const s = get();
    const classic = buildThermalClassicLegendColors({
      heizlast: s.heizlastRange,
      kuhllast: s.kuhllastRange,
      luftung: s.luftungRange,
      temperature: s.temperatureRange,
    });
    const presetIds = { ...DEFAULT_THERMAL_CLASSIC_PRESET_IDS };
    set({
      activeColorPalette: palette,
      customLegendColors: classic,
      legendSwatchPresetId: presetIds,
    });
    persistCustomLegendColors(classic);
    persistLegendSwatchPresetIds(presetIds);
  },
  setHeizlastRange: (values) => {
    const parsed = parseLegendRange(values.join(","));
    if (!parsed) return;
    persistRange(HEIZLAST_RANGE_KEY, parsed);
    set({ heizlastRange: parsed });
    const presetId = get().legendSwatchPresetId.heizlast;
    if (presetId) get().applyLegendSwatchPreset("heizlast", presetId);
  },
  setKuhllastRange: (values) => {
    const parsed = parseLegendRange(values.join(","));
    if (!parsed) return;
    persistRange(KUHLLAST_RANGE_KEY, parsed);
    set({ kuhllastRange: parsed });
    const presetId = get().legendSwatchPresetId.kuhllast;
    if (presetId) get().applyLegendSwatchPreset("kuhllast", presetId);
  },
  setLuftungRange: (values) => {
    const parsed = parseLegendRange(values.join(","));
    if (!parsed) return;
    persistRange(LUFTUNG_RANGE_KEY, parsed);
    set({ luftungRange: parsed });
    const presetId = get().legendSwatchPresetId.luftung;
    if (presetId) get().applyLegendSwatchPreset("luftung", presetId);
  },
  setTemperatureRange: (values) => {
    const parsed = parseLegendRange(values.join(","));
    if (!parsed) return;
    persistRange(TEMP_RANGE_KEY, parsed);
    set({ temperatureRange: parsed });
    const presetId = get().legendSwatchPresetId.temperature;
    if (presetId) get().applyLegendSwatchPreset("temperature", presetId);
  },
  setCoolingTemperatureRange: (values) => {
    const parsed = parseLegendRange(values.join(","));
    if (!parsed) return;
    persistRange(COOL_TEMP_RANGE_KEY, parsed);
    set({ coolingTemperatureRange: parsed });
    const presetId = get().legendSwatchPresetId.temperature;
    if (presetId) get().applyLegendSwatchPreset("temperature", presetId);
  },
  fitLegendToRooms: (rooms) => {
    const legend = legendRangesFromRooms(rooms);
    const heizlast = parseLegendRange(legend.heizlast.join(",")) ?? legend.heizlast;
    const kuhllast = parseLegendRange(legend.kuhllast.join(",")) ?? legend.kuhllast;
    const luftung = parseLegendRange(legend.luftung.join(",")) ?? legend.luftung;
    const temperature =
      parseLegendRange(legend.temperature.join(",")) ?? legend.temperature;
    const coolingTemperature =
      parseLegendRange(legend.coolingTemperature.join(",")) ??
      legend.coolingTemperature;

    persistRange(HEIZLAST_RANGE_KEY, heizlast);
    persistRange(KUHLLAST_RANGE_KEY, kuhllast);
    persistRange(LUFTUNG_RANGE_KEY, luftung);
    persistRange(TEMP_RANGE_KEY, temperature);
    persistRange(COOL_TEMP_RANGE_KEY, coolingTemperature);

    const classic = buildThermalClassicLegendColors({
      heizlast,
      kuhllast,
      luftung,
      temperature,
    });
    const presetIds = { ...DEFAULT_THERMAL_CLASSIC_PRESET_IDS };
    persistCustomLegendColors(classic);
    persistLegendSwatchPresetIds(presetIds);
    set({
      heizlastRange: heizlast,
      kuhllastRange: kuhllast,
      luftungRange: luftung,
      temperatureRange: temperature,
      coolingTemperatureRange: coolingTemperature,
      customLegendColors: classic,
      legendSwatchPresetId: presetIds,
    });
  },
  setLegendStopColor: (mode, value, color) => {
    const key = String(value);
    set((s) => {
      const next: CustomLegendColors = {
        ...s.customLegendColors,
        [mode]: { ...s.customLegendColors[mode], [key]: color },
      };
      const nextIds = { ...s.legendSwatchPresetId, [mode]: null };
      persistCustomLegendColors(next);
      persistLegendSwatchPresetIds(nextIds);
      return {
        customLegendColors: next,
        legendSwatchPresetId: nextIds,
      };
    });
  },
  resetLegendColors: (mode) => {
    const s = get();
    const tempRange =
      s.dataViewMode === "kuhllast"
        ? s.coolingTemperatureRange
        : s.temperatureRange;
    const classic = buildThermalClassicLegendColors({
      heizlast: s.heizlastRange,
      kuhllast: s.kuhllastRange,
      luftung: s.luftungRange,
      temperature: tempRange,
    });
    set((state) => {
      const next: CustomLegendColors = {
        ...state.customLegendColors,
        [mode]: classic[mode],
      };
      const nextIds = {
        ...state.legendSwatchPresetId,
        [mode]: DEFAULT_LEGEND_SWATCH_PRESET_ID,
      };
      persistCustomLegendColors(next);
      persistLegendSwatchPresetIds(nextIds);
      return {
        customLegendColors: next,
        legendSwatchPresetId: nextIds,
      };
    });
  },
  applyLegendSwatchPreset: (mode, presetId) => {
    set((s) => {
      const range =
        mode === "temperature"
          ? s.dataViewMode === "kuhllast"
            ? s.coolingTemperatureRange
            : s.temperatureRange
          : mode === "kuhllast"
            ? s.kuhllastRange
            : mode === "luftung"
              ? s.luftungRange
              : s.heizlastRange;

      let overrides: CustomLegendColorMap;
      if (mode === "temperature") {
        const heatPreset = getLegendSwatchPreset(presetId);
        if (heatPreset) {
          overrides = mapAnchorColorsToRange(heatPreset.tempColors, range);
        } else {
          const preset = getTemperatureSwatchPreset(presetId);
          if (!preset) return s;
          if (presetId === "temp-standard") {
            overrides = standardTemperatureOverrides(range);
          } else {
            overrides = mapAnchorColorsToRange(preset.colors, range);
          }
        }
      } else {
        const preset = getLegendSwatchPreset(presetId);
        if (!preset) return s;
        const anchors = swatchColorsForMode(preset, mode);
        overrides =
          mode === "kuhllast"
            ? mapAnchorColorsToRange(anchors, range)
            : mapHeatAnchorColorsToRange(anchors, range);
      }
      const next: CustomLegendColors = {
        ...s.customLegendColors,
        [mode]: overrides,
      };
      const nextIds = { ...s.legendSwatchPresetId, [mode]: presetId };
      persistCustomLegendColors(next);
      persistLegendSwatchPresetIds(nextIds);
      return {
        customLegendColors: next,
        legendSwatchPresetId: nextIds,
      };
    });
  },
  setRenderMode: (mode) => set({ renderMode: mode }),
  setLighting: (partial) =>
    set((s) => ({
      lighting: {
        spaceTransparency: clamp01(
          partial.spaceTransparency ?? s.lighting.spaceTransparency,
        ),
        elementTransparency: clamp01(
          partial.elementTransparency ?? s.lighting.elementTransparency,
        ),
        color: clamp01(partial.color ?? s.lighting.color),
        shadow: clamp01(partial.shadow ?? s.lighting.shadow),
        indirectLight: clamp01(
          partial.indirectLight ?? s.lighting.indirectLight,
        ),
      },
    })),
  setSceneBackground: (value, options) => {
    const persist = options?.persist !== false;
    if (persist && typeof window !== "undefined") {
      try {
        localStorage.setItem(BG_KEY, value);
      } catch {
        // ignore
      }
    }
    set({ sceneBackground: value });
  },
  setAutoSceneBackground: (on) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(AUTO_BG_KEY, on ? "1" : "0");
      } catch {
        // ignore
      }
    }
    set({ autoSceneBackground: on });
    const s = get();
    if (on) {
      get().setSceneBackground(getModeSkyPreset(s.dataViewMode, s.colorTheme));
    } else {
      get().setSceneBackground(getDefaultSceneBackground(s.colorTheme));
    }
  },
  setAutoFocusSelection: (on) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(AUTO_FOCUS_KEY, on ? "1" : "0");
      } catch {
        // ignore
      }
    }
    set({ autoFocusSelection: on });
    if (!on) return;
    const s = get();
    if (s.dataViewMode === "luftung" && s.selectedVentilationZoneKey) {
      set((st) => ({
        ventilationZoneFocusToken: st.ventilationZoneFocusToken + 1,
      }));
    } else if (s.selectedRoomId) {
      get().requestRoomFocus(s.selectedRoomId);
    }
  },
  setPdfCaptureActive: (on) => set({ pdfCaptureActive: on }),
  setSliceProgress: (t) => set({ sliceProgress: clamp01(t) }),
  setPresentationView: (active) => {
    const s = get();
    if (active === s.isPresentationView) return;
    // Presentation and Werkzeug both own visibility — never run them together.
    if (active && s.toolMode) get().setToolMode(false);
    if (active) {
      const floorsWithRooms = listVisibleFloors(s.floors, s.rooms);
      const pool = floorsWithRooms.length ? floorsWithRooms : s.floors;
      const erd = pool.find((f) =>
        /erdgeschoss|\beg\b|ground\s*floor|egeschoss/i.test(f.name),
      );
      const defaultFloor = erd?.id ?? pool[0]?.id ?? null;
      set({
        isPresentationView: true,
        presentationLayoutMode: "stack",
        presentationPrevFloor: s.selectedFloor,
        selectedFloor: null,
        presentationFloorId: defaultFloor,
        presentationRoomsOpen: false,
        presentationIsolate: false,
        selectedRoomId: null,
        selectedElement: null,
        rightPanelOpen: true,
        sidebarOpen: true,
      });
    } else {
      set({
        isPresentationView: false,
        selectedFloor: s.presentationPrevFloor,
        presentationPrevFloor: null,
        presentationFloorId: null,
        presentationRoomsOpen: false,
        presentationIsolate: false,
        selectedRoomId: null,
        selectedElement: null,
      });
    }
  },
  setPresentationFloorId: (floorId) => {
    if (floorId === get().presentationFloorId) return;
    set({
      presentationFloorId: floorId,
      selectedRoomId: null,
      selectedElement: null,
    });
  },
  setPresentationRoomsOpen: (open) => {
    if (!open) {
      set({
        presentationRoomsOpen: false,
        selectedRoomId: null,
        selectedElement: null,
      });
    } else {
      set({ presentationRoomsOpen: true });
    }
  },
  setPresentationLayoutMode: (mode) => {
    if (mode === get().presentationLayoutMode) return;
    set({ presentationLayoutMode: mode });
  },
  setPresentationIsolate: (isolate) => {
    if (isolate === get().presentationIsolate) return;
    if (!isolate) {
      set({ presentationIsolate: false });
      return;
    }
    const s = get();
    const visible = listVisibleFloors(s.floors, s.rooms);
    const pool = visible.length ? visible : s.floors;
    const erd = pool.find((f) =>
      /erdgeschoss|\beg\b|ground\s*floor|egeschoss/i.test(f.name),
    );
    const floorId = erd?.id ?? pool[0]?.id ?? s.presentationFloorId;
    set({
      presentationIsolate: true,
      presentationFloorId: floorId,
      presentationRoomsOpen: false,
      selectedRoomId: null,
      selectedElement: null,
    });
  },
  setPresentationFloorIsolate: (floorId) => {
    if (!floorId) {
      set({ presentationIsolate: false });
      return;
    }
    set({
      presentationIsolate: true,
      presentationFloorId: floorId,
      presentationRoomsOpen: false,
      selectedRoomId: null,
      selectedElement: null,
    });
  },
  setViewerContextMenuOpen: (open) => set({ viewerContextMenuOpen: open }),
  setSelectedVentilationZoneKey: (key) =>
    set((s) => ({
      selectedVentilationZoneKey: key,
      selectedRoomId: null,
      selectedElement: null,
      // Camera fly only when Auto focus is on (same behavior as Heizlast/Cooling).
      ventilationZoneFocusToken:
        key && s.autoFocusSelection
          ? s.ventilationZoneFocusToken + 1
          : s.ventilationZoneFocusToken,
    })),
  requestRoomFocus: (roomId) =>
    set((s) => ({
      selectedRoomId: roomId,
      // Camera fly only when Autofocus is on — selection still updates either way.
      roomFocusToken: s.autoFocusSelection
        ? s.roomFocusToken + 1
        : s.roomFocusToken,
    })),
  setCompareBothModes: (on) => {
    if (on === get().compareBothModes) return;
    set({ compareBothModes: on });
  },
  beginSceneBusy: () => {
    if (get().isLoadingModel) return;
    sceneWorkDepth += 1;
    if (sceneWorkDepth !== 1 || sceneBusyShowTimer) return;
    sceneBusyShowTimer = setTimeout(() => {
      sceneBusyShowTimer = null;
      if (sceneWorkDepth > 0) {
        set({ sceneBusy: true, sceneBusySince: Date.now() });
      }
    }, SCENE_BUSY_SHOW_DELAY_MS);
  },
  endSceneBusy: () => {
    if (sceneWorkDepth <= 0) return;
    sceneWorkDepth -= 1;
    if (sceneWorkDepth > 0) return;
    if (sceneBusyShowTimer) {
      clearTimeout(sceneBusyShowTimer);
      sceneBusyShowTimer = null;
      return;
    }
    set({ sceneBusy: false, sceneBusySince: null });
  },
  showSceneBusyNow: () => {
    if (get().isLoadingModel) return;
    if (sceneBusyShowTimer) {
      clearTimeout(sceneBusyShowTimer);
      sceneBusyShowTimer = null;
    }
    if (sceneWorkDepth > 0) {
      set({ sceneBusy: true, sceneBusySince: Date.now() });
    }
  },
  setActiveFilter: (filter) => set({ activeFilter: filter }),
  setIsLoadingModel: (loading) => {
    if (loading) {
      sceneWorkDepth = 0;
      if (sceneBusyShowTimer) {
        clearTimeout(sceneBusyShowTimer);
        sceneBusyShowTimer = null;
      }
      set({ sceneBusy: false, sceneBusySince: null });
    }
    set({ isLoadingModel: loading });
  },
  setLoadError: (error) => set({ loadError: error }),
  setLoadProgress: (progress, message) =>
    set({
      loadProgress: progress,
      ...(message != null ? { loadMessage: message } : {}),
    }),

  setLeftPanelOpen: (open) => {
    persistPanel(LEFT_PANEL_KEY, open);
    set({ leftPanelOpen: open });
  },
  setRightPanelOpen: (open) => {
    persistPanel(RIGHT_PANEL_KEY, open);
    set({ rightPanelOpen: open, sidebarOpen: open });
  },
  toggleLeftPanel: () => get().setLeftPanelOpen(!get().leftPanelOpen),
  toggleRightPanel: () => get().setRightPanelOpen(!get().rightPanelOpen),

  setSidebarOpen: (open) => get().setRightPanelOpen(open),
  toggleSidebar: () => get().toggleRightPanel(),

  setHeaderExpanded: (expanded) => set({ headerExpanded: expanded }),
  setHeaderCollapsed: (collapsed) => set({ isHeaderCollapsed: collapsed }),
  toggleHeaderCollapsed: () =>
    set({ isHeaderCollapsed: !get().isHeaderCollapsed }),
  setUiLanguage: (lang) => set({ uiLanguage: lang }),
  setColorTheme: (theme) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch {
        // ignore
      }
    }
    set({ colorTheme: theme });
  },

  addSavedView: (name, position, target, opts) => {
    const {
      activeModelId,
      selectedFloor,
      savedViews,
      presentationFloorId,
      isPresentationView,
      presentationIsolate,
    } = get();
    if (!activeModelId) return;
    const view: SavedView = {
      id: `view-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      position,
      target,
      floorId: isPresentationView
        ? presentationIsolate
          ? presentationFloorId
          : null
        : selectedFloor,
      inPresentation: isPresentationView,
      presentationIsolate: isPresentationView ? presentationIsolate : false,
      pageFormat: opts?.pageFormat ?? "a4",
    };
    const next = [...savedViews, view];
    persistSavedViews(activeModelId, next);
    set({ savedViews: next });
  },

  goToSavedView: (id) => get().savedViews.find((v) => v.id === id),

  removeSavedView: (id) => {
    const { activeModelId, savedViews } = get();
    const next = savedViews.filter((v) => v.id !== id);
    if (activeModelId) persistSavedViews(activeModelId, next);
    set({ savedViews: next });
  },

  clearModelData: () =>
    set({
      floors: [],
      rooms: [],
      activeModelFileSizeBytes: null,
      selectedFloor: null,
      selectedRoomId: null,
      hoveredRoom: null,
      selectedElement: null,
      sliceProgress: 0.9,
      isPresentationView: false,
      presentationPrevFloor: null,
      presentationFloorId: null,
      presentationRoomsOpen: false,
      presentationIsolate: false,
      compareBothModes: false,
      activeFilter: null,
      hiddenElementIds: new Set<number>(),
      isolatedElementIds: null,
      toolSelectedExpressId: null,
    }),

  setToolMode: (on) => {
    if (on === get().toolMode) return;
    if (on) {
      const lighting = get().lighting;
      // Werkzeug inspects the whole model: no floor slice, no presentation,
      // no compare — those all fight the structure-tree visibility rules.
      set({
        toolMode: true,
        // Werkzeug shows the model itself, so use the shading mode that renders
        // IFC materials at full fidelity. The analysis mode comes back on exit.
        toolPrevRenderMode: get().renderMode,
        toolPrevSpaceTransparency: lighting.spaceTransparency,
        toolPrevElementTransparency: lighting.elementTransparency,
        renderMode: "realistic",
        lighting: {
          ...lighting,
          // Rooms ghosted; building elements fully opaque for inspection.
          spaceTransparency: 0.3,
          elementTransparency: 1,
        },
        isPresentationView: false,
        presentationPrevFloor: null,
        presentationFloorId: null,
        presentationIsolate: false,
        compareBothModes: false,
        selectedVentilationZoneKey: null,
        activeFilter: null,
        selectedRoomId: null,
        selectedElement: null,
        toolSelectedExpressId: null,
        rightPanelOpen: true,
        sidebarOpen: true,
      });
      return;
    }
    const prevSpace = get().toolPrevSpaceTransparency;
    const prevElement = get().toolPrevElementTransparency;
    set({
      toolMode: false,
      renderMode: get().toolPrevRenderMode ?? get().renderMode,
      toolPrevRenderMode: null,
      toolPrevSpaceTransparency: null,
      toolPrevElementTransparency: null,
      lighting: {
        ...get().lighting,
        spaceTransparency: prevSpace ?? 0.8,
        elementTransparency: prevElement ?? 0.8,
      },
      hiddenElementIds: new Set<number>(),
      isolatedElementIds: null,
      toolSelectedExpressId: null,
      selectedElement: null,
    });
  },

  setElementsVisible: (expressIds, visible) => {
    if (!expressIds.length) return;
    const next = new Set(get().hiddenElementIds);
    for (const id of expressIds) {
      if (visible) next.delete(id);
      else next.add(id);
    }
    set({ hiddenElementIds: next });
  },

  isolateElements: (expressIds) =>
    set({
      isolatedElementIds:
        expressIds && expressIds.length ? new Set(expressIds) : null,
    }),

  resetElementVisibility: () =>
    set({ hiddenElementIds: new Set<number>(), isolatedElementIds: null }),

  setToolSelectedExpressId: (expressId) =>
    set({ toolSelectedExpressId: expressId }),

  requestToolReveal: (expressId) =>
    set({
      toolSelectedExpressId: expressId,
      toolRevealToken: get().toolRevealToken + 1,
    }),
}));

/** Hydrate panel open state after mount (avoids SSR mismatch). */
export function hydratePanelState(): void {
  useAppStore.getState().setLeftPanelOpen(readBool(LEFT_PANEL_KEY, false));
  useAppStore.getState().setRightPanelOpen(readBool(RIGHT_PANEL_KEY, false));
}

export function useEffectiveColorPalette(): ColorPaletteId {
  return useAppStore((s) =>
    resolveColorPalette(s.colorTheme, s.activeColorPalette),
  );
}

export function useLegendColorOverrides(mode: LegendColorMode) {
  return useAppStore((s) => s.customLegendColors[mode]);
}
