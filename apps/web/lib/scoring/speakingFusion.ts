import type { ScoreWeights, SpeakingSubscores01 } from "@/lib/scoring/types";
import { clamp01, weightedAverage01 } from "@/lib/scoring/utils";

const OVERALL_DIM_WEIGHTS: Array<{ key: keyof SpeakingSubscores01; weight: number }> = [
  { key: "content_01", weight: 0.25 },
  { key: "grammar_01", weight: 0.2 },
  { key: "vocab_01", weight: 0.2 },
  { key: "fluency_01", weight: 0.175 },
  { key: "pronunciation_01", weight: 0.175 },
];

export function fuseSpeakingScores(input: {
  llm: Pick<SpeakingSubscores01, "content_01" | "grammar_01" | "vocab_01"> | null;
  local: Pick<SpeakingSubscores01, "fluency_01" | "pronunciation_01"> | null;
  llmConfidence01: number;
  localConfidence01: number;
}) {
  const flags: Record<string, boolean | number | string | null> = {};
  const weights: ScoreWeights = {};
  const finalSubscores: SpeakingSubscores01 = {
    content_01: null,
    grammar_01: null,
    vocab_01: null,
    fluency_01: null,
    pronunciation_01: null,
  };

  const dims = Object.keys(finalSubscores) as Array<keyof SpeakingSubscores01>;
  for (const dim of dims) {
    const llmScore = dim === "content_01" || dim === "grammar_01" || dim === "vocab_01" ? input.llm?.[dim] ?? null : null;
    const localScore = dim === "fluency_01" || dim === "pronunciation_01" ? input.local?.[dim] ?? null : null;
    const llmWeight = llmScore == null ? 0 : clamp01(input.llmConfidence01);
    const localWeight = localScore == null ? 0 : clamp01(input.localConfidence01);
    const combined = llmWeight + localWeight;
    weights[dim] = { llm: llmWeight, local: localWeight, combined };

    if (combined <= 0) {
      flags[`missing_${dim}`] = true;
      finalSubscores[dim] = null;
      continue;
    }

    const fused = ((llmScore ?? 0) * llmWeight + (localScore ?? 0) * localWeight) / combined;
    finalSubscores[dim] = clamp01(fused);

    if (llmScore == null) flags[`llm_missing_${dim}`] = true;
    if (localScore == null) flags[`local_missing_${dim}`] = true;
  }

  const overall = weightedAverage01(
    OVERALL_DIM_WEIGHTS.map((d) => ({ score: finalSubscores[d.key], weight: d.weight }))
  );
  if (overall == null) {
    flags.no_dimension_for_overall = true;
    throw new Error("No valid speaking subscores available for fusion");
  }

  return {
    finalSubscores,
    overall_01_pre_calibration: overall,
    weights,
    flags,
  };
}
