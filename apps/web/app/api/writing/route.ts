import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { saveScore } from "@/lib/kv";
import { runWritingPipeline } from "@/lib/scoring/writingPipeline";

const Body = z.object({
  taskId: z.string().min(1),
  prompt: z.string().min(1),
  essay: z.string().min(1),
  targetWords: z.number().int().positive().optional(),
  seconds: z.number().int().nonnegative().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = Body.parse(await req.json());
    const result = await runWritingPipeline({
      taskId: body.taskId,
      prompt: body.prompt,
      essay: body.essay,
      targetWords: body.targetWords,
      seconds: body.seconds,
    });

    await saveScore("writing", {
      taskId: body.taskId,
      prompt: body.prompt,
      durationSec: body.seconds,
      words: result.words,
      band: result.band,
      ts: Date.now(),
      scoreTrace: result.trace,
      llm_subscores: result.trace.llm_subscores,
      local_subscores: result.trace.local_subscores,
      weights: result.trace.weights,
      final_subscores: result.trace.final_subscores,
      final_overall_pre_calibration: result.trace.final_overall_pre_calibration,
      final_overall_post_calibration: result.trace.final_overall_post_calibration,
      final_band: result.trace.final_band,
      debug_flags: result.trace.debug_flags,
      timings: result.trace.timings,
      models: result.trace.models,
    });

    return NextResponse.json({
      ok: true,
      data: {
        band: result.band,
        paragraphFeedback: result.paragraphFeedback,
        improvements: result.improvements,
        rewritten: result.rewritten,
        tokensUsed: result.tokensUsed,
        debug: result.debug,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "WRITING_SCORING_FAILED",
          message: e?.message || "writing scoring failed",
        },
      },
      { status: 400 }
    );
  }
}
