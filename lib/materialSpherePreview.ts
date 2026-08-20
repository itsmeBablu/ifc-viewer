/**
 * Renders realistic 3ds Max style 3D material preview spheres.
 * Computes PBR lighting (diffuse, Blinn-Phong specular based on roughness & metalness,
 * Fresnel rim reflection, and transmission glass transparency).
 */

import type {
  MaterialDefinition,
  MaterialPreviewShape,
} from "@/store/materialStore";

const sphereCache = new Map<string, string>();

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const num = parseInt(c, 16);
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

export function renderMaterialSphere(mat: MaterialDefinition, size = 48): string {
  const key = `${mat.id}_${mat.color}_${mat.roughness}_${mat.metalness}_${mat.opacity}_${mat.transmission}_${size}`;
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

  const rgb = hexToRgb(mat.color || "#888888");
  const roughness = Math.max(0.04, Math.min(1.0, mat.roughness));
  const metalness = Math.max(0.0, Math.min(1.0, mat.metalness));
  const opacity = Math.max(0.1, Math.min(1.0, mat.opacity));
  const transmission = Math.max(0.0, Math.min(1.0, mat.transmission ?? 0.0));

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
        const ambient = 0.18 + 0.08 * (1 - metalness);
        let diffuse = nDotL * 0.75 + nDotF2;

        if (transmission > 0.3) {
          diffuse = diffuse * (1.0 - transmission * 0.7) + 0.1;
        }

        // Color computation
        let r = rgb.r * (ambient + diffuse * (1 - metalness * 0.8));
        let g = rgb.g * (ambient + diffuse * (1 - metalness * 0.8));
        let b = rgb.b * (ambient + diffuse * (1 - metalness * 0.8));

        // Specular highlight tint (metallic reflects base color, dielectric reflects white)
        const specR = metalness > 0.5 ? rgb.r * 0.7 + 255 * 0.3 : 255;
        const specG = metalness > 0.5 ? rgb.g * 0.7 + 255 * 0.3 : 255;
        const specB = metalness > 0.5 ? rgb.b * 0.7 + 255 * 0.3 : 255;

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
  size = 160,
): string {
  if (shape === "sphere") return renderMaterialSphere(mat, size);
  if (typeof document === "undefined") return "";
  const key = `preview_${shape}_${mat.id}_${mat.color}_${mat.roughness}_${mat.metalness}_${mat.opacity}_${mat.hatchStyle}_${size}`;
  const cached = sphereCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const base = mat.color || "#888888";
  const gloss = Math.round((1 - mat.roughness) * 75);
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
    for (let y = pad; y < size - pad; y += 6) {
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(size - pad, y + Math.sin(y) * 3); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  const url = canvas.toDataURL();
  sphereCache.set(key, url);
  return url;
}
