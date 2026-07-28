"use client";

import { useEffect, useRef, useState } from "react";
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

function UploadIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 16V5" />
      <path d="m8 9 4-4 4 4" />
      <path d="M4 19h16" />
    </svg>
  );
}

/**
 * Top-right actions: View | Data | Profile (icon on top, label below).
 * Offset left to clear the 3D view cube (~100px + margin).
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setModeOpen(false);
        setLangOpen(false);
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
  const btnBase =
    "flex h-7 w-7 items-center justify-center rounded-full p-1 transition-all duration-200 active:scale-95 sm:h-8 sm:w-8";
  const btnIdle = `${btnBase} border border-transparent text-zinc-700 hover:border-amber-200/70 hover:bg-gradient-to-br hover:from-amber-200/95 hover:via-yellow-300/85 hover:to-amber-400/75 hover:text-amber-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)] hover:backdrop-blur-md`;
  const btnActive = `${btnBase} ${yellowGloss}`;

  return (
    <div
      ref={rootRef}
      data-app-header-actions
      className="pointer-events-none fixed top-3 z-[45] right-[8.75rem] sm:right-36 md:right-40"
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

      <div className="pointer-events-auto relative w-max min-w-[11.5rem] sm:min-w-[13.5rem] max-w-[min(100vw-9rem,18rem)]">
        {modeOpen && (
          <div className="absolute top-[calc(100%+0.35rem)] left-0 z-[50]">
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
          <div className="absolute top-[calc(100%+0.35rem)] right-0 z-[50]">
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
          <div className="grid grid-cols-3 gap-2 px-2.5 py-0.5 sm:gap-3.5 sm:px-4 sm:py-0.5">
            {/* View */}
            <div className="flex min-w-0 flex-col items-center leading-none">
              <button
                type="button"
                onClick={() => {
                  setModeOpen((v) => !v);
                  setLangOpen(false);
                }}
                aria-expanded={modeOpen}
                aria-label={t(uiLanguage, "view")}
                className={`${modeOpen ? btnActive : btnIdle} text-xs font-bold sm:text-sm`}
              >
                {MODE_LETTER[mode]}
              </button>
              <span className="mt-px w-full truncate text-center text-[8px] font-medium text-zinc-600 sm:text-[9px]">
                {t(uiLanguage, "view")}
              </span>
            </div>

            {/* Data (IFC) */}
            <div className="flex min-w-0 flex-col items-center leading-none">
              <button
                type="button"
                disabled={isLoadingModel}
                onClick={() => {
                  setModeOpen(false);
                  setLangOpen(false);
                  fileInputRef.current?.click();
                }}
                aria-label={t(uiLanguage, "loadIfc")}
                className={`${hasModel ? btnActive : btnIdle} disabled:opacity-45`}
              >
                <UploadIcon />
              </button>
              <span className="mt-px w-full truncate text-center text-[8px] font-medium text-zinc-600 sm:text-[9px]">
                {t(uiLanguage, "data")}
              </span>
            </div>

            {/* Profile */}
            <div className="flex min-w-0 flex-col items-center leading-none">
              <button
                type="button"
                onClick={() => {
                  setLangOpen((v) => !v);
                  setModeOpen(false);
                }}
                aria-expanded={langOpen}
                aria-label={t(uiLanguage, "profile")}
                className={langOpen ? btnActive : btnIdle}
              >
                <MdOutlineAccountCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <span className="mt-px w-full truncate text-center text-[8px] font-medium text-zinc-600 sm:text-[9px]">
                {t(uiLanguage, "profile")}
              </span>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
