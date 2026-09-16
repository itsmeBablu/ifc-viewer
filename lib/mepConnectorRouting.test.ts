import { describe, expect, it } from "vitest";
import { equipmentRoutePorts, equipmentRouteDefaults, matchesRequestedPort } from "./mepConnectorRouting";
import type { LayoutMepEquipment, LayoutPipe } from "./layoutDrawing";
import type { MepNetwork } from "./mepConnections";

const equipment: LayoutMepEquipment = {
  id: "equipment", projectId: "project", levelId: "upper", category: "radiator", xMm: 1000, yMm: 2000,
  elevationMm: 500, rotationDeg: 90, createdAt: 1,
  connectors: [{ id: "return", name: "Return", type: "pipe", systemType: "hydronic_return", relXmm: 100, relYmm: 0, relZmm: 50, dir: [1, 0, 0], sizeMm: 28 }],
};
const network: MepNetwork = { ducts: [], pipes: [], cableTrays: [], wires: [], levels: [] };
describe("routing from equipment ports", () => {
  it("uses the rotated port position and level-relative height", () => {
    const [port] = equipmentRoutePorts(equipment, network);
    expect(port.point.xMm).toBeCloseTo(1000);
    expect(port.point.yMm).toBeCloseTo(2100);
    expect(port.point.elevationMm).toBe(550);
    expect(equipmentRouteDefaults(port)).toMatchObject({ draftPipeDiameterMm: 28, draftPipeSystem: "hydronic_return", draftPipeElevationMm: 550 });
  });
  it("does not replace an explicit port with a nearby port", () => {
    const [port] = equipmentRoutePorts(equipment, network);
    expect(matchesRequestedPort(port.point, equipment.id, "supply")).toBe(false);
    expect(matchesRequestedPort(port.point, "other", "return")).toBe(false);
    expect(matchesRequestedPort(port.point, equipment.id, "return")).toBe(true);
  });
  it("excludes occupied ports", () => {
    const pipe: LayoutPipe = { id: "pipe", projectId: "project", levelId: "upper", startXmm: 1000, startYmm: 2100, endXmm: 2000, endYmm: 2100, diameterMm: 28, systemType: "hydronic_return", createdAt: 1, connectedStartEquipmentId: equipment.id, startConnectorId: "return" };
    expect(equipmentRoutePorts(equipment, { ...network, pipes: [pipe] })).toEqual([]);
  });
  it("starts round ducts with their connector diameter and system", () => {
    const [port] = equipmentRoutePorts({ ...equipment, connectors: [{ ...equipment.connectors![0], type: "duct", sizeMm: 160, systemType: "extract" }] }, network);
    expect(equipmentRouteDefaults(port)).toMatchObject({ draftDuctShape: "round", draftDuctDiameterMm: 160, draftDuctSystem: "extract" });
  });
  it("maps data ports to data wires and hides persisted wire connections", () => {
    const data = { ...equipment, connectors: [{ ...equipment.connectors![0], type: "data" as const }] };
    const [port] = equipmentRoutePorts(data, network);
    expect(port.kind).toBe("wire");
    expect(equipmentRouteDefaults(port)).toMatchObject({ draftWireSystem: "data" });
    expect(equipmentRoutePorts(data, { ...network, wires: [{ id: "wire", projectId: "project", levelId: "upper", startXmm: 1000, startYmm: 2100, endXmm: 2000, endYmm: 2100, createdAt: 1, connectedEndEquipmentId: equipment.id, endConnectorId: "return" }] })).toEqual([]);
  });
});
