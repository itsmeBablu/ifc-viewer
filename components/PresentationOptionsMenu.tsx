"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import GsapHeightAccordion from "./GsapHeightAccordion";
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
import SeasonalBgToggle from "./SeasonalBgToggle";
import {
  groupRoomsByVentilationZone,
  summaryVentilationZoneKey,
} from "@/lib/ventilation";

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
  luftung: "ventilation",
  kuhllast: "cooling",
};

const MODE_OPTIONS_SECTION: Record<DataViewMode, UiTextKey> = {
  heizlast: "heatingOptions",
  luftung: "ventilationOptions",
  kuhllast: "coolingOptions",
};

const activeRow =
  "amber-gloss-surface overflow-hidden rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-100/55 via-yellow-100/40 to-amber-200/35 font-semibold text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]";
const idleRow =
  "overflow-hidden rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)]";

const optionsBtnIdle =
  "presentation-icon-idle border border-transparent bg-transparent text-[var(--text-body)] hover:border-amber-200/70 hover:bg-gradient-to-br hover:from-amber-200/95 hover:via-yellow-300/85 hover:to-amber-400/75 hover:text-amber-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)]";
const optionsBtnOpen =
  "amber-gloss-surface border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)] backdrop-blur-md";

const layoutChipOn =
  "amber-gloss-surface overflow-hidden rounded-lg border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]";
const layoutChipOff =
  "presentation-chip-off overflow-hidden rounded-lg border border-transparent text-[var(--text-muted)] hover:border-amber-200/40 hover:bg-[var(--glass-inset-bg)]";

const viewChipOn =
  "amber-gloss-surface overflow-hidden rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-200/90 via-yellow-300/70 to-amber-400/55 font-semibold text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
const viewChipOff =
  "presentation-chip-off overflow-hidden rounded-xl border border-transparent text-[var(--text-muted)] hover:bg-[var(--glass-inset-bg)]";

type Props = {
  compact?: boolean;
  title?: ReactNode;
  onMenuOpenChange?: (open: boolean) => void;
};

type MenuKind = "view" | "options";

function SectionLabel({
  children,
  compact,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <p
      className={`font-semibold uppercase tracking-wide text-[var(--text-muted)] ${
        compact ? "px-0.5 text-[8px]" : "px-0.5 text-[9px]"
      }`}
    >
      {children}
    </p>
  );
}

function ViewModeChips({
  compact,
  dataViewMode,
  setDataViewMode,
  uiLanguage,
}: {
  compact: boolean;
  dataViewMode: DataViewMode;
  setDataViewMode: (mode: DataViewMode) => void;
  uiLanguage: ReturnType<typeof useAppStore.getState>["uiLanguage"];
}) {
  return (
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
            onClick={() => setDataViewMode(id)}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden rounded-xl px-1 text-center transition-[background,border,box-shadow,color] duration-300 ease-out ${
              compact ? "py-1" : "py-1.5"
            } ${selected ? viewChipOn : viewChipOff}`}
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
  );
}

export default function PresentationOptionsMenu({
  compact = false,
  title,
  onMenuOpenChange,
}: Props) {
  const [menu, setMenu] = useState<MenuKind | null>(null);
  const [panel, setPanel] = useState<MenuKind>("view");
  const rootRef = useRef<HTMLDivElement>(null);

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
  const autoSceneBackground = useAppStore((s) => s.autoSceneBackground);
  const dataViewMode = useAppStore((s) => s.dataViewMode);
  const setDataViewMode = useAppStore((s) => s.setDataViewMode);
  const selectedVentilationZoneKey = useAppStore(
    (s) => s.selectedVentilationZoneKey,
  );
  const setSelectedVentilationZoneKey = useAppStore(
    (s) => s.setSelectedVentilationZoneKey,
  );
  const presentationFloorId = useAppStore((s) => s.presentationFloorId);

  const ventilationZones = groupRoomsByVentilationZone(
    presentationIsolate && presentationFloorId
      ? rooms.filter((r) => r.floorId === presentationFloorId)
      : rooms,
  );

  const floorsWithRooms = listVisibleFloors(floors, rooms);
  const activeLayout = resolvePresentationLayout(
    floorsWithRooms.length || floors.length,
    presentationLayoutMode,
  );

  const setMenuOpen = (next: MenuKind | null) => {
    if (next) setPanel(next);
    setMenu(next);
    onMenuOpenChange?.(next !== null);
  };

  const toggleMenu = (kind: MenuKind) => {
    setMenuOpen(menu === kind ? null : kind);
  };

  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      setMenuOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(null);
    };
    const id = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDoc);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu]);

  const switchTrack =
    "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-300 ease-out";
  const switchKnob =
    "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ease-out";

  const iconBtn = compact ? "h-7 w-7" : "h-8 w-8";
  const iconSize = compact ? "h-4 w-4" : "h-5 w-5";

  const viewOpen = menu === "view";
  const optionsOpen = menu === "options";
  const open = menu !== null;

  const viewMenuClass = compact
    ? "presentation-menu-surface isolate overflow-hidden rounded-2xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-0.5 [box-shadow:0_6px_20px_-6px_rgba(0,0,0,0.14)]"
    : "presentation-menu-surface isolate overflow-hidden rounded-2xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-1 [box-shadow:0_6px_20px_-6px_rgba(0,0,0,0.14)]";

  const optionsMenuClass = compact
    ? "presentation-menu-surface isolate space-y-1.5 overflow-hidden rounded-2xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-1.5 [box-shadow:0_6px_20px_-6px_rgba(0,0,0,0.14)]"
    : "presentation-menu-surface isolate space-y-2 overflow-hidden rounded-2xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-2.5 [box-shadow:0_6px_20px_-6px_rgba(0,0,0,0.14)]";

  const viewModeChips = (
    <ViewModeChips
      compact={compact}
      dataViewMode={dataViewMode}
      setDataViewMode={setDataViewMode}
      uiLanguage={uiLanguage}
    />
  );

  const menuBody =
    panel === "view" ? (
      <div role="menu" className={viewMenuClass}>
        {viewModeChips}
      </div>
    ) : (
      <div role="menu" className={optionsMenuClass}>
        <div className="space-y-1">
          <SectionLabel compact={compact}>
            {t(uiLanguage, "view")}
          </SectionLabel>
          {viewModeChips}
        </div>

        <div className="space-y-1">
          <SectionLabel compact={compact}>
            {t(uiLanguage, "presentationOptionsSection")}
          </SectionLabel>
          <div
            className={`overflow-hidden rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)] ${
              compact ? "p-1.5" : "p-2"
            }`}
          >
            <div
              className={`flex items-center gap-2 px-0.5 ${
                compact ? "mb-1" : "mb-1.5"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/floor_layout.svg"
                alt=""
                className="presentation-svg-icon h-4 w-4 object-contain"
              />
              <p className="text-[11px] font-semibold text-[var(--text-strong)]">
                {t(uiLanguage, "floorLayout")}
              </p>
              <span className="ml-auto text-[9px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
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
                    className={`overflow-hidden rounded-lg px-1 text-[10px] font-semibold transition-all duration-300 ease-out ${
                      compact ? "py-1" : "py-1.5"
                    } ${on ? layoutChipOn : layoutChipOff}`}
                  >
                    {t(uiLanguage, opt.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className={`flex items-center justify-between gap-2 overflow-hidden rounded-xl transition-all duration-300 ease-out ${
              compact ? "p-1.5" : "p-2"
            } ${presentationIsolate ? activeRow : idleRow}`}
          >
            <div className="flex min-w-0 items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/isolate_view.svg"
                alt=""
                className="presentation-svg-icon h-4 w-4 object-contain"
              />
              <p className="text-[11px] font-semibold text-[var(--text-strong)]">
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
            className={`flex items-center justify-between gap-2 overflow-hidden rounded-xl transition-all duration-300 ease-out ${
              compact ? "p-1.5" : "p-2"
            } ${autoSceneBackground ? activeRow : idleRow}`}
          >
            <p className="text-[11px] font-semibold text-[var(--text-strong)]">
              {t(uiLanguage, "seasonalBg")}
            </p>
            <SeasonalBgToggle />
          </div>
        </div>

        <div className="space-y-1">
          <SectionLabel compact={compact}>
            {t(uiLanguage, MODE_OPTIONS_SECTION[dataViewMode])}
          </SectionLabel>
          {dataViewMode === "luftung" && ventilationZones.length > 0 ? (
            <div
              className={`overflow-hidden rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)] ${
                compact ? "space-y-1 p-1.5" : "space-y-1.5 p-2"
              }`}
            >
              <p className="text-[10px] font-semibold text-[var(--text-strong)]">
                {t(uiLanguage, "selectVentilationZone")}
              </p>
              <div className="flex flex-wrap gap-1">
                {ventilationZones.map((zone) => {
                  const key = summaryVentilationZoneKey(zone);
                  const on = selectedVentilationZoneKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setSelectedVentilationZoneKey(on ? null : key)
                      }
                      className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition-all duration-300 ease-out ${
                        on ? layoutChipOn : layoutChipOff
                      }`}
                    >
                      {zone.zoneName}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div
            className={`flex items-center justify-between gap-2 overflow-hidden rounded-xl transition-all duration-300 ease-out ${
              compact ? "p-1.5" : "p-2"
            } ${compareBothModes ? activeRow : idleRow}`}
          >
            <p className="text-[11px] font-semibold text-[var(--text-strong)]">
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
    );

  return (
    <div ref={rootRef} className="w-full">
      <div className={`flex items-center justify-between ${compact ? "gap-1" : "gap-2"}`}>
        <div className="min-w-0 flex-1">{title}</div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-expanded={viewOpen}
            aria-haspopup="menu"
            aria-label={t(uiLanguage, DATA_VIEW_LABEL[dataViewMode])}
            title={t(uiLanguage, "viewHint")}
            onClick={() => toggleMenu("view")}
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
            aria-expanded={optionsOpen}
            aria-haspopup="menu"
            aria-label={t(uiLanguage, "moreOptions")}
            onClick={() => toggleMenu("options")}
            className={`flex items-center justify-center rounded-full transition-[color,background,border,box-shadow,transform] duration-300 ease-out active:scale-95 ${iconBtn} ${
              optionsOpen ? optionsBtnOpen : optionsBtnIdle
            }`}
          >
            <IoOptionsOutline className={`${iconSize} text-current`} aria-hidden />
          </button>
        </div>
      </div>

      <GsapHeightAccordion
        open={open}
        contentKey={panel}
        innerClassName={compact ? "px-0.5 pb-0.5 pt-1" : "px-1 pb-1.5 pt-2"}
      >
        {menuBody}
      </GsapHeightAccordion>
    </div>
  );
}
