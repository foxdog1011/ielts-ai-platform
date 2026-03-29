// app/api/speaking/_handler.ts
//
// Extracted, injectable handler logic for POST /api/speaking.
// Imported by route.ts (with real deps) and by tests (with stubs).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAIClient } from "@/lib/openai";
import { runSpeakingPipeline } from "@/lib/scoring/speakingPipeline";
import { runAgentPipeline } from "@/lib/agents/orchestrator";
import { listHistory } from "@/lib/history";
import { saveScore } from "@/lib/kv";
import type { HistoryRecord } from "@/lib/history";
import type { AgentContext, AgentPipelineResult } from "@/lib/agents/types";

const Body = z.object({
  taskId: z.string().min(1),
  prompt: z.string().optional(),
  audioBase64: z.string().optional(),
  mime: z.string().optional(),
  audioPath: z.string().optional(),
  manualTranscript: z.string().optional(),
  durationSec: z.number().optional(),
});

export type SpeakingDeps = {
  pipeline: typeof runSpeakingPipeline;
  agent: typeof runAgentPipeline;
  history: typeof listHistory;
  save: typeof saveScore;
  openaiClient?: ReturnType<typeof getOpenAIClient>;
};

export async function _handlePost(req: NextRequest, deps: SpeakingDeps): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  try {
    const body = Body.parse(await req.json());
    const openaiClient = deps.openaiClient ?? getOpenAIClient();

    const [result, recentHistory] = await Promise.all([
      deps.pipeline(
        {
          taskId: body.taskId,
          prompt: body.prompt,
          audioBase64: body.audioBase64,
          audioPath: body.audioPath,
          mime: body.mime,
          manualTranscript: body.manualTranscript,
          durationSec: body.durationSec,
        },
        { openaiClient },
      ),
      deps.history({ type: "speaking", limit: 5 }).catch((): HistoryRecord[] => []),
    ]);

    // Guard: empty transcript produces meaningless scores. Reject early and
    // ask the user to provide a manual transcript rather than silently scoring.
    if (!result.transcript) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "TRANSCRIPT_EMPTY",
            message:
              "無法辨識語音內容（Whisper 返回空字串）。請在「逐字稿」欄位手動輸入你說的內容後再送出。",
          },
          requestId,
        },
        { status: 422 },
      );
    }

    // Agent pipeline: DiagnosisAgent → PlannerAgent → ReviewerAgent → CoachSnapshot.
    // Route-level catch: if agent throws despite its "never throws" guarantee,
    // scoring data is still returned to the caller.
    const agentCtx: AgentContext = {
      examType: "speaking",
      sessionId: body.taskId,
      band: result.band as Record<string, number | null | undefined>,
      pipelineDiagnosis: result.diagnosisResult,
      debugFlags: result.debug.debug_flags,
      llmFeedback: [...(result.feedback ? [result.feedback] : []), ...(result.suggestions ?? [])],
      speakingFeatures: (result.speakingFeatures ?? {}) as Record<string, unknown>,
      recentHistory,
    };
    const agentResult = await deps.agent(agentCtx).catch((): AgentPipelineResult => ({
      diagnosisResult: result.diagnosisResult ?? {
        anomalies: [],
        severity: "none",
        engineConflict: false,
        lowConfidence: false,
      },
      studyPlan: {
        priorityDimensions: [],
        repeatedWeaknesses: [],
        progressStatus: "stable",
        nextTaskRecommendation: "speaking_part2_long_turn",
        milestoneBand: (agentCtx.band["overall"] as number) ?? 5,
        practiceItems: [],
        planSource: "rule-based",
        sessionCount: recentHistory.length,
      },
      reviewerResult: { approved: true, reviewNotes: [] },
      coachSnapshot: undefined,
      meta: { durationMs: 0, agentsRan: [] },
    }));
    const { studyPlan, coachSnapshot } = agentResult;

    await deps.save("speaking", {
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
      planSnapshot: {
        currentFocus: studyPlan.currentFocus,
        nextTaskRecommendation: studyPlan.nextTaskRecommendation,
        milestoneBand: studyPlan.milestoneBand,
      },
    }).catch(() => undefined);

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
        agentMeta: agentResult.meta,                 // additive, optional
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
      { status: 400 },
    );
  }
}
