"use client";

import { useEffect, useMemo } from "react";
import { roomLoadColor, roomDensityLoad } from "@/lib/roomLoad";
import { heading } from "@/lib/designTokens";
import { listVisibleFloors } from "@/lib/floorFilter";
import { useAppStore, useEffectiveColorPalette } from "@/store/useAppStore";
import { t } from "@/lib/i18n";
import LegendBody from "./LegendBody";
import ModelText from "./ModelText";
import {
  formatFlowVolume,
  formatHeatLoss,
  groupRoomsByVentilationZone,
  roomInVentilationZone,
  roomVentilationListMetrics,
  roomVentilationZoneKey,
  summaryVentilationZoneKey,
} from "@/lib/ventilation";

/** Light tint of a hex color for list row backgrounds. */
function lightTint(hex: string, mix = 0.78): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `${hex}33`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mixCh = (c: number) => Math.round(c + (255 - c) * mix);
  return `rgb(${mixCh(r)}, ${mixCh(g)}, ${mixCh(b)})`;
}

/**
 * Presentation right panel: Legend (+ more menu).
 * When isolate is on: floor list + rooms for the selected floor.
 */
export default function PresentationSidePanel({
  includeLegend = true,
  compact = false,
}: {
  includeLegend?: boolean;
  compact?: boolean;
} = {}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const floors = useAppStore((s) => s.floors);
  const rooms = useAppStore((s) => s.rooms);
  const presentationFloorId = useAppStore((s) => s.presentationFloorId);
  const setPresentationFloorId = useAppStore((s) => s.setPresentationFloorId);
  const presentationIsolate = useAppStore((s) => s.presentationIsolate);
  const selectedRoomId = useAppStore((s) => s.selectedRoomId);
  const setSelectedRoomId = useAppStore((s) => s.setSelectedRoomId);
  const selectedVentilationZoneKey = useAppStore(
    (s) => s.selectedVentilationZoneKey,
  );
  const setSelectedVentilationZoneKey = useAppStore(
    (s) => s.setSelectedVentilationZoneKey,
  );
  const setSelectedElement = useAppStore((s) => s.setSelectedElement);
  const requestRoomFocus = useAppStore((s) => s.requestRoomFocus);
  const activeColorPalette = useEffectiveColorPalette();
  const heizlastRange = useAppStore((s) => s.heizlastRange);
  const kuhllastRange = useAppStore((s) => s.kuhllastRange);
  const dataViewMode = useAppStore((s) => s.dataViewMode);
  const customLegendColors = useAppStore((s) => s.customLegendColors);
  const loadOverrides =
    dataViewMode === "kuhllast"
      ? customLegendColors.kuhllast
      : customLegendColors.heizlast;
  const ventilation = dataViewMode === "luftung";

  const floorsWithRooms = useMemo(
    () => listVisibleFloors(floors, rooms),
    [floors, rooms],
  );

  const floorRooms = useMemo(() => {
    if (!presentationFloorId) return [];
    return rooms
      .filter((r) => r.floorId === presentationFloorId)
      .sort(
        (a, b) =>
          a.number.localeCompare(b.number) || a.name.localeCompare(b.name),
      );
  }, [rooms, presentationFloorId]);

  /** When isolating a floor, zone totals match that floor only (like VentilationZonePanel floorId). */
  const ventilationScopeRooms = useMemo(
    () =>
      presentationIsolate && presentationFloorId ? floorRooms : rooms,
    [presentationIsolate, presentationFloorId, floorRooms, rooms],
  );

  const selectedZone = useMemo(() => {
    if (!selectedVentilationZoneKey) return null;
    return (
      groupRoomsByVentilationZone(ventilationScopeRooms).find(
        (z) => summaryVentilationZoneKey(z) === selectedVentilationZoneKey,
      ) ?? null
    );
  }, [ventilationScopeRooms, selectedVentilationZoneKey]);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );

  // Prefer Erdgeschoss, else first visible floor
  useEffect(() => {
    if (!presentationIsolate || floorsWithRooms.length === 0) return;
    const stillValid = floorsWithRooms.some(
      (f) => f.id === presentationFloorId,
    );
    if (stillValid) return;
    const erd = floorsWithRooms.find((f) =>
      /erdgeschoss|\beg\b|ground\s*floor|egeschoss/i.test(f.name),
    );
    setPresentationFloorId(erd?.id ?? floorsWithRooms[0].id);
  }, [
    presentationIsolate,
    floorsWithRooms,
    presentationFloorId,
    setPresentationFloorId,
  ]);

  const selectRoom = (roomId: string, expressId: number, floorId: string) => {
    requestRoomFocus(roomId);
    setSelectedRoomId(roomId);
    void import("@/lib/ifcClient").then(({ getElementDetails }) =>
      getElementDetails(expressId, floorId, roomId).then((el) => {
        if (el) setSelectedElement(el);
      }),
    );
  };

  const selectVentilationZone = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;
    setSelectedVentilationZoneKey(roomVentilationZoneKey(room));
    setSelectedRoomId(null);
    setSelectedElement(null);
  };

  /** Double-click: keep zone for 3D markers, focus one room in the panel. */
  const focusVentilationRoom = (
    roomId: string,
    expressId: number,
    floorId: string,
  ) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;
    setSelectedVentilationZoneKey(roomVentilationZoneKey(room));
    selectRoom(roomId, expressId, floorId);
  };

  const clearVentilationSelection = () => {
    setSelectedVentilationZoneKey(null);
    setSelectedRoomId(null);
    setSelectedElement(null);
  };

  const showZoneSummary = Boolean(selectedZone && !selectedRoomId);
  const showRoomSummary = Boolean(selectedRoom);

  if (!includeLegend && !presentationIsolate) {
    return null;
  }

  return (
    <div className="flex flex-col text-[var(--text-body)]">
      {includeLegend && (
        <div className="shrink-0">
          <LegendBody paddedTop />
        </div>
      )}

      {presentationIsolate && (
        <section
          className={
            compact
              ? "flex flex-col space-y-1 px-2 pb-1.5"
              : "flex flex-col space-y-2 px-3 pb-3"
          }
        >
          <p className={`${heading.muted} shrink-0`}>
            {t(uiLanguage, "floorLevel")}
          </p>
          <div className="glass-inset thin-scroll max-h-28 shrink-0 divide-y divide-zinc-200/60 overflow-y-auto rounded-xl">
            {floorsWithRooms.length === 0 ? (
              <p className="px-2.5 py-2 text-[11px] text-[var(--text-muted)]">
                {t(uiLanguage, "noFloors")}
              </p>
            ) : (
              floorsWithRooms.map((f) => {
                const active = f.id === presentationFloorId;
                const count = rooms.filter((r) => r.floorId === f.id).length;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setPresentationFloorId(f.id)}
                    className={`flex w-full items-center justify-between gap-2 px-2.5 text-left transition-colors ${
                      compact ? "py-1 text-[11px]" : "py-2 text-xs"
                    } ${
                      active
                        ? "bg-[var(--chip-active-bg)] font-semibold text-[var(--chip-active-text)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--glass-inset-bg)]"
                    }`}
                  >
                    <ModelText className="min-w-0 truncate">{f.name}</ModelText>
                    <span className="tabular-nums text-[10px] text-[var(--text-muted)]">
                      {count}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <p className={`${heading.muted} shrink-0`}>
            {t(uiLanguage, "rooms")} ({floorRooms.length})
          </p>
          {floorRooms.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">
              {t(uiLanguage, "noRoomsOnFloor")}
            </p>
          ) : (
            <ul
              className={`thin-scroll space-y-0.5 overflow-y-auto overscroll-contain pr-0.5 pb-1 ${
                compact ? "max-h-40" : "max-h-52"
              }`}
            >
              {floorRooms.map((room) => {
                const hex = roomLoadColor(
                  room,
                  dataViewMode,
                  activeColorPalette,
                  heizlastRange,
                  kuhllastRange,
                  loadOverrides,
                );
                const density = roomDensityLoad(room, dataViewMode);
                const active = room.id === selectedRoomId;
                const inSelectedZone =
                  !selectedVentilationZoneKey ||
                  roomInVentilationZone(room, selectedVentilationZoneKey);
                const ventMetrics = ventilation
                  ? roomVentilationListMetrics(room.ventilation)
                  : null;
                return (
                  <li key={room.id}>
                    <button
                      type="button"
                      onClick={() =>
                        ventilation
                          ? selectVentilationZone(room.id)
                          : selectRoom(room.id, room.expressId, room.floorId)
                      }
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        if (ventilation) {
                          focusVentilationRoom(
                            room.id,
                            room.expressId,
                            room.floorId,
                          );
                        } else {
                          selectRoom(room.id, room.expressId, room.floorId);
                        }
                      }}
                      className={`flex w-full min-w-0 items-center gap-1.5 rounded-lg border text-left transition-all ${
                        compact ? "px-1.5 py-0.5" : "px-2 py-1"
                      } ${
                        active
                          ? "border-[var(--panel-divider)] shadow-sm ring-1 ring-[var(--panel-divider)]"
                          : inSelectedZone && selectedVentilationZoneKey
                            ? "border-[var(--panel-divider)]"
                            : "border-transparent hover:border-[var(--panel-divider)]"
                      } ${
                        ventilation &&
                        selectedVentilationZoneKey &&
                        !inSelectedZone
                          ? "opacity-45"
                          : ""
                      }`}
                      style={{ backgroundColor: lightTint(hex, 0.82) }}
                    >
                      <ModelText className="min-w-0 shrink truncate text-[10px] font-semibold text-on-tint sm:max-w-[42%]">
                        {room.number ? `${room.number} · ` : ""}
                        {room.name}
                      </ModelText>
                      {ventMetrics ? (
                        <span className="min-w-0 flex-1 truncate text-right text-[9px] tabular-nums text-on-tint-muted">
                          {t(uiLanguage, "abluftVolume")} {ventMetrics.abluft}
                          {" · "}
                          {t(uiLanguage, "zuluftVolume")} {ventMetrics.zuluft}
                          {" · "}
                          {ventMetrics.heatLoss}
                        </span>
                      ) : (
                        <span className="ml-auto shrink-0 text-[9px] tabular-nums text-on-tint-muted">
                          {density.toFixed(0)} W/m² · {room.temperature.toFixed(1)} °C
                        </span>
                      )}
                      <span
                        className="h-2 w-2 shrink-0 rounded-sm border border-zinc-400/30"
                        style={{ backgroundColor: hex }}
                        aria-hidden
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {ventilation && (showZoneSummary || showRoomSummary) ? (
            <div
              className={`shrink-0 space-y-1.5 border-t border-[var(--panel-divider)] ${
                compact ? "pt-1.5" : "pt-2.5"
              }`}
            >
              {showZoneSummary && selectedZone ? (
                <div
                  className={`rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)] ${
                    compact ? "p-2" : "p-2.5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        {t(uiLanguage, "usageZone")}
                      </p>
                      <p className="truncate text-[11px] font-semibold text-[var(--text-strong)]">
                        {selectedZone.zoneName}
                      </p>
                      {selectedZone.ventilationZoneName ? (
                        <p className="truncate text-[10px] text-[var(--text-muted)]">
                          {selectedZone.ventilationZoneName}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={clearVentilationSelection}
                      className="shrink-0 text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                    >
                      {t(uiLanguage, "showAllZones")}
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-2 text-[9px] tabular-nums text-[var(--text-body)]">
                    <span>
                      {t(uiLanguage, "abluftVolume")}:{" "}
                      {formatFlowVolume(selectedZone.totalAbluft)}
                    </span>
                    <span>
                      {t(uiLanguage, "zuluftVolume")}:{" "}
                      {formatFlowVolume(selectedZone.totalZuluft)}
                    </span>
                    <span>
                      {t(uiLanguage, "luftungHeatLoss")}:{" "}
                      {formatHeatLoss(selectedZone.totalHeatLoss)}
                    </span>
                  </div>
                </div>
              ) : null}

              {showRoomSummary && selectedRoom ? (
                <div
                  className={`rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] ${
                    compact ? "px-2 py-1.5" : "px-2.5 py-2"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      {t(uiLanguage, "rooms")}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoomId(null);
                        setSelectedElement(null);
                      }}
                      className="shrink-0 text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                    >
                      {t(uiLanguage, "showAllZones")}
                    </button>
                  </div>
                  <p className="truncate text-[11px] font-semibold text-[var(--text-strong)]">
                    {selectedRoom.number ? `${selectedRoom.number} · ` : ""}
                    {selectedRoom.name}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
