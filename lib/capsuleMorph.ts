export type CapsuleIndexGroup = {
  kind: "merge" | "split" | "same";
  outgoingIndices: number[];
  incomingIndices: number[];
};

function centerOutOrder(count: number): number[] {
  const center = (count - 1) / 2;
  return Array.from({ length: count }, (_, index) => index).sort((a, b) => {
    const distance = Math.abs(a - center) - Math.abs(b - center);
    return distance || a - b;
  });
}

function evenChunkSizes(itemCount: number, groupCount: number): number[] {
  if (groupCount <= 0) return [];
  const baseSize = Math.floor(itemCount / groupCount);
  const sizes = Array(groupCount).fill(baseSize) as number[];
  const remainder = itemCount % groupCount;
  const remainderOrder = centerOutOrder(groupCount);
  for (let index = 0; index < remainder; index += 1) sizes[remainderOrder[index]] += 1;
  return sizes;
}

function contiguousIndices(sizes: number[]): number[][] {
  let cursor = 0;
  return sizes.map((size) => Array.from({ length: size }, () => cursor++));
}

/** Pure, deterministic left-to-right mapping for every morph direction. */
export function computeCapsuleGroups(outgoingCount: number, incomingCount: number): CapsuleIndexGroup[] {
  if (outgoingCount === incomingCount) {
    return Array.from({ length: outgoingCount }, (_, index) => ({
      kind: "same" as const, outgoingIndices: [index], incomingIndices: [index],
    }));
  }
  if (outgoingCount > incomingCount) {
    return contiguousIndices(evenChunkSizes(outgoingCount, incomingCount)).map((outgoingIndices, incomingIndex) => ({
      kind: "merge" as const, outgoingIndices, incomingIndices: [incomingIndex],
    }));
  }
  return contiguousIndices(evenChunkSizes(incomingCount, outgoingCount)).map((incomingIndices, outgoingIndex) => ({
    kind: "split" as const, outgoingIndices: [outgoingIndex], incomingIndices,
  }));
}

/** Adapter retained for the existing animation timeline. */
export function groupCapsulesForMorph<T>(items: T[], groupCount: number): T[][] {
  if (groupCount <= 0) return items.length ? [items] : [];
  return contiguousIndices(evenChunkSizes(items.length, groupCount))
    .map((indices) => indices.map((index) => items[index]));
}
