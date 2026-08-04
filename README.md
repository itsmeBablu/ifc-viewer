# Heizlast IFC Presentation Viewer

Client-side Next.js app for presenting building heating data (Heizlast in W/m² and required room temperature in °C) from Revit-exported IFC files. Everything runs in the browser via WebAssembly — no backend, no database, no Speckle.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- three.js for 3D / 2D rendering
- web-ifc for IFC parsing (WASM)
- @thatopen/components + @thatopen/fragments (available for fragment workflows)
- zustand for UI / model state

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The viewport starts empty (fullscreen grid + axes). Use **Load IFC** to open a local `.ifc` file — that is the primary load path. Registry models under `public/models/` are secondary and only fetch when you pick them in the dropdown.

Glass UI uses `react-liquid-glass-svg` through the shared `components/GlassPanel.tsx` wrapper (retune once in `lib/designTokens.ts`).

## Adding IFC models

1. Place your `.ifc` file in `public/models/`, for example:

   ```
   public/models/building-a.ifc
   ```

2. Register it in `lib/modelRegistry.ts`:

   ```ts
   const MODELS: ModelEntry[] = [
     {
       id: "building-a",
       label: "Building A",
       ifcPath: "/models/building-a.ifc",
     },
     {
       id: "building-b",
       label: "Building B",
       ifcPath: "/models/building-b.ifc",
     },
   ];
   ```

3. Restart or refresh the dev server. Select the model from the header dropdown.

WASM binaries for web-ifc live in `public/wasm/` (copied from `node_modules/web-ifc`). If you upgrade `web-ifc`, re-copy:

```bash
copy node_modules\web-ifc\web-ifc.wasm public\wasm\
copy node_modules\web-ifc\web-ifc-mt.wasm public\wasm\
```

## Property mapping (Revit export)

Heat load and temperature are read from IFC property sets on `IfcSpace`. Preferred names are defined at the top of `lib/ifcClient.ts`:

- `HEAT_LOAD_PROP_NAMES` — e.g. `Heizlast`, `HeatLoadPerArea`
- `TEMPERATURE_PROP_NAMES` — e.g. `Temperature`, `Solltemperatur`

Adjust those constants to match your Revit shared-parameter / IFC export setup.

## Project layout

```
app/page.tsx                  Server Component → <ViewerAppClient />
components/ViewerAppClient.tsx  dynamic(() => ViewerApp, { ssr: false })
components/ViewerApp.tsx        layout + IFC load orchestration
components/Viewer3D.tsx         perspective 3D view
components/Plan2D.tsx           top-down orthographic plan
lib/ifcClient.ts                WASM IFC load / parse
lib/colorMapping.ts             Heizlast + temperature color scales
lib/modelRegistry.ts            available models
store/useAppStore.ts            zustand store
public/models/                  static .ifc assets
public/wasm/                    web-ifc WASM binaries
```

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Start development server |
| `npm run build`| Production build         |
| `npm run start`| Serve production build   |
| `npm run lint` | ESLint                   |

## Codebase memory (MCP)

This repo uses [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) (CBM) to give coding agents (Claude Code, Codex, etc.) a structural knowledge graph of the codebase instead of file-by-file grep/read exploration.

**Setup (one-time per machine):**

```bash
./scripts/setup-codebase-memory-mcp.sh
```

This downloads the signed CBM binary from the official installer (`install.sh` from the repo above), auto-configures any detected coding agent's MCP entry, enables `auto_index`/`auto_watch`, and indexes this repo. Restart your coding agent afterwards.

Once set up, the agent re-indexes/refreshes automatically at the start of each MCP session (git-based change detection via the background watcher) — no manual re-index needed day to day.

The compressed graph at `.codebase-memory/graph.db.zst` is committed so teammates can bootstrap from it instead of a full re-index on first clone. To rebuild it manually:

```bash
codebase-memory-mcp cli index_repository --repo-path "$PWD" --persistence true
```
