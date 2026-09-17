"use client";

import { useState } from "react";
import type { AiAttachment } from "@/lib/ai/attachments";
import { drawingReferenceSchema, type DrawingReference } from "@/lib/ai/drawing";

type Point = { x: number; y: number };
export default function AiDrawingAttachments({ files, disabled, onPage, onRemove, onReference }: { files: AiAttachment[]; disabled: boolean; onPage: (index: number, page: number) => void; onRemove: (index: number) => void; onReference: (value?: DrawingReference) => void }) {
  const [index, setIndex] = useState(0);
  const [points, setPoints] = useState<Point[]>([]);
  const [length, setLength] = useState("");
  const [area, setArea] = useState("");
  const file = files[index] ?? files[0];
  function reference(nextPoints = points, nextLength = length, nextArea = area, nextIndex = index) {
    const parsed = drawingReferenceSchema.safeParse({ ...(nextArea ? { totalAreaM2: Number(nextArea) } : {}), ...(nextPoints.length === 2 && Number(nextLength) > 0 ? { line: { attachmentIndex: nextIndex, pageNumber: files[nextIndex]?.pageNumber, start: nextPoints[0], end: nextPoints[1], lengthMm: Number(nextLength) * 1000 } } : {}) });
    onReference(parsed.success ? parsed.data : undefined);
  }
  return <section className="ai-drawing-attachments" aria-label="Uploaded plan preview">
    <div className="ai-drawing-tabs">
      {files.map((item, i) => <button type="button" key={`${i}:${item.name}`} disabled={disabled} aria-pressed={index === i} onClick={() => { setIndex(i); setPoints([]); reference([], length, area, i); }}>{item.name}</button>)}
      <button type="button" aria-label={`Remove ${file.name}`} disabled={disabled} onClick={() => onRemove(index)}>×</button>
    </div>
    {file.mimeType === "application/pdf" ? <p className="ai-text-muted">Attach this PDF again to see its page preview.</p> : <div className="ai-drawing-viewport">
      <button type="button" disabled={disabled} className="ai-drawing-canvas" aria-label="Select two reference points on the plan" onClick={e => {
        const rect = e.currentTarget.querySelector("img")!.getBoundingClientRect();
        const point = { x: Math.max(0, Math.min(1, (e.clientX-rect.left)/rect.width)), y: Math.max(0, Math.min(1, (e.clientY-rect.top)/rect.height)) };
        const next = points.length >= 2 ? [point] : [...points, point]; setPoints(next); reference(next);
      }}>
        {/* Keep natural dimensions for normalized reference-point calibration. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:${file.mimeType};base64,${file.data}`} alt={`${file.name}${file.pageNumber ? `, page ${file.pageNumber}` : ""}`} draggable={false} />
        {points.map((point, i) => <span key={i} className="ai-reference-point" style={{ left: `${point.x*100}%`, top: `${point.y*100}%` }}>{i+1}</span>)}
        {points.length === 2 && <svg className="ai-reference-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1={points[0].x*100} y1={points[0].y*100} x2={points[1].x*100} y2={points[1].y*100} vectorEffect="non-scaling-stroke" /></svg>}
      </button>
    </div>}
    {file.sourceMimeType === "application/pdf" && <label className="ai-pdf-page">PDF page <input type="number" aria-label="PDF page" min={1} max={file.pageCount} defaultValue={file.pageNumber} key={`${index}:${file.pageNumber}`} disabled={disabled} onBlur={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= (file.pageCount ?? 1) && n !== file.pageNumber) onPage(index, n); else e.target.value = String(file.pageNumber); }} /> of {file.pageCount} · selected page only</label>}
    <div className="ai-area-fields">
      <label>Known reference length (m)<input type="number" aria-label="Known reference length in metres" min={.01} max={1000} step="any" placeholder="Select 2 points above" value={length} disabled={disabled} onChange={e => { setLength(e.target.value); reference(points, e.target.value); }} /></label>
      <label>Or total internal area (m²)<input type="number" aria-label="Plan total internal area in square metres" min={1} max={100000} step="any" placeholder="e.g. 100" value={area} disabled={disabled} onChange={e => { setArea(e.target.value); reference(points, length, e.target.value); }} /></label>
    </div>
    <p className="ai-text-muted">{points.length === 1 ? "Select the second point on the same measured line." : points.length === 2 ? "Enter the real distance between points 1 and 2." : "Use plan dimensions, mark two points with a known distance, or enter total area. AI will ask if scale is still missing."}</p>
  </section>;
}
