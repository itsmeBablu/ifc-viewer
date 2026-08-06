"use client";

import { useEffect, useState } from "react";
import { sizeFieldsFor } from "@/lib/toolMarkup";
import { fromMm, toMm } from "@/lib/markupUnits";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import ColorSwatchPicker from "./ColorSwatchPicker";

function MmField({
  label,
  sceneValue,
  onCommit,
}: {
  label: string;
  sceneValue: number;
  onCommit: (scene: number) => void;
}) {
  const [text, setText] = useState(() => String(Math.round(toMm(sceneValue))));
  useEffect(() => {
    setText(String(Math.round(toMm(sceneValue))));
  }, [sceneValue]);

  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[9px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
        {label}
      </span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const n = Number(text);
            if (Number.isFinite(n)) onCommit(fromMm(n));
            else setText(String(Math.round(toMm(sceneValue))));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-full rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] text-[var(--text-body)] outline-none transition duration-150 focus:border-amber-300"
        />
        <span className="shrink-0 text-[9px] text-[var(--text-muted)]">mm</span>
      </div>
    </label>
  );
}

/** Attribute editor — mm position/size + collapsible color swatch. */
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
  const transformMode = useToolMarkupStore((s) => s.transformMode);
  const setTransformMode = useToolMarkupStore((s) => s.setTransformMode);

  const placement =
    placements.find((p) => p.id === selectedPlacementId) ?? null;
  const note = notes.find((n) => n.id === selectedNoteId) ?? null;
  const [draftNote, setDraftNote] = useState("");

  useEffect(() => {
    if (pendingNote) setDraftNote("");
  }, [pendingNote]);

  useEffect(() => {
    if (note) setDraftNote(note.text);
  }, [note?.id, note?.text]);

  const shell = `rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)]/35 p-2.5 ${className}`;

  if (pendingNote) {
    return (
      <div className={shell}>
        <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
          {t(uiLanguage, "markupNote")}
        </p>
        {(pendingNote.elementName ||
          pendingNote.expressId != null ||
          pendingNote.placementId) && (
          <p className="mb-1.5 truncate text-[9px] text-[var(--text-muted)]">
            {t(uiLanguage, "markupAttachedTo")}:{" "}
            <span className="font-semibold text-[var(--text-body)]">
              {pendingNote.elementName ??
                (pendingNote.placementId
                  ? pendingNote.placementId
                  : `#${pendingNote.expressId}`)}
            </span>
          </p>
        )}
        <textarea
          autoFocus
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
          rows={3}
          placeholder={t(uiLanguage, "markupNotePlaceholder")}
          className="mb-2 w-full resize-none rounded-xl border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] text-[var(--text-body)] outline-none focus:border-amber-300"
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
      <div className={shell}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
            {t(uiLanguage, "markupNote")}
          </p>
          <button
            type="button"
            onClick={clearSelection}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-body)]"
          >
            {t(uiLanguage, "close")}
          </button>
        </div>
        {(note.elementName || note.expressId != null || note.placementId) && (
          <p className="mb-1.5 truncate text-[9px] text-[var(--text-muted)]">
            {t(uiLanguage, "markupAttachedTo")}:{" "}
            <span className="font-semibold text-[var(--text-body)]">
              {note.elementName ?? note.placementId ?? `#${note.expressId}`}
            </span>
          </p>
        )}
        <textarea
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
          onBlur={() => {
            if (draftNote.trim() !== note.text) {
              void updateNote(note.id, { text: draftNote });
            }
          }}
          rows={3}
          className="mb-2 w-full resize-none rounded-xl border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] text-[var(--text-body)] outline-none focus:border-amber-300"
        />
        <button
          type="button"
          onClick={() => void deleteNote(note.id)}
          className="w-full rounded-xl bg-red-500/10 px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-500/15"
        >
          {t(uiLanguage, "markupDelete")}
        </button>
      </div>
    );
  }

  if (!placement) {
    return (
      <div className={`${shell} text-[11px] text-[var(--text-muted)]`}>
        {t(uiLanguage, "markupSelectIfcHint")}
      </div>
    );
  }

  const fields = sizeFieldsFor(placement.type);

  return (
    <div className={shell}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
          {t(uiLanguage, `markupShape_${placement.type}` as "markupShape_cube")}
        </p>
        <button
          type="button"
          onClick={clearSelection}
          className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-body)]"
        >
          {t(uiLanguage, "close")}
        </button>
      </div>

      <div className="mb-2 flex gap-1">
        {(
          [
            ["translate", "markupMove"],
            ["rotate", "markupRotate"],
            ["scale", "markupScale"],
          ] as const
        ).map(([mode, key]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={transformMode === mode}
            onClick={() => setTransformMode(mode)}
            className={`flex-1 rounded-lg px-1 py-1 text-[9px] font-bold transition duration-150 ${
              transformMode === mode
                ? "bg-sky-400/85 text-sky-950"
                : "bg-[var(--surface-muted)] text-[var(--text-muted)]"
            }`}
          >
            {t(uiLanguage, key)}
          </button>
        ))}
      </div>

      <div className="mb-2 grid grid-cols-3 gap-1.5">
        <MmField
          label="X"
          sceneValue={placement.posX}
          onCommit={(v) => void updatePlacement(placement.id, { posX: v })}
        />
        <MmField
          label="Y"
          sceneValue={placement.posY}
          onCommit={(v) => void updatePlacement(placement.id, { posY: v })}
        />
        <MmField
          label="Z"
          sceneValue={placement.posZ}
          onCommit={(v) => void updatePlacement(placement.id, { posZ: v })}
        />
      </div>

      <div className="mb-2 grid grid-cols-3 gap-1.5">
        {fields.map((f) => (
          <MmField
            key={f.key}
            label={f.label}
            sceneValue={placement[f.key]}
            onCommit={(v) =>
              void updatePlacement(placement.id, {
                [f.key]: Math.max(0.01, v),
              })
            }
          />
        ))}
      </div>

      <div className="mb-2 flex items-center gap-2">
        <span className="text-[9px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
          {t(uiLanguage, "markupColor")}
        </span>
        <ColorSwatchPicker
          color={placement.color}
          onChange={(hex) =>
            void updatePlacement(placement.id, { color: hex })
          }
          size="md"
        />
      </div>

      <label className="mb-2 flex flex-col gap-0.5">
        <span className="text-[9px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
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
          className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] text-[var(--text-body)] outline-none focus:border-amber-300"
        />
      </label>

      <button
        type="button"
        onClick={() => void deletePlacement(placement.id)}
        className="w-full rounded-xl bg-red-500/10 px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-500/15"
      >
        {t(uiLanguage, "markupDelete")}
      </button>
    </div>
  );
}
