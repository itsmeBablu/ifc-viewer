import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
vi.mock("@/lib/layoutDrawingDb");
vi.mock("@/lib/werkzeugHistory", () => ({ pushWerkzeugHistory: vi.fn() }));
import { installMepRouteHandles } from "./MepRouteHandles";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { COMPONENT_CATALOG } from "@/lib/componentCatalog";

class Element {
  style: Record<string, string> = {}; dataset: Record<string, string> = {};
  children: Element[] = []; hidden = false; disabled = false; title = "";
  listeners: Record<string, (e: unknown) => void> = {};
  setAttribute() {} append(...elements: Element[]) { this.children.push(...elements); }
  replaceChildren() { this.children = []; } remove() {}
  addEventListener(name: string, listener: (e: unknown) => void) { this.listeners[name] = listener; }
}
const initial = useLayoutDrawingStore.getState(), initialMarkup = useToolMarkupStore.getState();
afterEach(() => { useLayoutDrawingStore.setState(initial, true); useToolMarkupStore.setState(initialMarkup, true); vi.unstubAllGlobals(); });
describe("equipment connector handles in the viewport", () => {
  it.each(["plan", "3d", "quad"])("shows connectors only for selected catalogue equipment in %s", view => {
    const body = new Element(); let tick: FrameRequestCallback = () => {};
    vi.stubGlobal("document", { body, createElement: () => new Element() });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { tick = callback; return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const equipment = COMPONENT_CATALOG.filter(p => p.id.startsWith("mep-")).map((p, i) => ({ ...p, id: p.id, familyId: p.id, projectId: "p", levelId: "l", xMm: i * 2000, yMm: 0, rotationDeg: 0, createdAt: 1 }));
    useLayoutDrawingStore.setState({ ...initial, projectId: "p", mepModeActive: true, selectedEquipmentId: null, mepEquipment: equipment, levels: [{ id: "l", projectId: "p", name: "Ground", elevationMm: 0, heightMm: 3000, createdAt: 1 }] });
    useToolMarkupStore.setState({ quadView: view === "quad" });
    const camera = new THREE.OrthographicCamera(-30, 30, 30, -30, 0.1, 1000);
    camera.position.set(15, 40, view === "plan" ? 0 : 15); camera.lookAt(15, 0, 0); camera.updateMatrixWorld();
    const root = new THREE.Group(); root.name = "layout-drawing-layer";
    for (const item of equipment) { const group = new THREE.Group(); group.userData.layoutEquipmentId = item.id; root.add(group); }
    const activate = vi.fn();
    const dispose = installMepRouteHandles({ canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 900 }) } as HTMLCanvasElement, camera: () => camera, roots: () => [root], activate });
    tick(0);
    expect(body.children[0].children.filter(e => e.dataset.mepRouteHandle)).toHaveLength(0);
    useLayoutDrawingStore.setState({ selectedElements: equipment.map(e => ({ kind: "equipment", id: e.id })) });
    tick(1);
    const buttons = body.children[0].children.filter(e => e.dataset.mepRouteHandle);
    for (const item of equipment) expect(buttons.some(b => b.dataset.equipmentId === item.id && !b.hidden)).toBe(true);
    const chillerPorts = buttons.filter(b => b.dataset.equipmentId === "mep-chiller" && !b.hidden);
    expect(new Set(chillerPorts.map(b => `${b.style.left},${b.style.top}`)).size).toBe(chillerPorts.length);
    buttons[0].listeners.click({ preventDefault() {}, stopPropagation() {} });
    expect(activate).toHaveBeenCalledWith(expect.objectContaining({ objectId: equipment[0].id }));
    root.children[0].visible = false; tick(1);
    expect(buttons.filter(b => b.dataset.equipmentId === equipment[0].id).every(b => b.hidden)).toBe(true);
    useLayoutDrawingStore.setState({ selectedEquipmentId: "mep-chiller", selectedElements: [] }); tick(2);
    const single = body.children[0].children.filter(e => e.dataset.mepRouteHandle);
    expect(single.length).toBeGreaterThan(0);
    expect(single.every(b => b.dataset.equipmentId === "mep-chiller")).toBe(true);
    useLayoutDrawingStore.setState({ selectedEquipmentId: null }); tick(3);
    expect(body.children[0].children.filter(e => e.dataset.mepRouteHandle)).toHaveLength(0);
    dispose();
  });
});
