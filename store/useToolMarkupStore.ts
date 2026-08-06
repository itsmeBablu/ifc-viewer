"use client";

import { create } from "zustand";
import {
  DEFAULT_MARKUP_COLOR,
  DEFAULT_SHAPE_SIZES,
  newMarkupId,
  type MarkupNote,
  type MarkupPlacement,
  type MarkupShapeType,
  type MarkupToolId,
} from "@/lib/toolMarkup";
import {
  idbDeleteNote,
  idbDeletePlacement,
  idbListNotes,
  idbListPlacements,
  idbPutNote,
  idbPutPlacement,
} from "@/lib/toolMarkupDb";

type ToolMarkupState = {
  modelKey: string | null;
  armedTool: MarkupToolId | null;
  placements: MarkupPlacement[];
  notes: MarkupNote[];
  selectedPlacementId: string | null;
  selectedNoteId: string | null;
  /** Draft text when placing a note after a 3D click. */
  pendingNote: { posX: number; posY: number; posZ: number } | null;
  defaultColor: string;

  setArmedTool: (tool: MarkupToolId | null) => void;
  setDefaultColor: (color: string) => void;
  loadForModel: (modelKey: string | null) => Promise<void>;
  placeShape: (
    type: MarkupShapeType,
    pos: { x: number; y: number; z: number },
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
      >
    >,
  ) => Promise<void>;
  deletePlacement: (id: string) => Promise<void>;
  selectPlacement: (id: string | null) => void;
  beginNoteAt: (pos: { x: number; y: number; z: number }) => void;
  cancelPendingNote: () => void;
  commitPendingNote: (text: string, author?: string | null) => Promise<void>;
  updateNote: (
    id: string,
    patch: Partial<Pick<MarkupNote, "text" | "author" | "posX" | "posY" | "posZ">>,
  ) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  selectNote: (id: string | null) => void;
  clearSelection: () => void;
};

export const useToolMarkupStore = create<ToolMarkupState>((set, get) => ({
  modelKey: null,
  armedTool: null,
  placements: [],
  notes: [],
  selectedPlacementId: null,
  selectedNoteId: null,
  pendingNote: null,
  defaultColor: DEFAULT_MARKUP_COLOR,

  setArmedTool: (tool) =>
    set({
      armedTool: tool,
      pendingNote: null,
      selectedPlacementId: tool ? null : get().selectedPlacementId,
      selectedNoteId: tool ? null : get().selectedNoteId,
    }),

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
      });
      return;
    }
    try {
      const [placements, notes] = await Promise.all([
        idbListPlacements(modelKey),
        idbListNotes(modelKey),
      ]);
      set({
        modelKey,
        placements,
        notes,
        selectedPlacementId: null,
        selectedNoteId: null,
        pendingNote: null,
        armedTool: null,
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
      });
    }
  },

  placeShape: async (type, pos) => {
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
      rotX: 0,
      rotY: 0,
      rotZ: 0,
      sizeX: sizes.sizeX,
      sizeY: sizes.sizeY,
      sizeZ: sizes.sizeZ,
      color: get().defaultColor,
      label: null,
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

  beginNoteAt: (pos) =>
    set({
      pendingNote: { posX: pos.x, posY: pos.y, posZ: pos.z },
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
}));
