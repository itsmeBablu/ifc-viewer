"use client";

import {
  LuCompass,
  LuHand,
  LuHome,
  LuMaximize2,
  LuMinus,
  LuPlus,
} from "react-icons/lu";
import { useAppStore } from "@/store/useAppStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";

type Props = {
  onHome?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomFit?: () => void;
  onTogglePan?: () => void;
  onToggleOrbit?: () => void;
  isPanActive?: boolean;
  isOrbitActive?: boolean;
  className?: string;
};

/**
 * Autodesk-inspired vertical Navigation Bar.
 * Sits near the ViewCube in the top-right corner with 44x44pt touch targets for iPad/tablets.
 */
export default function NavigationBar({
  onHome,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onTogglePan,
  onToggleOrbit,
  isPanActive = false,
  isOrbitActive = false,
  className = "",
}: Props) {
  const quadView = useToolMarkupStore((s) => s.quadView);

  if (quadView) return null;

  return (
    <div
      aria-label="Navigation bar"
      className={`pointer-events-auto fixed right-4 top-36 z-[45] flex flex-col items-center gap-1 rounded-2xl border border-[var(--panel-divider)] bg-[var(--popover-bg)]/90 p-1 shadow-[0_12px_32px_rgba(0,0,0,.25)] backdrop-blur-2xl transition-all duration-200 ${className}`}
    >
      {/* Home button: resets camera to default 3D isometric view */}
      <button
        type="button"
        onClick={onHome}
        title="Default 3D View (Home)"
        aria-label="Home view"
        className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-body)] transition-colors hover:bg-[var(--glass-inset-bg)] hover:text-yellow-400 active:scale-95 cursor-pointer"
      >
        <LuHome className="h-5 w-5" />
      </button>

      <span className="h-px w-7 bg-[var(--panel-divider)]" />

      {/* Zoom In */}
      <button
        type="button"
        onClick={onZoomIn}
        title="Zoom In"
        aria-label="Zoom in"
        className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-body)] transition-colors hover:bg-[var(--glass-inset-bg)] hover:text-yellow-400 active:scale-95 cursor-pointer"
      >
        <LuPlus className="h-5 w-5" />
      </button>

      {/* Zoom Out */}
      <button
        type="button"
        onClick={onZoomOut}
        title="Zoom Out"
        aria-label="Zoom out"
        className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-body)] transition-colors hover:bg-[var(--glass-inset-bg)] hover:text-yellow-400 active:scale-95 cursor-pointer"
      >
        <LuMinus className="h-5 w-5" />
      </button>

      {/* Zoom Fit / Extents */}
      <button
        type="button"
        onClick={onZoomFit}
        title="Zoom Fit (Extents)"
        aria-label="Zoom fit"
        className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-body)] transition-colors hover:bg-[var(--glass-inset-bg)] hover:text-yellow-400 active:scale-95 cursor-pointer"
      >
        <LuMaximize2 className="h-5 w-5" />
      </button>

      <span className="h-px w-7 bg-[var(--panel-divider)]" />

      {/* Pan Mode toggle */}
      <button
        type="button"
        onClick={onTogglePan}
        title="Pan Tool"
        aria-label="Pan tool"
        className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all cursor-pointer ${
          isPanActive
            ? "btn-v-yellow text-zinc-950 font-bold shadow-md"
            : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-yellow-400"
        }`}
      >
        <LuHand className="h-5 w-5" />
      </button>

      {/* Orbit Mode toggle */}
      <button
        type="button"
        onClick={onToggleOrbit}
        title="Orbit Tool"
        aria-label="Orbit tool"
        className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all cursor-pointer ${
          isOrbitActive
            ? "btn-v-yellow text-zinc-950 font-bold shadow-md"
            : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-yellow-400"
        }`}
      >
        <LuCompass className="h-5 w-5" />
      </button>
    </div>
  );
}
