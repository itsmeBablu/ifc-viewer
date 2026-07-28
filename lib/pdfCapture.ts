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
 * Capture every floor (Heizlast + Temperature) and presentation stack
 * (Heizlast + Temperature) for the all-pages A4 report.
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
    pose: viewer.getCameraPose(),
  };

  const {
    setColorMode,
    setSelectedFloor,
    setSliceProgress,
    setPresentationView,
    setPresentationLayoutMode,
    setPresentationIsolate,
  } = useAppStore.getState();

  const floors = floorsWithRooms(store.floors, store.rooms);
  const floorSections: FloorPdfSection[] = [];

  try {
    // Ensure basic (non-presentation) view for floor captures
    if (store.isPresentationView) {
      setPresentationView(false);
      await waitMs(700);
    }
    setPresentationIsolate(false);
    setSliceProgress(1);

    for (const floor of floors) {
      report(`Floor ${floor.name} — Heizlast…`);
      setSelectedFloor(floor.id);
      setColorMode("heizlast");
      await settle(viewer, 350);
      const heizlastImage =
        viewer.captureViewport({ scale }) ?? null;

      report(`Floor ${floor.name} — Temperature…`);
      setColorMode("temperature");
      await settle(viewer, 300);
      const temperatureImage =
        viewer.captureViewport({ scale }) ?? null;

      floorSections.push({
        floorName: floor.name,
        rooms: store.rooms
          .filter((r) => r.floorId === floor.id)
          .sort(
            (a, b) =>
              a.number.localeCompare(b.number) ||
              a.name.localeCompare(b.name),
          ),
        heizlastImage,
        temperatureImage,
      });
    }

    // Presentation stack — all floors
    report("Presentation — Heizlast…");
    setSelectedFloor(null);
    setPresentationLayoutMode("stack");
    setPresentationIsolate(false);
    setColorMode("heizlast");
    setPresentationView(true);
    await waitMs(1100);
    await waitFrames(3);
    const presentationHeizlast =
      viewer.captureViewport({ scale }) ?? null;

    report("Presentation — Temperature…");
    setColorMode("temperature");
    await settle(viewer, 400);
    const presentationTemperature =
      viewer.captureViewport({ scale }) ?? null;

    return {
      floors: floorSections,
      presentation: {
        heizlastImage: presentationHeizlast,
        temperatureImage: presentationTemperature,
      },
    };
  } finally {
    // Restore UI state
    const s = useAppStore.getState();
    if (s.isPresentationView !== restore.isPresentationView) {
      setPresentationView(restore.isPresentationView);
      await waitMs(restore.isPresentationView ? 900 : 650);
    }
    setPresentationLayoutMode(restore.presentationLayoutMode);
    setPresentationIsolate(restore.presentationIsolate);
    setColorMode(restore.colorMode);
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
 * Capture presentation stack only (Heizlast + Temperature) at high scale.
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
    pose: viewer.getCameraPose(),
  };

  const {
    setColorMode,
    setSelectedFloor,
    setPresentationView,
    setPresentationLayoutMode,
    setPresentationIsolate,
  } = useAppStore.getState();

  try {
    setSelectedFloor(null);
    setPresentationLayoutMode("stack");
    setPresentationIsolate(false);
    setColorMode("heizlast");
    if (!store.isPresentationView) {
      setPresentationView(true);
      await waitMs(1100);
    } else {
      // Refresh layout to stack
      setPresentationLayoutMode("stack");
      await waitMs(500);
    }
    await waitFrames(3);
    report("Presentation — Heizlast…");
    const heizlastImage = viewer.captureViewport({ scale }) ?? null;

    report("Presentation — Temperature…");
    setColorMode("temperature");
    await settle(viewer, 400);
    const temperatureImage = viewer.captureViewport({ scale }) ?? null;

    return { heizlastImage, temperatureImage };
  } finally {
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
