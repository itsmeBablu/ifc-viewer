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
