"use client";

import { create } from "zustand";

export interface ViewVisibility {
  hiddenCategories: string[];
  hiddenIds: string[];
  isolatedIds: string[] | null;
}
export const EMPTY_VIEW_VISIBILITY: ViewVisibility = { hiddenCategories: [], hiddenIds: [], isolatedIds: null };

/** View filters are separate from the model and never delete building elements. */
export const useViewDisplayStore = create<{
  views: Record<string, ViewVisibility>;
  renderPreview: boolean;
  setRenderPreview: (on: boolean) => void;
  toggleCategory: (view: string, category: string) => void;
  hide: (view: string, ids: string[]) => void;
  isolate: (view: string, ids: string[]) => void;
  reset: (view: string) => void;
}>((set) => ({
  views: {},
  renderPreview: false,
  setRenderPreview: (renderPreview) => set({ renderPreview }),
  toggleCategory: (view, category) => set(s => {
    const current = s.views[view] ?? EMPTY_VIEW_VISIBILITY;
    const hiddenCategories = current.hiddenCategories.includes(category)
      ? current.hiddenCategories.filter(c => c !== category) : [...current.hiddenCategories, category];
    return { views: { ...s.views, [view]: { ...current, hiddenCategories } } };
  }),
  hide: (view, ids) => set(s => {
    const current = s.views[view] ?? EMPTY_VIEW_VISIBILITY;
    return { views: { ...s.views, [view]: { ...current, hiddenIds: [...new Set([...current.hiddenIds, ...ids])] } } };
  }),
  isolate: (view, ids) => set(s => ids.length ? {
    views: { ...s.views, [view]: { ...(s.views[view] ?? EMPTY_VIEW_VISIBILITY), isolatedIds: ids, hiddenIds: [] } },
  } : s),
  reset: (view) => set(s => ({ views: { ...s.views, [view]: EMPTY_VIEW_VISIBILITY } })),
}));

export function viewDisplayKey(preset: string, levelId: string | null, sectionId?: string | null) {
  return preset === "top" ? `top:${levelId ?? "all"}` : preset === "section" ? `section:${sectionId ?? "all"}` : preset;
}
