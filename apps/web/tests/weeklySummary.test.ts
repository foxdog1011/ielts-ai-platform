import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWeeklySummaryPayload,
  buildReminderPayload,
} from "@/lib/weeklySummary";
import type { WeeklySummaryInput, ReminderInput } from "@/lib/weeklySummary";
import type { HistoryRecord } from "@/lib/history";
import type { DiagSummary, PlanSnapshot } from "@/lib/kv";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = Date.now();

function makeRec(
  type: "writing" | "speaking",
  overall: number,
  daysAgo: number,
  extras: Partial<HistoryRecord & { diagSummary?: DiagSummary; planSnapshot?: PlanSnapshot }> = {},
): HistoryRecord {
  return {
    type,
    taskId: `${type}-${daysAgo}`,
    band: { overall, grammar: overall - 0.5 },
    ts: NOW - daysAgo * 24 * 60 * 60 * 1000,
    ...extras,
  } as HistoryRecord;
}

const PLAN_STUB: PlanSnapshot = {
  currentFocus: { dimension: "grammar", reason: "repeated_weakness" },
  nextTaskRecommendation: "task2_argument",
  milestoneBand: 6.5,
};

const DIAG_HIGH: DiagSummary = {
  severity: "high",
  anomalies: [{ code: "VERY_LOW_SUBSCORE", dimension: "grammar_01", severity: "high" }],
  engineConflict: false,
  lowConfidence: false,
};

function emptyInput(now = NOW): WeeklySummaryInput {
  return { writingHistory: [], speakingHistory: [], now };
}

// ── WeeklySummaryPayload ───────────────────────────────────────────────────────

test("buildWeeklySummaryPayload: all top-level fields present", () => {
  const snap = buildWeeklySummaryPayload(emptyInput());
  assert.equal(snap.scopeId, "default");
  assert.equal(snap.windowDays, 7);
  assert.ok(typeof snap.generatedAt === "string");
  assert.ok("writing"  in snap);
  assert.ok("speaking" in snap);
  assert.ok("overallStatus" in snap);
  assert.ok("primaryFocus"  in snap);
  assert.ok("urgencyLevel"  in snap);
  assert.ok("coachLine"     in snap);
  assert.ok("reminderCandidateCopy" in snap);
});

test("buildWeeklySummaryPayload: first_week when no sessions", () => {
  const snap = buildWeeklySummaryPayload(emptyInput());
  assert.equal(snap.overallStatus, "first_week");
  assert.equal(snap.writing, null);
  assert.equal(snap.speaking, null);
  assert.equal(snap.totalSessionsAllTime, 0);
});

test("buildWeeklySummaryPayload: first_week when only 1 session total", () => {
  const snap = buildWeeklySummaryPayload({
    writingHistory: [makeRec("writing", 6.0, 2)],
    speakingHistory: [],
    now: NOW,
  });
  assert.equal(snap.overallStatus, "first_week");
});

test("buildWeeklySummaryPayload: totalSessionsAllTime counts both types", () => {
  const snap = buildWeeklySummaryPayload({
    writingHistory:  [makeRec("writing",  6.0, 1), makeRec("writing",  5.5, 3)],
    speakingHistory: [makeRec("speaking", 5.0, 2)],
    now: NOW,
  });
  assert.equal(snap.totalSessionsAllTime, 3);
});

test("buildWeeklySummaryPayload: consistencyRating high when 4+ sessions this week", () => {
  const snap = buildWeeklySummaryPayload({
    writingHistory:  [makeRec("writing",  6, 1), makeRec("writing",  6, 2)],
    speakingHistory: [makeRec("speaking", 6, 1), makeRec("speaking", 6, 3)],
    now: NOW,
  });
  assert.equal(snap.consistencyRating, "high");
});

test("buildWeeklySummaryPayload: consistencyRating low when 0 sessions this week", () => {
  const snap = buildWeeklySummaryPayload({
    writingHistory:  [makeRec("writing", 6.0, 10)],
    speakingHistory: [],
    now: NOW,
  });
  assert.equal(snap.consistencyRating, "low");
});

test("buildWeeklySummaryPayload: writing summary null when no writing history", () => {
  const snap = buildWeeklySummaryPayload({
    writingHistory: [],
    speakingHistory: [makeRec("speaking", 6, 1), makeRec("speaking", 6, 2)],
    now: NOW,
  });
  assert.equal(snap.writing, null);
  assert.ok(snap.speaking !== null);
});

test("buildWeeklySummaryPayload: ExamTypeSummary sessionCount is within-window only", () => {
  const snap = buildWeeklySummaryPayload({
    writingHistory: [
      makeRec("writing", 6.0, 1),   // in window
      makeRec("writing", 5.5, 10),  // outside window
    ],
    speakingHistory: [],
    now: NOW,
  });
  assert.equal(snap.writing?.sessionCount, 1);
});

test("buildWeeklySummaryPayload: latestBand comes from most recent record regardless of window", () => {
  const snap = buildWeeklySummaryPayload({
    writingHistory: [makeRec("writing", 7.0, 10)],  // outside window but still latest
    speakingHistory: [],
    now: NOW,
  });
  assert.equal(snap.writing?.latestBand, 7.0);
});

test("buildWeeklySummaryPayload: bandDelta positive when improving within window", () => {
  const snap = buildWeeklySummaryPayload({
    writingHistory: [
      makeRec("writing", 7.0, 1),  // newest in window
      makeRec("writing", 5.5, 5),  // oldest in window
    ],
    speakingHistory: [],
    now: NOW,
  });
  assert.equal(snap.writing?.bandDelta, 1.5);
});

test("buildWeeklySummaryPayload: bandDelta null when only 1 window session", () => {
  const snap = buildWeeklySummaryPayload({
    writingHistory: [makeRec("writing", 6.0, 2)],
    speakingHistory: [],
    now: NOW,
  });
  assert.equal(snap.writing?.bandDelta, null);
});

test("buildWeeklySummaryPayload: currentFocus from planSnapshot", () => {
  const snap = buildWeeklySummaryPayload({
    writingHistory: [makeRec("writing", 6.0, 1, { planSnapshot: PLAN_STUB })],
    speakingHistory: [],
    now: NOW,
  });
  assert.deepEqual(snap.writing?.currentFocus, PLAN_STUB.currentFocus);
  assert.equal(snap.writing?.nextTask, PLAN_STUB.nextTaskRecommendation);
});

test("buildWeeklySummaryPayload: currentFocus null when no planSnapshot in history", () => {
  const snap = buildWeeklySummaryPayload({
    writingHistory: [makeRec("writing", 6.0, 1)],
    speakingHistory: [],
    now: NOW,
  });
  assert.equal(snap.writing?.currentFocus, null);
});

test("buildWeeklySummaryPayload: recurringAnomalies populated from diagSummary", () => {
  const recs = [
    makeRec("writing", 6, 1, { diagSummary: DIAG_HIGH }),
    makeRec("writing", 6, 2, { diagSummary: DIAG_HIGH }),
  ];
  const snap = buildWeeklySummaryPayload({ writingHistory: recs, speakingHistory: [], now: NOW });
  assert.ok((snap.writing?.recurringAnomalies ?? []).includes("VERY_LOW_SUBSCORE:grammar_01"));
  assert.ok(snap.recurringAnomaliesAllTypes.includes("VERY_LOW_SUBSCORE:grammar_01"));
});

test("buildWeeklySummaryPayload: urgencyLevel urgent when recurringAnomalies present", () => {
  const recs = [
    makeRec("writing", 6, 1, { diagSummary: DIAG_HIGH }),
    makeRec("writing", 6, 2, { diagSummary: DIAG_HIGH }),
  ];
  const snap = buildWeeklySummaryPayload({ writingHistory: recs, speakingHistory: [], now: NOW });
  assert.equal(snap.urgencyLevel, "urgent");
  assert.equal(snap.writing?.urgency, "urgent");
});

test("buildWeeklySummaryPayload: primaryFocus writing when only writing exists", () => {
  const snap = buildWeeklySummaryPayload({
    writingHistory:  [makeRec("writing", 6, 1), makeRec("writing", 6, 2)],
    speakingHistory: [],
    now: NOW,
  });
  assert.equal(snap.primaryFocus, "writing");
});

test("buildWeeklySummaryPayload: primaryFocus speaking when speaking urgency higher", () => {
  const urgentSpeaking = [
    makeRec("speaking", 6, 1, { diagSummary: DIAG_HIGH }),
    makeRec("speaking", 6, 2, { diagSummary: DIAG_HIGH }),
  ];
  const snap = buildWeeklySummaryPayload({
    writingHistory:  [makeRec("writing", 6, 1), makeRec("writing", 6, 2)],
    speakingHistory: urgentSpeaking,
    now: NOW,
  });
  assert.equal(snap.primaryFocus, "speaking");
});

test("buildWeeklySummaryPayload: engagementDays counts distinct calendar days across both types", () => {
  const recentTs = NOW - 2 * 24 * 60 * 60 * 1000;
  const snap = buildWeeklySummaryPayload({
    writingHistory:  [{ ...makeRec("writing",  6, 0), ts: recentTs }],
    speakingHistory: [{ ...makeRec("speaking", 6, 0), ts: recentTs }],
    now: NOW,
  });
  // Same calendar day → 1
  assert.equal(snap.engagementDays, 1);
});

test("buildWeeklySummaryPayload: coachLine is a non-empty string", () => {
  const snap = buildWeeklySummaryPayload(emptyInput());
  assert.ok(snap.coachLine.length > 0);
});

test("buildWeeklySummaryPayload: reminderCandidateCopy is a non-empty string", () => {
  const snap = buildWeeklySummaryPayload(emptyInput());
  assert.ok(snap.reminderCandidateCopy.length > 0);
});

// ── ReminderPayload ───────────────────────────────────────────────────────────

function emptyReminder(trigger: ReminderInput["triggerType"] = "on_demand"): ReminderInput {
  return { writingHistory: [], speakingHistory: [], triggerType: trigger, now: NOW };
}

test("buildReminderPayload: all top-level fields present", () => {
  const p = buildReminderPayload(emptyReminder());
  assert.equal(p.scopeId, "default");
  assert.ok(typeof p.generatedAt === "string");
  assert.ok("triggerType"          in p);
  assert.ok("daysSinceLastSession" in p);
  assert.ok("examTypeFocus"        in p);
  assert.ok("currentFocus"         in p);
  assert.ok("nextRecommendedTask"  in p);
  assert.ok("urgency"              in p);
  assert.ok("reminderText"         in p);
  assert.ok("ctaLabel"             in p);
  assert.ok("ctaTaskType"          in p);
  assert.ok("isFirstSession"       in p);
  assert.ok("hasRecurringAnomalies" in p);
  assert.ok("hasPersistentWeakness" in p);
  assert.ok("isImproving"          in p);
});

test("buildReminderPayload: isFirstSession true when no history", () => {
  const p = buildReminderPayload(emptyReminder());
  assert.equal(p.isFirstSession, true);
  assert.equal(p.daysSinceLastSession, null);
});

test("buildReminderPayload: isFirstSession false when history exists", () => {
  const p = buildReminderPayload({
    writingHistory: [makeRec("writing", 6, 3)],
    speakingHistory: [],
    triggerType: "on_demand",
    now: NOW,
  });
  assert.equal(p.isFirstSession, false);
});

test("buildReminderPayload: daysSinceLastSession computed correctly", () => {
  const p = buildReminderPayload({
    writingHistory: [makeRec("writing", 6, 4)],
    speakingHistory: [],
    triggerType: "inactivity_3d",
    now: NOW,
  });
  assert.equal(p.daysSinceLastSession, 4);
});

test("buildReminderPayload: daysSinceLastSession uses most recent across both types", () => {
  const p = buildReminderPayload({
    writingHistory:  [makeRec("writing",  6, 10)],
    speakingHistory: [makeRec("speaking", 6, 2)],  // more recent
    triggerType: "on_demand",
    now: NOW,
  });
  assert.equal(p.daysSinceLastSession, 2);
});

test("buildReminderPayload: examTypeFocus writing when no speaking history", () => {
  const p = buildReminderPayload({
    writingHistory: [makeRec("writing", 6, 1)],
    speakingHistory: [],
    triggerType: "on_demand",
    now: NOW,
  });
  assert.equal(p.examTypeFocus, "writing");
});

test("buildReminderPayload: examTypeFocus speaking when speaking dominant (3:1)", () => {
  const p = buildReminderPayload({
    writingHistory:  [
      makeRec("writing", 6, 1),
      makeRec("writing", 6, 2),
      makeRec("writing", 6, 3),
    ],
    speakingHistory: [],  // no speaking → writing dominant, focus speaking
    triggerType: "on_demand",
    now: NOW,
  });
  // No speaking history → focus is "writing" (nudge the neglected type)
  assert.equal(p.examTypeFocus, "writing");
});

test("buildReminderPayload: examTypeFocus mixed when both types balanced", () => {
  const p = buildReminderPayload({
    writingHistory:  [makeRec("writing",  6, 1), makeRec("writing",  6, 2)],
    speakingHistory: [makeRec("speaking", 6, 1), makeRec("speaking", 6, 2)],
    triggerType: "on_demand",
    now: NOW,
  });
  assert.equal(p.examTypeFocus, "mixed");
});

test("buildReminderPayload: triggerType forwarded into payload", () => {
  const p = buildReminderPayload({
    writingHistory: [makeRec("writing", 6, 4)],
    speakingHistory: [],
    triggerType: "inactivity_3d",
    now: NOW,
  });
  assert.equal(p.triggerType, "inactivity_3d");
});

test("buildReminderPayload: hasRecurringAnomalies true when 2+ sessions with same anomaly", () => {
  const p = buildReminderPayload({
    writingHistory: [
      makeRec("writing", 6, 1, { diagSummary: DIAG_HIGH }),
      makeRec("writing", 6, 2, { diagSummary: DIAG_HIGH }),
    ],
    speakingHistory: [],
    triggerType: "on_demand",
    now: NOW,
  });
  assert.equal(p.hasRecurringAnomalies, true);
  assert.equal(p.urgency, "urgent");
});

test("buildReminderPayload: hasPersistentWeakness true when 3+ weak sessions", () => {
  const recs = [
    makeRec("writing", 6, 1),
    makeRec("writing", 6, 2),
    makeRec("writing", 6, 3),
  ];
  const p = buildReminderPayload({
    writingHistory: recs,
    speakingHistory: [],
    triggerType: "on_demand",
    now: NOW,
  });
  // grammar is 0.5 below overall in all records → persistent
  assert.equal(p.hasPersistentWeakness, true);
});

test("buildReminderPayload: currentFocus comes from planSnapshot", () => {
  const p = buildReminderPayload({
    writingHistory: [makeRec("writing", 6, 1, { planSnapshot: PLAN_STUB })],
    speakingHistory: [],
    triggerType: "on_demand",
    now: NOW,
  });
  assert.deepEqual(p.currentFocus, PLAN_STUB.currentFocus);
  assert.equal(p.nextRecommendedTask, PLAN_STUB.nextTaskRecommendation);
  assert.equal(p.ctaTaskType, PLAN_STUB.nextTaskRecommendation);
});

test("buildReminderPayload: ctaLabel reflects currentFocus dimension", () => {
  const p = buildReminderPayload({
    writingHistory: [makeRec("writing", 6, 1, { planSnapshot: PLAN_STUB })],
    speakingHistory: [],
    triggerType: "on_demand",
    now: NOW,
  });
  assert.ok(p.ctaLabel.toLowerCase().includes("grammar"));
});

test("buildReminderPayload: reminderText mentions inactivity days on inactivity_3d trigger", () => {
  const p = buildReminderPayload({
    writingHistory:  [makeRec("writing", 6, 5)],
    speakingHistory: [],
    triggerType: "inactivity_3d",
    now: NOW,
  });
  assert.ok(p.reminderText.includes("5") || p.reminderText.toLowerCase().includes("days"));
});

test("buildReminderPayload: reminderText mentions weekly on weekly trigger", () => {
  const p = buildReminderPayload({
    writingHistory:  [makeRec("writing", 6, 1), makeRec("writing", 6, 2)],
    speakingHistory: [],
    triggerType: "weekly",
    now: NOW,
  });
  assert.ok(p.reminderText.toLowerCase().includes("week"));
});

test("buildReminderPayload: isImproving true when band rising across sessions", () => {
  const p = buildReminderPayload({
    writingHistory: [
      makeRec("writing", 7.0, 1),  // latest (newest-first)
      makeRec("writing", 5.5, 5),
      makeRec("writing", 5.5, 10),
    ],
    speakingHistory: [],
    triggerType: "on_demand",
    now: NOW,
  });
  assert.equal(p.isImproving, true);
});

test("buildReminderPayload: never throws on empty input", () => {
  assert.doesNotThrow(() => buildReminderPayload(emptyReminder()));
});

test("buildWeeklySummaryPayload: never throws on empty input", () => {
  assert.doesNotThrow(() => buildWeeklySummaryPayload(emptyInput()));
});
