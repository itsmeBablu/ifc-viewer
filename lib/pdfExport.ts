/**
 * Builds the exported PDF documents (per-floor and presentation pages)
 * from captured viewport images (see pdfCapture.ts), drawing legends,
 * room tables, and mode-specific titles/subtitles via jsPDF/autoTable.
 */
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import {
  legendStopsForMode,
  temperatureLegendStops,
  type ColorPaletteId,
  type CustomLegendColors,
  type LegendColorMode,
} from "@/lib/colorMapping";
import type { DataViewMode } from "@/lib/dataViewMode";
import { supportsCompareBothModes } from "@/lib/dataViewMode";
import type { PageFormat } from "@/lib/presentationLayout";
import type { ColorMode, Room } from "@/lib/types";

export type PdfLegendContext = {
  palette: ColorPaletteId;
  heizlastRange: number[];
  kuhllastRange?: number[];
  luftungRange?: number[];
  temperatureRange: number[];
  customLegendColors?: CustomLegendColors;
};

export type FloorPdfSection = {
  floorName: string;
  rooms: Room[];
  /** Capture: dual load+temp when compare, else single load. */
  dualImage: string | null;
};

export type PresentationPdfImages = {
  dualImage: string | null;
};

export type PdfModeSection = {
  mode: DataViewMode;
  floors: FloorPdfSection[];
  presentation: PresentationPdfImages;
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function sanitizeFilePart(s: string): string {
  return (
    s
      .trim()
      .replace(/[^\w\-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "model"
  );
}

function pageSizeMm(format: PageFormat): [number, number] {
  const map: Record<PageFormat, [number, number]> = {
    a0: [1189, 841],
    a1: [841, 594],
    a2: [594, 420],
    a3: [420, 297],
    a4: [297, 210],
  };
  return map[format] ?? map.a4;
}

function addViewportImage(
  doc: jsPDF,
  dataUrl: string | null,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (dataUrl) {
    try {
      doc.addImage(dataUrl, "PNG", x, y, w, h, undefined, "MEDIUM");
      return;
    } catch {
      // fall through
    }
  }
  doc.setFillColor(245, 246, 248);
  doc.rect(x, y, w, h, "F");
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text("3D viewport could not be captured", x + 4, y + 14);
}

function loadLegendMode(mode: DataViewMode): LegendColorMode {
  if (mode === "kuhllast") return "kuhllast";
  if (mode === "luftung") return "luftung";
  return "heizlast";
}

function loadLegendTitle(mode: DataViewMode): string {
  if (mode === "kuhllast") return "Kühllast W/m²";
  if (mode === "luftung") return "Lüftungswärmeverlust W";
  return "Heizlast W/m²";
}

function loadRangeFor(
  mode: DataViewMode,
  legend: PdfLegendContext,
): number[] {
  if (mode === "kuhllast") return legend.kuhllastRange ?? legend.heizlastRange;
  if (mode === "luftung") return legend.luftungRange ?? legend.heizlastRange;
  return legend.heizlastRange;
}

function floorPageSubtitle(mode: DataViewMode): string {
  if (mode === "kuhllast") return "Kühllast (top) + Temperature (bottom)";
  if (mode === "luftung") return "Lüftungswärmeverlust";
  return "Heizlast (top) + Temperature (bottom)";
}

function presentationSubtitle(mode: DataViewMode): string {
  if (mode === "kuhllast") {
    return "Presentation — Kühllast | Temperature (side by side)";
  }
  if (mode === "luftung") return "Presentation — Lüftung";
  return "Presentation — Heizlast | Temperature (side by side)";
}

/** Compact load or temperature legend in the top-right of an image area. */
function drawLegendTopRight(
  doc: jsPDF,
  imgX: number,
  imgY: number,
  imgW: number,
  kind: "temperature" | DataViewMode,
  legend: PdfLegendContext,
  offsetY = 0,
) {
  const boxW = Math.min(78, imgW * 0.32);
  const pad = 3;
  const x = imgX + imgW - boxW - 4;
  const y = imgY + 4 + offsetY;
  const isTemp = kind === "temperature";

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, boxW, isTemp ? 24 : 22, 1.5, 1.5, "F");
  doc.setDrawColor(220);
  doc.roundedRect(x, y, boxW, isTemp ? 24 : 22, 1.5, 1.5, "S");

  doc.setFontSize(7);
  doc.setTextColor(40);
  doc.text(
    isTemp ? "Temperature °C" : loadLegendTitle(kind),
    x + pad,
    y + 4.5,
  );

  if (isTemp) {
    const chips = temperatureLegendStops(
      legend.palette,
      legend.temperatureRange,
      legend.customLegendColors?.temperature,
    );
    const chipY = y + 7;
    const chipH = 5;
    const gap = 1.2;
    const chipW =
      (boxW - pad * 2 - gap * Math.max(0, chips.length - 1)) /
      Math.max(1, chips.length);
    chips.forEach((s, i) => {
      const cx = x + pad + i * (chipW + gap);
      const [r, g, b] = hexToRgb(s.color);
      doc.setFillColor(r, g, b);
      doc.roundedRect(cx, chipY, chipW, chipH, 0.6, 0.6, "F");
      doc.setFontSize(5);
      doc.setTextColor(40);
      doc.text(`${s.value}°`, cx + chipW / 2, chipY + chipH + 3.2, {
        align: "center",
      });
    });
    return;
  }

  const legendMode = loadLegendMode(kind);
  const stops = legendStopsForMode(
    legendMode,
    legend.palette,
    loadRangeFor(kind, legend),
    legend.customLegendColors?.[legendMode],
  );
  const barY = y + 7;
  const barH = 5;
  const barW = boxW - pad * 2;
  const segW = barW / Math.max(1, stops.length);
  for (let i = 0; i < stops.length; i++) {
    const [r, g, b] = hexToRgb(stops[i].color);
    doc.setFillColor(r, g, b);
    doc.rect(x + pad + i * segW, barY, segW + 0.1, barH, "F");
  }
  doc.setFontSize(5.5);
  doc.setTextColor(70);
  doc.text(String(stops[0]?.value ?? ""), x + pad, barY + barH + 3.5);
  doc.text(
    String(stops[stops.length - 1]?.value ?? ""),
    x + boxW - pad,
    barY + barH + 3.5,
    { align: "right" },
  );
}

function drawModeLegendsTopRight(
  doc: jsPDF,
  imgX: number,
  imgY: number,
  imgW: number,
  mode: DataViewMode,
  legend: PdfLegendContext,
) {
  drawLegendTopRight(doc, imgX, imgY, imgW, mode, legend, 0);
  if (supportsCompareBothModes(mode)) {
    drawLegendTopRight(doc, imgX, imgY, imgW, "temperature", legend, 27);
  }
}

function drawRoomTable(
  doc: jsPDF,
  rooms: Room[],
  startY: number,
  margin: number,
  mode: DataViewMode,
) {
  let head: string[];
  let body: string[][];

  if (mode === "kuhllast") {
    head = [
      "Name",
      "Number",
      "Kühllast (W/m²)",
      "Kühllast (W)",
      "Temperature (°C)",
    ];
    body = rooms.map((r) => [
      r.name || "—",
      r.number || "—",
      Number.isFinite(r.coolLoad) ? r.coolLoad.toFixed(1) : "—",
      r.kuhllast != null && Number.isFinite(r.kuhllast)
        ? String(Math.round(r.kuhllast))
        : "—",
      Number.isFinite(r.temperature) ? String(Math.round(r.temperature)) : "—",
    ]);
  } else if (mode === "luftung") {
    head = [
      "Name",
      "Number",
      "Abluft (m³/h)",
      "Zuluft (m³/h)",
      "Wärmeverlust (W)",
    ];
    body = rooms.map((r) => [
      r.name || "—",
      r.number || "—",
      Number.isFinite(r.ventilation.abluftVolume)
        ? String(Math.round(r.ventilation.abluftVolume))
        : "—",
      Number.isFinite(r.ventilation.zuluftVolume)
        ? String(Math.round(r.ventilation.zuluftVolume))
        : "—",
      Number.isFinite(r.ventilation.ventilationHeatLoss)
        ? String(Math.round(r.ventilation.ventilationHeatLoss))
        : "—",
    ]);
  } else {
    head = [
      "Name",
      "Number",
      "Heizlast (W/m²)",
      "Heizlast (W)",
      "Temperature (°C)",
    ];
    body = rooms.map((r) => [
      r.name || "—",
      r.number || "—",
      Number.isFinite(r.heatLoad) ? r.heatLoad.toFixed(1) : "—",
      r.heizlast != null && Number.isFinite(r.heizlast)
        ? String(Math.round(r.heizlast))
        : "—",
      Number.isFinite(r.temperature) ? String(Math.round(r.temperature)) : "—",
    ]);
  }

  autoTable(doc, {
    startY,
    head: [head],
    body: body.length ? body : [head.map(() => "—")],
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 1.2 },
    headStyles: { fillColor: [40, 40, 48], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 246, 248] },
  });
}

function drawFloorDualPage(
  doc: jsPDF,
  opts: {
    isFirst: boolean;
    modelName: string;
    floorName: string;
    image: string | null;
    rooms: Room[];
    legend: PdfLegendContext;
    dateStr: string;
    mode: DataViewMode;
  },
) {
  if (!opts.isFirst) doc.addPage([297, 210], "landscape");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentW = pageW - margin * 2;

  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text(opts.modelName, margin, margin + 2);
  doc.setFontSize(10);
  doc.setTextColor(50);
  doc.text(
    `${opts.floorName} — ${floorPageSubtitle(opts.mode)}`,
    margin,
    margin + 9,
  );
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`A4 · ${opts.dateStr}`, pageW - margin, margin + 2, {
    align: "right",
  });

  const headerH = 14;
  const tableReserve = Math.min(68, pageH * 0.32);
  const imgY = margin + headerH;
  const imgH = pageH - imgY - margin - tableReserve;
  const imgW = contentW;

  addViewportImage(doc, opts.image, margin, imgY, imgW, imgH);
  drawModeLegendsTopRight(doc, margin, imgY, imgW, opts.mode, opts.legend);

  doc.setFontSize(9);
  doc.setTextColor(40);
  doc.text(`Rooms — ${opts.floorName}`, margin, imgY + imgH + 6);
  drawRoomTable(doc, opts.rooms, imgY + imgH + 8, margin, opts.mode);
}

function drawPresentationDualPage(
  doc: jsPDF,
  opts: {
    isFirst: boolean;
    modelName: string;
    image: string | null;
    legend: PdfLegendContext;
    dateStr: string;
    format: PageFormat;
    mode: DataViewMode;
  },
) {
  const [w, h] = pageSizeMm(opts.format);
  if (!opts.isFirst) doc.addPage([w, h], "landscape");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentW = pageW - margin * 2;

  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text(opts.modelName, margin, margin + 2);
  doc.setFontSize(10);
  doc.setTextColor(50);
  doc.text(presentationSubtitle(opts.mode), margin, margin + 9);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `${opts.format.toUpperCase()} · ${opts.dateStr}`,
    pageW - margin,
    margin + 2,
    { align: "right" },
  );

  const headerH = 14;
  const imgY = margin + headerH;
  const imgH = pageH - imgY - margin;
  const imgW = contentW;
  addViewportImage(doc, opts.image, margin, imgY, imgW, imgH);
  drawModeLegendsTopRight(doc, margin, imgY, imgW, opts.mode, opts.legend);
}

/**
 * Full building report (A4): for each selected mode — floors + presentation.
 * File: {name}_allpages.pdf
 */
export function exportAllPagesPdf(input: {
  modelName: string;
  sections: PdfModeSection[];
  legend: PdfLegendContext;
}): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const title = input.modelName || "IFC Model";
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  let first = true;
  for (const section of input.sections) {
    for (const floor of section.floors) {
      drawFloorDualPage(doc, {
        isFirst: first,
        modelName: title,
        floorName: floor.floorName,
        image: floor.dualImage,
        rooms: floor.rooms,
        legend: input.legend,
        dateStr,
        mode: section.mode,
      });
      first = false;
    }
    drawPresentationDualPage(doc, {
      isFirst: first,
      modelName: title,
      image: section.presentation.dualImage,
      legend: input.legend,
      dateStr,
      format: "a4",
      mode: section.mode,
    });
    first = false;
  }

  const base = sanitizeFilePart(title.replace(/\.ifc$/i, ""));
  doc.save(`${base}_allpages.pdf`);
}

/**
 * Presentation-only PDF for each selected mode at the chosen paper size.
 */
export function exportPresentationPdf(input: {
  modelName: string;
  sections: Array<{ mode: DataViewMode; presentation: PresentationPdfImages }>;
  legend: PdfLegendContext;
  pageFormat: PageFormat;
}): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const title = input.modelName || "IFC Model";
  const format = input.pageFormat ?? "a3";
  const [w, h] = pageSizeMm(format);

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [w, h],
  });

  input.sections.forEach((section, i) => {
    drawPresentationDualPage(doc, {
      isFirst: i === 0,
      modelName: title,
      image: section.presentation.dualImage,
      legend: input.legend,
      dateStr,
      format,
      mode: section.mode,
    });
  });

  const base = sanitizeFilePart(title.replace(/\.ifc$/i, ""));
  doc.save(`${base}_presentation_${format}.pdf`);
}

/** @deprecated — kept for any callers of the old multi-view export. */
export type PdfViewPage = {
  title: string;
  viewportDataUrl: string | null;
  pageFormat?: PageFormat;
};

export type PdfExportInput = {
  views: PdfViewPage[];
  modelName: string;
  rooms: Room[];
  colorMode: ColorMode;
  palette: ColorPaletteId;
  heizlastRange: number[];
  temperatureRange: number[];
  pageFormat?: PageFormat;
  cleanViews?: boolean;
};

export function exportHeizlastPdf(input: PdfExportInput): void {
  const format = input.pageFormat ?? "a4";
  const legend: PdfLegendContext = {
    palette: input.palette,
    heizlastRange: input.heizlastRange,
    temperatureRange: input.temperatureRange,
  };
  const [w, h] = pageSizeMm(format);
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [w, h],
  });
  const dateStr = new Date().toISOString().slice(0, 10);
  const title = input.modelName || "IFC Model";
  const views =
    input.views.length > 0
      ? input.views
      : [{ title: "Current view", viewportDataUrl: null as string | null }];

  views.forEach((v, i) => {
    const pageFormat = v.pageFormat ?? format;
    if (i > 0) {
      const [pw, ph] = pageSizeMm(pageFormat);
      doc.addPage([pw, ph], "landscape");
    }
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 10;
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text(title, margin, margin + 2);
    doc.setFontSize(10);
    doc.setTextColor(50);
    doc.text(v.title || "View", margin, margin + 9);
    const imgY = margin + 14;
    const imgH = pageH - imgY - margin;
    addViewportImage(
      doc,
      v.viewportDataUrl,
      margin,
      imgY,
      pageW - margin * 2,
      imgH,
    );
    const legendKind: DataViewMode | "temperature" =
      input.colorMode === "temperature" ? "temperature" : "heizlast";
    drawLegendTopRight(
      doc,
      margin,
      imgY,
      pageW - margin * 2,
      legendKind,
      legend,
    );
  });

  doc.save(`${sanitizeFilePart(title)}-saved-views-${dateStr}.pdf`);
}
