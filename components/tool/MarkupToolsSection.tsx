"use client";

import HoverTip from "@/components/common/HoverTip";
import { t, type UiTextKey } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import {
  MARKUP_TOOL_ICONS,
  MARKUP_TOOL_ORDER,
  isShapeTool,
} from "./MarkupIcons";

const TOOL_LABEL: Record<string, UiTextKey> = {
  cube: "markupShape_cube",
  sphere: "markupShape_sphere",
  cylinder: "markupShape_cylinder",
  cone: "markupShape_cone",
  torus: "markupShape_torus",
  capsule: "markupShape_capsule",
  pyramid: "markupShape_pyramid",
  note: "markupShape_note",
};

const TOOL_HINT: Record<string, UiTextKey> = {
  cube: "markupHint_cube",
  sphere: "markupHint_sphere",
  cylinder: "markupHint_cylinder",
  cone: "markupHint_cone",
  torus: "markupHint_torus",
  capsule: "markupHint_capsule",
  pyramid: "markupHint_pyramid",
  note: "markupHint_note",
};

/** Shape / Pin tools — icon + truncated label, bottom-bar style hover tips. */
export default function MarkupToolsSection({
  className = "",
  hideChrome = false,
}: {
  className?: string;
  /** When true, omit snap/color row (owned by Editor chrome). */
  hideChrome?: boolean;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const toolSelectedExpressId = useAppStore((s) => s.toolSelectedExpressId);
  const armedTool = useToolMarkupStore((s) => s.armedTool);
  const setArmedTool = useToolMarkupStore((s) => s.setArmedTool);
  const requestNotePin = useToolMarkupStore((s) => s.requestNotePin);
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);
  const notePlaceHint = useToolMarkupStore((s) => s.notePlaceHint);

  const armOrPinNote = () => {
    if (armedTool === "note") {
      setArmedTool(null);
      return;
    }
    if (selectedPlacementId || toolSelectedExpressId != null) {
      requestNotePin();
      return;
    }
    setArmedTool("note");
  };

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
          const label = t(uiLanguage, TOOL_LABEL[id]);
          const hint = t(uiLanguage, TOOL_HINT[id]);
          return (
            <HoverTip
              key={id}
              label={label}
              hint={hint}
              placement="below"
              className="min-w-0"
            >
              <button
                type="button"
                aria-pressed={active}
                aria-label={label}
                onClick={() => {
                  if (id === "note") {
                    armOrPinNote();
                    return;
                  }
                  setArmedTool(active ? null : id);
                }}
                className={`flex h-[3.35rem] w-full min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl border px-1 transition duration-150 ${
                  active
                    ? "border-amber-300/80 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                    : "border-[var(--panel-divider)] bg-[var(--surface-muted)]/50 text-[var(--text-body)] hover:border-amber-200/60 hover:bg-amber-50/80"
                }`}
              >
                <span className="shrink-0 [&>svg]:h-5 [&>svg]:w-5">
                  <Icon />
                </span>
                <span className="w-full truncate text-center text-[9px] font-semibold leading-tight tracking-wide">
                  {label}
                </span>
              </button>
            </HoverTip>
          );
        })}
      </div>

      <p
        className={`min-h-[1.15rem] text-[10px] leading-snug ${
          notePlaceHint ? "text-amber-700" : "text-[var(--text-muted)]"
        }`}
      >
        {notePlaceHint
          ? t(uiLanguage, notePlaceHint as UiTextKey)
          : armedTool === "cube"
            ? t(uiLanguage, "markupDrawCubeHint3")
            : armedTool === "note"
              ? t(uiLanguage, "markupNotePinHint")
              : armedTool && isShapeTool(armedTool)
                ? t(uiLanguage, "markupClickToPlace")
                : t(uiLanguage, "markupSelectIfcHint")}
      </p>
    </div>
  );
}
