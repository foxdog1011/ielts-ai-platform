// app/api/gamification/daily/route.ts
//
// GET — returns today's daily challenge

import { NextRequest, NextResponse } from "next/server";
import { getDailyChallenge } from "@/features/gamification/daily-challenge";
import { getUserIdFromHeaders } from "@/features/gamification/get-user-id";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = getUserIdFromHeaders(req.headers);
    const data = await getDailyChallenge(userId);
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to get daily challenge" },
      { status: 500 },
    );
  }
}
