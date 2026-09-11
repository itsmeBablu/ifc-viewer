"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LuX,
  LuDownload,
  LuSquareCheck,
  LuSquare,
  LuLayers,
  LuFileText,
  LuInfo,
  LuLoader,
} from "react-icons/lu";
import { SiAutodesk } from "react-icons/si";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useAppStore } from "@/store/useAppStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useExportModalStore } from "@/store/useExportModalStore";
import {
  downloadSelectedFloorsCad,
  downloadSelectedFloorsPdf,
  type CadExportFormat,
} from "@/lib/cadFloorExport";

export default function FloorExportModal() {
  const isOpen = useExportModalStore((s) => s.isOpen);
  const activeFormat = useExportModalStore((s) => s.activeFormat);
  const setFormat = useExportModalStore((s) => s.setFormat);
  const close = useExportModalStore((s) => s.close);

  const levels = useLayoutDrawingStore((s) => s.levels);
  const walls = useLayoutDrawingStore((s) => s.walls);
  const doors = useLayoutDrawingStore((s) => s.doors);
  const windows = useLayoutDrawingStore((s) => s.windows);
  const appFloors = useAppStore((s) => s.floors);
  const activeLevelId = useToolMarkupStore((s) => s.markupFloorId);

  // Cad format: dxf (recommended for native AutoCAD opening) or dwg
  const [cadFormat, setCadFormat] = useState<CadExportFormat>("dxf");
  // PDF format: multipage or zip
  const [pdfAsZip, setPdfAsZip] = useState(false);
  // Busy spinner
  const [isExporting, setIsExporting] = useState(false);

  // Combined & deduplicated floor list
  const floorRows = useMemo(() => {
    const raw: {
      id: string;
      name: string;
      elevationMm: number;
      kind: "layout" | "ifc";
    }[] = [
      ...levels.map((l) => ({
        id: l.id,
        name: l.name,
        elevationMm: l.elevationMm,
        kind: "layout" as const,
      })),
      ...appFloors
        .filter((f) => !levels.some((l) => l.id === f.id))
        .map((f) => ({
          id: f.id,
          name: f.name,
          elevationMm: Math.round(f.elevation * 1000),
          kind: "ifc" as const,
        })),
    ];

    if (raw.length === 0) {
      return [{ id: "default", name: "Floor Plan (Level 0)", elevationMm: 0, kind: "layout" as const }];
    }

    return Array.from(
      raw
        .sort((a, b) => a.elevationMm - b.elevationMm)
        .reduce((unique, row) => {
          const norm = row.name.trim().toLowerCase();
          if (!unique.has(norm)) unique.set(norm, row);
          return unique;
        }, new Map<string, (typeof raw)[number]>())
        .values(),
    );
  }, [levels, appFloors]);

  // Selected floor IDs - defaults to ALL floors checked ("All sides tick")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Initialize all selected whenever modal opens or floor rows change
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(floorRows.map((f) => f.id)));
    }
  }, [isOpen, floorRows]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isExporting) close();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isExporting, close]);

  if (!isOpen) return null;

  const allSelected = floorRows.length > 0 && selectedIds.size === floorRows.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < floorRows.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(floorRows.map((f) => f.id)));
    }
  };

  const toggleFloor = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleDownload = async () => {
    if (selectedIds.size === 0 || isExporting) return;
    setIsExporting(true);
    try {
      const ids = Array.from(selectedIds);
      if (activeFormat === "cad") {
        await downloadSelectedFloorsCad(ids, cadFormat);
      } else {
        await downloadSelectedFloorsPdf(ids, pdfAsZip);
      }
      close();
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-900 text-zinc-100 shadow-2xl shadow-black/80 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/15 text-amber-400 border border-amber-400/20">
              <LuLayers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Export Floor Plans</h3>
              <p className="text-[11px] text-zinc-400">Download architectural floor drawings</p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={isExporting}
            aria-label="Close export dialog"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <LuX className="h-5 w-5" />
          </button>
        </div>

        {/* Format Selector Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/30 p-2 gap-2">
          <button
            type="button"
            onClick={() => setFormat("cad")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFormat === "cad"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent"
            }`}
          >
            <SiAutodesk className="h-4 w-4 text-sky-400" />
            <span>AutoCAD CAD (DWG / DXF)</span>
          </button>
          <button
            type="button"
            onClick={() => setFormat("pdf")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFormat === "pdf"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent"
            }`}
          >
            <LuFileText className="h-4 w-4 text-amber-400" />
            <span>Printable PDF</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
          {/* Floor Selection Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-zinc-800/60">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-xs font-bold text-zinc-200 hover:text-white transition-colors cursor-pointer"
              >
                {allSelected ? (
                  <LuSquareCheck className="h-4 w-4 text-amber-400" />
                ) : isIndeterminate ? (
                  <div className="h-4 w-4 rounded border border-amber-400 bg-amber-400/20 flex items-center justify-center">
                    <span className="h-1.5 w-2 bg-amber-400 rounded-sm" />
                  </div>
                ) : (
                  <LuSquare className="h-4 w-4 text-zinc-500" />
                )}
                <span>Select All Floors (All sides tick)</span>
              </button>
              <span className="text-[11px] font-semibold text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full">
                {selectedIds.size} of {floorRows.length} selected
              </span>
            </div>

            {/* Floor Checklist */}
            <div className="divide-y divide-zinc-800/40 rounded-xl border border-zinc-800 bg-zinc-950/40 max-h-52 overflow-y-auto">
              {floorRows.map((row) => {
                const checked = selectedIds.has(row.id);
                const wallCount = walls.filter((w) => w.levelId === row.id).length;
                const doorCount = doors.filter((d) => {
                  const w = walls.find((wall) => wall.id === d.wallId);
                  return w?.levelId === row.id;
                }).length;
                const winCount = windows.filter((win) => {
                  const w = walls.find((wall) => wall.id === win.wallId);
                  return w?.levelId === row.id;
                }).length;

                return (
                  <div
                    key={row.id}
                    onClick={() => toggleFloor(row.id)}
                    className={`flex items-center justify-between px-3.5 py-2.5 text-xs transition-colors cursor-pointer select-none ${
                      checked
                        ? "bg-amber-400/10 hover:bg-amber-400/15"
                        : "hover:bg-zinc-800/40 text-zinc-400"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {checked ? (
                        <LuSquareCheck className="h-4 w-4 text-amber-400 shrink-0" />
                      ) : (
                        <LuSquare className="h-4 w-4 text-zinc-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold truncate ${checked ? "text-zinc-100" : "text-zinc-400"}`}>
                            {row.name}
                          </span>
                          {row.id === activeLevelId && (
                            <span className="text-[9px] uppercase font-bold text-sky-400 bg-sky-500/15 px-1.5 py-0.5 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {wallCount > 0 ? `${wallCount} walls` : "Empty floor"}
                          {doorCount > 0 && ` · ${doorCount} doors`}
                          {winCount > 0 && ` · ${winCount} windows`}
                        </div>
                      </div>
                    </div>

                    <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded shrink-0">
                      {row.elevationMm >= 0 ? "+" : ""}
                      {(row.elevationMm / 1000).toFixed(2)} m
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Format Settings */}
          {activeFormat === "cad" ? (
            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                AutoCAD CAD Format
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`flex flex-col p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    cadFormat === "dxf"
                      ? "border-sky-500/60 bg-sky-500/10 text-white"
                      : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">AutoCAD DXF (.dxf)</span>
                    <span className="text-[9px] font-bold text-sky-400 bg-sky-400/20 px-1.5 py-0.5 rounded">
                      Recommended
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 leading-tight">
                    Opens natively in AutoCAD, Revit, Civil 3D & BricsCAD without errors.
                  </span>
                  <input
                    type="radio"
                    name="cadFormat"
                    value="dxf"
                    checked={cadFormat === "dxf"}
                    onChange={() => setCadFormat("dxf")}
                    className="sr-only"
                  />
                </label>

                <label
                  className={`flex flex-col p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    cadFormat === "dwg"
                      ? "border-sky-500/60 bg-sky-500/10 text-white"
                      : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">AutoCAD DWG (.dwg)</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 leading-tight">
                    Saves with .dwg extension for workflows that require the .dwg filename.
                  </span>
                  <input
                    type="radio"
                    name="cadFormat"
                    value="dwg"
                    checked={cadFormat === "dwg"}
                    onChange={() => setCadFormat("dwg")}
                    className="sr-only"
                  />
                </label>
              </div>

              {/* Notice regarding AutoCAD "Drawing file is invalid" */}
              <div className="flex items-start gap-2 rounded-lg bg-sky-950/40 border border-sky-800/40 p-2.5 text-[11px] text-sky-300">
                <LuInfo className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
                <div className="space-y-1 leading-relaxed">
                  <p className="font-semibold text-sky-200">Tip for AutoCAD users:</p>
                  <p className="text-zinc-300">
                    AutoCAD opens <strong className="text-white">.dxf</strong> natively on double-click with complete architectural layers (walls, doors, windows, slabs, gridlines, dimensions), and you can save it directly as <strong className="text-white">.dwg</strong> in AutoCAD. Renaming exchange files to .dwg triggers AutoCAD&apos;s <em>&apos;Drawing file is invalid&apos;</em> check because Autodesk requires proprietary binary headers for .dwg.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                PDF Layout Options
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`flex flex-col p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    !pdfAsZip
                      ? "border-amber-500/60 bg-amber-500/10 text-white"
                      : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  <span className="font-bold mb-1">Single Multi-Page PDF</span>
                  <span className="text-[10px] text-zinc-400 leading-tight">
                    All selected floors combined into one clean architectural sheet set.
                  </span>
                  <input
                    type="radio"
                    name="pdfMode"
                    checked={!pdfAsZip}
                    onChange={() => setPdfAsZip(false)}
                    className="sr-only"
                  />
                </label>

                <label
                  className={`flex flex-col p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    pdfAsZip
                      ? "border-amber-500/60 bg-amber-500/10 text-white"
                      : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  <span className="font-bold mb-1">Separate PDFs in .ZIP</span>
                  <span className="text-[10px] text-zinc-400 leading-tight">
                    Each floor exported as an individual PDF file bundled into a ZIP archive.
                  </span>
                  <input
                    type="radio"
                    name="pdfMode"
                    checked={pdfAsZip}
                    onChange={() => setPdfAsZip(true)}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4 bg-zinc-950/50">
          <button
            type="button"
            onClick={close}
            disabled={isExporting}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={selectedIds.size === 0 || isExporting}
            onClick={handleDownload}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all shadow-lg cursor-pointer ${
              selectedIds.size === 0
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : activeFormat === "cad"
                ? "bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-500/20 active:scale-95"
                : "bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-400/20 active:scale-95"
            }`}
          >
            {isExporting ? (
              <>
                <LuLoader className="h-4 w-4 animate-spin" />
                <span>Generating {activeFormat === "cad" ? "CAD" : "PDF"}...</span>
              </>
            ) : (
              <>
                <LuDownload className="h-4 w-4" />
                <span>
                  {selectedIds.size === 0
                    ? "Select Floors"
                    : selectedIds.size === 1
                    ? `Download Floor (${activeFormat === "cad" ? `.${cadFormat.toUpperCase()}` : ".PDF"})`
                    : `Download ${selectedIds.size} Floors (${
                        activeFormat === "cad" ? "ZIP" : pdfAsZip ? "ZIP" : "PDF Set"
                      })`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
