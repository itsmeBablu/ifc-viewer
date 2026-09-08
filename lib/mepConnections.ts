import type { LayoutDuct, LayoutPipe, LayoutCableTray, LayoutWire, LayoutLevel, MepEndpointLink } from "./layoutDrawing";

export type MepSegment = LayoutDuct | LayoutPipe | LayoutCableTray | LayoutWire;
export type MepKind = MepEndpointLink["kind"];
export type MepNetwork = { ducts: LayoutDuct[]; pipes: LayoutPipe[]; cableTrays: LayoutCableTray[]; wires: LayoutWire[]; levels: LayoutLevel[] };
export type MepSnapPoint = { xMm: number; yMm: number; elevationMm?: number; mepEndpoint?: MepEndpointLink };
export const mepRows = (kind: MepKind, state: MepNetwork): MepSegment[] => kind === "duct" ? state.ducts : kind === "pipe" ? state.pipes : kind === "wire" ? state.wires : state.cableTrays;
export const mepOffset = (row: MepSegment) => row.elevationMm ?? ("elevationOffsetMm" in row ? row.elevationOffsetMm : undefined) ?? ("shape" in row ? 2600 : "diameterMm" in row ? 2700 : 2800);
export const endpointPoint = (row: MepSegment, endpoint: "start" | "end") => ({ xMm: endpoint === "start" ? row.startXmm : row.endXmm, yMm: endpoint === "start" ? row.startYmm : row.endYmm });

export function mepEndpoints(kind: MepKind, state: MepNetwork, levelId: string, offset?: number) {
  const rows = mepRows(kind, state), endpoints: (MepSnapPoint & { elevationMm: number; worldElevationMm: number })[] = [];
  for (const row of rows) {
    if (row.levelId !== levelId || (offset != null && Math.abs(mepOffset(row) - offset) > 1)) continue;
    for (const endpoint of ["start", "end"] as const) {
      if ((endpoint === "start" && "connectedStartEquipmentId" in row && row.connectedStartEquipmentId) ||
          (endpoint === "end" && "connectedEndEquipmentId" in row && row.connectedEndEquipmentId)) continue;
      if (row[endpoint === "start" ? "startConnection" : "endConnection"] || rows.some(r => [r.startConnection, r.endConnection].some(link => link?.id === row.id && link.endpoint === endpoint))) continue;
      const elevationMm = mepOffset(row);
      endpoints.push({ ...endpointPoint(row, endpoint), elevationMm, worldElevationMm: (state.levels.find(l => l.id === row.levelId)?.elevationMm ?? 0) + elevationMm, mepEndpoint: { kind, id: row.id, endpoint } });
    }
  }
  return endpoints;
}

/** Links are persisted on the newly created segment; treat them as undirected
 * graph edges when traversing. Keeping one reference avoids half-written pairs. */
export function connectMepSegment<T extends MepSegment>(kind: MepKind, row: T, state: MepNetwork, start?: MepSnapPoint, end?: MepSnapPoint): T {
  const result = { ...row };
  for (const endpoint of ["start", "end"] as const) {
    const point = endpointPoint(result, endpoint), requested = endpoint === "start" ? start : end;
    const candidate = mepEndpoints(kind, state, row.levelId, endpoint === "end" ? mepOffset(result) : requested?.elevationMm ?? mepOffset(result)).find(p => {
      if (!p.mepEndpoint || p.mepEndpoint.id === row.id || Math.hypot(p.xMm - point.xMm, p.yMm - point.yMm) > 25) return false;
      if (requested?.mepEndpoint && (requested.mepEndpoint.id !== p.mepEndpoint.id || requested.mepEndpoint.endpoint !== p.mepEndpoint.endpoint)) return false;
      const neighbour = mepRows(kind, state).find(item => item.id === p.mepEndpoint?.id);
      return !neighbour || !mepMismatch(result, neighbour);
    });
    if (candidate) {
      result[endpoint === "start" ? "startConnection" : "endConnection"] = candidate.mepEndpoint;
      result.elevationMm = candidate.elevationMm;
    }
  }
  return result;
}

export function mepMismatch(a: MepSegment, b: MepSegment): string | null {
  if ("systemType" in a && "systemType" in b && a.systemType !== b.systemType) return "Different MEP systems";
  if ("shape" in a && "shape" in b && a.shape !== b.shape) return "Duct shape mismatch";
  const dimensions = (row: MepSegment): unknown[] => {
    if ("shape" in row) return row.shape === "round" ? [row.diameterMm ?? 200] : [row.widthMm ?? 300, row.heightMm ?? 200];
    if ("diameterMm" in row) return [row.diameterMm];
    if ("trayType" in row) return [row.trayType, row.widthMm, ...(row.trayType === "conduit" ? [] : [row.heightMm])];
    return [row.wireGauge ?? "3x1.5mm\u00b2", row.voltage ?? 230];
  };
  if (JSON.stringify(dimensions(a)) !== JSON.stringify(dimensions(b))) return "Size / diameter mismatch";
  return null;
}
