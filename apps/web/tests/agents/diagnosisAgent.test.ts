// tests/agents/diagnosisAgent.test.ts
//
// Phase 2 DiagnosisAgent tests.
// All deterministic — no LLM calls, no I/O.

import test from "node:test";
import assert from "node:assert/strict";
import { runDiagnosisAgent } from "@/lib/agents/diagnosisAgent";
import type { AgentContext } from "@/lib/agents/types";
import type { DiagnosisResult } from "@/lib/scoring/diagnosis";
import type { HistoryRecord } from "@/lib/history";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CLEAN_DIAG: DiagnosisResult = {
  anomalies: [],
  severity: "none",
  engineConflict: false,
  lowConfidence: false,
};

function makeWritingCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    examType: "writing",
    sessionId: "w-001",
    band: { overall: 6, taskResponse: 6.5, coherence: 6, lexical: 4.5, grammar: 6 },
    pipelineDiagnosis: CLEAN_DIAG,
    debugFlags: {},
    llmFeedback: [],
    recentHistory: [],
    ...overrides,
  };
}

function makeSpeakingCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    examType: "speaking",
    sessionId: "s-001",
    band: { overall: 6, content: 7, grammar: 6.5, vocab: 6, fluency: 4.5, pronunciation: 5 },
    pipelineDiagnosis: CLEAN_DIAG,
    debugFlags: {},
    llmFeedback: [],
    recentHistory: [],
    ...overrides,
  };
}

/** Build a HistoryRecord with diagSummary containing given anomaly codes */
function historyWithAnomalies(
  type: "writing" | "speaking",
  codes: string[],
): HistoryRecord {
  return {
    type,
    taskId: `hist-${Math.random()}`,
    diagSummary: {
      severity: "medium",
      anomalies: codes.map((code) => ({ code, severity: "medium" as const })),
      engineConflict: false,
      lowConfidence: false,
    },
  } as HistoryRecord;
}

// ── Output shape ──────────────────────────────────────────────────────────────

test("DiagnosisAgent output has all required fields", async () => {
  const result = await runDiagnosisAgent(makeWritingCtx());
  assert.ok("diagnosisResult" in result);
  assert.ok("topWeaknesses" in result);
  assert.ok("recurringIssues" in result);
  assert.ok("evidenceSummary" in result);
  assert.ok("augmented" in result);
  assert.ok("notes" in result);
  assert.ok(Array.isArray(result.topWeaknesses));
  assert.ok(Array.isArray(result.recurringIssues));
  assert.ok(typeof result.evidenceSummary === "string");
  assert.ok(result.evidenceSummary.length > 0);
});

// ── Writing case: topWeaknesses from low rubric dimension ─────────────────────

test("writing: low lexical dimension appears in topWeaknesses", async () => {
  const ctx = makeWritingCtx({
    pipelineDiagnosis: {
      anomalies: [
        {
          code: "VERY_LOW_SUBSCORE",
          dimension: "lr_01",
          severity: "high",
          note: "Heuristic: lr_01 is below 0.3",
        },
      ],
      severity: "high",
      engineConflict: false,
      lowConfidence: false,
    },
  });
  const result = await runDiagnosisAgent(ctx);
  assert.ok(result.topWeaknesses.includes("lr_01"), `expected lr_01 in topWeaknesses: ${result.topWeaknesses}`);
});

test("writing: only high/medium anomalies populate topWeaknesses (low excluded)", async () => {
  const ctx = makeWritingCtx({
    pipelineDiagnosis: {
      anomalies: [
        { code: "SHORT_ESSAY", dimension: "tr_01", severity: "low", note: "" },
        { code: "SUBSCORE_BELOW_OVERALL", dimension: "lr_01", severity: "medium", note: "" },
      ],
      severity: "medium",
      engineConflict: false,
      lowConfidence: false,
    },
  });
  const result = await runDiagnosisAgent(ctx);
  assert.ok(!result.topWeaknesses.includes("tr_01"), "low severity should be excluded");
  assert.ok(result.topWeaknesses.includes("lr_01"), "medium severity should be included");
});

test("writing: evidenceSummary mentions weakest dimensions", async () => {
  const ctx = makeWritingCtx({
    pipelineDiagnosis: {
      anomalies: [
        { code: "VERY_LOW_SUBSCORE", dimension: "gra_01", severity: "high", note: "" },
      ],
      severity: "high",
      engineConflict: false,
      lowConfidence: false,
    },
  });
  const result = await runDiagnosisAgent(ctx);
  assert.ok(
    result.evidenceSummary.includes("gra_01"),
    `expected gra_01 in summary: "${result.evidenceSummary}"`,
  );
});

// ── Speaking case: prosodic features affect evidenceSummary / notes ───────────

test("speaking: slow wpm adds prosodic note", async () => {
  const ctx = makeSpeakingCtx({
    speakingFeatures: { wpm: 55, pause_ratio: 0.1 },
  });
  const result = await runDiagnosisAgent(ctx);
  const hasWpmNote = result.notes.some((n) => n.includes("slow") || n.includes("wpm") || n.includes("55"));
  assert.ok(hasWpmNote, `expected wpm note, got: ${result.notes}`);
});

test("speaking: high pause_ratio adds prosodic note", async () => {
  const ctx = makeSpeakingCtx({
    speakingFeatures: { wpm: 120, pause_ratio: 0.4 },
  });
  const result = await runDiagnosisAgent(ctx);
  const hasPauseNote = result.notes.some((n) => n.toLowerCase().includes("pause"));
  assert.ok(hasPauseNote, `expected pause note, got: ${result.notes}`);
});

test("speaking: prosodic notes appear in evidenceSummary", async () => {
  const ctx = makeSpeakingCtx({
    speakingFeatures: { wpm: 60 },
  });
  const result = await runDiagnosisAgent(ctx);
  assert.ok(
    result.evidenceSummary.includes("Prosodic"),
    `expected Prosodic in summary: "${result.evidenceSummary}"`,
  );
});

test("speaking: normal wpm and pause_ratio produce no prosodic notes", async () => {
  const ctx = makeSpeakingCtx({
    speakingFeatures: { wpm: 130, pause_ratio: 0.15 },
  });
  const result = await runDiagnosisAgent(ctx);
  const prosodicNotes = result.notes.filter((n) => n.startsWith("Prosodic:"));
  assert.equal(prosodicNotes.length, 0, `unexpected prosodic notes: ${prosodicNotes}`);
});

// ── History case: recurringIssues ─────────────────────────────────────────────

test("recurringIssues: code in 2+ same-type sessions is flagged", async () => {
  const ctx = makeWritingCtx({
    recentHistory: [
      historyWithAnomalies("writing", ["LOW_LLM_CONFIDENCE"]),
      historyWithAnomalies("writing", ["LOW_LLM_CONFIDENCE", "SHORT_ESSAY"]),
      historyWithAnomalies("writing", ["SHORT_ESSAY"]),
    ],
  });
  const result = await runDiagnosisAgent(ctx);
  assert.ok(
    result.recurringIssues.includes("LOW_LLM_CONFIDENCE"),
    `expected LOW_LLM_CONFIDENCE recurring: ${result.recurringIssues}`,
  );
  assert.ok(
    result.recurringIssues.includes("SHORT_ESSAY"),
    `expected SHORT_ESSAY recurring: ${result.recurringIssues}`,
  );
});

test("recurringIssues: code in only 1 session is NOT flagged", async () => {
  const ctx = makeWritingCtx({
    recentHistory: [
      historyWithAnomalies("writing", ["VERY_LOW_SUBSCORE"]),
      historyWithAnomalies("writing", ["SHORT_ESSAY"]),
    ],
  });
  const result = await runDiagnosisAgent(ctx);
  assert.ok(
    !result.recurringIssues.includes("VERY_LOW_SUBSCORE"),
    "single-session code should not be recurring",
  );
});

test("recurringIssues: cross-type history is ignored", async () => {
  const ctx = makeWritingCtx({
    recentHistory: [
      historyWithAnomalies("speaking", ["LOCAL_AUDIO_MISSING"]),
      historyWithAnomalies("speaking", ["LOCAL_AUDIO_MISSING"]),
    ],
  });
  const result = await runDiagnosisAgent(ctx);
  // speaking records should not count toward writing recurringIssues
  assert.equal(result.recurringIssues.length, 0);
});

test("recurringIssues appear in evidenceSummary", async () => {
  const ctx = makeWritingCtx({
    recentHistory: [
      historyWithAnomalies("writing", ["LOW_LLM_CONFIDENCE"]),
      historyWithAnomalies("writing", ["LOW_LLM_CONFIDENCE"]),
    ],
  });
  const result = await runDiagnosisAgent(ctx);
  assert.ok(
    result.evidenceSummary.includes("LOW_LLM_CONFIDENCE"),
    `expected LOW_LLM_CONFIDENCE in summary: "${result.evidenceSummary}"`,
  );
});

// ── Engine conflict / anomaly case ────────────────────────────────────────────

test("engineConflict adds a note and appears in evidenceSummary", async () => {
  const ctx = makeSpeakingCtx({
    pipelineDiagnosis: {
      anomalies: [],
      severity: "none",
      engineConflict: true,
      lowConfidence: false,
    },
  });
  const result = await runDiagnosisAgent(ctx);
  const hasConflictNote = result.notes.some((n) => n.toLowerCase().includes("conflict"));
  assert.ok(hasConflictNote, `expected conflict note, got: ${result.notes}`);
  assert.ok(
    result.evidenceSummary.toLowerCase().includes("conflict"),
    `expected conflict in summary: "${result.evidenceSummary}"`,
  );
});

test("highSeverity diagnosis sets augmented=true", async () => {
  const ctx = makeSpeakingCtx({
    pipelineDiagnosis: {
      anomalies: [
        { code: "VERY_LOW_SUBSCORE", dimension: "fluency_01", severity: "high", note: "" },
      ],
      severity: "high",
      engineConflict: false,
      lowConfidence: false,
    },
  });
  const result = await runDiagnosisAgent(ctx);
  assert.equal(result.augmented, true);
});

// ── Missing optional fields ───────────────────────────────────────────────────

test("missing pipelineDiagnosis produces safe empty result", async () => {
  const ctx = makeWritingCtx({ pipelineDiagnosis: undefined });
  const result = await runDiagnosisAgent(ctx);
  assert.equal(result.diagnosisResult.severity, "none");
  assert.equal(result.diagnosisResult.anomalies.length, 0);
  assert.ok(result.evidenceSummary.length > 0);
  assert.equal(result.augmented, false);
});

test("missing speakingFeatures does not throw for speaking context", async () => {
  const ctx = makeSpeakingCtx({ speakingFeatures: undefined });
  const result = await runDiagnosisAgent(ctx);
  assert.ok(result.evidenceSummary.length > 0);
});

test("empty recentHistory produces empty recurringIssues", async () => {
  const ctx = makeWritingCtx({ recentHistory: [] });
  const result = await runDiagnosisAgent(ctx);
  assert.deepEqual(result.recurringIssues, []);
});

test("history records without diagSummary are safely skipped", async () => {
  const ctx = makeWritingCtx({
    recentHistory: [
      { type: "writing", taskId: "w-1" } as HistoryRecord,
      { type: "writing", taskId: "w-2" } as HistoryRecord,
    ],
  });
  const result = await runDiagnosisAgent(ctx);
  assert.deepEqual(result.recurringIssues, []);
});
