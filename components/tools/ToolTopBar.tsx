"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CiGrid32 } from "react-icons/ci";
import { TbRulerMeasure2, TbTarget } from "react-icons/tb";
import { TfiSave, TfiViewGrid } from "react-icons/tfi";
import { LuSearch, LuX } from "react-icons/lu";
import HoverTip from "@/components/common/HoverTip";
import {
  buildFragBlob,
  buildMarkupOnlyIfc,
  downloadBlob,
  getCachedIfcBytes,
  mergeMarkupIntoIfc,
} from "@/lib/markupFragSave";
import type { MarkupViewPreset } from "@/lib/toolMarkup";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import ColorSwatchPicker from "./ColorSwatchPicker";

const STORAGE_KEY = "ibv-tool-smart-bar-pos";

type Pos = { x: number; y: number };

const VIEWS: { id: MarkupViewPreset; label: string; titleKey: string }[] = [
  { id: "top", label: "Top", titleKey: "markupView_top" },
  { id: "north", label: "N", titleKey: "markupView_north" },
  { id: "south", label: "S", titleKey: "markupView_south" },
  { id: "east", label: "O", titleKey: "markupView_east" },
  { id: "west", label: "W", titleKey: "markupView_west" },
  { id: "free", label: "3D", titleKey: "markupView_free" },
];

const chip =
  "flex h-8 items-center justify-center rounded-lg transition duration-150";
const chipIdle =
  "bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-amber-100/70 hover:text-amber-950";
const chipOn =
  "bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]";
const saveGloss =
  "markup-save-gloss flex h-8 w-8 items-center justify-center rounded-lg text-sky-950 transition duration-150 disabled:opacity-35";

/** Header-aligned default: same vertical band as HeaderActions (top-2 / sm:top-3). */
function defaultTopPx(): number {
  if (typeof window === "undefined") return 12;
  return window.matchMedia("(min-width: 640px)").matches ? 12 : 8;
}

function loadPos(): Pos | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pos;
    if (typeof p.x === "number" && typeof p.y === "number") return p;
  } catch {
    /* ignore */
  }
  return null;
}

function clampPos(x: number, y: number, w: number, h: number): Pos {
  const margin = 8;
  const minTop = 4;
  return {
    x: Math.min(
      Math.max(margin, x),
      Math.max(margin, window.innerWidth - w - margin),
    ),
    y: Math.min(
      Math.max(minTop, y),
      Math.max(minTop, window.innerHeight - h - margin),
    ),
  };
}

function centerPos(w: number): Pos {
  const y = defaultTopPx();
  const x = Math.round((window.innerWidth - w) / 2);
  return clampPos(x, y, w, 48);
}

/**
 * Werkzeug smart bar — compact floating chrome (Save · Snap · Measure · Grid · Color | Top/N/S/O/W/3D).
 * Draggable anywhere; defaults to top-center aligned with the page header.
 */
export default function ToolTopBar({ className = "" }: { className?: string }) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const viewPreset = useToolMarkupStore((s) => s.viewPreset);
  const setViewPreset = useToolMarkupStore((s) => s.setViewPreset);
  const modelKey = useToolMarkupStore((s) => s.modelKey);
  const placements = useToolMarkupStore((s) => s.placements);
  const notes = useToolMarkupStore((s) => s.notes);
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);
  const updatePlacement = useToolMarkupStore((s) => s.updatePlacement);
  const markSaved = useToolMarkupStore((s) => s.markSaved);
  const defaultColor = useToolMarkupStore((s) => s.defaultColor);
  const setDefaultColor = useToolMarkupStore((s) => s.setDefaultColor);
  const snapToFaces = useToolMarkupStore((s) => s.snapToFaces);
  const setSnapToFaces = useToolMarkupStore((s) => s.setSnapToFaces);
  const gridSnap = useToolMarkupStore((s) => s.gridSnap);
  const setGridSnap = useToolMarkupStore((s) => s.setGridSnap);
  const measureMode = useToolMarkupStore((s) => s.measureMode);
  const setMeasureMode = useToolMarkupStore((s) => s.setMeasureMode);
  const measurements = useToolMarkupStore((s) => s.measurements);
  const clearMeasurements = useToolMarkupStore((s) => s.clearMeasurements);
  const quadView = useToolMarkupStore((s) => s.quadView);
  const setQuadView = useToolMarkupStore((s) => s.setQuadView);

  const browserSearch = useLayoutDrawingStore((s) => s.browserSearch);
  const setBrowserSearch = useLayoutDrawingStore((s) => s.setBrowserSearch);
  const elementsCategoryFilter = useLayoutDrawingStore((s) => s.elementsCategoryFilter);
  const setElementsCategoryFilter = useLayoutDrawingStore((s) => s.setElementsCategoryFilter);

  const selectedPlacement =
    placements.find((p) => p.id === selectedPlacementId) ?? null;
  const swatchColor = selectedPlacement?.color ?? defaultColor;

  const applyColor = (hex: string) => {
    setDefaultColor(hex);
    if (selectedPlacementId) {
      void updatePlacement(selectedPlacementId, { color: hex });
    }
  };

  const rootRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos>({ x: 0, y: 12 });
  const [ready, setReady] = useState(false);
  const posRef = useRef(pos);
  const dragRef = useRef<{
    ox: number;
    oy: number;
    sx: number;
    sy: number;
  } | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useEffect(() => {
    const el = rootRef.current;
    const w = el?.offsetWidth ?? 420;
    const h = el?.offsetHeight ?? 48;
    const saved = loadPos();
    setPos(saved ? clampPos(saved.x, saved.y, w, h) : centerPos(w));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const onResize = () => {
      const el = rootRef.current;
      if (!el) return;
      setPos((p) => clampPos(p.x, p.y, el.offsetWidth, el.offsetHeight));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [ready]);

  useEffect(() => {
    if (!saveOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!saveRef.current?.contains(e.target as Node)) setSaveOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [saveOpen]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!(e.target as HTMLElement).closest("[data-drag-handle]")) return;
      const el = rootRef.current;
      if (!el) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      setDragging(true);
      dragRef.current = {
        ox: e.clientX,
        oy: e.clientY,
        sx: pos.x,
        sy: pos.y,
      };
    },
    [pos.x, pos.y],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    const el = rootRef.current;
    if (!d || !el) return;
    setPos(
      clampPos(
        d.sx + (e.clientX - d.ox),
        d.sy + (e.clientY - d.oy),
        el.offsetWidth,
        el.offsetHeight,
      ),
    );
  }, []);

  const endDrag = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posRef.current));
    } catch {
      /* ignore */
    }
    rootRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  const saveAs = (kind: "frag" | "ifc") => {
    if (!modelKey) return;
    const base = (activeModelLabel ?? modelKey)
      .replace(/\.ifc$/i, "")
      .replace(/[^\w.-]+/g, "_");
    if (kind === "frag") {
      const layout = useLayoutDrawingStore.getState();
      downloadBlob(
        buildFragBlob({
          modelKey,
          modelLabel: activeModelLabel,
          placements,
          notes,
          ifcBytes: getCachedIfcBytes(modelKey),
          layout: {
            levels: layout.levels,
            walls: layout.walls,
            doors: layout.doors,
            windows: layout.windows,
            slabs: layout.slabs,
            underlays: layout.underlays,
          },
        }),
        `${base}.frag`,
      );
    } else {
      const cached = getCachedIfcBytes(modelKey);
      downloadBlob(
        cached
          ? mergeMarkupIntoIfc({
              baseIfc: cached,
              placements,
              notes,
            })
          : buildMarkupOnlyIfc({
              modelLabel: activeModelLabel,
              placements,
              notes,
            }),
        `${base}_marked.ifc`,
      );
    }
    markSaved();
    setSaveOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`pointer-events-auto fixed z-[36] ${className}`}
      style={{
        left: pos.x,
        top: pos.y,
        opacity: ready ? 1 : 0,
        transition: dragging ? undefined : "opacity 160ms ease",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className={`tool-glass flex h-11 items-center gap-1.5 rounded-2xl px-2 shadow-[0_8px_28px_rgba(0,0,0,0.1)] sm:gap-2 sm:px-2.5 ${
          dragging ? "ring-1 ring-amber-300/50" : ""
        }`}
      >
        <button
          type="button"
          data-drag-handle
          aria-label="Move toolbar"
          title="Move"
          className="flex h-8 w-5 shrink-0 cursor-grab flex-col items-center justify-center gap-0.5 rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-muted)] active:cursor-grabbing"
        >
          <span aria-hidden className="h-0.5 w-3 rounded-full bg-current opacity-70" />
          <span aria-hidden className="h-0.5 w-3 rounded-full bg-current opacity-70" />
          <span aria-hidden className="h-0.5 w-3 rounded-full bg-current opacity-70" />
        </button>

        <div ref={saveRef} className="relative flex items-center gap-1">
          <HoverTip
            label={t(uiLanguage, "markupSave")}
            hint={t(uiLanguage, "markupSaveHint")}
            placement="below"
            disabled={saveOpen}
          >
            <button
              type="button"
              aria-expanded={saveOpen}
              disabled={!modelKey}
              onClick={() => setSaveOpen((v) => !v)}
              className={saveGloss}
            >
              <TfiSave className="h-3.5 w-3.5" />
            </button>
          </HoverTip>
          <HoverTip
            label={t(uiLanguage, "markupSnapShort")}
            hint={t(uiLanguage, "markupSnap")}
            placement="below"
          >
            <button
              type="button"
              aria-pressed={snapToFaces}
              onClick={() => setSnapToFaces(!snapToFaces)}
              className={`${chip} w-8 ${snapToFaces ? chipOn : chipIdle}`}
            >
              <TbTarget className="h-4 w-4" />
            </button>
          </HoverTip>
          <HoverTip
            label={t(uiLanguage, "markupMeasure")}
            hint={t(uiLanguage, "markupMeasureHint")}
            placement="below"
          >
            <button
              type="button"
              aria-pressed={measureMode}
              onClick={() => {
                const next = !measureMode;
                setMeasureMode(next);
                if (next) {
                  useLayoutDrawingStore.getState().setArmedLayoutTool(null);
                }
              }}
              className={`${chip} w-8 ${measureMode ? chipOn : chipIdle}`}
            >
              <TbRulerMeasure2 className="h-4 w-4" />
            </button>
          </HoverTip>
          {measurements.length > 0 && (
            <HoverTip
              label={t(uiLanguage, "markupMeasureClear")}
              hint={t(uiLanguage, "markupMeasureClearHint")}
              placement="below"
            >
              <button
                type="button"
                onClick={() => clearMeasurements()}
                className={`${chip} min-w-[2rem] px-1.5 text-[9px] font-bold ${chipIdle}`}
              >
                {measurements.length}
              </button>
            </HoverTip>
          )}
          <HoverTip
            label={t(uiLanguage, "markupGridShort")}
            hint={t(uiLanguage, "markupGridSnap")}
            placement="below"
          >
            <button
              type="button"
              aria-pressed={gridSnap}
              onClick={() => setGridSnap(!gridSnap)}
              className={`${chip} w-8 ${gridSnap ? chipOn : chipIdle}`}
            >
              <CiGrid32 className="h-4 w-4" />
            </button>
          </HoverTip>
          <HoverTip
            label={t(uiLanguage, "markupColor")}
            hint={t(uiLanguage, "markupColorHint")}
            placement="below"
            disabled={colorOpen}
          >
            <ColorSwatchPicker
              color={swatchColor}
              onChange={applyColor}
              size="md"
              onOpenChange={setColorOpen}
            />
          </HoverTip>
          {saveOpen && (
            <div className="absolute top-[calc(100%+0.35rem)] left-0 z-40 w-44 overflow-hidden rounded-xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] py-1 shadow-lg">
              <button
                type="button"
                onClick={() => saveAs("frag")}
                className="w-full px-3 py-2 text-left text-[11px] font-medium hover:bg-amber-50"
              >
                {t(uiLanguage, "markupSaveFrag")}
              </button>
              <button
                type="button"
                onClick={() => saveAs("ifc")}
                className="w-full px-3 py-2 text-left text-[11px] font-medium hover:bg-amber-50"
              >
                {t(uiLanguage, "markupSaveIfc")}
              </button>
            </div>
          )}
        </div>

        <span className="mx-0.5 h-5 w-px shrink-0 bg-[var(--panel-divider)]" />

        {/* Search & Category Filter Elements */}
        <div className="flex items-center gap-1.5 px-1 shrink-0">
          <div className="relative flex items-center h-8 bg-white/40 border border-zinc-300/50 rounded-lg px-2 text-[11px] min-w-[120px] max-w-[160px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] focus-within:border-yellow-400">
            <LuSearch className="h-3.5 w-3.5 text-zinc-400 mr-1.5 shrink-0" />
            <input
              type="text"
              value={browserSearch}
              onChange={(e) => setBrowserSearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent outline-none text-[11px] text-zinc-800 placeholder:text-zinc-400"
            />
            {browserSearch && (
              <button
                type="button"
                onClick={() => setBrowserSearch("")}
                className="text-zinc-400 hover:text-zinc-600 pl-0.5"
              >
                <LuX className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="relative flex items-center h-8 bg-white/40 border border-zinc-300/50 rounded-lg px-1.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
            <select
              value={elementsCategoryFilter}
              onChange={(e) => setElementsCategoryFilter(e.target.value)}
              className="bg-transparent outline-none text-[9px] font-bold uppercase text-zinc-600 focus:text-zinc-900 cursor-pointer"
            >
              {["all", "wall", "door", "window", "slab", "column", "beam", "grid"].map((cat) => (
                <option key={cat} value={cat} className="text-zinc-950 font-bold uppercase">{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <span className="mx-0.5 h-5 w-px shrink-0 bg-[var(--panel-divider)]" />

        <HoverTip
          label={t(uiLanguage, "markupQuadView")}
          hint={t(uiLanguage, "markupQuadViewHint")}
          placement="below"
        >
          <button
            type="button"
            aria-pressed={quadView}
            onClick={() => setQuadView(!quadView)}
            className={`${chip} w-8 ${quadView ? chipOn : chipIdle}`}
          >
            <TfiViewGrid className="h-3.5 w-3.5" />
          </button>
        </HoverTip>

        <span className="mx-0.5 h-5 w-px shrink-0 bg-[var(--panel-divider)]" />

        <div className="flex items-center gap-0.5 sm:gap-1">
          {VIEWS.map((v) => {
            const active = viewPreset === v.id;
            return (
              <HoverTip
                key={v.id}
                label={v.label}
                hint={t(uiLanguage, v.titleKey as "markupView_top")}
                placement="below"
              >
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setViewPreset(v.id)}
                  className={`${chip} min-w-[1.85rem] px-1.5 text-[10px] font-bold tracking-wide sm:min-w-[2rem] sm:px-2 ${
                    active ? chipOn : chipIdle
                  }`}
                >
                  {v.label}
                </button>
              </HoverTip>
            );
          })}
        </div>
      </div>
    </div>
  );
}
