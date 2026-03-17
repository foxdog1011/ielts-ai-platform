// apps/web/lib/agents/types.ts
//
// Canonical types for the agent pipeline.
// All agents receive AgentContext; all agents return a typed AgentStepResult.
// The orchestrator composes them into AgentPipelineResult.

import type { ExamType } from "@/lib/scoring/types";
import type { DiagnosisResult } from "@/lib/scoring/diagnosis";
import type { StudyPlan } from "@/lib/planner";
import type { CoachSnapshot } from "@/lib/coach";
import type { HistoryRecord } from "@/lib/history";

// ── Input ─────────────────────────────────────────────────────────────────────

/**
 * Everything the orchestrator receives from the scoring pipeline and route layer.
 * Passed unchanged to every agent — agents read only the fields they need.
 */
export type AgentContext = {
  examType: ExamType;
  /** taskId from the original request */
  sessionId: string;

  // ── Scoring pipeline outputs ───────────────────────────────────────────────
  band: Record<string, number | null | undefined>;
  /** Raw diagnosis already computed inside the scoring pipeline (pre-calibration). */
  pipelineDiagnosis: DiagnosisResult | undefined;
  /** Debug flags from the scoring trace (short_essay, transcript_too_short, etc.) */
  debugFlags: Record<string, boolean | number | string | null>;

  // ── LLM feedback strings from current session ──────────────────────────────
  /** writing: paragraphFeedback + improvements; speaking: feedback + suggestions */
  llmFeedback: string[];

  // ── Speaking-only prosodic features ───────────────────────────────────────
  /** wpm, pause_ratio, avg_pause_sec, etc. — present only for speaking sessions */
  speakingFeatures?: Record<string, unknown>;

  // ── Cross-session context ─────────────────────────────────────────────────
  /** Pre-fetched history (same slice the route fetches before calling the agent pipeline) */
  recentHistory: HistoryRecord[];
};

// ── Per-agent step results ────────────────────────────────────────────────────

/** Output of DiagnosisAgent */
export type DiagnosisAgentResult = {
  /** Unchanged pipeline diagnosis — consumers can always rely on this field. */
  diagnosisResult: DiagnosisResult;
  /**
   * Dimensions (e.g. "fluency_01", "lexical") from medium/high anomalies.
   * Deduplicated; empty when no anomalies target a specific dimension.
   */
  topWeaknesses: string[];
  /**
   * Anomaly codes that appeared in diagSummary across 2+ prior same-type sessions.
   * Empty for first-time users or when history lacks diagSummary data.
   */
  recurringIssues: string[];
  /**
   * One-paragraph plain-language summary of the diagnostic findings.
   * Always a non-empty string (falls back to "No significant issues detected.").
   */
  evidenceSummary: string;
  /** true when agent added information beyond a straight passthrough of pipelineDiagnosis */
  augmented: boolean;
  /** Ordered diagnostic notes, e.g. prosodic flags or missing-data warnings */
  notes: string[];
};

/** Output of PlannerAgent */
export type PlannerAgentResult = {
  studyPlan: StudyPlan;
  /**
   * Band-dimension names (e.g. "lexical", "fluency") that were elevated in
   * priority because they appeared in both topWeaknesses (current session) and
   * were backed by recurringIssues (cross-session anomaly codes).
   * Empty when no boost was applied.
   */
  boostedDimensions: string[];
  /** true when at least one dimension's priority was elevated by the recurring boost */
  recurringBoostApplied: boolean;
};

/** A single reviewer note: a machine-readable flag + optional message */
export type ReviewNote = {
  code: string;
  message: string;
  severity: "info" | "warning" | "block";
};

/** Output of ReviewerAgent */
export type ReviewerAgentResult = {
  /** false only when at least one "block"-severity note was emitted */
  approved: boolean;
  reviewNotes: ReviewNote[];
};

// ── Final orchestrator output ─────────────────────────────────────────────────

export type AgentPipelineResult = {
  diagnosisResult: DiagnosisResult;
  studyPlan: StudyPlan;
  reviewerResult: ReviewerAgentResult;
  /** Built last, after all agents succeed; undefined when coach build throws */
  coachSnapshot: CoachSnapshot | undefined;
  meta: {
    durationMs: number;
    /** Ordered list of agent names that ran */
    agentsRan: string[];
  };
};
