/** Extracts prompt text from various API response shapes. */
export function getPromptText(d: unknown): string {
  if (!d) return '';
  if (typeof d === 'string') return d;
  if (typeof d === 'object' && d !== null && 'prompt' in d && typeof (d as Record<string, unknown>).prompt === 'string')
    return (d as Record<string, unknown>).prompt as string;
  if (Array.isArray(d) && d.length) return getPromptText(d[0]);
  return '';
}
