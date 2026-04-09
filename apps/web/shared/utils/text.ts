// shared/utils/text.ts
//
// Shared text utilities.

/**
 * Counts the number of words in a text string.
 * Splits on whitespace after trimming.
 */
export function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t
    .replace(/\n/g, " ")
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean).length;
}
