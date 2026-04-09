import { applyAntiInflation, clampSubscores, warnIfOverprediction } from "@/lib/scoring/consistencyGuards";
import type { ScoreWeights, WritingSubscores01 } from "@/lib/scoring/types";
import { clamp01, weightedAverage01 } from "@/lib/scoring/utils";

const OVERALL_DIM_WEIGHTS: Array<{ key: keyof WritingSubscores01; weight: number }> = [
  { key: "tr_01", weight: 0.3 },
  { key: "cc_01", weight: 0.25 },
  { key: "lr_01", weight: 0.25 },
  { key: "gra_01", weight: 0.2 },
];

export function fuseWritingScores(input: {
  llm: WritingSubscores01 | null;
  local: Partial<WritingSubscores01> | null;
  llmConfidence01: number;
  localConfidence01: number;
}) {
  const flags: Record<string, boolean | number | string | null> = {};
  const weights: ScoreWeights = {};
  const finalSubscores: WritingSubscores01 = {
    tr_01: null,
    cc_01: null,
    lr_01: null,
    gra_01: null,
  };

  for (const dim of Object.keys(finalSubscores) as Array<keyof WritingSubscores01>) {
    const llmScore = input.llm?.[dim] ?? null;
    const localScore = input.local?.[dim] ?? null;
    const llmWeight = llmScore == null ? 0 : clamp01(input.llmConfidence01);
    const localWeight = localScore == null ? 0 : clamp01(input.localConfidence01);
    const combined = llmWeight + localWeight;

    weights[dim] = { llm: llmWeight, local: localWeight, combined };

    if (combined <= 0) {
      flags[`missing_${dim}`] = true;
      finalSubscores[dim] = null;
      continue;
    }

    const fused =
      ((llmScore ?? 0) * llmWeight + (localScore ?? 0) * localWeight) /
      combined;
    finalSubscores[dim] = clamp01(fused);

    if (localScore == null) flags[`local_missing_${dim}`] = true;
    if (llmScore == null) flags[`llm_missing_${dim}`] = true;
  }

  // --- Step A: Cross-dimensional consistency ---
  // Pull outlier subscores toward the median so no two differ by > 0.2 in 0-1 space.
  const { clamped: consistentSubscores, adjusted: subscoresAdjusted } =
    clampSubscores(finalSubscores);
  if (subscoresAdjusted) flags.subscores_consistency_adjusted = true;

  const overall = weightedAverage01(
    OVERALL_DIM_WEIGHTS.map((d) => ({ score: consistentSubscores[d.key], weight: d.weight }))
  );

  if (overall == null) {
    flags.no_dimension_for_overall = true;
    throw new Error("No valid writing subscores available for fusion");
  }

  // --- Step B: Anti-inflation guard ---
  // If overall > 0.85 (~Band 8+), all subscores must be > 0.7; otherwise cap at 0.8.
  const { overall_01: guardedOverall, inflationCapped } =
    applyAntiInflation(overall, consistentSubscores);
  if (inflationCapped) flags.anti_inflation_capped = true;

  // --- Step C: Bias detection logging ---
  warnIfOverprediction(guardedOverall, consistentSubscores, "writing");

  return {
    finalSubscores: consistentSubscores,
    overall_01_pre_calibration: guardedOverall,
    weights,
    flags,
  };
}
