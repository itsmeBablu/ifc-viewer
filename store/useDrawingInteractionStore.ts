import { create } from "zustand";
import type { DrawingShape } from "@/lib/drawingShapes";

export const useDrawingInteractionStore = create<{
  shape: DrawingShape;
  navigating: boolean;
  tracking: boolean;
  busy: boolean;
  hasPoints: boolean;
  message: string | null;
  lengthMm: number | null;
  angleDeg: number | null;
}>(() => ({ shape: "line", navigating: false, tracking: true, busy: false, hasPoints: false, message: null, lengthMm: null, angleDeg: null }));
