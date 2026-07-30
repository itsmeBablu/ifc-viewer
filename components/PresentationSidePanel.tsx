"use client";

import { useMemo } from "react";
import { heizlastToColor } from "@/lib/colorMapping";
import { heading } from "@/lib/designTokens";
import {
  resolvePresentationLayout,
  type PresentationLayoutMode,
} from "@/lib/presentationLayout";
import { useAppStore } from "@/store/useAppStore";
import { t, type UiTextKey } from "@/lib/i18n";
import LegendBody from "./LegendBody";

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

const LAYOUT_OPTIONS: {
  id: PresentationLayoutMode;
  labelKey: UiTextKey;
  hintKey: UiTextKey;
}[] = [
  { id: "auto", labelKey: "layoutAuto", hintKey: "layoutAutoHint" },
  { id: "stack", labelKey: "layoutStack", hintKey: "layoutStackHint" },
  { id: "grid", labelKey: "layoutGrid", hintKey: "layoutGridHint" },
];

/**
 * Presentation right panel: Legend + layout options + optional Rooms.
 */
export default function PresentationSidePanel({
  includeLegend = true,
  compact = false,
}: {
  /** When false, only layout / isolate / rooms (mobile docks legend separately). */
  includeLegend?: boolean;
  /** Tighter rows + smaller switches for mobile docks. */
  compact?: boolean;
} = {}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const floors = useAppStore((s) => s.floors);
  const rooms = useAppStore((s) => s.rooms);
  const presentationFloorId = useAppStore((s) => s.presentationFloorId);
  const setPresentationFloorId = useAppStore((s) => s.setPresentationFloorId);
  const presentationRoomsOpen = useAppStore((s) => s.presentationRoomsOpen);
  const setPresentationRoomsOpen = useAppStore(
    (s) => s.setPresentationRoomsOpen,
  );
  const presentationLayoutMode = useAppStore((s) => s.presentationLayoutMode);
  const setPresentationLayoutMode = useAppStore(
    (s) => s.setPresentationLayoutMode,
  );
  const presentationIsolate = useAppStore((s) => s.presentationIsolate);
  const setPresentationIsolate = useAppStore((s) => s.setPresentationIsolate);
  const compareBothModes = useAppStore((s) => s.compareBothModes);
  const setCompareBothModes = useAppStore((s) => s.setCompareBothModes);
  const selectedRoomId = useAppStore((s) => s.selectedRoomId);
  const setSelectedRoomId = useAppStore((s) => s.setSelectedRoomId);
  const setSelectedElement = useAppStore((s) => s.setSelectedElement);
  const activeColorPalette = useAppStore((s) => s.activeColorPalette);
  const heizlastRange = useAppStore((s) => s.heizlastRange);

  const floorsWithRooms = useMemo(() => {
    const sorted = [...floors].sort((a, b) => a.elevation - b.elevation);
    return sorted.filter((f) => rooms.some((r) => r.floorId === f.id));
  }, [floors, rooms]);

  const activeLayout = resolvePresentationLayout(
    floorsWithRooms.length || floors.length,
    presentationLayoutMode,
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

  const selectRoom = (roomId: string, expressId: number, floorId: string) => {
    setSelectedRoomId(roomId);
    void import("@/lib/ifcClient").then(({ getElementDetails }) =>
      getElementDetails(expressId, floorId, roomId).then((el) => {
        if (el) setSelectedElement(el);
      }),
    );
  };

  const rowPad = compact ? "px-2.5 py-1" : "px-3 py-2";
  const switchTrack = compact
    ? "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200"
    : "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200";
  const switchKnob = compact
    ? "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
    : "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200";
  const knobOn = compact ? "translate-x-4" : "translate-x-5";
  const sectionSpace = compact ? "space-y-1.5 px-2.5 pb-2 pt-1" : "space-y-2.5 px-3 pb-3 pt-2";
  const roomsSectionSpace = compact
    ? `flex flex-col space-y-1.5 px-2.5 pb-2 ${
        presentationRoomsOpen ? "min-h-0 flex-1" : "shrink-0"
      }`
    : `flex flex-col space-y-2.5 px-3 pb-4 ${
        presentationRoomsOpen ? "min-h-0 flex-1" : "shrink-0"
      }`;

  return (
    <div
      className={`flex flex-col text-zinc-800 ${
        presentationRoomsOpen ? "h-full min-h-0 flex-1" : ""
      }`}
    >
      {includeLegend && (
        <div className="shrink-0">
          <LegendBody paddedTop />
        </div>
      )}

      <section className={`shrink-0 ${sectionSpace}`}>
        <div>
          <p className={heading.muted}>{t(uiLanguage, "floorLayout")}</p>
          {!compact && (
            <p className="mt-0.5 text-[10px] text-zinc-500">
              {t(uiLanguage, "equalSpacing")} · {t(uiLanguage, "now")}{" "}
              {activeLayout}
              {floorsWithRooms.length
                ? ` · ${floorsWithRooms.length} ${t(uiLanguage, "floors")}`
                : ""}
            </p>
          )}
        </div>
        <div
          className={`grid grid-cols-3 gap-1 rounded-xl border border-zinc-300/50 bg-white/40 ${
            compact ? "p-0.5" : "p-1"
          }`}
        >
          {LAYOUT_OPTIONS.map((opt) => {
            const on = presentationLayoutMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                title={t(uiLanguage, opt.hintKey)}
                onClick={() => setPresentationLayoutMode(opt.id)}
                className={`rounded-lg font-semibold transition-colors ${
                  compact
                    ? "px-1 py-1 text-[10px]"
                    : "px-1.5 py-1.5 text-[11px]"
                } ${
                  on
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-600 hover:bg-white/70"
                }`}
              >
                {t(uiLanguage, opt.labelKey)}
              </button>
            );
          })}
        </div>

        <div
          className={`flex items-center justify-between gap-2 rounded-xl border border-zinc-300/50 bg-white/40 ${rowPad}`}
        >
          <div className="min-w-0">
            <p
              className={`font-semibold text-zinc-800 ${
                compact ? "text-[11px]" : "text-xs"
              }`}
            >
              {t(uiLanguage, "isolateFloor")}
            </p>
            {!compact && (
              <p className="text-[10px] text-zinc-500">
                {t(uiLanguage, "isolateFloorHint")}
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={presentationIsolate}
            onClick={() => setPresentationIsolate(!presentationIsolate)}
            className={`${switchTrack} ${
              presentationIsolate ? "bg-sky-600" : "bg-zinc-300/80"
            }`}
          >
            <span
              className={`${switchKnob} ${
                presentationIsolate ? knobOn : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div
          className={`flex items-center justify-between gap-2 rounded-xl border border-zinc-300/50 bg-white/40 ${rowPad}`}
        >
          <div className="min-w-0">
            <p
              className={`font-semibold text-zinc-800 ${
                compact ? "text-[11px]" : "text-xs"
              }`}
            >
              {t(uiLanguage, "heizlastPlusTemp")}
            </p>
            {!compact && (
              <p className="text-[10px] text-zinc-500">
                {t(uiLanguage, "sideBySideHT")}
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={compareBothModes}
            onClick={() => setCompareBothModes(!compareBothModes)}
            className={`${switchTrack} ${
              compareBothModes ? "bg-sky-600" : "bg-zinc-300/80"
            }`}
          >
            <span
              className={`${switchKnob} ${
                compareBothModes ? knobOn : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {presentationIsolate && (
          <select
            value={presentationFloorId ?? ""}
            disabled={floorsWithRooms.length === 0}
            onChange={(e) =>
              setPresentationFloorId(
                e.target.value === "" ? null : e.target.value,
              )
            }
            className={`w-full rounded-xl border border-zinc-300/60 bg-white/50 outline-none focus:border-zinc-400 ${
              compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
            }`}
          >
            {floorsWithRooms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
      </section>

      <section className={roomsSectionSpace}>
        <div
          className={`flex shrink-0 items-center justify-between gap-2 rounded-xl border border-zinc-300/50 bg-white/40 ${rowPad}`}
        >
          <div>
            <p
              className={`font-semibold text-zinc-800 ${
                compact ? "text-[11px]" : "text-xs"
              }`}
            >
              {t(uiLanguage, "rooms")}
            </p>
            {!compact && (
              <p className="text-[10px] text-zinc-500">
                {t(uiLanguage, "roomsToggleHint")}
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={presentationRoomsOpen}
            onClick={() => setPresentationRoomsOpen(!presentationRoomsOpen)}
            className={`${switchTrack} ${
              presentationRoomsOpen ? "bg-sky-600" : "bg-zinc-300/80"
            }`}
          >
            <span
              className={`${switchKnob} ${
                presentationRoomsOpen ? knobOn : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {presentationRoomsOpen && (
          <div
            className={`flex min-h-0 flex-1 flex-col ${
              compact ? "space-y-1.5" : "space-y-2.5"
            }`}
          >
            <p className={`${heading.muted} shrink-0`}>
              {t(uiLanguage, "floorLevel")}
            </p>
            <select
              value={presentationFloorId ?? ""}
              disabled={floorsWithRooms.length === 0}
              onChange={(e) =>
                setPresentationFloorId(
                  e.target.value === "" ? null : e.target.value,
                )
              }
              className={`w-full shrink-0 rounded-xl border border-zinc-300/60 bg-white/50 outline-none focus:border-zinc-400 ${
                compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
              }`}
            >
              {floorsWithRooms.length === 0 ? (
                <option value="">{t(uiLanguage, "noFloors")}</option>
              ) : (
                floorsWithRooms.map((f) => {
                  const count = rooms.filter((r) => r.floorId === f.id).length;
                  return (
                    <option key={f.id} value={f.id}>
                      {f.name} ({count})
                    </option>
                  );
                })
              )}
            </select>

            {presentationFloorId ? (
              <>
                <p className={`${heading.muted} shrink-0`}>
                  {t(uiLanguage, "rooms")} ({floorRooms.length})
                </p>
                {floorRooms.length === 0 ? (
                  <p className="text-xs text-zinc-400">
                    {t(uiLanguage, "noRoomsOnFloor")}
                  </p>
                ) : (
                  <ul
                    className={`thin-scroll min-h-0 flex-1 overflow-y-auto pr-0.5 pb-1 ${
                      compact ? "space-y-0.5" : "space-y-1"
                    }`}
                  >
                    {floorRooms.map((room) => {
                      const hex = heizlastToColor(
                        room.heatLoad,
                        activeColorPalette,
                        heizlastRange,
                      );
                      const active = room.id === selectedRoomId;
                      return (
                        <li key={room.id}>
                          <button
                            type="button"
                            onClick={() =>
                              selectRoom(
                                room.id,
                                room.expressId,
                                room.floorId,
                              )
                            }
                            className={`flex w-full items-center justify-between gap-2 rounded-xl border text-left transition-all ${
                              compact ? "px-2 py-1.5" : "px-2.5 py-2"
                            } ${
                              active
                                ? "border-zinc-500/50 shadow-sm ring-1 ring-zinc-400/40"
                                : "border-transparent hover:border-zinc-300/40"
                            }`}
                            style={{ backgroundColor: lightTint(hex, 0.82) }}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-semibold text-zinc-900">
                                {room.number ? `${room.number} · ` : ""}
                                {room.name}
                              </span>
                              <span className="mt-0.5 flex gap-2 text-[10px] text-zinc-600">
                                <span className="tabular-nums">
                                  {room.heatLoad.toFixed(0)} W/m²
                                </span>
                                <span className="tabular-nums">
                                  {room.temperature.toFixed(1)} °C
                                </span>
                              </span>
                            </span>
                            <span
                              className="h-3 w-3 shrink-0 rounded-md border border-zinc-400/30"
                              style={{ backgroundColor: hex }}
                              aria-hidden
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-xs text-zinc-400">
                {t(uiLanguage, "selectFloorListRooms")}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
