"use client";

import { useState, useEffect } from "react";
import {
  LuArrowLeft,
  LuPlus,
  LuTrash2,
  LuLayers,
  LuSlidersHorizontal,
  LuInfo,
  LuCheck,
  LuPalette,
} from "react-icons/lu";
import type { ElementTypeDefinition } from "./EditTypeDialog";
import type { WallLayer, WallLayerFunction } from "@/lib/layoutDrawing";
import { useMaterialStore } from "@/store/materialStore";
import { useStudioSettingsStore, STUDIO_ACCENTS } from "@/store/useStudioSettingsStore";
import UnifiedButton from "@/components/common/UnifiedButton";

interface EditTypeEmbeddedPanelProps {
  typeDef: ElementTypeDefinition;
  onBack: () => void;
  onSave: (updated: ElementTypeDefinition) => void;
  onOpenMaterialPicker?: (layerIdx: number) => void;
}

export default function EditTypeEmbeddedPanel({
  typeDef,
  onBack,
  onSave,
  onOpenMaterialPicker,
}: EditTypeEmbeddedPanelProps) {
  const [formData, setFormData] = useState<ElementTypeDefinition>({ ...typeDef });
  const [activeTab, setActiveTab] = useState<"layers" | "dimensions" | "materials" | "physics">(
    typeDef.category === "Wall" ? "layers" : "dimensions"
  );
  const [selectedLayerIdx, setSelectedLayerIdx] = useState<number | null>(null);

  const materials = useMaterialStore((s) => s.materials);
  const accent = useStudioSettingsStore((s) => s.accent);
  const syncArchMep = useStudioSettingsStore((s) => s.syncArchMep);
  const isMep = formData.category === "Duct" || formData.category === "Pipe" || formData.category === "CableTray" || formData.category === "Heater" || formData.category === "Cooling" || formData.category === "Equipment";

  const activeAccent = syncArchMep
    ? STUDIO_ACCENTS[accent]
    : isMep
    ? STUDIO_ACCENTS.vblue
    : STUDIO_ACCENTS.vyellow;

  const accentColor = activeAccent.textClass;
  const accentBg = activeAccent.bgClass;

  useEffect(() => {
    setFormData({ ...typeDef });
  }, [typeDef]);

  // Esc key listener to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onBack();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  const handleUpdate = (patch: Partial<ElementTypeDefinition>) => {
    const next = { ...formData, ...patch };
    setFormData(next);
    onSave(next);
  };

  const inputClass =
    "h-7 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-[11px] font-mono text-[var(--text-strong)] focus:outline-none transition-colors";

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs select-none">
      {/* Embedded Header with Back Button */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-[var(--panel-divider)]/60 px-2 bg-[var(--surface-overlay)]/60">
        <button
          type="button"
          onClick={onBack}
          title="Back to Instance Properties (Esc)"
          className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--glass-inset-bg)] transition-colors"
        >
          <LuArrowLeft className="h-3.5 w-3.5" />
          <span>Properties</span>
        </button>

        <span className="font-bold text-[10px] uppercase tracking-wider text-[var(--text-muted)] truncate max-w-[130px]" title={formData.name}>
          Edit: {formData.name}...
        </span>
      </div>

      {/* Segmented Tab Switcher */}
      <div className="px-2 pt-1 pb-1 border-b border-[var(--panel-divider)]/30 bg-[var(--surface-overlay)]/20">
        <div className="flex gap-0.5 p-0.5 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)]">
          {formData.category === "Wall" && (
            <button
              type="button"
              onClick={() => setActiveTab("layers")}
              className={`flex-1 py-1 px-1.5 rounded text-[9px] font-bold transition-all flex items-center justify-center gap-1 truncate ${
                activeTab === "layers"
                  ? `${accentBg} text-zinc-950 shadow-sm`
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              }`}
            >
              <LuLayers className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">Layers...</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("dimensions")}
            className={`flex-1 py-1 px-1.5 rounded text-[9px] font-bold transition-all flex items-center justify-center gap-1 truncate ${
              activeTab === "dimensions"
                ? `${accentBg} text-zinc-950 shadow-sm`
                : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            }`}
          >
            <LuSlidersHorizontal className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">Dimensions...</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("materials")}
            className={`flex-1 py-1 px-1.5 rounded text-[9px] font-bold transition-all flex items-center justify-center gap-1 truncate ${
              activeTab === "materials"
                ? `${accentBg} text-zinc-950 shadow-sm`
                : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            }`}
          >
            <LuPalette className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">Materials...</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("physics")}
            className={`flex-1 py-1 px-1.5 rounded text-[9px] font-bold transition-all flex items-center justify-center gap-1 truncate ${
              activeTab === "physics"
                ? `${accentBg} text-zinc-950 shadow-sm`
                : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            }`}
          >
            <LuInfo className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">Ratings...</span>
          </button>
        </div>
      </div>

      {/* Main Form Body */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 thin-scroll text-xs">
        {/* TAB 1: Layers */}
        {activeTab === "layers" && formData.category === "Wall" && (
          <div className="space-y-1.5">
            {/* Type Name */}
            <div className="rounded-lg border border-[var(--panel-divider)] p-2 bg-[var(--surface-overlay)]/40 space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                Type Name:
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleUpdate({ name: e.target.value })}
                className="w-full h-7 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-[11px] font-semibold text-[var(--text-strong)] focus:outline-none"
              />
            </div>

            {/* Cross-Section Visualizer */}
            <div className="rounded-lg border border-[var(--panel-divider)] p-2 bg-[var(--surface-overlay)]/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Compound ({formData.thicknessMm || 200} mm)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const newLayer: WallLayer = {
                      id: `l-${Date.now()}`,
                      name: "Thermal Insulation",
                      function: "insulation",
                      material: "thermal-insulation",
                      thicknessMm: 50,
                      color: "#fef08a",
                    };
                    const updatedLayers = [...(formData.layers || []), newLayer];
                    const total = updatedLayers.reduce((s, l) => s + l.thicknessMm, 0);
                    handleUpdate({ layers: updatedLayers, thicknessMm: total });
                  }}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded border border-[var(--panel-divider)] text-[9px] font-bold hover:${accentBg} hover:text-zinc-950 transition-all`}
                >
                  <LuPlus className="h-2.5 w-2.5" />
                  <span>Add Layer</span>
                </button>
              </div>

              {/* Cross-section bar */}
              {formData.layers && formData.layers.length > 0 && (
                <div className="relative flex h-5 w-full overflow-hidden rounded border border-[var(--panel-divider)] p-0.5 gap-0.5 bg-[var(--glass-inset-bg)]">
                  {formData.layers.map((l, i) => (
                    <button
                      key={l.id || i}
                      type="button"
                      onClick={() => setSelectedLayerIdx(i)}
                      style={{
                        width: `${(l.thicknessMm / Math.max(1, formData.thicknessMm || 1)) * 100}%`,
                        backgroundColor:
                          l.color ||
                          (l.function === "insulation"
                            ? "#facc15"
                            : l.function === "structure"
                            ? "#64748b"
                            : l.function === "finish1"
                            ? "#f1f5f9"
                            : "#94a3b8"),
                      }}
                      title={`${l.name} (${l.function}): ${l.thicknessMm}mm`}
                      className={`h-full rounded-sm flex items-center justify-center overflow-hidden text-[8px] font-mono text-zinc-950 font-bold transition-all ${
                        selectedLayerIdx === i ? "ring-2 ring-yellow-400 brightness-110" : ""
                      }`}
                    >
                      {l.thicknessMm >= 25 ? `${l.thicknessMm}` : ""}
                    </button>
                  ))}
                </div>
              )}

              {/* Layer Rows */}
              <div className="space-y-1 pt-1">
                {(formData.layers || []).map((layer, idx) => (
                  <div
                    key={layer.id || idx}
                    className={`rounded border p-1.5 space-y-1 transition-all ${
                      selectedLayerIdx === idx
                        ? "border-yellow-400/80 bg-[var(--surface-overlay)]"
                        : "border-[var(--panel-divider)] bg-[var(--surface-overlay)]/60"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <select
                        value={layer.function}
                        onChange={(e) => {
                          const fn = e.target.value as WallLayerFunction;
                          const updated = (formData.layers || []).map((l, i) =>
                            i === idx ? { ...l, function: fn } : l
                          );
                          handleUpdate({ layers: updated });
                        }}
                        className="h-6 rounded border border-[var(--panel-divider)] bg-[var(--surface-card)] px-1 text-[9px] text-[var(--text-strong)] flex-1 min-w-0"
                      >
                        <option value="finish1">Finish 1 (Interior)</option>
                        <option value="substrate">Substrate</option>
                        <option value="structure">Structure Core</option>
                        <option value="core">Core Cavity</option>
                        <option value="insulation">Insulation</option>
                        <option value="finish2">Finish 2 (Exterior)</option>
                      </select>

                      {/* Thickness Input */}
                      <div className="flex items-center rounded border border-[var(--panel-divider)] overflow-hidden h-6 bg-[var(--surface-card)]">
                        <button
                          type="button"
                          onClick={() => {
                            const val = Math.max(5, layer.thicknessMm - 5);
                            const updated = (formData.layers || []).map((l, i) =>
                              i === idx ? { ...l, thicknessMm: val } : l
                            );
                            const total = updated.reduce((s, l) => s + l.thicknessMm, 0);
                            handleUpdate({ layers: updated, thicknessMm: total });
                          }}
                          className="px-1 h-full text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={layer.thicknessMm}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value));
                            const updated = (formData.layers || []).map((l, i) =>
                              i === idx ? { ...l, thicknessMm: val } : l
                            );
                            const total = updated.reduce((s, l) => s + l.thicknessMm, 0);
                            handleUpdate({ layers: updated, thicknessMm: total });
                          }}
                          className={`w-9 bg-transparent text-center font-mono text-[9px] font-bold ${accentColor}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = Math.min(1000, layer.thicknessMm + 5);
                            const updated = (formData.layers || []).map((l, i) =>
                              i === idx ? { ...l, thicknessMm: val } : l
                            );
                            const total = updated.reduce((s, l) => s + l.thicknessMm, 0);
                            handleUpdate({ layers: updated, thicknessMm: total });
                          }}
                          className="px-1 h-full text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                        >
                          +
                        </button>
                      </div>

                      {/* Color */}
                      <input
                        type="color"
                        value={layer.color || "#94a3b8"}
                        onChange={(e) => {
                          const updated = (formData.layers || []).map((l, i) =>
                            i === idx ? { ...l, color: e.target.value } : l
                          );
                          handleUpdate({ layers: updated });
                        }}
                        className="h-6 w-6 rounded border border-[var(--panel-divider)] bg-transparent p-0 cursor-pointer shrink-0"
                      />

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (formData.layers || []).filter((_, i) => i !== idx);
                          const total = updated.reduce((s, l) => s + l.thicknessMm, 0);
                          handleUpdate({ layers: updated, thicknessMm: total });
                        }}
                        className="h-6 w-5 flex items-center justify-center text-zinc-400 hover:text-red-500 shrink-0"
                      >
                        <LuTrash2 className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Material Selector dropdown for this individual layer */}
                    <div className="flex items-center gap-1">
                      <select
                        value={layer.material}
                        onChange={(e) => {
                          const matName = e.target.value;
                          const matDef = materials.find((m) => m.name === matName);
                          const updated = (formData.layers || []).map((l, i) =>
                            i === idx
                              ? {
                                  ...l,
                                  material: matName,
                                  name: matName,
                                  color: matDef?.color || l.color,
                                }
                              : l
                          );
                          handleUpdate({ layers: updated });
                        }}
                        className="w-full h-6 rounded border border-[var(--panel-divider)] bg-[var(--surface-card)] px-1.5 text-[9px] text-[var(--text-strong)] truncate font-semibold"
                      >
                        {materials.map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name} ({m.category})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Dimensions */}
        {activeTab === "dimensions" && (
          <div className="rounded-lg border border-[var(--panel-divider)] p-2 bg-[var(--surface-overlay)]/40 space-y-1.5">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] pb-1 border-b border-[var(--panel-divider)]/40">
              Dimensional Parameters:
            </div>

            {formData.thicknessMm !== undefined && (
              <div className="flex items-center justify-between py-0.5">
                <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[120px]">Thickness:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={formData.thicknessMm}
                    disabled={formData.category === "Wall" && Boolean(formData.layers && formData.layers.length > 0)}
                    onChange={(e) => handleUpdate({ thicknessMm: Number(e.target.value) })}
                    className={`${inputClass} w-16 text-right ${accentColor}`}
                  />
                  <span className="text-[9px] text-[var(--text-muted)] font-mono">mm</span>
                </div>
              </div>
            )}

            {formData.widthMm !== undefined && (
              <div className="flex items-center justify-between py-0.5">
                <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[120px]">Width:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={formData.widthMm}
                    onChange={(e) => handleUpdate({ widthMm: Number(e.target.value) })}
                    className={`${inputClass} w-16 text-right ${accentColor}`}
                  />
                  <span className="text-[9px] text-[var(--text-muted)] font-mono">mm</span>
                </div>
              </div>
            )}

            {formData.heightMm !== undefined && (
              <div className="flex items-center justify-between py-0.5">
                <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[120px]">Height:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={formData.heightMm}
                    onChange={(e) => handleUpdate({ heightMm: Number(e.target.value) })}
                    className={`${inputClass} w-16 text-right ${accentColor}`}
                  />
                  <span className="text-[9px] text-[var(--text-muted)] font-mono">mm</span>
                </div>
              </div>
            )}

            {formData.diameterMm !== undefined && (
              <div className="flex items-center justify-between py-0.5">
                <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[120px]">Diameter (Ø):</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={formData.diameterMm}
                    onChange={(e) => handleUpdate({ diameterMm: Number(e.target.value) })}
                    className={`${inputClass} w-16 text-right ${accentColor}`}
                  />
                  <span className="text-[9px] text-[var(--text-muted)] font-mono">mm</span>
                </div>
              </div>
            )}

            {formData.sillHeightMm !== undefined && (
              <div className="flex items-center justify-between py-0.5">
                <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[120px]">Sill Height:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={formData.sillHeightMm}
                    onChange={(e) => handleUpdate({ sillHeightMm: Number(e.target.value) })}
                    className={`${inputClass} w-16 text-right ${accentColor}`}
                  />
                  <span className="text-[9px] text-[var(--text-muted)] font-mono">mm</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Materials & Class */}
        {activeTab === "materials" && (
          <div className="rounded-lg border border-[var(--panel-divider)] p-2 bg-[var(--surface-overlay)]/40 space-y-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] pb-1 border-b border-[var(--panel-divider)]/40">
              Material & Construction:
            </div>

            <div className="flex items-center justify-between py-0.5">
              <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[90px]">Material:</span>
              <select
                value={formData.material}
                onChange={(e) => handleUpdate({ material: e.target.value })}
                className="h-7 w-40 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-[10px] font-semibold text-[var(--text-strong)] truncate"
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name} ({m.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between py-0.5">
              <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[90px]">Function:</span>
              <select
                value={formData.functionType}
                onChange={(e) => handleUpdate({ functionType: e.target.value as any })}
                className="h-7 w-32 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-[10px] text-[var(--text-strong)]"
              >
                <option value="Interior">Interior</option>
                <option value="Exterior">Exterior</option>
                <option value="Structural">Structural</option>
                <option value="Non-Bearing">Non-Bearing</option>
              </select>
            </div>
          </div>
        )}

        {/* TAB 4: Physics & Ratings */}
        {activeTab === "physics" && (
          <div className="rounded-lg border border-[var(--panel-divider)] p-2 bg-[var(--surface-overlay)]/40 space-y-1.5">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] pb-1 border-b border-[var(--panel-divider)]/40">
              Engineering Ratings:
            </div>

            <div className="flex items-center justify-between py-0.5">
              <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[110px]">Thermal U/K:</span>
              <input
                type="text"
                value={formData.thermalConductivity || "0.35 W/mK"}
                onChange={(e) => handleUpdate({ thermalConductivity: e.target.value })}
                className="h-7 w-28 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-right font-mono text-[10px] text-[var(--text-strong)] truncate"
              />
            </div>

            <div className="flex items-center justify-between py-0.5">
              <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[110px]">Fire Rating:</span>
              <input
                type="text"
                value={formData.fireRating || "F90"}
                onChange={(e) => handleUpdate({ fireRating: e.target.value })}
                className="h-7 w-24 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-right font-mono text-[10px] text-[var(--text-strong)] truncate"
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-end p-2 border-t border-[var(--panel-divider)] bg-[var(--surface-overlay)]/30">
        <UnifiedButton
          size="xs"
          variant="primary"
          onClick={onBack}
          icon={<LuCheck className="h-3 w-3" />}
          className={`${accentBg} !text-zinc-950 font-bold`}
        >
          Apply & Return
        </UnifiedButton>
      </div>
    </div>
  );
}
