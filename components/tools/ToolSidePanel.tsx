"use client";

/**
 * Werkzeug side panel — two tabs: IFC Elements | Editor.
 * Uses the same glass / sun-moon theme as the rest of the app.
 */

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { IoChevronDownSharp, IoChevronUp } from "react-icons/io5";
import { heading } from "@/lib/designTokens";
import { formatBytesParts } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { IfcStructure } from "@/lib/ifcStructure";
import { useModelSummary } from "./useModelSummary";
import { useAppStore } from "@/store/useAppStore";
import GlassPanel from "../common/GlassPanel";
import ModelText from "../common/ModelText";
import { useModelScene } from "./WerkzeugModelSceneContext";
import ElementInspector from "./ElementInspector";
import IfcStructureTree from "./IfcStructureTree";
import ToolEditorPanel from "./ToolEditorPanel";
import ToolUnderlineTabs from "./ToolUnderlineTabs";
import { useIfcStructure } from "./useIfcStructure";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";

type ToolTab = "elements" | "editor";

function formatBytes(bytes: number | null) {
  const { value, unit } = formatBytesParts(bytes);
  return unit ? `${value} ${unit}` : value;
}

export default function ToolSidePanel({
  className = "",
  onFile,
  isLoadingModel = false,
}: {
  className?: string;
  onFile?: (file: File) => void;
  isLoadingModel?: boolean;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const floors = useAppStore((s) => s.floors);
  const rooms = useAppStore((s) => s.rooms);
  const activeModelFileSizeBytes = useAppStore(
    (s) => s.activeModelFileSizeBytes,
  );
  const setElementsVisible = useAppStore((s) => s.setElementsVisible);
  const { structure, loading } = useIfcStructure(true);
  const { modelLabel } = useModelSummary();
  const { shellGroup } = useModelScene();
  const spacesAppliedFor = useRef<IfcStructure | null>(null);
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);
  const selectedNoteId = useToolMarkupStore((s) => s.selectedNoteId);
  const pendingNote = useToolMarkupStore((s) => s.pendingNote);
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);

  const [tab, setTab] = useState<ToolTab>("editor");
  const [modelDetailsOpen, setModelDetailsOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelTipOpen, setModelTipOpen] = useState(false);
  const [modelTipSuppressed, setModelTipSuppressed] = useState(false);
  const [modelTipPos, setModelTipPos] = useState({ top: 0, left: 0 });
  const modelBadgeRef = useRef<HTMLDivElement>(null);
  const modelNameBtnRef = useRef<HTMLButtonElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const modelFileInputRef = useRef<HTMLInputElement>(null);

  const totalComponents =
    structure?.elementCount ??
    rooms.length + (shellGroup?.children?.length ?? 0);

  useEffect(() => {
    if (!structure || spacesAppliedFor.current === structure) return;
    spacesAppliedFor.current = structure;
    if (structure.spaceIds.length) {
      setElementsVisible(structure.spaceIds, false);
    }
  }, [structure, setElementsVisible]);

  useEffect(() => {
    if (
      !(
        selectedPlacementId ||
        selectedNoteId ||
        pendingNote ||
        selectedWallId ||
        selectedDoorId ||
        selectedWindowId ||
        selectedSlabId
      )
    )
      return;
    const id = requestAnimationFrame(() => setTab("editor"));
    return () => cancelAnimationFrame(id);
  }, [
    selectedPlacementId,
    selectedNoteId,
    pendingNote,
    selectedWallId,
    selectedDoorId,
    selectedWindowId,
    selectedSlabId,
  ]);

  const updateModelTipPos = () => {
    const el = modelNameBtnRef.current ?? modelBadgeRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setModelTipPos({ top: r.bottom + 10, left: r.left + r.width / 2 });
  };

  useLayoutEffect(() => {
    if (!modelTipOpen) return;
    updateModelTipPos();
    window.addEventListener("resize", updateModelTipPos);
    window.addEventListener("scroll", updateModelTipPos, true);
    return () => {
      window.removeEventListener("resize", updateModelTipPos);
      window.removeEventListener("scroll", updateModelTipPos, true);
    };
  }, [modelTipOpen]);

  useEffect(() => {
    if (!modelMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        modelMenuRef.current?.contains(target) ||
        modelBadgeRef.current?.contains(target)
      ) {
        return;
      }
      setModelMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [modelMenuOpen]);

  const modelDetailHint = useMemo(() => {
    const floorsLine = `${floors.length} ${t(uiLanguage, "floors")} · ${rooms.length} ${t(uiLanguage, "rooms")}`;
    const sizeLine = `${totalComponents} · ${formatBytes(activeModelFileSizeBytes)}`;
    return `${floorsLine}\n${sizeLine}`;
  }, [
    floors.length,
    rooms.length,
    totalComponents,
    activeModelFileSizeBytes,
    uiLanguage,
  ]);

  const tabs = [
    { id: "elements" as const, label: t(uiLanguage, "toolTabElements") },
    { id: "editor" as const, label: t(uiLanguage, "toolTabEditor") },
  ];

  return (
    <div className={`flex min-h-0 flex-col gap-1.5 p-3 ${className}`}>
      <header className="shrink-0">
        <div className="flex items-center justify-between gap-2">
          <p className={heading.muted}>{t(uiLanguage, "tool")}</p>
          <div className="relative max-w-[70%]">
            {onFile && (
              <input
                ref={modelFileInputRef}
                type="file"
                accept=".ifc,.frag,application/x-step,application/octet-stream,.IFC,.FRAG"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) onFile(file);
                }}
              />
            )}
            <div
              ref={modelBadgeRef}
              className="flex max-w-full items-center gap-0.5 rounded-full border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 py-0.5 pl-2.5 pr-1 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-md"
            >
              <button
                ref={modelNameBtnRef}
                type="button"
                disabled={isLoadingModel || !onFile}
                onMouseEnter={() => {
                  if (modelTipSuppressed || modelMenuOpen) return;
                  updateModelTipPos();
                  setModelTipOpen(true);
                }}
                onMouseLeave={() => {
                  setModelTipOpen(false);
                  setModelTipSuppressed(false);
                }}
                onClick={() => {
                  if (!onFile) return;
                  setModelTipOpen(false);
                  setModelTipSuppressed(true);
                  setModelMenuOpen((v) => !v);
                }}
                className="min-w-0 truncate text-[11px] font-semibold transition duration-150 active:scale-[0.98] disabled:opacity-45"
                aria-expanded={modelMenuOpen}
                aria-label={modelLabel}
              >
                <ModelText as="span" className="block truncate">
                  {modelLabel}
                </ModelText>
              </button>
              <button
                type="button"
                onClick={() => setModelDetailsOpen((v) => !v)}
                aria-expanded={modelDetailsOpen}
                className="flex shrink-0 items-center justify-center rounded-full px-1 py-0.5 text-amber-950/80 transition duration-150 hover:bg-amber-950/10"
              >
                {modelDetailsOpen ? (
                  <IoChevronUp className="h-3 w-3" />
                ) : (
                  <IoChevronDownSharp className="h-3 w-3" />
                )}
              </button>
            </div>

            {modelTipOpen &&
              !modelMenuOpen &&
              typeof document !== "undefined" &&
              createPortal(
                <div
                  role="tooltip"
                  className="pointer-events-none fixed z-[200] w-max max-w-[240px] -translate-x-1/2"
                  style={{ top: modelTipPos.top, left: modelTipPos.left }}
                >
                  <GlassPanel variant="control" zIndex={200}>
                    <div className="px-3.5 py-2.5 text-center">
                      <p className="text-[12px] font-semibold tracking-wide text-zinc-900">
                        {modelLabel}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-[11px] leading-snug text-zinc-600">
                        {modelDetailHint}
                      </p>
                    </div>
                  </GlassPanel>
                </div>,
                (document.fullscreenElement as HTMLElement | null) ??
                  document.body,
              )}

            {modelMenuOpen && onFile && (
              <div
                ref={modelMenuRef}
                className="absolute top-[calc(100%+0.4rem)] right-0 z-[60] w-max min-w-[12rem]"
              >
                <GlassPanel variant="control" zIndex={60}>
                  <div className="flex flex-col gap-1 p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setModelMenuOpen(false);
                        modelFileInputRef.current?.click();
                      }}
                      className="btn-yellow-border-hover w-full rounded-lg border border-transparent px-2.5 py-2 text-left text-[11px] font-semibold text-[var(--text-body)]"
                    >
                      {t(uiLanguage, "loadOtherIfc")}
                    </button>
                    <div className="my-0.5 border-t border-[var(--panel-divider)]" />
                    <p className="px-2 pt-1 text-[9px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
                      {t(uiLanguage, "layoutEmptyProject")}
                    </p>
                    <form
                      className="flex flex-col gap-1 px-1 pb-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        const name = String(fd.get("name") ?? "").trim();
                        if (!name) return;
                        setModelMenuOpen(false);
                        void (async () => {
                          const { projectId, level } =
                            await useLayoutDrawingStore
                              .getState()
                              .createEmptyProject(name);
                          useAppStore
                            .getState()
                            .setActiveModelId(projectId, name, null);
                          useAppStore.getState().setFloors([
                            {
                              id: level.id,
                              name: level.name,
                              elevation: level.elevationMm / 1000,
                              expressId: -1,
                              typicalHeight: level.heightMm / 1000,
                              isBuildingStory: true,
                            },
                          ]);
                          useAppStore.getState().setSelectedFloor(level.id);
                          await useToolMarkupStore
                            .getState()
                            .loadForModel(projectId);
                          useToolMarkupStore
                            .getState()
                            .setMarkupFloorId(level.id);
                          useToolMarkupStore.getState().setViewPreset("top");
                          useAppStore.getState().setToolMode(true);
                        })();
                      }}
                    >
                      <input
                        name="name"
                        required
                        placeholder={t(uiLanguage, "layoutProjectName")}
                        className="rounded-lg border border-[var(--panel-divider)] bg-white/80 px-2 py-1.5 text-[11px] outline-none focus:border-sky-300"
                      />
                      <button
                        type="submit"
                        className="btn-yellow-border-hover w-full rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2.5 py-2 text-left text-[11px] font-semibold text-[var(--text-body)]"
                      >
                        {t(uiLanguage, "layoutCreateEmpty")}
                      </button>
                    </form>
                  </div>
                </GlassPanel>
              </div>
            )}
          </div>
        </div>

        <div
          className={`overflow-hidden transition-[max-height,opacity,margin] duration-200 ease-out ${
            modelDetailsOpen
              ? "mt-1.5 max-h-10 opacity-100"
              : "mt-0 max-h-0 opacity-0"
          }`}
        >
          <div className="flex w-full items-center text-[11px] text-zinc-600">
            {(
              [
                { label: t(uiLanguage, "floors"), value: String(floors.length) },
                { label: t(uiLanguage, "rooms"), value: String(rooms.length) },
                { label: "Komp.", value: String(totalComponents) },
                {
                  label: null as string | null,
                  value: formatBytes(activeModelFileSizeBytes),
                },
              ] as const
            ).map((tile, i) => (
              <div
                key={i}
                className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 ${
                  i > 0 ? "border-l border-zinc-300/50" : ""
                }`}
              >
                <span className="tabular-nums text-[12px] font-semibold text-zinc-800">
                  {tile.value}
                </span>
                {tile.label ? (
                  <span className="truncate text-[9px] font-medium text-zinc-500">
                    {tile.label}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </header>

      <ToolUnderlineTabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "elements" ? (
        <>
          <IfcStructureTree
            structure={structure}
            loading={loading}
            className="min-h-[8rem] flex-[3]"
          />
          <div className="border-t border-[var(--panel-divider)]" />
          <ElementInspector className="min-h-[9rem] flex-[2]" />
        </>
      ) : (
        <ToolEditorPanel className="min-h-0 flex-1" />
      )}
    </div>
  );
}
