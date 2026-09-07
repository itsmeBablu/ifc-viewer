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

interface ModifyCapsuleItem {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  badge?: string;
  glassStyle: string;
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
  const tools: ModifyCapsuleItem[] = [];

  // 1. select (Honey Amber liquid glass)
  tools.push({
    id: "select",
    label: "Select",
    hint: "Selection mode / Clear selection (Esc)",
    icon: <LuMousePointer2 className="h-4 w-4 stroke-[2.2]" />,
    glassStyle:
      "bg-gradient-to-b from-amber-400/40 via-amber-500/20 to-amber-600/30 border-amber-300/60 text-amber-200 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_4px_16px_rgba(245,158,11,0.35)]",
    isActive: state.tool === "select",
    onClick: () => {
      if (state.tool !== "select") {
        activateModifyTool("select");
      } else {
        clearSelection();
      }
    },
  });

  // 2. Move (Sky Cyan liquid glass)
  tools.push({
    id: "move",
    label: "Move",
    hint: "Translate element (drag gizmo)",
    icon: <LuMove className="h-4 w-4 stroke-[2.2]" />,
    glassStyle:
      "bg-gradient-to-b from-cyan-400/40 via-sky-500/20 to-blue-600/30 border-cyan-300/60 text-cyan-200 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_4px_16px_rgba(6,182,212,0.35)]",
    isActive: state.tool === "move",
    onClick: () => activateModifyTool("move"),
  });

  // 3. rotate (Emerald Jade liquid glass) - not for hosted doors/windows
  if (!isOnlyDoorOrWindow) {
    tools.push({
      id: "rotate",
      label: "Rotate",
      hint: "Rotate element (drag rotation ring)",
      icon: <LuRotate3D className="h-4 w-4 stroke-[2.2]" />,
      glassStyle:
        "bg-gradient-to-b from-emerald-400/40 via-emerald-500/20 to-teal-600/30 border-emerald-300/60 text-emerald-200 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_4px_16px_rgba(16,185,129,0.35)]",
      isActive: state.tool === "rotate",
      onClick: () => activateModifyTool("rotate"),
    });
  }

  // 4. align (Amethyst Purple liquid glass)
  if (!isOnlyDoorOrWindow && !kinds.has("stair") && !kinds.has("ramp")) {
    tools.push({
      id: "align",
      label: "Align",
      hint: "Align element to reference face or edge",
      icon: <LuAlignCenterHorizontal className="h-4 w-4 stroke-[2.2]" />,
      glassStyle:
        "bg-gradient-to-b from-purple-400/40 via-purple-500/20 to-violet-600/30 border-purple-300/60 text-purple-200 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_4px_16px_rgba(168,85,247,0.35)]",
      isActive: state.tool === "align",
      onClick: () => activateModifyTool("align"),
    });
  }

  // 5. mirror (Neon Fuchsia liquid glass)
  tools.push({
    id: "mirror",
    label: "Mirror",
    hint: "Mirror element / Flip orientation",
    icon: <LuFlipHorizontal2 className="h-4 w-4 stroke-[2.2]" />,
    glassStyle:
      "bg-gradient-to-b from-fuchsia-400/40 via-pink-500/20 to-rose-600/30 border-fuchsia-300/60 text-fuchsia-200 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_4px_16px_rgba(217,70,239,0.35)]",
    isActive: state.tool === "mirror",
    onClick: () => activateModifyTool("mirror"),
  });

  // 6. trim (Ruby Rose liquid glass)
  if (isLinear || hasRoofs || hasSlabs) {
    tools.push({
      id: "trim",
      label: "Trim",
      hint: "Trim or extend element (T)",
      icon: <LuScissors className="h-4 w-4 stroke-[2.2]" />,
      glassStyle:
        "bg-gradient-to-b from-pink-400/40 via-rose-500/20 to-red-600/30 border-pink-300/60 text-pink-200 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_4px_16px_rgba(244,63,94,0.35)]",
      isActive: armed === "trim",
      onClick: () => useLayoutDrawingStore.getState().setArmedLayoutTool(armed === "trim" ? null : "trim"),
    });
  }

  // 7. split (Sunset Tangerine liquid glass)
  if (isLinear) {
    tools.push({
      id: "split",
      label: "Split",
      hint: "Split element into two segments",
      icon: <LuDivide className="h-4 w-4 stroke-[2.2]" />,
      glassStyle:
        "bg-gradient-to-b from-orange-400/40 via-amber-500/20 to-orange-600/30 border-orange-300/60 text-orange-200 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_4px_16px_rgba(249,115,22,0.35)]",
      isActive: state.tool === "split",
      onClick: () => activateModifyTool("split"),
    });
  }

  // 8. attach top (Mint Aquamarine liquid glass) - for walls
  if (hasWalls) {
    tools.push({
      id: "attachTop",
      label: "Attach Top",
      hint: "Attach wall top to roof or slab",
      icon: <LuArrowUpToLine className="h-4 w-4 stroke-[2.2]" />,
      glassStyle:
        "bg-gradient-to-b from-teal-400/40 via-teal-500/20 to-emerald-600/30 border-teal-300/60 text-teal-200 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_4px_16px_rgba(20,184,166,0.35)]",
      isActive: state.tool === "attachTop",
      onClick: () => activateModifyTool("attachTop"),
    });
  }

  // 9. attach bottom (Marine Cerulean liquid glass) - for walls
  if (hasWalls) {
    tools.push({
      id: "attachBase",
      label: "Attach Bottom",
      hint: "Attach wall base to roof or slab",
      icon: <LuArrowDownToLine className="h-4 w-4 stroke-[2.2]" />,
      glassStyle:
        "bg-gradient-to-b from-teal-500/40 via-cyan-600/20 to-blue-700/30 border-teal-300/60 text-teal-200 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_4px_16px_rgba(13,148,136,0.35)]",
      isActive: state.tool === "attachBase",
      onClick: () => activateModifyTool("attachBase"),
    });
  }

  // 10. detach (Frosted Silver liquid glass) - for walls or roofs
  if (hasWalls || hasRoofs) {
    tools.push({
      id: "detach",
      label: "Detach",
      hint: "Detach wall top/base or unjoin roof geometry",
      icon: <LuUnlink className="h-4 w-4 stroke-[2.2]" />,
      glassStyle:
        "bg-gradient-to-b from-slate-400/40 via-zinc-500/20 to-slate-600/30 border-slate-300/60 text-slate-100 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_4px_16px_rgba(148,163,184,0.3)]",
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

  // 11. unjoin / join roof (Bronze Amber liquid glass) - for roofs
  if (hasRoofs) {
    const selectedRoof = slabs.find((s) => allSelected.some((sel) => sel.id === s.id && s.kind === "roof"));
    const isJoined = Boolean(selectedRoof?.roofJoin);
    tools.push({
      id: "unjoin",
      label: isJoined ? "Unjoin" : "Join Roof",
      hint: isJoined ? "Unjoin roof geometry" : "Join roof edges to target roof face",
      icon: <IconMarkupRoof className="h-4 w-4 stroke-[2.2]" />,
      glassStyle:
        "bg-gradient-to-b from-amber-500/40 via-orange-600/20 to-amber-700/30 border-amber-300/60 text-amber-200 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_4px_16px_rgba(217,119,6,0.35)]",
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

  // 12. element (Cobalt Blue liquid glass with badge)
  if (hasWalls || hasRoofs || hasSlabs || hasColumns || hasBeams || kinds.has("placement")) {
    const levelBadge = state.level === "element" ? "E" : state.level === "face" ? "F" : state.level === "edge" ? "Ed" : "V";
    tools.push({
      id: "element",
      label: `Element Level: ${state.level}`,
      hint: `Cycle selection level (Element, Face, Edge, Vertex) · Current: ${state.level}`,
      icon: <LuBox className="h-4 w-4 stroke-[2.2]" />,
      badge: levelBadge,
      glassStyle:
        "bg-gradient-to-b from-blue-400/40 via-indigo-500/20 to-blue-700/30 border-blue-300/60 text-blue-200 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_4px_16px_rgba(59,130,246,0.35)]",
      onClick: () => {
        const levels: SelectionLevel[] = ["element", "face", "edge", "vertex"];
        const nextIdx = (levels.indexOf(state.level) + 1) % levels.length;
        useModifyStore.setState({ level: levels[nextIdx], selection: null });
      },
    });
  }

  // 13. copy (Spring Lime liquid glass)
  tools.push({
    id: "copy",
    label: "Copy",
    hint: "Duplicate element with offset",
    icon: <LuCopy className="h-4 w-4 stroke-[2.2]" />,
    glassStyle:
      "bg-gradient-to-b from-lime-400/40 via-emerald-500/20 to-green-600/30 border-lime-300/60 text-lime-200 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_4px_16px_rgba(132,204,22,0.35)]",
    onClick: () =>
      void report(() =>
        transformElements(currentModifySelection(), new Matrix4().makeTranslation(0.1, 0, 0.1), true)
      ),
  });

  // 14. group (Neon Indigo liquid glass)
  if (canGroup) {
    const isGrouped = Boolean(group && !editingGroup);
    tools.push({
      id: "group",
      label: isGrouped ? "Ungroup" : "Group",
      hint: isGrouped ? "Ungroup selected elements" : "Group selected elements together",
      icon: <LuBoxes className="h-4 w-4 stroke-[2.2]" />,
      glassStyle:
        "bg-gradient-to-b from-indigo-400/40 via-purple-500/20 to-indigo-700/30 border-indigo-300/60 text-indigo-200 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_4px_16px_rgba(99,102,241,0.35)]",
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

  // 15. cut (Scarlet Crimson liquid glass)
  if (isLinear || hasColumns || hasBeams) {
    tools.push({
      id: "cut",
      label: "Cut",
      hint: "Cut element to clipboard and remove",
      icon: <LuCrop className="h-4 w-4 stroke-[2.2]" />,
      glassStyle:
        "bg-gradient-to-b from-rose-500/40 via-pink-600/20 to-rose-700/30 border-rose-300/60 text-rose-200 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_4px_16px_rgba(225,29,72,0.35)]",
      onClick: async () => {
        const store = useLayoutDrawingStore.getState();
        await store.copySelected(0, 0);
        await store.deleteSelected();
      },
    });
  }

  // 16. delete (Radiant Red Danger liquid glass)
  tools.push({
    id: "delete",
    label: "Delete",
    hint: "Delete selected elements (Del)",
    icon: <LuTrash2 className="h-4 w-4 stroke-[2.2]" />,
    glassStyle:
      "bg-gradient-to-b from-red-500/45 via-rose-600/25 to-red-700/35 border-red-400/70 text-red-100 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.8),0_4px_18px_rgba(239,68,68,0.5)] hover:bg-red-500/50",
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
      className="werkzeug-ipad-modify-ribbon pointer-events-auto w-full"
      role="toolbar"
      aria-label="Selection Modify Toolbar"
    >
      <div className="relative flex w-full max-w-[calc(100vw-16px)] items-center gap-2 overflow-x-auto rounded-2xl border border-white/20 bg-zinc-950/85 px-2.5 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.65)] backdrop-blur-2xl thin-scroll scrollbar-none touch-pan-x select-none">
        {/* Micro Selection Chip */}
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1 text-[11px] font-bold text-amber-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]">
          <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(250,204,21,0.9)]" />
          <span className="truncate max-w-[90px]">{selectionTitle}</span>
        </div>

        {/* Liquid Glass Capsule Buttons */}
        <div className="flex items-center gap-2">
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              disabled={state.busy}
              onClick={tool.onClick}
              title={`${tool.label} — ${tool.hint}`}
              aria-label={tool.label}
              className={`group relative flex h-10 w-10 min-w-[40px] min-h-[40px] shrink-0 items-center justify-center rounded-full border backdrop-blur-xl transition-all duration-200 active:scale-95 disabled:opacity-40 select-none cursor-pointer overflow-hidden shadow-lg ${
                tool.glassStyle
              } ${
                tool.isActive
                  ? "scale-110 ring-2 ring-white/95 shadow-[0_0_20px_rgba(255,255,255,0.55)] brightness-125 z-10"
                  : "opacity-95 hover:opacity-100 hover:scale-105"
              }`}
            >
              {/* Specular curved reflection sheen */}
              <span
                className="pointer-events-none absolute inset-x-1 top-0 h-[45%] rounded-t-full bg-gradient-to-b from-white/45 via-white/15 to-transparent"
                aria-hidden="true"
              />
              {/* Bottom ambient reflection */}
              <span
                className="pointer-events-none absolute inset-x-2 bottom-0.5 h-[20%] rounded-b-full bg-gradient-to-t from-white/25 to-transparent"
                aria-hidden="true"
              />

              {/* Icon */}
              <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {tool.icon}
              </span>

              {/* Selection Level Badge */}
              {tool.badge && (
                <span className="absolute bottom-0 right-0 z-20 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-blue-500 px-0.5 text-[8px] font-extrabold text-white shadow ring-1 ring-white/70">
                  {tool.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Status message hint (if any) */}
        {state.message && (
          <span className="shrink-0 text-[11px] font-medium text-amber-300 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
            {state.message}
          </span>
        )}
      </div>
    </div>
  );
}
