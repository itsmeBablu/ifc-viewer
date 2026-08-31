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
  scaleMm = 200
): THREE.CanvasTexture | null {
  if (!hatchStyle || hatchStyle === "solid") {
    return null;
  }

  const cacheKey = `${hatchStyle}_${strokeColor}_${bgColor}_${scaleMm}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  if (typeof document === "undefined") {
    const dummy = new THREE.CanvasTexture({} as HTMLCanvasElement);
    return dummy;
  }

  const canvas = document.createElement("canvas");
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // 1. Fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);

    // Subtle micro-surface texture noise
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 14;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    switch (hatchStyle) {
      case "horizontal":
        for (let y = 16; y < size; y += 32) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
        }
        break;

      case "vertical":
        for (let x = 16; x < size; x += 32) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
        }
        break;

      case "diagonal":
        for (let i = -size; i < size * 2; i += 32) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + size, size);
          ctx.stroke();
        }
        break;

      case "cross":
        for (let i = -size; i < size * 2; i += 32) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + size, size); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(i + size, 0); ctx.lineTo(i, size); ctx.stroke();
        }
        break;

      case "grid":
      case "tile":
      case "checker": {
        const step = hatchStyle === "tile" ? 64 : 48;
        // Grout line shadow
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 4;
        for (let p = 0; p <= size; p += step) {
          ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
        }
        // Grout line highlight
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 2;
        for (let p = 2; p <= size; p += step) {
          ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
        }
        if (hatchStyle === "checker") {
          ctx.fillStyle = strokeColor;
          ctx.globalAlpha = 0.22;
          for (let y = 0; y < size; y += step) {
            for (let x = 0; x < size; x += step) {
              if ((x / step + y / step) % 2 === 0) ctx.fillRect(x, y, step, step);
            }
          }
          ctx.globalAlpha = 1;
        }
        break;
      }

      case "brick": {
        // High-definition running bond brickwork with shaded mortar lines
        const rowH = 32;
        const colW = 64;
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 3;
        for (let r = 0; r < size; r += rowH) {
          // Bed joint (horizontal)
          ctx.beginPath();
          ctx.moveTo(0, r);
          ctx.lineTo(size, r);
          ctx.stroke();

          // Head joints (vertical, staggered)
          const offset = (r / rowH) % 2 === 0 ? 0 : colW / 2;
          for (let c = offset; c <= size; c += colW) {
            ctx.beginPath();
            ctx.moveTo(c, r);
            ctx.lineTo(c, r + rowH);
            ctx.stroke();
          }
        }
        // Bevel highlight on bricks
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1.5;
        for (let r = 2; r < size; r += rowH) {
          ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(size, r); ctx.stroke();
        }
        break;
      }

      case "concrete": {
        // Multi-frequency aggregate stone chips + pores
        ctx.fillStyle = strokeColor;
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < 90; i++) {
          const x = (i * 37 + 13) % size;
          const y = (i * 59 + 29) % size;
          const r = 1.2 + ((i * 17) % 4);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        // Small fractured gravel triangles
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        for (let i = 0; i < 24; i++) {
          const x = (i * 47 + 19) % size;
          const y = (i * 73 + 41) % size;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 6, y - 4);
          ctx.lineTo(x + 4, y + 5);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }

      case "wood": {
        // High-definition organic wood grain rings
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 2.5;
        for (let y = 10; y < size; y += 22) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.bezierCurveTo(size * 0.3, y + 14, size * 0.7, y - 12, size, y + 4);
          ctx.stroke();
        }
        // Fine grain fibers
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1;
        for (let y = 5; y < size; y += 11) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.bezierCurveTo(size * 0.25, y + 8, size * 0.75, y - 8, size, y + 2);
          ctx.stroke();
        }
        break;
      }

      case "reinforced-concrete": {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2.5;
        for (let i = -size; i < size * 2; i += 32) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + size, size); ctx.stroke();
        }
        ctx.fillStyle = strokeColor;
        for (let i = 0; i < 40; i++) {
          const x = (i * 43 + 17) % size;
          const y = (i * 67 + 31) % size;
          ctx.beginPath();
          ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case "insulation": {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        for (let x = 0; x <= size; x += 48) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.bezierCurveTo(x + 16, size * 0.35, x - 16, size * 0.65, x + 24, size);
          ctx.bezierCurveTo(x + 64, size * 0.65, x + 32, size * 0.35, x + 48, 0);
          ctx.stroke();
        }
        break;
      }

      case "stone": {
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.lineWidth = 3;
        // Natural ashlar / rubble stones
        const stoneBlocks = [
          [8, 12, 100, 50], [116, 10, 130, 54],
          [6, 70, 70, 56], [82, 72, 90, 52], [178, 70, 70, 56],
          [10, 134, 120, 52], [138, 132, 110, 56],
          [6, 194, 80, 54], [92, 196, 95, 50], [192, 194, 58, 54],
        ];
        for (const [x, y, w, h] of stoneBlocks) {
          ctx.strokeRect(x, y, w, h);
        }
        break;
      }

      default: {
        // Fallback subtle stipple
        ctx.fillStyle = strokeColor;
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < 50; i++) {
          ctx.fillRect((i * 37) % size, (i * 59) % size, 3, 3);
        }
        ctx.globalAlpha = 1;
        break;
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  const repeat = Math.max(0.5, Math.min(50, 1000 / scaleMm));
  texture.repeat.set(repeat, repeat);
  texture.needsUpdate = true;

  textureCache.set(cacheKey, texture);
  return texture;
}
