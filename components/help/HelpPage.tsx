"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import gsap from "gsap";
import { LuBookOpen, LuBox, LuChevronRight, LuEye, LuFolderOpen, LuKeyboard, LuMove, LuRuler, LuSettings2 } from "react-icons/lu";
import GlassPanel from "@/components/common/GlassPanel";
import { SHORTCUTS, shortcutText, type ShortcutCategory, type ShortcutDefinition } from "@/lib/shortcuts";

const topics: { id: string; label: string; icon: ReactNode; categories?: ShortcutCategory[] }[] = [
  { id: "getting-started", label: "Getting Started", icon: <LuBookOpen /> },
  { id: "drawing", label: "Drawing Tools", icon: <LuRuler />, categories: ["Draw Tools"] },
  { id: "modify", label: "Modify Tools", icon: <LuMove />, categories: ["Modify Tools"] },
  { id: "mep", label: "MEP", icon: <LuSettings2 />, categories: ["MEP Tools"] },
  { id: "views", label: "Views & Navigation", icon: <LuEye />, categories: ["View Controls"] },
  { id: "files", label: "File & Project", icon: <LuFolderOpen />, categories: ["File Actions"] },
  { id: "shortcuts", label: "Keyboard Shortcuts", icon: <LuKeyboard /> },
];

const categoryOrder: ShortcutCategory[] = ["Draw Tools", "MEP Tools", "Modify Tools", "File Actions", "View Controls", "General"];

function ToolCard({ item }: { item: ShortcutDefinition }) {
  return <div className="flex items-start gap-3 rounded-xl border border-[var(--panel-divider)] bg-[var(--panel-bg)]/45 p-3">
    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]"><LuBox size={16} /></span>
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{item.label}</strong><kbd className="rounded-md border border-[var(--panel-divider)] px-2 py-0.5 text-[11px] font-semibold">{shortcutText(item.id)}</kbd></div><p className="mt-1 text-xs leading-5 opacity-70">{item.description}</p></div>
  </div>;
}

export default function HelpPage() {
  const [active, setActive] = useState("getting-started");
  const detailRef = useRef<HTMLDivElement>(null);
  const topic = topics.find(item => item.id === active) ?? topics[0];
  const entries = useMemo(() => topic.categories ? SHORTCUTS.filter(item => topic.categories?.includes(item.category)) : [], [topic]);
  useEffect(() => { if (detailRef.current) gsap.fromTo(detailRef.current, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.22, ease: "power2.out" }); }, [active]);
  return <main className="min-h-screen overflow-y-auto bg-[var(--app-bg)] px-4 py-5 text-[var(--text-primary)] sm:px-6 lg:px-10">
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-55">Werkzeug</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Documentation</h1></div><Link href="/werkzeug" className="rounded-lg border border-[var(--panel-divider)] px-3 py-2 text-sm transition hover:bg-[var(--panel-bg)]">Back to workspace</Link></div>
      <GlassPanel preferCss wrapperClassName="" className="p-2 sm:p-3" fill>
        <div className="grid min-h-[70vh] gap-3 md:grid-cols-[220px_1fr]">
          <nav aria-label="Documentation topics" className="rounded-xl border border-[var(--panel-divider)] bg-[var(--panel-bg)]/35 p-2"><div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider opacity-50">Topics</div>{topics.map(item => <button key={item.id} type="button" onClick={() => setActive(item.id)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${active === item.id ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "opacity-75 hover:bg-[var(--panel-bg)]"}`} aria-current={active === item.id ? "page" : undefined}><span>{item.icon}</span><span className="flex-1">{item.label}</span><LuChevronRight size={14} className={active === item.id ? "opacity-100" : "opacity-35"} /></button>)}</nav>
          <section ref={detailRef} className="rounded-xl border border-[var(--panel-divider)] bg-[var(--panel-bg)]/25 p-4 sm:p-6">{active === "getting-started" && <><h2 className="text-xl font-semibold">Start a project</h2><p className="mt-2 max-w-2xl text-sm leading-6 opacity-75">Choose a tool from the capsule row, click to place points, move to preview, then click again to continue. Press Enter or double-click to finish a run; Escape cancels the active command and clears selection. Snapping and numeric feedback are shared by every drawing tool.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><ToolCard item={SHORTCUTS.find(item => item.id === "select")!} /><ToolCard item={SHORTCUTS.find(item => item.id === "cancel")!} /></div></>}{active !== "getting-started" && active !== "shortcuts" && <><h2 className="text-xl font-semibold">{topic.label}</h2><p className="mt-2 text-sm opacity-70">Use the same click, preview, snap, confirm, and cancel interaction model across the workspace.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{entries.map(item => <ToolCard key={item.id} item={item} />)}</div></>}{active === "shortcuts" && <><h2 className="text-xl font-semibold">Keyboard Shortcuts</h2><p className="mt-2 text-sm opacity-70">Shortcuts are active globally, switch to the relevant workspace context automatically, and are ignored while typing in text or number fields.</p><div className="mt-5 space-y-5">{categoryOrder.map(category => { const items = SHORTCUTS.filter(item => item.category === category); return <div key={category}><h3 className="mb-2 text-xs font-semibold uppercase tracking-wider opacity-55">{category}</h3><div className="grid gap-2 sm:grid-cols-2">{items.map(item => <ToolCard key={item.id} item={item} />)}</div></div>; })}</div></>}</section>
        </div>
      </GlassPanel>
    </div>
  </main>;
}
