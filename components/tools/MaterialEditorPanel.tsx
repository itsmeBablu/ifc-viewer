"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import {
  LuBox,
  LuCheck,
  LuChevronRight,
  LuCircle,
  LuCylinder,
  LuGrip,
  LuLayers,
  LuMousePointer2,
  LuPalette,
  LuPlus,
  LuSearch,
  LuSparkles,
  LuTrash2,
  LuX,
  LuSlidersHorizontal,
  LuFlame,
  LuImage,
} from "react-icons/lu";
import gsap from "gsap";
import UnifiedButton from "@/components/common/UnifiedButton";
import GsapHeightAccordion from "@/components/common/GsapHeightAccordion";
import { getHatchCanvasTexture } from "@/lib/hatchPatterns";
import { renderMaterialPreview } from "@/lib/materialSpherePreview";
import {
  MATERIAL_DRAG_MIME,
  useMaterialStore,
  type HatchStyle,
  type MaterialDefinition,
  type MaterialPreviewShape,
} from "@/store/materialStore";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";

const HATCHES: { id: HatchStyle; label: string; glyph: string }[] = [
  ["solid", "Solid / none", "■"],
  ["horizontal", "Horizontal lines", "≡"],
  ["vertical", "Vertical lines", "|||"],
  ["diagonal", "Diagonal 45°", "///"],
  ["cross", "Diagonal cross", "XXX"],
  ["grid", "Square grid", "▦"],
  ["brick", "Running bond brick", "▤"],
  ["tile", "Ceramic tile", "▦"],
  ["checker", "Checker plate", "▩"],
  ["concrete", "Concrete aggregate", "∴"],
  ["dots", "Regular dots", "⠿"],
  ["sand", "Sand", "⠂"],
  ["earth", "Earth / fill", "≋"],
  ["steel", "Steel section", "╳"],
  ["zigzag", "Insulation", "〽"],
  ["wood", "Wood grain", "≋"],
].map(([id, label, glyph]) => ({ id: id as HatchStyle, label, glyph }));

const CATEGORIES = [
  "All",
  "Masonry",
  "Concrete",
  "Wood",
  "Glass",
  "Metal",
  "Roofing",
  "Flooring",
  "Plastics",
  "Fabrics",
  "Finishes",
  "MEP",
  "Custom",
] as const;

const SHAPES: { id: MaterialPreviewShape; label: string; icon: React.ReactNode }[] = [
  { id: "sphere", label: "Sphere", icon: <LuCircle className="h-3.5 w-3.5" /> },
  { id: "cube", label: "Box", icon: <LuBox className="h-3.5 w-3.5" /> },
  { id: "cylinder", label: "Cylinder", icon: <LuCylinder className="h-3.5 w-3.5" /> },
  { id: "fabric", label: "Fabric", icon: <LuLayers className="h-3.5 w-3.5" /> },
];

const CLASS_DEFAULTS: Record<MaterialDefinition["category"], Partial<MaterialDefinition>> = {
  Masonry: {
    color: "#9f4325",
    roughness: 0.88,
    metalness: 0,
    opacity: 1,
    transmission: 0,
    clearcoat: 0,
    clearcoatRoughness: 0.3,
    ior: 1.52,
    bumpScale: 0.45,
    hatchStyle: "brick",
    hatchScaleMm: 250,
    tilingScale: 1,
  },
  Concrete: {
    color: "#8e9196",
    roughness: 0.85,
    metalness: 0.02,
    opacity: 1,
    transmission: 0,
    clearcoat: 0,
    clearcoatRoughness: 0.4,
    ior: 1.5,
    bumpScale: 0.35,
    hatchStyle: "concrete",
    hatchScaleMm: 200,
    tilingScale: 1,
  },
  Wood: {
    color: "#b4824d",
    roughness: 0.62,
    metalness: 0,
    opacity: 1,
    transmission: 0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.35,
    ior: 1.5,
    bumpScale: 0.3,
    hatchStyle: "wood",
    hatchScaleMm: 180,
    tilingScale: 1,
  },
  Glass: {
    color: "#c8e8f5",
    roughness: 0.03,
    metalness: 0,
    opacity: 0.35,
    transmission: 0.95,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    ior: 1.52,
    bumpScale: 0,
    hatchStyle: "solid",
    hatchScaleMm: 200,
    tilingScale: 1,
  },
  Metal: {
    color: "#c2c7cf",
    roughness: 0.25,
    metalness: 0.9,
    opacity: 1,
    transmission: 0,
    clearcoat: 0.18,
    clearcoatRoughness: 0.12,
    ior: 1.5,
    bumpScale: 0.12,
    hatchStyle: "solid",
    hatchScaleMm: 150,
    tilingScale: 1,
  },
  Roofing: {
    color: "#c2410c",
    roughness: 0.82,
    metalness: 0,
    opacity: 1,
    transmission: 0,
    clearcoat: 0,
    clearcoatRoughness: 0.3,
    ior: 1.5,
    bumpScale: 0.45,
    hatchStyle: "zigzag",
    hatchScaleMm: 150,
    tilingScale: 1,
  },
  Flooring: {
    color: "#e2e8f0",
    roughness: 0.25,
    metalness: 0.05,
    opacity: 1,
    transmission: 0,
    clearcoat: 0.4,
    clearcoatRoughness: 0.1,
    ior: 1.5,
    bumpScale: 0.15,
    hatchStyle: "tile",
    hatchScaleMm: 200,
    tilingScale: 1,
  },
  Plastics: {
    color: "#475569",
    roughness: 0.65,
    metalness: 0,
    opacity: 1,
    transmission: 0,
    clearcoat: 0,
    clearcoatRoughness: 0.2,
    ior: 1.5,
    bumpScale: 0.1,
    hatchStyle: "solid",
    hatchScaleMm: 100,
    tilingScale: 1,
  },
  Fabrics: {
    color: "#d6d3d1",
    roughness: 0.95,
    metalness: 0,
    opacity: 1,
    transmission: 0,
    clearcoat: 0,
    clearcoatRoughness: 0.3,
    ior: 1.5,
    bumpScale: 0.35,
    hatchStyle: "cross",
    hatchScaleMm: 60,
    tilingScale: 1,
  },
  Finishes: {
    color: "#f8fafc",
    roughness: 0.95,
    metalness: 0,
    opacity: 1,
    transmission: 0,
    clearcoat: 0,
    clearcoatRoughness: 0.3,
    ior: 1.5,
    bumpScale: 0.12,
    hatchStyle: "solid",
    hatchScaleMm: 200,
    tilingScale: 1,
  },
  MEP: {
    color: "#94a3b8",
    roughness: 0.28,
    metalness: 0.85,
    opacity: 1,
    transmission: 0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.1,
    ior: 1.5,
    bumpScale: 0.15,
    hatchStyle: "solid",
    hatchScaleMm: 100,
    tilingScale: 1,
  },
  Custom: {
    roughness: 0.5,
    metalness: 0,
    opacity: 1,
    transmission: 0,
    clearcoat: 0,
    clearcoatRoughness: 0.1,
    ior: 1.5,
    bumpScale: 0.2,
    hatchStyle: "solid",
    hatchScaleMm: 200,
    tilingScale: 1,
  },
};

const field =
  "h-8 w-full rounded-xl border border-white/15 bg-black/40 px-2.5 text-xs text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] outline-none backdrop-blur-xl focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20";

function Slider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  display?: string;
  onChange: (n: number) => void;
}) {
  const progress = `${Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))}%`;
  const isPercent = display === undefined;
  const suffix = isPercent ? "%" : display?.trim().endsWith("mm") ? "mm" : display?.trim().endsWith("×") ? "×" : "";
  const editableValue = isPercent ? Math.round(value * 100) : value;
  const editableMin = isPercent ? min * 100 : min;
  const editableMax = isPercent ? max * 100 : max;
  const editableStep = isPercent ? Math.max(1, step * 100) : step;

  const changeEditableValue = (raw: string) => {
    const next = Number(raw);
    if (!Number.isFinite(next)) return;
    onChange(Math.max(min, Math.min(max, isPercent ? next / 100 : next)));
  };

  return (
    <label className="grid grid-cols-[90px_1fr_56px] items-center gap-2 text-[11px] text-zinc-300 py-1 border-b border-white/[0.04] last:border-b-0">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="material-slider w-full cursor-pointer"
        style={{ "--slider-progress": progress } as React.CSSProperties}
      />
      <span className="flex items-baseline justify-end font-mono text-[10px] font-bold text-amber-300">
        <input
          type="number"
          min={editableMin}
          max={editableMax}
          step={editableStep}
          value={editableValue}
          onChange={(e) => changeEditableValue(e.target.value)}
          className="w-10 appearance-none border-0 bg-transparent p-0 text-right font-mono text-[10px] font-bold text-amber-300 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          aria-label={`${label} value`}
        />
        {suffix && <span className="ml-0.5 text-zinc-500">{suffix}</span>}
      </span>
    </label>
  );
}

function Section({
  title,
  icon,
  badgeGradient,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  badgeGradient: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="ios-glass-card rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between p-3 text-left font-bold text-xs text-white hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-5 h-5 rounded-md bg-gradient-to-br ${badgeGradient} flex items-center justify-center text-white text-[10px] shadow-sm`}
          >
            {icon}
          </div>
          <span className="tracking-tight">{title}</span>
        </div>
        <LuChevronRight
          className={`h-3.5 w-3.5 text-zinc-400 transition-transform duration-300 ${
            open ? "rotate-90" : "rotate-0"
          }`}
        />
      </button>
      <GsapHeightAccordion open={open} contentKey={title} innerClassName="space-y-2.5 p-3 pt-0 border-t border-white/[0.06]">
        {children}
      </GsapHeightAccordion>
    </section>
  );
}

export default function MaterialEditorPanel({
  isOpen,
  onClose,
  embedded = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}) {
  const isDark = useAppStore((s) => s.colorTheme === "dark");
  const materials = useMaterialStore((s) => s.materials);
  const selectedId = useMaterialStore((s) => s.selectedMaterialId);
  const select = useMaterialStore((s) => s.setSelectedMaterialId);
  const add = useMaterialStore((s) => s.addMaterial);
  const update = useMaterialStore((s) => s.updateMaterial);
  const remove = useMaterialStore((s) => s.deleteMaterial);
  const paintId = useMaterialStore((s) => s.paintMaterialId);
  const setPaintId = useMaterialStore((s) => s.setPaintMaterialId);

  const wallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const slabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const doorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const windowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedElements = useLayoutDrawingStore((s) => s.selectedElements);
  const columnId = selectedElements.find((item) => item.kind === "column")?.id;
  const beamId = selectedElements.find((item) => item.kind === "beam")?.id;

  const updateWall = useLayoutDrawingStore((s) => s.updateWall);
  const updateSlab = useLayoutDrawingStore((s) => s.updateSlab);
  const updateDoor = useLayoutDrawingStore((s) => s.updateDoor);
  const updateWindow = useLayoutDrawingStore((s) => s.updateWindow);
  const updateColumn = useLayoutDrawingStore((s) => s.updateColumn);
  const updateBeam = useLayoutDrawingStore((s) => s.updateBeam);

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [search, setSearch] = useState("");
  const [shape, setShape] = useState<MaterialPreviewShape>("sphere");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () =>
      materials.filter(
        (m) =>
          (category === "All" || m.category === category || (category === "Custom" && !m.isPreset)) &&
          (!search || `${m.name} ${m.category}`.toLowerCase().includes(search.toLowerCase()))
      ),
    [materials, category, search]
  );

  const selected = materials.find((m) => m.id === selectedId) ?? filtered[0] ?? materials[0];

  // GSAP animation on panel open
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".ios-glass-card",
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.04, ease: "power2.out" }
      );
    }, containerRef);
    return () => ctx.revert();
  }, [isOpen, category]);

  if (!isOpen || !selected) return null;

  const patch = (p: Partial<MaterialDefinition>) => update(selected.id, p);
  const clone = () =>
    select(add({ ...selected, name: `${selected.name} Copy`, category: "Custom", isPreset: false }).id);

  const assign = () => {
    const p = { material: selected.id, color: selected.color };
    if (wallId) void updateWall(wallId, p);
    else if (slabId) void updateSlab(slabId, p);
    else if (doorId) void updateDoor(doorId, p);
    else if (windowId) void updateWindow(windowId, p);
    else if (columnId) void updateColumn(columnId, p);
    else if (beamId) void updateBeam(beamId, p);
  };

  const drag = (e: React.DragEvent, m: MaterialDefinition) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData(MATERIAL_DRAG_MIME, m.id);
    e.dataTransfer.setData("text/plain", `vstudio-material:${m.id}`);
    select(m.id);
  };

  const preview = renderMaterialPreview(selected, shape, 144);
  const hasSelection = Boolean(wallId || slabId || doorId || windowId || columnId || beamId);

  const hatchTexture = getHatchCanvasTexture(
    selected.hatchStyle,
    "#334155",
    selected.color,
    selected.hatchScaleMm ?? 200
  );
  const hatchCanvas =
    typeof HTMLCanvasElement !== "undefined" && hatchTexture?.image instanceof HTMLCanvasElement
      ? hatchTexture.image
      : null;
  const hatchUrl = hatchCanvas?.toDataURL() ?? null;
  const sampleSizePx = Math.max(
    12,
    Math.min(96, (selected.hatchScaleMm ?? 200) / Math.max(0.1, selected.tilingScale ?? 1) / 4)
  );

  return (
    <div
      ref={containerRef}
      className={`${
        embedded ? "relative h-full min-h-0 w-full" : "absolute inset-0 max-[1100px]:fixed max-[1100px]:inset-3"
      } z-40 flex select-none flex-col overflow-hidden border-l border-white/20 dark:border-white/10 bg-slate-900/85 dark:bg-slate-950/90 text-white shadow-[0_16px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-3xl max-[1100px]:rounded-[28px] max-[1100px]:border`}
    >
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-white/[0.02] px-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-xs shadow-sm">
            <LuPalette className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white tracking-tight">Slate Material Studio</p>
            <p className="text-[9px] text-zinc-400">PBR Photometric · iOS 26 Glass</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={clone}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-zinc-200 hover:text-white transition-all active:scale-95"
            title="Duplicate Material"
          >
            <LuPlus className="h-3.5 w-3.5" />
          </button>
          {!selected.isPreset && (
            <button
              onClick={() => remove(selected.id)}
              className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 flex items-center justify-center text-red-400 hover:text-red-300 transition-all active:scale-95"
              title="Delete Material"
            >
              <LuTrash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-zinc-200 hover:text-white transition-all active:scale-95"
            title="Close"
          >
            <LuX className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 thin-scroll space-y-3">
        {/* SECTION 1: Material Browser Slots */}
        <Section
          title="Material Palette & Slots"
          icon={<LuBox className="h-3 w-3" />}
          badgeGradient="from-amber-500 to-orange-600"
        >
          {/* Search bar */}
          <div className="relative">
            <LuSearch className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PBR materials…"
              className={`${field} pl-8`}
            />
          </div>

          {/* Categories Pills */}
          <div className="flex gap-1 overflow-x-auto pb-1 thin-scroll">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`shrink-0 rounded-xl px-2.5 py-1 text-[10px] font-semibold transition-all active:scale-95 ${
                  category === c
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 shadow-[0_2px_8px_rgba(245,158,11,0.35),inset_0_1px_0_rgba(255,255,255,0.4)]"
                    : "border border-white/10 bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Slot Grid */}
          <div className="grid max-h-48 grid-cols-3 gap-1.5 overflow-y-auto pr-1 thin-scroll">
            {filtered.map((m) => (
              <button
                key={m.id}
                draggable
                onDragStart={(e) => drag(e, m)}
                onClick={() => select(m.id)}
                className={`group relative min-w-0 rounded-xl border p-1.5 text-left transition-all active:scale-95 ${
                  m.id === selected.id
                    ? "border-amber-400 bg-amber-500/10 shadow-[0_3px_12px_rgba(250,204,21,0.25),inset_0_1px_0_rgba(255,255,255,0.2)]"
                    : "border-white/10 bg-black/30 hover:border-white/20"
                }`}
                title="Drag onto a 3D object"
              >
                <LuGrip className="absolute right-1 top-1 h-3 w-3 text-zinc-500 group-hover:text-zinc-300" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  draggable={false}
                  src={renderMaterialPreview(m, "sphere", 72)}
                  alt=""
                  className="pointer-events-none mx-auto h-11 w-11 drop-shadow-md"
                />
                <span className="pointer-events-none block truncate text-[9px] font-bold text-white mt-1">
                  {m.name}
                </span>
                <span className="pointer-events-none block truncate text-[8px] text-zinc-400">
                  {m.category}
                </span>
              </button>
            ))}
          </div>

          <p className="flex items-center gap-1.5 text-[10px] text-zinc-400 pt-0.5">
            <LuMousePointer2 className="h-3 w-3 text-amber-400" />
            <span>Drag a slot onto any building mesh in 3D.</span>
          </p>
        </Section>

        {/* SECTION 2: 3D Preview & Identity */}
        <Section
          title="Photometric 3D Preview"
          icon={<LuSlidersHorizontal className="h-3 w-3" />}
          badgeGradient="from-blue-500 to-indigo-600"
        >
          <div className="grid grid-cols-[1fr_72px] gap-2.5">
            {/* 3D Chamber Preview Card */}
            <div className="flex min-h-28 items-center justify-center rounded-2xl border border-white/15 bg-black/50 shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Material preview"
                className="h-24 w-24 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
              />
            </div>

            {/* Shape Selectors */}
            <div className="grid grid-rows-4 gap-1">
              {SHAPES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setShape(s.id)}
                  className={`flex items-center justify-center gap-1 rounded-xl text-[10px] font-semibold border transition-all active:scale-95 ${
                    shape === s.id
                      ? "border-blue-400 bg-blue-500/20 text-blue-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"
                  }`}
                >
                  {s.icon}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-[1fr_95px] gap-2">
              <label className="text-[10px] text-zinc-400 block">
                Name
                <input
                  value={selected.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  className={`${field} mt-1`}
                />
              </label>

              <label className="text-[10px] text-zinc-400 block">
                Class
                <select
                  value={selected.category}
                  onChange={(e) => {
                    const next = e.target.value as MaterialDefinition["category"];
                    patch({ ...CLASS_DEFAULTS[next], category: next });
                  }}
                  className={`${field} mt-1`}
                >
                  {CATEGORIES.slice(1).map((c) => (
                    <option key={c} value={c} className="bg-slate-900 text-white">
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-[40px_1fr] gap-2 items-center">
              <input
                type="color"
                value={selected.color}
                onChange={(e) => patch({ color: e.target.value })}
                className="h-8 w-10 rounded-xl border border-white/20 bg-transparent p-0 cursor-pointer overflow-hidden shadow-sm"
              />
              <input value={selected.color.toUpperCase()} readOnly className={field} />
            </div>
          </div>
        </Section>

        {/* SECTION 3: PBR Physical Parameters */}
        <Section
          title="PBR Physical Parameters"
          icon={<LuSparkles className="h-3 w-3" />}
          badgeGradient="from-emerald-500 to-teal-600"
        >
          <Slider label="Roughness" value={selected.roughness} onChange={(v) => patch({ roughness: v })} />
          <Slider label="Metalness" value={selected.metalness} onChange={(v) => patch({ metalness: v })} />
          <Slider label="Opacity" value={selected.opacity} min={0.02} onChange={(v) => patch({ opacity: v })} />
          <Slider
            label="Transmission"
            value={selected.transmission ?? 0}
            onChange={(v) => patch({ transmission: v })}
          />
          <Slider label="Clearcoat" value={selected.clearcoat ?? 0} onChange={(v) => patch({ clearcoat: v })} />
          <Slider
            label="Coat Roughness"
            value={selected.clearcoatRoughness ?? 0.1}
            onChange={(v) => patch({ clearcoatRoughness: v })}
          />
          <Slider
            label="IOR Index"
            value={selected.ior ?? 1.5}
            min={1}
            max={2.5}
            display={(selected.ior ?? 1.5).toFixed(2)}
            onChange={(v) => patch({ ior: v })}
          />
          <Slider
            label="Bump Depth"
            value={selected.bumpScale ?? 0.2}
            max={2}
            display={(selected.bumpScale ?? 0.2).toFixed(2)}
            onChange={(v) => patch({ bumpScale: v })}
          />
        </Section>

        {/* SECTION 4: Hatch & Surface Pattern */}
        <Section
          title="Surface Hatch & Tiling"
          icon={<LuImage className="h-3 w-3" />}
          badgeGradient="from-purple-500 to-violet-600"
        >
          <label className="grid grid-cols-[80px_1fr] items-center gap-2 text-[11px] text-zinc-300">
            <span>Pattern</span>
            <select
              value={selected.hatchStyle}
              onChange={(e) => patch({ hatchStyle: e.target.value as HatchStyle })}
              className={field}
            >
              {HATCHES.map((h) => (
                <option key={h.id} value={h.id} className="bg-slate-900 text-white">
                  {h.glyph} {h.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-[80px_1fr] items-center gap-2 text-[11px] text-zinc-300">
            <span>Pattern Live</span>
            <div
              className="h-9 rounded-xl border border-white/20 shadow-inner"
              style={{
                backgroundColor: selected.color,
                backgroundImage: hatchUrl ? `url(${hatchUrl})` : undefined,
                backgroundSize: hatchUrl ? `${sampleSizePx}px ${sampleSizePx}px` : undefined,
              }}
            />
          </div>

          <Slider
            label="Spacing"
            value={selected.hatchScaleMm ?? 200}
            min={25}
            max={2000}
            step={25}
            display={`${selected.hatchScaleMm ?? 200} mm`}
            onChange={(v) => patch({ hatchScaleMm: v })}
          />
          <Slider
            label="UV Tiling"
            value={selected.tilingScale ?? 1}
            min={0.1}
            max={10}
            step={0.1}
            display={`${(selected.tilingScale ?? 1).toFixed(1)}×`}
            onChange={(v) => patch({ tilingScale: v })}
          />
        </Section>

        {/* Actions Footer */}
        <div className="sticky bottom-0 grid grid-cols-2 gap-2 rounded-2xl border border-white/15 bg-slate-950/90 p-2.5 shadow-2xl backdrop-blur-2xl">
          <button
            type="button"
            disabled={!hasSelection}
            onClick={assign}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 disabled:opacity-40 text-xs font-bold text-white py-2 shadow-md transition-all active:scale-95"
          >
            <LuCheck className="h-4 w-4" />
            <span>Assign</span>
          </button>
          <button
            type="button"
            onClick={() => setPaintId(paintId === selected.id ? null : selected.id)}
            className={`flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold py-2 shadow-md transition-all active:scale-95 ${
              paintId === selected.id
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 ring-2 ring-amber-400/50"
                : "bg-white/10 hover:bg-white/20 border border-white/10 text-white"
            }`}
          >
            <LuSparkles className="h-4 w-4" />
            <span>{paintId === selected.id ? "Painting" : "Paint Brush"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
