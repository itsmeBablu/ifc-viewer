"use client";

import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import {
  nearestParallelFaceGapMm,
  wallAngleDeg,
  wallFlipped,
  wallLengthMm,
  wallOffsetPerpendicular,
  wallRotatedAboutCenter,
  wallTranslated,
  wallWithFaceGapTo,
  wallWithLengthFromEnd,
  wallWithLengthFromStart,
} from "@/lib/layoutDrawing";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";

/**
 * Revit-style properties for selected layout wall / door / window.
 * Wall: length, endpoints, move, rotate, offset, flip, duplicate, delete.
 */
export default function LayoutPropertiesPanel({
  className = "",
}: {
  className?: string;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
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
  const deleteWall = useLayoutDrawingStore((s) => s.deleteWall);
  const deleteDoor = useLayoutDrawingStore((s) => s.deleteDoor);
  const deleteWindow = useLayoutDrawingStore((s) => s.deleteWindow);
  const deleteSlab = useLayoutDrawingStore((s) => s.deleteSlab);
  const duplicateWall = useLayoutDrawingStore((s) => s.duplicateWall);
  const duplicateDoor = useLayoutDrawingStore((s) => s.duplicateDoor);
  const duplicateWindow = useLayoutDrawingStore((s) => s.duplicateWindow);
  const duplicateSlab = useLayoutDrawingStore((s) => s.duplicateSlab);

  const wall = walls.find((w) => w.id === selectedWallId) ?? null;
  const door = doors.find((d) => d.id === selectedDoorId) ?? null;
  const win = windows.find((w) => w.id === selectedWindowId) ?? null;
  const slab = slabs.find((s) => s.id === selectedSlabId) ?? null;

  if (!wall && !door && !win && !slab) return null;

  const len = wall ? Math.round(wallLengthMm(wall)) : 0;
  const ang = wall ? Math.round(wallAngleDeg(wall) * 10) / 10 : 0;
  const nearestGap = wall
    ? nearestParallelFaceGapMm(wall, walls)
    : null;

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      {wall && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold tracking-wide text-[var(--text-strong)] uppercase">
              {t(uiLanguage, "layoutWall")}
            </p>
            <span className="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--text-muted)]">
              {t(uiLanguage, "layoutWallStraight")}
            </span>
          </div>

          {/* Dimensions */}
          <Section title={t(uiLanguage, "layoutEditDimensions")}>
            <div className="grid grid-cols-2 gap-1.5">
              <MmInput
                label={t(uiLanguage, "layoutWallLength")}
                value={len}
                onCommit={(v) =>
                  void updateWall(wall.id, wallWithLengthFromStart(wall, v))
                }
              />
              <MmInput
                label={t(uiLanguage, "layoutWallThickness")}
                value={wall.thicknessMm}
                onCommit={(v) => void updateWall(wall.id, { thicknessMm: v })}
              />
              <MmInput
                label={t(uiLanguage, "layoutLevelHeight")}
                value={wall.heightMm}
                onCommit={(v) => void updateWall(wall.id, { heightMm: v })}
              />
              <MmInput
                label={t(uiLanguage, "layoutWallAngle")}
                value={ang}
                step={0.1}
                onCommit={(v) => {
                  const delta = v - wallAngleDeg(wall);
                  void updateWall(wall.id, wallRotatedAboutCenter(wall, delta));
                }}
              />
            </div>
          </Section>

          {/* Endpoints — extend */}
          <Section title={t(uiLanguage, "layoutWallEndpoints")}>
            <p className="mb-1 text-[9px] leading-snug text-[var(--text-muted)]">
              {t(uiLanguage, "layoutWallEndpointsHint")}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <MmInput
                label="A · X"
                value={Math.round(wall.startXmm)}
                onCommit={(v) => void updateWall(wall.id, { startXmm: v })}
              />
              <MmInput
                label="A · Y"
                value={Math.round(wall.startYmm)}
                onCommit={(v) => void updateWall(wall.id, { startYmm: v })}
              />
              <MmInput
                label="B · X"
                value={Math.round(wall.endXmm)}
                onCommit={(v) => void updateWall(wall.id, { endXmm: v })}
              />
              <MmInput
                label="B · Y"
                value={Math.round(wall.endYmm)}
                onCommit={(v) => void updateWall(wall.id, { endYmm: v })}
              />
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <MmInput
                label={t(uiLanguage, "layoutExtendFromA")}
                value={len}
                onCommit={(v) =>
                  void updateWall(wall.id, wallWithLengthFromStart(wall, v))
                }
              />
              <MmInput
                label={t(uiLanguage, "layoutExtendFromB")}
                value={len}
                onCommit={(v) =>
                  void updateWall(wall.id, wallWithLengthFromEnd(wall, v))
                }
              />
            </div>
          </Section>

          {/* Move */}
          <Section title={t(uiLanguage, "layoutEditMove")}>
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  ["←", -100, 0],
                  ["→", 100, 0],
                  ["↑", 0, -100],
                  ["↓", 0, 100],
                ] as const
              ).map(([label, dx, dy]) => (
                <button
                  key={label}
                  type="button"
                  title={`${dx || dy} mm`}
                  onClick={() =>
                    void updateWall(wall.id, wallTranslated(wall, dx, dy))
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-sm font-bold hover:bg-amber-100"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <MmInput
                label="ΔX mm"
                value={0}
                key={`dx-${wall.id}-${wall.startXmm}`}
                onCommit={(v) => {
                  if (v) void updateWall(wall.id, wallTranslated(wall, v, 0));
                }}
              />
              <MmInput
                label="ΔY mm"
                value={0}
                key={`dy-${wall.id}-${wall.startYmm}`}
                onCommit={(v) => {
                  if (v) void updateWall(wall.id, wallTranslated(wall, 0, v));
                }}
              />
            </div>
          </Section>

          {/* Offset distance (perpendicular — like Revit wall offset) */}
          <Section title={t(uiLanguage, "layoutWallOffset")}>
            <p className="mb-1 text-[9px] leading-snug text-[var(--text-muted)]">
              {t(uiLanguage, "layoutWallOffsetHint")}
            </p>
            <div className="flex items-end gap-1.5">
              <MmInput
                label="mm"
                value={200}
                key={`off-${wall.id}`}
                onCommit={(v) => {
                  if (v)
                    void updateWall(wall.id, wallOffsetPerpendicular(wall, v));
                }}
              />
              <button
                type="button"
                onClick={() =>
                  void updateWall(wall.id, wallOffsetPerpendicular(wall, 200))
                }
                className="h-[34px] shrink-0 rounded-lg bg-[var(--surface-muted)] px-2.5 text-[10px] font-semibold hover:bg-amber-100"
              >
                +200
              </button>
              <button
                type="button"
                onClick={() =>
                  void updateWall(wall.id, wallOffsetPerpendicular(wall, -200))
                }
                className="h-[34px] shrink-0 rounded-lg bg-[var(--surface-muted)] px-2.5 text-[10px] font-semibold hover:bg-amber-100"
              >
                −200
              </button>
            </div>
            {nearestGap && (
              <div className="mt-1.5">
                <MmInput
                  label={t(uiLanguage, "layoutWallFaceGap")}
                  value={nearestGap.faceGapMm}
                  onCommit={(v) => {
                    const other = walls.find((w) => w.id === nearestGap.otherId);
                    if (!other) return;
                    void updateWall(
                      wall.id,
                      wallWithFaceGapTo(wall, other, v),
                    );
                  }}
                />
                <p className="mt-0.5 text-[9px] text-[var(--text-muted)]">
                  {t(uiLanguage, "layoutWallFaceGapHint")}
                </p>
              </div>
            )}
          </Section>

          {/* Rotate / Flip */}
          <Section title={t(uiLanguage, "layoutEditRotate")}>
            <div className="flex flex-wrap gap-1">
              {([-90, -15, -1, 1, 15, 90] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    void updateWall(wall.id, wallRotatedAboutCenter(wall, d))
                  }
                  className="rounded-lg bg-[var(--surface-muted)] px-2 py-1.5 text-[10px] font-bold hover:bg-amber-100"
                >
                  {d > 0 ? `+${d}°` : `${d}°`}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void updateWall(wall.id, wallFlipped(wall))}
                className="rounded-lg bg-[var(--surface-muted)] px-2 py-1.5 text-[10px] font-bold hover:bg-amber-100"
              >
                {t(uiLanguage, "layoutWallFlip")}
              </button>
            </div>
          </Section>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => void duplicateWall(wall.id)}
              className="flex-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)]/60 px-2 py-1.5 text-[11px] font-semibold hover:bg-sky-50"
            >
              {t(uiLanguage, "layoutDuplicate")}
            </button>
            <button
              type="button"
              onClick={() => void deleteWall(wall.id)}
              className="flex-1 rounded-xl bg-red-500/10 px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-500/15"
            >
              {t(uiLanguage, "markupDelete")}
            </button>
          </div>
        </>
      )}

      {door && (
        <>
          <p className="text-[10px] font-bold tracking-wide text-[var(--text-strong)] uppercase">
            {t(uiLanguage, "layoutDoor")}
          </p>
          <Section title={t(uiLanguage, "layoutEditDimensions")}>
            <div className="grid grid-cols-2 gap-1.5">
              <MmInput
                label="W mm"
                value={door.widthMm}
                onCommit={(v) => void updateDoor(door.id, { widthMm: v })}
              />
              <MmInput
                label="H mm"
                value={door.heightMm}
                onCommit={(v) => void updateDoor(door.id, { heightMm: v })}
              />
              <MmInput
                label={t(uiLanguage, "layoutAlongWall")}
                value={door.positionMm}
                onCommit={(v) => void updateDoor(door.id, { positionMm: v })}
              />
            </div>
          </Section>
          <div className="grid grid-cols-2 gap-1.5">
            <label className="flex flex-col gap-0.5">
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">
                Hinge
              </span>
              <select
                value={door.hinge}
                onChange={(e) =>
                  void updateDoor(door.id, {
                    hinge: e.target.value === "end" ? "end" : "start",
                  })
                }
                className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px]"
              >
                <option value="start">Start</option>
                <option value="end">End</option>
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">
                Swing
              </span>
              <select
                value={door.swing}
                onChange={(e) =>
                  void updateDoor(door.id, {
                    swing: e.target.value === "-1" ? -1 : 1,
                  })
                }
                className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px]"
              >
                <option value="1">+1</option>
                <option value="-1">−1</option>
              </select>
            </label>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => void duplicateDoor(door.id)}
              className="flex-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)]/60 px-2 py-1.5 text-[11px] font-semibold hover:bg-sky-50"
            >
              {t(uiLanguage, "layoutDuplicate")}
            </button>
            <button
              type="button"
              onClick={() => void deleteDoor(door.id)}
              className="flex-1 rounded-xl bg-red-500/10 px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-500/15"
            >
              {t(uiLanguage, "markupDelete")}
            </button>
          </div>
        </>
      )}

      {win && (
        <>
          <p className="text-[10px] font-bold tracking-wide text-[var(--text-strong)] uppercase">
            {t(uiLanguage, "layoutWindow")}
          </p>
          <Section title={t(uiLanguage, "layoutEditDimensions")}>
            <div className="grid grid-cols-2 gap-1.5">
              <MmInput
                label={t(uiLanguage, "layoutWindowWidth")}
                value={win.widthMm}
                onCommit={(v) => void updateWindow(win.id, { widthMm: v })}
              />
              <MmInput
                label={t(uiLanguage, "layoutWindowHeight")}
                value={win.heightMm}
                onCommit={(v) => void updateWindow(win.id, { heightMm: v })}
              />
              <MmInput
                label={t(uiLanguage, "layoutWindowSill")}
                value={win.sillHeightMm}
                onCommit={(v) =>
                  void updateWindow(win.id, { sillHeightMm: v })
                }
              />
              <MmInput
                label={t(uiLanguage, "layoutAlongWall")}
                value={win.positionMm}
                onCommit={(v) => void updateWindow(win.id, { positionMm: v })}
              />
            </div>
          </Section>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => void duplicateWindow(win.id)}
              className="flex-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)]/60 px-2 py-1.5 text-[11px] font-semibold hover:bg-sky-50"
            >
              {t(uiLanguage, "layoutDuplicate")}
            </button>
            <button
              type="button"
              onClick={() => void deleteWindow(win.id)}
              className="flex-1 rounded-xl bg-red-500/10 px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-500/15"
            >
              {t(uiLanguage, "markupDelete")}
            </button>
          </div>
        </>
      )}

      {slab && (
        <>
          <p className="text-[10px] font-bold tracking-wide text-[var(--text-strong)] uppercase">
            {t(
              uiLanguage,
              slab.kind === "roof" ? "layoutRoof" : "layoutFloor",
            )}
          </p>
          <Section title={t(uiLanguage, "layoutEditDimensions")}>
            <div className="grid grid-cols-2 gap-1.5">
              <MmInput
                label="X mm"
                value={Math.round(slab.maxXmm - slab.minXmm)}
                onCommit={(v) =>
                  void updateSlab(slab.id, {
                    maxXmm: slab.minXmm + Math.max(100, v),
                  })
                }
              />
              <MmInput
                label="Y mm"
                value={Math.round(slab.maxYmm - slab.minYmm)}
                onCommit={(v) =>
                  void updateSlab(slab.id, {
                    maxYmm: slab.minYmm + Math.max(100, v),
                  })
                }
              />
              <MmInput
                label={t(uiLanguage, "layoutSlabThickness")}
                value={slab.thicknessMm}
                onCommit={(v) =>
                  void updateSlab(slab.id, {
                    thicknessMm: Math.max(50, v),
                  })
                }
              />
              <MmInput
                label="Z offset"
                value={slab.elevationOffsetMm}
                onCommit={(v) =>
                  void updateSlab(slab.id, { elevationOffsetMm: v })
                }
              />
            </div>
          </Section>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => void duplicateSlab(slab.id)}
              className="flex-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)]/60 px-2 py-1.5 text-[11px] font-semibold hover:bg-sky-50"
            >
              {t(uiLanguage, "layoutDuplicate")}
            </button>
            <button
              type="button"
              onClick={() => void deleteSlab(slab.id)}
              className="flex-1 rounded-xl bg-red-500/10 px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-500/15"
            >
              {t(uiLanguage, "markupDelete")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--panel-divider)]/80 bg-white/40 p-2">
      <p className="mb-1.5 text-[9px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function MmInput({
  label,
  value,
  onCommit,
  step = 1,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[9px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
        {label}
      </span>
      <input
        type="number"
        step={step}
        defaultValue={value}
        key={`${label}-${value}`}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n !== value) onCommit(Math.round(n * 10) / 10);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] outline-none focus:border-sky-300"
      />
    </label>
  );
}
