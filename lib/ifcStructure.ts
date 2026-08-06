/**
 * IFC spatial tree for the Tool (Werkzeug) view.
 *
 * Project → Site → Building → Storey → [type group] → element, mirroring how
 * desktop BIM viewers present a model. `buildIfcStructure` is built lazily
 * from the still-open web-ifc model handle (via `getOpenIfcModel` from
 * ifcClient.ts) so no second parse is needed, walking IfcRelAggregates /
 * IfcRelContainedInSpatialStructure and bucketing elements per IFC type.
 */
import * as WebIFC from "web-ifc";
import { debugLog } from "./debugLog";
import { getOpenIfcModel } from "./ifcClient";

export type IfcTreeNodeKind = "spatial" | "typeGroup" | "element";

export type IfcTreeNode = {
  /** Stable per-model id — used as React key and expand/collapse key. */
  key: string;
  kind: IfcTreeNodeKind;
  expressId: number | null;
  /** IFC entity name, e.g. "IfcBuildingStorey". Type groups reuse the member type. */
  typeName: string;
  label: string;
  globalId: string | null;
  /** True when at least one mesh in the scene carries this express id. */
  hasGeometry: boolean;
  children: IfcTreeNode[];
  /** Every express id in this subtree (self included) that can be toggled. */
  leafIds: number[];
};

export type IfcStructure = {
  roots: IfcTreeNode[];
  nodeByExpressId: Map<number, IfcTreeNode>;
  /** Flat type index — powers the "by type" tab. */
  typeGroups: { typeName: string; ids: number[] }[];
  elementCount: number;
  spaceIds: number[];
};

type LineMeta = { typeName: string; name: string; globalId: string | null };

const SPATIAL_TYPE_CODES = new Set<number>([
  WebIFC.IFCPROJECT,
  WebIFC.IFCSITE,
  WebIFC.IFCBUILDING,
  WebIFC.IFCBUILDINGSTOREY,
  WebIFC.IFCSPACE,
]);

/** Give the main thread a frame so a large model never freezes the UI. */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function vectorToArray(vec: WebIFC.Vector<number>): number[] {
  const out: number[] = [];
  for (let i = 0; i < vec.size(); i++) out.push(vec.get(i));
  return out;
}

function readText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    return readText((value as { value: unknown }).value);
  }
  return String(value).trim();
}

/** "IfcBuildingStorey" → "Building storey" for type-group headings. */
export function humanizeIfcType(typeName: string): string {
  const bare = typeName.replace(/^Ifc/i, "");
  const spaced = bare.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function relationMap(
  api: WebIFC.IfcAPI,
  modelID: number,
  relType: number,
  relatingKey: "RelatingObject" | "RelatingStructure",
  relatedKey: "RelatedObjects" | "RelatedElements",
): Map<number, number[]> {
  const map = new Map<number, number[]>();
  let relIds: number[] = [];
  try {
    relIds = vectorToArray(api.GetLineIDsWithType(modelID, relType));
  } catch {
    return map;
  }

  for (const relId of relIds) {
    let rel: Record<string, unknown> | null = null;
    try {
      rel = api.GetLine(modelID, relId) as Record<string, unknown>;
    } catch {
      continue;
    }
    const relating = (rel?.[relatingKey] as { value?: number } | undefined)?.value;
    const related = rel?.[relatedKey] as Array<{ value?: number }> | undefined;
    if (relating == null || !Array.isArray(related)) continue;
    const bucket = map.get(relating) ?? [];
    for (const child of related) {
      if (child?.value != null) bucket.push(child.value);
    }
    map.set(relating, bucket);
  }

  return map;
}

async function readMeta(
  api: WebIFC.IfcAPI,
  modelID: number,
  ids: Iterable<number>,
): Promise<Map<number, LineMeta>> {
  const meta = new Map<number, LineMeta>();
  const typeNameCache = new Map<number, string>();
  let sinceYield = 0;

  for (const id of ids) {
    if (meta.has(id)) continue;
    let typeName = "IfcProduct";
    try {
      const code = api.GetLineType(modelID, id);
      const cached = typeNameCache.get(code);
      if (cached) {
        typeName = cached;
      } else {
        typeName =
          (typeof api.GetNameFromTypeCode === "function"
            ? api.GetNameFromTypeCode(code)
            : "") || `Type ${code}`;
        // web-ifc reports SHOUTING_CASE — normalise to IfcWallStandardCase style.
        typeName = normalizeTypeName(typeName);
        typeNameCache.set(code, typeName);
      }
    } catch {
      // keep fallback
    }

    let name = "";
    let globalId: string | null = null;
    try {
      const line = api.GetLine(modelID, id) as Record<string, unknown>;
      name =
        readText(line?.LongName) ||
        readText(line?.Name) ||
        readText(line?.Tag) ||
        "";
      globalId = readText(line?.GlobalId) || null;
    } catch {
      // keep fallback
    }

    meta.set(id, { typeName, name, globalId });

    sinceYield += 1;
    if (sinceYield >= 1500) {
      sinceYield = 0;
      await yieldToMain();
    }
  }

  return meta;
}

/** web-ifc returns "IFCBUILDINGSTOREY"; make it readable without a lookup table. */
function normalizeTypeName(raw: string): string {
  if (!/^[A-Z0-9_]+$/.test(raw)) return raw;
  const body = raw.startsWith("IFC") ? raw.slice(3) : raw;
  const pretty = body
    .toLowerCase()
    .replace(/(^|_)([a-z])/g, (_m, _sep, ch: string) => ch.toUpperCase());
  return `Ifc${pretty}`;
}

export type BuildIfcStructureOptions = {
  /** Express ids that actually have a mesh — drives the "hasGeometry" flag. */
  renderableIds?: Set<number>;
};

export async function buildIfcStructure(
  options: BuildIfcStructureOptions = {},
): Promise<IfcStructure | null> {
  const handle = getOpenIfcModel();
  if (!handle) {
    debugLog("ifcStructure", "no open model — cannot build tree", "warn");
    return null;
  }
  const { api, modelID } = handle;
  const renderable = options.renderableIds ?? null;

  try {
    const aggregates = relationMap(
      api,
      modelID,
      WebIFC.IFCRELAGGREGATES,
      "RelatingObject",
      "RelatedObjects",
    );
    await yieldToMain();
    const contained = relationMap(
      api,
      modelID,
      WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE,
      "RelatingStructure",
      "RelatedElements",
    );
    await yieldToMain();

    const isSpatial = (id: number): boolean => {
      try {
        return SPATIAL_TYPE_CODES.has(api.GetLineType(modelID, id));
      } catch {
        return false;
      }
    };

    const childrenOf = (id: number): number[] => [
      ...(aggregates.get(id) ?? []),
      ...(contained.get(id) ?? []),
    ];

    let roots = safeIds(api, modelID, WebIFC.IFCPROJECT);
    if (!roots.length) roots = safeIds(api, modelID, WebIFC.IFCSITE);
    if (!roots.length) roots = safeIds(api, modelID, WebIFC.IFCBUILDING);
    if (!roots.length) roots = safeIds(api, modelID, WebIFC.IFCBUILDINGSTOREY);
    if (!roots.length) {
      debugLog("ifcStructure", "no spatial root found", "warn");
      return null;
    }

    // Collect every id reachable from the roots before reading metadata, so the
    // (expensive) GetLine pass can be chunked in one place.
    const reachable: number[] = [];
    const seen = new Set<number>();
    const stack = [...roots];
    while (stack.length) {
      const id = stack.pop() as number;
      if (seen.has(id)) continue;
      seen.add(id);
      reachable.push(id);
      for (const child of childrenOf(id)) {
        if (!seen.has(child)) stack.push(child);
      }
    }

    const meta = await readMeta(api, modelID, reachable);

    const nodeByExpressId = new Map<number, IfcTreeNode>();
    const typeIndex = new Map<number, number[]>();
    let elementCount = 0;
    const spaceIds: number[] = [];

    const labelFor = (id: number, info: LineMeta): string =>
      info.name || `${humanizeIfcType(info.typeName)} #${id}`;

    const buildNode = (id: number, path: string): IfcTreeNode | null => {
      const info = meta.get(id);
      if (!info) return null;
      const spatial = isSpatial(id);
      const key = `${path}/${id}`;
      const node: IfcTreeNode = {
        key,
        kind: spatial ? "spatial" : "element",
        expressId: id,
        typeName: info.typeName,
        label: labelFor(id, info),
        globalId: info.globalId,
        hasGeometry: renderable ? renderable.has(id) : true,
        children: [],
        leafIds: [id],
      };

      if (!spatial) {
        elementCount += 1;
        const code = safeTypeCode(api, modelID, id);
        const bucket = typeIndex.get(code) ?? [];
        bucket.push(id);
        typeIndex.set(code, bucket);
      } else if (safeTypeCode(api, modelID, id) === WebIFC.IFCSPACE) {
        spaceIds.push(id);
      }

      const kids = childrenOf(id);
      if (kids.length) {
        const spatialKids: number[] = [];
        const elementKids: number[] = [];
        for (const child of kids) {
          (isSpatial(child) ? spatialKids : elementKids).push(child);
        }

        for (const child of spatialKids) {
          const built = buildNode(child, key);
          if (built) {
            node.children.push(built);
            node.leafIds.push(...built.leafIds);
          }
        }

        // Elements are bucketed per IFC type — a flat list of 4000 walls is unusable.
        const byType = new Map<string, number[]>();
        for (const child of elementKids) {
          const childType = meta.get(child)?.typeName ?? "IfcProduct";
          const bucket = byType.get(childType) ?? [];
          bucket.push(child);
          byType.set(childType, bucket);
        }

        const groups = [...byType.entries()].sort((a, b) =>
          a[0].localeCompare(b[0]),
        );
        for (const [typeName, ids] of groups) {
          const groupNode: IfcTreeNode = {
            key: `${key}/type:${typeName}`,
            kind: "typeGroup",
            expressId: null,
            typeName,
            label: humanizeIfcType(typeName),
            globalId: null,
            hasGeometry: false,
            children: [],
            leafIds: [],
          };
          for (const child of ids) {
            const built = buildNode(child, groupNode.key);
            if (!built) continue;
            groupNode.children.push(built);
            groupNode.leafIds.push(...built.leafIds);
            groupNode.hasGeometry ||= built.hasGeometry;
          }
          groupNode.children.sort((a, b) => a.label.localeCompare(b.label));
          node.children.push(groupNode);
          node.leafIds.push(...groupNode.leafIds);
        }
      }

      nodeByExpressId.set(id, node);
      return node;
    };

    const builtRoots: IfcTreeNode[] = [];
    for (const rootId of roots) {
      const node = buildNode(rootId, "root");
      if (node) builtRoots.push(node);
    }

    const typeGroups = [...typeIndex.entries()]
      .map(([code, ids]) => ({
        typeName: normalizeTypeName(
          (typeof api.GetNameFromTypeCode === "function"
            ? api.GetNameFromTypeCode(code)
            : "") || `Type ${code}`,
        ),
        ids,
      }))
      .sort((a, b) => a.typeName.localeCompare(b.typeName));

    debugLog(
      "ifcStructure",
      `tree built — roots=${builtRoots.length} elements=${elementCount} types=${typeGroups.length}`,
      "ok",
    );

    return {
      roots: builtRoots,
      nodeByExpressId,
      typeGroups,
      elementCount,
      spaceIds,
    };
  } catch (err) {
    debugLog("ifcStructure", "buildIfcStructure failed", "error", err);
    return null;
  }
}

function safeIds(
  api: WebIFC.IfcAPI,
  modelID: number,
  type: number,
): number[] {
  try {
    return vectorToArray(api.GetLineIDsWithType(modelID, type));
  } catch {
    return [];
  }
}

function safeTypeCode(
  api: WebIFC.IfcAPI,
  modelID: number,
  id: number,
): number {
  try {
    return api.GetLineType(modelID, id);
  } catch {
    return -1;
  }
}

/** Keys of every node on the path down to `expressId` — used to reveal a pick. */
export function pathToExpressId(
  structure: IfcStructure,
  expressId: number,
): string[] {
  const target = structure.nodeByExpressId.get(expressId);
  if (!target) return [];
  const parts = target.key.split("/");
  const keys: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    keys.push(parts.slice(0, i + 1).join("/"));
  }
  return keys.slice(0, -1);
}
