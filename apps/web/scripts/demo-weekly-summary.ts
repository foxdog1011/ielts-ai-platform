/**
 * apps/web/scripts/demo-weekly-summary.ts
 *
 * Runnable demo for the Weekly Digest + Reminder pipeline.
 * Uses realistic synthetic history — no server, no KV store needed.
 *
 * Usage:
 *   npx tsx apps/web/scripts/demo-weekly-summary.ts
 *
 * Outputs:
 *   - Formatted console summary
 *   - apps/web/n8n/sample-output.json  (full structured payload)
 */

import fs   from "node:fs";
import path from "node:path";

// ── Relative imports (avoids tsconfig path-alias resolution) ─────────────────
import { buildWeeklySummaryPayload, buildReminderPayload } from "../lib/weeklySummary.js";
import { formatWeeklyDigest, formatReminderMessage }       from "../lib/workflowFormatter.js";

// ── Synthetic history factory ────────────────────────────────────────────────

type Rec = {
  type: "writing" | "speaking";
  taskId: string;
  prompt: string;
  band: Record<string, number>;
  ts: number;
  diagSummary?: {
    severity: "none" | "low" | "medium" | "high";
    anomalies: Array<{ code: string; dimension?: string; severity: "low" | "medium" | "high" }>;
    engineConflict: boolean;
    lowConfidence: boolean;
  };
  planSnapshot?: {
    currentFocus: { dimension: string; reason: string };
    nextTaskRecommendation: string;
    milestoneBand: number;
  };
};

const DAY = 24 * 60 * 60 * 1000;

/** NOW is fixed so sample output is deterministic */
const NOW = new Date("2026-03-12T10:00:00Z").getTime();

const writingHistory: Rec[] = [
  // This week (days ago: 1, 3)
  {
    type: "writing",
    taskId: "w8",
    prompt: "Some cities have introduced congestion charging. Discuss advantages and disadvantages.",
    band: { overall: 6.5, taskResponse: 6.0, coherence: 7.0, lexical: 6.5, grammar: 5.5 },
    ts: NOW - 1 * DAY,
    diagSummary: {
      severity: "low",
      anomalies: [{ code: "VERY_LOW_SUBSCORE", dimension: "grammar_01", severity: "low" }],
      engineConflict: false,
      lowConfidence: false,
    },
    planSnapshot: {
      currentFocus: { dimension: "grammar", reason: "repeated_weakness" },
      nextTaskRecommendation: "task2_argument",
      milestoneBand: 7.0,
    },
  },
  {
    type: "writing",
    taskId: "w7",
    prompt: "Technology has made it easier for people to work remotely. Do the advantages outweigh the disadvantages?",
    band: { overall: 6.0, taskResponse: 6.0, coherence: 6.5, lexical: 6.0, grammar: 5.5 },
    ts: NOW - 3 * DAY,
    diagSummary: {
      severity: "low",
      anomalies: [{ code: "VERY_LOW_SUBSCORE", dimension: "grammar_01", severity: "low" }],
      engineConflict: false,
      lowConfidence: false,
    },
  },
  // Last week
  {
    type: "writing",
    taskId: "w6",
    prompt: "In many countries, the proportion of older people is increasing. What are the advantages and disadvantages?",
    band: { overall: 5.5, taskResponse: 5.5, coherence: 6.0, lexical: 5.5, grammar: 5.0 },
    ts: NOW - 9 * DAY,
  },
  {
    type: "writing",
    taskId: "w5",
    prompt: "Tourism is a growing global industry but it can also have negative impacts on local communities.",
    band: { overall: 5.5, taskResponse: 5.0, coherence: 6.0, lexical: 5.5, grammar: 5.0 },
    ts: NOW - 12 * DAY,
  },
  // Older
  {
    type: "writing",
    taskId: "w4",
    prompt: "Some people think that children should learn to be competitive. Others believe that cooperation is more important.",
    band: { overall: 5.0, taskResponse: 5.0, coherence: 5.5, lexical: 5.0, grammar: 4.5 },
    ts: NOW - 20 * DAY,
    diagSummary: {
      severity: "low",
      anomalies: [{ code: "VERY_LOW_SUBSCORE", dimension: "grammar_01", severity: "low" }],
      engineConflict: false,
      lowConfidence: false,
    },
  },
];

const speakingHistory: Rec[] = [
  // This week
  {
    type: "speaking",
    taskId: "s5",
    prompt: "Describe a memorable trip you have taken. You should say: where you went, who you went with, what you did there, and explain why it was memorable.",
    band: { overall: 6.0, content: 6.0, vocab: 6.0, fluency: 5.5, pronunciation: 6.5, grammar: 6.0 },
    ts: NOW - 2 * DAY,
    planSnapshot: {
      currentFocus: { dimension: "fluency", reason: "current_weakest" },
      nextTaskRecommendation: "speaking_part2_long_turn",
      milestoneBand: 6.5,
    },
  },
  // Last week
  {
    type: "speaking",
    taskId: "s4",
    prompt: "Describe a book that has had a significant influence on you.",
    band: { overall: 5.5, content: 5.5, vocab: 5.5, fluency: 5.0, pronunciation: 6.0, grammar: 5.5 },
    ts: NOW - 8 * DAY,
  },
  {
    type: "speaking",
    taskId: "s3",
    prompt: "Describe a person who has influenced your life in a positive way.",
    band: { overall: 5.5, content: 5.5, vocab: 5.5, fluency: 5.0, pronunciation: 6.0, grammar: 5.5 },
    ts: NOW - 11 * DAY,
    diagSummary: {
      severity: "low",
      anomalies: [{ code: "VERY_LOW_SUBSCORE", dimension: "fluency_01", severity: "low" }],
      engineConflict: false,
      lowConfidence: false,
    },
  },
  // Older
  {
    type: "speaking",
    taskId: "s2",
    prompt: "Describe a time when you helped someone.",
    band: { overall: 5.0, content: 5.0, vocab: 5.0, fluency: 4.5, pronunciation: 5.5, grammar: 5.0 },
    ts: NOW - 19 * DAY,
  },
  {
    type: "speaking",
    taskId: "s1",
    prompt: "Describe your hometown.",
    band: { overall: 5.0, content: 5.0, vocab: 5.0, fluency: 5.0, pronunciation: 5.0, grammar: 5.0 },
    ts: NOW - 28 * DAY,
  },
];

// ── Build payloads ────────────────────────────────────────────────────────────

// Cast to satisfy the type (our inline type matches HistoryRecord structure)
const w = writingHistory  as Parameters<typeof buildWeeklySummaryPayload>[0]["writingHistory"];
const s = speakingHistory as Parameters<typeof buildWeeklySummaryPayload>[0]["speakingHistory"];

const weekly  = buildWeeklySummaryPayload({ writingHistory: w, speakingHistory: s, now: NOW });
const reminder = buildReminderPayload({
  writingHistory: w,
  speakingHistory: s,
  triggerType: "weekly",
  now: NOW,
});

const digest   = formatWeeklyDigest(weekly, reminder);
const reminderMsg = formatReminderMessage(reminder);

// ── Console output ────────────────────────────────────────────────────────────

const HR = "─".repeat(64);

console.log(`\n${HR}`);
console.log("  IELTS Weekly Digest — Demo Run");
console.log(`  ${new Date(NOW).toDateString()}`);
console.log(HR);

console.log("\n📊  WEEKLY SUMMARY PAYLOAD (key fields)");
console.log(`  Overall Status   : ${weekly.overallStatus}`);
console.log(`  Urgency Level    : ${weekly.urgencyLevel}`);
console.log(`  Primary Focus    : ${weekly.primaryFocus}`);
console.log(`  Total Sessions   : ${weekly.totalSessionsAllTime}`);
console.log(`  Engagement Days  : ${weekly.engagementDays} (last 30d)`);
console.log(`  Consistency      : ${weekly.consistencyRating}`);

if (weekly.writing) {
  const w = weekly.writing;
  console.log(`\n  ✍️  Writing`);
  console.log(`    Latest Band      : ${w.latestBand}`);
  console.log(`    Avg Band (week)  : ${w.avgBand ?? "—"}`);
  console.log(`    Band Delta       : ${w.bandDelta !== null ? `${w.bandDelta > 0 ? "+" : ""}${w.bandDelta}` : "—"}`);
  console.log(`    Sessions (week)  : ${w.sessionCount}`);
  console.log(`    Trend            : ${w.trend}`);
  console.log(`    Persist. Weak    : ${w.persistentWeaknesses.join(", ") || "none"}`);
  console.log(`    Recurring Anomal : ${w.recurringAnomalies.join(", ") || "none"}`);
  console.log(`    Current Focus    : ${w.currentFocus?.dimension ?? "—"} (${w.currentFocus?.reason ?? "—"})`);
}

if (weekly.speaking) {
  const s = weekly.speaking;
  console.log(`\n  🎤  Speaking`);
  console.log(`    Latest Band      : ${s.latestBand}`);
  console.log(`    Avg Band (week)  : ${s.avgBand ?? "—"}`);
  console.log(`    Band Delta       : ${s.bandDelta !== null ? `${s.bandDelta > 0 ? "+" : ""}${s.bandDelta}` : "—"}`);
  console.log(`    Sessions (week)  : ${s.sessionCount}`);
  console.log(`    Trend            : ${s.trend}`);
  console.log(`    Persist. Weak    : ${s.persistentWeaknesses.join(", ") || "none"}`);
  console.log(`    Recurring Anomal : ${s.recurringAnomalies.join(", ") || "none"}`);
  console.log(`    Current Focus    : ${s.currentFocus?.dimension ?? "—"} (${s.currentFocus?.reason ?? "—"})`);
}

console.log(`\n  Coach Line: "${weekly.coachLine}"`);
console.log(`  Reminder Copy: "${weekly.reminderCandidateCopy}"`);

console.log(`\n${HR}`);
console.log("📨  DISCORD EMBED (Weekly Digest)");
console.log(HR);
console.log(`  Content : "${digest.discord.content || "(no @mention — not urgent)"}"`);
console.log(`  Title   : ${digest.discord.embeds[0].title}`);
console.log(`  Desc    : ${digest.discord.embeds[0].description}`);
console.log(`  Color   : #${digest.discord.embeds[0].color.toString(16).padStart(6, "0").toUpperCase()}`);
console.log(`  Fields  :`);
for (const f of digest.discord.embeds[0].fields) {
  console.log(`    [${f.name}]`);
  for (const line of f.value.split("\n")) console.log(`      ${line}`);
}
console.log(`  Footer  : ${digest.discord.embeds[0].footer.text}`);

console.log(`\n${HR}`);
console.log("📧  EMAIL (Weekly Digest)");
console.log(HR);
console.log(`  Subject : ${digest.email.subject}`);
console.log(`  Body    :`);
for (const line of digest.email.plaintext.split("\n")) {
  console.log(`    ${line}`);
}

console.log(`\n${HR}`);
console.log("📝  NOTION PAGE");
console.log(HR);
console.log(`  Title   : ${digest.notion.title}`);
console.log(`  Props   :`, JSON.stringify(digest.notion.properties, null, 2).split("\n").join("\n             "));
console.log(`  Body    :`);
for (const line of digest.notion.body_markdown.split("\n")) {
  console.log(`    ${line}`);
}

console.log(`\n${HR}`);
console.log("🔔  REMINDER (Inactivity Trigger)");
console.log(HR);
const inactRem = buildReminderPayload({
  writingHistory: w,
  speakingHistory: s,
  triggerType: "inactivity_3d",
  now: NOW,
});
const inactMsg = formatReminderMessage(inactRem);
console.log(`  triggerType          : ${inactRem.triggerType}`);
console.log(`  daysSinceLastSession : ${inactRem.daysSinceLastSession}`);
console.log(`  examTypeFocus        : ${inactRem.examTypeFocus}`);
console.log(`  urgency              : ${inactRem.urgency}`);
console.log(`  isFirstSession       : ${inactRem.isFirstSession}`);
console.log(`  hasRecurringAnomalies: ${inactRem.hasRecurringAnomalies}`);
console.log(`  hasPersistentWeakness: ${inactRem.hasPersistentWeakness}`);
console.log(`  isImproving          : ${inactRem.isImproving}`);
console.log(`  reminderText         : "${inactRem.reminderText}"`);
console.log(`  ctaLabel             : "${inactRem.ctaLabel}"`);
console.log(`  Discord Title        : ${inactMsg.discord.embeds[0].title}`);
console.log(`  Discord Desc         : ${inactMsg.discord.embeds[0].description}`);
console.log(`  Email Subject        : ${inactMsg.email.subject}`);

// ── Write sample JSON ─────────────────────────────────────────────────────────

const output = {
  _generated:  new Date(NOW).toISOString(),
  _script:     "apps/web/scripts/demo-weekly-summary.ts",
  _dataset:    "Synthetic: 5 writing sessions (20d), 5 speaking sessions (28d)",
  weeklyDigest: {
    weeklySummaryPayload: weekly,
    reminderPayload:      reminder,
    formattedDiscord:     digest.discord,
    formattedEmail:       digest.email,
    formattedNotion:      digest.notion,
  },
  inactivityReminder: {
    reminderPayload:  inactRem,
    formattedDiscord: inactMsg.discord,
    formattedEmail:   inactMsg.email,
  },
};

// __filename is available in tsx/CJS context
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const _dir    = typeof __dirname !== "undefined" ? __dirname : process.cwd();
const outDir  = path.resolve(_dir, "../n8n");
const outPath = path.join(outDir, "sample-output.json");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\n✅  Full JSON written → ${outPath}`);
console.log(HR + "\n");
