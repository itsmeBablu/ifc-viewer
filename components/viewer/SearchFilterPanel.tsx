"use client";

/**
 * SearchFilterPanel — bottom-toolbar popup body with two tabs: room Search
 * (name/number, jumps floor + optionally flies the camera) and a Filter tab
 * (heat-load range + temperature chips) that fades non-matching rooms in the
 * 3D scene via `activeFilter`.
 *
 * Reads/writes rooms, floors, selectedFloor, activeFilter and legend ranges
 * on useAppStore; drives `viewerRef.current?.flyToRoom` when Autofocus is on.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  temperatureLegendStops,
  temperatureToColor,
} from "@/lib/colorMapping";
import { getElementDetails } from "@/lib/ifcClient";
import { roomPassesFilter } from "@/lib/roomFilter";
import { t } from "@/lib/i18n";
import { useAppStore, useEffectiveColorPalette, useLegendColorOverrides } from "@/store/useAppStore";
import type { Room } from "@/lib/types";
import type { Viewer3DHandle } from "./Viewer3D";
import Slider from "../common/ui/Slider";
import type { RefObject } from "react";
import ModelText from "../common/ModelText";

type Mode = "search" | "filter";

type Props = {
  viewerRef: RefObject<Viewer3DHandle | null>;
  /** When false, live filter draft updates are paused. */
  open: boolean;
  /** Called after a search result is chosen (closes the toolbar popup). */
  onClose: () => void;
  /** Tighter layout for landscape mobile toolbar popover. */
  compact?: boolean;
};

/**
 * Search / filter panel body for the bottom toolbar popup.
 * Search jumps the camera (exception to non-zooming click-select).
 * Filter fades non-matching rooms via store.activeFilter.
 */
export default function SearchFilterPanel({
  viewerRef,
  open,
  onClose,
  compact = false,
}: Props) {
  const rooms = useAppStore((s) => s.rooms);
  const floors = useAppStore((s) => s.floors);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const activeFilter = useAppStore((s) => s.activeFilter);
  const temperatureRange = useAppStore((s) => s.temperatureRange);
  const activeColorPalette = useEffectiveColorPalette();
  const tempOverrides = useLegendColorOverrides("temperature");
  const setSelectedFloor = useAppStore((s) => s.setSelectedFloor);
  const setSelectedRoomId = useAppStore((s) => s.setSelectedRoomId);
  const setSelectedElement = useAppStore((s) => s.setSelectedElement);
  const setActiveFilter = useAppStore((s) => s.setActiveFilter);
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const colorTheme = useAppStore((s) => s.colorTheme);
  const dataViewMode = useAppStore((s) => s.dataViewMode);
  const isDark = colorTheme === "dark";
  const yellowGlossBtn = isDark
    ? "amber-gloss-surface border border-amber-300/80 bg-gradient-to-br from-amber-300/95 via-yellow-200/88 to-amber-400/78 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_4px_16px_rgba(251,191,36,0.42)] backdrop-blur-md"
    : "amber-gloss-surface border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)] backdrop-blur-md";

  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [minHeat, setMinHeat] = useState(0);
  const [maxHeat, setMaxHeat] = useState(55);
  const [temps, setTemps] = useState<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const floorName = useMemo(() => {
    const m = new Map(floors.map((f) => [f.id, f.name]));
    return (id: string) => m.get(id) ?? id;
  }, [floors]);

  const heatBounds = useMemo(() => {
    const loads = rooms.map((r) => r.heatLoad).filter((v) => Number.isFinite(v));
    if (!loads.length) return { min: 0, max: 55 };
    return {
      min: Math.floor(Math.min(...loads)),
      max: Math.ceil(Math.max(...loads, 1)),
    };
  }, [rooms]);

  useEffect(() => {
    setMinHeat(heatBounds.min);
    setMaxHeat(heatBounds.max);
  }, [heatBounds.min, heatBounds.max]);

  useEffect(() => {
    if (open && mode === "search") {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, mode]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) setQuery("");
  }, [open]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as Room[];
    return rooms
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.number.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [rooms, query]);

  const scopedRooms = useMemo(() => {
    if (!selectedFloor) return rooms;
    return rooms.filter((r) => r.floorId === selectedFloor);
  }, [rooms, selectedFloor]);

  const matchCount = useMemo(() => {
    if (!activeFilter) {
      return { match: scopedRooms.length, total: scopedRooms.length };
    }
    let match = 0;
    for (const r of scopedRooms) {
      if (roomPassesFilter(r, activeFilter)) match += 1;
    }
    return { match, total: scopedRooms.length };
  }, [scopedRooms, activeFilter]);

  const tempChips = temperatureLegendStops(
    activeColorPalette,
    temperatureRange,
    tempOverrides,
  );

  /** Search selection: switch floor if needed, select room; fly only with Autofocus. */
  const handleSearchSelect = async (room: Room) => {
    if (selectedFloor != null && room.floorId !== selectedFloor) {
      setSelectedFloor(room.floorId);
    }

    setSelectedRoomId(room.id);
    const el = await getElementDetails(room.expressId, room.floorId, room.id);
    if (el) setSelectedElement(el);

    if (useAppStore.getState().autoFocusSelection) {
      await viewerRef.current?.flyToRoom?.(room.id);
    }

    setQuery("");
    onClose();
  };

  const resetFilter = () => {
    setMinHeat(heatBounds.min);
    setMaxHeat(heatBounds.max);
    setTemps([]);
    setActiveFilter(null);
  };

  const toggleTemp = (v: number) => {
    setTemps((prev) =>
      prev.includes(v) ? prev.filter((t) => t !== v) : [...prev, v],
    );
  };

  // Live filter updates while Filter mode is open
  useEffect(() => {
    if (!open || mode !== "filter") return;
    const next: {
      minHeat?: number;
      maxHeat?: number;
      temperatures?: number[];
    } = {};
    if (minHeat > heatBounds.min) next.minHeat = minHeat;
    if (maxHeat < heatBounds.max) next.maxHeat = maxHeat;
    if (temps.length) next.temperatures = [...temps];
    const empty =
      next.minHeat == null &&
      next.maxHeat == null &&
      !(next.temperatures && next.temperatures.length);
    setActiveFilter(empty ? null : next);
  }, [
    open,
    mode,
    minHeat,
    maxHeat,
    temps,
    heatBounds.min,
    heatBounds.max,
    setActiveFilter,
  ]);

  return (
    <div
      className={`min-w-0 max-w-full overflow-hidden ${
        compact ? "space-y-1.5 p-0.5" : "space-y-2.5 p-1"
      }`}
    >
      <div className="glass-inset flex rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-0.5">
        <button
          type="button"
          onClick={() => setMode("search")}
          className={`flex-1 rounded-lg px-2 font-medium transition-colors ${
            compact ? "py-1 text-[11px]" : "py-1.5 text-xs"
          } ${
            mode === "search"
              ? "bg-[var(--chip-active-bg)] text-[var(--text-strong)] shadow-sm"
              : "text-[var(--text-body)]"
          }`}
        >
          {t(uiLanguage, "search")}
        </button>
        <button
          type="button"
          onClick={() => setMode("filter")}
          className={`flex-1 rounded-lg px-2 font-medium transition-colors ${
            compact ? "py-1 text-[11px]" : "py-1.5 text-xs"
          } ${
            mode === "filter"
              ? "bg-[var(--chip-active-bg)] text-[var(--text-strong)] shadow-sm"
              : "text-[var(--text-body)]"
          }`}
        >
          {t(uiLanguage, "filter")}
        </button>
      </div>

      {mode === "search" ? (
        <div className="relative space-y-1.5">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
            placeholder={t(uiLanguage, "searchPlaceholder")}
            className={`glass-input box-border w-full max-w-full rounded-xl px-3 outline-none focus:border-white/55 ${
              compact ? "py-1.5 text-xs" : "py-2 text-sm"
            }`}
          />
          {query.trim() && (
            <ul
              className={`glass-inset space-y-0.5 overflow-y-auto rounded-xl p-1 ${
                compact ? "max-h-28" : "max-h-48 p-1.5"
              }`}
            >
              {searchResults.length === 0 ? (
                <li className="px-2 py-2 text-xs text-[var(--text-muted)]">
                  {t(uiLanguage, "noRoomsMatch")}
                </li>
              ) : (
                searchResults.map((room) => (
                  <li key={room.id}>
                    <button
                      type="button"
                      onClick={() => void handleSearchSelect(room)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-[var(--glass-inset-bg)]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-[var(--text-strong)]">
                          <ModelText>
                            {room.number ? `${room.number} · ` : ""}
                            {room.name}
                          </ModelText>
                        </span>
                        <ModelText className="text-[10px] text-[var(--text-muted)]">
                          {floorName(room.floorId)}
                        </ModelText>
                      </span>
                      <span className="shrink-0 tabular-nums text-[10px] text-[var(--text-muted)]">
                        {(dataViewMode === "kuhllast"
                          ? room.coolLoad
                          : room.heatLoad
                        ).toFixed(0)}{" "}
                        W/m²
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      ) : (
        <div className={`min-w-0 overflow-hidden ${compact ? "space-y-2" : "space-y-3"}`}>
          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-[var(--text-body)]">
              <span className="min-w-0 truncate pr-1">
                {dataViewMode === "kuhllast"
                  ? t(uiLanguage, "kuhllastWm2")
                  : t(uiLanguage, "heizlastFilter")}
              </span>
              <span className="shrink-0 tabular-nums text-[var(--text-muted)]">
                {minHeat} – {maxHeat}
              </span>
            </div>
            <label className="mb-1.5 block min-w-0">
              <span className="mb-0.5 block text-[10px] text-[var(--text-muted)]">
                {t(uiLanguage, "min")}
              </span>
              <div className="min-w-0 px-0.5">
                <Slider
                  min={heatBounds.min}
                  max={heatBounds.max}
                  step={1}
                  value={minHeat}
                  onChange={(v) => setMinHeat(Math.min(v, maxHeat))}
                />
              </div>
            </label>
            <label className="block min-w-0">
              <span className="mb-0.5 block text-[10px] text-[var(--text-muted)]">
                {t(uiLanguage, "max")}
              </span>
              <div className="min-w-0 px-0.5">
                <Slider
                  min={heatBounds.min}
                  max={heatBounds.max}
                  step={1}
                  value={maxHeat}
                  onChange={(v) => setMaxHeat(Math.max(v, minHeat))}
                />
              </div>
            </label>
          </div>

          <div className="min-w-0">
            <p className="mb-1.5 text-[11px] font-medium text-[var(--text-body)]">
              {t(uiLanguage, "temperature")}
            </p>
            <div className="grid grid-cols-4 gap-1 sm:flex sm:flex-wrap sm:gap-1.5">
              {tempChips.map((s) => {
                const on = temps.includes(s.value);
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleTemp(s.value)}
                    className={`flex min-w-0 items-center justify-center gap-1 rounded-full border px-1.5 py-1 text-[10px] font-medium tabular-nums transition-colors sm:px-2.5 sm:text-[11px] ${
                      on
                        ? "border-[var(--panel-divider)] bg-[var(--chip-active-bg)] text-[var(--text-strong)] shadow-sm"
                        : "border-transparent bg-[var(--glass-inset-bg)] text-[var(--text-body)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{
                        backgroundColor: temperatureToColor(
                          s.value,
                          activeColorPalette,
                          temperatureRange,
                          tempOverrides,
                        ),
                      }}
                    />
                    {s.value}°
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="min-w-0 text-[11px] leading-snug text-[var(--text-muted)]">
              <span className="font-semibold tabular-nums text-[var(--text-strong)]">
                {matchCount.match}
              </span>{" "}
              {t(uiLanguage, "ofRoomsMatch")}{" "}
              <span className="tabular-nums">{matchCount.total}</span>{" "}
              {t(uiLanguage, "roomsMatch")}
            </p>
            <button
              type="button"
              onClick={resetFilter}
              className={`w-full shrink-0 rounded-xl px-2.5 py-2 text-[11px] font-semibold transition hover:brightness-105 active:scale-[0.98] md:w-auto md:py-1.5 ${yellowGlossBtn}`}
            >
              {t(uiLanguage, "resetFilter")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
