import { describe, expect, it } from "vitest";
import { computeCapsuleGroups, groupCapsulesForMorph } from "./capsuleMorph";

describe("groupCapsulesForMorph", () => {
  it("maps a nine-capsule Build set evenly into three Structure targets", () => {
    const outgoing = Array.from({ length: 9 }, (_, index) => index + 1);
    expect(groupCapsulesForMorph(outgoing, 3)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
  });

  it("gives an uneven remainder to the center groups", () => {
    const outgoing = Array.from({ length: 10 }, (_, index) => index + 1);
    expect(groupCapsulesForMorph(outgoing, 4).map((group) => group.length)).toEqual([2, 3, 3, 2]);
  });

  it("groups a full tab into the Modify action count without losing order", () => {
    const outgoing = ["wall", "window", "door", "floor", "roof", "lines", "column", "beam", "stair", "ramp"];
    const groups = groupCapsulesForMorph(outgoing, 8);
    expect(groups.flat()).toEqual(outgoing);
    expect(groups).toHaveLength(8);
    expect(groups.reduce((sum, group) => sum + group.length, 0)).toBe(outgoing.length);
  });

  it("collapses every outgoing capsule into one group when no target remains", () => {
    expect(groupCapsulesForMorph(["a", "b", "c"], 0)).toEqual([["a", "b", "c"]]);
  });
});

describe("computeCapsuleGroups", () => {
  it("splits 3 capsules uniformly across 10 incoming slots", () => {
    const groups = computeCapsuleGroups(3, 10);
    expect(groups.map((group) => group.incomingIndices.length)).toEqual([3, 4, 3]);
    expect(groups.flatMap((group) => group.incomingIndices)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("merges 10 capsules uniformly into 3 incoming slots", () => {
    const groups = computeCapsuleGroups(10, 3);
    expect(groups.map((group) => group.outgoingIndices.length)).toEqual([3, 4, 3]);
    expect(groups.flatMap((group) => group.outgoingIndices)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("uses symmetric center-out grouping when reversed", () => {
    const merge = computeCapsuleGroups(10, 3).map((group) => group.outgoingIndices.length);
    const split = computeCapsuleGroups(3, 10).map((group) => group.incomingIndices.length);
    expect(merge).toEqual(split);
    expect(Math.max(...merge) - Math.min(...merge)).toBeLessThanOrEqual(1);
  });

  it("keeps smaller Structure/Annotate-style counts balanced and ordered", () => {
    const groups = computeCapsuleGroups(4, 3);
    expect(groups.map((group) => group.outgoingIndices.length)).toEqual([1, 2, 1]);
    expect(groups.flatMap((group) => group.outgoingIndices)).toEqual([0, 1, 2, 3]);
  });

  it("maps equal counts one-to-one", () => {
    expect(computeCapsuleGroups(3, 3)).toEqual([
      { kind: "same", outgoingIndices: [0], incomingIndices: [0] },
      { kind: "same", outgoingIndices: [1], incomingIndices: [1] },
      { kind: "same", outgoingIndices: [2], incomingIndices: [2] },
    ]);
  });

  it("handles every merge and split count from 1 through 32 uniformly", () => {
    for (let outgoingCount = 1; outgoingCount <= 32; outgoingCount += 1) {
      for (let incomingCount = 1; incomingCount <= 32; incomingCount += 1) {
        const groups = computeCapsuleGroups(outgoingCount, incomingCount);
        const outgoingIndices = groups.flatMap((group) => group.outgoingIndices);
        const incomingIndices = groups.flatMap((group) => group.incomingIndices);
        expect([...new Set(outgoingIndices)].sort((a, b) => a - b)).toEqual(
          Array.from({ length: outgoingCount }, (_, index) => index),
        );
        expect([...new Set(incomingIndices)].sort((a, b) => a - b)).toEqual(
          Array.from({ length: incomingCount }, (_, index) => index),
        );

        const variableSizes = outgoingCount > incomingCount
          ? groups.map((group) => group.outgoingIndices.length)
          : groups.map((group) => group.incomingIndices.length);
        expect(Math.max(...variableSizes) - Math.min(...variableSizes)).toBeLessThanOrEqual(1);

        if (outgoingCount !== incomingCount) {
          const reverse = computeCapsuleGroups(incomingCount, outgoingCount);
          const reverseSizes = incomingCount > outgoingCount
            ? reverse.map((group) => group.outgoingIndices.length)
            : reverse.map((group) => group.incomingIndices.length);
          expect(reverseSizes).toEqual(variableSizes);
        }
      }
    }
  });

  it("handles empty sides without producing invalid mappings", () => {
    expect(computeCapsuleGroups(0, 8)).toEqual([]);
    expect(computeCapsuleGroups(8, 0)).toEqual([]);
    expect(computeCapsuleGroups(0, 0)).toEqual([]);
  });
});
