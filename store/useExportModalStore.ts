import { create } from "zustand";

export type ExportFormat = "cad" | "pdf";
export type CadFormat = "dxf" | "dwg";

interface ExportModalStore {
  isOpen: boolean;
  activeFormat: ExportFormat;
  cadFormat: CadFormat;
  open: (format?: ExportFormat) => void;
  close: () => void;
  setFormat: (format: ExportFormat) => void;
  setCadFormat: (cadFormat: CadFormat) => void;
}

export const useExportModalStore = create<ExportModalStore>((set) => ({
  isOpen: false,
  activeFormat: "cad",
  cadFormat: "dxf",
  open: (format = "cad") => set({ isOpen: true, activeFormat: format }),
  close: () => set({ isOpen: false }),
  setFormat: (format) => set({ activeFormat: format }),
  setCadFormat: (cadFormat) => set({ cadFormat }),
}));
