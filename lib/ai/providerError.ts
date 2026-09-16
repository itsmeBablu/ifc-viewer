/** Only safe, user-facing provider details may leave the server. */
export class GeminiError extends Error {
  constructor(message: string, readonly code: string, readonly status = 502, readonly retryAfter?: number) {
    super(message);
    this.name = "GeminiError";
  }
}
