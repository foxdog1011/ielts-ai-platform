// apps/web/lib/agents/reviewerAgent.ts
//
// ReviewerAgent — Phase 4.
// Validates cross-agent consistency of DiagnosisAgentResult × PlannerAgentResult.
//
// Rules (all deterministic; no LLM):
//   TASK_MISSING               (warning)  nextTaskRecommendation absent or empty
//   PLAN_FOCUS_UNSET           (info)     currentFocus not set
//   HIGH_SEVERITY_NO_FOCUS     (warning)  diagnosis severity=high but no currentFocus
//   BOOST_INCONSISTENCY        (warning)  recurringBoostApplied=true but currentFocus not in boostedDimensions
//   BOOST_REASON_OVERRIDE      (info)     boost only changed reason, not actual focus decision
//   LOW_CONFIDENCE_NO_RELIABILITY_NOTE (info)  lowConfidence or engineConflict but reliabilityNote absent
//   ALL_BANDS_EQUAL            (info)     all non-overall band values equal overall (suspicious input)
//   DIAGNOSIS_PLANNER_MISMATCH (warning)  topWeaknesses contain dims absent from priorityDimensions

import type { DiagnosisAgentResult, PlannerAgentResult, ReviewerAgentResult, ReviewNote } from "@/lib/agents/types";

// ── Entry point ───────────────────────────────────────────────────────────────

export async function runReviewerAgent(
  diagnosisResult: DiagnosisAgentResult,
  plannerResult: PlannerAgentResult,
): Promise<ReviewerAgentResult> {
  const notes: ReviewNote[] = [];
  const { studyPlan, boostedDimensions, recurringBoostApplied } = plannerResult;
  const { diagnosisResult: diag, topWeaknesses } = diagnosisResult;

  // ── Rule 1: TASK_MISSING ──────────────────────────────────────────────────
  if (!studyPlan.nextTaskRecommendation) {
    notes.push({
      code: "TASK_MISSING",
      message: "Planner did not produce a nextTaskRecommendation.",
      severity: "warning",
    });
  }

  // ── Rule 2: PLAN_FOCUS_UNSET ──────────────────────────────────────────────
  if (!studyPlan.currentFocus) {
    notes.push({
      code: "PLAN_FOCUS_UNSET",
      message: "Planner did not identify a currentFocus dimension.",
      severity: "info",
    });
  }

  // ── Rule 3: HIGH_SEVERITY_NO_FOCUS ────────────────────────────────────────
  if (diag.severity === "high" && !studyPlan.currentFocus) {
    notes.push({
      code: "HIGH_SEVERITY_NO_FOCUS",
      message:
        "Diagnosis severity is high but planner has no currentFocus — learner may need manual review.",
      severity: "warning",
    });
  }

  // ── Rule 4: BOOST_INCONSISTENCY ───────────────────────────────────────────
  // recurringBoostApplied=true but currentFocus dim is not in boostedDimensions
  if (
    recurringBoostApplied &&
    studyPlan.currentFocus &&
    !boostedDimensions.includes(studyPlan.currentFocus.dimension)
  ) {
    notes.push({
      code: "BOOST_INCONSISTENCY",
      message: `recurringBoostApplied=true but currentFocus dimension "${studyPlan.currentFocus.dimension}" is not in boostedDimensions [${boostedDimensions.join(", ")}].`,
      severity: "warning",
    });
  }

  // ── Rule 5: BOOST_REASON_OVERRIDE ────────────────────────────────────────
  // Boost changed the reason to "repeated_weakness" but the focus dim was
  // already the plan's natural choice (i.e. it was already currentFocus before boost).
  // Detectable when: recurringBoostApplied=true, currentFocus.reason="repeated_weakness",
  // AND that dim was already first in priorityDimensions (natural focus).
  if (
    recurringBoostApplied &&
    studyPlan.currentFocus?.reason === "repeated_weakness" &&
    studyPlan.priorityDimensions.length > 0 &&
    studyPlan.priorityDimensions[0].dimension === studyPlan.currentFocus.dimension &&
    boostedDimensions.includes(studyPlan.currentFocus.dimension)
  ) {
    notes.push({
      code: "BOOST_REASON_OVERRIDE",
      message: `Boost only updated the reason to "repeated_weakness" for "${studyPlan.currentFocus.dimension}" — dimension was already the natural plan focus.`,
      severity: "info",
    });
  }

  // ── Rule 6: LOW_CONFIDENCE_NO_RELIABILITY_NOTE ────────────────────────────
  if ((diag.lowConfidence || diag.engineConflict) && !studyPlan.reliabilityNote) {
    notes.push({
      code: "LOW_CONFIDENCE_NO_RELIABILITY_NOTE",
      message:
        "Diagnosis signals low confidence or engine conflict, but studyPlan has no reliabilityNote — learner UI may not surface the caveat.",
      severity: "info",
    });
  }

  // ── Rule 7: ALL_BANDS_EQUAL ───────────────────────────────────────────────
  // All non-overall band scores equal the overall score → suspicious / flat input
  const dimEntries = studyPlan.priorityDimensions;
  if (dimEntries.length > 0 && dimEntries.every((d) => d.gapToOverall === 0)) {
    notes.push({
      code: "ALL_BANDS_EQUAL",
      message:
        "All non-overall band scores equal the overall score — scoring input may be synthetic or incomplete.",
      severity: "info",
    });
  }

  // ── Rule 8: DIAGNOSIS_PLANNER_MISMATCH ───────────────────────────────────
  // topWeaknesses contain band-dimension names (may be raw subscore keys like
  // "lr_01" or resolved names like "lexical"). We check against resolved names
  // in priorityDimensions.
  const priorityDimSet = new Set(studyPlan.priorityDimensions.map((d) => d.dimension));
  const missingFromPlan = topWeaknesses.filter((tw) => !priorityDimSet.has(tw));
  if (topWeaknesses.length > 0 && missingFromPlan.length > 0) {
    notes.push({
      code: "DIAGNOSIS_PLANNER_MISMATCH",
      message: `topWeaknesses dimension(s) [${missingFromPlan.join(", ")}] absent from planner priorityDimensions — diagnosis and plan may be inconsistent.`,
      severity: "warning",
    });
  }

  const approved = !notes.some((n) => n.severity === "block");
  return { approved, reviewNotes: notes };
}
