"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { listVisibleFloors } from "@/lib/floorFilter";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import GlassPanel from "../common/GlassPanel";
import { useModelScene } from "./WerkzeugModelSceneContext";

/**
 * Floors / Levels — IFC storeys + layout levels.
 * Reference plan (PDF/DWG) lives inside each floor row; click chip → detail popup.
 */
export default function ToolFloorsSection({
  className = "",
}: {
  className?: string;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const floors = useAppStore((s) => s.floors);
  const rooms = useAppStore((s) => s.rooms);
  const setSelectedFloor = useAppStore((s) => s.setSelectedFloor);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const markupFloorId = useToolMarkupStore((s) => s.markupFloorId);
  const setMarkupFloorId = useToolMarkupStore((s) => s.setMarkupFloorId);
  const setViewPreset = useToolMarkupStore((s) => s.setViewPreset);
  const { shellGroup } = useModelScene();
  const visible = listVisibleFloors(floors, rooms, shellGroup);

  const projectId = useLayoutDrawingStore((s) => s.projectId);
  const levels = useLayoutDrawingStore((s) => s.levels);
  const underlays = useLayoutDrawingStore((s) => s.underlays);
  const addLevel = useLayoutDrawingStore((s) => s.addLevel);
  const updateLevel = useLayoutDrawingStore((s) => s.updateLevel);
  const addUnderlayFromFile = useLayoutDrawingStore((s) => s.addUnderlayFromFile);
  const updateUnderlay = useLayoutDrawingStore((s) => s.updateUnderlay);
  const deleteUnderlay = useLayoutDrawingStore((s) => s.deleteUnderlay);
  const selectUnderlay = useLayoutDrawingStore((s) => s.selectUnderlay);
  const beginCalibrateUnderlay = useLayoutDrawingStore(
    (s) => s.beginCalibrateUnderlay,
  );
  const cancelCalibrateUnderlay = useLayoutDrawingStore(
    (s) => s.cancelCalibrateUnderlay,
  );
  const commitCalibrateDistance = useLayoutDrawingStore(
    (s) => s.commitCalibrateDistance,
  );
  const calibrateUnderlayId = useLayoutDrawingStore((s) => s.calibrateUnderlayId);
  const calibratePoints = useLayoutDrawingStore((s) => s.calibratePoints);
  const selectedUnderlayId = useLayoutDrawingStore((s) => s.selectedUnderlayId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadLevelId, setUploadLevelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [calibMm, setCalibMm] = useState("1000");
  const [popupLevelId, setPopupLevelId] = useState<string | null>(null);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const popupRef = useRef<HTMLDivElement>(null);

  const activeId = markupFloorId ?? selectedFloor;

  useEffect(() => {
    if (!popupLevelId) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popupRef.current?.contains(t)) return;
      if ((e.target as HTMLElement)?.closest?.("[data-underlay-chip]")) return;
      setPopupLevelId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [popupLevelId]);

  const select = (floorId: string | null, goTop = false) => {
    setMarkupFloorId(floorId);
    setSelectedFloor(floorId);
    if (goTop && floorId) setViewPreset("top");
  };

  const underlayFor = (levelId: string) =>
    underlays.find((u) => u.levelId === levelId) ?? null;

  const openPopup = (levelId: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPopupPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 280) });
    setPopupLevelId(levelId);
    select(levelId, true);
    const u = underlayFor(levelId);
    if (u) selectUnderlay(u.id);
  };

  const onPickFile = async (file: File | undefined) => {
    const levelId = uploadLevelId;
    setUploadLevelId(null);
    if (!file || !levelId) return;
    setBusy(true);
    setErr(null);
    try {
      const row = await addUnderlayFromFile(levelId, file);
      select(levelId, true);
      if (row) {
        setPopupLevelId(levelId);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const popupUnderlay = popupLevelId ? underlayFor(popupLevelId) : null;

  const floorRows: {
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
    ...visible
      .filter((f) => !levels.some((l) => l.id === f.id))
      .map((f) => ({
        id: f.id,
        name: f.name,
        elevationMm: Math.round(f.elevation * 1000),
        kind: "ifc" as const,
      })),
  ];

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2 px-0.5">
        <p className="text-[9px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
          {t(uiLanguage, "floors")}
        </p>
        {projectId && (
          <button
            type="button"
            onClick={() => {
              void addLevel().then((lvl) => {
                if (lvl) select(lvl.id, true);
              });
            }}
            className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-sky-900 hover:bg-sky-200/80"
          >
            + {t(uiLanguage, "layoutAddLevel")}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.dwg,application/pdf,image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          void onPickFile(f);
        }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto thin-scroll pr-0.5">
        <button
          type="button"
          onClick={() => {
            select(null);
            setPopupLevelId(null);
          }}
          className={`mb-0.5 w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold transition duration-150 ${
            activeId == null
              ? "bg-amber-100 text-amber-950"
              : "text-[var(--text-body)] hover:bg-[var(--surface-muted)]"
          }`}
        >
          {t(uiLanguage, "markupAllFloors")}
        </button>

        {floorRows.map((row) => {
          const active = activeId === row.id;
          const underlay = underlayFor(row.id);
          const layoutLevel = levels.find((l) => l.id === row.id);
          return (
            <div
              key={row.id}
              className={`mb-0.5 rounded-lg px-1 py-0.5 ${
                active ? "bg-sky-100 text-sky-950" : ""
              }`}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => select(row.id, true)}
                  className="shrink-0 rounded px-1 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-body)]"
                  title={t(uiLanguage, "markupView_top")}
                >
                  ↕
                </button>
                {layoutLevel ? (
                  <input
                    type="text"
                    defaultValue={layoutLevel.name}
                    key={`${row.id}-name-${layoutLevel.name}`}
                    onClick={() => select(row.id, true)}
                    onBlur={(e) => {
                      const name = e.target.value.trim();
                      if (name && name !== layoutLevel.name) {
                        void updateLevel(row.id, { name });
                      } else {
                        e.target.value = layoutLevel.name;
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        (e.target as HTMLInputElement).blur();
                    }}
                    className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-1 text-[11px] font-semibold outline-none focus:border-sky-300 focus:bg-white/80"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => select(row.id, true)}
                    className="min-w-0 flex-1 truncate px-1 py-1 text-left text-[11px] font-semibold"
                  >
                    {row.name}
                  </button>
                )}

                {/* Reference plan chip — inside the floor row */}
                {projectId && (
                  <button
                    type="button"
                    data-underlay-chip
                    title={t(uiLanguage, "underlayAdd")}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (underlay) {
                        openPopup(row.id, e.currentTarget);
                      } else {
                        setUploadLevelId(row.id);
                        fileInputRef.current?.click();
                      }
                    }}
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${
                      underlay
                        ? selectedUnderlayId === underlay.id
                          ? "bg-amber-400/90 text-amber-950"
                          : "bg-amber-100 text-amber-900 hover:bg-amber-200/80"
                        : "bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-sky-50 hover:text-sky-900"
                    }`}
                  >
                    {underlay
                      ? underlay.sourceName.toLowerCase().endsWith(".dwg")
                        ? "DWG"
                        : "PDF"
                      : "+"}
                  </button>
                )}

                {layoutLevel && (
                  <>
                    <input
                      type="number"
                      defaultValue={layoutLevel.elevationMm}
                      key={`${row.id}-elev-${layoutLevel.elevationMm}`}
                      title={t(uiLanguage, "layoutLevelElevation")}
                      onClick={() => select(row.id, true)}
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (
                          Number.isFinite(n) &&
                          n !== layoutLevel.elevationMm
                        ) {
                          void updateLevel(row.id, {
                            elevationMm: Math.round(n),
                          });
                        } else {
                          e.target.value = String(layoutLevel.elevationMm);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          (e.target as HTMLInputElement).blur();
                      }}
                      className="w-[3.75rem] shrink-0 rounded-md border border-transparent bg-transparent px-1 py-1 text-right text-[10px] tabular-nums outline-none focus:border-sky-300 focus:bg-white/80"
                    />
                    <span className="shrink-0 pr-0.5 text-[8px] text-[var(--text-muted)]">
                      mm
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {busy && (
          <p className="px-2 py-1 text-[10px] text-sky-700">
            {t(uiLanguage, "underlayLoading")}
          </p>
        )}
        {err && <p className="px-2 py-1 text-[10px] text-red-600">{err}</p>}

        {calibrateUnderlayId && (
          <div className="mt-2 rounded-xl border border-amber-300/80 bg-amber-50/90 p-2">
            <p className="text-[10px] font-semibold text-amber-950">
              {t(uiLanguage, "underlayCalibrateTitle")}
            </p>
            <p className="mt-0.5 text-[9px] leading-snug text-amber-900/80">
              {calibratePoints.length < 2
                ? t(uiLanguage, "underlayCalibrateHint")
                : t(uiLanguage, "underlayCalibrateEnter")}
            </p>
            <p className="mt-1 text-[9px] tabular-nums text-amber-900">
              {calibratePoints.length}/2 {t(uiLanguage, "underlayPoints")}
            </p>
            {calibratePoints.length >= 2 && (
              <div className="mt-1.5 flex items-end gap-1.5">
                <label className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[8px] font-semibold uppercase text-amber-800">
                    mm
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={calibMm}
                    onChange={(e) => setCalibMm(e.target.value)}
                    className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-[11px] outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const n = Number(calibMm);
                    if (Number.isFinite(n) && n > 0) {
                      void commitCalibrateDistance(n);
                    }
                  }}
                  className="h-[30px] rounded-lg bg-amber-500 px-2.5 text-[10px] font-bold text-white"
                >
                  OK
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => cancelCalibrateUnderlay()}
              className="mt-1.5 text-[9px] font-semibold text-amber-800 underline"
            >
              {t(uiLanguage, "cancel")}
            </button>
          </div>
        )}
      </div>

      {popupLevelId &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popupRef}
            className="fixed z-[180] w-[260px]"
            style={{ top: popupPos.top, left: popupPos.left }}
          >
            <GlassPanel variant="control" zIndex={180}>
              <div className="flex flex-col gap-2 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold tracking-wide text-[var(--text-strong)] uppercase">
                      {t(uiLanguage, "underlayTitle")}
                    </p>
                    <p className="truncate text-[11px] text-[var(--text-body)]">
                      {popupUnderlay?.sourceName ??
                        t(uiLanguage, "underlayNone")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPopupLevelId(null)}
                    className="rounded px-1 text-[12px] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                  >
                    ×
                  </button>
                </div>

                {popupUnderlay ? (
                  <>
                    <p className="text-[9px] leading-snug text-[var(--text-muted)]">
                      {popupUnderlay.mmPerPixel > 0
                        ? `${Math.round(popupUnderlay.mmPerPixel * 100) / 100} mm/px · ${popupUnderlay.locked ? t(uiLanguage, "underlayLockedHint") : t(uiLanguage, "underlayDragHint")}`
                        : t(uiLanguage, "underlayNeedsCalib")}
                    </p>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
                        {t(uiLanguage, "underlayOpacity")}{" "}
                        {Math.round(popupUnderlay.opacity * 100)}%
                      </span>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={Math.round(popupUnderlay.opacity * 100)}
                        onChange={(e) =>
                          void updateUnderlay(popupUnderlay.id, {
                            opacity: Number(e.target.value) / 100,
                          })
                        }
                      />
                    </label>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          beginCalibrateUnderlay(popupUnderlay.id)
                        }
                        className="rounded-lg bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-950"
                      >
                        {t(uiLanguage, "underlayCalibrate")}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void updateUnderlay(popupUnderlay.id, {
                            locked: !popupUnderlay.locked,
                          })
                        }
                        className="rounded-lg bg-[var(--surface-muted)] px-2 py-1 text-[10px] font-semibold"
                      >
                        {popupUnderlay.locked
                          ? t(uiLanguage, "underlayUnlock")
                          : t(uiLanguage, "underlayLock")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadLevelId(popupLevelId);
                          fileInputRef.current?.click();
                        }}
                        className="rounded-lg bg-[var(--surface-muted)] px-2 py-1 text-[10px] font-semibold"
                      >
                        {t(uiLanguage, "underlayReplace")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void deleteUnderlay(popupUnderlay.id);
                          setPopupLevelId(null);
                        }}
                        className="rounded-lg bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-600"
                      >
                        {t(uiLanguage, "markupDelete")}
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setUploadLevelId(popupLevelId);
                      fileInputRef.current?.click();
                    }}
                    className="rounded-lg bg-sky-100 px-2 py-2 text-[11px] font-semibold text-sky-950"
                  >
                    {t(uiLanguage, "underlayAdd")}
                  </button>
                )}
              </div>
            </GlassPanel>
          </div>,
          (document.fullscreenElement as HTMLElement | null) ?? document.body,
        )}
    </div>
  );
}
