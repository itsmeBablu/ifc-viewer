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
import { exportAllPagesPdf, exportPresentationPdf } from "@/lib/pdfExport";
import { heading } from "@/lib/designTokens";
import { useAppStore } from "@/store/useAppStore";
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
          Schnitthöhe
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
        aria-label="Floor slice height"
      />
      <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
        <span>Boden {yMin.toFixed(1)} m</span>
        <span>Mitte</span>
        <span>Decke {yMax.toFixed(1)} m</span>
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
      : "No model");

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
    setPdfProgress("Starting…");
    try {
      const assets = await captureAllPagesAssets(viewerRef.current, {
        scale: 2.5,
        onProgress: setPdfProgress,
      });
      setPdfProgress("Building PDF…");
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
    setPdfProgress("Starting…");
    try {
      const presentation = await capturePresentationAssets(viewerRef.current, {
        scale: 3,
        onProgress: setPdfProgress,
      });
      setPdfProgress("Building PDF…");
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

  const yellowGlossBtn =
    "inline-flex items-center gap-1 rounded-full border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 px-2.5 py-1 text-[11px] font-semibold text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_3px_10px_rgba(251,191,36,0.3)] backdrop-blur-md transition active:scale-95 disabled:opacity-40";

  return (
    <div className="thin-scroll flex min-h-0 flex-1 flex-col overflow-y-auto text-zinc-800">
      {selectedElement && (
        <>
          <section className="space-y-2 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={heading.muted}>Selection</p>
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
                Clear
              </button>
            </div>
          </section>
          <Divider />
        </>
      )}

      <section className="space-y-2 px-4 py-3">
        <p className={heading.muted}>Model</p>
        <p className="truncate text-sm font-semibold tracking-wide">
          {modelLabel}
        </p>
        <div className="flex gap-4 text-xs">
          <span>
            <span className="font-semibold tabular-nums">{floors.length}</span>{" "}
            floors
          </span>
          <span>
            <span className="font-semibold tabular-nums">{rooms.length}</span>{" "}
            rooms
          </span>
        </div>
      </section>

      <Divider />

      <section className="space-y-2.5 px-4 py-3">
        <p className={heading.panel}>Floors & rooms</p>
        <select
          value={selectedFloor ?? ""}
          disabled={floorsWithRooms.length === 0}
          onChange={(e) =>
            setSelectedFloor(e.target.value === "" ? null : e.target.value)
          }
          className="w-full rounded-xl border border-zinc-300/60 bg-white/50 px-3 py-2 text-sm outline-none focus:border-zinc-400"
        >
          <option value="">All floors — pick one for plan</option>
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
                  No floor plan for this level
                </div>
              )}
            </div>

            <p className={heading.muted}>Rooms ({floorRooms.length})</p>
            {floorRooms.length === 0 ? (
              <p className="text-xs text-zinc-400">No rooms on this floor.</p>
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
            Select a floor to see its plan and rooms
          </p>
        )}
      </section>

      <Divider />

      <section className="space-y-2 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className={heading.panel}>Saved views</p>
          <button
            type="button"
            disabled={rooms.length === 0}
            onClick={openPdfPopup}
            title="Export PDF report"
            aria-label="Save PDF report"
            aria-expanded={pdfOpen}
            className={yellowGlossBtn}
          >
            <PiFilePdfThin className="h-4 w-4" />
            PDF
          </button>
        </div>
        {savedViews.length === 0 ? (
          <p className="text-xs text-zinc-400">
            Use the street-view button in the bottom toolbar to save a camera
            pose.
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
              aria-label="Close PDF dialog"
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
              aria-label="Download PDF"
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
                            Download PDF
                          </p>
                          <p className="mt-0.5 text-[11px] text-zinc-500">
                            Floors + presentation views
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={pdfExporting}
                          onClick={() => setPdfOpen(false)}
                          className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-white/50 hover:text-zinc-700"
                          aria-label="Close"
                        >
                          ✕
                        </button>
                      </div>

                      {pdfExporting && (
                        <p className="rounded-xl bg-white/50 px-3 py-2 text-[11px] font-medium text-zinc-700">
                          {pdfProgress || "Exporting…"}
                        </p>
                      )}

                      <div className="rounded-xl border border-white/50 bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                        <p className="text-xs font-semibold text-zinc-800">
                          All pages (A4)
                        </p>
                        <p className="mt-1 text-[10px] leading-snug text-zinc-500">
                          Each floor: Heizlast + Temperature (full image,
                          legend top-right) and room table. Then presentation
                          stack (both modes). File:{" "}
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
                              Exporting…
                            </>
                          ) : (
                            <>
                              <PiFilePdfThin className="h-5 w-5" />
                              Download all pages
                            </>
                          )}
                        </button>
                      </div>

                      <div className="rounded-xl border border-white/50 bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                        <p className="text-xs font-semibold text-zinc-800">
                          Presentation views
                        </p>
                        <p className="mt-1 text-[10px] leading-snug text-zinc-500">
                          Stack layout, all floors — one Heizlast page and one
                          Temperature page. High quality. Choose paper size:
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
                          Download presentation ({pdfPageFormat.toUpperCase()})
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={pdfExporting}
                        onClick={() => setPdfOpen(false)}
                        className="h-9 w-full rounded-xl border border-white/50 bg-white/40 text-sm font-medium text-zinc-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-md hover:bg-white/60"
                      >
                        Cancel
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
