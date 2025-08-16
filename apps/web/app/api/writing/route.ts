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
  // 四捨五入到 0.5
  return Math.round(n * 2) / 2;
}
function countWords(text: string) {
  const t = text.trim();
  if (!t) return 0;
  return t.replace(/\n/g, " ").split(" ").map(s => s.trim()).filter(Boolean).length;
}

type Band = {
  overall?: number | null;
  taskResponse?: number | null;
  coherence?: number | null;
  lexical?: number | null;
  grammar?: number | null;
};

function normalizeBand(b: Partial<Band> | null | undefined): Required<Band> {
  const o = (b?.overall ?? null);
  const tr = (b?.taskResponse ?? null);
  const cc = (b?.coherence ?? null);
  const lr = (b?.lexical ?? null);
  const gr = (b?.grammar ?? null);

  // clamp & half-steps 如果非 null
  const fix = (x: number | null) =>
    x == null || Number.isNaN(x) ? null : toHalfBand(clamp(Number(x), 0, 9));

  return {
    overall: fix(o),
    taskResponse: fix(tr),
    coherence: fix(cc),
    lexical: fix(lr),
    grammar: fix(gr),
  };
}

function deriveOverall(b: Required<Band>): number {
  // 如果 overall 缺，就用四構面平均
  const parts = [b.taskResponse, b.coherence, b.lexical, b.grammar].filter(
    (x): x is number => typeof x === "number"
  );
  if (typeof b.overall === "number") return toHalfBand(clamp(b.overall, 0, 9));
  if (parts.length === 0) return 5.5;
  const avg = parts.reduce((a, c) => a + c, 0) / parts.length;
  return toHalfBand(clamp(avg, 0, 9));
}

// ---------- LLM prompt ----------
function buildSystem() {
  return `You are an IELTS Writing Task 2 rater. Score strictly on four criteria:
- Task Response (TR)
- Coherence and Cohesion (CC)
- Lexical Resource (LR)
- Grammatical Range and Accuracy (GRA)

Return concise, actionable comments. Scores are 0.0–9.0 and can use half steps (e.g., 5.5, 6.0, 6.5).`;
}

function buildUser(prompt: string, essay: string) {
  return `PROMPT:
${prompt}

ESSAY:
${essay}
`;
}

// ---------- JSON schema for model ----------
const responseSchema = {
  type: "object",
  properties: {
    band: {
      type: "object",
      properties: {
        taskResponse: { type: "number" },
        coherence: { type: "number" },
        lexical: { type: "number" },
        grammar: { type: "number" },
        overall: { type: "number" },
      },
      required: ["taskResponse", "coherence", "lexical", "grammar"],
    },
    paragraphFeedback: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "number" },
          comment: { type: "string" },
        },
        required: ["index", "comment"],
      },
    },
    improvements: {
      type: "array",
      items: { type: "string" },
    },
    rewritten: { type: "string" },
  },
  required: ["band"],
} as const;

// ---------- handler ----------
export async function POST(req: NextRequest) {
  try {
    const body = Body.parse(await req.json());
    const { taskId, prompt, essay, targetWords, seconds } = body;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    // 使用 JSON 模式要用 Responses API（OpenAI SDK v5）
    const start = Date.now();
    const resp = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      input: [
        { role: "system", content: buildSystem() },
        { role: "user", content: buildUser(prompt, essay) },
      ],
      // JSON schema（function-like）
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ielts_writing_result",
          schema: responseSchema,
          strict: true,
        },
      },
      temperature: Number(process.env.TEMPERATURE ?? 0.2),
    } as any);

    // 解析 JSON
    const outText = resp.output_text || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(outText);
    } catch {
      parsed = {};
    }

    // 固定補齊 & clamp + half step
    const bandRaw: Partial<Band> = parsed?.band || {};
    let band = normalizeBand(bandRaw);
    band.overall = deriveOverall(band);

    // 其他欄位
    const paragraphFeedback: { index: number; comment: string }[] = Array.isArray(parsed?.paragraphFeedback)
      ? parsed.paragraphFeedback
          .map((x: any) => ({
            index: Number(x?.index ?? 0),
            comment: String(x?.comment ?? "").slice(0, 800),
          }))
          .filter((x: any) => x.comment)
      : [];

    const improvements: string[] = Array.isArray(parsed?.improvements)
      ? parsed.improvements.map((s: any) => String(s ?? "")).filter(Boolean).slice(0, 10)
      : [];

    const rewritten: string =
      typeof parsed?.rewritten === "string" && parsed.rewritten.trim()
        ? parsed.rewritten
        : "";

    const tokensUsed =
      (resp?.usage?.total_tokens as number | undefined) ??
      (resp?.usage as any)?.total_tokens ??
      undefined;

    // ---------- 寫入歷史（自動） ----------
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
      // 保持靜默，不阻斷主流程
      console.warn("[history] saveScore failed:", (e as Error)?.message);
    }

    // ---------- 回傳 ----------
    const data = {
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
    };

    return NextResponse.json({ ok: true, data });
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
