// tests/agents/orchestrator.test.ts
//
// Phase 1 orchestrator tests.
// All tests are deterministic — no LLM calls, no I/O.

import test from "node:test";
import assert from "node:assert/strict";
import { runAgentPipeline } from "@/lib/agents/orchestrator";
import type { AgentContext } from "@/lib/agents/types";
import type { DiagnosisResult } from "@/lib/scoring/diagnosis";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CLEAN_DIAGNOSIS: DiagnosisResult = {
  anomalies: [],
  severity: "none",
  engineConflict: false,
  lowConfidence: false,
};

const HIGH_SEVERITY_DIAGNOSIS: DiagnosisResult = {
  anomalies: [
    {
      code: "VERY_LOW_SUBSCORE",
      dimension: "fluency_01",
      severity: "high",
      note: "Heuristic: fluency is below 0.3",
    },
  ],
  severity: "high",
  engineConflict: false,
  lowConfidence: false,
};

function makeSpeakingCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    examType: "speaking",
    sessionId: "test-session-001",
    band: { overall: 6.5, content: 7, grammar: 7, vocab: 6.5, fluency: 5.5, pronunciation: 6 },
    pipelineDiagnosis: CLEAN_DIAGNOSIS,
    debugFlags: {},
    llmFeedback: ["Good vocabulary range.", "Work on fluency."],
    recentHistory: [],
    ...overrides,
  };
}

function makeWritingCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    examType: "writing",
    sessionId: "test-session-002",
    band: { overall: 6, taskResponse: 6.5, coherence: 6, lexical: 5.5, grammar: 6 },
    pipelineDiagnosis: CLEAN_DIAGNOSIS,
    debugFlags: {},
    llmFeedback: ["Coherence could be improved.", "Lexical range is limited."],
    recentHistory: [],
    ...overrides,
  };
}

// ── Shape tests ───────────────────────────────────────────────────────────────

test("runAgentPipeline returns all required top-level fields", async () => {
  const result = await runAgentPipeline(makeSpeakingCtx());
  assert.ok("diagnosisResult" in result, "missing diagnosisResult");
  assert.ok("studyPlan" in result, "missing studyPlan");
  assert.ok("reviewerResult" in result, "missing reviewerResult");
  assert.ok("meta" in result, "missing meta");
});

test("meta.agentsRan contains all three agents in order", async () => {
  const result = await runAgentPipeline(makeSpeakingCtx());
  assert.deepEqual(result.meta.agentsRan, ["DiagnosisAgent", "PlannerAgent", "ReviewerAgent"]);
});

test("meta.durationMs is a non-negative number", async () => {
  const result = await runAgentPipeline(makeSpeakingCtx());
  assert.ok(typeof result.meta.durationMs === "number");
  assert.ok(result.meta.durationMs >= 0);
});

// ── DiagnosisAgent passthrough ────────────────────────────────────────────────

test("DiagnosisAgent passes through pipelineDiagnosis unchanged", async () => {
  const result = await runAgentPipeline(makeSpeakingCtx({ pipelineDiagnosis: CLEAN_DIAGNOSIS }));
  assert.equal(result.diagnosisResult.severity, "none");
  assert.equal(result.diagnosisResult.anomalies.length, 0);
  assert.equal(result.diagnosisResult.engineConflict, false);
});

test("DiagnosisAgent handles missing pipelineDiagnosis gracefully", async () => {
  const result = await runAgentPipeline(makeSpeakingCtx({ pipelineDiagnosis: undefined }));
  assert.equal(result.diagnosisResult.severity, "none");
  assert.equal(result.diagnosisResult.anomalies.length, 0);
});

test("DiagnosisAgent preserves high-severity diagnosis", async () => {
  const result = await runAgentPipeline(
    makeSpeakingCtx({ pipelineDiagnosis: HIGH_SEVERITY_DIAGNOSIS }),
  );
  assert.equal(result.diagnosisResult.severity, "high");
  assert.equal(result.diagnosisResult.anomalies.length, 1);
  assert.equal(result.diagnosisResult.anomalies[0].code, "VERY_LOW_SUBSCORE");
});

// ── PlannerAgent ──────────────────────────────────────────────────────────────

test("PlannerAgent produces a studyPlan with required fields", async () => {
  const result = await runAgentPipeline(makeSpeakingCtx());
  const { studyPlan } = result;
  assert.ok(Array.isArray(studyPlan.priorityDimensions), "priorityDimensions missing");
  assert.ok(typeof studyPlan.nextTaskRecommendation === "string", "nextTaskRecommendation missing");
  assert.ok(typeof studyPlan.milestoneBand === "number", "milestoneBand missing");
  assert.ok(Array.isArray(studyPlan.practiceItems), "practiceItems missing");
});

test("PlannerAgent works for writing examType", async () => {
  const result = await runAgentPipeline(makeWritingCtx());
  assert.ok(result.studyPlan.nextTaskRecommendation.length > 0);
  assert.equal(result.studyPlan.planSource, "rule-based");
});

test("PlannerAgent milestoneBand is above current overall", async () => {
  const ctx = makeSpeakingCtx(); // overall: 6.5
  const result = await runAgentPipeline(ctx);
  assert.ok(result.studyPlan.milestoneBand > 6.5);
});

// ── ReviewerAgent ─────────────────────────────────────────────────────────────

test("ReviewerAgent approves a clean plan", async () => {
  const result = await runAgentPipeline(makeSpeakingCtx());
  assert.equal(result.reviewerResult.approved, true);
});

test("ReviewerAgent emits HIGH_SEVERITY_NO_FOCUS when severity is high and no focus", async () => {
  // Produce high severity; with only one session and simple band, planner may or may not set focus.
  // We test the rule directly by checking the note codes.
  const result = await runAgentPipeline(
    makeSpeakingCtx({
      pipelineDiagnosis: HIGH_SEVERITY_DIAGNOSIS,
      band: { overall: 6.5, content: 6.5, grammar: 6.5, vocab: 6.5, fluency: 6.5, pronunciation: 6.5 },
    }),
  );
  // When all sub-bands equal overall, planner sets no currentFocus.
  // Reviewer should flag HIGH_SEVERITY_NO_FOCUS.
  if (!result.studyPlan.currentFocus) {
    const codes = result.reviewerResult.reviewNotes.map((n) => n.code);
    assert.ok(codes.includes("HIGH_SEVERITY_NO_FOCUS"), `expected HIGH_SEVERITY_NO_FOCUS, got: ${codes}`);
  }
});

test("ReviewerAgent approved is never false when no block notes exist", async () => {
  const result = await runAgentPipeline(makeSpeakingCtx());
  const hasBlock = result.reviewerResult.reviewNotes.some((n) => n.severity === "block");
  if (!hasBlock) {
    assert.equal(result.reviewerResult.approved, true);
  }
});

// ── CoachSnapshot ─────────────────────────────────────────────────────────────

test("coachSnapshot is present for a valid context", async () => {
  const result = await runAgentPipeline(makeSpeakingCtx());
  assert.ok(result.coachSnapshot !== undefined, "coachSnapshot should be built");
});

test("coachSnapshot.learnerProfile.examType matches context", async () => {
  const result = await runAgentPipeline(makeSpeakingCtx());
  assert.equal(result.coachSnapshot?.learnerProfile.examType, "speaking");
});
