// apps/web/lib/scoring/diagnosis.ts
//
// Heuristic-based score diagnosis. Synchronous, pure function — no I/O, no LLM.
// All rules are explicitly labelled "heuristic" in their notes; none are derived
// from official IELTS scoring theory.
//
// Insertion point in pipelines: after fuseScores(), before calibrateOverall().
// The result is available to the planner via PlannerInput.diagnosisResult.

import type {
  ExamType,
  ScoreWeights,
  WritingSubscores01,
  SpeakingSubscores01,
} from "@/lib/scoring/types";

// ── Input ─────────────────────────────────────────────────────────────────────

export type WritingDiagnosisInput = {
  examType: "writing";
  subscores: WritingSubscores01;
  overallPre: number;
  weights: ScoreWeights;
  flags: Record<string, boolean | number | string | null>;
  llmConfidence01: number;
  localConfidence01: number;
};

export type SpeakingDiagnosisInput = {
  examType: "speaking";
  subscores: SpeakingSubscores01;
  overallPre: number;
  weights: ScoreWeights;
  flags: Record<string, boolean | number | string | null>;
  llmConfidence01: number;
  localConfidence01: number;
};

export type DiagnosisInput = WritingDiagnosisInput | SpeakingDiagnosisInput;

// ── Output ────────────────────────────────────────────────────────────────────

export type AnomalySeverity = "low" | "medium" | "high";

export type Anomaly = {
  /** Short machine-readable code for this anomaly, e.g. "VERY_LOW_SUBSCORE" */
  code: string;
  /** Which dimension is implicated, if applicable */
  dimension?: string;
  severity: AnomalySeverity;
  /** Human-readable heuristic note; always starts with "Heuristic:" */
  note: string;
};

export type DiagnosisResult = {
  anomalies: Anomaly[];
  /** Maximum severity across all anomalies; "none" when anomalies is empty */
  severity: "none" | AnomalySeverity;
  /**
   * True when llm and local engine confidence differ by > 0.5 and local
   * engine ran (localConfidence01 > 0). Heuristic — not an anomaly object
   * because it is a pipeline-level signal, not a per-dimension issue.
   */
  engineConflict: boolean;
  /** True when llmConfidence01 < 0.5. Mirrors LOW_LLM_CONFIDENCE anomaly. */
  lowConfidence: boolean;
};

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * diagnoseScores analyses a fused scoring result and returns a structured
 * DiagnosisResult. It is synchronous and adds zero latency to the pipeline.
 */
export function diagnoseScores(input: DiagnosisInput): DiagnosisResult {
  const anomalies: Anomaly[] = [];

  // Cast subscores to a generic map for common rules.
  // Safe: both WritingSubscores01 and SpeakingSubscores01 have only number|null values.
  const subscoresMap = input.subscores as Record<string, number | null>;

  diagnoseCommon(input.overallPre, subscoresMap, input.llmConfidence01, anomalies);

  if (input.examType === "writing") {
    diagnoseWriting(input, anomalies);
  } else {
    diagnoseSpeaking(input, anomalies);
  }

  return {
    anomalies,
    severity: rollupSeverity(anomalies),
    engineConflict: isEngineConflict(input.llmConfidence01, input.localConfidence01),
    lowConfidence: input.llmConfidence01 < 0.5,
  };
}

// ── Common rules (both examTypes) ────────────────────────────────────────────

function diagnoseCommon(
  overallPre: number,
  subscoresMap: Record<string, number | null>,
  llmConfidence01: number,
  anomalies: Anomaly[],
): void {
  // Heuristic: low LLM confidence reduces overall reliability.
  if (llmConfidence01 < 0.5) {
    anomalies.push({
      code: "LOW_LLM_CONFIDENCE",
      severity: "medium",
      note: "Heuristic: LLM confidence is below 0.5; scores from this session may be less reliable.",
    });
  }

  for (const [dim, val] of Object.entries(subscoresMap)) {
    if (val == null) continue;

    // Heuristic: absolute floor — a score below 0.3 (≈ band 4) is a critical weakness.
    if (val < 0.3) {
      anomalies.push({
        code: "VERY_LOW_SUBSCORE",
        dimension: dim,
        severity: "high",
        note: `Heuristic: ${dim} is below 0.3 (approximately band 4), indicating a critical weakness.`,
      });
    }

    // Heuristic: relative drag — dimension more than 0.2 below overall pulls the score down.
    if (overallPre - val > 0.2) {
      anomalies.push({
        code: "SUBSCORE_BELOW_OVERALL",
        dimension: dim,
        severity: "medium",
        note: `Heuristic: ${dim} is more than 0.2 below overall, acting as a drag dimension.`,
      });
    }
  }
}

// ── Writing-specific rules ────────────────────────────────────────────────────

function diagnoseWriting(
  input: WritingDiagnosisInput,
  anomalies: Anomaly[],
): void {
  const { flags } = input;

  // Heuristic: short essays reduce task response quality and LLM confidence.
  if (flags["short_essay"]) {
    anomalies.push({
      code: "SHORT_ESSAY",
      severity: "low",
      note: "Heuristic: essay word count is below 80; LLM confidence was downweighted automatically.",
    });
  }

  // Heuristic: local model not contributing means score is LLM-only.
  if (flags["local_error"] || flags["local_content_missing"]) {
    anomalies.push({
      code: "LOCAL_ENGINE_UNAVAILABLE",
      severity: "low",
      note: "Heuristic: local model did not contribute to writing fusion; score is LLM-only.",
    });
  }
}

// ── Speaking-specific rules ───────────────────────────────────────────────────

function diagnoseSpeaking(
  input: SpeakingDiagnosisInput,
  anomalies: Anomaly[],
): void {
  const { subscores, flags } = input;

  // Heuristic: empty or very short transcript makes all speaking scores unreliable.
  if (flags["transcript_empty"]) {
    anomalies.push({
      code: "TRANSCRIPT_QUALITY",
      severity: "high",
      note: "Heuristic: transcript is empty; speaking scores from this session are unreliable.",
    });
  } else if (flags["transcript_too_short"]) {
    anomalies.push({
      code: "TRANSCRIPT_QUALITY",
      severity: "medium",
      note: "Heuristic: transcript is very short (< 12 words); speaking scores may not reflect true ability.",
    });
  }

  // Heuristic: no audio path means local model cannot score fluency/pronunciation.
  if (flags["local_audio_missing"]) {
    anomalies.push({
      code: "LOCAL_AUDIO_MISSING",
      severity: "medium",
      note: "Heuristic: no audio file path provided; fluency and pronunciation scores are unavailable from local model.",
    });
  }

  // Heuristic: large gap between content and fluency suggests strong ideas but poor delivery.
  const { content_01, fluency_01 } = subscores;
  if (content_01 != null && fluency_01 != null && content_01 - fluency_01 > 0.2) {
    anomalies.push({
      code: "FLUENCY_CONTENT_MISMATCH",
      dimension: "fluency_01",
      severity: "medium",
      note: "Heuristic: content score is more than 0.2 above fluency; speaker may have strong ideas but struggles with delivery pace.",
    });
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<"none" | AnomalySeverity, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

function rollupSeverity(anomalies: Anomaly[]): "none" | AnomalySeverity {
  let max: "none" | AnomalySeverity = "none";
  for (const a of anomalies) {
    if (SEVERITY_RANK[a.severity] > SEVERITY_RANK[max]) max = a.severity;
  }
  return max;
}

function isEngineConflict(llmConfidence01: number, localConfidence01: number): boolean {
  // Heuristic: a gap > 0.5 between engine confidences is worth flagging,
  // but only when the local engine actually ran (localConfidence > 0).
  return localConfidence01 > 0 && Math.abs(llmConfidence01 - localConfidence01) > 0.5;
}
