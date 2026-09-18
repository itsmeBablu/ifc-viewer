import type { ResidentialParameters } from "./allocation";

export function bedroomBayWidths(p: ResidentialParameters, bays: number, roomWidthMm: number) {
  const seed = p.layoutSeed ?? 0;
  const weights = Array.from({ length: bays }, (_, i) => p.bedroomAreasM2?.[i] ?? .82 + ((seed * 17 + i * 31) % 37) / 100);
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map(w => roomWidthMm * bays * w / total);
}

/** Additional bathrooms share a wet wall and have separate access from the living zone. */
export function bathroomZones(p: ResidentialParameters, x: number, y: number, width: number, depth: number, upper = false) {
  const count = Math.max(1, p.bathroomCount ?? (p.variant === "duplex" ? 2 : 1));
  const floors = p.variant === "duplex" ? 2 : 1;
  const baths = Math.max(1, upper ? Math.floor(count / floors) : Math.ceil(count / floors));
  const weights = [...Array<number>(baths).fill(p.bathroomAreaM2 ?? 8), ...(p.guestBathroom ? [3] : [])];
  const total = weights.reduce((sum, value) => sum + value, 0);
  const clearDepth = depth - (weights.length - 1) * 150;
  let start = y;
  return weights.map((w, i) => {
    const d = clearDepth * w / total;
    const zone = { x, y: start, w: width, d, guest: i === baths };
    start += d + 150;
    return zone;
  });
}
