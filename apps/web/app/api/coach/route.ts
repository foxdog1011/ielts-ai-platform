// apps/web/app/api/coach/route.ts
// GET /api/coach — analyze scores and return personalized recommendations

import { NextResponse } from "next/server";
import { listHistory } from "@/lib/history";
import type { HistoryRecord, WritingRecord, SpeakingRecord } from "@/shared/domain/types";

export const dynamic = "force-dynamic";

/* ── Types ── */

type Recommendation = {
  priority: "high" | "medium" | "low";
  skill: string;
  dimension: string;
  action: string;
  reason: string;
};

type Milestone = {
  icon: string;
  label: string;
  achieved: boolean;
  progress: number;
  target: number;
};

type DailyPlan = {
  skill: string;
  taskType: string;
  reason: string;
};

type CoachData = {
  recommendations: Recommendation[];
  milestones: Milestone[];
  dailyPlan: DailyPlan[];
  strengths: { skill: string; dimension: string; average: number }[];
  streakDays: number;
  totalPractice: number;
};

/* ── Helpers ── */

function toMs(rec: HistoryRecord): number {
  if (typeof rec.ts === "number") return rec.ts;
  if (rec.createdAt) return Date.parse(rec.createdAt);
  return 0;
}

function getOverall(rec: HistoryRecord): number | null {
  if (!rec.band) return null;
  if (rec.type === "writing") return (rec as WritingRecord).band?.overall ?? null;
  const s = rec as SpeakingRecord;
  return s.band?.overall ?? s.band?.content ?? null;
}

type DimScore = { dimension: string; average: number; recent: number; trend: "up" | "down" | "flat" };

function analyzeDimensions(
  records: HistoryRecord[],
  skill: "writing" | "speaking",
): DimScore[] {
  const dims = skill === "writing"
    ? [
        { key: "taskResponse", label: "Task Response" },
        { key: "coherence", label: "Coherence" },
        { key: "lexical", label: "Lexical Resource" },
        { key: "grammar", label: "Grammar" },
      ]
    : [
        { key: "content", label: "Content" },
        { key: "grammar", label: "Grammar" },
        { key: "vocab", label: "Vocabulary" },
        { key: "fluency", label: "Fluency" },
        { key: "pronunciation", label: "Pronunciation" },
      ];

  return dims.map(({ key, label }) => {
    const vals = records
      .map((r) => (r.band as Record<string, unknown>)?.[key])
      .filter((v): v is number => typeof v === "number");

    if (vals.length === 0) return { dimension: label, average: 0, recent: 0, trend: "flat" as const };

    const average = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    const recentSlice = vals.slice(-3);
    const recent = Math.round((recentSlice.reduce((a, b) => a + b, 0) / recentSlice.length) * 10) / 10;
    const olderSlice = vals.slice(0, Math.max(1, vals.length - 3));
    const older = olderSlice.reduce((a, b) => a + b, 0) / olderSlice.length;

    const diff = recent - older;
    const trend: "up" | "down" | "flat" = diff > 0.3 ? "up" : diff < -0.3 ? "down" : "flat";

    return { dimension: label, average, recent, trend };
  });
}

const SKILL_TIPS: Record<string, Record<string, string>> = {
  Writing: {
    "Task Response": "仔細審題後列出 2-3 個主要論點，確保每段都有具體例子支持",
    "Coherence": "使用 Furthermore / However / In contrast 等銜接詞，每段首句點明主題",
    "Lexical Resource": "練習 paraphrase 題目關鍵字，準備 5 個替換詞給常用詞",
    "Grammar": "每篇練習至少用 2 個複合句（定語從句、條件句、比較級結構）",
  },
  Speaking: {
    "Content": "用 PEEL 架構回答：Point → Example → Explain → Link back",
    "Grammar": "練習在回答中自然使用過去式、完成式和虛擬語氣",
    "Vocabulary": "每個話題準備 5-8 個高階詞彙，平時多聽 TED Talks 累積",
    "Fluency": "每天大聲朗讀 5 分鐘英文文章，訓練口腔肌肉記憶",
    "Pronunciation": "重點練習 th/v/l/r 的發音，用 Forvo 確認重音位置",
  },
};

/* ── GET handler ── */

export async function GET() {
  try {
    const [writingRecs, speakingRecs] = await Promise.all([
      listHistory({ type: "writing", limit: 100 }).catch(() => []),
      listHistory({ type: "speaking", limit: 100 }).catch(() => []),
    ]);

    const totalPractice = writingRecs.length + speakingRecs.length;

    // Analyze dimensions
    const wDims = analyzeDimensions(writingRecs, "writing");
    const sDims = analyzeDimensions(speakingRecs, "speaking");

    // Build recommendations
    const recommendations: Recommendation[] = [];

    for (const dim of wDims) {
      if (dim.average === 0) continue;
      const priority: "high" | "medium" | "low" =
        dim.average < 5.5 ? "high" : dim.average < 6.5 ? "medium" : "low";

      if (dim.trend === "down") {
        recommendations.push({
          priority: "high",
          skill: "Writing",
          dimension: dim.dimension,
          action: SKILL_TIPS.Writing[dim.dimension] ?? "加強此面向的練習",
          reason: `你的 ${dim.dimension} 近期分數下降 (${dim.recent})，需要重點關注`,
        });
      } else if (priority !== "low") {
        recommendations.push({
          priority,
          skill: "Writing",
          dimension: dim.dimension,
          action: SKILL_TIPS.Writing[dim.dimension] ?? "持續練習提升此面向",
          reason: `${dim.dimension} 平均 ${dim.average} 分，仍有進步空間`,
        });
      }
    }

    for (const dim of sDims) {
      if (dim.average === 0) continue;
      const priority: "high" | "medium" | "low" =
        dim.average < 5.5 ? "high" : dim.average < 6.5 ? "medium" : "low";

      if (dim.trend === "down") {
        recommendations.push({
          priority: "high",
          skill: "Speaking",
          dimension: dim.dimension,
          action: SKILL_TIPS.Speaking[dim.dimension] ?? "加強此面向的練習",
          reason: `你的 ${dim.dimension} 近期分數下降 (${dim.recent})，需要重點關注`,
        });
      } else if (priority !== "low") {
        recommendations.push({
          priority,
          skill: "Speaking",
          dimension: dim.dimension,
          action: SKILL_TIPS.Speaking[dim.dimension] ?? "持續練習提升此面向",
          reason: `${dim.dimension} 平均 ${dim.average} 分，仍有進步空間`,
        });
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Strengths (dimensions scoring >= 6.5)
    const strengths = [
      ...wDims.filter((d) => d.average >= 6.5).map((d) => ({ skill: "Writing", dimension: d.dimension, average: d.average })),
      ...sDims.filter((d) => d.average >= 6.5).map((d) => ({ skill: "Speaking", dimension: d.dimension, average: d.average })),
    ].sort((a, b) => b.average - a.average);

    // Daily plan — focus on weakest area
    const dailyPlan: DailyPlan[] = [];
    const weakestWriting = wDims.filter((d) => d.average > 0).sort((a, b) => a.average - b.average)[0];
    const weakestSpeaking = sDims.filter((d) => d.average > 0).sort((a, b) => a.average - b.average)[0];

    if (weakestWriting) {
      dailyPlan.push({
        skill: "Writing",
        taskType: `寫作 Task — 加強 ${weakestWriting.dimension}`,
        reason: `你的 ${weakestWriting.dimension} 分數偏低 (${weakestWriting.average})`,
      });
    }
    if (weakestSpeaking) {
      dailyPlan.push({
        skill: "Speaking",
        taskType: `口說練習 — 加強 ${weakestSpeaking.dimension}`,
        reason: `你的 ${weakestSpeaking.dimension} 分數偏低 (${weakestSpeaking.average})`,
      });
    }

    if (dailyPlan.length === 0) {
      dailyPlan.push(
        { skill: "Writing", taskType: "寫作 Task 2 練習", reason: "開始你的第一次寫作練習吧！" },
        { skill: "Speaking", taskType: "口說 Part 2 練習", reason: "開始你的第一次口說練習吧！" },
      );
    }

    // Milestones
    const milestones: Milestone[] = [
      { icon: "pencil", label: "完成 10 次寫作練習", achieved: writingRecs.length >= 10, progress: Math.min(writingRecs.length, 10), target: 10 },
      { icon: "mic", label: "完成 10 次口說練習", achieved: speakingRecs.length >= 10, progress: Math.min(speakingRecs.length, 10), target: 10 },
      { icon: "star", label: "總練習達 30 次", achieved: totalPractice >= 30, progress: Math.min(totalPractice, 30), target: 30 },
      { icon: "trophy", label: "單次寫作達 Band 7", achieved: writingRecs.some((r) => (getOverall(r) ?? 0) >= 7), progress: writingRecs.some((r) => (getOverall(r) ?? 0) >= 7) ? 1 : 0, target: 1 },
      { icon: "fire", label: "單次口說達 Band 7", achieved: speakingRecs.some((r) => (getOverall(r) ?? 0) >= 7), progress: speakingRecs.some((r) => (getOverall(r) ?? 0) >= 7) ? 1 : 0, target: 1 },
      { icon: "rocket", label: "總練習達 50 次", achieved: totalPractice >= 50, progress: Math.min(totalPractice, 50), target: 50 },
    ];

    // Streak calculation (consecutive days with practice)
    const allDates = new Set<string>();
    for (const r of [...writingRecs, ...speakingRecs]) {
      const ms = toMs(r);
      if (ms > 0) allDates.add(new Date(ms).toISOString().slice(0, 10));
    }

    let streakDays = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (allDates.has(key)) {
        streakDays++;
      } else if (i > 0) {
        break;
      }
    }

    const data: CoachData = {
      recommendations: recommendations.slice(0, 6),
      milestones,
      dailyPlan,
      strengths,
      streakDays,
      totalPractice,
    };

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load coach data";
    return NextResponse.json({ ok: false, error: { message } }, { status: 500 });
  }
}
