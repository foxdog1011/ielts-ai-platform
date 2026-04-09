// shared/domain/types.ts
//
// Single source of truth for domain types used across the IELTS platform.
// Extracted from lib/kv.ts and lib/history.ts.

/** Slim diagnosis summary persisted alongside a score. */
export type DiagSummary = {
  severity: "none" | "low" | "medium" | "high";
  anomalies: Array<{
    code: string;
    dimension?: string;
    severity: "low" | "medium" | "high";
  }>;
  engineConflict: boolean;
  lowConfidence: boolean;
};

/** Slim study-plan snapshot persisted for cross-session trend analysis. */
export type PlanSnapshot = {
  currentFocus?: { dimension: string; reason: string };
  nextTaskRecommendation: string;
  milestoneBand: number;
};

/** Payload shape for persisting a score entry. */
export type ScorePayload = {
  taskId: string;
  prompt?: string;
  durationSec?: number;
  words?: number;
  band?: Record<string, number | null | undefined>;
  speakingFeatures?: Record<string, unknown>;
  scoreTrace?: Record<string, unknown>;
  ts?: number;
  createdAt?: string;
  diagSummary?: DiagSummary;
  planSnapshot?: PlanSnapshot;
};

// ── History record types ────────────────────────────────────────────────────

export type WritingBand = {
  overall?: number;
  taskResponse?: number;
  coherence?: number;
  lexical?: number;
  grammar?: number;
};

export type SpeakingBand = {
  overall?: number;
  content?: number;
  grammar?: number;
  vocab?: number;
  fluency?: number;
  pronunciation?: number;
};

export type BaseRecord = {
  taskId: string;
  prompt?: string;
  durationSec?: number;
  scoreTrace?: Record<string, unknown>;
  ts?: number;
  createdAt?: string;
  diagSummary?: DiagSummary;
  planSnapshot?: PlanSnapshot;
};

export type WritingRecord = BaseRecord & {
  type: "writing";
  words?: number;
  band?: WritingBand | null;
};

export type SpeakingRecord = BaseRecord & {
  type: "speaking";
  band?: SpeakingBand | null;
  speakingFeatures?: Record<string, number | string | boolean>;
};

export type HistoryRecord = WritingRecord | SpeakingRecord;
