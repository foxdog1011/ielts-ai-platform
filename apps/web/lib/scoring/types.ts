export type ExamType = "writing" | "speaking";

export type WritingSubscores01 = {
  tr_01: number | null;
  cc_01: number | null;
  lr_01: number | null;
  gra_01: number | null;
};

export type SpeakingSubscores01 = {
  content_01: number | null;
  grammar_01: number | null;
  vocab_01: number | null;
  fluency_01: number | null;
  pronunciation_01: number | null;
};

export type ScoreWeights = Record<string, { llm: number; local: number; combined: number }>;

export type ScoreDebugTrace = {
  exam_type: ExamType;
  used_llm: boolean;
  used_local: boolean;
  debug_flags: Record<string, boolean | number | string | null>;
  timings_ms: Record<string, number>;
  models: {
    llm_model?: string;
    asr_model?: string;
    local_model?: string;
  };
  calibration: {
    mode: "quantile" | "identity";
    map_version?: string;
    overall_01_pre: number;
    overall_01_post: number;
    band: number;
    calibration_missing_map: boolean;
  };
};

export type WritingScoreTrace = {
  llm_subscores: WritingSubscores01 | null;
  local_subscores: Partial<WritingSubscores01> | null;
  weights: ScoreWeights;
  final_subscores: WritingSubscores01;
  final_overall_pre_calibration: number;
  final_overall_post_calibration: number;
  final_band: number;
  debug_flags: Record<string, boolean | number | string | null>;
  timings: Record<string, number>;
  models: {
    llm_model?: string;
    local_model?: string;
  };
};

export type SpeakingScoreTrace = {
  llm_subscores: Pick<SpeakingSubscores01, "content_01" | "grammar_01" | "vocab_01"> | null;
  local_subscores: Pick<SpeakingSubscores01, "fluency_01" | "pronunciation_01"> | null;
  weights: ScoreWeights;
  final_subscores: SpeakingSubscores01;
  final_overall_pre_calibration: number;
  final_overall_post_calibration: number;
  final_band: number;
  debug_flags: Record<string, boolean | number | string | null>;
  timings: Record<string, number>;
  models: {
    llm_model?: string;
    asr_model?: string;
    local_model?: string;
  };
};

// Discriminated union — enables type-safe narrowing on scoreTrace at the history layer.
// kv.ts intentionally stays Record<string,unknown>; the cast happens once in history.ts.
export type WritingScoreTraceTagged = WritingScoreTrace & { exam_type: "writing" };
export type SpeakingScoreTraceTagged = SpeakingScoreTrace & { exam_type: "speaking" };
export type ScoreTrace = WritingScoreTraceTagged | SpeakingScoreTraceTagged;
