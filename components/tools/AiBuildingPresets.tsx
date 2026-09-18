"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LuCheck, LuChevronLeft, LuChevronRight, LuRefreshCw, LuSparkles } from "react-icons/lu";
import { currentAiContext } from "@/lib/ai/execute";
import { DEFAULT_AI_MODEL, type AiModelId } from "@/lib/ai/models";
import { residentialParametersSchema } from "@/lib/ai/modeling/brief";
import { RESIDENTIAL_PRESETS, residentialCommand, type ResidentialParameters } from "@/lib/ai/modeling/allocation";
import { homeSiteFit, suggestHomes, type HomeSite } from "@/lib/ai/modeling/home";
import { homeBuildParameters } from "@/lib/ai/modeling/preview";
import { polygonArea } from "@/lib/ai/modeling/footprint";
import { validateSketches } from "@/lib/ai/modeling/sketch";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { projectHomeSketches, homeReplacementActions } from "@/lib/ai/modeling/project";
import { defaultModelingPlan } from "@/lib/ai/modeling";
import { validatePlan } from "@/lib/ai/validate";
import AiFootprintCanvas from "./AiFootprintCanvas";
import AiHomeRooms from "./AiHomeRooms";

const steps = ["Plot", "Typology", "Outdoor", "Style", "Layout & 3D"];
const styles = [
  { id: "compact", name: "Compact modern", description: "Simple footprint with a flat roof.", footprint: "rectangle", layoutStyle: "linear", cultureStyle: "standard", roofStyle: "modern-flat" },
  { id: "german", name: "Gable-roof home", description: "Compact rooms with a pitched roof.", footprint: "rectangle", layoutStyle: "linear", cultureStyle: "german", roofStyle: "german-gable" },
  { id: "hip", name: "Hip-roof home", description: "A roof with slopes on all four sides.", footprint: "rectangle", layoutStyle: "linear", cultureStyle: "standard", roofStyle: "german-hip" },
  { id: "mansard", name: "Mansard-inspired home", description: "A sloping roof and compact service core.", footprint: "rectangle", layoutStyle: "linear", cultureStyle: "german", roofStyle: "mansard" },
  { id: "corner", name: "L-shaped home", description: "Two wings around an outdoor corner.", footprint: "l", layoutStyle: "corner", cultureStyle: "standard", roofStyle: "modern-flat" },
  { id: "courtyard", name: "U-shaped courtyard", description: "Shared wings around an open patio.", footprint: "u", layoutStyle: "courtyard", cultureStyle: "standard", roofStyle: "modern-flat" },
] as const;

export default function AiBuildingPresets({ disabled, model, heightMm, thicknessMm, projectId, onChoose, onCreate }: {
  disabled: boolean; model: AiModelId; heightMm: number; thicknessMm: number;
  onChoose: (command: string, p: ResidentialParameters) => void;
  projectId: string;
  onCreate: (command: string, p: ResidentialParameters, replaceProject: boolean) => void;
}) {
  const [step, setStep] = useState(1);
  const [inputMode, setInputMode] = useState<"area" | "dimensions">("area");
  const [area, setArea] = useState("");
  const [width, setWidth] = useState("");
  const [length, setLength] = useState("");
  const [p, setP] = useState<ResidentialParameters | null>(null);
  const [selectedConcept, setSelectedConcept] = useState("");
  const [styleId, setStyleId] = useState("compact");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [preferences, setPreferences] = useState("");
  const [layoutChat, setLayoutChat] = useState<Array<{role:"user"|"assistant";text:string}>>([]);
  const [replaceProject, setReplaceProject] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [buildReady, setBuildReady] = useState(false);
  const [validatedBuildKey, setValidatedBuildKey] = useState("");
  const [buildHint, setBuildHint] = useState("");
  const wallCount = useLayoutDrawingStore(s => s.walls.length);
  const buildKey = JSON.stringify([p, model, replaceProject, wallCount, heightMm, thicknessMm]);
  const checking = step === 5 && !!p && validatedBuildKey !== buildKey;
  const requestRef = useRef<AbortController | null>(null);
  const generationRef = useRef(false);
  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    const timer = setTimeout(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`vstudio:home:${projectId}`) ?? "null");
      if (saved) {
        setArea(saved.area ?? ""); setWidth(saved.width ?? ""); setLength(saved.length ?? "");
        setInputMode(saved.inputMode === "dimensions" ? "dimensions" : "area");
        setP(saved.parameters ?? null); setPreferences(saved.preferences ?? "");
        setStyleId(saved.styleId ?? "compact"); setSelectedConcept(saved.selectedConcept ?? "");
        setStep(saved.parameters ? Math.min(5, saved.step ?? 2) : 1); setReplaceProject(!!saved.replaceProject);
      }
    } catch { /* Start with the plot when a browser draft cannot be restored. */ }
    setDraftLoaded(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [projectId]);
  useEffect(() => {
    if (!draftLoaded) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(`vstudio:home:${projectId}`, JSON.stringify({ area, width, length, inputMode, parameters: p, preferences, styleId, selectedConcept, step, replaceProject })); }
      catch { setFeedback("This browser could not save your Home draft. Your project model can still be saved normally."); }
    }, 300);
    return () => clearTimeout(timer);
  }, [draftLoaded, projectId, area, width, length, inputMode, p, preferences, styleId, selectedConcept, step, replaceProject]);
  useEffect(() => {
    if (!p || step !== 5) return;
    let active = true;
    const timer = setTimeout(() => {
      setBuildReady(false); setBuildHint("");
      try {
        const context = currentAiContext();
        const compilationContext = replaceProject ? { ...context, selection: [], elements: context.elements.filter(e => e.kind === "level") } : context;
        const result = defaultModelingPlan({ command: residentialCommand(p), residential: residentialParametersSchema.parse(homeBuildParameters(p, heightMm, thicknessMm)), model, mode: "build", context: compilationContext, attachments: [], history: [] });
        if (!result) throw new Error("Choose a home concept first.");
        validatePlan({ ...result.plan, actions: [...(replaceProject ? homeReplacementActions(context) : []), ...result.plan.actions] }, context);
        if (active) setBuildReady(true);
      } catch (error) { if (active) setBuildHint(error instanceof Error ? error.message : "Adjust your rooms or drawing before building."); }
      finally { if (active) setValidatedBuildKey(buildKey); }
    }, 100);
    return () => { active = false; clearTimeout(timer); };
  }, [p, step, model, replaceProject, wallCount, buildKey, heightMm, thicknessMm]);
  const site: HomeSite = useMemo(() => inputMode === "area" ? { areaM2: Number(area) } : { areaM2: Number(width) * Number(length), widthM: Number(width), lengthM: Number(length) }, [inputMode, area, width, length]);
  const siteReady = site.areaM2 >= 30 && site.areaM2 <= 10000 && (inputMode === "area" || Number(width) >= 4 && Number(length) >= 4);
  const suggestions = useMemo(() => siteReady ? suggestHomes(site, heightMm, thicknessMm) : [], [siteReady, site, heightMm, thicknessMm]);
  const availableShapes = useMemo(() => (["rectangle", "l", "u", "drawn"] as const).filter(footprint => {
    if (footprint === "drawn" || !p) return true;
    try { return homeSiteFit({ ...p, footprint, sketches: undefined, totalAreaM2: undefined, widthM: undefined, lengthM: undefined }, site, heightMm, thicknessMm).fits; }
    catch { return false; }
  }), [p, site, heightMm, thicknessMm]);
  const blocked = disabled || loading;
  const check = (next: ResidentialParameters) => {
    if (next.sketches?.length) {
      validateSketches(next.sketches);
      const ground = next.sketches[0].points;
      const width = Math.max(...ground.map(p => p.xMm)) - Math.min(...ground.map(p => p.xMm)) + thicknessMm * 2;
      const length = Math.max(...ground.map(p => p.yMm)) - Math.min(...ground.map(p => p.yMm)) + thicknessMm * 2;
      const footprint = width * length / 1e6;
      const parking = next.garage && next.garage !== "none" ? (next.garageWidthM ?? 3.5) * (next.garageDepthM ?? 6) : 0;
      const occupiedWidth = width + (parking ? 800 + (next.garageWidthM ?? 3.5) * 1000 : 0);
      const gardenDepth = next.gardenAreaM2 ? 1000 + next.gardenAreaM2 * 1e6 / (next.gardenPosition === "parking" ? (next.garageWidthM ?? 3.5) * 1000 : width) : 0;
      const occupiedLength = next.gardenPosition === "parking" ? Math.max(length, (next.garageDepthM ?? 6) * 1000 + gardenDepth) : Math.max(length, parking ? (next.garageDepthM ?? 6) * 1000 : 0) + gardenDepth;
      return { fits: footprint + parking + (next.gardenAreaM2 ?? 0) <= site.areaM2 + .1 && (!site.widthM || occupiedWidth <= site.widthM * 1000) && (!site.lengthM || occupiedLength <= site.lengthM * 1000), remainingAreaM2: site.areaM2 - footprint - parking - (next.gardenAreaM2 ?? 0), building: null, totalAreaM2: next.sketches.reduce((sum, s) => sum + polygonArea(s.points) / 1e6, 0) };
    }
    const fit = homeSiteFit(next, site, heightMm, thicknessMm);
    return { ...fit, totalAreaM2: fit.building.allocation.totalAreaM2 + fit.building.extraAreaM2 };
  };
  let fit: ReturnType<typeof check> | null = null;
  let fitMessage = "";
  if (p && siteReady) {
    try {
      fit = check(p);
      if (!fit.fits) fitMessage = "These choices need more outdoor space. Reduce the garden or parking, or choose a smaller home.";
    } catch { fitMessage = "These rooms need a little more space. Choose a smaller home or use automatic room dimensions."; }
  }
  const canFit = (next: ResidentialParameters) => { try { return check(next).fits; } catch { return false; } };
  const update = (next: ResidentialParameters) => {
    setP(next); setFeedback("");
    onChoose(residentialCommand(next), next);
  };
  const resetSite = () => { setP(null); setSelectedConcept(""); setMessage(""); setFeedback(""); };
  const choose = (id: string) => {
    const suggestion = suggestions.find(s => s.id === id);
    if (!suggestion) return;
    setSelectedConcept(id); setStyleId("compact");
    update({ ...suggestion.parameters, roofStyle: "modern-flat", cultureStyle: "standard", layoutStyle: "linear", doorStyle: "wood", doorHeightMm: 2100, doubleEntranceDoor: false, windowStyle: "casement", windowHeightMm: 1200 });
  };
  const generate = async () => {
    if (!p || blocked || generationRef.current || !fit?.fits) return;
    generationRef.current = true;
    setLayoutChat(v=>[...v.slice(-9),{role:"user",text:preferences.trim()||"Suggest another practical layout."}]);
    setLoading(true); setMessage(""); setFeedback("");
    await new Promise(resolve => setTimeout(resolve, 40));
    const previous = p;
    setStep(5); setLoading(true); setMessage("");
    const controller = new AbortController(); requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 240000);
    try {
      const response = await fetch("/api/ai-command", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ intent: "layout", mode: "build", model: model === "ollama-local" ? DEFAULT_AI_MODEL : model, residential: residentialParametersSchema.parse(previous), command: `Regenerate only this home's layout inside the current plot. Keep its outline, bedroom and bathroom counts, room areas, openings, fittings and MEP. User preferences: ${preferences.trim() || "Suggest a practical alternative with simple circulation."}`, context: { ...currentAiContext(), elements: [], selection: [] }, attachments: [], history: layoutChat.slice(-10) }) });
      const result = await response.json();
      if (!response.ok || result.kind !== "layout") throw new Error(result.error || "Gemini could not suggest this layout right now.");
      const next = residentialParametersSchema.parse(result.parameters);
      if (!canFit(next)) throw new Error("Gemini's proposal exceeds your plot. Try smaller room areas.");
      update(next); const reply=typeof result.message === "string" ? result.message : "Your new room arrangement is ready.";setMessage(reply);setLayoutChat(v=>[...v.slice(-9),{role:"assistant",text:reply}]);
    } catch (error) { const reply = controller.signal.aborted ? "Gemini request cancelled. Your layout is unchanged." : error instanceof Error ? error.message : "Gemini is unavailable. Your layout is unchanged."; setFeedback(reply); setLayoutChat(v => [...v.slice(-9), { role: "assistant", text: reply }]); }
    finally { clearTimeout(timeout); requestRef.current = null; generationRef.current = false; setLoading(false); }
  };
  const readyFor = (target: number) => target === 1 || siteReady && (target === 2 || !!p && (target < 5 || !!fit?.fits));
  const nextButton = (target: number, label: string) => <button type="button" className="ai-create-layout" disabled={blocked || !readyFor(target)} onClick={() => setStep(target)}>{label} <LuChevronRight /></button>;
  const backButton = (target: number) => <button type="button" className="ai-secondary-button" disabled={blocked} onClick={() => setStep(target)}><LuChevronLeft /> Back</button>;

  return <section className="ai-building-presets" aria-label="Home planning flow">
    <nav className="ai-wizard-nav" aria-label="Home planning steps">{steps.map((name, i) => <button key={name} type="button" className={"ai-wizard-tab " + (step === i + 1 ? "is-active" : "")} disabled={blocked || !readyFor(i + 1)} onClick={() => setStep(i + 1)}><span className="ai-wizard-tab-num">{i + 1}</span><span>{name}</span></button>)}</nav>
    {step === 1 && <div className="ai-wizard-step">
      {wallCount > 0 && <div className="ai-home-project-options"><strong>Your project already has a building</strong><div className="ai-suggestion-row"><button type="button" disabled={blocked} onClick={() => {
        try {
          const sketches = projectHomeSketches(currentAiContext());
          if (!sketches.length) return;
          const ground = sketches[0].points;
          const plotAreaM2 = p?.plotAreaM2 ?? Math.ceil((Math.max(...ground.map(p => p.xMm)) + thicknessMm * 2) * (Math.max(...ground.map(p => p.yMm)) + thicknessMm * 2) / 1e6 * 1.2);
          setInputMode("area"); setArea(String(plotAreaM2)); setReplaceProject(true);
          update({ ...p, variant: p?.variant ?? (sketches.length > 1 ? "duplex" : "villa"), bedrooms: p?.bedrooms ?? 2, plotAreaM2, sketches, totalAreaM2: sketches.reduce((sum, s) => sum + polygonArea(s.points) / 1e6, 0), garage: "none", gardenAreaM2: 0 }); setStep(5);
        } catch { setFeedback("Show the existing project in the drawing workspace to adjust its walls directly."); }
      }}>Remodel existing</button><button type="button" disabled={blocked} onClick={() => { resetSite(); setReplaceProject(true); }}>New home · replace on Build</button></div><small>{replaceProject ? "Build will replace this project's model. Undo can restore it." : "The current building stays until you choose to remodel or replace it."}</small></div>}
      <h4>Start with your plot</h4><p className="ai-text-muted">Enter its area, or its length and width. We will show only suitable home concepts.</p>
      <div className="ai-suggestion-row ai-plot-method" role="group" aria-label="Plot measurement method">{(["area", "dimensions"] as const).map(method => <button key={method} type="button" aria-pressed={inputMode === method} disabled={blocked} onClick={() => { setInputMode(method); resetSite(); }}>{method === "area" ? "Area (m²)" : "Length × width"}</button>)}</div>
      <div className="ai-area-fields">
        {inputMode === "area" ? <label><span>Plot area (m²)</span><input aria-label="Plot area" type="number" min={30} max={10000} value={area} placeholder="Enter a value" disabled={blocked} onChange={e => { setArea(e.target.value); resetSite(); }} /></label> : <>
          <label><span>Length (m)</span><input aria-label="Plot length" type="number" min={4} step={.1} value={length} placeholder="Enter a value" disabled={blocked} onChange={e => { setLength(e.target.value); resetSite(); }} /></label>
          <label><span>Width (m)</span><input aria-label="Plot width" type="number" min={4} step={.1} value={width} placeholder="Enter a value" disabled={blocked} onChange={e => { setWidth(e.target.value); resetSite(); }} /></label>
        </>}
      </div>
      {siteReady && <p className="ai-status-line">{site.areaM2.toFixed(1)} m² plot · {suggestions.length} suitable concepts</p>}
      <details className="ai-layout-requirements ai-home-preset-list"><summary>More home presets · select and edit</summary><div className="ai-typology-cards">{RESIDENTIAL_PRESETS.map(preset=><button type="button" key={preset.label} disabled={blocked} onClick={()=>{const {label,...template}=preset;const next:ResidentialParameters={...template,bedroomDistribution:"bedroomDistribution" in template && Array.isArray(template.bedroomDistribution) ? [...template.bedroomDistribution] : undefined,footprintPoints:"footprintPoints" in template ? template.footprintPoints.map(p=>({...p})):undefined,garage:"none",gardenAreaM2:0,balcony:"none",plotAreaM2:siteReady?site.areaM2:undefined,plotWidthM:site.widthM,plotLengthM:site.lengthM};if(!siteReady){try{const b=homeSiteFit(next,{areaM2:10000},heightMm,thicknessMm);setInputMode("area");setArea(String(Math.ceil(b.footprintAreaM2*1.3)));}catch{setInputMode("area");setArea("300");}}setSelectedConcept(label);update(next);setStep(2);}}><strong>{preset.label}</strong><small>Start with this concept and adjust bedrooms, bathrooms and outdoor space.</small></button>)}</div></details>
      <div className="ai-layout-actions">{nextButton(2, "See suitable homes")}</div>
    </div>}
    {step === 2 && <div className="ai-wizard-step">
      <h4>Homes for your {site.areaM2.toFixed(0)} m² plot</h4><p className="ai-text-muted">Compare bedroom count, footprint and remaining outdoor space.</p>
      <div className="ai-typology-cards">{suggestions.map(s => <button key={s.id} type="button" disabled={blocked} aria-pressed={selectedConcept === s.id} className={"ai-typology-card " + (selectedConcept === s.id ? "is-selected" : "")} onClick={() => choose(s.id)}><strong>{s.label} {selectedConcept === s.id && <LuCheck />}</strong><span>{s.totalAreaM2.toFixed(0)} m² across {s.parameters.variant === "duplex" ? "two floors" : "one floor"}</span><small>{s.reason}</small></button>)}</div>
      {p && <AiHomeRooms parameters={p} disabled={blocked} onChange={update}/>}
      {!suggestions.length && <p className="ai-design-recommendation">This plot is too narrow for these home concepts. Check its measurements or start with area only to explore a compact home.</p>}
      <div className="ai-layout-actions">{backButton(1)}{nextButton(3, "Next: Outdoor")}</div>
    </div>}
    {step === 3 && p && <div className="ai-wizard-step">
      <h4>Outdoor features that fit</h4><p className="ai-text-muted">Choices account for the building and available plot space.</p>
      <strong>Parking</strong><div className="ai-suggestion-row">{(["none", "open", "enclosed"] as const).map(garage => { const fits = canFit({ ...p, garage }); return <button key={garage} type="button" disabled={blocked || !fits} className={!fits ? "ai-choice-unavailable" : ""} title={!fits ? "Needs more outdoor area or width. Try fewer bedrooms or no garden." : undefined} aria-pressed={p.garage === garage} onClick={() => update({ ...p, garage })}>{garage === "none" ? "No parking" : garage === "open" ? "Carport" : "Enclosed garage"}</button>; })}</div>
      <strong>Garden</strong><div className="ai-suggestion-row">{[0, 10, 20, 40, 60, 100].map(gardenAreaM2 => { const fits = canFit({ ...p, gardenAreaM2 }); return <button key={gardenAreaM2} type="button" disabled={blocked || !fits} className={!fits ? "ai-choice-unavailable" : ""} title={!fits ? "Try a smaller garden, fewer bedrooms or no parking." : undefined} aria-pressed={p.gardenAreaM2 === gardenAreaM2} onClick={() => update({ ...p, gardenAreaM2 })}>{gardenAreaM2 ? gardenAreaM2 + " m²" : "No garden"}</button>; })}</div>
      <strong>Garden position</strong><div className="ai-suggestion-row">{(["rear","front","parking"] as const).map(gardenPosition=><button key={gardenPosition} type="button" disabled={blocked} aria-pressed={(p.gardenPosition??"rear")===gardenPosition} onClick={()=>update({...p,gardenPosition})}>{gardenPosition==="rear"?"Behind the house":gardenPosition==="front"?"In front":"Next to parking"}</button>)}</div>
      <p className="ai-design-recommendation">Red choices need more space. Go back to choose fewer bedrooms, reduce your garden, or leave out parking. With length and width, parking also needs space beside the house.</p>
      <p className="ai-status-line">{Math.max(0, fit?.remainingAreaM2 ?? 0).toFixed(0)} m² remaining for access and other outdoor uses</p>
      <div className="ai-layout-actions">{backButton(2)}{nextButton(4, "Next: Style")}</div>
    </div>}
    {step === 4 && p && <div className="ai-wizard-step">
      <h4>Style, openings and home systems</h4><p className="ai-text-muted">Door and window openings are placed automatically when you build.</p>
      <div className="ai-home-style-cards">{styles.filter(style => canFit({ ...p, footprint: style.footprint, sketches: undefined, totalAreaM2: undefined, widthM: undefined, lengthM: undefined })).map(style => <button key={style.id} type="button" disabled={blocked} aria-pressed={styleId === style.id} onClick={() => { setStyleId(style.id); const next = { ...p, footprint: style.footprint, layoutStyle: style.layoutStyle, cultureStyle: style.cultureStyle, roofStyle: style.roofStyle, sketches: undefined, totalAreaM2: undefined, widthM: undefined, lengthM: undefined }; update(next); }}><strong><svg className="ai-roof-icon" viewBox="0 0 40 30" aria-hidden="true"><path d={style.roofStyle==="modern-flat"?"M5 12H35M7 12V26H33V12":style.roofStyle==="german-gable"?"M3 15L20 3L37 15M7 13V26H33V13":style.roofStyle==="german-hip"?"M3 15L12 4H28L37 15ZM12 4L20 15L28 4M7 15V26H33V15":"M3 16L10 8L20 3L30 8L37 16M7 14V26H33V14"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>{style.name}</strong><small>{style.description}</small></button>)}</div>
      <details className="ai-layout-requirements"><summary>Approximate room areas</summary><AiHomeRooms parameters={p} disabled={blocked} onChange={update} areasOnly/></details>
      <details open className="ai-layout-requirements"><summary>Doors, windows and bathrooms</summary><div className="ai-area-fields">
        <label><span>Bathrooms in the home</span><select aria-label="Home bathroom count" value={p.bathroomCount ?? (p.variant === "duplex" ? 2 : 1)} disabled={blocked} onChange={e => update({ ...p, bathroomCount: Number(e.target.value), totalAreaM2: undefined, sketches: undefined })}>{[1, 2, 3, 4].map(count => <option key={count} value={count} disabled={count < (p.variant === "duplex" ? 2 : 1) || !canFit({ ...p, bathroomCount: count, totalAreaM2: undefined, sketches: undefined })}>{count}</option>)}</select></label>
        <label className="ai-home-toggle"><input aria-label="Guest bathroom" type="checkbox" checked={!!p.guestBathroom} disabled={blocked || !p.guestBathroom && !canFit({ ...p, guestBathroom: true, totalAreaM2: undefined, sketches: undefined })} onChange={e => update({ ...p, guestBathroom: e.target.checked, totalAreaM2: undefined, sketches: undefined })} /> Guest WC</label>
        <label><span>Door style</span><select aria-label="Home door style" value={p.doorStyle ?? "wood"} disabled={blocked} onChange={e => update({ ...p, doorStyle: e.target.value as ResidentialParameters["doorStyle"] })}>{["wood", "metal", "glass", "sliding"].map(s => <option key={s} value={s}>{s}</option>)}</select></label>
        <label><span>Door height (m)</span><input aria-label="Home door height" type="number" min={1.9} max={Math.min(2.6, (heightMm - 100) / 1000)} step={.1} value={(p.doorHeightMm ?? 2100) / 1000} disabled={blocked} onChange={e => update({ ...p, doorHeightMm: Number(e.target.value) * 1000 })} /></label>
        <label><span>Entrance</span><select aria-label="Home entrance door" value={p.doubleEntranceDoor ? "double" : "single"} disabled={blocked} onChange={e => update({ ...p, doubleEntranceDoor: e.target.value === "double" })}><option value="single">Single door</option><option value="double">Double doors where wall space permits</option></select></label>
        <label><span>Windows</span><select aria-label="Home window style" value={p.windowStyle ?? "casement"} disabled={blocked} onChange={e => update({ ...p, windowStyle: e.target.value as ResidentialParameters["windowStyle"] })}>{["casement", "sliding", "fixed", "single-hung", "double-hung"].map(s => <option key={s} value={s}>{s}</option>)}</select></label>
        <label className="ai-home-toggle"><input type="checkbox" aria-label="Roof window" checked={!!p.roofWindow} disabled={blocked} onChange={e=>update({...p,roofWindow:e.target.checked})}/> Roof window / skylight</label><label><span>Window height (m)</span><input aria-label="Home window height" type="number" min={.6} max={Math.min(2, (heightMm - 1000) / 1000)} step={.1} value={(p.windowHeightMm ?? 1200) / 1000} disabled={blocked} onChange={e => update({ ...p, windowHeightMm: Number(e.target.value) * 1000 })} /></label>
        <label><span>Bathroom fitting</span><select aria-label="Home bathroom fitting" value={p.bathFixture ?? "shower"} disabled={blocked} onChange={e => update({ ...p, bathFixture: e.target.value as ResidentialParameters["bathFixture"] })}><option value="shower">Shower</option><option value="bathtub">Bathtub; shower in smaller rooms</option></select></label>
      </div></details>
      <details className="ai-layout-requirements"><summary>Rooms and facade</summary><div className="ai-home-checks"><label><input type="checkbox" checked={!!p.curtainFacade} disabled={blocked} onChange={e => update({ ...p, curtainFacade: e.target.checked })} /> Glazed curtain wall on the rear facade</label><label><input type="checkbox" checked={!!p.separateKitchen} disabled={blocked} onChange={e => update({ ...p, separateKitchen: e.target.checked, sketches: undefined })} /> Separate kitchen</label></div><div className="ai-area-fields">{Array.from({ length: p.bedrooms }, (_, i) => <label key={i}><span>Bedroom {i + 1} area (m²)</span><input aria-label={`Bedroom ${i + 1} area`} type="number" min={7.5} max={100} step={.5} value={p.bedroomAreasM2?.[i] ?? p.bedroomAreaM2 ?? 20} disabled={blocked} onChange={e => { const areas = Array.from({ length: p.bedrooms }, (_, j) => j === i ? Number(e.target.value) : p.bedroomAreasM2?.[j] ?? p.bedroomAreaM2 ?? 20); update({ ...p, bedroomAreasM2: areas, bedroomAreaM2: areas.reduce((sum, a) => sum + a, 0) / areas.length, sketches: undefined, totalAreaM2: undefined }); }} /></label>)}</div></details>
      <details className="ai-layout-requirements"><summary>MEP and furnishing</summary><div className="ai-home-checks">
        <label><input type="checkbox" checked={p.furnished !== false} disabled={blocked} onChange={e => update({ ...p, furnished: e.target.checked })} /> Furniture and bathroom fittings</label>
        <label><input type="checkbox" checked={!!p.underfloorHeating} disabled={blocked} onChange={e => update({ ...p, underfloorHeating: e.target.checked })} /> Underfloor heating</label>
        <label><input type="checkbox" checked={p.piping === "underfloor"} disabled={blocked} onChange={e => update({ ...p, piping: e.target.checked ? "underfloor" : "none" })} /> Hot and cold water routes</label>
        <label><input type="checkbox" checked={p.ducts === "ceiling"} disabled={blocked} onChange={e => update({ ...p, ducts: e.target.checked ? "ceiling" : "none" })} /> Ceiling ventilation</label>
        <label><input type="checkbox" checked={!!p.electrical} disabled={blocked} onChange={e => update({ ...p, electrical: e.target.checked })} /> Ceiling lights and sockets</label>
      </div><p className="ai-text-muted">Concept equipment and routes are editable in the building model.</p></details>
      <div className="ai-layout-actions">{backButton(3)}<button type="button" className="ai-create-layout" disabled={blocked || !fit?.fits} onClick={() => { setStep(5); void generate(); }}>Plan my layout <LuSparkles /></button></div>
    </div>}
    {step === 5 && p && <div className="ai-wizard-step">
      <h4>Your layout and building</h4><p className="ai-text-muted">{p.bedrooms} bedrooms · {fit?.totalAreaM2.toFixed(0) ?? "—"} m² total · {p.variant === "duplex" ? "two floors" : "one floor"}</p>
      <div className="ai-home-layout-chat" aria-label="Gemini layout conversation">{layoutChat.map((turn,i)=><p key={i} className={`ai-home-layout-message is-${turn.role}`}><strong>{turn.role==="user"?"You":"Gemini"}</strong>{turn.text}</p>)}</div><label className="ai-home-preferences"><span>Ask Gemini to change your layout</span><textarea aria-label="Layout preferences" rows={2} maxLength={1500} value={preferences} disabled={blocked} placeholder="Move the master bedroom to the garden side…" onChange={e => setPreferences(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void generate();}}}/></label>
      <AiFootprintCanvas parameters={p} onChange={update} disabled={blocked} building={fit?.building} heightMm={heightMm} thicknessMm={thicknessMm} model={model} preferences={preferences} onPreferences={setPreferences} onRefresh={() => void generate()} chat={layoutChat} availableShapes={availableShapes} />
      <p className="ai-text-muted">Drag walls or their endpoints in the 2D workspace. Partitions can stay open; doors and windows are automatic.</p>
      <div className="ai-layout-actions ai-layout-actions-final">{backButton(4)}<button type="button" className="ai-create-layout" disabled={blocked || !fit?.fits || !buildReady || checking} onClick={() => { const prepared=homeBuildParameters(p,heightMm,thicknessMm);setReplaceProject(true);onCreate(residentialCommand(prepared),prepared,replaceProject); }}>Build <LuSparkles /></button><button type="button" title="Refresh with Gemini AI using your preferences" aria-label="Refresh with AI" className="ai-secondary-button" disabled={blocked || !fit?.fits} onClick={() => void generate()}><LuRefreshCw /> AI</button></div>
      {checking && <p role="status" className="ai-status-line">Checking your drawing and preparing the building…</p>}
      {buildHint && <div role="status" className="ai-design-recommendation">{buildHint}<button type="button" className="ai-secondary-button" disabled={blocked} onClick={() => update({ ...p, sketches: undefined, footprint: "rectangle", footprintPoints: undefined, widthM: undefined, lengthM: undefined, totalAreaM2: undefined, bedroomAreasM2: undefined })}>Use automatic rooms</button></div>}
      {message && <p className="ai-design-recommendation">{message}</p>}
    </div>}
    {loading && <div className="ai-thinking" role="status"><LuSparkles className="animate-pulse" /><span>Planning a fresh room arrangement…</span><button type="button" onClick={() => requestRef.current?.abort()}>Cancel</button></div>}
    {(feedback || fitMessage) && <p className="ai-design-recommendation" role="status">{feedback || fitMessage}</p>}
  </section>;
}
