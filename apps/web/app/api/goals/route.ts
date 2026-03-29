// apps/web/app/api/goals/route.ts
// GET  /api/goals          — return current goals + this-week progress
// POST /api/goals          — upsert goals { targetBand, weeklyWriting, weeklySpeaking }

import { NextRequest, NextResponse } from "next/server";
import { listHistory } from "@/lib/history";
import { kv } from "@vercel/kv";

const GOALS_KEY = "goals:v1";

export type Goals = {
  targetBand: number;
  weeklyWriting: number;
  weeklySpeaking: number;
  updatedAt: string;
};

async function getGoals(): Promise<Goals | null> {
  try {
    const raw = await kv.get<Goals>(GOALS_KEY);
    return raw ?? null;
  } catch {
    // In-memory fallback for local dev
    const g = (globalThis as any).__goals_mem__ as Goals | undefined;
    return g ?? null;
  }
}

async function setGoals(goals: Goals): Promise<void> {
  try {
    await kv.set(GOALS_KEY, goals);
  } catch {
    (globalThis as any).__goals_mem__ = goals;
  }
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET() {
  const [goals, writingRecs, speakingRecs] = await Promise.all([
    getGoals(),
    listHistory({ type: "writing", limit: 100 }).catch(() => []),
    listHistory({ type: "speaking", limit: 100 }).catch(() => []),
  ]);

  const now = Date.now();
  const weekStart = now - SEVEN_DAYS_MS;

  function toMs(rec: any): number {
    if (typeof rec.ts === "number") return rec.ts;
    if (rec.createdAt) return Date.parse(rec.createdAt);
    return 0;
  }

  const thisWeekWriting = writingRecs.filter((r) => toMs(r) > weekStart).length;
  const thisWeekSpeaking = speakingRecs.filter((r) => toMs(r) > weekStart).length;

  return NextResponse.json({
    ok: true,
    data: {
      goals: goals ?? { targetBand: 7, weeklyWriting: 3, weeklySpeaking: 3, updatedAt: "" },
      progress: { thisWeekWriting, thisWeekSpeaking },
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const targetBand = Math.max(4, Math.min(9, Number(body.targetBand) || 7));
    const weeklyWriting = Math.max(0, Math.min(21, Number(body.weeklyWriting) || 3));
    const weeklySpeaking = Math.max(0, Math.min(21, Number(body.weeklySpeaking) || 3));

    const goals: Goals = {
      targetBand,
      weeklyWriting,
      weeklySpeaking,
      updatedAt: new Date().toISOString(),
    };
    await setGoals(goals);

    return NextResponse.json({ ok: true, data: goals });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: { message: e?.message || "Failed to save goals" } },
      { status: 400 },
    );
  }
}
