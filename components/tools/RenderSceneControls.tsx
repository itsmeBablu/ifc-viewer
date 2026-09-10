"use client";

import { useState } from "react";
import { useViewDisplayStore } from "@/store/useViewDisplayStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useMaterialStore } from "@/store/materialStore";
import type { RenderMaterialTarget } from "@/lib/wallFinishes";
import RenderElementsMenu from "./RenderElementsMenu";

export default function RenderSceneControls() {
  const settings = useViewDisplayStore();
  const levels = useLayoutDrawingStore(s => s.levels);
  const applyMaterial = useLayoutDrawingStore(s => s.applyCategoryTexture);
  const autoTextures = useLayoutDrawingStore(s => s.autoTextureArchitecture);
  const materials = useMaterialStore(s => s.materials);
  const [target, setTarget] = useState<RenderMaterialTarget>("walls-exterior");
  const [materialId, setMaterialId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const field = "w-full rounded border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-1.5 text-[11px]";
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage("");
    try { await action(); setMessage("Materials updated."); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-2">
      {(["exterior", "interior"] as const).map(mode => <button key={mode} type="button" aria-pressed={settings.renderSceneMode === mode} className={field} onClick={() => {
        settings.setRenderSetting("renderSceneMode", mode);
        settings.applyRenderPreset(mode === "interior" ? "interior" : "architectural");
        settings.setRenderSetting("renderHiddenCategories", mode === "interior" ? [...new Set([...settings.renderHiddenCategories, "Roofs"])] : settings.renderHiddenCategories.filter(c => c !== "Roofs"));
      }}>{mode === "interior" ? "Interior" : "Exterior"}</button>)}
    </div>
    <RenderElementsMenu />
    <details open className="rounded border border-[var(--panel-divider)] p-2 space-y-2">
      <summary className="font-semibold cursor-pointer">Sky & ground</summary>
      <label className="flex gap-2"><input type="checkbox" checked={settings.skyEnabled} onChange={e => settings.setRenderSetting("skyEnabled", e.target.checked)} />Physical sky and reflections</label>
      <label className="flex gap-2"><input type="checkbox" checked={settings.groundEnabled} onChange={e => settings.setRenderSetting("groundEnabled", e.target.checked)} />Ground surface</label>
      <label className="block">Ground reference level<select className={field} value={settings.groundLevelId ?? ""} onChange={e => settings.setRenderSetting("groundLevelId", e.target.value || null)}><option value="">Project origin (0 mm)</option>{levels.map(l => <option key={l.id} value={l.id}>{l.name} · {l.elevationMm} mm</option>)}</select></label>
      <div className="grid grid-cols-2 gap-2">
        <label>Height offset (mm)<input className={field} type="number" step={10} value={settings.groundOffsetMm} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) settings.setRenderSetting("groundOffsetMm", n); }} /></label>
        <label>Ground size (m)<input className={field} type="number" min={10} max={2000} value={settings.groundSizeM} onChange={e => settings.setRenderSetting("groundSizeM", Math.max(10, Math.min(2000, Number(e.target.value) || 200)))} /></label>
      </div>
      <label className="block">Ground material<select className={field} value={settings.groundMaterialId} onChange={e => settings.setRenderSetting("groundMaterialId", e.target.value)}><option value="">Landscape green</option>{materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    </details>
    <details open className="rounded border border-[var(--panel-divider)] p-2 space-y-2">
      <summary className="font-semibold cursor-pointer">Surface materials</summary>
      <select aria-label="Material target" className={field} value={target} onChange={e => setTarget(e.target.value as RenderMaterialTarget)}>
        <option value="walls-interior">Walls · interior face</option><option value="walls-exterior">Walls · exterior face</option><option value="roofs">Roofs</option><option value="floors">Floors</option><option value="doors">Door leaves</option><option value="window-frames">Window frames</option><option value="window-glass">Window glazing</option>
      </select>
      <select aria-label="Surface material" className={field} value={materialId} onChange={e => setMaterialId(e.target.value)}><option value="">Choose material</option>{materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      <button type="button" className={field} disabled={!materialId || busy} onClick={() => void run(() => applyMaterial(target, materialId))}>Apply material</button>
      <p className="text-[10px] text-[var(--text-muted)]">Applies to selected elements of this category, or all if none are selected. Wall faces follow the wall direction.</p>
      <button type="button" className={field} disabled={busy} onClick={() => void run(autoTextures)}>Auto textures · interior / exterior finishes</button>
      {message && <p role="status">{message}</p>}
    </details>
    <label className="block">Lens field of view · {settings.cameraFov}°<input aria-label="Camera field of view" className="w-full" type="range" min={25} max={90} value={settings.cameraFov} onChange={e => settings.setRenderSetting("cameraFov", Number(e.target.value))} /></label>
    <label className="block">Shadow edges<select className={field} value={settings.shadowSoftness} onChange={e => settings.setRenderSetting("shadowSoftness", e.target.value as "soft" | "crisp")}><option value="soft">Soft</option><option value="crisp">Crisp</option></select></label>
  </div>;
}
