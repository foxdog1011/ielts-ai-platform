import OpenAI from "openai";
import { calibrateOverall } from "@/lib/scoring/calibration";
import { diagnoseScores } from "@/lib/scoring/diagnosis";
import type { DiagnosisResult } from "@/lib/scoring/diagnosis";
import { runLocalWritingScore } from "@/lib/scoring/localAdapters";
import { scoreWritingWithLlm } from "@/lib/scoring/llmWritingRubric";
import type { ScoreDebugTrace, WritingScoreTrace, WritingSubscores01 } from "@/lib/scoring/types";
import { startTimer, toHalfBandFrom01, wordCount } from "@/lib/scoring/utils";
import { fuseWritingScores } from "@/lib/scoring/writingFusion";

export type WritingPipelineInput = {
  essay: string;
  prompt: string;
  taskId: string;
  taskType?: string;
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
    /** Injected for testing; defaults to diagnoseScores. Must not throw — errors are caught internally. */
    diagnosisFn?: typeof diagnoseScores;
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
    taskType: input.taskType ?? "task2",
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

  // TODO: local writing model outputs content_01/overall_01 but WritingSubscores01
  // needs tr_01/cc_01/lr_01/gra_01. Until the mapping is defined (in coordination
  // with ml/src/score_cli.py), local scores do not contribute to writing fusion.
  const localSubscores: Partial<WritingSubscores01> = {};
  if (localResult.ok && localResult.content_01 == null) flags.local_content_missing = true;

  const essayWords = wordCount(input.essay);
  let llmConfidence = llmResult.rubric.confidence_01;
  if (essayWords < 80) {
    llmConfidence = Math.max(0.2, llmConfidence * 0.6);
    flags.short_essay = true;
  }
  const localConfidence = 0; // local subscores not yet mapped; see TODO above

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

  // Diagnosis runs after flags are complete. Isolated: failure must not affect band/feedback.
  const diagnosisFn = deps?.diagnosisFn ?? diagnoseScores;
  let diagnosisResult: DiagnosisResult | undefined;
  try {
    diagnosisResult = diagnosisFn({
      examType: "writing",
      subscores: fused.finalSubscores,
      overallPre: fused.overall_01_pre_calibration,
      weights: fused.weights,
      flags,
      llmConfidence01: llmConfidence,
      localConfidence01: localConfidence,
    });
  } catch {
    // diagnosisResult stays undefined; scoring continues unaffected
  }

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
    /** additive, optional — undefined when diagnosisFn threw */
    diagnosisResult,
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
    } satisfies ScoreDebugTrace,
    words: essayWords,
  };
}
