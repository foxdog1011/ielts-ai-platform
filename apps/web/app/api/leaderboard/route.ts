// app/api/leaderboard/route.ts
//
// GET  — return sorted leaderboard (?type=writing|speaking|all)
// POST — update a user's leaderboard entry after scoring

import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard, updateLeaderboard } from "@/features/leaderboard/leaderboard-service";
import { getUserIdFromHeaders } from "@/features/gamification/get-user-id";

const VALID_TYPES = new Set(["writing", "speaking", "all"]);

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const type = req.nextUrl.searchParams.get("type") ?? "all";
    if (!VALID_TYPES.has(type)) {
      return NextResponse.json(
        { ok: false, error: "Invalid type. Use writing, speaking, or all." },
        { status: 400 },
      );
    }
    const data = await getLeaderboard(type as "writing" | "speaking" | "all");
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to get leaderboard" },
      { status: 500 },
    );
  }
}

interface PostBody {
  readonly displayName?: string;
  readonly type?: string;
  readonly band?: number;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = getUserIdFromHeaders(req.headers);
    const body = (await req.json()) as PostBody;
    const { displayName, type, band } = body;

    if (!displayName || typeof displayName !== "string") {
      return NextResponse.json({ ok: false, error: "displayName is required" }, { status: 400 });
    }
    if (type !== "writing" && type !== "speaking") {
      return NextResponse.json({ ok: false, error: "type must be writing or speaking" }, { status: 400 });
    }
    if (typeof band !== "number" || band < 0 || band > 9) {
      return NextResponse.json({ ok: false, error: "band must be 0-9" }, { status: 400 });
    }

    await updateLeaderboard(userId, displayName, type, band);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to update leaderboard" },
      { status: 500 },
    );
  }
}
