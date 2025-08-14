import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listPrompts,
  savePromptsUniq,
  type WritingPart,
  type SpeakingPart,
} from "@/lib/promptStore";

const WRITING_PARTS = ["task1-ac", "task1-gt", "task2"] as const;
const SPEAKING_PARTS = ["part1", "part2", "part3"] as const;

const Query = z.object({
  type: z.enum(["writing", "speaking"]).optional(),
  part: z
    .union([
      z.custom<WritingPart>((v) => WRITING_PARTS.includes(v as any)),
      z.custom<SpeakingPart>((v) => SPEAKING_PARTS.includes(v as any)),
    ])
    .optional(),
  topic: z.string().optional(),
  level: z.enum(["5.0-6.0", "6.0-7.0", "7.0-8.0"]).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = Query.safeParse({
      type: searchParams.get("type") || undefined,
      part: searchParams.get("part") || undefined,
      topic: searchParams.get("topic") || undefined,
      level: searchParams.get("level") || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { message: "invalid query", issues: parsed.error.issues } },
        { status: 400 }
      );
    }
    const { type, part, topic, level } = parsed.data;

    // 依序降級：全部條件 → 去掉 topic/level → 只保留 type → 全部放寬
    const attempts: Array<Parameters<typeof listPrompts>[0]> = [
      { type: type as any, part: part as any, topic, level: level as any, limit: 200, offset: 0 },
      { type: type as any, part: part as any, limit: 200, offset: 0 },
      { type: type as any, limit: 200, offset: 0 },
      { limit: 200, offset: 0 },
    ];

    let candidates: any[] = [];
    for (const opt of attempts) {
      candidates = await listPrompts(opt);
      if (candidates.length) break;
    }

    // 若依然沒有資料：寫入一批內建種子題目，再回傳其中一題
    if (!candidates.length) {
      const seeded = await ensureSeeds();
      if (seeded.length) {
        candidates = seeded;
      }
    }

    if (!candidates.length) {
      // 最終兜底（理論上到不了這裡）
      return NextResponse.json(
        { ok: false, error: { message: "no prompt found (empty bank). Try generating some first." } },
        { status: 404 }
      );
    }

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    return NextResponse.json({ ok: true, data: picked });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: { message: e?.message || "random prompt error" } },
      { status: 500 }
    );
  }
}

/** 若題庫為空，寫入一小批種子題（writing task2 + speaking part2） */
async function ensureSeeds() {
  const seeds = SEED_PROMPTS.map((p) => ({
    ...p,
    source: "seed" as const,
  }));
  const saved = await savePromptsUniq(seeds);
  // 回傳剛寫入的題目（若已存在，savePromptsUniq 會去重，回傳可能為空）
  return saved;
}

const SEED_PROMPTS: Array<{
  type: "writing" | "speaking";
  part: WritingPart | SpeakingPart;
  topicTags: string[];
  level?: "5.0-6.0" | "6.0-7.0" | "7.0-8.0";
  prompt: string;
  followup?: string[];
}> = [
  // Writing Task 2
  {
    type: "writing",
    part: "task2",
    topicTags: ["education", "technology"],
    level: "6.0-7.0",
    prompt:
      "Some people believe that technology has made students less focused, while others think it has improved their learning efficiency. Discuss both views and give your own opinion.",
  },
  {
    type: "writing",
    part: "task2",
    topicTags: ["environment", "government"],
    level: "6.0-7.0",
    prompt:
      "Many governments are investing in public transport to reduce traffic and pollution. To what extent do you agree or disagree?",
  },
  // Speaking Part 2 (Cue Card)
  {
    type: "speaking",
    part: "part2",
    topicTags: ["person", "inspiration"],
    level: "6.0-7.0",
    prompt:
      "Describe a person who has inspired you. You should say:\n- who the person is\n- how you know this person\n- what this person did\nand explain why this person inspired you.",
    followup: [
      "Do you think role models are necessary for young people?",
      "Can public figures influence social values?",
    ],
  },
  {
    type: "speaking",
    part: "part2",
    topicTags: ["place", "travel"],
    level: "6.0-7.0",
    prompt:
      "Describe a place you visited that left a strong impression on you. You should say:\n- where it is\n- when you went there\n- what you did there\nand explain why it was memorable.",
    followup: [
      "Do you prefer traveling alone or with others?",
      "How has tourism changed in your country in recent years?",
    ],
  },
];
