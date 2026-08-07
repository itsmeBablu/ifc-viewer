/**
 * Convert DWG → PDF (ODA File Converter) or vector strokes (LibreDWG).
 * Set ODA_CONVERTER_PATH to the ODA "ODAFileConverter" executable.
 */

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

async function tryOdaToPdf(dwgBytes: Uint8Array, baseName: string): Promise<Buffer | null> {
  const oda =
    process.env.ODA_CONVERTER_PATH?.trim() ||
    process.env.ODA_FILE_CONVERTER?.trim() ||
    "";
  if (!oda) return null;

  const dir = await fs.mkdtemp(path.join(tmpdir(), "ibv-dwg-"));
  try {
    const inFile = path.join(dir, `${baseName}.dwg`);
    const outDir = path.join(dir, "out");
    await fs.mkdir(outDir);
    await fs.writeFile(inFile, dwgBytes);
    // ODAFileConverter "input" "output" "version" "type" "recurse" "audit"
    // type 0 = DWG, 1? — PDF output often needs output filter; many installs use:
    // ODAFileConverter in out ACAD2018 DXF 0 1  — we try PDF via "PDF" filter if available.
    // Documented usage: InputFolder OutputFolder OutputVersion OutputFileType Recurse Audit
    // OutputFileType: DWG, DXF, DXB, PDF (depending on build)
    await execFileAsync(
      oda,
      [dir, outDir, "ACAD2018", "PDF", "0", "1"],
      { timeout: 120_000, windowsHide: true },
    );
    const files = await fs.readdir(outDir);
    const pdfName = files.find((f) => f.toLowerCase().endsWith(".pdf"));
    if (!pdfName) return null;
    return fs.readFile(path.join(outDir, pdfName));
  } catch {
    return null;
  } finally {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

async function libreDwgStrokes(dwgBytes: Uint8Array): Promise<{
  strokes: { points: { x: number; y: number }[] }[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
} | null> {
  try {
    const { LibreDwg, Dwg_File_Type } = await import("@mlightcad/libredwg-web");
    const wasmDir = path.join(
      process.cwd(),
      "node_modules",
      "@mlightcad",
      "libredwg-web",
      "wasm",
    );
    const libredwg = await LibreDwg.create(wasmDir);
    const ab = dwgBytes.buffer.slice(
      dwgBytes.byteOffset,
      dwgBytes.byteOffset + dwgBytes.byteLength,
    ) as ArrayBuffer;
    const ptr = libredwg.dwg_read_data(ab, Dwg_File_Type.DWG);
    if (ptr == null) return null;
    try {
      const db = libredwg.convert(ptr);
      const entities = (db.entities ?? []) as unknown as Array<
        Record<string, unknown>
      >;
      const strokes: { points: { x: number; y: number }[] }[] = [];
      const bounds = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
      };
      const add = (pts: { x: number; y: number }[]) => {
        if (pts.length < 2) return;
        strokes.push({ points: pts });
        for (const p of pts) {
          bounds.minX = Math.min(bounds.minX, p.x);
          bounds.minY = Math.min(bounds.minY, p.y);
          bounds.maxX = Math.max(bounds.maxX, p.x);
          bounds.maxY = Math.max(bounds.maxY, p.y);
        }
      };
      for (const e of entities) {
        const type = String(e.type ?? "");
        if (type === "LINE") {
          const s = e.startPoint as { x: number; y: number };
          const t = e.endPoint as { x: number; y: number };
          if (s && t) add([s, t]);
        } else if (type === "LWPOLYLINE") {
          const verts = e.vertices as { x: number; y: number }[] | undefined;
          if (verts?.length) {
            const pts = [...verts];
            if ((Number(e.flag) & 1) === 1 && pts[0]) pts.push(pts[0]);
            add(pts);
          }
        } else if (type === "CIRCLE") {
          const c = e.center as { x: number; y: number };
          const r = Number(e.radius ?? 0);
          if (c && r > 0) {
            const pts: { x: number; y: number }[] = [];
            for (let i = 0; i <= 48; i++) {
              const a = (i / 48) * Math.PI * 2;
              pts.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
            }
            add(pts);
          }
        }
      }
      if (!strokes.length || !Number.isFinite(bounds.minX)) return null;
      return { strokes, bounds };
    } finally {
      try {
        libredwg.dwg_free(ptr);
      } catch {
        /* ignore */
      }
    }
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_") || "drawing";

  const pdf = await tryOdaToPdf(bytes, base);
  if (pdf) {
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${base}.pdf"`,
      },
    });
  }

  const strokes = await libreDwgStrokes(bytes);
  if (strokes) {
    return NextResponse.json(strokes);
  }

  return NextResponse.json(
    {
      error:
        "DWG conversion failed. Install ODA File Converter and set ODA_CONVERTER_PATH, or rely on client LibreDWG.",
    },
    { status: 501 },
  );
}
