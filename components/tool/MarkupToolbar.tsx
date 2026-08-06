"use client";

import { MARKUP_COLOR_PALETTE } from "@/lib/toolMarkup";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import {
  MARKUP_TOOL_ICONS,
  MARKUP_TOOL_ORDER,
  isShapeTool,
} from "./MarkupIcons";

/**
 * Slim vertical markup toolbar — left edge of the Werkzeug viewer.
 */
export default function MarkupToolbar({
  className = "",
}: {
  className?: string;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const armedTool = useToolMarkupStore((s) => s.armedTool);
  const setArmedTool = useToolMarkupStore((s) => s.setArmedTool);
  const defaultColor = useToolMarkupStore((s) => s.defaultColor);
  const setDefaultColor = useToolMarkupStore((s) => s.setDefaultColor);

  return (
    <div
      className={`pointer-events-auto flex flex-col items-center gap-1 rounded-2xl border border-[var(--panel-divider)] bg-[var(--glass-panel-bg,rgba(255,255,255,0.72))] p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.12)] backdrop-blur-md ${className}`}
      role="toolbar"
      aria-label={t(uiLanguage, "markupToolbar")}
    >
      {MARKUP_TOOL_ORDER.map((id) => {
        const Icon = MARKUP_TOOL_ICONS[id];
        const active = armedTool === id;
        const labelKey =
          id === "note"
            ? "markupNote"
            : (`markupShape_${id}` as const);
        return (
          <button
            key={id}
            type="button"
            title={t(uiLanguage, labelKey)}
            aria-label={t(uiLanguage, labelKey)}
            aria-pressed={active}
            onClick={() => setArmedTool(active ? null : id)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
              active
                ? "bg-amber-400/90 text-amber-950 shadow-inner"
                : "text-[var(--text-body)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
            }`}
          >
            <Icon />
          </button>
        );
      })}

      <div className="my-0.5 h-px w-7 bg-[var(--panel-divider)]" />

      <div className="grid grid-cols-3 gap-0.5 px-0.5 pb-0.5">
        {MARKUP_COLOR_PALETTE.map((hex) => {
          const active = defaultColor.toLowerCase() === hex.toLowerCase();
          return (
            <button
              key={hex}
              type="button"
              title={hex}
              aria-label={hex}
              aria-pressed={active}
              onClick={() => setDefaultColor(hex)}
              className={`h-3.5 w-3.5 rounded-full border transition ${
                active
                  ? "scale-110 border-zinc-800 ring-1 ring-amber-400"
                  : "border-black/15 hover:scale-110"
              }`}
              style={{ backgroundColor: hex }}
            />
          );
        })}
      </div>

      <label
        className="relative mt-0.5 flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-[var(--panel-divider)]"
        title={t(uiLanguage, "markupCustomColor")}
      >
        <span
          className="absolute inset-0.5 rounded-md"
          style={{ backgroundColor: defaultColor }}
        />
        <input
          type="color"
          value={defaultColor}
          onChange={(e) => setDefaultColor(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={t(uiLanguage, "markupCustomColor")}
        />
      </label>

      {armedTool && (
        <p className="max-w-[3.25rem] pt-0.5 text-center text-[8px] font-semibold leading-tight text-amber-800">
          {isShapeTool(armedTool)
            ? t(uiLanguage, "markupClickToPlace")
            : t(uiLanguage, "markupClickToNote")}
        </p>
      )}
    </div>
  );
}
