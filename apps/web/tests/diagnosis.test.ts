import test from "node:test";
import assert from "node:assert/strict";
import { diagnoseScores } from "@/lib/scoring/diagnosis";
import type { DiagnosisInput, WritingDiagnosisInput, SpeakingDiagnosisInput } from "@/lib/scoring/diagnosis";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CLEAN_WRITING: WritingDiagnosisInput = {
  examType: "writing",
  subscores: { tr_01: 0.7, cc_01: 0.65, lr_01: 0.68, gra_01: 0.72 },
  overallPre: 0.69,
  weights: {},
  flags: {},
  llmConfidence01: 0.85,
  localConfidence01: 0,
};

const CLEAN_SPEAKING: SpeakingDiagnosisInput = {
  examType: "speaking",
  subscores: { content_01: 0.7, grammar_01: 0.65, vocab_01: 0.68, fluency_01: 0.66, pronunciation_01: 0.64 },
  overallPre: 0.67,
  weights: {},
  flags: {},
  llmConfidence01: 0.9,
  localConfidence01: 1,
};

// ── No-anomaly baseline ───────────────────────────────────────────────────────

test("clean writing input produces no anomalies and severity 'none'", () => {
  const result = diagnoseScores(CLEAN_WRITING);
  assert.equal(result.anomalies.length, 0);
  assert.equal(result.severity, "none");
  assert.equal(result.lowConfidence, false);
  assert.equal(result.engineConflict, false);
});

test("clean speaking input produces no anomalies and severity 'none'", () => {
  const result = diagnoseScores(CLEAN_SPEAKING);
  assert.equal(result.anomalies.length, 0);
  assert.equal(result.severity, "none");
});

// ── Low-score dimension detection ─────────────────────────────────────────────

test("writing: subscore well below overall triggers SUBSCORE_BELOW_OVERALL (medium)", () => {
  const input: DiagnosisInput = {
    ...CLEAN_WRITING,
    subscores: { tr_01: 0.4, cc_01: 0.7, lr_01: 0.7, gra_01: 0.7 }, // overall ~0.63, tr gap=0.23
    overallPre: 0.63,
  };
  const result = diagnoseScores(input);
  const anomaly = result.anomalies.find((a) => a.code === "SUBSCORE_BELOW_OVERALL");
  assert.ok(anomaly !== undefined, "expected SUBSCORE_BELOW_OVERALL anomaly");
  assert.equal(anomaly.dimension, "tr_01");
  assert.equal(anomaly.severity, "medium");
});

test("writing: weakest dimension is first in anomaly list when sorted", () => {
  // tr_01 gap = 0.3, cc_01 gap = 0.21 — both trigger SUBSCORE_BELOW_OVERALL
  const input: DiagnosisInput = {
    ...CLEAN_WRITING,
    subscores: { tr_01: 0.4, cc_01: 0.49, lr_01: 0.72, gra_01: 0.72 },
    overallPre: 0.70,
  };
  const result = diagnoseScores(input);
  const belowOverall = result.anomalies
    .filter((a) => a.code === "SUBSCORE_BELOW_OVERALL")
    .map((a) => a.dimension);
  assert.ok(belowOverall.includes("tr_01"));
  assert.ok(belowOverall.includes("cc_01"));
});

test("speaking: fluency below overall by > 0.2 triggers SUBSCORE_BELOW_OVERALL", () => {
  const input: DiagnosisInput = {
    ...CLEAN_SPEAKING,
    subscores: { content_01: 0.75, grammar_01: 0.72, vocab_01: 0.70, fluency_01: 0.45, pronunciation_01: 0.68 },
    overallPre: 0.67,
  };
  const result = diagnoseScores(input);
  const anomaly = result.anomalies.find(
    (a) => a.code === "SUBSCORE_BELOW_OVERALL" && a.dimension === "fluency_01",
  );
  assert.ok(anomaly !== undefined);
});

// ── VERY_LOW_SUBSCORE (absolute floor) ────────────────────────────────────────

test("writing: subscore below 0.3 triggers VERY_LOW_SUBSCORE with high severity", () => {
  const input: DiagnosisInput = {
    ...CLEAN_WRITING,
    subscores: { tr_01: 0.25, cc_01: 0.65, lr_01: 0.65, gra_01: 0.65 },
    overallPre: 0.55,
  };
  const result = diagnoseScores(input);
  const anomaly = result.anomalies.find(
    (a) => a.code === "VERY_LOW_SUBSCORE" && a.dimension === "tr_01",
  );
  assert.ok(anomaly !== undefined);
  assert.equal(anomaly.severity, "high");
  assert.equal(result.severity, "high");
});

test("speaking: pronunciation below 0.3 triggers VERY_LOW_SUBSCORE", () => {
  const input: DiagnosisInput = {
    ...CLEAN_SPEAKING,
    subscores: { content_01: 0.65, grammar_01: 0.6, vocab_01: 0.62, fluency_01: 0.6, pronunciation_01: 0.28 },
    overallPre: 0.57,
  };
  const result = diagnoseScores(input);
  const anomaly = result.anomalies.find(
    (a) => a.code === "VERY_LOW_SUBSCORE" && a.dimension === "pronunciation_01",
  );
  assert.ok(anomaly !== undefined);
  assert.equal(anomaly.severity, "high");
});

// ── Flags → anomaly/severity effects ─────────────────────────────────────────

test("writing: short_essay flag produces SHORT_ESSAY anomaly with low severity", () => {
  const input: DiagnosisInput = { ...CLEAN_WRITING, flags: { short_essay: true } };
  const result = diagnoseScores(input);
  const anomaly = result.anomalies.find((a) => a.code === "SHORT_ESSAY");
  assert.ok(anomaly !== undefined);
  assert.equal(anomaly.severity, "low");
});

test("writing: local_error flag produces LOCAL_ENGINE_UNAVAILABLE with low severity", () => {
  const input: DiagnosisInput = { ...CLEAN_WRITING, flags: { local_error: true } };
  const result = diagnoseScores(input);
  const anomaly = result.anomalies.find((a) => a.code === "LOCAL_ENGINE_UNAVAILABLE");
  assert.ok(anomaly !== undefined);
  assert.equal(anomaly.severity, "low");
});

test("writing: local_content_missing flag also triggers LOCAL_ENGINE_UNAVAILABLE", () => {
  const input: DiagnosisInput = { ...CLEAN_WRITING, flags: { local_content_missing: true } };
  const result = diagnoseScores(input);
  assert.ok(result.anomalies.some((a) => a.code === "LOCAL_ENGINE_UNAVAILABLE"));
});

test("speaking: transcript_too_short flag produces TRANSCRIPT_QUALITY with medium severity", () => {
  const input: DiagnosisInput = { ...CLEAN_SPEAKING, flags: { transcript_too_short: true } };
  const result = diagnoseScores(input);
  const anomaly = result.anomalies.find((a) => a.code === "TRANSCRIPT_QUALITY");
  assert.ok(anomaly !== undefined);
  assert.equal(anomaly.severity, "medium");
});

test("speaking: transcript_empty flag produces TRANSCRIPT_QUALITY with high severity", () => {
  const input: DiagnosisInput = { ...CLEAN_SPEAKING, flags: { transcript_empty: true } };
  const result = diagnoseScores(input);
  const anomaly = result.anomalies.find((a) => a.code === "TRANSCRIPT_QUALITY");
  assert.ok(anomaly !== undefined);
  assert.equal(anomaly.severity, "high");
  assert.equal(result.severity, "high");
});

test("speaking: local_audio_missing flag produces LOCAL_AUDIO_MISSING with medium severity", () => {
  const input: DiagnosisInput = { ...CLEAN_SPEAKING, flags: { local_audio_missing: true } };
  const result = diagnoseScores(input);
  const anomaly = result.anomalies.find((a) => a.code === "LOCAL_AUDIO_MISSING");
  assert.ok(anomaly !== undefined);
  assert.equal(anomaly.severity, "medium");
});

// ── Writing vs speaking examType differences ──────────────────────────────────

test("SHORT_ESSAY anomaly is only produced for writing, not speaking", () => {
  // Speaking input with a 'short_essay' flag should not trigger SHORT_ESSAY
  const input: DiagnosisInput = { ...CLEAN_SPEAKING, flags: { short_essay: true } };
  const result = diagnoseScores(input);
  assert.ok(!result.anomalies.some((a) => a.code === "SHORT_ESSAY"));
});

test("TRANSCRIPT_QUALITY anomaly is only produced for speaking, not writing", () => {
  const input: DiagnosisInput = { ...CLEAN_WRITING, flags: { transcript_too_short: true } };
  const result = diagnoseScores(input);
  assert.ok(!result.anomalies.some((a) => a.code === "TRANSCRIPT_QUALITY"));
});

test("FLUENCY_CONTENT_MISMATCH is only produced for speaking", () => {
  // Writing has no content_01/fluency_01 so the rule should never fire
  const result = diagnoseScores(CLEAN_WRITING);
  assert.ok(!result.anomalies.some((a) => a.code === "FLUENCY_CONTENT_MISMATCH"));
});

// ── FLUENCY_CONTENT_MISMATCH rule ────────────────────────────────────────────

test("speaking: content > fluency by > 0.2 triggers FLUENCY_CONTENT_MISMATCH", () => {
  const input: DiagnosisInput = {
    ...CLEAN_SPEAKING,
    subscores: { content_01: 0.75, grammar_01: 0.68, vocab_01: 0.68, fluency_01: 0.50, pronunciation_01: 0.62 },
    overallPre: 0.65,
  };
  const result = diagnoseScores(input);
  const anomaly = result.anomalies.find((a) => a.code === "FLUENCY_CONTENT_MISMATCH");
  assert.ok(anomaly !== undefined);
  assert.equal(anomaly.dimension, "fluency_01");
  assert.equal(anomaly.severity, "medium");
});

test("speaking: content > fluency by exactly 0.2 does NOT trigger FLUENCY_CONTENT_MISMATCH", () => {
  const input: DiagnosisInput = {
    ...CLEAN_SPEAKING,
    subscores: { content_01: 0.70, grammar_01: 0.68, vocab_01: 0.68, fluency_01: 0.50, pronunciation_01: 0.62 },
    overallPre: 0.636,
  };
  const result = diagnoseScores(input);
  // gap = 0.20, rule requires > 0.2
  assert.ok(!result.anomalies.some((a) => a.code === "FLUENCY_CONTENT_MISMATCH"));
});

test("speaking: fluency >= content does not trigger FLUENCY_CONTENT_MISMATCH", () => {
  const input: DiagnosisInput = {
    ...CLEAN_SPEAKING,
    subscores: { content_01: 0.60, grammar_01: 0.65, vocab_01: 0.65, fluency_01: 0.70, pronunciation_01: 0.65 },
    overallPre: 0.65,
  };
  const result = diagnoseScores(input);
  assert.ok(!result.anomalies.some((a) => a.code === "FLUENCY_CONTENT_MISMATCH"));
});

// ── LOW_LLM_CONFIDENCE ────────────────────────────────────────────────────────

test("llmConfidence01 < 0.5 triggers LOW_LLM_CONFIDENCE (medium) and sets lowConfidence=true", () => {
  const input: DiagnosisInput = { ...CLEAN_WRITING, llmConfidence01: 0.4 };
  const result = diagnoseScores(input);
  assert.ok(result.anomalies.some((a) => a.code === "LOW_LLM_CONFIDENCE" && a.severity === "medium"));
  assert.equal(result.lowConfidence, true);
});

test("llmConfidence01 exactly 0.5 does NOT trigger LOW_LLM_CONFIDENCE", () => {
  const input: DiagnosisInput = { ...CLEAN_WRITING, llmConfidence01: 0.5 };
  const result = diagnoseScores(input);
  assert.ok(!result.anomalies.some((a) => a.code === "LOW_LLM_CONFIDENCE"));
  assert.equal(result.lowConfidence, false);
});

// ── Engine conflict detection ─────────────────────────────────────────────────

test("engineConflict=true when llm and local confidence differ by > 0.5 and local ran", () => {
  const input: DiagnosisInput = { ...CLEAN_SPEAKING, llmConfidence01: 0.9, localConfidence01: 0.3 };
  const result = diagnoseScores(input);
  assert.equal(result.engineConflict, true);
});

test("engineConflict=false when local engine did not run (localConfidence01=0)", () => {
  const input: DiagnosisInput = { ...CLEAN_WRITING, llmConfidence01: 0.9, localConfidence01: 0 };
  const result = diagnoseScores(input);
  assert.equal(result.engineConflict, false);
});

test("engineConflict=false when confidence gap is <= 0.5", () => {
  const input: DiagnosisInput = { ...CLEAN_SPEAKING, llmConfidence01: 0.8, localConfidence01: 0.4 };
  const result = diagnoseScores(input);
  assert.equal(result.engineConflict, false);
});

// ── Severity rollup ───────────────────────────────────────────────────────────

test("severity rolls up to 'high' when any anomaly is high", () => {
  // VERY_LOW_SUBSCORE fires at high; SHORT_ESSAY fires at low
  const input: DiagnosisInput = {
    ...CLEAN_WRITING,
    subscores: { tr_01: 0.2, cc_01: 0.65, lr_01: 0.65, gra_01: 0.65 },
    overallPre: 0.54,
    flags: { short_essay: true },
  };
  const result = diagnoseScores(input);
  assert.equal(result.severity, "high");
});

test("severity is 'low' when only low-severity anomalies present", () => {
  const input: DiagnosisInput = { ...CLEAN_WRITING, flags: { short_essay: true } };
  const result = diagnoseScores(input);
  assert.equal(result.severity, "low");
});

// ── Null subscores are handled gracefully ─────────────────────────────────────

test("null subscores do not trigger VERY_LOW_SUBSCORE or SUBSCORE_BELOW_OVERALL", () => {
  const input: DiagnosisInput = {
    ...CLEAN_WRITING,
    subscores: { tr_01: null, cc_01: null, lr_01: null, gra_01: null },
    overallPre: 0.6,
  };
  const result = diagnoseScores(input);
  assert.ok(!result.anomalies.some((a) => a.code === "VERY_LOW_SUBSCORE"));
  assert.ok(!result.anomalies.some((a) => a.code === "SUBSCORE_BELOW_OVERALL"));
});

test("speaking: null fluency/content skips FLUENCY_CONTENT_MISMATCH check", () => {
  const input: DiagnosisInput = {
    ...CLEAN_SPEAKING,
    subscores: { content_01: null, grammar_01: 0.65, vocab_01: 0.65, fluency_01: null, pronunciation_01: 0.65 },
    overallPre: 0.65,
  };
  const result = diagnoseScores(input);
  assert.ok(!result.anomalies.some((a) => a.code === "FLUENCY_CONTENT_MISMATCH"));
});

// ── Anomaly note format ───────────────────────────────────────────────────────

test("all anomaly notes start with 'Heuristic:'", () => {
  const input: DiagnosisInput = {
    ...CLEAN_WRITING,
    subscores: { tr_01: 0.25, cc_01: 0.4, lr_01: 0.65, gra_01: 0.65 },
    overallPre: 0.49,
    flags: { short_essay: true, local_error: true },
    llmConfidence01: 0.4,
  };
  const result = diagnoseScores(input);
  for (const anomaly of result.anomalies) {
    assert.ok(
      anomaly.note.startsWith("Heuristic:"),
      `Expected note to start with "Heuristic:" but got: "${anomaly.note}"`,
    );
  }
});
