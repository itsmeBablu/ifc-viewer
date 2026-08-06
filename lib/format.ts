/**
 * Small display-formatting helpers shared across the UI.
 * `formatBytesParts` splits a byte count into a value/unit pair (B/KB/MB/GB)
 * for tile-style display (e.g. the model summary size tile).
 */
export function formatBytesParts(bytes: number | null): {
  value: string;
  unit: string;
} {
  if (!Number.isFinite(bytes ?? NaN)) return { value: "—", unit: "" };
  const v = bytes as number;
  if (v <= 0) return { value: "0", unit: "B" };
  const units = ["B", "KB", "MB", "GB"] as const;
  let idx = 0;
  let n = v;
  while (n >= 1024 && idx < units.length - 1) {
    n /= 1024;
    idx += 1;
  }
  const digits = idx === 0 ? 0 : 1;
  return { value: n.toFixed(digits), unit: units[idx] as string };
}
