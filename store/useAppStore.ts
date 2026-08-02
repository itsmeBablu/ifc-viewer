"use client";

import { create } from "zustand";
import type { ColorPaletteId } from "@/lib/colorMapping";
import {
  EMPTY_CUSTOM_LEGEND_COLORS,
  mapAnchorColorsToRange,
  resolveColorPalette,
  standardTemperatureOverrides,
  type CustomLegendColors,
  type CustomLegendColorMap,
  type LegendColorMode,
} from "@/lib/colorMapping";
import {
  getLegendSwatchPreset,
  getTemperatureSwatchPreset,
  LEGEND_SWATCH_PRESETS,
  LEGEND_TEMPERATURE_SWATCH_PRESETS,
  swatchColorsForMode,
  type LegendSwatchPreset,
  type TemperatureSwatchPreset,
} from "@/lib/legendSwatchPresets";
import {
  DEFAULT_HEIZLAST_RANGE,
  DEFAULT_KUHLLAST_RANGE,
  DEFAULT_TEMPERATURE_RANGE,
  parseLegendRange,
} from "@/lib/colorMapping";
import { listVisibleFloors } from "@/lib/floorFilter";
import type { DataViewMode } from "@/lib/dataViewMode";
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
const THEME_KEY = "ifc-viewer:colorTheme";
const HEIZLAST_RANGE_KEY = "ifc-viewer:heizlastRange";
const KUHLLAST_RANGE_KEY = "ifc-viewer:kuhllastRange";
const TEMP_RANGE_KEY = "ifc-viewer:temperatureRange";
const CUSTOM_LEGEND_COLORS_KEY = "ifc-viewer:customLegendColors";
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
  colorMode: ColorMode;
  /** Heating / ventilation / cooling — synced between header and legend. */
  dataViewMode: DataViewMode;
  activeColorPalette: ColorPaletteId;
  /** Legend Heizlast stop values (6–8). */
  heizlastRange: number[];
  /** Legend Kühllast stop values (6–8). */
  kuhllastRange: number[];
  /** Legend temperature stop values (6–8). */
  temperatureRange: number[];
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
  /** Selected Nutzungszone in Lüftung view (zoneNumber::zoneName). */
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
  setColorMode: (mode: ColorMode) => void;
  setDataViewMode: (mode: DataViewMode) => void;
  setActiveColorPalette: (id: ColorPaletteId) => void;
  setHeizlastRange: (values: number[]) => void;
  setKuhllastRange: (values: number[]) => void;
  setTemperatureRange: (values: number[]) => void;
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

function initialCustomLegendColors(): CustomLegendColors {
  if (typeof window === "undefined") return { ...EMPTY_CUSTOM_LEGEND_COLORS };
  try {
    const raw = localStorage.getItem(CUSTOM_LEGEND_COLORS_KEY);
    if (!raw) return { ...EMPTY_CUSTOM_LEGEND_COLORS };
    const parsed = JSON.parse(raw) as Partial<CustomLegendColors>;
    return {
      temperature: parsed.temperature ?? {},
      heizlast: parsed.heizlast ?? {},
      kuhllast: parsed.kuhllast ?? {},
    };
  } catch {
    return { ...EMPTY_CUSTOM_LEGEND_COLORS };
  }
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
  colorMode: "heizlast",
  dataViewMode: "heizlast",
  activeColorPalette: initialPalette(),
  heizlastRange: initialRange(HEIZLAST_RANGE_KEY, DEFAULT_HEIZLAST_RANGE),
  kuhllastRange: initialRange(KUHLLAST_RANGE_KEY, DEFAULT_KUHLLAST_RANGE),
  temperatureRange: initialRange(TEMP_RANGE_KEY, DEFAULT_TEMPERATURE_RANGE),
  customLegendColors: initialCustomLegendColors(),
  legendSwatchPresetId: {
    temperature: null,
    heizlast: null,
    kuhllast: null,
  },
  renderMode: "fullColor",
  lighting: {
    spaceTransparency: 0.75,
    elementTransparency: 0.5,
    color: 1,
    shadow: 0.55,
    indirectLight: 0.45,
  },
  sceneBackground: initialBackground(),
  autoSceneBackground: initialAutoSceneBackground(),
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

  setActiveModelId: (id, label, fileSizeBytes) => {
    set({
      activeModelId: id,
      activeModelLabel: label ?? null,
      activeModelFileSizeBytes: fileSizeBytes ?? null,
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
  setColorMode: (mode) => {
    if (mode === get().colorMode) return;
    set({ colorMode: mode });
  },
  setDataViewMode: (mode) => {
    if (mode === get().dataViewMode) return;
    set({
      dataViewMode: mode,
      ...(mode !== "luftung" ? { selectedVentilationZoneKey: null } : {}),
    });
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
    set({ activeColorPalette: palette, customLegendColors: { ...EMPTY_CUSTOM_LEGEND_COLORS }, legendSwatchPresetId: { temperature: null, heizlast: null, kuhllast: null } });
    persistCustomLegendColors({ ...EMPTY_CUSTOM_LEGEND_COLORS });
  },
  setHeizlastRange: (values) => {
    const parsed = parseLegendRange(values.join(","));
    if (!parsed) return;
    persistRange(HEIZLAST_RANGE_KEY, parsed);
    set({ heizlastRange: parsed });
  },
  setKuhllastRange: (values) => {
    const parsed = parseLegendRange(values.join(","));
    if (!parsed) return;
    persistRange(KUHLLAST_RANGE_KEY, parsed);
    set({ kuhllastRange: parsed });
  },
  setTemperatureRange: (values) => {
    const parsed = parseLegendRange(values.join(","));
    if (!parsed) return;
    persistRange(TEMP_RANGE_KEY, parsed);
    set({ temperatureRange: parsed });
  },
  setLegendStopColor: (mode, value, color) => {
    const key = String(value);
    set((s) => {
      const next: CustomLegendColors = {
        ...s.customLegendColors,
        [mode]: { ...s.customLegendColors[mode], [key]: color },
      };
      persistCustomLegendColors(next);
      return {
        customLegendColors: next,
        legendSwatchPresetId: { ...s.legendSwatchPresetId, [mode]: null },
      };
    });
  },
  resetLegendColors: (mode) => {
    set((s) => {
      const next: CustomLegendColors = {
        ...s.customLegendColors,
        [mode]: {},
      };
      persistCustomLegendColors(next);
      return {
        customLegendColors: next,
        legendSwatchPresetId: { ...s.legendSwatchPresetId, [mode]: null },
      };
    });
  },
  applyLegendSwatchPreset: (mode, presetId) => {
    set((s) => {
      const range =
        mode === "temperature"
          ? s.temperatureRange
          : mode === "kuhllast"
            ? s.kuhllastRange
            : s.heizlastRange;

      let overrides: CustomLegendColorMap;
      if (mode === "temperature") {
        const preset = getTemperatureSwatchPreset(presetId);
        if (!preset) return s;
        if (presetId === "temp-standard") {
          overrides = standardTemperatureOverrides(range);
        } else {
          overrides = mapAnchorColorsToRange(preset.colors, range);
        }
      } else {
        const preset = getLegendSwatchPreset(presetId);
        if (!preset) return s;
        overrides = mapAnchorColorsToRange(
          swatchColorsForMode(preset, mode),
          range,
        );
      }
      const next: CustomLegendColors = {
        ...s.customLegendColors,
        [mode]: overrides,
      };
      persistCustomLegendColors(next);
      return {
        customLegendColors: next,
        legendSwatchPresetId: { ...s.legendSwatchPresetId, [mode]: presetId },
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
  setSliceProgress: (t) => set({ sliceProgress: clamp01(t) }),
  setPresentationView: (active) => {
    const s = get();
    if (active === s.isPresentationView) return;
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
      ventilationZoneFocusToken: key ? s.ventilationZoneFocusToken + 1 : s.ventilationZoneFocusToken,
    })),
  requestRoomFocus: (roomId) =>
    set((s) => ({
      selectedRoomId: roomId,
      roomFocusToken: s.roomFocusToken + 1,
    })),
  setCompareBothModes: (on) => {
    if (on === get().compareBothModes) return;
    set({ compareBothModes: on });
  },
  beginSceneBusy: () => {
    if (get().isLoadingModel) return;
    sceneWorkDepth += 1;
    if (sceneWorkDepth === 1) {
      set({ sceneBusy: true, sceneBusySince: Date.now() });
    }
  },
  endSceneBusy: () => {
    if (sceneWorkDepth <= 0) return;
    sceneWorkDepth -= 1;
    if (sceneWorkDepth > 0) return;
    set({ sceneBusy: false, sceneBusySince: null });
  },
  setActiveFilter: (filter) => set({ activeFilter: filter }),
  setIsLoadingModel: (loading) => {
    if (loading) {
      sceneWorkDepth = 0;
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
