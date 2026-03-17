// apps/web/lib/agents/plannerAgent.ts
//
// PlannerAgent — Phase 3.
// Wraps buildStudyPlan() and augments its output using DiagnosisAgentResult:
//
//   recurringBoost:
//     When topWeaknesses (current-session weak dimensions) overlap with
//     dimension-relevant recurringIssues (cross-session anomaly patterns),
//     those dimensions are elevated to currentFocus with reason "repeated_weakness".
//     This ensures persistent cross-session problems are not overshadowed by a
//     single-session best-performer fluke.
//
// Rules (all deterministic; no LLM in Phase 3):
//   - Only dimension-relevant anomaly codes trigger boost (see BOOST_CODES)
//   - Boost is a post-process: studyPlan is fully built first, then amended
//   - planner.ts is never modified; backward-compatible
//
// mode: "rule" | "llm-augmented"
//   "rule"          — current implementation; fully deterministic
//   "llm-augmented" — reserved for Phase N; falls back to "rule" until implemented

import { buildStudyPlan } from "@/lib/planner";
import type { StudyPlan, CurrentFocus } from "@/lib/planner";
import type { AgentContext, DiagnosisAgentResult, PlannerAgentResult } from "@/lib/agents/types";

// ── Subscore → band dimension mapping (mirrors planner.ts SUBSCORE_TO_BAND_DIM) ─

const SUBSCORE_TO_BAND_DIM: Readonly<Record<string, string>> = {
  tr_01: "taskResponse",
  cc_01: "coherence",
  lr_01: "lexical",
  gra_01: "grammar",
  content_01: "content",
  grammar_01: "grammar",
  vocab_01: "vocab",
  fluency_01: "fluency",
  pronunciation_01: "pronunciation",
};

/**
 * Anomaly codes that are dimension-specific — only these codes justify
 * elevating a dimension's priority via the recurring boost.
 * Pipeline-level codes (LOW_LLM_CONFIDENCE, LOCAL_ENGINE_UNAVAILABLE) are
 * intentionally excluded: they reflect engine reliability, not learner weakness.
 */
const BOOST_CODES = new Set([
  "VERY_LOW_SUBSCORE",
  "SUBSCORE_BELOW_OVERALL",
  "FLUENCY_CONTENT_MISMATCH",
  "TRANSCRIPT_QUALITY",
]);

// ── Entry point ───────────────────────────────────────────────────────────────

export async function runPlannerAgent(
  ctx: AgentContext,
  diagnosisAgentResult: DiagnosisAgentResult,
  mode: "rule" | "llm-augmented" = "rule",
): Promise<PlannerAgentResult> {
  // "llm-augmented" is reserved; fall back to rule-based until implemented.
  void mode;

  // 1. Run the existing rule-based planner as base.
  const basePlan = await buildStudyPlan({
    examType: ctx.examType,
    currentBand: ctx.band as any, // safe: band shape matches PlannerInput union
    llmFeedback: ctx.llmFeedback,
    recentHistory: ctx.recentHistory,
    diagnosisResult: diagnosisAgentResult.diagnosisResult,
  });

  // 2. Compute boosted dimensions.
  const boostedDimensions = computeBoostedDimensions(diagnosisAgentResult);

  // 3. Apply boost: override currentFocus when warranted.
  const studyPlan = applyRecurringBoost(basePlan, boostedDimensions);
  const recurringBoostApplied =
    boostedDimensions.length > 0 &&
    studyPlan.currentFocus?.reason === "repeated_weakness" &&
    boostedDimensions.includes(studyPlan.currentFocus.dimension);

  return { studyPlan, boostedDimensions, recurringBoostApplied };
}

// ── Boost logic ───────────────────────────────────────────────────────────────

/**
 * Returns band-dimension names to boost.
 *
 * Criteria (both must be true):
 *   A. At least one entry in recurringIssues is a BOOST_CODE
 *      (dimension-relevant anomaly seen in 2+ prior sessions).
 *   B. topWeaknesses is non-empty (current session also flagged those dims).
 *
 * topWeaknesses may contain either subscore keys (e.g. "lr_01") or band
 * dimension names (e.g. "lexical"); both are normalised.
 */
function computeBoostedDimensions(diag: DiagnosisAgentResult): string[] {
  const { topWeaknesses, recurringIssues } = diag;
  if (topWeaknesses.length === 0) return [];
  if (!recurringIssues.some((c) => BOOST_CODES.has(c))) return [];

  // Normalise topWeaknesses to band dimension names.
  return topWeaknesses.map((tw) => SUBSCORE_TO_BAND_DIM[tw] ?? tw);
}

/**
 * Post-processes a StudyPlan to reflect the recurring boost.
 *
 * Rules:
 *   1. If currentFocus is already a boosted dimension → no change.
 *   2. If a boosted dimension exists in priorityDimensions AND is currently
 *      below overall (gapToOverall > 0) → override currentFocus.
 *   3. If a boosted dimension exists in priorityDimensions but is NOT below
 *      overall → still override (cross-session pattern takes precedence).
 *   4. boostedDimensions order determines which one is selected first.
 */
function applyRecurringBoost(plan: StudyPlan, boostedDimensions: string[]): StudyPlan {
  if (boostedDimensions.length === 0) return plan;

  // If currentFocus is already a boosted dimension, upgrade its reason to
  // "repeated_weakness" (cross-session signal is stronger than current_weakest).
  if (plan.currentFocus && boostedDimensions.includes(plan.currentFocus.dimension)) {
    if (plan.currentFocus.reason === "repeated_weakness") return plan; // already correct
    return {
      ...plan,
      currentFocus: { dimension: plan.currentFocus.dimension, reason: "repeated_weakness" },
    };
  }

  // currentFocus is a different dimension — find the first boosted dim in priorityDimensions.
  const target = boostedDimensions.find((bd) =>
    plan.priorityDimensions.some((d) => d.dimension === bd),
  );
  if (!target) return plan;

  return { ...plan, currentFocus: { dimension: target, reason: "repeated_weakness" } };
}
