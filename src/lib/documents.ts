/**
 * Document vault upload limits.
 *
 * Document bytes are persisted as base64 in the database (so downloads work on
 * any host — Vercel's serverless filesystem is ephemeral), which means the
 * whole file travels inside a single multipart POST body to `/api/documents`.
 *
 * Vercel Functions hard-cap request/response bodies at 4.5 MB and return
 * `413 FUNCTION_PAYLOAD_TOO_LARGE` for anything larger — the route handler
 * never even runs. That cap is NOT configurable, so files must be kept safely
 * under it up front (the cap below leaves headroom for multipart framing and
 * the other form fields) and rejected early with a clear, actionable error
 * instead of an opaque "could not save" failure.
 */
export const DOC_MAX_BYTES = 4 * 1024 * 1024; // 4 MiB — measured well under the 4.5 MB platform limit
export const DOC_MAX_BYTES_LABEL = "4 MB";

/** Human-readable byte size, e.g. "6.3 MB", "512 KB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "?";
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
  }
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
