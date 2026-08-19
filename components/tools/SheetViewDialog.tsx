"use client";

import { useState } from "react";
import {
  LuX,
  LuPrinter,
  LuPlus,
  LuTrash2,
  LuFileSpreadsheet,
} from "react-icons/lu";
import { UnifiedButton } from "@/components/common/UnifiedButton";
import {
  SHEET_DIMENSIONS_MM,
  type LayoutSheet,
  type SheetSize,
  type SheetViewport,
} from "@/lib/layoutDrawing";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useAppStore } from "@/store/useAppStore";

interface SheetViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SheetViewDialog({ isOpen, onClose }: SheetViewDialogProps) {
  const activeModelLabel = useAppStore((s) => s.activeModelLabel) || "Architectural Project";
  const walls = useLayoutDrawingStore((s) => s.walls);
  const slabs = useLayoutDrawingStore((s) => s.slabs);

  const [sheet, setSheet] = useState<LayoutSheet>(() => ({
    id: "sheet-1",
    projectId: "proj-1",
    sheetNumber: "A101",
    sheetName: "GROUND FLOOR PLAN & ELEVATION",
    sheetSize: "A3",
    projectName: activeModelLabel,
    clientName: "Client Presentation",
    author: "V Studio Architect",
    checker: "Lead Engineer",
    date: new Date().toISOString().slice(0, 10),
    scale: "1:100",
    revisions: [
      { rev: "01", desc: "Initial Concept Issue", date: new Date().toISOString().slice(0, 10) },
      { rev: "02", desc: "Layout & Openings Updated", date: new Date().toISOString().slice(0, 10) },
    ],
    viewports: [
      {
        id: "vp-1",
        viewType: "floor_plan",
        name: "Floor Plan - Level 0",
        scale: "1:100",
        xMm: 20,
        yMm: 20,
        widthMm: 260,
        heightMm: 180,
      },
    ],
    createdAt: 0,
  }));

  if (!isOpen) return null;

  const dims = SHEET_DIMENSIONS_MM[sheet.sheetSize] || SHEET_DIMENSIONS_MM.A3;

  const handlePrint = () => {
    window.print();
  };

  const addViewport = () => {
    const newVp: SheetViewport = {
      id: `vp-${Date.now()}`,
      viewType: "floor_plan",
      name: `View ${sheet.viewports.length + 1}`,
      scale: "1:100",
      xMm: 30 + sheet.viewports.length * 20,
      yMm: 30 + sheet.viewports.length * 20,
      widthMm: 180,
      heightMm: 120,
    };
    setSheet({ ...sheet, viewports: [...sheet.viewports, newVp] });
  };

  const removeViewport = (id: string) => {
    setSheet({ ...sheet, viewports: sheet.viewports.filter((v) => v.id !== id) });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-200 select-none">
      {/* Top Bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4">
        <div className="flex items-center gap-3">
          <LuFileSpreadsheet className="h-5 w-5 text-yellow-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Sheet Composition & Title Block</span>
              <span className="rounded bg-yellow-400/20 px-1.5 py-0.5 text-[10px] font-mono text-yellow-400 border border-yellow-400/30">
                {sheet.sheetNumber} — {sheet.sheetSize}
              </span>
            </h2>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Sheet Size Selector */}
          <select
            value={sheet.sheetSize}
            onChange={(e) => setSheet({ ...sheet, sheetSize: e.target.value as SheetSize })}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-200 focus:border-yellow-400 focus:outline-none"
          >
            <option value="A1">A1 (841 x 594 mm)</option>
            <option value="A2">A2 (594 x 420 mm)</option>
            <option value="A3">A3 (420 x 297 mm)</option>
            <option value="A4">A4 (297 x 210 mm)</option>
          </select>

          <UnifiedButton
            size="sm"
            variant="secondary"
            icon={<LuPlus className="h-3.5 w-3.5" />}
            onClick={addViewport}
          >
            Add Viewport
          </UnifiedButton>

          <UnifiedButton
            size="sm"
            variant="primary"
            icon={<LuPrinter className="h-3.5 w-3.5" />}
            onClick={handlePrint}
          >
            Print / Export PDF
          </UnifiedButton>

          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LuX className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Sheet Workspace */}
      <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-slate-950">
        {/* Printable Architectural Sheet */}
        <div
          id="architectural-sheet"
          style={{
            width: `${dims.widthMm * 2.2}px`,
            height: `${dims.heightMm * 2.2}px`,
            aspectRatio: `${dims.widthMm} / ${dims.heightMm}`,
          }}
          className="relative bg-white text-slate-900 shadow-2xl rounded-sm border-2 border-slate-400 p-6 flex flex-col justify-between overflow-hidden print:m-0 print:border-none print:shadow-none"
        >
          {/* Outer Border Line (Standard 10mm margin CAD frame) */}
          <div className="absolute inset-3 border-2 border-slate-900 pointer-events-none" />
          <div className="absolute inset-3.5 border border-slate-400 pointer-events-none" />

          {/* Viewports Container */}
          <div className="relative flex-1 m-2">
            {sheet.viewports.map((vp) => (
              <div
                key={vp.id}
                style={{
                  left: `${vp.xMm * 1.8}px`,
                  top: `${vp.yMm * 1.8}px`,
                  width: `${vp.widthMm * 2.2}px`,
                  height: `${vp.heightMm * 2.2}px`,
                }}
                className="absolute border border-slate-800 bg-slate-50/50 rounded flex flex-col p-2 group shadow-sm hover:border-yellow-500"
              >
                {/* Viewport Header */}
                <div className="flex items-center justify-between border-b border-slate-300 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  <span>{vp.name} ({vp.scale})</span>
                  <button
                    type="button"
                    onClick={() => removeViewport(vp.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"
                    title="Remove Viewport"
                  >
                    <LuTrash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Viewport Canvas Sketch Elements Preview */}
                <div className="flex-1 relative overflow-hidden flex items-center justify-center p-2">
                  <svg className="w-full h-full" viewBox="-5000 -5000 10000 10000">
                    {/* Grid */}
                    <defs>
                      <pattern id="sheet-grid" width="1000" height="1000" patternUnits="userSpaceOnUse">
                        <path d="M 1000 0 L 0 0 0 1000" fill="none" stroke="#e2e8f0" strokeWidth="20" />
                      </pattern>
                    </defs>
                    <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#sheet-grid)" />

                    {/* Slabs */}
                    {slabs.map((sl) => (
                      <rect
                        key={sl.id}
                        x={sl.minXmm}
                        y={sl.minYmm}
                        width={sl.maxXmm - sl.minXmm}
                        height={sl.maxYmm - sl.minYmm}
                        fill="#f1f5f9"
                        stroke="#94a3b8"
                        strokeWidth="30"
                      />
                    ))}

                    {/* Walls */}
                    {walls.map((w) => (
                      <line
                        key={w.id}
                        x1={w.startXmm}
                        y1={w.startYmm}
                        x2={w.endXmm}
                        y2={w.endYmm}
                        stroke="#0f172a"
                        strokeWidth={w.thicknessMm || 200}
                        strokeLinecap="square"
                      />
                    ))}
                  </svg>
                </div>

                {/* Viewport Bottom Label Line (Revit / CAD Standard) */}
                <div className="mt-1 pt-1 border-t border-slate-900 flex items-center justify-between text-[10px] font-bold text-slate-900">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-white text-[9px]">1</span>
                    <span>{vp.name}</span>
                  </div>
                  <span className="font-mono text-[9px]">Scale {vp.scale}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Standard Revit / CAD Title Block (Bottom Right Corner) */}
          <div className="self-end w-[420px] border-2 border-slate-900 bg-white text-slate-900 z-10 text-[10px]">
            {/* Project Header */}
            <div className="p-2.5 border-b-2 border-slate-900 flex justify-between items-center bg-slate-100">
              <div>
                <input
                  type="text"
                  value={sheet.projectName}
                  onChange={(e) => setSheet({ ...sheet, projectName: e.target.value })}
                  className="font-bold text-xs uppercase tracking-wider text-slate-900 bg-transparent border-none focus:outline-none focus:bg-yellow-100 w-64"
                />
                <div className="text-[9px] text-slate-500 font-semibold">{sheet.clientName}</div>
              </div>
              <div className="font-black text-sm tracking-tighter text-slate-900 border-2 border-slate-900 px-1.5 py-0.5">
                V STUDIO
              </div>
            </div>

            {/* Revisions Table */}
            <div className="border-b-2 border-slate-900">
              <div className="grid grid-cols-6 font-bold bg-slate-200 px-1.5 py-0.5 text-[8px] uppercase border-b border-slate-400">
                <span className="col-span-1">No.</span>
                <span className="col-span-3">Description</span>
                <span className="col-span-2 text-right">Date</span>
              </div>
              {sheet.revisions.map((r, i) => (
                <div key={i} className="grid grid-cols-6 px-1.5 py-0.5 text-[8px] border-b border-slate-200 last:border-none font-mono">
                  <span className="col-span-1 font-bold">{r.rev}</span>
                  <span className="col-span-3 font-sans truncate">{r.desc}</span>
                  <span className="col-span-2 text-right">{r.date}</span>
                </div>
              ))}
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-3 border-b-2 border-slate-900 text-[8px]">
              <div className="p-1 border-r border-slate-300">
                <span className="text-slate-500 font-semibold uppercase block">Author</span>
                <span className="font-bold">{sheet.author}</span>
              </div>
              <div className="p-1 border-r border-slate-300">
                <span className="text-slate-500 font-semibold uppercase block">Checker</span>
                <span className="font-bold">{sheet.checker}</span>
              </div>
              <div className="p-1">
                <span className="text-slate-500 font-semibold uppercase block">Date</span>
                <span className="font-bold font-mono">{sheet.date}</span>
              </div>
            </div>

            {/* Sheet Title & Number */}
            <div className="grid grid-cols-4 items-center">
              <div className="col-span-3 p-2 border-r-2 border-slate-900">
                <span className="text-slate-500 text-[8px] font-bold uppercase block">Sheet Name</span>
                <input
                  type="text"
                  value={sheet.sheetName}
                  onChange={(e) => setSheet({ ...sheet, sheetName: e.target.value })}
                  className="font-bold text-xs uppercase text-slate-900 bg-transparent border-none focus:outline-none focus:bg-yellow-100 w-full"
                />
              </div>
              <div className="col-span-1 p-2 text-center bg-slate-900 text-white">
                <span className="text-[7px] text-slate-300 uppercase block font-semibold">Sheet No.</span>
                <input
                  type="text"
                  value={sheet.sheetNumber}
                  onChange={(e) => setSheet({ ...sheet, sheetNumber: e.target.value })}
                  className="font-black text-sm text-yellow-400 bg-transparent text-center border-none focus:outline-none focus:bg-slate-800 w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
