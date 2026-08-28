"use client";

import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import {
  beamAngleDeg,
  beamLengthMm,
  beamRotatedAboutCenter,
  beamTranslated,
  beamWithLengthFromEnd,
  beamWithLengthFromStart,
  calculateRampMetrics,
  calculateStairMetrics,
  columnTranslated,
  deriveRiseMm,
  getEquipmentConnectors,
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
 * Revit-style properties for the selected layout element.
 * Wall: length, endpoints, move, rotate, offset, flip, duplicate, delete.
 * Door / window: size + position along host wall.
 * Slab: plan size, thickness, Z offset.
 * Column: profile, width/depth/height, base/top level, position.
 * Beam: length, width/depth, angle, endpoints, Z offset.
 * Stair: shape, rise/riser/tread, 2R+T formula, railings, base/top levels.
 * Ramp: slope 1:12 ADA check, thickness, railings, base/top levels.
 */
export default function LayoutPropertiesPanel({
  className = "",
}: {
  className?: string;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const walls = useLayoutDrawingStore((s) => s.walls);
  const levels = useLayoutDrawingStore((s) => s.levels);
  const doors = useLayoutDrawingStore((s) => s.doors);
  const windows = useLayoutDrawingStore((s) => s.windows);
  const slabs = useLayoutDrawingStore((s) => s.slabs);
  const columns = useLayoutDrawingStore((s) => s.columns);
  const beams = useLayoutDrawingStore((s) => s.beams);
  const stairs = useLayoutDrawingStore((s) => s.stairs);
  const ramps = useLayoutDrawingStore((s) => s.ramps);
  const ducts = useLayoutDrawingStore((s) => s.ducts);
  const pipes = useLayoutDrawingStore((s) => s.pipes);
  const cableTrays = useLayoutDrawingStore((s) => s.cableTrays);
  const mepEquipment = useLayoutDrawingStore((s) => s.mepEquipment);
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const selectedStairId = useLayoutDrawingStore((s) => s.selectedStairId);
  const selectedRampId = useLayoutDrawingStore((s) => s.selectedRampId);
  const selectedElements = useLayoutDrawingStore((s) => s.selectedElements);
  const updateWall = useLayoutDrawingStore((s) => s.updateWall);
  const updateDoor = useLayoutDrawingStore((s) => s.updateDoor);
  const updateWindow = useLayoutDrawingStore((s) => s.updateWindow);
  const updateSlab = useLayoutDrawingStore((s) => s.updateSlab);
  const updateColumn = useLayoutDrawingStore((s) => s.updateColumn);
  const updateBeam = useLayoutDrawingStore((s) => s.updateBeam);
  const updateStair = useLayoutDrawingStore((s) => s.updateStair);
  const updateRamp = useLayoutDrawingStore((s) => s.updateRamp);
  const updateDuct = useLayoutDrawingStore((s) => s.updateDuct);
  const updatePipe = useLayoutDrawingStore((s) => s.updatePipe);
  const updateCableTray = useLayoutDrawingStore((s) => s.updateCableTray);
  const updateEquipment = useLayoutDrawingStore((s) => s.updateEquipment);
  const deleteWall = useLayoutDrawingStore((s) => s.deleteWall);
  const deleteDoor = useLayoutDrawingStore((s) => s.deleteDoor);
  const deleteWindow = useLayoutDrawingStore((s) => s.deleteWindow);
  const deleteSlab = useLayoutDrawingStore((s) => s.deleteSlab);
  const deleteColumn = useLayoutDrawingStore((s) => s.deleteColumn);
  const deleteBeam = useLayoutDrawingStore((s) => s.deleteBeam);
  const deleteStair = useLayoutDrawingStore((s) => s.deleteStair);
  const deleteRamp = useLayoutDrawingStore((s) => s.deleteRamp);
  const deleteDuct = useLayoutDrawingStore((s) => s.deleteDuct);
  const deletePipe = useLayoutDrawingStore((s) => s.deletePipe);
  const deleteCableTray = useLayoutDrawingStore((s) => s.deleteCableTray);
  const deleteEquipment = useLayoutDrawingStore((s) => s.deleteEquipment);
  const duplicateWall = useLayoutDrawingStore((s) => s.duplicateWall);
  const duplicateDoor = useLayoutDrawingStore((s) => s.duplicateDoor);
  const duplicateWindow = useLayoutDrawingStore((s) => s.duplicateWindow);
  const duplicateSlab = useLayoutDrawingStore((s) => s.duplicateSlab);
  const duplicateColumn = useLayoutDrawingStore((s) => s.duplicateColumn);
  const duplicateBeam = useLayoutDrawingStore((s) => s.duplicateBeam);
  const duplicateStair = useLayoutDrawingStore((s) => s.duplicateStair);
  const duplicateRamp = useLayoutDrawingStore((s) => s.duplicateRamp);
  const duplicateDuct = useLayoutDrawingStore((s) => s.duplicateDuct);
  const duplicatePipe = useLayoutDrawingStore((s) => s.duplicatePipe);
  const duplicateCableTray = useLayoutDrawingStore((s) => s.duplicateCableTray);
  const duplicateEquipment = useLayoutDrawingStore((s) => s.duplicateEquipment);

  const wall = walls.find((w) => w.id === selectedWallId) ?? null;
  const door = doors.find((d) => d.id === selectedDoorId) ?? null;
  const win = windows.find((w) => w.id === selectedWindowId) ?? null;
  const slab = slabs.find((s) => s.id === selectedSlabId) ?? null;
  const stair = stairs.find((st) => st.id === (selectedStairId ?? selectedElements.find((e) => e.kind === "stair")?.id)) ?? null;
  const ramp = ramps.find((rp) => rp.id === (selectedRampId ?? selectedElements.find((e) => e.kind === "ramp")?.id)) ?? null;

  const selectedColumnId = selectedElements.find((e) => e.kind === "column")?.id ?? null;
  const selectedBeamId = selectedElements.find((e) => e.kind === "beam")?.id ?? null;
  const selectedDuctId = useLayoutDrawingStore((s) => s.selectedDuctId) ?? selectedElements.find((e) => e.kind === "duct")?.id ?? null;
  const selectedPipeId = useLayoutDrawingStore((s) => s.selectedPipeId) ?? selectedElements.find((e) => e.kind === "pipe")?.id ?? null;
  const selectedCableTrayId = useLayoutDrawingStore((s) => s.selectedCableTrayId) ?? selectedElements.find((e) => e.kind === "cabletray")?.id ?? null;
  const selectedEquipmentId = useLayoutDrawingStore((s) => s.selectedEquipmentId) ?? selectedElements.find((e) => e.kind === "equipment")?.id ?? null;

  const column = columns.find((c) => c.id === selectedColumnId) ?? null;
  const beam = beams.find((b) => b.id === selectedBeamId) ?? null;
  const duct = ducts.find((d) => d.id === selectedDuctId) ?? null;
  const pipe = pipes.find((p) => p.id === selectedPipeId) ?? null;
  const tray = cableTrays.find((t) => t.id === selectedCableTrayId) ?? null;
  const equip = mepEquipment.find((eq) => eq.id === selectedEquipmentId) ?? null;

  if (!wall && !door && !win && !slab && !column && !beam && !stair && !ramp && !duct && !pipe && !tray && !equip) return null;

  const len = wall ? Math.round(wallLengthMm(wall)) : 0;
  const ang = wall ? Math.round(wallAngleDeg(wall) * 10) / 10 : 0;
  const nearestGap = wall
    ? nearestParallelFaceGapMm(wall, walls)
    : null;
  const beamLen = beam ? Math.round(beamLengthMm(beam)) : 0;
  const beamAng = beam ? Math.round(beamAngleDeg(beam) * 10) / 10 : 0;

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
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              <LevelSelect
                label="Base level"
                value={wall.levelId}
                levels={levels}
                onChange={(levelId) => {
                  const base = levels.find((level) => level.id === levelId);
                  const top = levels.find((level) => level.id === wall.topLevelId);
                  const heightMm = top && base && top.elevationMm > base.elevationMm
                    ? top.elevationMm - base.elevationMm
                    : wall.heightMm;
                  void updateWall(wall.id, { levelId, heightMm });
                }}
              />
              <LevelSelect
                label="Top level"
                value={wall.topLevelId ?? ""}
                levels={levels.filter((level) => level.elevationMm > (levels.find((item) => item.id === wall.levelId)?.elevationMm ?? -Infinity))}
                allowUnconnected
                onChange={(topLevelId) => {
                  const base = levels.find((level) => level.id === wall.levelId);
                  const top = levels.find((level) => level.id === topLevelId);
                  void updateWall(wall.id, {
                    topLevelId: topLevelId || undefined,
                    ...(base && top ? { heightMm: top.elevationMm - base.elevationMm } : {}),
                  });
                }}
              />
            </div>
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

      {column && (() => {
        const base = levels.find((level) => level.id === column.levelId);
        const top = levels.find((level) => level.id === column.topLevelId);
        const heightMm =
          column.heightMm ??
          (base && top && top.elevationMm > base.elevationMm
            ? top.elevationMm - base.elevationMm
            : base?.heightMm ?? 3000);
        return (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold tracking-wide text-[var(--text-strong)] uppercase">
                {t(uiLanguage, "layoutColumn")}
              </p>
              <span className="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--text-muted)]">
                {t(
                  uiLanguage,
                  column.profile === "circle"
                    ? "layoutProfileCircle"
                    : "layoutProfileRect",
                )}
              </span>
            </div>

            {/* Dimensions */}
            <Section title={t(uiLanguage, "layoutEditDimensions")}>
              <div className="mb-2 grid grid-cols-2 gap-1.5">
                <LevelSelect
                  label="Base level"
                  value={column.levelId}
                  levels={levels}
                  onChange={(levelId) => {
                    const nextBase = levels.find((level) => level.id === levelId);
                    const nextTop = levels.find((level) => level.id === column.topLevelId);
                    const nextHeight =
                      nextBase && nextTop && nextTop.elevationMm > nextBase.elevationMm
                        ? nextTop.elevationMm - nextBase.elevationMm
                        : column.heightMm;
                    void updateColumn(column.id, {
                      levelId,
                      ...(nextHeight != null ? { heightMm: nextHeight } : {}),
                    });
                  }}
                />
                <LevelSelect
                  label="Top level"
                  value={column.topLevelId ?? ""}
                  levels={levels.filter((level) => level.elevationMm > (levels.find((item) => item.id === column.levelId)?.elevationMm ?? -Infinity))}
                  allowUnconnected
                  onChange={(topLevelId) => {
                    const nextBase = levels.find((level) => level.id === column.levelId);
                    const nextTop = levels.find((level) => level.id === topLevelId);
                    void updateColumn(column.id, {
                      topLevelId: topLevelId || undefined,
                      ...(nextBase && nextTop && nextTop.elevationMm > nextBase.elevationMm
                        ? { heightMm: nextTop.elevationMm - nextBase.elevationMm }
                        : {}),
                    });
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <MmInput
                  label={t(uiLanguage, "layoutWidth")}
                  value={column.widthMm}
                  onCommit={(v) =>
                    void updateColumn(column.id, { widthMm: Math.max(50, v) })
                  }
                />
                <MmInput
                  label={t(uiLanguage, "layoutDepth")}
                  value={column.depthMm}
                  onCommit={(v) =>
                    void updateColumn(column.id, { depthMm: Math.max(50, v) })
                  }
                />
                <MmInput
                  label={t(uiLanguage, "layoutHeight")}
                  value={Math.round(heightMm)}
                  onCommit={(v) =>
                    void updateColumn(column.id, {
                      heightMm: Math.max(100, v),
                      topLevelId: undefined,
                    })
                  }
                />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <span className="mr-0.5 text-[9px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
                  {t(uiLanguage, "layoutProfile")}
                </span>
                {(["rect", "circle"] as const).map((profile) => (
                  <button
                    key={profile}
                    type="button"
                    aria-pressed={column.profile === profile}
                    onClick={() => void updateColumn(column.id, { profile })}
                    className={`rounded-lg px-2 py-1 text-[10px] font-bold ${column.profile === profile
                        ? "bg-zinc-800 text-white"
                        : "bg-[var(--surface-muted)] text-[var(--text-body)] hover:bg-amber-100"
                      }`}
                  >
                    {t(
                      uiLanguage,
                      profile === "circle"
                        ? "layoutProfileCircle"
                        : "layoutProfileRect",
                    )}
                  </button>
                ))}
              </div>
            </Section>

            {/* Position */}
            <Section title={t(uiLanguage, "layoutEditMove")}>
              <div className="grid grid-cols-2 gap-1.5">
                <MmInput
                  label="X mm"
                  value={Math.round(column.xMm)}
                  onCommit={(v) => void updateColumn(column.id, { xMm: v })}
                />
                <MmInput
                  label="Y mm"
                  value={Math.round(column.yMm)}
                  onCommit={(v) => void updateColumn(column.id, { yMm: v })}
                />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
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
                      void updateColumn(
                        column.id,
                        columnTranslated(column, dx, dy),
                      )
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
                  key={`dx-${column.id}-${column.xMm}`}
                  onCommit={(v) => {
                    if (v)
                      void updateColumn(
                        column.id,
                        columnTranslated(column, v, 0),
                      );
                  }}
                />
                <MmInput
                  label="ΔY mm"
                  value={0}
                  key={`dy-${column.id}-${column.yMm}`}
                  onCommit={(v) => {
                    if (v)
                      void updateColumn(
                        column.id,
                        columnTranslated(column, 0, v),
                      );
                  }}
                />
              </div>
            </Section>

            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => void duplicateColumn(column.id)}
                className="flex-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)]/60 px-2 py-1.5 text-[11px] font-semibold hover:bg-sky-50"
              >
                {t(uiLanguage, "layoutDuplicate")}
              </button>
              <button
                type="button"
                onClick={() => void deleteColumn(column.id)}
                className="flex-1 rounded-xl bg-red-500/10 px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-500/15"
              >
                {t(uiLanguage, "markupDelete")}
              </button>
            </div>
          </>
        );
      })()}

      {beam && (
        <>
          <p className="text-[10px] font-bold tracking-wide text-[var(--text-strong)] uppercase">
            {t(uiLanguage, "layoutBeam")}
          </p>

          {/* Dimensions */}
          <Section title={t(uiLanguage, "layoutEditDimensions")}>
            <div className="mb-2">
              <LevelSelect
                label="Reference level"
                value={beam.levelId}
                levels={levels}
                onChange={(levelId) => void updateBeam(beam.id, { levelId })}
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <MmInput
                label={t(uiLanguage, "layoutLength")}
                value={beamLen}
                onCommit={(v) =>
                  void updateBeam(beam.id, beamWithLengthFromStart(beam, v))
                }
              />
              <MmInput
                label={t(uiLanguage, "layoutWallAngle")}
                value={beamAng}
                step={0.1}
                onCommit={(v) => {
                  const delta = v - beamAngleDeg(beam);
                  void updateBeam(
                    beam.id,
                    beamRotatedAboutCenter(beam, delta),
                  );
                }}
              />
              <MmInput
                label={t(uiLanguage, "layoutWidth")}
                value={beam.widthMm}
                onCommit={(v) =>
                  void updateBeam(beam.id, { widthMm: Math.max(50, v) })
                }
              />
              <MmInput
                label={t(uiLanguage, "layoutHeight")}
                value={beam.depthMm}
                onCommit={(v) =>
                  void updateBeam(beam.id, { depthMm: Math.max(50, v) })
                }
              />
              <MmInput
                label={t(uiLanguage, "layoutZOffset")}
                value={beam.elevationOffsetMm}
                onCommit={(v) =>
                  void updateBeam(beam.id, { elevationOffsetMm: v })
                }
              />
            </div>
          </Section>

          {/* Endpoints — extend */}
          <Section title={t(uiLanguage, "layoutWallEndpoints")}>
            <div className="grid grid-cols-2 gap-1.5">
              <MmInput
                label="A · X"
                value={Math.round(beam.startXmm)}
                onCommit={(v) => void updateBeam(beam.id, { startXmm: v })}
              />
              <MmInput
                label="A · Y"
                value={Math.round(beam.startYmm)}
                onCommit={(v) => void updateBeam(beam.id, { startYmm: v })}
              />
              <MmInput
                label="B · X"
                value={Math.round(beam.endXmm)}
                onCommit={(v) => void updateBeam(beam.id, { endXmm: v })}
              />
              <MmInput
                label="B · Y"
                value={Math.round(beam.endYmm)}
                onCommit={(v) => void updateBeam(beam.id, { endYmm: v })}
              />
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <MmInput
                label={t(uiLanguage, "layoutExtendFromA")}
                value={beamLen}
                onCommit={(v) =>
                  void updateBeam(beam.id, beamWithLengthFromStart(beam, v))
                }
              />
              <MmInput
                label={t(uiLanguage, "layoutExtendFromB")}
                value={beamLen}
                onCommit={(v) =>
                  void updateBeam(beam.id, beamWithLengthFromEnd(beam, v))
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
                    void updateBeam(beam.id, beamTranslated(beam, dx, dy))
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
                key={`dx-${beam.id}-${beam.startXmm}`}
                onCommit={(v) => {
                  if (v)
                    void updateBeam(beam.id, beamTranslated(beam, v, 0));
                }}
              />
              <MmInput
                label="ΔY mm"
                value={0}
                key={`dy-${beam.id}-${beam.startYmm}`}
                onCommit={(v) => {
                  if (v)
                    void updateBeam(beam.id, beamTranslated(beam, 0, v));
                }}
              />
            </div>
          </Section>

          {/* Rotate */}
          <Section title={t(uiLanguage, "layoutEditRotate")}>
            <div className="flex flex-wrap gap-1">
              {([-90, -15, -1, 1, 15, 90] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    void updateBeam(beam.id, beamRotatedAboutCenter(beam, d))
                  }
                  className="rounded-lg bg-[var(--surface-muted)] px-2 py-1.5 text-[10px] font-bold hover:bg-amber-100"
                >
                  {d > 0 ? `+${d}°` : `${d}°`}
                </button>
              ))}
            </div>
          </Section>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => void duplicateBeam(beam.id)}
              className="flex-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)]/60 px-2 py-1.5 text-[11px] font-semibold hover:bg-sky-50"
            >
              {t(uiLanguage, "layoutDuplicate")}
            </button>
            <button
              type="button"
              onClick={() => void deleteBeam(beam.id)}
              className="flex-1 rounded-xl bg-red-500/10 px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-500/15"
            >
              {t(uiLanguage, "markupDelete")}
            </button>
          </div>
        </>
      )}

      {stair && (() => {
        const riseMm = deriveRiseMm(levels, stair.levelId, stair.topLevelId, stair.baseOffsetMm, stair.topOffsetMm);
        const metrics = calculateStairMetrics(riseMm, stair.targetRiserHeightMm, stair.treadDepthMm);
        const isComfortable = metrics.strideValue >= 600 && metrics.strideValue <= 650;
        return (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold tracking-wide text-[var(--text-strong)] uppercase">
                Stair ({stair.stairType})
              </p>
              <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-bold text-sky-600 uppercase">
                {metrics.riserCount} Risers
              </span>
            </div>

            <Section title="Constraints">
              <div className="grid grid-cols-2 gap-2">
                <LevelSelect
                  label="Base Level"
                  value={stair.levelId}
                  levels={levels}
                  onChange={(id) => void updateStair(stair.id, { levelId: id })}
                />
                <MmInput
                  label="Base Offset"
                  value={stair.baseOffsetMm ?? 0}
                  onCommit={(v) => void updateStair(stair.id, { baseOffsetMm: v })}
                />
                <LevelSelect
                  label="Top Level"
                  value={stair.topLevelId ?? ""}
                  levels={levels}
                  allowUnconnected={false}
                  onChange={(id) => void updateStair(stair.id, { topLevelId: id })}
                />
                <MmInput
                  label="Top Offset"
                  value={stair.topOffsetMm ?? 0}
                  onCommit={(v) => void updateStair(stair.id, { topOffsetMm: v })}
                />
              </div>
              <div className="mt-2 rounded-lg bg-[var(--surface-muted)]/60 px-2 py-1.5 text-[11px] font-medium flex justify-between">
                <span className="text-[var(--text-muted)]">Total Rise:</span>
                <span className="font-bold text-[var(--text-strong)]">{Math.round(riseMm)} mm</span>
              </div>
            </Section>

            <Section title="Dimensions & Shape">
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">Stair Type</span>
                  <select
                    value={stair.stairType}
                    onChange={(e) => void updateStair(stair.id, { stairType: e.target.value as any })}
                    className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] outline-none focus:border-sky-300"
                  >
                    <option value="straight">Straight Run</option>
                    <option value="l-shape">L-Shape (Quarter-Turn 90°)</option>
                    <option value="u-shape">U-Shape (Switchback 180°)</option>
                    <option value="spiral">Circular / Spiral (Helical)</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <MmInput
                    label="Run Width"
                    value={stair.widthMm}
                    onCommit={(v) => void updateStair(stair.id, { widthMm: v })}
                  />
                  <MmInput
                    label="Target Riser"
                    value={stair.targetRiserHeightMm}
                    onCommit={(v) => void updateStair(stair.id, { targetRiserHeightMm: v })}
                  />
                  <MmInput
                    label="Tread Depth"
                    value={stair.treadDepthMm}
                    onCommit={(v) => void updateStair(stair.id, { treadDepthMm: v })}
                  />
                  <MmInput
                    label="Nosing"
                    value={stair.nosingDepthMm ?? 25}
                    onCommit={(v) => void updateStair(stair.id, { nosingDepthMm: v })}
                  />
                </div>
              </div>
            </Section>

            <Section title="Calculated Rules & Comfort">
              <div className="flex flex-col gap-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Actual Riser:</span>
                  <span className="font-bold">{metrics.actualRiserMm} mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Riser Count:</span>
                  <span className="font-bold">{metrics.riserCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Tread Count:</span>
                  <span className="font-bold">{metrics.treadCount}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-[var(--panel-divider)]/60">
                  <span className="text-[var(--text-muted)]">2R + T Stride:</span>
                  <span className={`font-mono font-bold ${isComfortable ? "text-emerald-600" : "text-amber-600"}`}>
                    {Math.round(metrics.strideValue)} mm
                  </span>
                </div>
                <div className={`mt-1 rounded-md px-2 py-1 text-[10px] font-medium leading-tight ${isComfortable ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>
                  {isComfortable ? "✓ Optimum Stride Comfort (600–650mm)" : "⚠ Outside standard stride range (600–650mm)"}
                </div>
              </div>
            </Section>

            <Section title="Railings">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4 text-[11px]">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stair.hasRailingLeft !== false}
                      onChange={(e) => void updateStair(stair.id, { hasRailingLeft: e.target.checked })}
                      className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span>Left Railing</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stair.hasRailingRight !== false}
                      onChange={(e) => void updateStair(stair.id, { hasRailingRight: e.target.checked })}
                      className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span>Right Railing</span>
                  </label>
                </div>
                <MmInput
                  label="Railing Height"
                  value={stair.railingHeightMm ?? 900}
                  onCommit={(v) => void updateStair(stair.id, { railingHeightMm: v })}
                />
              </div>
            </Section>

            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => void duplicateStair(stair.id)}
                className="flex-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)]/60 px-2 py-1.5 text-[11px] font-semibold hover:bg-sky-50"
              >
                {t(uiLanguage, "layoutDuplicate")}
              </button>
              <button
                type="button"
                onClick={() => void deleteStair(stair.id)}
                className="flex-1 rounded-xl bg-red-500/10 px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-500/15"
              >
                {t(uiLanguage, "markupDelete")}
              </button>
            </div>
          </>
        );
      })()}

      {ramp && (() => {
        const riseMm = deriveRiseMm(levels, ramp.levelId, ramp.topLevelId, ramp.baseOffsetMm, ramp.topOffsetMm);
        const runLengthMm = Math.hypot(ramp.endXmm - ramp.startXmm, ramp.endYmm - ramp.startYmm);
        const metrics = calculateRampMetrics(riseMm, runLengthMm);
        const isAdaCompliant = !metrics.exceedsMaxSlope;
        const slopeRatioText = Number.isFinite(metrics.slopeRatio) ? `1:${metrics.slopeRatio.toFixed(1)}` : "Level";
        return (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold tracking-wide text-[var(--text-strong)] uppercase">
                Ramp
              </p>
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${isAdaCompliant ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                {slopeRatioText}
              </span>
            </div>

            <Section title="Constraints">
              <div className="grid grid-cols-2 gap-2">
                <LevelSelect
                  label="Base Level"
                  value={ramp.levelId}
                  levels={levels}
                  onChange={(id) => void updateRamp(ramp.id, { levelId: id })}
                />
                <MmInput
                  label="Base Offset"
                  value={ramp.baseOffsetMm ?? 0}
                  onCommit={(v) => void updateRamp(ramp.id, { baseOffsetMm: v })}
                />
                <LevelSelect
                  label="Top Level"
                  value={ramp.topLevelId ?? ""}
                  levels={levels}
                  allowUnconnected={false}
                  onChange={(id) => void updateRamp(ramp.id, { topLevelId: id })}
                />
                <MmInput
                  label="Top Offset"
                  value={ramp.topOffsetMm ?? 0}
                  onCommit={(v) => void updateRamp(ramp.id, { topOffsetMm: v })}
                />
              </div>
              <div className="mt-2 rounded-lg bg-[var(--surface-muted)]/60 px-2 py-1.5 text-[11px] font-medium flex justify-between">
                <span className="text-[var(--text-muted)]">Total Rise:</span>
                <span className="font-bold text-[var(--text-strong)]">{Math.round(riseMm)} mm</span>
              </div>
            </Section>

            <Section title="Dimensions">
              <div className="grid grid-cols-2 gap-2">
                <MmInput
                  label="Width"
                  value={ramp.widthMm}
                  onCommit={(v) => void updateRamp(ramp.id, { widthMm: v })}
                />
                <MmInput
                  label="Thickness"
                  value={ramp.thicknessMm}
                  onCommit={(v) => void updateRamp(ramp.id, { thicknessMm: v })}
                />
              </div>
              <div className="mt-2 rounded-lg bg-[var(--surface-muted)]/60 px-2 py-1.5 text-[11px] font-medium flex justify-between">
                <span className="text-[var(--text-muted)]">Run Length:</span>
                <span className="font-bold text-[var(--text-strong)]">{Math.round(runLengthMm)} mm</span>
              </div>
            </Section>

            <Section title="Slope & Accessibility">
              <div className="flex flex-col gap-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Slope Ratio:</span>
                  <span className="font-bold">{slopeRatioText}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Slope Grade:</span>
                  <span className="font-bold">{metrics.slopePercent}%</span>
                </div>
                <div className={`mt-1 rounded-md px-2 py-1 text-[10px] font-medium leading-tight ${isAdaCompliant ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>
                  {isAdaCompliant ? "✓ ADA Compliant Slope (≤ 1:12 / 8.33%)" : "⚠ Steeper than ADA max slope 1:12 (8.33%)"}
                </div>
              </div>
            </Section>

            <Section title="Railings & Curbs">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4 text-[11px]">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ramp.hasRailingLeft !== false}
                      onChange={(e) => void updateRamp(ramp.id, { hasRailingLeft: e.target.checked })}
                      className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span>Left Railing</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ramp.hasRailingRight !== false}
                      onChange={(e) => void updateRamp(ramp.id, { hasRailingRight: e.target.checked })}
                      className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span>Right Railing</span>
                  </label>
                </div>
                <MmInput
                  label="Railing Height"
                  value={ramp.railingHeightMm ?? 900}
                  onCommit={(v) => void updateRamp(ramp.id, { railingHeightMm: v })}
                />
              </div>
            </Section>

            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => void duplicateRamp(ramp.id)}
                className="flex-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)]/60 px-2 py-1.5 text-[11px] font-semibold hover:bg-sky-50"
              >
                {t(uiLanguage, "layoutDuplicate")}
              </button>
              <button
                type="button"
                onClick={() => void deleteRamp(ramp.id)}
                className="flex-1 rounded-xl bg-red-500/10 px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-500/15"
              >
                {t(uiLanguage, "markupDelete")}
              </button>
            </div>
          </>
        );
      })()}

      {/* -- DUCT INSPECTOR ---------------------------------------------------- */}
      {duct && (() => {
        const dx = duct.endXmm - duct.startXmm;
        const dy = duct.endYmm - duct.startYmm;
        const ductLen = Math.round(Math.hypot(dx, dy));
        const areaSqM = duct.shape === "round"
          ? Math.PI * Math.pow((duct.diameterMm ?? 200) / 2000, 2)
          : duct.shape === "oval"
          ? (((duct.widthMm ?? 300) * (duct.heightMm ?? 200)) - (4 - Math.PI) * Math.pow((duct.heightMm ?? 200) / 2, 2)) / 1_000_000
          : ((duct.widthMm ?? 300) * (duct.heightMm ?? 200)) / 1_000_000;
        const flow = duct.flowM3h ?? 250;
        const velocity = Math.round((flow / (3600 * Math.max(0.001, areaSqM))) * 10) / 10;

        return (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold tracking-wide text-cyan-400 uppercase">
                Air Duct ({duct.shape})
              </p>
              <span className="rounded-md bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-bold text-cyan-400 uppercase">
                {duct.systemType}
              </span>
            </div>

            <Section title="Duct Geometry & Profile">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">Profile</span>
                  <select
                    value={duct.shape}
                    onChange={(e) => void updateDuct(duct.id, { shape: e.target.value as any })}
                    className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] outline-none"
                  >
                    <option value="rectangular">Rectangular</option>
                    <option value="round">Round (Spiral)</option>
                    <option value="oval">Flat Oval</option>
                  </select>
                </label>

                <label className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">System</span>
                  <select
                    value={duct.systemType}
                    onChange={(e) => void updateDuct(duct.id, { systemType: e.target.value as any })}
                    className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] outline-none font-semibold text-cyan-500"
                  >
                    <option value="supply">Supply (Zuluft)</option>
                    <option value="extract">Extract (Abluft)</option>
                    <option value="exhaust">Exhaust (Fortluft)</option>
                    <option value="outdoor">Outside (Außenluft)</option>
                  </select>
                </label>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                {duct.shape !== "round" ? (
                  <>
                    <MmInput
                      label="Width"
                      value={duct.widthMm ?? 300}
                      onCommit={(v) => void updateDuct(duct.id, { widthMm: v })}
                    />
                    <MmInput
                      label="Height"
                      value={duct.heightMm ?? 200}
                      onCommit={(v) => void updateDuct(duct.id, { heightMm: v })}
                    />
                  </>
                ) : (
                  <MmInput
                    label="Diameter"
                    value={duct.diameterMm ?? 200}
                    onCommit={(v) => void updateDuct(duct.id, { diameterMm: v })}
                  />
                )}
                <MmInput
                  label="Center Elev"
                  value={duct.elevationMm ?? duct.elevationOffsetMm ?? 2600}
                  onCommit={(v) => void updateDuct(duct.id, { elevationMm: v })}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>Run Length:</span>
                <span className="font-mono font-bold text-[var(--text-strong)]">{ductLen} mm</span>
              </div>
            </Section>

            <Section title="Airflow & Aerodynamics">
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">Design Flow (m³/h)</span>
                  <input
                    type="number"
                    defaultValue={duct.flowM3h ?? 250}
                    onBlur={(e) => void updateDuct(duct.id, { flowM3h: Number(e.target.value) })}
                    className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] outline-none font-mono"
                  />
                </label>

                <div className="flex items-center justify-between rounded-lg bg-[var(--surface-overlay)] p-2 text-xs">
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Velocity (v)</div>
                    <div className="font-mono font-bold text-sm text-[var(--text-strong)]">{velocity} m/s</div>
                  </div>
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                    velocity <= 3.5 ? "bg-emerald-500/20 text-emerald-500" : velocity <= 5.0 ? "bg-amber-500/20 text-amber-500" : "bg-rose-500/20 text-rose-500"
                  }`}>
                    {velocity <= 3.5 ? "Quiet (Comfort)" : velocity <= 5.0 ? "Standard" : "High Noise Risk"}
                  </span>
                </div>
              </div>
            </Section>

            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => void duplicateDuct(duct.id)}
                className="flex-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)]/60 px-2 py-1.5 text-[11px] font-semibold hover:bg-sky-50"
              >
                {t(uiLanguage, "layoutDuplicate")}
              </button>
              <button
                type="button"
                onClick={() => void deleteDuct(duct.id)}
                className="flex-1 rounded-xl bg-red-500/10 px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-500/15"
              >
                {t(uiLanguage, "markupDelete")}
              </button>
            </div>
          </>
        );
      })()}

      {/* -- PIPE INSPECTOR ---------------------------------------------------- */}
      {pipe && (() => {
        const dx = pipe.endXmm - pipe.startXmm;
        const dy = pipe.endYmm - pipe.startYmm;
        const pipeLen = Math.round(Math.hypot(dx, dy));

        return (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold tracking-wide text-blue-400 uppercase">
                Pipe Run (DN{pipe.diameterMm})
              </p>
              <span className="rounded-md bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-400 uppercase">
                {pipe.systemType}
              </span>
            </div>

            <Section title="Pipe Properties">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">System</span>
                  <select
                    value={pipe.systemType}
                    onChange={(e) => void updatePipe(pipe.id, { systemType: e.target.value as any })}
                    className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] outline-none font-semibold text-blue-500"
                  >
                    <option value="hydronic_supply">Heating Supply</option>
                    <option value="hydronic_return">Heating Return</option>
                    <option value="domestic_cold">Cold Water</option>
                    <option value="domestic_hot">Hot Water</option>
                    <option value="sanitary_waste">Sanitary Waste</option>
                    <option value="gas">Gas Pipe</option>
                  </select>
                </label>

                <MmInput
                  label="Outer Diameter"
                  value={pipe.diameterMm}
                  onCommit={(v) => void updatePipe(pipe.id, { diameterMm: v })}
                />
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <MmInput
                  label="Elevation"
                  value={pipe.elevationMm ?? pipe.elevationOffsetMm ?? 2700}
                  onCommit={(v) => void updatePipe(pipe.id, { elevationMm: v })}
                />
                <label className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">Slope (%)</span>
                  <input
                    type="number"
                    step={0.1}
                    defaultValue={pipe.slopePercent ?? 0}
                    onBlur={(e) => void updatePipe(pipe.id, { slopePercent: Number(e.target.value) })}
                    className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] outline-none font-mono"
                  />
                </label>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>Run Length:</span>
                <span className="font-mono font-bold text-[var(--text-strong)]">{pipeLen} mm</span>
              </div>
            </Section>

            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => void duplicatePipe(pipe.id)}
                className="flex-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)]/60 px-2 py-1.5 text-[11px] font-semibold hover:bg-sky-50"
              >
                {t(uiLanguage, "layoutDuplicate")}
              </button>
              <button
                type="button"
                onClick={() => void deletePipe(pipe.id)}
                className="flex-1 rounded-xl bg-red-500/10 px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-500/15"
              >
                {t(uiLanguage, "markupDelete")}
              </button>
            </div>
          </>
        );
      })()}

      {/* -- CABLE TRAY INSPECTOR ---------------------------------------------- */}
      {tray && (() => {
        const dx = tray.endXmm - tray.startXmm;
        const dy = tray.endYmm - tray.startYmm;
        const trayLen = Math.round(Math.hypot(dx, dy));

        return (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold tracking-wide text-slate-300 uppercase">
                Cable Tray ({tray.trayType})
              </p>
              <span className="rounded-md bg-slate-500/20 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 uppercase">
                {tray.widthMm}×{tray.heightMm}
              </span>
            </div>

            <Section title="Tray Properties">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">Tray Type</span>
                  <select
                    value={tray.trayType}
                    onChange={(e) => void updateCableTray(tray.id, { trayType: e.target.value as any })}
                    className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] outline-none"
                  >
                    <option value="ladder">Ladder</option>
                    <option value="perforated">Perforated</option>
                    <option value="wire_mesh">Wire Mesh</option>
                    <option value="conduit">Conduit</option>
                  </select>
                </label>

                <MmInput
                  label="Elevation"
                  value={tray.elevationMm ?? tray.elevationOffsetMm ?? 2800}
                  onCommit={(v) => void updateCableTray(tray.id, { elevationMm: v })}
                />
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <MmInput
                  label="Width"
                  value={tray.widthMm}
                  onCommit={(v) => void updateCableTray(tray.id, { widthMm: v })}
                />
                <MmInput
                  label="Height"
                  value={tray.heightMm}
                  onCommit={(v) => void updateCableTray(tray.id, { heightMm: v })}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>Tray Length:</span>
                <span className="font-mono font-bold text-[var(--text-strong)]">{trayLen} mm</span>
              </div>
            </Section>

            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => void duplicateCableTray(tray.id)}
                className="flex-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)]/60 px-2 py-1.5 text-[11px] font-semibold hover:bg-sky-50"
              >
                {t(uiLanguage, "layoutDuplicate")}
              </button>
              <button
                type="button"
                onClick={() => void deleteCableTray(tray.id)}
                className="flex-1 rounded-xl bg-red-500/10 px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-500/15"
              >
                {t(uiLanguage, "markupDelete")}
              </button>
            </div>
          </>
        );
      })()}

      {/* -- MEP EQUIPMENT INSPECTOR ------------------------------------------- */}
      {equip && (() => {
        const connectors = getEquipmentConnectors(equip);
        const isRadiator = equip.category === "radiator";
        const isCooling = equip.category === "fan_coil" || equip.category === "ac_unit" || equip.category === "chiller";
        const defW = isRadiator ? 1000 : equip.category === "fan_coil" ? 900 : equip.category === "ac_unit" ? 850 : equip.category === "chiller" ? 1600 : 400;
        const defH = isRadiator ? 600 : equip.category === "fan_coil" ? 250 : equip.category === "ac_unit" ? 290 : equip.category === "chiller" ? 1200 : 400;
        const defD = isRadiator ? 100 : equip.category === "fan_coil" ? 600 : equip.category === "ac_unit" ? 210 : equip.category === "chiller" ? 800 : 400;

        return (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold tracking-wide text-amber-400 uppercase">
                {equip.name || "MEP Equipment"}
              </p>
              <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-400 uppercase">
                {equip.category}
              </span>
            </div>

            <Section title="Equipment Category">
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">Category</span>
                  <select
                    value={equip.category}
                    onChange={(e) => void updateEquipment(equip.id, { category: e.target.value as any })}
                    className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] outline-none text-amber-500 font-semibold"
                  >
                    <option value="radiator">Heating Radiator</option>
                    <option value="fan_coil">Fan Coil Unit (FCU)</option>
                    <option value="ac_unit">AC Indoor Split Unit</option>
                    <option value="chiller">Chiller / Heat Pump Unit</option>
                    <option value="diffuser_supply">Supply Diffuser (Zuluft)</option>
                    <option value="diffuser_extract">Extract Diffuser (Abluft)</option>
                    <option value="diffuser_overflow">Overflow Grille (Überströmung)</option>
                    <option value="panel">Electrical Panel</option>
                    <option value="socket">Power Socket Outlet</option>
                    <option value="light">Light Fixture</option>
                    <option value="sink">Wash Basin / Sink</option>
                    <option value="toilet">Toilet (WC)</option>
                  </select>
                </label>
              </div>
            </Section>

            {/* Procedural Dimensions (Live Dimension Editing) */}
            <Section title="Procedural Dimensions">
              <div className="grid grid-cols-3 gap-1.5">
                <MmInput
                  label="Width"
                  value={equip.widthMm ?? defW}
                  onCommit={(v) => void updateEquipment(equip.id, { widthMm: v })}
                />
                <MmInput
                  label="Height"
                  value={equip.heightMm ?? defH}
                  onCommit={(v) => void updateEquipment(equip.id, { heightMm: v })}
                />
                <MmInput
                  label="Depth"
                  value={equip.depthMm ?? defD}
                  onCommit={(v) => void updateEquipment(equip.id, { depthMm: v })}
                />
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <MmInput
                  label="Elevation"
                  value={equip.elevationMm ?? equip.elevationOffsetMm ?? 0}
                  onCommit={(v) => void updateEquipment(equip.id, { elevationMm: v })}
                />
                <label className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">Rotation (°)</span>
                  <input
                    type="number"
                    defaultValue={equip.rotationDeg ?? 0}
                    onBlur={(e) => void updateEquipment(equip.id, { rotationDeg: Number(e.target.value) })}
                    className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] outline-none font-mono"
                  />
                </label>
              </div>
            </Section>

            {/* Heating / Cooling / Airflow Capacity */}
            {(isRadiator || isCooling || equip.category.startsWith("diffuser")) && (
              <Section title="Thermal & Aerodynamic Capacity">
                <div className="grid grid-cols-2 gap-2">
                  {isRadiator && (
                    <label className="flex flex-col gap-0.5 col-span-2">
                      <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">Heating Output (W)</span>
                      <input
                        type="number"
                        defaultValue={equip.powerWatts ?? 1500}
                        onBlur={(e) => void updateEquipment(equip.id, { powerWatts: Number(e.target.value) })}
                        className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] outline-none font-mono"
                      />
                    </label>
                  )}

                  {isCooling && (
                    <>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">Cooling Output (W)</span>
                        <input
                          type="number"
                          defaultValue={equip.coolingWatts ?? (equip.category === "chiller" ? 15000 : 2500)}
                          onBlur={(e) => void updateEquipment(equip.id, { coolingWatts: Number(e.target.value) })}
                          className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] outline-none font-mono"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">Airflow (m³/h)</span>
                        <input
                          type="number"
                          defaultValue={equip.airflowM3h ?? 450}
                          onBlur={(e) => void updateEquipment(equip.id, { airflowM3h: Number(e.target.value) })}
                          className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] outline-none font-mono"
                        />
                      </label>
                    </>
                  )}

                  {equip.category.startsWith("diffuser") && (
                    <label className="flex flex-col gap-0.5 col-span-2">
                      <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">Airflow Rate (m³/h)</span>
                      <input
                        type="number"
                        defaultValue={equip.flowM3h ?? 100}
                        onBlur={(e) => void updateEquipment(equip.id, { flowM3h: Number(e.target.value) })}
                        className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] outline-none font-mono"
                      />
                    </label>
                  )}
                </div>
              </Section>
            )}

            {/* Connectors List */}
            {connectors.length > 0 && (
              <Section title={`Connectors (${connectors.length})`}>
                <div className="flex flex-col gap-1.5">
                  {connectors.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-overlay)] p-1.5 text-[10px]">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`h-2 w-2 rounded-full ${
                          c.type === "duct" ? "bg-cyan-400" : c.type === "pipe" ? (c.systemType === "hydronic_supply" ? "bg-red-500" : "bg-blue-500") : "bg-yellow-400"
                        }`} />
                        <span className="font-semibold text-[var(--text-strong)] truncate">{c.name}</span>
                      </div>
                      <span className="font-mono text-[9px] text-[var(--text-muted)]">
                        {c.sizeMm ? `Ø${c.sizeMm}mm` : c.widthMm ? `${c.widthMm}×${c.heightMm}mm` : "Elec"}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => void duplicateEquipment(equip.id)}
                className="flex-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)]/60 px-2 py-1.5 text-[11px] font-semibold hover:bg-sky-50"
              >
                {t(uiLanguage, "layoutDuplicate")}
              </button>
              <button
                type="button"
                onClick={() => void deleteEquipment(equip.id)}
                className="flex-1 rounded-xl bg-red-500/10 px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-500/15"
              >
                {t(uiLanguage, "markupDelete")}
              </button>
            </div>
          </>
        );
      })()}
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

function LevelSelect({
  label,
  value,
  levels,
  allowUnconnected = false,
  onChange,
}: {
  label: string;
  value: string;
  levels: Array<{ id: string; name: string; elevationMm: number }>;
  allowUnconnected?: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[9px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] outline-none focus:border-sky-300">
        {allowUnconnected && <option value="">Unconnected</option>}
        {levels.slice().sort((a, b) => a.elevationMm - b.elevationMm).map((level) => <option key={level.id} value={level.id}>{level.name} ({level.elevationMm} mm)</option>)}
      </select>
    </label>
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
