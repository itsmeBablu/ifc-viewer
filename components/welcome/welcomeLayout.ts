/**
 * Welcome screen layout tiers.
 */

export type WelcomeLayoutTier = "stacked" | "splitCompact" | "splitSpacious";

export type WelcomeLayoutConfig = {
  tier: WelcomeLayoutTier;
  isWide: boolean;
  isMobileForm: boolean;
  isMobileLandscape: boolean;
  viewportClass: string;
  formClass: string;
  shellClass: string;
  headerClass: string;
  logoClass: string;
  titleClass: string;
  showSubtitle: boolean;
  fieldsClass: string;
  cardClass: string;
  themeCardClass: string;
  seasonalCardClass: string;
  seasonalHintClass: string;
  togglesRowClass: string;
  toggleCellClass: string;
  inputClass: string;
  labelClass: string;
  bodyTextClass: string;
  hintClass: string;
  actionsClass: string;
  primaryBtnClass: string;
  secondaryBtnClass: string;
  languageCompact: boolean;
  formMaxWidth: string;
  contentBlockClass: string;
};

export function getWelcomeLayout(width: number, height: number): WelcomeLayoutConfig {
  const isLandscape = width > height;
  const isWide = isLandscape && width >= 568 && height >= 280;
  const isShort = height < 520;
  const isSpacious = isWide && height >= 560 && width >= 900;

  const cardBase =
    "rounded-2xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] backdrop-blur-sm";
  const inputBase =
    "box-border w-full rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-sm text-[var(--text-strong)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--text-muted)] focus:border-amber-300/80 focus:shadow-[0_0_0_3px_rgba(251,191,36,0.2)]";
  const togglesRow = `flex items-stretch gap-0 overflow-hidden ${cardBase} p-0`;
  const toggleCell =
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-2 py-2 sm:gap-1.5 sm:px-3 sm:py-2.5";

  const mobileShared = {
    isMobileForm: true as const,
    isMobileLandscape: false as const,
    themeCardClass: `${cardBase} shrink-0 px-3.5 py-3`,
    seasonalCardClass: `${cardBase} shrink-0 px-3.5 py-3`,
    seasonalHintClass: "text-[11px] leading-relaxed text-[var(--text-muted)] mt-1",
    togglesRowClass: "",
    toggleCellClass: "",
    hintClass: "hidden",
    languageCompact: false as const,
    fieldsClass: "welcome-mobile-fields flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain",
    cardClass: `${cardBase} shrink-0 px-3.5 py-3`,
    inputClass: `${inputBase} h-11 shrink-0 px-3.5 py-2.5`,
    labelClass: "mb-1.5 block shrink-0 text-xs font-semibold tracking-wide text-[var(--text-muted)]",
    bodyTextClass: "text-xs font-semibold text-[var(--text-body)]",
    actionsClass: "welcome-mobile-actions flex shrink-0 flex-row gap-2 pt-1.5",
    primaryBtnClass:
      "order-2 min-h-11 flex-1 font-semibold active:scale-[0.98] border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)] backdrop-blur-md text-sm px-4 py-2.5",
    secondaryBtnClass:
      "order-1 min-h-11 flex-1 font-semibold active:scale-[0.98] border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-body)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-md hover:border-[var(--glass-border)] text-xs px-3.5 py-2.5",
    contentBlockClass:
      "flex h-full min-h-0 w-full flex-1 flex-col gap-2.5 overflow-hidden",
    formMaxWidth: "w-full h-full min-h-0",
    showSubtitle: false,
  };

  if (!isWide) {
    const viewFlex = height < 700 ? "flex-[7]" : "flex-[8]";
    const formFlex = height < 700 ? "flex-[13]" : "flex-[12]";

    return {
      tier: "stacked",
      isWide: false,
      viewportClass: `relative order-1 min-h-0 w-full ${viewFlex} shrink-0 overflow-hidden border-b border-[var(--panel-divider)]`,
      formClass: `order-2 flex min-h-0 ${formFlex} flex-col overflow-hidden`,
      shellClass:
        "flex h-full min-h-0 flex-1 flex-col overflow-hidden px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
      headerClass: "flex shrink-0 flex-col items-center text-center",
      logoClass: isShort ? "mb-1 h-6 w-auto object-contain" : "mb-1.5 h-7 w-auto object-contain",
      titleClass:
        "text-[clamp(0.9375rem,4vw,1.05rem)] font-semibold leading-tight tracking-tight text-[var(--text-strong)]",
      ...mobileShared,
    };
  }

  if (isSpacious) {
    return {
      tier: "splitSpacious",
      isWide: true,
      isMobileForm: false,
      isMobileLandscape: false,
      viewportClass:
        "relative order-1 h-full min-h-0 min-w-0 flex-1 overflow-hidden border-r border-[var(--panel-divider)]",
      formClass: "order-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
      shellClass:
        "flex h-full min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-[clamp(1.5rem,3vw,2.5rem)] py-[clamp(1rem,3vh,2rem)]",
      headerClass: "flex shrink-0 flex-col items-start text-left",
      logoClass: "mb-4 h-10 w-auto object-contain sm:h-11 md:h-12",
      titleClass: "text-xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-2xl",
      showSubtitle: true,
      fieldsClass: "flex w-full shrink-0 flex-col gap-3",
      cardClass: `${cardBase} px-4 py-3`,
      themeCardClass: "",
      seasonalCardClass: "",
      seasonalHintClass: "",
      togglesRowClass: togglesRow,
      toggleCellClass: `${toggleCell} sm:px-4 sm:py-3`,
      inputClass: `${inputBase} min-h-12 px-4 py-3`,
      labelClass: "mb-1.5 block text-xs font-semibold tracking-wide text-[var(--text-muted)]",
      bodyTextClass: "text-sm font-medium text-[var(--text-body)]",
      hintClass: "mt-0.5 text-xs text-[var(--text-muted)]",
      actionsClass: "flex w-full shrink-0 flex-col gap-2.5",
      primaryBtnClass:
        "w-full min-h-12 font-semibold active:scale-[0.98] border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)] backdrop-blur-md text-base px-6 py-3",
      secondaryBtnClass:
        "w-full min-h-12 font-semibold active:scale-[0.98] border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-body)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-md hover:border-[var(--glass-border)] text-base px-6 py-3",
      languageCompact: false,
      formMaxWidth: "w-full max-w-md",
      contentBlockClass: "flex w-full max-w-md shrink-0 flex-col gap-4 sm:gap-5",
    };
  }

  /* Mobile landscape — compact grid, no scroll */
  return {
    tier: "splitCompact",
    isWide: true,
    isMobileForm: true,
    isMobileLandscape: true,
    viewportClass:
      "relative order-1 h-full min-h-0 min-w-0 flex-1 overflow-hidden border-r border-[var(--panel-divider)]",
    formClass: "order-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
    shellClass:
      "flex h-full min-h-0 flex-1 flex-col overflow-hidden px-2 py-1 sm:px-2.5",
    headerClass: "flex shrink-0 flex-row items-center gap-1.5 w-full",
    logoClass: "mb-0 h-5 w-auto shrink-0 object-contain",
    titleClass: "text-xs font-semibold leading-tight tracking-tight text-[var(--text-strong)]",
    showSubtitle: false,
    fieldsClass:
      "welcome-mobile-fields welcome-mobile-landscape flex min-h-0 flex-1 flex-col justify-center gap-1 overflow-hidden",
    cardClass: `${cardBase} welcome-mobile-lang shrink-0 px-2 py-1`,
    themeCardClass: `${cardBase} welcome-mobile-theme shrink-0 px-2 py-1`,
    seasonalCardClass: `${cardBase} shrink-0 px-2 py-1`,
    seasonalHintClass: "line-clamp-2 text-[9px] leading-tight text-[var(--text-muted)]",
    togglesRowClass: "",
    toggleCellClass: "",
    hintClass: "hidden",
    languageCompact: true,
    inputClass: `${inputBase} h-8 shrink-0 px-2.5 py-1 text-xs`,
    labelClass: "mb-0.5 block shrink-0 text-[10px] font-semibold tracking-wide text-[var(--text-muted)]",
    bodyTextClass: "shrink-0 text-[10px] font-medium text-[var(--text-body)]",
    actionsClass: "welcome-mobile-actions flex shrink-0 flex-row gap-1.5",
    primaryBtnClass:
      "order-2 h-8 min-h-0 flex-1 font-semibold active:scale-[0.98] border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)] backdrop-blur-md text-[11px] px-2 py-1",
    secondaryBtnClass:
      "order-1 h-8 min-h-0 flex-1 font-semibold active:scale-[0.98] border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-body)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-md hover:border-[var(--glass-border)] text-[10px] px-2 py-1",
    contentBlockClass:
      "grid h-full min-h-0 w-full flex-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-0.5 overflow-hidden",
    formMaxWidth: "w-full h-full min-h-0",
  };
}
