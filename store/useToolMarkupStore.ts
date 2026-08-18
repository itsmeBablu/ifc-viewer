"use client";

import { create } from "zustand";
import {
  DEFAULT_MARKUP_COLOR,
  DEFAULT_SHAPE_SIZES,
  buildMarkupSavePackage,
  downloadMarkupPackage,
  newMarkupId,
  normalizeNote,
  normalizePlacement,
  pickRandomMarkupColor,
  type MarkupNote,
  type MarkupPlacement,
  type MarkupShapeType,
  type MarkupToolId,
  type MarkupTransformMode,
  type MarkupViewPreset,
} from "@/lib/toolMarkup";
import {
  idbDeleteNote,
  idbDeletePlacement,
  idbListNotes,
  idbListPlacements,
  idbPutNote,
  idbPutPlacement,
} from "@/lib/toolMarkupDb";
import {
  clearWerkzeugHistory,
  pushWerkzeugHistory,
} from "@/lib/werkzeugHistory";

type CubeDrawState = {
  start: { x: number; y: number; z: number };
  current: { x: number; y: number; z: number };
  /** After footprint locked: opposite corner used for W/D. */
  footprintEnd: { x: number; y: number; z: number } | null;
  phase: "footprint" | "height";
  height: number;
  /** Screen Y when height phase started (for Top-view height drag). */
  heightScreenY: number | null;
} | null;

export type MarkupMeasurement = {
  id: string;
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
};

type ToolMarkupState = {
  modelKey: string | null;
  armedTool: MarkupToolId | null;
  transformMode: MarkupTransformMode;
  snapToFaces: boolean;
  gridSnap: boolean;
  gridSize: number;
  /** Full CAD snap suite — all combinable, all default on */
  snapEndpoint: boolean;
  snapMidpoint: boolean;
  snapCenter: boolean;
  snapIntersection: boolean;
  snapPerpendicular: boolean;
  snapExtension: boolean;
  cubeDraw: CubeDrawState;
  markupFloorId: string | null;
  viewPreset: MarkupViewPreset;
  /** Bumped when viewPreset changes so Viewer3D can fly the camera. */
  viewPresetToken: number;
  /** 2×2 CAD quad view (Werkzeug). */
  quadView: boolean;
  /** Per-quadrant presets: TL, TR, BL, BR. */
  quadPresets: [
    MarkupViewPreset,
    MarkupViewPreset,
    MarkupViewPreset,
    MarkupViewPreset,
  ];
  /** Which quadrant receives orbit / top-bar view chips. */
  quadActiveIndex: 0 | 1 | 2 | 3;
  /** Single-view preset restored when leaving quad mode. */
  preQuadViewPreset: MarkupViewPreset;
  /** Bumped when a quadrant preset is posed/fitted. */
  quadPoseToken: number;
  placements: MarkupPlacement[];
  notes: MarkupNote[];
  selectedPlacementId: string | null;
  selectedNoteId: string | null;
  pendingNote: {
    posX: number;
    posY: number;
    posZ: number;
    expressId: number | null;
    placementId: string | null;
    wallId: string | null;
    doorId: string | null;
    windowId: string | null;
    underlayId: string | null;
    elementName: string | null;
    floorId: string | null;
  } | null;
  defaultColor: string;
  lastSavedAt: number | null;
  /** Bumped when measurements (or other non-timestamped content) change. */
  contentTouchedAt: number;
  notePlaceHint: string | null;
  dragSnapHint: {
    text: string;
    clientX?: number;
    clientY?: number;
  } | null;
  /** Lightweight cursor tooltip in Werkzeug (wall / door / shape / IFC). */
  sceneHoverTip: {
    text: string;
    clientX: number;
    clientY: number;
  } | null;
  /** Bumped to pin a note onto the current IFC/shape selection (Viewer resolves pose). */
  notePinToken: number;
  /** Tape-measure tool — click two points for a persistent dimension. */
  measureMode: boolean;
  measureDraft: { x: number; y: number; z: number } | null;
  measurements: MarkupMeasurement[];

  setArmedTool: (tool: MarkupToolId | null) => void;
  /** Bump so Viewer pins a notice on the current IFC/shape selection. */
  requestNotePin: () => void;
  setNotePlaceHint: (msg: string | null) => void;
  setDragSnapHint: (
    tip: {
      text: string;
      clientX?: number;
      clientY?: number;
    } | null,
  ) => void;
  setSceneHoverTip: (
    tip: { text: string; clientX: number; clientY: number } | null,
  ) => void;
  setMeasureMode: (on: boolean) => void;
  addMeasurePoint: (pos: { x: number; y: number; z: number }) => void;
  clearMeasurements: () => void;
  clearMeasureDraft: () => void;

  setTransformMode: (mode: MarkupTransformMode) => void;
  setSnapToFaces: (on: boolean) => void;
  setGridSnap: (on: boolean) => void;
  setSnapEndpoint: (on: boolean) => void;
  setSnapMidpoint: (on: boolean) => void;
  setSnapCenter: (on: boolean) => void;
  setSnapIntersection: (on: boolean) => void;
  setSnapPerpendicular: (on: boolean) => void;
  setSnapExtension: (on: boolean) => void;
  setCubeDraw: (draw: CubeDrawState) => void;
  setMarkupFloorId: (floorId: string | null) => void;
  setViewPreset: (preset: MarkupViewPreset) => void;
  setQuadView: (on: boolean) => void;
  setQuadActiveIndex: (index: 0 | 1 | 2 | 3) => void;
  setQuadPreset: (index: 0 | 1 | 2 | 3, preset: MarkupViewPreset) => void;
  bumpQuadPoseToken: () => void;
  setDefaultColor: (color: string) => void;
  loadForModel: (modelKey: string | null) => Promise<void>;
  placeShape: (
    type: MarkupShapeType,
    pos: { x: number; y: number; z: number },
    meta?: {
      floorId?: string | null;
      rot?: { x: number; y: number; z: number };
      sizeX?: number;
      sizeY?: number;
      sizeZ?: number;
      color?: string;
      label?: string | null;
    },
  ) => Promise<MarkupPlacement | null>;
  duplicatePlacement: (id: string) => Promise<MarkupPlacement | null>;
  updatePlacement: (
    id: string,
    patch: Partial<
      Pick<
        MarkupPlacement,
        | "posX"
        | "posY"
        | "posZ"
        | "rotX"
        | "rotY"
        | "rotZ"
        | "sizeX"
        | "sizeY"
        | "sizeZ"
        | "color"
        | "label"
        | "floorId"
      >
    >,
  ) => Promise<void>;
  deletePlacement: (id: string) => Promise<void>;
  selectPlacement: (id: string | null) => void;
  beginNoteAt: (
    pos: { x: number; y: number; z: number },
    meta?: {
      expressId?: number | null;
      placementId?: string | null;
      wallId?: string | null;
      doorId?: string | null;
      windowId?: string | null;
      underlayId?: string | null;
      elementName?: string | null;
      floorId?: string | null;
    },
  ) => void;
  cancelPendingNote: () => void;
  commitPendingNote: (text: string, author?: string | null) => Promise<void>;
  updateNote: (
    id: string,
    patch: Partial<
      Pick<
        MarkupNote,
        | "text"
        | "author"
        | "posX"
        | "posY"
        | "posZ"
        | "expressId"
        | "placementId"
        | "wallId"
        | "doorId"
        | "windowId"
        | "underlayId"
        | "elementName"
        | "floorId"
      >
    >,
  ) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  selectNote: (id: string | null) => void;
  clearSelection: () => void;
  saveMarkupFile: (modelLabel?: string | null) => boolean;
  markSaved: () => void;
};

export const useToolMarkupStore = create<ToolMarkupState>((set, get) => ({
  modelKey: null,
  armedTool: null,
  transformMode: "translate",
  snapToFaces: false,
  gridSnap: false,
  gridSize: 0.1,
  // Full CAD snap suite
  snapEndpoint: true,
  snapMidpoint: true,
  snapCenter: true,
  snapIntersection: true,
  snapPerpendicular: true,
  snapExtension: true,
  cubeDraw: null,
  markupFloorId: null,
  viewPreset: "free",
  viewPresetToken: 0,
  quadView: false,
  quadPresets: ["top", "free", "north", "east"],
  quadActiveIndex: 0,
  preQuadViewPreset: "free",
  quadPoseToken: 0,
  placements: [],
  notes: [],
  selectedPlacementId: null,
  selectedNoteId: null,
  pendingNote: null,
  defaultColor: DEFAULT_MARKUP_COLOR,
  lastSavedAt: null,
  contentTouchedAt: 0,
  notePlaceHint: null,
  dragSnapHint: null,
  sceneHoverTip: null,
  notePinToken: 0,
  measureMode: false,
  measureDraft: null,
  measurements: [],

  setNotePlaceHint: (msg) => set({ notePlaceHint: msg }),
  setDragSnapHint: (msg) => set({ dragSnapHint: msg }),
  setSceneHoverTip: (tip) => set({ sceneHoverTip: tip }),

  requestNotePin: () =>
    set((s) => ({
      notePinToken: s.notePinToken + 1,
      armedTool: null,
      pendingNote: null,
      notePlaceHint: null,
      measureMode: false,
      measureDraft: null,
    })),

  setArmedTool: (tool) =>
    set({
      armedTool: tool,
      pendingNote: null,
      notePlaceHint: tool === "note" ? "markupNotePinHint" : null,
      selectedPlacementId: tool ? null : get().selectedPlacementId,
      selectedNoteId: tool ? null : get().selectedNoteId,
      measureMode: tool ? false : get().measureMode,
      measureDraft: tool ? null : get().measureDraft,
    }),

  setMeasureMode: (on) => {
    if (on) {
      set({
        measureMode: true,
        measureDraft: null,
        armedTool: null,
        cubeDraw: null,
        pendingNote: null,
        notePlaceHint: null,
      });
      return;
    }
    set({ measureMode: false, measureDraft: null });
  },

  addMeasurePoint: (pos) => {
    const draft = get().measureDraft;
    if (!draft) {
      set({ measureDraft: { x: pos.x, y: pos.y, z: pos.z } });
      return;
    }
    const m: MarkupMeasurement = {
      id: newMarkupId("meas"),
      ax: draft.x,
      ay: draft.y,
      az: draft.z,
      bx: pos.x,
      by: pos.y,
      bz: pos.z,
    };
    set((s) => ({
      measurements: [...s.measurements, m],
      measureDraft: null,
      contentTouchedAt: Date.now(),
    }));
  },

  clearMeasurements: () => {
    pushWerkzeugHistory();
    set({
      measurements: [],
      measureDraft: null,
      contentTouchedAt: Date.now(),
    });
  },
  clearMeasureDraft: () => set({ measureDraft: null }),

  setTransformMode: (mode) => set({ transformMode: mode }),

  setSnapToFaces: (on) => set({ snapToFaces: on }),
  setGridSnap: (on) => set({ gridSnap: on }),
  setSnapEndpoint: (on) => set({ snapEndpoint: on }),
  setSnapMidpoint: (on) => set({ snapMidpoint: on }),
  setSnapCenter: (on) => set({ snapCenter: on }),
  setSnapIntersection: (on) => set({ snapIntersection: on }),
  setSnapPerpendicular: (on) => set({ snapPerpendicular: on }),
  setSnapExtension: (on) => set({ snapExtension: on }),
  setCubeDraw: (draw) => set({ cubeDraw: draw }),

  setMarkupFloorId: (floorId) => set({ markupFloorId: floorId }),

  setViewPreset: (preset) =>
    set((s) => {
      if (s.quadView) {
        const next = [...s.quadPresets] as typeof s.quadPresets;
        next[s.quadActiveIndex] = preset;
        return {
          viewPreset: preset,
          viewPresetToken: s.viewPresetToken + 1,
          quadPresets: next,
          quadPoseToken: s.quadPoseToken + 1,
        };
      }
      return {
        viewPreset: preset,
        viewPresetToken: s.viewPresetToken + 1,
      };
    }),

  setQuadView: (on) =>
    set((s) => {
      if (on === s.quadView) return s;
      if (on) {
        return {
          quadView: true,
          preQuadViewPreset: s.viewPreset,
          quadActiveIndex: 0,
          viewPreset: s.quadPresets[0],
          viewPresetToken: s.viewPresetToken + 1,
          quadPoseToken: s.quadPoseToken + 1,
        };
      }
      return {
        quadView: false,
        viewPreset: s.preQuadViewPreset,
        viewPresetToken: s.viewPresetToken + 1,
      };
    }),

  setQuadActiveIndex: (index) =>
    set((s) => ({
      quadActiveIndex: index,
      viewPreset: s.quadPresets[index],
    })),

  setQuadPreset: (index, preset) =>
    set((s) => {
      const next = [...s.quadPresets] as typeof s.quadPresets;
      next[index] = preset;
      return {
        quadPresets: next,
        viewPreset: index === s.quadActiveIndex ? preset : s.viewPreset,
        viewPresetToken: s.viewPresetToken + 1,
        quadPoseToken: s.quadPoseToken + 1,
      };
    }),

  bumpQuadPoseToken: () =>
    set((s) => ({ quadPoseToken: s.quadPoseToken + 1 })),

  setDefaultColor: (color) => set({ defaultColor: color }),

  loadForModel: async (modelKey) => {
    clearWerkzeugHistory();
    if (!modelKey) {
      set({
        modelKey: null,
        placements: [],
        notes: [],
        selectedPlacementId: null,
        selectedNoteId: null,
        pendingNote: null,
        armedTool: null,
        markupFloorId: null,
        measureMode: false,
        measureDraft: null,
        measurements: [],
      });
      return;
    }
    try {
      const [rawPlacements, rawNotes] = await Promise.all([
        idbListPlacements(modelKey),
        idbListNotes(modelKey),
      ]);
      set({
        modelKey,
        placements: rawPlacements.map((p) => normalizePlacement(p)),
        notes: rawNotes.map((n) => normalizeNote(n)),
        selectedPlacementId: null,
        selectedNoteId: null,
        pendingNote: null,
        armedTool: null,
        markupFloorId: null,
        measureMode: false,
        measureDraft: null,
        measurements: [],
      });
    } catch {
      set({
        modelKey,
        placements: [],
        notes: [],
        selectedPlacementId: null,
        selectedNoteId: null,
        pendingNote: null,
        armedTool: null,
        markupFloorId: null,
        measureMode: false,
        measureDraft: null,
        measurements: [],
      });
    }
  },

  placeShape: async (type, pos, meta) => {
    pushWerkzeugHistory();
    const modelKey = get().modelKey;
    if (!modelKey) return null;
    const sizes = DEFAULT_SHAPE_SIZES[type];
    const now = Date.now();
    const placement: MarkupPlacement = {
      id: newMarkupId("pl"),
      modelKey,
      type,
      posX: pos.x,
      posY: pos.y,
      posZ: pos.z,
      rotX: meta?.rot?.x ?? 0,
      rotY: meta?.rot?.y ?? 0,
      rotZ: meta?.rot?.z ?? 0,
      sizeX: meta?.sizeX ?? sizes.sizeX,
      sizeY: meta?.sizeY ?? sizes.sizeY,
      sizeZ: meta?.sizeZ ?? sizes.sizeZ,
      color: meta?.color ?? pickRandomMarkupColor(),
      label: meta?.label ?? null,
      floorId: meta?.floorId ?? get().markupFloorId,
      createdAt: now,
      updatedAt: now,
    };
    await idbPutPlacement(placement);
    const keepArmed = Boolean(get().armedTool);
    set((s) => ({
      placements: [...s.placements, placement],
      // Continuous placement: stay armed and don't steal focus to the gizmo.
      selectedPlacementId: keepArmed ? null : placement.id,
      selectedNoteId: null,
      armedTool: keepArmed ? s.armedTool : null,
    }));
    return placement;
  },

  duplicatePlacement: async (id) => {
    pushWerkzeugHistory();
    const src = get().placements.find((p) => p.id === id);
    if (!src) return null;
    return get().placeShape(
      src.type,
      { x: src.posX + 0.4, y: src.posY, z: src.posZ + 0.4 },
      {
        floorId: src.floorId,
        rot: { x: src.rotX, y: src.rotY, z: src.rotZ },
        sizeX: src.sizeX,
        sizeY: src.sizeY,
        sizeZ: src.sizeZ,
        color: src.color,
        label: src.label,
      },
    );
  },

  updatePlacement: async (id, patch) => {
    const current = get().placements.find((p) => p.id === id);
    if (!current) return;
    pushWerkzeugHistory();
    const next: MarkupPlacement = {
      ...current,
      ...patch,
      updatedAt: Date.now(),
    };
    await idbPutPlacement(next);
    const moved =
      patch.posX != null || patch.posY != null || patch.posZ != null;
    let notes = get().notes;
    if (moved) {
      const dx = next.posX - current.posX;
      const dy = next.posY - current.posY;
      const dz = next.posZ - current.posZ;
      const attached = notes.filter((n) => n.placementId === id);
      if (attached.length) {
        const updatedNotes = await Promise.all(
          attached.map(async (n) => {
            const nn = {
              ...n,
              posX: n.posX + dx,
              posY: n.posY + dy,
              posZ: n.posZ + dz,
              updatedAt: Date.now(),
            };
            await idbPutNote(nn);
            return nn;
          }),
        );
        const byId = new Map(updatedNotes.map((n) => [n.id, n]));
        notes = notes.map((n) => byId.get(n.id) ?? n);
      }
    }
    set((s) => ({
      placements: s.placements.map((p) => (p.id === id ? next : p)),
      notes,
    }));
  },

  deletePlacement: async (id) => {
    pushWerkzeugHistory();
    await idbDeletePlacement(id);
    set((s) => ({
      placements: s.placements.filter((p) => p.id !== id),
      selectedPlacementId:
        s.selectedPlacementId === id ? null : s.selectedPlacementId,
    }));
  },

  selectPlacement: (id) =>
    set({
      selectedPlacementId: id,
      selectedNoteId: null,
      armedTool: null,
      pendingNote: null,
    }),

  beginNoteAt: (pos, meta) => {
    const expressId = meta?.expressId ?? null;
    const placementId = meta?.placementId ?? null;
    const wallId = meta?.wallId ?? null;
    const doorId = meta?.doorId ?? null;
    const windowId = meta?.windowId ?? null;
    const underlayId = meta?.underlayId ?? null;
    if (
      expressId == null &&
      !placementId &&
      !wallId &&
      !doorId &&
      !windowId &&
      !underlayId
    ) {
      set({ notePlaceHint: "markupNoteMustAttach" });
      return;
    }
    set({
      pendingNote: {
        posX: pos.x,
        posY: pos.y,
        posZ: pos.z,
        expressId,
        placementId,
        wallId,
        doorId,
        windowId,
        underlayId,
        elementName: meta?.elementName ?? null,
        floorId: meta?.floorId ?? get().markupFloorId,
      },
      armedTool: null,
      selectedPlacementId: null,
      selectedNoteId: null,
      notePlaceHint: null,
    });
  },

  cancelPendingNote: () => set({ pendingNote: null }),

  commitPendingNote: async (text, author = null) => {
    const modelKey = get().modelKey;
    const pending = get().pendingNote;
    if (!modelKey || !pending) return;
    const trimmed = text.trim();
    if (!trimmed) {
      set({ pendingNote: null });
      return;
    }
    if (
      pending.expressId == null &&
      !pending.placementId &&
      !pending.wallId &&
      !pending.doorId &&
      !pending.windowId &&
      !pending.underlayId
    ) {
      set({ pendingNote: null });
      return;
    }
    pushWerkzeugHistory();
    const now = Date.now();
    const note: MarkupNote = {
      id: newMarkupId("note"),
      modelKey,
      posX: pending.posX,
      posY: pending.posY,
      posZ: pending.posZ,
      text: trimmed,
      author,
      expressId: pending.expressId,
      placementId: pending.placementId,
      wallId: pending.wallId,
      doorId: pending.doorId,
      windowId: pending.windowId,
      underlayId: pending.underlayId,
      elementName: pending.elementName,
      floorId: pending.floorId,
      createdAt: now,
      updatedAt: now,
    };
    await idbPutNote(note);
    set((s) => ({
      notes: [...s.notes, note],
      pendingNote: null,
      selectedNoteId: note.id,
    }));
  },

  updateNote: async (id, patch) => {
    pushWerkzeugHistory();
    const current = get().notes.find((n) => n.id === id);
    if (!current) return;
    const next: MarkupNote = {
      ...current,
      ...patch,
      updatedAt: Date.now(),
    };
    await idbPutNote(next);
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? next : n)),
    }));
  },

  deleteNote: async (id) => {
    pushWerkzeugHistory();
    await idbDeleteNote(id);
    set((s) => ({
      notes: s.notes.filter((n) => n.id !== id),
      selectedNoteId: s.selectedNoteId === id ? null : s.selectedNoteId,
    }));
  },

  selectNote: (id) =>
    set({
      selectedNoteId: id,
      selectedPlacementId: null,
      armedTool: null,
      pendingNote: null,
    }),

  clearSelection: () =>
    set({
      selectedPlacementId: null,
      selectedNoteId: null,
      pendingNote: null,
    }),

  saveMarkupFile: (modelLabel = null) => {
    const { modelKey, placements, notes } = get();
    if (!modelKey) return false;
    const pkg = buildMarkupSavePackage({
      modelKey,
      modelLabel,
      placements,
      notes,
    });
    downloadMarkupPackage(pkg);
    set({ lastSavedAt: Date.now(), contentTouchedAt: Date.now() });
    return true;
  },

  markSaved: () =>
    set({ lastSavedAt: Date.now(), contentTouchedAt: Date.now() }),
}));
