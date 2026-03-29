// apps/web/app/api/prompts/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ── Simple in-memory rate limiter ──────────────────────────────────────────
// 5 generate calls per IP per hour. Resets on server restart (acceptable for
// a single-user app — prevents accidental runaway API cost).
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const _rateBucket = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = _rateBucket.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    _rateBucket.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }
  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  entry.count += 1;
  return { allowed: true, remaining: RATE_LIMIT - entry.count };
}
// ─────────────────────────────────────────────────────────────────────────
import OpenAI from "openai";
import {
  savePromptsUniq,
  type PromptItem,
  type PromptType,
  type WritingPart,
  type SpeakingPart,
} from "@/lib/promptStore";

const BodySchema = z.object({
  type: z.enum(["writing", "speaking"]),
  part: z.string(), // 由下方校驗
  count: z.number().int().min(1).max(50).default(10),
  topics: z.array(z.string()).max(10).default([]),
  level: z.enum(["5.0-6.0", "6.0-7.0", "7.0-8.0"]).optional(),
});

const WRITING_PARTS: WritingPart[] = ["task1-ac", "task1-gt", "task2"];
const SPEAKING_PARTS: SpeakingPart[] = ["part1", "part2", "part3"];

function makeSystem(type: PromptType, part: WritingPart | SpeakingPart) {
  if (type === "writing") {
    const p2 = part === "task2";
    return [
      "You are an IELTS item writer generating ORIGINAL practice prompts.",
      "Return JSON ONLY with key 'items' as an array.",
      p2
        ? "Each item: { prompt, topicTags[], followup?[] } for Writing Task 2."
        : "Each item: { prompt, topicTags[] } for Writing Task 1.",
      "Topic tags: lowercase, 1-3 words each, 1-4 tags.",
      "No copyrighted passages. No duplication. Be globally relevant and culturally neutral.",
    ].join("\n");
  } else {
    // speaking
    return [
      "You are an IELTS item writer generating ORIGINAL Speaking prompts.",
      "Return JSON ONLY with key 'items' as an array.",
      part === "part2"
        ? "Each item: { prompt, topicTags[], followup?[] } where followup lists 3-5 likely part-3 questions."
        : "Each item: { prompt, topicTags[] }",
      "Topic tags: lowercase, 1-3 words each, 1-4 tags.",
      "Clear, concise, exam-style wording. No duplicates.",
    ].join("\n");
  }
}

function makeUser(body: z.infer<typeof BodySchema>) {
  const { type, part, count, topics, level } = body;
  const topicStr = topics.length
    ? `Focus on topics: ${topics.join(", ")}.`
    : "Use varied common IELTS topics.";
  const levelStr = level ? `Target level: ${level}.` : "Target level: 6.0-7.0.";
  return [
    `Generate ${count} ${type.toUpperCase()} prompts for ${part}.`,
    topicStr,
    levelStr,
    "Output JSON as { items: [...] } only.",
  ].join("\n");
}

function normalize(
  type: PromptType,
  part: WritingPart | SpeakingPart,
  data: any,
  level?: PromptItem["level"]
) {
  const arr = Array.isArray(data?.items) ? data.items : [];
  return arr
    .map((raw: any) => ({
      type,
      part,
      level,
      prompt: String(raw?.prompt || "").trim(),
      topicTags: (Array.isArray(raw?.topicTags) ? raw.topicTags : [])
        .map((t: any) => String(t || "").trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 4),
      followup: Array.isArray(raw?.followup)
        ? raw.followup
            .map((q: any) => String(q || "").trim())
            .filter(Boolean)
            .slice(0, 6)
        : undefined,
      source: "ai-gen" as const,
    }))
    .filter((x: any) => x.prompt?.length > 10);
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const { allowed, remaining } = checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: { message: "每小時最多生成 5 次，請稍後再試。" } },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }

    const body = BodySchema.parse(await req.json());
    // 驗 part 合法
    if (body.type === "writing" && !WRITING_PARTS.includes(body.part as WritingPart)) {
      return NextResponse.json(
        { ok: false, error: { message: "Invalid writing part" } },
        { status: 400 }
      );
    }
    if (body.type === "speaking" && !SPEAKING_PARTS.includes(body.part as SpeakingPart)) {
      return NextResponse.json(
        { ok: false, error: { message: "Invalid speaking part" } },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    // ✅ 用 Chat Completions + JSON 物件格式，避免 Responses API 型別錯誤
    const chat = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: makeSystem(body.type as PromptType, body.part as any) },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: makeUser(body),
            },
          ],
        },
      ],
      max_tokens: 1800,
    });

    const text = chat.choices?.[0]?.message?.content || "{}";
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }

    const rows = normalize(
      body.type as PromptType,
      body.part as any,
      data,
      body.level
    );

    // 這裡 savePromptsUniq 允許去重/補 id/hash/ts；你的型別若嚴格，直接 as any
    const saved = await savePromptsUniq(rows as any);

    return NextResponse.json(
      { ok: true, data: { created: saved.length, items: saved } },
      { headers: { "X-RateLimit-Remaining": String(remaining) } },
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: { message: err?.message || "Failed to generate" } },
      { status: 400 }
    );
  }
}
