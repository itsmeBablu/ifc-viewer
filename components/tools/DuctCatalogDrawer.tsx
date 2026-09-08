"use client";

import { useState } from "react";
import { LuChevronDown, LuChevronUp } from "react-icons/lu";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";

type CatalogItem = {
  id: string;
  name: string;
  kind: "round" | "rect" | "elbow" | "tee" | "reducer" | "transition" | "cap";
  shape?: "round" | "rectangular" | "oval";
  size?: number;
  width?: number;
  height?: number;
};

const ITEMS: CatalogItem[] = [
  { id: "round-200", name: "Round duct · Ø200 mm", kind: "round", shape: "round", size: 200 },
  { id: "round-315", name: "Round duct · Ø315 mm", kind: "round", shape: "round", size: 315 },
  { id: "rect-300x200", name: "Rectangular · 300 × 200", kind: "rect", shape: "rectangular", width: 300, height: 200 },
  { id: "rect-600x300", name: "Rectangular · 600 × 300", kind: "rect", shape: "rectangular", width: 600, height: 300 },
  { id: "elbow-90", name: "90° elbow", kind: "elbow" },
  { id: "tee", name: "Tee", kind: "tee" },
  { id: "reducer", name: "Reducer", kind: "reducer" },
  { id: "transition", name: "Rect transition", kind: "transition" },
  { id: "cap", name: "End cap", kind: "cap" },
];

function Thumbnail({ kind }: { kind: CatalogItem["kind"] }) {
  if (kind === "round") return <svg viewBox="0 0 120 64" aria-hidden="true"><defs><linearGradient id="duct-round" x1="0" x2="1"><stop stopColor="#38bdf8"/><stop offset="1" stopColor="#0e7490"/></linearGradient></defs><ellipse cx="28" cy="32" rx="14" ry="21" fill="#7dd3fc"/><path d="M28 11h57c12 0 12 42 0 42H28" fill="url(#duct-round)"/><ellipse cx="85" cy="32" rx="14" ry="21" fill="#0c4a6e"/></svg>;
  if (kind === "rect") return <svg viewBox="0 0 120 64" aria-hidden="true"><path d="M14 21 80 10l26 12-65 14Z" fill="#bae6fd"/><path d="M14 21v25l27 13V36Z" fill="#0369a1"/><path d="M41 36 106 22v25L41 59Z" fill="#0284c7"/></svg>;
  if (kind === "elbow") return <svg viewBox="0 0 120 64" aria-hidden="true"><path d="M25 14v25c0 8 6 13 14 13h46" fill="none" stroke="#38bdf8" strokeWidth="15" strokeLinecap="round"/><path d="M25 14v25c0 8 6 13 14 13h46" fill="none" stroke="#075985" strokeWidth="3" strokeLinecap="round"/></svg>;
  if (kind === "tee") return <svg viewBox="0 0 120 64" aria-hidden="true"><path d="M15 32h90M60 10v44" stroke="#38bdf8" strokeWidth="14" strokeLinecap="round"/><path d="M15 32h90M60 10v44" stroke="#075985" strokeWidth="2" strokeLinecap="round"/></svg>;
  if (kind === "reducer") return <svg viewBox="0 0 120 64" aria-hidden="true"><path d="M13 19h25l44 9v8l-44 9H13Z" fill="#38bdf8"/><path d="M82 28h24v8H82Z" fill="#075985"/></svg>;
  if (kind === "transition") return <svg viewBox="0 0 120 64" aria-hidden="true"><path d="M15 16h35l55 12v8L50 48H15Z" fill="#7dd3fc"/><path d="M15 16v32" stroke="#075985" strokeWidth="3"/></svg>;
  return <svg viewBox="0 0 120 64" aria-hidden="true"><ellipse cx="60" cy="32" rx="34" ry="22" fill="#0c4a6e"/><ellipse cx="60" cy="32" rx="25" ry="15" fill="#bae6fd"/></svg>;
}

export default function DuctCatalogDrawer({ onPick }: { onPick?: (item: CatalogItem) => void }) {
  const [open, setOpen] = useState(true);
  const store = useLayoutDrawingStore();
  const pick = (item: CatalogItem) => {
    if (item.shape) store.setDraftDuctShape(item.shape);
    if (item.size) store.setDraftDuctSize(item.size, Math.round(item.size * 0.6), item.size);
    if (item.width && item.height) store.setDraftDuctSize(item.width, item.height, Math.round((item.width + item.height) / 2));
    store.setArmedLayoutTool("duct");
    onPick?.(item);
  };
  return <section className={`duct-catalog-drawer ${open ? "is-open" : "is-collapsed"}`} aria-label="Duct catalog">
    <button type="button" className="duct-catalog-handle" onClick={() => setOpen(value => !value)} aria-expanded={open}><span className="flex items-center gap-1.5"><span className="h-1 w-8 rounded-full bg-sky-300/60" /> Duct catalog</span>{open ? <LuChevronDown /> : <LuChevronUp />}</button>
    {open && <div className="duct-catalog-scroller">{ITEMS.map(item => <button key={item.id} type="button" className="duct-catalog-card" onClick={() => pick(item)} title={`Use ${item.name}`}><Thumbnail kind={item.kind} /><span>{item.name}</span></button>)}</div>}
  </section>;
}
