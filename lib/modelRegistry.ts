/**
 * Static registry of bundled demo/sample models (secondary to local File
 * upload — most users load their own .ifc via the file picker instead).
 * Entries are only fetched when the user explicitly picks one from this
 * list, never on startup. Do not list paths that aren't present under
 * public/models/, since `getModelById`/`getModels` assume they resolve.
 */
import type { ModelEntry } from "./types";

const MODELS: ModelEntry[] = [
  // Uncomment / add once the file exists at public/models/building-a.ifc:
  // {
  //   id: "building-a",
  //   label: "Building A",
  //   ifcPath: "/models/building-a.ifc",
  // },
  {
    id: "smoke",
    label: "Smoke test (minimal)",
    ifcPath: "/models/_smoke.ifc",
  },
];

export function getModels(): ModelEntry[] {
  return MODELS;
}

export function getModelById(id: string): ModelEntry | undefined {
  return MODELS.find((m) => m.id === id);
}
