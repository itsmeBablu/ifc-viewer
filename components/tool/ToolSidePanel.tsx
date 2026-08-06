"use client";

/**
 * ToolSidePanel — root panel for the Werkzeug (native IFC inspection) mode;
 * composes IfcStructureTree above ElementInspector, replacing the legend
 * panel while this view is active.
 *
 * Reads activeModelLabel from useAppStore, and hides IfcSpace volumes by
 * default via setElementsVisible once per loaded model.
 */

import { useEffect, useRef } from "react";
import { t } from "@/lib/i18n";
import type { IfcStructure } from "@/lib/ifcStructure";
import { useAppStore } from "@/store/useAppStore";
import ModelText from "../common/ModelText";
import ElementInspector from "./ElementInspector";
import IfcStructureTree from "./IfcStructureTree";
import { useIfcStructure } from "./useIfcStructure";

/**
 * Werkzeug side panel — IFC spatial tree on top, selected element details below.
 * Replaces the legend while the tool view is active.
 */
export default function ToolSidePanel({
  className = "",
}: {
  className?: string;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const setElementsVisible = useAppStore((s) => s.setElementsVisible);
  const { structure, loading } = useIfcStructure(true);
  const spacesAppliedFor = useRef<IfcStructure | null>(null);

  // IfcSpace volumes hide the building when shown by default — start them off,
  // exactly like desktop BIM viewers do.
  useEffect(() => {
    if (!structure || spacesAppliedFor.current === structure) return;
    spacesAppliedFor.current = structure;
    if (structure.spaceIds.length) {
      setElementsVisible(structure.spaceIds, false);
    }
  }, [structure, setElementsVisible]);

  return (
    <div className={`flex min-h-0 flex-col gap-1.5 p-3 ${className}`}>
      <header className="px-1">
        <h2 className="text-sm font-semibold tracking-wide text-[var(--text-strong)]">
          {t(uiLanguage, "tool")}
        </h2>
        {activeModelLabel && (
          <ModelText className="block truncate text-[10px] font-medium text-[var(--text-muted)]">
            {activeModelLabel}
          </ModelText>
        )}
      </header>

      <IfcStructureTree
        structure={structure}
        loading={loading}
        className="min-h-[8rem] flex-[3]"
      />

      <div className="border-t border-[var(--panel-divider)]" />

      <ElementInspector className="min-h-[9rem] flex-[2]" />
    </div>
  );
}
