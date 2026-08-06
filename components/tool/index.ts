/**
 * Werkzeug (Tool) — native IFC inspection view + markup.
 *
 * A standard BIM-viewer surface: the model in its own IFC colors, an IFC spatial
 * structure tree with per-element visibility, and a tabbed property inspector.
 * Markup tools (shapes + sticky notes) live here too — persisted per model in
 * IndexedDB as discrete rows for later sync.
 *
 * Depends on:
 * - ../viewer — 3D scene + ModelSceneContext
 * - @/lib/ifcStructure — spatial tree built from the open web-ifc model
 * - @/lib/toolMarkup — placement/note types + geometry
 */
export { default as ToolSidePanel } from "./ToolSidePanel";
export { default as ToolModifyPanel } from "./ToolModifyPanel";
export { default as IfcStructureTree } from "./IfcStructureTree";
export { default as ElementInspector } from "./ElementInspector";
export { default as MarkupToolbar } from "./MarkupToolbar";
export { default as MarkupPropertiesPanel } from "./MarkupPropertiesPanel";
export { useIfcStructure } from "./useIfcStructure";
export { MarkupSceneLayer } from "./MarkupSceneLayer";
