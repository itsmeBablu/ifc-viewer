"use client";

import { useAppStore } from "@/store/useAppStore";
import { useModelScene } from "./WerkzeugModelSceneContext";
import { getModelById } from "@/lib/modelRegistry";
import { formatBytesParts } from "@/lib/format";
import { t } from "@/lib/i18n";

export type ModelSummaryTile = { value: string; unit: string };

/** Active model label + size/elements/floors/rooms tiles (Werkzeug context). */
export function useModelSummary(): {
  activeModelId: string | null;
  modelLabel: string;
  tiles: ModelSummaryTile[];
} {
  const activeModelId = useAppStore((s) => s.activeModelId);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const activeModelFileSizeBytes = useAppStore(
    (s) => s.activeModelFileSizeBytes,
  );
  const floors = useAppStore((s) => s.floors);
  const rooms = useAppStore((s) => s.rooms);
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const { shellGroup } = useModelScene();

  const modelLabel =
    activeModelLabel ??
    (activeModelId
      ? (getModelById(activeModelId)?.label ?? activeModelId)
      : t(uiLanguage, "noModel"));

  const totalComponents = rooms.length + (shellGroup?.children?.length ?? 0);
  const sizeParts = formatBytesParts(activeModelFileSizeBytes);

  const tiles: ModelSummaryTile[] = [
    { value: sizeParts.value, unit: sizeParts.unit || "—" },
    { value: String(totalComponents), unit: t(uiLanguage, "elements") },
    { value: String(floors.length), unit: t(uiLanguage, "floors") },
    { value: String(rooms.length), unit: t(uiLanguage, "rooms") },
  ];

  return { activeModelId, modelLabel, tiles };
}
