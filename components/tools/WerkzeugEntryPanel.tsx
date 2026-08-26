"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { LuChevronDown, LuClock3, LuFolderOpen, LuSearch, LuTrash2 } from "react-icons/lu";
import GlassPanel from "@/components/common/GlassPanel";
import GsapHeightAccordion from "@/components/common/GsapHeightAccordion";
import GsapOverlay from "@/components/common/GsapOverlay";
import LoadIfcButton from "@/components/common/LoadIfcButton";
import { IconUpload } from "@/components/common/ui";
import { idbDeleteProject, idbListProjects, type StoredLayoutProject } from "@/lib/layoutDrawingDb";
import { motion, radius } from "@/lib/designTokens";
import { gsapDuration, gsapEase } from "@/lib/gsapMotion";
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

const formatProjectSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function WerkzeugEntryPanel({ onFile }: { onFile: (file: File) => void }) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState<StoredLayoutProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectToDelete, setProjectToDelete] = useState<StoredLayoutProject | null>(null);
  const projectSectionRef = useRef<HTMLElement>(null);
  const projectListRef = useRef<HTMLDivElement>(null);
  const projectCardRefs = useRef(new Map<string, HTMLElement>());

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
    setBusy(true);
    try {
      await idbDeleteProject(project.id);
      setSelectedProjectId((selected) => selected === project.id ? null : selected);
      setProjectToDelete(null);
      await refreshProjects();
    } finally {
      setBusy(false);
    }
  };

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }),
    [],
  );
  const filteredProjects = useMemo(() => {
    const query = projectSearch.trim().toLocaleLowerCase();
    return query
      ? projects.filter((project) => project.name.toLocaleLowerCase().includes(query))
      : projects;
  }, [projectSearch, projects]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const timer = window.setTimeout(() => {
      const list = window.matchMedia("(orientation: portrait)").matches
        ? projectSectionRef.current
        : projectListRef.current;
      const card = projectCardRefs.current.get(selectedProjectId);
      if (!list || !card) return;
      const listRect = list.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      let scrollTop = list.scrollTop;
      if (cardRect.top < listRect.top) {
        scrollTop -= listRect.top - cardRect.top + 4;
      } else if (cardRect.bottom > listRect.bottom) {
        scrollTop += cardRect.bottom - listRect.bottom + 4;
      }
      gsap.to(list, {
        scrollTop,
        duration: gsapDuration.accordion,
        ease: gsapEase.iosOut,
        overwrite: true,
      });
    }, gsapDuration.accordion * 1000 + 30);
    return () => window.clearTimeout(timer);
  }, [selectedProjectId]);
  const amberBtn = `${motion.base} ${radius.control} btn-v-yellow btn-liquid-hover inline-flex min-h-10 min-w-[168px] items-center justify-center gap-2 px-6 py-2 text-sm active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45`;

  return (
    <div className="pointer-events-auto relative h-full min-h-0 w-full overflow-hidden bg-slate-950/25 p-3 backdrop-blur-xl sm:p-4 lg:p-10">
      <div className="mx-auto flex min-h-full w-full max-w-6xl items-center justify-center">
        <GlassPanel fill variant="panel" zIndex={90} preferCss wrapperClassName="tool-glass h-[calc(100dvh-1.5rem)] w-full overflow-hidden rounded-[24px] border border-white/55 shadow-[0_28px_90px_rgba(15,23,42,0.28)] sm:h-[calc(100dvh-2rem)] lg:h-[calc(100dvh-5rem)] lg:rounded-[28px]">
          <div className="flex h-full min-h-0 flex-col landscape:grid landscape:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)] landscape:grid-rows-1">
            <section ref={projectSectionRef} className="order-2 flex min-h-0 flex-1 touch-pan-y flex-col overflow-y-auto border-t border-[var(--panel-divider)] p-4 landscape:order-1 landscape:overflow-hidden landscape:border-t-0 landscape:border-r lg:p-7" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="sticky top-0 z-10 -mx-1 bg-white/45 px-1 pb-1 backdrop-blur-xl landscape:static landscape:mx-0 landscape:bg-transparent landscape:px-0 landscape:backdrop-blur-none">
                <div className="mb-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-[var(--text-strong)]">Previous projects</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">Stored locally on this device</p>
                  </div>
                  <span className="rounded-full bg-white/35 px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)]">{projects.length} saved</span>
                </div>

                <label className="relative mb-3 block">
                  <LuSearch className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="search"
                    value={projectSearch}
                    onChange={(event) => setProjectSearch(event.target.value)}
                    placeholder="Search previous projects"
                    aria-label="Search previous projects"
                    className="h-9 w-full rounded-xl border border-white/50 bg-white/35 pr-3 pl-9 text-xs outline-none placeholder:text-[var(--text-muted)] focus:border-amber-300"
                  />
                </label>
              </div>

              <div
                ref={projectListRef}
                className="min-h-0 flex-none touch-pan-y overflow-x-hidden overflow-y-visible overscroll-contain pr-1 landscape:h-0 landscape:flex-1 landscape:overflow-y-scroll"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
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
                ) : filteredProjects.length === 0 ? (
                  <p className="py-10 text-center text-xs text-[var(--text-muted)]">No projects match “{projectSearch.trim()}”.</p>
                ) : (
                  <div className="grid gap-2">
                    {filteredProjects.map((project) => {
                      const expanded = selectedProjectId === project.id;
                      return (
                        <article ref={(element) => { if (element) projectCardRefs.current.set(project.id, element); else projectCardRefs.current.delete(project.id); }} key={project.id} className={`min-w-0 overflow-hidden rounded-2xl border backdrop-blur-md transition-colors ${expanded ? "border-amber-300/70 bg-white/45" : "border-white/45 bg-white/25"}`}>
                          <button
                            type="button"
                            aria-expanded={expanded}
                            onClick={() => setSelectedProjectId((selected) => selected === project.id ? null : project.id)}
                            className="flex w-full min-w-0 items-center gap-3 p-3 text-left"
                          >
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100/70 text-amber-700"><LuFolderOpen className="size-4" /></span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-[var(--text-strong)]">{project.name}</span>
                              <span className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--text-muted)]"><LuClock3 className="size-3" />{project.lastModified ? dateFormatter.format(project.lastModified) : "Date unavailable"}</span>
                            </span>
                            <LuChevronDown className={`size-4 shrink-0 text-[var(--text-muted)] transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
                          </button>

                          <GsapHeightAccordion open={expanded} contentKey={project.lastModified}>
                            <div className="border-t border-white/45 px-3 pt-3 pb-4">
                              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[11px]">
                                <dt className="text-[var(--text-muted)]">Project name</dt>
                                <dd className="truncate text-right font-semibold text-[var(--text-strong)]">{project.name}</dd>
                                <dt className="text-[var(--text-muted)]">Last modified</dt>
                                <dd className="text-right font-medium text-[var(--text-strong)]">{project.lastModified ? dateFormatter.format(project.lastModified) : "Date unavailable"}</dd>
                                <dt className="text-[var(--text-muted)]">Storage</dt>
                                <dd className="text-right font-medium text-[var(--text-strong)]">This device</dd>
                              </dl>
                              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-5 gap-y-1 text-[11px]">
                                <span className="whitespace-nowrap text-[var(--text-muted)]">Project size <strong className="ml-1 font-semibold text-[var(--text-strong)]">{formatProjectSize(project.sizeBytes)}</strong></span>
                                <span className="whitespace-nowrap text-[var(--text-muted)]">Contents <strong className="ml-1 font-semibold text-[var(--text-strong)]">{project.levelCount ?? 0} levels · {project.elementCount ?? 0} elements</strong></span>
                              </div>
                              {(project.referenceFiles?.length ?? 0) > 0 && (
                                <div className="mt-3 rounded-xl bg-white/30 p-2.5">
                                  <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">DWG / PDF references</p>
                                  <div className="grid gap-1">
                                    {project.referenceFiles?.map((reference, index) => (
                                      <div key={`${reference.name}-${index}`} className="flex min-w-0 items-center justify-between gap-3 text-[11px]">
                                        <span className="truncate font-medium text-[var(--text-strong)]">{reference.name}</span>
                                        <span className="shrink-0 rounded-md bg-white/45 px-1.5 py-0.5 text-[9px] font-bold text-[var(--text-muted)]">{reference.type}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="mt-4 flex items-center justify-end gap-2">
                                <button type="button" disabled={busy} onClick={() => setProjectToDelete(project)} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-red-600 transition hover:bg-red-100/60 disabled:opacity-45"><LuTrash2 className="size-4" />Delete</button>
                                <button type="button" disabled={busy} onClick={() => void activateProject(project)} className="h-9 rounded-xl bg-amber-300/75 px-4 text-xs font-semibold text-amber-950 transition hover:bg-amber-300 disabled:opacity-45">Open project</button>
                              </div>
                            </div>
                          </GsapHeightAccordion>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="order-1 flex shrink-0 flex-col justify-center p-4 sm:p-5 landscape:order-2 lg:p-10">
              <p className="text-[11px] font-bold tracking-[0.24em] text-amber-700 uppercase">V Studio</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-3xl">Start designing</h1>
              <p className="mt-2 hidden max-w-sm text-xs leading-relaxed text-[var(--text-muted)] sm:block">{t(uiLanguage, "werkzeugEntryHint")}</p>
              <div className="mt-3 flex justify-start sm:mt-5"><LoadIfcButton onFile={onFile} label={t(uiLanguage, "werkzeugUploadIfc")} /></div>
              <div className="relative my-3 text-center text-[10px] font-semibold tracking-wide text-[var(--text-muted)] uppercase sm:my-4">
                <span className="absolute inset-x-0 top-1/2 border-t border-[var(--panel-divider)]" />
                <span className="relative bg-white/35 px-2 backdrop-blur-sm">{t(uiLanguage, "or")}</span>
              </div>
              <form onSubmit={(event) => { event.preventDefault(); void create(); }} className="flex flex-col items-stretch gap-2 sm:gap-3">
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

      <GsapOverlay show={Boolean(projectToDelete)} className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
        <GlassPanel variant="panel" zIndex={141} preferCss wrapperClassName="w-full max-w-sm rounded-3xl border border-white/55 shadow-[0_24px_70px_rgba(15,23,42,0.35)]">
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-project-title" className="p-5 sm:p-6">
            <div className="mb-3 grid size-10 place-items-center rounded-full bg-red-100/75 text-red-600"><LuTrash2 className="size-5" /></div>
            <h2 id="delete-project-title" className="text-base font-semibold text-[var(--text-strong)]">Delete project?</h2>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
              <strong className="font-semibold text-[var(--text-strong)]">{projectToDelete?.name}</strong> and all of its locally stored drawing data will be permanently removed from this device.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setProjectToDelete(null)} className="h-9 rounded-xl bg-white/40 px-4 text-xs font-semibold text-[var(--text-strong)] transition hover:bg-white/60 disabled:opacity-45">Cancel</button>
              <button type="button" disabled={busy || !projectToDelete} onClick={() => { if (projectToDelete) void deleteProject(projectToDelete); }} className="h-9 rounded-xl bg-red-500 px-4 text-xs font-semibold text-white transition hover:bg-red-600 disabled:opacity-45">{busy ? "Deleting…" : "Confirm Delete"}</button>
            </div>
          </div>
        </GlassPanel>
      </GsapOverlay>
    </div>
  );
}
