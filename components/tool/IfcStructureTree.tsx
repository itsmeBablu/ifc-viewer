"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { getElementDetails } from "@/lib/ifcClient";
import {
  humanizeIfcType,
  pathToExpressId,
  type IfcStructure,
  type IfcTreeNode,
} from "@/lib/ifcStructure";
import { useAppStore } from "@/store/useAppStore";
import ModelText from "../common/ModelText";
import {
  IconChevron,
  IconEye,
  IconEyeMixed,
  IconEyeOff,
  IconIsolate,
  IconReset,
  IconSearch,
  IconTarget,
} from "./ToolIcons";

type Props = {
  structure: IfcStructure | null;
  loading: boolean;
  className?: string;
};

type VisibilityState = "on" | "off" | "mixed";

/** Cap per branch so a storey with 5000 walls still renders instantly. */
const PAGE_SIZE = 200;

function visibilityOf(
  leafIds: number[],
  hidden: Set<number>,
  isolated: Set<number> | null,
): VisibilityState {
  if (!leafIds.length) return "on";
  if (hidden.size === 0 && isolated == null) return "on";

  let visible = 0;
  for (const id of leafIds) {
    const on = !hidden.has(id) && (isolated == null || isolated.has(id));
    if (on) visible += 1;
  }
  if (visible === 0) return "off";
  if (visible === leafIds.length) return "on";
  return "mixed";
}

function matchesQuery(node: IfcTreeNode, query: string): boolean {
  if (node.label.toLowerCase().includes(query)) return true;
  if (node.typeName.toLowerCase().includes(query)) return true;
  if (node.expressId != null && String(node.expressId).includes(query)) {
    return true;
  }
  return Boolean(node.globalId?.toLowerCase().includes(query));
}

/** Prune the tree to branches containing a match; keeps ancestors for context. */
function filterTree(nodes: IfcTreeNode[], query: string): IfcTreeNode[] {
  const out: IfcTreeNode[] = [];
  for (const node of nodes) {
    const children = filterTree(node.children, query);
    if (children.length || matchesQuery(node, query)) {
      out.push(children.length ? { ...node, children } : node);
    }
  }
  return out;
}

function collectKeys(nodes: IfcTreeNode[], into: Set<string>): Set<string> {
  for (const node of nodes) {
    if (node.children.length) {
      into.add(node.key);
      collectKeys(node.children, into);
    }
  }
  return into;
}

export default function IfcStructureTree({
  structure,
  loading,
  className = "",
}: Props) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const hiddenElementIds = useAppStore((s) => s.hiddenElementIds);
  const isolatedElementIds = useAppStore((s) => s.isolatedElementIds);
  const setElementsVisible = useAppStore((s) => s.setElementsVisible);
  const isolateElements = useAppStore((s) => s.isolateElements);
  const resetElementVisibility = useAppStore((s) => s.resetElementVisibility);
  const selectedExpressId = useAppStore((s) => s.toolSelectedExpressId);
  const setToolSelectedExpressId = useAppStore(
    (s) => s.setToolSelectedExpressId,
  );
  const setSelectedElement = useAppStore((s) => s.setSelectedElement);
  const requestToolReveal = useAppStore((s) => s.requestToolReveal);

  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  /** Expansion + paging are per-structure, so a new model resets them for free. */
  const [userExpanded, setUserExpanded] = useState<{
    src: IfcStructure | null;
    keys: Set<string>;
  }>({ src: null, keys: new Set() });
  const [pageState, setPageState] = useState<{
    src: IfcStructure | null;
    pages: Record<string, number>;
  }>({ src: null, pages: {} });
  /** Element whose auto-revealed branch the user collapsed again. */
  const [revealDismissed, setRevealDismissed] = useState<number | null>(null);

  // Open spatial levels down to the storeys; type groups stay collapsed.
  const defaultExpanded = useMemo(() => {
    const initial = new Set<string>();
    if (!structure) return initial;
    const walk = (nodes: IfcTreeNode[], depth: number) => {
      for (const node of nodes) {
        if (node.kind === "spatial" && depth < 4 && node.children.length) {
          initial.add(node.key);
          walk(node.children, depth + 1);
        }
      }
    };
    walk(structure.roots, 0);
    return initial;
  }, [structure]);

  const baseExpanded =
    userExpanded.src === structure ? userExpanded.keys : defaultExpanded;
  const pageByKey = pageState.src === structure ? pageState.pages : {};

  // Reveal the branch of an element picked in 3D.
  const revealPath = useMemo(() => {
    if (!structure || selectedExpressId == null) return [];
    if (revealDismissed === selectedExpressId) return [];
    return pathToExpressId(structure, selectedExpressId);
  }, [structure, selectedExpressId, revealDismissed]);

  const expanded = useMemo(() => {
    if (!revealPath.length) return baseExpanded;
    const next = new Set(baseExpanded);
    for (const key of revealPath) next.add(key);
    return next;
  }, [baseExpanded, revealPath]);

  useEffect(() => {
    if (selectedExpressId == null) return;
    const el = listRef.current?.querySelector(
      `[data-express-id="${selectedExpressId}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedExpressId, expanded]);

  const normalizedQuery = query.trim().toLowerCase();
  const roots = useMemo(() => {
    if (!structure) return [];
    if (!normalizedQuery) return structure.roots;
    return filterTree(structure.roots, normalizedQuery);
  }, [structure, normalizedQuery]);

  // A search should show its hits, not the collapsed state from before.
  const searchExpanded = useMemo(
    () => (normalizedQuery ? collectKeys(roots, new Set<string>()) : null),
    [roots, normalizedQuery],
  );

  const isExpanded = useCallback(
    (key: string) => (searchExpanded ?? expanded).has(key),
    [searchExpanded, expanded],
  );

  const toggleExpanded = useCallback(
    (key: string) => {
      if (revealPath.includes(key) && selectedExpressId != null) {
        setRevealDismissed(selectedExpressId);
      }
      setUserExpanded((prev) => {
        const base = prev.src === structure ? prev.keys : expanded;
        const keys = new Set(base);
        if (keys.has(key)) keys.delete(key);
        else keys.add(key);
        return { src: structure, keys };
      });
    },
    [structure, expanded, revealPath, selectedExpressId],
  );

  const selectNode = useCallback(
    (node: IfcTreeNode) => {
      if (node.expressId == null) return;
      setToolSelectedExpressId(node.expressId);
      void getElementDetails(node.expressId).then((details) => {
        if (details) setSelectedElement(details);
      });
    },
    [setToolSelectedExpressId, setSelectedElement],
  );

  const hiddenCount = hiddenElementIds.size;
  const isolationActive = isolatedElementIds != null;

  const renderNode = (node: IfcTreeNode, depth: number) => {
    const hasChildren = node.children.length > 0;
    const open = hasChildren && isExpanded(node.key);
    const state = visibilityOf(node.leafIds, hiddenElementIds, isolatedElementIds);
    const selected =
      node.expressId != null && node.expressId === selectedExpressId;
    const shown = open ? (pageByKey[node.key] ?? PAGE_SIZE) : 0;
    const visibleChildren = open ? node.children.slice(0, shown) : [];
    const remaining = node.children.length - visibleChildren.length;

    return (
      <div key={node.key}>
        <div
          data-express-id={node.expressId ?? undefined}
          className={`group flex items-center gap-1 rounded-none border-b border-[var(--panel-divider)]/35 pr-1 transition-colors duration-150 ${
            selected
              ? "bg-[var(--chip-active-bg)] shadow-[inset_0_0_0_1px_var(--panel-divider)]"
              : "hover:bg-[var(--surface-muted)]"
          }`}
          style={{ paddingLeft: `${depth * 12 + 2}px` }}
        >
          <button
            type="button"
            onClick={() => hasChildren && toggleExpanded(node.key)}
            aria-label={node.label}
            aria-expanded={hasChildren ? open : undefined}
            className="flex h-5 w-4 shrink-0 items-center justify-center text-[var(--text-muted)]"
            tabIndex={hasChildren ? 0 : -1}
          >
            {hasChildren ? <IconChevron open={open} /> : null}
          </button>

          <button
            type="button"
            onClick={() => setElementsVisible(node.leafIds, state !== "on")}
            title={t(uiLanguage, "toggleVisibility")}
            aria-label={t(uiLanguage, "toggleVisibility")}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors duration-150 ${
              state === "off"
                ? "text-[var(--text-muted)]/55"
                : "text-[var(--text-body)]"
            } hover:bg-[var(--glass-inset-bg)]`}
          >
            {state === "on" ? (
              <IconEye />
            ) : state === "off" ? (
              <IconEyeOff />
            ) : (
              <IconEyeMixed />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (node.expressId == null) {
                if (hasChildren) toggleExpanded(node.key);
                return;
              }
              selectNode(node);
            }}
            onDoubleClick={() => {
              if (node.expressId != null) requestToolReveal(node.expressId);
            }}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-[3px] text-left"
          >
            <ModelText
              className={`min-w-0 flex-1 truncate text-[11px] leading-tight ${
                state === "off"
                  ? "text-[var(--text-muted)]/60"
                  : selected
                    ? "font-semibold text-[var(--text-strong)]"
                    : "text-[var(--text-body)]"
              }`}
            >
              {node.label}
            </ModelText>
            {node.kind === "typeGroup" ? (
              <span className="shrink-0 rounded-full bg-[var(--glass-inset-bg)] px-1.5 text-[9px] font-semibold tabular-nums text-[var(--text-muted)]">
                {node.children.length}
              </span>
            ) : (
              <span className="shrink-0 text-[9px] font-medium tracking-wide text-[var(--text-muted)]/80">
                {humanizeIfcType(node.typeName)}
              </span>
            )}
          </button>

          {node.expressId != null && (
            <button
              type="button"
              onClick={() => requestToolReveal(node.expressId as number)}
              title={t(uiLanguage, "zoomToElement")}
              aria-label={t(uiLanguage, "zoomToElement")}
              className="hidden h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] group-hover:flex"
            >
              <IconTarget />
            </button>
          )}
          <button
            type="button"
            onClick={() => isolateElements(node.leafIds)}
            title={t(uiLanguage, "isolateElement")}
            aria-label={t(uiLanguage, "isolateElement")}
            className="hidden h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] group-hover:flex"
          >
            <IconIsolate />
          </button>
        </div>

        {open && (
          <div>
            {visibleChildren.map((child) => renderNode(child, depth + 1))}
            {remaining > 0 && (
              <button
                type="button"
                onClick={() =>
                  setPageState((prev) => {
                    const pages = prev.src === structure ? prev.pages : {};
                    return {
                      src: structure,
                      pages: {
                        ...pages,
                        [node.key]: (pages[node.key] ?? PAGE_SIZE) + PAGE_SIZE,
                      },
                    };
                  })
                }
                style={{ paddingLeft: `${(depth + 1) * 12 + 26}px` }}
                className="w-full py-1 text-left text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              >
                +{remaining}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className={`flex min-h-0 flex-col ${className}`}>
      <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
        <h3 className="text-xs font-semibold tracking-wide text-[var(--text-strong)]">
          {t(uiLanguage, "ifcStructure")}
        </h3>
        <div className="flex items-center gap-0.5">
          {(hiddenCount > 0 || isolationActive) && (
            <button
              type="button"
              onClick={resetElementVisibility}
              title={t(uiLanguage, "showAllElements")}
              aria-label={t(uiLanguage, "showAllElements")}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
            >
              <IconReset />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (selectedExpressId != null) setRevealDismissed(selectedExpressId);
              setUserExpanded({ src: structure, keys: new Set() });
            }}
            title={t(uiLanguage, "collapseAll")}
            aria-label={t(uiLanguage, "collapseAll")}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
          >
            <IconChevron open={false} className="rotate-90" />
          </button>
        </div>
      </div>

      <label className="mb-1.5 flex items-center gap-1.5 rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] px-2 py-1">
        <IconSearch className="shrink-0 text-[var(--text-muted)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(uiLanguage, "searchStructure")}
          className="min-w-0 flex-1 bg-transparent text-[11px] text-[var(--text-body)] outline-none placeholder:text-[var(--text-muted)]"
        />
      </label>

      <div
        ref={listRef}
        className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5"
      >
        {loading && !structure ? (
          <p className="px-1 py-3 text-[11px] font-medium text-[var(--text-muted)]">
            {t(uiLanguage, "buildingStructureLoading")}
          </p>
        ) : !structure ? (
          <p className="px-1 py-3 text-[11px] font-medium text-[var(--text-muted)]">
            {t(uiLanguage, "structureUnavailable")}
          </p>
        ) : roots.length === 0 ? (
          <p className="px-1 py-3 text-[11px] font-medium text-[var(--text-muted)]">
            {t(uiLanguage, "noSearchResults")}
          </p>
        ) : (
          roots.map((node) => renderNode(node, 0))
        )}
      </div>

      {structure && (
        <p className="flex items-center gap-1.5 px-1 pt-1 text-[10px] font-medium tabular-nums text-[var(--text-muted)]">
          <span>
            {Math.max(0, structure.elementCount - hiddenCount)}/
            {structure.elementCount} {t(uiLanguage, "visibleCount")}
          </span>
          {isolationActive && (
            <button
              type="button"
              onClick={() => isolateElements(null)}
              className="rounded-full bg-[var(--glass-inset-bg)] px-1.5 py-px font-semibold text-[var(--text-body)] hover:text-[var(--text-strong)]"
            >
              {t(uiLanguage, "clearIsolation")}
            </button>
          )}
        </p>
      )}
    </section>
  );
}
