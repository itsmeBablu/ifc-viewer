"use client";

import RenderSceneControls from "./RenderSceneControls";
import { useState } from "react";
import {
  LuCamera,
  LuDownload,
  LuX,
  LuSunMedium,
  LuSunset,
  LuCloud,
  LuMoon,
  LuLightbulb,
  LuSlidersHorizontal,
  LuCompass,
} from "react-icons/lu";
import {
  useViewDisplayStore,
  type RenderPreset,
} from "@/store/useViewDisplayStore";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useModelScene } from "./WerkzeugModelSceneContext";

export function enterRenderView() {
  const markup = useToolMarkupStore.getState();
  const layout = useLayoutDrawingStore.getState();
  if (layout.slabBoundaryEdit) return;
  layout.setArmedLayoutTool(null);
  layout.clearSelection();
  markup.setArmedTool(null);
  markup.setMeasureMode(false);
  markup.clearSelection();
  markup.setWalkthroughMode(false);
  markup.setQuadView(false);
  markup.setViewPreset("free");
  useAppStore.getState().setRenderMode("realistic");
  useViewDisplayStore.getState().setRenderPreview(true);
}

function getCompassHeading(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return "N";
  if (normalized < 67.5) return "NE";
  if (normalized < 112.5) return "E";
  if (normalized < 157.5) return "SE";
  if (normalized < 202.5) return "S";
  if (normalized < 247.5) return "SW";
  if (normalized < 292.5) return "W";
  return "NW";
}

const PRESETS: { key: RenderPreset; label: string; icon: typeof LuSunMedium }[] = [
  { key: "architectural", label: "Noon", icon: LuSunMedium },
  { key: "golden", label: "Golden", icon: LuSunset },
  { key: "overcast", label: "Overcast", icon: LuCloud },
  { key: "dusk", label: "Dusk", icon: LuMoon },
  { key: "interior", label: "Interior", icon: LuLightbulb },
];

export default function RenderViewControls() {
  const enabled = useViewDisplayStore((s) => s.renderPreview);
  const sunAzimuth = useViewDisplayStore((s) => s.sunAzimuth);
  const sunElevation = useViewDisplayStore((s) => s.sunElevation);
  const sunIntensity = useViewDisplayStore((s) => s.sunIntensity);
  const ambientIntensity = useViewDisplayStore((s) => s.ambientIntensity);
  const shadowsEnabled = useViewDisplayStore((s) => s.shadowsEnabled);
  const exposure = useViewDisplayStore((s) => s.exposure);
  const activePreset = useViewDisplayStore((s) => s.renderPreset);
  const setRenderSetting = useViewDisplayStore((s) => s.setRenderSetting);
  const applyRenderPreset = useViewDisplayStore((s) => s.applyRenderPreset);

  const { captureViewport } = useModelScene();
  const [scale, setScale] = useState(2);
  const [error, setError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const save = () => {
    const data = captureViewport?.({ scale });
    if (!data) {
      setError("Could not capture this view. Try a lower resolution.");
      return;
    }
    const link = document.createElement("a");
    link.href = data;
    link.download = `render-arch-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    link.click();
    setError("");
  };

  const sliderCls = "w-full v-yellow-slider";

  return (
    <details className="property-disclosure rounded-lg border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)]" open>
      <summary className="cursor-pointer select-none font-semibold flex items-center justify-between p-2 text-xs">
        <span className="flex items-center gap-1.5">
          <LuCamera className="text-amber-500" />
          Render Studio
        </span>
        {enabled ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE RENDER
          </span>
        ) : (
          <span className="text-[10px] text-[var(--text-muted)]">PBR & Shadows</span>
        )}
      </summary>

      <div className="space-y-3 p-2 pt-0 text-xs">
        {/* Toggle Mode Button */}
        <button
          type="button"
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold shadow-sm transition-all duration-200 active:scale-[0.98] ${
            enabled
              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30"
              : "btn-v-yellow btn-liquid-hover !text-zinc-950 shadow-md shadow-yellow-400/25 border-transparent"
          }`}
          onClick={() =>
            enabled
              ? useViewDisplayStore.getState().setRenderPreview(false)
              : enterRenderView()
          }
        >
          {enabled ? <LuX className="text-sm" /> : <LuCamera className="text-sm text-zinc-950" />}
          {enabled ? "Exit Render Studio" : "Enter Render Studio"}
        </button>

        <RenderSceneControls />

        {/* Atmosphere Presets */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
            Lighting Atmosphere
          </label>
          <div className="grid grid-cols-5 gap-1">
            {PRESETS.map(({ key, label, icon: Icon }) => {
              const isSelected = activePreset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (!enabled) enterRenderView();
                    applyRenderPreset(key);
                  }}
                  className={`flex flex-col items-center justify-center p-1.5 rounded border text-[10px] transition-colors ${
                    isSelected
                      ? "border-blue-500 bg-blue-500/20 font-semibold text-blue-400 shadow-sm"
                      : "border-[var(--panel-divider)] bg-[var(--popover-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-neutral-500"
                  }`}
                  title={`${label} Atmosphere`}
                >
                  <Icon className="text-sm mb-0.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sun & Shadows Quick Controls */}
        <div className="space-y-2 rounded border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-2">
          {/* Sun Azimuth */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1 text-[var(--text-muted)]">
                <LuCompass className="text-xs" /> Sun Direction
              </span>
              <span className="font-mono text-[10px] font-semibold">
                {sunAzimuth}° {getCompassHeading(sunAzimuth)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={sunAzimuth}
              onChange={(e) => setRenderSetting("sunAzimuth", Number(e.target.value))}
              className={sliderCls}
            />
          </div>

          {/* Sun Altitude */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1 text-[var(--text-muted)]">
                <LuSunMedium className="text-xs" /> Sun Altitude
              </span>
              <span className="font-mono text-[10px] font-semibold">
                {sunElevation}°
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={85}
              step={1}
              value={sunElevation}
              onChange={(e) => setRenderSetting("sunElevation", Number(e.target.value))}
              className={sliderCls}
            />
          </div>

          {/* Sunlight Shadows Toggle */}
          <label className="flex items-center justify-between pt-1 cursor-pointer select-none">
            <span className="text-[11px] font-medium">Cast Sunlight Shadows</span>
            <input
              type="checkbox"
              checked={shadowsEnabled}
              onChange={(e) => setRenderSetting("shadowsEnabled", e.target.checked)}
              className="rounded border-[var(--panel-divider)] accent-blue-600 w-3.5 h-3.5"
            />
          </label>
        </div>

        {/* Fine Tuning / Advanced Sliders */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <span className="flex items-center gap-1">
              <LuSlidersHorizontal className="text-xs" /> Lighting Details
            </span>
            <span className="text-[10px] font-mono">{showAdvanced ? "▲" : "▼"}</span>
          </button>

          {showAdvanced && (
            <div className="space-y-2 mt-1.5 p-2 rounded border border-[var(--panel-divider)] bg-[var(--popover-bg)]">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-[var(--text-muted)]">Direct Sunlight</span>
                  <span className="font-mono">{sunIntensity.toFixed(2)}×</span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={3.0}
                  step={0.05}
                  value={sunIntensity}
                  onChange={(e) => setRenderSetting("sunIntensity", Number(e.target.value))}
                  className={sliderCls}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-[var(--text-muted)]">Ambient Sky Fill</span>
                  <span className="font-mono">{ambientIntensity.toFixed(2)}×</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={2.0}
                  step={0.05}
                  value={ambientIntensity}
                  onChange={(e) => setRenderSetting("ambientIntensity", Number(e.target.value))}
                  className={sliderCls}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-[var(--text-muted)]">Camera Exposure</span>
                  <span className="font-mono">{exposure.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.6}
                  max={2.0}
                  step={0.05}
                  value={exposure}
                  onChange={(e) => setRenderSetting("exposure", Number(e.target.value))}
                  className={sliderCls}
                />
              </div>
            </div>
          )}
        </div>

        {/* High-Res Snapshot Export */}
        <div className="space-y-1.5 pt-1 border-t border-[var(--panel-divider)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-[var(--text-muted)]">Export Quality</span>
            <select
              aria-label="Image resolution"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="rounded border border-[var(--panel-divider)] bg-[var(--popover-bg)] px-2 py-1 text-[11px]"
            >
              <option value={1}>Viewport (1×)</option>
              <option value={2}>Ultra HD (2×)</option>
              <option value={3}>Poster Print (3×)</option>
            </select>
          </div>
          <button
            type="button"
            disabled={!captureViewport}
            onClick={save}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-[var(--panel-divider)] bg-[var(--popover-bg)] px-2 py-2 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors"
          >
            <LuDownload /> Save Render (PNG)
          </button>
          {error && (
            <p role="alert" className="text-xs text-rose-500">
              {error}
            </p>
          )}
        </div>
      </div>
    </details>
  );
}

