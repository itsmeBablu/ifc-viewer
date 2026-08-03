import type { Floor, Room, RoomVentilation, VentilationFlowRole } from "./types";

export type VentilationZoneSummary = {
  /** Storey this Nutzungszone belongs to (WG1 on EG ≠ WG1 on 1.OG). */
  floorId: string;
  floorName: string;
  /** Short label: EG, 03. OG, -01. UG, DG. */
  floorAbbrev: string;
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
    hasAld: false,
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

/**
 * ALD inlets often export fractional flows (e.g. 0.4 m³/h) below the general
 * vent minimum — still real supply air.
 */
export const MIN_ALD_FLOW_M3H = 0.05;

/** True when the room has an ALD / outdoor-air inlet worth showing as Zuluft. */
export function roomHasAldSupply(v: RoomVentilation): boolean {
  return v.hasAld || v.aldVolume >= MIN_ALD_FLOW_M3H;
}

/** Lüftung 3D / presentation flow colors. */
export const VENT_FLOW_COLORS = {
  /** Abluft — yellow. */
  abluft: 0xfacc15,
  /** Zuluft — red. */
  zuluft: 0xef4444,
  /** Überstrom — green. */
  uberstrom: 0x22c55e,
} as const;

export const VENT_FLOW_HEX = {
  abluft: "#facc15",
  zuluft: "#ef4444",
  uberstrom: "#22c55e",
} as const;

/** Solar Computer RaumArt codes without duct/fan flow markers. */
const NON_VENTILATED_ROOM_ARTS = new Set(["200"]);

/** Wet rooms with a local Abluftgerät (SC_H73KEY_RaumArt). */
const EXTRACT_DEVICE_ROOM_ARTS = new Set(["204", "205", "206"]);

/** Corridors / halls — Überströmung transfer, not mechanical extract. */
const OVERFLOW_TRANSFER_ROOM_ARTS = new Set(["201"]);

/** Normalize IFC RaumArt ("204", "204.0", "204 Bad") to a digit code. */
export function normalizeRoomArt(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const m = s.match(/^(\d+)/);
  if (m) return String(parseInt(m[1]!, 10));
  return s;
}

/**
 * Bad / WC / Dusche — local Abluftgerät rooms (by RaumArt or name).
 * "keine Luftaufbereitung" still allows a local fan.
 */
export function roomIsWetExtractRoom(room: Room): boolean {
  const art = normalizeRoomArt(room.ventilation.roomArt);
  if (EXTRACT_DEVICE_ROOM_ARTS.has(art)) return true;
  const label = `${room.name} ${room.number}`.toLowerCase();
  return /\b(bad|badezimmer|bath|bathroom|wc|dusche|toilet|toilette|waschraum|nasszelle)\b/i.test(
    label,
  );
}

/** Flur / corridor — Überströmung only, no Abluftgerät or yellow extract arrows. */
export function roomIsOverflowTransfer(room: Room): boolean {
  const v = room.ventilation;
  const art = normalizeRoomArt(v.roomArt);
  if (v.isExtractRoom || v.abluftOutlets > 0) return false;
  // Bathrooms are never overflow-only — they get a ceiling Abluftgerät.
  if (roomIsWetExtractRoom(room)) return false;
  if (v.isOverflowRoom) return v.overflowVolume >= MIN_VENT_FLOW_M3H;
  if (OVERFLOW_TRANSFER_ROOM_ARTS.has(art)) {
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
  if (
    v.isSupplyRoom ||
    v.zuluftVolume >= MIN_VENT_FLOW_M3H ||
    roomHasAldSupply(v)
  ) {
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
  const art = normalizeRoomArt(v.roomArt);
  if (NON_VENTILATED_ROOM_ARTS.has(art)) return false;

  const hasExtractFlow =
    v.abluftVolume >= MIN_VENT_FLOW_M3H ||
    v.overflowVolume >= MIN_VENT_FLOW_M3H;

  // Bad / WC — local Abluftgerät; do not require hasVentSystem when flow exists.
  // Bathrooms often store extract as Überstrom + IstAbluftraum without outlets count.
  if (roomIsWetExtractRoom(room)) {
    return (
      v.hasVentSystem ||
      v.abluftOutlets > 0 ||
      v.isExtractRoom ||
      hasExtractFlow
    );
  }

  if (roomIsOverflowTransfer(room)) return false;
  if (v.isExtractRoom) {
    return v.hasVentSystem || v.abluftOutlets > 0 || hasExtractFlow;
  }
  if (v.abluftOutlets > 0) return true;
  // Central RLT rooms only — "keine Luftaufbereitung" skips non-wet rooms.
  if (!v.hasAirTreatment) return false;
  return v.hasVentSystem && hasExtractFlow;
}

/** Duct Abluft without a local fan unit — upward arrows only. */
export function roomHasDuctExtractOnly(room: Room): boolean {
  const v = room.ventilation;
  return !v.hasVentSystem && v.abluftVolume > 0;
}

/** True when the room should show 3D flow markers (not heat-loss-only). */
export function roomShowsVentilationFlowMarkers(room: Room): boolean {
  const v = room.ventilation;
  if (NON_VENTILATED_ROOM_ARTS.has(normalizeRoomArt(v.roomArt))) return false;

  if (roomHasExtractFan(room)) return true;
  if (v.abluftVolume >= MIN_VENT_FLOW_M3H || v.zuluftVolume >= MIN_VENT_FLOW_M3H) return true;
  if (roomHasAldSupply(v) || v.overflowVolume >= MIN_VENT_FLOW_M3H) return true;
  return false;
}

/** Room in the zone that introduces Zuluft (facade bedroom, ALD inlet, etc.). */
export function roomSuppliesZoneZuluft(room: Room): boolean {
  const v = room.ventilation;
  return (
    v.isSupplyRoom ||
    v.zuluftVolume >= MIN_VENT_FLOW_M3H ||
    roomHasAldSupply(v)
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
    !roomHasAldSupply(v)
  );
}

/** Green Zuluft arrows — facade inlets, interior transfer (Flur, Bad), downstream rooms. */
export function roomShowsZuluftMarkers(room: Room): boolean {
  const v = room.ventilation;
  if (NON_VENTILATED_ROOM_ARTS.has(normalizeRoomArt(v.roomArt))) return false;

  if (v.zuluftVolume >= MIN_VENT_FLOW_M3H || roomHasAldSupply(v)) {
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

const zoneNameFallback = (room: Room) =>
  room.ventilation.zoneName.trim() ||
  room.ventilation.ventilationZoneName.trim() ||
  "—";

/**
 * Short German storey labels for compact tables:
 * Erdgeschoss → EG, 3. Obergeschoss → 03. OG, -1 Untergeschoss → -01. UG, Dachgeschoss → DG.
 */
export function abbreviateFloorName(name: string): string {
  const n = name.trim().replace(/\s+/g, " ");
  if (!n) return "—";
  if (/dachgeschoss|\bdg\b|attic|roof\s*floor/i.test(n)) return "DG";
  if (/erdgeschoss|\beg\b|ground\s*floor|parterre/i.test(n)) return "EG";

  const padFloor = (num: number, suffix: "OG" | "UG") => {
    const abs = Math.abs(num);
    const padded = String(abs).padStart(2, "0");
    return num < 0 || suffix === "UG"
      ? `-${padded}. ${suffix}`
      : `${padded}. ${suffix}`;
  };

  const ugBefore = n.match(/(-?\d+)\s*[.\-]?\s*(?:untergeschoss|\bug\b)/i);
  if (ugBefore) {
    let num = parseInt(ugBefore[1], 10);
    if (num > 0) num = -num;
    return padFloor(num, "UG");
  }
  const ugAfter = n.match(/(?:untergeschoss|\bug\b)\s*[.\-]?\s*(-?\d+)/i);
  if (ugAfter) {
    let num = parseInt(ugAfter[1], 10);
    if (num > 0) num = -num;
    return padFloor(num, "UG");
  }
  if (/untergeschoss|\bug\b|basement|keller/i.test(n)) return "UG";

  const ogBefore = n.match(/(\d+)\s*[.\-]?\s*(?:obergeschoss|\bog\b|etage|stockwerk)/i);
  if (ogBefore) return padFloor(parseInt(ogBefore[1], 10), "OG");
  const ogAfter = n.match(/(?:obergeschoss|\bog\b)\s*[.\-]?\s*(\d+)/i);
  if (ogAfter) return padFloor(parseInt(ogAfter[1], 10), "OG");
  if (/obergeschoss|\bog\b/i.test(n)) return "OG";

  return n.length > 12 ? `${n.slice(0, 11)}…` : n;
}

/** Display label for a Nutzungszone (WG 1, or padded zone number). */
export function ventilationZoneDisplayName(zone: {
  zoneName: string;
  zoneNumber: number;
}): string {
  const name = zone.zoneName.trim();
  if (name && name !== "—") return name;
  if (zone.zoneNumber !== 0) {
    const n = zone.zoneNumber;
    if (n < 0) return String(n);
    return String(Math.abs(n)).padStart(5, "0");
  }
  return "—";
}

/**
 * Unique key per floor + zone — WG1 on EG is distinct from WG1 on 1.OG.
 * Format: floorId::zoneNumber::zoneName
 */
export function roomVentilationZoneKey(room: Room): string {
  const name = room.ventilation.zoneName.trim() || zoneNameFallback(room);
  return `${room.floorId}::${room.ventilation.zoneNumber}::${name}`;
}

export function summaryVentilationZoneKey(zone: VentilationZoneSummary): string {
  return `${zone.floorId}::${zone.zoneNumber}::${zone.zoneName}`;
}

export function roomInVentilationZone(
  room: Room,
  zoneKey: string | null,
): boolean {
  if (!zoneKey) return true;
  return roomVentilationZoneKey(room) === zoneKey;
}

/** Group rooms by floor + Nutzungszone / Lüftungszone. */
export function groupRoomsByVentilationZone(
  rooms: Room[],
  floors: Floor[] = [],
): VentilationZoneSummary[] {
  const floorById = new Map(floors.map((f) => [f.id, f]));
  const map = new Map<string, VentilationZoneSummary>();

  for (const room of rooms) {
    const key = roomVentilationZoneKey(room);
    let entry = map.get(key);
    if (!entry) {
      const floor = floorById.get(room.floorId);
      const floorName = floor?.name ?? "";
      entry = {
        floorId: room.floorId,
        floorName,
        floorAbbrev: abbreviateFloorName(floorName),
        zoneName: room.ventilation.zoneName || zoneNameFallback(room),
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
    if (!entry.ventilationZoneName && room.ventilation.ventilationZoneName) {
      entry.ventilationZoneName = room.ventilation.ventilationZoneName;
    }
  }

  return [...map.values()].sort((a, b) => {
    const ea = floorById.get(a.floorId)?.elevation ?? 0;
    const eb = floorById.get(b.floorId)?.elevation ?? 0;
    return (
      ea - eb ||
      a.zoneNumber - b.zoneNumber ||
      a.zoneName.localeCompare(b.zoneName)
    );
  });
}

export function formatFlowVolume(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return `${value.toFixed(1).replace(".", ",")} m³/h`;
}

/** Compact number for table cells (unit in column header). */
export function formatFlowVolumeCompact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  const rounded = Math.round(value * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1).replace(".", ",");
}

export function formatHeatLoss(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return `${Math.round(value)} W`;
}
