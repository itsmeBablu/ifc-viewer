"use client";

import LayoutPropertiesPanel from "./LayoutPropertiesPanel";
import MarkupPropertiesPanel from "./MarkupPropertiesPanel";
import ToolFloorsSection from "./ToolFloorsSection";

/**
 * Editor tab body — levels + selection properties (chrome moved to top/left).
 */
export default function ToolEditorPanel({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-0 flex-col gap-2.5 overflow-y-auto thin-scroll ${className}`}
    >
      <ToolFloorsSection className="max-h-44 shrink-0" />
      <div className="border-t border-[var(--panel-divider)] pt-2">
        <LayoutPropertiesPanel className="mb-2" />
        <MarkupPropertiesPanel className="!border-0 !bg-transparent !p-0 !shadow-none" />
      </div>
    </div>
  );
}
