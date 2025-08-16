// apps/web/app/api/speaking/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import path from "node:path";
import { promises as fs } from "node:fs";
import { saveScore } from "@/lib/kv";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const ASR_MODEL = process.env.ASR_MODEL || "gpt-4o-mini-transcribe";
const CALIB_PATH = path.join(process.cwd(), "public", "calibration", "quantile_map.json");
let quantileMap: Record<string, number> | null = null;

async function loadCalibration() {
  if (quantileMap) return quantileMap;
  try {
    const buf = await fs.readFile(CALIB_PATH, "utf8");
    quantileMap = JSON.parse(buf);
  } catch {
    quantileMap = null;
  }
  return quantileMap;
}

function applyQuantileMap01ToBand(overall01: number): number {
  if (!quantileMap) return Math.round((4 + 5 * overall01) * 2) / 2;
  const q = Math.max(0, Math.min(1, overall01));
  const key = q.toFixed(2);
  const mapped = quantileMap[key];
  if (typeof mapped === "number") return Math.round(mapped * 2) / 2;
  // 最近 key
  const keys = Object.keys(quantileMap).map(Number).sort((a,b)=>a-b);
  let nearest = keys[0];
  for (const k of keys) if (Math.abs(k - q) < Math.abs(nearest - q)) nearest = k;
  return Math.round((quantileMap[nearest.toFixed(2)] ?? (4 + 5*q)) * 2) / 2;
}

const Body = z.object({
  taskId: z.string().min(1),
  prompt: z.string().optional(),
  // 兩種來源：前端錄音（base64）或本機音檔路徑（dev）
  audioBase64: z.string().optional(),
  mime: z.string().optional(),
  audioPath: z.string().optional(),
  manualTranscript: z.string().optional(),
  durationSec: z.number().optional(),
});

export async function POST(req: NextRequest) {
  const rid = crypto.randomUUID();
  try {
    const body = Body.parse(await req.json());
    const { taskId, prompt, audioBase64, mime, audioPath, manualTranscript, durationSec } = body;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    // 1) 取得 transcript（若沒給 manual）
    let transcript = (manualTranscript || "").trim();
    if (!transcript) {
      if (audioBase64) {
        // 用 OpenAI ASR（gpt-4o-mini-transcribe）
        const audio = {
          data: audioBase64,
          mime: mime || "audio/webm",
        };
        const asr = await openai.audio.transcriptions.create({
          model: ASR_MODEL,
          file: { name: `rec.${(audio.mime.split("/")[1] || "webm")}`, data: Buffer.from(audio.data, "base64") } as any
        } as any);
        transcript = (asr?.text || "").trim();
      } else if (audioPath) {
        // dev: 本機路徑給 Python baseline 取得 features +（可選）textgrid/轉寫
        // 這段如果你已有本機 features，就直接沿用；這裡保持 transcript 可能仍為空
        transcript = "";
      }
    }

    // 2) 內容面（LLM）——維持你的原流程；這裡做一個簡化
    const llm = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: "You are an IELTS Speaking examiner assistant. Score content, grammar, vocabulary." },
        { role: "user", content: `Prompt:\n${prompt || "(no prompt)"}\n\nTranscript:\n${transcript || "(empty)"}\n\nRate briefly.` },
      ],
    });

    // 簡化：把 overall_01 略估（實務上你已用本機 features + quantile）
    const overall01 = Math.min(1, Math.max(0, (transcript || "").split(/\s+/).length / 120)); // placeholder
    await loadCalibration();
    const overallBand = applyQuantileMap01ToBand(overall01);

    const result = {
      band: {
        overall: overallBand,
        content: 0.2,
        grammar: 0.3,
        vocab: 0.4,
        // 若你從本機拿到：
        fluency: null,
        pronunciation: null,
      },
      speakingFeatures: {},
      feedback: (llm.output_text || "").trim(),
      tokensUsed: (llm.usage?.total_tokens as number) || undefined,
      debug: {
        overall_01: overall01,
        calibration_mode: quantileMap ? "quantile" : "linear",
        used_local: false,
        used_llm: true,
        asr_model: ASR_MODEL,
      },
    };

    // ✅ 自動寫入歷史（關鍵新增）
    try {
      await saveScore("speaking", {
        taskId,
        prompt,
        durationSec: typeof durationSec === "number" ? durationSec : undefined,
        band: {
          overall: result.band.overall,
          content: result.band.content,
          speech: result.band.overall, // 你也可改成來自本機的 speech 面分數
          fluency: result.band.fluency,
          pronunciation: result.band.pronunciation,
          grammar: result.band.grammar,
          vocab: result.band.vocab,
        },
        ts: Date.now(),
      });
    } catch (e) {
      console.error("[speaking] saveScore failed:", e);
    }

    return NextResponse.json({ ok: true, data: result, requestId: rid });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: { code: "bad_request", message: e?.message || "Invalid request" }, requestId: rid },
      { status: 400 }
    );
  }
}