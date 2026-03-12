import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { saveScore } from "@/lib/kv";
import { listHistory } from "@/lib/history";
import type { HistoryRecord } from "@/lib/history";
import { buildStudyPlan } from "@/lib/planner";
import { buildCoachSnapshot } from "@/lib/coach";
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

    // Planner runs before saveScore so we can persist diagSummary + planSnapshot together.
    // .catch ensures planner failure never affects band/feedback fields.
    const studyPlan = await buildStudyPlan({
      examType: "writing",
      currentBand: result.band,
      llmFeedback: result.improvements ?? [],
      recentHistory,
      diagnosisResult: result.diagnosisResult,
    }).catch(() => undefined);

    // Storage failure must not surface as a scoring error — absorb silently.
    await saveScore("writing", {
      taskId: body.taskId,
      prompt: body.prompt,
      durationSec: body.seconds,
      words: result.words,
      band: result.band,
      ts: Date.now(),
      scoreTrace: result.trace,
      diagSummary: result.diagnosisResult
        ? {
            severity: result.diagnosisResult.severity,
            anomalies: result.diagnosisResult.anomalies.map((a) => ({
              code: a.code,
              dimension: a.dimension,
              severity: a.severity,
            })),
            engineConflict: result.diagnosisResult.engineConflict,
            lowConfidence: result.diagnosisResult.lowConfidence,
          }
        : undefined,
      planSnapshot: studyPlan
        ? {
            currentFocus: studyPlan.currentFocus,
            nextTaskRecommendation: studyPlan.nextTaskRecommendation,
            milestoneBand: studyPlan.milestoneBand,
          }
        : undefined,
    }).catch(() => undefined);

    const coachSnapshot = studyPlan
      ? buildCoachSnapshot({
          examType: "writing",
          currentBand: result.band as Record<string, number | null | undefined>,
          diagnosisResult: result.diagnosisResult,
          studyPlan,
          recentHistory,
        })
      : undefined;

    return NextResponse.json({
      ok: true,
      data: {
        band: result.band,
        paragraphFeedback: result.paragraphFeedback,
        improvements: result.improvements,
        rewritten: result.rewritten,
        tokensUsed: result.tokensUsed,
        debug: result.debug,
        studyPlan,
        coachSnapshot,                               // additive, optional
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "WRITING_SCORING_FAILED",
          message: e instanceof Error ? e.message : "writing scoring failed",
        },
      },
      { status: 400 }
    );
  }
}
