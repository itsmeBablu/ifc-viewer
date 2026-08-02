"use client";

import { useEffect, useMemo, useState } from "react";
import { clearFloorSnapshots, renderFloorSnapshot } from "@/lib/floorSnapshot";
import { listVisibleFloors } from "@/lib/floorFilter";
import { roomVentilationListMetrics } from "@/lib/ventilation";
import { t } from "@/lib/i18n";
import { useAppStore, useEffectiveColorPalette } from "@/store/useAppStore";
import { useModelScene } from "./ModelSceneContext";
import {
  GlassInset,
  GlassSelect,
  PanelTitle,
  heading,
} from "./ui";
import ModelText from "./ModelText";

type Props = {
  embedded?: boolean;
};

export default function FloorRoomsPanel({ embedded = false }: Props) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const dataViewMode = useAppStore((s) => s.dataViewMode);
  const floors = useAppStore((s) => s.floors);
  const rooms = useAppStore((s) => s.rooms);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const selectedRoomId = useAppStore((s) => s.selectedRoomId);
  const activeModelId = useAppStore((s) => s.activeModelId);
  const colorMode = useAppStore((s) => s.colorMode);
  const colorTheme = useAppStore((s) => s.colorTheme);
  const compareBothModes = useAppStore((s) => s.compareBothModes);
  const activeColorPalette = useEffectiveColorPalette();
  const heizlastRange = useAppStore((s) => s.heizlastRange);
  const kuhllastRange = useAppStore((s) => s.kuhllastRange);
  const temperatureRange = useAppStore((s) => s.temperatureRange);
  const setSelectedFloor = useAppStore((s) => s.setSelectedFloor);
  const setSelectedRoomId = useAppStore((s) => s.setSelectedRoomId);
  const { shellGroup } = useModelScene();

  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  const floorsWithRooms = useMemo(
    () => listVisibleFloors(floors, rooms),
    [floors, rooms],
  );

  const floorRooms = useMemo(() => {
    if (!selectedFloor) return [];
    return rooms
      .filter((r) => r.floorId === selectedFloor)
      .sort((a, b) => a.number.localeCompare(b.number) || a.name.localeCompare(b.name));
  }, [rooms, selectedFloor]);

  useEffect(() => {
    if (
      selectedFloor &&
      !floorsWithRooms.some((f) => f.id === selectedFloor)
    ) {
      setSelectedFloor(null);
    }
  }, [selectedFloor, floorsWithRooms, setSelectedFloor]);

  const selectedFloorObj = floorsWithRooms.find((f) => f.id === selectedFloor);

  useEffect(() => {
    if (activeModelId) clearFloorSnapshots(activeModelId);
    setSnapshotUrl(null);
  }, [activeModelId, shellGroup]);

  useEffect(() => {
    if (!selectedFloorObj || !activeModelId) {
      setSnapshotUrl(null);
      return;
    }
    try {
      setSnapshotUrl(
        renderFloorSnapshot(
          shellGroup,
          selectedFloorObj,
          floorsWithRooms,
          activeModelId,
          rooms,
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
    floorsWithRooms,
    activeModelId,
    rooms,
    selectedRoomId,
    colorMode,
    colorTheme,
    compareBothModes,
    dataViewMode,
    activeColorPalette,
    heizlastRange,
    kuhllastRange,
    temperatureRange,
  ]);

  const body = (
    <div className="space-y-3">
      <div>
        <label className={`mb-1.5 block ${heading.muted}`}>
          {t(uiLanguage, "floorLevel")}
        </label>
        <GlassSelect
          value={selectedFloor ?? ""}
          onChange={(e) =>
            setSelectedFloor(e.target.value === "" ? null : e.target.value)
          }
          disabled={floorsWithRooms.length === 0}
        >
          <option value="">{t(uiLanguage, "allFloorsPick")}</option>
          {floorsWithRooms.map((f) => {
            const count = rooms.filter((r) => r.floorId === f.id).length;
            return (
              <option key={f.id} value={f.id} className="notranslate" translate="no">
                {f.name} ({count})
              </option>
            );
          })}
        </GlassSelect>
      </div>

      {selectedFloor ? (
        <>
          <GlassInset className="overflow-hidden p-1.5">
            {snapshotUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={snapshotUrl}
                alt={selectedFloorObj?.name ?? ""}
                className="block h-auto w-full rounded-2xl object-contain bg-[var(--scene-bg)]"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-2xl bg-white/30 text-xs text-zinc-400">
                {t(uiLanguage, "noFloorPlan")}
              </div>
            )}
          </GlassInset>

          <div>
            <p className={`mb-1.5 ${heading.muted}`}>
              {t(uiLanguage, "rooms")} ({floorRooms.length})
            </p>
            {floorRooms.length === 0 ? (
              <p className="text-xs text-zinc-400">
                {t(uiLanguage, "noRoomsOnFloor")}
              </p>
            ) : (
              <ul className="max-h-44 space-y-1 overflow-y-auto pr-0.5">
                {floorRooms.map((room) => {
                  const active = room.id === selectedRoomId;
                  const ventMetrics =
                    dataViewMode === "luftung"
                      ? roomVentilationListMetrics(room.ventilation)
                      : null;
                  return (
                    <li key={room.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedRoomId(room.id)}
                        className={`flex w-full min-w-0 items-center gap-2 rounded-2xl px-3 py-2 text-left text-xs transition-all duration-300 ease-out ${
                          active
                            ? "bg-gradient-to-b from-white/90 to-white/60 font-semibold text-zinc-900 shadow-sm shadow-black/5 border border-white/50"
                            : "border border-transparent text-zinc-600 hover:bg-white/40"
                        }`}
                      >
                        <ModelText className="min-w-0 shrink truncate">
                          {room.number ? `${room.number} · ` : ""}
                          {room.name}
                        </ModelText>
                        <span className="ml-auto min-w-0 truncate text-right text-[10px] tabular-nums text-zinc-400">
                          {ventMetrics ? (
                            <>
                              {t(uiLanguage, "abluftVolume")} {ventMetrics.abluft}
                              {" · "}
                              {t(uiLanguage, "zuluftVolume")} {ventMetrics.zuluft}
                              {" · "}
                              {ventMetrics.heatLoss}
                            </>
                          ) : dataViewMode === "kuhllast" ? (
                            `${room.coolLoad.toFixed(0)} W/m²`
                          ) : (
                            `${room.heatLoad.toFixed(0)} W/m²`
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      ) : (
        <GlassInset className="px-3 py-6 text-center text-xs text-zinc-400">
          {t(uiLanguage, "selectFloorHint")}
        </GlassInset>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <section className="p-4">
      <PanelTitle>{t(uiLanguage, "floorsAndRooms")}</PanelTitle>
      {body}
    </section>
  );
}
