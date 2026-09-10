"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useViewDisplayStore } from "@/store/useViewDisplayStore";

const CATEGORIES = ["Walls", "Roofs", "Floors", "Doors", "Windows", "Columns", "Beams", "Stairs", "Ramps", "Equipment / Furniture", "Ducts", "Pipes", "Cable trays", "Wires"];

export default function RenderElementsMenu() {
  const hidden = useViewDisplayStore(s => s.renderHiddenCategories);
  const setSetting = useViewDisplayStore(s => s.setRenderSetting);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (!position) return;
    const close = (e: PointerEvent) => { if (!button.current?.contains(e.target as Node) && !menu.current?.contains(e.target as Node)) setPosition(null); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setPosition(null); };
    const resize = () => setPosition(null);
    window.addEventListener("pointerdown", close); window.addEventListener("keydown", key); window.addEventListener("resize", resize);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", key); window.removeEventListener("resize", resize); };
  }, [position]);
  return <>
    <button ref={button} type="button" className="desktop-capsule-btn shrink-0" aria-expanded={Boolean(position)} aria-haspopup="dialog" onClick={() => {
      const rect = button.current!.getBoundingClientRect();
      setPosition(position ? null : { top: rect.bottom + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - 250)) });
    }}>Show elements ▾</button>
    {position && createPortal(<div ref={menu} role="dialog" aria-label="Render element visibility" style={position} className="fixed z-[9999] w-60 max-h-[65vh] overflow-y-auto rounded-xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-3 shadow-xl text-xs">
      <div className="mb-2 flex justify-between"><strong>Show elements</strong><button type="button" onClick={() => setSetting("renderHiddenCategories", [])}>Show all</button></div>
      {CATEGORIES.map(category => <label key={category} className="flex items-center gap-2 py-1.5"><input type="checkbox" checked={!hidden.includes(category)} onChange={() => setSetting("renderHiddenCategories", hidden.includes(category) ? hidden.filter(c => c !== category) : [...hidden, category])} />{category}</label>)}
      <p className="mt-2 text-[var(--text-muted)]">Visibility applies to Render Studio and exported images.</p>
    </div>, document.body)}
  </>;
}
