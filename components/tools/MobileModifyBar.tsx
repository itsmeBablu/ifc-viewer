"use client";

import { useMemo } from "react";
import {
  LuMousePointer2,
  LuMove,
  LuRotate3D,
  LuAlignCenterHorizontal,
  LuFlipHorizontal2,
  LuScissors,
  LuDivide,
  LuArrowUpToLine,
  LuArrowDownToLine,
  LuUnlink,
  LuBox,
  LuCopy,
  LuBoxes,
  LuCrop,
  LuTrash2,
} from "react-icons/lu";
import { IconMarkupRoof } from "./MarkupIcons";
import { useModifyStore, type ModifyTool } from "@/store/useModifyStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { currentModifySelection, saveNamedGroup, transformElements } from "@/lib/modifyOperations";
import { selectionKey, type SelectionLevel } from "@/lib/modifySelection";
import type { SelectedElementRef } from "@/lib/layoutDrawing";
import { Matrix4 } from "three";

export function activateModifyTool(tool: ModifyTool) {
  useLayoutDrawingStore.setState({ armedLayoutTool: null });
  useToolMarkupStore.getState().setArmedTool(null);
  useModifyStore.getState().activate(tool);
}

interface ModifyIconItem {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  badge?: string;
  iconColor: string;
  isActive?: boolean;
  isDanger?: boolean;
  onClick: () => void;
}

export default function MobileModifyBar() {
  const state = useModifyStore();
  const selectedElements = useLayoutDrawingStore((s) => s.selectedElements);
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const selectedStairId = useLayoutDrawingStore((s) => s.selectedStairId);
  const selectedRampId = useLayoutDrawingStore((s) => s.selectedRampId);
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);

  const slabs = useLayoutDrawingStore((s) => s.slabs);
  const groups = useLayoutDrawingStore((s) => s.groups);
  const editingGroup = useLayoutDrawingStore((s) => s.activeGroupId);
  const armed = useLayoutDrawingStore((s) => s.armedLayoutTool);

  // Unified selection list across 2D CAD & 3D BIM views
  const allSelected = useMemo((): SelectedElementRef[] => {
    const list: SelectedElementRef[] = [...selectedElements];
    if (selectedWallId && !list.some((e) => e.id === selectedWallId)) list.push({ kind: "wall", id: selectedWallId });
    if (selectedDoorId && !list.some((e) => e.id === selectedDoorId)) list.push({ kind: "door", id: selectedDoorId });
    if (selectedWindowId && !list.some((e) => e.id === selectedWindowId)) list.push({ kind: "window", id: selectedWindowId });
    if (selectedSlabId && !list.some((e) => e.id === selectedSlabId)) list.push({ kind: "slab", id: selectedSlabId });
    if (selectedStairId && !list.some((e) => e.id === selectedStairId)) list.push({ kind: "stair", id: selectedStairId });
    if (selectedRampId && !list.some((e) => e.id === selectedRampId)) list.push({ kind: "ramp", id: selectedRampId });
    if (selectedPlacementId && !list.some((e) => e.id === selectedPlacementId)) list.push({ kind: "placement", id: selectedPlacementId });
    return list;
  }, [
    selectedElements,
    selectedWallId,
    selectedDoorId,
    selectedWindowId,
    selectedSlabId,
    selectedStairId,
    selectedRampId,
    selectedPlacementId,
  ]);

  const count = allSelected.length;

  // Identify kinds of selected items
  const kinds = useMemo(() => {
    const set = new Set<string>();
    for (const item of allSelected) {
      if (item.kind === "slab") {
        const s = slabs.find((sl) => sl.id === item.id);
        set.add(s?.kind === "roof" ? "roof" : "slab");
      } else {
        set.add(item.kind);
      }
    }
    return set;
  }, [allSelected, slabs]);

  const hasWalls = kinds.has("wall");
  const hasRoofs = kinds.has("roof");
  const hasSlabs = kinds.has("slab");
  const hasBeams = kinds.has("beam");
  const hasColumns = kinds.has("column");
  const hasDuctOrPipe = kinds.has("duct") || kinds.has("pipe") || kinds.has("cabletray") || kinds.has("wire");
  const hasLines = kinds.has("line");
  const isLinear = hasWalls || hasBeams || hasDuctOrPipe || hasLines;
  const isOnlyDoorOrWindow = kinds.size > 0 && [...kinds].every((k) => k === "door" || k === "window");

  // Check if any selected item belongs to a group
  const group = groups.find((g) =>
    allSelected.some((sel) => g.elementRefs.some((r) => selectionKey(r) === selectionKey(sel)))
  );
  const canGroup = count >= 2 || Boolean(group);

  // Compute selection title label
  const selectionTitle = useMemo(() => {
    if (count > 1) return `${count} Items`;
    if (hasWalls) return "Wall";
    if (kinds.has("door")) return "Door";
    if (kinds.has("window")) return "Window";
    if (hasRoofs) return "Roof";
    if (hasSlabs) return "Floor";
    if (hasColumns) return "Column";
    if (hasBeams) return "Beam";
    if (kinds.has("stair")) return "Stair";
    if (kinds.has("ramp")) return "Ramp";
    if (kinds.has("equipment")) return "Equipment";
    if (kinds.has("component")) return "Component";
    if (kinds.has("duct")) return "Duct";
    if (kinds.has("pipe")) return "Pipe";
    if (kinds.has("cabletray")) return "Tray";
    if (kinds.has("wire")) return "Wire";
    if (kinds.has("line")) return "Line";
    if (kinds.has("placement")) return "3D Shape";
    return "Selected";
  }, [count, hasWalls, hasRoofs, hasSlabs, hasColumns, hasBeams, kinds]);

  // Hide completely when no element is selected
  if (count === 0) return null;

  const report = async (work: () => Promise<unknown>) => {
    useModifyStore.setState({ busy: true, message: null });
    try {
      await work();
    } catch (e) {
      useModifyStore.setState({ message: e instanceof Error ? e.message : "Operation failed." });
    } finally {
      useModifyStore.setState({ busy: false });
    }
  };

  const clearSelection = () => {
    useLayoutDrawingStore.getState().clearSelection();
    useToolMarkupStore.getState().clearSelection();
    useModifyStore.setState({ selection: null });
  };

  // Build the list of active tools in exact prompt order:
  // select Move rotate align mirror trim split (attach top bottom , detach , unjoin) element copy group, cut delete
  const tools: ModifyIconItem[] = [];

  // 1. select
  tools.push({
    id: "select",
    label: "Select",
    hint: "Selection mode / Clear selection (Esc)",
    icon: <LuMousePointer2 className="h-4 w-4" />,
    iconColor: "text-amber-400 hover:text-amber-300",
    isActive: state.tool === "select",
    onClick: () => {
      if (state.tool !== "select") {
        activateModifyTool("select");
      } else {
        clearSelection();
      }
    },
  });

  // 2. Move
  tools.push({
    id: "move",
    label: "Move",
    hint: "Translate element (drag gizmo)",
    icon: <LuMove className="h-4 w-4" />,
    iconColor: "text-sky-400 hover:text-sky-300",
    isActive: state.tool === "move",
    onClick: () => activateModifyTool("move"),
  });

  // 3. rotate - not for hosted doors/windows
  if (!isOnlyDoorOrWindow) {
    tools.push({
      id: "rotate",
      label: "Rotate",
      hint: "Rotate element (drag rotation ring)",
      icon: <LuRotate3D className="h-4 w-4" />,
      iconColor: "text-emerald-400 hover:text-emerald-300",
      isActive: state.tool === "rotate",
      onClick: () => activateModifyTool("rotate"),
    });
  }

  // 4. align
  if (!isOnlyDoorOrWindow && !kinds.has("stair") && !kinds.has("ramp")) {
    tools.push({
      id: "align",
      label: "Align",
      hint: "Align element to reference face or edge",
      icon: <LuAlignCenterHorizontal className="h-4 w-4" />,
      iconColor: "text-purple-400 hover:text-purple-300",
      isActive: state.tool === "align",
      onClick: () => activateModifyTool("align"),
    });
  }

  // 5. mirror
  tools.push({
    id: "mirror",
    label: "Mirror",
    hint: "Mirror element / Flip orientation",
    icon: <LuFlipHorizontal2 className="h-4 w-4" />,
    iconColor: "text-fuchsia-400 hover:text-fuchsia-300",
    isActive: state.tool === "mirror",
    onClick: () => activateModifyTool("mirror"),
  });

  // 6. trim
  if (isLinear || hasRoofs || hasSlabs) {
    tools.push({
      id: "trim",
      label: "Trim",
      hint: "Trim or extend element (T)",
      icon: <LuScissors className="h-4 w-4" />,
      iconColor: "text-pink-400 hover:text-pink-300",
      isActive: armed === "trim",
      onClick: () => useLayoutDrawingStore.getState().setArmedLayoutTool(armed === "trim" ? null : "trim"),
    });
  }

  // 7. split
  if (isLinear) {
    tools.push({
      id: "split",
      label: "Split",
      hint: "Split element into two segments",
      icon: <LuDivide className="h-4 w-4" />,
      iconColor: "text-orange-400 hover:text-orange-300",
      isActive: state.tool === "split",
      onClick: () => activateModifyTool("split"),
    });
  }

  // 8. attach top - for walls
  if (hasWalls) {
    tools.push({
      id: "attachTop",
      label: "Attach Top",
      hint: "Attach wall top to roof or slab",
      icon: <LuArrowUpToLine className="h-4 w-4" />,
      iconColor: "text-teal-400 hover:text-teal-300",
      isActive: state.tool === "attachTop",
      onClick: () => activateModifyTool("attachTop"),
    });
  }

  // 9. attach bottom - for walls
  if (hasWalls) {
    tools.push({
      id: "attachBase",
      label: "Attach Bottom",
      hint: "Attach wall base to roof or slab",
      icon: <LuArrowDownToLine className="h-4 w-4" />,
      iconColor: "text-cyan-400 hover:text-cyan-300",
      isActive: state.tool === "attachBase",
      onClick: () => activateModifyTool("attachBase"),
    });
  }

  // 10. detach - for walls or roofs
  if (hasWalls || hasRoofs) {
    tools.push({
      id: "detach",
      label: "Detach",
      hint: "Detach wall top/base or unjoin roof geometry",
      icon: <LuUnlink className="h-4 w-4" />,
      iconColor: "text-slate-300 hover:text-slate-200",
      onClick: () =>
        void report(async () => {
          const layout = useLayoutDrawingStore.getState();
          for (const ref of currentModifySelection()) {
            if (ref.kind === "wall") {
              await layout.updateWall(ref.id, { attachedTopRoofId: undefined, attachedBaseRoofId: undefined });
            }
            const roof = layout.slabs.find((s) => s.id === ref.id);
            if (roof?.roofJoin) {
              const boundary = roof.roofJoin.originalBoundary;
              await layout.updateSlab(roof.id, {
                boundary,
                roofJoin: undefined,
                minXmm: Math.min(...boundary.map((p) => p.xMm)),
                maxXmm: Math.max(...boundary.map((p) => p.xMm)),
                minYmm: Math.min(...boundary.map((p) => p.yMm)),
                maxYmm: Math.max(...boundary.map((p) => p.yMm)),
              });
            }
          }
        }),
    });
  }

  // 11. unjoin / join roof - for roofs
  if (hasRoofs) {
    const selectedRoof = slabs.find((s) => allSelected.some((sel) => sel.id === s.id && s.kind === "roof"));
    const isJoined = Boolean(selectedRoof?.roofJoin);
    tools.push({
      id: "unjoin",
      label: isJoined ? "Unjoin" : "Join Roof",
      hint: isJoined ? "Unjoin roof geometry" : "Join roof edges to target roof face",
      icon: <IconMarkupRoof className="h-4 w-4" />,
      iconColor: "text-amber-500 hover:text-amber-400",
      isActive: state.tool === "joinRoof",
      onClick: () => {
        if (isJoined && selectedRoof) {
          const boundary = selectedRoof.roofJoin!.originalBoundary;
          void useLayoutDrawingStore.getState().updateSlab(selectedRoof.id, {
            boundary,
            roofJoin: undefined,
            minXmm: Math.min(...boundary.map((p) => p.xMm)),
            maxXmm: Math.max(...boundary.map((p) => p.xMm)),
            minYmm: Math.min(...boundary.map((p) => p.yMm)),
            maxYmm: Math.max(...boundary.map((p) => p.yMm)),
          });
        } else {
          activateModifyTool("joinRoof");
        }
      },
    });
  }

  // 12. element level
  if (hasWalls || hasRoofs || hasSlabs || hasColumns || hasBeams || kinds.has("placement")) {
    const levelBadge = state.level === "element" ? "E" : state.level === "face" ? "F" : state.level === "edge" ? "Ed" : "V";
    tools.push({
      id: "element",
      label: `Element Level: ${state.level}`,
      hint: `Cycle selection level (Element, Face, Edge, Vertex) · Current: ${state.level}`,
      icon: <LuBox className="h-4 w-4" />,
      badge: levelBadge,
      iconColor: "text-blue-400 hover:text-blue-300",
      onClick: () => {
        const levels: SelectionLevel[] = ["element", "face", "edge", "vertex"];
        const nextIdx = (levels.indexOf(state.level) + 1) % levels.length;
        useModifyStore.setState({ level: levels[nextIdx], selection: null });
      },
    });
  }

  // 13. copy
  tools.push({
    id: "copy",
    label: "Copy",
    hint: "Duplicate element with offset",
    icon: <LuCopy className="h-4 w-4" />,
    iconColor: "text-lime-400 hover:text-lime-300",
    onClick: () =>
      void report(() =>
        transformElements(currentModifySelection(), new Matrix4().makeTranslation(0.1, 0, 0.1), true)
      ),
  });

  // 14. group
  if (canGroup) {
    const isGrouped = Boolean(group && !editingGroup);
    tools.push({
      id: "group",
      label: isGrouped ? "Ungroup" : "Group",
      hint: isGrouped ? "Ungroup selected elements" : "Group selected elements together",
      icon: <LuBoxes className="h-4 w-4" />,
      iconColor: "text-indigo-400 hover:text-indigo-300",
      onClick: () => {
        if (isGrouped && group) {
          void report(() => useLayoutDrawingStore.getState().ungroup(group.id));
        } else if (count >= 2) {
          void report(async () => {
            await saveNamedGroup(`Group ${groups.length + 1}`);
          });
        }
      },
    });
  }

  // 15. cut
  if (isLinear || hasColumns || hasBeams) {
    tools.push({
      id: "cut",
      label: "Cut",
      hint: "Cut element to clipboard and remove",
      icon: <LuCrop className="h-4 w-4" />,
      iconColor: "text-rose-400 hover:text-rose-300",
      onClick: async () => {
        const store = useLayoutDrawingStore.getState();
        await store.copySelected(0, 0);
        await store.deleteSelected();
      },
    });
  }

  // 16. delete
  tools.push({
    id: "delete",
    label: "Delete",
    hint: "Delete selected elements (Del)",
    icon: <LuTrash2 className="h-4 w-4" />,
    iconColor: "text-red-500 hover:text-red-400",
    isDanger: true,
    onClick: () => {
      const markup = useToolMarkupStore.getState();
      if (markup.selectedPlacementId) {
        markup.deletePlacement(markup.selectedPlacementId);
      } else {
        void useLayoutDrawingStore.getState().deleteSelected();
      }
    },
  });

  return (
    <div
      className="werkzeug-ipad-modify-ribbon pointer-events-auto w-full !bg-transparent !border-0 !shadow-none !backdrop-blur-none !overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      role="toolbar"
      aria-label="Selection Modify Toolbar"
    >
      <div className="relative flex w-full max-w-[calc(100vw-16px)] items-center gap-1.5 overflow-x-auto overflow-y-hidden bg-transparent border-0 p-0 shadow-none backdrop-blur-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden touch-pan-x select-none">
        {/* Compact Selection Title */}
        <span className="shrink-0 text-[10px] font-bold tracking-tight text-amber-400 pl-1 pr-1">
          {selectionTitle}
        </span>
        <span className="h-3.5 w-px bg-white/20 shrink-0" aria-hidden="true" />

        {/* Small Icons Floating Directly on 3D View Without Any Background — Round Liquid Glass Button on Click */}
        <div className="flex items-center gap-1">
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              disabled={state.busy}
              onClick={tool.onClick}
              title={`${tool.label} — ${tool.hint}`}
              aria-label={tool.label}
              className={`btn-liquid-glass-round relative shrink-0 disabled:opacity-30 ${
                tool.isDanger ? "is-danger" : ""
              } ${tool.isActive ? "is-active" : tool.iconColor}`}
            >
              {tool.icon}

              {/* Selection Level Mini Badge */}
              {tool.badge && (
                <span
                  className={`absolute -bottom-0.5 -right-0.5 text-[7px] font-extrabold leading-none ${
                    tool.isActive ? "text-zinc-900" : "text-blue-400"
                  }`}
                >
                  {tool.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Status message hint (if any) */}
        {state.message && (
          <span className="shrink-0 text-[10px] font-medium text-amber-300 pl-1">
            {state.message}
          </span>
        )}
      </div>
    </div>
  );
}
