/**
 * App chrome — header, mobile corner menu, sidebar shell.
 *
 * Live: `HeaderActions` and `MobileCornerMenu` are imported directly by the
 * app (not via this barrel) and are the real header/mobile-menu UI.
 *
 * Legacy/unreferenced: `AppHeader` and `SidebarPanel` — along with this
 * barrel file itself — are not imported by anything reachable from
 * app/page.tsx; they were superseded by HeaderActions.tsx. Kept only for
 * potential reuse; do not assume they're wired into the running app.
 */
export { default as AppHeader } from "./AppHeader";
export { default as HeaderActions } from "./HeaderActions";
export { default as MobileCornerMenu } from "./MobileCornerMenu";
export { default as SidebarPanel } from "./SidebarPanel";
