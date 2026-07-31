"use client";

import type { CSSProperties } from "react";
import { heizlastToColor, temperatureToColor } from "@/lib/colorMapping";
import type { Room } from "@/lib/types";
import { t, type UiLanguage } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import GlassPanel from "./GlassPanel";

type Props = {
  /** Cursor-follow position (3D hover). Ignored when `anchor` is set. */
  x?: number;
  y?: number;
  /** Explicit room — used for list selection popup. */
  room?: Room | null;
  /** Less transparency / more solid panel. */
  opaque?: boolean;
  /** Fixed screen position for list-selection popup. */
  anchor?: { left: number; top: number } | null;
};

function RoomInfoBody({
  room,
  palette,
  heizlastRange,
  temperatureRange,
  uiLanguage,
}: {
  room: Room;
  palette: string;
  heizlastRange: number[];
  temperatureRange: number[];
  uiLanguage: UiLanguage;
}) {
  const heatColor = heizlastToColor(room.heatLoad, palette, heizlastRange);
  const tempColor = temperatureToColor(
    room.temperature,
    palette,
    temperatureRange,
  );
  const absHeizlast = room.heizlast;
  const name = room.name?.trim() || "—";
  const number = room.number?.trim() || "—";
  const watts =
    absHeizlast != null && Number.isFinite(absHeizlast)
      ? `${Math.round(absHeizlast)}W`
      : "—";
  const density = Number.isFinite(room.heatLoad)
    ? `${room.heatLoad.toFixed(1).replace(".", ",")} W/m²`
    : "—";
  const temp = Number.isFinite(room.temperature)
    ? `${Math.round(room.temperature)}°C`
    : "—";

  return (
    <div className="px-3.5 py-3">
      <p className="text-[11px] font-semibold tracking-wide text-zinc-800">
        {t(uiLanguage, "normHeizlast")}
      </p>
      <div className="my-2 h-px bg-zinc-300/70" />

      <p className="truncate text-sm font-semibold text-zinc-900">
        <span className="notranslate" translate="no">
          {name}
        </span>
        <span className="font-medium text-zinc-500">
          {" "}
          |{" "}
          <span className="notranslate" translate="no">
            {number}
          </span>
        </span>
      </p>

      <div className="mt-2 space-y-1.5 text-xs">
        <div className="flex items-baseline justify-between gap-3">
          <span className="shrink-0 font-medium text-zinc-500">
            {t(uiLanguage, "heizlast")}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-right font-medium text-zinc-800">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: heatColor }}
              aria-hidden
            />
            <span className="tabular-nums">
              {watts}
              {density !== "—" ? (
                <span className="font-normal text-zinc-600">
                  {" "}
                  {t(uiLanguage, "withDensity")} {density}
                </span>
              ) : null}
            </span>
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="shrink-0 font-medium text-zinc-500">
            {t(uiLanguage, "temperature")}
          </span>
          <span className="flex items-center gap-1.5 font-medium text-zinc-800">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: tempColor }}
              aria-hidden
            />
            <span className="tabular-nums">{temp}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function RoomTooltip({
  x = 0,
  y = 0,
  room: roomProp = null,
  opaque = false,
  anchor = null,
}: Props) {
  const hoveredRoom = useAppStore((s) => s.hoveredRoom);
  const palette = useAppStore((s) => s.activeColorPalette);
  const heizlastRange = useAppStore((s) => s.heizlastRange);
  const temperatureRange = useAppStore((s) => s.temperatureRange);
  const uiLanguage = useAppStore((s) => s.uiLanguage);

  const room = roomProp ?? hoveredRoom;
  if (!room) return null;

  // Prefer hover cursor follow; selection uses anchor or falls back beside left panel
  let left: number;
  let top: number;
  if (anchor) {
    left = anchor.left;
    top = anchor.top;
  } else if (roomProp && !hoveredRoom) {
    left = typeof window !== "undefined" ? Math.min(360, window.innerWidth - 240) : 360;
    top = typeof window !== "undefined" ? Math.min(160, window.innerHeight - 200) : 160;
  } else {
    const offset = 16;
    left = Math.min(
      x + offset,
      typeof window !== "undefined" ? window.innerWidth - 260 : x,
    );
    top = Math.min(
      y + offset,
      typeof window !== "undefined" ? window.innerHeight - 180 : y,
    );
  }

  const style: CSSProperties = {
    position: "fixed",
    left,
    top,
    zIndex: 60,
    width: 248,
    pointerEvents: roomProp ? "auto" : "none",
    ...(opaque
      ? {
          filter: "none",
        }
      : {}),
  };

  return (
    <div style={style}>
      <GlassPanel
        variant="panel"
        zIndex={60}
        wrapperClassName={`w-full ${opaque ? "room-tooltip--opaque" : ""}`}
      >
        <div className={opaque ? "rounded-3xl bg-white/90" : undefined}>
          <RoomInfoBody
            room={room}
            palette={palette}
            heizlastRange={heizlastRange}
            temperatureRange={temperatureRange}
            uiLanguage={uiLanguage}
          />
        </div>
      </GlassPanel>
    </div>
  );
}
