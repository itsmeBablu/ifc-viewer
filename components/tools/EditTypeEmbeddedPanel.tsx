"use client";

import { useState, useEffect } from "react";
import { LuArrowLeft, LuPlus, LuTrash2, LuCheck } from "react-icons/lu";
import type { ElementTypeDefinition } from "./EditTypeDialog";
import { DEFAULT_ELEMENT_TYPES } from "./EditTypeDialog";
import type { WallLayer, WallLayerFunction } from "@/lib/layoutDrawing";
import { useMaterialStore } from "@/store/materialStore";
import { useStudioSettingsStore, STUDIO_ACCENTS } from "@/store/useStudioSettingsStore";
import UnifiedButton from "@/components/common/UnifiedButton";

interface EditTypeEmbeddedPanelProps {
  typeDef?: ElementTypeDefinition;
  onBack: () => void;
  onSave: (updated: ElementTypeDefinition) => void;
  onOpenMaterialPicker?: (layerIdx: number) => void;
}

function automaticTypeName(typeDef: ElementTypeDefinition): string {
  const material = typeDef.material?.trim() || "Generic";
  if (typeDef.category === "Wall") {
    return `${typeDef.functionType} - ${material} - ${typeDef.thicknessMm ?? 200} mm`;
  }
  if (typeDef.category === "Door" || typeDef.category === "Window") {
    const style = typeDef.category === "Door" ? "Single Frame Door" : "Single Frame Window";
    return `${style} - ${material} - ${typeDef.widthMm ?? 0} x ${typeDef.heightMm ?? 0} mm`;
  }
  if (typeDef.category === "Floor" || typeDef.category === "Roof") {
    return `${typeDef.functionType} ${typeDef.category} - ${material} - ${typeDef.thicknessMm ?? 200} mm`;
  }
  return typeDef.name;
}

export default function EditTypeEmbeddedPanel({
  typeDef,
  onBack,
  onSave,
  onOpenMaterialPicker,
}: EditTypeEmbeddedPanelProps) {
  const fallbackTypeDef = DEFAULT_ELEMENT_TYPES["wall-300"] || Object.values(DEFAULT_ELEMENT_TYPES)[0];
  const safeTypeDef = typeDef || fallbackTypeDef;

  const [formData, setFormData] = useState<ElementTypeDefinition>({ ...safeTypeDef });
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
    if (typeDef) setFormData({ ...typeDef });
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
    const draft = { ...formData, ...patch };
    const name = patch.name !== undefined ? patch.name : automaticTypeName(draft);
    const next = { ...draft, name };
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

      {/* Main Form Body - Single Unified Panel without sub-tabs */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2.5 thin-scroll text-xs">
        {/* SECTION 1: Type Identity */}
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

        {/* SECTION 2: Compound Layers (for Wall) */}
        {formData.category === "Wall" && (
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
                <span>+ Layer</span>
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
                      <option value="finish1">Finish 1</option>
                      <option value="substrate">Substrate</option>
                      <option value="structure">Structure</option>
                      <option value="core">Core</option>
                      <option value="insulation">Insulation</option>
                      <option value="finish2">Finish 2</option>
                    </select>

                    <div className="flex items-center rounded border border-[var(--panel-divider)] overflow-hidden h-6 bg-[var(--surface-card)]">
                      <input
                        type="number"
                        value={layer.thicknessMm}
                        min={1}
                        max={1000}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value));
                          const updated = (formData.layers || []).map((l, i) =>
                            i === idx ? { ...l, thicknessMm: val } : l
                          );
                          const total = updated.reduce((s, l) => s + l.thicknessMm, 0);
                          handleUpdate({ layers: updated, thicknessMm: total });
                        }}
                        className={`w-10 bg-transparent text-center font-mono text-[9px] font-bold ${accentColor}`}
                      />
                      <span className="text-[8px] text-[var(--text-muted)] font-mono pr-1">mm</span>
                    </div>

                    <input
                      type="color"
                      value={layer.color || "#94a3b8"}
                      onChange={(e) => {
                        const updated = (formData.layers || []).map((l, i) =>
                          i === idx ? { ...l, color: e.target.value } : l
                        );
                        handleUpdate({ layers: updated });
                      }}
                      className="h-6 w-5 rounded border border-[var(--panel-divider)] bg-transparent p-0 cursor-pointer shrink-0"
                      title="Layer Color"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        const updated = (formData.layers || []).filter((_, i) => i !== idx);
                        const total = updated.reduce((s, l) => s + l.thicknessMm, 0);
                        handleUpdate({ layers: updated, thicknessMm: total });
                      }}
                      className="h-6 w-5 rounded flex items-center justify-center text-zinc-400 hover:text-red-500 transition-colors shrink-0"
                      title="Remove Layer"
                    >
                      <LuTrash2 className="h-3 w-3" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={layer.material}
                    onChange={(e) => {
                      const updated = (formData.layers || []).map((l, i) =>
                        i === idx ? { ...l, material: e.target.value, name: e.target.value } : l
                      );
                      handleUpdate({ layers: updated });
                    }}
                    placeholder="Material..."
                    className="w-full h-5 rounded border border-[var(--panel-divider)] bg-[var(--surface-card)] px-1.5 text-[9px] text-[var(--text-strong)] truncate"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 3: Dimensions */}
        <div className="rounded-lg border border-[var(--panel-divider)] p-2 bg-[var(--surface-overlay)]/40 space-y-1">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] pb-0.5 border-b border-[var(--panel-divider)]/40">
            Dimensions:
          </div>

          {formData.thicknessMm !== undefined && (
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[110px]">Thickness:</span>
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
              <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[110px]">Width:</span>
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
              <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[110px]">Height:</span>
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
              <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[110px]">Diameter (Ø):</span>
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
              <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[110px]">Sill Height:</span>
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

        {/* SECTION 4: Materials & Construction */}
        <div className="rounded-lg border border-[var(--panel-divider)] p-2 bg-[var(--surface-overlay)]/40 space-y-1.5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] pb-0.5 border-b border-[var(--panel-divider)]/40">
            Material & Construction:
          </div>

          <div className="flex items-center justify-between py-0.5">
            <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[90px]">Material:</span>
            <select
              value={formData.material}
              onChange={(e) => handleUpdate({ material: e.target.value })}
              className="h-6 w-40 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 text-[10px] font-semibold text-[var(--text-strong)] truncate"
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
              className="h-6 w-32 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1 text-[10px] text-[var(--text-strong)]"
            >
              <option value="Interior">Interior</option>
              <option value="Exterior">Exterior</option>
              <option value="Structural">Structural</option>
              <option value="Non-Bearing">Non-Bearing</option>
            </select>
          </div>
        </div>

        {/* SECTION 5: Ratings & Physics */}
        <div className="rounded-lg border border-[var(--panel-divider)] p-2 bg-[var(--surface-overlay)]/40 space-y-1.5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] pb-0.5 border-b border-[var(--panel-divider)]/40">
            Engineering Ratings:
          </div>

          <div className="flex items-center justify-between py-0.5">
            <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[110px]">Thermal U/K:</span>
            <input
              type="text"
              value={formData.thermalConductivity || "0.18 W/m²K (U)"}
              onChange={(e) => handleUpdate({ thermalConductivity: e.target.value })}
              className="h-6 w-28 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 text-right font-mono text-[10px] text-[var(--text-strong)] truncate"
            />
          </div>

          <div className="flex items-center justify-between py-0.5">
            <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[110px]">Fire Rating:</span>
            <input
              type="text"
              value={formData.fireRating || "F90-A"}
              onChange={(e) => handleUpdate({ fireRating: e.target.value })}
              className="h-6 w-24 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 text-right font-mono text-[10px] text-[var(--text-strong)] truncate"
            />
          </div>
        </div>
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
