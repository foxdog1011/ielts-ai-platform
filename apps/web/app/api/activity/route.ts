// app/api/activity/route.ts
//
// GET /api/activity — returns recent anonymized practice activity for the feed.

import { NextRequest, NextResponse } from "next/server";
import { getRecentActivity } from "@/features/activity/activity-service";
import type { ActivityApiResponse } from "@/features/activity/types";

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? "20")));

    const data = await getRecentActivity(limit);

    const response: ActivityApiResponse = {
      success: true,
      data,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message } satisfies ActivityApiResponse,
      { status: 500 },
    );
  }
}
