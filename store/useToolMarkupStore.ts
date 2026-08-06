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

type CubeDrawState = {
  start: { x: number; y: number; z: number };
  current: { x: number; y: number; z: number };
  phase: "footprint" | "height";
  height: number;
} | null;

type ToolMarkupState = {
  modelKey: string | null;
  armedTool: MarkupToolId | null;
  transformMode: MarkupTransformMode;
  snapToFaces: boolean;
  gridSnap: boolean;
  gridSize: number;
  cubeDraw: CubeDrawState;
  markupFloorId: string | null;
  viewPreset: MarkupViewPreset;
  /** Bumped when viewPreset changes so Viewer3D can fly the camera. */
  viewPresetToken: number;
  placements: MarkupPlacement[];
  notes: MarkupNote[];
  selectedPlacementId: string | null;
  selectedNoteId: string | null;
  pendingNote: {
    posX: number;
    posY: number;
    posZ: number;
    expressId: number | null;
    elementName: string | null;
    floorId: string | null;
  } | null;
  defaultColor: string;
  lastSavedAt: number | null;

  setArmedTool: (tool: MarkupToolId | null) => void;
  setTransformMode: (mode: MarkupTransformMode) => void;
  setSnapToFaces: (on: boolean) => void;
  setGridSnap: (on: boolean) => void;
  setCubeDraw: (draw: CubeDrawState) => void;
  setMarkupFloorId: (floorId: string | null) => void;
  setViewPreset: (preset: MarkupViewPreset) => void;
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
    },
  ) => Promise<MarkupPlacement | null>;
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
  snapToFaces: true,
  gridSnap: false,
  gridSize: 0.1,
  cubeDraw: null,
  markupFloorId: null,
  viewPreset: "free",
  viewPresetToken: 0,
  placements: [],
  notes: [],
  selectedPlacementId: null,
  selectedNoteId: null,
  pendingNote: null,
  defaultColor: DEFAULT_MARKUP_COLOR,
  lastSavedAt: null,

  setArmedTool: (tool) =>
    set({
      armedTool: tool,
      pendingNote: null,
      selectedPlacementId: tool ? null : get().selectedPlacementId,
      selectedNoteId: tool ? null : get().selectedNoteId,
    }),

  setTransformMode: (mode) => set({ transformMode: mode }),

  setSnapToFaces: (on) => set({ snapToFaces: on }),
  setGridSnap: (on) => set({ gridSnap: on }),
  setCubeDraw: (draw) => set({ cubeDraw: draw }),

  setMarkupFloorId: (floorId) => set({ markupFloorId: floorId }),

  setViewPreset: (preset) =>
    set((s) => ({
      viewPreset: preset,
      viewPresetToken: s.viewPresetToken + 1,
    })),

  setDefaultColor: (color) => set({ defaultColor: color }),

  loadForModel: async (modelKey) => {
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
      });
    }
  },

  placeShape: async (type, pos, meta) => {
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
      color: get().defaultColor,
      label: null,
      floorId: meta?.floorId ?? get().markupFloorId,
      createdAt: now,
      updatedAt: now,
    };
    await idbPutPlacement(placement);
    set((s) => ({
      placements: [...s.placements, placement],
      selectedPlacementId: placement.id,
      selectedNoteId: null,
      armedTool: null,
    }));
    return placement;
  },

  updatePlacement: async (id, patch) => {
    const current = get().placements.find((p) => p.id === id);
    if (!current) return;
    const next: MarkupPlacement = {
      ...current,
      ...patch,
      updatedAt: Date.now(),
    };
    await idbPutPlacement(next);
    set((s) => ({
      placements: s.placements.map((p) => (p.id === id ? next : p)),
    }));
  },

  deletePlacement: async (id) => {
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

  beginNoteAt: (pos, meta) =>
    set({
      pendingNote: {
        posX: pos.x,
        posY: pos.y,
        posZ: pos.z,
        expressId: meta?.expressId ?? null,
        elementName: meta?.elementName ?? null,
        floorId: meta?.floorId ?? get().markupFloorId,
      },
      armedTool: null,
      selectedPlacementId: null,
      selectedNoteId: null,
    }),

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
    set({ lastSavedAt: Date.now() });
    return true;
  },

  markSaved: () => set({ lastSavedAt: Date.now() }),
}));
