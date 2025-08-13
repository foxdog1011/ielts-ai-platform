import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OpenAI } from "openai";
import { saveWriting } from "../../lib/history";

/**
 * 入參：
 * - taskId: string
 * - prompt: string
 * - essay: string
 * - targetWords: number
 * - seconds?: number
 *
 * 回傳：
 * { ok, requestId, data: {
 *   band: { overall, taskResponse, coherence, lexical, grammar },
 *   paragraphFeedback: { index: number; comment: string }[],
 *   improvements: string[],
 *   rewritten: string,
 *   tokensUsed?: number
 * } }
 */

const BodySchema = z.object({
  taskId: z.string().min(1),
  prompt: z.string().min(1),
  essay: z.string().min(30, "Essay too short"),
  targetWords: z.number().min(50).max(1000),
  seconds: z.number().int().min(0).max(3600).optional(),
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 10);
  try {
    const body = BodySchema.parse(await req.json());

    const system = [
      "You are an IELTS Writing Task 2 examiner.",
      "Grade on 0–9 band (0.5 increments) for Task Response, Coherence & Cohesion, Lexical Resource, Grammar Range & Accuracy, plus an overall band.",
      "Return JSON ONLY with keys: band, paragraphFeedback, improvements, rewritten, tokensUsed.",
      "band: { overall, taskResponse, coherence, lexical, grammar } (numbers).",
      "paragraphFeedback: array of { index, comment } pointing to paragraph index (0-based).",
      "improvements: 3–6 short, actionable bullets.",
      "rewritten: a concise improved version that preserves meaning.",
    ].join("\n");

    const user = [
      `Prompt:\n${body.prompt}`,
      "",
      `Target Words: ${body.targetWords}`,
      body.seconds ? `Elapsed Seconds: ${body.seconds}` : null,
      "",
      `Essay:\n${body.essay}`,
    ].filter(Boolean).join("\n");

    const chat = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 1400,
    });

    const text = chat.choices?.[0]?.message?.content || "{}";
    let data: any = {};
    try { data = JSON.parse(text); } catch { data = {}; }
    // @ts-ignore
    data.tokensUsed = data.tokensUsed || chat.usage?.total_tokens;

    const norm = {
      band: {
        overall: pickNum(data?.band?.overall),
        taskResponse: pickNum(data?.band?.taskResponse),
        coherence: pickNum(data?.band?.coherence),
        lexical: pickNum(data?.band?.lexical),
        grammar: pickNum(data?.band?.grammar),
      },
      paragraphFeedback: Array.isArray(data?.paragraphFeedback) ? data.paragraphFeedback : [],
      improvements: Array.isArray(data?.improvements) ? data.improvements : [],
      rewritten: typeof data?.rewritten === "string" ? data.rewritten : "",
      tokensUsed: data.tokensUsed,
    };

    // 寫入歷史（詞數/WPM 也存一下，方便之後趨勢）
    const words = countWords(body.essay);
    const wpm = body.seconds ? Math.round(words / Math.max(1, body.seconds / 60)) : undefined;
    await saveWriting({
      taskId: body.taskId,
      band: norm.band,
      words,
      wpm,
      targetWords: body.targetWords,
    });

    return NextResponse.json({ ok: true, data: norm, requestId });
  } catch (err: any) {
    const message = err?.issues?.[0]?.message || err?.message || "Failed to evaluate writing";
    return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message }, requestId }, { status: 400 });
  }
}

function pickNum(v: any) { const n = Number(v); return isFinite(n) ? n : undefined; }
function countWords(t: string) {
  const s = t?.trim(); if (!s) return 0;
  return s.replace(/\n/g, " ").split(" ").map((x) => x.trim()).filter(Boolean).length;
}
