import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OpenAI } from "openai";
import { savePromptsUniq, type PromptItem, type PromptType, type WritingPart, type SpeakingPart } from  "../../../../lib/promptStore";
const BodySchema = z.object({
  type: z.enum(["writing","speaking"]),
  part: z.string(), // 由下方校驗
  count: z.number().int().min(1).max(50).default(10),
  topics: z.array(z.string()).max(10).default([]),
  level: z.enum(["5.0-6.0","6.0-7.0","7.0-8.0"]).optional(),
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json());
    // 驗 part 合法
    const writingParts: WritingPart[] = ["task1-ac","task1-gt","task2"];
    const speakingParts: SpeakingPart[] = ["part1","part2","part3"];
    if (body.type === "writing" && !writingParts.includes(body.part as WritingPart)) {
      return bad("Invalid writing part");
    }
    if (body.type === "speaking" && !speakingParts.includes(body.part as SpeakingPart)) {
      return bad("Invalid speaking part");
    }

    const sys = makeSystem(body.type as PromptType, body.part as any);
    const user = makeUser(body);

    const chat = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
      max_tokens: 1800,
    });

    const text = chat.choices?.[0]?.message?.content || "{}";
    let data: any = {};
    try { data = JSON.parse(text); } catch { data = {}; }

    const rows: Omit<PromptItem, "id" | "ts" | "hash">[] = normalize(body.type as PromptType, body.part as any, data, body.level);
    const saved = await savePromptsUniq(rows);
    return NextResponse.json({ ok: true, data: { created: saved.length, items: saved } });
  } catch (err: any) {
    return bad(err?.issues?.[0]?.message || err?.message || "Failed to generate");
  }
}

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { message } }, { status });
}

/* ---------- prompt templates ---------- */

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
  const topicStr = topics.length ? `Focus on topics: ${topics.join(", ")}.` : "Use varied common IELTS topics.";
  const levelStr = level ? `Target level: ${level}.` : "Target level: 6.0-7.0.";
  return [
    `Generate ${count} ${type.toUpperCase()} prompts for ${part}.`,
    topicStr,
    levelStr,
    "Output JSON as { items: [...] } only.",
  ].join("\n");
}

function normalize(type: PromptType, part: WritingPart | SpeakingPart, data: any, level?: PromptItem["level"]) {
  const arr = Array.isArray(data?.items) ? data.items : [];
  return arr
    .map((raw: any) => ({
      type,
      part,
      level,
      prompt: String(raw?.prompt || "").trim(),
      topicTags: (Array.isArray(raw?.topicTags) ? raw.topicTags : []).map((t: any) => String(t || "").trim().toLowerCase()).filter(Boolean).slice(0,4),
      followup: Array.isArray(raw?.followup) ? raw.followup.map((q:any)=>String(q||"").trim()).filter(Boolean).slice(0,6) : undefined,
      source: "ai-gen" as const,
    }))
    .filter((x: any) => x.prompt?.length > 10);
}
