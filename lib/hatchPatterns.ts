import * as THREE from "three";
import type { HatchStyle } from "@/store/materialStore";

const textureCache = new Map<string, THREE.CanvasTexture>();
const svgUriCache = new Map<string, string>();

/**
 * Generates clean, seamless vector SVG markup for architectural hatching patterns.
 */
export function getHatchSvgString(
  hatchStyle: HatchStyle,
  strokeColor = "#3f3f46",
  bgColor = "#ffffff",
  size = 64
): string {
  const stroke = strokeColor || "#3f3f46";
  const bg = bgColor || "#ffffff";

  let innerSvg = "";

  switch (hatchStyle) {
    case "horizontal":
      innerSvg = `
        <line x1="0" y1="${size * 0.25}" x2="${size}" y2="${size * 0.25}" stroke="${stroke}" stroke-width="2" />
        <line x1="0" y1="${size * 0.75}" x2="${size}" y2="${size * 0.75}" stroke="${stroke}" stroke-width="2" />
      `;
      break;

    case "vertical":
      innerSvg = `
        <line x1="${size * 0.25}" y1="0" x2="${size * 0.25}" y2="${size}" stroke="${stroke}" stroke-width="2" />
        <line x1="${size * 0.75}" y1="0" x2="${size * 0.75}" y2="${size}" stroke="${stroke}" stroke-width="2" />
      `;
      break;

    case "diagonal":
      innerSvg = `
        <line x1="0" y1="0" x2="${size}" y2="${size}" stroke="${stroke}" stroke-width="2" />
        <line x1="-${size * 0.5}" y1="${size * 0.5}" x2="${size * 0.5}" y2="${size * 1.5}" stroke="${stroke}" stroke-width="2" />
        <line x1="${size * 0.5}" y1="-${size * 0.5}" x2="${size * 1.5}" y2="${size * 0.5}" stroke="${stroke}" stroke-width="2" />
      `;
      break;

    case "cross":
      innerSvg = `
        <line x1="0" y1="0" x2="${size}" y2="${size}" stroke="${stroke}" stroke-width="2" />
        <line x1="${size}" y1="0" x2="0" y2="${size}" stroke="${stroke}" stroke-width="2" />
      `;
      break;

    case "grid":
    case "tile":
    case "checker":
      innerSvg = `
        <rect x="0" y="0" width="${size}" height="${size}" fill="none" stroke="${stroke}" stroke-width="2" />
      `;
      if (hatchStyle === "checker") {
        innerSvg += `<rect x="0" y="0" width="${size / 2}" height="${size / 2}" fill="${stroke}" fill-opacity="0.3" />`;
        innerSvg += `<rect x="${size / 2}" y="${size / 2}" width="${size / 2}" height="${size / 2}" fill="${stroke}" fill-opacity="0.3" />`;
      }
      break;

    case "brick":
      innerSvg = `
        <line x1="0" y1="0" x2="${size}" y2="0" stroke="${stroke}" stroke-width="2" />
        <line x1="0" y1="${size / 2}" x2="${size}" y2="${size / 2}" stroke="${stroke}" stroke-width="2" />
        <line x1="${size / 2}" y1="0" x2="${size / 2}" y2="${size / 2}" stroke="${stroke}" stroke-width="2" />
        <line x1="0" y1="${size / 2}" x2="0" y2="${size}" stroke="${stroke}" stroke-width="2" />
        <line x1="${size}" y1="${size / 2}" x2="${size}" y2="${size}" stroke="${stroke}" stroke-width="2" />
      `;
      break;

    case "concrete":
    case "reinforced-concrete":
      innerSvg = `
        <circle cx="${size * 0.2}" cy="${size * 0.3}" r="3" fill="${stroke}" fill-opacity="0.6" />
        <circle cx="${size * 0.7}" cy="${size * 0.25}" r="2" fill="${stroke}" fill-opacity="0.6" />
        <circle cx="${size * 0.4}" cy="${size * 0.75}" r="4" fill="${stroke}" fill-opacity="0.6" />
        <circle cx="${size * 0.85}" cy="${size * 0.8}" r="2.5" fill="${stroke}" fill-opacity="0.6" />
        <polygon points="${size * 0.5},${size * 0.1} ${size * 0.58},${size * 0.2} ${size * 0.45},${size * 0.22}" fill="${stroke}" fill-opacity="0.7" />
        <polygon points="${size * 0.15},${size * 0.6} ${size * 0.28},${size * 0.65} ${size * 0.2},${size * 0.75}" fill="${stroke}" fill-opacity="0.7" />
      `;
      if (hatchStyle === "reinforced-concrete") {
        innerSvg += `
          <line x1="0" y1="0" x2="${size}" y2="${size}" stroke="${stroke}" stroke-width="2" stroke-dasharray="4,4" />
        `;
      }
      break;

    case "wood":
      innerSvg = `
        <path d="M 0,${size * 0.2} Q ${size * 0.3},${size * 0.4} ${size},${size * 0.15}" stroke="${stroke}" stroke-width="2" fill="none" />
        <path d="M 0,${size * 0.5} Q ${size * 0.6},${size * 0.3} ${size},${size * 0.6}" stroke="${stroke}" stroke-width="2" fill="none" />
        <path d="M 0,${size * 0.8} Q ${size * 0.4},${size * 0.95} ${size},${size * 0.75}" stroke="${stroke}" stroke-width="2" fill="none" />
      `;
      break;

    case "insulation":
      innerSvg = `
        <path d="M 0,${size / 2} C ${size * 0.25},0 ${size * 0.25},${size} ${size * 0.5},${size / 2} C ${size * 0.75},0 ${size * 0.75},${size} ${size},${size / 2}" stroke="${stroke}" stroke-width="2.5" fill="none" />
      `;
      break;

    case "stone":
      innerSvg = `
        <rect x="2" y="2" width="${size * 0.5 - 4}" height="${size * 0.5 - 4}" fill="none" stroke="${stroke}" stroke-width="2" />
        <rect x="${size * 0.5 + 2}" y="2" width="${size * 0.5 - 4}" height="${size * 0.5 - 4}" fill="none" stroke="${stroke}" stroke-width="2" />
        <rect x="2" y="${size * 0.5 + 2}" width="${size - 4}" height="${size * 0.5 - 4}" fill="none" stroke="${stroke}" stroke-width="2" />
      `;
      break;

    default:
      innerSvg = `
        <circle cx="${size * 0.25}" cy="${size * 0.25}" r="1.5" fill="${stroke}" />
        <circle cx="${size * 0.75}" cy="${size * 0.75}" r="1.5" fill="${stroke}" />
        <circle cx="${size * 0.75}" cy="${size * 0.25}" r="1.5" fill="${stroke}" />
        <circle cx="${size * 0.25}" cy="${size * 0.75}" r="1.5" fill="${stroke}" />
      `;
      break;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${bg}" />
    ${innerSvg}
  </svg>`;
}

/**
 * Returns a SVG Data-URI string for vector background rendering.
 */
export function getHatchSvgDataUri(
  hatchStyle: HatchStyle,
  strokeColor = "#3f3f46",
  bgColor = "#ffffff"
): string {
  const key = `${hatchStyle}_${strokeColor}_${bgColor}`;
  if (svgUriCache.has(key)) return svgUriCache.get(key)!;

  const svgStr = getHatchSvgString(hatchStyle, strokeColor, bgColor);
  const encoded = encodeURIComponent(svgStr);
  const uri = `data:image/svg+xml;charset=utf-8,${encoded}`;
  svgUriCache.set(key, uri);
  return uri;
}

/**
 * Creates or retrieves a cached CanvasTexture with high-DPI vector-rendered architectural hatch patterns.
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
  const size = 512; // High DPI vector render
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // 1. Background fill
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);

    // Micro surface tactile texture
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 8;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    switch (hatchStyle) {
      case "horizontal":
        for (let y = 32; y < size; y += 64) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
        }
        break;

      case "vertical":
        for (let x = 32; x < size; x += 64) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
        }
        break;

      case "diagonal":
        for (let i = -size; i < size * 2; i += 64) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + size, size);
          ctx.stroke();
        }
        break;

      case "cross":
        for (let i = -size; i < size * 2; i += 64) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + size, size); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(i + size, 0); ctx.lineTo(i, size); ctx.stroke();
        }
        break;

      case "grid":
      case "tile":
      case "checker": {
        const step = hatchStyle === "tile" ? 128 : 96;
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 6;
        for (let p = 0; p <= size; p += step) {
          ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
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
        const rowH = 64;
        const colW = 128;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 4;
        for (let r = 0; r < size; r += rowH) {
          ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(size, r); ctx.stroke();
          const offset = (r / rowH) % 2 === 0 ? 0 : colW / 2;
          for (let c = offset; c <= size; c += colW) {
            ctx.beginPath(); ctx.moveTo(c, r); ctx.lineTo(c, r + rowH); ctx.stroke();
          }
        }
        break;
      }

      case "concrete": {
        ctx.fillStyle = strokeColor;
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < 180; i++) {
          const x = (i * 73 + 23) % size;
          const y = (i * 113 + 47) % size;
          const r = 2.0 + ((i * 17) % 6);
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        for (let i = 0; i < 48; i++) {
          const x = (i * 97 + 39) % size;
          const y = (i * 149 + 83) % size;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 12, y - 8);
          ctx.lineTo(x + 8, y + 10);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }

      case "wood": {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 4;
        for (let y = 20; y < size; y += 44) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.bezierCurveTo(size * 0.3, y + 28, size * 0.7, y - 24, size, y + 8);
          ctx.stroke();
        }
        break;
      }

      case "reinforced-concrete": {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 4;
        for (let i = -size; i < size * 2; i += 64) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + size, size); ctx.stroke();
        }
        ctx.fillStyle = strokeColor;
        for (let i = 0; i < 80; i++) {
          const x = (i * 83 + 37) % size;
          const y = (i * 137 + 61) % size;
          ctx.beginPath(); ctx.arc(x, y, 3.5 + (i % 4), 0, Math.PI * 2); ctx.fill();
        }
        break;
      }

      case "insulation": {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 5;
        for (let x = 0; x <= size; x += 96) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.bezierCurveTo(x + 32, size * 0.35, x - 32, size * 0.65, x + 48, size);
          ctx.bezierCurveTo(x + 128, size * 0.65, x + 64, size * 0.35, x + 96, 0);
          ctx.stroke();
        }
        break;
      }

      case "stone": {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 5;
        const stoneBlocks = [
          [16, 24, 200, 100], [232, 20, 260, 108],
          [12, 140, 140, 112], [164, 144, 180, 104], [356, 140, 140, 112],
          [20, 268, 240, 104], [276, 264, 220, 112],
          [12, 388, 160, 108], [184, 392, 190, 100], [384, 388, 116, 108],
        ];
        for (const [x, y, w, h] of stoneBlocks) {
          ctx.strokeRect(x, y, w, h);
        }
        break;
      }

      default: {
        ctx.fillStyle = strokeColor;
        ctx.globalAlpha = 0.4;
        for (let i = 0; i < 100; i++) {
          ctx.fillRect((i * 73) % size, (i * 113) % size, 4, 4);
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
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.needsUpdate = true;

  textureCache.set(cacheKey, texture);
  return texture;
}
