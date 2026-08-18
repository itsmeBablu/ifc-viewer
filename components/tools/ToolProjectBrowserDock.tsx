"use client";

import { useState } from "react";
import {
  LuLayers,
  LuFolderTree,
  LuChevronLeft,
  LuChevronRight,
  LuTrash2,
} from "react-icons/lu";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useIfcStructure } from "./useIfcStructure";
import IfcStructureTree from "./IfcStructureTree";
import ToolFloorsSection from "./ToolFloorsSection";

type RightTab = "browser" | "ifcTree";

export default function ToolProjectBrowserDock({
  onFile,
  isLoadingModel = false,
}: {
  onFile?: (file: File) => void;
  isLoadingModel?: boolean;
}) {
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
  const setRightPanelOpen = useAppStore((s) => s.setRightPanelOpen);
  const { structure, loading } = useIfcStructure(true);

  const [activeTab, setActiveTab] = useState<RightTab>("browser");

  // Layout Store
  const walls = useLayoutDrawingStore((s) => s.walls);
  const doors = useLayoutDrawingStore((s) => s.doors);
  const windows = useLayoutDrawingStore((s) => s.windows);
  const slabs = useLayoutDrawingStore((s) => s.slabs);
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectWall = useLayoutDrawingStore((s) => s.selectWall);
  const deleteWall = useLayoutDrawingStore((s) => s.deleteWall);

  // Markup Store
  const placements = useToolMarkupStore((s) => s.placements);
  const notes = useToolMarkupStore((s) => s.notes);
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);
  const selectPlacement = useToolMarkupStore((s) => s.selectPlacement);
  const deletePlacement = useToolMarkupStore((s) => s.deletePlacement);

  return (
    <aside
      className={`fixed right-0 top-[116px] bottom-7 z-30 flex flex-col border-l border-[var(--panel-divider)] bg-[var(--surface-overlay)]/95 shadow-xl backdrop-blur-xl transition-all duration-300 select-none ${
        rightPanelOpen ? "w-80" : "w-10"
      }`}
    >
      {/* Dock Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--panel-divider)] px-3">
        <button
          type="button"
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          title={rightPanelOpen ? "Collapse Project Browser" : "Expand Project Browser"}
          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
        >
          {rightPanelOpen ? <LuChevronRight className="h-4 w-4" /> : <LuChevronLeft className="h-4 w-4" />}
        </button>

        {rightPanelOpen && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("browser")}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition-colors ${
                activeTab === "browser"
                  ? "bg-amber-500/20 text-amber-500 border border-amber-400/40"
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              }`}
            >
              <LuFolderTree className="h-3.5 w-3.5" />
              <span>Project Browser</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ifcTree")}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition-colors ${
                activeTab === "ifcTree"
                  ? "bg-amber-500/20 text-amber-500 border border-amber-400/40"
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              }`}
            >
              <LuLayers className="h-3.5 w-3.5" />
              <span>IFC Tree</span>
            </button>
          </div>
        )}
      </div>

      {/* Dock Content Body */}
      {rightPanelOpen && (
        <div className="flex flex-1 min-h-0 flex-col overflow-y-auto p-3 thin-scroll space-y-4 text-xs">
          {activeTab === "browser" ? (
            <div className="space-y-4">
              {/* LEVELS SECTION */}
              <div className="rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-3">
                <div className="text-[11px] font-bold text-[var(--text-strong)] uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Building Levels & Stories</span>
                </div>
                <ToolFloorsSection />
              </div>

              {/* DRAWN ARCHITECTURE ELEMENTS */}
              <div className="rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-3">
                <div className="text-[11px] font-bold text-[var(--text-strong)] uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Architecture Elements ({walls.length + doors.length + windows.length + slabs.length})</span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto thin-scroll">
                  {walls.length === 0 && doors.length === 0 && windows.length === 0 && slabs.length === 0 ? (
                    <div className="text-[11px] text-[var(--text-muted)] py-2 text-center italic">
                      No layout elements drawn yet.
                    </div>
                  ) : (
                    <>
                      {walls.map((w, idx) => (
                        <div
                          key={w.id}
                          onClick={() => selectWall(w.id)}
                          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors ${
                            selectedWallId === w.id
                              ? "bg-amber-500/20 text-amber-500 border border-amber-400/40"
                              : "hover:bg-[var(--surface-overlay)] text-[var(--text-body)]"
                          }`}
                        >
                          <span className="font-semibold">Wall #{idx + 1} ({w.thicknessMm}mm)</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteWall(w.id);
                            }}
                            className="p-1 text-red-400 hover:text-red-500"
                          >
                            <LuTrash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}

                      {doors.map((d, idx) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-[var(--surface-overlay)] text-[var(--text-body)]"
                        >
                          <span>Door #{idx + 1} ({d.widthMm}×{d.heightMm}mm)</span>
                        </div>
                      ))}

                      {windows.map((win, idx) => (
                        <div
                          key={win.id}
                          className="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-[var(--surface-overlay)] text-[var(--text-body)]"
                        >
                          <span>Window #{idx + 1} ({win.widthMm}×{win.heightMm}mm)</span>
                        </div>
                      ))}

                      {slabs.map((sl, idx) => (
                        <div
                          key={sl.id}
                          className="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-[var(--surface-overlay)] text-[var(--text-body)]"
                        >
                          <span>Floor Slab #{idx + 1} ({sl.thicknessMm}mm)</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* 3D SHAPES & NOTES */}
              <div className="rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-3">
                <div className="text-[11px] font-bold text-[var(--text-strong)] uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>3D Shapes & Tags ({placements.length + notes.length})</span>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto thin-scroll">
                  {placements.length === 0 && notes.length === 0 ? (
                    <div className="text-[11px] text-[var(--text-muted)] py-2 text-center italic">
                      No 3D shapes or tags placed.
                    </div>
                  ) : (
                    <>
                      {placements.map((p, idx) => (
                        <div
                          key={p.id}
                          onClick={() => selectPlacement(p.id)}
                          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors ${
                            selectedPlacementId === p.id
                              ? "bg-amber-500/20 text-amber-500 border border-amber-400/40"
                              : "hover:bg-[var(--surface-overlay)] text-[var(--text-body)]"
                          }`}
                        >
                          <span className="font-semibold capitalize">{p.type} #{idx + 1}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePlacement(p.id);
                            }}
                            className="p-1 text-red-400 hover:text-red-500"
                          >
                            <LuTrash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}

                      {notes.map((n, idx) => (
                        <div
                          key={n.id}
                          className="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-[var(--surface-overlay)] text-[var(--text-body)]"
                        >
                          <span className="truncate max-w-[180px]">Note: {n.text || `#${idx + 1}`}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: IFC SPATIAL STRUCTURE TREE */
            <div className="h-full flex-1">
              <IfcStructureTree structure={structure} loading={loading} />
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
