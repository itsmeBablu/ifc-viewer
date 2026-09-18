"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { currentAiContext } from "@/lib/ai/execute";
import { DEFAULT_AI_MODEL, type AiModelId } from "@/lib/ai/models";
import { residentialParametersSchema } from "@/lib/ai/modeling/brief";
import {
  residentialCommand,
  suggestResidentialTypes,
  type ResidentialParameters,
  type TypologySuggestion,
} from "@/lib/ai/modeling/allocation";
import { allocateBuilding, polygonArea } from "@/lib/ai/modeling/footprint";
import { allocateResidential } from "@/lib/ai/modeling/allocation";
import { multiApartmentActions } from "@/lib/ai/modeling/multiApartment";
import AiFootprintCanvas from "./AiFootprintCanvas";
import { validateSketches } from "@/lib/ai/modeling/sketch";
import {
  LuRefreshCw,
  LuSparkles,
  LuCheck,
  LuChevronRight,
  LuChevronLeft,
  LuHouse,
  LuTreePine,
  LuMaximize2,
  LuPalette,
  LuFlame,
  LuZap,
  LuWind,
  LuBuilding2,
  LuLayers,
} from "react-icons/lu";

export default function AiBuildingPresets({
  disabled,
  model,
  heightMm,
  thicknessMm,
  onChoose,
  onCreate,
}: {
  disabled: boolean;
  model: AiModelId;
  heightMm: number;
  thicknessMm: number;
  onChoose: (command: string, p: ResidentialParameters) => void;
  onCreate: (command: string, p: ResidentialParameters) => void;
}) {
  // Wizard steps: 1 = Plot, 2 = Typology, 3 = Outdoor & MEP, 4 = Style & Facade, 5 = Result
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [plotArea, setPlotArea] = useState<number>(180);
  const [plotWidth, setPlotWidth] = useState<number | undefined>(undefined);
  const [plotLength, setPlotLength] = useState<number | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [designMessage, setDesignMessage] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  const [manualOverrideOpen, setManualOverrideOpen] = useState(false);

  const [p, setP] = useState<ResidentialParameters>({
    variant: "villa",
    bedrooms: 3,
    bedroomAreaM2: 18,
    furnished: true,
    layoutStyle: "linear",
    cultureStyle: "standard",
    roofStyle: "modern-flat",
    separateKitchen: true,
    ensuiteBathrooms: true,
    garage: "enclosed",
    garageWidthM: 3.5,
    garageDepthM: 6,
    gardenAreaM2: 50,
    layoutSeed: 12345,
    plotAreaM2: 180,
    commonStairs: true,
    lift: true,
    underfloorHeating: false,
    piping: "none",
    ducts: "none",
    electrical: false,
    curtainFacade: false,
  });

  const suggestions = useMemo(() => suggestResidentialTypes(plotArea).map(s => {
    if (s.apartmentFloors) {
      const unit = allocateResidential({ variant: "apartment", bedrooms: s.bedrooms, bedroomAreaM2: 18 }, heightMm, thicknessMm);
      return {
        ...s,
        label: "Apartment building",
        reason: `${s.apartmentFloors ?? 3} floors, 2 homes per floor with shared elevator & common stairs core.`,
        apartmentsPerFloor: 2,
        estimatedAreaM2: Math.ceil(unit.totalAreaM2 * (s.apartmentFloors ?? 3) * 2),
      };
    }
    const shape = s.layoutStyle === "courtyard" ? "u" : s.layoutStyle === "corner" ? "l" : "rectangle";
    const building = allocateBuilding({ variant: s.variant, bedrooms: s.bedrooms, bedroomAreaM2: plotArea < 140 ? 11 : 18, footprint: shape }, heightMm, thicknessMm);
    return { ...s, estimatedAreaM2: Math.ceil(building.allocation.totalAreaM2 + building.extraAreaM2) };
  }), [plotArea, heightMm, thicknessMm]);

  const validate = (next: ResidentialParameters) => {
    if (
      next.apartmentFloors !== undefined ||
      next.apartmentsPerFloor !== undefined ||
      next.bedroomsPerApartment !== undefined
    ) {
      const actions = multiApartmentActions(next, "check", "ground", 0, heightMm, thicknessMm);
      if (actions.length > 4999) throw new Error("This building is too large for a single build batch. Reduce floors or units.");
      return null;
    }
    if (next.sketches) {
      validateSketches(next.sketches);
      const area = next.sketches.reduce((sum, s) => sum + polygonArea(s.points) / 1e6, 0);
      if (next.totalAreaM2 !== undefined && Math.abs(area - next.totalAreaM2) > 0.1) {
        throw new Error(`Drawn floors give ${area.toFixed(1)} m². Update the total or adjust the lines.`);
      }
      return null;
    }
    return allocateBuilding(next, heightMm, thicknessMm);
  };

  let result: ReturnType<typeof allocateBuilding> | null = null;
  let error = "";
  try {
    result = validate(p);
  } catch (e) {
    error = e instanceof Error ? e.message : "Check room sizes.";
  }

  const update = (next: ResidentialParameters) => {
    setGenerationError("");
    setP(next);
    try {
      validate(next);
      onChoose(residentialCommand(next), next);
    } catch {
      onChoose("", next);
    }
  };

  const handleShuffle = async () => {
    if (isRefreshing || disabled) return;
    setIsRefreshing(true);
    setGenerationError("");
    const controller = new AbortController(); requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 240000);
    try {
      const parameters = residentialParametersSchema.parse({ ...p, sketches: undefined });
      const response = await fetch("/api/ai-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          intent: "layout",
          mode: "build",
          model: model === "ollama-local" ? DEFAULT_AI_MODEL : model,
          residential: parameters,
          command: `Apply the layout requirements: ${aiInstruction.trim() || "Suggest a fresh residential layout with practical circulation and daylight."}. Preserve the selected outline and dimensions, and explain what changed.`,
          context: currentAiContext(),
          attachments: [],
          history: aiInstruction.trim() ? [{ role: "user", text: aiInstruction.trim() }] : [],
        }),
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error ?? "Layout generation failed. Please try again.");
      if (resData.kind !== "layout") throw new Error("Gemini did not return a layout. Please try again.");
      const next = residentialParametersSchema.parse(resData.parameters);
      validate(next);
      update(next);
      setDesignMessage(resData.message);
      setStep(5);
    } catch (e) {
      setGenerationError(controller.signal.aborted ? "Layout generation was cancelled or timed out. Your current drawing is preserved." : e instanceof Error && !e.name.includes("Zod") ? e.message : "Choose a complete outline and valid dimensions before generating.");
    } finally {
      clearTimeout(timeout);
      requestRef.current = null;
      setIsRefreshing(false);
    }
  };

  const selectTypology = (sug: TypologySuggestion) => {
    const next: ResidentialParameters = {
      ...p,
      variant: sug.variant,
      bedrooms: sug.bedrooms,
      bedroomAreaM2: plotArea < 140 ? 11 : 18,
      footprint: sug.layoutStyle === "courtyard" ? "u" : sug.layoutStyle === "corner" ? "l" : "rectangle",
      sketches: undefined,
      layoutStyle: sug.layoutStyle ?? p.layoutStyle,
      apartmentFloors: sug.apartmentFloors,
      apartmentsPerFloor: sug.apartmentsPerFloor,
      bedroomsPerApartment: sug.bedroomsPerApartment,
      commonStairs: sug.apartmentFloors ? (p.commonStairs ?? true) : undefined,
      lift: sug.apartmentFloors ? (p.lift ?? true) : undefined,
      totalAreaM2: sug.estimatedAreaM2,
      layoutSeed: ((p.layoutSeed ?? 0) + 7919) % 1000001,
    };
    update(next);
  };

  const isApartmentBuilding = p.variant === "apartment" && (p.apartmentFloors !== undefined || p.apartmentsPerFloor !== undefined);
  const allocation = result?.allocation;

  return (
    <section className="ai-building-presets" aria-label="Smart building generator wizard">
      {/* Step Indicators */}
      <nav className="ai-wizard-nav" aria-label="Wizard Steps">
        {[
          { num: 1, label: "Plot", icon: <LuMaximize2 className="h-3 w-3" /> },
          { num: 2, label: "Typology", icon: <LuHouse className="h-3 w-3" /> },
          { num: 3, label: "Outdoor & MEP", icon: <LuTreePine className="h-3 w-3" /> },
          { num: 4, label: "Style & Facade", icon: <LuPalette className="h-3 w-3" /> },
          { num: 5, label: "Layout & 3D", icon: <LuSparkles className="h-3 w-3" /> },
        ].map((s) => (
          <button
            key={s.num}
            type="button"
            className={`ai-wizard-tab ${step === s.num ? "is-active" : step > s.num ? "is-complete" : ""}`}
            onClick={() => setStep(s.num as 1 | 2 | 3 | 4 | 5)}
            disabled={disabled || isRefreshing}
          >
            <span className="ai-wizard-tab-num">{step > s.num ? <LuCheck /> : s.icon}</span>
            <span className="ai-wizard-tab-label">{s.label}</span>
          </button>
        ))}
      </nav>

      {/* STEP 1: Plot & Site Area */}
      {step === 1 && (
        <div className="ai-wizard-step animate-in fade-in duration-200">
          <div className="ai-wizard-step-header">
            <h4 className="text-sm font-semibold text-[var(--text-strong)] flex items-center gap-1.5">
              <LuMaximize2 className="text-amber-400" /> 1. Enter Plot / Site Area
            </h4>
            <p className="text-xs text-[var(--text-muted)]">
              Enter your site area to compare home concepts. Building footprint, garden and parking must fit within the available space.
            </p>
          </div>

          <div className="ai-area-fields mt-3">
            <label className="w-full">
              <span>Plot / Site Area (m²)</span>
              <input
                aria-label="Plot area"
                type="number"
                min={30}
                max={10000}
                step={5}
                value={plotArea || ""}
                placeholder="e.g. 180"
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setPlotArea(val);
                  update({ ...p, plotAreaM2: val });
                }}
              />
            </label>
          </div>

          {/* Quick preset chips */}
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            <span className="text-[11px] text-[var(--text-muted)]">Quick presets:</span>
            {[
              { label: "80 m² (Compact)", area: 80 },
              { label: "160 m² (Suburban)", area: 160 },
              { label: "280 m² (Villa)", area: 280 },
              { label: "500 m² (Estate)", area: 500 },
              { label: "1000 m² (Apartments)", area: 1000 },
            ].map((chip) => (
              <button
                key={chip.area}
                type="button"
                className={`text-[11px] px-2 py-0.5 rounded-full border border-[var(--panel-divider)] hover:border-amber-400 transition-colors ${
                  plotArea === chip.area ? "bg-amber-500/20 text-amber-300 font-semibold border-amber-400" : ""
                }`}
                onClick={() => {
                  setPlotArea(chip.area);
                  update({ ...p, plotAreaM2: chip.area });
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Optional Site Dimensions */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[var(--panel-divider)]">
            <label className="text-xs">
              <span className="text-[var(--text-muted)]">Site Width (optional · m)</span>
              <input
                type="number"
                min={4}
                max={100}
                step={0.5}
                value={plotWidth || ""}
                placeholder="Auto"
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : undefined;
                  setPlotWidth(val);
                  update({ ...p, plotWidthM: val });
                }}
              />
            </label>
            <label className="text-xs">
              <span className="text-[var(--text-muted)]">Site Length (optional · m)</span>
              <input
                type="number"
                min={4}
                max={100}
                step={0.5}
                value={plotLength || ""}
                placeholder="Auto"
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : undefined;
                  setPlotLength(val);
                  update({ ...p, plotLengthM: val });
                }}
              />
            </label>
          </div>

          <div className="ai-wizard-step-footer mt-4 flex justify-end">
            <button
              type="button"
              className="ai-create-layout flex items-center gap-1 text-xs"
              onClick={() => setStep(2)}
              disabled={plotArea < 30}
            >
              Continue to Typologies <LuChevronRight />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Realistic Typology Suggestions */}
      {step === 2 && (
        <div className="ai-wizard-step animate-in fade-in duration-200">
          <div className="ai-wizard-step-header">
            <h4 className="text-sm font-semibold text-[var(--text-strong)] flex items-center gap-1.5">
              <LuHouse className="text-amber-400" /> 2. Building Typology & Multi-Floor Units
            </h4>
            <p className="text-xs text-[var(--text-muted)]">
              Compare single-family homes or multi-floor apartment blocks with common stairs and lift:
            </p>
          </div>

          <div className="ai-typology-cards mt-3 flex flex-col gap-2">
            {suggestions.map((sug, i) => {
              const isSelected =
                p.variant === sug.variant &&
                p.bedrooms === sug.bedrooms &&
                (sug.apartmentFloors === undefined || p.apartmentFloors === sug.apartmentFloors);
              return (
                <button
                  key={i}
                  type="button"
                  className={`ai-typology-card text-left p-2.5 rounded-xl border transition-all ${
                    isSelected
                      ? "border-amber-400 bg-amber-500/10 shadow-sm"
                      : "border-[var(--panel-divider)] hover:border-slate-400/50 bg-slate-800/30"
                  }`}
                  onClick={() => selectTypology(sug)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-[var(--text-strong)] flex items-center gap-1.5">
                      {sug.apartmentFloors ? <LuBuilding2 className="text-sky-400" /> : <LuHouse />}
                      {sug.label}
                      {isSelected && <LuCheck className="text-amber-400 h-3.5 w-3.5" />}
                    </span>
                    <span className="text-[11px] font-mono text-amber-400/90">
                      ~{sug.estimatedAreaM2} m²
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">{sug.reason}</p>
                </button>
              );
            })}
          </div>

          {/* Multi-Floor Apartment Specific Controls */}
          {isApartmentBuilding && (
            <div className="mt-3 p-3 bg-sky-950/30 border border-sky-500/30 rounded-xl">
              <h5 className="text-xs font-bold text-sky-300 flex items-center gap-1.5 mb-2">
                <LuLayers className="text-sky-400" /> Multi-Floor Apartment Options
              </h5>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs">
                  <span className="text-[var(--text-muted)]">Floors (1–12)</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={p.apartmentFloors ?? 3}
                    onChange={(e) => update({ ...p, apartmentFloors: Math.min(12, Math.max(1, Number(e.target.value) || 1)) })}
                  />
                </label>
                <label className="text-xs">
                  <span className="text-[var(--text-muted)]">Units / Floor (2–10)</span>
                  <input
                    type="number"
                    min={2}
                    max={10}
                    value={p.apartmentsPerFloor ?? 2}
                    onChange={(e) => update({ ...p, apartmentsPerFloor: Math.min(10, Math.max(2, Number(e.target.value) || 2)) })}
                  />
                </label>
                <label className="text-xs">
                  <span className="text-[var(--text-muted)]">Beds / Unit (1–3)</span>
                  <select
                    value={p.bedroomsPerApartment ?? p.bedrooms ?? 2}
                    onChange={(e) => update({ ...p, bedrooms: Number(e.target.value) || 2, bedroomsPerApartment: Number(e.target.value) as 1 | 2 | 3 })}
                  >
                    <option value={1}>1 Bedroom</option>
                    <option value={2}>2 Bedrooms</option>
                    <option value={3}>3 Bedrooms</option>
                  </select>
                </label>
              </div>

              {/* Vertical Circulation Toggles */}
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-sky-500/20">
                <label className="flex items-center gap-2 text-xs text-[var(--text-strong)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={p.commonStairs !== false}
                    onChange={(e) => update({ ...p, commonStairs: e.target.checked })}
                  />
                  <span>🪜 Common Staircase Core</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-[var(--text-strong)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={p.lift !== false}
                    onChange={(e) => update({ ...p, lift: e.target.checked })}
                  />
                  <span>🏢 Shared Passenger Lift</span>
                </label>
              </div>
            </div>
          )}

          {/* Manual override expander */}
          <div className="mt-3 pt-2 border-t border-[var(--panel-divider)]">
            <button
              type="button"
              className="text-[11px] text-amber-400/90 underline hover:text-amber-300 transition-colors"
              onClick={() => setManualOverrideOpen(!manualOverrideOpen)}
            >
              {manualOverrideOpen ? "Hide custom parameters" : "Custom building override (bedrooms, area, multi-floor) ▾"}
            </button>
            {manualOverrideOpen && (
              <div className="ai-area-fields mt-2 p-2 bg-slate-900/40 rounded-lg border border-[var(--panel-divider)]">
                <label>
                  <span>Building Type</span>
                  <select
                    value={p.apartmentFloors ? "apartment_block" : p.variant}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "apartment_block") {
                        update({ ...p, variant: "apartment", apartmentFloors: 3, apartmentsPerFloor: 2, bedroomsPerApartment: 2, commonStairs: true, lift: true });
                      } else {
                        update({ ...p, variant: val as any, apartmentFloors: undefined, apartmentsPerFloor: undefined, bedroomsPerApartment: undefined });
                      }
                    }}
                  >
                    <option value="villa">Single-storey Villa</option>
                    <option value="duplex">Two-storey Duplex</option>
                    <option value="apartment">Single Apartment Unit</option>
                    <option value="apartment_block">Multi-Floor Apartment Block</option>
                  </select>
                </label>
                <label>
                  <span>Bedrooms</span>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={p.bedrooms}
                    onChange={(e) => update({ ...p, bedrooms: Number(e.target.value) || 1 })}
                  />
                </label>
                <label>
                  <span>Total Target Area (m²)</span>
                  <input
                    type="number"
                    min={30}
                    max={20000}
                    value={p.totalAreaM2 || ""}
                    placeholder="Auto"
                    onChange={(e) =>
                      update({ ...p, totalAreaM2: e.target.value ? Number(e.target.value) : undefined })
                    }
                  />
                </label>
              </div>
            )}
          </div>

          <div className="ai-wizard-step-footer mt-4 flex items-center justify-between">
            <button
              type="button"
              className="ai-secondary-button flex items-center gap-1 text-xs"
              onClick={() => setStep(1)}
            >
              <LuChevronLeft /> Back
            </button>
            <button
              type="button"
              className="ai-create-layout flex items-center gap-1 text-xs"
              onClick={() => setStep(3)}
            >
              Outdoor & MEP <LuChevronRight />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Outdoor Features & MEP Services */}
      {step === 3 && (
        <div className="ai-wizard-step animate-in fade-in duration-200">
          <div className="ai-wizard-step-header">
            <h4 className="text-sm font-semibold text-[var(--text-strong)] flex items-center gap-1.5">
              <LuTreePine className="text-emerald-400" /> 3. Outdoor & Building MEP Systems
            </h4>
            <p className="text-xs text-[var(--text-muted)]">
              Configure HVAC ventilation ducts, underfloor heating, domestic piping, electrical fixtures, parking and garden:
            </p>
          </div>

          <div className="flex flex-col gap-3 mt-3">
            {/* MEP Building Services Section */}
            <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5">
              <h5 className="text-xs font-bold text-amber-300 flex items-center gap-1.5 mb-2">
                <LuFlame className="text-amber-400" /> Building MEP Systems
              </h5>
              <div className="grid grid-cols-2 gap-2">
                {/* Underfloor Heating */}
                <button
                  type="button"
                  className={`text-xs p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${
                    p.underfloorHeating
                      ? "border-amber-400 bg-amber-500/20 text-amber-200 font-semibold"
                      : "border-[var(--panel-divider)] bg-slate-800/40 text-[var(--text-muted)]"
                  }`}
                  onClick={() => update({ ...p, underfloorHeating: !p.underfloorHeating })}
                >
                  <span className="flex items-center gap-1.5">
                    <LuFlame className={p.underfloorHeating ? "text-amber-400" : ""} /> Underfloor Heating
                  </span>
                  {p.underfloorHeating && <LuCheck className="h-3.5 w-3.5 text-amber-400" />}
                </button>

                {/* Electrical Fixtures */}
                <button
                  type="button"
                  className={`text-xs p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${
                    p.electrical
                      ? "border-amber-400 bg-amber-500/20 text-amber-200 font-semibold"
                      : "border-[var(--panel-divider)] bg-slate-800/40 text-[var(--text-muted)]"
                  }`}
                  onClick={() => update({ ...p, electrical: !p.electrical })}
                >
                  <span className="flex items-center gap-1.5">
                    <LuZap className={p.electrical ? "text-amber-400" : ""} /> Electrical & Lights
                  </span>
                  {p.electrical && <LuCheck className="h-3.5 w-3.5 text-amber-400" />}
                </button>

                {/* Domestic Piping */}
                <div className="p-1.5 rounded-lg border border-[var(--panel-divider)] bg-slate-800/40">
                  <span className="text-[10px] text-[var(--text-muted)] block mb-1">Water Piping</span>
                  <div className="grid grid-cols-3 gap-1">
                    {(["none", "underfloor", "ceiling"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`text-[10px] py-1 rounded border text-center transition-colors capitalize ${
                          (p.piping ?? "none") === mode
                            ? "border-sky-400 bg-sky-500/20 text-sky-200 font-semibold"
                            : "border-transparent text-[var(--text-muted)]"
                        }`}
                        onClick={() => update({ ...p, piping: mode })}
                      >
                        {mode === "none" ? "None" : mode === "underfloor" ? "Floor" : "Ceiling"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ventilation Ducts */}
                <div className="p-1.5 rounded-lg border border-[var(--panel-divider)] bg-slate-800/40">
                  <span className="text-[10px] text-[var(--text-muted)] block mb-1">Ventilation Ducts</span>
                  <div className="grid grid-cols-2 gap-1">
                    {(["none", "ceiling"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`text-[10px] py-1 rounded border text-center transition-colors ${
                          (p.ducts ?? "none") === mode
                            ? "border-teal-400 bg-teal-500/20 text-teal-200 font-semibold"
                            : "border-transparent text-[var(--text-muted)]"
                        }`}
                        onClick={() => update({ ...p, ducts: mode })}
                      >
                        {mode === "none" ? "None" : "Ceiling HVAC"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Garage */}
            <div className="p-2.5 rounded-xl border border-[var(--panel-divider)] bg-slate-800/30">
              <label className="text-xs font-semibold text-[var(--text-strong)] block mb-1.5">
                Garage / Parking
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "none", label: "No Garage" },
                  { id: "open", label: "Open Carport" },
                  { id: "enclosed", label: "Enclosed Garage" },
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`text-xs p-1.5 rounded-lg border text-center transition-colors ${
                      p.garage === g.id
                        ? "border-amber-400 bg-amber-500/15 text-amber-300 font-medium"
                        : "border-[var(--panel-divider)] hover:border-slate-400/40"
                    }`}
                    onClick={() => update({ ...p, garage: g.id as any })}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Garden */}
            <div className="p-2.5 rounded-xl border border-[var(--panel-divider)] bg-slate-800/30">
              <label className="text-xs font-semibold text-[var(--text-strong)] block mb-1.5">
                Private Garden Area
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: "None", area: 0 },
                  { label: "30 m²", area: 30 },
                  { label: "60 m²", area: 60 },
                  { label: "100 m²", area: 100 },
                ].map((g) => (
                  <button
                    key={g.area}
                    type="button"
                    className={`text-xs p-1.5 rounded-lg border text-center transition-colors ${
                      p.gardenAreaM2 === g.area
                        ? "border-emerald-400 bg-emerald-500/15 text-emerald-300 font-medium"
                        : "border-[var(--panel-divider)] hover:border-slate-400/40"
                    }`}
                    onClick={() => update({ ...p, gardenAreaM2: g.area })}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Balcony / Terrace */}
            <div className="p-2.5 rounded-xl border border-[var(--panel-divider)] bg-slate-800/30">
              <label className="text-xs font-semibold text-[var(--text-strong)] block mb-1.5">
                Balcony & Terraces
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "none", label: "No Balcony" },
                  { id: "front", label: "Front Balcony" },
                  { id: "terrace", label: "Garden Terrace" },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`text-xs p-1.5 rounded-lg border text-center transition-colors ${
                      p.balcony === b.id || (!p.balcony && b.id === "front")
                        ? "border-sky-400 bg-sky-500/15 text-sky-300 font-medium"
                        : "border-[var(--panel-divider)] hover:border-slate-400/40"
                    }`}
                    onClick={() => update({ ...p, balcony: b.id as any })}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="ai-wizard-step-footer mt-4 flex items-center justify-between">
            <button
              type="button"
              className="ai-secondary-button flex items-center gap-1 text-xs"
              onClick={() => setStep(2)}
            >
              <LuChevronLeft /> Back
            </button>
            <button
              type="button"
              className="ai-create-layout flex items-center gap-1 text-xs"
              onClick={() => setStep(4)}
            >
              Style & Facade <LuChevronRight />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Architectural Style & Facade (Fassade) */}
      {step === 4 && (
        <div className="ai-wizard-step animate-in fade-in duration-200">
          <div className="ai-wizard-step-header">
            <h4 className="text-sm font-semibold text-[var(--text-strong)] flex items-center gap-1.5">
              <LuPalette className="text-violet-400" /> 4. Architectural Style & Facade (Fassade)
            </h4>
            <p className="text-xs text-[var(--text-muted)]">
              Choose exterior envelope finishes, glazed curtain facades, and roof architecture:
            </p>
          </div>

          {/* Facade & Glazing Section */}
          <div className="p-2.5 rounded-xl border border-sky-500/30 bg-sky-500/5 mt-3">
            <h5 className="text-xs font-bold text-sky-300 flex items-center gap-1.5 mb-2">
              <LuPalette className="text-sky-400" /> Exterior Facade & Openings
            </h5>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`text-xs p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${
                  p.curtainFacade
                    ? "border-sky-400 bg-sky-500/20 text-sky-200 font-semibold"
                    : "border-[var(--panel-divider)] bg-slate-800/40 text-[var(--text-muted)]"
                }`}
                onClick={() => update({ ...p, curtainFacade: !p.curtainFacade })}
              >
                <span>🪟 Glazed Curtain Facade</span>
                {p.curtainFacade && <LuCheck className="h-3.5 w-3.5 text-sky-400" />}
              </button>

              <button
                type="button"
                className={`text-xs p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${
                  p.doubleEntranceDoor
                    ? "border-sky-400 bg-sky-500/20 text-sky-200 font-semibold"
                    : "border-[var(--panel-divider)] bg-slate-800/40 text-[var(--text-muted)]"
                }`}
                onClick={() => update({ ...p, doubleEntranceDoor: !p.doubleEntranceDoor })}
              >
                <span>🚪 Double Entrance Door</span>
                {p.doubleEntranceDoor && <LuCheck className="h-3.5 w-3.5 text-sky-400" />}
              </button>
            </div>
          </div>

          {/* Preset Styles */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[
              {
                id: "german",
                title: "German Passivhaus",
                desc: "Rational thermal envelope, compact service core & gable/hip roof",
                layoutStyle: "linear",
                cultureStyle: "german",
                roofStyle: "german-gable",
              },
              {
                id: "italian",
                title: "Italian / Mediterranean",
                desc: "Patio courtyard, open-air loggia & terracotta roof finishes",
                layoutStyle: "courtyard",
                cultureStyle: "standard",
                roofStyle: "german-hip",
              },
              {
                id: "luxury",
                title: "Modern Luxury Glazed",
                desc: "Glazed curtain walls, private master suite & open living pavilion",
                layoutStyle: "split",
                cultureStyle: "standard",
                roofStyle: "modern-flat",
                curtainFacade: true,
              },
              {
                id: "courtyard",
                title: "Courtyard Villa",
                desc: "U-shaped plan wrapping a private landscaped atrium",
                layoutStyle: "courtyard",
                cultureStyle: "standard",
                roofStyle: "modern-flat",
              },
            ].map((style) => {
              const isSelected = p.layoutStyle === style.layoutStyle && p.roofStyle === style.roofStyle && p.cultureStyle === style.cultureStyle;
              return (
                <button
                  key={style.id}
                  type="button"
                  className={`text-left p-2.5 rounded-xl border transition-all ${
                    isSelected
                      ? "border-amber-400 bg-amber-500/15 text-amber-300 shadow-sm"
                      : "border-[var(--panel-divider)] hover:border-slate-400/40 bg-slate-800/30"
                  }`}
                  onClick={() => {
                    update({
                      ...p,
                      layoutStyle: style.layoutStyle as any,
                      cultureStyle: style.cultureStyle as any,
                      roofStyle: style.roofStyle as any,
                      curtainFacade: style.curtainFacade ?? p.curtainFacade,
                      footprint: style.layoutStyle === "courtyard" ? "u" : "rectangle",
                      sketches: undefined,
                      totalAreaM2: undefined,
                    });
                  }}
                >
                  <span className="font-semibold text-xs block mb-1">{style.title}</span>
                  <span className="text-[11px] text-[var(--text-muted)] block leading-snug">
                    {style.desc}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="ai-wizard-step-footer mt-4 flex items-center justify-between">
            <button
              type="button"
              className="ai-secondary-button flex items-center gap-1 text-xs"
              onClick={() => setStep(3)}
            >
              <LuChevronLeft /> Back
            </button>
            <button
              type="button"
              className="ai-create-layout flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
              disabled={disabled || isRefreshing || !!error}
              onClick={() => { setStep(5); void handleShuffle(); }}
            >
              Generate Layout Plan <LuSparkles />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Layout Result & Generation */}
      {step === 5 && (
        <div className="ai-wizard-step animate-in fade-in duration-200">
          <div className="ai-wizard-step-header flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-[var(--text-strong)] flex items-center gap-1.5">
                <LuSparkles className="text-amber-400" /> 5. Generated Floor Plan Layout
              </h4>
              <p className="text-xs text-[var(--text-muted)]">
                {isApartmentBuilding ? `${p.apartmentFloors} Floors · ${p.apartmentsPerFloor} Homes/Floor · ${p.bedroomsPerApartment ?? 2} Beds` : `${p.bedrooms} Bedrooms · ${p.variant}`}
                {allocation ? ` · ~${Math.round(allocation.totalAreaM2 + (result?.extraAreaM2 ?? 0))} m²` : ""}
              </p>
            </div>
            <button
              type="button"
              className="text-[11px] text-amber-400/90 underline"
              onClick={() => setStep(1)}
            >
              Adjust inputs ↩
            </button>
          </div>

          {/* Interactive 2D Layout Canvas */}
          <div className="mt-3 relative">
            <AiFootprintCanvas parameters={p} onChange={update} disabled={disabled || isRefreshing} building={result} heightMm={heightMm} thicknessMm={thicknessMm} />
          </div>
          <label className="ai-home-preferences mt-3">
            <span>Tell Gemini what to change</span>
            <textarea
              rows={2}
              maxLength={1500}
              value={aiInstruction}
              disabled={disabled || isRefreshing}
              placeholder="e.g. Add 3 floors with stairs and lift, separate kitchen, and underfloor heating."
              onChange={e => setAiInstruction(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleShuffle(); } }}
            />
          </label>

          {/* Active Services & Feature Badges */}
          <div className="flex flex-wrap gap-1 mt-2">
            {p.curtainFacade && <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-medium">🪟 Curtain Facade</span>}
            {p.underfloorHeating && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium">♨️ Underfloor Heating</span>}
            {p.piping && p.piping !== "none" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">🚰 {p.piping} Piping</span>}
            {p.ducts && p.ducts !== "none" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-medium">💨 Ceiling Ducts</span>}
            {p.electrical && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 font-medium">⚡ Electrical Sockets</span>}
            {isApartmentBuilding && p.commonStairs !== false && <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">🪜 Common Stairs</span>}
            {isApartmentBuilding && p.lift !== false && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">🏢 Shared Lift</span>}
          </div>

          {/* Room Area Summary */}
          {allocation && (
            <div className="ai-area-summary mt-3 p-2.5 bg-slate-900/60 rounded-xl border border-[var(--panel-divider)]">
              <strong className="text-xs text-[var(--text-strong)] block mb-1">
                {Number((allocation.totalAreaM2 + (result?.extraAreaM2 ?? 0)).toFixed(1))} m² Total Internal Area · {allocation.floors} Floor{allocation.floors > 1 ? "s" : ""}
              </strong>
              <div className="grid grid-cols-4 gap-1 text-[11px] text-[var(--text-muted)]">
                <div>🛏️ Beds: {Number(allocation.bedroomTotalM2.toFixed(1))} m²</div>
                <div>🛋️ Living: {Number(allocation.livingTotalM2.toFixed(1))} m²</div>
                <div>🍳 Kitchen: {Number(allocation.kitchenTotalM2.toFixed(1))} m²</div>
                <div>🚿 Baths: {Number(allocation.bathroomTotalM2.toFixed(1))} m²</div>
              </div>
            </div>
          )}

          <details className="ai-layout-requirements mt-3">
            <summary>Adjust rooms, bathrooms and building dimensions</summary>
            <div className="ai-area-fields mt-2">
              {([['Bedroom area', 'bedroomAreaM2', 11], ['Living area', 'livingAreaM2', 10], ['Kitchen area', 'kitchenAreaM2', 6], ['Bathroom area', 'bathroomAreaM2', 4], ['Building width (m)', 'widthM', 4], ['Building length (m)', 'lengthM', 4]] as const).map(([label, key, min]) => (
                <label key={key}>
                  <span>{label}{key.endsWith('M2') ? ' (m²)' : ''}</span>
                  <input
                    type="number"
                    min={min}
                    step={0.5}
                    disabled={disabled || isRefreshing}
                    value={p[key] ?? ''}
                    placeholder="Automatic"
                    onChange={e => update({ ...p, [key]: e.target.value ? Number(e.target.value) : undefined, sketches: undefined })}
                  />
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <input type="checkbox" checked={p.furnished !== false} disabled={disabled || isRefreshing} onChange={e => update({ ...p, furnished: e.target.checked })} /> Furnished
              </label>
              <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <input type="checkbox" checked={p.separateKitchen !== false} disabled={disabled || isRefreshing} onChange={e => update({ ...p, separateKitchen: e.target.checked, sketches: undefined })} /> Separate kitchen room
              </label>
              <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <input type="checkbox" checked={p.ensuiteBathrooms !== false} disabled={disabled || isRefreshing} onChange={e => update({ ...p, ensuiteBathrooms: e.target.checked })} /> Ensuite master bath
              </label>
              <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <input type="checkbox" checked={p.guestBathroom === true} disabled={disabled || isRefreshing} onChange={e => update({ ...p, guestBathroom: e.target.checked })} /> Separate guest WC
              </label>
            </div>
          </details>
          {result && (result.allocation.totalAreaM2 + result.extraAreaM2) / result.allocation.floors + (p.gardenAreaM2 ?? 0) + (p.garage === 'none' ? 0 : (p.garageWidthM ?? 3.5) * (p.garageDepthM ?? 6)) > plotArea && <p className="ai-design-recommendation">This concept plus garden and parking exceeds your site area. Try a compact rectangle, fewer bedrooms, or a duplex with a smaller footprint.</p>}
          {error && <><p role="alert" className="ai-error mt-2">{error}</p><button type="button" className="ai-secondary-button" disabled={disabled || isRefreshing} onClick={() => update({ ...p, totalAreaM2: undefined, widthM: undefined, lengthM: undefined })}>Suggest dimensions that fit these rooms</button></>}
          {designMessage && <p className="ai-design-recommendation">{designMessage}</p>}
          {isRefreshing && <div className="ai-thinking" role="status" aria-live="polite"><LuSparkles className="animate-pulse" /><span>Gemini is planning your rooms and checking the outline…</span><button type="button" onClick={() => requestRef.current?.abort()}>Cancel</button></div>}

          {/* ACTION BUTTONS: Refresh vs Create vs Back */}
          <div className="ai-layout-actions mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              className="ai-secondary-button flex items-center gap-1.5 px-3 py-2 text-xs font-semibold"
              disabled={disabled || isRefreshing || !!error}
              onClick={handleShuffle}
              title="Generate a different valid room layout for these exact same inputs"
            >
              <LuRefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-amber-400" : ""}`} />
              <span>{isRefreshing ? "Regenerating…" : "Refresh / Shuffle Layout"}</span>
            </button>

            <button
              type="button"
              className="ai-create-layout flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-md transition-all active:scale-95"
              disabled={disabled || isRefreshing || !!error || (p.bedroomAreaM2 ?? 20) < 11}
              onClick={() => onCreate(residentialCommand(p), p)}
            >
              <LuSparkles className="h-3.5 w-3.5" />
              <span>Create this layout in 3D</span>
            </button>
          </div>
        </div>
      )}
      {generationError && <p role="alert" className="ai-error">{generationError}</p>}
    </section>
  );
}
