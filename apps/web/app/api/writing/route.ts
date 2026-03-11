import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { saveScore } from "@/lib/kv";
import { listHistory } from "@/lib/history";
import type { HistoryRecord } from "@/lib/history";
import { buildStudyPlan } from "@/lib/planner";
import { runWritingPipeline } from "@/lib/scoring/writingPipeline";

const Body = z.object({
  taskId: z.string().min(1),
  taskType: z.enum(["task1", "task2"]).optional(),
  prompt: z.string().min(1),
  essay: z.string().min(1),
  targetWords: z.number().int().positive().optional(),
  seconds: z.number().int().nonnegative().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = Body.parse(await req.json());

    // Fetch history concurrently with pipeline — hidden behind pipeline latency.
    // History failure degrades gracefully: empty array → planner runs without trend data.
    const [result, recentHistory] = await Promise.all([
      runWritingPipeline({
        taskId: body.taskId,
        taskType: body.taskType,
        prompt: body.prompt,
        essay: body.essay,
        targetWords: body.targetWords,
        seconds: body.seconds,
      }),
      listHistory({ type: "writing", limit: 5 }).catch((): HistoryRecord[] => []),
    ]);

    await saveScore("writing", {
      taskId: body.taskId,
      prompt: body.prompt,
      durationSec: body.seconds,
      words: result.words,
      band: result.band,
      ts: Date.now(),
      scoreTrace: result.trace,
    });

    // Planner runs after saveScore so recentHistory contains only prior sessions.
    // .catch ensures planner failure never affects band/feedback fields.
    const studyPlan = await buildStudyPlan({
      examType: "writing",
      currentBand: result.band,
      llmFeedback: result.improvements ?? [],
      recentHistory,
      diagnosisResult: result.diagnosisResult,
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      data: {
        band: result.band,                          // unchanged
        paragraphFeedback: result.paragraphFeedback, // unchanged
        improvements: result.improvements,           // unchanged
        rewritten: result.rewritten,                 // unchanged
        tokensUsed: result.tokensUsed,               // unchanged
        debug: result.debug,                         // unchanged
        studyPlan,                                   // additive, optional — omitted from JSON when undefined
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
