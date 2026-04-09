// app/api/gamification/streak/route.ts
//
// GET  — returns current streak info
// POST — records a practice session (updates streak)

import { NextRequest, NextResponse } from "next/server";
import { getStreak, recordPractice } from "@/features/gamification/streak-service";
import { getUserIdFromHeaders } from "@/features/gamification/get-user-id";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = getUserIdFromHeaders(req.headers);
    const data = await getStreak(userId);
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to get streak" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = getUserIdFromHeaders(req.headers);
    const data = await recordPractice(userId);
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to record practice" },
      { status: 500 },
    );
  }
}
