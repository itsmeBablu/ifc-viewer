"use client";

/**
 * ElementInspector — tabbed property inspector for the Werkzeug tool panel.
 * Shows the selected IFC element's attributes, grouped property sets, and
 * quantities, falling back to Attributes when a tab has no content.
 *
 * Reads `selectedElement`, `toolSelectedExpressId`, and `floors` from
 * useAppStore; the element is set by IfcStructureTree or a 3D pick.
 */

import { useMemo, useState } from "react";
import { t, type UiTextKey } from "@/lib/i18n";
import { humanizeIfcType } from "@/lib/ifcStructure";
import type { ElementProperty } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import ModelText from "../common/ModelText";

type TabId = "attributes" | "psets" | "quantities" | "all";

const TABS: { id: TabId; labelKey: UiTextKey }[] = [
  { id: "attributes", labelKey: "attributes" },
  { id: "psets", labelKey: "propertySets" },
  { id: "quantities", labelKey: "quantities" },
  { id: "all", labelKey: "allProperties" },
];

function isQuantity(prop: ElementProperty): boolean {
  const pset = (prop.pset ?? "").toLowerCase();
  return (
    pset.startsWith("qto") ||
    pset.includes("basequantities") ||
    pset.includes("quantit") ||
    pset.includes("mengen")
  );
}

function groupByPset(
  props: ElementProperty[],
): { pset: string; items: ElementProperty[] }[] {
  const map = new Map<string, ElementProperty[]>();
  for (const prop of props) {
    const key = prop.pset?.trim() || "—";
    const bucket = map.get(key) ?? [];
    bucket.push(prop);
    map.set(key, bucket);
  }
  return [...map.entries()]
    .map(([pset, items]) => ({ pset, items }))
    .sort((a, b) => a.pset.localeCompare(b.pset));
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-2 py-[3px]">
      <ModelText className="min-w-0 truncate text-[10.5px] font-medium text-[var(--text-muted)]">
        {label}
      </ModelText>
      <ModelText className="min-w-0 break-words text-[10.5px] text-[var(--text-body)]">
        {value || "—"}
      </ModelText>
    </div>
  );
}

export default function ElementInspector({
  className = "",
}: {
  className?: string;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const selectedElement = useAppStore((s) => s.selectedElement);
  const toolSelectedExpressId = useAppStore((s) => s.toolSelectedExpressId);
  const floors = useAppStore((s) => s.floors);
  const [tab, setTab] = useState<TabId>("attributes");

  const properties = useMemo(
    () => selectedElement?.properties ?? [],
    [selectedElement],
  );
  const quantities = useMemo(
    () => properties.filter(isQuantity),
    [properties],
  );
  const psets = useMemo(
    () => groupByPset(properties.filter((p) => !isQuantity(p))),
    [properties],
  );

  const tabHasContent = (id: TabId): boolean => {
    if (id === "attributes") return true;
    if (id === "quantities") return quantities.length > 0;
    if (id === "psets") return psets.length > 0;
    return properties.length > 0;
  };

  // Fall back to Attributes when the new element has nothing for the open tab.
  const activeTab: TabId = tabHasContent(tab) ? tab : "attributes";

  const pending =
    toolSelectedExpressId != null &&
    selectedElement?.expressId !== toolSelectedExpressId;

  const floorName = selectedElement?.floorId
    ? (floors.find((f) => f.id === selectedElement.floorId)?.name ?? null)
    : null;

  const tabBtn = (active: boolean) =>
    `rounded-lg px-2 py-1 text-[10px] font-semibold tracking-wide transition-colors duration-150 ${
      active
        ? "bg-[var(--chip-active-bg)] text-[var(--text-strong)] shadow-[inset_0_0_0_1px_var(--panel-divider)]"
        : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-body)]"
    }`;

  return (
    <section className={`flex min-h-0 flex-col ${className}`}>
      <div className="flex items-baseline justify-between gap-2 px-1 pb-1">
        <h3 className="text-xs font-semibold tracking-wide text-[var(--text-strong)]">
          {t(uiLanguage, "elementDetails")}
        </h3>
        {selectedElement && (
          <span className="shrink-0 text-[9px] font-medium tabular-nums text-[var(--text-muted)]">
            #{selectedElement.expressId}
          </span>
        )}
      </div>

      {!selectedElement ? (
        <div className="rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] px-2.5 py-3">
          <p className="text-[11px] font-semibold text-[var(--text-body)]">
            {pending
              ? t(uiLanguage, "buildingStructureLoading")
              : t(uiLanguage, "noElementSelected")}
          </p>
          {!pending && (
            <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--text-muted)]">
              {t(uiLanguage, "noElementSelectedHint")}
            </p>
          )}
        </div>
      ) : (
        <>
          <ModelText className="truncate px-1 text-[11px] font-semibold text-[var(--text-strong)]">
            {selectedElement.name}
          </ModelText>

          <div className="mt-1 flex flex-wrap gap-0.5 px-0.5">
            {TABS.filter((entry) => tabHasContent(entry.id)).map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                className={tabBtn(activeTab === entry.id)}
              >
                {t(uiLanguage, entry.labelKey)}
              </button>
            ))}
          </div>

          <div className="thin-scroll mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
            {activeTab === "attributes" && (
              <div className="divide-y divide-[var(--panel-divider)]/50">
                <Row
                  label={t(uiLanguage, "ifcType")}
                  value={`${humanizeIfcType(selectedElement.typeName)} (${selectedElement.typeName})`}
                />
                <Row label="Name" value={selectedElement.name} />
                {selectedElement.materialName && (
                  <Row
                    label={t(uiLanguage, "material")}
                    value={selectedElement.materialName}
                  />
                )}
                <Row
                  label={t(uiLanguage, "globalId")}
                  value={selectedElement.globalId}
                />
                <Row
                  label={t(uiLanguage, "expressId")}
                  value={String(selectedElement.expressId)}
                />
                {floorName && (
                  <Row label={t(uiLanguage, "floorLevel")} value={floorName} />
                )}
              </div>
            )}

            {activeTab === "psets" &&
              psets.map((group) => (
                <div key={group.pset} className="mb-2">
                  <ModelText className="block truncate pb-0.5 text-[9.5px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
                    {group.pset}
                  </ModelText>
                  <div className="divide-y divide-[var(--panel-divider)]/50 rounded-lg bg-[var(--glass-inset-bg)] px-1.5">
                    {group.items.map((prop, i) => (
                      <Row
                        key={`${group.pset}-${prop.name}-${i}`}
                        label={prop.name}
                        value={prop.value}
                      />
                    ))}
                  </div>
                </div>
              ))}

            {activeTab === "quantities" && (
              <div className="divide-y divide-[var(--panel-divider)]/50">
                {quantities.map((prop, i) => (
                  <Row
                    key={`${prop.name}-${i}`}
                    label={prop.name}
                    value={prop.value}
                  />
                ))}
              </div>
            )}

            {activeTab === "all" && (
              <div className="divide-y divide-[var(--panel-divider)]/50">
                {properties.map((prop, i) => (
                  <Row
                    key={`${prop.pset ?? ""}-${prop.name}-${i}`}
                    label={prop.pset ? `${prop.pset} · ${prop.name}` : prop.name}
                    value={prop.value}
                  />
                ))}
              </div>
            )}

            {activeTab !== "attributes" && properties.length === 0 && (
              <p className="py-2 text-[10.5px] font-medium text-[var(--text-muted)]">
                {t(uiLanguage, "noPropertiesAvailable")}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
