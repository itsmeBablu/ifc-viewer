"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ToolLeftPaletteInner from "./ToolLeftPaletteInner";

const STORAGE_KEY = "ibv-tool-left-palette-pos";

type Pos = { x: number; y: number };

function loadPos(): Pos | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pos;
    if (typeof p.x === "number" && typeof p.y === "number") return p;
  } catch {
    /* ignore */
  }
  return null;
}

function clampPos(x: number, y: number, w: number, h: number): Pos {
  const margin = 8;
  const minTop = 56;
  return {
    x: Math.min(
      Math.max(margin, x),
      Math.max(margin, window.innerWidth - w - margin),
    ),
    y: Math.min(
      Math.max(minTop, y),
      Math.max(minTop, window.innerHeight - h - margin),
    ),
  };
}

/**
 * Draggable floating left tool strip — persists position in localStorage.
 */
export default function ToolLeftPalette({
  className = "",
}: {
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos>({ x: 16, y: 110 });
  const posRef = useRef(pos);
  const dragRef = useRef<{
    ox: number;
    oy: number;
    sx: number;
    sy: number;
  } | null>(null);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useEffect(() => {
    const saved = loadPos();
    if (!saved) return;
    const el = rootRef.current;
    const w = el?.offsetWidth ?? 56;
    const h = el?.offsetHeight ?? 160;
    setPos(clampPos(saved.x, saved.y, w, h));
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!(e.target as HTMLElement).closest("[data-drag-handle]")) return;
      const el = rootRef.current;
      if (!el) return;
      el.setPointerCapture(e.pointerId);
      dragRef.current = {
        ox: e.clientX,
        oy: e.clientY,
        sx: pos.x,
        sy: pos.y,
      };
    },
    [pos.x, pos.y],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    const el = rootRef.current;
    if (!d || !el) return;
    setPos(
      clampPos(
        d.sx + (e.clientX - d.ox),
        d.sy + (e.clientY - d.oy),
        el.offsetWidth,
        el.offsetHeight,
      ),
    );
  }, []);

  const endDrag = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posRef.current));
    } catch {
      /* ignore */
    }
    rootRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div
      ref={rootRef}
      className={`pointer-events-auto ${className}`}
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 35 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        data-drag-handle
        className="mb-1 flex cursor-grab items-center justify-center rounded-t-2xl px-2 py-1 active:cursor-grabbing"
        title="Move"
      >
        <span
          aria-hidden
          className="h-1 w-8 rounded-full bg-[var(--panel-divider)]"
        />
      </div>
      <ToolLeftPaletteInner />
    </div>
  );
}
