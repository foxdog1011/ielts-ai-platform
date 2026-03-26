// app/api/writing/_handler.ts
//
// Extracted, injectable handler logic for POST /api/writing.
// Imported by route.ts (with real deps) and by tests (with stubs).
// Kept in a sibling file so route.ts only exports Next.js handlers,
// satisfying the framework's route-export type constraints.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAIClient } from "@/lib/openai";
import { runWritingPipeline } from "@/lib/scoring/writingPipeline";
import { runAgentPipeline } from "@/lib/agents/orchestrator";
import { listHistory } from "@/lib/history";
import { saveScore } from "@/lib/kv";
import type { HistoryRecord } from "@/lib/history";
import type { AgentContext, AgentPipelineResult } from "@/lib/agents/types";

const Body = z.object({
  taskId: z.string().min(1),
  taskType: z.enum(["task1", "task2"]).optional(),
  prompt: z.string().min(1),
  essay: z.string().min(1),
  targetWords: z.number().int().positive().optional(),
  seconds: z.number().int().nonnegative().optional(),
});

/**
 * Injectable dependencies.
 * Production: route.ts wires real impls. Tests: pass stubs.
 * openaiClient is optional — if omitted, _handlePost calls getOpenAIClient()
 * inside the try block so any missing-key error is caught and returned as 400.
 */
export type WritingDeps = {
  pipeline: typeof runWritingPipeline;
  agent: typeof runAgentPipeline;
  history: typeof listHistory;
  save: typeof saveScore;
  openaiClient?: ReturnType<typeof getOpenAIClient>;
};

export async function _handlePost(req: NextRequest, deps: WritingDeps): Promise<NextResponse> {
  try {
    const body = Body.parse(await req.json());
    const openaiClient = deps.openaiClient ?? getOpenAIClient();

    // Fetch history concurrently with pipeline — hidden behind pipeline latency.
    const [result, recentHistory] = await Promise.all([
      deps.pipeline(
        {
          taskId: body.taskId,
          taskType: body.taskType,
          prompt: body.prompt,
          essay: body.essay,
          targetWords: body.targetWords,
          seconds: body.seconds,
        },
        { openaiClient },
      ),
      deps.history({ type: "writing", limit: 5 }).catch((): HistoryRecord[] => []),
    ]);

    // Agent pipeline: DiagnosisAgent → PlannerAgent → ReviewerAgent → CoachSnapshot.
    // Route-level catch: if agent throws despite its "never throws" guarantee,
    // scoring data is still returned to the caller.
    const agentCtx: AgentContext = {
      examType: "writing",
      sessionId: body.taskId,
      band: result.band as Record<string, number | null | undefined>,
      pipelineDiagnosis: result.diagnosisResult,
      debugFlags: result.debug.debug_flags,
      llmFeedback: result.improvements ?? [],
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
        nextTaskRecommendation: "task2_argument",
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

    // Storage failure must not surface as a scoring error — absorb silently.
    await deps.save("writing", {
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
      planSnapshot: {
        currentFocus: studyPlan.currentFocus,
        nextTaskRecommendation: studyPlan.nextTaskRecommendation,
        milestoneBand: studyPlan.milestoneBand,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      data: {
        band: result.band,
        bandMargin: result.bandMargin,
        paragraphFeedback: result.paragraphFeedback,
        improvements: result.improvements,
        rewritten: result.rewritten,
        tokensUsed: result.tokensUsed,
        debug: result.debug,
        studyPlan,
        coachSnapshot,                               // additive, optional
        agentMeta: agentResult.meta,                 // additive, optional
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
      { status: 400 },
    );
  }
}
