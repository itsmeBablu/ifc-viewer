/**
 * Renders realistic 3ds Max style 3D material preview spheres.
 * Computes PBR lighting (diffuse, Blinn-Phong specular based on roughness & metalness,
 * Fresnel rim reflection, transmission glass transparency, and procedural texture mapping).
 */

import type {
  MaterialDefinition,
  MaterialPreviewShape,
} from "@/store/materialStore";

const sphereCache = new Map<string, string>();

function hexToRgb(hex?: string): { r: number; g: number; b: number } {
  if (!hex || typeof hex !== "string") {
    return { r: 140, g: 140, b: 140 };
  }
  let c = hex.trim().replace(/^#/, "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  if (c.length < 6) c = c.padEnd(6, "8");
  const num = parseInt(c.slice(0, 6), 16);
  if (isNaN(num)) return { r: 140, g: 140, b: 140 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function shadeHex(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const target = amount >= 0 ? 255 : 0;
  const mix = Math.abs(amount);
  const channel = (value: number) =>
    Math.round(value + (target - value) * mix).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function renderMaterialSphere(mat: MaterialDefinition, size = 64): string {
  if (!mat) return "";

  const matId = mat.id || "mat";
  const matColor = mat.color || "#888888";
  const roughness = Math.max(0.04, Math.min(1.0, Number.isFinite(mat.roughness) ? mat.roughness : 0.5));
  const metalness = Math.max(0.0, Math.min(1.0, Number.isFinite(mat.metalness) ? mat.metalness : 0.0));
  const opacity = Math.max(0.1, Math.min(1.0, Number.isFinite(mat.opacity) ? mat.opacity : 1.0));
  const transmission = Math.max(0.0, Math.min(1.0, Number.isFinite(mat.transmission) ? (mat.transmission ?? 0.0) : 0.0));
  const hatchStyle = mat.hatchStyle || "solid";

  const key = `${matId}_${matColor}_${roughness.toFixed(2)}_${metalness.toFixed(2)}_${opacity.toFixed(2)}_${transmission.toFixed(2)}_${hatchStyle}_${size}`;
  if (sphereCache.has(key)) {
    return sphereCache.get(key)!;
  }

  if (typeof document === "undefined") {
    return "";
  }

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const rgb = hexToRgb(matColor);

  // Light vectors (normalized)
  const lx = 0.53, ly = 0.76, lz = 0.38; // Key light from top-right
  const f2x = -0.6, f2y = -0.3, f2z = 0.74; // Fill light

  const radius = size * 0.44;
  const cx = size / 2;
  const cy = size / 2;

  // Specular power based on roughness
  const shininess = Math.max(2, Math.round((1 - roughness) * 128));
  const specStrength = (1 - roughness) * (0.4 + 0.6 * metalness);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = (x + 0.5 - cx) / radius;
      const dy = -(y + 0.5 - cy) / radius;
      const d2 = dx * dx + dy * dy;

      if (d2 <= 1.0) {
        const dz = Math.sqrt(Math.max(0, 1.0 - d2));
        const nx = dx;
        const ny = dy;
        const nz = dz;

        // Spherical UV projection for procedural surface texture
        const u = 0.5 + Math.atan2(nx, nz) / (2 * Math.PI);
        const v = 0.5 - Math.asin(Math.max(-1, Math.min(1, ny))) / Math.PI;

        // Base texture modulation based on hatch style
        let baseR = rgb.r;
        let baseG = rgb.g;
        let baseB = rgb.b;

        if (hatchStyle === "brick") {
          const vScale = 12;
          const uScale = 12;
          const row = Math.floor(v * vScale);
          const uShift = (row % 2) * 0.5;
          const col = Math.floor(u * uScale + uShift);
          const fu = (u * uScale + uShift) - col;
          const fv = (v * vScale) - row;
          const isMortar = fu < 0.1 || fv < 0.15;
          if (isMortar) {
            baseR = 215; baseG = 210; baseB = 200;
          } else {
            const brickRand = Math.sin(col * 13.7 + row * 29.3) * 0.5 + 0.5;
            const tone = 0.88 + 0.24 * brickRand;
            baseR = Math.min(255, rgb.r * tone);
            baseG = Math.min(255, rgb.g * tone);
            baseB = Math.min(255, rgb.b * tone);
          }
        } else if (hatchStyle === "wood" || hatchStyle === "timber-cut") {
          const dist = Math.sqrt((u - 0.5) * (u - 0.5) * 4 + (v - 0.5) * (v - 0.5));
          const grain = Math.sin(dist * 45 + Math.sin(u * 20) * 1.5) * 0.5 + 0.5;
          const tone = 0.78 + 0.35 * grain;
          baseR = Math.min(255, rgb.r * tone);
          baseG = Math.min(255, rgb.g * tone);
          baseB = Math.min(255, rgb.b * tone);
        } else if (hatchStyle === "concrete" || hatchStyle === "reinforced-concrete") {
          const speck = (Math.sin(u * 120) * Math.cos(v * 120) + Math.sin(u * 240 + v * 240)) * 0.5 + 0.5;
          const tone = 0.86 + 0.22 * speck;
          baseR = Math.min(255, rgb.r * tone);
          baseG = Math.min(255, rgb.g * tone);
          baseB = Math.min(255, rgb.b * tone);
        } else if (hatchStyle === "tile" || hatchStyle === "grid") {
          const tu = (u * 10) % 1;
          const tv = (v * 10) % 1;
          const isGrout = tu < 0.08 || tv < 0.08;
          if (isGrout) {
            baseR = 195; baseG = 195; baseB = 195;
          }
        } else if (hatchStyle === "checker") {
          const cu = Math.floor(u * 8) % 2;
          const cv = Math.floor(v * 8) % 2;
          if (cu !== cv) {
            baseR = rgb.r * 0.45; baseG = rgb.g * 0.45; baseB = rgb.b * 0.45;
          }
        } else if (hatchStyle === "stone" || hatchStyle === "gravel") {
          const sNoise = (Math.sin(u * 45) * Math.cos(v * 40) + Math.sin(u * 95 + v * 90)) * 0.5 + 0.5;
          const tone = 0.82 + 0.28 * sNoise;
          baseR = Math.min(255, rgb.r * tone);
          baseG = Math.min(255, rgb.g * tone);
          baseB = Math.min(255, rgb.b * tone);
        } else if (hatchStyle === "dots" || hatchStyle === "sand") {
          const du = (u * 28) % 1 - 0.5;
          const dv = (v * 28) % 1 - 0.5;
          const isDot = (du * du + dv * dv) < 0.06;
          const tone = isDot ? 0.65 : 1.0;
          baseR = rgb.r * tone; baseG = rgb.g * tone; baseB = rgb.b * tone;
        } else if (hatchStyle === "steel") {
          const brush = Math.sin(v * 140) * 0.12 + 0.94;
          baseR = rgb.r * brush; baseG = rgb.g * brush; baseB = rgb.b * brush;
        }

        // Diffuse Lambertian
        const nDotL = Math.max(0, nx * lx + ny * ly + nz * lz);
        const nDotF2 = Math.max(0, nx * f2x + ny * f2y + nz * f2z) * 0.3;

        // Specular Half-vector
        const hx = lx, hy = ly, hz = lz + 1.0;
        const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz);
        const nDotH = Math.max(0, (nx * hx + ny * hy + nz * hz) / hLen);
        const spec = Math.pow(nDotH, shininess) * specStrength;

        // Fresnel term
        const fresnel = Math.pow(1.0 - nz, 3.5) * (0.2 + 0.8 * (1 - roughness));

        // Ambient + Diffuse base
        const ambient = 0.22 + 0.08 * (1 - metalness);
        let diffuse = nDotL * 0.75 + nDotF2;

        if (transmission > 0.3) {
          diffuse = diffuse * (1.0 - transmission * 0.7) + 0.1;
        }

        // Color computation
        let r = baseR * (ambient + diffuse * (1 - metalness * 0.8));
        let g = baseG * (ambient + diffuse * (1 - metalness * 0.8));
        let b = baseB * (ambient + diffuse * (1 - metalness * 0.8));

        // Specular highlight tint (metallic reflects base color, dielectric reflects white)
        const specR = metalness > 0.5 ? baseR * 0.7 + 255 * 0.3 : 255;
        const specG = metalness > 0.5 ? baseG * 0.7 + 255 * 0.3 : 255;
        const specB = metalness > 0.5 ? baseB * 0.7 + 255 * 0.3 : 255;

        r += spec * specR + fresnel * 120;
        g += spec * specG + fresnel * 120;
        b += spec * specB + fresnel * 120;

        // Rim shadow (ambient occlusion on sphere perimeter)
        const rimAo = Math.pow(dz, 0.25);
        r *= rimAo;
        g *= rimAo;
        b *= rimAo;

        // Edge antialiasing
        const edgeDist = Math.sqrt(d2);
        const aa = edgeDist > 0.92 ? (1.0 - edgeDist) / 0.08 : 1.0;

        data[idx] = Math.min(255, Math.max(0, Math.round(r)));
        data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
        data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
        data[idx + 3] = Math.round(Math.min(255, (transmission > 0 ? opacity * 0.85 + 0.15 : opacity) * 255 * aa));
      } else if (d2 < 1.15 && y > size * 0.6) {
        // Drop shadow under sphere
        const shadowAlpha = Math.max(0, (1.15 - d2) / 0.15) * 0.25 * ((y - size * 0.6) / (size * 0.4));
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = Math.round(shadowAlpha * 255);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const dataUrl = canvas.toDataURL();
  sphereCache.set(key, dataUrl);
  return dataUrl;
}

export function renderMaterialPreview(
  mat: MaterialDefinition,
  shape: MaterialPreviewShape,
  size = 128,
): string {
  if (!mat) return "";
  if (shape === "sphere") return renderMaterialSphere(mat, size);
  if (typeof document === "undefined") return "";

  const base = mat.color || "#888888";
  const key = `preview_${shape}_${mat.id}_${base}_${mat.roughness}_${mat.metalness}_${mat.opacity}_${mat.hatchStyle}_${size}`;
  const cached = sphereCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const gloss = Math.round((1 - (mat.roughness ?? 0.5)) * 75);
  ctx.clearRect(0, 0, size, size);
  ctx.shadowColor = "rgba(0,0,0,.5)";
  ctx.shadowBlur = size * 0.08;
  ctx.shadowOffsetY = size * 0.04;

  if (shape === "cube") {
    const x = size * 0.2, y = size * 0.2, w = size * 0.52, h = size * 0.56;
    ctx.fillStyle = base;
    ctx.fillRect(x, y + size * 0.12, w, h);
    ctx.fillStyle = shadeHex(base, 0.28);
    ctx.beginPath(); ctx.moveTo(x, y + size * 0.12); ctx.lineTo(x + size * 0.17, y); ctx.lineTo(x + w + size * 0.17, y); ctx.lineTo(x + w, y + size * 0.12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shadeHex(base, -0.28);
    ctx.beginPath(); ctx.moveTo(x + w, y + size * 0.12); ctx.lineTo(x + w + size * 0.17, y); ctx.lineTo(x + w + size * 0.17, y + h); ctx.lineTo(x + w, y + h + size * 0.12); ctx.closePath(); ctx.fill();
  } else if (shape === "cylinder") {
    const x = size * 0.22, y = size * 0.16, w = size * 0.56, h = size * 0.66;
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, shadeHex(base, -0.42));
    grad.addColorStop(0.45, shadeHex(base, 0.25 + gloss / 300));
    grad.addColorStop(1, shadeHex(base, -0.38));
    ctx.fillStyle = grad; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = shadeHex(base, 0.28);
    ctx.beginPath(); ctx.ellipse(x + w / 2, y, w / 2, size * 0.11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shadeHex(base, -0.38);
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h, w / 2, size * 0.1, 0, 0, Math.PI); ctx.fill();
  } else {
    const pad = size * 0.16;
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.moveTo(pad, pad * 1.2);
    ctx.bezierCurveTo(size * 0.38, pad * 0.5, size * 0.55, pad * 1.8, size - pad, pad);
    ctx.lineTo(size - pad, size - pad);
    ctx.bezierCurveTo(size * 0.62, size - pad * 0.4, size * 0.42, size - pad * 1.5, pad, size - pad * 0.7);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "#fff";
    for (let py = pad; py < size - pad; py += 6) {
      ctx.beginPath(); ctx.moveTo(pad, py); ctx.lineTo(size - pad, py + Math.sin(py) * 3); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  const url = canvas.toDataURL();
  sphereCache.set(key, url);
  return url;
}
