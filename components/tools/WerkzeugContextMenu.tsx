"use client";

/**
 * WerkzeugContextMenu — right-click context menu for the 3D canvas (distinct
 * from a drag/pan gesture, which is suppressed). Offers view toggles (compare
 * both modes, seasonal background, autofocus, fullscreen), a save-view flyout
 * (name + PDF page format + slice-height slider) and a floor-isolate flyout,
 * plus loading a new IFC file.
 *
 * Reads/writes many useAppStore fields (dataViewMode, floors/rooms,
 * presentation isolate state, autoSceneBackground, autoFocusSelection) and
 * calls `viewerRef.current?.getCameraPose()` / `addSavedView` to persist views.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { MdKeyboardArrowRight } from "react-icons/md";
import { LuEye, LuEyeOff, LuFocus, LuRotateCcw } from "react-icons/lu";
import { compareBothModesLabelKey, supportsCompareBothModes } from "@/lib/dataViewMode";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import type { PageFormat } from "@/lib/presentationLayout";
import type { MarkupViewPreset } from "@/lib/toolMarkup";
import { MARKUP_TOOL_ORDER } from "./MarkupIcons";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import SliceHeightSlider from "../common/SliceHeightSlider";
import type { WerkzeugViewer3DHandle } from "./WerkzeugViewer3D";
import ModelText from "../common/ModelText";

type Props = {
  viewerRef: RefObject<WerkzeugViewer3DHandle | null>;
  rootRef: RefObject<HTMLElement | null>;
  onLoadIfc: (file: File) => void;
  loadDisabled?: boolean;
};

type MenuState = {
  x: number;
  y: number;
};

type SidePanel = "save" | "floor" | "shapes" | null;

const ctxMenuSurface =
  "context-menu-surface isolate overflow-hidden rounded-[22px] border border-white/80 bg-gradient-to-br from-white/95 via-white/82 to-slate-100/72 text-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,1),inset_0_-1px_0_rgba(148,163,184,0.12),0_18px_50px_rgba(15,23,42,0.22)] backdrop-blur-2xl";

const ctxItemIdle =
  "flex w-full items-center justify-between gap-2 overflow-hidden rounded-xl border border-transparent px-2.5 py-2 text-left text-xs font-medium text-zinc-700 transition hover:border-white hover:bg-white/80 hover:text-zinc-950 hover:shadow-[0_5px_16px_rgba(15,23,42,0.08)] disabled:opacity-40";

const ctxItemActive =
  "overflow-hidden rounded-xl border-white bg-white/90 text-zinc-950 shadow-[inset_0_1px_0_white,0_5px_16px_rgba(15,23,42,0.10)]";

const ctxChipOn =
  "overflow-hidden rounded-lg border border-white bg-white text-zinc-900 shadow-[inset_0_1px_0_white,0_3px_10px_rgba(15,23,42,0.10)]";

const ctxChipOff =
  "overflow-hidden rounded-lg border border-transparent bg-white/35 text-zinc-500 transition hover:border-white hover:bg-white/80 hover:text-zinc-900";

const ctxToggleOn = "bg-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.55)]";
const ctxToggleOff = "ctx-toggle-off bg-amber-200/70";

const ctxLabel = "text-[10px] font-semibold tracking-wide text-[var(--text-muted)]";

const ctxPrimaryBtn =
  "w-full rounded-xl border border-white bg-white/85 px-2 py-1.5 text-xs font-semibold text-zinc-800 shadow-[inset_0_1px_0_white,0_4px_14px_rgba(15,23,42,0.10)] transition hover:bg-white disabled:opacity-40";

function getCategoryInfo(kind: string): { id: string; label: string } {
  switch (kind) {
    case "wall":
      return { id: "walls", label: "Walls" };
    case "door":
      return { id: "doors", label: "Doors" };
    case "window":
      return { id: "windows", label: "Windows" };
    case "slab":
      return { id: "slabs", label: "Floors & Roofs" };
    case "column":
    case "beam":
      return { id: "structural", label: "Columns & Beams" };
    case "stair":
    case "ramp":
      return { id: "circulation", label: "Stairs & Ramps" };
    case "duct":
    case "pipe":
    case "cabletray":
    case "equipment":
    case "wire":
      return { id: "mep", label: "MEP Systems" };
    default:
      return { id: kind, label: `${kind[0].toUpperCase()}${kind.slice(1)}s` };
  }
}

/**
 * Right-click context menu for the 3D canvas.
 */
export default function WerkzeugContextMenu({
  viewerRef,
  rootRef,
  onLoadIfc,
  loadDisabled,
}: Props) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const compareBothModes = useAppStore((s) => s.compareBothModes);
  const setCompareBothModes = useAppStore((s) => s.setCompareBothModes);
  const dataViewMode = useAppStore((s) => s.dataViewMode);
  const floors = useAppStore((s) => s.floors);
  const rooms = useAppStore((s) => s.rooms);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const setSelectedFloor = useAppStore((s) => s.setSelectedFloor);
  const isPresentationView = useAppStore((s) => s.isPresentationView);
  const presentationIsolate = useAppStore((s) => s.presentationIsolate);
  const presentationFloorId = useAppStore((s) => s.presentationFloorId);
  const setPresentationFloorIsolate = useAppStore(
    (s) => s.setPresentationFloorIsolate,
  );
  const setViewerContextMenuOpen = useAppStore(
    (s) => s.setViewerContextMenuOpen,
  );
  const activeModelId = useAppStore((s) => s.activeModelId);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const colorMode = useAppStore((s) => s.colorMode);
  const autoSceneBackground = useAppStore((s) => s.autoSceneBackground);
  const setAutoSceneBackground = useAppStore((s) => s.setAutoSceneBackground);
  const autoFocusSelection = useAppStore((s) => s.autoFocusSelection);
  const setAutoFocusSelection = useAppStore((s) => s.setAutoFocusSelection);
  const show3DGrid = useAppStore((s) => s.show3DGrid);
  const setShow3DGrid = useAppStore((s) => s.setShow3DGrid);
  const addSavedView = useAppStore((s) => s.addSavedView);
  const toolMode = useAppStore((s) => s.toolMode);

  const viewPreset = useToolMarkupStore((s) => s.viewPreset);
  const setViewPreset = useToolMarkupStore((s) => s.setViewPreset);
  const quadView = useToolMarkupStore((s) => s.quadView);
  const setQuadView = useToolMarkupStore((s) => s.setQuadView);
  const setArmedTool = useToolMarkupStore((s) => s.setArmedTool);
  const setTransformMode = useToolMarkupStore((s) => s.setTransformMode);
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);
  const deletePlacement = useToolMarkupStore((s) => s.deletePlacement);
  const clearSelection = useToolMarkupStore((s) => s.clearSelection);
  const placements = useToolMarkupStore((s) => s.placements);
  const beginNoteAt = useToolMarkupStore((s) => s.beginNoteAt);
  const updatePlacement = useToolMarkupStore((s) => s.updatePlacement);
  const placeShape = useToolMarkupStore((s) => s.placeShape);
  const defaultColor = useToolMarkupStore((s) => s.defaultColor);

  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const deleteWall = useLayoutDrawingStore((s) => s.deleteWall);
  const deleteDoor = useLayoutDrawingStore((s) => s.deleteDoor);
  const deleteWindow = useLayoutDrawingStore((s) => s.deleteWindow);
  const walls = useLayoutDrawingStore((s) => s.walls);
  const doors = useLayoutDrawingStore((s) => s.doors);
  const windows = useLayoutDrawingStore((s) => s.windows);
  const clearLayoutSelection = useLayoutDrawingStore(
    (s) => s.clearLayoutSelection,
  );
  const selectedElements = useLayoutDrawingStore((s) => s.selectedElements);
  const moveSelected = useLayoutDrawingStore((s) => s.moveSelected);
  const copySelected = useLayoutDrawingStore((s) => s.copySelected);
  const deleteSelected = useLayoutDrawingStore((s) => s.deleteSelected);
  const lockedElementKeys = useLayoutDrawingStore((s) => s.lockedElementKeys);
  const setRightPanelOpen = useAppStore((s) => s.setRightPanelOpen);

  // Visibility / Eye mode store bindings
  const hiddenElementIds = useLayoutDrawingStore((s) => s.hiddenElementIds);
  const hiddenCategories = useLayoutDrawingStore((s) => s.hiddenCategories);
  const isolatedElementIds = useLayoutDrawingStore((s) => s.isolatedElementIds);
  const revealHiddenMode = useLayoutDrawingStore((s) => s.revealHiddenMode);
  const hideSelected = useLayoutDrawingStore((s) => s.hideSelected);
  const isolateSelected = useLayoutDrawingStore((s) => s.isolateSelected);
  const isolateCategory = useLayoutDrawingStore((s) => s.isolateCategory);
  const toggleHideCategory = useLayoutDrawingStore((s) => s.toggleHideCategory);
  const toggleHideElement = useLayoutDrawingStore((s) => s.toggleHideElement);
  const unhideElement = useLayoutDrawingStore((s) => s.unhideElement);
  const unhideAll = useLayoutDrawingStore((s) => s.unhideAll);
  const toggleRevealHiddenMode = useLayoutDrawingStore((s) => s.toggleRevealHiddenMode);

  const requestToolReveal = useAppStore((s) => s.requestToolReveal);
  const toolSelectedExpressId = useAppStore((s) => s.toolSelectedExpressId);
  const isolateElements = useAppStore((s) => s.isolateElements);

  const shapesBtnRef = useRef<HTMLButtonElement>(null);

  const [menu, setMenu] = useState<MenuState | null>(null);
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [viewName, setViewName] = useState("");
  const [pageFormat, setPageFormat] = useState<PageFormat>("a4");
  const [toast, setToast] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const floorBtnRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Same floor list as Floors & rooms (prefer floors that have rooms). */
  const floorOptions = useMemo(() => {
    const sorted = [...floors].sort((a, b) => a.elevation - b.elevation);
    const withRooms = sorted.filter((f) =>
      rooms.some((r) => r.floorId === f.id),
    );
    return withRooms.length > 0 ? withRooms : sorted;
  }, [floors, rooms]);

  const activeIsolateFloorId =
    isPresentationView && presentationIsolate
      ? presentationFloorId
      : selectedFloor;

  const defaultSaveViewName = () => {
    if (isPresentationView) {
      const raw =
        activeModelLabel?.trim() || activeModelId?.trim() || "model";
      const base = raw.replace(/\.ifc$/i, "").trim() || "model";
      if (presentationIsolate) return `${base}_isolated view`;
      const modeTag =
        colorMode === "temperature" ? "Temperature" : "heizlast";
      return `${base}_${modeTag}`;
    }
    if (!selectedFloor) return "";
    return floors.find((f) => f.id === selectedFloor)?.name ?? "";
  };

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    onFs();
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const drag = {
      active: false,
      moved: false,
      x: 0,
      y: 0,
      t: 0,
    };
    const MOVE_PX = 6;
    const HOLD_MS = 220;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 2) return;
      const target = e.target as HTMLElement | null;
      if (!target || !(target instanceof HTMLCanvasElement)) return;
      drag.active = true;
      drag.moved = false;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.t = Date.now();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!drag.active || drag.moved) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (dx * dx + dy * dy >= MOVE_PX * MOVE_PX) drag.moved = true;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 2) return;
      if (Date.now() - drag.t >= HOLD_MS) drag.moved = true;
      drag.active = false;
    };

    const onCtx = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !(target instanceof HTMLCanvasElement)) return;
      e.preventDefault();
      // Hold / drag → OrbitControls pan only; no menu.
      if (drag.moved || Date.now() - drag.t >= HOLD_MS) {
        drag.moved = false;
        return;
      }
      drag.moved = false;
      target.dispatchEvent(new CustomEvent("werkzeug-context-pick", {
        detail: { clientX: e.clientX, clientY: e.clientY },
      }));
      setViewerContextMenuOpen(true);
      setSidePanel(null);
      setViewName(defaultSaveViewName());
      setPageFormat("a4");
      setMenu({ x: e.clientX, y: e.clientY });
    };

    root.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    root.addEventListener("contextmenu", onCtx);
    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("contextmenu", onCtx);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rootRef,
    floors,
    selectedFloor,
    isPresentationView,
    presentationIsolate,
    activeModelId,
    activeModelLabel,
    colorMode,
  ]);

  useEffect(() => {
    if (!menu) {
      setViewerContextMenuOpen(false);
      return;
    }
    setViewerContextMenuOpen(true);
    const onDoc = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenu(null);
      setSidePanel(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(null);
        setSidePanel(null);
      }
    };
    const id = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDoc, true);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onDoc, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, setViewerContextMenuOpen]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const close = () => {
    setMenu(null);
    setSidePanel(null);
    setViewerContextMenuOpen(false);
  };

  const toggleFullscreen = async () => {
    const el = rootRef.current ?? document.documentElement;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // ignore
    }
    close();
  };

  const commitSaveView = () => {
    const name = viewName.trim();
    if (!name || !viewerRef.current || !activeModelId) return;
    const pose = viewerRef.current.getCameraPose();
    addSavedView(name, pose.position, pose.target, { pageFormat });
    setToast(t(uiLanguage, "viewSavedOk"));
    close();
  };

  const isolateFloor = (floorId: string | null) => {
    if (isPresentationView) {
      setPresentationFloorIsolate(floorId);
    } else {
      setSelectedFloor(floorId);
    }
    close();
  };

  const itemCls = (opts?: { active?: boolean; open?: boolean }) => {
    if (opts?.active || opts?.open) {
      return `${ctxItemIdle} ${ctxItemActive}`;
    }
    return ctxItemIdle;
  };

  const portalRoot =
    (typeof document !== "undefined"
      ? ((document.fullscreenElement as HTMLElement | null) ?? document.body)
      : null) ?? document.body;

  /** Place flyout beside the triggering button, never clipped by glass overflow. */
  const flyoutStyle = (): CSSProperties | undefined => {
    const btn =
      sidePanel === "save"
        ? saveBtnRef.current
        : sidePanel === "floor"
          ? floorBtnRef.current
          : sidePanel === "shapes"
            ? shapesBtnRef.current
            : null;
    if (!btn || !menu) return undefined;
    const r = btn.getBoundingClientRect();
    const flyoutW = sidePanel === "save" ? 230 : sidePanel === "shapes" ? 180 : 220;
    const openRight = r.right + 8 + flyoutW < window.innerWidth;
    return {
      position: "fixed",
      top: Math.min(r.top, window.innerHeight - 280),
      left: openRight ? r.right + 8 : undefined,
      right: openRight ? undefined : window.innerWidth - r.left + 8,
      zIndex: 132,
    };
  };

  const TOOL_VIEWS: { id: MarkupViewPreset; label: string }[] = [
    { id: "top", label: "Top" },
    { id: "north", label: "N" },
    { id: "south", label: "S" },
    { id: "east", label: "O" },
    { id: "west", label: "W" },
    { id: "free", label: "3D" },
  ];
  const primaryLayoutSelection = selectedElements[selectedElements.length - 1] ?? null;
  const layoutSelectionLocked = selectedElements.some((item) =>
    lockedElementKeys.includes(`${item.kind}:${item.id}`),
  );
  const layoutSelectionLabel = primaryLayoutSelection
    ? primaryLayoutSelection.kind === "slab"
      ? "Floor / roof"
      : primaryLayoutSelection.kind[0].toUpperCase() + primaryLayoutSelection.kind.slice(1)
    : null;

  const menuNode =
    menu &&
    createPortal(
      <div
        ref={menuRef}
        className="contents"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className="fixed z-[130]"
          style={{
            left: Math.min(menu.x, window.innerWidth - 240),
            top: Math.min(menu.y, window.innerHeight - 300),
          }}
          role="menu"
        >
          <div className={ctxMenuSurface}>
            <div className="min-w-[210px] p-1.5">
              {toolMode ? (
                <>
                  {primaryLayoutSelection && (
                    <div className="mb-1.5 rounded-2xl border border-white/90 bg-white/55 p-1 shadow-[inset_0_1px_0_white]">
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                          {layoutSelectionLabel}
                        </span>
                        <span className="rounded-full bg-zinc-900 px-1.5 py-0.5 text-[8px] font-bold text-white">
                          Selected
                        </span>
                      </div>
                      <button
                        type="button"
                        role="menuitem"
                        className={itemCls()}
                        onClick={() => {
                          setRightPanelOpen(true);
                          close();
                        }}
                      >
                        <span>Properties</span>
                        <span className="text-[9px] text-zinc-400">Edit all</span>
                      </button>
                      <div className="px-2 pb-1 pt-1 text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
                        Move · 100 mm
                      </div>
                      <div className="grid grid-cols-4 gap-1 px-1 pb-1">
                        {([
                          ["←", -100, 0],
                          ["↑", 0, -100],
                          ["↓", 0, 100],
                          ["→", 100, 0],
                        ] as const).map(([label, dx, dy]) => (
                          <button
                            key={label}
                            type="button"
                            disabled={layoutSelectionLocked}
                            onClick={() => void moveSelected(dx, dy)}
                            className="h-8 rounded-xl border border-white/90 bg-white/70 text-sm font-bold text-zinc-700 shadow-[inset_0_1px_0_white,0_3px_10px_rgba(15,23,42,0.06)] transition hover:bg-white disabled:opacity-35"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-1 px-1 pb-1">
                        <button
                          type="button"
                          disabled={layoutSelectionLocked}
                          onClick={() => {
                            void copySelected(500, 500);
                            close();
                          }}
                          className={itemCls()}
                        >
                          <span>{t(uiLanguage, "layoutDuplicate")}</span>
                        </button>
                        <button
                          type="button"
                          disabled={layoutSelectionLocked}
                          onClick={() => {
                            void deleteSelected();
                            close();
                          }}
                          className={`${itemCls()} text-red-600 hover:text-red-700`}
                        >
                          <span>{t(uiLanguage, "markupDelete")}</span>
                        </button>
                      </div>

                      {/* Visibility & Isolate section for selected element */}
                      {(() => {
                        const cat = getCategoryInfo(primaryLayoutSelection.kind);
                        const isItemHidden =
                          hiddenElementIds.has(primaryLayoutSelection.id) ||
                          hiddenCategories.has(cat.id) ||
                          (isolatedElementIds !== null && !isolatedElementIds.has(primaryLayoutSelection.id));
                        const isCatHidden = hiddenCategories.has(cat.id);

                        return (
                          <div className="mt-1 border-t border-slate-200/80 pt-1">
                            <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                              Visibility & Isolate
                            </div>

                            {/* Hide / Unhide Element */}
                            {isItemHidden ? (
                              <button
                                type="button"
                                role="menuitem"
                                className={itemCls()}
                                onClick={() => {
                                  unhideElement(primaryLayoutSelection.id);
                                  close();
                                }}
                              >
                                <span className="flex items-center gap-1.5 font-medium text-pink-600">
                                  <LuEye className="h-3.5 w-3.5" />
                                  <span>Unhide {layoutSelectionLabel}</span>
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                role="menuitem"
                                className={itemCls()}
                                onClick={() => {
                                  hideSelected();
                                  close();
                                }}
                              >
                                <span className="flex items-center gap-1.5 font-medium text-zinc-700">
                                  <LuEyeOff className="h-3.5 w-3.5 text-zinc-500" />
                                  <span>Hide {layoutSelectionLabel}</span>
                                </span>
                              </button>
                            )}

                            {/* Hide / Unhide Category */}
                            <button
                              type="button"
                              role="menuitem"
                              className={itemCls()}
                              onClick={() => {
                                toggleHideCategory(cat.id);
                                close();
                              }}
                            >
                              <span className="flex items-center gap-1.5 font-medium text-zinc-700">
                                {isCatHidden ? (
                                  <>
                                    <LuEye className="h-3.5 w-3.5 text-pink-600" />
                                    <span className="text-pink-600">Unhide All {cat.label}</span>
                                  </>
                                ) : (
                                  <>
                                    <LuEyeOff className="h-3.5 w-3.5 text-zinc-500" />
                                    <span>Hide All {cat.label}</span>
                                  </>
                                )}
                              </span>
                            </button>

                            {/* Isolate Element */}
                            <button
                              type="button"
                              role="menuitem"
                              className={itemCls()}
                              onClick={() => {
                                isolateSelected();
                                close();
                              }}
                            >
                              <span className="flex items-center gap-1.5 font-medium text-zinc-700">
                                <LuFocus className="h-3.5 w-3.5 text-zinc-500" />
                                <span>Isolate {layoutSelectionLabel}</span>
                              </span>
                            </button>

                            {/* Isolate Category */}
                            <button
                              type="button"
                              role="menuitem"
                              className={itemCls()}
                              onClick={() => {
                                isolateCategory(cat.id);
                                close();
                              }}
                            >
                              <span className="flex items-center gap-1.5 font-medium text-zinc-700">
                                <LuFocus className="h-3.5 w-3.5 text-amber-500" />
                                <span>Isolate All {cat.label}</span>
                              </span>
                            </button>

                            {/* Reset / Unhide All */}
                            {(hiddenElementIds.size > 0 || hiddenCategories.size > 0 || isolatedElementIds !== null) && (
                              <button
                                type="button"
                                role="menuitem"
                                className={`${itemCls()} text-amber-600 hover:text-amber-700`}
                                onClick={() => {
                                  unhideAll();
                                  close();
                                }}
                              >
                                <span className="flex items-center gap-1.5 font-medium">
                                  <LuRotateCcw className="h-3.5 w-3.5" />
                                  <span>Unhide All (Reset)</span>
                                </span>
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {!primaryLayoutSelection && selectedPlacementId && (
                    <div className="rounded-2xl border border-white/90 bg-white/55 p-1">
                      <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">3D shape</p>
                      {(["translate", "rotate", "scale"] as const).map((mode) => <button key={mode} type="button" className={itemCls()} onClick={() => { setTransformMode(mode); close(); }}><span className="capitalize">{mode === "translate" ? "Move" : mode}</span></button>)}
                      <button type="button" className={itemCls()} onClick={() => { const p = placements.find((item) => item.id === selectedPlacementId); if (p) void placeShape(p.type, { x: p.posX + .4, y: p.posY, z: p.posZ + .4 }, { floorId: p.floorId, rot: { x: p.rotX, y: p.rotY, z: p.rotZ }, sizeX: p.sizeX, sizeY: p.sizeY, sizeZ: p.sizeZ }); close(); }}><span>{t(uiLanguage, "layoutDuplicate")}</span></button>
                      <button type="button" className={`${itemCls()} text-red-600`} onClick={() => { void deletePlacement(selectedPlacementId); clearSelection(); close(); }}><span>{t(uiLanguage, "markupDelete")}</span></button>
                    </div>
                  )}
                  {!primaryLayoutSelection && !selectedPlacementId && toolSelectedExpressId != null && (
                    <div className="rounded-2xl border border-white/90 bg-white/55 p-1">
                      <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">IFC component</p>
                      <button type="button" className={itemCls()} onClick={() => { setRightPanelOpen(true); requestToolReveal(toolSelectedExpressId); close(); }}><span>Properties</span></button>
                      <button type="button" className={itemCls()} onClick={() => { isolateElements([toolSelectedExpressId]); requestToolReveal(toolSelectedExpressId); close(); }}><span>{t(uiLanguage, "layoutIsolate")}</span></button>
                      <button type="button" className={itemCls()} onClick={() => { setArmedTool("note"); close(); }}><span>{t(uiLanguage, "layoutAddNote")}</span></button>
                    </div>
                  )}
                  {!primaryLayoutSelection && !selectedPlacementId && toolSelectedExpressId == null && <>
                  {(hiddenElementIds.size > 0 || hiddenCategories.size > 0 || isolatedElementIds !== null || revealHiddenMode) && (
                    <div className="mb-1.5 rounded-2xl border border-white/90 bg-white/55 p-1">
                      <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        <span>Visibility</span>
                        {revealHiddenMode && <span className="rounded-full bg-pink-500 px-1.5 py-0.5 text-[8px] font-bold text-white">Ghost Mode</span>}
                      </div>
                      <button
                        type="button"
                        className={itemCls()}
                        onClick={() => {
                          toggleRevealHiddenMode();
                          close();
                        }}
                      >
                        <span className="flex items-center gap-1.5 text-zinc-700">
                          <LuEye className="h-3.5 w-3.5 text-pink-500" />
                          <span>{revealHiddenMode ? "Exit Ghost Mode" : "Reveal Hidden (Ghost Mode)"}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`${itemCls()} text-amber-600 hover:text-amber-700`}
                        onClick={() => {
                          unhideAll();
                          close();
                        }}
                      >
                        <span className="flex items-center gap-1.5 font-medium">
                          <LuRotateCcw className="h-3.5 w-3.5" />
                          <span>Unhide All Elements</span>
                        </span>
                      </button>
                    </div>
                  )}
                  <p className={`mb-1 px-2 ${ctxLabel}`}>
                    {t(uiLanguage, "markupViews")}
                  </p>
                  <div className="mb-1.5 flex flex-wrap gap-1 px-1">
                    {TOOL_VIEWS.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className={`${!quadView && viewPreset === v.id ? ctxChipOn : ctxChipOff} px-2 py-1 text-[10px] font-bold`}
                        onClick={() => {
                          setQuadView(false);
                          setViewPreset(v.id);
                          close();
                        }}
                      >
                        {v.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`${quadView ? ctxChipOn : ctxChipOff} px-2 py-1 text-[10px] font-bold`}
                      onClick={() => {
                        setQuadView(!quadView);
                        close();
                      }}
                    >
                      4 Views
                    </button>
                  </div>

                  <button
                    ref={shapesBtnRef}
                    type="button"
                    role="menuitem"
                    className={itemCls({ open: sidePanel === "shapes" })}
                    onClick={() =>
                      setSidePanel((p) => (p === "shapes" ? null : "shapes"))
                    }
                    aria-expanded={sidePanel === "shapes"}
                  >
                    <span>{t(uiLanguage, "markupShapesMenu")}</span>
                    <MdKeyboardArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  </button>

                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={show3DGrid}
                    className={itemCls()}
                    onClick={() => {
                      setShow3DGrid(!show3DGrid);
                      close();
                    }}
                  >
                    <span>3D Graph & XYZ Axes</span>
                    <span
                      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                        show3DGrid
                          ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                          : "bg-zinc-300 dark:bg-zinc-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${
                          show3DGrid ? "translate-x-3.5" : "translate-x-0.5"
                        }`}
                      />
                    </span>
                  </button>

                  <div className="my-1 border-t border-amber-200/45 dark:border-[var(--panel-divider)]" />

                  <button
                    type="button"
                    role="menuitem"
                    className={itemCls()}
                    disabled={!selectedPlacementId}
                    onClick={() => {
                      setTransformMode("translate");
                      close();
                    }}
                  >
                    <span>{t(uiLanguage, "markupMove")}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={itemCls()}
                    disabled={!selectedPlacementId}
                    onClick={() => {
                      setTransformMode("scale");
                      close();
                    }}
                  >
                    <span>{t(uiLanguage, "markupScale")}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={itemCls()}
                    disabled={!selectedPlacementId}
                    onClick={() => {
                      setTransformMode("rotate");
                      close();
                    }}
                  >
                    <span>{t(uiLanguage, "markupRotate")}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={itemCls()}
                    disabled={!selectedPlacementId}
                    onClick={() => {
                      if (selectedPlacementId) {
                        void deletePlacement(selectedPlacementId);
                        clearSelection();
                      }
                      close();
                    }}
                  >
                    <span>{t(uiLanguage, "markupDelete")}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={itemCls()}
                    disabled={!selectedPlacementId}
                    onClick={() => {
                      const p = placements.find(
                        (x) => x.id === selectedPlacementId,
                      );
                      if (p) {
                        void placeShape(p.type, {
                          x: p.posX + 0.4,
                          y: p.posY,
                          z: p.posZ + 0.4,
                        }, {
                          floorId: p.floorId,
                          rot: { x: p.rotX, y: p.rotY, z: p.rotZ },
                          sizeX: p.sizeX,
                          sizeY: p.sizeY,
                          sizeZ: p.sizeZ,
                        });
                      }
                      close();
                    }}
                  >
                    <span>{t(uiLanguage, "layoutDuplicate")}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={itemCls()}
                    disabled={!selectedPlacementId}
                    onClick={() => {
                      if (selectedPlacementId) {
                        void updatePlacement(selectedPlacementId, {
                          color: defaultColor,
                        });
                      }
                      close();
                    }}
                  >
                    <span>{t(uiLanguage, "markupColor")}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={itemCls()}
                    disabled={
                      !selectedPlacementId &&
                      !selectedWallId &&
                      !selectedDoorId &&
                      !selectedWindowId &&
                      toolSelectedExpressId == null
                    }
                    onClick={() => {
                      if (selectedWallId) {
                        const w = walls.find((x) => x.id === selectedWallId);
                        if (w) {
                          beginNoteAt(
                            {
                              x: (w.startXmm + w.endXmm) / 2000,
                              y: 1.2,
                              z: (w.startYmm + w.endYmm) / 2000,
                            },
                            { wallId: w.id, elementName: "Wall", floorId: w.levelId },
                          );
                        }
                      } else if (selectedDoorId) {
                        const d = doors.find((x) => x.id === selectedDoorId);
                        if (d) {
                          beginNoteAt(
                            { x: 0, y: 1, z: 0 },
                            { doorId: d.id, elementName: "Door", wallId: d.wallId },
                          );
                        }
                      } else if (selectedWindowId) {
                        const w = windows.find((x) => x.id === selectedWindowId);
                        if (w) {
                          beginNoteAt(
                            { x: 0, y: 1.2, z: 0 },
                            {
                              windowId: w.id,
                              elementName: "Window",
                              wallId: w.wallId,
                            },
                          );
                        }
                      } else if (selectedPlacementId) {
                        const p = placements.find(
                          (x) => x.id === selectedPlacementId,
                        );
                        if (p) {
                          beginNoteAt(
                            { x: p.posX, y: p.posY + 0.2, z: p.posZ },
                            {
                              placementId: p.id,
                              elementName: p.label ?? p.type,
                              floorId: p.floorId,
                            },
                          );
                        }
                      } else if (toolSelectedExpressId != null) {
                        setArmedTool("note");
                      }
                      close();
                    }}
                  >
                    <span>{t(uiLanguage, "layoutAddNote")}</span>
                  </button>
                  {(selectedWallId || selectedDoorId || selectedWindowId) && (
                    <button
                      type="button"
                      role="menuitem"
                      className={itemCls()}
                      onClick={() => {
                        if (selectedWallId) void deleteWall(selectedWallId);
                        if (selectedDoorId) void deleteDoor(selectedDoorId);
                        if (selectedWindowId)
                          void deleteWindow(selectedWindowId);
                        clearLayoutSelection();
                        close();
                      }}
                    >
                      <span>{t(uiLanguage, "markupDelete")} (layout)</span>
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    className={itemCls()}
                    disabled={toolSelectedExpressId == null}
                    onClick={() => {
                      if (toolSelectedExpressId != null) {
                        isolateElements([toolSelectedExpressId]);
                        requestToolReveal(toolSelectedExpressId);
                      }
                      close();
                    }}
                  >
                    <span>{t(uiLanguage, "layoutIsolate")}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={itemCls()}
                    disabled={
                      !selectedPlacementId && toolSelectedExpressId == null
                    }
                    onClick={() => {
                      if (toolSelectedExpressId != null) {
                        requestToolReveal(toolSelectedExpressId);
                      } else if (selectedPlacementId) {
                        useToolMarkupStore
                          .getState()
                          .selectPlacement(selectedPlacementId);
                        viewerRef.current?.fitVisible();
                      }
                      close();
                    }}
                  >
                    <span>{t(uiLanguage, "markupFocusSelected")}</span>
                  </button>
                  </>}
                </>
              ) : (
                <>
              {supportsCompareBothModes(dataViewMode) ? (
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={compareBothModes}
                  className={itemCls()}
                  onClick={() => {
                    setCompareBothModes(!compareBothModes);
                    close();
                  }}
                >
                  <span>
                    {t(uiLanguage, compareBothModesLabelKey(dataViewMode))}
                  </span>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      compareBothModes ? ctxToggleOn : ctxToggleOff
                    }`}
                  />
                </button>
              ) : null}

              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={show3DGrid}
                className={itemCls()}
                onClick={() => {
                  setShow3DGrid(!show3DGrid);
                  close();
                }}
              >
                <span>3D Graph & XYZ Axes</span>
                <span
                  className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                    show3DGrid
                      ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                      : "bg-zinc-300 dark:bg-zinc-600"
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${
                      show3DGrid ? "translate-x-3.5" : "translate-x-0.5"
                    }`}
                  />
                </span>
              </button>

              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={autoSceneBackground}
                className={itemCls()}
                onClick={() => {
                  setAutoSceneBackground(!autoSceneBackground);
                  close();
                }}
              >
                <span>{t(uiLanguage, "seasonalBg")}</span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    autoSceneBackground ? ctxToggleOn : ctxToggleOff
                  }`}
                />
              </button>

              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={autoFocusSelection}
                className={itemCls()}
                onClick={() => {
                  setAutoFocusSelection(!autoFocusSelection);
                  close();
                }}
              >
                <span>{t(uiLanguage, "autoFocus")}</span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    autoFocusSelection ? ctxToggleOn : ctxToggleOff
                  }`}
                />
              </button>

              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={isFullscreen}
                className={itemCls()}
                onClick={() => void toggleFullscreen()}
              >
                <span>
                  {isFullscreen
                    ? t(uiLanguage, "exitFullscreen")
                    : t(uiLanguage, "fullscreen")}
                </span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isFullscreen ? ctxToggleOn : ctxToggleOff
                  }`}
                />
              </button>

              <button
                ref={saveBtnRef}
                type="button"
                role="menuitem"
                className={itemCls({ open: sidePanel === "save" })}
                disabled={!activeModelId}
                onClick={() =>
                  setSidePanel((p) => (p === "save" ? null : "save"))
                }
                aria-expanded={sidePanel === "save"}
              >
                <span>{t(uiLanguage, "saveView")}</span>
                <MdKeyboardArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              </button>

              <button
                ref={floorBtnRef}
                type="button"
                role="menuitem"
                className={itemCls({ open: sidePanel === "floor" })}
                onClick={() =>
                  setSidePanel((p) => (p === "floor" ? null : "floor"))
                }
                aria-expanded={sidePanel === "floor"}
              >
                <span>{t(uiLanguage, "isolateFloor")}</span>
                <MdKeyboardArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              </button>

              <div className="my-1 border-t border-amber-200/45 dark:border-[var(--panel-divider)]" />

              <button
                type="button"
                role="menuitem"
                className={itemCls()}
                disabled={loadDisabled}
                onClick={() => fileInputRef.current?.click()}
              >
                <span>{t(uiLanguage, "loadNewIfc")}</span>
              </button>
                </>
              )}
            </div>
          </div>
        </div>

        {sidePanel === "shapes" && toolMode && (
          <div style={flyoutStyle()} className="fixed z-[132]">
            <div className={ctxMenuSurface}>
              <div className="max-h-64 min-w-[160px] overflow-y-auto p-1.5 thin-scroll">
                <p className={`mb-1 px-2 ${ctxLabel}`}>
                  {t(uiLanguage, "markupShapesMenu")}
                </p>
                {MARKUP_TOOL_ORDER.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={itemCls()}
                    onClick={() => {
                      setArmedTool(id);
                      close();
                    }}
                  >
                    <span>
                      {t(
                        uiLanguage,
                        id === "note"
                          ? "markupHint_note"
                          : (`markupShape_${id}` as "markupShape_cube"),
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {sidePanel === "save" && !toolMode && (
          <div style={flyoutStyle()} className="fixed z-[132]">
            <div className={ctxMenuSurface}>
              <div className="w-56 space-y-2 p-2.5">
                <p className={`px-0.5 ${ctxLabel}`}>
                  {t(uiLanguage, "saveView")}
                </p>
                <input
                  autoFocus
                  type="text"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitSaveView();
                    if (e.key === "Escape") close();
                  }}
                  placeholder={t(uiLanguage, "viewName")}
                  className="glass-input w-full rounded-xl px-2.5 py-1.5 text-xs text-[var(--text-body)] outline-none focus:border-amber-300/70"
                />
                <p className={`px-0.5 ${ctxLabel}`}>
                  {t(uiLanguage, "pdfPageSize")}
                </p>
                <div className="grid grid-cols-5 gap-0.5">
                  {(["a4", "a3", "a2", "a1", "a0"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setPageFormat(f)}
                      className={`rounded-lg py-1 text-[10px] font-semibold uppercase transition-all duration-300 ease-out ${
                        pageFormat === f ? ctxChipOn : ctxChipOff
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="pt-1.5">
                  <SliceHeightSlider
                    floors={floors}
                    selectedFloor={selectedFloor}
                    disabled={isPresentationView || selectedFloor == null}
                  />
                </div>
                <button
                  type="button"
                  disabled={!viewName.trim() || !activeModelId}
                  onClick={commitSaveView}
                  className={ctxPrimaryBtn}
                >
                  {t(uiLanguage, "save")}
                </button>
              </div>
            </div>
          </div>
        )}

        {sidePanel === "floor" && !toolMode && (
          <div style={flyoutStyle()} className="fixed z-[132]">
            <div className={ctxMenuSurface}>
              <div className="max-h-64 min-w-[210px] overflow-y-auto p-1.5 thin-scroll">
                <p className={`mb-1 px-2 ${ctxLabel}`}>
                  {t(uiLanguage, "isolateFloor")}
                </p>
                <button
                  type="button"
                  role="menuitem"
                  className={itemCls({ active: activeIsolateFloorId == null })}
                  onClick={() => isolateFloor(null)}
                >
                  {t(uiLanguage, "showAllFloors")}
                </button>
                {floorOptions.length === 0 ? (
                  <p className="px-2.5 py-2 text-[11px] text-[var(--text-muted)]">
                    {t(uiLanguage, "noFloors")}
                  </p>
                ) : (
                  floorOptions.map((f) => {
                    const count = rooms.filter(
                      (r) => r.floorId === f.id,
                    ).length;
                    const active = activeIsolateFloorId === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        role="menuitem"
                        className={itemCls({ active })}
                        onClick={() => isolateFloor(f.id)}
                      >
                        <ModelText className="min-w-0 truncate">
                          {f.name}
                          {count > 0 ? ` (${count})` : ""}
                        </ModelText>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>,
      portalRoot,
    );

  const toastNode =
    toast &&
    createPortal(
      <div className="pointer-events-none fixed bottom-24 left-1/2 z-[140] -translate-x-1/2">
        <div className={ctxMenuSurface}>
          <p className="px-3.5 py-2 text-xs font-semibold text-[var(--text-strong)]">
            {toast}
          </p>
        </div>
      </div>,
      portalRoot,
    );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".ifc,.frag,application/x-step,application/octet-stream,.IFC,.FRAG"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          close();
          if (file) onLoadIfc(file);
        }}
      />
      {menuNode}
      {toastNode}
    </>
  );
}
