import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStudyPlan,
  nextHalfBand,
  rankDimensions,
  computeTrendNote,
  buildPracticeItems,
  buildReliabilityNote,
} from "@/lib/planner";
import type { PlannerInput, DimensionPriority } from "@/lib/planner";
import type { HistoryRecord } from "@/lib/history";
import type { DiagnosisResult } from "@/lib/scoring/diagnosis";

// ── nextHalfBand ─────────────────────────────────────────────────────────────

test("nextHalfBand: steps up by 0.5 from an integer band", () => {
  assert.equal(nextHalfBand(6.0), 6.5);
});

test("nextHalfBand: steps up by 0.5 from a half-band", () => {
  assert.equal(nextHalfBand(6.5), 7.0);
});

test("nextHalfBand: caps at 9.0", () => {
  assert.equal(nextHalfBand(9.0), 9.0);
  assert.equal(nextHalfBand(8.5), 9.0);
});

test("nextHalfBand: works from low bands", () => {
  assert.equal(nextHalfBand(4.0), 4.5);
  assert.equal(nextHalfBand(4.5), 5.0);
});

// ── rankDimensions ────────────────────────────────────────────────────────────

test("rankDimensions: orders dimensions by gap descending (weakest first)", () => {
  const band = { overall: 6.0, taskResponse: 5.0, coherence: 5.5, lexical: 6.5, grammar: 6.0 };
  const result = rankDimensions(band, 6.0);

  assert.equal(result[0].dimension, "taskResponse");  // gap 1.0
  assert.equal(result[1].dimension, "coherence");      // gap 0.5
  // grammar gap = 0, lexical gap = -0.5 (both non-positive, order by gap desc)
  const names = result.map((d) => d.dimension);
  assert.ok(names.includes("lexical"));
  assert.ok(names.includes("grammar"));
});

test("rankDimensions: excludes 'overall' key", () => {
  const band = { overall: 6.0, grammar: 5.5 };
  const result = rankDimensions(band, 6.0);
  assert.ok(result.every((d) => d.dimension !== "overall"));
  assert.equal(result.length, 1);
});

test("rankDimensions: null dimension gets gapToOverall=0 and currentBand=null", () => {
  const band = { overall: 6.0, fluency: null, grammar: 5.0 };
  const result = rankDimensions(band, 6.0);
  const fluencyEntry = result.find((d) => d.dimension === "fluency");
  assert.ok(fluencyEntry !== undefined);
  assert.equal(fluencyEntry.currentBand, null);
  assert.equal(fluencyEntry.gapToOverall, 0);
});

test("rankDimensions: all null dimensions returns list with all gaps=0", () => {
  const band = { overall: 6.0, a: null, b: null };
  const result = rankDimensions(band, 6.0);
  assert.equal(result.length, 2);
  assert.ok(result.every((d) => d.gapToOverall === 0));
});

// ── computeTrendNote ──────────────────────────────────────────────────────────

function makeWritingRecord(overall: number): HistoryRecord {
  return { type: "writing", taskId: "t", band: { overall } };
}

function makeSpeakingRecord(overall: number): HistoryRecord {
  return { type: "speaking", taskId: "t", band: { overall } };
}

test("computeTrendNote: returns undefined when fewer than 2 same-type records", () => {
  assert.equal(
    computeTrendNote(6.0, [makeWritingRecord(5.5)], "writing"),
    undefined,
  );
  assert.equal(computeTrendNote(6.0, [], "writing"), undefined);
});

test("computeTrendNote: returns undefined when delta < 0.25", () => {
  const history = [makeWritingRecord(5.9), makeWritingRecord(5.8)];
  assert.equal(computeTrendNote(6.0, history, "writing"), undefined);
});

test("computeTrendNote: reports improvement correctly", () => {
  const history = [makeWritingRecord(5.0), makeWritingRecord(5.0), makeWritingRecord(5.0)];
  const note = computeTrendNote(6.0, history, "writing");
  assert.ok(note !== undefined);
  assert.ok(note.includes("up"));
  assert.ok(note.includes("1"));
});

test("computeTrendNote: reports decline correctly", () => {
  const history = [makeWritingRecord(7.0), makeWritingRecord(7.0)];
  const note = computeTrendNote(6.0, history, "writing");
  assert.ok(note !== undefined);
  assert.ok(note.includes("down"));
});

test("computeTrendNote: filters to same examType only", () => {
  // Only one writing record (despite speaking records present) → undefined
  const history: HistoryRecord[] = [
    makeWritingRecord(5.0),
    makeSpeakingRecord(4.0),
    makeSpeakingRecord(4.0),
  ];
  assert.equal(computeTrendNote(6.0, history, "writing"), undefined);
});

test("computeTrendNote: uses up to 3 records for window", () => {
  // avg of [5.0, 5.0, 5.0] = 5.0; current 6.0 → up 1.0 vs last 3 sessions
  const history = [
    makeWritingRecord(5.0),
    makeWritingRecord(5.0),
    makeWritingRecord(5.0),
    makeWritingRecord(5.0), // 4th record: outside window
  ];
  const note = computeTrendNote(6.0, history, "writing");
  assert.ok(note?.includes("3 sessions"));
});

// ── buildPracticeItems ────────────────────────────────────────────────────────

const STUB_TIPS = { grammar: "Tip grammar.", coherence: "Tip coherence." };

const STUB_DIMS: DimensionPriority[] = [
  { dimension: "grammar", currentBand: 5.0, gapToOverall: 1.0 },
  { dimension: "coherence", currentBand: 5.5, gapToOverall: 0.5 },
];

test("buildPracticeItems: returns llmFeedback slice when 2+ items available", () => {
  const feedback = ["Item A.", "Item B.", "Item C.", "Item D."];
  const result = buildPracticeItems(feedback, STUB_DIMS, STUB_TIPS);
  assert.deepEqual(result, ["Item A.", "Item B.", "Item C."]);
});

test("buildPracticeItems: pads with dimension tips when feedback is sparse", () => {
  const result = buildPracticeItems(["Only one item."], STUB_DIMS, STUB_TIPS);
  assert.equal(result[0], "Only one item.");
  assert.ok(result.length >= 2);
  assert.ok(result.some((s) => s === STUB_TIPS.grammar || s === STUB_TIPS.coherence));
});

test("buildPracticeItems: uses only tips when no llmFeedback", () => {
  const result = buildPracticeItems([], STUB_DIMS, STUB_TIPS);
  assert.ok(result.length >= 1);
  assert.ok(result.every((s) => Object.values(STUB_TIPS).includes(s)));
});

test("buildPracticeItems: filters blank strings from feedback", () => {
  const result = buildPracticeItems(["", "  ", "Real item."], STUB_DIMS, STUB_TIPS);
  assert.ok(!result.includes(""));
  assert.ok(!result.includes("  "));
});

test("buildPracticeItems: does not duplicate a tip already in feedback", () => {
  const tip = STUB_TIPS.grammar;
  const result = buildPracticeItems([tip], STUB_DIMS, STUB_TIPS);
  assert.equal(result.filter((s) => s === tip).length, 1);
});

// ── buildStudyPlan (integration) ──────────────────────────────────────────────

const BASE_WRITING_INPUT: PlannerInput = {
  examType: "writing",
  currentBand: { overall: 6.0, taskResponse: 5.0, coherence: 5.5, lexical: 6.0, grammar: 6.5 },
  llmFeedback: ["Focus on task coverage.", "Use varied vocabulary."],
  recentHistory: [],
};

const BASE_SPEAKING_INPUT: PlannerInput = {
  examType: "speaking",
  currentBand: { overall: 5.5, content: 5.0, grammar: 5.5, vocab: 5.0, fluency: 4.5, pronunciation: 5.5 },
  llmFeedback: ["Speak more fluently.", "Improve pronunciation."],
  recentHistory: [],
};

test("buildStudyPlan writing: returns a valid StudyPlan shape", async () => {
  const plan = await buildStudyPlan(BASE_WRITING_INPUT);
  assert.equal(plan.planSource, "rule-based");
  assert.ok(Array.isArray(plan.priorityDimensions));
  assert.ok(typeof plan.nextTaskRecommendation === "string");
  assert.ok(typeof plan.milestoneBand === "number");
  assert.ok(Array.isArray(plan.practiceItems));
});

test("buildStudyPlan writing: weakest dimension is first in priorityDimensions", async () => {
  const plan = await buildStudyPlan(BASE_WRITING_INPUT);
  // taskResponse=5.0 is furthest below overall=6.0
  assert.equal(plan.priorityDimensions[0].dimension, "taskResponse");
});

test("buildStudyPlan writing: nextTaskRecommendation maps to taskResponse task", async () => {
  const plan = await buildStudyPlan(BASE_WRITING_INPUT);
  assert.equal(plan.nextTaskRecommendation, "task2_argument");
});

test("buildStudyPlan writing: milestoneBand is next half-band above overall", async () => {
  const plan = await buildStudyPlan(BASE_WRITING_INPUT); // overall 6.0
  assert.equal(plan.milestoneBand, 6.5);
});

test("buildStudyPlan writing: practiceItems uses llmFeedback when 2+ items", async () => {
  const plan = await buildStudyPlan(BASE_WRITING_INPUT);
  assert.deepEqual(plan.practiceItems, ["Focus on task coverage.", "Use varied vocabulary."]);
});

test("buildStudyPlan writing: trendNote absent when no history", async () => {
  const plan = await buildStudyPlan(BASE_WRITING_INPUT);
  assert.equal(plan.trendNote, undefined);
});

test("buildStudyPlan writing: trendNote present when improving over history", async () => {
  const input: PlannerInput = {
    ...BASE_WRITING_INPUT,
    recentHistory: [
      makeWritingRecord(5.0),
      makeWritingRecord(5.0),
      makeWritingRecord(5.0),
    ],
  };
  const plan = await buildStudyPlan(input);
  assert.ok(plan.trendNote !== undefined);
  assert.ok(plan.trendNote!.includes("up"));
});

test("buildStudyPlan speaking: fluency identified as weakest dimension", async () => {
  const plan = await buildStudyPlan(BASE_SPEAKING_INPUT);
  assert.equal(plan.priorityDimensions[0].dimension, "fluency"); // gap 1.0
});

test("buildStudyPlan speaking: nextTaskRecommendation maps to fluency task", async () => {
  const plan = await buildStudyPlan(BASE_SPEAKING_INPUT);
  assert.equal(plan.nextTaskRecommendation, "speaking_part2_long_turn");
});

test("buildStudyPlan speaking: priorityDimensions excludes 'overall'", async () => {
  const plan = await buildStudyPlan(BASE_SPEAKING_INPUT);
  assert.ok(plan.priorityDimensions.every((d) => d.dimension !== "overall"));
});

test("buildStudyPlan: custom plannerFn is called instead of default", async () => {
  let called = false;
  const customFn = async (): Promise<import("@/lib/planner").StudyPlan> => {
    called = true;
    return {
      priorityDimensions: [],
      nextTaskRecommendation: "custom_task",
      milestoneBand: 7.0,
      practiceItems: [],
      planSource: "llm",
    };
  };
  const plan = await buildStudyPlan(BASE_WRITING_INPUT, customFn);
  assert.equal(called, true);
  assert.equal(plan.planSource, "llm");
  assert.equal(plan.nextTaskRecommendation, "custom_task");
});

test("buildStudyPlan: all null dimensions still returns valid plan", async () => {
  const input: PlannerInput = {
    examType: "writing",
    currentBand: { overall: 6.0, taskResponse: null, coherence: null, lexical: null, grammar: null },
    llmFeedback: [],
    recentHistory: [],
  };
  const plan = await buildStudyPlan(input);
  assert.ok(plan.priorityDimensions.every((d) => d.currentBand === null && d.gapToOverall === 0));
  assert.ok(typeof plan.nextTaskRecommendation === "string");
});

test("buildStudyPlan writing: milestoneBand caps at 9.0", async () => {
  const input: PlannerInput = {
    examType: "writing",
    currentBand: { overall: 9.0 },
    llmFeedback: [],
    recentHistory: [],
  };
  const plan = await buildStudyPlan(input);
  assert.equal(plan.milestoneBand, 9.0);
});

// ── Phase 10C: diagnosisResult integration ────────────────────────────────────

// DiagnosisResult fixtures (plain objects — no need to call diagnoseScores)

const HIGH_SEVERITY_WRITING_DIAGNOSIS: DiagnosisResult = {
  anomalies: [
    {
      code: "VERY_LOW_SUBSCORE",
      dimension: "tr_01",          // maps to "taskResponse" in planner
      severity: "high",
      note: "Heuristic: tr_01 is below 0.3.",
    },
  ],
  severity: "high",
  engineConflict: false,
  lowConfidence: false,
};

const MEDIUM_SEVERITY_SPEAKING_DIAGNOSIS: DiagnosisResult = {
  anomalies: [
    {
      code: "FLUENCY_CONTENT_MISMATCH",
      dimension: "fluency_01",     // maps to "fluency" in planner
      severity: "medium",
      note: "Heuristic: fluency is below content.",
    },
  ],
  severity: "medium",
  engineConflict: false,
  lowConfidence: false,
};

const ENGINE_CONFLICT_DIAGNOSIS: DiagnosisResult = {
  anomalies: [],
  severity: "none",
  engineConflict: true,
  lowConfidence: false,
};

const LOW_CONFIDENCE_DIAGNOSIS: DiagnosisResult = {
  anomalies: [{ code: "LOW_LLM_CONFIDENCE", severity: "medium", note: "Heuristic: low." }],
  severity: "medium",
  engineConflict: false,
  lowConfidence: true,
};

const BOTH_RELIABILITY_DIAGNOSIS: DiagnosisResult = {
  anomalies: [],
  severity: "none",
  engineConflict: true,
  lowConfidence: true,
};

// ── diagnosisFlag annotation ──────────────────────────────────────────────────

test("10C: with diagnosisResult, affected dimension gets diagnosisFlag", async () => {
  const input: PlannerInput = {
    ...BASE_WRITING_INPUT,
    // taskResponse is the weakest dim in BASE_WRITING_INPUT (band 5.0, overall 6.0)
    diagnosisResult: HIGH_SEVERITY_WRITING_DIAGNOSIS,
  };
  const plan = await buildStudyPlan(input);
  const taskResponseDim = plan.priorityDimensions.find((d) => d.dimension === "taskResponse");
  assert.ok(taskResponseDim !== undefined);
  assert.equal(taskResponseDim.diagnosisFlag, "high");
});

test("10C: without diagnosisResult, no dimension has diagnosisFlag", async () => {
  const plan = await buildStudyPlan(BASE_WRITING_INPUT);
  assert.ok(plan.priorityDimensions.every((d) => d.diagnosisFlag === undefined));
});

test("10C: speaking FLUENCY_CONTENT_MISMATCH annotates fluency with medium flag", async () => {
  const input: PlannerInput = {
    ...BASE_SPEAKING_INPUT,
    diagnosisResult: MEDIUM_SEVERITY_SPEAKING_DIAGNOSIS,
  };
  const plan = await buildStudyPlan(input);
  const fluencyDim = plan.priorityDimensions.find((d) => d.dimension === "fluency");
  assert.ok(fluencyDim !== undefined);
  assert.equal(fluencyDim.diagnosisFlag, "medium");
});

test("10C: unaffected dimensions have no diagnosisFlag when only one dim is annotated", async () => {
  const input: PlannerInput = {
    ...BASE_WRITING_INPUT,
    diagnosisResult: HIGH_SEVERITY_WRITING_DIAGNOSIS,  // only tr_01 / taskResponse flagged
  };
  const plan = await buildStudyPlan(input);
  const unflagged = plan.priorityDimensions.filter((d) => d.dimension !== "taskResponse");
  assert.ok(unflagged.every((d) => d.diagnosisFlag === undefined));
});

// ── practiceItems with high-severity diagnosis ────────────────────────────────

test("10C: high-severity diagnosis prepends anomaly tip to practiceItems", async () => {
  const input: PlannerInput = {
    ...BASE_WRITING_INPUT,
    llmFeedback: ["LLM item 1.", "LLM item 2."],
    diagnosisResult: HIGH_SEVERITY_WRITING_DIAGNOSIS,
  };
  const plan = await buildStudyPlan(input);
  // First item must be the anomaly tip (VERY_LOW_SUBSCORE)
  assert.ok(
    plan.practiceItems[0].toLowerCase().includes("weakest dimension"),
    `Expected anomaly tip first, got: "${plan.practiceItems[0]}"`,
  );
});

test("10C: without diagnosis, practiceItems uses LLM feedback as before", async () => {
  const plan = await buildStudyPlan(BASE_WRITING_INPUT);
  assert.deepEqual(plan.practiceItems, ["Focus on task coverage.", "Use varied vocabulary."]);
});

test("10C: medium-severity diagnosis does NOT prepend anomaly tip", async () => {
  const input: PlannerInput = {
    ...BASE_SPEAKING_INPUT,
    llmFeedback: ["LLM item 1.", "LLM item 2."],
    diagnosisResult: MEDIUM_SEVERITY_SPEAKING_DIAGNOSIS,
  };
  const plan = await buildStudyPlan(input);
  // First item should be LLM feedback, not an anomaly tip
  assert.equal(plan.practiceItems[0], "LLM item 1.");
});

// ── buildPracticeItems: existing tests remain unaffected (new 4th-arg absent) ─

test("10C: buildPracticeItems with diagnosisResult=high prepends anomaly tip", () => {
  const diag: DiagnosisResult = HIGH_SEVERITY_WRITING_DIAGNOSIS;
  const result = buildPracticeItems(
    ["Feedback A.", "Feedback B."],
    [{ dimension: "taskResponse", currentBand: 5.0, gapToOverall: 1.0 }],
    { taskResponse: "Tip TR." },
    diag,
  );
  assert.ok(result[0].toLowerCase().includes("weakest dimension"));
  assert.ok(result.length <= 3);
});

test("10C: buildPracticeItems with no ANOMALY_PRACTICE_TIPS match falls through to feedback", () => {
  // HIGH severity but code not in ANOMALY_PRACTICE_TIPS — should not prepend anything
  const diag: DiagnosisResult = {
    anomalies: [{ code: "UNKNOWN_CODE", severity: "high", note: "Heuristic: test." }],
    severity: "high",
    engineConflict: false,
    lowConfidence: false,
  };
  const result = buildPracticeItems(
    ["Feedback A.", "Feedback B."],
    [],
    {},
    diag,
  );
  assert.equal(result[0], "Feedback A.");
});

// ── buildReliabilityNote ──────────────────────────────────────────────────────

test("10C: buildReliabilityNote returns undefined when diagnosisResult is undefined", () => {
  assert.equal(buildReliabilityNote(undefined), undefined);
});

test("10C: buildReliabilityNote returns undefined when no reliability concern", () => {
  const diag: DiagnosisResult = {
    anomalies: [],
    severity: "none",
    engineConflict: false,
    lowConfidence: false,
  };
  assert.equal(buildReliabilityNote(diag), undefined);
});

test("10C: engineConflict=true produces a reliability note mentioning disagreement", () => {
  const note = buildReliabilityNote(ENGINE_CONFLICT_DIAGNOSIS);
  assert.ok(typeof note === "string");
  assert.ok(note.toLowerCase().includes("disagreed") || note.toLowerCase().includes("disagree"));
});

test("10C: lowConfidence=true produces a reliability note mentioning confidence", () => {
  const note = buildReliabilityNote(LOW_CONFIDENCE_DIAGNOSIS);
  assert.ok(typeof note === "string");
  assert.ok(note.toLowerCase().includes("confidence"));
});

test("10C: both engineConflict and lowConfidence produces a combined note", () => {
  const note = buildReliabilityNote(BOTH_RELIABILITY_DIAGNOSIS);
  assert.ok(typeof note === "string");
  // Should mention both concerns
  const lower = note.toLowerCase();
  assert.ok(lower.includes("confidence") && (lower.includes("disagreed") || lower.includes("engines")));
});

// ── reliabilityNote in full buildStudyPlan output ─────────────────────────────

test("10C: buildStudyPlan sets reliabilityNote when engineConflict is true", async () => {
  const input: PlannerInput = {
    ...BASE_WRITING_INPUT,
    diagnosisResult: ENGINE_CONFLICT_DIAGNOSIS,
  };
  const plan = await buildStudyPlan(input);
  assert.ok(typeof plan.reliabilityNote === "string");
  assert.ok(plan.reliabilityNote!.length > 0);
});

test("10C: buildStudyPlan reliabilityNote is undefined when no diagnosis", async () => {
  const plan = await buildStudyPlan(BASE_WRITING_INPUT);
  assert.equal(plan.reliabilityNote, undefined);
});

test("10C: buildStudyPlan reliabilityNote is undefined when diagnosis has no reliability concern", async () => {
  const input: PlannerInput = {
    ...BASE_WRITING_INPUT,
    diagnosisResult: HIGH_SEVERITY_WRITING_DIAGNOSIS,  // severity:high but no conflict/lowConf
  };
  const plan = await buildStudyPlan(input);
  assert.equal(plan.reliabilityNote, undefined);
});
