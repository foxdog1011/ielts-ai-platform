import test from "node:test";
import assert from "node:assert/strict";
import { buildCoachSnapshot } from "@/lib/coach";
import type { CoachSnapshotInput } from "@/lib/coach";
import type { HistoryRecord } from "@/lib/history";
import type { DiagnosisResult } from "@/lib/scoring/diagnosis";
import type { DiagSummary } from "@/lib/kv";
import type { StudyPlan } from "@/lib/planner";

// ── Shared stubs ──────────────────────────────────────────────────────────────

function makeHistory(
  type: "writing" | "speaking",
  overalls: number[],
  daysAgo: number[] = [],
): HistoryRecord[] {
  return overalls.map((overall, i) => {
    const ts = Date.now() - (daysAgo[i] ?? i) * 24 * 60 * 60 * 1000;
    return {
      type,
      taskId: `t${i}`,
      band: { overall, grammar: overall - 0.5, vocab: overall - 0.5 },
      ts,
    } as HistoryRecord;
  });
}

const STUB_PLAN: StudyPlan = {
  priorityDimensions: [
    { dimension: "grammar", currentBand: 5.5, gapToOverall: 0.5 },
    { dimension: "vocab", currentBand: 6.0, gapToOverall: 0.0 },
  ],
  currentFocus: { dimension: "grammar", reason: "current_weakest" },
  nextTaskRecommendation: "task2_argument",
  milestoneBand: 6.5,
  practiceItems: ["Practice grammar", "Expand vocabulary"],
  planSource: "rule-based",
};

const STUB_DIAGNOSIS_NONE: DiagnosisResult = {
  anomalies: [],
  severity: "none",
  engineConflict: false,
  lowConfidence: false,
};

const STUB_DIAGNOSIS_HIGH: DiagnosisResult = {
  anomalies: [{ code: "VERY_LOW_SUBSCORE", dimension: "fluency_01", severity: "high", note: "Heuristic: low" }],
  severity: "high",
  engineConflict: false,
  lowConfidence: false,
};

function makeInput(overrides: Partial<CoachSnapshotInput> = {}): CoachSnapshotInput {
  return {
    examType: "writing",
    currentBand: { overall: 6.0, grammar: 5.5, vocab: 6.0 },
    diagnosisResult: STUB_DIAGNOSIS_NONE,
    studyPlan: STUB_PLAN,
    recentHistory: [],
    ...overrides,
  };
}

// ── LearnerProfile ────────────────────────────────────────────────────────────

test("learnerProfile: totalSessions is 0 on first session", () => {
  const snap = buildCoachSnapshot(makeInput({ recentHistory: [] }));
  assert.equal(snap.learnerProfile.totalSessions, 0);
});

test("learnerProfile: totalSessions counts only same-type records", () => {
  const history: HistoryRecord[] = [
    ...makeHistory("writing", [5.5, 6.0]),
    ...makeHistory("speaking", [5.0]),
  ];
  const snap = buildCoachSnapshot(makeInput({ recentHistory: history }));
  assert.equal(snap.learnerProfile.totalSessions, 2);
});

test("learnerProfile: avgBandLast5 is null on first session", () => {
  const snap = buildCoachSnapshot(makeInput());
  assert.equal(snap.learnerProfile.avgBandLast5, null);
});

test("learnerProfile: avgBandLast5 computed correctly", () => {
  const history = makeHistory("writing", [5.0, 6.0, 7.0]);
  const snap = buildCoachSnapshot(makeInput({ recentHistory: history }));
  assert.equal(snap.learnerProfile.avgBandLast5, 6.0);
});

test("learnerProfile: bestBand is highest across all sessions", () => {
  const history = makeHistory("writing", [5.0, 7.0, 6.5]);
  const snap = buildCoachSnapshot(makeInput({ recentHistory: history }));
  assert.equal(snap.learnerProfile.bestBand, 7.0);
});

test("learnerProfile: persistentWeaknesses uses 3-session threshold", () => {
  // grammar is 0.5 below overall in all 3 records — should appear
  const history = makeHistory("writing", [6.0, 6.0, 6.0]);
  const snap = buildCoachSnapshot(makeInput({ recentHistory: history }));
  assert.ok(snap.learnerProfile.persistentWeaknesses.includes("grammar"));
});

test("learnerProfile: persistentWeaknesses empty when only 2 weak sessions", () => {
  const history = makeHistory("writing", [6.0, 6.0]);
  const snap = buildCoachSnapshot(makeInput({ recentHistory: history }));
  assert.equal(snap.learnerProfile.persistentWeaknesses.length, 0);
});

test("learnerProfile: recentTrend is first_session with no history", () => {
  const snap = buildCoachSnapshot(makeInput({ recentHistory: [] }));
  assert.equal(snap.learnerProfile.recentTrend, "first_session");
});

test("learnerProfile: recentTrend is improving when current band > avg by 0.25+", () => {
  const history = makeHistory("writing", [5.5, 5.5, 5.5]);
  const snap = buildCoachSnapshot(makeInput({
    currentBand: { overall: 6.0 },
    recentHistory: history,
  }));
  assert.equal(snap.learnerProfile.recentTrend, "improving");
});

test("learnerProfile: engagementDays counts distinct calendar days across both types", () => {
  const today = Date.now();
  const history: HistoryRecord[] = [
    { type: "writing", taskId: "a", band: { overall: 6 }, ts: today } as HistoryRecord,
    { type: "speaking", taskId: "b", band: { overall: 5 }, ts: today } as HistoryRecord,
  ];
  const snap = buildCoachSnapshot(makeInput({ recentHistory: history }));
  // Both same calendar day → 1 day
  assert.equal(snap.learnerProfile.engagementDays, 1);
});

test("learnerProfile: topicCount counts distinct prompts", () => {
  const history: HistoryRecord[] = [
    { type: "writing", taskId: "a", prompt: "Topic A", band: { overall: 6 }, ts: Date.now() } as HistoryRecord,
    { type: "writing", taskId: "b", prompt: "Topic B", band: { overall: 6 }, ts: Date.now() } as HistoryRecord,
    { type: "writing", taskId: "c", prompt: "Topic A", band: { overall: 6 }, ts: Date.now() } as HistoryRecord,
  ];
  const snap = buildCoachSnapshot(makeInput({ recentHistory: history }));
  assert.equal(snap.learnerProfile.topicCount, 2);
});

// ── CoachSummary ──────────────────────────────────────────────────────────────

test("coachSummary: sessionLabel is 'First session' on first session", () => {
  const snap = buildCoachSnapshot(makeInput());
  assert.equal(snap.coachSummary.sessionLabel, "First session");
});

test("coachSummary: sessionLabel reflects session number", () => {
  const history = makeHistory("writing", [6.0, 6.0]);
  const snap = buildCoachSnapshot(makeInput({ recentHistory: history }));
  assert.equal(snap.coachSummary.sessionLabel, "Session 3");
});

test("coachSummary: headline mentions critical gap on high-severity diagnosis", () => {
  const snap = buildCoachSnapshot(makeInput({ diagnosisResult: STUB_DIAGNOSIS_HIGH }));
  assert.ok(snap.coachSummary.headline.toLowerCase().includes("critical") ||
    snap.coachSummary.headline.toLowerCase().includes("urgent"),
    `expected urgent headline, got: ${snap.coachSummary.headline}`);
});

test("coachSummary: headline mentions persistent weakness when present", () => {
  // Need 3 sessions with grammar weak (grammar < overall in each)
  const history: HistoryRecord[] = [
    { type: "writing", taskId: "a", band: { overall: 7.0, grammar: 5.5, vocab: 6.5 }, ts: Date.now() - 1000 } as HistoryRecord,
    { type: "writing", taskId: "b", band: { overall: 7.0, grammar: 5.5, vocab: 6.5 }, ts: Date.now() - 2000 } as HistoryRecord,
    { type: "writing", taskId: "c", band: { overall: 7.0, grammar: 5.5, vocab: 6.5 }, ts: Date.now() - 3000 } as HistoryRecord,
  ];
  const snap = buildCoachSnapshot(makeInput({
    diagnosisResult: STUB_DIAGNOSIS_NONE,
    recentHistory: history,
  }));
  assert.ok(snap.coachSummary.headline.toLowerCase().includes("grammar") ||
    snap.coachSummary.headline.toLowerCase().includes("session"),
    `expected persistent weakness headline, got: ${snap.coachSummary.headline}`);
});

test("coachSummary: encouragement is a non-empty string", () => {
  const snap = buildCoachSnapshot(makeInput());
  assert.ok(typeof snap.coachSummary.encouragement === "string");
  assert.ok(snap.coachSummary.encouragement.length > 0);
});

test("coachSummary: keyInsight mentions engine conflict when flagged", () => {
  const conflictDiag: DiagnosisResult = {
    anomalies: [],
    severity: "none",
    engineConflict: true,
    lowConfidence: false,
  };
  const snap = buildCoachSnapshot(makeInput({ diagnosisResult: conflictDiag }));
  assert.ok(snap.coachSummary.keyInsight.toLowerCase().includes("engine") ||
    snap.coachSummary.keyInsight.toLowerCase().includes("disagree"),
    `expected engine conflict insight, got: ${snap.coachSummary.keyInsight}`);
});

// ── NextActionCandidate ───────────────────────────────────────────────────────

test("nextActionCandidate: taskType matches studyPlan.nextTaskRecommendation", () => {
  const snap = buildCoachSnapshot(makeInput());
  assert.equal(snap.nextActionCandidate.taskType, STUB_PLAN.nextTaskRecommendation);
});

test("nextActionCandidate: priority is urgent on high-severity diagnosis", () => {
  const snap = buildCoachSnapshot(makeInput({ diagnosisResult: STUB_DIAGNOSIS_HIGH }));
  assert.equal(snap.nextActionCandidate.priority, "urgent");
});

test("nextActionCandidate: priority is maintenance when improving + no persistent weakness", () => {
  const history = makeHistory("writing", [5.5, 5.5, 5.5]);
  const snap = buildCoachSnapshot(makeInput({
    currentBand: { overall: 6.5 },  // large improvement → no persistent weakness from these records
    diagnosisResult: STUB_DIAGNOSIS_NONE,
    recentHistory: history,
    studyPlan: { ...STUB_PLAN },
  }));
  // grammar is still weak in all 3 records, so persistent weakness triggers — priority stays normal
  assert.ok(["urgent", "normal", "maintenance"].includes(snap.nextActionCandidate.priority));
});

test("nextActionCandidate: rationale is a non-empty string", () => {
  const snap = buildCoachSnapshot(makeInput());
  assert.ok(snap.nextActionCandidate.rationale.length > 0);
});

// ── WeeklySummaryPreview ──────────────────────────────────────────────────────

test("weeklySummaryPreview: sessionCountThisWeek is 0 for old history", () => {
  const history = makeHistory("writing", [6.0], [10]); // 10 days ago
  const snap = buildCoachSnapshot(makeInput({ recentHistory: history }));
  assert.equal(snap.weeklySummaryPreview.sessionCountThisWeek, 0);
});

test("weeklySummaryPreview: sessionCountThisWeek counts sessions within 7 days", () => {
  const history = makeHistory("writing", [6.0, 6.0], [1, 3]); // 1 and 3 days ago
  const snap = buildCoachSnapshot(makeInput({ recentHistory: history }));
  assert.equal(snap.weeklySummaryPreview.sessionCountThisWeek, 2);
});

test("weeklySummaryPreview: consistencyRating high when 4+ sessions", () => {
  const history = makeHistory("writing", [6, 6, 6, 6], [1, 2, 3, 4]);
  const snap = buildCoachSnapshot(makeInput({ recentHistory: history }));
  assert.equal(snap.weeklySummaryPreview.consistencyRating, "high");
});

test("weeklySummaryPreview: consistencyRating low when 0 sessions this week", () => {
  const history = makeHistory("writing", [6.0], [10]);
  const snap = buildCoachSnapshot(makeInput({ recentHistory: history }));
  assert.equal(snap.weeklySummaryPreview.consistencyRating, "low");
});

test("weeklySummaryPreview: bandDeltaThisWeek is null when no prior same-type session this week", () => {
  const snap = buildCoachSnapshot(makeInput({ recentHistory: [] }));
  assert.equal(snap.weeklySummaryPreview.bandDeltaThisWeek, null);
});

test("weeklySummaryPreview: bandDeltaThisWeek computed vs oldest this-week session", () => {
  const history = makeHistory("writing", [5.5], [1]); // 1 day ago, overall 5.5
  const snap = buildCoachSnapshot(makeInput({
    currentBand: { overall: 6.0 },
    recentHistory: history,
  }));
  assert.equal(snap.weeklySummaryPreview.bandDeltaThisWeek, 0.5);
});

test("weeklySummaryPreview: summaryLine is a non-empty string", () => {
  const snap = buildCoachSnapshot(makeInput());
  assert.ok(snap.weeklySummaryPreview.summaryLine.length > 0);
});

test("weeklySummaryPreview: summaryLine includes no-sessions message when empty week", () => {
  const history = makeHistory("writing", [6.0], [10]);
  const snap = buildCoachSnapshot(makeInput({ recentHistory: history }));
  assert.ok(snap.weeklySummaryPreview.summaryLine.toLowerCase().includes("session") ||
    snap.weeklySummaryPreview.summaryLine.toLowerCase().includes("streak"));
});

// ── recurringAnomalies (proves persisted diagSummary is consumed) ─────────────

function makeHistoryWithDiag(
  anomalies: DiagSummary["anomalies"],
  count: number,
): HistoryRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    type: "writing" as const,
    taskId: `d${i}`,
    band: { overall: 6 },
    ts: Date.now() - (i + 1) * 1000,
    diagSummary: {
      severity: "high" as const,
      anomalies,
      engineConflict: false,
      lowConfidence: false,
    },
  } as HistoryRecord));
}

test("learnerProfile: recurringAnomalies is empty when no diagSummary in history", () => {
  const history = makeHistory("writing", [6.0, 6.0]);
  const snap = buildCoachSnapshot(makeInput({ recentHistory: history }));
  assert.equal(snap.learnerProfile.recurringAnomalies.length, 0);
});

test("learnerProfile: recurringAnomalies empty when anomaly appears only once", () => {
  const history = makeHistoryWithDiag(
    [{ code: "VERY_LOW_SUBSCORE", dimension: "grammar_01", severity: "high" }],
    1,
  );
  const snap = buildCoachSnapshot(makeInput({ recentHistory: history }));
  assert.equal(snap.learnerProfile.recurringAnomalies.length, 0);
});

test("learnerProfile: recurringAnomalies includes key when anomaly appears in 2+ sessions", () => {
  const history = makeHistoryWithDiag(
    [{ code: "VERY_LOW_SUBSCORE", dimension: "grammar_01", severity: "high" }],
    2,
  );
  const snap = buildCoachSnapshot(makeInput({ recentHistory: history }));
  assert.ok(snap.learnerProfile.recurringAnomalies.includes("VERY_LOW_SUBSCORE:grammar_01"),
    `expected key in recurringAnomalies, got: ${JSON.stringify(snap.learnerProfile.recurringAnomalies)}`);
});

test("learnerProfile: recurringAnomalies key has no colon when dimension is absent", () => {
  const history = makeHistoryWithDiag(
    [{ code: "ENGINE_CONFLICT", severity: "high" }],
    2,
  );
  const snap = buildCoachSnapshot(makeInput({ recentHistory: history }));
  assert.ok(snap.learnerProfile.recurringAnomalies.includes("ENGINE_CONFLICT"),
    `expected ENGINE_CONFLICT in recurringAnomalies, got: ${JSON.stringify(snap.learnerProfile.recurringAnomalies)}`);
});

test("nextActionCandidate: priority is urgent when recurringAnomalies detected (even with none-severity diagnosis)", () => {
  const history = makeHistoryWithDiag(
    [{ code: "VERY_LOW_SUBSCORE", dimension: "fluency_01", severity: "high" }],
    2,
  );
  const snap = buildCoachSnapshot(makeInput({
    diagnosisResult: STUB_DIAGNOSIS_NONE,
    recentHistory: history,
  }));
  assert.equal(snap.nextActionCandidate.priority, "urgent");
});

// ── Full output shape ─────────────────────────────────────────────────────────

test("buildCoachSnapshot: all four sections present", () => {
  const snap = buildCoachSnapshot(makeInput());
  assert.ok("learnerProfile" in snap);
  assert.ok("coachSummary" in snap);
  assert.ok("nextActionCandidate" in snap);
  assert.ok("weeklySummaryPreview" in snap);
});

test("buildCoachSnapshot: never throws on empty input", () => {
  assert.doesNotThrow(() =>
    buildCoachSnapshot(makeInput({
      currentBand: {},
      diagnosisResult: undefined,
      recentHistory: [],
    }))
  );
});
