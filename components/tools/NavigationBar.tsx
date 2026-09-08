"use client";

import { memo } from "react";
import {
  LuHouse,
  LuMaximize2,
  LuMinus,
  LuPlus,
} from "react-icons/lu";

type Props = {
  onHome?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomFit?: () => void;
  rightOffset?: number;
  className?: string;
};

/**
 * Clean floating navigation controls for Zoom In, Zoom Out, Zoom Fit, and Home.
 * Styled with minimalist floating transparent icons that transform into liquid glass
 * round buttons on press/active.
 */
function NavigationBar({
  onHome,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  rightOffset,
  className = "",
}: Props) {
  return (
    <nav
      aria-label="Navigation and zoom controls"
      className={`pointer-events-auto fixed z-30 flex flex-col items-center gap-1.5 p-1 transition-all duration-200 select-none ${className}`}
      style={{
        top: "84px",
        right: rightOffset !== undefined ? `${rightOffset}px` : "16px",
      }}
    >
      {/* Home / Default 3D View */}
      {onHome && (
        <button
          type="button"
          onClick={onHome}
          title="Default 3D View (Home)"
          aria-label="Home view"
          className="group relative flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-all duration-150 hover:text-white hover:bg-white/10 active:scale-90 active:bg-white/20 active:backdrop-blur-md active:border active:border-white/30 cursor-pointer"
        >
          <LuHouse className="h-4 w-4 transition-transform group-hover:scale-110" />
        </button>
      )}

      {/* Zoom In (+) */}
      {onZoomIn && (
        <button
          type="button"
          onClick={onZoomIn}
          title="Zoom In (+)"
          aria-label="Zoom in"
          className="group relative flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-all duration-150 hover:text-white hover:bg-white/10 active:scale-90 active:bg-white/20 active:backdrop-blur-md active:border active:border-white/30 cursor-pointer"
        >
          <LuPlus className="h-4 w-4 transition-transform group-hover:scale-110" />
        </button>
      )}

      {/* Zoom Out (-) */}
      {onZoomOut && (
        <button
          type="button"
          onClick={onZoomOut}
          title="Zoom Out (-)"
          aria-label="Zoom out"
          className="group relative flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-all duration-150 hover:text-white hover:bg-white/10 active:scale-90 active:bg-white/20 active:backdrop-blur-md active:border active:border-white/30 cursor-pointer"
        >
          <LuMinus className="h-4 w-4 transition-transform group-hover:scale-110" />
        </button>
      )}

      {/* Zoom Fit / Extents */}
      {onZoomFit && (
        <button
          type="button"
          onClick={onZoomFit}
          title="Zoom to Fit (Extents)"
          aria-label="Zoom to fit"
          className="group relative flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-all duration-150 hover:text-white hover:bg-white/10 active:scale-90 active:bg-white/20 active:backdrop-blur-md active:border active:border-white/30 cursor-pointer"
        >
          <LuMaximize2 className="h-4 w-4 transition-transform group-hover:scale-110" />
        </button>
      )}
    </nav>
  );
}

export default memo(NavigationBar);
