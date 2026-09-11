export type ShortcutCategory = "Draw Tools" | "MEP Tools" | "Modify Tools" | "File Actions" | "View Controls" | "General";

export type ShortcutDefinition = {
  id: string;
  combo: string;
  label: string;
  description: string;
  category: ShortcutCategory;
};

/** Single source of truth used by the keyboard handler, tooltips, and /help. */
export const SHORTCUTS: ShortcutDefinition[] = [
  { id: "select", combo: "V", label: "Select", description: "Select elements, faces, edges, or vertices.", category: "General" },
  { id: "wall", combo: "W", label: "Wall", description: "Draw connected wall segments on the active level.", category: "Draw Tools" },
  { id: "door", combo: "D", label: "Door", description: "Place a door in a host wall.", category: "Draw Tools" },
  { id: "window", combo: "Shift+W", label: "Window", description: "Place a window in a host wall.", category: "Draw Tools" },
  { id: "floor", combo: "F", label: "Floor", description: "Sketch a closed floor boundary, including holes.", category: "Draw Tools" },
  { id: "roof", combo: "R", label: "Roof", description: "Sketch a roof footprint and define its slope edges.", category: "Draw Tools" },
  { id: "lines", combo: "L", label: "Lines", description: "Draw connected sketch lines and boundaries.", category: "Draw Tools" },
  { id: "column", combo: "C", label: "Column", description: "Place a structural column.", category: "Draw Tools" },
  { id: "beam", combo: "B", label: "Beam", description: "Draw a structural beam.", category: "Draw Tools" },
  { id: "stair", combo: "S", label: "Stair", description: "Draw a stair run.", category: "Draw Tools" },
  { id: "ramp", combo: "Shift+R", label: "Ramp", description: "Draw an accessible ramp.", category: "Draw Tools" },
  { id: "component", combo: "P", label: "Component", description: "Place a component or furniture family.", category: "Draw Tools" },
  { id: "shapes", combo: "H", label: "Shapes / Note", description: "Open markup shapes and notes.", category: "Draw Tools" },
  { id: "trim", combo: "T", label: "Trim / Extend", description: "Trim or extend a boundary or wall junction.", category: "Modify Tools" },
  { id: "move", combo: "M", label: "Move", description: "Move selected geometry with snapping.", category: "Modify Tools" },
  { id: "rotate", combo: "Shift+M", label: "Rotate", description: "Rotate selected geometry.", category: "Modify Tools" },
  { id: "align", combo: "A", label: "Align", description: "Align selected geometry to a reference.", category: "Modify Tools" },
  { id: "mirror", combo: "Shift+A", label: "Mirror", description: "Mirror selected geometry about an axis.", category: "Modify Tools" },
  { id: "split", combo: "X", label: "Split", description: "Split a wall or sketch line at a picked point.", category: "Modify Tools" },
  { id: "group", combo: "Ctrl+G", label: "Group", description: "Group the current selection.", category: "Modify Tools" },
  { id: "copy", combo: "Ctrl+C", label: "Copy", description: "Copy selected elements.", category: "Modify Tools" },
  { id: "paste", combo: "Ctrl+V", label: "Paste / Offset Copy", description: "Create an offset copy of the current selection using the existing project copy workflow.", category: "Modify Tools" },
  { id: "joinRoof", combo: "J", label: "Join Roof", description: "Join a roof boundary edge to another roof face.", category: "Modify Tools" },
  { id: "attachTop", combo: "Shift+T", label: "Attach Top", description: "Attach selected wall tops to a roof or floor.", category: "Modify Tools" },
  { id: "attachBase", combo: "Shift+B", label: "Attach Base", description: "Attach selected wall bases to a roof or floor.", category: "Modify Tools" },
  { id: "duct", combo: "Shift+D", label: "Duct", description: "Draw a rigid duct run.", category: "MEP Tools" },
  { id: "flex_duct", combo: "Shift+F", label: "Flex Duct", description: "Draw a flexible duct run.", category: "MEP Tools" },
  { id: "mep_placeholder", combo: "Shift+P", label: "MEP Placeholder", description: "Draw a placeholder route.", category: "MEP Tools" },
  { id: "pipe", combo: "I", label: "Pipe", description: "Draw a hydronic or plumbing pipe run.", category: "MEP Tools" },
  { id: "cabletray", combo: "Y", label: "Cable Tray", description: "Draw cable tray or conduit.", category: "MEP Tools" },
  { id: "wire", combo: "E", label: "Wire", description: "Draw an electrical wire run.", category: "MEP Tools" },
  { id: "equipment", combo: "Shift+E", label: "Equipment", description: "Place MEP equipment and fixtures.", category: "MEP Tools" },
  { id: "workplane", combo: "Shift+Q", label: "Work Plane", description: "Set the active reference work plane.", category: "MEP Tools" },
  { id: "open", combo: "Ctrl+O", label: "Open", description: "Open an IFC or FRAG file.", category: "File Actions" },
  { id: "save", combo: "Ctrl+S", label: "Save", description: "Save the current project export.", category: "File Actions" },
  { id: "undo", combo: "Ctrl+Z", label: "Undo", description: "Undo the last project change.", category: "File Actions" },
  { id: "redo", combo: "Ctrl+Y", label: "Redo", description: "Redo the last undone project change.", category: "File Actions" },
  { id: "delete", combo: "Delete", label: "Delete", description: "Delete the current selection.", category: "Modify Tools" },
  { id: "view-top", combo: "1", label: "Plan View", description: "Switch to top plan view.", category: "View Controls" },
  { id: "view-free", combo: "3", label: "3D View", description: "Switch to free 3D view.", category: "View Controls" },
  { id: "render-realistic", combo: "4", label: "Realistic", description: "Use realistic render mode.", category: "View Controls" },
  { id: "render-light", combo: "5", label: "Light", description: "Use light render mode.", category: "View Controls" },
  { id: "render-wireframe", combo: "6", label: "Wireframe", description: "Use wireframe render mode.", category: "View Controls" },
  { id: "cancel", combo: "Escape", label: "Cancel / Deselect", description: "Cancel the active command and clear selection.", category: "General" },
];

export const shortcutFor = (id: string) => SHORTCUTS.find(shortcut => shortcut.id === id);
export const shortcutText = (id: string) => shortcutFor(id)?.combo ?? "";
export const shortcutTextForLabel = (label: string) => SHORTCUTS.find(shortcut => shortcut.label === label || label.startsWith(`${shortcut.label} `))?.combo ?? "";
export const shortcutForByCombo = (combo: string) => SHORTCUTS.find(shortcut => shortcut.combo === combo);

export function normalizedShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">): string {
  if (event.key === "Escape") return "Escape";
  if (event.key === "Delete" || event.key === "Backspace") return "Delete";
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("Ctrl");
  if (event.shiftKey) parts.push("Shift");
  if (event.altKey) parts.push("Alt");
  parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);
  return parts.join("+");
}
