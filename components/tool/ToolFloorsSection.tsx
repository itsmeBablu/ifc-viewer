"use client";

import { listVisibleFloors } from "@/lib/floorFilter";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useModelScene } from "../viewer/ModelSceneContext";

/**
 * IfcBuildingStorey list — selecting a floor switches to Top ortho + floor clip.
 */
export default function ToolFloorsSection({
  className = "",
}: {
  className?: string;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const floors = useAppStore((s) => s.floors);
  const rooms = useAppStore((s) => s.rooms);
  const setSelectedFloor = useAppStore((s) => s.setSelectedFloor);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const markupFloorId = useToolMarkupStore((s) => s.markupFloorId);
  const setMarkupFloorId = useToolMarkupStore((s) => s.setMarkupFloorId);
  const setViewPreset = useToolMarkupStore((s) => s.setViewPreset);
  const { shellGroup } = useModelScene();
  const visible = listVisibleFloors(floors, rooms, shellGroup);
  const activeId = markupFloorId ?? selectedFloor;

  const select = (floorId: string | null) => {
    setMarkupFloorId(floorId);
    setSelectedFloor(floorId);
    if (floorId) setViewPreset("top");
  };

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <p className="mb-1.5 shrink-0 px-0.5 text-[9px] font-semibold tracking-wide text-zinc-500 uppercase">
        {t(uiLanguage, "floors")}
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto thin-scroll pr-0.5">
        <button
          type="button"
          onClick={() => select(null)}
          className={`tool-underline-item mb-0.5 w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold transition duration-150 ${
            activeId == null
              ? "bg-white/10 text-zinc-100"
              : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
          }`}
        >
          {t(uiLanguage, "markupAllFloors")}
        </button>
        {visible.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => select(f.id)}
            className={`tool-underline-item mb-0.5 w-full truncate rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold transition duration-150 ${
              activeId === f.id
                ? "bg-white/10 text-zinc-100"
                : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>
    </div>
  );
}
