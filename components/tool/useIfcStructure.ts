"use client";

/**
 * useIfcStructure — hook that builds the IFC spatial/type tree for the
 * Werkzeug tool panel, keyed to the currently loaded model.
 *
 * Reads activeModelId/isLoadingModel from useAppStore and shellGroup/rooms
 * from useModelScene; rebuilds via buildIfcStructure only when the model
 * changes, reporting the prior structure as "loading" until the new one
 * is ready so the tree never flashes stale data.
 */

import { useEffect, useState } from "react";
import type { Group } from "three";
import { buildIfcStructure, type IfcStructure } from "@/lib/ifcStructure";
import { useAppStore } from "@/store/useAppStore";
import { useModelScene } from "../viewer/ModelSceneContext";

export type IfcStructureState = {
  structure: IfcStructure | null;
  loading: boolean;
};

type BuildResult = {
  /** The shell the tree was built for — anything else means it is stale. */
  source: Group | null;
  modelId: string | null;
  structure: IfcStructure | null;
};

/**
 * Builds the IFC spatial tree once per loaded model. The web-ifc handle stays
 * open after load, so this never re-parses the file.
 */
export function useIfcStructure(enabled: boolean): IfcStructureState {
  const activeModelId = useAppStore((s) => s.activeModelId);
  const isLoadingModel = useAppStore((s) => s.isLoadingModel);
  const { shellGroup, rooms } = useModelScene();
  const [result, setResult] = useState<BuildResult>({
    source: null,
    modelId: null,
    structure: null,
  });

  const hasModel = Boolean(shellGroup) || rooms.length > 0;

  useEffect(() => {
    if (!enabled || isLoadingModel || !hasModel) return;

    const renderableIds = new Set<number>();
    shellGroup?.traverse((obj) => {
      const id = obj.userData.expressId as number | undefined;
      if (typeof id === "number") renderableIds.add(id);
    });
    for (const room of rooms) renderableIds.add(room.expressId);

    let cancelled = false;
    void buildIfcStructure({ renderableIds }).then((structure) => {
      if (cancelled) return;
      setResult({ source: shellGroup, modelId: activeModelId, structure });
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, isLoadingModel, hasModel, activeModelId, shellGroup, rooms]);

  // A result from a previous model is stale — treat it as "still building".
  const fresh =
    result.source === shellGroup && result.modelId === activeModelId;

  return {
    structure: hasModel && fresh ? result.structure : null,
    loading: hasModel && !fresh,
  };
}
