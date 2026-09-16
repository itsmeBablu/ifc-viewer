import { getEquipmentConnectors, type LayoutMepEquipment, type DuctSystemType, type PipeSystemType } from "./layoutDrawing";
import { mepRows, type MepNetwork, type MepSnapPoint, type MepKind } from "./mepConnections";

export function equipmentRoutePorts(equipment: LayoutMepEquipment, network: MepNetwork) {
  return getEquipmentConnectors(equipment).flatMap(c => {
    const kind: MepKind = c.type === "electrical" || c.type === "data" ? "wire" : c.type;
    if (mepRows(kind, network).some(row =>
      ("connectedStartEquipmentId" in row && row.connectedStartEquipmentId === equipment.id && "startConnectorId" in row && row.startConnectorId === c.id) ||
      ("connectedEndEquipmentId" in row && row.connectedEndEquipmentId === equipment.id && "endConnectorId" in row && row.endConnectorId === c.id))) return [];
    const point: MepSnapPoint = { xMm: c.worldXmm, yMm: c.worldYmm, elevationMm: c.worldZmm,
      equipmentConnector: { equipmentId: equipment.id, connectorId: c.id } };
    return [{ kind, connector: c, point, levelId: equipment.levelId, label: c.name }];
  });
}

export function equipmentRouteDefaults(port: ReturnType<typeof equipmentRoutePorts>[number]) {
  const c = port.connector;
  if (port.kind === "duct") return {
    draftDuctShape: c.sizeMm ? "round" as const : "rectangular" as const,
    draftDuctDiameterMm: c.sizeMm ?? 200, draftDuctWidthMm: c.widthMm ?? 300, draftDuctHeightMm: c.heightMm ?? 200,
    draftDuctSystem: (["supply", "extract", "exhaust", "outdoor", "return"].includes(c.systemType ?? "") ? c.systemType : "supply") as DuctSystemType,
    draftDuctElevationMm: c.worldZmm,
  };
  if (port.kind === "pipe") return {
    draftPipeDiameterMm: c.sizeMm ?? 22,
    draftPipeSystem: (["hydronic_supply", "hydronic_return", "domestic_cold", "domestic_hot", "sanitary_waste", "fire_protection", "gas"].includes(c.systemType ?? "") ? c.systemType : "hydronic_supply") as PipeSystemType,
    draftPipeElevationMm: c.worldZmm,
  };
  return { draftWireSystem: c.type === "data" ? "data" as const : "power" as const, draftWireElevationMm: c.worldZmm };
}

/** An explicit port must never be replaced by a neighbouring port within the snap radius. */
export function matchesRequestedPort(point: MepSnapPoint, equipmentId: string, connectorId: string) {
  return !point.equipmentConnector || (point.equipmentConnector.equipmentId === equipmentId && point.equipmentConnector.connectorId === connectorId);
}
