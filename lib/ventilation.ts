import type { Room, RoomVentilation, VentilationFlowRole } from "./types";

export type VentilationZoneSummary = {
  zoneName: string;
  ventilationZoneName: string;
  zoneNumber: number;
  zoneAldVolume: number;
  roomCount: number;
  totalAbluft: number;
  totalZuluft: number;
  totalHeatLoss: number;
  roomIds: string[];
};

export function emptyVentilation(): RoomVentilation {
  return {
    abluftVolume: 0,
    zuluftVolume: 0,
    overflowVolume: 0,
    aldVolume: 0,
    ventilationHeatLoss: 0,
    hasVentSystem: false,
    hasAirTreatment: true,
    isSupplyRoom: false,
    isExtractRoom: false,
    isOverflowRoom: false,
    zoneName: "",
    ventilationZoneName: "",
    zoneAldVolume: 0,
    zoneNumber: 0,
    roomArt: "",
    abluftOutlets: 0,
  };
}

/** Primary volume flow used for display (m³/h). */
export function roomFlowVolume(v: RoomVentilation): number {
  return Math.max(
    v.abluftVolume,
    v.zuluftVolume,
    v.aldVolume,
    v.overflowVolume,
  );
}

/** Minimum m³/h — ignore tiny numeric noise from IFC exports. */
export const MIN_VENT_FLOW_M3H = 0.5;

/** Solar Computer RaumArt codes without duct/fan flow markers. */
const NON_VENTILATED_ROOM_ARTS = new Set(["200"]);

/** Wet rooms with a local Abluftgerät (SC_H73KEY_RaumArt). */
const EXTRACT_DEVICE_ROOM_ARTS = new Set(["204", "205", "206"]);

/** Corridors / halls — Überströmung transfer, not mechanical extract. */
const OVERFLOW_TRANSFER_ROOM_ARTS = new Set(["201"]);

/** Flur / corridor — Überströmung only, no Abluftgerät or red extract arrows. */
export function roomIsOverflowTransfer(room: Room): boolean {
  const v = room.ventilation;
  if (v.isExtractRoom || v.abluftOutlets > 0) return false;
  if (
    EXTRACT_DEVICE_ROOM_ARTS.has(v.roomArt.trim()) &&
    v.hasVentSystem
  ) {
    return false;
  }
  if (v.isOverflowRoom) return v.overflowVolume >= MIN_VENT_FLOW_M3H;
  if (OVERFLOW_TRANSFER_ROOM_ARTS.has(v.roomArt.trim())) {
    return v.overflowVolume >= MIN_VENT_FLOW_M3H;
  }
  if (
    v.overflowVolume >= MIN_VENT_FLOW_M3H &&
    v.abluftVolume < MIN_VENT_FLOW_M3H &&
    !v.hasVentSystem
  ) {
    return true;
  }
  return false;
}

export function ventilationFlowRole(room: Room): VentilationFlowRole {
  const v = room.ventilation;
  if (roomHasExtractFan(room)) return "extract";
  if (roomIsOverflowTransfer(room)) return "overflow";
  if (v.isExtractRoom || v.abluftVolume >= MIN_VENT_FLOW_M3H) return "extract";
  if (v.isSupplyRoom || v.zuluftVolume >= MIN_VENT_FLOW_M3H || v.aldVolume >= MIN_VENT_FLOW_M3H) {
    return "supply";
  }
  if (v.isOverflowRoom || v.overflowVolume >= MIN_VENT_FLOW_M3H) return "overflow";
  return "neutral";
}

/**
 * Mechanical Abluftgerät (e.g. Bad — LüftungssystemVorhanden on wet rooms).
 * Flur / Überströmung (RaumArt 201) has LüftungssystemVorhanden too but no local fan.
 */
export function roomHasExtractFan(room: Room): boolean {
  const v = room.ventilation;
  if (NON_VENTILATED_ROOM_ARTS.has(v.roomArt.trim())) return false;
  if (roomIsOverflowTransfer(room)) return false;
  if (v.isExtractRoom) return v.hasVentSystem || v.abluftOutlets > 0;
  if (v.abluftOutlets > 0) return true;
  // Bad / WC — local Abluftgerät; "keine Luftaufbereitung" only means no central RLT.
  if (EXTRACT_DEVICE_ROOM_ARTS.has(v.roomArt.trim())) {
    return (
      v.hasVentSystem &&
      (v.abluftVolume >= MIN_VENT_FLOW_M3H ||
        v.overflowVolume >= MIN_VENT_FLOW_M3H)
    );
  }
  if (!v.hasAirTreatment) return false;
  return (
    v.hasVentSystem &&
    (v.abluftVolume >= MIN_VENT_FLOW_M3H ||
      v.overflowVolume >= MIN_VENT_FLOW_M3H)
  );
}

/** Duct Abluft without a local fan unit — upward arrows only. */
export function roomHasDuctExtractOnly(room: Room): boolean {
  const v = room.ventilation;
  return !v.hasVentSystem && v.abluftVolume > 0;
}

/** True when the room should show 3D flow markers (not heat-loss-only). */
export function roomShowsVentilationFlowMarkers(room: Room): boolean {
  const v = room.ventilation;
  if (NON_VENTILATED_ROOM_ARTS.has(v.roomArt.trim())) return false;

  if (roomHasExtractFan(room)) return true;
  if (v.abluftVolume >= MIN_VENT_FLOW_M3H || v.zuluftVolume >= MIN_VENT_FLOW_M3H) return true;
  if (v.aldVolume >= MIN_VENT_FLOW_M3H || v.overflowVolume >= MIN_VENT_FLOW_M3H) return true;
  return false;
}

/** Room in the zone that introduces Zuluft (facade bedroom, ALD inlet, etc.). */
export function roomSuppliesZoneZuluft(room: Room): boolean {
  const v = room.ventilation;
  return (
    v.isSupplyRoom ||
    v.zuluftVolume >= MIN_VENT_FLOW_M3H ||
    v.aldVolume >= MIN_VENT_FLOW_M3H
  );
}

/** Bathroom / WC — extract only, no green Zuluft arrows from facade. */
export function roomIsExtractOnly(room: Room): boolean {
  const v = room.ventilation;
  if (roomSuppliesZoneZuluft(room)) return false;
  if (v.isExtractRoom) return true;
  if (roomHasExtractFan(room)) return true;
  return (
    v.abluftVolume >= MIN_VENT_FLOW_M3H &&
    v.zuluftVolume < MIN_VENT_FLOW_M3H &&
    v.aldVolume < MIN_VENT_FLOW_M3H
  );
}

/** Green Zuluft arrows — facade inlets, interior transfer (Flur, Bad), downstream rooms. */
export function roomShowsZuluftMarkers(room: Room): boolean {
  const v = room.ventilation;
  if (NON_VENTILATED_ROOM_ARTS.has(v.roomArt.trim())) return false;

  if (v.zuluftVolume >= MIN_VENT_FLOW_M3H || v.aldVolume >= MIN_VENT_FLOW_M3H) {
    return true;
  }
  // Bad / WC — receives transfer air from corridor / zone neighbours.
  if (roomHasExtractFan(room)) return true;
  // Flur / Diele — receives air from window / supply rooms in zone.
  if (roomIsOverflowTransfer(room)) return true;
  return false;
}

/** Compact Abluft · Zuluft · LW values for room list rows. */
export function roomVentilationListMetrics(v: RoomVentilation): {
  abluft: string;
  zuluft: string;
  heatLoss: string;
} {
  return {
    abluft: formatFlowVolume(Math.max(v.abluftVolume, v.overflowVolume)),
    zuluft: formatFlowVolume(Math.max(v.zuluftVolume, v.aldVolume)),
    heatLoss: formatHeatLoss(v.ventilationHeatLoss),
  };
}

/** Metric for room coloring in Lüftung view — ventilation heat loss (W). */
export function roomVentilationColorValue(room: Room): number {
  return room.ventilation.ventilationHeatLoss;
}

export function roomHasVentilationMarkers(room: Room): boolean {
  return roomShowsVentilationFlowMarkers(room);
}

const zoneKey = (room: Room) =>
  room.ventilation.zoneName.trim() ||
  room.ventilation.ventilationZoneName.trim() ||
  "—";

export function roomVentilationZoneKey(room: Room): string {
  const name = room.ventilation.zoneName.trim() || zoneKey(room);
  return `${room.ventilation.zoneNumber}::${name}`;
}

export function summaryVentilationZoneKey(zone: VentilationZoneSummary): string {
  return `${zone.zoneNumber}::${zone.zoneName}`;
}

export function roomInVentilationZone(
  room: Room,
  zoneKey: string | null,
): boolean {
  if (!zoneKey) return true;
  return roomVentilationZoneKey(room) === zoneKey;
}

/** Group rooms by Nutzungszone / Lüftungszone (apartment / office unit). */
export function groupRoomsByVentilationZone(
  rooms: Room[],
): VentilationZoneSummary[] {
  const map = new Map<string, VentilationZoneSummary>();

  for (const room of rooms) {
    const key = zoneKey(room);
    let entry = map.get(key);
    if (!entry) {
      entry = {
        zoneName: room.ventilation.zoneName || key,
        ventilationZoneName: room.ventilation.ventilationZoneName,
        zoneNumber: room.ventilation.zoneNumber,
        zoneAldVolume: room.ventilation.zoneAldVolume,
        roomCount: 0,
        totalAbluft: 0,
        totalZuluft: 0,
        totalHeatLoss: 0,
        roomIds: [],
      };
      map.set(key, entry);
    }
    entry.roomCount += 1;
    entry.totalAbluft += Math.max(
      room.ventilation.abluftVolume,
      room.ventilation.overflowVolume,
    );
    entry.totalZuluft += Math.max(
      room.ventilation.zuluftVolume,
      room.ventilation.aldVolume,
    );
    entry.totalHeatLoss += room.ventilation.ventilationHeatLoss;
    entry.roomIds.push(room.id);
    if (!entry.zoneAldVolume && room.ventilation.zoneAldVolume > 0) {
      entry.zoneAldVolume = room.ventilation.zoneAldVolume;
    }
  }

  return [...map.values()].sort(
    (a, b) =>
      a.zoneNumber - b.zoneNumber ||
      a.zoneName.localeCompare(b.zoneName),
  );
}

export function formatFlowVolume(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return `${value.toFixed(1).replace(".", ",")} m³/h`;
}

export function formatHeatLoss(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return `${Math.round(value)} W`;
}
