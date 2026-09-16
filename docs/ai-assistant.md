# Current AI workflow

See [AI BIM modeling](bim/README.md) for the current direct-drawing workflow, Arch/MEP defaults and Ollama setup. Build now applies validated changes automatically; the preview-approval descriptions below document the earlier release. The current app request allowance is 1,500 per 24 hours with counted memory fallback when Redis is unavailable. It does not represent Google provider quota.

Gemini loads relevant runtime [creation playbooks](../lib/ai/playbooks/README.md) and focused action schemas/catalogue rows. It interprets the brief; code expands bounded recipes and validates the entire batch. The chat shows actual input/output/thinking tokens reported by Gemini after successful requests. The live typing estimate covers only the user's message, and model output limits are ceilings rather than tokens charged automatically.

Temporary server/network errors are retried at most twice with backoff on the same selected Gemini model, under one overall deadline. Google quota, key, model-access, request-schema and invalid-output errors are not retried or silently sent to Ollama. Error responses distinguish Gemini quota (HTTP 429) from app requests, with app usage headers retained.

# AI modeling assistant setup

AI access requires Google sign-in. Manual modeling remains public. Projects remain in this browser's IndexedDB; signing in does not add cloud storage or synchronization.

Set these **server-only** variables in `.env.local` locally and in the deployment environment (never use `NEXT_PUBLIC_`):

```dotenv
AUTH_SECRET=<random secret, generate with openssl rand -base64 32>
AUTH_GOOGLE_ID=<Google OAuth client ID>
AUTH_GOOGLE_SECRET=<Google OAuth client secret>
AUTH_URL=http://localhost:3000
GEMINI_API_KEY=<Gemini API key from Google AI Studio>
GEMINI_MODEL=gemini-3.1-flash-lite
UPSTASH_REDIS_REST_URL=<Upstash Redis REST URL>
UPSTASH_REDIS_REST_TOKEN=<Upstash Redis REST token>
```

An empty template is available in `.env.example`. Copy missing entries into `.env.local` beside `package.json`; preserve existing credentials. The real `.env.local` is ignored by Git. Keep these variables server-only.

## Where to copy the values

1. **Gemini API key:** open [Google AI Studio API Keys](https://aistudio.google.com/app/apikey), select or create a project, choose **Create API key**, and copy it into `GEMINI_API_KEY`. If your existing Cloud project is absent, import it from AI Studio's Projects page first. See [Google's key setup instructions](https://ai.google.dev/gemini-api/docs/api-key).
2. **Redis URL and token:** open [Upstash Console](https://console.upstash.com/), create or select a **Redis** database, then open its **Details / REST API** connection section. Copy `UPSTASH_REDIS_REST_URL` (an HTTPS URL) and `UPSTASH_REDIS_REST_TOKEN` (the read/write token). Do not use the `redis://` connection string, Redis password, or read-only token. The limiter needs writes. [Upstash connection instructions](https://upstash.com/docs/redis/howto/connect-with-upstash-redis).
3. **Google sign-in:** keep your existing `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and `AUTH_SECRET`. For a new setup, the first two come from [Google Cloud OAuth clients](https://console.cloud.google.com/auth/clients), client type **Web application**. Generate `AUTH_SECRET` locally with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` and paste the output into your private environment file.

Google sign-in only establishes the user's identity. Every AI request in this app uses the server's `GEMINI_API_KEY`; it does not use the signed-in user's Google AI Pro subscription or OAuth token. AI Pro benefits in AI Studio do not automatically configure this server. Check model access, quota and billing for the API key's project in AI Studio. [Google's subscription and API explanation](https://blog.google/innovation-and-ai/technology/developers-tools/google-one-ai-studio/).

## Localhost and Vercel

Register both exact Google authorized redirect URIs:

```text
http://localhost:3000/api/auth/callback/google
https://ibv-viewer.vercel.app/api/auth/callback/google
```

There is no `/werkzeug` prefix on authentication routes. Authorized JavaScript origins are `http://localhost:3000` and `https://ibv-viewer.vercel.app`.

Locally use `AUTH_URL=http://localhost:3000`, then restart `npm run dev` after changing credentials. In Vercel **Project Settings > Environment Variables**, add the Gemini, Redis and existing authentication values to **Production**, using `AUTH_URL=https://ibv-viewer.vercel.app`. Redeploy after saving. `.env.local` is not uploaded to Vercel. If using Preview deployments, configure that environment separately with its own correct origin and Google callback.

Redis stores per-account request counters, not projects or chat. It lets all production instances enforce the same 10-requests-per-10-minutes limit. Missing production Redis credentials stop requests before Gemini; successful Google login alone therefore does not prove AI is ready.

## Token use and chat behavior

The prompt sends the catalogue as compact rows, removes duplicate identity/persistence fields from model context, and includes at most 12,000 characters of complete recent conversation turns. Geometry and element references remain available for validation. Gemini uses minimal thinking, concise replies and an 8,192-token output ceiling. Large irregular builds should be split into batches; truncated output is rejected rather than partially applied. Requests are never automatically retried.

Files are sent with the first message after attaching them. They stay visible for reuse, but are not automatically resent on every follow-up: check **Include files with next message** when another image/PDF read is necessary. After a failed request this option is restored for retry. Actual token savings depend on the project and attachments.

Sending clears the composer immediately. Failures, timeouts and unusable responses appear in the conversation, with **Edit and resend last message** to recover the command. Proposed geometry still requires explicit preview approval before application.

Verify Google sign-in, session renewal, sign-out, and a rejected/cancelled login using real credentials. No credentials are committed. Implementation follows https://authjs.dev/getting-started/installation and https://authjs.dev/getting-started/providers/google.

The AI route defaults to `gemini-3.1-flash-lite` through Google's server-side REST API. Optionally set `GEMINI_MODEL=gemini-3.5-flash-lite` to use the newer economy model. Only these two models are accepted; there is no automatic upgrade to Flash/Pro or retry on failure. A model name does not disable billing on a paid project. Review current quotas, prices and data handling at https://ai.google.dev/gemini-api/docs/pricing. Commands and supplied model context are sent to Gemini only when the user submits a command.

## Faster creation with modeling recipes

The model can now emit a compact recipe instead of writing every element's full geometry:

| Recipe | Code generates |
| --- | --- |
| `rectangular_shell` | Four walls, plus an optional floor and roof, on a specified level |
| `wall_path` | Connected straight wall segments from shared points and dimensions |
| `window_row` | Equally spaced windows with shared dimensions on one host wall |
| `equipment_grid` | Rows/columns of the same catalogue item with specified spacing |

Recipes can be mixed with explicit level creation, individual elements, irregular geometry and edits in the same plan. They are expanded on the server into the normal editable elements before preview. The 150-element limit applies **after expansion**. Computed coordinates, IDs, host references, opening overlaps and roof geometry still pass normal validation on both server and client. Applying remains one IndexedDB transaction, one model update and one undo step. Only changed collections are copied; unaffected geometry retains its array references.

For shells, the origin and spans describe wall centrelines; slabs extend to exterior wall faces. Roof height equals wall height above the level. Recipes do not infer interior rooms, openings, spacing or consequential dimensions. Repeated equipment is placement only, not collision-aware room planning. Explicit dimensional requests let the assistant build immediately; missing essential details still produce a question.

Example: “On the ground floor, make an 8 m by 6 m wall-centre shell at (0, 0), height 3 m, walls 200 mm, floor 200 mm and flat roof 200 mm. No openings.” Or: “Place 100 dining chairs in 10 rows and 10 columns, first centre (0, 0), X spacing 1000 mm, Y spacing 1500 mm, rotation 0, elevation 0.”

The September 2026 live smoke check with ordinary dimensional prompts returned a validated shell with three windows (nine elements) in about 1.6 seconds and a 100-chair grid in about 1.2 seconds using Flash-Lite. The grid required 140 generated tokens; code expanded the 187-character action into 100 elements. These are individual preview-generation observations, not latency guarantees or measurements of browser rendering. Actual cost and time depend on model load, context, attachments and requested geometry.

Run `npm run lint` and `npm test` using Node 22.13+ (the repository's current Vitest/Vite dependencies cannot run on Node 20.11).

## Modeling workflow

Open a project, choose AI assistant, sign in, and enter a command. Essential missing requirements are asked as follow-up questions. Proposed changes show a schematic plan footprint, assumptions, and a numbered list of dimensions and references. Apply explicitly approves the entire batch; deletions also require a checked confirmation. Discard leaves the project unchanged. The assistant's Undo button undoes the whole batch, or use the editor's existing Undo/Redo.

The first release supports up to 150 actions per command and 1,000 context elements within a 256 KB request. Coordinates and dimensions are millimetres. Plan X/Y map to scene X/Z. Opening position is its centre distance from the wall start. New elements use temporary references that are remapped to application IDs together. Projects changed after a preview require regeneration.

Supported actions: create/update levels, straight walls, doors, windows, polygon floors, flat roofs and rectangular hip/gable/shed roofs, columns, beams, and catalog furniture/equipment. Delete actions must remove dependent openings before their wall. Constrained, grouped, or locked elements require manual editing. Connected MEP systems, stairs, structural/MEP engineering validation, collision-free room layouts, and cloud persistence are outside this first release. A proposed house remains an editable concept model, not a certified building design.

Client application uses a single IndexedDB transaction. No geometry is published until persistence succeeds, and the batch gets one shared undo snapshot. Tests cover malformed geometry, missing references, overlap/out-of-wall openings, stale previews, transaction rollback and undo/redo.

## Request limits

Create an Upstash Redis database and copy its REST URL and token into the server environment. AI requests use a sliding window of 10 requests per 10 minutes per authenticated Google account ID. Clarification turns count as requests. IP addresses and client-supplied IDs are not used. Limits survive deployment replicas and new sessions. Exhaustion returns HTTP 429 with Retry-After; missing Redis configuration, errors, or timeouts return 503 and prevent Gemini calls. Configure Upstash before trying the text or voice pipeline. See https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms.

For local development only, if these two variables are absent, the server uses a per-user in-memory fallback with the same 10-per-10-minute limit. It resets when the dev server restarts and must not be used as a production substitute. Production still requires Upstash and fails closed when it is missing or unreachable.

## Voice and device verification

Dictate command uses SpeechRecognition or webkitSpeechRecognition on secure origins. Choose English or German, grant microphone permission, speak, review the resulting text, then Send. There is no separate voice endpoint or automatic execution. Permission denial, absent microphone, missing API, no speech, or speech-service failures keep text input available. Closing the panel releases recognition. Browser recognition may use online services; this is not a promise of offline or on-device audio processing. See https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition.

Before release, use an actual iPad in Safari to test microphone approval/denial, dictation, stop, interrupted recognition, panel close, keyboard layout, text fallback, and the same preview/apply/undo loop. Repeat in desktop Chrome. Emulation and mocked recognition test logic and layout but do not establish real iOS microphone support. Live OAuth/Gemini/Redis and physical-device speech verification require configured services/devices and are not covered by mocked tests.

Implementation verification: production build passes; lint reports no errors (existing repository warnings remain); 120 automated tests pass under Node 22. Chromium smoke checks passed for anonymous manual project creation, the AI sign-in gate, mocked-session typed preview/apply/undo, portrait and landscape iPad-size panel bounds, and mocked prefixed voice transcription requiring an explicit Send. No browser page errors were reported. Live service credentials were not present during implementation.
