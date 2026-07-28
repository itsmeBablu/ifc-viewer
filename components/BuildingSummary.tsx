"use client";

import { useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { getModelById } from "@/lib/modelRegistry";
import { t } from "@/lib/i18n";
import { GlassInset, PanelTitle, heading } from "./ui";

type Props = {
  embedded?: boolean;
};

export default function BuildingSummary({ embedded = false }: Props) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const activeModelId = useAppStore((s) => s.activeModelId);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const floors = useAppStore((s) => s.floors);
  const rooms = useAppStore((s) => s.rooms);

  const modelLabel =
    activeModelLabel ??
    (activeModelId
      ? (getModelById(activeModelId)?.label ?? activeModelId)
      : t(uiLanguage, "noModel"));

  const perFloor = useMemo(() => {
    return [...floors]
      .sort((a, b) => a.elevation - b.elevation)
      .map((f) => ({
        id: f.id,
        name: f.name,
        count: rooms.filter((r) => r.floorId === f.id).length,
      }));
  }, [floors, rooms]);

  const body = (
    <div className="space-y-3">
      <div>
        <p className={heading.muted}>{t(uiLanguage, "activeModel")}</p>
        <p className="truncate text-sm font-medium text-zinc-900">{modelLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <GlassInset className="px-3 py-2.5">
          <p className={heading.muted}>{t(uiLanguage, "floors")}</p>
          <p className="text-lg font-semibold tabular-nums text-zinc-900">
            {floors.length}
          </p>
        </GlassInset>
        <GlassInset className="px-3 py-2.5">
          <p className={heading.muted}>{t(uiLanguage, "rooms")}</p>
          <p className="text-lg font-semibold tabular-nums text-zinc-900">
            {rooms.length}
          </p>
        </GlassInset>
      </div>

      {perFloor.length > 0 && (
        <ul className="max-h-32 space-y-0.5 overflow-y-auto">
          {perFloor.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between rounded-2xl px-2.5 py-1.5 text-xs text-zinc-600 transition-all duration-300 ease-out hover:bg-white/40"
            >
              <span className="truncate pr-2 font-medium">{f.name}</span>
              <span className="tabular-nums text-zinc-400">{f.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <section className="p-4">
      <PanelTitle>{t(uiLanguage, "buildingSummary")}</PanelTitle>
      {body}
    </section>
  );
}
