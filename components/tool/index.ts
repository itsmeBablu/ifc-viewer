/**
 * Werkzeug (Tool) — native IFC inspection view.
 *
 * A standard BIM-viewer surface: the model in its own IFC colors, an IFC spatial
 * structure tree with per-element visibility, and a tabbed property inspector.
 * No legend, no floors/rooms panel — those belong to the analysis views.
 *
 * Depends on:
 * - ../viewer — 3D scene + ModelSceneContext
 * - @/lib/ifcStructure — spatial tree built from the open web-ifc model
 */
export { default as ToolSidePanel } from "./ToolSidePanel";
export { default as IfcStructureTree } from "./IfcStructureTree";
export { default as ElementInspector } from "./ElementInspector";
export { useIfcStructure } from "./useIfcStructure";
