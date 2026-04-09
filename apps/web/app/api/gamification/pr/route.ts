// app/api/gamification/pr/route.ts
//
// GET  — returns all personal records for the user
// POST — checks scores against stored PRs and updates if new bests found

import { NextRequest, NextResponse } from "next/server";
import {
  getPersonalRecords,
  checkAndUpdatePR,
} from "@/features/gamification/pr-service";
import { getUserIdFromHeaders } from "@/features/gamification/get-user-id";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = getUserIdFromHeaders(req.headers);
    const data = await getPersonalRecords(userId);
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to get PRs" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = getUserIdFromHeaders(req.headers);
    const body = await req.json();

    const { type, scores } = body as {
      type?: string;
      scores?: Record<string, number>;
    };

    if (!type || (type !== "writing" && type !== "speaking")) {
      return NextResponse.json(
        { ok: false, error: "type must be 'writing' or 'speaking'" },
        { status: 400 },
      );
    }

    if (!scores || typeof scores !== "object") {
      return NextResponse.json(
        { ok: false, error: "scores must be an object of dimension:number pairs" },
        { status: 400 },
      );
    }

    const newPRs = await checkAndUpdatePR(userId, type, scores);
    return NextResponse.json({ ok: true, data: { newPRs } });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to check PRs" },
      { status: 500 },
    );
  }
}
