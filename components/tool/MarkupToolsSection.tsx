"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import ColorSwatchPicker from "./ColorSwatchPicker";
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

/** Primary shape/note tools — large icons + collapsible color swatch. */
export default function MarkupToolsSection({
  className = "",
}: {
  className?: string;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const armedTool = useToolMarkupStore((s) => s.armedTool);
  const setArmedTool = useToolMarkupStore((s) => s.setArmedTool);
  const defaultColor = useToolMarkupStore((s) => s.defaultColor);
  const setDefaultColor = useToolMarkupStore((s) => s.setDefaultColor);
  const snapToFaces = useToolMarkupStore((s) => s.snapToFaces);
  const setSnapToFaces = useToolMarkupStore((s) => s.setSnapToFaces);
  const gridSnap = useToolMarkupStore((s) => s.gridSnap);
  const setGridSnap = useToolMarkupStore((s) => s.setGridSnap);
  const notePlaceHint = useToolMarkupStore((s) => s.notePlaceHint);
  const [tip, setTip] = useState<string | null>(null);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
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
                  ? "border-amber-400/80 bg-amber-400/20 text-amber-200"
                  : "border-white/8 bg-white/[0.04] text-zinc-300 hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
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
          notePlaceHint ? "text-amber-300" : "text-zinc-500"
        }`}
      >
        {notePlaceHint
          ? t(uiLanguage, notePlaceHint as "markupNoteMustAttach")
          : tip ??
            (armedTool === "cube"
              ? t(uiLanguage, "markupDrawCubeHint")
              : armedTool === "note"
                ? t(uiLanguage, "markupNoteMustAttach")
                : armedTool && isShapeTool(armedTool)
                  ? t(uiLanguage, "markupClickToPlace")
                  : t(uiLanguage, "markupSelectIfcHint"))}
      </p>

      <div className="flex items-center gap-3">
        <span className="text-[9px] font-semibold tracking-wide text-zinc-500 uppercase">
          {t(uiLanguage, "markupColor")}
        </span>
        <ColorSwatchPicker
          color={defaultColor}
          onChange={setDefaultColor}
          size="lg"
        />
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            title={t(uiLanguage, "markupSnap")}
            aria-pressed={snapToFaces}
            onClick={() => setSnapToFaces(!snapToFaces)}
            className={`rounded-lg px-2 py-1 text-[9px] font-bold transition duration-150 ${
              snapToFaces
                ? "bg-emerald-500/90 text-emerald-950"
                : "bg-white/6 text-zinc-500 hover:bg-white/10"
            }`}
          >
            SNAP
          </button>
          <button
            type="button"
            title={t(uiLanguage, "markupGridSnap")}
            aria-pressed={gridSnap}
            onClick={() => setGridSnap(!gridSnap)}
            className={`rounded-lg px-2 py-1 text-[9px] font-bold transition duration-150 ${
              gridSnap
                ? "bg-emerald-500/90 text-emerald-950"
                : "bg-white/6 text-zinc-500 hover:bg-white/10"
            }`}
          >
            GRID
          </button>
        </div>
      </div>
    </div>
  );
}
