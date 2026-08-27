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
      case "horizontal":
        for (let y = 8; y < 64; y += 12) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(64, y); ctx.stroke();
        }
        break;

      case "vertical":
        for (let x = 8; x < 64; x += 12) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 64); ctx.stroke();
        }
        break;

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

      case "grid":
      case "tile":
      case "checker": {
        const step = hatchStyle === "tile" ? 16 : 12;
        for (let p = 0; p <= 64; p += step) {
          ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(64, p); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 64); ctx.stroke();
        }
        if (hatchStyle === "checker") {
          ctx.globalAlpha = 0.18;
          ctx.fillStyle = strokeColor;
          for (let y = 0; y < 64; y += step) {
            for (let x = 0; x < 64; x += step) {
              if ((x / step + y / step) % 2 === 0) ctx.fillRect(x, y, step, step);
            }
          }
          ctx.globalAlpha = 1;
        }
        break;
      }

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

      case "sand":
      case "earth": {
        ctx.fillStyle = strokeColor;
        for (let i = 0; i < 36; i++) {
          const x = (i * 29 + 7) % 64;
          const y = (i * 43 + 11) % 64;
          ctx.beginPath();
          ctx.arc(x, y, hatchStyle === "earth" ? 1.8 : 1.1, 0, Math.PI * 2);
          ctx.fill();
          if (hatchStyle === "earth" && i % 3 === 0) {
            ctx.beginPath(); ctx.moveTo(x - 4, y + 3); ctx.lineTo(x + 5, y - 2); ctx.stroke();
          }
        }
        break;
      }

      case "steel":
        for (let i = -64; i < 128; i += 12) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 64, 64); ctx.stroke();
        }
        ctx.lineWidth = 1;
        for (let i = -64; i < 128; i += 24) {
          ctx.beginPath(); ctx.moveTo(i + 64, 0); ctx.lineTo(i, 64); ctx.stroke();
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

      case "reinforced-concrete":
        // 45 degree diagonal hatching + random concrete aggregate stipples/triangles
        ctx.lineWidth = 1.5;
        for (let i = -64; i < 128; i += 16) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + 64, 64);
          ctx.stroke();
        }
        ctx.fillStyle = strokeColor;
        const rcDots = [
          [10, 18, 1.8], [30, 10, 2.2], [48, 22, 1.6],
          [20, 42, 2.4], [38, 48, 1.8], [54, 38, 2.2],
        ];
        for (const [x, y, r] of rcDots) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.moveTo(14, 28); ctx.lineTo(19, 24); ctx.lineTo(17, 31); ctx.closePath();
        ctx.moveTo(42, 14); ctx.lineTo(47, 10); ctx.lineTo(45, 17); ctx.closePath();
        ctx.fill();
        break;

      case "insulation":
        // Standard architectural batt insulation looping curve
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let x = 0; x <= 64; x += 16) {
          ctx.moveTo(x, 0);
          ctx.bezierCurveTo(x + 4, 20, x - 4, 44, x + 8, 64);
          ctx.bezierCurveTo(x + 20, 44, x + 12, 20, x + 16, 0);
        }
        ctx.stroke();
        break;

      case "gypsum":
        // Paired fine diagonal lines (plasterboard / drywall standard)
        ctx.lineWidth = 1.2;
        for (let i = -64; i < 128; i += 24) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 64, 64); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(i + 4, 0); ctx.lineTo(i + 68, 64); ctx.stroke();
        }
        break;

      case "stone":
        // Random rubble masonry stone outlines
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(4, 8); ctx.lineTo(24, 6); ctx.lineTo(28, 22); ctx.lineTo(6, 26); ctx.closePath();
        ctx.moveTo(32, 4); ctx.lineTo(58, 8); ctx.lineTo(62, 24); ctx.lineTo(34, 20); ctx.closePath();
        ctx.moveTo(2, 32); ctx.lineTo(20, 28); ctx.lineTo(26, 46); ctx.lineTo(4, 50); ctx.closePath();
        ctx.moveTo(28, 26); ctx.lineTo(48, 24); ctx.lineTo(52, 44); ctx.lineTo(26, 46); ctx.closePath();
        ctx.moveTo(54, 28); ctx.lineTo(64, 30); ctx.lineTo(64, 48); ctx.lineTo(54, 46); ctx.closePath();
        ctx.moveTo(6, 54); ctx.lineTo(34, 52); ctx.lineTo(32, 64); ctx.lineTo(4, 64); ctx.closePath();
        ctx.moveTo(38, 50); ctx.lineTo(62, 52); ctx.lineTo(60, 64); ctx.lineTo(36, 64); ctx.closePath();
        ctx.stroke();
        break;

      case "timber-cut":
        // Structural lumber cut cross (45° diagonals + growth ring arcs)
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(64, 64);
        ctx.moveTo(64, 0); ctx.lineTo(0, 64);
        ctx.stroke();
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.arc(32, 32, 12, 0, Math.PI * 2);
        ctx.arc(32, 32, 22, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case "glass":
        // Architectural glass triple-slash pattern
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        // Group 1
        ctx.moveTo(12, 4); ctx.lineTo(4, 20);
        ctx.moveTo(18, 4); ctx.lineTo(10, 20);
        ctx.moveTo(24, 4); ctx.lineTo(16, 20);
        // Group 2
        ctx.moveTo(48, 36); ctx.lineTo(40, 52);
        ctx.moveTo(54, 36); ctx.lineTo(46, 52);
        ctx.moveTo(60, 36); ctx.lineTo(52, 52);
        ctx.stroke();
        break;

      case "gravel":
        // Packed pebble aggregate
        ctx.lineWidth = 1.2;
        ctx.fillStyle = strokeColor;
        const pebbles = [
          [12, 14, 4, 3], [28, 10, 5, 4], [46, 16, 4, 3], [58, 8, 3, 3],
          [8, 32, 4, 4], [24, 28, 6, 4], [40, 34, 5, 4], [56, 30, 4, 3],
          [16, 48, 5, 3], [34, 46, 4, 4], [50, 48, 5, 3], [60, 44, 3, 3],
          [8, 60, 3, 3], [24, 60, 4, 3], [42, 58, 5, 4], [58, 60, 4, 3],
        ];
        for (const [cx, cy, rx, ry] of pebbles) {
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, (cx + cy) * 0.1, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;

      case "membrane":
        // Waterproofing membrane barrier (dashed / thick line)
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        for (let y = 10; y < 64; y += 18) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(64, y); ctx.stroke();
        }
        ctx.setLineDash([]);
        break;

      default:
        break;
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
