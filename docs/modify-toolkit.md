# Modify toolkit

Implementation is local and awaits the requested final verification pass. Tests,
production build, and push are intentionally deferred.

## Selection and interaction

The previous selection model stored only an element kind and ID, and its transform
gizmo was attached only to markup meshes. Selection now also carries a transient
geometry reference: world point, mesh and geometry identity, face index, instance
index, and the selected face patch, feature edge, or vertex. Face picking follows
connected coplanar triangles; edge picking suppresses coplanar tessellation
diagonals. The selection-level menu exposes Element, Face, Edge, and Vertex.

Geometric features identify the reference and the part of the target to position.
Move, Align, Rotate, and Mirror transform the owning parametric element or group;
they do not deform arbitrary mesh vertices. Floor/roof boundary deformation uses
the separate boundary editor. Imported IFC source geometry is not modified by
this toolkit.

- Move uses XYZ arrows and the view-plane center handle. Plan and mesh snapping
  apply during dragging; Alt bypasses snapping. Preview transformations are
  restored before committing model data. Escape and pointer cancellation discard
  a drag. Quad views use the active viewport rectangle.
- Align picks the reference first and then target features. A face supplies a
  plane, an edge supplies a supporting line, and a vertex supplies a point. The
  reference remains active for subsequent targets; Escape resets it, then exits.
- Mirror offers Draw Axis (two plan points), Pick Axis (a straight edge), and Copy.
  Polygon holes, equipment handedness, and markup handedness are preserved.
- Split divides straight or curved walls/sketch lines. A wall split migrates
  hosted openings to the correct new wall and rejects a cut through an opening.
- Group takes a name and saves a reusable definition separately from its instance.
  Member selection expands to the group. Move, Rotate, Copy, and Mirror operate on
  its members together. Edit Group restricts edits to members; Finish Group saves
  the updated definition. Ungroup leaves the saved definition available for later
  placement. Group definitions and sketch lines are persisted in IndexedDB.

Level-bound parametric objects retain their modeling constraints: unsupported
tilting is rejected. Doors/windows remain on their host; moving a wall carries its
openings. Grid elevations remain level controlled. Mesh face subdivision and
persistent alignment constraints/padlocks require separate topology and constraint
work. There is no decorative padlock that implies an unenforced constraint.

## Boundary editing

Edit Boundary preserves the existing slab boundary/holes data model. Square
vertices and selectable edges are drawn in plan view. An edge's highlighted
endpoints extend along its supporting line; dragging the edge translates it
parallel to itself. Trim/Extend takes two clicked portions to retain and joins at
the supporting-line intersection if the resulting loop is valid. Insert/remove
vertex tools use the same validation.

All rings must be finite, closed implicitly, nondegenerate, and free of crossings
or self-contact. Holes must be strictly inside the outer ring and disjoint from
each other. Invalid drag samples retain the last valid preview. The slab store
changes on pointer release, so full mesh generation is deferred until drag-end.
Finish persists the session; Cancel restores outer boundary, holes, and roof-edge
settings. The existing polygon-with-holes path is THREE.ExtrudeGeometry →
THREE.ShapeUtils.triangulateShape → Earcut. Pitched roofs without holes retain
their existing specialized mesh path.

## Autodesk references

- [Align Elements](https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Model/files/GUID-9C867721-1970-4ECC-90F1-3C112B9EC2E6.htm): reference-first selection, highlighted geometric parts, multiple targets, and persistent locking.
- [Mirror Elements](https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Model/files/GUID-DF735D0A-A051-43C0-B21B-E8F6CBAFD5C3.htm): pick/draw axis and Copy option.
- [Sketching](https://help.autodesk.com/cloudhelp/2024/ENU/Revit-GetStarted/files/GUID-9D109722-5133-4BBD-813E-428D36005578.htm): Edit Boundary and closed connected loops without overlaps or gaps.
- [Trim and Extend Elements](https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-D9AB5E1D-2D76-4D92-8000-24B78AAF09CC.htm): two-element corner operation and choosing the portions to retain.
