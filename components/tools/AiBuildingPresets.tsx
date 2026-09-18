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
  // Wizard steps: 1 = Plot, 2 = Typology, 3 = Outdoor, 4 = Style, 5 = Result
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [plotArea, setPlotArea] = useState<number>(180);
  const [plotWidth, setPlotWidth] = useState<number | undefined>(undefined);
  const [plotLength, setPlotLength] = useState<number | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [designMessage, setDesignMessage] = useState("");
  const [generationError, setGenerationError] = useState("");
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
  });

  const suggestions = useMemo(() => suggestResidentialTypes(plotArea).map(s => {
    if (s.apartmentFloors) {
      const unit = allocateResidential({ variant: "apartment", bedrooms: s.bedrooms, bedroomAreaM2: 18 }, heightMm, thicknessMm);
      return { ...s, label: "Small apartment building", reason: "3 floors, 2 homes per floor; compare family homes with a rental building.", apartmentsPerFloor: 2, estimatedAreaM2: Math.ceil(unit.totalAreaM2 * 6) };
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
      if (actions.length > 399) throw new Error("This building needs more than one AI batch. Start with fewer floors or homes per floor.");
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
      const response = await fetch("/api/ai-command", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ intent: "layout", mode: "build", model: model === "ollama-local" ? DEFAULT_AI_MODEL : model, residential: parameters, command: "Suggest a fresh residential layout for these requirements. Explain the best room arrangement and useful alternatives, preserving the selected outline and dimensions.", context: currentAiContext(), attachments: [], history: [] }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Layout generation failed. Please try again.");
      if (result.kind !== "layout") throw new Error("Gemini did not return a layout. Please try again.");
      const next = residentialParametersSchema.parse(result.parameters);
      validate(next);
      update(next); setDesignMessage(result.message); setStep(5);
    } catch (e) { setGenerationError(controller.signal.aborted ? "Layout generation was cancelled or timed out. Your current drawing is preserved." : e instanceof Error && !e.name.includes("Zod") ? e.message : "Choose a complete outline and valid dimensions before generating."); }
    finally { clearTimeout(timeout); requestRef.current = null; setIsRefreshing(false); }
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
      totalAreaM2: sug.estimatedAreaM2,
      layoutSeed: ((p.layoutSeed ?? 0) + 7919) % 1000001,
    };
    update(next);
  };

  const allocation = result?.allocation;

  return (
    <section className="ai-building-presets" aria-label="Smart building generator wizard">
      {/* Step Indicators */}
      <nav className="ai-wizard-nav" aria-label="Wizard Steps">
        {[
          { num: 1, label: "Plot", icon: <LuMaximize2 className="h-3 w-3" /> },
          { num: 2, label: "Typology", icon: <LuHouse className="h-3 w-3" /> },
          { num: 3, label: "Outdoor", icon: <LuTreePine className="h-3 w-3" /> },
          { num: 4, label: "Style", icon: <LuPalette className="h-3 w-3" /> },
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
              <LuHouse className="text-amber-400" /> 2. Realistic Typology for {plotArea} m² Site
            </h4>
            <p className="text-xs text-[var(--text-muted)]">
              Compare concept homes for your site. Areas below use room sizes that the layout generator can build.
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

          {/* Manual override expander */}
          <div className="mt-3 pt-2 border-t border-[var(--panel-divider)]">
            <button
              type="button"
              className="text-[11px] text-amber-400/90 underline hover:text-amber-300 transition-colors"
              onClick={() => setManualOverrideOpen(!manualOverrideOpen)}
            >
              {manualOverrideOpen ? "Hide custom room override" : "Custom override (bedrooms, area, multi-storey) ▾"}
            </button>
            {manualOverrideOpen && (
              <div className="ai-area-fields mt-2 p-2 bg-slate-900/40 rounded-lg border border-[var(--panel-divider)]">
                <label>
                  <span>Building Type</span>
                  <select
                    value={p.variant}
                    onChange={(e) => update({ ...p, variant: e.target.value as any })}
                  >
                    <option value="villa">Single-storey Villa</option>
                    <option value="duplex">Two-storey Duplex</option>
                    <option value="apartment">Apartment</option>
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
                    max={2000}
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
              Outdoor Features <LuChevronRight />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Outdoor Features */}
      {step === 3 && (
        <div className="ai-wizard-step animate-in fade-in duration-200">
          <div className="ai-wizard-step-header">
            <h4 className="text-sm font-semibold text-[var(--text-strong)] flex items-center gap-1.5">
              <LuTreePine className="text-emerald-400" /> 3. Outdoor Features
            </h4>
            <p className="text-xs text-[var(--text-muted)]">
              Choose parking, private garden area, and terrace/balcony features:
            </p>
          </div>

          <div className="flex flex-col gap-3 mt-3">
            {/* Garage */}
            <div className="p-2.5 rounded-xl border border-[var(--panel-divider)] bg-slate-800/30">
              <label className="text-xs font-semibold text-[var(--text-strong)] block mb-1.5">
                Garage / Parking
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "none", label: "No Garage" },
                  { id: "open", label: "Open Carport (1 Car)" },
                  { id: "enclosed", label: "Enclosed Garage (1 Car)" },
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`text-xs p-2 rounded-lg border text-left transition-colors ${
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
              Architectural Style <LuChevronRight />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Architectural Style */}
      {step === 4 && (
        <div className="ai-wizard-step animate-in fade-in duration-200">
          <div className="ai-wizard-step-header">
            <h4 className="text-sm font-semibold text-[var(--text-strong)] flex items-center gap-1.5">
              <LuPalette className="text-violet-400" /> 4. Architectural Style & Envelope
            </h4>
            <p className="text-xs text-[var(--text-muted)]">
              Choose a design language respecting regional zoning, daylighting, and roof forms:
            </p>
          </div>

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
                title: "Modern Luxury Villa",
                desc: "Glazed curtain walls, private master suite & open living pavilion",
                layoutStyle: "split",
                cultureStyle: "standard",
                roofStyle: "modern-flat",
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
                      footprint: style.layoutStyle === "courtyard" ? "u" : "rectangle", sketches: undefined, totalAreaM2: undefined,
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
                {p.bedrooms} Bedrooms · {p.variant} · {allocation ? `${Math.round(allocation.totalAreaM2)} m² total` : ""}
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
            <summary>Adjust rooms and building dimensions</summary>
            <div className="ai-area-fields mt-2">
              {([['Bedroom area', 'bedroomAreaM2', 11], ['Living area', 'livingAreaM2', 10], ['Kitchen area', 'kitchenAreaM2', 6], ['Bathroom area', 'bathroomAreaM2', 4], ['Building width (m)', 'widthM', 4], ['Building length (m)', 'lengthM', 4]] as const).map(([label, key, min]) => <label key={key}><span>{label}{key.endsWith('M2') ? ' (m²)' : ''}</span><input type="number" min={min} step={0.5} disabled={disabled || isRefreshing} value={p[key] ?? ''} placeholder="Automatic" onChange={e => update({ ...p, [key]: e.target.value ? Number(e.target.value) : undefined, sketches: undefined })} /></label>)}
            </div>
            <div className="ai-suggestion-row mt-2">
              <label><input type="checkbox" checked={p.furnished !== false} disabled={disabled || isRefreshing} onChange={e => update({ ...p, furnished: e.target.checked })} /> Furnished</label>
              <label><input type="checkbox" checked={p.separateKitchen !== false} disabled={disabled || isRefreshing} onChange={e => update({ ...p, separateKitchen: e.target.checked, sketches: undefined })} /> Separate kitchen</label>
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
