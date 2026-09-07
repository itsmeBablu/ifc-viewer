"use client";
import { create } from "zustand";
import type { GeometrySelection, SelectionLevel } from "@/lib/modifySelection";

export type ModifyTool = "select" | "move" | "rotate" | "align" | "mirror" | "split" | "attachTop" | "attachBase" | "joinRoof";
type State = {
  tool: ModifyTool;
  level: SelectionLevel;
  reference: GeometrySelection | null;
  selection: GeometrySelection | null;
  mirrorCopy: boolean;
  mirrorAxis: "draw" | "pick";
  message: string | null;
  busy: boolean;
  placingGroupId: string | null;
  requestGroupName: boolean;
  activate: (tool: ModifyTool) => void;
};
export const useModifyStore = create<State>(set => ({
  tool: "select", level: "element", reference: null, selection: null,
  mirrorCopy: true, mirrorAxis: "draw", message: null, busy: false, placingGroupId: null, requestGroupName: false,
  activate: tool => set({ tool, reference: null, message: null }),
}));
