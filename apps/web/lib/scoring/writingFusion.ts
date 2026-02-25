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

  const overall = weightedAverage01(
    OVERALL_DIM_WEIGHTS.map((d) => ({ score: finalSubscores[d.key], weight: d.weight }))
  );

  if (overall == null) {
    flags.no_dimension_for_overall = true;
    throw new Error("No valid writing subscores available for fusion");
  }

  return {
    finalSubscores,
    overall_01_pre_calibration: overall,
    weights,
    flags,
  };
}
