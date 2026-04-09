// shared/utils/time.ts
//
// Shared time utilities. Extracted from coach.ts and history.ts
// to eliminate duplication of toEpochMs.

/**
 * Extracts an epoch millisecond timestamp from a record that may have
 * `ts` (epoch ms) or `createdAt` (ISO string). Returns 0 when neither
 * field yields a valid timestamp.
 */
export function toEpochMs(rec: { ts?: number; createdAt?: string }): number {
  if (typeof rec.ts === "number" && Number.isFinite(rec.ts)) return rec.ts;
  if (rec.createdAt) {
    const t = Date.parse(rec.createdAt);
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}
