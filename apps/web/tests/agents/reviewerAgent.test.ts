// tests/agents/reviewerAgent.test.ts
//
// Phase 4 ReviewerAgent tests. Deterministic — no LLM, no I/O.

import test from "node:test";
import assert from "node:assert/strict";
import { runReviewerAgent } from "@/lib/agents/reviewerAgent";
import type { DiagnosisAgentResult, PlannerAgentResult } from "@/lib/agents/types";
import type { StudyPlan } from "@/lib/planner";
import type { DiagnosisResult } from "@/lib/scoring/diagnosis";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CLEAN_DIAG: DiagnosisResult = {
  anomalies: [],
  severity: "none",
  engineConflict: false,
  lowConfidence: false,
};

function makeDiagAgentResult(overrides: Partial<DiagnosisAgentResult> = {}): DiagnosisAgentResult {
  return {
    diagnosisResult: CLEAN_DIAG,
    topWeaknesses: [],
    recurringIssues: [],
    evidenceSummary: "No issues.",
    augmented: false,
    notes: [],
    ...overrides,
  };
}

function makeStudyPlan(overrides: Partial<StudyPlan> = {}): StudyPlan {
  return {
    priorityDimensions: [
      { dimension: "lexical", currentBand: 5, gapToOverall: 1.5 },
      { dimension: "coherence", currentBand: 6.5, gapToOverall: 0 },
    ],
    currentFocus: { dimension: "lexical", reason: "current_weakest" },
    nextTaskRecommendation: "task2_vocabulary_range",
    milestoneBand: 7,
    practiceItems: ["Use synonyms.", "Vary sentence openers."],
    planSource: "rule-based",
    sessionCount: 0,
    ...overrides,
  };
}

function makePlannerResult(overrides: Partial<PlannerAgentResult> = {}): PlannerAgentResult {
  return {
    studyPlan: makeStudyPlan(),
    boostedDimensions: [],
    recurringBoostApplied: false,
    ...overrides,
  };
}

// ── Output shape ──────────────────────────────────────────────────────────────

test("ReviewerAgent output has approved and reviewNotes", async () => {
  const result = await runReviewerAgent(makeDiagAgentResult(), makePlannerResult());
  assert.ok("approved" in result);
  assert.ok("reviewNotes" in result);
  assert.ok(typeof result.approved === "boolean");
  assert.ok(Array.isArray(result.reviewNotes));
});

// ── Normal pass case ──────────────────────────────────────────────────────────

test("clean input passes with no blocking notes", async () => {
  const result = await runReviewerAgent(makeDiagAgentResult(), makePlannerResult());
  assert.equal(result.approved, true);
  const blockingNotes = result.reviewNotes.filter((n) => n.severity === "block");
  assert.equal(blockingNotes.length, 0);
});

test("clean input produces no warning or block notes", async () => {
  const result = await runReviewerAgent(makeDiagAgentResult(), makePlannerResult());
  const nonInfo = result.reviewNotes.filter((n) => n.severity !== "info");
  assert.equal(nonInfo.length, 0);
});

// ── Rule: TASK_MISSING ────────────────────────────────────────────────────────

test("TASK_MISSING emitted when nextTaskRecommendation is empty", async () => {
  const planner = makePlannerResult({
    studyPlan: makeStudyPlan({ nextTaskRecommendation: "" }),
  });
  const result = await runReviewerAgent(makeDiagAgentResult(), planner);
  assert.ok(result.reviewNotes.some((n) => n.code === "TASK_MISSING"));
  const note = result.reviewNotes.find((n) => n.code === "TASK_MISSING")!;
  assert.equal(note.severity, "warning");
});

// ── Rule: PLAN_FOCUS_UNSET ────────────────────────────────────────────────────

test("PLAN_FOCUS_UNSET emitted when currentFocus is absent", async () => {
  const planner = makePlannerResult({
    studyPlan: makeStudyPlan({ currentFocus: undefined }),
  });
  const result = await runReviewerAgent(makeDiagAgentResult(), planner);
  assert.ok(result.reviewNotes.some((n) => n.code === "PLAN_FOCUS_UNSET"));
  const note = result.reviewNotes.find((n) => n.code === "PLAN_FOCUS_UNSET")!;
  assert.equal(note.severity, "info");
});

// ── Rule: HIGH_SEVERITY_NO_FOCUS ─────────────────────────────────────────────

test("HIGH_SEVERITY_NO_FOCUS emitted when severity=high and no currentFocus", async () => {
  const diag = makeDiagAgentResult({
    diagnosisResult: { ...CLEAN_DIAG, severity: "high" },
  });
  const planner = makePlannerResult({
    studyPlan: makeStudyPlan({ currentFocus: undefined }),
  });
  const result = await runReviewerAgent(diag, planner);
  assert.ok(result.reviewNotes.some((n) => n.code === "HIGH_SEVERITY_NO_FOCUS"));
  const note = result.reviewNotes.find((n) => n.code === "HIGH_SEVERITY_NO_FOCUS")!;
  assert.equal(note.severity, "warning");
});

test("HIGH_SEVERITY_NO_FOCUS not emitted when currentFocus is present despite high severity", async () => {
  const diag = makeDiagAgentResult({
    diagnosisResult: { ...CLEAN_DIAG, severity: "high" },
  });
  const result = await runReviewerAgent(diag, makePlannerResult());
  assert.ok(!result.reviewNotes.some((n) => n.code === "HIGH_SEVERITY_NO_FOCUS"));
});

// ── Rule: BOOST_INCONSISTENCY ─────────────────────────────────────────────────

test("BOOST_INCONSISTENCY emitted when recurringBoostApplied=true but currentFocus not in boostedDimensions", async () => {
  const planner = makePlannerResult({
    studyPlan: makeStudyPlan({
      currentFocus: { dimension: "grammar", reason: "repeated_weakness" },
    }),
    boostedDimensions: ["lexical"],   // grammar not in here
    recurringBoostApplied: true,
  });
  const result = await runReviewerAgent(makeDiagAgentResult(), planner);
  assert.ok(result.reviewNotes.some((n) => n.code === "BOOST_INCONSISTENCY"));
  const note = result.reviewNotes.find((n) => n.code === "BOOST_INCONSISTENCY")!;
  assert.equal(note.severity, "warning");
});

test("no BOOST_INCONSISTENCY when recurringBoostApplied=false", async () => {
  const planner = makePlannerResult({
    studyPlan: makeStudyPlan({
      currentFocus: { dimension: "grammar", reason: "current_weakest" },
    }),
    boostedDimensions: ["lexical"],
    recurringBoostApplied: false,
  });
  const result = await runReviewerAgent(makeDiagAgentResult(), planner);
  assert.ok(!result.reviewNotes.some((n) => n.code === "BOOST_INCONSISTENCY"));
});

test("no BOOST_INCONSISTENCY when currentFocus dim is in boostedDimensions", async () => {
  const planner = makePlannerResult({
    studyPlan: makeStudyPlan({
      currentFocus: { dimension: "lexical", reason: "repeated_weakness" },
    }),
    boostedDimensions: ["lexical"],
    recurringBoostApplied: true,
  });
  const result = await runReviewerAgent(makeDiagAgentResult(), planner);
  assert.ok(!result.reviewNotes.some((n) => n.code === "BOOST_INCONSISTENCY"));
});

// ── Rule: BOOST_REASON_OVERRIDE ───────────────────────────────────────────────

test("BOOST_REASON_OVERRIDE emitted when boost only changed reason (dim was already first in priorityDimensions)", async () => {
  // lexical is first in priorityDimensions AND is the boosted dim with repeated_weakness reason
  const planner = makePlannerResult({
    studyPlan: makeStudyPlan({
      priorityDimensions: [
        { dimension: "lexical", currentBand: 5, gapToOverall: 1.5 },
        { dimension: "coherence", currentBand: 6.5, gapToOverall: 0 },
      ],
      currentFocus: { dimension: "lexical", reason: "repeated_weakness" },
    }),
    boostedDimensions: ["lexical"],
    recurringBoostApplied: true,
  });
  const result = await runReviewerAgent(makeDiagAgentResult(), planner);
  assert.ok(result.reviewNotes.some((n) => n.code === "BOOST_REASON_OVERRIDE"));
  const note = result.reviewNotes.find((n) => n.code === "BOOST_REASON_OVERRIDE")!;
  assert.equal(note.severity, "info");
});

test("no BOOST_REASON_OVERRIDE when boost changed both reason and focus dimension", async () => {
  // coherence was first but lexical gets boosted — dimension actually changed
  const planner = makePlannerResult({
    studyPlan: makeStudyPlan({
      priorityDimensions: [
        { dimension: "coherence", currentBand: 5.5, gapToOverall: 1.0 },
        { dimension: "lexical", currentBand: 5, gapToOverall: 1.5 },
      ],
      currentFocus: { dimension: "lexical", reason: "repeated_weakness" },
    }),
    boostedDimensions: ["lexical"],
    recurringBoostApplied: true,
  });
  const result = await runReviewerAgent(makeDiagAgentResult(), planner);
  assert.ok(!result.reviewNotes.some((n) => n.code === "BOOST_REASON_OVERRIDE"));
});

// ── Rule: LOW_CONFIDENCE_NO_RELIABILITY_NOTE ──────────────────────────────────

test("LOW_CONFIDENCE_NO_RELIABILITY_NOTE emitted when lowConfidence=true and no reliabilityNote", async () => {
  const diag = makeDiagAgentResult({
    diagnosisResult: { ...CLEAN_DIAG, lowConfidence: true },
  });
  const planner = makePlannerResult({
    studyPlan: makeStudyPlan({ reliabilityNote: undefined }),
  });
  const result = await runReviewerAgent(diag, planner);
  assert.ok(result.reviewNotes.some((n) => n.code === "LOW_CONFIDENCE_NO_RELIABILITY_NOTE"));
  const note = result.reviewNotes.find((n) => n.code === "LOW_CONFIDENCE_NO_RELIABILITY_NOTE")!;
  assert.equal(note.severity, "info");
});

test("LOW_CONFIDENCE_NO_RELIABILITY_NOTE emitted when engineConflict=true and no reliabilityNote", async () => {
  const diag = makeDiagAgentResult({
    diagnosisResult: { ...CLEAN_DIAG, engineConflict: true },
  });
  const result = await runReviewerAgent(diag, makePlannerResult());
  assert.ok(result.reviewNotes.some((n) => n.code === "LOW_CONFIDENCE_NO_RELIABILITY_NOTE"));
});

test("no LOW_CONFIDENCE_NO_RELIABILITY_NOTE when reliabilityNote is present", async () => {
  const diag = makeDiagAgentResult({
    diagnosisResult: { ...CLEAN_DIAG, lowConfidence: true },
  });
  const planner = makePlannerResult({
    studyPlan: makeStudyPlan({ reliabilityNote: "LLM confidence was low this session." }),
  });
  const result = await runReviewerAgent(diag, planner);
  assert.ok(!result.reviewNotes.some((n) => n.code === "LOW_CONFIDENCE_NO_RELIABILITY_NOTE"));
});

// ── Rule: ALL_BANDS_EQUAL ─────────────────────────────────────────────────────

test("ALL_BANDS_EQUAL emitted when all dimensions have gapToOverall=0", async () => {
  const planner = makePlannerResult({
    studyPlan: makeStudyPlan({
      priorityDimensions: [
        { dimension: "lexical", currentBand: 6.5, gapToOverall: 0 },
        { dimension: "coherence", currentBand: 6.5, gapToOverall: 0 },
        { dimension: "grammar", currentBand: 6.5, gapToOverall: 0 },
      ],
    }),
  });
  const result = await runReviewerAgent(makeDiagAgentResult(), planner);
  assert.ok(result.reviewNotes.some((n) => n.code === "ALL_BANDS_EQUAL"));
  const note = result.reviewNotes.find((n) => n.code === "ALL_BANDS_EQUAL")!;
  assert.equal(note.severity, "info");
});

test("no ALL_BANDS_EQUAL when at least one dimension has non-zero gap", async () => {
  const result = await runReviewerAgent(makeDiagAgentResult(), makePlannerResult());
  // Default plan has lexical gapToOverall=1.5, so should not trigger
  assert.ok(!result.reviewNotes.some((n) => n.code === "ALL_BANDS_EQUAL"));
});

test("no ALL_BANDS_EQUAL when priorityDimensions is empty", async () => {
  const planner = makePlannerResult({
    studyPlan: makeStudyPlan({ priorityDimensions: [] }),
  });
  const result = await runReviewerAgent(makeDiagAgentResult(), planner);
  assert.ok(!result.reviewNotes.some((n) => n.code === "ALL_BANDS_EQUAL"));
});

// ── Rule: DIAGNOSIS_PLANNER_MISMATCH ─────────────────────────────────────────

test("DIAGNOSIS_PLANNER_MISMATCH emitted when topWeaknesses dim absent from priorityDimensions", async () => {
  const diag = makeDiagAgentResult({
    // "fluency" is the resolved topWeakness but not in default plan's priorityDimensions
    topWeaknesses: ["fluency"],
  });
  const result = await runReviewerAgent(diag, makePlannerResult());
  assert.ok(result.reviewNotes.some((n) => n.code === "DIAGNOSIS_PLANNER_MISMATCH"));
  const note = result.reviewNotes.find((n) => n.code === "DIAGNOSIS_PLANNER_MISMATCH")!;
  assert.equal(note.severity, "warning");
});

test("no DIAGNOSIS_PLANNER_MISMATCH when all topWeaknesses are in priorityDimensions", async () => {
  const diag = makeDiagAgentResult({
    topWeaknesses: ["lexical"],  // lexical IS in the default plan's priorityDimensions
  });
  const result = await runReviewerAgent(diag, makePlannerResult());
  assert.ok(!result.reviewNotes.some((n) => n.code === "DIAGNOSIS_PLANNER_MISMATCH"));
});

test("no DIAGNOSIS_PLANNER_MISMATCH when topWeaknesses is empty", async () => {
  const result = await runReviewerAgent(makeDiagAgentResult(), makePlannerResult());
  assert.ok(!result.reviewNotes.some((n) => n.code === "DIAGNOSIS_PLANNER_MISMATCH"));
});

// ── Multiple rules can fire together ─────────────────────────────────────────

test("multiple rules can fire in a single review", async () => {
  const diag = makeDiagAgentResult({
    diagnosisResult: { ...CLEAN_DIAG, severity: "high", lowConfidence: true },
    topWeaknesses: ["fluency"],
  });
  const planner = makePlannerResult({
    studyPlan: makeStudyPlan({
      currentFocus: undefined,
      nextTaskRecommendation: "",
    }),
  });
  const result = await runReviewerAgent(diag, planner);
  const codes = result.reviewNotes.map((n) => n.code);
  assert.ok(codes.includes("TASK_MISSING"), `missing TASK_MISSING in ${codes}`);
  assert.ok(codes.includes("PLAN_FOCUS_UNSET"), `missing PLAN_FOCUS_UNSET in ${codes}`);
  assert.ok(codes.includes("HIGH_SEVERITY_NO_FOCUS"), `missing HIGH_SEVERITY_NO_FOCUS in ${codes}`);
  assert.ok(codes.includes("DIAGNOSIS_PLANNER_MISMATCH"), `missing DIAGNOSIS_PLANNER_MISMATCH in ${codes}`);
  assert.ok(codes.includes("LOW_CONFIDENCE_NO_RELIABILITY_NOTE"), `missing LOW_CONFIDENCE_NO_RELIABILITY_NOTE in ${codes}`);
});

// ── approved flag ─────────────────────────────────────────────────────────────

test("approved=true when only info/warning notes (no block)", async () => {
  const diag = makeDiagAgentResult({
    diagnosisResult: { ...CLEAN_DIAG, severity: "high" },
  });
  const planner = makePlannerResult({
    studyPlan: makeStudyPlan({ currentFocus: undefined }),
  });
  const result = await runReviewerAgent(diag, planner);
  // HIGH_SEVERITY_NO_FOCUS is a warning — approved should still be true
  assert.equal(result.approved, true);
  assert.ok(result.reviewNotes.some((n) => n.severity === "warning"));
});

// ── Missing optional fields safe handling ─────────────────────────────────────

test("handles empty priorityDimensions without crashing", async () => {
  const planner = makePlannerResult({
    studyPlan: makeStudyPlan({ priorityDimensions: [] }),
  });
  const result = await runReviewerAgent(makeDiagAgentResult(), planner);
  assert.ok(typeof result.approved === "boolean");
});

test("handles undefined currentFocus and empty boostedDimensions safely", async () => {
  const planner = makePlannerResult({
    studyPlan: makeStudyPlan({ currentFocus: undefined }),
    boostedDimensions: [],
    recurringBoostApplied: false,
  });
  const result = await runReviewerAgent(makeDiagAgentResult(), planner);
  assert.ok(!result.reviewNotes.some((n) => n.code === "BOOST_INCONSISTENCY"));
  assert.ok(!result.reviewNotes.some((n) => n.code === "BOOST_REASON_OVERRIDE"));
});
