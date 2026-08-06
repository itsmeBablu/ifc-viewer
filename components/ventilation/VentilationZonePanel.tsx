"use client";

/**
 * VentilationZonePanel — compact Nutzungszone (usage-zone) table for the
 * Lüftung legend: one row per floor+zone, with drill-down into a zone's
 * rooms and per-room airflow metrics.
 *
 * Reads rooms/floors, dataViewMode, and selectedVentilationZoneKey from
 * useAppStore; renders nothing outside dataViewMode === "luftung".
 */

import { useMemo, useState } from "react";
import { heading } from "@/lib/designTokens";
import { t } from "@/lib/i18n";
import {
  formatFlowVolumeCompact,
  formatHeatLoss,
  groupRoomsByVentilationZone,
  roomInVentilationZone,
  roomVentilationListMetrics,
  summaryVentilationZoneKey,
  ventilationZoneDisplayName,
} from "@/lib/ventilation";
import type { Room } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import ModelText from "../common/ModelText";

type Props = {
  compact?: boolean;
  className?: string;
  /** Limit zones / rooms to one floor (presentation isolate). */
  floorId?: string | null;
  /** Start collapsed (arrow closed). Default open so values are visible. */
  defaultOpen?: boolean;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform duration-200 ${
        open ? "rotate-180" : "rotate-0"
      }`}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * Compact Nutzungszone table for the Lüftung legend —
 * one row per floor+zone (EG WG1 ≠ 1.OG WG1).
 */
export default function VentilationZonePanel({
  compact = false,
  className = "",
  floorId = null,
  defaultOpen = true,
}: Props) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const rooms = useAppStore((s) => s.rooms);
  const floors = useAppStore((s) => s.floors);
  const dataViewMode = useAppStore((s) => s.dataViewMode);
  const selectedZoneKey = useAppStore((s) => s.selectedVentilationZoneKey);
  const setSelectedZoneKey = useAppStore((s) => s.setSelectedVentilationZoneKey);
  const selectedRoomId = useAppStore((s) => s.selectedRoomId);
  const requestRoomFocus = useAppStore((s) => s.requestRoomFocus);
  const setSelectedElement = useAppStore((s) => s.setSelectedElement);
  const [open, setOpen] = useState(defaultOpen);

  const scopedRooms = useMemo(
    () => (floorId ? rooms.filter((r) => r.floorId === floorId) : rooms),
    [rooms, floorId],
  );

  const zones = useMemo(
    () => groupRoomsByVentilationZone(scopedRooms, floors),
    [scopedRooms, floors],
  );

  /** When a zone is selected, show only that one row (not the full floor list). */
  const displayZones = useMemo(() => {
    if (!selectedZoneKey) return zones;
    return zones.filter(
      (z) => summaryVentilationZoneKey(z) === selectedZoneKey,
    );
  }, [zones, selectedZoneKey]);

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
    if (useAppStore.getState().autoFocusSelection) {
      requestRoomFocus(room.id);
    } else {
      useAppStore.getState().setSelectedRoomId(room.id);
    }
    void import("@/lib/ifcClient").then(({ getElementDetails }) =>
      getElementDetails(room.expressId, room.floorId, room.id).then((el) => {
        if (el) setSelectedElement(el);
      }),
    );
  };

  const th =
    "whitespace-nowrap px-1 py-1 text-left text-[9px] font-semibold tracking-wide text-[var(--text-muted)]";
  const td = "whitespace-nowrap px-1 py-1 align-middle tabular-nums";

  return (
    <section className={`${compact ? "space-y-1" : "space-y-1.5"} ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-0.5 py-0.5 text-left transition-colors hover:bg-[var(--glass-inset-bg)]"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <p className={heading.muted}>{t(uiLanguage, "usageZone")}</p>
          <span className="text-[9px] tabular-nums text-[var(--text-muted)]">
            ({displayZones.length})
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          {selectedZoneKey ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedZoneKey(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedZoneKey(null);
                }
              }}
              className="text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            >
              {t(uiLanguage, "showAllZones")}
            </span>
          ) : null}
          <Chevron open={open} />
        </span>
      </button>

      {open ? (
        <>
          <div className="overflow-hidden rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)]">
            <div className="thin-scroll max-h-44 overflow-x-auto overflow-y-auto">
              <table className="w-full min-w-[19rem] table-fixed border-collapse text-[10px] leading-tight">
                <thead className="sticky top-0 z-[1] bg-[var(--surface-muted)]">
                  <tr className="border-b border-[var(--panel-divider)]">
                    <th className={`${th} w-[18%]`}>
                      {t(uiLanguage, "floorShort")}
                    </th>
                    <th className={`${th} w-[20%] pl-2.5`}>
                      {t(uiLanguage, "zoneShort")}
                    </th>
                    <th
                      className={`${th} w-[21%] text-right`}
                      title={`${t(uiLanguage, "abluftVolume")} m³/h`}
                    >
                      {t(uiLanguage, "abluftShort")}{" "}
                      <span className="font-normal">m³/h</span>
                    </th>
                    <th
                      className={`${th} w-[21%] text-right`}
                      title={`${t(uiLanguage, "zuluftVolume")} m³/h`}
                    >
                      {t(uiLanguage, "zuluftShort")}{" "}
                      <span className="font-normal">m³/h</span>
                    </th>
                    <th
                      className={`${th} w-[20%] text-right`}
                      title={`${t(uiLanguage, "heatLossShort")} W`}
                    >
                      {t(uiLanguage, "heatLossShort")}{" "}
                      <span className="font-normal">W</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayZones.map((zone, i) => {
                    const key = summaryVentilationZoneKey(zone);
                    const active = key === selectedZoneKey;
                    return (
                      <tr
                        key={key}
                        onClick={() =>
                          setSelectedZoneKey(active ? null : key)
                        }
                        className={`cursor-pointer border-b border-[var(--panel-divider)]/40 last:border-b-0 transition-colors ${
                          active
                            ? "bg-[var(--chip-active-bg)] text-[var(--chip-active-text)]"
                            : i % 2 === 0
                              ? "bg-amber-50/70 hover:bg-amber-100/80 dark:bg-amber-400/10 dark:hover:bg-amber-400/18"
                              : "bg-transparent hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        <td
                          className={`${td} min-w-0 font-semibold tabular-nums text-[var(--text-strong)]`}
                        >
                          <span title={zone.floorName || undefined}>
                            {zone.floorAbbrev}
                          </span>
                        </td>
                        <td className={`${td} min-w-0 max-w-0 pl-2.5`}>
                          <span
                            title={
                              zone.ventilationZoneName ||
                              ventilationZoneDisplayName(zone)
                            }
                          >
                            <ModelText className="block truncate font-medium text-[var(--text-strong)]">
                              {ventilationZoneDisplayName(zone)}
                            </ModelText>
                          </span>
                        </td>
                        <td className={`${td} text-right text-[var(--text-body)]`}>
                          {formatFlowVolumeCompact(zone.totalAbluft)}
                        </td>
                        <td className={`${td} text-right text-[var(--text-body)]`}>
                          {formatFlowVolumeCompact(zone.totalZuluft)}
                        </td>
                        <td className={`${td} text-right text-[var(--text-body)]`}>
                          {Number.isFinite(zone.totalHeatLoss) &&
                          zone.totalHeatLoss > 0
                            ? Math.round(zone.totalHeatLoss)
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {selectedZone ? (
            <div
              className={`rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)] ${
                compact ? "space-y-1 p-1.5" : "space-y-1.5 p-2"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate text-[10px] font-semibold text-[var(--text-strong)]">
                  <span className="text-[var(--text-muted)]">
                    {selectedZone.floorAbbrev}
                  </span>
                  <span className="mx-1 text-[var(--text-muted)]">·</span>
                  {ventilationZoneDisplayName(selectedZone)}
                </p>
                <span className="shrink-0 text-[9px] tabular-nums text-[var(--text-muted)]">
                  {formatHeatLoss(selectedZone.totalHeatLoss)}
                  {" · "}
                  {selectedZone.roomCount} {t(uiLanguage, "rooms")}
                </span>
              </div>
              <p className="text-[9px] text-[var(--text-muted)]">
                {t(uiLanguage, "doubleClickRoomHint")}
              </p>
              <ul className="thin-scroll max-h-28 space-y-0.5 overflow-y-auto pr-0.5">
                {zoneRooms.map((room) => {
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
                        className={`flex w-full min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-left transition-colors ${
                          active
                            ? "bg-[var(--chip-active-bg)] ring-1 ring-[var(--panel-divider)]"
                            : "hover:bg-[var(--glass-inset-bg)]"
                        }`}
                      >
                        <ModelText className="min-w-0 shrink truncate text-[10px] font-semibold text-[var(--text-strong)] sm:max-w-[42%]">
                          {room.number ? `${room.number} · ` : ""}
                          {room.name}
                        </ModelText>
                        <span className="min-w-0 flex-1 truncate text-right text-[9px] tabular-nums text-[var(--text-muted)]">
                          {t(uiLanguage, "abluftVolume")} {metrics.abluft}
                          {" · "}
                          {t(uiLanguage, "zuluftVolume")} {metrics.zuluft}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="px-0.5 text-[9px] text-[var(--text-muted)]">
              {t(uiLanguage, "selectVentilationZone")}
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}
