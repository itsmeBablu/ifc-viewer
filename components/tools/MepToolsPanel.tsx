"use client";

import React, { useState } from "react";
import {
  LuWind,
  LuDroplets,
  LuZap,
  LuBox,
  LuSearch,
  LuCheck,
  LuMousePointer2,
  LuCable,
  LuPlus,
  LuInfo,
} from "react-icons/lu";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { COMPONENT_CATALOG } from "@/lib/componentCatalog";
import type { LayoutToolId } from "@/lib/layoutDrawing";

const disciplines = [
  { id: "all", label: "All Systems", icon: LuBox },
  { id: "hvac", label: "HVAC / Air", icon: LuWind },
  { id: "piping", label: "Hydronic & Plumbing", icon: LuDroplets },
  { id: "electrical", label: "Electrical & Data", icon: LuZap },
] as const;

interface RouteDefinition {
  id: LayoutToolId;
  label: string;
  subtitle: string;
  domain: "hvac" | "piping" | "electrical";
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgLight: string;
  explanation: string;
  standardElevations: string;
  connectivity: string;
}

const routes: RouteDefinition[] = [
  {
    id: "duct",
    label: "Rigid Duct",
    subtitle: "Rectangular / Round Trunks",
    domain: "hvac",
    icon: LuWind,
    color: "#38bdf8",
    bgLight: "rgba(56, 189, 248, 0.12)",
    explanation:
      "Primary air distribution network. Transports conditioned supply, return, or exhaust air from AHUs and plant rooms through main corridors and risers.",
    standardElevations: "Ceiling void (+2600mm to +3200mm)",
    connectivity: "Automatically creates mitered elbows, transitions & tees. Snaps to AHUs, VAVs & diffusers.",
  },
  {
    id: "flex_duct",
    label: "Flexible Duct",
    subtitle: "Diffuser & VAV Runouts",
    domain: "hvac",
    icon: LuWind,
    color: "#0284c7",
    bgLight: "rgba(2, 132, 199, 0.12)",
    explanation:
      "Acoustic and flexible spiral-wound connection lines bridging rigid duct branches to ceiling diffusers, grilles, and terminal units.",
    standardElevations: "Drop to ceiling (+2400mm to +2700mm)",
    connectivity: "Connects from rigid duct takeoffs directly into diffuser spigots.",
  },
  {
    id: "pipe",
    label: "Hydronic & Pipe",
    subtitle: "Heating, Chilled & Water",
    domain: "piping",
    icon: LuDroplets,
    color: "#f97316",
    bgLight: "rgba(249, 115, 22, 0.12)",
    explanation:
      "Pressurized fluid distribution for heating loops (heat pump/radiators), chilled cooling circuits, potable domestic water, and gravity drainage stacks.",
    standardElevations: "Ceiling void (+2800mm), Floor void (+150mm), or Wall (+1200mm)",
    connectivity: "Automatically inserts inline elbows, branch tees, and reducers. Snaps to boilers, pumps & radiators.",
  },
  {
    id: "cabletray",
    label: "Tray & Conduit",
    subtitle: "Cable Containment Network",
    domain: "electrical",
    icon: LuCable,
    color: "#a855f7",
    bgLight: "rgba(168, 85, 247, 0.12)",
    explanation:
      "Heavy-duty galvanized cable containment supporting primary power feeders, distribution board risers, and high-density structured IT data baskets.",
    standardElevations: "Upper ceiling void (+2900mm to +3400mm)",
    connectivity: "Generates horizontal/vertical bends and crosses. Snaps to distribution panels and IT racks.",
  },
  {
    id: "wire",
    label: "Wire & Circuit",
    subtitle: "Power, Lighting & Telecom",
    domain: "electrical",
    icon: LuZap,
    color: "#eab308",
    bgLight: "rgba(234, 179, 8, 0.12)",
    explanation:
      "Point-to-point electrical branch circuits connecting sub-distribution boards to lighting switches, power outlets, luminaires, and sensors.",
    standardElevations: "Wall skirting (+300mm), switches (+1100mm), or ceiling (+2600mm)",
    connectivity: "Direct point routing with continuous node insertion.",
  },
];

const AIR_SYSTEMS = [
  {
    id: "supply",
    label: "Supply Air",
    color: "#38bdf8",
    code: "SUP",
    flow: "Plant → Room",
    description: "Conditioned, filtered and temperature-controlled air delivered to spaces for occupant comfort.",
  },
  {
    id: "return",
    label: "Return Air",
    color: "#e879f9",
    code: "RET",
    flow: "Room → Plant",
    description: "Warm/stale indoor air extracted back to the AHU for heat recovery exchange and reconditioning.",
  },
  {
    id: "extract",
    label: "Extract Air",
    color: "#facc15",
    code: "EXT",
    flow: "Wet Room → Outside",
    description: "Vitiated air removed from kitchens, bathrooms, and technical zones directly exhausted to atmosphere.",
  },
  {
    id: "exhaust",
    label: "Exhaust Air",
    color: "#fb923c",
    code: "EXH",
    flow: "Plant → Outside",
    description: "Post-heat-recovery discharge air expelled from the building exterior.",
  },
  {
    id: "outdoor",
    label: "Outdoor Air",
    color: "#4ade80",
    code: "ODA",
    flow: "Outside → Plant",
    description: "Fresh atmospheric intake air pulled into central ventilation units for filtration.",
  },
];

const PIPE_SYSTEMS = [
  {
    id: "hydronic_supply",
    label: "Heating Supply",
    color: "#ef4444",
    code: "HTG-S",
    description: "High-temperature pressurized water (50°C–70°C) pumped from heat pumps or boilers to radiators & FCUs.",
  },
  {
    id: "hydronic_return",
    label: "Heating Return",
    color: "#f97316",
    code: "HTG-R",
    description: "Cooled return water circulated back to the heat generator for continuous reheat.",
  },
  {
    id: "domestic_cold",
    label: "Domestic Cold",
    color: "#2563eb",
    code: "DCW",
    description: "Potable municipal drinking water supply distributed to sanitary fixtures and calorifiers.",
  },
  {
    id: "domestic_hot",
    label: "Domestic Hot",
    color: "#fb7185",
    code: "DHW",
    description: "Tempered domestic sanitary hot water (55°C–60°C) supplied to sinks, showers, and kitchens.",
  },
  {
    id: "sanitary_waste",
    label: "Sanitary Waste",
    color: "#84cc16",
    code: "SAN",
    description: "Gravity soil and waste discharge connecting fixtures to vertical discharge stacks and sewer mains.",
  },
  {
    id: "fire_protection",
    label: "Fire Protection",
    color: "#dc2626",
    code: "FP",
    description: "High-pressure wet/dry standpipe sprinkler system for building fire suppression.",
  },
  {
    id: "gas",
    label: "Fuel Gas",
    color: "#eab308",
    code: "GAS",
    description: "Low-pressure natural gas or LPG supply lines to central heating boilers and commercial appliances.",
  },
];

const CABLE_TRAY_TYPES = [
  {
    id: "ladder",
    label: "Cable Ladder",
    desc: "Heavy-duty open rung design for high-power distribution feeders and high heat dissipation.",
  },
  {
    id: "perforated",
    label: "Perforated Tray",
    desc: "Continuous ventilated base with slot perforations for general commercial and industrial cabling.",
  },
  {
    id: "wire_mesh",
    label: "Wire Mesh Basket",
    desc: "Lightweight, highly flexible basket tray ideal for structured Cat6A/fiber data center cabling.",
  },
  {
    id: "conduit",
    label: "Conduit Run",
    desc: "Rigid metallic or PVC conduit tubes providing enclosed mechanical protection for circuit wires.",
  },
];

const ELEVATION_PRESETS = [
  { label: "High Void", value: 3000, desc: "Directly under ceiling slab" },
  { label: "Ceiling Grid", value: 2600, desc: "Suspended ceiling plenum" },
  { label: "Wall Level", value: 1200, desc: "Service switches & radiator headers" },
  { label: "Floor Level", value: 150, desc: "Floor void / skirting perimeter" },
];

const fieldClass =
  "h-8 w-full rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2.5 text-xs text-[var(--text-strong)] transition-all focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400/50";
const cardClass =
  "rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-overlay)]/40 p-3.5 space-y-3 backdrop-blur-sm shadow-sm";

function NumberField({
  label,
  value,
  onChange,
  min,
  unit,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  unit?: string;
}) {
  return (
    <label className="block space-y-1">
      <div className="flex items-center justify-between text-[10.5px] font-medium text-[var(--text-muted)]">
        <span>{label}</span>
        {unit && <span className="text-[9px] text-[var(--text-muted)]/70">{unit}</span>}
      </div>
      <input
        className={fieldClass}
        type="number"
        min={min}
        value={value}
        onChange={(e) => {
          if (e.target.value !== "" && Number.isFinite(e.target.valueAsNumber)) {
            onChange(e.target.valueAsNumber);
          }
        }}
      />
    </label>
  );
}

export default function MepToolsPanel() {
  const s = useLayoutDrawingStore();
  const levelId = useToolMarkupStore((state) => state.markupFloorId);
  const [search, setSearch] = useState("");

  const category = s.desktopMepCategory;
  const domain = category === "wiring" ? "electrical" : category;
  const tool = s.armedLayoutTool;
  const isDuct = tool === "duct" || tool === "flex_duct" || tool === "mep_placeholder";
  const isPipe = tool === "pipe";
  const isTray = tool === "cabletray";
  const isWire = tool === "wire";
  const drawing = s.ductDraw || s.pipeDraw || s.cableTrayDraw || s.wireDraw;
  const level = s.levels.find((l) => l.id === levelId) ?? s.levels[0];

  const arm = (next: LayoutToolId) => {
    s.setMepModeActive(true);
    s.setArmedLayoutTool(next);
  };

  const finish = () => {
    s.cancelDuctDraw();
    s.cancelPipeDraw();
    s.cancelCableTrayDraw();
    s.cancelWireDraw();
    s.setArmedLayoutTool(null);
  };

  const fixtures = COMPONENT_CATALOG.filter(
    (item) =>
      item.id.startsWith("mep-") &&
      (domain === "all" ||
        domain === "components" ||
        (domain === "hvac"
          ? item.room === "HVAC"
          : domain === "piping"
          ? ["Plumbing", "Heating"].includes(item.room)
          : item.room === "Electrical")) &&
      `${item.name} ${item.room}`.toLowerCase().includes(search.toLowerCase()),
  );

  const activeRouteDef = routes.find((r) => r.id === tool);
  const activeAirSys = AIR_SYSTEMS.find((a) => a.id === s.draftDuctSystem) ?? AIR_SYSTEMS[0];
  const activePipeSys = PIPE_SYSTEMS.find((p) => p.id === s.draftPipeSystem) ?? PIPE_SYSTEMS[0];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-4 text-xs thin-scroll">
      {/* MEP Header Banner */}
      <div className="rounded-xl border border-sky-400/30 bg-gradient-to-br from-sky-500/15 via-sky-400/5 to-transparent p-3.5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[.18em] text-sky-400">
              MEP Engineering Console
            </span>
          </div>
          <span className="truncate rounded-md bg-[var(--surface-overlay)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)] border border-[var(--panel-divider)]">
            {level?.name ?? "Default Level"}
          </span>
        </div>
        <p className="mt-2 text-sm font-bold text-[var(--text-strong)]">
          Route Services · Connect Systems · Place Plant
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
          Architectural walls, doors, and slabs are bypassed during routing so MEP runs snap cleanly without obstruction.
        </p>
      </div>

      {/* Discipline Selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          <span>Discipline Filter</span>
          <span className="text-[9px] text-[var(--text-muted)]/70">Click to filter tools</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5" aria-label="MEP discipline">
          {disciplines.map(({ id, label, icon: Icon }) => {
            const active = domain === id;
            return (
              <button
                type="button"
                key={id}
                aria-pressed={active}
                onClick={() => s.setDesktopMepCategory(id)}
                className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-[10px] font-medium transition-all ${
                  active
                    ? "border-sky-400/60 bg-sky-400/15 text-sky-400 shadow-sm shadow-sky-500/10 font-bold"
                    : "border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-strong)]"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-sky-400" : ""}`} />
                <span className="truncate px-1">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 01 / Route Tools with Hover Explanations */}
      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            01 / Routing & Distribution
          </h3>
          <span className="text-[9px] text-sky-400/90 font-medium">Auto-junctions & fittings</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {routes
            .filter((r) => domain === "all" || domain === "components" || r.domain === domain)
            .map((r) => {
              const Icon = r.icon;
              const isArmed = tool === r.id;
              return (
                <div key={r.id} className="relative group">
                  <button
                    type="button"
                    aria-pressed={isArmed}
                    onClick={() => arm(r.id)}
                    className={`w-full rounded-xl border p-2.5 text-left transition-all ${
                      isArmed
                        ? "border-sky-400 bg-sky-400/15 text-sky-400 shadow-sm"
                        : "border-[var(--panel-divider)] bg-[var(--surface-overlay)]/30 text-[var(--text-strong)] hover:border-sky-400/60 hover:bg-[var(--surface-overlay)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-lg"
                        style={{ backgroundColor: r.bgLight, color: r.color }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      {isArmed && (
                        <span className="flex h-2 w-2 rounded-full bg-sky-400 shadow-sm shadow-sky-400"></span>
                      )}
                    </div>
                    <span className="mt-2 block font-semibold text-xs">{r.label}</span>
                    <span className="mt-0.5 block text-[9.5px] text-[var(--text-muted)] line-clamp-1">
                      {r.subtitle}
                    </span>
                  </button>
                </div>
              );
            })}
        </div>

        {/* Dynamic Route Info Box */}
        {activeRouteDef && (
          <div className="rounded-lg border border-sky-400/25 bg-sky-400/5 p-2.5 space-y-1.5 transition-all">
            <div className="flex items-center gap-1.5 text-sky-400 font-semibold text-[10.5px]">
              <LuInfo className="h-3.5 w-3.5 shrink-0" />
              <span>{activeRouteDef.label}: Engineering Guidance</span>
            </div>
            <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
              {activeRouteDef.explanation}
            </p>
            <div className="grid grid-cols-1 gap-1 text-[9.5px] pt-1 border-t border-sky-400/15 text-[var(--text-muted)]">
              <div>
                <strong className="text-[var(--text-strong)]">Standard Zone: </strong>
                {activeRouteDef.standardElevations}
              </div>
              <div>
                <strong className="text-[var(--text-strong)]">Connections: </strong>
                {activeRouteDef.connectivity}
              </div>
            </div>
          </div>
        )}

        <div className="pt-1 flex items-center justify-between text-[11px]">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={s.mepChainDrawing}
              onChange={(e) => s.setMepChainDrawing(e.target.checked)}
              className="accent-sky-400 rounded h-3.5 w-3.5"
            />
            <span className="font-medium text-[var(--text-strong)]">Continuous Multi-Segment Run</span>
          </label>
        </div>

        {drawing ? (
          <button
            type="button"
            onClick={finish}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 px-3 py-2 font-bold text-slate-950 shadow-sm transition-all"
          >
            <LuCheck className="h-4 w-4" />
            Finish Current Run (or press Esc)
          </button>
        ) : (
          <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
            💡 Click on canvas to start run. Click at each bend to turn. Click existing endpoint or press Esc to complete.
          </p>
        )}
      </section>

      {/* 02 / Elevation Quick-Presets & Settings */}
      {(isDuct || isPipe || isTray || isWire || tool === "equipment") && (
        <section className={cardClass}>
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Route & Dimension Parameters
            </h3>
            <span className="text-[9px] text-[var(--text-muted)]">Level relative</span>
          </div>

          {/* Elevation Quick Presets */}
          {!isWire && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10.5px] font-medium text-[var(--text-muted)]">
                <span>Quick Elevation Presets</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {ELEVATION_PRESETS.map((preset) => {
                  const currentElev = isDuct
                    ? s.draftDuctElevationMm
                    : isPipe
                    ? s.draftPipeElevationMm
                    : isTray
                    ? s.draftCableTrayElevationMm
                    : s.draftEquipmentElevationMm;
                  const isSelected = currentElev === preset.value;
                  const setElev = isDuct
                    ? s.setDraftDuctElevationMm
                    : isPipe
                    ? s.setDraftPipeElevationMm
                    : isTray
                    ? s.setDraftCableTrayElevationMm
                    : s.setDraftEquipmentElevationMm;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      title={preset.desc}
                      onClick={() => setElev(preset.value)}
                      className={`rounded-lg border py-1.5 px-1 text-center transition-all ${
                        isSelected
                          ? "border-sky-400 bg-sky-400/20 text-sky-400 font-bold"
                          : "border-[var(--panel-divider)] text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-strong)]"
                      }`}
                    >
                      <span className="block text-[9px] font-medium truncate">{preset.label}</span>
                      <span className="block text-[10px] font-mono">+{preset.value}</span>
                    </button>
                  );
                })}
              </div>

              <NumberField
                label="Custom Elevation Above Level"
                unit="mm"
                value={
                  isDuct
                    ? s.draftDuctElevationMm
                    : isPipe
                    ? s.draftPipeElevationMm
                    : isTray
                    ? s.draftCableTrayElevationMm
                    : s.draftEquipmentElevationMm
                }
                onChange={
                  isDuct
                    ? s.setDraftDuctElevationMm
                    : isPipe
                    ? s.setDraftPipeElevationMm
                    : isTray
                    ? s.setDraftCableTrayElevationMm
                    : s.setDraftEquipmentElevationMm
                }
              />
            </div>
          )}

          {/* Duct Sizing & Air System */}
          {isDuct && (
            <div className="space-y-2.5 pt-1 border-t border-[var(--panel-divider)]">
              <label className="block space-y-1">
                <span className="text-[10.5px] font-medium text-[var(--text-muted)]">Profile Shape</span>
                <select
                  className={fieldClass}
                  value={s.draftDuctShape}
                  onChange={(e) => s.setDraftDuctShape(e.target.value as typeof s.draftDuctShape)}
                >
                  <option value="rectangular">Rectangular (Standard Commercial)</option>
                  <option value="round">Spiral Round (High Velocity / Exposed)</option>
                  <option value="oval">Flat Oval (Low Ceiling Plenums)</option>
                </select>
              </label>

              {s.draftDuctShape === "round" ? (
                <NumberField
                  label="Duct Diameter"
                  unit="mm"
                  min={50}
                  value={s.draftDuctDiameterMm}
                  onChange={(v) =>
                    s.setDraftDuctSize(s.draftDuctWidthMm, s.draftDuctHeightMm, Math.max(50, v))
                  }
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="Width (W)"
                    unit="mm"
                    min={50}
                    value={s.draftDuctWidthMm}
                    onChange={(v) =>
                      s.setDraftDuctSize(Math.max(50, v), s.draftDuctHeightMm, s.draftDuctDiameterMm)
                    }
                  />
                  <NumberField
                    label="Height (H)"
                    unit="mm"
                    min={50}
                    value={s.draftDuctHeightMm}
                    onChange={(v) =>
                      s.setDraftDuctSize(s.draftDuctWidthMm, Math.max(50, v), s.draftDuctDiameterMm)
                    }
                  />
                </div>
              )}

              {/* Air System with Color Badge & Explanation */}
              <div className="space-y-1">
                <span className="text-[10.5px] font-medium text-[var(--text-muted)]">Air Distribution System</span>
                <select
                  className={fieldClass}
                  value={s.draftDuctSystem}
                  onChange={(e) => s.setDraftDuctSystem(e.target.value as typeof s.draftDuctSystem)}
                >
                  {AIR_SYSTEMS.map((sys) => (
                    <option key={sys.id} value={sys.id}>
                      {sys.label} [{sys.code}]
                    </option>
                  ))}
                </select>

                <div className="mt-2 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)]/60 p-2.5 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: activeAirSys.color }}
                    ></span>
                    <span className="font-bold text-[11px] text-[var(--text-strong)]">
                      {activeAirSys.label} ({activeAirSys.code})
                    </span>
                    <span className="ml-auto text-[9px] text-sky-400 font-medium">{activeAirSys.flow}</span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
                    {activeAirSys.description}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pipe Sizing & Pipe System */}
          {isPipe && (
            <div className="space-y-2.5 pt-1 border-t border-[var(--panel-divider)]">
              <NumberField
                label="Nominal Pipe Diameter (DN)"
                unit="mm"
                min={10}
                value={s.draftPipeDiameterMm}
                onChange={s.setDraftPipeDiameterMm}
              />

              <div className="space-y-1">
                <span className="text-[10.5px] font-medium text-[var(--text-muted)]">Hydronic / Fluid System</span>
                <select
                  className={fieldClass}
                  value={s.draftPipeSystem}
                  onChange={(e) => s.setDraftPipeSystem(e.target.value as typeof s.draftPipeSystem)}
                >
                  {PIPE_SYSTEMS.map((sys) => (
                    <option key={sys.id} value={sys.id}>
                      {sys.label} [{sys.code}]
                    </option>
                  ))}
                </select>

                <div className="mt-2 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)]/60 p-2.5 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: activePipeSys.color }}
                    ></span>
                    <span className="font-bold text-[11px] text-[var(--text-strong)]">
                      {activePipeSys.label} ({activePipeSys.code})
                    </span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
                    {activePipeSys.description}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Cable Tray Containment */}
          {isTray && (
            <div className="space-y-2.5 pt-1 border-t border-[var(--panel-divider)]">
              <label className="block space-y-1">
                <span className="text-[10.5px] font-medium text-[var(--text-muted)]">Containment Format</span>
                <select
                  className={fieldClass}
                  value={s.draftCableTrayType}
                  onChange={(e) => s.setDraftCableTrayType(e.target.value as typeof s.draftCableTrayType)}
                >
                  {CABLE_TRAY_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  label={s.draftCableTrayType === "conduit" ? "Diameter (⌀)" : "Tray Width"}
                  unit="mm"
                  min={20}
                  value={s.draftCableTrayWidthMm}
                  onChange={s.setDraftCableTrayWidthMm}
                />
                {s.draftCableTrayType !== "conduit" && (
                  <NumberField
                    label="Side Flange Height"
                    unit="mm"
                    min={20}
                    value={s.draftCableTrayHeightMm}
                    onChange={s.setDraftCableTrayHeightMm}
                  />
                )}
              </div>

              <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
                {CABLE_TRAY_TYPES.find((t) => t.id === s.draftCableTrayType)?.desc}
              </p>
            </div>
          )}

          {/* Wire Circuits */}
          {isWire && (
            <div className="space-y-2.5 pt-1 border-t border-[var(--panel-divider)]">
              <label className="block space-y-1">
                <span className="text-[10.5px] font-medium text-[var(--text-muted)]">Circuit Class</span>
                <select
                  className={fieldClass}
                  value={s.draftWireSystem}
                  onChange={(e) => s.setDraftWireSystem(e.target.value as typeof s.draftWireSystem)}
                >
                  <option value="power">230V / 400V Mains Power</option>
                  <option value="lighting">Lighting Loop Circuit</option>
                  <option value="data">Structured Data & Telecom (Cat6A)</option>
                  <option value="control">BMS / HVAC Control & Sensors</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10.5px] font-medium text-[var(--text-muted)]">Conductor Cross-Section / Gauge</span>
                <input
                  className={fieldClass}
                  value={s.draftWireGauge}
                  onChange={(e) => s.setDraftWireGauge(e.target.value)}
                  placeholder="e.g. 3x1.5mm², 3x2.5mm²"
                />
              </label>
            </div>
          )}
        </section>
      )}

      {/* 03 / Fixtures & Equipment Catalog with Hover Explanations */}
      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            03 / Plant & Terminal Equipment
          </h3>
          <span className="text-[9px] text-[var(--text-muted)]">{fixtures.length} available</span>
        </div>

        <div className="relative">
          <LuSearch className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input
            aria-label="Search MEP fixtures"
            placeholder="Search chillers, pumps, diffusers, panels…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${fieldClass} pl-8`}
          />
        </div>

        <div className="space-y-1.5 max-h-60 overflow-y-auto thin-scroll pr-1">
          {fixtures.map((item) => {
            const isSelected = tool === "equipment" && s.draftComponentId === item.id;
            return (
              <button
                type="button"
                key={item.id}
                aria-pressed={isSelected}
                onClick={() => {
                  s.chooseComponent(item.id);
                  arm("equipment");
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition-all ${
                  isSelected
                    ? "border-sky-400/80 bg-sky-400/15 text-sky-400 shadow-sm"
                    : "border-[var(--panel-divider)] bg-[var(--surface-overlay)]/25 hover:border-sky-400/40 hover:bg-[var(--surface-overlay)] text-[var(--text-strong)]"
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                    isSelected
                      ? "border-sky-400/40 bg-sky-400/20 text-sky-400"
                      : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)]"
                  }`}
                >
                  <LuBox className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs truncate">{item.name}</span>
                    <span className="text-[9px] font-medium text-[var(--text-muted)] ml-1 shrink-0">
                      {item.room}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[9.5px] text-[var(--text-muted)]">
                    <span>
                      {item.widthMm} × {item.depthMm} × {item.heightMm} mm
                    </span>
                  </div>
                </div>
                <LuPlus className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
              </button>
            );
          })}
          {!fixtures.length && (
            <p className="py-4 text-center text-xs text-[var(--text-muted)]">
              No matching MEP equipment found.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)]/40 p-2 text-[10px] leading-relaxed text-[var(--text-muted)]">
          💡 Click equipment to arm, then click on floor/ceiling to place. Press <strong>Space</strong> while hovering to rotate. Connectors automatically pair with open duct & pipe ends.
        </div>
      </section>

      {/* Return to Selection Button */}
      <button
        type="button"
        onClick={finish}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-overlay)]/40 hover:bg-[var(--surface-overlay)] p-2.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-all"
      >
        <LuMousePointer2 className="h-3.5 w-3.5" />
        Exit MEP Tools · Select Elements
      </button>
    </div>
  );
}
