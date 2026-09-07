import * as THREE from "three";

/**
 * Creates an enhanced XYZ Coordinate Axes Triad for 3D viewports.
 * - +X axis: Red with arrowhead
 * - +Y axis: Green with arrowhead (Up axis in Three.js coordinate space)
 * - +Z axis: Blue with arrowhead
 * - -X, -Y, -Z: Subtle dashed extension lines
 * - Origin: White center sphere
 */
export function createEnhancedAxes(length = 6): THREE.Group {
  const group = new THREE.Group();
  group.name = "3d-axes";

  const headLength = Math.max(0.6, length * 0.18);
  const headWidth = Math.max(0.25, length * 0.07);
  const shaftRadius = Math.max(0.04, length * 0.012);

  // +X Axis (Red)
  const xDir = new THREE.Vector3(1, 0, 0);
  const xArrow = new THREE.ArrowHelper(xDir, new THREE.Vector3(0, 0, 0), length, 0xef4444, headLength, headWidth);
  group.add(xArrow);

  // +Y Axis (Green - Up)
  const yDir = new THREE.Vector3(0, 1, 0);
  const yArrow = new THREE.ArrowHelper(yDir, new THREE.Vector3(0, 0, 0), length, 0x22c55e, headLength, headWidth);
  group.add(yArrow);

  // +Z Axis (Blue)
  const zDir = new THREE.Vector3(0, 0, 1);
  const zArrow = new THREE.ArrowHelper(zDir, new THREE.Vector3(0, 0, 0), length, 0x3b82f6, headLength, headWidth);
  group.add(zArrow);

  // Subtle dashed negative axes for complete 3D orientation
  const negMat = new THREE.LineDashedMaterial({
    color: 0x94a3b8,
    dashSize: 0.3,
    gapSize: 0.2,
    transparent: true,
    opacity: 0.45,
  });

  for (const dir of [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1)]) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      dir.clone().multiplyScalar(length * 0.45),
    ]);
    const line = new THREE.Line(geo, negMat);
    line.computeLineDistances();
    group.add(line);
  }

  // Origin sphere marker
  const originMesh = new THREE.Mesh(
    new THREE.SphereGeometry(shaftRadius * 2.5, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.2 })
  );
  group.add(originMesh);

  // Ensure axes are not clipped by pointer raycasts
  group.traverse((o) => {
    o.raycast = () => undefined;
  });

  return group;
}
