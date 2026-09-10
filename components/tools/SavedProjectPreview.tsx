"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { LuRotateCcw, LuBox, LuArrowDown } from "react-icons/lu";
import * as db from "@/lib/layoutDrawingDb";
import { idbListPlacements } from "@/lib/toolMarkupDb";
import { createPlacementMesh } from "@/lib/toolMarkup";
import LayoutSceneLayer from "./LayoutSceneLayer";

export default function SavedProjectPreview({
  projectId,
  isModal = false,
  className = "",
}: {
  projectId: string;
  isModal?: boolean;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("Loading 3D model…");
  const [interactive, setInteractive] = useState(isModal);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const boundsRef = useRef<{ center: THREE.Vector3; radius: number } | null>(null);
  const scheduleRenderRef = useRef<() => void>(() => {});

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    let cleanup = () => {};

    void (async () => {
      const [
        levels, walls, doors, windows, slabs, columns, beams, stairs, ramps,
        ducts, pipes, trays, equipment, wires, lines, placements,
      ] = await Promise.all([
        db.idbListLevels(projectId),
        db.idbListWalls(projectId),
        db.idbListDoors(projectId),
        db.idbListWindows(projectId),
        db.idbListSlabs(projectId),
        db.idbListColumns(projectId),
        db.idbListBeams(projectId),
        db.idbListStairs(projectId),
        db.idbListRamps(projectId),
        db.idbListDucts(projectId),
        db.idbListPipes(projectId),
        db.idbListCableTrays(projectId),
        db.idbListMepEquipment(projectId),
        db.idbListWires(projectId),
        db.idbListSketchLines(projectId),
        idbListPlacements(projectId),
      ]);

      if (cancelled) return;

      const hasElements = [
        walls, slabs, columns, beams, stairs, ramps, ducts,
        pipes, trays, equipment, wires, lines, placements,
      ].some((rows) => rows.length > 0);

      if (!hasElements) {
        setMessage("No saved 3D geometry found for this project.");
        return;
      }

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;

      // When in modal, events are active immediately; otherwise passive until hovered
      renderer.domElement.style.pointerEvents = isModal ? "auto" : "none";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";

      element.appendChild(renderer.domElement);
      renderer.domElement.setAttribute("aria-label", "3D CAD model preview. Drag to orbit, scroll to zoom.");

      const scene = new THREE.Scene();
      const layer = new LayoutSceneLayer();
      scene.add(layer.group);

      // Balanced lighting
      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 2.2);
      scene.add(hemiLight);

      const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.0);
      dirLight1.position.set(25, 45, 30);
      scene.add(dirLight1);

      const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 1.0);
      dirLight2.position.set(-20, 20, -25);
      scene.add(dirLight2);

      const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 5000);
      cameraRef.current = camera;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = false;
      controls.screenSpacePanning = true;
      controlsRef.current = controls;

      const markup = new THREE.Group();
      scene.add(markup);

      // On-demand rendering: only render when controls change or size changes
      let renderScheduled = false;
      const scheduleRender = () => {
        if (renderScheduled) return;
        renderScheduled = true;
        requestAnimationFrame(() => {
          renderScheduled = false;
          if (!cancelled) renderer.render(scene, camera);
        });
      };
      scheduleRenderRef.current = scheduleRender;
      controls.addEventListener("change", scheduleRender);

      let lastW = 0;
      let lastH = 0;
      const observer = new ResizeObserver(() => {
        const width = element.clientWidth;
        const height = element.clientHeight;
        if (!width || !height) return;
        if (Math.abs(width - lastW) < 2 && Math.abs(height - lastH) < 2) return;
        lastW = width;
        lastH = height;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        scheduleRender();
      });

      cleanup = () => {
        observer.disconnect();
        controls.removeEventListener("change", scheduleRender);
        controls.dispose();
        layer.dispose();
        markup.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of mats) m.dispose();
          }
        });
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
        cameraRef.current = null;
        controlsRef.current = null;
        boundsRef.current = null;
      };

      // Populate layout scene layer with project elements
      const opts = { activeLevelId: null, showAllLevels: true, fallbackElevMm: 0 };
      layer.sync(levels, walls, doors, windows, slabs, {
        ...opts,
        selectedWallId: null,
        selectedDoorId: null,
        selectedWindowId: null,
        selectedSlabId: null,
      });
      layer.syncColumns(columns, levels, { ...opts, selectedColumnIds: new Set() });
      layer.syncBeams(beams, levels, { ...opts, selectedBeamIds: new Set() });
      layer.syncStairs(stairs, levels, { ...opts, selectedStairIds: new Set() });
      layer.syncRamps(ramps, levels, { ...opts, selectedRampIds: new Set() });
      layer.syncDucts(ducts, levels, { ...opts, selectedDuctIds: new Set() });
      layer.syncPipes(pipes, levels, { ...opts, selectedPipeIds: new Set() });
      layer.syncCableTrays(trays, levels, { ...opts, selectedCableTrayIds: new Set() });
      layer.syncMepEquipment(equipment, levels, { ...opts, selectedEquipmentIds: new Set() });
      layer.syncWires(wires, levels, { ...opts, selectedWireIds: new Set() });
      layer.syncSketch(lines, null, [], levels);

      const sketch = layer.group.getObjectByName("layout-sketch-lines");
      if (sketch) sketch.visible = true;

      for (const placement of placements) {
        markup.add(createPlacementMesh(placement));
      }

      // Compute bounding box and initial camera view
      const bounds = new THREE.Box3().setFromObject(layer.group).union(new THREE.Box3().setFromObject(markup));
      const center = bounds.isEmpty() ? new THREE.Vector3(0, 0, 0) : bounds.getCenter(new THREE.Vector3());
      const size = bounds.isEmpty() ? new THREE.Vector3(10, 10, 10) : bounds.getSize(new THREE.Vector3());
      const radius = Math.max(size.length() / 2, 1.0);
      boundsRef.current = { center, radius };

      const initW = Math.max(element.clientWidth || 320, 100);
      const initH = Math.max(element.clientHeight || 240, 100);
      renderer.setSize(initW, initH, false);
      camera.aspect = initW / initH;
      camera.near = Math.max(radius / 1000, 0.01);
      camera.far = Math.max(radius * 1000, 10000);

      // Position camera in attractive isometric 3D angle
      const isoOffset = new THREE.Vector3(1, 0.85, 1.1).normalize().multiplyScalar(radius * 2.3);
      camera.position.copy(center).add(isoOffset);
      camera.updateProjectionMatrix();

      controls.target.copy(center);
      controls.update();

      observer.observe(element);
      scheduleRender();
      setMessage("");
    })().catch(() => {
      cleanup();
      if (!cancelled) setMessage("3D preview could not be loaded.");
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [projectId, isModal]);

  const handlePointerEnter = () => {
    if (isModal) return;
    setInteractive(true);
    const canvas = host.current?.querySelector("canvas");
    if (canvas) (canvas as HTMLElement).style.pointerEvents = "auto";
  };

  const handlePointerLeave = () => {
    if (isModal) return;
    setInteractive(false);
    const canvas = host.current?.querySelector("canvas");
    if (canvas) (canvas as HTMLElement).style.pointerEvents = "none";
  };

  const setViewIsometric = () => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    const b = boundsRef.current;
    if (!cam || !ctrl || !b) return;
    const offset = new THREE.Vector3(1, 0.85, 1.1).normalize().multiplyScalar(b.radius * 2.3);
    cam.position.copy(b.center).add(offset);
    ctrl.target.copy(b.center);
    ctrl.update();
    scheduleRenderRef.current();
  };

  const setViewTop = () => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    const b = boundsRef.current;
    if (!cam || !ctrl || !b) return;
    cam.position.set(b.center.x, b.center.y + b.radius * 2.5, b.center.z + 0.001);
    ctrl.target.copy(b.center);
    ctrl.update();
    scheduleRenderRef.current();
  };

  const resetView = () => {
    setViewIsometric();
  };

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <div ref={host} className="absolute inset-0 h-full w-full" />

      {message ? (
        <div className="absolute inset-0 grid place-items-center bg-slate-900/10 p-4 text-center">
          <div className="rounded-2xl border border-white/20 bg-white/40 px-5 py-3.5 backdrop-blur-md dark:bg-black/40">
            <p className="text-xs font-medium text-[var(--text-strong)]">{message}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Camera preset buttons overlay */}
          <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/70 p-1 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-black/50">
            <button
              type="button"
              onClick={setViewIsometric}
              title="Isometric 3D View"
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-[var(--text-strong)] transition hover:bg-white/80 dark:hover:bg-white/15"
            >
              <LuBox className="size-3.5 text-amber-600 dark:text-amber-400" />
              <span>3D</span>
            </button>
            <button
              type="button"
              onClick={setViewTop}
              title="Top 2D Plan View"
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-[var(--text-strong)] transition hover:bg-white/80 dark:hover:bg-white/15"
            >
              <LuArrowDown className="size-3.5 text-sky-600 dark:text-sky-400" />
              <span>Top</span>
            </button>
            <button
              type="button"
              onClick={resetView}
              title="Reset Camera"
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-[var(--text-strong)] transition hover:bg-white/80 dark:hover:bg-white/15"
            >
              <LuRotateCcw className="size-3 text-slate-500" />
              <span>Reset</span>
            </button>
          </div>

          {!isModal && !interactive && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/30 px-3 py-1 text-[10px] font-medium text-white/90 shadow-sm backdrop-blur-sm">
                Hover to interact in 3D
              </span>
            </span>
          )}

          <span
            className={`pointer-events-none absolute bottom-2 left-3 text-[10px] font-medium transition-opacity duration-200 ${
              interactive || isModal ? "opacity-90" : "opacity-40"
            } text-[var(--text-muted)]`}
          >
            Left-drag to orbit · Right-drag to pan · Scroll to zoom
          </span>
        </>
      )}
    </div>
  );
}
