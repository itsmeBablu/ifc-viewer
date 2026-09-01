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

  const isDark = useAppStore((s) => s.colorTheme === "dark");
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

  // Propagate Type Selection
  const handleTypeChange = (typeId: string) => {
    const chosenType = types[typeId] || DEFAULT_ELEMENT_TYPES[typeId];
    if (!chosenType) return;

    if (selectedWall) {
      updateWall(selectedWall.id, {
        thicknessMm: chosenType.thicknessMm || selectedWall.thicknessMm,
        heightMm: chosenType.heightMm || selectedWall.heightMm,
        wallTypeId: chosenType.id,
        layers: chosenType.layers ? [...chosenType.layers] : undefined,
      });
    } else if (selectedDoor && chosenType.widthMm && chosenType.heightMm) {
      updateDoor(selectedDoor.id, {
        widthMm: chosenType.widthMm,
        heightMm: chosenType.heightMm,
      });
    } else if (selectedWindow && chosenType.widthMm && chosenType.heightMm) {
      updateWindow(selectedWindow.id, {
        widthMm: chosenType.widthMm,
        heightMm: chosenType.heightMm,
      });
    } else if (selectedSlab && chosenType.thicknessMm) {
      updateSlab(selectedSlab.id, {
        thicknessMm: chosenType.thicknessMm,
      });
    }
  };

  // Propagate Edit Type Dialog updates to all matching instances
  const handleTypeSave = (updated: ElementTypeDefinition) => {
    setTypes((prev) => ({ ...prev, [updated.id]: updated }));

    if (updated.category === "Wall" && updated.thicknessMm) {
      walls.forEach((w) => {
        if (w.wallTypeId === updated.id || (!w.wallTypeId && w.thicknessMm === currentType.thicknessMm)) {
          updateWall(w.id, {
            thicknessMm: updated.thicknessMm,
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

  const cardStyle = `ios-glass-card rounded-2xl border backdrop-blur-md overflow-hidden transition-all ${
    isDark
      ? "border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
      : "border-black/[0.06] bg-white/80 shadow-[0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_0_rgba(255,255,255,0.9)]"
  }`;

  return (
    <>
      <aside
        ref={dockRef}
        className={`fixed left-0 top-[116px] bottom-7 z-30 flex flex-col border-r transition-all duration-300 select-none ${
          isDark
            ? "border-white/10 bg-slate-950/85 text-white shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.25)]"
            : "border-black/[0.08] bg-white/95 text-zinc-900 shadow-[0_8px_32px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]"
        } backdrop-blur-3xl ${collapsed ? "w-11" : "w-80"}`}
      >
        {/* Dock Header */}
        <div className={`flex h-11 shrink-0 items-center justify-between border-b px-3.5 ${
          isDark ? "border-white/10 bg-white/[0.02]" : "border-black/[0.06] bg-black/[0.02]"
        }`}>
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-xs shadow-sm">
                <LuSlidersHorizontal className="h-3.5 w-3.5" />
              </div>
              <span className={`font-bold text-xs tracking-wide uppercase font-mono ${isDark ? "text-white" : "text-zinc-900"}`}>
                Properties
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand Properties Palette" : "Collapse Properties Palette"}
            className={`flex h-7 w-7 items-center justify-center rounded-xl border transition-all active:scale-95 ${
              isDark
                ? "bg-white/5 hover:bg-white/15 border-white/10 text-zinc-300 hover:text-white"
                : "bg-black/5 hover:bg-black/10 border-black/5 text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {collapsed ? <LuChevronRight className="h-4 w-4" /> : <LuChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Dock Content Body */}
        {!collapsed && (
          <div ref={contentRef} className="flex flex-1 min-h-0 flex-col overflow-y-auto p-3 thin-scroll space-y-3 text-xs">
            {/* TYPE SELECTOR HEADER & EDIT TYPE BUTTON */}
            {hasSelection && (selectedWall || selectedDoor || selectedWindow || selectedSlab) && (
              <div className={`rounded-2xl border p-3.5 backdrop-blur-md space-y-2.5 ${
                isDark
                  ? "border-white/15 bg-white/[0.04] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                  : "border-black/[0.06] bg-white/80 shadow-[0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_0_rgba(255,255,255,0.9)]"
              }`}>
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                    <LuSparkles className="h-3 w-3" />
                    <span>Type Definition</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditTypeOpen(true)}
                    className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 font-bold text-[10px] shadow-sm transition-all active:scale-95 border ${
                      isDark
                        ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border-amber-500/40 text-amber-300"
                        : "bg-gradient-to-r from-amber-500/15 to-orange-500/15 hover:from-amber-500/25 hover:to-orange-500/25 border-amber-500/30 text-amber-700"
                    }`}
                  >
                    <LuSlidersHorizontal className="h-3 w-3" />
                    <span>Edit Type</span>
                  </button>
                </div>

                <select
                  value={activeTypeKey}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className={`w-full h-8 rounded-xl border px-3 text-xs font-semibold focus:outline-none transition-all ${
                    isDark
                      ? "border-white/15 bg-black/40 text-white focus:border-amber-400"
                      : "border-black/10 bg-white text-zinc-900 shadow-sm focus:border-amber-500"
                  }`}
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
                      <option key={t.id} value={t.id} className={isDark ? "bg-slate-900 text-white" : "bg-white text-zinc-900"}>
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
                <div className={cardStyle}>
                  <button
                    type="button"
                    onClick={() => toggleSection("identity")}
                    className={`flex w-full items-center justify-between p-3 font-bold text-xs transition-colors ${
                      isDark ? "text-white hover:bg-white/5" : "text-zinc-900 hover:bg-black/[0.03]"
                    }`}
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
                    <div className={`p-3 pt-0 space-y-2 border-t text-xs ${isDark ? "border-white/[0.06]" : "border-black/[0.04]"}`}>
                      <div className={`flex items-center justify-between py-1 border-b ${isDark ? "border-white/[0.04]" : "border-black/[0.03]"}`}>
                        <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Mark / ID:</span>
                        <span className={`font-mono font-bold ${isDark ? "text-purple-300" : "text-purple-700"}`}>
                          {selectedWall ? `W-${selectedWall.id.slice(-4)}` : selectedDoor ? `D-${selectedDoor.id.slice(-4)}` : selectedWindow ? `WN-${selectedWindow.id.slice(-4)}` : "EL-1"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Comments:</span>
                        <input
                          type="text"
                          placeholder="Add remark…"
                          className={`w-36 h-6 rounded-lg border px-2 text-right text-[11px] focus:outline-none ${
                            isDark
                              ? "border-white/10 bg-black/40 text-zinc-200 placeholder:text-zinc-600 focus:border-purple-400"
                              : "border-black/10 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-purple-500 shadow-sm"
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. DIMENSIONS */}
                <div className={cardStyle}>
                  <button
                    type="button"
                    onClick={() => toggleSection("dimensions")}
                    className={`flex w-full items-center justify-between p-3 font-bold text-xs transition-colors ${
                      isDark ? "text-white hover:bg-white/5" : "text-zinc-900 hover:bg-black/[0.03]"
                    }`}
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
                    <div className={`p-3 pt-0 space-y-2 border-t text-xs ${isDark ? "border-white/[0.06]" : "border-black/[0.04]"}`}>
                      {selectedWall && (
                        <>
                          <div className={`flex items-center justify-between py-1 border-b ${isDark ? "border-white/[0.04]" : "border-black/[0.03]"}`}>
                            <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Length:</span>
                            <span className={`font-mono font-semibold ${isDark ? "text-blue-300" : "text-blue-600"}`}>{wallLen} mm</span>
                          </div>
                          <div className={`flex items-center justify-between py-1 border-b ${isDark ? "border-white/[0.04]" : "border-black/[0.03]"}`}>
                            <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Thickness:</span>
                            <span className={`font-mono font-semibold ${isDark ? "text-blue-300" : "text-blue-600"}`}>{selectedWall.thicknessMm} mm</span>
                          </div>
                          <div className={`flex items-center justify-between py-1 border-b ${isDark ? "border-white/[0.04]" : "border-black/[0.03]"}`}>
                            <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Height:</span>
                            <span className={`font-mono font-semibold ${isDark ? "text-blue-300" : "text-blue-600"}`}>{selectedWall.heightMm || 3000} mm</span>
                          </div>
                          <div className={`flex items-center justify-between py-1 border-b ${isDark ? "border-white/[0.04]" : "border-black/[0.03]"}`}>
                            <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Surface Area:</span>
                            <span className={`font-mono font-bold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>{wallArea} m²</span>
                          </div>
                          <div className="flex items-center justify-between py-1">
                            <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Volume:</span>
                            <span className={`font-mono font-bold ${isDark ? "text-cyan-400" : "text-cyan-600"}`}>{wallVol} m³</span>
                          </div>
                        </>
                      )}

                      {selectedDoor && (
                        <>
                          <div className={`flex items-center justify-between py-1 border-b ${isDark ? "border-white/[0.04]" : "border-black/[0.03]"}`}>
                            <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Width:</span>
                            <span className={`font-mono font-semibold ${isDark ? "text-blue-300" : "text-blue-600"}`}>{selectedDoor.widthMm} mm</span>
                          </div>
                          <div className={`flex items-center justify-between py-1 border-b ${isDark ? "border-white/[0.04]" : "border-black/[0.03]"}`}>
                            <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Height:</span>
                            <span className={`font-mono font-semibold ${isDark ? "text-blue-300" : "text-blue-600"}`}>{selectedDoor.heightMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between py-1">
                            <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Clear Opening:</span>
                            <span className={`font-mono font-bold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>{((selectedDoor.widthMm * selectedDoor.heightMm) / 1_000_000).toFixed(2)} m²</span>
                          </div>
                        </>
                      )}

                      {selectedWindow && (
                        <>
                          <div className={`flex items-center justify-between py-1 border-b ${isDark ? "border-white/[0.04]" : "border-black/[0.03]"}`}>
                            <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Width:</span>
                            <span className={`font-mono font-semibold ${isDark ? "text-blue-300" : "text-blue-600"}`}>{selectedWindow.widthMm} mm</span>
                          </div>
                          <div className={`flex items-center justify-between py-1 border-b ${isDark ? "border-white/[0.04]" : "border-black/[0.03]"}`}>
                            <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Height:</span>
                            <span className={`font-mono font-semibold ${isDark ? "text-blue-300" : "text-blue-600"}`}>{selectedWindow.heightMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between py-1">
                            <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Sill Height:</span>
                            <span className={`font-mono font-semibold ${isDark ? "text-blue-300" : "text-blue-600"}`}>{selectedWindow.sillHeightMm} mm</span>
                          </div>
                        </>
                      )}

                      {selectedSlab && (
                        <>
                          <div className={`flex items-center justify-between py-1 border-b ${isDark ? "border-white/[0.04]" : "border-black/[0.03]"}`}>
                            <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Thickness:</span>
                            <span className={`font-mono font-semibold ${isDark ? "text-blue-300" : "text-blue-600"}`}>{selectedSlab.thicknessMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between py-1">
                            <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Footprint Area:</span>
                            <span className={`font-mono font-bold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
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
                <div className={cardStyle}>
                  <button
                    type="button"
                    onClick={() => toggleSection("constraints")}
                    className={`flex w-full items-center justify-between p-3 font-bold text-xs transition-colors ${
                      isDark ? "text-white hover:bg-white/5" : "text-zinc-900 hover:bg-black/[0.03]"
                    }`}
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
                    <div className={`p-3 pt-0 space-y-2 border-t text-xs ${isDark ? "border-white/[0.06]" : "border-black/[0.04]"}`}>
                      <div className={`flex items-center justify-between py-1 border-b ${isDark ? "border-white/[0.04]" : "border-black/[0.03]"}`}>
                        <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Base Constraint:</span>
                        <span className={`font-semibold ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                          {currentFloorObj ? currentFloorObj.name : "Level 1 (0.00m)"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Base Offset:</span>
                        <span className={`font-mono ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>0 mm</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. MATERIALS & FINISHES */}
                <div className={cardStyle}>
                  <button
                    type="button"
                    onClick={() => toggleSection("materials")}
                    className={`flex w-full items-center justify-between p-3 font-bold text-xs transition-colors ${
                      isDark ? "text-white hover:bg-white/5" : "text-zinc-900 hover:bg-black/[0.03]"
                    }`}
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
                    <div className={`p-3 pt-0 space-y-2 border-t text-xs ${isDark ? "border-white/[0.06]" : "border-black/[0.04]"}`}>
                      <div className={`flex items-center justify-between py-1 border-b ${isDark ? "border-white/[0.04]" : "border-black/[0.03]"}`}>
                        <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Material:</span>
                        <span className={`font-medium truncate max-w-[140px] ${isDark ? "text-emerald-300" : "text-emerald-600"}`}>{currentType.material}</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Function:</span>
                        <span className={`font-medium ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>{currentType.functionType}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. IFC & EXPORT */}
                <div className={cardStyle}>
                  <button
                    type="button"
                    onClick={() => toggleSection("ifc")}
                    className={`flex w-full items-center justify-between p-3 font-bold text-xs transition-colors ${
                      isDark ? "text-white hover:bg-white/5" : "text-zinc-900 hover:bg-black/[0.03]"
                    }`}
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
                    <div className={`p-3 pt-0 space-y-2 border-t text-xs ${isDark ? "border-white/[0.06]" : "border-black/[0.04]"}`}>
                      <div className="flex items-center justify-between py-1">
                        <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Export Entity:</span>
                        <span className={`font-mono ${isDark ? "text-rose-300" : "text-rose-600"}`}>
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
                <div className={cardStyle}>
                  <div className="p-3.5 space-y-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs shadow-sm">
                        <LuInfo className="h-3.5 w-3.5" />
                      </div>
                      <span className={`text-xs font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>Project Information</span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className={`flex items-center justify-between py-1 border-b ${isDark ? "border-white/[0.04]" : "border-black/[0.03]"}`}>
                        <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Model Name:</span>
                        <span className={`font-semibold truncate max-w-[140px] ${isDark ? "text-white" : "text-zinc-900"}`}>
                          {activeModelLabel || "Standard Project"}
                        </span>
                      </div>

                      <div className={`flex items-center justify-between py-1 border-b ${isDark ? "border-white/[0.04]" : "border-black/[0.03]"}`}>
                        <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Active Level:</span>
                        <span className={`font-semibold ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                          {currentFloorObj ? currentFloorObj.name : "All Levels"}
                        </span>
                      </div>

                      <div className={`flex items-center justify-between py-1 border-b ${isDark ? "border-white/[0.04]" : "border-black/[0.03]"}`}>
                        <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Units:</span>
                        <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>Millimeters (mm)</span>
                      </div>

                      <div className={`flex items-center justify-between py-1 border-b ${isDark ? "border-white/[0.04]" : "border-black/[0.03]"}`}>
                        <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Total Levels:</span>
                        <span className={`font-mono font-bold ${isDark ? "text-blue-400" : "text-blue-600"}`}>{floors.length}</span>
                      </div>

                      <div className={`flex items-center justify-between py-1 border-b ${isDark ? "border-white/[0.04]" : "border-black/[0.03]"}`}>
                        <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Placed Walls:</span>
                        <span className={`font-mono font-bold ${isDark ? "text-amber-400" : "text-amber-600"}`}>{walls.length}</span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>3D Shapes:</span>
                        <span className={`font-mono font-bold ${isDark ? "text-purple-400" : "text-purple-600"}`}>{placements.length}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* IFC INSPECTOR ON SELECTION */}
                <div className={`pt-2 border-t ${isDark ? "border-white/10" : "border-black/[0.06]"}`}>
                  <div className={`text-[11px] font-bold mb-2 uppercase tracking-wide ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
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
