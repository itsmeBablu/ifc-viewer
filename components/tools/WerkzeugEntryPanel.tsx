"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LuClock3, LuFolderOpen, LuTrash2 } from "react-icons/lu";
import GlassPanel from "@/components/common/GlassPanel";
import LoadIfcButton from "@/components/common/LoadIfcButton";
import { IconUpload } from "@/components/common/ui";
import { idbDeleteProject, idbListProjects, type StoredLayoutProject } from "@/lib/layoutDrawingDb";
import { motion, radius } from "@/lib/designTokens";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";

const floorFromLevel = (level: { id: string; name: string; elevationMm: number; heightMm: number }) => ({
  id: level.id,
  name: level.name,
  elevation: level.elevationMm / 1000,
  expressId: -1,
  typicalHeight: level.heightMm / 1000,
  isBuildingStory: true,
});

export default function WerkzeugEntryPanel({ onFile }: { onFile: (file: File) => void }) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState<StoredLayoutProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      setProjects(await idbListProjects());
    } catch {
      setProjectsError("Saved projects could not be read on this device.");
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void idbListProjects()
      .then((savedProjects) => {
        if (!cancelled) setProjects(savedProjects);
      })
      .catch(() => {
        if (!cancelled) setProjectsError("Saved projects could not be read on this device.");
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const activateProject = useCallback(async (project: StoredLayoutProject) => {
    setBusy(true);
    try {
      await useLayoutDrawingStore.getState().loadForProject(project.id, project.id.startsWith("empty:"));
      const levels = useLayoutDrawingStore.getState().levels;
      useAppStore.getState().setActiveModelId(project.id, project.name, null);
      useAppStore.getState().setFloors(levels.map(floorFromLevel));
      const firstLevel = levels[0];
      if (firstLevel) useAppStore.getState().setSelectedFloor(firstLevel.id);
      await useToolMarkupStore.getState().loadForModel(project.id);
      if (firstLevel) useToolMarkupStore.getState().setMarkupFloorId(firstLevel.id);
      useToolMarkupStore.getState().setViewPreset("top");
      useAppStore.getState().setToolMode(true);
    } finally {
      setBusy(false);
    }
  }, []);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const { projectId, level } = await useLayoutDrawingStore.getState().createEmptyProject(trimmed);
      useAppStore.getState().setActiveModelId(projectId, trimmed, null);
      useAppStore.getState().setFloors([floorFromLevel(level)]);
      useAppStore.getState().setSelectedFloor(level.id);
      await useToolMarkupStore.getState().loadForModel(projectId);
      useToolMarkupStore.getState().setMarkupFloorId(level.id);
      useToolMarkupStore.getState().setViewPreset("top");
      useAppStore.getState().setToolMode(true);
    } finally {
      setBusy(false);
    }
  };

  const deleteProject = async (project: StoredLayoutProject) => {
    if (!window.confirm(`Delete “${project.name}” from this device?`)) return;
    setBusy(true);
    try {
      await idbDeleteProject(project.id);
      await refreshProjects();
    } finally {
      setBusy(false);
    }
  };

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }),
    [],
  );
  const amberBtn = `${motion.base} ${radius.control} btn-v-yellow btn-liquid-hover inline-flex min-h-10 min-w-[168px] items-center justify-center gap-2 px-6 py-2 text-sm active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45`;

  return (
    <div className="pointer-events-auto relative h-full min-h-0 w-full overflow-y-auto bg-slate-950/25 p-3 backdrop-blur-xl sm:p-6 lg:p-10">
      <div className="mx-auto flex min-h-full w-full max-w-6xl items-center justify-center">
        <GlassPanel variant="panel" zIndex={90} preferCss wrapperClassName="tool-glass w-full overflow-hidden rounded-[28px] border border-white/55 shadow-[0_28px_90px_rgba(15,23,42,0.28)]">
          <div className="grid max-h-[calc(100dvh-1.5rem)] min-h-0 grid-cols-1 lg:max-h-[calc(100dvh-5rem)] lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]">
            <section className="order-2 flex min-h-0 flex-col border-t border-[var(--panel-divider)] p-4 sm:p-7 lg:order-1 lg:border-t-0 lg:border-r">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-[var(--text-strong)]">Previous projects</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Stored locally on this device</p>
                </div>
                <span className="rounded-full bg-white/35 px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)]">{projects.length} saved</span>
              </div>

              <div className="min-h-[10rem] flex-1 overflow-y-auto overscroll-contain pr-1">
                {projectsLoading ? (
                  <p className="py-10 text-center text-xs text-[var(--text-muted)]">Loading projects…</p>
                ) : projectsError ? (
                  <p className="py-10 text-center text-xs text-red-600">{projectsError}</p>
                ) : projects.length === 0 ? (
                  <div className="flex min-h-[10rem] flex-col items-center justify-center rounded-2xl border border-dashed border-white/55 bg-white/15 px-5 text-center">
                    <LuFolderOpen className="mb-2 size-6 text-amber-600/70" />
                    <p className="text-sm font-semibold text-[var(--text-strong)]">No saved projects yet</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">Create one or upload an IFC to get started.</p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {projects.map((project) => (
                      <article key={project.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/45 bg-white/25 p-3 backdrop-blur-md">
                        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100/70 text-amber-700"><LuFolderOpen className="size-4" /></div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--text-strong)]">{project.name}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--text-muted)]"><LuClock3 className="size-3" />{project.lastModified ? dateFormatter.format(project.lastModified) : "Date unavailable"}</p>
                        </div>
                        <button type="button" disabled={busy} onClick={() => void activateProject(project)} className="rounded-xl bg-amber-300/75 px-3 py-2 text-xs font-semibold text-amber-950 transition hover:bg-amber-300 disabled:opacity-45">Open</button>
                        <button type="button" disabled={busy} onClick={() => void deleteProject(project)} aria-label={`Delete ${project.name}`} className="grid size-9 shrink-0 place-items-center rounded-full text-red-600 transition hover:bg-red-100/60 disabled:opacity-45"><LuTrash2 className="size-4" /></button>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="order-1 flex flex-col justify-center p-5 sm:p-8 lg:order-2 lg:p-10">
              <p className="text-[11px] font-bold tracking-[0.24em] text-amber-700 uppercase">V Studio</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-3xl">Start designing</h1>
              <p className="mt-2 max-w-sm text-xs leading-relaxed text-[var(--text-muted)]">{t(uiLanguage, "werkzeugEntryHint")}</p>
              <div className="mt-6 flex justify-start"><LoadIfcButton onFile={onFile} label={t(uiLanguage, "werkzeugUploadIfc")} /></div>
              <div className="relative my-5 text-center text-[10px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
                <span className="absolute inset-x-0 top-1/2 border-t border-[var(--panel-divider)]" />
                <span className="relative bg-white/35 px-2 backdrop-blur-sm">{t(uiLanguage, "or")}</span>
              </div>
              <form onSubmit={(event) => { event.preventDefault(); void create(); }} className="flex flex-col items-stretch gap-3">
                <label className="text-[11px] font-semibold text-[var(--text-muted)]" htmlFor="werkzeug-project-name">{t(uiLanguage, "layoutProjectName")}</label>
                <input id="werkzeug-project-name" value={name} onChange={(event) => setName(event.target.value)} required placeholder={t(uiLanguage, "layoutProjectName")} className="h-10 w-full rounded-xl border border-white/55 bg-white/50 px-3 text-xs outline-none backdrop-blur-md focus:border-amber-300" />
                <GlassPanel variant="control" zIndex={2} wrapperClassName="mt-1 inline-flex self-start">
                  <button type="submit" disabled={busy || !name.trim()} className={amberBtn} aria-label={t(uiLanguage, "layoutCreateEmpty")}><IconUpload />{t(uiLanguage, "layoutCreateEmpty")}</button>
                </GlassPanel>
              </form>
            </section>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
