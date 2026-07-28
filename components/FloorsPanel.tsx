"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { PiFilePdfThin } from "react-icons/pi";
import { clearFloorSnapshots, renderFloorSnapshot } from "@/lib/floorSnapshot";
import { getModelById } from "@/lib/modelRegistry";
import {
  captureAllPagesAssets,
  capturePresentationAssets,
  pdfLegendFromStore,
} from "@/lib/pdfCapture";
import { exportAllPagesPdf, exportHeizlastPdf, exportPresentationPdf } from "@/lib/pdfExport";
import { heading } from "@/lib/designTokens";
import { useAppStore } from "@/store/useAppStore";
import { t } from "@/lib/i18n";
import { useModelScene } from "./ModelSceneContext";
import GlassPanel from "./GlassPanel";
import Slider from "./ui/Slider";
import type { Viewer3DHandle } from "./Viewer3D";
import type { Floor, Room } from "@/lib/types";
import type { PageFormat } from "@/lib/presentationLayout";

type Props = {
  viewerRef: RefObject<Viewer3DHandle | null>;
};

function Divider() {
  return <div className="mx-3 border-t border-zinc-300/50" />;
}

function FloorSliceSlider({
  floors,
  selectedFloor,
}: {
  floors: Floor[];
  selectedFloor: string;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const sliceProgress = useAppStore((s) => s.sliceProgress);
  const setSliceProgress = useAppStore((s) => s.setSliceProgress);

  const { yMin, yMax, heightLabel } = useMemo(() => {
    const sorted = [...floors].sort((a, b) => a.elevation - b.elevation);
    const idx = sorted.findIndex((f) => f.id === selectedFloor);
    const floor = sorted[idx];
    const next = sorted[idx + 1];
    const yMin = floor?.elevation ?? 0;
    const yMax = next?.elevation ?? yMin + 3;
    const y = yMin + sliceProgress * Math.max(0.05, yMax - yMin);
    const toM = (v: number) => (Math.abs(v) > 100 ? v / 1000 : v);
    return {
      yMin: toM(yMin),
      yMax: toM(yMax),
      heightLabel: `${toM(y).toFixed(2)} m`,
    };
  }, [floors, selectedFloor, sliceProgress]);

  return (
    <div className="rounded-xl border border-zinc-300/50 bg-white/45 px-3 py-2.5 backdrop-blur-sm">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-zinc-600">
          {t(uiLanguage, "sliceHeight")}
        </p>
        <p className="tabular-nums text-[11px] font-medium text-zinc-800">
          {heightLabel}
        </p>
      </div>
      <Slider
        min={0}
        max={100}
        step={1}
        value={Math.round(sliceProgress * 100)}
        onChange={(v) => setSliceProgress(v / 100)}
        aria-label={t(uiLanguage, "sliceHeight")}
      />
      <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
        <span>
          {t(uiLanguage, "floor")} {yMin.toFixed(1)} m
        </span>
        <span>{t(uiLanguage, "middle")}</span>
        <span>
          {t(uiLanguage, "ceiling")} {yMax.toFixed(1)} m
        </span>
      </div>
    </div>
  );
}

/** Left panel: building summary, floors, rooms, slice, saved views. */
export default function FloorsPanel({ viewerRef }: Props) {
  const floors = useAppStore((s) => s.floors);
  const rooms = useAppStore((s) => s.rooms);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const selectedRoomId = useAppStore((s) => s.selectedRoomId);
  const isPresentationView = useAppStore((s) => s.isPresentationView);
  const compareBothModes = useAppStore((s) => s.compareBothModes);
  const setCompareBothModes = useAppStore((s) => s.setCompareBothModes);
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const colorMode = useAppStore((s) => s.colorMode);
  const activeColorPalette = useAppStore((s) => s.activeColorPalette);
  const heizlastRange = useAppStore((s) => s.heizlastRange);
  const temperatureRange = useAppStore((s) => s.temperatureRange);
  const activeModelId = useAppStore((s) => s.activeModelId);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const savedViews = useAppStore((s) => s.savedViews);
  const selectedElement = useAppStore((s) => s.selectedElement);

  const setSelectedFloor = useAppStore((s) => s.setSelectedFloor);
  const setSelectedRoomId = useAppStore((s) => s.setSelectedRoomId);
  const setSelectedElement = useAppStore((s) => s.setSelectedElement);
  const goToSavedView = useAppStore((s) => s.goToSavedView);
  const removeSavedView = useAppStore((s) => s.removeSavedView);

  const { shellGroup, rooms: sceneRooms } = useModelScene();
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");
  const [pdfPageFormat, setPdfPageFormat] = useState<PageFormat>("a3");
  const [pdfSavedSelection, setPdfSavedSelection] = useState<string[]>([]);

  const sortedFloors = useMemo(
    () => [...floors].sort((a, b) => a.elevation - b.elevation),
    [floors],
  );

  const floorsWithRooms = useMemo(
    () =>
      sortedFloors.filter((f) => rooms.some((r) => r.floorId === f.id)),
    [sortedFloors, rooms],
  );

  useEffect(() => {
    if (
      selectedFloor &&
      !floorsWithRooms.some((f) => f.id === selectedFloor)
    ) {
      setSelectedFloor(null);
    }
  }, [selectedFloor, floorsWithRooms, setSelectedFloor]);

  const floorRooms = useMemo(() => {
    if (!selectedFloor) return [];
    return rooms
      .filter((r) => r.floorId === selectedFloor)
      .sort(
        (a, b) =>
          a.number.localeCompare(b.number) || a.name.localeCompare(b.name),
      );
  }, [rooms, selectedFloor]);

  const selectedFloorObj = sortedFloors.find((f) => f.id === selectedFloor);

  const modelLabel =
    activeModelLabel ??
    (activeModelId
      ? (getModelById(activeModelId)?.label ?? activeModelId)
      : t(uiLanguage, "noModel"));

  useEffect(() => {
    if (activeModelId) clearFloorSnapshots(activeModelId);
    setSnapshotUrl(null);
  }, [activeModelId, shellGroup]);

  useEffect(() => {
    if (!selectedFloorObj || !activeModelId) {
      setSnapshotUrl(null);
      return;
    }
    const roomSource = rooms.length ? rooms : sceneRooms;
    try {
      setSnapshotUrl(
        renderFloorSnapshot(
          shellGroup,
          selectedFloorObj,
          sortedFloors,
          activeModelId,
          roomSource,
        ),
      );
    } catch {
      setSnapshotUrl(null);
    }
  }, [
    shellGroup,
    selectedFloorObj,
    sortedFloors,
    activeModelId,
    rooms,
    sceneRooms,
  ]);

  /** Select only — no flyTo. Popup is rendered by ViewerApp via RoomTooltip. */
  const selectRoomFromList = (room: Room) => {
    setSelectedRoomId(room.id);
    void import("@/lib/ifcClient").then(({ getElementDetails }) =>
      getElementDetails(room.expressId, room.floorId, room.id).then((el) => {
        if (el) setSelectedElement(el);
      }),
    );
  };

  const handleGoView = (id: string) => {
    const view = goToSavedView(id);
    if (!view || !viewerRef.current) return;
    if (view.floorId !== undefined) setSelectedFloor(view.floorId);
    void viewerRef.current.flyToPose(view.position, view.target, 850);
  };

  const openPdfPopup = () => {
    setPdfProgress("");
    setPdfSavedSelection(savedViews.map((v) => v.id));
    setPdfOpen(true);
  };

  useEffect(() => {
    if (!pdfOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pdfExporting) setPdfOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pdfOpen, pdfExporting]);

  const modelNameForPdf = () => {
    const st = useAppStore.getState();
    return (
      st.activeModelLabel ?? st.activeModelId ?? "model"
    ).replace(/\.ifc$/i, "");
  };

  const exportAllPages = async () => {
    if (pdfExporting || !viewerRef.current || rooms.length === 0) return;
    setPdfExporting(true);
    setPdfProgress(t(uiLanguage, "starting"));
    try {
      const assets = await captureAllPagesAssets(viewerRef.current, {
        scale: 2.5,
        onProgress: setPdfProgress,
      });
      setPdfProgress(t(uiLanguage, "buildingPdf"));
      exportAllPagesPdf({
        modelName: modelNameForPdf(),
        floors: assets.floors,
        presentation: assets.presentation,
        legend: pdfLegendFromStore(),
      });
      setPdfOpen(false);
    } finally {
      setPdfExporting(false);
      setPdfProgress("");
    }
  };

  const exportPresentationOnly = async () => {
    if (pdfExporting || !viewerRef.current || rooms.length === 0) return;
    setPdfExporting(true);
    setPdfProgress(t(uiLanguage, "starting"));
    try {
      const presentation = await capturePresentationAssets(viewerRef.current, {
        scale: 3,
        onProgress: setPdfProgress,
      });
      setPdfProgress(t(uiLanguage, "buildingPdf"));
      exportPresentationPdf({
        modelName: modelNameForPdf(),
        presentation,
        legend: pdfLegendFromStore(),
        pageFormat: pdfPageFormat,
      });
      setPdfOpen(false);
    } finally {
      setPdfExporting(false);
      setPdfProgress("");
    }
  };

  const exportSavedViewsOnly = async () => {
    if (
      pdfExporting ||
      !viewerRef.current ||
      rooms.length === 0 ||
      pdfSavedSelection.length === 0
    ) {
      return;
    }
    const selected = savedViews.filter((v) => pdfSavedSelection.includes(v.id));
    if (selected.length === 0) return;

    setPdfExporting(true);
    setPdfProgress(t(uiLanguage, "capturingSaved"));
    try {
      const pages: {
        title: string;
        viewportDataUrl: string | null;
        pageFormat?: PageFormat;
      }[] = [];
      for (let i = 0; i < selected.length; i += 1) {
        const view = selected[i];
        setPdfProgress(
          `${t(uiLanguage, "capturingSaved")} (${i + 1}/${selected.length}: ${view.name})`,
        );
        if (view.floorId !== undefined) setSelectedFloor(view.floorId);
        await viewerRef.current.flyToPose(view.position, view.target, 700);
        // Wait one frame for camera + overlays to settle.
        await new Promise((resolve) =>
          requestAnimationFrame(() => resolve(undefined)),
        );
        const viewportDataUrl =
          viewerRef.current.captureViewport({ scale: 2.2 }) ?? null;
        pages.push({
          title: view.name,
          viewportDataUrl,
          pageFormat: view.pageFormat,
        });
      }
      setPdfProgress(t(uiLanguage, "buildingPdf"));
      exportHeizlastPdf({
        views: pages,
        modelName: modelNameForPdf(),
        rooms,
        colorMode,
        palette: activeColorPalette,
        heizlastRange,
        temperatureRange,
      });
      setPdfOpen(false);
    } finally {
      setPdfExporting(false);
      setPdfProgress("");
    }
  };

  const yellowGlossBtn =
    "inline-flex items-center gap-1 rounded-full border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 px-2.5 py-1 text-[11px] font-semibold text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_3px_10px_rgba(251,191,36,0.3)] backdrop-blur-md transition active:scale-95 disabled:opacity-40";

  return (
    <div className="thin-scroll flex min-h-0 flex-1 flex-col overflow-y-auto text-zinc-800">
      {selectedElement && (
        <>
          <section className="space-y-2 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={heading.muted}>{t(uiLanguage, "selection")}</p>
                <p className="truncate text-sm font-semibold">
                  {selectedElement.name}
                </p>
                <p className="text-[10px] text-zinc-500">
                  {selectedElement.typeName}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 text-[11px] font-medium text-zinc-500 hover:text-zinc-800"
                onClick={() => {
                  setSelectedElement(null);
                  setSelectedRoomId(null);
                }}
              >
                {t(uiLanguage, "clear")}
              </button>
            </div>
          </section>
          <Divider />
        </>
      )}

      <section className="space-y-2 px-4 py-3">
        <p className={heading.muted}>{t(uiLanguage, "model")}</p>
        <p className="truncate text-sm font-semibold tracking-wide">
          {modelLabel}
        </p>
        <div className="flex gap-4 text-xs">
          <span>
            <span className="font-semibold tabular-nums">{floors.length}</span>{" "}
            {t(uiLanguage, "floors")}
          </span>
          <span>
            <span className="font-semibold tabular-nums">{rooms.length}</span>{" "}
            {t(uiLanguage, "rooms")}
          </span>
        </div>
      </section>

      <Divider />

      <section className="space-y-2.5 px-4 py-3">
        <p className={heading.panel}>{t(uiLanguage, "floorsAndRooms")}</p>
        <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-300/50 bg-white/40 px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-800">
              {t(uiLanguage, "heizlastPlusTemp")}
            </p>
            <p className="text-[10px] text-zinc-500">
              {t(uiLanguage, "sameFloorStacked")}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={compareBothModes}
            onClick={() => setCompareBothModes(!compareBothModes)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
              compareBothModes ? "bg-sky-600" : "bg-zinc-300/80"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                compareBothModes ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        <select
          value={selectedFloor ?? ""}
          disabled={floorsWithRooms.length === 0}
          onChange={(e) =>
            setSelectedFloor(e.target.value === "" ? null : e.target.value)
          }
          className="w-full rounded-xl border border-zinc-300/60 bg-white/50 px-3 py-2 text-sm outline-none focus:border-zinc-400"
        >
          <option value="">{t(uiLanguage, "allFloorsPick")}</option>
          {floorsWithRooms.map((f) => {
            const count = rooms.filter((r) => r.floorId === f.id).length;
            return (
              <option key={f.id} value={f.id}>
                {f.name} ({count})
              </option>
            );
          })}
        </select>

        {selectedFloor ? (
          <>
            {!isPresentationView && (
              <FloorSliceSlider
                floors={sortedFloors}
                selectedFloor={selectedFloor}
              />
            )}

            <div className="overflow-hidden rounded-xl border border-zinc-300/50 bg-[#f2f4f7]">
              {snapshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={snapshotUrl}
                  alt={`Floor plan ${selectedFloorObj?.name ?? ""}`}
                  className="aspect-square w-full object-contain"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center text-xs text-zinc-400">
                  {t(uiLanguage, "noFloorPlan")}
                </div>
              )}
            </div>

            <p className={heading.muted}>
              {t(uiLanguage, "rooms")} ({floorRooms.length})
            </p>
            {floorRooms.length === 0 ? (
              <p className="text-xs text-zinc-400">
                {t(uiLanguage, "noRoomsOnFloor")}
              </p>
            ) : (
              <ul className="thin-scroll max-h-48 space-y-0.5 overflow-y-auto pr-0.5">
                {floorRooms.map((room) => {
                  const active = room.id === selectedRoomId;
                  return (
                    <li key={room.id}>
                      <button
                        type="button"
                        onClick={() => selectRoomFromList(room)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                          active
                            ? "bg-zinc-900/10 font-semibold text-zinc-900"
                            : "text-zinc-600 hover:bg-zinc-900/5"
                        }`}
                      >
                        <span className="min-w-0 truncate">
                          {room.number ? `${room.number} · ` : ""}
                          {room.name}
                        </span>
                        <span className="tabular-nums text-zinc-400">
                          {room.heatLoad.toFixed(0)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <p className="text-xs text-zinc-400">
            {t(uiLanguage, "selectFloorHint")}
          </p>
        )}
      </section>

      <Divider />

      <section className="space-y-2 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className={heading.panel}>{t(uiLanguage, "savedViews")}</p>
          <button
            type="button"
            disabled={rooms.length === 0}
            onClick={openPdfPopup}
            title={t(uiLanguage, "savePdf")}
            aria-label={t(uiLanguage, "savePdf")}
            aria-expanded={pdfOpen}
            className={yellowGlossBtn}
          >
            <PiFilePdfThin className="h-4 w-4" />
            {t(uiLanguage, "savePdf")}
          </button>
        </div>
        {savedViews.length === 0 ? (
          <p className="text-xs text-zinc-400">
            {t(uiLanguage, "savedViewsHint")}
          </p>
        ) : (
          <ul className="space-y-1">
            {savedViews.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-1 rounded-lg bg-white/40 px-2 py-1"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-xs font-medium text-zinc-700 hover:text-zinc-900"
                  onClick={() => handleGoView(v.id)}
                >
                  {v.name}
                  <span className="ml-1.5 text-[9px] font-semibold uppercase text-zinc-400">
                    {v.pageFormat ?? "a4"}
                  </span>
                </button>
                <button
                  type="button"
                  className="shrink-0 px-1 text-[10px] text-zinc-400 hover:text-red-600"
                  onClick={() => removeSavedView(v.id)}
                  aria-label={`Delete ${v.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pdfOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
            role="presentation"
          >
            <button
              type="button"
              aria-label={t(uiLanguage, "closePdf")}
              className="absolute inset-0 bg-zinc-900/35 backdrop-blur-[2px]"
              disabled={pdfExporting}
              onClick={() => {
                if (!pdfExporting) setPdfOpen(false);
              }}
            />
            <div
              className="relative z-[121] w-full max-w-md"
              role="dialog"
              aria-modal="true"
              aria-label={t(uiLanguage, "downloadPdf")}
            >
              <div
                className="rounded-[1.35rem] border border-amber-200/60 bg-gradient-to-br from-amber-100/55 via-white/35 to-yellow-200/40 p-[1px] shadow-[0_12px_40px_rgba(251,191,36,0.28),0_4px_16px_rgba(0,0,0,0.08)]"
              >
                <GlassPanel
                  variant="control"
                  zIndex={121}
                  wrapperClassName="overflow-hidden rounded-[1.25rem]"
                >
                  <div className="relative overflow-hidden rounded-[1.25rem] bg-gradient-to-b from-white/55 via-white/25 to-amber-50/30 p-4 backdrop-blur-md">
                    <span
                      className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/70 to-transparent"
                      aria-hidden
                    />
                    <div className="relative space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">
                            {t(uiLanguage, "downloadPdf")}
                          </p>
                          <p className="mt-0.5 text-[11px] text-zinc-500">
                            {t(uiLanguage, "floorsAndPresentation")}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={pdfExporting}
                          onClick={() => setPdfOpen(false)}
                          className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-white/50 hover:text-zinc-700"
                          aria-label={t(uiLanguage, "close")}
                        >
                          ✕
                        </button>
                      </div>

                      {pdfExporting && (
                        <p className="rounded-xl bg-white/50 px-3 py-2 text-[11px] font-medium text-zinc-700">
                          {pdfProgress || t(uiLanguage, "exporting")}
                        </p>
                      )}

                      <div className="rounded-xl border border-white/50 bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                        <p className="text-xs font-semibold text-zinc-800">
                          {t(uiLanguage, "allPages")}
                        </p>
                        <p className="mt-1 text-[10px] leading-snug text-zinc-500">
                          {t(uiLanguage, "allPagesDesc")}{" "}
                          <span className="font-medium text-zinc-700">
                            {modelLabel.replace(/\.ifc$/i, "")}_allpages.pdf
                          </span>
                        </p>
                        <button
                          type="button"
                          disabled={pdfExporting || rooms.length === 0}
                          onClick={() => void exportAllPages()}
                          className={`${yellowGlossBtn} mt-2.5 h-10 w-full justify-center rounded-xl px-3 text-sm disabled:opacity-40`}
                        >
                          {pdfExporting ? (
                            <>
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-800/30 border-t-amber-900" />
                              {t(uiLanguage, "exporting")}
                            </>
                          ) : (
                            <>
                              <PiFilePdfThin className="h-5 w-5" />
                              {t(uiLanguage, "downloadAllPages")}
                            </>
                          )}
                        </button>
                      </div>

                      <div className="rounded-xl border border-white/50 bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                        <p className="text-xs font-semibold text-zinc-800">
                          {t(uiLanguage, "presentationViews")}
                        </p>
                        <p className="mt-1 text-[10px] leading-snug text-zinc-500">
                          {t(uiLanguage, "presentationDesc")}
                        </p>
                        <div className="mt-2 grid grid-cols-5 gap-1">
                          {(["a4", "a3", "a2", "a1", "a0"] as const).map(
                            (f) => (
                              <button
                                key={f}
                                type="button"
                                disabled={pdfExporting}
                                onClick={() => setPdfPageFormat(f)}
                                className={`rounded-lg py-1.5 text-[11px] font-semibold uppercase ${
                                  pdfPageFormat === f
                                    ? "bg-zinc-800 text-white"
                                    : "bg-white/60 text-zinc-600 hover:bg-white/90"
                                }`}
                              >
                                {f}
                              </button>
                            ),
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={pdfExporting || rooms.length === 0}
                          onClick={() => void exportPresentationOnly()}
                          className={`${yellowGlossBtn} mt-2.5 h-10 w-full justify-center rounded-xl px-3 text-sm disabled:opacity-40`}
                        >
                          <PiFilePdfThin className="h-5 w-5" />
                          {t(uiLanguage, "downloadPresentation")} (
                          {pdfPageFormat.toUpperCase()})
                        </button>
                      </div>

                      <div className="rounded-xl border border-white/50 bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                        <p className="text-xs font-semibold text-zinc-800">
                          {t(uiLanguage, "savedViewsPdf")}
                        </p>
                        <p className="mt-1 text-[10px] leading-snug text-zinc-500">
                          {t(uiLanguage, "selectSavedViews")}
                        </p>
                        {savedViews.length === 0 ? (
                          <p className="mt-2 text-[10px] text-zinc-400">
                            {t(uiLanguage, "noSavedViewsYet")}
                          </p>
                        ) : (
                          <div className="mt-2 max-h-28 space-y-1 overflow-y-auto rounded-lg border border-zinc-200/70 bg-white/55 p-2">
                            {savedViews.map((view) => (
                              <label key={view.id} className="flex items-center gap-2 text-[11px] text-zinc-700">
                                <input
                                  type="checkbox"
                                  checked={pdfSavedSelection.includes(view.id)}
                                  onChange={(e) =>
                                    setPdfSavedSelection((prev) =>
                                      e.target.checked
                                        ? [...prev, view.id]
                                        : prev.filter((id) => id !== view.id),
                                    )
                                  }
                                />
                                <span className="truncate">{view.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          disabled={
                            pdfExporting ||
                            rooms.length === 0 ||
                            savedViews.length === 0 ||
                            pdfSavedSelection.length === 0
                          }
                          onClick={() => void exportSavedViewsOnly()}
                          className={`${yellowGlossBtn} mt-2.5 h-10 w-full justify-center rounded-xl px-3 text-sm disabled:opacity-40`}
                        >
                          <PiFilePdfThin className="h-5 w-5" />
                          {t(uiLanguage, "downloadSavedViews")}
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={pdfExporting}
                        onClick={() => setPdfOpen(false)}
                        className="h-9 w-full rounded-xl border border-white/50 bg-white/40 text-sm font-medium text-zinc-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-md hover:bg-white/60"
                      >
                        {t(uiLanguage, "cancel")}
                      </button>
                    </div>
                  </div>
                </GlassPanel>
              </div>
            </div>
          </div>,
          (document.fullscreenElement as HTMLElement | null) ?? document.body,
        )}
    </div>
  );
}
