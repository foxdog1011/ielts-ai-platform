import test from "node:test";
import assert from "node:assert/strict";
import { runSpeakingPipeline } from "@/lib/scoring/speakingPipeline";
import type { DiagnosisResult } from "@/lib/scoring/diagnosis";

test("speaking pipeline has no placeholder constants and computes deterministic overall", async () => {
  const deps = {
    asrFn: async () => ({
      transcript: "I studied engineering and I explain my answer with specific details and examples.",
      segments: [{ startSec: 0, endSec: 1.2, text: "I studied engineering" }],
      usedAsr: true,
      modelUsed: "stub-asr",
    }),
    llmFn: async () => ({
      rubric: {
        subscores: { content_01: 0.77, grammar_01: 0.61, vocab_01: 0.52 },
        rationale: { content: "ok", grammar: "ok", vocab: "ok" },
        feedback: "feedback",
        suggestions: ["s1"],
        confidence_01: 0.83,
      },
      tokensUsed: 100,
      modelUsed: "stub-llm",
    }),
    localFn: async () => ({
      ok: true as const,
      err: null,
      fluency_01: 0.42,
      pronunciation_01: 0.58,
      content_01: 0.5,
      overall_01: 0.55,
      speaking_features: { wpm: 145 },
      raw: {},
    }),
  };

  const a = await runSpeakingPipeline({ taskId: "sp1", prompt: "q", audioPath: "a.wav" }, deps);
  const b = await runSpeakingPipeline({ taskId: "sp1", prompt: "q", audioPath: "a.wav" }, deps);

  assert.notEqual(a.trace.final_subscores.content_01, 0.2);
  assert.notEqual(a.trace.final_subscores.grammar_01, 0.3);
  assert.notEqual(a.trace.final_subscores.vocab_01, 0.4);
  assert.equal(a.trace.final_overall_pre_calibration, b.trace.final_overall_pre_calibration);
  assert.ok(Number.isFinite(a.trace.final_overall_pre_calibration));
});

// ── Shared stubs ─────────────────────────────────────────────────────────────

const STUB_ASR = async () => ({
  transcript: "I would like to talk about the topic in detail with specific examples and clear ideas.",
  segments: [] as { startSec: number; endSec: number; text: string }[],
  usedAsr: true,
  modelUsed: "stub-asr",
});

const STUB_LLM = async () => ({
  rubric: {
    subscores: { content_01: 0.72, grammar_01: 0.65, vocab_01: 0.68 },
    rationale: { content: "ok", grammar: "ok", vocab: "ok" },
    feedback: "overall clear",
    suggestions: ["Improve examples.", "Use varied vocabulary."],
    confidence_01: 0.85,
  },
  tokensUsed: 100,
  modelUsed: "stub-llm",
});

const STUB_LOCAL = async () => ({
  ok: false as const,
  err: "no local",
  fluency_01: null as null,
  pronunciation_01: null as null,
  content_01: null as null,
  overall_01: null as null,
  speaking_features: {},
});

const STUB_INPUT = { taskId: "sp-diag", prompt: "Describe a place." };

test("speaking short transcript down-weights llm and flags are set", async () => {
  const result = await runSpeakingPipeline(
    { taskId: "sp2", prompt: "q", audioPath: "a.wav" },
    {
      asrFn: async () => ({
        transcript: "short answer only",
        segments: [],
        usedAsr: true,
        modelUsed: "stub-asr",
      }),
      llmFn: async () => ({
        rubric: {
          subscores: { content_01: 0.9, grammar_01: 0.9, vocab_01: 0.9 },
          rationale: { content: "ok", grammar: "ok", vocab: "ok" },
          feedback: "feedback",
          suggestions: [],
          confidence_01: 1,
        },
        modelUsed: "stub-llm",
      }),
      localFn: async () => ({
        ok: true as const,
        err: null,
        fluency_01: null,
        pronunciation_01: null,
        content_01: null,
        overall_01: null,
        speaking_features: {},
        raw: {},
      }),
    }
  );

  assert.equal(result.debug.debug_flags.transcript_too_short, true);
  assert.equal(result.debug.debug_flags.local_missing_fluency, true);
  assert.equal(result.debug.debug_flags.local_missing_pronunciation, true);
  assert.equal(result.band.fluency, null);
  assert.equal(result.band.pronunciation, null);
  assert.ok(Number.isFinite(result.trace.final_overall_pre_calibration));
});

// ── Diagnosis integration ─────────────────────────────────────────────────────

test("pipeline: diagnosisResult is present in return when default diagnosisFn runs", async () => {
  const result = await runSpeakingPipeline(
    STUB_INPUT,
    { asrFn: STUB_ASR, llmFn: STUB_LLM, localFn: STUB_LOCAL },
  );
  assert.ok("diagnosisResult" in result, "expected diagnosisResult field on return");
  assert.ok(result.diagnosisResult !== undefined);
  assert.ok(Array.isArray(result.diagnosisResult.anomalies));
  assert.ok(["none", "low", "medium", "high"].includes(result.diagnosisResult.severity));
});

test("pipeline: diagnosisFn dep is called with examType 'speaking'", async () => {
  let capturedExamType: string | undefined;
  const diagnosisFn = (input: Parameters<typeof import("@/lib/scoring/diagnosis").diagnoseScores>[0]): DiagnosisResult => {
    capturedExamType = input.examType;
    return { anomalies: [], severity: "none", engineConflict: false, lowConfidence: false };
  };
  await runSpeakingPipeline(STUB_INPUT, { asrFn: STUB_ASR, llmFn: STUB_LLM, localFn: STUB_LOCAL, diagnosisFn });
  assert.equal(capturedExamType, "speaking");
});

test("pipeline: diagnosisFn dep receives fused subscores as input", async () => {
  let capturedSubscores: Record<string, number | null> | undefined;
  const diagnosisFn = (input: Parameters<typeof import("@/lib/scoring/diagnosis").diagnoseScores>[0]): DiagnosisResult => {
    capturedSubscores = input.subscores as Record<string, number | null>;
    return { anomalies: [], severity: "none", engineConflict: false, lowConfidence: false };
  };
  await runSpeakingPipeline(STUB_INPUT, { asrFn: STUB_ASR, llmFn: STUB_LLM, localFn: STUB_LOCAL, diagnosisFn });
  assert.ok(capturedSubscores !== undefined);
  assert.ok("content_01" in capturedSubscores);
  assert.ok("grammar_01" in capturedSubscores);
});

test("pipeline: when diagnosisFn throws, band and suggestions are still returned", async () => {
  const diagnosisFn = (): DiagnosisResult => { throw new Error("diagnosis boom"); };
  const result = await runSpeakingPipeline(
    STUB_INPUT,
    { asrFn: STUB_ASR, llmFn: STUB_LLM, localFn: STUB_LOCAL, diagnosisFn },
  );
  assert.ok(typeof result.band.overall === "number");
  assert.ok(Array.isArray(result.suggestions));
  assert.ok(result.trace !== undefined);
});

test("pipeline: when diagnosisFn throws, diagnosisResult is undefined", async () => {
  const diagnosisFn = (): DiagnosisResult => { throw new Error("diagnosis boom"); };
  const result = await runSpeakingPipeline(
    STUB_INPUT,
    { asrFn: STUB_ASR, llmFn: STUB_LLM, localFn: STUB_LOCAL, diagnosisFn },
  );
  assert.equal(result.diagnosisResult, undefined);
});
