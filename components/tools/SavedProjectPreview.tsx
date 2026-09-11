"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as db from "@/lib/layoutDrawingDb";
import { idbListPlacements } from "@/lib/toolMarkupDb";
import { createPlacementMesh } from "@/lib/toolMarkup";
import LayoutSceneLayer from "./LayoutSceneLayer";

/** Yield control back to the browser for one frame before heavy sync work. */
function yieldFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export default function SavedProjectPreview({ projectId }: { projectId: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("Loading 3D preview…");
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    let cleanup = () => {};

    void (async () => {
      // ── 1. Load all project data asynchronously (non-blocking IDB reads)
      const [levels, walls, doors, windows, slabs, columns, beams, stairs, ramps, ducts, pipes, trays, equipment, wires, lines, placements] = await Promise.all([
        db.idbListLevels(projectId), db.idbListWalls(projectId), db.idbListDoors(projectId), db.idbListWindows(projectId), db.idbListSlabs(projectId),
        db.idbListColumns(projectId), db.idbListBeams(projectId), db.idbListStairs(projectId), db.idbListRamps(projectId), db.idbListDucts(projectId),
        db.idbListPipes(projectId), db.idbListCableTrays(projectId), db.idbListMepEquipment(projectId), db.idbListWires(projectId), db.idbListSketchLines(projectId), idbListPlacements(projectId),
      ]);
      if (cancelled) return;

      if (![walls, slabs, columns, beams, stairs, ramps, ducts, pipes, trays, equipment, wires, lines, placements].some(rows => rows.length)) {
        setMessage("No saved 3D geometry. IFC source files need to be uploaded again.");
        return;
      }

      // ── 2. Yield one frame so the browser can process pending UI events
      //       before the heavy synchronous Three.js geometry sync below.
      await yieldFrame();
      if (cancelled) return;

      // ── 3. Set up Three.js renderer (non-blocking from UI perspective)
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      // Canvas starts non-interactive so OrbitControls doesn't steal scroll/click
      // from the project list. Enabled only on intentional hover.
      renderer.domElement.style.pointerEvents = "none";

      element.appendChild(renderer.domElement);
      renderer.domElement.setAttribute("aria-label", "Saved project 3D preview. Drag to orbit, scroll to zoom.");

      const scene = new THREE.Scene();
      const layer = new LayoutSceneLayer();
      scene.add(layer.group, new THREE.HemisphereLight(0xffffff, 0x64748b, 3));
      const light = new THREE.DirectionalLight(0xffffff, 3);
      light.position.set(10, 20, 15);
      scene.add(light);

      const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 10000);
      const controls = new OrbitControls(camera, renderer.domElement);
      // No damping → no need for a continuous rAF update loop.
      controls.enableDamping = false;

      const markup = new THREE.Group();
      scene.add(markup);

      // ── On-demand rendering: only re-render when OrbitControls changes the view.
      let renderScheduled = false;
      const scheduleRender = () => {
        if (renderScheduled) return;
        renderScheduled = true;
        requestAnimationFrame(() => {
          renderScheduled = false;
          if (!cancelled) renderer.render(scene, camera);
        });
      };
      controls.addEventListener("change", scheduleRender);

      const observer = new ResizeObserver(() => {
        const width = element.clientWidth, height = element.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        scheduleRender();
      });

      cleanup = () => {
        observer.disconnect();
        controls.removeEventListener("change", scheduleRender);
        controls.dispose();
        layer.dispose();
        markup.traverse(obj => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) mat.dispose();
          }
        });
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };

      // ── 4. Heavy synchronous geometry sync — runs after the yield above.
      const opts = { activeLevelId: null, showAllLevels: true, fallbackElevMm: 0 };
      layer.sync(levels, walls, doors, windows, slabs, {
        ...opts, selectedWallId: null, selectedDoorId: null, selectedWindowId: null, selectedSlabId: null,
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
      for (const placement of placements) markup.add(createPlacementMesh(placement));

      const bounds = new THREE.Box3().setFromObject(layer.group).union(new THREE.Box3().setFromObject(markup));
      const center = bounds.getCenter(new THREE.Vector3());
      const radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, 0.5);

      camera.aspect = Math.max(1, element.clientWidth) / Math.max(1, element.clientHeight);
      const halfFovRad = THREE.MathUtils.degToRad(camera.fov / 2);
      const angle = Math.min(halfFovRad, Math.atan(Math.tan(halfFovRad) * camera.aspect));
      camera.position.copy(center).add(
        new THREE.Vector3(1, 0.85, 1).normalize().multiplyScalar((radius / Math.sin(angle)) * 1.15),
      );
      camera.near = Math.max(radius / 1000, 0.001);
      camera.far = radius * 1000;
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

    return () => { cancelled = true; cleanup(); };
  }, [projectId]);

  // Toggle canvas pointer-events on deliberate hover so OrbitControls
  // only activates when the user means to interact with the 3D thumbnail.
  const enableInteraction = () => {
    setInteractive(true);
    const canvas = host.current?.querySelector("canvas");
    if (canvas) (canvas as HTMLElement).style.pointerEvents = "auto";
  };
  const disableInteraction = () => {
    setInteractive(false);
    const canvas = host.current?.querySelector("canvas");
    if (canvas) (canvas as HTMLElement).style.pointerEvents = "none";
  };

  return (
    <div
      className="relative min-h-52 overflow-hidden rounded-xl bg-slate-200/40"
      onPointerEnter={enableInteraction}
      onPointerLeave={disableInteraction}
    >
      <div ref={host} className="absolute inset-0" />
      {message ? (
        <p role="status" className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-[var(--text-muted)]">
          {message}
        </p>
      ) : (
        <>
          <span className={`pointer-events-none absolute bottom-2 left-2 text-[9px] transition-opacity duration-200 text-[var(--text-muted)] ${interactive ? "opacity-100" : "opacity-50"}`}>
            3D · Drag to orbit · Scroll to zoom
          </span>
          {!interactive && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/20 px-2 py-1 text-[9px] text-white/70 backdrop-blur-sm">
                Hover to interact
              </span>
            </span>
          )}
        </>
      )}
    </div>
  );
}
