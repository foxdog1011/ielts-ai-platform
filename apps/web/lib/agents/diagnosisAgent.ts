// apps/web/lib/agents/diagnosisAgent.ts
//
// DiagnosisAgent — Phase 2.
// Augments the pipeline's DiagnosisResult with:
//   - topWeaknesses:   dimensions from medium/high anomalies
//   - recurringIssues: anomaly codes appearing in 2+ prior same-type sessions
//   - evidenceSummary: plain-language synthesis of findings
//   - prosodic notes:  speaking-specific flags derived from speakingFeatures
//
// Rules:
//   - Never re-runs diagnosis.ts (backward-compatible; pipeline output is authoritative)
//   - Deterministic only (no LLM in Phase 2)
//   - Safe with all optional fields absent

import type { DiagnosisResult } from "@/lib/scoring/diagnosis";
import type { HistoryRecord } from "@/lib/history";
import type { AgentContext, DiagnosisAgentResult } from "@/lib/agents/types";

// ── Entry point ───────────────────────────────────────────────────────────────

export async function runDiagnosisAgent(ctx: AgentContext): Promise<DiagnosisAgentResult> {
  const base: DiagnosisResult = ctx.pipelineDiagnosis ?? emptyDiagnosis();
  const notes: string[] = [];

  if (!ctx.pipelineDiagnosis) {
    notes.push("DiagnosisAgent: pipelineDiagnosis absent — using empty baseline.");
  }

  // 1. topWeaknesses
  const topWeaknesses = extractTopWeaknesses(base);

  // 2. recurringIssues (cross-session pattern)
  const recurringIssues = extractRecurringIssues(ctx.recentHistory, ctx.examType);

  // 3. Speaking prosodic audit (adds notes only, does not change diagnosisResult)
  const prosodicNotes: string[] = [];
  if (ctx.examType === "speaking") {
    auditProsodic(ctx.speakingFeatures, ctx.debugFlags, prosodicNotes);
    notes.push(...prosodicNotes);
  }

  // 4. Engine conflict note
  if (base.engineConflict) {
    notes.push(
      "DiagnosisAgent: engine conflict detected — LLM and local model confidences diverged by > 0.5.",
    );
  }

  // 5. evidenceSummary
  const evidenceSummary = buildEvidenceSummary(base, topWeaknesses, recurringIssues, notes);

  // augmented = agent found substantive new signals (not just absence warnings)
  const augmented =
    topWeaknesses.length > 0 || recurringIssues.length > 0 || prosodicNotes.length > 0;

  return {
    diagnosisResult: base,
    topWeaknesses,
    recurringIssues,
    evidenceSummary,
    augmented,
    notes,
  };
}

// ── Rule: topWeaknesses ───────────────────────────────────────────────────────

/**
 * Collects unique dimension names from anomalies with severity "high" or "medium".
 * Anomalies with no dimension (pipeline-level signals) are intentionally excluded.
 */
function extractTopWeaknesses(diag: DiagnosisResult): string[] {
  const seen = new Set<string>();
  for (const a of diag.anomalies) {
    if ((a.severity === "high" || a.severity === "medium") && a.dimension) {
      seen.add(a.dimension);
    }
  }
  return Array.from(seen);
}

// ── Rule: recurringIssues ─────────────────────────────────────────────────────

/**
 * Counts how many prior same-type sessions contain each anomaly code in their
 * persisted diagSummary. Returns codes that appear in at least 2 sessions.
 *
 * Uses `code` only (not dimension) for stable cross-session comparison.
 */
function extractRecurringIssues(history: HistoryRecord[], examType: "writing" | "speaking"): string[] {
  const codeCounts = new Map<string, number>();

  for (const rec of history) {
    if (rec.type !== examType) continue;
    const diag = rec.diagSummary;
    if (!diag?.anomalies) continue;

    // Deduplicate codes within the same session before counting.
    const seenInSession = new Set<string>();
    for (const a of diag.anomalies) {
      if (!seenInSession.has(a.code)) {
        seenInSession.add(a.code);
        codeCounts.set(a.code, (codeCounts.get(a.code) ?? 0) + 1);
      }
    }
  }

  return Array.from(codeCounts.entries())
    .filter(([, count]) => count >= 2)
    .map(([code]) => code);
}

// ── Rule: prosodic audit (speaking only) ─────────────────────────────────────

const WPM_SLOW_THRESHOLD = 80;
const WPM_FAST_THRESHOLD = 180;
const PAUSE_RATIO_HIGH_THRESHOLD = 0.35;

/**
 * Adds human-readable notes for prosodic signals that warrant attention.
 * Does not modify diagnosisResult — notes flow into evidenceSummary instead.
 */
function auditProsodic(
  features: Record<string, unknown> | undefined,
  flags: Record<string, boolean | number | string | null>,
  notes: string[],
): void {
  // Flag-based checks (always available even without audio features)
  if (flags["transcript_too_short"]) {
    notes.push("Prosodic: transcript is very short (< 12 words) — fluency metrics unreliable.");
  }
  if (flags["local_audio_missing"]) {
    notes.push("Prosodic: no audio provided — wpm and pause metrics unavailable.");
  }

  if (!features) return;

  const wpm = typeof features["wpm"] === "number" ? features["wpm"] : null;
  const pauseRatio =
    typeof features["pause_ratio"] === "number" ? features["pause_ratio"] : null;
  const avgPauseSec =
    typeof features["avg_pause_sec"] === "number" ? features["avg_pause_sec"] : null;

  if (wpm !== null) {
    if (wpm < WPM_SLOW_THRESHOLD) {
      notes.push(
        `Prosodic: speech rate is slow (${wpm.toFixed(0)} wpm < ${WPM_SLOW_THRESHOLD}) — may indicate hesitation or low fluency.`,
      );
    } else if (wpm > WPM_FAST_THRESHOLD) {
      notes.push(
        `Prosodic: speech rate is fast (${wpm.toFixed(0)} wpm > ${WPM_FAST_THRESHOLD}) — may reduce intelligibility.`,
      );
    }
  }

  if (pauseRatio !== null && pauseRatio > PAUSE_RATIO_HIGH_THRESHOLD) {
    const pct = (pauseRatio * 100).toFixed(0);
    notes.push(
      `Prosodic: high pause ratio (${pct}% of utterance is silence) — delivery may feel halting.`,
    );
  }

  if (avgPauseSec !== null && avgPauseSec > 2.5) {
    notes.push(
      `Prosodic: average pause duration is ${avgPauseSec.toFixed(1)}s — frequent long gaps detected.`,
    );
  }
}

// ── evidenceSummary builder ───────────────────────────────────────────────────

function buildEvidenceSummary(
  diag: DiagnosisResult,
  topWeaknesses: string[],
  recurringIssues: string[],
  notes: string[],
): string {
  const parts: string[] = [];

  if (diag.severity === "none" && topWeaknesses.length === 0 && recurringIssues.length === 0) {
    parts.push("No significant issues detected in this session.");
  } else {
    if (diag.severity !== "none") {
      parts.push(`Session diagnosis severity: ${diag.severity}.`);
    }
    if (topWeaknesses.length > 0) {
      parts.push(`Weakest dimensions this session: ${topWeaknesses.join(", ")}.`);
    }
    if (recurringIssues.length > 0) {
      parts.push(
        `Recurring patterns across sessions: ${recurringIssues.join(", ")} — these have appeared in 2 or more prior sessions.`,
      );
    }
  }

  if (diag.engineConflict) {
    parts.push("Engine conflict: LLM and local model confidence diverged; treat band scores with caution.");
  }
  if (diag.lowConfidence) {
    parts.push("LLM confidence was low this session; scores may be less reliable.");
  }

  // Append any prosodic or special notes
  const prosodic = notes.filter((n) => n.startsWith("Prosodic:"));
  if (prosodic.length > 0) {
    parts.push(...prosodic);
  }

  return parts.join(" ") || "No significant issues detected.";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyDiagnosis(): DiagnosisResult {
  return { anomalies: [], severity: "none", engineConflict: false, lowConfidence: false };
}
