"use client";

import { useEffect, useMemo } from "react";
import { heizlastToColor } from "@/lib/colorMapping";
import { heading } from "@/lib/designTokens";
import { listVisibleFloors } from "@/lib/floorFilter";
import { useAppStore } from "@/store/useAppStore";
import { t } from "@/lib/i18n";
import LegendBody from "./LegendBody";
import ModelText from "./ModelText";

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
  const setSelectedElement = useAppStore((s) => s.setSelectedElement);
  const activeColorPalette = useAppStore((s) => s.activeColorPalette);
  const heizlastRange = useAppStore((s) => s.heizlastRange);

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
    setSelectedRoomId(roomId);
    void import("@/lib/ifcClient").then(({ getElementDetails }) =>
      getElementDetails(expressId, floorId, roomId).then((el) => {
        if (el) setSelectedElement(el);
      }),
    );
  };

  if (!includeLegend && !presentationIsolate) {
    return null;
  }

  return (
    <div
      className={`flex min-h-0 flex-col text-zinc-800 ${
        presentationIsolate ? "h-full min-h-0 flex-1" : ""
      }`}
    >
      {includeLegend && (
        <div className="shrink-0">
          <LegendBody paddedTop />
        </div>
      )}

      {presentationIsolate && (
        <section
          className={
            compact
              ? "flex min-h-0 flex-1 flex-col space-y-1.5 overflow-hidden px-2.5 pb-2"
              : "flex min-h-0 flex-1 flex-col space-y-2 overflow-hidden px-3 pb-3"
          }
        >
          <p className={`${heading.muted} shrink-0`}>
            {t(uiLanguage, "floorLevel")}
          </p>
          <div className="thin-scroll max-h-28 shrink-0 divide-y divide-zinc-200/60 overflow-y-auto rounded-xl border border-zinc-300/50 bg-white/40">
            {floorsWithRooms.length === 0 ? (
              <p className="px-2.5 py-2 text-[11px] text-zinc-400">
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
                      compact ? "py-1.5 text-[11px]" : "py-2 text-xs"
                    } ${
                      active
                        ? "bg-zinc-900/10 font-semibold text-zinc-900"
                        : "text-zinc-600 hover:bg-zinc-900/5"
                    }`}
                  >
                    <ModelText className="min-w-0 truncate">{f.name}</ModelText>
                    <span className="tabular-nums text-[10px] text-zinc-400">
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
            <p className="text-xs text-zinc-400">
              {t(uiLanguage, "noRoomsOnFloor")}
            </p>
          ) : (
            <ul className="thin-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain pr-0.5 pb-1">
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
                        selectRoom(room.id, room.expressId, room.floorId)
                      }
                      className={`flex w-full items-center gap-2 rounded-lg border text-left transition-all ${
                        compact ? "px-1.5 py-1" : "px-2 py-1.5"
                      } ${
                        active
                          ? "border-zinc-500/50 shadow-sm ring-1 ring-zinc-400/40"
                          : "border-transparent hover:border-zinc-300/40"
                      }`}
                      style={{ backgroundColor: lightTint(hex, 0.82) }}
                    >
                      <ModelText className="min-w-0 flex-1 truncate text-[11px] font-semibold text-zinc-900">
                        {room.number ? `${room.number} · ` : ""}
                        {room.name}
                      </ModelText>
                      <span className="flex shrink-0 items-center gap-1.5 tabular-nums text-[10px] text-zinc-600">
                        <span>{room.heatLoad.toFixed(0)} W/m²</span>
                        <span className="text-zinc-400">·</span>
                        <span>{room.temperature.toFixed(1)} °C</span>
                        <span
                          className="h-2.5 w-2.5 rounded-sm border border-zinc-400/30"
                          style={{ backgroundColor: hex }}
                          aria-hidden
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
