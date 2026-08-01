"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { heizlastToColor, kuhllastToColor, temperatureToColor } from "@/lib/colorMapping";
import { gsapDuration, gsapEase } from "@/lib/gsapMotion";
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
  /** Fixed screen position for list-selection popup (desktop). */
  anchor?: { left: number; top: number } | null;
};

function RoomInfoBody({
  room,
  palette,
  heizlastRange,
  kuhllastRange,
  temperatureRange,
  uiLanguage,
  cooling,
  compact = false,
}: {
  room: Room;
  palette: string;
  heizlastRange: number[];
  kuhllastRange: number[];
  temperatureRange: number[];
  uiLanguage: UiLanguage;
  cooling: boolean;
  compact?: boolean;
}) {
  const loadColor = cooling
    ? kuhllastToColor(room.coolLoad, palette, kuhllastRange)
    : heizlastToColor(room.heatLoad, palette, heizlastRange);
  const tempColor = temperatureToColor(
    room.temperature,
    palette,
    temperatureRange,
  );
  const absLoad = cooling ? room.kuhllast : room.heizlast;
  const densityVal = cooling ? room.coolLoad : room.heatLoad;
  const name = room.name?.trim() || "—";
  const number = room.number?.trim() || "—";
  const watts =
    absLoad != null && Number.isFinite(absLoad)
      ? `${Math.round(absLoad)}W`
      : "—";
  const density = Number.isFinite(densityVal)
    ? `${densityVal.toFixed(1).replace(".", ",")} W/m²`
    : "—";
  const temp = Number.isFinite(room.temperature)
    ? `${Math.round(room.temperature)}°C`
    : "—";

  const titleKey = cooling ? "normKuhllast" : "normHeizlast";
  const loadKey = cooling ? "kuhllast" : "heizlast";

  const nameNumberRow = (sizeCls: string) => (
    <div className={`flex min-w-0 items-baseline gap-1 ${sizeCls}`}>
      <span
        className="notranslate min-w-0 truncate font-semibold text-zinc-900"
        translate="no"
        title={name}
      >
        {name}
      </span>
      <span className="shrink-0 font-medium text-zinc-400" aria-hidden>
        |
      </span>
      <span
        className="notranslate shrink-0 font-semibold tabular-nums text-zinc-800"
        translate="no"
      >
        {number}
      </span>
    </div>
  );

  if (compact) {
    return (
      <div className="px-2 py-1.5">
        <p className="text-[9px] font-semibold tracking-wide text-zinc-800">
          {t(uiLanguage, titleKey)}
        </p>
        <div className="my-0.5 h-px bg-white/40" />
        {nameNumberRow("text-[11px]")}
        <div className="my-0.5 h-px bg-white/40" />
        <div className="flex items-baseline justify-between gap-2 text-[10px]">
          <span className="shrink-0 font-medium text-zinc-500">
            {t(uiLanguage, loadKey)}
          </span>
          <span className="flex min-w-0 items-center gap-1 text-right font-medium text-zinc-800">
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: loadColor }}
              aria-hidden
            />
            <span className="tabular-nums">
              {watts}
              {density !== "—" ? (
                <span className="font-normal text-zinc-600"> {density}</span>
              ) : null}
            </span>
          </span>
        </div>
        <div className="my-0.5 h-px bg-white/40" />
        <div className="flex items-baseline justify-between gap-2 text-[10px]">
          <span className="shrink-0 font-medium text-zinc-500">
            {t(uiLanguage, "temperature")}
          </span>
          <span className="flex items-center gap-1 font-medium text-zinc-800">
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: tempColor }}
              aria-hidden
            />
            <span className="tabular-nums">{temp}</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3.5 py-3">
      <p className="text-[11px] font-semibold tracking-wide text-zinc-800">
        {t(uiLanguage, titleKey)}
      </p>
      <div className="my-2 h-px bg-white/35" />
      {nameNumberRow("text-sm")}
      <div className="mt-2 space-y-1.5 text-xs">
        <div className="flex items-baseline justify-between gap-3">
          <span className="shrink-0 font-medium text-zinc-500">
            {t(uiLanguage, loadKey)}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-right font-medium text-zinc-800">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: loadColor }}
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
  anchor = null,
}: Props) {
  const hoveredRoom = useAppStore((s) => s.hoveredRoom);
  const palette = useAppStore((s) => s.activeColorPalette);
  const heizlastRange = useAppStore((s) => s.heizlastRange);
  const kuhllastRange = useAppStore((s) => s.kuhllastRange);
  const temperatureRange = useAppStore((s) => s.temperatureRange);
  const dataViewMode = useAppStore((s) => s.dataViewMode);
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const [isMobile, setIsMobile] = useState(false);
  const [headerLeft, setHeaderLeft] = useState(8);
  const [headerBottom, setHeaderBottom] = useState(56);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsMobile(!(w >= 768 && h >= 560));

      const header = document.querySelector(
        "[data-app-header-actions]",
      ) as HTMLElement | null;
      if (header) {
        const r = header.getBoundingClientRect();
        setHeaderLeft(r.left);
        setHeaderBottom(r.bottom + 6);
      }
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(update)
        : null;
    const header = document.querySelector("[data-app-header-actions]");
    if (header && ro) ro.observe(header);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      ro?.disconnect();
    };
  }, []);

  const room = roomProp ?? hoveredRoom;
  const isSelection = Boolean(roomProp);
  const compact = isMobile && isSelection;
  const cooling = dataViewMode === "kuhllast";

  let targetLeft = 0;
  let targetTop = 0;
  let targetWidth = 248;
  let useFollow = false;

  if (room) {
    if (isSelection && isMobile) {
      targetLeft = headerLeft;
      targetTop = headerBottom;
      targetWidth = 168;
    } else if (anchor) {
      targetLeft = anchor.left;
      targetTop = anchor.top;
    } else if (roomProp && !hoveredRoom) {
      targetLeft =
        typeof window !== "undefined"
          ? Math.min(360, window.innerWidth - 240)
          : 360;
      targetTop =
        typeof window !== "undefined"
          ? Math.min(160, window.innerHeight - 200)
          : 160;
    } else {
      useFollow = true;
      const offset = 16;
      targetLeft = Math.min(
        x + offset,
        typeof window !== "undefined" ? window.innerWidth - 260 : x,
      );
      targetTop = Math.min(
        y + offset,
        typeof window !== "undefined" ? window.innerHeight - 180 : y,
      );
    }
  }

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el || !room) return;
    gsap.to(el, {
      left: targetLeft,
      top: targetTop,
      width: targetWidth,
      duration: useFollow ? gsapDuration.follow : gsapDuration.tooltip,
      ease: gsapEase.iosOut,
      overwrite: true,
    });
  }, [room, targetLeft, targetTop, targetWidth, useFollow]);

  if (!room) return null;

  const style: CSSProperties = {
    position: "fixed",
    left: targetLeft,
    top: targetTop,
    zIndex: 60,
    width: targetWidth,
    pointerEvents: isSelection || roomProp ? "auto" : "none",
  };

  return (
    <div ref={wrapRef} style={style}>
      <GlassPanel variant="panel" zIndex={60} wrapperClassName="w-full">
        <RoomInfoBody
          room={room}
          palette={palette}
          heizlastRange={heizlastRange}
          kuhllastRange={kuhllastRange}
          temperatureRange={temperatureRange}
          uiLanguage={uiLanguage}
          cooling={cooling}
          compact={compact}
        />
      </GlassPanel>
    </div>
  );
}
