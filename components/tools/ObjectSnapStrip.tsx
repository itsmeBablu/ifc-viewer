"use client";

import { useEffect, useRef, useState } from "react";
import { LuCheck, LuChevronDown, LuMagnet } from "react-icons/lu";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import {
  SnapApparentIcon, SnapCenterIcon, SnapEndpointIcon, SnapExtensionIcon,
  SnapInsertionIcon, SnapIntersectionIcon, SnapMidpointIcon, SnapNearestIcon,
  SnapNodeIcon, SnapParallelIcon, SnapPerpendicularIcon, SnapQuadrantIcon,
  SnapTangentIcon,
} from "./SnapIcons";

const SNAP_ITEMS = [
  ["endpoint", "Endpoint", SnapEndpointIcon], ["midpoint", "Midpoint", SnapMidpointIcon],
  ["center", "Center", SnapCenterIcon], ["node", "Node", SnapNodeIcon],
  ["quadrant", "Quadrant", SnapQuadrantIcon], ["intersection", "Intersection", SnapIntersectionIcon],
  ["extension", "Extension", SnapExtensionIcon], ["insertion", "Insertion", SnapInsertionIcon],
  ["perpendicular", "Perpendicular", SnapPerpendicularIcon], ["tangent", "Tangent", SnapTangentIcon],
  ["nearest", "Nearest", SnapNearestIcon], ["apparent", "Apparent", SnapApparentIcon],
  ["parallel", "Parallel", SnapParallelIcon],
] as const;

export default function ObjectSnapStrip({ compact = false, iconOnly = false, showCount = true }: { compact?: boolean; iconOnly?: boolean; showCount?: boolean }) {
  const modes = useLayoutDrawingStore((state) => state.planSnapModes);
  const setMode = useLayoutDrawingStore((state) => state.setPlanSnapMode);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeCount = SNAP_ITEMS.filter(([mode]) => modes[mode]).length;

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={rootRef} className={`werkzeug-snap-dropdown ${compact ? "is-compact" : ""} ${iconOnly ? "is-icon-only" : ""}`}>
      <button type="button" title="Object snaps" aria-label={`Object snaps · ${activeCount} active`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)} className={`werkzeug-snap-trigger ${open ? "is-open" : ""}`}>
        <LuMagnet className="h-4 w-4" />
        {!iconOnly && <><span>Snaps</span>{showCount && <span className="werkzeug-snap-count">{activeCount}</span>}<LuChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} /></>}
      </button>
      {open && <div className="werkzeug-snap-menu" role="menu" aria-label="Object snaps">
        <div className="werkzeug-snap-menu-heading"><span>Object snaps</span>{showCount && <span>{activeCount} active</span>}</div>
        <div className="werkzeug-snap-menu-grid">
          {SNAP_ITEMS.map(([mode, label, Icon]) => {
            const active = modes[mode];
              <button
                key={mode}
                type="button"
                role="menuitemcheckbox"
                aria-checked={active}
                title={`${label} object snap`}
                onClick={() => setMode(mode, !active)}
                className={`werkzeug-snap-pill flex items-center justify-between gap-1.5 rounded-xl px-2.5 py-1.5 text-xs transition-all ${
                  active
                    ? "is-active btn-v-yellow btn-liquid-hover !text-zinc-950 font-bold"
                    : "btn-yellow-border-hover border border-transparent bg-[var(--surface-overlay)] text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="werkzeug-snap-icon h-3.5 w-3.5" />
                  <span className="werkzeug-snap-name text-[11px] font-medium">{label}</span>
                </div>
                <LuCheck className={`werkzeug-snap-check h-3.5 w-3.5 ${active ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />
              </button>
          })}
        </div>
      </div>}
    </div>
  );
}
