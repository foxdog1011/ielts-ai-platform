// apps/web/lib/planner.ts
//
// Rule-based study planner. No LLM calls.
// Upgrade path: pass an LLM-backed PlannerFn to buildStudyPlan().
//
// Insertion pattern (route layer):
//
//   const [result, recentHistory] = await Promise.all([
//     runWritingPipeline(input),
//     listHistory({ type: "writing", limit: 5 }),
//   ]);
//   await saveScore("writing", { ... });
//   const studyPlan = await buildStudyPlan({ ... }).catch(() => undefined);
//   return NextResponse.json({ ok: true, data: { ...existing, studyPlan } });

import type { HistoryRecord } from "@/lib/history";
import type { AnomalySeverity, DiagnosisResult } from "@/lib/scoring/diagnosis";

// ── Input ─────────────────────────────────────────────────────────────────────

/** Band shape returned by runWritingPipeline. */
export type WritingPlannerBand = {
  overall: number;
  taskResponse?: number | null;
  coherence?: number | null;
  lexical?: number | null;
  grammar?: number | null;
};

/** Band shape returned by runSpeakingPipeline. */
export type SpeakingPlannerBand = {
  overall: number;
  content?: number | null;
  grammar?: number | null;
  vocab?: number | null;
  fluency?: number | null;
  pronunciation?: number | null;
};

/**
 * Discriminated on examType so the implementation can narrow band shape
 * without casting at the call site.
 *
 * recentHistory: pre-fetched by the caller (route layer) via
 *   listHistory({ type, limit: 5 }) run concurrently with the pipeline.
 *   Contains only *previous* sessions — the current session is saved after
 *   the pipeline returns, so it is never included here.
 */
export type PlannerInput =
  | {
      examType: "writing";
      currentBand: WritingPlannerBand;
      /** paragraphFeedback + improvements from the current session */
      llmFeedback: string[];
      recentHistory: HistoryRecord[];
      /** Optional user goal band; currently unused by rule-based impl */
      targetBand?: number;
      /**
       * Optional diagnosis result produced after fusion, before calibration.
       * Consumed by future planner implementations to boost high-severity dims.
       * Rule-based planner currently accepts but does not act on this field.
       */
      diagnosisResult?: DiagnosisResult;
    }
  | {
      examType: "speaking";
      currentBand: SpeakingPlannerBand;
      /** feedback + suggestions from the current session */
      llmFeedback: string[];
      recentHistory: HistoryRecord[];
      targetBand?: number;
      /** See writing variant for full description. */
      diagnosisResult?: DiagnosisResult;
    };

// ── Output ────────────────────────────────────────────────────────────────────

export type DimensionPriority = {
  /** Subscore dimension name, e.g. "coherence", "fluency" */
  dimension: string;
  /** Band value for this dimension (null if engine did not produce it) */
  currentBand: number | null;
  /**
   * How far this dimension is below the session overall (positive = below).
   * 0 when currentBand is null (dimension unavailable).
   */
  gapToOverall: number;
  /**
   * Highest anomaly severity targeting this dimension from diagnosis.
   * Omitted when no diagnosis was provided or no anomaly targeted this dim.
   */
  diagnosisFlag?: AnomalySeverity;
};

/**
 * The single most important dimension for the learner to focus on.
 * Priority order: diagnosis_flagged > repeated_weakness > current_weakest.
 */
export type CurrentFocus = {
  dimension: string;
  reason: "diagnosis_flagged" | "repeated_weakness" | "current_weakest";
};

export type ProgressStatus = "first_session" | "improving" | "stable" | "declining";

export type StudyPlan = {
  /** Dimensions ordered from weakest to strongest */
  priorityDimensions: DimensionPriority[];
  /**
   * The single dimension the learner should focus on most.
   * Absent only when all dimension bands equal or exceed the overall.
   */
  currentFocus?: CurrentFocus;
  /**
   * Dimensions that appeared below the session overall in ≥ 2 of the last 5
   * same-type sessions. Empty array for first-time users.
   * Omitted when the plannerFn is custom and does not compute history.
   */
  repeatedWeaknesses?: string[];
  /**
   * Overall progress direction compared to recent session history.
   * Omitted when the plannerFn is custom and does not compute history.
   */
  progressStatus?: ProgressStatus;
  /** E.g. "task2_argument", "speaking_part2_long_turn" */
  nextTaskRecommendation: string;
  /** Next achievable half-band step above current overall */
  milestoneBand: number;
  /** 2-3 actionable practice suggestions */
  practiceItems: string[];
  /** E.g. "Overall up 0.5 vs last 3 sessions" — omitted when < 2 same-type history records */
  trendNote?: string;
  /**
   * Present when scoring confidence was low or automated engines conflicted.
   * Consumers should surface this to calibrate learner expectations.
   * Omitted when there is no reliability concern.
   */
  reliabilityNote?: string;
  /** Lets consumers know how the plan was generated */
  planSource: "rule-based" | "llm";
  /**
   * Number of prior same-type sessions in recentHistory at plan-build time.
   * 0 = this is the user's first session of this exam type.
   * Omitted when the plannerFn is custom (LLM-backed) and does not compute it.
   */
  sessionCount?: number;
};

// ── Runner ────────────────────────────────────────────────────────────────────

export type PlannerFn = (input: PlannerInput) => Promise<StudyPlan>;

/**
 * buildStudyPlan is the single public entry point.
 *
 * Default plannerFn is rule-based (no LLM, no extra latency).
 * Pass an LLM-backed PlannerFn to upgrade without changing the call site.
 */
export async function buildStudyPlan(
  input: PlannerInput,
  plannerFn: PlannerFn = ruleBasedPlan,
): Promise<StudyPlan> {
  return plannerFn(input);
}

// ── Internal tables ───────────────────────────────────────────────────────────

const WRITING_TASK_MAP: Readonly<Record<string, string>> = {
  taskResponse: "task2_argument",
  coherence: "task2_structure",
  lexical: "task1_paraphrase",
  grammar: "task1_process",
};

const SPEAKING_TASK_MAP: Readonly<Record<string, string>> = {
  fluency: "speaking_part2_long_turn",
  pronunciation: "speaking_pronunciation_drill",
  content: "speaking_part3_discussion",
  vocab: "speaking_vocabulary_practice",
  grammar: "speaking_grammar_accuracy",
};

const WRITING_TIPS: Readonly<Record<string, string>> = {
  taskResponse: "Address all parts of the task prompt with specific examples.",
  coherence: "Use one central idea per paragraph and link ideas with signpost phrases.",
  lexical: "Paraphrase key terms from the prompt and vary your vocabulary range.",
  grammar: "Practice complex sentence structures and reduce repetitive patterns.",
};

const SPEAKING_TIPS: Readonly<Record<string, string>> = {
  fluency: "Practice speaking for 2 minutes on one topic without stopping.",
  pronunciation: "Record yourself and focus on word stress and intonation patterns.",
  content: "Expand answers using the PEEL structure: Point, Example, Explain, Link.",
  vocab: "Learn 5 topic-specific collocations per day and use them in practice.",
  grammar: "Practise narrating past events using a range of tenses.",
};

// ── Diagnosis-related tables ──────────────────────────────────────────────────

/**
 * Maps scoring subscore keys (with _01 suffix) to planner band dimension names.
 * Required because scoring and planner layers use different naming conventions.
 */
const SUBSCORE_TO_BAND_DIM: Readonly<Record<string, string>> = {
  tr_01: "taskResponse",
  cc_01: "coherence",
  lr_01: "lexical",
  gra_01: "grammar",
  content_01: "content",
  grammar_01: "grammar",
  vocab_01: "vocab",
  fluency_01: "fluency",
  pronunciation_01: "pronunciation",
};

/**
 * Practice tips prepended when a high-severity diagnosis anomaly is present.
 * Keyed by anomaly code. Only high-severity codes are included; medium/low
 * anomalies influence dimension tips via rankDimensions instead.
 */
const ANOMALY_PRACTICE_TIPS: Readonly<Record<string, string>> = {
  VERY_LOW_SUBSCORE:
    "Target your weakest dimension with focused drills before attempting full practice tests.",
  TRANSCRIPT_QUALITY:
    "Aim to speak for at least 60 seconds to generate reliable speaking scores.",
};

const ANOMALY_SEVERITY_ORDER: Record<AnomalySeverity, number> = { low: 1, medium: 2, high: 3 };

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Returns next half-band step above overall, capped at 9.0. */
export function nextHalfBand(overall: number): number {
  return Math.min(9.0, (Math.floor(overall * 2) / 2) + 0.5);
}

/**
 * Converts a flat band object (excluding "overall") into a ranked list.
 * Dimensions with null values get gapToOverall=0 and sort after real gaps.
 */
export function rankDimensions(
  band: Record<string, number | null | undefined>,
  overall: number,
): DimensionPriority[] {
  return Object.entries(band)
    .filter(([key]) => key !== "overall")
    .map(([dim, val]): DimensionPriority => ({
      dimension: dim,
      currentBand: val ?? null,
      gapToOverall:
        val != null ? Math.round((overall - val) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.gapToOverall - a.gapToOverall);
}

/**
 * Computes a trend note by comparing currentOverall to the average of the
 * most recent same-type history records. Returns undefined when data is
 * insufficient or the change is negligible (< 0.25 bands).
 */
export function computeTrendNote(
  currentOverall: number,
  recentHistory: HistoryRecord[],
  examType: "writing" | "speaking",
): string | undefined {
  const overalls = recentHistory
    .filter((r) => r.type === examType)
    .map((r) => (r.band as { overall?: number } | null | undefined)?.overall)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  if (overalls.length < 2) return undefined;

  const window = overalls.slice(0, 3);
  const avg = window.reduce((s, v) => s + v, 0) / window.length;
  const delta = currentOverall - avg;
  const rounded = Math.round(Math.abs(delta) * 10) / 10;
  if (rounded < 0.25) return undefined;

  const dir = delta > 0 ? "up" : "down";
  const n = window.length;
  return `Overall ${dir} ${rounded} vs last ${n} session${n !== 1 ? "s" : ""}`;
}

/**
 * Assembles 2-3 practice items.
 *
 * Priority order when diagnosisResult is provided:
 *   1. One high-severity anomaly tip (heuristic: surface critical issues first)
 *   2. LLM feedback strings (up to remaining slots)
 *   3. Dimension-specific fallback tips
 *
 * When diagnosisResult is absent and 2+ feedback strings exist, the original
 * fast-path is preserved so existing behaviour is unchanged.
 */
export function buildPracticeItems(
  llmFeedback: string[],
  priorityDimensions: DimensionPriority[],
  tipMap: Readonly<Record<string, string>>,
  diagnosisResult?: DiagnosisResult,
): string[] {
  const feedbackItems = llmFeedback
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  // Fast path: no diagnosis and sufficient feedback — preserve original behaviour.
  if (!diagnosisResult && feedbackItems.length >= 2) return feedbackItems;

  const items: string[] = [];

  // 1. Heuristic: prepend one high-severity anomaly tip to surface critical issues.
  if (diagnosisResult?.severity === "high") {
    for (const anomaly of diagnosisResult.anomalies) {
      if (anomaly.severity === "high") {
        const tip = ANOMALY_PRACTICE_TIPS[anomaly.code];
        if (tip) { items.push(tip); break; }
      }
    }
  }

  // 2. Fill with LLM feedback.
  for (const s of feedbackItems) {
    if (items.length >= 3) break;
    if (!items.includes(s)) items.push(s);
  }

  // 3. Pad with dimension tips when still short.
  for (const dim of priorityDimensions) {
    if (items.length >= 3) break;
    const tip = tipMap[dim.dimension];
    if (tip && !items.includes(tip)) items.push(tip);
  }

  return items;
}

/**
 * Annotates each DimensionPriority entry with the highest anomaly severity
 * targeting that dimension from a DiagnosisResult.
 * Internal — tested through buildStudyPlan integration tests.
 */
function annotateWithDiagnosis(
  dims: DimensionPriority[],
  diagnosisResult: DiagnosisResult,
): DimensionPriority[] {
  const dimFlags = new Map<string, AnomalySeverity>();
  for (const anomaly of diagnosisResult.anomalies) {
    if (!anomaly.dimension) continue;
    const bandDim = SUBSCORE_TO_BAND_DIM[anomaly.dimension] ?? anomaly.dimension;
    const current = dimFlags.get(bandDim);
    if (!current || ANOMALY_SEVERITY_ORDER[anomaly.severity] > ANOMALY_SEVERITY_ORDER[current]) {
      dimFlags.set(bandDim, anomaly.severity);
    }
  }
  return dims.map((d) => {
    const flag = dimFlags.get(d.dimension);
    return flag !== undefined ? { ...d, diagnosisFlag: flag } : d;
  });
}

/**
 * Builds a reliability note when scoring confidence is low or engines conflicted.
 * Returns undefined when there is no reliability concern.
 */
export function buildReliabilityNote(diagnosisResult: DiagnosisResult | undefined): string | undefined {
  if (!diagnosisResult) return undefined;
  const { engineConflict, lowConfidence } = diagnosisResult;
  if (engineConflict && lowConfidence) {
    return "Scoring confidence was low and engines disagreed — treat this session's scores as estimates.";
  }
  if (engineConflict) {
    return "Automated engines disagreed on this session's scores — treat results as estimates.";
  }
  if (lowConfidence) {
    return "Scoring confidence was low for this session — results may not fully reflect your ability.";
  }
  return undefined;
}

/**
 * Returns dimension names that were below the session overall in at least
 * `minSessions` of the provided history records (same examType only).
 * Uses the `band` field stored on each record; keys matching the planner's
 * dimension naming convention (e.g. "taskResponse", "coherence").
 */
export function computeRepeatedWeaknesses(
  recentHistory: HistoryRecord[],
  examType: "writing" | "speaking",
  minSessions = 2,
): string[] {
  const records = recentHistory
    .filter((r) => r.type === examType)
    .slice(0, 5);

  if (records.length < minSessions) return [];

  const weakCount: Record<string, number> = {};
  for (const rec of records) {
    const band = rec.band as Record<string, number | null | undefined> | null | undefined;
    if (!band) continue;
    const overall = band.overall;
    if (overall == null || !Number.isFinite(overall)) continue;
    for (const [dim, val] of Object.entries(band)) {
      if (dim === "overall") continue;
      if (typeof val !== "number" || !Number.isFinite(val)) continue;
      if (val < overall) {
        weakCount[dim] = (weakCount[dim] ?? 0) + 1;
      }
    }
  }

  return Object.entries(weakCount)
    .filter(([, count]) => count >= minSessions)
    .sort((a, b) => b[1] - a[1])
    .map(([dim]) => dim);
}

/**
 * Returns a progress status by comparing currentOverall to the average of
 * up to 3 most recent same-type sessions.
 * "first_session" when no prior same-type records exist.
 */
export function computeProgressStatus(
  currentOverall: number,
  recentHistory: HistoryRecord[],
  examType: "writing" | "speaking",
): ProgressStatus {
  const overalls = recentHistory
    .filter((r) => r.type === examType)
    .map((r) => (r.band as { overall?: number } | null | undefined)?.overall)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .slice(0, 3);

  if (overalls.length === 0) return "first_session";

  const avg = overalls.reduce((s, v) => s + v, 0) / overalls.length;
  const delta = currentOverall - avg;
  if (delta >= 0.25) return "improving";
  if (delta <= -0.25) return "declining";
  return "stable";
}

/**
 * Picks the single most important dimension to focus on.
 *
 * Priority:
 *   1. Dimension flagged with diagnosis severity "high" (system anomaly warning)
 *   2. Repeated weakness that is also currently below overall (cross-session + current)
 *   3. Repeated weakness only (cross-session memory, even if not worst this session)
 *   4. Current session's weakest dimension (gapToOverall > 0)
 *   Returns undefined when all dimensions are at or above overall.
 */
export function buildCurrentFocus(
  priorityDimensions: DimensionPriority[],
  repeatedWeaknesses: string[],
): CurrentFocus | undefined {
  // 1. Diagnosis-flagged high severity
  const highFlagged = priorityDimensions.find((d) => d.diagnosisFlag === "high");
  if (highFlagged) return { dimension: highFlagged.dimension, reason: "diagnosis_flagged" };

  // 2. Repeated weakness that is also currently below overall
  const currentlyWeak = new Set(
    priorityDimensions.filter((d) => d.gapToOverall > 0).map((d) => d.dimension),
  );
  const crossSessionAndCurrent = repeatedWeaknesses.find((rw) => currentlyWeak.has(rw));
  if (crossSessionAndCurrent) return { dimension: crossSessionAndCurrent, reason: "repeated_weakness" };

  // 3. Repeated weakness (cross-session only)
  if (repeatedWeaknesses.length > 0) return { dimension: repeatedWeaknesses[0], reason: "repeated_weakness" };

  // 4. Current weakest
  const weakest = priorityDimensions.find((d) => d.gapToOverall > 0);
  if (weakest) return { dimension: weakest.dimension, reason: "current_weakest" };

  return undefined;
}

// ── Rule-based implementation ─────────────────────────────────────────────────

async function ruleBasedPlan(input: PlannerInput): Promise<StudyPlan> {
  const { examType, currentBand, llmFeedback, recentHistory } = input;
  const diagnosisResult = input.diagnosisResult;
  const overall = currentBand.overall;
  const sessionCount = recentHistory.filter((r) => r.type === examType).length;

  const taskMap = examType === "writing" ? WRITING_TASK_MAP : SPEAKING_TASK_MAP;
  const tipMap = examType === "writing" ? WRITING_TIPS : SPEAKING_TIPS;

  // Safe cast: both PlannerBand variants are flat objects with number|null|undefined values
  const bandRecord = currentBand as Record<string, number | null | undefined>;

  const rawDims = rankDimensions(bandRecord, overall);
  const priorityDimensions = diagnosisResult
    ? annotateWithDiagnosis(rawDims, diagnosisResult)
    : rawDims;

  const repeatedWeaknesses = computeRepeatedWeaknesses(recentHistory, examType);
  const progressStatus = computeProgressStatus(overall, recentHistory, examType);
  const currentFocus = buildCurrentFocus(priorityDimensions, repeatedWeaknesses);

  const weakestDim = currentFocus?.dimension ?? priorityDimensions[0]?.dimension;
  const fallbackTask =
    examType === "writing" ? "task2_argument" : "speaking_part2_long_turn";
  const nextTaskRecommendation =
    (weakestDim != null ? taskMap[weakestDim] : undefined) ?? fallbackTask;

  const milestoneBand = nextHalfBand(overall);
  const trendNote = computeTrendNote(overall, recentHistory, examType);
  const practiceItems = buildPracticeItems(llmFeedback, priorityDimensions, tipMap, diagnosisResult);
  const reliabilityNote = buildReliabilityNote(diagnosisResult);

  return {
    priorityDimensions,
    currentFocus,
    repeatedWeaknesses,
    progressStatus,
    nextTaskRecommendation,
    milestoneBand,
    practiceItems,
    trendNote,
    reliabilityNote,
    planSource: "rule-based",
    sessionCount,
  };
}
