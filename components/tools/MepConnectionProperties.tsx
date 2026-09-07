"use client";
import { useState } from "react";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { endpointPoint, mepMismatch, mepOffset, mepRows, type MepKind, type MepSegment } from "@/lib/mepConnections";

export default function MepConnectionProperties({ kind, row }: { kind: MepKind; row: MepSegment }) {
  const store = useLayoutDrawingStore();
  const [error, setError] = useState<string | null>(null);
  const update = (id: string, patch: { levelId?: string; elevationMm?: number; startConnection?: undefined; endConnection?: undefined }) => kind === "duct" ? store.updateDuct(id, patch) : kind === "pipe" ? store.updatePipe(id, patch) : kind === "wire" ? store.updateWire(id, patch) : store.updateCableTray(id, patch);
  const level = store.levels.find(l => l.id === row.levelId);
  const links = mepRows(kind, store).flatMap(source => (["start", "end"] as const).flatMap(endpoint => {
    const link = source[endpoint === "start" ? "startConnection" : "endConnection"];
    return link && (source.id === row.id || link.id === row.id) ? [{ source, endpoint, link }] : [];
  }));
  return <section className="space-y-2 rounded border border-[var(--panel-divider)] p-2 text-xs">
    <strong>Level & connections</strong>
    <label className="block">Reference level<select className="w-full rounded bg-[var(--surface-overlay)] p-1" value={row.levelId} onChange={e => void update(row.id, { levelId: e.target.value })}>{store.levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
    <label className="block">Center offset above level (mm)<input className="w-full rounded bg-[var(--surface-overlay)] p-1" type="number" value={mepOffset(row)} onChange={e => { if (e.target.value && Number.isFinite(Number(e.target.value))) void update(row.id, { elevationMm: Number(e.target.value) }); }}/></label>
    <p>Absolute center elevation: {(level?.elevationMm ?? 0) + mepOffset(row)} mm</p>
    {!links.length && <p>No segment connections.</p>}
    {links.map(({ source, endpoint, link }) => {
      const target = mepRows(link.kind, store).find(r => r.id === link.id);
      const a = endpointPoint(source, endpoint), b = target && endpointPoint(target, link.endpoint);
      const warning = !target || !b ? "Target no longer exists" : source.levelId !== target.levelId || Math.hypot(a.xMm - b.xMm, a.yMm - b.yMm, mepOffset(source) - mepOffset(target)) > 1 ? "Endpoints no longer meet" : mepMismatch(source, target);
      return <div key={`${source.id}:${endpoint}`} className="flex items-center gap-2"><span className={warning ? "text-amber-600" : "text-[var(--text-muted)]"}>{warning ? `⚠ ${warning}` : `Connected ${endpoint} → ${link.endpoint}`}</span><button className="ml-auto underline" onClick={() => { setError(null); void update(source.id, endpoint === "start" ? { startConnection: undefined } : { endConnection: undefined }).catch(e => setError(String(e))); }}>Disconnect</button></div>;
    })}
    {error && <p role="alert">{error}</p>}
  </section>;
}
