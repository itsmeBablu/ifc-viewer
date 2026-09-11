import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { mepRunKind } from "@/lib/drawingInteraction";
import type { MepSnapPoint } from "@/lib/mepConnections";

export function currentMepDrawing() {
  const s = useLayoutDrawingStore.getState(), kind = mepRunKind(s.armedLayoutTool);
  const draw = kind === "duct" ? s.ductDraw : kind === "pipe" ? s.pipeDraw : kind === "wire" ? s.wireDraw : kind === "cabletray" ? s.cableTrayDraw : null;
  const offset = draw?.elevationOffsetMm ?? (kind === "duct" ? s.draftDuctElevationMm : kind === "pipe" ? s.draftPipeElevationMm : kind === "wire" ? s.draftWireElevationMm : s.draftCableTrayElevationMm);
  return { kind, draw, offset };
}

export function cancelMepDrawing() {
  useLayoutDrawingStore.setState({ ductDraw: null, pipeDraw: null, cableTrayDraw: null, wireDraw: null });
}

export async function placeMepPoint(levelId: string, point: MepSnapPoint) {
  const s = useLayoutDrawingStore.getState(), { kind, draw } = currentMepDrawing();
  if (kind === "duct") {
    if (!draw) s.startDuctDraw(levelId, point);
    else {
      s.updateDuctDrawCursor(point);
      const duct = await s.finishDuctDraw();
      if (duct && (s.armedLayoutTool === "flex_duct" || s.armedLayoutTool === "mep_placeholder")) await s.updateDuct(duct.id, { isFlex: s.armedLayoutTool === "flex_duct", isPlaceholder: s.armedLayoutTool === "mep_placeholder" });
    }
  } else if (kind === "pipe") {
    if (!draw) s.startPipeDraw(levelId, point); else { s.updatePipeDrawCursor(point); await s.finishPipeDraw(); }
  } else if (kind === "cabletray") {
    if (!draw) s.startCableTrayDraw(levelId, point); else { s.updateCableTrayDrawCursor(point); await s.finishCableTrayDraw(); }
  } else if (kind === "wire") {
    if (!draw) s.startWireDraw(levelId, point); else { s.updateWireDrawCursor(point); await s.finishWireDraw(); }
  }
}

export function changeMepDrawingLevel(levelId: string) {
  const s = useLayoutDrawingStore.getState();
  const relocate = <T extends NonNullable<typeof s.wireDraw>>(draw: T | null) => draw?.start ? { ...draw, levelId, start: { xMm: draw.start.xMm, yMm: draw.start.yMm }, cursor: null } : null;
  // A level change relocates the pending segment, leaving saved segments untouched.
  useLayoutDrawingStore.setState({
    ductDraw: s.ductDraw?.start ? { ...s.ductDraw, levelId, start: { xMm: s.ductDraw.start.xMm, yMm: s.ductDraw.start.yMm }, cursor: null } : null,
    pipeDraw: s.pipeDraw?.start ? { ...s.pipeDraw, levelId, start: { xMm: s.pipeDraw.start.xMm, yMm: s.pipeDraw.start.yMm }, cursor: null } : null,
    cableTrayDraw: s.cableTrayDraw?.start ? { ...s.cableTrayDraw, levelId, start: { xMm: s.cableTrayDraw.start.xMm, yMm: s.cableTrayDraw.start.yMm }, cursor: null } : null,
    wireDraw: relocate(s.wireDraw),
  });
}
