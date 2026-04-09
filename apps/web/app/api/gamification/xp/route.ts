// app/api/gamification/xp/route.ts
//
// GET — returns current XP info (totalXP, level, xpToNextLevel)

import { NextRequest, NextResponse } from "next/server";
import { getXP } from "@/features/gamification/xp-service";
import { getUserIdFromHeaders } from "@/features/gamification/get-user-id";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = getUserIdFromHeaders(req.headers);
    const data = await getXP(userId);
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to get XP" },
      { status: 500 },
    );
  }
}
