import { create } from "zustand";
import {
  clampToolRightPanelWidth,
  persistToolRightPanelWidthPx,
  readToolRightPanelWidthPx,
} from "./werkzeugLayout";

type WerkzeugUiState = {
  toolRightPanelWidthPx: number;
  setToolRightPanelWidthPx: (px: number, viewportWidth?: number) => void;
};

export const useWerkzeugUiStore = create<WerkzeugUiState>((set) => ({
  toolRightPanelWidthPx: readToolRightPanelWidthPx(),
  setToolRightPanelWidthPx: (px, viewportWidth) => {
    const next = clampToolRightPanelWidth(px, viewportWidth);
    persistToolRightPanelWidthPx(next);
    set({ toolRightPanelWidthPx: next });
  },
}));
