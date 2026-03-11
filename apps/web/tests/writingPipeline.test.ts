import test from "node:test";
import assert from "node:assert/strict";
import { runWritingPipeline } from "@/lib/scoring/writingPipeline";
import type { DiagnosisResult } from "@/lib/scoring/diagnosis";

test("writing pipeline runs local model and returns llm-only subscores when local has no mapped keys", async () => {
  // local model runs (ok: true) but its content_01/overall_01 do not map to
  // WritingSubscores01 keys (tr_01/cc_01/lr_01/gra_01), so final subscores
  // equal the LLM subscores. used_local reflects whether local ran, not
  // whether it contributed to fusion.
  const result = await runWritingPipeline(
    {
      taskId: "task2",
      taskType: "task2",
      prompt: "Discuss both views.",
      essay: "This is a sufficiently long essay text ".repeat(20),
    },
    {
      localFn: async () => ({
        ok: true as const,
        err: null,
        overall_01: 0.51,
        content_01: 0.57,
        raw: {},
      }),
      llmFn: async () => ({
        rubric: {
          subscores: { tr_01: 0.71, cc_01: 0.66, lr_01: 0.69, gra_01: 0.63 },
          rationale: {
            task_response: "ok",
            coherence_cohesion: "ok",
            lexical_resource: "ok",
            grammar_range_accuracy: "ok",
          },
          paragraph_feedback: [{ index: 0, comment: "clear" }],
          improvements: ["improve examples"],
          rewritten: "rewritten essay",
          confidence_01: 0.84,
        },
        tokensUsed: 222,
        modelUsed: "stub-llm",
      }),
    }
  );

  assert.equal(result.debug.used_local, true);
  assert.equal(result.trace.final_subscores.tr_01, 0.71);
  assert.equal(result.trace.final_subscores.cc_01, 0.66);
  assert.equal(result.trace.final_subscores.lr_01, 0.69);
  assert.equal(result.trace.final_subscores.gra_01, 0.63);
  assert.ok(result.trace.final_overall_pre_calibration >= 0 && result.trace.final_overall_pre_calibration <= 1);
});

test("writing pipeline passes taskType to llmFn and defaults to task2", async () => {
  let capturedTaskType: string | undefined;
  const makeLlmFn = () =>
    async (input: { taskType?: string; essay: string; promptContext?: string }) => {
      capturedTaskType = input.taskType;
      return {
        rubric: {
          subscores: { tr_01: 0.7, cc_01: 0.7, lr_01: 0.7, gra_01: 0.7 },
          rationale: {
            task_response: "ok",
            coherence_cohesion: "ok",
            lexical_resource: "ok",
            grammar_range_accuracy: "ok",
          },
          paragraph_feedback: [],
          improvements: [],
          rewritten: "x",
          confidence_01: 1,
        },
        modelUsed: "stub-llm",
      };
    };
  const localFn = async () => ({
    ok: false as const,
    err: "no local",
    overall_01: null as null,
    content_01: null as null,
  });

  // explicit taskType
  await runWritingPipeline(
    { taskId: "abc", taskType: "task1", prompt: "p", essay: "x ".repeat(100) },
    { llmFn: makeLlmFn(), localFn }
  );
  assert.equal(capturedTaskType, "task1");

  // omitted taskType — should default to "task2"
  await runWritingPipeline(
    { taskId: "abc", prompt: "p", essay: "x ".repeat(100) },
    { llmFn: makeLlmFn(), localFn }
  );
  assert.equal(capturedTaskType, "task2");
});

test("writing overall_01 is deterministic", async () => {
  const deps = {
    localFn: async () => ({
      ok: false as const,
      err: "no local",
      overall_01: null,
      content_01: null,
    }),
    llmFn: async () => ({
      rubric: {
        subscores: { tr_01: 0.8, cc_01: 0.6, lr_01: 0.4, gra_01: 0.2 },
        rationale: {
          task_response: "ok",
          coherence_cohesion: "ok",
          lexical_resource: "ok",
          grammar_range_accuracy: "ok",
        },
        paragraph_feedback: [],
        improvements: [],
        rewritten: "x",
        confidence_01: 1,
      },
      modelUsed: "stub-llm",
    }),
  };
  const a = await runWritingPipeline({ taskId: "t", prompt: "p", essay: "a ".repeat(120) }, deps);
  const b = await runWritingPipeline({ taskId: "t", prompt: "p", essay: "a ".repeat(120) }, deps);
  assert.equal(a.trace.final_overall_pre_calibration, b.trace.final_overall_pre_calibration);
  assert.ok(Number.isFinite(a.trace.final_overall_pre_calibration));
});

// ── Diagnosis integration ─────────────────────────────────────────────────────

const STUB_INPUT = {
  taskId: "t",
  taskType: "task2" as const,
  prompt: "Discuss both views.",
  essay: "This is a test essay. ".repeat(20),
};

const STUB_LOCAL_FN = async () => ({
  ok: false as const,
  err: "no local",
  overall_01: null as null,
  content_01: null as null,
});

const STUB_LLM_FN = async () => ({
  rubric: {
    subscores: { tr_01: 0.7, cc_01: 0.65, lr_01: 0.68, gra_01: 0.72 },
    rationale: {
      task_response: "ok", coherence_cohesion: "ok",
      lexical_resource: "ok", grammar_range_accuracy: "ok",
    },
    paragraph_feedback: [],
    improvements: ["Improve examples."],
    rewritten: "x",
    confidence_01: 0.85,
  },
  tokensUsed: 100,
  modelUsed: "stub-llm",
});

test("pipeline: diagnosisResult is present in return when default diagnosisFn runs", async () => {
  const result = await runWritingPipeline(STUB_INPUT, { localFn: STUB_LOCAL_FN, llmFn: STUB_LLM_FN });
  assert.ok("diagnosisResult" in result, "expected diagnosisResult field on return");
  // Default diagnoseScores should not throw; result should be defined
  assert.ok(result.diagnosisResult !== undefined);
  assert.ok(Array.isArray(result.diagnosisResult.anomalies));
  assert.ok(["none", "low", "medium", "high"].includes(result.diagnosisResult.severity));
});

test("pipeline: diagnosisFn dep is called with examType 'writing'", async () => {
  let capturedExamType: string | undefined;
  const diagnosisFn = (input: Parameters<typeof import("@/lib/scoring/diagnosis").diagnoseScores>[0]): DiagnosisResult => {
    capturedExamType = input.examType;
    return { anomalies: [], severity: "none", engineConflict: false, lowConfidence: false };
  };
  await runWritingPipeline(STUB_INPUT, { localFn: STUB_LOCAL_FN, llmFn: STUB_LLM_FN, diagnosisFn });
  assert.equal(capturedExamType, "writing");
});

test("pipeline: diagnosisFn dep receives fused subscores as input", async () => {
  let capturedSubscores: Record<string, number | null> | undefined;
  const diagnosisFn = (input: Parameters<typeof import("@/lib/scoring/diagnosis").diagnoseScores>[0]): DiagnosisResult => {
    capturedSubscores = input.subscores as Record<string, number | null>;
    return { anomalies: [], severity: "none", engineConflict: false, lowConfidence: false };
  };
  await runWritingPipeline(STUB_INPUT, { localFn: STUB_LOCAL_FN, llmFn: STUB_LLM_FN, diagnosisFn });
  assert.ok(capturedSubscores !== undefined);
  assert.ok("tr_01" in capturedSubscores);
  assert.ok("cc_01" in capturedSubscores);
});

test("pipeline: when diagnosisFn throws, band and feedback are still returned", async () => {
  const diagnosisFn = (): DiagnosisResult => { throw new Error("diagnosis boom"); };
  const result = await runWritingPipeline(
    STUB_INPUT,
    { localFn: STUB_LOCAL_FN, llmFn: STUB_LLM_FN, diagnosisFn },
  );
  // Scoring must be unaffected
  assert.ok(typeof result.band.overall === "number");
  assert.ok(Array.isArray(result.improvements));
  assert.ok(result.trace !== undefined);
});

test("pipeline: when diagnosisFn throws, diagnosisResult is undefined", async () => {
  const diagnosisFn = (): DiagnosisResult => { throw new Error("diagnosis boom"); };
  const result = await runWritingPipeline(
    STUB_INPUT,
    { localFn: STUB_LOCAL_FN, llmFn: STUB_LLM_FN, diagnosisFn },
  );
  assert.equal(result.diagnosisResult, undefined);
});
