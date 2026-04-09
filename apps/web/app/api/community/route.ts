// app/api/community/route.ts
// API routes for the community question bank.

import { NextRequest, NextResponse } from "next/server";
import {
  kvSetJSON,
  kvGetJSON,
  kvListPushJSON,
  kvListTailJSON,
} from "@/shared/infrastructure/kv";
import type {
  CommunityQuestion,
  CommunityApiResponse,
  CreateQuestionInput,
} from "@/features/community/types";

const PAGE_SIZE = 12;
const LIST_KEY = "community:list";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function validateInput(
  body: unknown,
): { valid: true; data: CreateQuestionInput } | { valid: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { valid: false, error: "Request body must be a JSON object." };
  }

  const b = body as Record<string, unknown>;

  if (b.type !== "writing" && b.type !== "speaking") {
    return { valid: false, error: "type must be 'writing' or 'speaking'." };
  }
  if (typeof b.title !== "string" || b.title.trim().length < 2 || b.title.trim().length > 120) {
    return { valid: false, error: "title must be 2-120 characters." };
  }
  if (typeof b.prompt !== "string" || b.prompt.trim().length < 10 || b.prompt.trim().length > 2000) {
    return { valid: false, error: "prompt must be 10-2000 characters." };
  }
  if (b.difficulty !== "easy" && b.difficulty !== "medium" && b.difficulty !== "hard") {
    return { valid: false, error: "difficulty must be 'easy', 'medium', or 'hard'." };
  }
  if (typeof b.authorName !== "string" || b.authorName.trim().length < 1 || b.authorName.trim().length > 30) {
    return { valid: false, error: "authorName must be 1-30 characters." };
  }
  if (b.tips !== undefined && (typeof b.tips !== "string" || b.tips.trim().length > 500)) {
    return { valid: false, error: "tips must be a string under 500 characters." };
  }

  return {
    valid: true,
    data: {
      type: b.type as "writing" | "speaking",
      title: b.title.trim() as string,
      prompt: b.prompt.trim() as string,
      difficulty: b.difficulty as "easy" | "medium" | "hard",
      tips: b.tips ? (b.tips as string).trim() : undefined,
      authorName: b.authorName.trim() as string,
    },
  };
}

// GET /api/community?type=writing|speaking&sort=popular|newest|highest&page=1
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const typeFilter = url.searchParams.get("type") as "writing" | "speaking" | null;
    const sort = (url.searchParams.get("sort") ?? "newest") as "popular" | "newest" | "highest";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));

    // Fetch all question IDs from the list (newest last from rpush)
    const ids = await kvListTailJSON<string>(LIST_KEY, 500);

    // Fetch all questions in parallel
    const questions = (
      await Promise.all(ids.map((id) => kvGetJSON<CommunityQuestion>(`community:${id}`)))
    ).filter((q): q is CommunityQuestion => q !== null);

    // Filter by type
    const filtered = typeFilter
      ? questions.filter((q) => q.type === typeFilter)
      : questions;

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "popular") return b.practiceCount - a.practiceCount;
      if (sort === "highest") return (b.avgScore ?? 0) - (a.avgScore ?? 0);
      return b.createdAt - a.createdAt; // newest
    });

    const total = sorted.length;
    const start = (page - 1) * PAGE_SIZE;
    const paginated = sorted.slice(start, start + PAGE_SIZE);

    const response: CommunityApiResponse<readonly CommunityQuestion[]> = {
      success: true,
      data: paginated,
      meta: { total, page, limit: PAGE_SIZE },
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message } satisfies CommunityApiResponse<never>,
      { status: 500 },
    );
  }
}

// POST /api/community
export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const validation = validateInput(body);

    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error } satisfies CommunityApiResponse<never>,
        { status: 400 },
      );
    }

    const { data } = validation;
    const id = generateId();

    const question: CommunityQuestion = {
      id,
      type: data.type,
      title: data.title,
      prompt: data.prompt,
      difficulty: data.difficulty,
      tips: data.tips,
      authorName: data.authorName,
      authorId: `anon-${Date.now()}`,
      practiceCount: 0,
      totalScore: 0,
      avgScore: null,
      createdAt: Date.now(),
    };

    // Store the question and add its ID to the index list
    await kvSetJSON(`community:${id}`, question);
    await kvListPushJSON(LIST_KEY, id);

    const response: CommunityApiResponse<CommunityQuestion> = {
      success: true,
      data: question,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message } satisfies CommunityApiResponse<never>,
      { status: 500 },
    );
  }
}
