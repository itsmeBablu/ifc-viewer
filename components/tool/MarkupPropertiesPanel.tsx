"use client";

import { useEffect, useState } from "react";
import { MARKUP_COLOR_PALETTE, sizeFieldsFor } from "@/lib/toolMarkup";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";

/**
 * Floating / docked properties for the selected markup shape or note.
 */
export default function MarkupPropertiesPanel({
  className = "",
}: {
  className?: string;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const placements = useToolMarkupStore((s) => s.placements);
  const notes = useToolMarkupStore((s) => s.notes);
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);
  const selectedNoteId = useToolMarkupStore((s) => s.selectedNoteId);
  const pendingNote = useToolMarkupStore((s) => s.pendingNote);
  const updatePlacement = useToolMarkupStore((s) => s.updatePlacement);
  const deletePlacement = useToolMarkupStore((s) => s.deletePlacement);
  const updateNote = useToolMarkupStore((s) => s.updateNote);
  const deleteNote = useToolMarkupStore((s) => s.deleteNote);
  const commitPendingNote = useToolMarkupStore((s) => s.commitPendingNote);
  const cancelPendingNote = useToolMarkupStore((s) => s.cancelPendingNote);
  const clearSelection = useToolMarkupStore((s) => s.clearSelection);

  const placement = placements.find((p) => p.id === selectedPlacementId) ?? null;
  const note = notes.find((n) => n.id === selectedNoteId) ?? null;
  const [draftNote, setDraftNote] = useState("");

  useEffect(() => {
    if (pendingNote) setDraftNote("");
  }, [pendingNote]);

  useEffect(() => {
    if (note) setDraftNote(note.text);
  }, [note?.id, note?.text]);

  if (pendingNote) {
    return (
      <div
        className={`rounded-2xl border border-[var(--panel-divider)] bg-[var(--glass-panel-bg,rgba(255,255,255,0.85))] p-2.5 shadow-lg backdrop-blur-md ${className}`}
      >
        <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-[var(--text-muted)]">
          {t(uiLanguage, "markupNote")}
        </p>
        <textarea
          autoFocus
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
          rows={3}
          placeholder={t(uiLanguage, "markupNotePlaceholder")}
          className="mb-2 w-full resize-none rounded-xl border border-[var(--panel-divider)] bg-white/60 px-2 py-1.5 text-[11px] text-[var(--text-body)] outline-none focus:border-amber-300"
        />
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => void commitPendingNote(draftNote)}
            className="flex-1 rounded-xl bg-amber-400/90 px-2 py-1.5 text-[11px] font-semibold text-amber-950"
          >
            {t(uiLanguage, "markupSave")}
          </button>
          <button
            type="button"
            onClick={cancelPendingNote}
            className="rounded-xl px-2 py-1.5 text-[11px] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
          >
            {t(uiLanguage, "cancel")}
          </button>
        </div>
      </div>
    );
  }

  if (note) {
    return (
      <div
        className={`rounded-2xl border border-[var(--panel-divider)] bg-[var(--glass-panel-bg,rgba(255,255,255,0.85))] p-2.5 shadow-lg backdrop-blur-md ${className}`}
      >
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)]">
            {t(uiLanguage, "markupNote")}
          </p>
          <button
            type="button"
            onClick={clearSelection}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
          >
            ✕
          </button>
        </div>
        <textarea
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
          onBlur={() => {
            if (draftNote.trim() !== note.text) {
              void updateNote(note.id, { text: draftNote.trim() });
            }
          }}
          rows={3}
          className="mb-2 w-full resize-none rounded-xl border border-[var(--panel-divider)] bg-white/60 px-2 py-1.5 text-[11px] text-[var(--text-body)] outline-none focus:border-amber-300"
        />
        <button
          type="button"
          onClick={() => void deleteNote(note.id)}
          className="w-full rounded-xl border border-red-200/80 bg-red-50/80 px-2 py-1.5 text-[11px] font-semibold text-red-700"
        >
          {t(uiLanguage, "markupDelete")}
        </button>
      </div>
    );
  }

  if (!placement) return null;

  const fields = sizeFieldsFor(placement.type);

  return (
    <div
      className={`rounded-2xl border border-[var(--panel-divider)] bg-[var(--glass-panel-bg,rgba(255,255,255,0.85))] p-2.5 shadow-lg backdrop-blur-md ${className}`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)]">
          {t(uiLanguage, `markupShape_${placement.type}`)}
        </p>
        <button
          type="button"
          onClick={clearSelection}
          className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
        >
          ✕
        </button>
      </div>

      <label className="mb-2 block">
        <span className="mb-0.5 block text-[9px] font-medium text-[var(--text-muted)]">
          {t(uiLanguage, "markupLabel")}
        </span>
        <input
          type="text"
          value={placement.label ?? ""}
          onChange={(e) =>
            void updatePlacement(placement.id, {
              label: e.target.value || null,
            })
          }
          placeholder="Heizung / Lüftung…"
          className="w-full rounded-lg border border-[var(--panel-divider)] bg-white/60 px-2 py-1 text-[11px] outline-none focus:border-amber-300"
        />
      </label>

      <div className="mb-2 space-y-1.5">
        {fields.map((f) => (
          <label key={f.key} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-[9px] font-semibold text-[var(--text-muted)]">
              {f.label}
            </span>
            <input
              type="range"
              min={f.min}
              max={f.max}
              step={f.step}
              value={placement[f.key]}
              onChange={(e) =>
                void updatePlacement(placement.id, {
                  [f.key]: Number(e.target.value),
                })
              }
              className="min-w-0 flex-1"
            />
            <input
              type="number"
              min={f.min}
              max={f.max}
              step={f.step}
              value={Number(placement[f.key].toFixed(2))}
              onChange={(e) =>
                void updatePlacement(placement.id, {
                  [f.key]: Number(e.target.value),
                })
              }
              className="w-14 rounded-md border border-[var(--panel-divider)] bg-white/60 px-1 py-0.5 text-[10px] tabular-nums outline-none"
            />
          </label>
        ))}
      </div>

      <p className="mb-1 text-[9px] font-medium text-[var(--text-muted)]">
        {t(uiLanguage, "markupColor")}
      </p>
      <div className="mb-2 flex flex-wrap gap-1">
        {MARKUP_COLOR_PALETTE.map((hex) => {
          const active = placement.color.toLowerCase() === hex.toLowerCase();
          return (
            <button
              key={hex}
              type="button"
              aria-label={hex}
              onClick={() => void updatePlacement(placement.id, { color: hex })}
              className={`h-5 w-5 rounded-full border ${
                active
                  ? "border-zinc-800 ring-1 ring-amber-400"
                  : "border-black/15"
              }`}
              style={{ backgroundColor: hex }}
            />
          );
        })}
        <label className="relative h-5 w-5 overflow-hidden rounded-full border border-[var(--panel-divider)]">
          <input
            type="color"
            value={placement.color}
            onChange={(e) =>
              void updatePlacement(placement.id, { color: e.target.value })
            }
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          <span
            className="absolute inset-0"
            style={{ backgroundColor: placement.color }}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => void deletePlacement(placement.id)}
        className="w-full rounded-xl border border-red-200/80 bg-red-50/80 px-2 py-1.5 text-[11px] font-semibold text-red-700"
      >
        {t(uiLanguage, "markupDelete")}
      </button>
    </div>
  );
}
