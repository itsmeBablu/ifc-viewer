"use client";

/**
 * LanguageSelect — EN / DE / ES picker (compact inline or three wide buttons).
 */

import Image from "next/image";
import { motion, radius } from "@/lib/designTokens";
import { t, type UiLanguage } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";

const LANGUAGES: { id: UiLanguage; labelKey: "langEn" | "langDe" | "langEs"; flag?: string }[] =
  [
    { id: "en", labelKey: "langEn", flag: "/en.svg" },
    { id: "de", labelKey: "langDe", flag: "/de.svg" },
    { id: "es", labelKey: "langEs", flag: "/es.svg" },
  ];

type Props = {
  className?: string;
  /** Full-width three-column buttons (welcome desktop). */
  wide?: boolean;
  /** Tighter sizing for stacked portrait / phone layouts. */
  compact?: boolean;
};

function FlagIcon({ flag, id }: { flag?: string; id: UiLanguage }) {
  if (flag) {
    return (
      <Image
        src={flag}
        alt=""
        width={22}
        height={22}
        className="h-[22px] w-[22px] shrink-0 rounded-full object-cover"
        aria-hidden
      />
    );
  }
  return (
    <span
      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[10px] font-bold"
      aria-hidden
    >
      {id.toUpperCase()}
    </span>
  );
}

export default function LanguageSelect({ className = "", wide = false, compact = false }: Props) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const setUiLanguage = useAppStore((s) => s.setUiLanguage);

  const selectedClass = `${motion.base} ${radius.control} border-amber-300/80 bg-amber-100/35 text-[var(--text-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_0_0_1px_rgba(251,191,36,0.25)]`;
  const idleClass = `${motion.base} ${radius.control} border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-muted)] hover:border-[var(--glass-border)] hover:text-[var(--text-body)]`;

  if (wide) {
    return (
      <div
        className={`grid w-full grid-cols-3 ${compact ? "gap-1.5" : "gap-2"} ${className}`}
        role="group"
        aria-label={t(uiLanguage, "language")}
      >
        {LANGUAGES.map(({ id, labelKey, flag }) => {
          const selected = uiLanguage === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              aria-label={t(uiLanguage, labelKey)}
              onClick={() => setUiLanguage(id)}
              className={`flex w-full flex-col items-center justify-center border text-center ${
                compact
                  ? "min-h-10 gap-1 px-1.5 py-1.5"
                  : "min-h-12 gap-1.5 px-3 py-2.5"
              } ${selected ? selectedClass : idleClass}`}
            >
              <FlagIcon flag={flag} id={id} />
              <span
                className={`font-semibold leading-tight text-[var(--text-body)] ${
                  compact ? "text-[10px]" : "text-xs"
                }`}
              >
                {compact ? id.toUpperCase() : t(uiLanguage, labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`flex shrink-0 gap-1.5 ${className}`}
      role="group"
      aria-label={t(uiLanguage, "language")}
    >
      {LANGUAGES.map(({ id, labelKey, flag }) => {
        const selected = uiLanguage === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={selected}
            aria-label={t(uiLanguage, labelKey)}
            onClick={() => setUiLanguage(id)}
            className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide sm:min-w-[3.25rem] ${
              selected ? selectedClass : idleClass
            }`}
          >
            <FlagIcon flag={flag} id={id} />
            <span>{id.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
}
