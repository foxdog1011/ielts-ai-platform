// apps/web/lib/weeklySummary.ts
//
// Deterministic, LLM-free weekly summary and reminder payload builders.
// No I/O — accepts pre-fetched history from the caller.
//
// Design goals:
//   - Stable schema for n8n / MCP / webhook consumption
//   - All fields computable without re-running the scoring pipeline
//   - Reuses existing planner / coach helpers; no new storage system
//   - Pure functions → trivially unit-testable

import type { HistoryRecord } from "@/lib/history";
import type { PlanSnapshot } from "@/lib/kv";
import { computeRepeatedWeaknesses, computeProgressStatus } from "@/lib/planner";
import { computeRecurringAnomalies } from "@/lib/coach";

// ── Shared utilities (imported from shared layer) ────────────────────────────

import { friendlyDim } from "@/shared/constants/dimensions";
import { toEpochMs } from "@/shared/utils/time";

const SEVEN_DAYS_MS  = 7  * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function toMs(rec: Pick<HistoryRecord, "ts" | "createdAt">): number {
  return toEpochMs(rec);
}

function getOverall(rec: HistoryRecord): number | null {
  const band = rec.band as { overall?: number } | null | undefined;
  const v = band?.overall;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function wavg(values: number[]): number {
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

function latestPlanSnapshot(records: HistoryRecord[]): PlanSnapshot | null {
  for (const rec of records) {
    const ps = (rec as HistoryRecord & { planSnapshot?: PlanSnapshot }).planSnapshot;
    if (ps) return ps;
  }
  return null;
}

const URGENCY_ORDER: Record<"urgent" | "normal" | "maintenance", number> = {
  urgent: 2, normal: 1, maintenance: 0,
};

// ── ExamTypeSummary ───────────────────────────────────────────────────────────

/**
 * Trend of learning progress for one exam type.
 * "first_session"      — fewer than 2 same-type sessions exist (mirrors planner).
 * "insufficient_data"  — no history for this exam type at all.
 */
export type ExamTypeTrend =
  | "improving"
  | "stable"
  | "declining"
  | "first_session"
  | "insufficient_data";

/**
 * Per-exam-type signals for the weekly summary.
 * All fields are derivable from persisted HistoryRecord data — no LLM needed.
 */
export type ExamTypeSummary = {
  examType: "writing" | "speaking";

  /** Sessions submitted within the 7-day window. */
  sessionCount: number;

  /**
   * Overall band from the most recent session ever (not window-limited).
   * Null when no sessions exist.
   */
  latestBand: number | null;

  /**
   * Average overall band across window sessions.
   * Null when sessionCount is 0.
   */
  avgBand: number | null;

  /**
   * Latest minus oldest overall band within the window.
   * Positive = improving within the week.
   * Null when sessionCount < 2.
   */
  bandDelta: number | null;

  /**
   * Learning trajectory derived from all same-type history using
   * the same threshold as the planner (±0.25 bands vs prior 3-session avg).
   * "insufficient_data" only when no history exists.
   */
  trend: ExamTypeTrend;

  /**
   * Dimensions below overall in 3+ of the last 5 same-type sessions.
   * Stricter threshold than planner (2) — reflects durable patterns.
   */
  persistentWeaknesses: string[];

  /**
   * Anomaly keys from persisted diagSummary appearing in 2+ sessions.
   * Format: "CODE" or "CODE:dimension".
   */
  recurringAnomalies: string[];

  /**
   * Recommended focus dimension from the latest persisted planSnapshot.
   * Null when no planSnapshot has been stored yet.
   */
  currentFocus: { dimension: string; reason: string } | null;

  /**
   * Next recommended task type from the latest persisted planSnapshot.
   * Null when no planSnapshot has been stored yet.
   */
  nextTask: string | null;

  /** Rolled-up urgency for this exam type. */
  urgency: "urgent" | "normal" | "maintenance";

  /** ISO 8601 timestamp of the most recent session. Null if no sessions. */
  lastSessionAt: string | null;
};

function buildExamTypeSummary(
  examType: "writing" | "speaking",
  historyNewestFirst: HistoryRecord[],
  windowMs: number,
): ExamTypeSummary {
  if (historyNewestFirst.length === 0) {
    return {
      examType,
      sessionCount: 0,
      latestBand: null,
      avgBand: null,
      bandDelta: null,
      trend: "insufficient_data",
      persistentWeaknesses: [],
      recurringAnomalies: [],
      currentFocus: null,
      nextTask: null,
      urgency: "normal",
      lastSessionAt: null,
    };
  }

  const now = Date.now();
  const windowRecs = historyNewestFirst.filter((r) => toMs(r) > now - windowMs);
  const sessionCount = windowRecs.length;

  const windowOveralls = windowRecs.map(getOverall).filter((v): v is number => v !== null);
  const avgBand = windowOveralls.length > 0 ? wavg(windowOveralls) : null;
  const bandDelta =
    windowOveralls.length >= 2
      ? Math.round((windowOveralls[0] - windowOveralls[windowOveralls.length - 1]) * 10) / 10
      : null;

  const latestBand = getOverall(historyNewestFirst[0]);

  // trend: compare most recent band vs prior sessions (same logic as post-session planner)
  const trend: ExamTypeTrend = computeProgressStatus(
    latestBand ?? 0,
    historyNewestFirst.slice(1), // rest of history as "prior"
    examType,
  );

  const persistentWeaknesses = computeRepeatedWeaknesses(historyNewestFirst, examType, 3);
  const recurringAnomalies   = computeRecurringAnomalies(historyNewestFirst);

  const ps = latestPlanSnapshot(historyNewestFirst);
  const currentFocus = ps?.currentFocus ?? null;
  const nextTask     = ps?.nextTaskRecommendation ?? null;

  const isUrgent =
    recurringAnomalies.length > 0 ||
    (trend === "declining" && persistentWeaknesses.length > 0);
  const isMaintenance =
    trend === "improving" &&
    persistentWeaknesses.length === 0 &&
    recurringAnomalies.length === 0;
  const urgency: ExamTypeSummary["urgency"] = isUrgent
    ? "urgent"
    : isMaintenance
    ? "maintenance"
    : "normal";

  const lastSessionAt = new Date(toMs(historyNewestFirst[0])).toISOString();

  return {
    examType,
    sessionCount,
    latestBand,
    avgBand,
    bandDelta,
    trend,
    persistentWeaknesses,
    recurringAnomalies,
    currentFocus,
    nextTask,
    urgency,
    lastSessionAt,
  };
}

// ── WeeklySummaryPayload ──────────────────────────────────────────────────────

/**
 * Comprehensive weekly summary payload.
 *
 * Design rationale:
 *   - `scopeId: "default"` — no user auth in current app; replace with real
 *     userId when auth is introduced. Fixed literal type prevents accidental
 *     omission and makes migration obvious.
 *   - `windowDays: 7` — fixed literal; consumers don't need to check it, but
 *     it clarifies the data freshness contract for downstream automation.
 *   - Per-type breakdowns (`writing`, `speaking`) allow n8n to branch on
 *     a single type without parsing cross-type aggregates.
 *   - `recurringAnomaliesAllTypes` is the union of both types' anomaly keys —
 *     useful for a single "anything broken?" guard in automation.
 *   - `primaryFocus` is a routing hint: which exam type the learner should
 *     open next. Derived from urgency + session imbalance, not UI state.
 *   - `coachLine` and `reminderCandidateCopy` are the only human-readable
 *     fields. All other fields are structured for programmatic use.
 */
export type WeeklySummaryPayload = {
  /**
   * Scope identifier.
   * "default" = singleton scope (no user auth in current app).
   * Replace with real userId when auth is introduced.
   */
  scopeId: "default";

  /** ISO 8601 timestamp of when this payload was generated. */
  generatedAt: string;

  /** Summary window in days. Always 7 for weekly. */
  windowDays: 7;

  // ── Learner context ────────────────────────────────────────────────────────

  /** Total sessions ever recorded across both exam types. */
  totalSessionsAllTime: number;

  /** Distinct calendar days with any session in the last 30 days. */
  engagementDays: number;

  /** Based on total sessions within the 7-day window across both types. */
  consistencyRating: "high" | "medium" | "low";

  // ── Per-type breakdowns ────────────────────────────────────────────────────

  /** Writing signals. Null when no writing sessions have ever been recorded. */
  writing: ExamTypeSummary | null;

  /** Speaking signals. Null when no speaking sessions have ever been recorded. */
  speaking: ExamTypeSummary | null;

  // ── Cross-type aggregate signals ──────────────────────────────────────────

  /**
   * Rolled-up learning status across both exam types.
   * "first_week" when totalSessionsAllTime < 2 — avoids false trend signals.
   */
  overallStatus: "improving" | "stable" | "declining" | "first_week";

  /**
   * Union of recurringAnomalies from writing and speaking (deduplicated).
   * n8n guard: if length > 0, route to urgent notification.
   */
  recurringAnomaliesAllTypes: string[];

  // ── Recommended track ──────────────────────────────────────────────────────

  /**
   * Which exam type deserves the most attention this week.
   * Derived from: urgency signals first, then session-count imbalance.
   * "balanced" when signals are equivalent or both need work.
   */
  primaryFocus: "writing" | "speaking" | "balanced";

  /** Highest urgency level across both exam types. */
  urgencyLevel: "urgent" | "normal" | "maintenance";

  // ── Human-readable outputs ─────────────────────────────────────────────────

  /**
   * One-sentence coach summary. Deterministic rule-based text.
   * Not for direct display without localisation — treat as a template.
   */
  coachLine: string;

  /**
   * Short notification-ready reminder copy (~100 chars).
   * Suitable for: push notification body, email subject, Discord message.
   */
  reminderCandidateCopy: string;
};

export type WeeklySummaryInput = {
  /** Newest-first writing history records. */
  writingHistory: HistoryRecord[];
  /** Newest-first speaking history records. */
  speakingHistory: HistoryRecord[];
  /** Override wall clock for deterministic testing. Defaults to Date.now(). */
  now?: number;
};

export function buildWeeklySummaryPayload(input: WeeklySummaryInput): WeeklySummaryPayload {
  const { writingHistory, speakingHistory } = input;
  const now = input.now ?? Date.now();

  const writing  = writingHistory.length  > 0 ? buildExamTypeSummary("writing",  writingHistory,  SEVEN_DAYS_MS) : null;
  const speaking = speakingHistory.length > 0 ? buildExamTypeSummary("speaking", speakingHistory, SEVEN_DAYS_MS) : null;

  const totalSessionsAllTime = writingHistory.length + speakingHistory.length;

  const thirtyAgo = now - THIRTY_DAYS_MS;
  const engagementDays = new Set(
    [...writingHistory, ...speakingHistory]
      .filter((r) => toMs(r) > thirtyAgo)
      .map((r) => new Date(toMs(r)).toDateString()),
  ).size;

  const totalThisWeek = (writing?.sessionCount ?? 0) + (speaking?.sessionCount ?? 0);
  const consistencyRating: WeeklySummaryPayload["consistencyRating"] =
    totalThisWeek >= 4 ? "high" : totalThisWeek >= 2 ? "medium" : "low";

  const overallStatus    = computeOverallStatus(totalSessionsAllTime, writing, speaking);
  const urgencyLevel     = computeUrgencyLevel(writing, speaking);
  const primaryFocus     = computePrimaryFocus(writing, speaking);

  const recurringAnomaliesAllTypes = [
    ...new Set([
      ...(writing?.recurringAnomalies  ?? []),
      ...(speaking?.recurringAnomalies ?? []),
    ]),
  ];

  const coachLine = buildCoachLine(overallStatus, writing, speaking, consistencyRating, urgencyLevel);
  const reminderCandidateCopy = buildReminderCandidateCopy(
    overallStatus, primaryFocus, writing, speaking, consistencyRating,
  );

  return {
    scopeId: "default",
    generatedAt: new Date(now).toISOString(),
    windowDays: 7,
    totalSessionsAllTime,
    engagementDays,
    consistencyRating,
    writing,
    speaking,
    overallStatus,
    recurringAnomaliesAllTypes,
    primaryFocus,
    urgencyLevel,
    coachLine,
    reminderCandidateCopy,
  };
}

function computeOverallStatus(
  totalSessions: number,
  writing: ExamTypeSummary | null,
  speaking: ExamTypeSummary | null,
): WeeklySummaryPayload["overallStatus"] {
  if (totalSessions < 2) return "first_week";
  const trends = [writing?.trend, speaking?.trend].filter(
    (t): t is ExamTypeTrend => t !== undefined && t !== "insufficient_data",
  );
  if (trends.length === 0) return "first_week";
  if (trends.some((t) => t === "declining")) return "declining";
  if (trends.some((t) => t === "improving")) return "improving";
  return "stable";
}

function computeUrgencyLevel(
  writing: ExamTypeSummary | null,
  speaking: ExamTypeSummary | null,
): WeeklySummaryPayload["urgencyLevel"] {
  const wu = writing?.urgency  ?? "normal";
  const su = speaking?.urgency ?? "normal";
  return URGENCY_ORDER[wu] >= URGENCY_ORDER[su] ? wu : su;
}

function computePrimaryFocus(
  writing: ExamTypeSummary | null,
  speaking: ExamTypeSummary | null,
): WeeklySummaryPayload["primaryFocus"] {
  if (writing && !speaking)  return "writing";
  if (speaking && !writing)  return "speaking";
  if (!writing && !speaking) return "balanced";
  // Urgency wins
  const wu = URGENCY_ORDER[writing!.urgency];
  const su = URGENCY_ORDER[speaking!.urgency];
  if (wu > su) return "writing";
  if (su > wu) return "speaking";
  // Tie-break: fewer sessions this week needs more attention
  if (writing!.sessionCount < speaking!.sessionCount) return "writing";
  if (speaking!.sessionCount < writing!.sessionCount) return "speaking";
  return "balanced";
}

function buildCoachLine(
  overallStatus: WeeklySummaryPayload["overallStatus"],
  writing: ExamTypeSummary | null,
  speaking: ExamTypeSummary | null,
  consistency: WeeklySummaryPayload["consistencyRating"],
  urgency: WeeklySummaryPayload["urgencyLevel"],
): string {
  if (overallStatus === "first_week") {
    return "Getting started — build a consistent practice habit and patterns will emerge.";
  }

  if (urgency === "urgent") {
    const urgentSummary = writing?.urgency === "urgent" ? writing : speaking;
    const dim = urgentSummary?.persistentWeaknesses[0] ?? urgentSummary?.currentFocus?.dimension;
    const type = writing?.urgency === "urgent" ? "writing" : "speaking";
    if (dim) return `Recurring ${friendlyDim(dim)} weakness in ${type} — focused drills this week.`;
    return `Recurring anomaly detected — targeted ${type} practice is urgent.`;
  }

  if (overallStatus === "improving") {
    return consistency === "high"
      ? "Consistent practice is working — you're improving across the board."
      : "Progress visible — more sessions per week will accelerate it.";
  }

  if (overallStatus === "declining") {
    const type = writing?.trend === "declining" ? "writing" : "speaking";
    return `${type.charAt(0).toUpperCase() + type.slice(1)} band slipping — one focused session can turn it around.`;
  }

  // stable
  return consistency === "low"
    ? "Scores stable but sessions are sparse — aim for 3+ sessions this week."
    : "Holding steady — push your weakest dimension to break the plateau.";
}

function buildReminderCandidateCopy(
  overallStatus: WeeklySummaryPayload["overallStatus"],
  primaryFocus: WeeklySummaryPayload["primaryFocus"],
  writing: ExamTypeSummary | null,
  speaking: ExamTypeSummary | null,
  consistency: WeeklySummaryPayload["consistencyRating"],
): string {
  if (overallStatus === "first_week") {
    return "Ready for your next IELTS session? Start a quick practice to build your baseline.";
  }

  const focusedSummary = primaryFocus === "writing" ? writing : primaryFocus === "speaking" ? speaking : null;
  const typeName = primaryFocus === "balanced" ? "IELTS" : primaryFocus;
  const totalThisWeek = (writing?.sessionCount ?? 0) + (speaking?.sessionCount ?? 0);

  if (focusedSummary?.urgency === "urgent") {
    const dim = focusedSummary.persistentWeaknesses[0] ?? focusedSummary.currentFocus?.dimension ?? "your focus area";
    return `Your ${friendlyDim(dim)} needs attention — a 15-min ${typeName} drill could shift your band.`;
  }

  if (consistency === "low") {
    const n = totalThisWeek;
    return `Only ${n} session${n === 1 ? "" : "s"} this week — a quick ${typeName} practice keeps your streak going.`;
  }

  if (overallStatus === "improving") {
    return `You're on a roll with ${typeName} — keep the momentum with another session this week.`;
  }

  return `Time to practice ${typeName} — consistency is what moves the band.`;
}

// ── ReminderPayload ───────────────────────────────────────────────────────────

/**
 * Lightweight reminder-ready payload.
 *
 * Design rationale:
 *   - `triggerType` is set by the caller (n8n schedule, MCP tool, webhook).
 *     The builder is agnostic — it computes the same fields regardless.
 *   - `daysSinceLastSession` is the primary routing signal for inactivity rules.
 *   - `examTypeFocus` routes the learner to the right exam type without UI logic.
 *   - `ctaLabel` + `ctaTaskType` are decoupled: label is human text, taskType is
 *     machine-readable for deep-linking or form pre-fill.
 *   - Boolean flags (`isFirstSession`, `hasRecurringAnomalies`, …) are explicit
 *     for n8n conditional branching — avoids string comparison in automation nodes.
 *   - `reminderText` is kept to ~120 chars; suitable for push notification body,
 *     email subject line, or Discord message body without truncation.
 */
export type ReminderPayload = {
  scopeId: "default";

  /** ISO 8601 timestamp of when this payload was generated. */
  generatedAt: string;

  /**
   * What caused this reminder to be generated.
   * Set by the caller — the builder does not auto-detect.
   */
  triggerType: "inactivity_3d" | "weekly" | "on_demand";

  // ── Context ────────────────────────────────────────────────────────────────

  /**
   * Whole days since the most recent session of any exam type.
   * Null when no sessions have ever been recorded.
   * n8n: use this to gate inactivity_3d notifications.
   */
  daysSinceLastSession: number | null;

  /**
   * Which exam type this reminder targets.
   * "mixed"    = both types equally active (or no sessions yet).
   * "writing"  = writing has been neglected relative to speaking (3:1+ ratio).
   * "speaking" = speaking has been neglected relative to writing.
   */
  examTypeFocus: "writing" | "speaking" | "mixed";

  // ── Action ────────────────────────────────────────────────────────────────

  /**
   * Current recommended focus from the latest persisted planSnapshot.
   * Null when no planSnapshot has been stored yet (first-time user).
   */
  currentFocus: { dimension: string; reason: string } | null;

  /**
   * Next recommended task type from the latest persisted planSnapshot.
   * Null when no planSnapshot has been stored yet.
   */
  nextRecommendedTask: string | null;

  urgency: "urgent" | "normal" | "maintenance";

  // ── Notification copy ──────────────────────────────────────────────────────

  /**
   * Push/email/Discord body. ~100-120 chars.
   * Varies by triggerType, urgency, and learner context.
   */
  reminderText: string;

  /** Human-readable CTA button label. E.g. "Practice Grammar". */
  ctaLabel: string;

  /**
   * Machine-readable task type for deep-linking or form pre-fill.
   * Mirrors nextRecommendedTask.
   */
  ctaTaskType: string | null;

  // ── Condition flags for n8n branching ─────────────────────────────────────

  /** True when no sessions of any type have ever been recorded. */
  isFirstSession: boolean;

  /**
   * True when any exam type has anomalies appearing in 2+ persisted sessions.
   * n8n: if true, route to urgent notification channel.
   */
  hasRecurringAnomalies: boolean;

  /**
   * True when any exam type has a dimension weak in 3+ sessions.
   * n8n: if true, prepend a weakness-focus message.
   */
  hasPersistentWeakness: boolean;

  /** True when at least one exam type is on an improving trend. */
  isImproving: boolean;
};

export type ReminderInput = {
  /** Newest-first writing history records. */
  writingHistory: HistoryRecord[];
  /** Newest-first speaking history records. */
  speakingHistory: HistoryRecord[];
  triggerType: ReminderPayload["triggerType"];
  /** Override wall clock for deterministic testing. Defaults to Date.now(). */
  now?: number;
};

export function buildReminderPayload(input: ReminderInput): ReminderPayload {
  const { writingHistory, speakingHistory, triggerType } = input;
  const now = input.now ?? Date.now();

  const isFirstSession = writingHistory.length === 0 && speakingHistory.length === 0;

  // Most recent session across both types
  const allSorted = [...writingHistory, ...speakingHistory].sort((a, b) => toMs(b) - toMs(a));
  const lastRec = allSorted[0] ?? null;
  const daysSinceLastSession = lastRec !== null
    ? Math.floor((now - toMs(lastRec)) / (24 * 60 * 60 * 1000))
    : null;

  // Exam type focus: derived from relative session volume
  const wLen = writingHistory.length;
  const sLen = speakingHistory.length;
  const examTypeFocus: ReminderPayload["examTypeFocus"] =
    wLen === 0 && sLen === 0 ? "mixed"
    : wLen === 0             ? "speaking"
    : sLen === 0             ? "writing"
    : wLen >= 3 * sLen       ? "speaking" // writing dominant → nudge speaking
    : sLen >= 3 * wLen       ? "writing"  // speaking dominant → nudge writing
    : "mixed";

  // Plan signals from most recent session
  const ps          = latestPlanSnapshot(allSorted);
  const currentFocus        = ps?.currentFocus ?? null;
  const nextRecommendedTask = ps?.nextTaskRecommendation ?? null;

  // Cross-type signals — read persisted diagSummary from history
  const hasRecurringAnomalies =
    computeRecurringAnomalies(writingHistory).length > 0 ||
    computeRecurringAnomalies(speakingHistory).length > 0;

  const hasPersistentWeakness =
    computeRepeatedWeaknesses(writingHistory,  "writing",  3).length > 0 ||
    computeRepeatedWeaknesses(speakingHistory, "speaking", 3).length > 0;

  const wTrend = writingHistory.length  > 1
    ? computeProgressStatus(getOverall(writingHistory[0])  ?? 0, writingHistory.slice(1),  "writing")
    : null;
  const sTrend = speakingHistory.length > 1
    ? computeProgressStatus(getOverall(speakingHistory[0]) ?? 0, speakingHistory.slice(1), "speaking")
    : null;
  const isImproving = wTrend === "improving" || sTrend === "improving";

  const urgency: ReminderPayload["urgency"] =
    hasRecurringAnomalies                                           ? "urgent"
    : hasPersistentWeakness && (wTrend === "declining" || sTrend === "declining") ? "urgent"
    : isImproving && !hasPersistentWeakness && !hasRecurringAnomalies            ? "maintenance"
    : "normal";

  const reminderText = buildReminderText(
    triggerType, examTypeFocus, daysSinceLastSession, urgency, currentFocus, isFirstSession,
  );
  const ctaLabel   = buildCtaLabel(currentFocus, examTypeFocus);
  const ctaTaskType = nextRecommendedTask;

  return {
    scopeId: "default",
    generatedAt: new Date(now).toISOString(),
    triggerType,
    daysSinceLastSession,
    examTypeFocus,
    currentFocus,
    nextRecommendedTask,
    urgency,
    reminderText,
    ctaLabel,
    ctaTaskType,
    isFirstSession,
    hasRecurringAnomalies,
    hasPersistentWeakness,
    isImproving,
  };
}

function buildReminderText(
  triggerType: ReminderPayload["triggerType"],
  examTypeFocus: ReminderPayload["examTypeFocus"],
  daysSince: number | null,
  urgency: ReminderPayload["urgency"],
  currentFocus: { dimension: string; reason: string } | null,
  isFirstSession: boolean,
): string {
  if (isFirstSession) {
    return "Start your IELTS journey — complete your first practice session today.";
  }

  if (urgency === "urgent" && currentFocus) {
    const typeStr = examTypeFocus === "mixed" ? "IELTS" : examTypeFocus;
    return `Recurring ${friendlyDim(currentFocus.dimension)} weakness detected. A focused ${typeStr} drill today could shift your band.`;
  }

  if (triggerType === "inactivity_3d" && daysSince !== null && daysSince >= 3) {
    const typeStr = examTypeFocus === "mixed" ? "IELTS" : examTypeFocus;
    return `${daysSince} days since your last session — keep your ${typeStr} momentum going.`;
  }

  if (triggerType === "weekly") {
    const typeStr = examTypeFocus === "mixed" ? "IELTS" : examTypeFocus;
    return `Weekly check-in: time for a ${typeStr} practice to keep your progress on track.`;
  }

  const typeStr = examTypeFocus === "mixed" ? "IELTS" : examTypeFocus;
  const dimStr = currentFocus ? friendlyDim(currentFocus.dimension) : "your weakest area";
  return `Ready to practice ${typeStr}? Your current focus is ${dimStr}.`;
}

function buildCtaLabel(
  currentFocus: { dimension: string; reason: string } | null,
  examTypeFocus: ReminderPayload["examTypeFocus"],
): string {
  if (currentFocus) return `Practice ${friendlyDim(currentFocus.dimension)}`;
  if (examTypeFocus === "writing")  return "Start Writing Practice";
  if (examTypeFocus === "speaking") return "Start Speaking Practice";
  return "Start Practice";
}
