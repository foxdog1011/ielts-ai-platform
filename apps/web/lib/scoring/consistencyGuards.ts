/**
 * Cross-dimensional consistency guards for IELTS scoring fusion.
 *
 * Prevents contradictory score combinations (e.g., Grammar=Band 9, Vocab=Band 5)
 * by clamping outliers toward the median and applying anti-inflation rules.
 */

import { clamp01 } from "@/lib/scoring/utils";

// ---------------------------------------------------------------------------
// A. Cross-dimensional consistency: clamp outlier subscores toward the median
// ---------------------------------------------------------------------------

/**
 * Pulls outlier subscores toward the median so no two non-null scores
 * differ by more than `maxSpread` in 0-1 space.
 *
 * Returns a new record (immutable — original is not mutated).
 *
 * Example: median = 0.6, maxSpread = 0.2
 *   - a score of 0.9 is capped at 0.8  (median + 0.2)
 *   - a score of 0.3 is raised to 0.4  (median - 0.2)
 */
export function clampSubscores<K extends string>(
  scores: Record<K, number | null>,
  maxSpread: number = 0.2,
): { clamped: Record<K, number | null>; adjusted: boolean } {
  const keys = Object.keys(scores) as K[];
  const validValues = keys
    .map((k) => scores[k])
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);

  // Nothing to clamp when fewer than 2 non-null scores exist
  if (validValues.length < 2) {
    return { clamped: { ...scores }, adjusted: false };
  }

  const median =
    validValues.length % 2 === 1
      ? validValues[Math.floor(validValues.length / 2)]!
      : (validValues[validValues.length / 2 - 1]! + validValues[validValues.length / 2]!) / 2;

  const lo = clamp01(median - maxSpread);
  const hi = clamp01(median + maxSpread);

  let adjusted = false;
  const clamped = { ...scores };
  for (const k of keys) {
    const v = clamped[k];
    if (v == null) continue;
    if (v < lo) {
      clamped[k] = lo as typeof clamped[K];
      adjusted = true;
    } else if (v > hi) {
      clamped[k] = hi as typeof clamped[K];
      adjusted = true;
    }
  }

  return { clamped, adjusted };
}

// ---------------------------------------------------------------------------
// B. Anti-inflation guard: cap overall when subscores do not justify Band 8+
// ---------------------------------------------------------------------------

/** Threshold in 0-1 space above which anti-inflation kicks in (~Band 8). */
const HIGH_OVERALL_THRESHOLD = 0.85;
/** Minimum subscore required to justify a high overall. */
const MIN_SUBSCORE_FOR_HIGH = 0.7;
/** Overall is capped to this value when any subscore is below MIN_SUBSCORE_FOR_HIGH. */
const CAPPED_OVERALL = 0.8;

/**
 * If `overall_01` exceeds the high-band threshold but any subscore is
 * below the minimum, the overall is capped. Returns a new value (immutable).
 */
export function applyAntiInflation(
  overall_01: number,
  subscores: Record<string, number | null>,
): { overall_01: number; inflationCapped: boolean } {
  if (overall_01 <= HIGH_OVERALL_THRESHOLD) {
    return { overall_01, inflationCapped: false };
  }

  const values = Object.values(subscores).filter((v): v is number => v != null);
  const anyBelowMin = values.some((v) => v < MIN_SUBSCORE_FOR_HIGH);

  if (anyBelowMin) {
    return { overall_01: Math.min(overall_01, CAPPED_OVERALL), inflationCapped: true };
  }

  return { overall_01, inflationCapped: false };
}

// ---------------------------------------------------------------------------
// C. Bias detection: warn when overall suggests Band 9 over-prediction
// ---------------------------------------------------------------------------

const BAND_9_THRESHOLD = 0.9;

/**
 * Emits a console.warn when the overall score is suspiciously high,
 * logging the raw subscores for debugging.
 */
export function warnIfOverprediction(
  overall_01: number,
  subscores: Record<string, number | null>,
  examType: string,
): void {
  if (overall_01 > BAND_9_THRESHOLD) {
    console.warn(
      `[scoring][${examType}] Potential Band 9 over-prediction: overall_01=${overall_01.toFixed(3)}. ` +
        `Raw subscores: ${JSON.stringify(subscores)}`,
    );
  }
}
