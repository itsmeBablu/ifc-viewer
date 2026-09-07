# Parametric furniture

Furniture already uses `LayoutMepEquipment`, `ComponentProperties`, `createFurniture`, and the existing placement tool. Dining tables and straight kitchen sets extend those paths.

`FurnitureParameters` is the persistent input. `evaluateFurniture` is a pure rule function returning normalized parameters, derived dimensions, and named child placements. `createFurniture` turns those parts into geometry. Generated chairs and cabinets are owned by their assembly; picking them selects the assembly's equipment record. They are not manually maintained child records.

New assemblies have an ordinary named Group instance and saved Group definition containing that owner record. Move, Rotate, Mirror, copy, group placement and history therefore carry the parameters with them. Use Edit Group / finish editing to update a saved definition after changing an instance. Grouping can also accept a single parametric assembly.

Dining rules use 650 mm per seat, above [IKEA's 600 mm minimum](https://www.ikea.com/ch/en/customer-service/knowledge/articles/3gbc7ffd-5023-4c02-bfeb-50d51e204d4g.html). Circular diameter uses chord spacing, with a 900 mm minimum. Rectangular tables allocate long-edge seats and two end seats from four chairs upward. Dimensions are derived; chair dimensions remain ergonomic rather than stretching chairs as the count changes.

The first kitchen assembly has modular base cabinets, a continuous countertop, and optional upper cabinets. Wall placement chooses the front-facing orientation and uses the shared Align face transform to place its back flush to a straight wall. Adjacent same-wall units snap by their widths along the wall direction. Changing a run's width keeps its wall-start end fixed and shifts directly abutting downstream units; wall-end overflow and overlaps are rejected. Independent Move/Rotate operations release the stored wall association.

## Deferred validation

No dev server, tests, build or publish checks were run for this task, per user instruction. The existing Align/Group implementation has not yet passed its deferred runtime checks.

The final pass must cover counts 2–20, odd counts and round/rectangular switching; picking chairs; copy/mirror/undo/reload and saved-group placement; kitchen alignment on rotated walls and opposite wall sides; resize propagation, wall-end rejection and Alt bypass. Two runs meeting at a corner require explicit collision inspection. Automatic corner cabinets, curved-wall fitting, appliance integration and live following of later wall edits are outside this first implementation.
