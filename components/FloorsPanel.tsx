"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { PiFilePdfThin } from "react-icons/pi";
import { IoChevronDownSharp, IoChevronUp } from "react-icons/io5";
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
import type { Viewer3DHandle } from "./Viewer3D";
import type { Floor, Room } from "@/lib/types";
import type { PageFormat } from "@/lib/presentationLayout";

type Props = {
  viewerRef: RefObject<Viewer3DHandle | null>;
  onFile: (file: File) => void;
  isLoadingModel?: boolean;
};

function Divider() {
  return <div className="mx-3 border-t border-zinc-300/50" />;
}

/** Left panel: building summary, floors, rooms, slice, saved views. */
export default function FloorsPanel({
  viewerRef,
  onFile,
  isLoadingModel = false,
}: Props) {
  const floors = useAppStore((s) => s.floors);
  const rooms = useAppStore((s) => s.rooms);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const selectedRoomId = useAppStore((s) => s.selectedRoomId);
  const isPresentationView = useAppStore((s) => s.isPresentationView);
  const presentationFloorId = useAppStore((s) => s.presentationFloorId);
  const presentationIsolate = useAppStore((s) => s.presentationIsolate);
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const colorMode = useAppStore((s) => s.colorMode);
  const activeColorPalette = useAppStore((s) => s.activeColorPalette);
  const heizlastRange = useAppStore((s) => s.heizlastRange);
  const temperatureRange = useAppStore((s) => s.temperatureRange);
  const activeModelId = useAppStore((s) => s.activeModelId);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const activeModelFileSizeBytes = useAppStore(
    (s) => s.activeModelFileSizeBytes,
  );
  const savedViews = useAppStore((s) => s.savedViews);
  const selectedElement = useAppStore((s) => s.selectedElement);

  const setSelectedFloor = useAppStore((s) => s.setSelectedFloor);
  const setSelectedRoomId = useAppStore((s) => s.setSelectedRoomId);
  const setSelectedElement = useAppStore((s) => s.setSelectedElement);
  const setPresentationFloorId = useAppStore((s) => s.setPresentationFloorId);
  const setPresentationIsolate = useAppStore((s) => s.setPresentationIsolate);
  const goToSavedView = useAppStore((s) => s.goToSavedView);
  const removeSavedView = useAppStore((s) => s.removeSavedView);

  const { shellGroup, rooms: sceneRooms } = useModelScene();
  const totalComponents = rooms.length + (shellGroup?.children?.length ?? 0);

  const formatBytes = (bytes: number | null) => {
    if (!Number.isFinite(bytes ?? NaN)) return "—";
    const v = bytes as number;
    if (v <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"] as const;
    let idx = 0;
    let n = v;
    while (n >= 1024 && idx < units.length - 1) {
      n /= 1024;
      idx += 1;
    }
    const digits = idx === 0 ? 0 : 1;
    return `${n.toFixed(digits)} ${units[idx]}`;
  };
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");
  const [pdfPageFormat, setPdfPageFormat] = useState<PageFormat>("a3");
  const [pdfSavedSelection, setPdfSavedSelection] = useState<string[]>([]);

  const [floorsExpanded, setFloorsExpanded] = useState(true);
  const [roomsExpanded, setRoomsExpanded] = useState(true);
  const [selectionExpanded, setSelectionExpanded] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelTipOpen, setModelTipOpen] = useState(false);
  const [modelTipSuppressed, setModelTipSuppressed] = useState(false);
  const [modelTipPos, setModelTipPos] = useState({ top: 0, left: 0 });
  const modelBadgeRef = useRef<HTMLButtonElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const modelFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRoomsExpanded(Boolean(selectedFloor));
  }, [selectedFloor]);

  const updateModelTipPos = () => {
    const el = modelBadgeRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setModelTipPos({ top: r.bottom + 10, left: r.left + r.width / 2 });
  };

  useLayoutEffect(() => {
    if (!modelTipOpen) return;
    updateModelTipPos();
    window.addEventListener("resize", updateModelTipPos);
    window.addEventListener("scroll", updateModelTipPos, true);
    return () => {
      window.removeEventListener("resize", updateModelTipPos);
      window.removeEventListener("scroll", updateModelTipPos, true);
    };
  }, [modelTipOpen]);

  useEffect(() => {
    if (!modelMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        modelMenuRef.current?.contains(target) ||
        modelBadgeRef.current?.contains(target)
      ) {
        return;
      }
      setModelMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [modelMenuOpen]);

  const modelDetailHint = useMemo(() => {
    const floorsLine = `${floors.length} ${t(uiLanguage, "floors")} · ${rooms.length} ${t(uiLanguage, "rooms")}`;
    const sizeLine = `${totalComponents} · ${formatBytes(activeModelFileSizeBytes)}`;
    return `${floorsLine}\n${sizeLine}`;
  }, [
    floors.length,
    rooms.length,
    totalComponents,
    activeModelFileSizeBytes,
    uiLanguage,
  ]);

  const sortedFloors = useMemo(
    () => [...floors].sort((a, b) => a.elevation - b.elevation),
    [floors],
  );

  useEffect(() => {
    if (selectedFloor && !sortedFloors.some((f) => f.id === selectedFloor)) {
      setSelectedFloor(null);
    }
  }, [selectedFloor, sortedFloors, setSelectedFloor]);

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
          640,
          selectedRoomId,
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
    selectedRoomId,
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
    const restorePresentationIsolate = presentationIsolate;
    const restorePresentationFloorId = presentationFloorId;
    const restoreSelectedFloor = selectedFloor;
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
        // When exporting in presentation mode, also restore the presentation isolate state.
        if (isPresentationView) {
          const fid = view.floorId;
          setPresentationIsolate(fid != null);
          setPresentationFloorId(fid);
          setSelectedFloor(null);
        } else {
          setSelectedFloor(view.floorId);
        }
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
      // Restore UI state after capture.
      setPresentationIsolate(restorePresentationIsolate);
      setPresentationFloorId(restorePresentationFloorId);
      setSelectedFloor(restoreSelectedFloor);
    }
  };

  const yellowGlossBtn =
    "inline-flex items-center gap-1 rounded-full border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 px-2.5 py-1 text-[11px] font-semibold text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_3px_10px_rgba(251,191,36,0.3)] backdrop-blur-md transition active:scale-95 disabled:opacity-40";

  return (
    <div className="flex min-h-0 flex-1 flex-col text-zinc-800">
      <section className="space-y-2 px-4 py-3">
        {/* Header row: label + yellow glass IFC name badge */}
        <div className="flex items-center justify-between gap-2">
          <p className={heading.muted}>{t(uiLanguage, "model")}</p>
          <div className="relative max-w-[58%]">
            <input
              ref={modelFileInputRef}
              type="file"
              accept=".ifc,application/x-step,application/octet-stream,.IFC"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onFile(file);
              }}
            />
            <button
              ref={modelBadgeRef}
              type="button"
              disabled={isLoadingModel}
              onMouseEnter={() => {
                if (modelTipSuppressed || modelMenuOpen) return;
                updateModelTipPos();
                setModelTipOpen(true);
              }}
              onMouseLeave={() => {
                setModelTipOpen(false);
                setModelTipSuppressed(false);
              }}
              onClick={() => {
                setModelTipOpen(false);
                setModelTipSuppressed(true);
                setModelMenuOpen((v) => !v);
              }}
              className="max-w-full truncate rounded-full border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 px-2.5 py-0.5 text-[11px] font-semibold text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-md transition active:scale-[0.98] disabled:opacity-45"
              aria-expanded={modelMenuOpen}
              aria-label={modelLabel}
            >
              {modelLabel}
            </button>

            {modelTipOpen &&
              !modelMenuOpen &&
              typeof document !== "undefined" &&
              createPortal(
                <div
                  role="tooltip"
                  className="pointer-events-none fixed z-[200] w-max max-w-[240px] -translate-x-1/2"
                  style={{ top: modelTipPos.top, left: modelTipPos.left }}
                >
                  <GlassPanel variant="control" zIndex={200}>
                    <div className="px-3.5 py-2.5 text-center">
                      <p className="text-[12px] font-semibold tracking-wide text-zinc-900">
                        {modelLabel}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-[11px] leading-snug text-zinc-600">
                        {modelDetailHint}
                      </p>
                    </div>
                  </GlassPanel>
                </div>,
                (document.fullscreenElement as HTMLElement | null) ??
                  document.body,
              )}

            {modelMenuOpen && (
              <div
                ref={modelMenuRef}
                className="absolute top-[calc(100%+0.4rem)] right-0 z-[60] w-max min-w-[10.5rem]"
              >
                <GlassPanel variant="control" zIndex={60}>
                  <div className="flex flex-col gap-1 p-1.5">
                    <button
                      type="button"
                      disabled={isLoadingModel}
                      onClick={() => {
                        setModelMenuOpen(false);
                        modelFileInputRef.current?.click();
                      }}
                      className="rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-200/90 via-yellow-300/70 to-amber-400/55 px-2.5 py-1.5 text-left text-[11px] font-semibold text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition hover:brightness-105 disabled:opacity-45"
                    >
                      {t(uiLanguage, "loadOtherIfc")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModelMenuOpen(false)}
                      className="rounded-xl border border-transparent px-2.5 py-1.5 text-left text-[11px] text-zinc-700 transition hover:border-white/55 hover:bg-white/40"
                    >
                      {t(uiLanguage, "cancel")}
                    </button>
                  </div>
                </GlassPanel>
              </div>
            )}
          </div>
        </div>

        {/* Single-line stats — values stay, labels truncate */}
        <div className="mt-1 flex items-center gap-1.5 overflow-hidden text-[11px] text-zinc-600">
          <span className="shrink-0 font-semibold tabular-nums">{floors.length}</span>
          <span className="min-w-0 truncate">{t(uiLanguage, "floors")}</span>
          <span className="shrink-0 text-zinc-400">|</span>
          <span className="shrink-0 font-semibold tabular-nums">{rooms.length}</span>
          <span className="min-w-0 truncate">{t(uiLanguage, "rooms")}</span>
          <span className="shrink-0 text-zinc-400">|</span>
          <span className="shrink-0 font-semibold tabular-nums">{totalComponents}</span>
          <span className="min-w-0 truncate">Komp.</span>
          <span className="shrink-0 text-zinc-400">|</span>
          <span className="shrink-0 font-semibold">
            {formatBytes(activeModelFileSizeBytes)}
          </span>
        </div>
      </section>

      <Divider />

      {/* === SCROLLABLE MIDDLE: Floors & Rooms === */}
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
      <section className="space-y-1.5 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className={heading.panel}>{t(uiLanguage, "floorsAndRooms")}</p>
          <button
            type="button"
            onClick={() => setFloorsExpanded((v) => !v)}
            aria-label={floorsExpanded ? t(uiLanguage, "hideFloors") : t(uiLanguage, "showFloors")}
            className="flex items-center justify-center rounded-lg border border-zinc-300/60 bg-white/40 px-1.5 py-0.5 text-zinc-600 transition-colors duration-200 hover:bg-white/60"
          >
            {floorsExpanded ? (
              <IoChevronDownSharp className="h-3 w-3" />
            ) : (
              <IoChevronUp className="h-3 w-3" />
            )}
          </button>
        </div>

        <div
          className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
            floorsExpanded ? "max-h-[720px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="space-y-1 pt-0.5">
            {/* 3D View (all elements, no isolation) */}
            <button
              type="button"
              onClick={() => {
                setSelectedElement(null);
                setSelectedRoomId(null);
                setSelectedFloor(null);
                setRoomsExpanded(false);
              }}
              className={`w-full rounded-lg border px-2 py-1 text-left text-[11px] transition-colors ${
                selectedFloor == null
                  ? "border-amber-200/70 bg-gradient-to-br from-amber-100/55 via-yellow-100/40 to-amber-200/35 font-semibold text-zinc-900"
                  : "border-zinc-300/60 bg-white/30 text-zinc-600 hover:bg-white/45"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{t(uiLanguage, "view3d")}</span>
                <span className="tabular-nums text-[10px] text-zinc-400">
                  {floors.length}
                </span>
              </span>
            </button>

            {/* Floors list */}
            <div className="divide-y divide-zinc-200/60 rounded-lg border border-zinc-300/50 bg-white/30">
              {sortedFloors.map((f) => {
                const active = f.id === selectedFloor;
                const count = rooms.filter((r) => r.floorId === f.id).length;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setSelectedElement(null);
                      setSelectedFloor(f.id);
                      setRoomsExpanded(true);
                    }}
                    className={`flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-[11px] transition-colors ${
                      active
                        ? "bg-zinc-900/10 font-semibold text-zinc-900"
                        : "text-zinc-600 hover:bg-zinc-900/5"
                    }`}
                  >
                    <span className="min-w-0 truncate">{f.name}</span>
                    <span className="tabular-nums text-[10px] text-zinc-400">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Rooms tab + 2D layout */}
            {selectedFloor ? (
              <div className="space-y-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => setRoomsExpanded((v) => !v)}
                  aria-label={roomsExpanded ? "Hide rooms" : "Show rooms"}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-300/60 bg-white/35 px-2 py-1 text-left"
                >
                  <span className="text-[11px] font-semibold text-zinc-700">
                    {t(uiLanguage, "roomsInSelectedFloor")}
                  </span>
                  {roomsExpanded ? (
                    <IoChevronDownSharp className="h-3 w-3 text-zinc-600" />
                  ) : (
                    <IoChevronUp className="h-3 w-3 text-zinc-600" />
                  )}
                </button>

                <div
                  className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
                    roomsExpanded
                      ? "max-h-[560px] opacity-100"
                      : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="overflow-hidden rounded-lg border border-zinc-300/50 bg-[#f2f4f7]">
                    {snapshotUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={snapshotUrl}
                        alt={`Floor plan ${selectedFloorObj?.name ?? ""}`}
                        className="aspect-square w-full object-contain"
                      />
                    ) : (
                      <div className="flex aspect-square items-center justify-center text-[11px] text-zinc-400">
                        {t(uiLanguage, "noFloorPlan")}
                      </div>
                    )}
                  </div>

                  <p className="mt-1 px-0.5 text-[10px] font-medium text-zinc-500">
                    {t(uiLanguage, "rooms")} ({floorRooms.length})
                  </p>

                  {floorRooms.length === 0 ? (
                    <p className="text-[11px] text-zinc-400">
                      {t(uiLanguage, "noRoomsOnFloor")}
                    </p>
                  ) : (
                    <ul className="thin-scroll max-h-48 space-y-0 overflow-y-auto pb-1 pr-0.5">
                      {floorRooms.map((room) => {
                        const active = room.id === selectedRoomId;
                        return (
                          <li key={room.id}>
                            <button
                              type="button"
                              onClick={() => selectRoomFromList(room)}
                              className={`flex w-full items-center justify-between gap-2 rounded px-2 py-0.5 text-left text-[11px] transition-colors ${
                                active
                                  ? "bg-zinc-900/10 font-semibold text-zinc-900"
                                  : "text-zinc-600 hover:bg-zinc-900/5"
                              }`}
                            >
                              <span className="min-w-0 truncate">
                                {room.number ? `${room.number} · ` : ""}
                                {room.name}
                              </span>
                              <span className="tabular-nums text-[10px] text-zinc-400">
                                {room.heatLoad.toFixed(0)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <p className="px-1 text-[11px] text-zinc-400">
                {t(uiLanguage, "selectFloorHint")}
              </p>
            )}
          </div>
        </div>
      </section>
      </div>
      {/* === END SCROLLABLE MIDDLE === */}

      <Divider />

      {/* === FIXED BOTTOM: Selection (always shown) + Saved Views (10%) === */}
      <section
        className={`shrink-0 flex-col px-4 py-3 ${
          selectionExpanded && selectedElement ? "flex h-[25%]" : "flex"
        } space-y-2`}
      >
        {/* Header row — always visible */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <p className={heading.muted}>{t(uiLanguage, "selection")}</p>
            {selectedElement && (
              <p className="truncate text-[11px] font-semibold text-zinc-800">
                {selectedElement.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-zinc-500">
              Attributes
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={selectionExpanded}
              disabled={!selectedElement}
              onClick={() => setSelectionExpanded((v) => !v)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40 ${
                selectionExpanded && selectedElement
                  ? "bg-sky-600"
                  : "bg-zinc-300/80"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                  selectionExpanded && selectedElement
                    ? "translate-x-4"
                    : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {selectionExpanded && selectedElement && (
          <>
              <div className="min-h-0 flex-1 rounded-xl border border-zinc-300/40 bg-white/30 p-2">
                <p className="mb-1 text-[10px] font-semibold tracking-wide text-zinc-600">
                  Attributes
                </p>
                <div className="thin-scroll h-full max-h-full overflow-y-auto pr-1">
                  <ul className="space-y-0.5">
                    <li className="text-[10px] leading-tight text-zinc-700">
                      <span className="font-semibold text-zinc-600">Kind</span>
                      :{" "}
                      <span className="break-words text-zinc-800">
                        {selectedElement.kind}
                      </span>
                    </li>

                    <li className="text-[10px] leading-tight text-zinc-700">
                      <span className="font-semibold text-zinc-600">Floor</span>
                      :{" "}
                      <span className="break-words text-zinc-800">
                        {selectedElement.floorId ?? "—"}
                      </span>
                    </li>

                    <li className="text-[10px] leading-tight text-zinc-700">
                      <span className="font-semibold text-zinc-600">
                        Express ID
                      </span>
                      :{" "}
                      <span className="break-words text-zinc-800">
                        {selectedElement.expressId}
                      </span>
                    </li>

                    <li className="text-[10px] leading-tight text-zinc-700">
                      <span className="font-semibold text-zinc-600">Room ID</span>
                      :{" "}
                      <span className="break-words text-zinc-800">
                        {selectedElement.roomId ?? "—"}
                      </span>
                    </li>

                    <li className="text-[10px] leading-tight text-zinc-700">
                      <span className="font-semibold text-zinc-600">
                        Global ID
                      </span>
                      :{" "}
                      <span className="break-words text-zinc-800">
                        {selectedElement.globalId ?? "—"}
                      </span>
                    </li>

                    {(selectedElement.properties ?? []).map((p, idx) => (
                      <li
                        key={`${p.name}-${p.value}-${p.pset ?? "none"}-${idx}`}
                        className="text-[10px] leading-tight text-zinc-700"
                      >
                        <span className="font-semibold text-zinc-600">
                          {p.pset ? `${p.pset} · ` : ""}
                          {p.name}
                        </span>
                        :{" "}
                        <span className="break-words text-zinc-800">
                          {p.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
      </section>

      <Divider />

      <section className="shrink-0 space-y-2 px-4 py-2">
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
          <ul className="thin-scroll max-h-16 space-y-1 overflow-y-auto">
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
