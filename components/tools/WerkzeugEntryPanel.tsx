"use client";

import { useState } from "react";
import GlassPanel from "@/components/common/GlassPanel";
import LoadIfcButton from "@/components/common/LoadIfcButton";
import { IconUpload } from "@/components/common/ui";
import { motion, radius } from "@/lib/designTokens";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";

/**
 * Werkzeug-only entry: Upload IFC or create an empty layout project.
 * Empty-project CTA matches the yellow liquid-glass IFC upload button.
 */
export default function WerkzeugEntryPanel({
  onFile,
}: {
  onFile: (file: File) => void;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const { projectId, level } =
        await useLayoutDrawingStore.getState().createEmptyProject(trimmed);
      useAppStore.getState().setActiveModelId(projectId, trimmed, null);
      useAppStore.getState().setFloors([
        {
          id: level.id,
          name: level.name,
          elevation: level.elevationMm / 1000,
          expressId: -1,
          typicalHeight: level.heightMm / 1000,
          isBuildingStory: true,
        },
      ]);
      useAppStore.getState().setSelectedFloor(level.id);
      await useToolMarkupStore.getState().loadForModel(projectId);
      useToolMarkupStore.getState().setMarkupFloorId(level.id);
      useToolMarkupStore.getState().setViewPreset("top");
      useAppStore.getState().setToolMode(true);
    } finally {
      setBusy(false);
    }
  };

  const amberBtn =
    `${motion.base} ${radius.control} inline-flex min-w-[168px] items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)]`;

  return (
    <GlassPanel
      variant="panel"
      zIndex={30}
      preferCss
      wrapperClassName="pointer-events-auto w-full max-w-[min(26rem,calc(100vw-2rem))] tool-glass"
    >
      <div className="p-6">
        <p className="mb-1 text-sm font-semibold tracking-wide text-[var(--text-strong)]">
          {t(uiLanguage, "tool")}
        </p>
        <p className="mb-5 text-xs font-medium leading-relaxed text-[var(--text-muted)]">
          {t(uiLanguage, "werkzeugEntryHint")}
        </p>

        <div className="mb-4 flex justify-center">
          <LoadIfcButton
            onFile={onFile}
            label={t(uiLanguage, "werkzeugUploadIfc")}
          />
        </div>

        <div className="relative mb-4 text-center text-[10px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
          <span className="absolute inset-x-0 top-1/2 border-t border-[var(--panel-divider)]" />
          <span className="relative bg-white/50 px-2 backdrop-blur-sm">
            {t(uiLanguage, "or")}
          </span>
        </div>

        <form
          className="flex flex-col items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder={t(uiLanguage, "layoutProjectName")}
            className="w-full max-w-[220px] rounded-xl border border-white/50 bg-white/55 px-3 py-2 text-[12px] outline-none backdrop-blur-md focus:border-amber-300"
          />
          {/* Same yellow liquid-glass control as LoadIfcButton */}
          <GlassPanel variant="control" zIndex={2} wrapperClassName="inline-flex">
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className={amberBtn}
              aria-label={t(uiLanguage, "layoutCreateEmpty")}
            >
              <IconUpload />
              {t(uiLanguage, "layoutCreateEmpty")}
            </button>
          </GlassPanel>
        </form>
      </div>
    </GlassPanel>
  );
}
