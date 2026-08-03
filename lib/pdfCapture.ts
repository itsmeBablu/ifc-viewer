import type { PageFormat } from "@/lib/presentationLayout";
import type { ColorMode, Floor, Room } from "@/lib/types";
import type { Viewer3DHandle } from "@/components/Viewer3D";
import { listVisibleFloors } from "@/lib/floorFilter";
import { resolveColorPalette } from "@/lib/colorMapping";
import {
  supportsCompareBothModes,
  type DataViewMode,
} from "@/lib/dataViewMode";
import { useAppStore } from "@/store/useAppStore";
import type {
  FloorPdfSection,
  PdfModeSection,
  PresentationPdfImages,
  PdfLegendContext,
} from "@/lib/pdfExport";

function waitFrames(n = 2): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => {
      if (left <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(left - 1));
    };
    step(n);
  });
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T | void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[pdfCapture] timed out: ${label}`);
          resolve();
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function settle(viewer: Viewer3DHandle, ms = 280): Promise<void> {
  await waitMs(ms);
  await waitFrames(3);
  viewer.fitVisible();
  await waitFrames(2);
  await waitMs(120);
}

async function safeFlyToPose(
  viewer: Viewer3DHandle,
  position: [number, number, number],
  target: [number, number, number],
  duration: number,
): Promise<void> {
  await withTimeout(
    viewer.flyToPose(position, target, duration),
    Math.max(2500, duration + 1500),
    `flyToPose(${duration}ms)`,
  );
}

function floorsWithRooms(floors: Floor[], rooms: Room[]): Floor[] {
  return listVisibleFloors(floors, rooms);
}

const MODE_LABEL: Record<DataViewMode, string> = {
  heizlast: "Heizlast",
  kuhllast: "Kühllast",
  luftung: "Lüftung",
};

export function pdfLegendFromStore(): PdfLegendContext {
  const s = useAppStore.getState();
  return {
    palette: resolveColorPalette(s.colorTheme, s.activeColorPalette),
    heizlastRange: s.heizlastRange,
    kuhllastRange: s.kuhllastRange,
    luftungRange: s.luftungRange,
    temperatureRange: s.temperatureRange,
    customLegendColors: s.customLegendColors,
  };
}

async function applyDataViewMode(mode: DataViewMode): Promise<void> {
  const { setDataViewMode, setCompareBothModes, setColorMode } =
    useAppStore.getState();
  setDataViewMode(mode);
  setColorMode("heizlast");
  setCompareBothModes(supportsCompareBothModes(mode));
  // Let Viewer3D rebuild room materials for the new mode.
  await waitMs(550);
  await waitFrames(3);
}

/**
 * Capture every floor (+ presentation) for each selected data mode.
 * Heizlast/Kühllast: dual load + temperature. Lüftung: single load view.
 */
export async function captureAllPagesAssets(
  viewer: Viewer3DHandle,
  opts?: {
    scale?: number;
    onProgress?: (msg: string) => void;
    modes?: DataViewMode[];
  },
): Promise<{ sections: PdfModeSection[] }> {
  const scale = opts?.scale ?? 2.5;
  const report = opts?.onProgress ?? (() => undefined);
  const modes = (opts?.modes?.length ? opts.modes : ["heizlast"]) as DataViewMode[];
  const store = useAppStore.getState();

  const restore = {
    colorMode: store.colorMode,
    dataViewMode: store.dataViewMode,
    selectedFloor: store.selectedFloor,
    sliceProgress: store.sliceProgress,
    isPresentationView: store.isPresentationView,
    presentationLayoutMode: store.presentationLayoutMode,
    presentationIsolate: store.presentationIsolate,
    compareBothModes: store.compareBothModes,
    pose: viewer.getCameraPose(),
  };

  const {
    setColorMode,
    setDataViewMode,
    setSelectedFloor,
    setSliceProgress,
    setPresentationView,
    setPresentationLayoutMode,
    setPresentationIsolate,
    setCompareBothModes,
  } = useAppStore.getState();

  const floors = floorsWithRooms(store.floors, store.rooms);
  const sections: PdfModeSection[] = [];

  try {
    if (store.isPresentationView) {
      setPresentationView(false);
      await waitMs(700);
    }
    setPresentationIsolate(false);
    setSliceProgress(1);

    for (const mode of modes) {
      report(`${MODE_LABEL[mode]} — floors…`);
      await applyDataViewMode(mode);

      const floorSections: FloorPdfSection[] = [];
      for (const floor of floors) {
        report(`${MODE_LABEL[mode]} — ${floor.name}…`);
        setSelectedFloor(floor.id);
        await settle(viewer, 400);
        const dualImage = viewer.captureViewport({ scale }) ?? null;
        floorSections.push({
          floorName: floor.name,
          rooms: store.rooms
            .filter((r) => r.floorId === floor.id)
            .sort(
              (a, b) =>
                a.number.localeCompare(b.number) ||
                a.name.localeCompare(b.name),
            ),
          dualImage,
        });
      }

      report(`${MODE_LABEL[mode]} — presentation…`);
      setSelectedFloor(null);
      setPresentationLayoutMode("stack");
      setPresentationIsolate(false);
      setCompareBothModes(supportsCompareBothModes(mode));
      setPresentationView(true);
      await waitMs(1200);
      await waitFrames(3);
      viewer.fitVisible();
      await waitFrames(2);
      const presentationDual = viewer.captureViewport({ scale }) ?? null;
      setPresentationView(false);
      await waitMs(650);

      sections.push({
        mode,
        floors: floorSections,
        presentation: { dualImage: presentationDual },
      });
    }

    return { sections };
  } finally {
    const s = useAppStore.getState();
    setCompareBothModes(restore.compareBothModes);
    setDataViewMode(restore.dataViewMode);
    if (s.isPresentationView !== restore.isPresentationView) {
      setPresentationView(restore.isPresentationView);
      await waitMs(restore.isPresentationView ? 900 : 650);
    }
    setPresentationLayoutMode(restore.presentationLayoutMode);
    setPresentationIsolate(restore.presentationIsolate);
    setColorMode(restore.colorMode as ColorMode);
    setSelectedFloor(restore.selectedFloor);
    setSliceProgress(restore.sliceProgress);
    await waitMs(200);
    await safeFlyToPose(
      viewer,
      restore.pose.position,
      restore.pose.target,
      500,
    );
  }
}

/**
 * Capture presentation view for each selected data mode.
 */
export async function capturePresentationAssets(
  viewer: Viewer3DHandle,
  opts?: {
    scale?: number;
    onProgress?: (msg: string) => void;
    modes?: DataViewMode[];
  },
): Promise<{ sections: Array<{ mode: DataViewMode; presentation: PresentationPdfImages }> }> {
  const scale = opts?.scale ?? 3;
  const report = opts?.onProgress ?? (() => undefined);
  const modes = (opts?.modes?.length ? opts.modes : ["heizlast"]) as DataViewMode[];
  const store = useAppStore.getState();
  const alreadyPresenting = store.isPresentationView;

  const restore = {
    colorMode: store.colorMode,
    dataViewMode: store.dataViewMode,
    selectedFloor: store.selectedFloor,
    isPresentationView: store.isPresentationView,
    presentationLayoutMode: store.presentationLayoutMode,
    presentationIsolate: store.presentationIsolate,
    presentationFloorId: store.presentationFloorId,
    compareBothModes: store.compareBothModes,
    pose: viewer.getCameraPose(),
  };

  const {
    setColorMode,
    setDataViewMode,
    setSelectedFloor,
    setPresentationView,
    setPresentationLayoutMode,
    setPresentationIsolate,
    setPresentationFloorId,
    setCompareBothModes,
  } = useAppStore.getState();

  const sections: Array<{
    mode: DataViewMode;
    presentation: PresentationPdfImages;
  }> = [];

  try {
    for (const mode of modes) {
      report(`${MODE_LABEL[mode]} — presentation…`);
      await applyDataViewMode(mode);

      if (!alreadyPresenting) {
        setSelectedFloor(null);
        setPresentationLayoutMode("stack");
        setPresentationIsolate(false);
        setCompareBothModes(supportsCompareBothModes(mode));
        setPresentationView(true);
        await waitMs(1200);
        await waitFrames(3);
        viewer.fitVisible();
        await settle(viewer, 350);
      } else {
        // Keep current framing — do not fit / change isolate / layout / floor.
        const pose = viewer.getCameraPose();
        const wantCompare = supportsCompareBothModes(mode);
        const currentCompare = useAppStore.getState().compareBothModes;
        if (currentCompare !== wantCompare) {
          setCompareBothModes(wantCompare);
          await waitMs(1100);
          await safeFlyToPose(viewer, pose.position, pose.target, 1);
          await waitFrames(4);
          await waitMs(120);
        } else {
          await waitFrames(2);
          await waitMs(80);
        }
      }

      const dualImage = viewer.captureViewport({ scale }) ?? null;
      sections.push({ mode, presentation: { dualImage } });
    }

    return { sections };
  } finally {
    setCompareBothModes(restore.compareBothModes);
    setDataViewMode(restore.dataViewMode);
    const s = useAppStore.getState();
    if (s.isPresentationView !== restore.isPresentationView) {
      setPresentationView(restore.isPresentationView);
      await waitMs(restore.isPresentationView ? 900 : 650);
    }
    setPresentationLayoutMode(restore.presentationLayoutMode);
    setPresentationIsolate(restore.presentationIsolate);
    setPresentationFloorId(restore.presentationFloorId);
    setColorMode(restore.colorMode as ColorMode);
    setSelectedFloor(restore.selectedFloor);
    await waitMs(200);
    await safeFlyToPose(
      viewer,
      restore.pose.position,
      restore.pose.target,
      alreadyPresenting ? 1 : 500,
    );
  }
}

export type { PageFormat };
