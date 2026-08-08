"use client";

/**
 * AmbientViewport — lightweight empty Three.js scene for the welcome screen.
 * Orbit/pan/zoom only; ground grid + XYZ axes — no model or tool systems.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ColorTheme } from "@/lib/themeColors";
import { resolveSceneBackground } from "@/lib/sceneSky";
import {
  getWelcomeAmbientBackground,
  getWelcomeAmbientLighting,
} from "@/lib/seasonalAmbient";

type Props = {
  colorTheme: ColorTheme;
  seasonalOn: boolean;
  className?: string;
};

type SceneBundle = {
  scene: THREE.Scene;
  hemi: THREE.HemisphereLight;
  ambient: THREE.AmbientLight;
  grid: THREE.GridHelper;
  axes: THREE.AxesHelper;
  disposeBg: () => void;
};

function gridLineColors(theme: ColorTheme): [number, number] {
  return theme === "dark" ? [0x5a6070, 0x3d4452] : [0xa8adb8, 0xc8cdd6];
}

function applyGridColors(grid: THREE.GridHelper, theme: ColorTheme) {
  const [center, cell] = gridLineColors(theme);
  const mats = Array.isArray(grid.material) ? grid.material : [grid.material];
  if (mats[0]) mats[0].color.setHex(center);
  if (mats[1]) mats[1].color.setHex(cell);
}

/** Frame the ground grid to the panel aspect ratio with comfortable padding. */
function fitAmbientCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  width: number,
  height: number,
) {
  const aspect = width / Math.max(height, 1);
  const gridHalf = 20;
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const distV = gridHalf / Math.tan(vFov / 2);
  const distH = gridHalf / Math.tan(hFov / 2);
  const distance = Math.max(distV, distH) * 1.08;

  const elevation = 0.32;
  const azimuth = Math.PI / 4;
  const target = new THREE.Vector3(0, 0, 0);
  const horizontal = distance * Math.cos(elevation);

  camera.position.set(
    horizontal * Math.cos(azimuth),
    distance * Math.sin(elevation),
    horizontal * Math.sin(azimuth),
  );
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  camera.lookAt(target);

  controls.target.copy(target);
  controls.minDistance = distance * 0.4;
  controls.maxDistance = distance * 2.4;
  controls.update();
}

function applyAmbientLook(
  bundle: SceneBundle,
  theme: ColorTheme,
  seasonalOn: boolean,
) {
  bundle.disposeBg();

  const bgValue = getWelcomeAmbientBackground(theme, seasonalOn);
  const lighting = getWelcomeAmbientLighting(theme, seasonalOn);
  const bg = resolveSceneBackground(bgValue);

  if (bg instanceof THREE.CanvasTexture) {
    bundle.scene.background = bg;
    bundle.disposeBg = () => bg.dispose();
  } else {
    bundle.scene.background = bg;
    bundle.disposeBg = () => {};
  }

  bundle.hemi.color.setHex(lighting.hemisphereSky);
  bundle.hemi.groundColor.setHex(lighting.hemisphereGround);
  bundle.hemi.intensity = lighting.hemisphereIntensity;
  bundle.ambient.color.setHex(lighting.ambientColor);
  bundle.ambient.intensity = lighting.ambientIntensity;
  applyGridColors(bundle.grid, theme);
}

export default function AmbientViewport({
  colorTheme,
  seasonalOn,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bundleRef = useRef<SceneBundle | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    container.appendChild(canvas);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    controls.update();

    const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 0.5);
    scene.add(hemi);
    const ambient = new THREE.AmbientLight(0xffffff, 0.32);
    scene.add(ambient);

    const [gridCenter, gridCell] = gridLineColors(colorTheme);
    const grid = new THREE.GridHelper(40, 40, gridCenter, gridCell);
    const gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
    for (const m of gridMats) {
      m.transparent = true;
      m.opacity = 0.55;
    }

    const helpers = new THREE.Group();
    helpers.name = "ambient-helpers";
    helpers.add(grid);
    const axes = new THREE.AxesHelper(4);
    helpers.add(axes);
    scene.add(helpers);

    const bundle: SceneBundle = {
      scene,
      hemi,
      ambient,
      grid,
      axes,
      disposeBg: () => {},
    };
    bundleRef.current = bundle;
    applyAmbientLook(bundle, colorTheme, seasonalOn);

    let lastFitAspect = 0;

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w < 1 || h < 1) return;
      renderer.setSize(w, h, false);
      const aspect = w / h;
      if (lastFitAspect === 0 || Math.abs(aspect - lastFitAspect) > 0.12) {
        fitAmbientCamera(camera, controls, w, h);
        lastFitAspect = aspect;
      } else {
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      bundle.disposeBg();
      grid.geometry.dispose();
      for (const m of gridMats) m.dispose();
      axes.geometry.dispose();
      if (axes.material instanceof THREE.Material) {
        axes.material.dispose();
      }
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      bundleRef.current = null;
    };
    // Mount once — prop updates handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const bundle = bundleRef.current;
    if (!bundle) return;
    applyAmbientLook(bundle, colorTheme, seasonalOn);
  }, [colorTheme, seasonalOn]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full min-h-0 w-full overflow-hidden bg-[var(--scene-bg)] ${className}`}
      aria-hidden
    />
  );
}
