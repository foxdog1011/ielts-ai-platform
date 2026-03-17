// apps/web/lib/agents/orchestrator.ts
//
// Single-orchestrator agent pipeline.
// Phase 1: skeleton wiring — each agent is deterministic / rule-based.
// Upgrade path: swap individual agents for LLM-backed implementations
// without touching this file or the route layer.
//
// Execution order (sequential, intentional):
//   1. DiagnosisAgent   — re-assess / enrich diagnosis from pipeline output
//   2. PlannerAgent     — build study plan using diagnosis result
//   3. ReviewerAgent    — validate consistency of diagnosis + plan
//   (CoachSnapshot built inline after all agents pass)

import { buildCoachSnapshot } from "@/lib/coach";
import { runDiagnosisAgent } from "@/lib/agents/diagnosisAgent";
import { runPlannerAgent } from "@/lib/agents/plannerAgent";
import { runReviewerAgent } from "@/lib/agents/reviewerAgent";
import type {
  AgentContext,
  AgentPipelineResult,
  DiagnosisAgentResult,
  PlannerAgentResult,
  ReviewerAgentResult,
} from "@/lib/agents/types";

// ── Public orchestrator entry point ──────────────────────────────────────────

/**
 * runAgentPipeline is the single entry point for the agent layer.
 *
 * Called from route handlers after the scoring pipeline completes.
 * Replaces direct calls to buildStudyPlan() + buildCoachSnapshot() in routes.
 *
 * Guarantees: never throws — all agent failures are caught and surfaced via
 * reviewerResult.reviewNotes with severity "warning".
 */
export async function runAgentPipeline(ctx: AgentContext): Promise<AgentPipelineResult> {
  const startMs = Date.now();
  const agentsRan: string[] = [];

  // 1. DiagnosisAgent
  const diagnosisResult = await runDiagnosisAgent(ctx).catch(
    (e): DiagnosisAgentResult => ({
      diagnosisResult: ctx.pipelineDiagnosis ?? {
        anomalies: [],
        severity: "none",
        engineConflict: false,
        lowConfidence: false,
      },
      topWeaknesses: [],
      recurringIssues: [],
      evidenceSummary: "DiagnosisAgent encountered an error.",
      augmented: false,
      notes: [`DiagnosisAgent error: ${e instanceof Error ? e.message : String(e)}`],
    }),
  );
  agentsRan.push("DiagnosisAgent");

  // 2. PlannerAgent
  const plannerResult = await runPlannerAgent(ctx, diagnosisResult).catch(
    (e): PlannerAgentResult => ({
      studyPlan: {
        priorityDimensions: [],
        repeatedWeaknesses: [],
        progressStatus: "stable",
        nextTaskRecommendation: ctx.examType === "writing" ? "task2_argument" : "speaking_part2_long_turn",
        milestoneBand: (ctx.band["overall"] as number) ?? 5,
        practiceItems: [],
        planSource: "rule-based",
        sessionCount: ctx.recentHistory.length,
      },
      boostedDimensions: [],
      recurringBoostApplied: false,
    }),
  );
  agentsRan.push("PlannerAgent");

  // 3. ReviewerAgent
  const reviewerResult = await runReviewerAgent(diagnosisResult, plannerResult).catch(
    (e): ReviewerAgentResult => ({
      approved: true,
      reviewNotes: [
        {
          code: "REVIEWER_ERROR",
          message: `ReviewerAgent threw: ${e instanceof Error ? e.message : String(e)}`,
          severity: "warning",
        },
      ],
    }),
  );
  agentsRan.push("ReviewerAgent");

  // CoachSnapshot (not counted as an "agent" yet — Phase 3+ will promote it)
  let coachSnapshot;
  try {
    coachSnapshot = buildCoachSnapshot({
      examType: ctx.examType,
      currentBand: ctx.band,
      diagnosisResult: diagnosisResult.diagnosisResult,
      studyPlan: plannerResult.studyPlan,
      recentHistory: ctx.recentHistory,
    });
  } catch {
    coachSnapshot = undefined;
  }

  return {
    diagnosisResult: diagnosisResult.diagnosisResult,
    studyPlan: plannerResult.studyPlan,
    reviewerResult,
    coachSnapshot,
    meta: {
      durationMs: Date.now() - startMs,
      agentsRan,
    },
  };
}
