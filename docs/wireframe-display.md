# Feature-edge wireframe

Wireframe draws `EdgesGeometry` lines and temporarily suppresses mesh materials during rendering. It does not enable material triangle wireframe. Surface visibility is restored after rendering so selection and other visual styles retain their existing behavior.

The shared path covers layout, markup and IFC meshes, including instances, quad viewports and viewport image capture. Geometry is cached until its identity or position/index version changes. Existing shaded edge overlays are temporarily hidden to avoid duplicate outlines.

Layout walls supply a single outer-envelope geometry with the same opening cuts as their solid meshes. This avoids exposing internal construction-layer interfaces. Opening perimeters remain geometric feature edges.

The initial crease threshold is 12 degrees. Runtime and visual validation are deferred by user instruction. The final pass must inspect a plain wall (12 box edges), a wall with a door and window (outer edges plus opening perimeters), slabs, pitched roofs, and rounded MEP geometry. Compare thresholds on curved geometry before deciding whether any family needs a different value. Smooth view-dependent silhouettes are distinct from crease edges and are not synthesized by this implementation.

References:

- [Autodesk: Wireframe visual style](https://help.autodesk.com/cloudhelp/2020/ENU/RevitLT-DocumentPresent/files/GUID-C4F70AAA-2F1C-428B-B5BD-EA2562039C42.htm)
- [Three.js: EdgesGeometry](https://threejs.org/docs/pages/EdgesGeometry.html)
