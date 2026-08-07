"use client";

import { useLayoutEffect, useRef, useState } from "react";

type TabId = string;

/**
 * Underline tab row — amber indicator, theme-aware text.
 */
export default function ToolUnderlineTabs<T extends TabId>({
  tabs,
  value,
  onChange,
  className = "",
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
  const [bar, setBar] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const btn = btnRefs.current.get(value);
    const row = rowRef.current;
    if (!btn || !row) return;
    const rr = row.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    setBar({ left: br.left - rr.left, width: br.width });
  }, [value, tabs]);

  return (
    <div
      ref={rowRef}
      className={`relative flex gap-1 border-b border-[var(--panel-divider)] ${className}`}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          ref={(el) => {
            if (el) btnRefs.current.set(tab.id, el);
            else btnRefs.current.delete(tab.id);
          }}
          aria-pressed={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={`relative z-[1] px-2.5 py-2 text-[11px] font-semibold transition-colors duration-150 ${
            value === tab.id
              ? "text-[var(--text-strong)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-body)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-amber-400 transition-[transform,width] duration-200 ease-out"
        style={{
          width: bar.width,
          transform: `translateX(${bar.left}px)`,
        }}
      />
    </div>
  );
}
