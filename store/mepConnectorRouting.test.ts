import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/layoutDrawingDb");
vi.mock("@/lib/werkzeugHistory", () => ({ pushWerkzeugHistory: vi.fn() }));
import { useLayoutDrawingStore } from "./useLayoutDrawingStore";
import { equipmentRoutePorts, equipmentRouteDefaults } from "@/lib/mepConnectorRouting";
import { placeMepPoint } from "@/components/tools/mepDrawingActions";
import type { LayoutMepEquipment } from "@/lib/layoutDrawing";
import { idbPutPipe, idbPutWire } from "@/lib/layoutDrawingDb";
import { COMPONENT_CATALOG } from "@/lib/componentCatalog";
import { mepRows } from "@/lib/mepConnections";

const initial = useLayoutDrawingStore.getState();
const equipment: LayoutMepEquipment = { id: "unit", projectId: "p", levelId: "l", category: "radiator", xMm: 0, yMm: 0, rotationDeg: 0, elevationMm: 500, createdAt: 1,
  connectors: ["first", "clicked"].map((id, i) => ({ id, name: id, type: "pipe", systemType: "hydronic_return", relXmm: i * 100, relYmm: 0, relZmm: 0, dir: [1, 0, 0], sizeMm: 28 })) };
beforeEach(() => { vi.clearAllMocks(); useLayoutDrawingStore.setState({ ...initial, projectId: "p", mepEquipment: [equipment], mepChainDrawing: true }, true); });
describe("click-to-route persistence", () => {
  it.each(COMPONENT_CATALOG.filter(p => p.id.startsWith("mep-")))("routes every default port of $name", async preset => {
    const item: LayoutMepEquipment = { ...preset, id: "catalog-unit", familyId: preset.id, projectId: "p", levelId: "l", xMm: 0, yMm: 0, rotationDeg: 30, createdAt: 1 };
    useLayoutDrawingStore.setState({ mepEquipment: [item] });
    const ports = equipmentRoutePorts(item, useLayoutDrawingStore.getState());
    expect(ports.length).toBeGreaterThan(0);
    for (const port of ports) {
      useLayoutDrawingStore.getState().setArmedLayoutTool(port.kind);
      useLayoutDrawingStore.setState({ ...equipmentRouteDefaults(port), ductDraw: null, pipeDraw: null, wireDraw: null });
      await placeMepPoint("l", port.point);
      await placeMepPoint("l", { xMm: port.point.xMm + 5000, yMm: port.point.yMm + 5000 });
      const row = mepRows(port.kind, useLayoutDrawingStore.getState()).at(-1)!;
      expect(row).toMatchObject({ connectedStartEquipmentId: item.id, startConnectorId: port.connector.id });
    }
    expect(equipmentRoutePorts(item, useLayoutDrawingStore.getState())).toHaveLength(0);
    expect(equipmentRoutePorts(item, useLayoutDrawingStore.getState(), true)).toHaveLength(ports.length);
  });
  it("persists the clicked port instead of the first nearby port, then continues the run", async () => {
    const port = equipmentRoutePorts(equipment, useLayoutDrawingStore.getState())[1];
    useLayoutDrawingStore.getState().setArmedLayoutTool("pipe");
    useLayoutDrawingStore.setState(equipmentRouteDefaults(port));
    await placeMepPoint("l", port.point);
    await placeMepPoint("l", { xMm: 1000, yMm: 0 });
    const [pipe] = useLayoutDrawingStore.getState().pipes;
    expect(pipe).toMatchObject({ startXmm: 100, diameterMm: 28, systemType: "hydronic_return", elevationOffsetMm: 500, connectedStartEquipmentId: "unit", startConnectorId: "clicked" });
    expect(idbPutPipe).toHaveBeenCalledWith(pipe);
    await placeMepPoint("l", { xMm: 1000, yMm: 1000 });
    expect(useLayoutDrawingStore.getState().pipes[1].startConnection).toMatchObject({ kind: "pipe", id: pipe.id, endpoint: "end" });
  });
  it("persists data-wire equipment connections and ends the chain at another port", async () => {
    const first: LayoutMepEquipment = { ...equipment, connectors: [{ ...equipment.connectors![0], type: "data" }] };
    const second: LayoutMepEquipment = { ...first, id: "other", xMm: 1000 };
    useLayoutDrawingStore.setState({ mepEquipment: [first, second] });
    const start = equipmentRoutePorts(first, useLayoutDrawingStore.getState())[0];
    const end = equipmentRoutePorts(second, useLayoutDrawingStore.getState())[0];
    useLayoutDrawingStore.getState().setArmedLayoutTool("wire");
    useLayoutDrawingStore.setState(equipmentRouteDefaults(start));
    await placeMepPoint("l", start.point); await placeMepPoint("l", end.point);
    const [wire] = useLayoutDrawingStore.getState().wires;
    expect(wire).toMatchObject({ systemType: "data", elevationMm: 500, connectedStartEquipmentId: "unit", connectedEndEquipmentId: "other", startConnectorId: "first", endConnectorId: "first" });
    expect(idbPutWire).toHaveBeenCalledWith(wire);
    expect(useLayoutDrawingStore.getState().wireDraw).toBeNull();
  });
});
