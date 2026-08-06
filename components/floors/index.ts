/**
 * Floors & room lists (shared across heating / cooling / ventilation).
 *
 * Live: `FloorsPanel` is the current, consolidated tabbed panel and is
 * imported directly by the app.
 *
 * Legacy/unreferenced: `FloorRoomsPanel` (and its siblings BuildingSummary,
 * FloorSelector, SavedViewsPanel in this same folder) are not imported by
 * anything reachable from app/page.tsx — they were superseded when
 * FloorsPanel.tsx consolidated their functionality into a single panel.
 */
export { default as FloorsPanel } from "./FloorsPanel";
export { default as FloorRoomsPanel } from "./FloorRoomsPanel";
