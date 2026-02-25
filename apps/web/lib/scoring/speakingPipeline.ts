import OpenAI from "openai";
import { calibrateOverall } from "@/lib/scoring/calibration";
import { transcribeAudio } from "@/lib/scoring/asr";
import { scoreSpeakingWithLlm } from "@/lib/scoring/llmSpeakingRubric";
import { runLocalSpeakingScore } from "@/lib/scoring/localAdapters";
import { fuseSpeakingScores } from "@/lib/scoring/speakingFusion";
import type { SpeakingScoreTrace, SpeakingSubscores01 } from "@/lib/scoring/types";
import { startTimer, toHalfBandFrom01, wordCount } from "@/lib/scoring/utils";

export type SpeakingPipelineInput = {
  taskId: string;
  prompt?: string;
  audioBase64?: string;
  audioPath?: string;
  mime?: string;
  manualTranscript?: string;
  durationSec?: number;
};

export async function runSpeakingPipeline(
  input: SpeakingPipelineInput,
  deps?: {
    asrFn?: typeof transcribeAudio;
    localFn?: typeof runLocalSpeakingScore;
    llmFn?: typeof scoreSpeakingWithLlm;
    openaiClient?: OpenAI;
  }
) {
  const asrFn = deps?.asrFn ?? transcribeAudio;
  const localFn = deps?.localFn ?? runLocalSpeakingScore;
  const llmFn = deps?.llmFn ?? scoreSpeakingWithLlm;

  const flags: Record<string, boolean | number | string | null> = {};
  const timings: Record<string, number> = {};
  const timerAll = startTimer();

  const asrTimer = startTimer();
  const asr = await asrFn({
    manualTranscript: input.manualTranscript,
    audioBase64: input.audioBase64,
    audioPath: input.audioPath,
    mime: input.mime,
    client: deps?.openaiClient,
  });
  timings.asr_ms = asrTimer.elapsedMs();
  const transcript = asr.transcript.trim();

  const localTimer = startTimer();
  const local = await localFn({
    transcript,
    audioPath: input.audioPath,
  });
  timings.local_ms = localTimer.elapsedMs();
  if (!local.ok) flags.local_error = local.err ?? true;
  if (!input.audioPath) flags.local_audio_missing = true;

  let llmConfidence = 1;
  const transcriptWords = wordCount(transcript);
  if (transcriptWords < 12) {
    llmConfidence = 0.2;
    flags.transcript_too_short = true;
  } else if (transcriptWords < 25) {
    llmConfidence = 0.5;
    flags.transcript_short = true;
  }
  if (!transcript) {
    flags.transcript_empty = true;
  }

  const llmTimer = startTimer();
  const llm = await llmFn({
    transcript,
    prompt: input.prompt,
    client: deps?.openaiClient,
  });
  timings.llm_ms = llmTimer.elapsedMs();
  llmConfidence = Math.min(llmConfidence, llm.rubric.confidence_01);

  const localConfidence = local.ok && local.fluency_01 != null && local.pronunciation_01 != null ? 1 : 0;
  if (local.ok && local.fluency_01 == null) flags.local_missing_fluency = true;
  if (local.ok && local.pronunciation_01 == null) flags.local_missing_pronunciation = true;

  const fused = fuseSpeakingScores({
    llm: {
      content_01: llm.rubric.subscores.content_01,
      grammar_01: llm.rubric.subscores.grammar_01,
      vocab_01: llm.rubric.subscores.vocab_01,
    },
    local: {
      fluency_01: local.fluency_01,
      pronunciation_01: local.pronunciation_01,
    },
    llmConfidence01: llmConfidence,
    localConfidence01: localConfidence,
  });

  const calibration = await calibrateOverall({
    examType: "speaking",
    overall_01_pre: fused.overall_01_pre_calibration,
  });
  Object.assign(flags, fused.flags);
  if (calibration.calibration_missing_map) flags.calibration_missing_map = true;
  timings.total_ms = timerAll.elapsedMs();

  const trace: SpeakingScoreTrace = {
    llm_subscores: {
      content_01: llm.rubric.subscores.content_01,
      grammar_01: llm.rubric.subscores.grammar_01,
      vocab_01: llm.rubric.subscores.vocab_01,
    },
    local_subscores: {
      fluency_01: local.fluency_01,
      pronunciation_01: local.pronunciation_01,
    },
    weights: fused.weights,
    final_subscores: fused.finalSubscores,
    final_overall_pre_calibration: fused.overall_01_pre_calibration,
    final_overall_post_calibration: calibration.overall_01_post,
    final_band: calibration.band,
    debug_flags: flags,
    timings,
    models: {
      llm_model: llm.modelUsed,
      asr_model: asr.modelUsed,
      local_model: "ml/src/score_cli.py",
    },
  };

  const band = {
    overall: calibration.band,
    content: toHalfBandFrom01(fused.finalSubscores.content_01 ?? calibration.overall_01_post),
    grammar: toHalfBandFrom01(fused.finalSubscores.grammar_01 ?? calibration.overall_01_post),
    vocab: toHalfBandFrom01(fused.finalSubscores.vocab_01 ?? calibration.overall_01_post),
    fluency:
      fused.finalSubscores.fluency_01 == null ? null : toHalfBandFrom01(fused.finalSubscores.fluency_01),
    pronunciation:
      fused.finalSubscores.pronunciation_01 == null
        ? null
        : toHalfBandFrom01(fused.finalSubscores.pronunciation_01),
  };

  return {
    transcript,
    segments: asr.segments,
    band,
    speakingFeatures: local.speaking_features,
    feedback: llm.rubric.feedback,
    suggestions: llm.rubric.suggestions,
    tokensUsed: llm.tokensUsed,
    trace,
    debug: {
      exam_type: "speaking" as const,
      used_llm: true,
      used_local: local.ok,
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
  };
}
