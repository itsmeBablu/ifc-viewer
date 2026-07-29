"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { MdOutlineAccountCircle } from "react-icons/md";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import GlassPanel from "./GlassPanel";

type HeaderMode = "heizlast" | "luftung" | "kuhllast" | "editor";

type Props = {
  onFile: (file: File) => void;
  hasModel: boolean;
  isLoadingModel: boolean;
};

const MODE_LETTER: Record<HeaderMode, string> = {
  heizlast: "H",
  luftung: "L",
  kuhllast: "K",
  editor: "T",
};

function UploadIcon() {
  return (
    <svg
      width="14"
      height="14"
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
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [suppressed, setSuppressed] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

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

  return (
    <div
      ref={wrapRef}
      className="relative flex items-center justify-center"
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
            role="tooltip"
            className="pointer-events-none fixed z-[200] w-max max-w-[220px] -translate-x-1/2 animate-[fadeTip_160ms_ease-out]"
            style={{ top: pos.top, left: pos.left }}
          >
            <GlassPanel variant="control" zIndex={200}>
              <div className="px-3 py-2 text-center">
                <p className="text-[11px] font-semibold tracking-wide text-zinc-900">
                  {label}
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-zinc-600">
                  {hint}
                </p>
              </div>
            </GlassPanel>
          </div>,
          document.body,
        )}
    </div>
  );
}

/**
 * Compact round Heating control — expands on hover to Data + Profile.
 */
export default function HeaderActions({
  onFile,
  hasModel,
  isLoadingModel,
}: Props) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const setUiLanguage = useAppStore((s) => s.setUiLanguage);

  const [mode, setMode] = useState<HeaderMode>("heizlast");
  const [modeOpen, setModeOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const expanded = hovered || modeOpen || langOpen;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setModeOpen(false);
        setLangOpen(false);
        setHovered(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const modeOptions: { id: HeaderMode; label: string }[] = [
    { id: "heizlast", label: t(uiLanguage, "appTitle") },
    { id: "luftung", label: t(uiLanguage, "optionsLuft") },
    { id: "kuhllast", label: t(uiLanguage, "optionsCool") },
    { id: "editor", label: t(uiLanguage, "tool") },
  ];

  const yellowGloss =
    "border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)] backdrop-blur-md";
  const roundBtn =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ease-out active:scale-95";
  const roundIdle = `${roundBtn} border border-transparent text-zinc-700 hover:border-amber-200/70 hover:bg-gradient-to-br hover:from-amber-200/95 hover:via-yellow-300/85 hover:to-amber-400/75 hover:text-amber-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)]`;
  const roundActive = `${roundBtn} ${yellowGloss}`;

  const sideBtn =
    "flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-full transition-all duration-300 ease-out active:scale-95";
  const sideIdle = `${sideBtn} border border-transparent text-zinc-700 hover:border-amber-200/70 hover:bg-gradient-to-br hover:from-amber-200/95 hover:via-yellow-300/85 hover:to-amber-400/75 hover:text-amber-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)]`;
  const sideActive = `${sideBtn} ${yellowGloss}`;

  return (
    <div
      ref={rootRef}
      data-app-header-actions
      className="pointer-events-none fixed top-2 z-[45] right-[7.25rem] sm:top-3 sm:right-32 md:right-[8.5rem]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        if (!modeOpen && !langOpen) setHovered(false);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".ifc,application/x-step,application/octet-stream,.IFC"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />

      <div className="pointer-events-auto relative w-max">
        {modeOpen && (
          <div className="absolute top-[calc(100%+0.45rem)] left-0 z-[50]">
            <GlassPanel variant="control" zIndex={50}>
              <div className="w-48 p-1 text-xs text-zinc-700 sm:w-52">
                {modeOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setMode(opt.id);
                      setModeOpen(false);
                    }}
                    className={`block w-full rounded-xl px-2.5 py-1.5 text-left transition-all duration-200 ${
                      mode === opt.id
                        ? "border border-amber-200/70 bg-gradient-to-br from-amber-200/90 via-yellow-300/70 to-amber-400/55 font-semibold text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_14px_rgba(251,191,36,0.28)] backdrop-blur-md"
                        : "border border-transparent hover:border-white/55 hover:bg-white/40 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] hover:backdrop-blur-md"
                    }`}
                  >
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800/90 text-[10px] font-bold text-white">
                      {MODE_LETTER[opt.id]}
                    </span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </GlassPanel>
          </div>
        )}

        {langOpen && (
          <div className="absolute top-[calc(100%+0.45rem)] right-0 z-[50]">
            <GlassPanel variant="control" zIndex={50}>
              <div className="min-w-[148px] p-1.5 sm:min-w-[160px] sm:p-2">
                <p className="mb-1.5 px-1.5 text-[10px] font-semibold tracking-wide text-zinc-500">
                  {t(uiLanguage, "language")}
                </p>
                <div className="flex flex-col gap-1">
                  {(
                    [
                      ["en", "langEn"],
                      ["de", "langDe"],
                      ["es", "langEs"],
                    ] as const
                  ).map(([lang, labelKey]) => {
                    const selected = uiLanguage === lang;
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => {
                          setUiLanguage(lang);
                          setLangOpen(false);
                        }}
                        className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition-all duration-200 ${
                          selected
                            ? "border border-amber-200/70 bg-gradient-to-br from-amber-200/90 via-yellow-300/70 to-amber-400/55 font-semibold text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_14px_rgba(251,191,36,0.28)] backdrop-blur-md"
                            : "border border-transparent text-zinc-700 hover:border-white/55 hover:bg-white/40 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] hover:backdrop-blur-md"
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
              </div>
            </GlassPanel>
          </div>
        )}

        <GlassPanel variant="panel" zIndex={45}>
          <div
            className={`flex items-center overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              expanded
                ? "gap-0.5 px-1 py-0.5"
                : "justify-center gap-0 px-0.5 py-0.5"
            }`}
          >
            <HeaderTip
              label={t(uiLanguage, "heating")}
              hint={t(uiLanguage, "viewHint")}
            >
              <button
                type="button"
                onClick={() => {
                  setModeOpen((v) => !v);
                  setLangOpen(false);
                  setHovered(true);
                }}
                aria-expanded={modeOpen || expanded}
                aria-label={t(uiLanguage, "heating")}
                className={modeOpen ? roundActive : roundIdle}
              >
                {MODE_LETTER[mode]}
              </button>
            </HeaderTip>

            <div
              className={`flex items-center overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                expanded
                  ? "ml-0.5 max-w-[5.5rem] gap-0.5 opacity-100"
                  : "ml-0 max-w-0 gap-0 opacity-0 pointer-events-none"
              }`}
            >
              <HeaderTip
                label={t(uiLanguage, "data")}
                hint={t(uiLanguage, "dataHint")}
              >
                <button
                  type="button"
                  disabled={isLoadingModel}
                  onClick={() => {
                    setModeOpen(false);
                    setLangOpen(false);
                    fileInputRef.current?.click();
                  }}
                  aria-label={t(uiLanguage, "loadIfc")}
                  className={`${hasModel ? sideActive : sideIdle} disabled:opacity-45`}
                >
                  <UploadIcon />
                </button>
              </HeaderTip>

              <HeaderTip
                label={t(uiLanguage, "profile")}
                hint={t(uiLanguage, "profileHint")}
              >
                <button
                  type="button"
                  onClick={() => {
                    setLangOpen((v) => !v);
                    setModeOpen(false);
                  }}
                  aria-expanded={langOpen}
                  aria-label={t(uiLanguage, "profile")}
                  className={langOpen ? sideActive : sideIdle}
                >
                  <MdOutlineAccountCircle className="h-4 w-4" />
                </button>
              </HeaderTip>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
