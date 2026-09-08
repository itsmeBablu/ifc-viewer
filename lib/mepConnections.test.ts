import { describe, expect, it } from "vitest";
import { connectMepSegment, mepEndpoints, type MepNetwork } from "./mepConnections";
import type { LayoutPipe } from "./layoutDrawing";

const pipe = (patch: Partial<LayoutPipe> = {}): LayoutPipe => ({
  id: "a", projectId: "project", levelId: "level", startXmm: 0, startYmm: 0,
  endXmm: 1000, endYmm: 0, diameterMm: 22, systemType: "domestic_cold",
  elevationOffsetMm: 1000, createdAt: 1, ...patch,
});
const network = (pipes: LayoutPipe[]): MepNetwork => ({ pipes, ducts: [], cableTrays: [], wires: [], levels: [] });

describe("MEP endpoint connections", () => {
  it("connects a new bend to the previous run", () => {
    const next = pipe({ id: "b", startXmm: 1000, endYmm: 1000 });
    expect(connectMepSegment("pipe", next, network([pipe()])).startConnection)
      .toEqual({ kind: "pipe", id: "a", endpoint: "end" });
  });
  it("keeps occupied fixture ports out of endpoint snapping", () => {
    const points = mepEndpoints("pipe", network([pipe({ connectedEndEquipmentId: "sink", endConnectorId: "inlet" })]), "level");
    expect(points.map(p => p.mepEndpoint?.endpoint)).toEqual(["start"]);
  });
  it("does not reuse a port referenced by another run", () => {
    const b = pipe({ id: "b", startConnection: { kind: "pipe", id: "a", endpoint: "end" } });
    expect(mepEndpoints("pipe", network([pipe(), b]), "level").some(p => p.mepEndpoint?.id === "a" && p.mepEndpoint.endpoint === "end")).toBe(false);
  });
  it.each([
    { systemType: "domestic_hot" as const }, { diameterMm: 54 },
    { levelId: "other-level" }, { elevationOffsetMm: 2000 },
  ])("rejects incompatible endpoints: %j", patch => {
    const next = pipe({ id: "b", startXmm: 1000, endYmm: 1000, ...patch });
    expect(connectMepSegment("pipe", next, network([pipe()])).startConnection).toBeUndefined();
  });
});
