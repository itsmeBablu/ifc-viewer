export type OpeningOrientation = {
  hinge: "start" | "end";
  swing: 1 | -1;
  openingAngleDeg: number;
};

export function nextOpeningOrientation(value: Partial<OpeningOrientation>): OpeningOrientation {
  const hinge = value.hinge ?? "start";
  const swing = value.swing ?? 1;
  return {
    hinge: swing === -1 ? (hinge === "start" ? "end" : "start") : hinge,
    swing: swing === 1 ? -1 : 1,
    openingAngleDeg: value.openingAngleDeg ?? 0,
  };
}

export function openingOrientationLabel(value: Partial<OpeningOrientation>) {
  return `${value.swing === -1 ? "Inside" : "Outside"} · ${value.hinge === "end" ? "Right" : "Left"} hinge`;
}
