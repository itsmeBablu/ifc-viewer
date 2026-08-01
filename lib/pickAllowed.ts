import { useAppStore } from "@/store/useAppStore";

/** Whether a room/floor may be picked in the current view (isolate / floor filter). */
export function isRoomPickAllowed(
  roomId: string | null | undefined,
  floorId: string | null | undefined,
): boolean {
  const s = useAppStore.getState();
  const room = roomId ? s.rooms.find((r) => r.id === roomId) : undefined;
  const effectiveFloor = floorId ?? room?.floorId ?? null;

  if (s.isPresentationView && s.presentationIsolate && s.presentationFloorId) {
    return effectiveFloor === s.presentationFloorId;
  }
  if (!s.isPresentationView && s.selectedFloor) {
    return effectiveFloor === s.selectedFloor;
  }
  return true;
}

/** Selected room id only if it belongs to the currently pickable floor scope. */
export function effectiveSelectedRoomId(
  selectedRoomId: string | null | undefined,
): string | null {
  if (!selectedRoomId) return null;
  if (!isRoomPickAllowed(selectedRoomId, null)) return null;
  return selectedRoomId;
}
