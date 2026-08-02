"use client";

import { useMemo } from "react";
import { roomLoadColor } from "@/lib/roomLoad";
import { heading } from "@/lib/designTokens";
import { t } from "@/lib/i18n";
import {
  formatFlowVolume,
  formatHeatLoss,
  groupRoomsByVentilationZone,
  roomInVentilationZone,
  roomVentilationListMetrics,
  summaryVentilationZoneKey,
} from "@/lib/ventilation";
import type { Room } from "@/lib/types";
import { useAppStore, useEffectiveColorPalette } from "@/store/useAppStore";
import ModelText from "./ModelText";

type Props = {
  compact?: boolean;
  className?: string;
  /** Limit zones / rooms to one floor (presentation isolate). */
  floorId?: string | null;
};

function lightTint(hex: string, mix = 0.78): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `${hex}33`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mixCh = (c: number) => Math.round(c + (255 - c) * mix);
  return `rgb(${mixCh(r)}, ${mixCh(g)}, ${mixCh(b)})`;
}

export default function VentilationZonePanel({
  compact = false,
  className = "",
  floorId = null,
}: Props) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const rooms = useAppStore((s) => s.rooms);
  const dataViewMode = useAppStore((s) => s.dataViewMode);
  const selectedZoneKey = useAppStore((s) => s.selectedVentilationZoneKey);
  const setSelectedZoneKey = useAppStore((s) => s.setSelectedVentilationZoneKey);
  const selectedRoomId = useAppStore((s) => s.selectedRoomId);
  const requestRoomFocus = useAppStore((s) => s.requestRoomFocus);
  const setSelectedElement = useAppStore((s) => s.setSelectedElement);
  const activeColorPalette = useEffectiveColorPalette();
  const heizlastRange = useAppStore((s) => s.heizlastRange);
  const kuhllastRange = useAppStore((s) => s.kuhllastRange);
  const customLegendColors = useAppStore((s) => s.customLegendColors);
  const loadOverrides =
    dataViewMode === "kuhllast"
      ? customLegendColors.kuhllast
      : customLegendColors.heizlast;

  const scopedRooms = useMemo(
    () => (floorId ? rooms.filter((r) => r.floorId === floorId) : rooms),
    [rooms, floorId],
  );

  const zones = useMemo(
    () => groupRoomsByVentilationZone(scopedRooms),
    [scopedRooms],
  );

  const selectedZone = zones.find(
    (z) => summaryVentilationZoneKey(z) === selectedZoneKey,
  );

  const zoneRooms = useMemo(() => {
    if (!selectedZoneKey) return [];
    return scopedRooms
      .filter((r) => roomInVentilationZone(r, selectedZoneKey))
      .sort(
        (a, b) =>
          a.number.localeCompare(b.number) || a.name.localeCompare(b.name),
      );
  }, [scopedRooms, selectedZoneKey]);

  if (dataViewMode !== "luftung" || zones.length === 0) return null;

  const focusRoom = (room: Room) => {
    requestRoomFocus(room.id);
    void import("@/lib/ifcClient").then(({ getElementDetails }) =>
      getElementDetails(room.expressId, room.floorId, room.id).then((el) => {
        if (el) setSelectedElement(el);
      }),
    );
  };

  return (
    <section
      className={`${compact ? "space-y-1 px-2 py-1.5" : "space-y-2 px-3 py-2.5"} ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={heading.muted}>{t(uiLanguage, "usageZone")}</p>
        {selectedZoneKey ? (
          <button
            type="button"
            onClick={() => setSelectedZoneKey(null)}
            className="text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text-strong)]"
          >
            {t(uiLanguage, "showAllZones")}
          </button>
        ) : null}
      </div>

      <ul className="thin-scroll max-h-32 space-y-1 overflow-y-auto pr-0.5">
        {zones.map((zone) => {
          const key = summaryVentilationZoneKey(zone);
          const active = key === selectedZoneKey;
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => setSelectedZoneKey(active ? null : key)}
                className={`w-full rounded-lg px-2 py-1.5 text-left transition-colors ${
                  compact ? "text-[10px]" : "text-[11px]"
                } ${
                  active
                    ? "bg-[var(--chip-active-bg)] text-[var(--chip-active-text)] ring-1 ring-[var(--panel-divider)]"
                    : "bg-[var(--glass-inset-bg)] text-[var(--text-body)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                <p className="font-semibold text-[var(--text-strong)]">
                  {zone.zoneName}
                </p>
                {zone.ventilationZoneName ? (
                  <p className="truncate text-[var(--text-muted)]">
                    {zone.ventilationZoneName}
                  </p>
                ) : null}
                <div className="mt-1 flex flex-wrap gap-x-2 tabular-nums text-[var(--text-muted)]">
                  <span>
                    {t(uiLanguage, "abluftVolume")}:{" "}
                    {formatFlowVolume(zone.totalAbluft)}
                  </span>
                  <span>
                    {t(uiLanguage, "zuluftVolume")}:{" "}
                    {formatFlowVolume(zone.totalZuluft)}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {selectedZone ? (
        <div
          className={`rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)] ${
            compact ? "space-y-1 p-2" : "space-y-1.5 p-2.5"
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {t(uiLanguage, "zoneDetails")}
          </p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] tabular-nums text-[var(--text-body)]">
            <span>
              {t(uiLanguage, "zoneAldTotal")}:{" "}
              {formatFlowVolume(selectedZone.zoneAldVolume)}
            </span>
            <span>
              {t(uiLanguage, "luftungHeatLoss")}:{" "}
              {formatHeatLoss(selectedZone.totalHeatLoss)}
            </span>
            <span>
              {t(uiLanguage, "rooms")}: {selectedZone.roomCount}
            </span>
          </div>

          <p className={`${heading.muted} pt-1`}>
            {t(uiLanguage, "rooms")} ({zoneRooms.length})
          </p>
          <p className="text-[9px] text-[var(--text-muted)]">
            {t(uiLanguage, "doubleClickRoomHint")}
          </p>
          <ul className="thin-scroll max-h-36 space-y-0.5 overflow-y-auto pr-0.5">
            {zoneRooms.map((room) => {
              const hex = roomLoadColor(
                room,
                "luftung",
                activeColorPalette,
                heizlastRange,
                kuhllastRange,
                loadOverrides,
              );
              const active = room.id === selectedRoomId;
              const metrics = roomVentilationListMetrics(room.ventilation);
              return (
                <li key={room.id}>
                  <button
                    type="button"
                    onClick={() => focusRoom(room)}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      focusRoom(room);
                    }}
                    className={`flex w-full min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-left transition-all ${
                      active
                        ? "border-[var(--panel-divider)] ring-1 ring-[var(--panel-divider)]"
                        : "border-transparent hover:border-[var(--panel-divider)]"
                    }`}
                    style={{ backgroundColor: lightTint(hex, 0.82) }}
                  >
                    <ModelText className="min-w-0 shrink truncate text-[10px] font-semibold text-on-tint sm:max-w-[40%]">
                      {room.number ? `${room.number} · ` : ""}
                      {room.name}
                    </ModelText>
                    <span className="min-w-0 flex-1 truncate text-right text-[9px] tabular-nums text-on-tint-muted">
                      {t(uiLanguage, "abluftVolume")} {metrics.abluft}
                      {" · "}
                      {t(uiLanguage, "zuluftVolume")} {metrics.zuluft}
                      {" · "}
                      {metrics.heatLoss}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
