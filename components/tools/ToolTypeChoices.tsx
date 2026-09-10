"use client";

import { useState } from "react";
import { DEFAULT_ELEMENT_TYPES, type ElementTypeDefinition } from "./EditTypeDialog";
import { TOOL_TYPE_CATEGORY } from "@/lib/bimTypeCatalog";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import type { LayoutToolId } from "@/lib/layoutDrawing";
import { ComponentLibrary } from "./ComponentProperties";

interface ToolTypeChoicesProps {
  tool: LayoutToolId;
  onChoose?: () => void;
  selectedElement?: { kind: string; id: string };
}

export default function ToolTypeChoices({ tool, onChoose, selectedElement }: ToolTypeChoicesProps) {
  const store = useLayoutDrawingStore();
  const [search, setSearch] = useState("");

  if (tool === "equipment" || tool === "component" || selectedElement?.kind === "equipment") {
    const item = selectedElement && store.armedLayoutTool !== "component" && store.armedLayoutTool !== "equipment"
      ? store.mepEquipment.find((eq) => eq.id === selectedElement.id)
      : undefined;
    return <ComponentLibrary item={item} onChoose={onChoose} />;
  }

  const resolvedTool = tool === "lines" && store.sketchTargetKind ? store.sketchTargetKind : tool;
  const category = TOOL_TYPE_CATEGORY[resolvedTool];
  if (!category) return null;

  const types = Object.values(DEFAULT_ELEMENT_TYPES).filter(
    (t) => t.category === category && t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelectType = (type: ElementTypeDefinition) => {
    if (selectedElement) {
      const { kind, id } = selectedElement;
      if (kind === "wall") {
        void store.updateWall(id, {
          wallTypeId: type.id,
          thicknessMm: type.thicknessMm,
          heightMm: type.heightMm,
          material: type.material,
        });
      } else if (kind === "door") {
        void store.updateDoor(id, {
          typeId: type.id,
          widthMm: type.widthMm,
          heightMm: type.heightMm,
          style: type.doorStyle ?? (type.id.includes("double") ? "double" : "wood"),
          headShape: type.headShape === "round" ? "arched" : type.headShape,
          material: type.material,
        });
      } else if (kind === "window") {
        void store.updateWindow(id, {
          typeId: type.id,
          widthMm: type.widthMm,
          heightMm: type.heightMm,
          sillHeightMm: type.sillHeightMm,
          headShape: type.headShape,
          sashCount: type.sashCount,
          operation: type.windowOperation,
          material: type.material,
        });
      } else if (kind === "column") {
        void store.updateColumn(id, {
          widthMm: type.widthMm,
          depthMm: type.depthMm,
          profile: type.structuralProfile ?? "rect",
          material: type.material,
        });
      } else if (kind === "beam") {
        void store.updateBeam(id, {
          widthMm: type.widthMm,
          depthMm: type.depthMm,
          profile: type.structuralProfile === "i" ? "i" : "rect",
          material: type.material,
        });
      } else if (kind === "stair") {
        void store.updateStair(id, {
          widthMm: type.widthMm,
          stairType: type.id.includes("spiral")
            ? "spiral"
            : type.id.includes("ushape")
            ? "u-shape"
            : type.id.includes("lshape")
            ? "l-shape"
            : "straight",
        });
      } else if (kind === "slab") {
        void store.updateSlab(id, {
          thicknessMm: type.thicknessMm,
        });
      }
    } else {
      store.applyElementType(resolvedTool, type);
    }
    onChoose?.();
  };

  const isCurrentType = (type: ElementTypeDefinition) => {
    if (selectedElement) {
      if (selectedElement.kind === "wall") {
        const w = store.walls.find((x) => x.id === selectedElement.id);
        return (w?.wallTypeId ?? (w as unknown as { typeId?: string })?.typeId) === type.id;
      }
      if (selectedElement.kind === "door") {
        const d = store.doors.find((x) => x.id === selectedElement.id);
        return d?.typeId === type.id || (type.doorStyle && d?.style === type.doorStyle);
      }
      if (selectedElement.kind === "window") {
        const win = store.windows.find((x) => x.id === selectedElement.id);
        return win?.typeId === type.id || (win?.sashCount === type.sashCount && win?.headShape === type.headShape);
      }
      if (selectedElement.kind === "column") {
        const col = store.columns.find((x) => x.id === selectedElement.id);
        return col?.profile === type.structuralProfile;
      }
      if (selectedElement.kind === "beam") {
        const bm = store.beams.find((x) => x.id === selectedElement.id);
        return bm?.profile === type.structuralProfile;
      }
    }
    return store.draftElementTypes[resolvedTool]?.id === type.id;
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{category} types</p>
        <span className="text-[9px] text-[var(--text-muted)]">{types.length} options</span>
      </div>
      <input
        aria-label={`Find ${category} type`}
        placeholder="Find type…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-7 w-full rounded border border-[var(--panel-divider)] bg-[var(--surface-card)] px-2 text-[11px] text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:border-yellow-400 focus:outline-none"
      />
      <div className="max-h-52 overflow-y-auto thin-scroll space-y-0.5">
        {types.map((type) => {
          const active = isCurrentType(type);
          return (
            <button
              type="button"
              key={type.id}
              className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[10px] transition-colors ${
                active
                  ? "bg-yellow-400/20 text-yellow-600 font-semibold dark:text-yellow-400"
                  : "hover:bg-[var(--surface-overlay)] text-[var(--text-strong)]"
              }`}
              onClick={() => handleSelectType(type)}
            >
              <span>{type.name}</span>
              {type.material && <span className="text-[9px] text-[var(--text-muted)] ml-2">{type.material}</span>}
            </button>
          );
        })}
        {types.length === 0 && (
          <p className="px-2 py-2 text-center text-[10px] text-[var(--text-muted)]">No matching types</p>
        )}
      </div>
    </div>
  );
}
