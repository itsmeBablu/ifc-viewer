import type { PageFormat } from "@/lib/presentationLayout";
import type { ColorMode, Floor, Room } from "@/lib/types";
import type { Viewer3DHandle } from "@/components/Viewer3D";
import { useAppStore } from "@/store/useAppStore";
import type {
  FloorPdfSection,
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

async function settle(viewer: Viewer3DHandle, ms = 280): Promise<void> {
  await waitMs(ms);
  await waitFrames(3);
  viewer.fitVisible();
  await waitFrames(2);
  await waitMs(120);
}

function floorsWithRooms(floors: Floor[], rooms: Room[]): Floor[] {
  return [...floors]
    .sort((a, b) => a.elevation - b.elevation)
    .filter((f) => rooms.some((r) => r.floorId === f.id));
}

export function pdfLegendFromStore(): PdfLegendContext {
  const s = useAppStore.getState();
  return {
    palette: s.activeColorPalette,
    heizlastRange: s.heizlastRange,
    temperatureRange: s.temperatureRange,
  };
}

/**
 * Capture every floor as dual Heizlast/Temperature (stacked) and
 * presentation as dual side-by-side for the all-pages A4 report.
 */
export async function captureAllPagesAssets(
  viewer: Viewer3DHandle,
  opts?: { scale?: number; onProgress?: (msg: string) => void },
): Promise<{
  floors: FloorPdfSection[];
  presentation: PresentationPdfImages;
}> {
  const scale = opts?.scale ?? 2.5;
  const report = opts?.onProgress ?? (() => undefined);
  const store = useAppStore.getState();

  const restore = {
    colorMode: store.colorMode,
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
    setSelectedFloor,
    setSliceProgress,
    setPresentationView,
    setPresentationLayoutMode,
    setPresentationIsolate,
    setCompareBothModes,
  } = useAppStore.getState();

  const floors = floorsWithRooms(store.floors, store.rooms);
  const floorSections: FloorPdfSection[] = [];

  try {
    if (store.isPresentationView) {
      setPresentationView(false);
      await waitMs(700);
    }
    setPresentationIsolate(false);
    setSliceProgress(1);
    setCompareBothModes(true);
    await waitMs(400);

    for (const floor of floors) {
      report(`Floor ${floor.name} — dual view…`);
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

    report("Presentation — dual side-by-side…");
    setSelectedFloor(null);
    setPresentationLayoutMode("stack");
    setPresentationIsolate(false);
    setCompareBothModes(true);
    setPresentationView(true);
    await waitMs(1200);
    await waitFrames(3);
    viewer.fitVisible();
    await waitFrames(2);
    const presentationDual =
      viewer.captureViewport({ scale }) ?? null;

    return {
      floors: floorSections,
      presentation: { dualImage: presentationDual },
    };
  } finally {
    const s = useAppStore.getState();
    setCompareBothModes(restore.compareBothModes);
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
    await viewer.flyToPose(
      restore.pose.position,
      restore.pose.target,
      500,
    );
  }
}

/**
 * Capture presentation stack dual view (Heizlast | Temperature) at high scale.
 */
export async function capturePresentationAssets(
  viewer: Viewer3DHandle,
  opts?: { scale?: number; onProgress?: (msg: string) => void },
): Promise<PresentationPdfImages> {
  const scale = opts?.scale ?? 3;
  const report = opts?.onProgress ?? (() => undefined);
  const store = useAppStore.getState();

  const restore = {
    colorMode: store.colorMode,
    selectedFloor: store.selectedFloor,
    isPresentationView: store.isPresentationView,
    presentationLayoutMode: store.presentationLayoutMode,
    presentationIsolate: store.presentationIsolate,
    compareBothModes: store.compareBothModes,
    pose: viewer.getCameraPose(),
  };

  const {
    setColorMode,
    setSelectedFloor,
    setPresentationView,
    setPresentationLayoutMode,
    setPresentationIsolate,
    setCompareBothModes,
  } = useAppStore.getState();

  try {
    setSelectedFloor(null);
    setPresentationLayoutMode("stack");
    setPresentationIsolate(false);
    setCompareBothModes(true);
    if (!store.isPresentationView) {
      setPresentationView(true);
      await waitMs(1200);
    } else {
      setPresentationLayoutMode("stack");
      await waitMs(600);
    }
    await waitFrames(3);
    viewer.fitVisible();
    await settle(viewer, 350);
    report("Presentation — dual capture…");
    const dualImage = viewer.captureViewport({ scale }) ?? null;
    return { dualImage };
  } finally {
    setCompareBothModes(restore.compareBothModes);
    const s = useAppStore.getState();
    if (s.isPresentationView !== restore.isPresentationView) {
      setPresentationView(restore.isPresentationView);
      await waitMs(restore.isPresentationView ? 900 : 650);
    }
    setPresentationLayoutMode(restore.presentationLayoutMode);
    setPresentationIsolate(restore.presentationIsolate);
    setColorMode(restore.colorMode as ColorMode);
    setSelectedFloor(restore.selectedFloor);
    await waitMs(200);
    await viewer.flyToPose(
      restore.pose.position,
      restore.pose.target,
      500,
    );
  }
}

export type { PageFormat };
