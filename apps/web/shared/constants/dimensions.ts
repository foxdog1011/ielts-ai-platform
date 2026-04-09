// shared/constants/dimensions.ts
//
// Single source of truth for IELTS dimension labels, band ranges, and subscore keys.
// Extracted from coach.ts and weeklySummary.ts to eliminate duplication.

/** Map internal dim keys to readable labels used in natural-language strings. */
export const DIM_LABELS: Readonly<Record<string, string>> = {
  // writing
  taskResponse: "Task Response",
  coherence: "Coherence",
  lexical: "Vocabulary",
  grammar: "Grammar",
  // speaking
  content: "Content",
  vocab: "Vocabulary",
  fluency: "Fluency",
  pronunciation: "Pronunciation",
  // 01-suffixed keys (from diagnosis / scoring)
  content_01: "Content",
  grammar_01: "Grammar",
  vocab_01: "Vocabulary",
  fluency_01: "Fluency",
  pronunciation_01: "Pronunciation",
  tr_01: "Task Response",
  cc_01: "Coherence",
  lr_01: "Vocabulary",
  gra_01: "Grammar",
};

/** Convert an internal dimension key to a human-readable label. */
export function friendlyDim(dim: string): string {
  return DIM_LABELS[dim] ?? dim;
}

/** IELTS band ranges for display / validation. */
export const BAND_RANGE = { min: 0, max: 9, step: 0.5 } as const;

/** Writing subscore keys (band-level). */
export const WRITING_BAND_KEYS = [
  "taskResponse",
  "coherence",
  "lexical",
  "grammar",
] as const;

/** Speaking subscore keys (band-level). */
export const SPEAKING_BAND_KEYS = [
  "content",
  "grammar",
  "vocab",
  "fluency",
  "pronunciation",
] as const;

/** Writing subscore keys (0-1 normalized). */
export const WRITING_SUBSCORE_01_KEYS = [
  "tr_01",
  "cc_01",
  "lr_01",
  "gra_01",
] as const;

/** Speaking subscore keys (0-1 normalized). */
export const SPEAKING_SUBSCORE_01_KEYS = [
  "content_01",
  "grammar_01",
  "vocab_01",
  "fluency_01",
  "pronunciation_01",
] as const;
