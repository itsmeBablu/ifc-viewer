# AI BIM modeling

Gemini remains the default provider. Select **Ollama · Local** in the model selector to use the second provider. No provider is substituted automatically.

## Ollama setup

Install and start Ollama on the machine running Next.js. Choose an installed text model using `ollama list`; pull your chosen model with `ollama pull <model-name>`. Set server-only values in `.env.local`:

```dotenv
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=<installed-model-name>
```

Restart the app after configuration. Ollama uses `/api/chat` with JSON-schema structured output; results pass the same geometry validation and IndexedDB persistence as Gemini. Google sign-in remains required. Text only: attachments require Gemini. On a hosted deployment, localhost refers to the deployment server, not the user's computer. Configure a reachable private Ollama service there.

## Defaults

`lib/bim/defaults.ts` centralizes architectural wall, slab, ceiling, storey, opening, circulation, room and roof dimensions, plus MEP sizes, equipment envelopes, spacing, clearance, service-zone and elevation defaults. Both providers receive these defaults. Existing project dimensions and explicit prompt dimensions take precedence. These are concept modeling assumptions, not engineering calculations or regulatory requirements.

## Arch and MEP

Both workspace disciplines remain available and are sent with each command. MEP prompts preserve architecture unless explicitly asked to change it. AI supports ducts, duct runs, pipes, pipe runs, pipe slope and cable trays using existing 3D geometry. The existing fittings engine derives duct/pipe elbows, tees, crosses and reducers from route junctions; fittings are not standalone AI actions.

The equipment catalog contains radiators, heaters, boilers, heat pumps, chillers, fan coils, AC units, air terminals, supply diffusers, extract grilles, sprinklers, plumbing fixtures and electrical equipment. AHUs, fans and valves have labeled generic equipment envelopes using the existing renderer; these are placement models without detailed internals or connector simulation.

## Direct drawing

Build switches to the coordinated 3D view. Workspace pointer, touch and keyboard input is blocked while the request and application run, including panel close and editor shortcuts. Validated plans apply automatically, including requested deletions, with one batch Undo. Review and Guide do not change geometry. Errors and clarifications release the lock. Browser navigation/closing the tab cannot be prevented reliably.

The complete response is validated and saved in one atomic transaction before committed geometry is revealed in small visual batches. This is progressive display after generation, not token-by-token geometry streaming. Invalid or incomplete provider responses are never partially applied.

The displayed app allowance counts app requests, not Gemini quota. Gemini can return temporary upstream errors despite remaining allowance. Select another Gemini model or explicitly select Ollama; this cannot increase Google's quota or guarantee service availability.

Sources: [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs), [Gemini troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting).
