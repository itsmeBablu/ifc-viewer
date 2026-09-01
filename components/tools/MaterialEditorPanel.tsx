"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import {
  LuBox,
  LuCheck,
  LuChevronRight,
  LuChevronDown,
  LuCircle,
  LuCylinder,
  LuGrip,
  LuLayers,
  LuLoader2,
  LuMousePointer2,
  LuPalette,
  LuPlus,
  LuSearch,
  LuSparkles,
  LuTrash2,
  LuX,
  LuSlidersHorizontal,
} from "react-icons/lu";
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
import type { WallType } from "@/lib/layoutDrawing";
import DuplicateOrApplyTypeDialog from "./DuplicateOrApplyTypeDialog";

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
  { id: "sphere", label: "Sphere", icon: <LuCircle className="h-3 w-3" /> },
  { id: "cube", label: "Box", icon: <LuBox className="h-3 w-3" /> },
  { id: "cylinder", label: "Cylinder", icon: <LuCylinder className="h-3 w-3" /> },
  { id: "fabric", label: "Fabric", icon: <LuLayers className="h-3 w-3" /> },
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
    color: "#475569",
    roughness: 0.8,
    metalness: 0.1,
    opacity: 1,
    transmission: 0,
    clearcoat: 0,
    clearcoatRoughness: 0.2,
    ior: 1.5,
    bumpScale: 0.4,
    hatchStyle: "grid",
    hatchScaleMm: 300,
    tilingScale: 1,
  },
  Flooring: {
    color: "#78716c",
    roughness: 0.4,
    metalness: 0.05,
    opacity: 1,
    transmission: 0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.15,
    ior: 1.5,
    bumpScale: 0.2,
    hatchStyle: "tile",
    hatchScaleMm: 400,
    tilingScale: 1,
  },
  Plastics: {
    color: "#e2e8f0",
    roughness: 0.3,
    metalness: 0,
    opacity: 1,
    transmission: 0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.1,
    ior: 1.46,
    bumpScale: 0.05,
    hatchStyle: "solid",
    hatchScaleMm: 100,
    tilingScale: 1,
  },
  Fabrics: {
    color: "#64748b",
    roughness: 0.95,
    metalness: 0,
    opacity: 1,
    transmission: 0,
    clearcoat: 0,
    clearcoatRoughness: 0,
    ior: 1.35,
    bumpScale: 0.5,
    hatchStyle: "checker",
    hatchScaleMm: 50,
    tilingScale: 1,
  },
  Finishes: {
    color: "#f8fafc",
    roughness: 0.9,
    metalness: 0,
    opacity: 1,
    transmission: 0,
    clearcoat: 0,
    clearcoatRoughness: 0,
    ior: 1.5,
    bumpScale: 0.15,
    hatchStyle: "sand",
    hatchScaleMm: 100,
    tilingScale: 1,
  },
  MEP: {
    color: "#38bdf8",
    roughness: 0.35,
    metalness: 0.7,
    opacity: 1,
    transmission: 0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.1,
    ior: 1.5,
    bumpScale: 0.1,
    hatchStyle: "steel",
    hatchScaleMm: 150,
    tilingScale: 1,
  },
  Custom: {
    color: "#94a3b8",
    roughness: 0.5,
    metalness: 0.1,
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

function Slider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  display,
  onChange,
  isMep = false,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  display?: string;
  onChange: (n: number) => void;
  isMep?: boolean;
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
    <label className="grid grid-cols-[80px_1fr_48px] items-center gap-1.5 text-[10px] py-0.5 border-b border-[var(--panel-divider)]/30 last:border-b-0 text-[var(--text-body)]">
      <span className="truncate">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="material-slider w-full cursor-pointer h-1.5"
        style={{ "--slider-progress": progress } as React.CSSProperties}
      />
      <span className={`flex items-baseline justify-end font-mono text-[10px] font-bold ${
        isMep ? "text-sky-400" : "text-yellow-400"
      }`}>
        <input
          type="number"
          min={editableMin}
          max={editableMax}
          step={editableStep}
          value={editableValue}
          onChange={(e) => changeEditableValue(e.target.value)}
          className={`w-8 appearance-none border-0 bg-transparent p-0 text-right font-mono text-[10px] font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
            isMep ? "text-sky-400" : "text-yellow-400"
          }`}
          aria-label={`${label} value`}
        />
        {suffix && <span className="ml-0.5 text-[var(--text-muted)] text-[9px]">{suffix}</span>}
      </span>
    </label>
  );
}

function Section({
  title,
  icon,
  children,
  defaultOpen = true,
  isMep = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  isMep?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-card)] overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between p-2 text-left font-bold text-[11px] text-[var(--text-strong)] hover:bg-[var(--surface-overlay)] transition-colors"
      >
        <div className="flex items-center gap-1.5 min-w-0 pr-2">
          <span className={`shrink-0 ${isMep ? "text-sky-400" : "text-yellow-400"}`}>{icon}</span>
          <span className="truncate">{title}</span>
        </div>
        <LuChevronRight
          className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-200 shrink-0 ${
            open ? "rotate-90" : "rotate-0"
          }`}
        />
      </button>
      <GsapHeightAccordion open={open} contentKey={title} innerClassName="space-y-1.5 p-2 pt-0 border-t border-[var(--panel-divider)]/40 text-xs">
        {children}
      </GsapHeightAccordion>
    </section>
  );
}

function VYellowDropdown<T extends string>({
  value,
  options,
  onChange,
  className = "",
  isMep = false,
}: {
  value: T;
  options: T[];
  onChange: (val: T) => void;
  className?: string;
  isMep?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex h-7 w-full items-center justify-between rounded-lg border px-2 text-[11px] font-semibold transition-all ${
          open
            ? isMep
              ? "border-sky-400 bg-sky-500/15 text-white ring-1 ring-sky-400/40"
              : "border-yellow-400 bg-yellow-500/15 text-white ring-1 ring-yellow-400/40"
            : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-strong)] hover:border-yellow-400/50"
        }`}
      >
        <span className="truncate">{value}</span>
        <LuChevronDown className={`h-3 w-3 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-card)] text-[var(--text-strong)] p-1 shadow-2xl backdrop-blur-xl thin-scroll">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[10.5px] transition-colors ${
                opt === value
                  ? isMep
                    ? "bg-sky-400 text-zinc-950 font-black"
                    : "bg-yellow-400 text-zinc-950 font-black"
                  : "text-[var(--text-strong)] hover:bg-[var(--surface-overlay)]"
              }`}
            >
              <span className="truncate">{opt}</span>
              {opt === value && <LuCheck className="h-3 w-3 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
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

  const walls = useLayoutDrawingStore((s) => s.walls);
  const wallTypes = useLayoutDrawingStore((s) => s.wallTypes);
  const updateWallType = useLayoutDrawingStore((s) => s.updateWallType);
  const addWallType = useLayoutDrawingStore((s) => s.addWallType);

  const [duplicatePrompt, setDuplicatePrompt] = useState<{
    isOpen: boolean;
    wallId: string;
    typeName: string;
    matchingWallIds: string[];
    materialName: string;
    color?: string;
  } | null>(null);

  const [category, setCategory] = useState<string>("All");
  const [search, setSearch] = useState<string>("");
  const [shape, setShape] = useState<MaterialPreviewShape>("sphere");
  const [panelWidth, setPanelWidth] = useState<number>(340);

  const isResizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(340);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = panelWidth;

    const onMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = resizeStartXRef.current - ev.clientX;
      const next = Math.min(800, Math.max(280, resizeStartWidthRef.current + delta));
      setPanelWidth(next);
    };

    const onUp = () => {
      isResizingRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [panelWidth]);

  const selected = useMemo(() => {
    return materials.find((m) => m.id === selectedId) ?? materials[0];
  }, [materials, selectedId]);

  const filtered = useMemo(() => {
    return materials.filter((m) => {
      if (category !== "All" && m.category !== category) return false;
      if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [materials, category, search]);

  if (!isOpen) return null;

  const isMep = selected.category === "MEP" || category === "MEP";
  const accentColor = isMep ? "text-sky-400" : "text-yellow-400";
  const accentBg = isMep ? "bg-sky-400" : "bg-yellow-400";

  const patch = (p: Partial<MaterialDefinition>) => {
    update(selected.id, p);
  };

  const clone = () => {
    const next: MaterialDefinition = {
      ...selected,
      id: `mat-custom-${Date.now()}`,
      name: `${selected.name} Copy`,
      isPreset: false,
    };
    add(next);
    select(next.id);
  };

  const handleApplyToAll = () => {
    if (!duplicatePrompt) return;
    const { matchingWallIds, materialName, color } = duplicatePrompt;
    for (const wid of matchingWallIds) {
      void updateWall(wid, { material: materialName, color });
    }
    setDuplicatePrompt(null);
  };

  const handleDuplicate = () => {
    if (!duplicatePrompt) return;
    const { wallId, typeName, materialName, color } = duplicatePrompt;
    const selectedWall = walls.find((w) => w.id === wallId);
    const newTypeId = `wall-type-${Date.now()}`;
    const newTypeName = `${typeName} (Custom)`;
    const thick = selectedWall?.thicknessMm || 200;

    const newType: WallType = {
      id: newTypeId,
      name: newTypeName,
      totalThicknessMm: thick,
      layers: selectedWall?.layers ? selectedWall.layers.map((l) => ({
        ...l,
        material: l.function === "structure" ? materialName : l.material,
        color: l.function === "structure" ? (color || l.color) : l.color,
      })) : [
        { id: `l1-${Date.now()}`, name: "Interior Finish", function: "finish1", material: "Plaster", thicknessMm: 15, color: "#f8fafc" },
        { id: `l2-${Date.now()}`, name: "Structural Core", function: "structure", material: materialName, thicknessMm: Math.max(10, thick - 30), color: color || "#8e9196" },
        { id: `l3-${Date.now()}`, name: "Exterior Finish", function: "finish2", material: "Plaster", thicknessMm: 15, color: "#f1f5f9" },
      ],
    };

    void addWallType(newType);
    void updateWall(wallId, {
      wallTypeId: newTypeId,
      material: materialName,
      color,
      layers: newType.layers,
    });
    setDuplicatePrompt(null);
  };

  const assign = () => {
    const p = { material: selected.name, color: selected.color };
    if (wallId) {
      const selectedWall = walls.find((w) => w.id === wallId);
      if (selectedWall) {
        const typeId = selectedWall.wallTypeId;
        const matching = walls.filter((w) => (typeId ? w.wallTypeId === typeId : (w.thicknessMm === selectedWall.thicknessMm)));
        if (matching.length > 1) {
          const typeName = wallTypes.find((t) => t.id === typeId)?.name || `Wall - ${selectedWall.thicknessMm}mm`;
          setDuplicatePrompt({
            isOpen: true,
            wallId,
            typeName,
            matchingWallIds: matching.map((w) => w.id),
            materialName: selected.name,
            color: selected.color,
          });
          return;
        }
      }
      void updateWall(wallId, p);
    } else if (slabId) void updateSlab(slabId, p);
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

  const preview = renderMaterialPreview(selected, shape, 112);
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

  const fieldInputClass = `h-7 w-full rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-[11px] text-[var(--text-strong)] outline-none focus:outline-none transition-colors ${
    isMep ? "focus:border-sky-400" : "focus:border-yellow-400"
  }`;

  return (
    <div
      style={!embedded ? { width: panelWidth } : undefined}
      className={`${
        embedded ? "relative h-full min-h-0 w-full" : "fixed top-0 bottom-0 right-0 z-40"
      } flex select-none flex-col overflow-hidden border-l border-[var(--panel-divider)] bg-[var(--surface-card)] text-[var(--text-strong)] shadow-2xl backdrop-blur-2xl transition-all`}
    >
      {!embedded && (
        <div
          onMouseDown={onResizeMouseDown}
          className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 hover:${accentBg} transition-colors`}
          title="Drag to resize material panel width"
        />
      )}

      <header className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--panel-divider)] px-2.5 bg-[var(--surface-overlay)]/60">
        <div className="flex items-center gap-1.5 min-w-0 pr-2">
          <span className={`h-2 w-2 rounded-full ${accentBg} shrink-0`} />
          <p className="text-[11px] font-bold text-[var(--text-strong)] truncate">
            Material Studio:
          </p>
          <span className="text-[10px] text-[var(--text-muted)] truncate" title={selected.name}>
            {selected.name}...
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={clone}
            className="flex h-6 w-6 items-center justify-center rounded border border-[var(--panel-divider)] text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-overlay)]"
            title="Duplicate Material"
          >
            <LuPlus className="h-3 w-3" />
          </button>
          {!selected.isPreset && (
            <button
              type="button"
              onClick={() => remove(selected.id)}
              className="flex h-6 w-6 items-center justify-center rounded border border-red-500/20 text-red-500 hover:bg-red-500/10"
              title="Delete Material"
            >
              <LuTrash2 className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-overlay)]"
            title="Close"
          >
            <LuX className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-2 thin-scroll text-xs">
        <Section title="Material Browser" icon={<LuSearch className="h-3.5 w-3.5" />} isMep={isMep}>
          <div className="relative">
            <LuSearch className="absolute left-2 top-2 h-3 w-3 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search library..."
              className={`${fieldInputClass} pl-6`}
            />
          </div>

          <div className="flex gap-1 overflow-x-auto pb-0.5 thin-scroll">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`shrink-0 rounded px-2 py-0.5 text-[9px] font-semibold transition-all ${
                  category === c
                    ? `${isMep ? "btn-v-blue" : "btn-v-yellow"} btn-liquid-hover !text-zinc-950 font-bold shadow-sm`
                    : "btn-yellow-border-hover border border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid max-h-56 grid-cols-2 min-[340px]:grid-cols-3 gap-2 overflow-y-auto p-1 thin-scroll">
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                draggable
                onDragStart={(e) => drag(e, m)}
                onClick={() => select(m.id)}
                className={`group relative aspect-square w-full overflow-hidden rounded-xl border text-left transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] ${
                  m.id === selected.id
                    ? isMep
                      ? "border-sky-400 ring-2 ring-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.3)] bg-[var(--surface-overlay)]"
                      : "border-yellow-400 ring-2 ring-yellow-400 shadow-[0_0_16px_rgba(250,204,21,0.3)] bg-[var(--surface-overlay)]"
                    : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] hover:bg-[var(--surface-overlay)] hover:border-yellow-400/60 shadow-sm"
                }`}
                title={`${m.name} (${m.category})`}
              >
                {/* Full Square High-Texture Preview */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  draggable={false}
                  src={renderMaterialPreview(m, "sphere", 128)}
                  alt=""
                  className="h-full w-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-110"
                />

                {/* Grip Icon */}
                <LuGrip className="absolute right-1.5 top-1.5 h-3 w-3 text-[var(--text-muted)] drop-shadow" />

                {/* Bottom Overlay Label */}
                <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-[var(--surface-card)] via-[var(--surface-card)]/80 to-transparent p-1.5 pt-4 pointer-events-none">
                  <span className="truncate text-[10px] font-bold text-[var(--text-strong)] leading-tight">
                    {m.name}
                  </span>
                  <span className="truncate text-[8px] font-medium text-[var(--text-muted)] group-hover:text-[var(--text-strong)] transition-colors">
                    {m.category}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <p className="flex items-center gap-1 text-[9px] text-[var(--text-muted)]">
            <LuMousePointer2 className="h-2.5 w-2.5" />
            <span>Drag slot onto any 3D model element</span>
          </p>
        </Section>

        <Section title="Preview & Definition" icon={<LuPalette className="h-3.5 w-3.5" />} isMep={isMep}>
          <div className="grid grid-cols-[1fr_56px] gap-1.5">
            <div className="flex h-20 items-center justify-center rounded border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Material preview" className="h-16 w-16 object-contain drop-shadow" />
            </div>

            <div className="grid grid-rows-4 gap-0.5">
              {SHAPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setShape(s.id)}
                  className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-semibold border transition-all ${
                    shape === s.id
                      ? `${isMep ? "btn-v-blue" : "btn-v-yellow"} btn-liquid-hover !text-zinc-950 font-bold border-transparent shadow-sm`
                      : "btn-yellow-border-hover border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)]"
                  }`}
                >
                  {s.icon}
                  <span className="truncate">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-[1fr_105px] gap-1.5 pt-1 border-t border-[var(--panel-divider)]/40">
            <label className="text-[9px] text-[var(--text-muted)] block">
              <span className="truncate block mb-0.5">Name:</span>
              <input
                value={selected.name}
                onChange={(e) => patch({ name: e.target.value })}
                className={fieldInputClass}
              />
            </label>
            <div className="text-[9px] text-[var(--text-muted)] block">
              <span className="truncate block mb-0.5">Class:</span>
              <VYellowDropdown
                value={selected.category}
                options={CATEGORIES.slice(1)}
                onChange={(next) => {
                  patch({ ...CLASS_DEFAULTS[next as MaterialDefinition["category"]], category: next as MaterialDefinition["category"] });
                }}
                isMep={isMep}
              />
            </div>
          </div>

          <div className="grid grid-cols-[32px_1fr] items-center gap-1.5 pt-0.5">
            <input
              type="color"
              value={selected.color}
              onChange={(e) => patch({ color: e.target.value })}
              className="h-7 w-8 rounded border border-[var(--panel-divider)] bg-transparent p-0 cursor-pointer"
            />
            <input
              value={selected.color.toUpperCase()}
              readOnly
              className={`${fieldInputClass} font-mono`}
            />
          </div>
        </Section>

        <Section title="PBR Properties" icon={<LuSlidersHorizontal className="h-3.5 w-3.5" />} isMep={isMep}>
          <Slider label="Roughness" value={selected.roughness} onChange={(v) => patch({ roughness: v })} isMep={isMep} />
          <Slider label="Metalness" value={selected.metalness} onChange={(v) => patch({ metalness: v })} isMep={isMep} />
          <Slider label="Opacity" value={selected.opacity} min={0.02} onChange={(v) => patch({ opacity: v })} isMep={isMep} />
          <Slider label="Transmission" value={selected.transmission ?? 0} onChange={(v) => patch({ transmission: v })} isMep={isMep} />
          <Slider label="Clearcoat" value={selected.clearcoat ?? 0} onChange={(v) => patch({ clearcoat: v })} isMep={isMep} />
          <Slider label="IOR" value={selected.ior ?? 1.5} min={1} max={2.5} display={(selected.ior ?? 1.5).toFixed(2)} onChange={(v) => patch({ ior: v })} isMep={isMep} />
          <Slider label="Bump Map" value={selected.bumpScale ?? 0.2} max={2} display={(selected.bumpScale ?? 0.2).toFixed(2)} onChange={(v) => patch({ bumpScale: v })} isMep={isMep} />
        </Section>

        <Section title="Surface Pattern / Poche" icon={<LuLayers className="h-3.5 w-3.5" />} isMep={isMep}>
          <label className="grid grid-cols-[70px_1fr] items-center gap-1 text-[10px] text-[var(--text-body)]">
            <span className="truncate">Pattern:</span>
            <select
              value={selected.hatchStyle}
              onChange={(e) => patch({ hatchStyle: e.target.value as HatchStyle })}
              className={fieldInputClass}
            >
              {HATCHES.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.glyph} {h.label}...
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-[70px_1fr] items-center gap-1 text-[10px] text-[var(--text-body)]">
            <span className="truncate">Live Swatch:</span>
            <div
              className="h-6 rounded border border-[var(--panel-divider)] shadow-inner"
              style={{
                backgroundColor: selected.color,
                backgroundImage: hatchUrl ? `url(${hatchUrl})` : undefined,
                backgroundSize: hatchUrl ? `${sampleSizePx}px ${sampleSizePx}px` : undefined,
              }}
            />
          </div>

          <Slider
            label="Scale (mm)"
            value={selected.hatchScaleMm ?? 200}
            min={25}
            max={2000}
            step={25}
            display={`${selected.hatchScaleMm ?? 200} mm`}
            onChange={(v) => patch({ hatchScaleMm: v })}
            isMep={isMep}
          />
          <Slider
            label="Tiling"
            value={selected.tilingScale ?? 1}
            min={0.1}
            max={10}
            step={0.1}
            display={`${(selected.tilingScale ?? 1).toFixed(1)}×`}
            onChange={(v) => patch({ tilingScale: v })}
            isMep={isMep}
          />
        </Section>

        <div className="sticky bottom-0 grid grid-cols-2 gap-1.5 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-card)] p-1.5 shadow-lg">
          <UnifiedButton
            size="sm"
            variant="secondary"
            disabled={!hasSelection}
            onClick={assign}
            icon={<LuCheck className="h-3.5 w-3.5" />}
            className="w-full text-[10px] font-bold py-1"
          >
            Assign Selected...
          </UnifiedButton>
          <UnifiedButton
            size="sm"
            variant="primary"
            onClick={() => setPaintId(paintId === selected.id ? null : selected.id)}
            icon={<LuSparkles className="h-3.5 w-3.5" />}
            className={`w-full text-[10px] font-bold py-1 ${
              isMep ? "!btn-v-blue" : "!btn-v-yellow"
            } btn-liquid-hover !text-zinc-950`}
          >
            {paintId === selected.id ? "Painting..." : "Paint in View"}
          </UnifiedButton>
        </div>
      </div>

      {duplicatePrompt && (
        <DuplicateOrApplyTypeDialog
          isOpen={duplicatePrompt.isOpen}
          typeName={duplicatePrompt.typeName}
          matchingCount={duplicatePrompt.matchingWallIds.length}
          materialName={duplicatePrompt.materialName}
          onApplyToAll={handleApplyToAll}
          onDuplicate={handleDuplicate}
          onCancel={() => setDuplicatePrompt(null)}
        />
      )}
    </div>
  );
}
