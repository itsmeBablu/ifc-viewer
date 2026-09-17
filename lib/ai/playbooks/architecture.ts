export const architectureGuide = {
  id: "architecture",
  instructions: [
    "Use rectangular_shell for an outline, wall_path for partitions, window_row for repeated windows. Code expands coordinates; never repeat recipe-generated elements.",
    "Use the supplied active level. Only create a level when needed. Dimensions are millimetres; use project defaults for routine wall sizes and disclose them.",
    "Shell dimensions are wall-centre spans. Subtract wall thickness from explicit outside spans. Floors and roofs cover exterior faces automatically.",
    "Use apartment_layout for basic apartments and house_layout for villas/houses (variant villa) or two-storey duplexes (variant duplex). Default bedrooms: apartment two, villa three, duplex five; explicit counts win. Use concept defaults for omitted dimensions and proceed without asking; disclose assumptions. A shell alone is not a complete home.",
    "Doors/windows reference a wall, including its recipe prefix. positionMm is centre distance from wall start. Avoid overlaps and keep sill plus opening height below wall height.",
  ],
  example: { summary: "8 by 6 m shell", assumptions: ["Wall-centre spans; project wall defaults."], actions: [
    { kind: "rectangular_shell", id: "shell", levelId: "<active-level-id>", xMm: 0, yMm: 0, widthMm: 8000, depthMm: 6000, thicknessMm: 200, heightMm: 3000, floorThicknessMm: 200 },
  ] },
};
