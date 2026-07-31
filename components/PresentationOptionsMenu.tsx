"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IoOptionsOutline } from "react-icons/io5";
import {
  DATA_VIEW_ICON,
  DATA_VIEW_MODES,
  type DataViewMode,
} from "@/lib/dataViewMode";
import {
  resolvePresentationLayout,
  type PresentationLayoutMode,
} from "@/lib/presentationLayout";
import { listVisibleFloors } from "@/lib/floorFilter";
import { t, type UiTextKey } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";

const MENU_MS = 800;

const LAYOUT_OPTIONS: {
  id: PresentationLayoutMode;
  labelKey: UiTextKey;
  hintKey: UiTextKey;
}[] = [
  { id: "auto", labelKey: "layoutAuto", hintKey: "layoutAutoHint" },
  { id: "stack", labelKey: "layoutStack", hintKey: "layoutStackHint" },
  { id: "grid", labelKey: "layoutGrid", hintKey: "layoutGridHint" },
];

const DATA_VIEW_LABEL: Record<DataViewMode, UiTextKey> = {
  heizlast: "heating",
  luftung: "optionsLuft",
  kuhllast: "optionsCool",
};

const activeRow =
  "overflow-hidden border border-amber-200/70 bg-gradient-to-br from-amber-100/55 via-yellow-100/40 to-amber-200/35 font-semibold text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]";
const idleRow = "overflow-hidden border border-zinc-200/80 bg-zinc-50";

/** Transparent by default; yellow only on hover / open. */
const optionsBtnIdle =
  "border border-transparent bg-transparent text-zinc-800 hover:border-amber-200/70 hover:bg-gradient-to-br hover:from-amber-200/95 hover:via-yellow-300/85 hover:to-amber-400/75 hover:text-amber-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)]";
const optionsBtnOpen =
  "border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)] backdrop-blur-md";

const layoutChipOn =
  "overflow-hidden border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_2px_8px_rgba(251,191,36,0.28)]";
const layoutChipOff =
  "overflow-hidden border border-transparent text-zinc-600 hover:bg-white hover:border-amber-200/40";

const viewChipOn =
  "overflow-hidden border border-amber-200/70 bg-gradient-to-br from-amber-200/90 via-yellow-300/70 to-amber-400/55 font-semibold text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
const viewChipOff =
  "overflow-hidden border border-transparent text-zinc-600 hover:bg-zinc-100/80";

type Props = {
  compact?: boolean;
  /** Left side of the header row (usually the Legend title). */
  title?: ReactNode;
};

function useOpenAnim(open: boolean, durationMs: number) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setShown(true));
      });
      return () => window.cancelAnimationFrame(id);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), durationMs);
    return () => window.clearTimeout(t);
  }, [open, durationMs]);

  return { mounted, shown };
}

/**
 * Legend header + data-view picker + options dropdown.
 * Floor layout defaults to stack; user can switch Auto / Stack / Grid.
 */
export default function PresentationOptionsMenu({
  compact = false,
  title,
}: Props) {
  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const optionsAnim = useOpenAnim(open, MENU_MS);
  const viewAnim = useOpenAnim(viewOpen, MENU_MS);

  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const floors = useAppStore((s) => s.floors);
  const rooms = useAppStore((s) => s.rooms);
  const presentationLayoutMode = useAppStore((s) => s.presentationLayoutMode);
  const setPresentationLayoutMode = useAppStore(
    (s) => s.setPresentationLayoutMode,
  );
  const presentationIsolate = useAppStore((s) => s.presentationIsolate);
  const setPresentationIsolate = useAppStore((s) => s.setPresentationIsolate);
  const compareBothModes = useAppStore((s) => s.compareBothModes);
  const setCompareBothModes = useAppStore((s) => s.setCompareBothModes);
  const dataViewMode = useAppStore((s) => s.dataViewMode);
  const setDataViewMode = useAppStore((s) => s.setDataViewMode);

  const floorsWithRooms = listVisibleFloors(floors, rooms);
  const activeLayout = resolvePresentationLayout(
    floorsWithRooms.length || floors.length,
    presentationLayoutMode,
  );

  useEffect(() => {
    if (!open && !viewOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setViewOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setViewOpen(false);
      }
    };
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, viewOpen]);

  const switchTrack =
    "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200";
  const switchKnob =
    "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200";

  const iconBtn = compact ? "h-7 w-7" : "h-8 w-8";
  const iconSize = compact ? "h-4 w-4" : "h-5 w-5";

  return (
    <div ref={rootRef} className="w-full space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">{title}</div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-expanded={viewOpen}
            aria-haspopup="menu"
            aria-label={t(uiLanguage, DATA_VIEW_LABEL[dataViewMode])}
            title={t(uiLanguage, "viewHint")}
            onClick={() => {
              setViewOpen((v) => !v);
              setOpen(false);
            }}
            className={`flex items-center justify-center rounded-full transition-[color,background,border,box-shadow,transform] duration-300 ease-out active:scale-95 ${iconBtn} ${
              viewOpen ? optionsBtnOpen : optionsBtnIdle
            }`}
          >
            <Image
              src={DATA_VIEW_ICON[dataViewMode]}
              alt=""
              width={20}
              height={20}
              className={`${iconSize} object-contain`}
              aria-hidden
            />
          </button>
          <button
            type="button"
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={t(uiLanguage, "moreOptions")}
            onClick={() => {
              setOpen((v) => !v);
              setViewOpen(false);
            }}
            className={`flex items-center justify-center rounded-full transition-[color,background,border,box-shadow,transform] duration-300 ease-out active:scale-95 ${iconBtn} ${
              open ? optionsBtnOpen : optionsBtnIdle
            }`}
          >
            <IoOptionsOutline className={iconSize} aria-hidden />
          </button>
        </div>
      </div>

      {viewAnim.mounted && (
        <div
          className={`grid transition-[grid-template-rows,opacity,transform] duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            viewAnim.shown
              ? "grid-rows-[1fr] translate-y-0 opacity-100"
              : "grid-rows-[0fr] -translate-y-1 opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              role="menu"
              className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 p-1 shadow-[0_6px_20px_rgba(0,0,0,0.08)]"
            >
              <div className="flex gap-0.5">
                {DATA_VIEW_MODES.map((id) => {
                  const selected = dataViewMode === id;
                  const label = t(uiLanguage, DATA_VIEW_LABEL[id]);
                  return (
                    <button
                      key={id}
                      type="button"
                      role="menuitem"
                      title={label}
                      onClick={() => {
                        setDataViewMode(id);
                      }}
                      className={`flex min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden rounded-xl px-1 py-1.5 text-center transition-all duration-200 ${
                        selected ? viewChipOn : viewChipOff
                      }`}
                    >
                      <Image
                        src={DATA_VIEW_ICON[id]}
                        alt=""
                        width={14}
                        height={14}
                        className="h-3.5 w-3.5 shrink-0 object-contain"
                        aria-hidden
                      />
                      <span className="min-w-0 truncate text-[9px] font-semibold leading-tight">
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {optionsAnim.mounted && (
        <div
          className={`grid transition-[grid-template-rows,opacity,transform] duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            optionsAnim.shown
              ? "grid-rows-[1fr] translate-y-0 opacity-100"
              : "grid-rows-[0fr] -translate-y-1 opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              role="menu"
              className="space-y-2 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 p-2.5 shadow-[0_6px_20px_rgba(0,0,0,0.08)]"
            >
              <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50 p-2">
                <div className="mb-1.5 flex items-center gap-2 px-0.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/floor_layout.svg"
                    alt=""
                    className="h-4 w-4 object-contain"
                  />
                  <p className="text-[11px] font-semibold text-zinc-800">
                    {t(uiLanguage, "floorLayout")}
                  </p>
                  <span className="ml-auto text-[9px] font-medium uppercase tracking-wide text-zinc-400">
                    {activeLayout}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {LAYOUT_OPTIONS.map((opt) => {
                    const on = presentationLayoutMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="menuitem"
                        title={t(uiLanguage, opt.hintKey)}
                        onClick={() => setPresentationLayoutMode(opt.id)}
                        className={`overflow-hidden rounded-lg px-1 py-1.5 text-[10px] font-semibold transition-all ${
                          on ? layoutChipOn : layoutChipOff
                        }`}
                      >
                        {t(uiLanguage, opt.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className={`flex items-center justify-between gap-2 overflow-hidden rounded-xl p-2 transition-all ${
                  presentationIsolate ? activeRow : idleRow
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/isolate_view.svg"
                    alt=""
                    className="h-4 w-4 object-contain"
                  />
                  <p className="text-[11px] font-semibold text-zinc-800">
                    {t(uiLanguage, "isolateFloor")}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={presentationIsolate}
                  onClick={() => setPresentationIsolate(!presentationIsolate)}
                  className={`${switchTrack} ${
                    presentationIsolate ? "bg-amber-500" : "bg-zinc-300/80"
                  }`}
                >
                  <span
                    className={`${switchKnob} ${
                      presentationIsolate ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div
                className={`flex items-center justify-between gap-2 overflow-hidden rounded-xl p-2 transition-all ${
                  compareBothModes ? activeRow : idleRow
                }`}
              >
                <p className="text-[11px] font-semibold text-zinc-800">
                  {t(uiLanguage, "heizlastPlusTemp")}
                </p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={compareBothModes}
                  onClick={() => setCompareBothModes(!compareBothModes)}
                  className={`${switchTrack} ${
                    compareBothModes ? "bg-amber-500" : "bg-zinc-300/80"
                  }`}
                >
                  <span
                    className={`${switchKnob} ${
                      compareBothModes ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
