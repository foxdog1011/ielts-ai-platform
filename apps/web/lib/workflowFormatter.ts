// apps/web/lib/workflowFormatter.ts
//
// Pre-assembled notification payloads for n8n / MCP / webhook consumers.
// Pure functions — no I/O, no LLM.
//
// Usage:
//   GET /api/weekly-summary?trigger=weekly&format=discord
//   → response.data.formatted.discord  (ready to POST to Discord webhook)
//   → response.data.formatted.email    (subject + plaintext)
//   → response.data.formatted.notion   (title + properties + markdown body)
//
// Design principle: n8n nodes should forward fields, not assemble text.
// All string concatenation happens here so workflow expressions stay simple.

import type { WeeklySummaryPayload, ReminderPayload, ExamTypeSummary } from "@/lib/weeklySummary";

// ── Discord types (matches Discord Webhook API) ───────────────────────────────

export type DiscordField = { name: string; value: string; inline: boolean };

export type DiscordEmbed = {
  title: string;
  description: string;
  /** Decimal colour integer. Use EMBED_COLOR constants below. */
  color: number;
  fields: DiscordField[];
  footer: { text: string };
};

export type DiscordMessage = {
  /** Optional @mention or preamble line. Empty string when not urgent. */
  content: string;
  embeds: [DiscordEmbed];
};

// ── Email types ────────────────────────────────────────────────────────────────

export type EmailMessage = {
  subject: string;
  plaintext: string;
};

// ── Notion types ──────────────────────────────────────────────────────────────
//
// Matches Notion "Create database item" node input shape.
// Caller maps properties → Notion property update objects.

export type NotionPagePayload = {
  /** Page title — use as the "Name" property. */
  title: string;
  /** Flat, string/number/boolean properties — easy to map in n8n's Notion node. */
  properties: {
    status: string;
    urgency: string;
    writing_band: number | null;
    speaking_band: number | null;
    sessions_this_week: number;
    engagement_days: number;
    primary_focus: string;
    recurring_anomalies: string;
    generated_at: string;
  };
  /** Markdown body for a "content" block. Paste into a paragraph block. */
  body_markdown: string;
};

export type FormattedWeeklyDigest = {
  discord: DiscordMessage;
  email: EmailMessage;
  notion: NotionPagePayload;
};

export type FormattedReminder = {
  discord: DiscordMessage;
  email: EmailMessage;
};

// ── Colour palette ────────────────────────────────────────────────────────────

const EMBED_COLOR = {
  urgent:      0xED4245, // red
  normal:      0x5865F2, // Discord blurple
  maintenance: 0x57F287, // green
  first_week:  0xFEE75C, // yellow
} as const;

// ── Shared helpers ────────────────────────────────────────────────────────────

const STATUS_EMOJI: Record<string, string> = {
  improving:  "📈",
  stable:     "➡️",
  declining:  "📉",
  first_week: "🌱",
};

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

function band(v: number | null | undefined): string {
  return v != null ? String(v) : "—";
}

function typeBlock(s: ExamTypeSummary, icon: string): DiscordField {
  const lines = [
    `Band: **${band(s.latestBand)}** · Sessions: ${s.sessionCount} · Trend: ${s.trend}`,
  ];
  if (s.persistentWeaknesses.length > 0) lines.push(`Weak: ${s.persistentWeaknesses.join(", ")}`);
  if (s.recurringAnomalies.length > 0)   lines.push(`⚠ Anomaly: ${s.recurringAnomalies[0]}`);
  if (s.currentFocus)                    lines.push(`Focus: ${s.currentFocus.dimension}`);
  return { name: `${icon} ${cap(s.examType)}`, value: lines.join("\n"), inline: true };
}

// ── formatWeeklyDigest ────────────────────────────────────────────────────────

/**
 * Produces Discord embed, email text, and Notion page payload from a
 * WeeklySummaryPayload + ReminderPayload pair.
 *
 * Call once per `/api/weekly-summary` response — both payloads come from
 * the same request so they are always in sync.
 */
export function formatWeeklyDigest(
  summary: WeeklySummaryPayload,
  reminder: ReminderPayload,
): FormattedWeeklyDigest {
  const emoji = STATUS_EMOJI[summary.overallStatus] ?? "📊";
  const color: number =
    summary.urgencyLevel === "urgent"      ? EMBED_COLOR.urgent
    : summary.urgencyLevel === "maintenance" ? EMBED_COLOR.maintenance
    : summary.overallStatus === "first_week" ? EMBED_COLOR.first_week
    : EMBED_COLOR.normal;

  // ── Discord ─────────────────────────────────────────────────────────────────

  const fields: DiscordField[] = [];
  if (summary.writing)  fields.push(typeBlock(summary.writing,  "✍️"));
  if (summary.speaking) fields.push(typeBlock(summary.speaking, "🎤"));

  if (summary.recurringAnomaliesAllTypes.length > 0) {
    fields.push({
      name: "⚠️ Recurring Anomalies",
      value: summary.recurringAnomaliesAllTypes.join("\n"),
      inline: false,
    });
  }

  fields.push({
    name: "🎯 Recommended Next Action",
    value: [
      `Focus: **${reminder.currentFocus?.dimension ?? "—"}**`,
      `Task: \`${reminder.nextRecommendedTask ?? "start practice"}\``,
      `Urgency: **${reminder.urgency}**`,
    ].join("  ·  "),
    inline: false,
  });

  const footerText = [
    `${summary.totalSessionsAllTime} sessions total`,
    `${summary.engagementDays} active days (30d)`,
    summary.generatedAt.slice(0, 10),
  ].join("  ·  ");

  const discordEmbed: DiscordEmbed = {
    title: `${emoji} IELTS Weekly — ${cap(summary.overallStatus)}`,
    description: summary.coachLine,
    color,
    fields,
    footer: { text: footerText },
  };

  const discord: DiscordMessage = {
    content: summary.urgencyLevel === "urgent" ? "🚨 Urgent practice needed!" : "",
    embeds: [discordEmbed],
  };

  // ── Email ────────────────────────────────────────────────────────────────────

  const emailLines: string[] = [
    `IELTS Weekly Summary — ${new Date(summary.generatedAt).toDateString()}`,
    `Status: ${cap(summary.overallStatus)} ${emoji}`,
    "",
    summary.coachLine,
    "",
  ];

  if (summary.writing) {
    emailLines.push(
      `Writing  — Band ${band(summary.writing.latestBand)} | ${summary.writing.trend} | ${summary.writing.sessionCount} session(s) this week`,
    );
  }
  if (summary.speaking) {
    emailLines.push(
      `Speaking — Band ${band(summary.speaking.latestBand)} | ${summary.speaking.trend} | ${summary.speaking.sessionCount} session(s) this week`,
    );
  }
  if (summary.recurringAnomaliesAllTypes.length > 0) {
    emailLines.push(``, `⚠ Recurring anomalies: ${summary.recurringAnomaliesAllTypes.join(", ")}`);
  }

  emailLines.push(
    ``,
    `→ ${reminder.ctaLabel}`,
    `  Task: ${reminder.nextRecommendedTask ?? "—"}`,
    ``,
    reminder.reminderText,
  );

  const email: EmailMessage = {
    subject: `[IELTS] ${emoji} ${cap(summary.overallStatus)} — ${summary.generatedAt.slice(0, 10)}`,
    plaintext: emailLines.join("\n"),
  };

  // ── Notion ───────────────────────────────────────────────────────────────────

  const wmd = summary.writing
    ? [
        `### ✍️ Writing`,
        `- Band: **${band(summary.writing.latestBand)}**  ·  Sessions: ${summary.writing.sessionCount}  ·  Trend: ${summary.writing.trend}`,
        summary.writing.persistentWeaknesses.length > 0
          ? `- Persistent weak: ${summary.writing.persistentWeaknesses.join(", ")}`
          : `- No persistent weaknesses`,
        summary.writing.currentFocus
          ? `- Focus: **${summary.writing.currentFocus.dimension}** (${summary.writing.currentFocus.reason})`
          : "",
      ].filter(Boolean).join("\n")
    : "### ✍️ Writing\n- No data";

  const smd = summary.speaking
    ? [
        `### 🎤 Speaking`,
        `- Band: **${band(summary.speaking.latestBand)}**  ·  Sessions: ${summary.speaking.sessionCount}  ·  Trend: ${summary.speaking.trend}`,
        summary.speaking.persistentWeaknesses.length > 0
          ? `- Persistent weak: ${summary.speaking.persistentWeaknesses.join(", ")}`
          : `- No persistent weaknesses`,
        summary.speaking.currentFocus
          ? `- Focus: **${summary.speaking.currentFocus.dimension}** (${summary.speaking.currentFocus.reason})`
          : "",
      ].filter(Boolean).join("\n")
    : "### 🎤 Speaking\n- No data";

  const anomalyMd =
    summary.recurringAnomaliesAllTypes.length > 0
      ? `### ⚠️ Recurring Anomalies\n${summary.recurringAnomaliesAllTypes.map((a) => `- \`${a}\``).join("\n")}`
      : "";

  const notionBody = [
    `## ${emoji} ${cap(summary.overallStatus)}`,
    ``,
    `> ${summary.coachLine}`,
    ``,
    wmd,
    ``,
    smd,
    anomalyMd ? `\n${anomalyMd}` : "",
    ``,
    `### 🎯 Next Action`,
    `- Focus: **${reminder.currentFocus?.dimension ?? "—"}**  (${reminder.currentFocus?.reason ?? "—"})`,
    `- Task: \`${reminder.nextRecommendedTask ?? "—"}\``,
    `- Urgency: **${reminder.urgency}**`,
    `- CTA: ${reminder.ctaLabel}`,
  ].filter((l) => l !== undefined).join("\n");

  const notion: NotionPagePayload = {
    title: `IELTS Weekly — ${summary.generatedAt.slice(0, 10)}`,
    properties: {
      status:               summary.overallStatus,
      urgency:              summary.urgencyLevel,
      writing_band:         summary.writing?.latestBand ?? null,
      speaking_band:        summary.speaking?.latestBand ?? null,
      sessions_this_week:   (summary.writing?.sessionCount ?? 0) + (summary.speaking?.sessionCount ?? 0),
      engagement_days:      summary.engagementDays,
      primary_focus:        summary.primaryFocus,
      recurring_anomalies:  summary.recurringAnomaliesAllTypes.join(", "),
      generated_at:         summary.generatedAt,
    },
    body_markdown: notionBody,
  };

  return { discord, email, notion };
}

// ── formatReminderMessage ─────────────────────────────────────────────────────

/**
 * Lightweight reminder-specific formatter.
 * Used by Workflow B — does not require the full WeeklySummaryPayload.
 */
export function formatReminderMessage(reminder: ReminderPayload): FormattedReminder {
  const urgencyEmoji =
    reminder.urgency === "urgent"      ? "🚨"
    : reminder.urgency === "maintenance" ? "✅"
    : "📚";

  const color: number =
    reminder.urgency === "urgent"      ? EMBED_COLOR.urgent
    : reminder.urgency === "maintenance" ? EMBED_COLOR.maintenance
    : EMBED_COLOR.normal;

  const embedFields: DiscordField[] = [];

  if (reminder.currentFocus) {
    embedFields.push({
      name: "🎯 Recommended Focus",
      value: `**${reminder.currentFocus.dimension}** — ${reminder.currentFocus.reason.replace(/_/g, " ")}`,
      inline: true,
    });
  }

  if (reminder.daysSinceLastSession !== null) {
    embedFields.push({
      name: "⏱️ Last Session",
      value: `${reminder.daysSinceLastSession} day${reminder.daysSinceLastSession === 1 ? "" : "s"} ago`,
      inline: true,
    });
  }

  embedFields.push({
    name: "➡️ Next Step",
    value: `\`${reminder.nextRecommendedTask ?? "start practice"}\`  ·  ${reminder.ctaLabel}`,
    inline: false,
  });

  const embed: DiscordEmbed = {
    title: `${urgencyEmoji} IELTS Reminder — ${cap(reminder.examTypeFocus)} Focus`,
    description: reminder.reminderText,
    color,
    fields: embedFields,
    footer: {
      text: `Trigger: ${reminder.triggerType}  ·  ${reminder.generatedAt.slice(0, 10)}`,
    },
  };

  const discord: DiscordMessage = {
    content: reminder.urgency === "urgent" ? "🚨 Action needed!" : "",
    embeds: [embed],
  };

  const emailLines = [
    reminder.reminderText,
    "",
    `→ ${reminder.ctaLabel}`,
    reminder.nextRecommendedTask ? `   Task: ${reminder.nextRecommendedTask}` : "",
    reminder.daysSinceLastSession !== null
      ? `   Last session: ${reminder.daysSinceLastSession} day(s) ago`
      : "",
  ].filter((l) => l !== "");

  const email: EmailMessage = {
    subject: `[IELTS] ${urgencyEmoji} ${reminder.ctaLabel}`,
    plaintext: emailLines.join("\n"),
  };

  return { discord, email };
}
