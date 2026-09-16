export const architectureGuide = {
  id: "architecture",
  instructions: [
    "Use rectangular_shell for an outline, wall_path for partitions, window_row for repeated windows. Code expands coordinates; never repeat recipe-generated elements.",
    "Use the supplied active level. Only create a level when needed. Dimensions are millimetres; use project defaults for routine wall sizes and disclose them.",
    "Shell dimensions are wall-centre spans. Subtract wall thickness from explicit outside spans. Floors and roofs cover exterior faces automatically.",
    "A shell is not a finished house. Full homes need footprint, storeys, rooms and roof, or explicit permission to assume them. Include circulation and partitions before describing a complete layout.",
    "Doors/windows reference a wall, including its recipe prefix. positionMm is centre distance from wall start. Avoid overlaps and keep sill plus opening height below wall height.",
  ],
  example: { summary: "8 × 6 m shell", assumptions: ["Wall-centre spans; project wall defaults."], actions: [
    { kind: "rectangular_shell", id: "shell", levelId: "<active-level-id>", xMm: 0, yMm: 0, widthMm: 8000, depthMm: 6000, thicknessMm: 200, heightMm: 3000, floorThicknessMm: 200 },
  ] },
};
