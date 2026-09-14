# AI modeling assistant setup

AI access requires Google sign-in. Manual modeling remains public. Projects remain in this browser's IndexedDB; signing in does not add cloud storage or synchronization.

Set these **server-only** variables in `.env.local` locally and in the deployment environment (never use `NEXT_PUBLIC_`):

```dotenv
AUTH_SECRET=<random secret, generate with openssl rand -base64 32>
AUTH_GOOGLE_ID=<Google OAuth client ID>
AUTH_GOOGLE_SECRET=<Google OAuth client secret>
AUTH_URL=http://localhost:3000
GEMINI_API_KEY=<Gemini API key from Google AI Studio>
```

Create a Google Cloud OAuth client of type Web application, configure the consent screen and permitted test users, and register `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI. Add the equivalent HTTPS callback for production and set AUTH_URL to that site's origin. Restart the development server after configuring variables.

Verify Google sign-in, session renewal, sign-out, and a rejected/cancelled login using real credentials. No credentials are committed. Implementation follows https://authjs.dev/getting-started/installation and https://authjs.dev/getting-started/providers/google.

The AI route uses `gemini-2.5-flash` through Google's server-side REST API. Keep the Google project on the free tier to enforce the intended cost policy; a model name alone does not disable billing in a paid project. There is no automatic model upgrade or retry. Review current quotas and data handling at https://ai.google.dev/gemini-api/docs/pricing. Commands and supplied model context are sent to Gemini only when the user submits a command.

Run `npm run lint` and `npm test` using Node 22.13+ (the repository's current Vitest/Vite dependencies cannot run on Node 20.11).

## Modeling workflow

Open a project, choose AI assistant, sign in, and enter a command. Essential missing requirements are asked as follow-up questions. Proposed changes show a schematic plan footprint, assumptions, and a numbered list of dimensions and references. Apply explicitly approves the entire batch; deletions also require a checked confirmation. Discard leaves the project unchanged. The assistant's Undo button undoes the whole batch, or use the editor's existing Undo/Redo.

The first release supports up to 150 actions per command and 1,000 context elements within a 256 KB request. Coordinates and dimensions are millimetres. Plan X/Y map to scene X/Z. Opening position is its centre distance from the wall start. New elements use temporary references that are remapped to application IDs together. Projects changed after a preview require regeneration.

Supported actions: create/update levels, straight walls, doors, windows, polygon floors, flat roofs and rectangular hip/gable/shed roofs, columns, beams, and catalog furniture/equipment. Delete actions must remove dependent openings before their wall. Constrained, grouped, or locked elements require manual editing. Connected MEP systems, stairs, structural/MEP engineering validation, collision-free room layouts, and cloud persistence are outside this first release. A proposed house remains an editable concept model, not a certified building design.

Client application uses a single IndexedDB transaction. No geometry is published until persistence succeeds, and the batch gets one shared undo snapshot. Tests cover malformed geometry, missing references, overlap/out-of-wall openings, stale previews, transaction rollback and undo/redo.
