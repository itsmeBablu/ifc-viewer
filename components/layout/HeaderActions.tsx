"use client";

/**
 * HeaderActions — the app's top-left header bar: logo, mode-selector menu
 * (Bauteile / Heizung / Kälte / Wohnungslüftung / Werkzeuge), the IFC upload
 * button, and a Profil menu (language, theme, seasonal background).
 *
 * Renders as a single animated glass shell (GSAP-driven width/opacity) that
 * expands on hover/pin and collapses on mobile. Dropdowns (mode menu, profile
 * menu, language flyout) are hover-opened with short close-grace timers so
 * the pointer can travel from the trigger button into the portalled menu
 * without it closing prematurely; menus are positioned via `createPortal`
 * against live `getBoundingClientRect()` measurements rather than CSS anchoring.
 *
 * Coupled to the left FloorsPanel: whenever any header dropdown (mode menu,
 * profile menu, or the "Cargar IFC" hover tip) is open, an effect calls
 * `useAppStore`'s `setLeftPanelOpen(false)` to auto-collapse FloorsPanel so
 * the two don't visually overlap; it restores `setLeftPanelOpen(true)` once
 * all three close. This sync is desktop/tablet only — mobile has its own
 * corner-menu layout (see MobileCornerMenu) and skips the collapse.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import Image from "next/image";
import { MdOutlineAccountCircle } from "react-icons/md";
import {
  headerCollapsedMinWidthPx,
  isCompactMobileViewport,
  leftPanelWidthPx,
} from "@/lib/layoutTokens";
import { gsapDuration, gsapEase, killGsap } from "@/lib/gsapMotion";
import { t } from "@/lib/i18n";
import { OPEN_IFC_FILE_EVENT } from "@/lib/viewerHotkeys";
import { useAppStore } from "@/store/useAppStore";
import { useModelSummary } from "@/lib/useModelSummary";
import GsapPopMenu from "../common/GsapPopMenu";
import GlassPanel from "../common/GlassPanel";
import ThemeToggle from "../common/ThemeToggle";
import SeasonalBgToggle from "../common/SeasonalBgToggle";
import {
  HEADER_MODE_ICON,
  isDataViewMode,
  type HeaderMode,
} from "@/lib/dataViewMode";

type ProfileHoverId = "language" | "theme" | "seasonalBg" | "en" | "de" | "es";

const menuRowIdle =
  "box-border border border-transparent transition-[background-color,border-color,box-shadow,color] duration-200";

function menuRowStyles(isDark: boolean) {
  const surface = isDark
    ? "amber-gloss-surface border border-amber-300/80 bg-gradient-to-br from-amber-300/92 via-yellow-200/82 to-amber-400/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_4px_16px_rgba(251,191,36,0.4)] backdrop-blur-md"
    : "amber-gloss-surface border border-amber-200/70 bg-gradient-to-br from-amber-200/90 via-yellow-300/70 to-amber-400/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_14px_rgba(251,191,36,0.28)] backdrop-blur-md";
  return {
    highlight: `${surface} font-semibold text-amber-950`,
    surfaceHighlight: `${surface} text-amber-950`,
  };
}

type Props = {
  onFile: (file: File) => void;
  hasModel: boolean;
  isLoadingModel: boolean;
};

function ModeIcon({
  mode,
  className = "h-5 w-5 object-contain sm:h-[1.35rem] sm:w-[1.35rem]",
}: {
  mode: HeaderMode;
  className?: string;
}) {
  return (
    <Image
      src={HEADER_MODE_ICON[mode]}
      alt=""
      width={22}
      height={22}
      className={className}
      aria-hidden
    />
  );
}

function UploadIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 16V5" />
      <path d="m8 9 4-4 4 4" />
      <path d="M4 19h16" />
    </svg>
  );
}

/** Hover explanation popup below a header control. */
function HeaderTip({
  label,
  hint,
  content,
  wide = false,
  onOpenChange,
  children,
}: {
  label: string;
  hint: string;
  /** Overrides the default label/hint text with richer content (e.g. model info). */
  content?: ReactNode;
  wide?: boolean;
  /** Notified whenever the hover/focus tip opens or closes. */
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [suppressed, setSuppressed] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    onOpenChange?.(open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updatePos = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 10, left: r.left + r.width / 2 });
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

  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!tip) return;
    if (open) {
      gsap.fromTo(
        tip,
        { autoAlpha: 0, y: 4 },
        { autoAlpha: 1, y: 0, duration: gsapDuration.tooltip, ease: gsapEase.iosOut },
      );
    }
  }, [open, pos.top, pos.left]);

  return (
    <div
      ref={wrapRef}
      className="relative flex h-full items-center justify-center self-stretch"
      onMouseEnter={() => {
        if (suppressed) return;
        updatePos();
        setOpen(true);
      }}
      onMouseLeave={() => {
        setOpen(false);
        setSuppressed(false);
      }}
      onFocus={() => {
        if (suppressed) return;
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
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            className={`pointer-events-none fixed z-[200] w-max -translate-x-1/2 ${
              wide ? "max-w-[16rem]" : "max-w-[220px]"
            }`}
            style={{ top: pos.top, left: pos.left, visibility: "hidden" }}
          >
            <GlassPanel variant="control" zIndex={200}>
              {content ?? (
                <div className="px-3 py-2 text-center">
                  <p className="text-[11px] font-semibold tracking-wide text-[var(--text-strong)]">
                    {label}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-snug text-[var(--text-muted)]">
                    {hint}
                  </p>
                </div>
              )}
            </GlassPanel>
          </div>,
          document.body,
        )}
    </div>
  );
}

/**
 * Logo header — glass expands to reveal Heating / Data / Profile inside.
 */
export default function HeaderActions({
  onFile,
  hasModel,
  isLoadingModel,
}: Props) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const setUiLanguage = useAppStore((s) => s.setUiLanguage);
  const { modelLabel, tiles: modelTiles } = useModelSummary();
  const dataViewMode = useAppStore((s) => s.dataViewMode);
  const setDataViewMode = useAppStore((s) => s.setDataViewMode);
  const colorTheme = useAppStore((s) => s.colorTheme);
  const isDark = colorTheme === "dark";
  const { highlight: menuRowHighlight, surfaceHighlight: menuRowSurfaceHighlight } =
    menuRowStyles(isDark);

  const toolMode = useAppStore((s) => s.toolMode);
  const setToolMode = useAppStore((s) => s.setToolMode);
  const bauteilMode = useAppStore((s) => s.bauteilMode);
  const setBauteilMode = useAppStore((s) => s.setBauteilMode);
  const setLeftPanelOpen = useAppStore((s) => s.setLeftPanelOpen);
  const mode: HeaderMode = toolMode ? "editor" : bauteilMode ? "bauteil" : dataViewMode;
  const [modeOpen, setModeOpen] = useState(false);
  /** Cargar IFC hover/focus tip open — mirrored into FloorsPanel's open state. */
  const [dataTipOpen, setDataTipOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [languageExpanded, setLanguageExpanded] = useState(false);
  /** Which dropdown row is under the pointer — highlight follows this, not only selection. */
  const [modeHoverId, setModeHoverId] = useState<HeaderMode | null>(null);
  /** Which profile dropdown row is under the pointer — highlight follows cursor. */
  const [profileHoverId, setProfileHoverId] = useState<ProfileHoverId | null>(
    null,
  );
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [isWideHeader, setIsWideHeader] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
  );
  /** Phone only — desktop / iPad keep the header open (no hover auto-close). */
  const [isMobileHeader, setIsMobileHeader] = useState(
    () => typeof window !== "undefined" && isCompactMobileViewport(),
  );
  const [logoReady, setLogoReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<SVGSVGElement>(null);
  const iconsRef = useRef<HTMLDivElement>(null);
  const headerReady = useRef(false);
  const modeBtnRef = useRef<HTMLButtonElement>(null);
  const [modePos, setModePos] = useState({ top: 0, left: 0 });
  const didSyncFloorsRef = useRef(false);
  const modeCloseTimer = useRef<number | null>(null);
  const profileCloseTimer = useRef<number | null>(null);
  const languageRowRef = useRef<HTMLButtonElement>(null);
  const [langFlyoutPos, setLangFlyoutPos] = useState({ top: 0, left: 0 });

  const expanded =
    !isMobileHeader || pinned || hovered || modeOpen || profileOpen;
  const showMode = isWideHeader || expanded;
  const showActions = expanded;

  const measureCollapsedWidth = () => {
    const min = headerCollapsedMinWidthPx();
    const inner = innerRef.current;
    if (!inner) return min;
    const prev = inner.style.width;
    inner.style.width = "auto";
    const w = inner.scrollWidth;
    inner.style.width = prev;
    return Math.max(w, min);
  };

  useEffect(() => {
    const mqWide = window.matchMedia("(min-width: 768px)");
    const update = () => {
      setIsWideHeader(mqWide.matches);
      setIsMobileHeader(isCompactMobileViewport());
    };
    update();
    mqWide.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      mqWide.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    const img = innerRef.current?.querySelector("img");
    if (img?.complete) setLogoReady(true);
  }, []);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const inner = innerRef.current;
    const icons = iconsRef.current;
    if (!shell || !inner) return;

    const targetWidth = expanded
      ? leftPanelWidthPx()
      : measureCollapsedWidth();
    const start = shell.offsetWidth;

    if (!headerReady.current) {
      gsap.set(shell, { width: targetWidth });
      if (icons) gsap.set(icons, { autoAlpha: 1 });
      headerReady.current = true;
      return;
    }

    shell.style.width = `${start}px`;
    killGsap(shell);
    gsap.to(shell, {
      width: targetWidth,
      duration: gsapDuration.sidebar,
      ease: gsapEase.panel,
    });

    if (icons) {
      killGsap(icons);
      if (expanded) {
        gsap.fromTo(
          icons,
          { autoAlpha: 0.65 },
          {
            autoAlpha: 1,
            duration: gsapDuration.sidebar * 0.85,
            ease: gsapEase.iosOut,
          },
        );
      }
    }
  }, [expanded, showMode, showActions, isWideHeader, modeOpen, profileOpen, hasModel, logoReady]);

  useEffect(() => {
    const onResize = () => {
      const shell = shellRef.current;
      if (!shell || !expanded) return;
      gsap.to(shell, {
        width: leftPanelWidthPx(),
        duration: gsapDuration.fast,
        ease: gsapEase.panel,
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [expanded]);

  useLayoutEffect(() => {
    const chevron = chevronRef.current;
    if (!chevron) return;
    killGsap(chevron);
    gsap.to(chevron, {
      rotation: expanded ? 0 : 180,
      duration: gsapDuration.sidebar * 0.65,
      ease: gsapEase.iosOut,
    });
  }, [expanded]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        if (modeCloseTimer.current != null) window.clearTimeout(modeCloseTimer.current);
        if (profileCloseTimer.current != null) window.clearTimeout(profileCloseTimer.current);
        setModeOpen(false);
        setProfileOpen(false);
        setLanguageExpanded(false);
        setModeHoverId(null);
        setProfileHoverId(null);
        // Auto-collapse header only on mobile; desktop/iPad stay open.
        if (isCompactMobileViewport()) {
          setHovered(false);
          setPinned(false);
        }
      }
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  useEffect(() => {
    const openPicker = () => {
      if (isLoadingModel) return;
      fileInputRef.current?.click();
    };
    window.addEventListener(OPEN_IFC_FILE_EVENT, openPicker);
    return () => window.removeEventListener(OPEN_IFC_FILE_EVENT, openPicker);
  }, [isLoadingModel]);

  useEffect(() => {
    return () => {
      if (modeCloseTimer.current != null) window.clearTimeout(modeCloseTimer.current);
      if (profileCloseTimer.current != null) window.clearTimeout(profileCloseTimer.current);
    };
  }, []);

  /** Mode dropdown position — anchored to the mode button itself, like HeaderTip. */
  const updateModePos = () => {
    const el = modeBtnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setModePos({ top: r.bottom + 8, left: r.left });
  };

  useLayoutEffect(() => {
    if (!modeOpen) return;
    updateModePos();
    window.addEventListener("resize", updateModePos);
    window.addEventListener("scroll", updateModePos, true);
    return () => {
      window.removeEventListener("resize", updateModePos);
      window.removeEventListener("scroll", updateModePos, true);
    };
  }, [modeOpen]);

  /** Any header dropdown opening auto-collapses FloorsPanel; closing restores it. */
  useEffect(() => {
    if (isMobileHeader) return;
    if (!didSyncFloorsRef.current) {
      didSyncFloorsRef.current = true;
      return;
    }
    setLeftPanelOpen(!modeOpen && !dataTipOpen && !profileOpen);
  }, [modeOpen, dataTipOpen, profileOpen, isMobileHeader, setLeftPanelOpen]);

  /** Language flyout position — anchored to the Sprache row, opening to its right. */
  const updateLangFlyoutPos = () => {
    const el = languageRowRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setLangFlyoutPos({ top: r.top, left: r.right + 8 });
  };

  useLayoutEffect(() => {
    if (!languageExpanded) return;
    updateLangFlyoutPos();
    window.addEventListener("resize", updateLangFlyoutPos);
    window.addEventListener("scroll", updateLangFlyoutPos, true);
    return () => {
      window.removeEventListener("resize", updateLangFlyoutPos);
      window.removeEventListener("scroll", updateLangFlyoutPos, true);
    };
  }, [languageExpanded]);

  const cancelModeMenuClose = () => {
    if (modeCloseTimer.current != null) {
      window.clearTimeout(modeCloseTimer.current);
      modeCloseTimer.current = null;
    }
  };
  /** Hover opens the mode menu — mirrors the Cargar IFC / Profil hover tips. */
  const openModeMenu = () => {
    cancelModeMenuClose();
    setModeOpen(true);
    setProfileOpen(false);
    setLanguageExpanded(false);
    setProfileHoverId(null);
    setHovered(true);
  };
  /** Small grace delay so moving the pointer from the button into the portalled
   *  menu below it doesn't close the menu before the pointer arrives. */
  const closeModeMenuSoon = () => {
    cancelModeMenuClose();
    modeCloseTimer.current = window.setTimeout(() => {
      setModeOpen(false);
      setModeHoverId(null);
    }, 150);
  };

  const cancelProfileMenuClose = () => {
    if (profileCloseTimer.current != null) {
      window.clearTimeout(profileCloseTimer.current);
      profileCloseTimer.current = null;
    }
  };
  const openProfileMenu = () => {
    cancelProfileMenuClose();
    setProfileOpen(true);
    setModeOpen(false);
    setModeHoverId(null);
    setProfileHoverId(null);
  };
  const closeProfileMenuSoon = () => {
    cancelProfileMenuClose();
    profileCloseTimer.current = window.setTimeout(() => {
      setProfileOpen(false);
      setProfileHoverId(null);
      setLanguageExpanded(false);
    }, 150);
  };

  const modeOptions: { id: HeaderMode; label: string; shortcut: string }[] = [
    { id: "bauteil", label: t(uiLanguage, "bauteil"), shortcut: "B" },
    { id: "heizlast", label: t(uiLanguage, "heating"), shortcut: "H" },
    { id: "kuhllast", label: t(uiLanguage, "cooling"), shortcut: "K" },
    { id: "luftung", label: t(uiLanguage, "ventilation"), shortcut: "L" },
    { id: "editor", label: t(uiLanguage, "tool"), shortcut: "W" },
  ];

  const yellowGloss = isDark
    ? "amber-gloss-surface border border-amber-300/80 bg-gradient-to-br from-amber-300/95 via-yellow-200/88 to-amber-400/78 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_4px_16px_rgba(251,191,36,0.42)] backdrop-blur-md"
    : "amber-gloss-surface border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)] backdrop-blur-md";
  const roundBtn =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-[color,background,border,box-shadow,transform] duration-300 ease-out active:scale-95 sm:h-9 sm:w-9";
  const roundIdle = isDark
    ? `${roundBtn} border border-transparent text-[var(--toolbar-icon)] hover:border-amber-300/80 hover:bg-gradient-to-br hover:from-amber-300/95 hover:via-yellow-200/88 hover:to-amber-400/78 hover:text-amber-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_4px_16px_rgba(251,191,36,0.42)]`
    : `${roundBtn} border border-transparent text-zinc-700 hover:border-amber-200/70 hover:bg-gradient-to-br hover:from-amber-200/95 hover:via-yellow-300/85 hover:to-amber-400/75 hover:text-amber-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)]`;
  const roundActive = `${roundBtn} ${yellowGloss}`;

  const sideBtn =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-[color,background,border,box-shadow,transform] duration-300 ease-out active:scale-95 sm:h-9 sm:w-9";
  const sideIdle = isDark
    ? `${sideBtn} border border-transparent text-[var(--toolbar-icon)] hover:border-amber-300/80 hover:bg-gradient-to-br hover:from-amber-300/95 hover:via-yellow-200/88 hover:to-amber-400/78 hover:text-amber-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_4px_16px_rgba(251,191,36,0.42)]`
    : `${sideBtn} border border-transparent text-[var(--toolbar-icon)] hover:border-amber-200/70 hover:bg-gradient-to-br hover:from-amber-200/95 hover:via-yellow-300/85 hover:to-amber-400/75 hover:text-amber-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)]`;
  const sideActive = `${sideBtn} ${yellowGloss}`;

  const showIconLabels = !isMobileHeader;
  /** Tight icon→caption gap; fill header height so the pair sits vertically centered. */
  const iconStack =
    "flex h-full flex-col items-center justify-center gap-px";
  /** Wraps to 2 lines instead of truncating — some translations (es/en) run long. */
  const iconCaption =
    "line-clamp-2 max-w-[6.75rem] break-words text-center text-[9px] font-semibold leading-tight tracking-wide text-[var(--text-muted)]";

  function ModeShortcutLabel({
    label,
    shortcut,
  }: {
    label: string;
    shortcut: string;
  }) {
    const idx = label.toLocaleLowerCase().indexOf(shortcut.toLocaleLowerCase());
    // Shortcut letters are German initials — when a translation doesn't
    // contain the letter naturally, just show the label (no loose letter).
    if (idx < 0) return <span>{label}</span>;
    return (
      <span>
        {label.slice(0, idx)}
        <span className="underline decoration-1 underline-offset-2">
          {label.slice(idx, idx + 1)}
        </span>
        {label.slice(idx + 1)}
      </span>
    );
  }
  const modeLabel =
    mode === "editor"
      ? t(uiLanguage, "tool")
      : mode === "bauteil"
        ? t(uiLanguage, "bauteil")
        : mode === "luftung"
          ? t(uiLanguage, "ventilation")
          : mode === "kuhllast"
            ? t(uiLanguage, "cooling")
            : t(uiLanguage, "heating");

  return (
    <div
      ref={rootRef}
      data-app-header-actions
      className="pointer-events-auto fixed top-2 left-2 z-[45] sm:top-3 md:left-4"
      onMouseEnter={() => {
        if (isMobileHeader) setHovered(true);
      }}
      onMouseLeave={() => {
        if (
          isMobileHeader &&
          !modeOpen &&
          !profileOpen &&
          !pinned
        ) {
          setHovered(false);
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".ifc,.frag,application/x-step,application/octet-stream,.IFC,.FRAG"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />

      {typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[50]"
            style={{ top: modePos.top, left: modePos.left }}
            onMouseEnter={cancelModeMenuClose}
            onMouseLeave={closeModeMenuSoon}
          >
            <GsapPopMenu show={modeOpen} onMouseLeave={() => setModeHoverId(null)}>
              <GlassPanel variant="menu" zIndex={50}>
                <div className="w-max min-w-[12rem] divide-y divide-zinc-200/70 p-1 text-xs text-[var(--text-body)]">
                  {modeOptions.map((opt) => {
                    const selected = mode === opt.id;
                    const highlighted =
                      modeHoverId != null ? modeHoverId === opt.id : selected;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onMouseEnter={() => setModeHoverId(opt.id)}
                        onClick={() => {
                          if (opt.id === "bauteil") {
                            setToolMode(false);
                            setBauteilMode(true);
                          } else if (isDataViewMode(opt.id)) {
                            setToolMode(false);
                            setBauteilMode(false);
                            setDataViewMode(opt.id);
                          } else {
                            setBauteilMode(false);
                            setToolMode(true);
                          }
                          setModeOpen(false);
                          setModeHoverId(null);
                        }}
                        className={`flex w-full items-center whitespace-nowrap rounded-xl px-2.5 py-1.5 text-left ${
                          highlighted
                            ? menuRowHighlight
                            : `${menuRowIdle} ${selected ? "font-semibold text-[var(--text-strong)]" : ""}`
                        }`}
                      >
                        <span className="mr-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--chip-active-bg)]">
                          <ModeIcon
                            mode={opt.id}
                            className="h-4 w-4 object-contain"
                          />
                        </span>
                        <ModeShortcutLabel
                          label={opt.label}
                          shortcut={opt.shortcut}
                        />
                      </button>
                    );
                  })}
                </div>
              </GlassPanel>
            </GsapPopMenu>
          </div>,
          document.body,
        )}

      <div className="relative w-full">
        <GsapPopMenu
          show={profileOpen}
          className="absolute top-[calc(100%+0.45rem)] right-0 z-[50]"
          onMouseEnter={cancelProfileMenuClose}
          onMouseLeave={() => {
            setProfileHoverId(null);
            closeProfileMenuSoon();
          }}
        >
          <GlassPanel variant="menu" zIndex={50}>
            <div className="box-border w-[13.25rem] p-1.5 sm:w-[14.25rem] sm:p-2">
              <p className="mb-1.5 px-1.5 text-[10px] font-semibold tracking-wide text-[var(--text-muted)]">
                {t(uiLanguage, "profile")}
              </p>

              <button
                ref={languageRowRef}
                type="button"
                onClick={() => setLanguageExpanded((v) => !v)}
                aria-expanded={languageExpanded}
                onMouseEnter={() => setProfileHoverId("language")}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs ${
                  (profileHoverId != null
                    ? profileHoverId === "language"
                    : languageExpanded)
                    ? menuRowHighlight
                    : `${menuRowIdle} text-[var(--text-body)]`
                }`}
              >
                <span>{t(uiLanguage, "language")}</span>
                <span className="h-4 w-4 shrink-0 overflow-hidden rounded-full border border-white/60 shadow-sm">
                  <Image
                    src={`/${uiLanguage}.svg`}
                    alt={uiLanguage}
                    width={16}
                    height={16}
                    className="h-full w-full object-cover"
                  />
                </span>
              </button>

              {typeof document !== "undefined" &&
                createPortal(
                  <div
                    className="fixed z-[55]"
                    style={{ top: langFlyoutPos.top, left: langFlyoutPos.left }}
                    onMouseEnter={cancelProfileMenuClose}
                    onMouseLeave={closeProfileMenuSoon}
                  >
                    <GsapPopMenu show={languageExpanded}>
                      <GlassPanel variant="menu" zIndex={55}>
                        <div className="w-max min-w-[9rem] space-y-1 p-1.5">
                          {(
                            [
                              ["en", "langEn"],
                              ["de", "langDe"],
                              ["es", "langEs"],
                            ] as const
                          ).map(([lang, labelKey]) => {
                            const selected = uiLanguage === lang;
                            const highlighted =
                              profileHoverId != null
                                ? profileHoverId === lang
                                : selected;
                            return (
                              <button
                                key={lang}
                                type="button"
                                onMouseEnter={() => setProfileHoverId(lang)}
                                onClick={() => {
                                  setUiLanguage(lang);
                                  setProfileHoverId(null);
                                  setLanguageExpanded(false);
                                }}
                                className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs ${
                                  highlighted
                                    ? menuRowHighlight
                                    : `${menuRowIdle} text-[var(--text-body)] ${selected ? "font-semibold text-[var(--text-strong)]" : ""}`
                                }`}
                              >
                                <span className="h-5 w-5 overflow-hidden rounded-full border border-white/60 shadow-sm">
                                  <Image
                                    src={`/${lang}.svg`}
                                    alt={lang}
                                    width={20}
                                    height={20}
                                    className="h-full w-full object-cover"
                                  />
                                </span>
                                {t(uiLanguage, labelKey)}
                              </button>
                            );
                          })}
                        </div>
                      </GlassPanel>
                    </GsapPopMenu>
                  </div>,
                  document.body,
                )}

              <div
                onMouseEnter={() => setProfileHoverId("theme")}
                className={`mt-1 box-border flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-1.5 ${
                  profileHoverId === "theme"
                    ? menuRowSurfaceHighlight
                    : menuRowIdle
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--text-body)]">
                    {t(uiLanguage, "theme")}
                  </p>
                  <p
                    className={`mt-0.5 text-[10px] leading-snug ${
                      profileHoverId === "theme"
                        ? "text-amber-900/75"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    {t(uiLanguage, "themeHint")}
                  </p>
                </div>
                <ThemeToggle />
              </div>

              <div
                onMouseEnter={() => setProfileHoverId("seasonalBg")}
                className={`mt-1 box-border flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-1.5 ${
                  profileHoverId === "seasonalBg"
                    ? menuRowSurfaceHighlight
                    : menuRowIdle
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--text-body)]">
                    {t(uiLanguage, "seasonalBg")}
                  </p>
                  <p
                    className={`mt-0.5 text-[10px] leading-snug ${
                      profileHoverId === "seasonalBg"
                        ? "text-amber-900/75"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    {t(uiLanguage, "seasonalBgHint")}
                  </p>
                </div>
                <SeasonalBgToggle />
              </div>
            </div>
          </GlassPanel>
        </GsapPopMenu>

        {/* One glass: logo + mode + Data/Profile + arrow — shell width animates via GSAP */}
        <div
          ref={shellRef}
          className="overflow-hidden rounded-3xl"
          style={
            expanded
              ? undefined
              : { minWidth: headerCollapsedMinWidthPx() }
          }
        >
          <GlassPanel
            variant="panel"
            zIndex={45}
            wrapperClassName={`relative min-w-0 overflow-hidden rounded-3xl ${expanded ? "w-full" : "inline-flex w-max"}`}
          >
            <div
              ref={innerRef}
              className={`flex items-stretch ${
                showIconLabels ? "h-[3.75rem]" : "h-10 sm:h-11"
              } ${expanded ? "w-full" : "w-max"} ${
                isMobileHeader ? "pr-5" : "pr-3 sm:pr-3.5"
              }`}
            >
              {/* Logo + mode — fixed left cluster (never shifts on expand) */}
              <div
                className={`flex shrink-0 items-center self-stretch pl-3 sm:pl-3.5 ${
                  showIconLabels ? "" : "py-1"
                }`}
              >
                <Image
                  src="/ibv_logo.svg"
                  alt="IBV logo"
                  width={132}
                  height={32}
                  className="h-6 w-auto max-w-none shrink-0 object-contain sm:h-7"
                  priority
                  onLoad={() => setLogoReady(true)}
                />

                {showMode && (
                  <>
                    <span
                      className={`mx-2.5 w-px shrink-0 self-center bg-amber-400/80 sm:mx-3 ${
                        showIconLabels ? "h-7" : "h-5 sm:h-6"
                      }`}
                      aria-hidden
                    />
                    <div className="relative flex h-full items-center justify-center self-stretch">
                      <button
                        ref={modeBtnRef}
                        type="button"
                        onMouseEnter={openModeMenu}
                        onMouseLeave={closeModeMenuSoon}
                        onClick={() => {
                          cancelModeMenuClose();
                          setModeOpen((v) => !v);
                          setProfileOpen(false);
                          setLanguageExpanded(false);
                          setProfileHoverId(null);
                          setModeHoverId(null);
                          setHovered(true);
                        }}
                        aria-expanded={modeOpen}
                        aria-label={modeLabel}
                        title={t(uiLanguage, "viewHintWithTool")}
                        className={
                          showIconLabels
                            ? iconStack
                            : modeOpen
                              ? roundActive
                              : roundIdle
                        }
                      >
                        {showIconLabels ? (
                          <>
                            <span className={modeOpen ? roundActive : roundIdle}>
                              <ModeIcon mode={mode} />
                            </span>
                            <span className={iconCaption}>{modeLabel}</span>
                          </>
                        ) : (
                          <ModeIcon mode={mode} />
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {showActions && (
                <div
                  ref={iconsRef}
                  className={`flex min-w-0 flex-1 items-center justify-evenly self-stretch px-2 sm:px-3 ${
                    showIconLabels ? "" : "py-1"
                  }`}
                >
                    <HeaderTip
                      label={t(uiLanguage, "data")}
                      hint={t(uiLanguage, "dataHint")}
                      wide={hasModel}
                      onOpenChange={setDataTipOpen}
                      content={
                        hasModel ? (
                          <div className="w-56 px-3 py-2.5">
                            <p className="mb-1.5 truncate text-center text-[11px] font-semibold text-[var(--text-strong)]">
                              {modelLabel}
                            </p>
                            <div className="flex items-stretch gap-1.5">
                              {modelTiles.map((tile, i) => (
                                <div
                                  key={i}
                                  className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] px-1 py-1.5 text-center"
                                >
                                  <span className="tabular-nums text-[13px] font-semibold text-[var(--text-strong)]">
                                    {tile.value}
                                  </span>
                                  <span className="truncate text-[9px] font-medium text-[var(--text-muted)]">
                                    {tile.unit}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <p className="mt-1.5 text-center text-[10px] font-medium tracking-wide text-amber-700/90">
                              {t(uiLanguage, "loadOtherIfcShortcut")}
                            </p>
                          </div>
                        ) : undefined
                      }
                    >
                      <button
                        type="button"
                        disabled={isLoadingModel}
                        onClick={() => {
                          setModeOpen(false);
                          setProfileOpen(false);
                          setLanguageExpanded(false);
                          fileInputRef.current?.click();
                        }}
                        aria-label={t(uiLanguage, "loadIfc")}
                        className={`${
                          showIconLabels
                            ? iconStack
                            : hasModel
                              ? sideActive
                              : sideIdle
                        } disabled:opacity-45`}
                      >
                        {showIconLabels ? (
                          <>
                            <span className={hasModel ? sideActive : sideIdle}>
                              <UploadIcon />
                            </span>
                            <span className={iconCaption}>
                              {t(uiLanguage, "ifcUpload")}
                            </span>
                          </>
                        ) : (
                          <UploadIcon />
                        )}
                      </button>
                    </HeaderTip>

                    <div className="relative flex h-full items-center justify-center self-stretch">
                      <button
                        type="button"
                        onMouseEnter={openProfileMenu}
                        onMouseLeave={closeProfileMenuSoon}
                        onClick={() => {
                          cancelProfileMenuClose();
                          setProfileOpen((v) => {
                            if (v) setLanguageExpanded(false);
                            return !v;
                          });
                          setModeOpen(false);
                          setModeHoverId(null);
                          setProfileHoverId(null);
                        }}
                        aria-expanded={profileOpen}
                        aria-label={t(uiLanguage, "profile")}
                        title={t(uiLanguage, "profileHint")}
                        className={
                          showIconLabels
                            ? iconStack
                            : profileOpen
                              ? sideActive
                              : sideIdle
                        }
                      >
                        {showIconLabels ? (
                          <>
                            <span
                              className={profileOpen ? sideActive : sideIdle}
                            >
                              <MdOutlineAccountCircle className="h-5 w-5 text-current sm:h-[1.35rem] sm:w-[1.35rem]" />
                            </span>
                            <span className={iconCaption}>
                              {t(uiLanguage, "profile")}
                            </span>
                          </>
                        ) : (
                          <MdOutlineAccountCircle className="h-5 w-5 text-current sm:h-[1.35rem] sm:w-[1.35rem]" />
                        )}
                      </button>
                    </div>
                </div>
              )}

              {isMobileHeader && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setPinned((v) => !v);
                  setHovered(true);
                }}
                aria-label={
                  expanded ? "Hide header actions" : "Show header actions"
                }
                className="absolute inset-y-0 right-0 z-20 flex w-5 touch-manipulation items-center justify-center rounded-r-3xl bg-zinc-400/30 text-zinc-600 transition-colors duration-300 ease-out hover:bg-zinc-400/45"
              >
                <svg
                  ref={chevronRef}
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m15 6-6 6 6 6" />
                </svg>
              </button>
              )}
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
