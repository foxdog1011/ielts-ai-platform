import test from "node:test";
import assert from "node:assert/strict";
import { runSpeakingPipeline } from "@/lib/scoring/speakingPipeline";

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
      ok: true,
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
        ok: true,
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
