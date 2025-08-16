// apps/web/app/api/writing/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { saveScore } from "@/lib/kv";

// ---------- Zod schema ----------
const Body = z.object({
  taskId: z.string().min(1),
  prompt: z.string().min(1),
  essay: z.string().min(1),
  targetWords: z.number().int().positive().optional(),
  seconds: z.number().int().nonnegative().optional(),
});

// ---------- helpers ----------
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function toHalfBand(n: number) {
  return Math.round(n * 2) / 2; // 四捨五入到 0.5
}
function countWords(text: string) {
  const t = text.trim();
  if (!t) return 0;
  return t
    .replace(/\n/g, " ")
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean).length;
}

type Band = {
  overall?: number | null;
  taskResponse?: number | null;
  coherence?: number | null;
  lexical?: number | null;
  grammar?: number | null;
};

function normalizeBand(b: Partial<Band> | null | undefined): Required<Band> {
  const fix = (x: number | null | undefined) =>
    x == null || Number.isNaN(x) ? null : toHalfBand(clamp(Number(x), 0, 9));
  return {
    overall: fix(b?.overall ?? null),
    taskResponse: fix(b?.taskResponse ?? null),
    coherence: fix(b?.coherence ?? null),
    lexical: fix(b?.lexical ?? null),
    grammar: fix(b?.grammar ?? null),
  };
}

function deriveOverall(b: Required<Band>): number {
  const parts = [b.taskResponse, b.coherence, b.lexical, b.grammar].filter(
    (x): x is number => typeof x === "number"
  );
  if (typeof b.overall === "number") return toHalfBand(clamp(b.overall, 0, 9));
  if (parts.length === 0) return 5.5;
  const avg = parts.reduce((a, c) => a + c, 0) / parts.length;
  return toHalfBand(clamp(avg, 0, 9));
}

function fillMissingWithOverall(b: Required<Band>): Required<Band> {
  const ov = typeof b.overall === "number" ? b.overall : deriveOverall(b) ?? 5.5;
  return {
    overall: ov,
    taskResponse: typeof b.taskResponse === "number" ? b.taskResponse : ov,
    coherence: typeof b.coherence === "number" ? b.coherence : ov,
    lexical: typeof b.lexical === "number" ? b.lexical : ov,
    grammar: typeof b.grammar === "number" ? b.grammar : ov,
  };
}

// ---------- LLM prompts ----------
function buildSystem() {
  return `
You are an IELTS Writing Task 2 examiner.

Return ONE JSON object only, no markdown, no extra text, with the EXACT shape:
{
  "band": {
    "taskResponse": number,
    "coherence": number,
    "lexical": number,
    "grammar": number,
    "overall": number
  },
  "paragraphFeedback": [
    { "index": number, "comment": string }
  ],
  "improvements": [ string ],
  "rewritten": string
}

Scoring strictly follows IELTS bands (0.0–9.0, half-step increments).
"paragraphFeedback": up to 6 short, actionable comments (index 0-based).
"improvements": up to 10 bullet-like actionable tips.
"rewritten": provide a concise, improved version of the entire essay (preserve meaning, better TR/CC/LR/GRA). No markdown.
Output JSON ONLY.
`.trim();
}

function buildUser(prompt: string, essay: string, targetWords?: number) {
  const tw = targetWords ? `TARGET WORDS: ~${targetWords}\n` : "";
  return `
PROMPT:
${prompt}

${tw}ESSAY:
${essay}
`.trim();
}

// ---------- handler ----------
export async function POST(req: NextRequest) {
  try {
    const body = Body.parse(await req.json());
    const { taskId, prompt, essay, targetWords, seconds } = body;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const start = Date.now();
    const chat = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: Number(process.env.TEMPERATURE ?? 0.2),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystem() },
        { role: "user", content: buildUser(prompt, essay, targetWords) },
      ],
      max_tokens: 1200,
    });

    const text = chat.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {};
    }

    // 整理分數
    let band = normalizeBand(parsed?.band || {});
    band.overall = deriveOverall(band);
    band = fillMissingWithOverall(band);

    // 其他欄位
    const paragraphFeedback: { index: number; comment: string }[] =
      Array.isArray(parsed?.paragraphFeedback)
        ? parsed.paragraphFeedback
            .map((x: any) => ({
              index: Number(x?.index ?? 0),
              comment: String(x?.comment ?? "").slice(0, 800),
            }))
            .filter(
              (x: { index: number; comment: string }) => !!x.comment
            )
            .slice(0, 6)
        : [];

    const improvements: string[] = Array.isArray(parsed?.improvements)
      ? parsed.improvements
          .map((s: any) => String(s ?? ""))
          .filter((s: string) => !!s)
          .slice(0, 10)
      : [];

    const rewritten: string =
      typeof parsed?.rewritten === "string" && parsed.rewritten.trim()
        ? parsed.rewritten
        : "";

    const tokensUsed =
      (chat?.usage?.total_tokens as number | undefined) ??
      (chat?.usage as any)?.total_tokens ??
      undefined;

    // 寫入歷史（不影響主流程）
    try {
      const words = countWords(essay);
      await saveScore("writing", {
        taskId,
        prompt,
        durationSec: seconds ?? undefined,
        words,
        band,
      });
    } catch (e) {
      console.warn("[history] saveScore failed:", (e as Error)?.message);
    }

    return NextResponse.json({
      ok: true,
      data: {
        band,
        paragraphFeedback,
        improvements,
        rewritten,
        tokensUsed,
        debug: {
          used_llm: true,
          used_local: false,
          calibration_mode: "none",
          latency_ms: Date.now() - start,
        },
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "BAD_REQUEST",
          message: e?.message || "Invalid body",
        },
      },
      { status: 400 }
    );
  }
}
