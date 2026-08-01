"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BsFullscreen, BsFullscreenExit } from "react-icons/bs";
import { MdZoomInMap } from "react-icons/md";
import { VscSymbolColor } from "react-icons/vsc";
import { CiLight } from "react-icons/ci";
import { LiaStreetViewSolid } from "react-icons/lia";
import { LuPresentation } from "react-icons/lu";
import { IoSearchOutline } from "react-icons/io5";
import type { RenderMode } from "@/lib/types";
import { SCENE_BACKGROUND_PRESETS, useAppStore } from "@/store/useAppStore";
import { getModeSkyPreset } from "@/lib/sceneSky";
import { BG_PRESET_LABEL_KEYS, t, type UiTextKey } from "@/lib/i18n";
import GlassPanel from "./GlassPanel";
import SearchFilterPanel from "./SearchFilterPanel";
import Slider from "./ui/Slider";
import SliceHeightSlider from "./SliceHeightSlider";
import { canHover, clampPopoverCenterX } from "@/lib/canHover";
import type { Viewer3DHandle } from "./Viewer3D";
import type { RefObject } from "react";

const MODE_LABEL_KEYS: Record<RenderMode, UiTextKey> = {
  light: "modeLight",
  fullColor: "modeFullColor",
  wireframe: "modeWireframe",
  texture: "modeTexture",
  realistic: "modeRealistic",
};

type Props = {
  viewerRef: RefObject<Viewer3DHandle | null>;
  targetRef: RefObject<HTMLElement | null>;
};

type Panel = "shade" | "light" | "save" | "search" | null;

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block px-1 py-0.5">
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-[var(--text-body)]">{label}</span>
        <span className="tabular-nums text-[10px] text-[var(--text-muted)]">
          {Math.round(value * 100)}%
        </span>
      </div>
      <Slider
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={(v) => onChange(v / 100)}
      />
    </label>
  );
}

/** Hover popup above a toolbar control — portaled so glass/overflow can't clip it. */
function ToolTipWrap({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [suppressed, setSuppressed] = useState(false);
  const [pos, setPos] = useState({ bottom: 0, left: 0 });
  const hoverCapable = canHover();

  const updatePos = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      bottom: window.innerHeight - r.top + 12,
      left: r.left + r.width / 2,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="relative flex items-center justify-center"
      onMouseEnter={() => {
        if (!hoverCapable || suppressed) return;
        updatePos();
        setOpen(true);
      }}
      onMouseLeave={() => {
        setOpen(false);
        setSuppressed(false);
      }}
      onFocus={() => {
        if (!hoverCapable || suppressed) return;
        updatePos();
        setOpen(true);
      }}
      onBlur={() => setOpen(false)}
      onClick={() => {
        setOpen(false);
        setSuppressed(true);
      }}
    >
      {children}
      {open &&
        hoverCapable &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[200] w-max max-w-[240px] -translate-x-1/2"
            style={{ bottom: pos.bottom, left: pos.left }}
          >
            <GlassPanel variant="panel" zIndex={200}>
              <div className="px-3.5 py-2.5 text-center">
                <p className="text-[12px] font-semibold tracking-wide text-[var(--text-strong)]">
                  {label}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-[var(--text-body)]">
                  {hint}
                </p>
              </div>
            </GlassPanel>
          </div>,
          (document.fullscreenElement as HTMLElement | null) ?? document.body,
        )}
    </div>
  );
}

export default function ViewerToolbar({ viewerRef, targetRef }: Props) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const renderMode = useAppStore((s) => s.renderMode);
  const setRenderMode = useAppStore((s) => s.setRenderMode);
  const lighting = useAppStore((s) => s.lighting);
  const setLighting = useAppStore((s) => s.setLighting);
  const sceneBackground = useAppStore((s) => s.sceneBackground);
  const setSceneBackground = useAppStore((s) => s.setSceneBackground);
  const autoSceneBackground = useAppStore((s) => s.autoSceneBackground);
  const setAutoSceneBackground = useAppStore((s) => s.setAutoSceneBackground);
  const dataViewMode = useAppStore((s) => s.dataViewMode);
  const addSavedView = useAppStore((s) => s.addSavedView);
  const activeModelId = useAppStore((s) => s.activeModelId);
  const isPresentationView = useAppStore((s) => s.isPresentationView);
  const setPresentationView = useAppStore((s) => s.setPresentationView);
  const activeFilter = useAppStore((s) => s.activeFilter);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const colorMode = useAppStore((s) => s.colorMode);
  const floors = useAppStore((s) => s.floors);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const presentationIsolate = useAppStore((s) => s.presentationIsolate);
  const colorTheme = useAppStore((s) => s.colorTheme);
  const isDark = colorTheme === "dark";

  const defaultSaveViewName = () => {
    if (isPresentationView) {
      const raw =
        activeModelLabel?.trim() ||
        activeModelId?.trim() ||
        "model";
      const base = raw.replace(/\.ifc$/i, "").trim() || "model";
      if (presentationIsolate) {
        return `${base}_isolated view`;
      }
      const modeTag =
        colorMode === "temperature" ? "Temperature" : "heizlast";
      return `${base}_${modeTag}`;
    }
    const floorId = selectedFloor;
    if (!floorId) return "";
    return floors.find((f) => f.id === floorId)?.name ?? "";
  };

  const [panel, setPanel] = useState<Panel>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobileToolbar, setIsMobileToolbar] = useState(false);
  const [shadePos, setShadePos] = useState({ bottom: 0, left: 0 });
  const [lightPos, setLightPos] = useState({ bottom: 0, left: 0 });
  const [savePos, setSavePos] = useState({ bottom: 0, left: 0 });
  const [searchPos, setSearchPos] = useState({ bottom: 0, left: 0 });
  const [viewName, setViewName] = useState("");
  const [pageFormat, setPageFormat] = useState<
    import("@/lib/presentationLayout").PageFormat
  >("a4");

  const shadeBtnRef = useRef<HTMLButtonElement>(null);
  const lightBtnRef = useRef<HTMLButtonElement>(null);
  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const shadeMenuRef = useRef<HTMLDivElement>(null);
  const lightMenuRef = useRef<HTMLDivElement>(null);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const searchMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onFs = () => {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      // Presentation must stay fullscreen — leaving FS exits presentation
      if (!fs && useAppStore.getState().isPresentationView) {
        useAppStore.getState().setPresentationView(false);
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobileToolbar(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    if (panel !== "shade" || !shadeBtnRef.current) return;
    const update = () => {
      const r = shadeBtnRef.current!.getBoundingClientRect();
      setShadePos({
        bottom: window.innerHeight - r.top + 10,
        left: r.left + r.width / 2,
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [panel]);

  useLayoutEffect(() => {
    if (panel !== "light" || !lightBtnRef.current) return;
    const update = () => {
      const r = lightBtnRef.current!.getBoundingClientRect();
      setLightPos({
        bottom: window.innerHeight - r.top + 10,
        left: r.left + r.width / 2,
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [panel]);

  useLayoutEffect(() => {
    if (panel !== "save" || !saveBtnRef.current) return;
    const update = () => {
      const r = saveBtnRef.current!.getBoundingClientRect();
      setSavePos({
        bottom: window.innerHeight - r.top + 10,
        left: r.left + r.width / 2,
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [panel]);

  useLayoutEffect(() => {
    if (panel !== "search" || !searchBtnRef.current) return;
    const update = () => {
      const r = searchBtnRef.current!.getBoundingClientRect();
      const mobile = window.innerWidth < 768;
      const panelWidth = Math.min(340, window.innerWidth - 16);
      setSearchPos({
        bottom: window.innerHeight - r.top + 10,
        left: mobile
          ? 0
          : clampPopoverCenterX(r.left + r.width / 2, panelWidth),
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [panel, isMobileToolbar]);

  useEffect(() => {
    if (!panel) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panel === "shade") {
        if (shadeMenuRef.current?.contains(t)) return;
        if (shadeBtnRef.current?.contains(t)) return;
      }
      if (panel === "light") {
        if (lightMenuRef.current?.contains(t)) return;
        if (lightBtnRef.current?.contains(t)) return;
      }
      if (panel === "save") {
        if (saveMenuRef.current?.contains(t)) return;
        if (saveBtnRef.current?.contains(t)) return;
      }
      if (panel === "search") {
        if (searchMenuRef.current?.contains(t)) return;
        if (searchBtnRef.current?.contains(t)) return;
      }
      setPanel(null);
    };
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [panel]);

  const toggleFullscreen = async () => {
    const el = targetRef.current ?? document.documentElement;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  };

  const togglePresentation = async () => {
    const next = !isPresentationView;
    setPresentationView(next);
    const el = targetRef.current ?? document.documentElement;
    try {
      if (next) {
        if (!document.fullscreenElement) await el.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore — presentation still toggles without FS if browser blocks it
    }
  };

  const commitSaveView = () => {
    const name = viewName.trim();
    if (!name || !viewerRef.current) return;
    const pose = viewerRef.current.getCameraPose();
    addSavedView(name, pose.position, pose.target, { pageFormat });
    setViewName("");
    setPanel(null);
  };

  const yellowGloss = isDark
    ? "border border-amber-300/80 bg-gradient-to-br from-amber-300/95 via-yellow-200/88 to-amber-400/78 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_4px_16px_rgba(251,191,36,0.42)] backdrop-blur-md"
    : "border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)] backdrop-blur-md";
  const blueGloss =
    "border border-sky-200/70 bg-gradient-to-br from-sky-200/95 via-sky-300/85 to-sky-400/75 text-sky-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(56,189,248,0.35)] backdrop-blur-md";
  const btnBase =
    "flex h-7 w-10 items-center justify-center rounded-xl transition-[background,border,box-shadow,color,transform] duration-200 ease-out active:scale-95 sm:h-8 sm:w-11";
  const btnIdle = isDark
    ? `${btnBase} toolbar-icon-btn border border-transparent text-[var(--toolbar-icon)] hover:border-amber-300/80 hover:bg-gradient-to-br hover:from-amber-300/95 hover:via-yellow-200/88 hover:to-amber-400/78 hover:text-amber-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_4px_16px_rgba(251,191,36,0.42)] hover:backdrop-blur-md`
    : `${btnBase} toolbar-icon-btn border border-transparent text-[var(--toolbar-icon)] hover:border-amber-200/70 hover:bg-gradient-to-br hover:from-amber-200/95 hover:via-yellow-300/85 hover:to-amber-400/75 hover:text-amber-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)] hover:backdrop-blur-md`;
  const btnActive = `${btnBase} ${yellowGloss}`;
  const btnPresentationIdle = `${btnBase} ${yellowGloss}`;
  const btnPresentationOn = `${btnBase} ${blueGloss}`;

  const menuItemActive = "bg-[var(--chip-active-bg)] text-[var(--text-strong)]";
  const menuItemIdle =
    "text-[var(--text-strong)] hover:bg-[var(--glass-inset-bg)]";
  const menuHeading = "text-[var(--text-body)]";
  const menuDivider = "border-[var(--panel-divider)]";

  const popoverShell = "fixed z-[80] -translate-x-1/2";

  // Presentation uses fullscreen on the viewer root — menus must portal inside it
  const portalRoot =
    (typeof document !== "undefined"
      ? ((document.fullscreenElement as HTMLElement | null) ?? document.body)
      : null) ?? document.body;

  const shadeMenu =
    panel === "shade" &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={shadeMenuRef}
        className={popoverShell}
        style={{ bottom: shadePos.bottom, left: shadePos.left }}
        role="menu"
      >
        <GlassPanel variant="panel" zIndex={80}>
          <div className="max-h-52 w-44 overflow-y-auto p-1.5">
            {(Object.keys(MODE_LABEL_KEYS) as RenderMode[]).map((id) => (
              <button
                key={id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setRenderMode(id);
                  setPanel(null);
                }}
                className={`block w-full rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors ${
                  renderMode === id ? menuItemActive : menuItemIdle
                }`}
              >
                {t(uiLanguage, MODE_LABEL_KEYS[id])}
              </button>
            ))}
          </div>
        </GlassPanel>
      </div>,
      portalRoot,
    );

  const lightMenu =
    panel === "light" &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={lightMenuRef}
        className={popoverShell}
        style={{ bottom: lightPos.bottom, left: lightPos.left }}
        role="dialog"
        aria-label={t(uiLanguage, "lighting")}
      >
        <GlassPanel variant="panel" zIndex={80}>
          <div className="w-56 p-1.5 max-md:max-h-[min(380px,70vh)] max-md:overflow-y-auto md:overflow-visible">
        <p className={`mb-0.5 px-1 text-[10px] font-semibold tracking-wide uppercase ${menuHeading}`}>
          {t(uiLanguage, "lighting")}
        </p>
        <SliderRow
          label={t(uiLanguage, "spacesOpacity")}
          value={lighting.spaceTransparency}
          onChange={(spaceTransparency) => setLighting({ spaceTransparency })}
        />
        <SliderRow
          label={t(uiLanguage, "elementsOpacity")}
          value={lighting.elementTransparency}
          onChange={(elementTransparency) =>
            setLighting({ elementTransparency })
          }
        />
        <SliderRow
          label={t(uiLanguage, "color")}
          value={lighting.color}
          onChange={(color) => setLighting({ color })}
        />
        <SliderRow
          label={t(uiLanguage, "shadow")}
          value={lighting.shadow}
          onChange={(shadow) => setLighting({ shadow })}
        />
        <SliderRow
          label={t(uiLanguage, "indirectLight")}
          value={lighting.indirectLight}
          onChange={(indirectLight) => setLighting({ indirectLight })}
        />

        <div className={`mt-1 border-t pt-1.5 ${menuDivider}`}>
          <div className="mb-1 flex items-center justify-between gap-2 px-1">
            <p className={`text-[10px] font-semibold tracking-wide uppercase ${menuHeading}`}>
              {t(uiLanguage, "bg3d")}
            </p>
            <label className="flex shrink-0 items-center gap-1.5">
              <span className="text-[10px] font-medium text-[var(--text-body)]">
                {t(uiLanguage, "skyAuto")}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={autoSceneBackground}
                aria-label={t(uiLanguage, "skyAuto")}
                onClick={() => setAutoSceneBackground(!autoSceneBackground)}
                className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-200 ${
                  autoSceneBackground
                    ? "border-amber-300/80 bg-gradient-to-br from-amber-300/95 to-amber-400/80"
                    : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    autoSceneBackground ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </label>
          </div>
          <div className="grid grid-cols-4 gap-1 px-0.5 pb-0.5">
            {SCENE_BACKGROUND_PRESETS.map((p) => {
              const autoSkyId = getModeSkyPreset(dataViewMode, colorTheme);
              const active = autoSceneBackground
                ? p.id === autoSkyId
                : sceneBackground === p.id ||
                  sceneBackground.toLowerCase() === p.hex.toLowerCase();
              const presetLabel = BG_PRESET_LABEL_KEYS[p.id]
                ? t(uiLanguage, BG_PRESET_LABEL_KEYS[p.id])
                : p.label;
              return (
                <button
                  key={p.id}
                  type="button"
                  title={presetLabel}
                  onClick={() => {
                    setAutoSceneBackground(false);
                    setSceneBackground(p.id);
                  }}
                  className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-1 transition-[background-color,box-shadow] ${
                    active
                      ? isDark
                        ? "bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                        : "bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.06)]"
                      : "hover:bg-[var(--glass-inset-bg)]"
                  }`}
                >
                  <span
                    className="h-3 w-full shrink-0 rounded-[5px] border border-[var(--panel-divider)]/55"
                    style={{
                      background: p.gradient
                        ? `linear-gradient(to bottom, ${p.gradient.top}, ${p.gradient.bottom})`
                        : p.hex,
                    }}
                  />
                  <span
                    className={`line-clamp-2 min-h-[1.15rem] w-full px-0.5 text-center text-[7px] font-medium leading-[1.1] ${
                      active
                        ? isDark
                          ? "text-zinc-200"
                          : "text-zinc-700"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    {presetLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
          </div>
        </GlassPanel>
      </div>,
      portalRoot,
    );

  const saveMenu =
    panel === "save" &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={saveMenuRef}
        className={popoverShell}
        style={{ bottom: savePos.bottom, left: savePos.left }}
        role="dialog"
        aria-label={t(uiLanguage, "saveView")}
      >
        <GlassPanel variant="panel" zIndex={80}>
          <div className="w-56 p-2.5">
        <p className={`mb-1.5 px-0.5 text-[10px] font-semibold tracking-wide uppercase ${menuHeading}`}>
          {t(uiLanguage, "saveView")}
        </p>
        <input
          autoFocus
          type="text"
          value={viewName}
          onChange={(e) => setViewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitSaveView();
            if (e.key === "Escape") setPanel(null);
          }}
          placeholder={t(uiLanguage, "viewName")}
          className="glass-input mb-2 w-full rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-white/55"
        />
        <p className={`mb-1 px-0.5 text-[10px] font-medium ${menuHeading}`}>
          {t(uiLanguage, "pdfPageSize")}
        </p>
        <div className="mb-2 grid grid-cols-5 gap-0.5">
          {(["a4", "a3", "a2", "a1", "a0"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setPageFormat(f)}
              className={`rounded-lg py-1 text-[10px] font-semibold uppercase ${
                pageFormat === f
                  ? "bg-[var(--chip-active-bg)] text-[var(--chip-active-text)]"
                  : "bg-[var(--glass-inset-bg)] text-[var(--text-body)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="mb-2">
          <SliceHeightSlider
            floors={floors}
            selectedFloor={selectedFloor}
            disabled={isPresentationView || selectedFloor == null}
          />
        </div>
        <button
          type="button"
          disabled={!viewName.trim() || !activeModelId}
          onClick={commitSaveView}
          className="w-full rounded-xl bg-[var(--text-strong)] px-2 py-1.5 text-xs font-medium text-[var(--background)] disabled:opacity-40"
        >
          {t(uiLanguage, "save")}
        </button>
          </div>
        </GlassPanel>
      </div>,
      portalRoot,
    );

  const searchMenu =
    panel === "search" &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={searchMenuRef}
        className={
          isMobileToolbar
            ? "fixed z-[80] left-2 right-2 w-auto max-w-[calc(100vw-1rem)]"
            : popoverShell
        }
        style={{
          bottom: searchPos.bottom,
          ...(isMobileToolbar ? {} : { left: searchPos.left }),
        }}
        role="dialog"
        aria-label={t(uiLanguage, "searchFilter")}
      >
        <GlassPanel variant="panel" zIndex={80}>
          <div className="max-h-[min(70vh,28rem)] overflow-x-hidden overflow-y-auto p-2 sm:max-h-[min(75vh,32rem)]">
            <SearchFilterPanel
              viewerRef={viewerRef}
              open={panel === "search"}
              onClose={() => setPanel(null)}
            />
          </div>
        </GlassPanel>
      </div>,
      portalRoot,
    );

  return (
    <>
      <div className="pointer-events-none fixed bottom-[max(0.65rem,env(safe-area-inset-bottom))] left-1/2 z-40 w-[min(100vw-1rem,36rem)] -translate-x-1/2 px-1 sm:bottom-5 sm:w-auto sm:px-0">
        <GlassPanel
          variant="panel"
          zIndex={40}
          wrapperClassName="pointer-events-auto mx-auto max-w-full"
        >
          <div className="flex w-full max-w-full items-center gap-0 px-1 py-1 sm:gap-1 sm:px-2 sm:py-1">
            <div className="flex-1 min-w-0">
              <ToolTipWrap
                label={t(uiLanguage, "fitModel")}
                hint={t(uiLanguage, "fitModelHint")}
              >
                <button
                  type="button"
                  className={btnIdle}
                  aria-label={t(uiLanguage, "fitModel")}
                  onClick={() => viewerRef.current?.fitVisible()}
                >
                  <MdZoomInMap className="h-[18px] w-[18px]" />
                </button>
              </ToolTipWrap>
            </div>

            <div className="flex-1 min-w-0">
              <ToolTipWrap
                label={t(uiLanguage, "searchFilter")}
                hint={t(uiLanguage, "searchFilterHint")}
              >
                <button
                  ref={searchBtnRef}
                  type="button"
                  className={
                    panel === "search" || activeFilter ? btnActive : btnIdle
                  }
                  aria-label={t(uiLanguage, "searchFilter")}
                  aria-expanded={panel === "search"}
                  onClick={() =>
                    setPanel((p) => (p === "search" ? null : "search"))
                  }
                >
                  <IoSearchOutline className="h-[18px] w-[18px]" />
                </button>
              </ToolTipWrap>
            </div>

            <div className="flex-1 min-w-0">
              <ToolTipWrap
                label={t(uiLanguage, "shading")}
                hint={t(uiLanguage, "shadingHint")}
              >
                <button
                  ref={shadeBtnRef}
                  type="button"
                  className={panel === "shade" ? btnActive : btnIdle}
                  aria-label={t(uiLanguage, "shading")}
                  aria-expanded={panel === "shade"}
                  onClick={() =>
                    setPanel((p) => (p === "shade" ? null : "shade"))
                  }
                >
                  <VscSymbolColor className="h-[18px] w-[18px]" />
                </button>
              </ToolTipWrap>
            </div>

            <div className="flex-1 min-w-0">
              <ToolTipWrap
                label={t(uiLanguage, "lighting")}
                hint={t(uiLanguage, "lightingHint")}
              >
                <button
                  ref={lightBtnRef}
                  type="button"
                  className={panel === "light" ? btnActive : btnIdle}
                  aria-label={t(uiLanguage, "lighting")}
                  aria-expanded={panel === "light"}
                  onClick={() =>
                    setPanel((p) => (p === "light" ? null : "light"))
                  }
                >
                  <CiLight className="h-[18px] w-[18px]" />
                </button>
              </ToolTipWrap>
            </div>

            <div className="flex-1 min-w-0">
              <ToolTipWrap
                label={t(uiLanguage, "saveView")}
                hint={t(uiLanguage, "saveViewHint")}
              >
                <button
                  ref={saveBtnRef}
                  type="button"
                  className={panel === "save" ? btnActive : btnIdle}
                  aria-label={t(uiLanguage, "saveView")}
                  aria-expanded={panel === "save"}
                  onClick={() => {
                    setPanel((p) => {
                      if (p === "save") return null;
                      setViewName(defaultSaveViewName());
                      return "save";
                    });
                  }}
                >
                  <LiaStreetViewSolid className="h-[18px] w-[18px]" />
                </button>
              </ToolTipWrap>
            </div>

            <div className="flex-1 min-w-0">
              <ToolTipWrap
                label={
                  isFullscreen
                    ? t(uiLanguage, "exitFullscreen")
                    : t(uiLanguage, "fullscreen")
                }
                hint={
                  isFullscreen
                    ? t(uiLanguage, "exitFullscreenHint")
                    : t(uiLanguage, "fullscreenHint")
                }
              >
                <button
                  type="button"
                  className={isFullscreen ? btnActive : btnIdle}
                  aria-label={
                    isFullscreen
                      ? t(uiLanguage, "exitFullscreen")
                      : t(uiLanguage, "fullscreen")
                  }
                  onClick={() => void toggleFullscreen()}
                >
                  {isFullscreen ? (
                    <BsFullscreenExit className="h-[18px] w-[18px]" />
                  ) : (
                    <BsFullscreen className="h-[18px] w-[18px]" />
                  )}
                </button>
              </ToolTipWrap>
            </div>

            <div className="hidden sm:block mx-0.5 h-4 w-px bg-[var(--panel-divider)]" aria-hidden />

            <div className="flex-1 min-w-0">
              <ToolTipWrap
                label={
                  isPresentationView
                    ? t(uiLanguage, "backToNormal")
                    : t(uiLanguage, "presentationView")
                }
                hint={
                  isPresentationView
                    ? t(uiLanguage, "backToNormalHint")
                    : t(uiLanguage, "presentationHint")
                }
              >
                <button
                  type="button"
                  className={
                    isPresentationView
                      ? btnPresentationOn
                      : btnPresentationIdle
                  }
                  aria-label={
                    isPresentationView
                      ? t(uiLanguage, "backToNormal")
                      : t(uiLanguage, "presentationView")
                  }
                  aria-pressed={isPresentationView}
                  onClick={() => void togglePresentation()}
                >
                  <LuPresentation className="h-[18px] w-[18px]" />
                </button>
              </ToolTipWrap>
            </div>
          </div>
        </GlassPanel>
      </div>
      {shadeMenu}
      {lightMenu}
      {saveMenu}
      {searchMenu}
    </>
  );
}
