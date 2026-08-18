"use client";

import { useState } from "react";
import { LuX, LuTable, LuTrash2, LuPlus, LuDownload, LuFileSpreadsheet } from "react-icons/lu";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useAppStore } from "@/store/useAppStore";
import { downloadBlob } from "@/lib/markupFragSave";

export default function RoomScheduleDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const rooms = useLayoutDrawingStore((s) => s.layoutRooms || []);
  const deleteRoom = useLayoutDrawingStore((s) => s.deleteRoom);
  const updateRoom = useLayoutDrawingStore((s) => s.updateRoom);
  const addRoom = useLayoutDrawingStore((s) => s.addRoom);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const floors = useAppStore((s) => s.floors);

  if (!isOpen) return null;

  const totalArea = rooms.reduce((acc, r) => acc + (r.areaSqM || 0), 0);

  const handleExportCsv = () => {
    let csv = "Room Number,Room Name,Level,Area (sqm)\n";
    rooms.forEach((r) => {
      const level = floors.find((f) => f.id === r.levelId)?.name || "Level 1";
      csv += `"${r.number}","${r.name}","${level}","${r.areaSqM.toFixed(2)}"\n`;
    });
    csv += `Total,,,${totalArea.toFixed(2)}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `${activeModelLabel || "project"}-room-schedule.csv`);
  };

  const handleAddDefaultRoom = () => {
    addRoom({
      name: `Room ${rooms.length + 1}`,
      number: `${rooms.length + 101}`,
      areaSqM: 18.5,
      boundaryPoints: [
        { xMm: -2000, yMm: -2000 },
        { xMm: 2000, yMm: -2000 },
        { xMm: 2000, yMm: 2000 },
        { xMm: -2000, yMm: 2000 },
      ],
      tagPosMm: { xMm: 0, yMm: 0 },
    });
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] shadow-2xl overflow-hidden flex flex-col max-h-[85dvh]">
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-[var(--panel-divider)] px-4 bg-[var(--surface-overlay)]">
          <div className="flex items-center gap-2">
            <LuFileSpreadsheet className="h-4 w-4 text-emerald-500" />
            <span className="font-bold text-sm text-[var(--text-strong)]">
              Room & Area Take-off Schedule
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>

        {/* Schedule Table */}
        <div className="flex-1 overflow-y-auto p-4 thin-scroll">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--panel-divider)] text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <th className="pb-2 pl-2">Number</th>
                <th className="pb-2">Room Name</th>
                <th className="pb-2">Level</th>
                <th className="pb-2 text-right">Area (m²)</th>
                <th className="pb-2 text-center w-12">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--panel-divider)]/40">
              {rooms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[var(--text-muted)] italic">
                    No rooms placed yet. Click "Add Room" or use the Room Tool in the Architecture ribbon.
                  </td>
                </tr>
              ) : (
                rooms.map((r) => {
                  const level = floors.find((f) => f.id === r.levelId)?.name || "Level 1 (0.00m)";
                  return (
                    <tr key={r.id} className="hover:bg-[var(--glass-inset-bg)] transition-colors">
                      <td className="py-2 pl-2 font-mono font-semibold text-[var(--text-strong)]">
                        <input
                          type="text"
                          value={r.number}
                          onChange={(e) => updateRoom(r.id, { number: e.target.value })}
                          className="w-16 rounded border border-transparent hover:border-[var(--panel-divider)] bg-transparent px-1.5 py-0.5 font-mono focus:border-amber-500 focus:bg-[var(--surface-overlay)] focus:outline-none"
                        />
                      </td>
                      <td className="py-2 font-semibold text-[var(--text-strong)]">
                        <input
                          type="text"
                          value={r.name}
                          onChange={(e) => updateRoom(r.id, { name: e.target.value })}
                          className="w-48 rounded border border-transparent hover:border-[var(--panel-divider)] bg-transparent px-1.5 py-0.5 focus:border-amber-500 focus:bg-[var(--surface-overlay)] focus:outline-none"
                        />
                      </td>
                      <td className="py-2 text-[var(--text-muted)]">{level}</td>
                      <td className="py-2 text-right font-mono font-bold text-emerald-500">
                        {r.areaSqM.toFixed(2)} m²
                      </td>
                      <td className="py-2 text-center">
                        <button
                          type="button"
                          onClick={() => deleteRoom(r.id)}
                          className="p-1 text-red-400 hover:text-red-500 transition-colors"
                        >
                          <LuTrash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--panel-divider)] font-bold text-xs">
                <td colSpan={3} className="pt-3 pl-2 text-[var(--text-strong)] uppercase">Total Building Area</td>
                <td className="pt-3 text-right font-mono text-emerald-500 text-sm">{totalArea.toFixed(2)} m²</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-3 border-t border-[var(--panel-divider)] bg-[var(--surface-overlay)]">
          <button
            type="button"
            onClick={handleAddDefaultRoom}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--text-strong)] hover:border-amber-500 transition-all"
          >
            <LuPlus className="h-4 w-4 text-amber-500" />
            <span>Add Room</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all"
            >
              <LuDownload className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-amber-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
