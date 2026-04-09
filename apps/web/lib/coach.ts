// apps/web/lib/coach.ts
//
// Deterministic orchestration layer that sits ABOVE the planner.
//
// Responsibilities (distinct from existing layers):
//   scoring pipeline  → per-session score + diagnosis
//   planner           → per-session ranked dimensions + recommended task
//   coach (this file) → cross-session memory, narrative summary, action priority
//
// No LLM calls. No I/O. Synchronous.
// Upgrade path: swap inner helpers for LLM-backed variants without changing
// the public buildCoachSnapshot() signature.

import type { HistoryRecord } from "@/lib/history";
import type { DiagSummary } from "@/lib/kv";
import type { DiagnosisResult } from "@/lib/scoring/diagnosis";
import {
  computeRepeatedWeaknesses,
  computeProgressStatus,
  type StudyPlan,
  type ProgressStatus,
} from "@/lib/planner";

// ── Input ─────────────────────────────────────────────────────────────────────

export type CoachSnapshotInput = {
  examType: "writing" | "speaking";
  /** Flat band object from the current session pipeline. */
  currentBand: Record<string, number | null | undefined>;
  diagnosisResult: DiagnosisResult | undefined;
  /** StudyPlan already computed by buildStudyPlan() — coach reads it, never rewrites it. */
  studyPlan: StudyPlan;
  /**
   * Recent history fetched by the route (same as what was passed to the planner).
   * May contain both exam types; coach filters internally.
   */
  recentHistory: HistoryRecord[];
};

// ── Output ────────────────────────────────────────────────────────────────────

/** Aggregated cross-session summary for this learner and exam type. */
export type LearnerProfile = {
  examType: "writing" | "speaking";
  /** Same-type sessions visible in recentHistory (does not count the current session). */
  totalSessions: number;
  /** Average overall band across the most recent 5 same-type sessions. Null on first session. */
  avgBandLast5: number | null;
  /** Highest overall band recorded across all sessions in recentHistory. */
  bestBand: number | null;
  /** Progress direction vs prior sessions. */
  recentTrend: ProgressStatus;
  /**
   * Dimensions weak in 3+ of the last 5 same-type sessions (stricter than planner's 2).
   * These represent durable patterns, not session noise.
   */
  persistentWeaknesses: string[];
  /**
   * Dimensions consistently above overall in 4+ of the last 5 sessions.
   * Reflects genuine strengths worth preserving.
   */
  strongDims: string[];
  /** Distinct calendar days with any session in the last 30 days (engagement metric). */
  engagementDays: number;
  /** Number of distinct prompts attempted (same exam type). */
  topicCount: number;
  /**
   * Anomaly codes (with optional dimension) that appear in diagSummary of 2+
   * prior same-type sessions. Proves that persisted diagSummary is being read.
   * Format: "CODE" or "CODE:dimension" when a dimension is present.
   */
  recurringAnomalies: string[];
};

/** Session-level narrative surfaces the most important signal in plain language. */
export type CoachSummary = {
  /** One-line attention-grabbing headline, e.g. "Vocabulary pulling your score down". */
  headline: string;
  /** Most important cross-session finding (distinct from the headline). */
  keyInsight: string;
  /** Context-sensitive motivational line. */
  encouragement: string;
  /** Human-readable session label, e.g. "Session 4" or "First session". */
  sessionLabel: string;
};

/** The single most actionable next step, with an explicit priority signal. */
export type NextActionCandidate = {
  /** Maps 1-to-1 to studyPlan.nextTaskRecommendation. */
  taskType: string;
  /** The specific dimension to work on. */
  targetDimension: string;
  /**
   * urgent   — high-severity diagnosis OR declining + persistent weakness
   * normal   — default
   * maintenance — improving + no persistent weakness + no high-severity diagnosis
   */
  priority: "urgent" | "normal" | "maintenance";
  /** One-sentence explanation of why this action is prioritised. */
  rationale: string;
};

/** Snapshot of the learner's activity and progress over the last 7 calendar days. */
export type WeeklySummaryPreview = {
  /** Sessions of either type submitted in the last 7 days. */
  sessionCountThisWeek: number;
  /**
   * Difference between the most recent and oldest same-type overall band
   * recorded this week. Null when fewer than 2 same-type sessions this week.
   */
  bandDeltaThisWeek: number | null;
  /** Dimension most frequently below overall across this-week same-type sessions. */
  topWeaknessThisWeek: string | null;
  /** high ≥ 4 sessions/week, medium 2-3, low 0-1. */
  consistencyRating: "high" | "medium" | "low";
  /** One-sentence human-readable digest. */
  summaryLine: string;
};

export type CoachSnapshot = {
  learnerProfile: LearnerProfile;
  coachSummary: CoachSummary;
  nextActionCandidate: NextActionCandidate;
  weeklySummaryPreview: WeeklySummaryPreview;
};

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Builds a CoachSnapshot from the current session result and history.
 * Pure, synchronous — safe to call anywhere without await.
 * Never throws: individual section helpers return safe fallbacks on bad data.
 */
export function buildCoachSnapshot(input: CoachSnapshotInput): CoachSnapshot {
  const { examType, currentBand, diagnosisResult, studyPlan, recentHistory } = input;

  const learnerProfile = buildLearnerProfile(examType, currentBand, recentHistory);
  const coachSummary = buildCoachSummary(learnerProfile, diagnosisResult, studyPlan);
  const nextActionCandidate = buildNextActionCandidate(
    studyPlan,
    learnerProfile,
    diagnosisResult,
  );
  const weeklySummaryPreview = buildWeeklySummaryPreview(examType, currentBand, recentHistory);

  return { learnerProfile, coachSummary, nextActionCandidate, weeklySummaryPreview };
}

// ── LearnerProfile ────────────────────────────────────────────────────────────

function buildLearnerProfile(
  examType: "writing" | "speaking",
  currentBand: Record<string, number | null | undefined>,
  recentHistory: HistoryRecord[],
): LearnerProfile {
  const sameType = recentHistory.filter((r) => r.type === examType);
  const totalSessions = sameType.length;

  // Band averages
  const overallsLast5 = sameType
    .slice(0, 5)
    .map((r) => (r.band as { overall?: number } | null | undefined)?.overall)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const avgBandLast5 =
    overallsLast5.length > 0
      ? Math.round((overallsLast5.reduce((s, v) => s + v, 0) / overallsLast5.length) * 10) / 10
      : null;

  const allOveralls = sameType
    .map((r) => (r.band as { overall?: number } | null | undefined)?.overall)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const bestBand = allOveralls.length > 0 ? Math.max(...allOveralls) : null;

  // Persistent weaknesses: threshold 3 (stricter than planner's 2)
  const persistentWeaknesses = computeRepeatedWeaknesses(recentHistory, examType, 3);

  // Strong dims: above overall in 4+ of last 5 sessions
  const strongDims = computeStrongDims(sameType, 4);

  // Engagement: distinct calendar days with any session in last 30 days
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const engagementDays = new Set(
    recentHistory
      .filter((r) => toEpochMs(r) > thirtyDaysAgo)
      .map((r) => new Date(toEpochMs(r)).toDateString()),
  ).size;

  // Topic diversity (same type only)
  const topicCount = new Set(sameType.filter((r) => r.prompt).map((r) => r.prompt!)).size;

  const currentOverall = (currentBand.overall as number | null | undefined) ?? 0;
  const recentTrend = computeProgressStatus(currentOverall, recentHistory, examType);
  const recurringAnomalies = computeRecurringAnomalies(sameType);

  return {
    examType,
    totalSessions,
    avgBandLast5,
    bestBand,
    recentTrend,
    persistentWeaknesses,
    strongDims,
    engagementDays,
    topicCount,
    recurringAnomalies,
  };
}

/** Dimensions above overall in at least `minSessions` of the provided records. */
function computeStrongDims(sameTypeRecords: HistoryRecord[], minSessions: number): string[] {
  const records = sameTypeRecords.slice(0, 5);
  if (records.length < 2) return [];

  const strongCount: Record<string, number> = {};
  for (const rec of records) {
    const band = rec.band as Record<string, number | null | undefined> | null | undefined;
    if (!band) continue;
    const overall = band.overall;
    if (overall == null || !Number.isFinite(overall)) continue;
    for (const [dim, val] of Object.entries(band)) {
      if (dim === "overall") continue;
      if (typeof val !== "number" || !Number.isFinite(val)) continue;
      if (val > overall) {
        strongCount[dim] = (strongCount[dim] ?? 0) + 1;
      }
    }
  }

  return Object.entries(strongCount)
    .filter(([, count]) => count >= minSessions)
    .sort((a, b) => b[1] - a[1])
    .map(([dim]) => dim);
}

/**
 * Reads persisted `diagSummary.anomalies` from same-type history records and
 * returns anomaly keys ("CODE" or "CODE:dimension") that appear in at least
 * `minSessions` records. This is the real logic that proves persisted data is used.
 *
 * Exported for reuse in weeklySummary.ts.
 */
export function computeRecurringAnomalies(
  sameTypeHistory: HistoryRecord[],
  minSessions = 2,
): string[] {
  const codeCount: Record<string, number> = {};
  for (const rec of sameTypeHistory) {
    const diagSummary = (rec as HistoryRecord & { diagSummary?: DiagSummary }).diagSummary;
    if (!diagSummary?.anomalies?.length) continue;
    // Count each anomaly key at most once per record (de-dup within session)
    const seenThisRecord = new Set<string>();
    for (const anomaly of diagSummary.anomalies) {
      const key = anomaly.dimension ? `${anomaly.code}:${anomaly.dimension}` : anomaly.code;
      if (!seenThisRecord.has(key)) {
        seenThisRecord.add(key);
        codeCount[key] = (codeCount[key] ?? 0) + 1;
      }
    }
  }
  return Object.entries(codeCount)
    .filter(([, count]) => count >= minSessions)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);
}

// ── CoachSummary ──────────────────────────────────────────────────────────────

function buildCoachSummary(
  profile: LearnerProfile,
  diagnosisResult: DiagnosisResult | undefined,
  studyPlan: StudyPlan,
): CoachSummary {
  const sessionLabel =
    profile.totalSessions === 0 ? "First session" : `Session ${profile.totalSessions + 1}`;

  const headline = buildHeadline(profile, diagnosisResult, studyPlan);
  const keyInsight = buildKeyInsight(profile, diagnosisResult);
  const encouragement = buildEncouragement(profile.recentTrend, profile.totalSessions);

  return { headline, keyInsight, encouragement, sessionLabel };
}

function buildHeadline(
  profile: LearnerProfile,
  diagnosisResult: DiagnosisResult | undefined,
  studyPlan: StudyPlan,
): string {
  // Priority 1: high-severity diagnosis
  if (diagnosisResult?.severity === "high") {
    const highAnomaly = diagnosisResult.anomalies.find((a) => a.severity === "high");
    if (highAnomaly?.code === "TRANSCRIPT_QUALITY")
      return "Short response — more speaking data needed for reliable scores";
    if (highAnomaly?.code === "VERY_LOW_SUBSCORE" && highAnomaly.dimension)
      return `Critical gap: ${friendlyDim(highAnomaly.dimension)} needs urgent attention`;
  }

  // Priority 2: durable cross-session weakness (3+ sessions)
  if (profile.persistentWeaknesses.length > 0) {
    return `${friendlyDim(profile.persistentWeaknesses[0])} has lagged for ${profile.totalSessions >= 3 ? "3+" : "multiple"} sessions`;
  }

  // Priority 3: trend-based
  if (profile.recentTrend === "declining")
    return `Band slipping — ${friendlyDim(studyPlan.currentFocus?.dimension ?? "overall")} is the priority`;
  if (profile.recentTrend === "improving") return "Progress confirmed — keep the momentum";
  if (profile.recentTrend === "first_session") return "First session complete — baseline established";

  return `Holding steady — push ${friendlyDim(studyPlan.currentFocus?.dimension ?? "overall")} to next level`;
}

function buildKeyInsight(
  profile: LearnerProfile,
  diagnosisResult: DiagnosisResult | undefined,
): string {
  // Scoring reliability concern overrides everything
  if (diagnosisResult?.engineConflict && diagnosisResult?.lowConfidence)
    return "Both scoring engines flagged low confidence this session — treat scores as estimates.";
  if (diagnosisResult?.engineConflict)
    return "Automated engines disagreed on scores — results reflect an estimate, not a ceiling.";

  // Persistent weakness is the most useful cross-session insight
  if (profile.persistentWeaknesses.length > 0) {
    const dims = profile.persistentWeaknesses.map(friendlyDim).join(", ");
    return `${dims} ${profile.persistentWeaknesses.length === 1 ? "has" : "have"} been below your overall for 3+ sessions — targeted drills will move the needle faster than full tests.`;
  }

  // Strong dims worth acknowledging
  if (profile.strongDims.length > 0) {
    const dims = profile.strongDims.map(friendlyDim).join(", ");
    return `${dims} ${profile.strongDims.length === 1 ? "is" : "are"} a consistent strength — use that foundation to build weaker areas.`;
  }

  // Topic diversity
  if (profile.topicCount >= 4)
    return `You've practiced across ${profile.topicCount} different topics — good variety for exam readiness.`;

  if (profile.totalSessions === 0)
    return "Complete 2-3 more sessions to start seeing cross-session patterns.";

  return "Keep adding sessions — patterns become clearer after 3-5 submissions.";
}

function buildEncouragement(trend: ProgressStatus, totalSessions: number): string {
  if (totalSessions === 0) return "Great start. Data compounds — keep going.";
  if (trend === "improving") return "You're trending up. Consistent practice is working.";
  if (trend === "declining") return "A dip is normal. One focused session often turns it around.";
  if (trend === "stable") return "Stable is a platform. Targeted effort on the focus dim breaks plateaus.";
  return "Building a baseline. Your trend will emerge after a few more sessions.";
}

// ── NextActionCandidate ───────────────────────────────────────────────────────

function buildNextActionCandidate(
  studyPlan: StudyPlan,
  profile: LearnerProfile,
  diagnosisResult: DiagnosisResult | undefined,
): NextActionCandidate {
  const taskType = studyPlan.nextTaskRecommendation;
  const targetDimension = studyPlan.currentFocus?.dimension ?? studyPlan.priorityDimensions[0]?.dimension ?? "overall";

  const isUrgent =
    diagnosisResult?.severity === "high" ||
    (profile.recentTrend === "declining" && profile.persistentWeaknesses.length > 0) ||
    profile.recurringAnomalies.length > 0; // persisted anomaly pattern detected

  const isMaintenance =
    profile.recentTrend === "improving" &&
    profile.persistentWeaknesses.length === 0 &&
    diagnosisResult?.severity !== "high";

  const priority: NextActionCandidate["priority"] = isUrgent
    ? "urgent"
    : isMaintenance
    ? "maintenance"
    : "normal";

  const rationale = buildRationale(targetDimension, priority, profile, diagnosisResult);

  return { taskType, targetDimension, priority, rationale };
}

function buildRationale(
  targetDimension: string,
  priority: NextActionCandidate["priority"],
  profile: LearnerProfile,
  diagnosisResult: DiagnosisResult | undefined,
): string {
  if (priority === "urgent") {
    if (diagnosisResult?.severity === "high")
      return `High-severity signal detected — ${friendlyDim(targetDimension)} needs focused work before the next full practice test.`;
    if (profile.recurringAnomalies.length > 0)
      return `Recurring anomaly pattern across ${profile.totalSessions}+ sessions — ${friendlyDim(targetDimension)} requires immediate targeted practice.`;
    return `${friendlyDim(targetDimension)} is declining across sessions — interrupt the pattern now.`;
  }
  if (priority === "maintenance")
    return `You're improving overall — ${friendlyDim(targetDimension)} maintains your weakest edge while momentum continues.`;

  if (profile.persistentWeaknesses.includes(targetDimension))
    return `${friendlyDim(targetDimension)} has been below overall for multiple sessions — cross-session repetition makes it the highest-value focus.`;

  return `${friendlyDim(targetDimension)} has the largest gap to your overall band this session.`;
}

// ── WeeklySummaryPreview ──────────────────────────────────────────────────────

function buildWeeklySummaryPreview(
  examType: "writing" | "speaking",
  currentBand: Record<string, number | null | undefined>,
  recentHistory: HistoryRecord[],
): WeeklySummaryPreview {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const thisWeekAll = recentHistory.filter((r) => toEpochMs(r) > sevenDaysAgo);
  const sessionCountThisWeek = thisWeekAll.length;

  const thisWeekSameType = thisWeekAll.filter((r) => r.type === examType);
  const weekOveralls = thisWeekSameType
    .map((r) => (r.band as { overall?: number } | null | undefined)?.overall)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const currentOverall = currentBand.overall as number | null | undefined;

  // Band delta: current session vs oldest same-type session this week
  let bandDeltaThisWeek: number | null = null;
  if (typeof currentOverall === "number" && weekOveralls.length >= 1) {
    const oldest = weekOveralls[weekOveralls.length - 1];
    bandDeltaThisWeek = Math.round((currentOverall - oldest) * 10) / 10;
  }

  // Top weakness this week (most common dim below overall)
  const topWeaknessThisWeek = computeTopWeeklyWeakness(thisWeekSameType);

  const consistencyRating: WeeklySummaryPreview["consistencyRating"] =
    sessionCountThisWeek >= 4 ? "high" : sessionCountThisWeek >= 2 ? "medium" : "low";

  const summaryLine = buildWeeklySummaryLine(
    sessionCountThisWeek,
    bandDeltaThisWeek,
    topWeaknessThisWeek,
    consistencyRating,
  );

  return {
    sessionCountThisWeek,
    bandDeltaThisWeek,
    topWeaknessThisWeek,
    consistencyRating,
    summaryLine,
  };
}

function computeTopWeeklyWeakness(thisWeekSameType: HistoryRecord[]): string | null {
  if (thisWeekSameType.length === 0) return null;
  const dimCount: Record<string, number> = {};
  for (const rec of thisWeekSameType) {
    const band = rec.band as Record<string, number | null | undefined> | null | undefined;
    if (!band) continue;
    const overall = band.overall;
    if (overall == null || !Number.isFinite(overall)) continue;
    for (const [dim, val] of Object.entries(band)) {
      if (dim === "overall") continue;
      if (typeof val !== "number" || !Number.isFinite(val)) continue;
      if (val < overall) dimCount[dim] = (dimCount[dim] ?? 0) + 1;
    }
  }
  const top = Object.entries(dimCount).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : null;
}

function buildWeeklySummaryLine(
  sessionCount: number,
  bandDelta: number | null,
  topWeakness: string | null,
  consistency: WeeklySummaryPreview["consistencyRating"],
): string {
  if (sessionCount === 0) return "No sessions this week yet — start today to build your streak.";

  const consistencyNote =
    consistency === "high"
      ? "Great consistency this week."
      : consistency === "medium"
      ? "Steady effort this week."
      : "One session this week — aim for 2-3 to build momentum.";

  const trendNote =
    bandDelta === null
      ? ""
      : bandDelta > 0
      ? ` Band up ${bandDelta} vs your first session this week.`
      : bandDelta < 0
      ? ` Band down ${Math.abs(bandDelta)} — focus on recovery next session.`
      : " Band holding steady.";

  const focusNote = topWeakness ? ` Keep targeting ${friendlyDim(topWeakness)}.` : "";

  return `${consistencyNote}${trendNote}${focusNote}`.trim();
}

// ── Shared utilities (imported from shared layer) ────────────────────────────

import { friendlyDim } from "@/shared/constants/dimensions";
import { toEpochMs } from "@/shared/utils/time";
