import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import OpenAI from "openai";
import { saveScore } from "@/lib/kv";

export const runtime = "nodejs";

// ====== ENV ======
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const TEMPERATURE = +(process.env.TEMPERATURE || 0.2);
const ASR_MODEL = process.env.ASR_MODEL || "gpt-4o-mini-transcribe"; // 退而用 whisper-1
const ML_CWD = process.env.ML_CWD || process.cwd();
const CALI_PATH =
  process.env.CALIBRATION_PATH ||
  path.join(process.cwd(), "public", "calibration", "quantile_map.json");
const PY_BIN = process.env.PYTHON_BIN || "python3";
const ALLOWED_AUDIO_ROOTS = (process.env.ALLOWED_AUDIO_ROOTS || ML_CWD).split(",").map(s=>s.trim()).filter(Boolean);

// ====== 校準 ======
type Curve = { overall01: number[]; band: number[]; mode: string };
function loadCurve(): Curve {
  const raw = fs.readFileSync(CALI_PATH, "utf-8");
  return JSON.parse(raw);
}
function calibrateBand(overall01: number, curve: Curve): number {
  const x = Math.max(0, Math.min(1, Number.isFinite(overall01) ? overall01 : 0));
  const xs = curve.overall01, ys = curve.band;
  let i = 0, j = xs.length - 1;
  while (i + 1 < j) { const m = (i + j) >> 1; (xs[m] <= x ? i = m : j = m); }
  const t = (x - xs[i]) / Math.max(1e-9, xs[j] - xs[i]);
  const y = ys[i] + t * (ys[j] - ys[i]);
  return Math.round(y * 2) / 2;
}

// ====== 安全路徑 ======
function resolveAllowed(p: string) {
  const real = fs.realpathSync(p);
  for (const root of ALLOWED_AUDIO_ROOTS) {
    const r = fs.realpathSync(root);
    if (real.startsWith(r + path.sep) || real === r) return real;
  }
  throw new Error("Audio path not allowed");
}

// ====== Python baseline ======
function runPythonScore({ audioPath, transcript }: { audioPath: string; transcript?: string; }) {
  return new Promise<{ ok: boolean; json?: any; err?: string }>((resolve) => {
    const args = ["src/score_cli.py", "--audio", audioPath];
    if (transcript) args.push("--transcript", transcript);
    const py = spawn(PY_BIN, args, { cwd: ML_CWD, env: { ...process.env, PYTHONUNBUFFERED: "1" } });
    let out = "", err = "";
    py.stdout.on("data", d => out += d.toString());
    py.stderr.on("data", d => err += d.toString());
    py.on("close", code => {
      if (code === 0) { try { resolve({ ok: true, json: JSON.parse(out) }); } catch (e: any) { resolve({ ok: false, err: "Invalid JSON: "+e?.message }); } }
      else { console.error("[PY-ERR speaking]", err); resolve({ ok: false, err: err || `python exited ${code}` }); }
    });
  });
}

// ====== LLM 文字面 ======
async function scoreSpeakingTextLLM(transcript: string, promptText?: string) {
  const messages: any[] = [
    { role: "system", content: "You are an IELTS Speaking examiner. Based on transcript only (no audio), score content/grammar/vocab and overall_text in 0..1, and suggest band_text from {4.0..9.0 step 0.5}. Return ONLY via the function." },
    { role: "user", content: `${promptText ? `Prompt:\n${promptText}\n\n` : ""}Transcript:\n${transcript}` },
  ];
  const tools: any[] = [{
    type: "function",
    function: {
      name: "return_speaking_text_scores",
      description: "Return text-side scores for IELTS Speaking.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          content:      { type: "number", minimum: 0, maximum: 1 },
          grammar:      { type: "number", minimum: 0, maximum: 1 },
          vocab:        { type: "number", minimum: 0, maximum: 1 },
          overall_text: { type: "number", minimum: 0, maximum: 1 },
          band_text:    { type: "number", enum: [4.0,4.5,5.0,5.5,6.0,6.5,7.0,7.5,8.0,8.5,9.0] },
          feedback:     { type: "string" },
        },
        required: ["content","grammar","vocab","overall_text","band_text"]
      }
    }
  }];

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: TEMPERATURE,
    messages, tools,
    tool_choice: { type: "function", function: { name: "return_speaking_text_scores" } },
  });
  const m: any = completion.choices[0].message;
  const call = m.tool_calls?.[0];
  const usage = (completion as any).usage;
  if (call?.function?.arguments) return { ...JSON.parse(call.function.arguments), tokensUsed: usage?.total_tokens };
  try { return { ...(m.content ? JSON.parse(m.content as string) : {}), tokensUsed: usage?.total_tokens }; }
  catch { throw new Error("LLM did not return structured output."); }
}

// ====== ASR（無 transcript 才跑）=====
async function transcribeIfNeeded(audioPath: string, transcript?: string) {
  if (transcript && transcript.trim()) return transcript;
  try {
    const model = ASR_MODEL || "gpt-4o-mini-transcribe";
    const file = fs.createReadStream(audioPath);
    const r = await openai.audio.transcriptions.create({ file, model }); // 支援 gpt-4o-mini-transcribe / whisper-1
    // @ts-ignore
    return (r as any).text || (r as any).transcript || "";
  } catch (e) {
    console.warn("[ASR] failed:", (e as any)?.message || e);
    // 退而用 whisper-1
    try {
      const file = fs.createReadStream(audioPath);
      const r2 = await openai.audio.transcriptions.create({ file, model: "whisper-1" });
      // @ts-ignore
      return (r2 as any).text || (r2 as any).transcript || "";
    } catch { return ""; }
  }
}

// ====== 融合 ======
function fuseSpeaking(llm: any, py: any) {
  const textOverall = Number(llm?.overall_text);
  const textContent = Number(llm?.content);
  const textGrammar = Number(llm?.grammar);
  const textVocab   = Number(llm?.vocab);
  const flu = Number(py?.subscores_01?.fluency);
  const pro = Number(py?.subscores_01?.pronunciation);

  const textProxy =
    Number.isFinite(textOverall)
      ? textOverall
      : [textContent, textGrammar, textVocab].every(Number.isFinite)
        ? 0.5*textContent + 0.25*textGrammar + 0.25*textVocab
        : NaN;

  const parts: number[] = []; const wts: number[] = [];
  if (Number.isFinite(textProxy)) { parts.push(textProxy); wts.push(0.5); }
  if (Number.isFinite(flu))       { parts.push(flu);      wts.push(0.3); }
  if (Number.isFinite(pro))       { parts.push(pro);      wts.push(0.2); }

  const overall01 = parts.length ? parts.reduce((s,v,i)=>s+v*wts[i],0)/wts.reduce((a,b)=>a+b,0) : 0;

  return {
    overall_01: Math.max(0, Math.min(1, overall01)),
    subscores_01: {
      content: Number.isFinite(textContent) ? textContent : null,
      grammar: Number.isFinite(textGrammar) ? textGrammar : null,
      vocab:   Number.isFinite(textVocab)   ? textVocab   : null,
      fluency: Number.isFinite(flu)         ? flu         : null,
      pronunciation: Number.isFinite(pro)   ? pro         : null,
    },
    speaking_features: py?.speaking_features ?? {},
    feedback: llm?.feedback ?? "",
    tokensUsed: llm?.tokensUsed,
  };
}

// ====== Handler ======
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { audioBase64, audioPath, transcript: t0, prompt, taskId } = await req.json();

    // 1) 決定 wavPath（僅允許白名單目錄）
    let wavPath = (audioPath as string | undefined)?.trim();
    if (wavPath) wavPath = resolveAllowed(wavPath);

    if (!wavPath && audioBase64) {
      const m = (audioBase64 as string).match(/^data:audio\/\w+;base64,(.+)$/);
      if (!m) return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "Invalid audioBase64" }, requestId }, { status: 400 });
      const buf = Buffer.from(m[1], "base64");
      const tmp = path.join("/tmp", `upload-${Date.now()}.wav`);
      fs.writeFileSync(tmp, buf);
      wavPath = tmp;
    }
    if (!wavPath && !t0) {
      return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "Provide audioPath or transcript" }, requestId }, { status: 400 });
    }

    // 2) ASR（若缺 transcript）
    const transcript = await transcribeIfNeeded(wavPath!, t0);

    // 3) 本地 baseline（語音）
    let pyOut: any = null; let pyErr: string | null = null;
    if (wavPath) {
      const r = await runPythonScore({ audioPath: wavPath, transcript });
      pyOut = r.ok ? r.json : null;
      pyErr = r.ok ? null : (r.err || null);
    }

    // 4) LLM（文字）
    let llm: any = null;
    if (transcript) {
      llm = await scoreSpeakingTextLLM(transcript, prompt);
    }

    // 5) 融合 + 校準
    const fused = fuseSpeaking(llm, pyOut);
    const curve = loadCurve();
    const band = calibrateBand(fused.overall_01, curve);

    const data = {
      band: {
        overall: band,
        content: fused.subscores_01.content,
        grammar: fused.subscores_01.grammar,
        vocab:   fused.subscores_01.vocab,
        fluency: fused.subscores_01.fluency,
        pronunciation: fused.subscores_01.pronunciation,
      },
      speakingFeatures: fused.speaking_features,
      feedback: fused.feedback,
      tokensUsed: fused.tokensUsed,
      debug: {
        overall_01: fused.overall_01,
        calibration_mode: curve.mode,
        used_local: !!pyOut,
        used_llm: !!llm,
        local_err: pyErr,
        ml_cwd: ML_CWD,
        py_bin: PY_BIN,
        asr_model: ASR_MODEL,
      },
    };

    // 6) 寫入 KV（歷史）
    try {
      await saveScore("speaking", {
        taskId: taskId || "speaking",
        band: data.band,
        speakingFeatures: data.speakingFeatures,
      });
    } catch (e) {
      console.warn("[KV save speaking] fail:", (e as any)?.message || e);
    }

    return NextResponse.json({ ok: true, data, requestId }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: { code: "SERVER_ERROR", message: String(err?.message || err) }, requestId }, { status: 500 });
  }
}
