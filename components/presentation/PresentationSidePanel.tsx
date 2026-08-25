"use client";

/**
 * PresentationSidePanel — right-side panel for the presentation view:
 * LegendBody plus, when `presentationIsolate` is on, a floor picker and
 * either a room list or the VentilationZonePanel (Lüftung mode).
 *
 * Reads floors/rooms, presentationFloorId/Isolate, and color-range state
 * from useAppStore; selecting a room fetches details via ifcClient.
 */

import { useEffect, useMemo } from "react";
import { roomLoadColor, roomDensityLoad, roomTemperatureForView } from "@/lib/roomLoad";
import { heading } from "@/lib/designTokens";
import { listVisibleFloors } from "@/lib/floorFilter";
import { useAppStore, useEffectiveColorPalette } from "@/store/useAppStore";
import { t } from "@/lib/i18n";
import LegendBody from "../legend/LegendBody";
import ModelText from "../common/ModelText";
import VentilationZonePanel from "../ventilation/VentilationZonePanel";
import { useModelScene } from "../viewer/ModelSceneContext";

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
 * When isolate is on: floor list + rooms (or Nutzungszone table in Lüftung).
 */
export default function PresentationSidePanel({
  includeLegend = true,
  compact = false,
  sideSlideMenus = false,
}: {
  includeLegend?: boolean;
  compact?: boolean;
  /** iPad landscape: open View/Options as a right-edge sliding drawer. */
  sideSlideMenus?: boolean;
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
  const requestRoomFocus = useAppStore((s) => s.requestRoomFocus);
  const activeColorPalette = useEffectiveColorPalette();
  const heizlastRange = useAppStore((s) => s.heizlastRange);
  const kuhllastRange = useAppStore((s) => s.kuhllastRange);
  const luftungRange = useAppStore((s) => s.luftungRange);
  const dataViewMode = useAppStore((s) => s.dataViewMode);
  const customLegendColors = useAppStore((s) => s.customLegendColors);
  const loadOverrides =
    dataViewMode === "kuhllast"
      ? customLegendColors.kuhllast
      : dataViewMode === "luftung"
        ? customLegendColors.luftung
        : customLegendColors.heizlast;
  const ventilation = dataViewMode === "luftung";
  const { shellGroup } = useModelScene();

  const floorsWithRooms = useMemo(
    () => listVisibleFloors(floors, rooms, shellGroup),
    [floors, rooms, shellGroup],
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
    if (useAppStore.getState().autoFocusSelection) {
      requestRoomFocus(roomId);
    } else {
      setSelectedRoomId(roomId);
    }
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
    <div className="flex flex-col text-[var(--text-body)]">
      {includeLegend && (
        <div className="shrink-0">
          <LegendBody paddedTop sideSlideMenus={sideSlideMenus} />
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

          {ventilation ? (
            <VentilationZonePanel
              compact={compact}
              floorId={presentationFloorId}
              className="shrink-0"
            />
          ) : (
            <>
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
                      luftungRange,
                    );
                    const density = roomDensityLoad(room, dataViewMode);
                    const active = room.id === selectedRoomId;
                    return (
                      <li key={room.id}>
                        <button
                          type="button"
                          onClick={() =>
                            selectRoom(room.id, room.expressId, room.floorId)
                          }
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            selectRoom(room.id, room.expressId, room.floorId);
                          }}
                          className={`flex w-full min-w-0 items-center gap-1.5 rounded-lg border text-left transition-all ${
                            compact ? "px-1.5 py-0.5" : "px-2 py-1"
                          } ${
                            active
                              ? "border-[var(--panel-divider)] shadow-sm ring-1 ring-[var(--panel-divider)]"
                              : "border-transparent hover:border-[var(--panel-divider)]"
                          }`}
                          style={{ backgroundColor: lightTint(hex, 0.82) }}
                        >
                          <ModelText className="min-w-0 shrink truncate text-[10px] font-semibold text-on-tint sm:max-w-[42%]">
                            {room.number ? `${room.number} · ` : ""}
                            {room.name}
                          </ModelText>
                          <span className="ml-auto shrink-0 text-[9px] tabular-nums text-on-tint-muted">
                            {density.toFixed(0)} W/m² ·{" "}
                            {roomTemperatureForView(
                              room,
                              dataViewMode,
                            ).toFixed(1)}{" "}
                            °C
                          </span>
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
            </>
          )}
        </section>
      )}
    </div>
  );
}
