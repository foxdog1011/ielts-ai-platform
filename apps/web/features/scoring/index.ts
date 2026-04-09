// features/scoring/index.ts — public API for shared scoring utilities
export { calibrateOverall } from "./calibration";
export { diagnoseScores } from "./diagnosis";
export type { DiagnosisResult, DiagnosisInput, Anomaly, AnomalySeverity } from "./diagnosis";
export { clampSubscores, applyAntiInflation, warnIfOverprediction } from "./consistency-guards";
export { runLocalWritingScore, runLocalSpeakingScore } from "./local-adapters";
export { clamp01, safeNumber, safeScore01, wordCount, startTimer, toHalfBandFrom01, weightedAverage01 } from "./utils";
export type {
  ExamType,
  WritingSubscores01,
  SpeakingSubscores01,
  ScoreWeights,
  ScoreDebugTrace,
  WritingScoreTrace,
  SpeakingScoreTrace,
  ScoreTrace,
} from "./types";
export { WritingLlmRubricSchema, SpeakingLlmRubricSchema } from "./schemas";
export type { WritingLlmRubric, SpeakingLlmRubric } from "./schemas";
