// apps/web/app/api/dashboard/route.ts
// GET /api/dashboard — aggregate historical scores for analytics dashboard

import { NextResponse } from "next/server";
import { listHistory } from "@/lib/history";
import type { HistoryRecord, WritingRecord, SpeakingRecord } from "@/shared/domain/types";

export const dynamic = "force-dynamic";

/* ── Types ── */

type SkillTrend = {
  skill: string;
  average: number;
  trend: number[];       // last N overall scores
  dates: string[];       // matching ISO dates
  count: number;
};

type WeaknessItem = {
  skill: string;
  dimension: string;
  average: number;
  suggestion: string;
};

type WeeklyCount = {
  weekLabel: string;     // e.g. "4/1"
  writing: number;
  speaking: number;
};

type RecentScore = {
  type: "writing" | "speaking";
  overall: number | null;
  date: string;
  taskId: string;
  prompt?: string;
};

type DashboardData = {
  overallTrend: { score: number; date: string }[];
  skillBreakdown: SkillTrend[];
  weaknesses: WeaknessItem[];
  weeklyPractice: WeeklyCount[];
  recentScores: RecentScore[];
  totalSessions: number;
  averageBand: number;
};

/* ── Helpers ── */

function toMs(rec: HistoryRecord): number {
  if (typeof rec.ts === "number") return rec.ts;
  if (rec.createdAt) return Date.parse(rec.createdAt);
  return 0;
}

function toDateStr(rec: HistoryRecord): string {
  const ms = toMs(rec);
  return ms ? new Date(ms).toISOString().slice(0, 10) : "";
}

function getOverall(rec: HistoryRecord): number | null {
  if (!rec.band) return null;
  if (rec.type === "writing") return (rec as WritingRecord).band?.overall ?? null;
  const s = rec as SpeakingRecord;
  return s.band?.overall ?? s.band?.content ?? null;
}

const WRITING_DIMS: { key: keyof NonNullable<WritingRecord["band"]>; label: string; suggestion: string }[] = [
  { key: "taskResponse", label: "Task Response", suggestion: "多練習分析題目要求，確保回答涵蓋所有要點" },
  { key: "coherence", label: "Coherence", suggestion: "加強段落銜接詞使用，練習邏輯架構" },
  { key: "lexical", label: "Lexical Resource", suggestion: "擴充同義詞庫，避免重複用字" },
  { key: "grammar", label: "Grammar", suggestion: "練習複合句和從句結構，減少基本語法錯誤" },
];

const SPEAKING_DIMS: { key: keyof NonNullable<SpeakingRecord["band"]>; label: string; suggestion: string }[] = [
  { key: "content", label: "Content", suggestion: "練習快速腦力激盪，豐富回答內容" },
  { key: "grammar", label: "Grammar", suggestion: "口說中刻意使用不同時態和句型" },
  { key: "vocab", label: "Vocabulary", suggestion: "準備各主題常用詞彙，練習同義替換" },
  { key: "fluency", label: "Fluency", suggestion: "練習不停頓地說至少 30 秒，減少 um/uh" },
  { key: "pronunciation", label: "Pronunciation", suggestion: "跟讀母語者錄音，練習重音和語調" },
];

/* ── GET handler ── */

export async function GET() {
  try {
    const [writingRecs, speakingRecs] = await Promise.all([
      listHistory({ type: "writing", limit: 100 }).catch(() => []),
      listHistory({ type: "speaking", limit: 100 }).catch(() => []),
    ]);

    const allRecs: HistoryRecord[] = [...writingRecs, ...speakingRecs]
      .sort((a, b) => toMs(a) - toMs(b)); // old to new

    // Overall trend (all scores chronologically)
    const overallTrend = allRecs
      .map((rec) => ({ score: getOverall(rec), date: toDateStr(rec) }))
      .filter((x): x is { score: number; date: string } => x.score !== null);

    // Per-skill breakdown
    const skillBreakdown: SkillTrend[] = [];

    if (writingRecs.length > 0) {
      const scores = writingRecs.map((r) => getOverall(r)).filter((v): v is number => v !== null);
      skillBreakdown.push({
        skill: "Writing",
        average: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
        trend: scores.slice(-10),
        dates: writingRecs.slice(-10).map(toDateStr),
        count: writingRecs.length,
      });
    }

    if (speakingRecs.length > 0) {
      const scores = speakingRecs.map((r) => getOverall(r)).filter((v): v is number => v !== null);
      skillBreakdown.push({
        skill: "Speaking",
        average: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
        trend: scores.slice(-10),
        dates: speakingRecs.slice(-10).map(toDateStr),
        count: speakingRecs.length,
      });
    }

    // Weakness analysis
    const weaknesses: WeaknessItem[] = [];

    // Writing dimensions
    const wBands = writingRecs
      .map((r) => (r as WritingRecord).band)
      .filter((b): b is NonNullable<WritingRecord["band"]> => b !== null && b !== undefined);

    for (const dim of WRITING_DIMS) {
      const vals = wBands.map((b) => b[dim.key]).filter((v): v is number => typeof v === "number");
      if (vals.length > 0) {
        const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
        weaknesses.push({ skill: "Writing", dimension: dim.label, average: avg, suggestion: dim.suggestion });
      }
    }

    // Speaking dimensions
    const sBands = speakingRecs
      .map((r) => (r as SpeakingRecord).band)
      .filter((b): b is NonNullable<SpeakingRecord["band"]> => b !== null && b !== undefined);

    for (const dim of SPEAKING_DIMS) {
      const vals = sBands.map((b) => b[dim.key]).filter((v): v is number => typeof v === "number");
      if (vals.length > 0) {
        const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
        weaknesses.push({ skill: "Speaking", dimension: dim.label, average: avg, suggestion: dim.suggestion });
      }
    }

    // Sort weaknesses by average ascending (worst first)
    weaknesses.sort((a, b) => a.average - b.average);

    // Weekly practice count (last 6 weeks)
    const now = Date.now();
    const SIX_WEEKS = 6 * 7 * 24 * 60 * 60 * 1000;
    const weeklyPractice: WeeklyCount[] = [];

    for (let w = 5; w >= 0; w--) {
      const weekStart = now - (w + 1) * 7 * 24 * 60 * 60 * 1000;
      const weekEnd = now - w * 7 * 24 * 60 * 60 * 1000;
      const d = new Date(weekStart);
      const weekLabel = `${d.getMonth() + 1}/${d.getDate()}`;

      const writing = writingRecs.filter((r) => {
        const ms = toMs(r);
        return ms > weekStart && ms <= weekEnd;
      }).length;

      const speaking = speakingRecs.filter((r) => {
        const ms = toMs(r);
        return ms > weekStart && ms <= weekEnd;
      }).length;

      weeklyPractice.push({ weekLabel, writing, speaking });
    }

    // Recent scores (newest first, limit 10)
    const recentScores: RecentScore[] = [...allRecs]
      .reverse()
      .slice(0, 10)
      .map((rec) => ({
        type: rec.type,
        overall: getOverall(rec),
        date: toDateStr(rec),
        taskId: rec.taskId,
        prompt: rec.prompt,
      }));

    // Global stats
    const allOveralls = overallTrend.map((x) => x.score);
    const totalSessions = allRecs.length;
    const averageBand = allOveralls.length > 0
      ? Math.round((allOveralls.reduce((a, b) => a + b, 0) / allOveralls.length) * 10) / 10
      : 0;

    const data: DashboardData = {
      overallTrend,
      skillBreakdown,
      weaknesses,
      weeklyPractice,
      recentScores,
      totalSessions,
      averageBand,
    };

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load dashboard data";
    return NextResponse.json({ ok: false, error: { message } }, { status: 500 });
  }
}
