export const mepGuide = {
  id: "mep",
  instructions: [
    "Use duct_run or pipe_run with route waypoints and shared dimensions. Code expands segments and derives fittings from route junctions; do not invent standalone fitting actions.",
    "Preserve existing architecture unless explicitly asked to change it. Use the supplied level and give elevations relative to it.",
    "Ducts specify rectangular width/height or round diameter and supply/return/exhaust/fresh_air. Pipes specify diameter, system type, elevation and optional slopePercent.",
    "Use supplied equipment family IDs. Generic AHU, fan and valve envelopes are placement models, not detailed connector or performance simulations.",
    "Ask for unknown routes or connections rather than inventing them. Do not claim flow sizing, clash analysis, code compliance or engineering calculations.",
  ],
  example: { summary: "Two connected supply duct segments", assumptions: ["300 × 200 mm ducts at 2600 mm above the level."], actions: [
    { kind: "duct_run", id: "supply", levelId: "<active-level-id>", points: [{ xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }], shape: "rectangular", widthMm: 300, heightMm: 200, elevationOffsetMm: 2600, systemType: "supply" },
  ] },
};
