import * as THREE from "three";

/**
 * Creates an enhanced XYZ Coordinate Axes Triad for 3D viewports.
 * - +X axis: Red with arrowhead
 * - +Y axis: Green with arrowhead (Up axis in Three.js coordinate space)
 * - +Z axis: Blue with arrowhead
 * - Soft transparency and reduced length to keep the scene clean and uncluttered.
 */
export function createEnhancedAxes(length = 2.5): THREE.Group {
  const group = new THREE.Group();
  group.name = "3d-axes";

  const headLength = Math.max(0.35, length * 0.2);
  const headWidth = Math.max(0.12, length * 0.08);

  const makeArrow = (dir: THREE.Vector3, colorHex: number) => {
    const arrow = new THREE.ArrowHelper(
      dir,
      new THREE.Vector3(0, 0, 0),
      length,
      colorHex,
      headLength,
      headWidth,
    );
    const lineMat = arrow.line.material as THREE.LineBasicMaterial;
    lineMat.transparent = true;
    lineMat.opacity = 0.55;
    lineMat.depthTest = true;

    const coneMat = arrow.cone.material as THREE.MeshBasicMaterial;
    coneMat.transparent = true;
    coneMat.opacity = 0.65;
    coneMat.depthTest = true;

    return arrow;
  };

  // +X Axis (Red)
  group.add(makeArrow(new THREE.Vector3(1, 0, 0), 0xef4444));

  // +Y Axis (Green - Up)
  group.add(makeArrow(new THREE.Vector3(0, 1, 0), 0x22c55e));

  // +Z Axis (Blue)
  group.add(makeArrow(new THREE.Vector3(0, 0, 1), 0x3b82f6));

  // Subtle transparent negative axes for reference
  const negMat = new THREE.LineDashedMaterial({
    color: 0x94a3b8,
    dashSize: 0.18,
    gapSize: 0.14,
    transparent: true,
    opacity: 0.2,
    depthTest: true,
  });

  for (const dir of [
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, -1),
  ]) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      dir.clone().multiplyScalar(length * 0.35),
    ]);
    const line = new THREE.Line(geo, negMat);
    line.computeLineDistances();
    group.add(line);
  }

  // Origin point
  const originMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 12, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
    }),
  );
  group.add(originMesh);

  // Ensure axes are not clipped by pointer raycasts
  group.traverse((o) => {
    o.raycast = () => undefined;
  });

  return group;
}
