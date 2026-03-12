import { NextRequest, NextResponse } from "next/server";
import { listHistory } from "@/lib/history";
import type { HistoryRecord } from "@/lib/history";
import {
  buildWeeklySummaryPayload,
  buildReminderPayload,
} from "@/lib/weeklySummary";
import type { ReminderPayload } from "@/lib/weeklySummary";
import {
  formatWeeklyDigest,
  formatReminderMessage,
} from "@/lib/workflowFormatter";
import type { FormattedWeeklyDigest, FormattedReminder } from "@/lib/workflowFormatter";

const VALID_TRIGGERS = ["inactivity_3d", "weekly", "on_demand"] as const;
const VALID_FORMATS  = ["discord", "email", "notion", "all", "reminder"] as const;
type FormatMode = (typeof VALID_FORMATS)[number];

/**
 * GET /api/weekly-summary
 *
 * Query params:
 *   trigger  = on_demand | weekly | inactivity_3d   (default: on_demand)
 *   format   = discord | email | notion | all | reminder
 *              When present, adds `formatted` to the response:
 *              - discord/email/notion/all → formatWeeklyDigest output (subset or full)
 *              - reminder                → formatReminderMessage (lighter embed, Workflow B)
 *
 * n8n usage:
 *   Workflow A (Weekly Digest):   ?trigger=weekly&format=all
 *   Workflow B (Inactivity):      ?trigger=inactivity_3d&format=reminder
 *   MCP on-demand:                ?trigger=on_demand   (no format needed)
 */
export async function GET(req: NextRequest) {
  try {
    const params = new URL(req.url).searchParams;

    const triggerParam = params.get("trigger") ?? "on_demand";
    const triggerType = (
      VALID_TRIGGERS.includes(triggerParam as ReminderPayload["triggerType"])
        ? triggerParam
        : "on_demand"
    ) as ReminderPayload["triggerType"];

    const formatParam = params.get("format") ?? "";
    const formatMode = (
      VALID_FORMATS.includes(formatParam as FormatMode) ? formatParam : null
    ) as FormatMode | null;

    const [writingHistory, speakingHistory] = await Promise.all([
      listHistory({ type: "writing",  limit: 50 }).catch((): HistoryRecord[] => []),
      listHistory({ type: "speaking", limit: 50 }).catch((): HistoryRecord[] => []),
    ]);

    const weeklySummary = buildWeeklySummaryPayload({ writingHistory, speakingHistory });
    const reminder      = buildReminderPayload({ writingHistory, speakingHistory, triggerType });

    let formatted: FormattedWeeklyDigest | FormattedReminder | Partial<FormattedWeeklyDigest> | undefined;

    if (formatMode === "reminder") {
      formatted = formatReminderMessage(reminder);
    } else if (formatMode === "all") {
      formatted = formatWeeklyDigest(weeklySummary, reminder);
    } else if (formatMode === "discord") {
      formatted = { discord: formatWeeklyDigest(weeklySummary, reminder).discord };
    } else if (formatMode === "email") {
      formatted = { email: formatWeeklyDigest(weeklySummary, reminder).email };
    } else if (formatMode === "notion") {
      formatted = { notion: formatWeeklyDigest(weeklySummary, reminder).notion };
    }

    return NextResponse.json({
      ok: true,
      data: {
        weeklySummary,
        reminder,
        ...(formatted !== undefined ? { formatted } : {}),
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "WEEKLY_SUMMARY_FAILED",
          message: e instanceof Error ? e.message : "weekly summary failed",
        },
      },
      { status: 500 },
    );
  }
}
