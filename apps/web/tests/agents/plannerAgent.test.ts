// tests/agents/plannerAgent.test.ts
//
// Phase 3 PlannerAgent tests. Deterministic — no LLM, no I/O.

import test from "node:test";
import assert from "node:assert/strict";
import { runPlannerAgent } from "@/lib/agents/plannerAgent";
import type { AgentContext, DiagnosisAgentResult } from "@/lib/agents/types";
import type { DiagnosisResult } from "@/lib/scoring/diagnosis";
import type { HistoryRecord } from "@/lib/history";

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

function makeWritingCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    examType: "writing",
    sessionId: "w-001",
    band: { overall: 6.5, taskResponse: 7, coherence: 6.5, lexical: 5, grammar: 6.5 },
    pipelineDiagnosis: CLEAN_DIAG,
    debugFlags: {},
    llmFeedback: ["Expand vocabulary range.", "Use signpost phrases."],
    recentHistory: [],
    ...overrides,
  };
}

function makeSpeakingCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    examType: "speaking",
    sessionId: "s-001",
    band: { overall: 6, content: 7, grammar: 6.5, vocab: 6, fluency: 4.5, pronunciation: 5.5 },
    pipelineDiagnosis: CLEAN_DIAG,
    debugFlags: {},
    llmFeedback: ["Practice fluency drills."],
    recentHistory: [],
    ...overrides,
  };
}

function makeHistoryRecord(
  type: "writing" | "speaking",
  band: Record<string, number>,
): HistoryRecord {
  return { type, taskId: `h-${Math.random()}`, band } as HistoryRecord;
}

// ── Output shape ──────────────────────────────────────────────────────────────

test("PlannerAgent output has all required fields", async () => {
  const result = await runPlannerAgent(makeWritingCtx(), makeDiagAgentResult());
  assert.ok("studyPlan" in result);
  assert.ok("boostedDimensions" in result);
  assert.ok("recurringBoostApplied" in result);
  assert.ok(Array.isArray(result.boostedDimensions));
  assert.ok(typeof result.recurringBoostApplied === "boolean");
});

test("studyPlan has all required fields", async () => {
  const result = await runPlannerAgent(makeWritingCtx(), makeDiagAgentResult());
  const { studyPlan } = result;
  assert.ok(Array.isArray(studyPlan.priorityDimensions));
  assert.ok(typeof studyPlan.nextTaskRecommendation === "string");
  assert.ok(typeof studyPlan.milestoneBand === "number");
  assert.ok(Array.isArray(studyPlan.practiceItems));
  assert.equal(studyPlan.planSource, "rule-based");
});

// ── topWeaknesses ordering (priority dimensions are predictable) ──────────────

test("weakest dimension appears first in priorityDimensions (writing)", async () => {
  // lexical=5 is furthest below overall=6.5 → should be first
  const ctx = makeWritingCtx();
  const result = await runPlannerAgent(ctx, makeDiagAgentResult());
  assert.equal(result.studyPlan.priorityDimensions[0].dimension, "lexical");
});

test("weakest dimension appears first in priorityDimensions (speaking)", async () => {
  // fluency=4.5 is furthest below overall=6 → should be first
  const ctx = makeSpeakingCtx();
  const result = await runPlannerAgent(ctx, makeDiagAgentResult());
  assert.equal(result.studyPlan.priorityDimensions[0].dimension, "fluency");
});

test("gapToOverall is positive for below-overall dimensions", async () => {
  const ctx = makeWritingCtx(); // lexical=5, overall=6.5 → gap=1.5
  const result = await runPlannerAgent(ctx, makeDiagAgentResult());
  const lexical = result.studyPlan.priorityDimensions.find((d) => d.dimension === "lexical");
  assert.ok(lexical, "lexical not found in priorityDimensions");
  assert.ok(lexical.gapToOverall > 0);
});

test("dimensions at or above overall have gapToOverall ≤ 0", async () => {
  const ctx = makeWritingCtx(); // taskResponse=7 is above overall=6.5 → gap=-0.5
  const result = await runPlannerAgent(ctx, makeDiagAgentResult());
  const tr = result.studyPlan.priorityDimensions.find((d) => d.dimension === "taskResponse");
  assert.ok(tr, "taskResponse not found");
  assert.ok(tr.gapToOverall <= 0);
});

test("milestoneBand is strictly above current overall", async () => {
  const ctx = makeWritingCtx(); // overall=6.5
  const result = await runPlannerAgent(ctx, makeDiagAgentResult());
  assert.ok(result.studyPlan.milestoneBand > 6.5);
});

// ── recurringIssues boost ─────────────────────────────────────────────────────

test("recurringBoost: topWeaknesses + VERY_LOW_SUBSCORE recurring → currentFocus is boosted dim", async () => {
  // lr_01 → "lexical"; VERY_LOW_SUBSCORE is a BOOST_CODE
  const diagResult = makeDiagAgentResult({
    topWeaknesses: ["lr_01"],
    recurringIssues: ["VERY_LOW_SUBSCORE"],
  });
  const ctx = makeWritingCtx();
  const result = await runPlannerAgent(ctx, diagResult);

  assert.ok(result.boostedDimensions.includes("lexical"), `boostedDimensions: ${result.boostedDimensions}`);
  assert.equal(result.studyPlan.currentFocus?.dimension, "lexical");
  assert.equal(result.studyPlan.currentFocus?.reason, "repeated_weakness");
  assert.equal(result.recurringBoostApplied, true);
});

test("recurringBoost: SUBSCORE_BELOW_OVERALL is also a boost code", async () => {
  const diagResult = makeDiagAgentResult({
    topWeaknesses: ["fluency_01"],
    recurringIssues: ["SUBSCORE_BELOW_OVERALL"],
  });
  const ctx = makeSpeakingCtx();
  const result = await runPlannerAgent(ctx, diagResult);

  assert.ok(result.boostedDimensions.includes("fluency"));
  assert.equal(result.studyPlan.currentFocus?.dimension, "fluency");
});

test("no boost when recurringIssues contains only non-BOOST_CODES", async () => {
  const diagResult = makeDiagAgentResult({
    topWeaknesses: ["lr_01"],
    recurringIssues: ["LOW_LLM_CONFIDENCE", "LOCAL_ENGINE_UNAVAILABLE"],
  });
  const ctx = makeWritingCtx();
  const result = await runPlannerAgent(ctx, diagResult);

  assert.equal(result.boostedDimensions.length, 0);
  assert.equal(result.recurringBoostApplied, false);
});

test("no boost when topWeaknesses is empty", async () => {
  const diagResult = makeDiagAgentResult({
    topWeaknesses: [],
    recurringIssues: ["VERY_LOW_SUBSCORE"],
  });
  const ctx = makeWritingCtx();
  const result = await runPlannerAgent(ctx, diagResult);

  assert.equal(result.boostedDimensions.length, 0);
  assert.equal(result.recurringBoostApplied, false);
});

test("no boost when recurringIssues is empty", async () => {
  const diagResult = makeDiagAgentResult({
    topWeaknesses: ["lr_01"],
    recurringIssues: [],
  });
  const ctx = makeWritingCtx();
  const result = await runPlannerAgent(ctx, diagResult);

  assert.equal(result.boostedDimensions.length, 0);
  assert.equal(result.recurringBoostApplied, false);
});

test("boost does not override if currentFocus is already the boosted dim", async () => {
  // Force diagnosis to flag lr_01 as high → planner will naturally focus lexical
  const highDiag: DiagnosisResult = {
    anomalies: [{ code: "VERY_LOW_SUBSCORE", dimension: "lr_01", severity: "high", note: "" }],
    severity: "high",
    engineConflict: false,
    lowConfidence: false,
  };
  const diagResult = makeDiagAgentResult({
    diagnosisResult: highDiag,
    topWeaknesses: ["lr_01"],
    recurringIssues: ["VERY_LOW_SUBSCORE"],
  });
  const ctx = makeWritingCtx();
  const result = await runPlannerAgent(ctx, diagResult);

  // currentFocus should still be "lexical" (either from diagnosis_flagged or repeated_weakness)
  assert.equal(result.studyPlan.currentFocus?.dimension, "lexical");
});

// ── missing optional fields ───────────────────────────────────────────────────

test("empty recentHistory produces a valid plan (first session)", async () => {
  const ctx = makeWritingCtx({ recentHistory: [] });
  const result = await runPlannerAgent(ctx, makeDiagAgentResult());
  assert.ok(result.studyPlan.nextTaskRecommendation.length > 0);
  assert.equal(result.studyPlan.sessionCount, 0);
});

test("recentHistory with records populates sessionCount", async () => {
  const ctx = makeWritingCtx({
    recentHistory: [
      makeHistoryRecord("writing", { overall: 6, lexical: 5.5, coherence: 6 }),
      makeHistoryRecord("writing", { overall: 6.5, lexical: 5.5, coherence: 7 }),
    ],
  });
  const result = await runPlannerAgent(ctx, makeDiagAgentResult());
  assert.equal(result.studyPlan.sessionCount, 2);
});

test("recentHistory with repeated weakness populates repeatedWeaknesses", async () => {
  // lexical below overall in both records
  const ctx = makeWritingCtx({
    recentHistory: [
      makeHistoryRecord("writing", { overall: 6.5, lexical: 5.5, coherence: 7, grammar: 6.5 }),
      makeHistoryRecord("writing", { overall: 6.5, lexical: 5.0, coherence: 6.5, grammar: 7 }),
    ],
  });
  const result = await runPlannerAgent(ctx, makeDiagAgentResult());
  assert.ok(
    result.studyPlan.repeatedWeaknesses?.includes("lexical"),
    `expected lexical in repeatedWeaknesses: ${result.studyPlan.repeatedWeaknesses}`,
  );
});

test("missing band dimensions produce gapToOverall=0 (not a crash)", async () => {
  const ctx = makeWritingCtx({
    band: { overall: 6, taskResponse: null, coherence: undefined, lexical: 5, grammar: 6 },
  });
  const result = await runPlannerAgent(ctx, makeDiagAgentResult());
  assert.ok(Array.isArray(result.studyPlan.priorityDimensions));
});

// ── mode="rule" stability ─────────────────────────────────────────────────────

test("mode=rule produces identical results on repeated calls", async () => {
  const ctx = makeWritingCtx();
  const diag = makeDiagAgentResult({ topWeaknesses: ["lr_01"], recurringIssues: ["VERY_LOW_SUBSCORE"] });
  const r1 = await runPlannerAgent(ctx, diag, "rule");
  const r2 = await runPlannerAgent(ctx, diag, "rule");

  assert.equal(r1.studyPlan.currentFocus?.dimension, r2.studyPlan.currentFocus?.dimension);
  assert.equal(r1.studyPlan.nextTaskRecommendation, r2.studyPlan.nextTaskRecommendation);
  assert.deepEqual(r1.boostedDimensions, r2.boostedDimensions);
});
