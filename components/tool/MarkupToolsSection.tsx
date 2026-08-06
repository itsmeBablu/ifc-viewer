"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import {
  MARKUP_TOOL_ICONS,
  MARKUP_TOOL_ORDER,
  isShapeTool,
} from "./MarkupIcons";

const TOOL_HINT: Record<
  string,
  | "markupHint_cube"
  | "markupHint_sphere"
  | "markupHint_cylinder"
  | "markupHint_cone"
  | "markupHint_torus"
  | "markupHint_capsule"
  | "markupHint_pyramid"
  | "markupHint_note"
> = {
  cube: "markupHint_cube",
  sphere: "markupHint_sphere",
  cylinder: "markupHint_cylinder",
  cone: "markupHint_cone",
  torus: "markupHint_torus",
  capsule: "markupHint_capsule",
  pyramid: "markupHint_pyramid",
  note: "markupHint_note",
};

/** Shape / note tools — large icons + tooltips. */
export default function MarkupToolsSection({
  className = "",
  hideChrome = false,
}: {
  className?: string;
  /** When true, omit snap/color row (owned by Editor chrome). */
  hideChrome?: boolean;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const armedTool = useToolMarkupStore((s) => s.armedTool);
  const setArmedTool = useToolMarkupStore((s) => s.setArmedTool);
  const notePlaceHint = useToolMarkupStore((s) => s.notePlaceHint);
  const [tip, setTip] = useState<string | null>(null);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {!hideChrome && (
        <p className="px-0.5 text-[9px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
          {t(uiLanguage, "markupToolbar")}
        </p>
      )}
      <div className="grid grid-cols-4 gap-2">
        {MARKUP_TOOL_ORDER.map((id) => {
          const Icon = MARKUP_TOOL_ICONS[id];
          const active = armedTool === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              title={t(uiLanguage, TOOL_HINT[id])}
              onMouseEnter={() => setTip(t(uiLanguage, TOOL_HINT[id]))}
              onMouseLeave={() => setTip(null)}
              onFocus={() => setTip(t(uiLanguage, TOOL_HINT[id]))}
              onBlur={() => setTip(null)}
              onClick={() => setArmedTool(active ? null : id)}
              className={`flex h-12 w-full items-center justify-center rounded-xl border transition duration-150 ${
                active
                  ? "border-amber-300/80 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                  : "border-[var(--panel-divider)] bg-[var(--surface-muted)]/50 text-[var(--text-body)] hover:border-amber-200/60 hover:bg-amber-50/80"
              }`}
            >
              <span className="[&>svg]:h-6 [&>svg]:w-6">
                <Icon />
              </span>
            </button>
          );
        })}
      </div>

      <p
        className={`min-h-[1.15rem] text-[10px] leading-snug ${
          notePlaceHint ? "text-amber-700" : "text-[var(--text-muted)]"
        }`}
      >
        {notePlaceHint
          ? t(uiLanguage, notePlaceHint as "markupNoteMustAttach")
          : tip ??
            (armedTool === "cube"
              ? t(uiLanguage, "markupDrawCubeHint3")
              : armedTool === "note"
                ? t(uiLanguage, "markupNoteMustAttach")
                : armedTool && isShapeTool(armedTool)
                  ? t(uiLanguage, "markupClickToPlace")
                  : t(uiLanguage, "markupSelectIfcHint"))}
      </p>
    </div>
  );
}
