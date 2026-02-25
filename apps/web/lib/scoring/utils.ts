export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function safeNumber(input: unknown): number | null {
  if (typeof input !== "number" || Number.isNaN(input) || !Number.isFinite(input)) return null;
  return input;
}

export function safeScore01(input: unknown): number | null {
  const n = safeNumber(input);
  return n == null ? null : clamp01(n);
}

export function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t
    .replace(/\n/g, " ")
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean).length;
}

export function startTimer() {
  const startedAt = Date.now();
  return {
    elapsedMs: () => Date.now() - startedAt,
  };
}

export function toHalfBandFrom01(score01: number): number {
  const band = 4 + 5 * clamp01(score01);
  return Math.round(band * 2) / 2;
}

export function weightedAverage01(items: Array<{ score: number | null; weight: number }>): number | null {
  let weightSum = 0;
  let total = 0;
  for (const it of items) {
    if (it.score == null || it.weight <= 0) continue;
    weightSum += it.weight;
    total += it.score * it.weight;
  }
  if (weightSum <= 0) return null;
  return clamp01(total / weightSum);
}
