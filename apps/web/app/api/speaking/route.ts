import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OpenAI } from "openai";

/**
 * 入參：
 * - taskId: string
 * - audioBase64: string（純 base64，無 data: 前綴）
 * - mime: string（e.g. audio/webm）
 * - durationSec: number (1~600)
 * - manualTranscript?: string
 * - speechMetrics?: { pauseRate?: number; avgPauseSec?: number }
 *
 * 回傳：
 * { ok, requestId, data: {
 *   transcript: string,
 *   content: { band: { overall, taskResponse, coherence, vocabulary, grammar }, suggestions: string[] },
 *   speech:  { band: { overall, pronunciation, fluency }, metrics: { durationSec, wpm, pauseRate, avgPauseSec }, suggestions: string[] },
 *   tokensUsed?: number
 * } }
 */

const BodySchema = z.object({
  taskId: z.string().min(1),
  audioBase64: z.string().min(1),
  mime: z.string().min(1),
  durationSec: z.number().int().min(1).max(600),
  manualTranscript: z.string().optional(),
  speechMetrics: z
    .object({
      pauseRate: z.number().min(0).max(1).optional(),
      avgPauseSec: z.number().min(0).max(5).optional(),
    })
    .optional(),
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 10);
  try {
    const body = BodySchema.parse(await req.json());

    // 1) Transcript（先用人工，沒有就 ASR）
    const transcript =
      (body.manualTranscript && body.manualTranscript.trim()) ||
      (await transcribeWithWhisper(body.audioBase64, body.mime));

    // 2) 文本詞數 / WPM
    const wordCount = countWords(transcript);
    const wpm =
      wordCount && body.durationSec > 0 ? Math.round(wordCount / (body.durationSec / 60)) : 0;

    // 3) 兩通道並行評分
    const [contentEval, speechEval] = await Promise.all([
      evaluateContentChannel(transcript),
      evaluateSpeechChannel({
        durationSec: body.durationSec,
        wpm,
        pauseRate: body.speechMetrics?.pauseRate,
        avgPauseSec: body.speechMetrics?.avgPauseSec,
        transcript,
      }),
    ]);

    // 4) 正規化 + 整理回傳
    const data = {
      transcript,
      content: normalizeContent(contentEval),
      speech: normalizeSpeech(speechEval, {
        durationSec: body.durationSec,
        wpm,
        pauseRate: body.speechMetrics?.pauseRate,
        avgPauseSec: body.speechMetrics?.avgPauseSec,
      }),
      tokensUsed:
        (contentEval as any).tokensUsed ||
        (speechEval as any).tokensUsed ||
        undefined,
    };

    return NextResponse.json({ ok: true, requestId, data });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: { message: e?.message || "speaking route error" },
      },
      { status: 400 }
    );
  }
}

/* ---------------- Helpers ---------------- */

function countWords(t: string) {
  const s = t?.trim();
  if (!s) return 0;
  return s
    .replace(/\n/g, " ")
    .split(" ")
    .map((x) => x.trim())
    .filter(Boolean).length;
}

function extFromMime(mime: string) {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg")) return "mp3";
  return "dat";
}

async function transcribeWithWhisper(audioBase64: string, mime: string) {
  const buf = Buffer.from(audioBase64, "base64");
  // Node 18+ 提供 File；若你的執行環境沒有 File，可以改用 ReadableStream 與名稱物件
  const file = new File([buf], `audio.${extFromMime(mime)}`, { type: mime });
  const res = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
  });
  // @ts-ignore
  return (res.text as string) || (res as any).text || "";
}

/** 通道 A：內容面（TR/CC/LR/GRA） */
async function evaluateContentChannel(transcript: string) {
  const system = [
    "You are an IELTS Speaking content evaluator.",
    "Grade the response on a 0–9 band scale (0.5 increments) for Task Response, Coherence & Cohesion, Lexical Resource, Grammar range & accuracy.",
    "Also provide an overall content band.",
    "Return JSON ONLY with keys: band, suggestions, tokensUsed.",
    "band: { overall, taskResponse, coherence, vocabulary, grammar } as numbers.",
    "suggestions: array of short, actionable strings (max 5).",
  ].join("\n");

  const chat = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Transcript:\n${transcript || "(empty)"}` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 700,
  });

  const text = chat.choices?.[0]?.message?.content || "{}";
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  // @ts-ignore
  data.tokensUsed = data.tokensUsed || chat.usage?.total_tokens;
  return data;
}

/** 通道 B：語音面（Pronunciation/Fluency） */
async function evaluateSpeechChannel(args: {
  durationSec: number;
  wpm: number;
  pauseRate?: number;
  avgPauseSec?: number;
  transcript: string;
}) {
  const { durationSec, wpm, pauseRate, avgPauseSec, transcript } = args;

  const system = [
    "You are an IELTS Speaking pronunciation & fluency evaluator.",
    "Rate pronunciation and fluency on a 0–9 band scale (0.5 increments), and provide an overall speech band.",
    "Use the provided objective features (WPM, pause rate, average pause length) as primary evidence.",
    "Return JSON ONLY with keys: band, suggestions, tokensUsed.",
    "band: { overall, pronunciation, fluency } as numbers.",
    "suggestions: array of short, actionable strings (max 4).",
  ].join("\n");

  const user = [
    `Duration: ${Math.round(durationSec)}s`,
    `WPM: ${wpm}`,
    pauseRate !== undefined
      ? `PauseRate(>250ms): ${(pauseRate * 100).toFixed(1)}%`
      : "PauseRate: (n/a)",
    avgPauseSec !== undefined
      ? `AvgPause: ${avgPauseSec.toFixed(2)}s`
      : "AvgPause: (n/a)",
    "Transcript (for lexical hints, do NOT grade content here):",
    transcript || "(empty)",
  ].join("\n");

  const chat = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 500,
  });

  const text = chat.choices?.[0]?.message?.content || "{}";
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  // @ts-ignore
  data.tokensUsed = data.tokensUsed || chat.usage?.total_tokens;
  return data;
}

/** 正規化輸出 */
function normalizeContent(x: any) {
  const band = x?.band || {};
  return {
    band: {
      overall: pickNum(band.overall),
      taskResponse: pickNum(band.taskResponse),
      coherence: pickNum(band.coherence),
      vocabulary: pickNum(band.vocabulary),
      grammar: pickNum(band.grammar),
    },
    suggestions: Array.isArray(x?.suggestions) ? x.suggestions : [],
  };
}

function normalizeSpeech(
  x: any,
  metrics: {
    durationSec: number;
    wpm: number;
    pauseRate?: number;
    avgPauseSec?: number;
  }
) {
  const band = x?.band || {};
  return {
    band: {
      overall: pickNum(band.overall),
      pronunciation: pickNum(band.pronunciation),
      fluency: pickNum(band.fluency),
    },
    metrics: {
      durationSec: metrics.durationSec,
      wpm: metrics.wpm,
      pauseRate: metrics.pauseRate ?? null,
      avgPauseSec: metrics.avgPauseSec ?? null,
    },
    suggestions: Array.isArray(x?.suggestions) ? x.suggestions : [],
  };
}

function pickNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
