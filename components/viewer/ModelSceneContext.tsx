"use client";

/**
 * ModelSceneContext — lightweight React context sharing the loaded IFC scene
 * (shell `Group` + parsed `Room[]`) between the 3D and 2D renderers.
 *
 * Provided once by ViewerApp (via `sceneValue`, memoized on `shellGroup`/`rooms`)
 * and consumed by Viewer3D and Plan2D so both stay in sync with the same
 * loaded model without prop-drilling.
 */

import { createContext, useContext } from "react";
import type { Group } from "three";
import type { Room } from "@/lib/types";

export type ModelSceneValue = {
  shellGroup: Group | null;
  rooms: Room[];
};

export const ModelSceneContext = createContext<ModelSceneValue>({
  shellGroup: null,
  rooms: [],
});

export function useModelScene() {
  return useContext(ModelSceneContext);
}
