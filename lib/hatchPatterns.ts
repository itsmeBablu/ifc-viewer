import * as THREE from "three";
import type { HatchStyle } from "@/store/materialStore";

const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Creates or retrieves a cached CanvasTexture with the given architectural hatch pattern.
 */
export function getHatchCanvasTexture(
  hatchStyle: HatchStyle,
  strokeColor = "#3f3f46",
  bgColor = "#ffffff",
  scale = 16
): THREE.CanvasTexture {
  const cacheKey = `${hatchStyle}_${strokeColor}_${bgColor}_${scale}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  if (typeof document === "undefined") {
    // SSR fallback dummy texture
    const dummy = new THREE.CanvasTexture({} as HTMLCanvasElement);
    return dummy;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 64, 64);

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.lineCap = "square";

    switch (hatchStyle) {
      case "diagonal":
        // 45 degree diagonal hatching
        for (let i = -64; i < 128; i += 16) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + 64, 64);
          ctx.stroke();
        }
        break;

      case "cross":
        // Cross-hatch (diagonal in both directions)
        for (let i = -64; i < 128; i += 16) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + 64, 64);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(i + 64, 0);
          ctx.lineTo(i, 64);
          ctx.stroke();
        }
        break;

      case "brick":
        // Running bond brick pattern
        ctx.beginPath();
        // Horizontal bed joints
        ctx.moveTo(0, 16);
        ctx.lineTo(64, 16);
        ctx.moveTo(0, 32);
        ctx.lineTo(64, 32);
        ctx.moveTo(0, 48);
        ctx.lineTo(64, 48);
        ctx.moveTo(0, 64);
        ctx.lineTo(64, 64);

        // Vertical head joints
        ctx.moveTo(16, 0);
        ctx.lineTo(16, 16);
        ctx.moveTo(48, 0);
        ctx.lineTo(48, 16);

        ctx.moveTo(0, 16);
        ctx.lineTo(0, 32);
        ctx.moveTo(32, 16);
        ctx.lineTo(32, 32);
        ctx.moveTo(64, 16);
        ctx.lineTo(64, 32);

        ctx.moveTo(16, 32);
        ctx.lineTo(16, 48);
        ctx.moveTo(48, 32);
        ctx.lineTo(48, 48);

        ctx.moveTo(0, 48);
        ctx.lineTo(0, 64);
        ctx.moveTo(32, 48);
        ctx.lineTo(32, 64);
        ctx.moveTo(64, 48);
        ctx.lineTo(64, 64);
        ctx.stroke();
        break;

      case "concrete":
        // Random aggregate stipple dots + small triangles
        ctx.fillStyle = strokeColor;
        const dots = [
          [8, 12, 2], [24, 6, 3], [44, 18, 2], [56, 8, 1.5],
          [14, 36, 3], [32, 42, 2], [50, 34, 3.5], [60, 46, 2],
          [6, 56, 2], [26, 58, 3], [42, 54, 2], [58, 60, 2.5],
        ];
        for (const [x, y, r] of dots) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        // Small triangles
        ctx.beginPath();
        ctx.moveTo(18, 24); ctx.lineTo(24, 20); ctx.lineTo(22, 28); ctx.closePath();
        ctx.moveTo(38, 12); ctx.lineTo(44, 8); ctx.lineTo(42, 16); ctx.closePath();
        ctx.moveTo(46, 46); ctx.lineTo(52, 42); ctx.lineTo(50, 50); ctx.closePath();
        ctx.fill();
        break;

      case "dots":
        // Regular dot grid
        ctx.fillStyle = strokeColor;
        for (let x = 8; x < 64; x += 16) {
          for (let y = 8; y < 64; y += 16) {
            ctx.beginPath();
            ctx.arc(x, y, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;

      case "zigzag":
        // Insulation zigzag pattern
        ctx.beginPath();
        for (let x = 0; x < 64; x += 16) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x + 8, 32);
          ctx.lineTo(x + 16, 0);
          ctx.moveTo(x + 8, 32);
          ctx.lineTo(x + 16, 64);
          ctx.lineTo(x + 24, 32);
        }
        ctx.stroke();
        break;

      case "wood":
        // Wood grain wavy rings
        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.bezierCurveTo(20, 15, 40, 5, 64, 12);
        ctx.moveTo(0, 26);
        ctx.bezierCurveTo(18, 32, 44, 20, 64, 28);
        ctx.moveTo(0, 42);
        ctx.bezierCurveTo(22, 48, 38, 36, 64, 44);
        ctx.moveTo(0, 56);
        ctx.bezierCurveTo(20, 62, 42, 50, 64, 58);
        ctx.stroke();
        break;

      case "solid":
      default:
        // Plain solid
        break;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(scale, scale);
  texture.needsUpdate = true;

  textureCache.set(cacheKey, texture);
  return texture;
}
