// app/api/gamification/weekly/route.ts
//
// GET   — returns current week's goal and progress
// POST  — set weekly target
// PATCH — record one practice toward this week's goal

import { NextRequest, NextResponse } from "next/server";
import {
  getWeeklyGoal,
  setWeeklyGoal,
  recordWeeklyProgress,
} from "@/features/gamification/weekly-goals";
import { getUserIdFromHeaders } from "@/features/gamification/get-user-id";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = getUserIdFromHeaders(req.headers);
    const data = await getWeeklyGoal(userId);
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to get weekly goal" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = getUserIdFromHeaders(req.headers);
    const body = await req.json();

    const { target } = body as { target?: number };

    if (target == null || typeof target !== "number") {
      return NextResponse.json(
        { ok: false, error: "target must be a number between 1 and 14" },
        { status: 400 },
      );
    }

    const data = await setWeeklyGoal(userId, target);
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to set weekly goal" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = getUserIdFromHeaders(req.headers);
    const data = await recordWeeklyProgress(userId);
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to record progress" },
      { status: 500 },
    );
  }
}
