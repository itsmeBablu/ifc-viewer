"use client";

import { useState, useRef, useEffect } from "react";
import {
  LuChevronLeft,
  LuChevronRight,
  LuChevronDown,
  LuChevronUp,
  LuSlidersHorizontal,
  LuLayers,
  LuInfo,
  LuFileText,
  LuRuler,
  LuBox,
  LuShieldCheck,
  LuSparkles,
} from "react-icons/lu";
import gsap from "gsap";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useAppStore } from "@/store/useAppStore";
import LayoutPropertiesPanel from "./LayoutPropertiesPanel";
import MarkupPropertiesPanel from "./MarkupPropertiesPanel";
import ElementInspector from "./ElementInspector";
import EditTypeDialog, { DEFAULT_ELEMENT_TYPES, type ElementTypeDefinition } from "./EditTypeDialog";
import { wallLengthMm, wallAngleDeg } from "@/lib/layoutDrawing";

export default function ToolPropertiesDock() {
  const [collapsed, setCollapsed] = useState(false);
  const [editTypeOpen, setEditTypeOpen] = useState(false);
  const [types, setTypes] = useState<Record<string, ElementTypeDefinition>>(DEFAULT_ELEMENT_TYPES);
  const dockRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Section Collapse States
  const [openSections, setOpenSections] = useState({
    identity: true,
    dimensions: true,
    constraints: true,
    materials: true,
    ifc: false,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));
  };

  // GSAP animation on collapse toggle & selection change
  useEffect(() => {
    if (!collapsed && contentRef.current) {
      gsap.fromTo(
        contentRef.current.querySelectorAll(".ios-glass-card"),
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.28, stagger: 0.03, ease: "power2.out" }
      );
    }
  }, [collapsed]);

  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const floors = useAppStore((s) => s.floors);

  // Layout Store Selections
  const walls = useLayoutDrawingStore((s) => s.walls);
  const doors = useLayoutDrawingStore((s) => s.doors);
  const windows = useLayoutDrawingStore((s) => s.windows);
  const slabs = useLayoutDrawingStore((s) => s.slabs);
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const updateWall = useLayoutDrawingStore((s) => s.updateWall);
  const updateDoor = useLayoutDrawingStore((s) => s.updateDoor);
  const updateWindow = useLayoutDrawingStore((s) => s.updateWindow);
  const updateSlab = useLayoutDrawingStore((s) => s.updateSlab);

  // Markup Store Selections
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);
  const selectedNoteId = useToolMarkupStore((s) => s.selectedNoteId);
  const placements = useToolMarkupStore((s) => s.placements);
  const notes = useToolMarkupStore((s) => s.notes);

  const selectedWall = walls.find((w) => w.id === selectedWallId);
  const selectedDoor = doors.find((d) => d.id === selectedDoorId);
  const selectedWindow = windows.find((w) => w.id === selectedWindowId);
  const selectedSlab = slabs.find((s) => s.id === selectedSlabId);
  const selectedPlacement = placements.find((p) => p.id === selectedPlacementId);
  const selectedNote = notes.find((n) => n.id === selectedNoteId);

  const hasSelection = Boolean(
    selectedWall || selectedDoor || selectedWindow || selectedSlab || selectedPlacement || selectedNote
  );

  const currentFloorObj = floors.find((f) => f.id === selectedFloor);

  // Match Active Element to a Type Definition
  const getActiveTypeKey = (): string => {
    if (selectedWall) {
      if (selectedWall.wallTypeId && (types[selectedWall.wallTypeId] || DEFAULT_ELEMENT_TYPES[selectedWall.wallTypeId])) {
        return selectedWall.wallTypeId;
      }
      if (selectedWall.thicknessMm === 100) return "wall-interior-100";
      if (selectedWall.thicknessMm === 150) return "wall-interior-150";
      if (selectedWall.thicknessMm === 300) return "wall-exterior-300";
      if (selectedWall.thicknessMm === 365) return "wall-exterior-365";
      return "wall-generic-200";
    }
    if (selectedDoor) {
      if (selectedDoor.widthMm === 800) return "door-single-800";
      if (selectedDoor.widthMm === 1800) return "door-double-1800";
      return "door-single-900";
    }
    if (selectedWindow) {
      if (selectedWindow.widthMm === 1000) return "win-fixed-1000";
      if (selectedWindow.widthMm === 2000) return "win-pano-2000";
      return "win-double-1200";
    }
    if (selectedSlab) {
      return selectedSlab.kind === "roof" ? "slab-roof-300" : "slab-floor-200";
    }
    return "wall-generic-200";
  };

  const activeTypeKey = getActiveTypeKey();
  const currentType = types[activeTypeKey] || DEFAULT_ELEMENT_TYPES[activeTypeKey] || DEFAULT_ELEMENT_TYPES["wall-generic-200"];

  const handleTypeChange = (newTypeKey: string) => {
    const target = types[newTypeKey] || DEFAULT_ELEMENT_TYPES[newTypeKey];
    if (!target) return;

    if (selectedWall && target.category === "Wall") {
      updateWall(selectedWall.id, {
        thicknessMm: target.thicknessMm || selectedWall.thicknessMm,
        heightMm: target.heightMm || selectedWall.heightMm,
        wallTypeId: target.id,
        layers: target.layers ? [...target.layers] : undefined,
      });
    } else if (selectedDoor && target.widthMm && target.heightMm) {
      updateDoor(selectedDoor.id, { widthMm: target.widthMm, heightMm: target.heightMm });
    } else if (selectedWindow && target.widthMm && target.heightMm) {
      updateWindow(selectedWindow.id, {
        widthMm: target.widthMm,
        heightMm: target.heightMm,
        sillHeightMm: target.sillHeightMm ?? 900,
      });
    } else if (selectedSlab && target.thicknessMm) {
      updateSlab(selectedSlab.id, { thicknessMm: target.thicknessMm });
    }
  };

  const handleTypeSave = (updated: ElementTypeDefinition) => {
    setTypes((prev) => ({ ...prev, [updated.id]: updated }));

    // Global update for all matching elements
    if (updated.category === "Wall") {
      walls.forEach((w) => {
        if (w.wallTypeId === updated.id || (!w.wallTypeId && w.thicknessMm === currentType.thicknessMm)) {
          updateWall(w.id, {
            thicknessMm: updated.thicknessMm || w.thicknessMm,
            heightMm: updated.heightMm || w.heightMm,
            wallTypeId: updated.id,
            layers: updated.layers ? [...updated.layers] : undefined,
          });
        }
      });
    } else if (updated.category === "Door" && updated.widthMm && updated.heightMm) {
      doors.forEach((d) => {
        if (d.widthMm === currentType.widthMm) {
          updateDoor(d.id, { widthMm: updated.widthMm, heightMm: updated.heightMm });
        }
      });
    }
  };

  // Calculations for selected wall
  const wallLen = selectedWall ? Math.round(wallLengthMm(selectedWall)) : 0;
  const wallArea = selectedWall ? ((wallLen * (selectedWall.heightMm || 3000)) / 1_000_000).toFixed(2) : "0";
  const wallVol = selectedWall ? ((wallLen * (selectedWall.heightMm || 3000) * selectedWall.thicknessMm) / 1_000_000_000).toFixed(3) : "0";

  return (
    <>
      <aside
        ref={dockRef}
        className={`fixed left-0 top-[116px] bottom-7 z-30 flex flex-col border-r border-black/[0.08] dark:border-white/10 bg-white/85 dark:bg-slate-950/85 text-zinc-900 dark:text-white shadow-[0_8px_32px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-3xl transition-all duration-300 select-none ${
          collapsed ? "w-11" : "w-80"
        }`}
      >
        {/* Dock Header */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-black/[0.06] dark:border-white/10 px-3.5 bg-black/[0.02] dark:bg-white/[0.02]">
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-xs shadow-sm">
                <LuSlidersHorizontal className="h-3.5 w-3.5" />
              </div>
              <span className="font-bold text-xs text-zinc-900 dark:text-white tracking-wide uppercase font-mono">
                Properties
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand Properties Palette" : "Collapse Properties Palette"}
            className="flex h-7 w-7 items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/15 border border-black/5 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all active:scale-95"
          >
            {collapsed ? <LuChevronRight className="h-4 w-4" /> : <LuChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Dock Content Body */}
        {!collapsed && (
          <div ref={contentRef} className="flex flex-1 min-h-0 flex-col overflow-y-auto p-3 thin-scroll space-y-3 text-xs">
            {/* TYPE SELECTOR HEADER & EDIT TYPE BUTTON */}
            {hasSelection && (selectedWall || selectedDoor || selectedWindow || selectedSlab) && (
              <div className="ios-glass-card rounded-2xl border border-black/[0.06] dark:border-white/15 bg-white/70 dark:bg-white/[0.04] p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] backdrop-blur-md space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    <LuSparkles className="h-3 w-3" />
                    <span>Type Definition</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditTypeOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 bg-gradient-to-r from-amber-500/15 to-orange-500/15 hover:from-amber-500/25 hover:to-orange-500/25 border border-amber-500/30 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold text-[10px] shadow-sm transition-all active:scale-95"
                  >
                    <LuSlidersHorizontal className="h-3 w-3" />
                    <span>Edit Type</span>
                  </button>
                </div>

                <select
                  value={activeTypeKey}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full h-8 rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/40 px-3 text-xs font-semibold text-zinc-900 dark:text-white shadow-sm focus:border-amber-500 dark:focus:border-amber-400 focus:outline-none transition-all"
                >
                  {Object.values(types)
                    .filter((t) => {
                      if (selectedWall) return t.category === "Wall";
                      if (selectedDoor) return t.category === "Door";
                      if (selectedWindow) return t.category === "Window";
                      if (selectedSlab) return t.category === "Floor" || t.category === "Roof";
                      return true;
                    })
                    .map((t) => (
                      <option key={t.id} value={t.id} className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* COLLAPSIBLE SECTIONS FOR SELECTED ELEMENT */}
            {hasSelection ? (
              <div className="space-y-2.5">
                {/* 1. IDENTITY DATA */}
                <div className="ios-glass-card rounded-2xl border border-black/[0.06] dark:border-white/10 bg-white/70 dark:bg-white/[0.04] backdrop-blur-md overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
                  <button
                    type="button"
                    onClick={() => toggleSection("identity")}
                    className="flex w-full items-center justify-between p-3 font-bold text-xs text-zinc-900 dark:text-white hover:bg-black/[0.03] dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white text-[10px] shadow-sm">
                        <LuFileText className="h-3 w-3" />
                      </div>
                      <span>Identity Data</span>
                    </span>
                    {openSections.identity ? <LuChevronUp className="h-3.5 w-3.5 text-zinc-400" /> : <LuChevronDown className="h-3.5 w-3.5 text-zinc-400" />}
                  </button>

                  {openSections.identity && (
                    <div className="p-3 pt-0 space-y-2 border-t border-black/[0.04] dark:border-white/[0.06] text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-black/[0.03] dark:border-white/[0.04]">
                        <span className="text-zinc-500 dark:text-zinc-400">Mark / ID:</span>
                        <span className="font-mono font-bold text-purple-700 dark:text-purple-300">
                          {selectedWall ? `W-${selectedWall.id.slice(-4)}` : selectedDoor ? `D-${selectedDoor.id.slice(-4)}` : selectedWindow ? `WN-${selectedWindow.id.slice(-4)}` : "EL-1"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-zinc-500 dark:text-zinc-400">Comments:</span>
                        <input
                          type="text"
                          placeholder="Add remark…"
                          className="w-36 h-6 rounded-lg border border-black/10 dark:border-white/10 bg-white/80 dark:bg-black/40 px-2 text-right text-[11px] text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-purple-500 dark:focus:border-purple-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. DIMENSIONS */}
                <div className="ios-glass-card rounded-2xl border border-black/[0.06] dark:border-white/10 bg-white/70 dark:bg-white/[0.04] backdrop-blur-md overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
                  <button
                    type="button"
                    onClick={() => toggleSection("dimensions")}
                    className="flex w-full items-center justify-between p-3 font-bold text-xs text-zinc-900 dark:text-white hover:bg-black/[0.03] dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] shadow-sm">
                        <LuRuler className="h-3 w-3" />
                      </div>
                      <span>Dimensions</span>
                    </span>
                    {openSections.dimensions ? <LuChevronUp className="h-3.5 w-3.5 text-zinc-400" /> : <LuChevronDown className="h-3.5 w-3.5 text-zinc-400" />}
                  </button>

                  {openSections.dimensions && (
                    <div className="p-3 pt-0 space-y-2 border-t border-black/[0.04] dark:border-white/[0.06] text-xs">
                      {selectedWall && (
                        <>
                          <div className="flex items-center justify-between py-1 border-b border-black/[0.03] dark:border-white/[0.04]">
                            <span className="text-zinc-500 dark:text-zinc-400">Length:</span>
                            <span className="font-mono font-semibold text-blue-600 dark:text-blue-300">{wallLen} mm</span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-black/[0.03] dark:border-white/[0.04]">
                            <span className="text-zinc-500 dark:text-zinc-400">Thickness:</span>
                            <span className="font-mono font-semibold text-blue-600 dark:text-blue-300">{selectedWall.thicknessMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-black/[0.03] dark:border-white/[0.04]">
                            <span className="text-zinc-500 dark:text-zinc-400">Height:</span>
                            <span className="font-mono font-semibold text-blue-600 dark:text-blue-300">{selectedWall.heightMm || 3000} mm</span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-black/[0.03] dark:border-white/[0.04]">
                            <span className="text-zinc-500 dark:text-zinc-400">Surface Area:</span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{wallArea} m²</span>
                          </div>
                          <div className="flex items-center justify-between py-1">
                            <span className="text-zinc-500 dark:text-zinc-400">Volume:</span>
                            <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{wallVol} m³</span>
                          </div>
                        </>
                      )}

                      {selectedDoor && (
                        <>
                          <div className="flex items-center justify-between py-1 border-b border-black/[0.03] dark:border-white/[0.04]">
                            <span className="text-zinc-500 dark:text-zinc-400">Width:</span>
                            <span className="font-mono font-semibold text-blue-600 dark:text-blue-300">{selectedDoor.widthMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-black/[0.03] dark:border-white/[0.04]">
                            <span className="text-zinc-500 dark:text-zinc-400">Height:</span>
                            <span className="font-mono font-semibold text-blue-600 dark:text-blue-300">{selectedDoor.heightMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between py-1">
                            <span className="text-zinc-500 dark:text-zinc-400">Clear Opening:</span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{((selectedDoor.widthMm * selectedDoor.heightMm) / 1_000_000).toFixed(2)} m²</span>
                          </div>
                        </>
                      )}

                      {selectedWindow && (
                        <>
                          <div className="flex items-center justify-between py-1 border-b border-black/[0.03] dark:border-white/[0.04]">
                            <span className="text-zinc-500 dark:text-zinc-400">Width:</span>
                            <span className="font-mono font-semibold text-blue-600 dark:text-blue-300">{selectedWindow.widthMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-black/[0.03] dark:border-white/[0.04]">
                            <span className="text-zinc-500 dark:text-zinc-400">Height:</span>
                            <span className="font-mono font-semibold text-blue-600 dark:text-blue-300">{selectedWindow.heightMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between py-1">
                            <span className="text-zinc-500 dark:text-zinc-400">Sill Height:</span>
                            <span className="font-mono font-semibold text-blue-600 dark:text-blue-300">{selectedWindow.sillHeightMm} mm</span>
                          </div>
                        </>
                      )}

                      {selectedSlab && (
                        <>
                          <div className="flex items-center justify-between py-1 border-b border-black/[0.03] dark:border-white/[0.04]">
                            <span className="text-zinc-500 dark:text-zinc-400">Thickness:</span>
                            <span className="font-mono font-semibold text-blue-600 dark:text-blue-300">{selectedSlab.thicknessMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between py-1">
                            <span className="text-zinc-500 dark:text-zinc-400">Footprint Area:</span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {(((selectedSlab.maxXmm - selectedSlab.minXmm) * (selectedSlab.maxYmm - selectedSlab.minYmm)) / 1_000_000).toFixed(2)} m²
                            </span>
                          </div>
                        </>
                      )}

                      {selectedPlacement && (
                        <MarkupPropertiesPanel className="!border-0 !bg-transparent !p-0 !shadow-none" />
                      )}
                    </div>
                  )}
                </div>

                {/* 3. CONSTRAINTS */}
                <div className="ios-glass-card rounded-2xl border border-black/[0.06] dark:border-white/10 bg-white/70 dark:bg-white/[0.04] backdrop-blur-md overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
                  <button
                    type="button"
                    onClick={() => toggleSection("constraints")}
                    className="flex w-full items-center justify-between p-3 font-bold text-xs text-zinc-900 dark:text-white hover:bg-black/[0.03] dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-[10px] shadow-sm">
                        <LuLayers className="h-3 w-3" />
                      </div>
                      <span>Constraints</span>
                    </span>
                    {openSections.constraints ? <LuChevronUp className="h-3.5 w-3.5 text-zinc-400" /> : <LuChevronDown className="h-3.5 w-3.5 text-zinc-400" />}
                  </button>

                  {openSections.constraints && (
                    <div className="p-3 pt-0 space-y-2 border-t border-black/[0.04] dark:border-white/[0.06] text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-black/[0.03] dark:border-white/[0.04]">
                        <span className="text-zinc-500 dark:text-zinc-400">Base Constraint:</span>
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {currentFloorObj ? currentFloorObj.name : "Level 1 (0.00m)"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-zinc-500 dark:text-zinc-400">Base Offset:</span>
                        <span className="font-mono text-zinc-700 dark:text-zinc-300">0 mm</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. MATERIALS & FINISHES */}
                <div className="ios-glass-card rounded-2xl border border-black/[0.06] dark:border-white/10 bg-white/70 dark:bg-white/[0.04] backdrop-blur-md overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
                  <button
                    type="button"
                    onClick={() => toggleSection("materials")}
                    className="flex w-full items-center justify-between p-3 font-bold text-xs text-zinc-900 dark:text-white hover:bg-black/[0.03] dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-[10px] shadow-sm">
                        <LuBox className="h-3 w-3" />
                      </div>
                      <span>Materials & Finish</span>
                    </span>
                    {openSections.materials ? <LuChevronUp className="h-3.5 w-3.5 text-zinc-400" /> : <LuChevronDown className="h-3.5 w-3.5 text-zinc-400" />}
                  </button>

                  {openSections.materials && (
                    <div className="p-3 pt-0 space-y-2 border-t border-black/[0.04] dark:border-white/[0.06] text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-black/[0.03] dark:border-white/[0.04]">
                        <span className="text-zinc-500 dark:text-zinc-400">Material:</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-300 truncate max-w-[140px]">{currentType.material}</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-zinc-500 dark:text-zinc-400">Function:</span>
                        <span className="font-medium text-zinc-700 dark:text-zinc-200">{currentType.functionType}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. IFC & EXPORT */}
                <div className="ios-glass-card rounded-2xl border border-black/[0.06] dark:border-white/10 bg-white/70 dark:bg-white/[0.04] backdrop-blur-md overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
                  <button
                    type="button"
                    onClick={() => toggleSection("ifc")}
                    className="flex w-full items-center justify-between p-3 font-bold text-xs text-zinc-900 dark:text-white hover:bg-black/[0.03] dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white text-[10px] shadow-sm">
                        <LuShieldCheck className="h-3 w-3" />
                      </div>
                      <span>IFC / BIM Data</span>
                    </span>
                    {openSections.ifc ? <LuChevronUp className="h-3.5 w-3.5 text-zinc-400" /> : <LuChevronDown className="h-3.5 w-3.5 text-zinc-400" />}
                  </button>

                  {openSections.ifc && (
                    <div className="p-3 pt-0 space-y-2 border-t border-black/[0.04] dark:border-white/[0.06] text-xs">
                      <div className="flex items-center justify-between py-1">
                        <span className="text-zinc-500 dark:text-zinc-400">Export Entity:</span>
                        <span className="font-mono text-rose-600 dark:text-rose-300">
                          {selectedWall ? "IfcWallStandardCase" : selectedDoor ? "IfcDoor" : selectedWindow ? "IfcWindow" : "IfcSlab"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* DEFAULT PROJECT METADATA WHEN NOTHING SELECTED */
              <div className="space-y-3.5">
                <div className="ios-glass-card rounded-2xl border border-black/[0.06] dark:border-white/10 bg-white/70 dark:bg-white/[0.04] p-3.5 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] space-y-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs shadow-sm">
                      <LuInfo className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white tracking-tight">Project Information</span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-black/[0.03] dark:border-white/[0.04]">
                      <span className="text-zinc-500 dark:text-zinc-400">Model Name:</span>
                      <span className="font-semibold text-zinc-900 dark:text-white truncate max-w-[140px]">
                        {activeModelLabel || "Standard Project"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-black/[0.03] dark:border-white/[0.04]">
                      <span className="text-zinc-500 dark:text-zinc-400">Active Level:</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {currentFloorObj ? currentFloorObj.name : "All Levels"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-black/[0.03] dark:border-white/[0.04]">
                      <span className="text-zinc-500 dark:text-zinc-400">Units:</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-200">Millimeters (mm)</span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-black/[0.03] dark:border-white/[0.04]">
                      <span className="text-zinc-500 dark:text-zinc-400">Total Levels:</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{floors.length}</span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-black/[0.03] dark:border-white/[0.04]">
                      <span className="text-zinc-500 dark:text-zinc-400">Placed Walls:</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{walls.length}</span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-zinc-500 dark:text-zinc-400">3D Shapes:</span>
                      <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{placements.length}</span>
                    </div>
                  </div>
                </div>

                {/* IFC INSPECTOR ON SELECTION */}
                <div className="pt-2 border-t border-black/[0.06] dark:border-white/10">
                  <div className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wide">
                    IFC Element Details
                  </div>
                  <ElementInspector />
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Edit Type Dialog */}
      <EditTypeDialog
        typeDef={currentType}
        isOpen={editTypeOpen}
        onClose={() => setEditTypeOpen(false)}
        onSave={handleTypeSave}
      />
    </>
  );
}
