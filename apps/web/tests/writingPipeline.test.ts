import test from "node:test";
import assert from "node:assert/strict";
import { runWritingPipeline } from "@/lib/scoring/writingPipeline";

test("writing pipeline uses local when local scoring succeeds", async () => {
  const result = await runWritingPipeline(
    {
      taskId: "task2",
      prompt: "Discuss both views.",
      essay: "This is a sufficiently long essay text ".repeat(20),
    },
    {
      localFn: async () => ({
        ok: true,
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
