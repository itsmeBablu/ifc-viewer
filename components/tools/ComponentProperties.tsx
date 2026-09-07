"use client";

import { useState } from "react";
import { COMPONENT_CATALOG, componentPreset, isArchitecturalComponent } from "@/lib/componentCatalog";
import type { LayoutMepEquipment } from "@/lib/layoutDrawing";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";

export function ComponentLibrary({ item, onChoose }: { item?: LayoutMepEquipment; onChoose?: () => void }) {
  const store = useLayoutDrawingStore();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const isFurniture = store.armedLayoutTool === "component" ||
    store.draftEquipmentCategory === "furniture" ||
    (item ? (item.category === "furniture" || isArchitecturalComponent(item.familyId)) : !store.mepModeActive);

  const catalog = COMPONENT_CATALOG.filter((p) =>
    isFurniture ? isArchitecturalComponent(p.id) : !isArchitecturalComponent(p.id)
  );

  const categories = ["All", ...new Set(catalog.map((p) => p.room))];

  const filtered = catalog.filter((p) => {
    const matchesCategory = selectedCategory === "All" || p.room === selectedCategory;
    const matchesSearch = !search.trim() || `${p.name} ${p.room}`.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeId = item?.familyId ?? store.draftComponentId;

  return (
    <div className="space-y-2">
      {/* Category Pills */}
      <div className="flex flex-wrap gap-1">
        {categories.map((cat) => (
          <button
            type="button"
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold transition-colors ${
              selectedCategory === cat
                ? "bg-yellow-400 text-black shadow-sm"
                : "border border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <input
          aria-label="Find component"
          placeholder="Filter components…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 w-full rounded border border-[var(--panel-divider)] bg-[var(--surface-card)] px-2 text-[11px] text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:border-yellow-400 focus:outline-none"
        />
      </div>

      {/* Items Scroll Area */}
      <div className="max-h-56 space-y-1 overflow-y-auto pr-0.5 thin-scroll">
        {filtered.map((p) => {
          const isSelected = activeId === p.id;
          return (
            <button
              type="button"
              key={p.id}
              aria-pressed={isSelected}
              onClick={() => {
                if (item) {
                  void store.updateEquipment(item.id, {
                    familyId: p.id,
                    name: p.name,
                    category: p.category,
                    widthMm: p.widthMm,
                    depthMm: p.depthMm,
                    heightMm: p.heightMm,
                  });
                } else {
                  store.chooseComponent(p.id);
                }
                onChoose?.();
              }}
              className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-all ${
                isSelected
                  ? "border-yellow-400/80 bg-yellow-400/15 text-[var(--text-strong)] shadow-sm"
                  : "border-transparent bg-[var(--surface-overlay)]/40 hover:border-[var(--panel-divider)] hover:bg-[var(--surface-overlay)]"
              }`}
            >
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-[11px] font-semibold text-[var(--text-strong)]">
                  {p.name}
                </strong>
                <span className="block text-[9px] font-medium text-[var(--text-muted)]">
                  {p.room}
                </span>
              </div>
              <div className="shrink-0 text-right font-mono text-[9px] text-[var(--text-muted)]">
                <div>{p.widthMm} × {p.depthMm}</div>
                <div>{p.heightMm} mm</div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-4 text-center text-[10px] text-[var(--text-muted)]">
            No matching components found
          </p>
        )}
      </div>
    </div>
  );
}

export default function ComponentProperties({ item }: { item?: LayoutMepEquipment }) {
  const store = useLayoutDrawingStore();
  const markup = useToolMarkupStore();

  const isFurniture = store.armedLayoutTool === "component" ||
    store.draftEquipmentCategory === "furniture" ||
    (item ? (item.category === "furniture" || isArchitecturalComponent(item.familyId)) : !store.mepModeActive);

  // Auto-heal draftComponentId if it's currently an MEP component in furniture mode
  const activeFamilyId = item?.familyId ?? store.draftComponentId;
  if (!item && isFurniture && !isArchitecturalComponent(activeFamilyId)) {
    store.chooseComponent("sofa-3");
  }

  const preset = componentPreset(item?.familyId ?? store.draftComponentId);
  const isPlan = (markup.quadView ? markup.quadPresets[markup.quadActiveIndex] : markup.viewPreset) === "top";
  const currentLevel = store.levels.find((l) => l.id === markup.markupFloorId) ?? store.levels[0];
  const effectiveLevelId = item?.levelId ?? store.componentPlacementLevelId ?? currentLevel?.id ?? store.levels[0]?.id ?? "";

  const field = "h-7 w-full min-w-0 rounded border border-[var(--panel-divider)] bg-[var(--surface-card)] px-1.5 text-[11px] font-semibold text-[var(--text-strong)] focus:border-yellow-400 focus:outline-none";
  const labelCls = "space-y-0.5 text-[10px] font-semibold text-[var(--text-muted)]";

  const update = (patch: Partial<LayoutMepEquipment>) => {
    if (item) void store.updateEquipment(item.id, patch);
  };

  const handleLevelChange = (newLevelId: string) => {
    if (item) {
      update({ levelId: newLevelId });
    } else {
      useLayoutDrawingStore.setState({ componentPlacementLevelId: newLevelId || null });
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Active Component Title & Pill */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-500">
          {item ? "Selected Component" : isFurniture ? "Architectural Furniture" : "MEP Equipment"}
        </span>
        {preset && (
          <span className="rounded bg-yellow-400/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-yellow-600 dark:text-yellow-400">
            {preset.room}
          </span>
        )}
      </div>

      <ComponentLibrary item={item} />

      {/* Geometry and placement properties */}
      <div className="space-y-2 border-t border-[var(--panel-divider)] pt-2.5">
        <label className={labelCls}>
          <span>Base Level</span>
          <select
            aria-label="Component base level"
            className={field}
            value={effectiveLevelId}
            onChange={(e) => handleLevelChange(e.target.value)}
          >
            {store.levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.elevationMm} mm)
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className={labelCls}>
            <span>Width (mm)</span>
            <input
              type="number"
              className={field}
              min={100}
              value={item?.widthMm ?? store.draftComponentWidthMm}
              onChange={(e) => {
                const val = Math.max(100, Number(e.target.value));
                if (item) update({ widthMm: val });
                else useLayoutDrawingStore.setState({ draftComponentWidthMm: val });
              }}
            />
          </label>
          <label className={labelCls}>
            <span>Depth (mm)</span>
            <input
              type="number"
              className={field}
              min={100}
              value={item?.depthMm ?? store.draftComponentDepthMm}
              onChange={(e) => {
                const val = Math.max(100, Number(e.target.value));
                if (item) update({ depthMm: val });
                else useLayoutDrawingStore.setState({ draftComponentDepthMm: val });
              }}
            />
          </label>
          <label className={labelCls}>
            <span>Height (mm)</span>
            <input
              type="number"
              className={field}
              min={100}
              value={item?.heightMm ?? store.draftComponentHeightMm}
              onChange={(e) => {
                const val = Math.max(100, Number(e.target.value));
                if (item) update({ heightMm: val });
                else useLayoutDrawingStore.setState({ draftComponentHeightMm: val });
              }}
            />
          </label>
          <label className={labelCls}>
            <span>Base Offset (mm)</span>
            <input
              type="number"
              className={field}
              value={item?.elevationMm ?? store.draftEquipmentElevationMm}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (item) update({ elevationMm: val });
                else useLayoutDrawingStore.setState({ draftEquipmentElevationMm: val });
              }}
            />
          </label>
          <label className={labelCls}>
            <span>Rotation (°)</span>
            <input
              type="number"
              className={field}
              step={90}
              value={item?.rotationDeg ?? store.draftEquipmentRotationDeg}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (item) update({ rotationDeg: val });
                else store.setDraftEquipmentRotationDeg(val);
              }}
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              className="h-7 w-full rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[10px] font-semibold text-[var(--text-strong)] hover:border-yellow-400 hover:text-yellow-500"
              onClick={() => {
                if (item) {
                  update({ rotationDeg: ((item.rotationDeg ?? 0) + 90) % 360 });
                } else {
                  store.setDraftEquipmentRotationDeg((store.draftEquipmentRotationDeg + 90) % 360);
                }
              }}
            >
              Rotate 90° (Space)
            </button>
          </div>

          {preset?.id.startsWith("kitchen-") && (
            <label className={`${labelCls} col-span-2`}>
              <span>Kitchen Module Width (mm)</span>
              <select
                className={field}
                value={item?.moduleWidthMm ?? store.draftComponentModuleMm}
                onChange={(e) => {
                  const size = Number(e.target.value);
                  if (item) update({ moduleWidthMm: size });
                  else useLayoutDrawingStore.setState({ draftComponentModuleMm: size });
                }}
              >
                {[300, 400, 450, 500, 600, 800, 900].map((size) => (
                  <option key={size} value={size}>
                    {size} mm standard
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {!item && (
          <div className="rounded-md border border-yellow-400/25 bg-yellow-400/10 p-2 text-[10px] text-[var(--text-muted)]">
            <p className="font-semibold text-yellow-600 dark:text-yellow-400">Ready to place</p>
            <p className="mt-0.5">Click in 2D or 3D to place component. Press <kbd className="rounded border border-current px-1 font-mono text-[9px]">Space</kbd> to rotate 90°. Snapping automatically aligns to wall faces and adjacent furniture.</p>
          </div>
        )}

        {item && (
          <div className="flex gap-2 pt-1 text-[10px]">
            <button
              type="button"
              onClick={() => void store.duplicateEquipment(item.id)}
              className="flex-1 rounded border border-[var(--panel-divider)] py-1 font-semibold text-[var(--text-strong)] hover:bg-[var(--surface-overlay)]"
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => void store.deleteEquipment(item.id)}
              className="flex-1 rounded border border-red-500/30 py-1 font-semibold text-red-500 hover:bg-red-500/10"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
