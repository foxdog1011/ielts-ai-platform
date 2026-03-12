import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { saveScore } from "@/lib/kv";
import { listHistory } from "@/lib/history";
import type { HistoryRecord } from "@/lib/history";
import { buildStudyPlan } from "@/lib/planner";
import { buildCoachSnapshot } from "@/lib/coach";
import { runSpeakingPipeline } from "@/lib/scoring/speakingPipeline";

const Body = z.object({
  taskId: z.string().min(1),
  prompt: z.string().optional(),
  audioBase64: z.string().optional(),
  mime: z.string().optional(),
  audioPath: z.string().optional(),
  manualTranscript: z.string().optional(),
  durationSec: z.number().optional(),
});

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const body = Body.parse(await req.json());

    const [result, recentHistory] = await Promise.all([
      runSpeakingPipeline({
        taskId: body.taskId,
        prompt: body.prompt,
        audioBase64: body.audioBase64,
        audioPath: body.audioPath,
        mime: body.mime,
        manualTranscript: body.manualTranscript,
        durationSec: body.durationSec,
      }),
      listHistory({ type: "speaking", limit: 5 }).catch((): HistoryRecord[] => []),
    ]);

    const studyPlan = await buildStudyPlan({
      examType: "speaking",
      currentBand: result.band,
      llmFeedback: [...(result.feedback ? [result.feedback] : []), ...(result.suggestions ?? [])],
      recentHistory,
      diagnosisResult: result.diagnosisResult,
    }).catch(() => undefined);

    await saveScore("speaking", {
      taskId: body.taskId,
      prompt: body.prompt,
      durationSec: body.durationSec,
      band: result.band,
      speakingFeatures: result.speakingFeatures,
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
          examType: "speaking",
          currentBand: result.band as Record<string, number | null | undefined>,
          diagnosisResult: result.diagnosisResult,
          studyPlan,
          recentHistory,
        })
      : undefined;

    const speakingFeatures = (result.speakingFeatures ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      ok: true,
      data: {
        transcript: result.transcript,
        segments: result.segments,
        band: result.band,
        speakingFeatures: result.speakingFeatures,
        feedback: result.feedback,
        suggestions: result.suggestions,
        content: {
          band: {
            overall: result.band.overall,
            taskResponse: result.band.content,
            vocabulary: result.band.vocab,
            grammar: result.band.grammar,
          },
          suggestions: result.suggestions,
        },
        speech: {
          band: {
            overall: result.band.overall,
            pronunciation: result.band.pronunciation ?? undefined,
            fluency: result.band.fluency ?? undefined,
          },
          metrics: {
            durationSec: body.durationSec,
            wpm: typeof speakingFeatures["wpm"] === "number" ? (speakingFeatures["wpm"] as number) : undefined,
            pauseRate:
              typeof speakingFeatures["pause_ratio"] === "number"
                ? (speakingFeatures["pause_ratio"] as number)
                : undefined,
            avgPauseSec:
              typeof speakingFeatures["avg_pause_sec"] === "number"
                ? (speakingFeatures["avg_pause_sec"] as number)
                : undefined,
          },
          suggestions: [],
        },
        tokensUsed: result.tokensUsed,
        debug: result.debug,
        studyPlan,
        coachSnapshot,                               // additive, optional
      },
      requestId,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "SPEAKING_SCORING_FAILED",
          message: e instanceof Error ? e.message : "speaking scoring failed",
        },
        requestId,
      },
      { status: 400 }
    );
  }
}
