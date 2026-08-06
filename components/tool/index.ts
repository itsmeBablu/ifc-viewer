/**
 * Werkzeug (Tool) — native IFC inspection + Blender-style markup dock.
 *
 * Depends on:
 * - ../viewer — 3D scene + ModelSceneContext
 * - @/lib/ifcStructure — spatial tree from the open web-ifc model
 * - @/lib/toolMarkup — placement/note types + geometry
 * - @/lib/markupUnits — mm display / distance snap helpers
 */
export { default as ToolSidePanel } from "./ToolSidePanel";
export { default as ToolTopBar } from "./ToolTopBar";
export { default as ToolModifyPanel } from "./ToolModifyPanel";
export { default as ToolFloorsSection } from "./ToolFloorsSection";
export { default as ToolUnderlineTabs } from "./ToolUnderlineTabs";
export { default as MarkupToolsSection } from "./MarkupToolsSection";
export { default as ColorSwatchPicker } from "./ColorSwatchPicker";
export { default as IfcStructureTree } from "./IfcStructureTree";
export { default as ElementInspector } from "./ElementInspector";
export { default as MarkupToolbar } from "./MarkupToolbar";
export { default as MarkupPropertiesPanel } from "./MarkupPropertiesPanel";
export { useIfcStructure } from "./useIfcStructure";
export { MarkupSceneLayer } from "./MarkupSceneLayer";
