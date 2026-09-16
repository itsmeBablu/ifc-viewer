"use client";
import type { AiContext, AiPlan } from "@/lib/ai/schema";

export default function AiPlanPreview({ plan, context }: { plan: AiPlan; context: AiContext }) {
  const lines = plan.actions.flatMap(a =>
    a.kind === "wall" || a.kind === "beam" || a.kind === "duct" || a.kind === "pipe"
      ? [{ id: a.id, kind: a.kind, levelId: a.levelId, x1: a.startXmm, y1: a.startYmm, x2: a.endXmm, y2: a.endYmm }]
      : []
  );
  const surfaces = plan.actions.flatMap(a => (a.kind === "floor" || a.kind === "roof" ? [a] : []));
  const points = [...lines.flatMap(l => [[l.x1, l.y1], [l.x2, l.y2]]), ...surfaces.flatMap(s => s.boundary.map(p => [p.xMm, p.yMm]))];
  if (!points.length) return <p className="text-xs ai-text-muted">Review the dimensions and locations in the action list below.</p>;
  const minX = Math.min(...points.map(p => p[0])), minY = Math.min(...points.map(p => p[1]));
  const width = Math.max(1000, Math.max(...points.map(p => p[0])) - minX), height = Math.max(1000, Math.max(...points.map(p => p[1])) - minY);
  const margin = Math.max(width, height) * 0.08;
  const levels = [...new Set([...lines.map(l => l.levelId), ...surfaces.map(s => s.levelId)])];
  return (
    <div>
      {levels.map(levelId => (
        <figure key={levelId} className="my-2">
          <figcaption className="text-xs ai-text-body">Plan preview · {String(context.elements.find(e => e.id === levelId)?.properties.name ?? levelId)} · mm</figcaption>
          <svg aria-label={`Proposed geometry on level ${levelId}`} role="img" viewBox={`${minX - margin} ${minY - margin} ${width + margin * 2} ${height + margin * 2}`} className="mt-1 h-40 w-full rounded-lg ai-plan-canvas">
            {surfaces.filter(s => s.levelId === levelId).map(s => (
              <polygon key={s.id} points={s.boundary.map(p => `${p.xMm},${p.yMm}`).join(" ")} fill={s.kind === "roof" ? "#60a5fa22" : "#facc1522"} stroke="var(--text-muted)" strokeWidth={Math.max(width, height) / 300} />
            ))}
            {lines.filter(l => l.levelId === levelId).map(l => {
              const stroke = l.kind === "duct" ? "#06b6d4" : l.kind === "pipe" ? "#3b82f6" : "var(--ai-accent-ink)";
              const strokeWidth = l.kind === "duct" ? Math.max(width, height) / 100 : l.kind === "pipe" ? Math.max(width, height) / 160 : Math.max(width, height) / 150;
              const strokeDasharray = l.kind === "pipe" ? "4 2" : undefined;
              return <line key={l.id} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={strokeDasharray} />;
            })}
          </svg>
        </figure>
      ))}
      <p className="text-xs ai-text-muted">Schematic footprint; review ducting, piping, openings, heights, equipment and deletions below.</p>
    </div>
  );
}
