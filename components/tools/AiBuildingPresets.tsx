"use client";

import { useState, useMemo } from "react";
import {
  residentialCommand,
  suggestResidentialTypes,
  type ResidentialParameters,
  type TypologySuggestion,
} from "@/lib/ai/modeling/allocation";
import { allocateBuilding, polygonArea } from "@/lib/ai/modeling/footprint";
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
  heightMm,
  thicknessMm,
  onChoose,
  onCreate,
}: {
  disabled: boolean;
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
  });

  const suggestions = useMemo(() => suggestResidentialTypes(plotArea), [plotArea]);

  const validate = (next: ResidentialParameters) => {
    if (
      next.apartmentFloors !== undefined ||
      next.apartmentsPerFloor !== undefined ||
      next.bedroomsPerApartment !== undefined
    ) {
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
    setP(next);
    try {
      validate(next);
      onChoose(residentialCommand(next), next);
    } catch {
      onChoose("", next);
    }
  };

  const handleShuffle = () => {
    setIsRefreshing(true);
    const newSeed = Math.floor(Math.random() * 1000000);
    const next = { ...p, layoutSeed: newSeed };
    update(next);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const selectTypology = (sug: TypologySuggestion) => {
    const next: ResidentialParameters = {
      ...p,
      variant: sug.variant,
      bedrooms: sug.bedrooms,
      layoutStyle: sug.layoutStyle ?? p.layoutStyle,
      apartmentFloors: sug.apartmentFloors,
      apartmentsPerFloor: sug.apartmentsPerFloor,
      bedroomsPerApartment: sug.bedroomsPerApartment,
      totalAreaM2: sug.estimatedAreaM2,
      layoutSeed: Math.floor(Math.random() * 1000000),
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
            disabled={disabled}
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
              Specify your property or buildable site area. Real architectural site coverage (35%–60%) calculates realistic typologies.
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
                  update({ ...p, widthM: val });
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
                  update({ ...p, lengthM: val });
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
              Based on architectural standards (DIN 18025 / Neufert), these building typologies fit your plot footprint:
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
              const isSelected = p.layoutStyle === style.layoutStyle && (style.cultureStyle === "standard" || p.cultureStyle === style.cultureStyle);
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
                      footprint: style.layoutStyle === "courtyard" ? "u" : "rectangle",
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
              onClick={() => setStep(5)}
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
            <AiFootprintCanvas parameters={p} onChange={update} disabled={disabled} building={result} />
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

          {error && <p role="alert" className="ai-error mt-2">{error}</p>}

          {/* ACTION BUTTONS: Refresh vs Create vs Back */}
          <div className="ai-layout-actions mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              className="ai-secondary-button flex items-center gap-1.5 px-3 py-2 text-xs font-semibold"
              disabled={disabled}
              onClick={handleShuffle}
              title="Generate a different valid room layout for these exact same inputs"
            >
              <LuRefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-amber-400" : ""}`} />
              <span>{isRefreshing ? "Regenerating…" : "Refresh / Shuffle Layout"}</span>
            </button>

            <button
              type="button"
              className="ai-create-layout flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-md transition-all active:scale-95"
              disabled={disabled || !!error || (p.bedroomAreaM2 ?? 20) < 11}
              onClick={() => onCreate(residentialCommand(p), p)}
            >
              <LuSparkles className="h-3.5 w-3.5" />
              <span>Create this layout in 3D</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
