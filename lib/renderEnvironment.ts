import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import type { RenderSceneSettings } from "@/store/useViewDisplayStore";
import { useMaterialStore } from "@/store/materialStore";
import { getHatchCanvasTexture } from "./hatchPatterns";

export function renderGroundElevation(levels: { id: string; elevationMm: number }[], levelId: string | null, offsetMm: number) {
  const level = levels.find(l => l.id === levelId);
  return ((level?.elevationMm ?? 0) + offsetMm) / 1000;
}

export class RenderEnvironment {
  readonly sky = new Sky();
  readonly ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.95 }));
  private reflection: THREE.WebGLRenderTarget | null = null;
  private skyKey = "";
  private groundKey = "";
  private previousEnvironment: THREE.Scene["environment"];

  constructor(private scene: THREE.Scene, private renderer: THREE.WebGLRenderer) {
    this.previousEnvironment = scene.environment;
    this.sky.name = "render-sky";
    this.sky.scale.setScalar(1000);
    this.sky.raycast = () => {};
    this.ground.name = "render-ground";
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.ground.raycast = () => {};
    scene.add(this.sky, this.ground);
  }

  update(settings: RenderSceneSettings & { renderPreview: boolean; sunAzimuth: number; sunElevation: number; renderPreset: string }, levels: { id: string; elevationMm: number }[]) {
    this.sky.visible = settings.renderPreview && settings.skyEnabled;
    this.ground.visible = settings.renderPreview && settings.groundEnabled;
    this.ground.position.y = renderGroundElevation(levels, settings.groundLevelId, settings.groundOffsetMm);
    this.ground.scale.setScalar(settings.groundSizeM);
    const material = useMaterialStore.getState().getMaterial(settings.groundMaterialId);
    const groundKey = JSON.stringify([settings.groundMaterialId, settings.groundSizeM, material]);
    if (groundKey !== this.groundKey) {
      this.groundKey = groundKey;
      this.ground.material.map?.dispose();
      this.ground.material.map = null;
      this.ground.material.color.set(material?.color ?? "#879574");
      this.ground.material.roughness = material?.roughness ?? 0.95;
      this.ground.material.metalness = material?.metalness ?? 0;
      if (material?.hatchStyle && material.hatchStyle !== "solid") {
        const source = getHatchCanvasTexture(material.hatchStyle, "#4b5147", material.color, material.hatchScaleMm);
        if (source) {
          const texture = source.clone();
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.setScalar(settings.groundSizeM / Math.max(0.1, (material.hatchScaleMm ?? 1000) / 1000));
          texture.needsUpdate = true;
          this.ground.material.map = texture;
          this.ground.material.color.setHex(0xffffff);
        }
      }
      this.ground.material.needsUpdate = true;
    }
    if (!this.sky.visible) {
      this.scene.environment = this.previousEnvironment;
      return;
    }
    const key = `${settings.sunAzimuth}:${settings.sunElevation}:${settings.renderPreset}`;
    if (key !== this.skyKey) {
      this.skyKey = key;
      const uniforms = this.sky.material.uniforms;
      uniforms.turbidity.value = settings.renderPreset === "overcast" ? 18 : 3;
      uniforms.rayleigh.value = settings.renderPreset === "dusk" ? 4 : 2;
      uniforms.mieCoefficient.value = 0.005;
      uniforms.mieDirectionalG.value = 0.8;
      uniforms.sunPosition.value.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - settings.sunElevation), THREE.MathUtils.degToRad(settings.sunAzimuth));
      const environment = new THREE.Scene();
      const clone = this.sky.clone();
      environment.add(clone);
      const generator = new THREE.PMREMGenerator(this.renderer);
      this.reflection?.dispose();
      this.reflection = generator.fromScene(environment, 0.04, 0.1, 2000);
      generator.dispose();
    }
    this.scene.environment = this.reflection?.texture ?? this.previousEnvironment;
  }

  dispose() {
    this.scene.environment = this.previousEnvironment;
    this.scene.remove(this.sky, this.ground);
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.ground.geometry.dispose();
    this.ground.material.map?.dispose();
    this.ground.material.dispose();
    this.reflection?.dispose();
  }
}
