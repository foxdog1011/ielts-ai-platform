import OpenAI from "openai";
import { calibrateOverall } from "@/lib/scoring/calibration";
import { runLocalWritingScore } from "@/lib/scoring/localAdapters";
import { scoreWritingWithLlm } from "@/lib/scoring/llmWritingRubric";
import type { WritingScoreTrace, WritingSubscores01 } from "@/lib/scoring/types";
import { startTimer, toHalfBandFrom01, wordCount } from "@/lib/scoring/utils";
import { fuseWritingScores } from "@/lib/scoring/writingFusion";

export type WritingPipelineInput = {
  essay: string;
  prompt: string;
  taskId: string;
  targetWords?: number;
  seconds?: number;
};

export async function runWritingPipeline(
  input: WritingPipelineInput,
  deps?: {
    localFn?: typeof runLocalWritingScore;
    llmFn?: typeof scoreWritingWithLlm;
    now?: () => number;
    openaiClient?: OpenAI;
  }
) {
  const localFn = deps?.localFn ?? runLocalWritingScore;
  const llmFn = deps?.llmFn ?? scoreWritingWithLlm;

  const timerAll = startTimer();
  const flags: Record<string, boolean | number | string | null> = {};
  const timings: Record<string, number> = {};

  const localTimer = startTimer();
  const localResult = await localFn(input.essay);
  timings.local_ms = localTimer.elapsedMs();
  if (!localResult.ok) flags.local_error = localResult.err ?? true;

  const llmTimer = startTimer();
  const llmResult = await llmFn({
    essay: input.essay,
    taskType: input.taskId,
    promptContext: input.prompt,
    client: deps?.openaiClient,
  });
  timings.llm_ms = llmTimer.elapsedMs();

  const llmSubscores: WritingSubscores01 = {
    tr_01: llmResult.rubric.subscores.tr_01,
    cc_01: llmResult.rubric.subscores.cc_01,
    lr_01: llmResult.rubric.subscores.lr_01,
    gra_01: llmResult.rubric.subscores.gra_01,
  };

  const localSubscores: Partial<WritingSubscores01> = {};
  if (localResult.ok && localResult.content_01 == null) flags.local_content_missing = true;
  flags.local_missing_tr_01 = true;
  flags.local_missing_cc_01 = true;
  flags.local_missing_lr_01 = true;
  flags.local_missing_gra_01 = true;

  const essayWords = wordCount(input.essay);
  let llmConfidence = llmResult.rubric.confidence_01;
  if (essayWords < 80) {
    llmConfidence = Math.max(0.2, llmConfidence * 0.6);
    flags.short_essay = true;
  }
  const localConfidence = localResult.ok ? 0.5 : 0;

  const fused = fuseWritingScores({
    llm: llmSubscores,
    local: localSubscores,
    llmConfidence01: llmConfidence,
    localConfidence01: localConfidence,
  });

  const calibration = await calibrateOverall({
    examType: "writing",
    overall_01_pre: fused.overall_01_pre_calibration,
  });
  Object.assign(flags, fused.flags);
  if (calibration.calibration_missing_map) flags.calibration_missing_map = true;

  const finalBand = {
    overall: calibration.band,
    taskResponse: toHalfBandFrom01(fused.finalSubscores.tr_01 ?? calibration.overall_01_post),
    coherence: toHalfBandFrom01(fused.finalSubscores.cc_01 ?? calibration.overall_01_post),
    lexical: toHalfBandFrom01(fused.finalSubscores.lr_01 ?? calibration.overall_01_post),
    grammar: toHalfBandFrom01(fused.finalSubscores.gra_01 ?? calibration.overall_01_post),
  };

  timings.total_ms = timerAll.elapsedMs();

  const trace: WritingScoreTrace = {
    llm_subscores: llmSubscores,
    local_subscores: localSubscores,
    weights: fused.weights,
    final_subscores: fused.finalSubscores,
    final_overall_pre_calibration: fused.overall_01_pre_calibration,
    final_overall_post_calibration: calibration.overall_01_post,
    final_band: calibration.band,
    debug_flags: flags,
    timings,
    models: {
      llm_model: llmResult.modelUsed,
      local_model: "ml/src/score_cli.py",
    },
  };

  return {
    band: finalBand,
    paragraphFeedback: llmResult.rubric.paragraph_feedback,
    improvements: llmResult.rubric.improvements,
    rewritten: llmResult.rubric.rewritten,
    tokensUsed: llmResult.tokensUsed,
    trace,
    debug: {
      exam_type: "writing" as const,
      used_llm: true,
      used_local: localResult.ok,
      debug_flags: flags,
      timings_ms: timings,
      models: trace.models,
      calibration: {
        mode: calibration.mode,
        map_version: calibration.map_version,
        overall_01_pre: fused.overall_01_pre_calibration,
        overall_01_post: calibration.overall_01_post,
        band: calibration.band,
        calibration_missing_map: calibration.calibration_missing_map,
      },
    },
    words: essayWords,
  };
}
