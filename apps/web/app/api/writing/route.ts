import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import OpenAI from "openai";
import { saveScore } from "@/lib/kv";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const TEMPERATURE = +(process.env.TEMPERATURE || 0.2);
const ML_CWD = process.env.ML_CWD || process.cwd();
const CALI_PATH =
  process.env.CALIBRATION_PATH ||
  path.join(process.cwd(), "public", "calibration", "quantile_map.json");
const PY_BIN = process.env.PYTHON_BIN || "python3";

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

function runPythonContent({ text }: { text: string }) {
  return new Promise<{ ok: boolean; json?: any; err?: string }>((resolve) => {
    const args = ["src/score_cli.py", "--text", text];
    const py = spawn(PY_BIN, args, { cwd: ML_CWD, env: { ...process.env, PYTHONUNBUFFERED: "1" } });
    let out = "", err = "";
    py.stdout.on("data", d => out += d.toString());
    py.stderr.on("data", d => err += d.toString());
    py.on("close", code => {
      if (code === 0) { try { resolve({ ok: true, json: JSON.parse(out) }); } catch (e: any) { resolve({ ok: false, err: "Invalid JSON: "+e?.message }); } }
      else { console.error("[PY-ERR writing]", err); resolve({ ok: false, err: err || `python exited ${code}` }); }
    });
  });
}

async function scoreWritingLLM(promptText: string, essay: string) {
  const messages: any[] = [
    { role: "system", content: "You are an IELTS Writing Task 2 examiner. Score taskResponse, coherence, lexical, grammar in 0..1, and overall_text in 0..1; suggest band_text in {4.0..9.0 step 0.5}. Also return paragraphFeedback (index/comment), improvements[], and a concise rewritten intro. Return via the function only." },
    { role: "user", content: `Prompt:\n${promptText}\n\nEssay:\n${essay}` },
  ];
  const tools: any[] = [{
    type: "function",
    function: {
      name: "return_writing_scores",
      description: "Return scores for IELTS Writing Task 2.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          taskResponse:  { type: "number", minimum: 0, maximum: 1 },
          coherence:     { type: "number", minimum: 0, maximum: 1 },
          lexical:       { type: "number", minimum: 0, maximum: 1 },
          grammar:       { type: "number", minimum: 0, maximum: 1 },
          overall_text:  { type: "number", minimum: 0, maximum: 1 },
          band_text:     { type: "number", enum: [4.0,4.5,5.0,5.5,6.0,6.5,7.0,7.5,8.0,8.5,9.0] },
          paragraphFeedback: {
            type: "array",
            items: { type: "object", properties: { index: { type: "number" }, comment: { type: "string" } } }
          },
          improvements:  { type: "array", items: { type: "string" } },
          rewritten:     { type: "string" },
        },
        required: ["taskResponse","coherence","lexical","grammar","overall_text","band_text"]
      }
    }
  }];

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: TEMPERATURE,
    messages, tools,
    tool_choice: { type: "function", function: { name: "return_writing_scores" } },
  });

  const m: any = completion.choices[0].message;
  const call = m.tool_calls?.[0];
  const usage = (completion as any).usage;
  if (call?.function?.arguments) return { ...JSON.parse(call.function.arguments), tokensUsed: usage?.total_tokens };
  try { return { ...(m.content ? JSON.parse(m.content as string) : {}), tokensUsed: usage?.total_tokens }; }
  catch { throw new Error("LLM did not return structured output."); }
}

function fuseWriting(llm: any, py: any) {
  const tr = Number(llm?.taskResponse);
  const coh = Number(llm?.coherence);
  const lex = Number(llm?.lexical);
  const gra = Number(llm?.grammar);
  const overall_text = Number(llm?.overall_text);
  const content01 = Number(py?.subscores_01?.content);
  const textProxy = Number.isFinite(overall_text)
    ? overall_text
    : [tr,coh,lex,gra].every(Number.isFinite) ? (0.35*tr + 0.25*coh + 0.2*lex + 0.2*gra) : NaN;

  let parts: number[] = [], wts: number[] = [];
  if (Number.isFinite(textProxy)) { parts.push(textProxy); wts.push(0.6); }
  if (Number.isFinite(content01)) { parts.push(content01); wts.push(0.4); }

  const overall01 = parts.length ? parts.reduce((s,v,i)=>s+v*wts[i],0)/wts.reduce((a,b)=>a+b,0) : (Number.isFinite(textProxy)?textProxy:0);

  return {
    overall_01: Math.max(0, Math.min(1, overall01)),
    subscores_01: {
      taskResponse: Number.isFinite(tr) ? tr : null,
      coherence:    Number.isFinite(coh)? coh: null,
      lexical:      Number.isFinite(lex)? lex: null,
      grammar:      Number.isFinite(gra)? gra: null,
      content:      Number.isFinite(content01)? content01: null,
    },
    paragraphFeedback: Array.isArray(llm?.paragraphFeedback) ? llm.paragraphFeedback : [],
    improvements: Array.isArray(llm?.improvements) ? llm.improvements : [],
    rewritten: typeof llm?.rewritten === "string" ? llm.rewritten : "",
    tokensUsed: llm?.tokensUsed,
  };
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { taskId, prompt, essay } = await req.json();

    let pyOut: any = null; let pyErr: string | null = null;
    if (essay) {
      const r = await runPythonContent({ text: essay });
      pyOut = r.ok ? r.json : null;
      pyErr = r.ok ? null : (r.err || null);
    }

    const llm = await scoreWritingLLM(String(prompt || ""), String(essay || ""));
    const fused = fuseWriting(llm, pyOut);
    const curve = loadCurve();
    const band = calibrateBand(fused.overall_01, curve);

    const data = {
      band: {
        overall: band,
        taskResponse: fused.subscores_01.taskResponse,
        coherence:    fused.subscores_01.coherence,
        lexical:      fused.subscores_01.lexical,
        grammar:      fused.subscores_01.grammar,
      },
      paragraphFeedback: fused.paragraphFeedback,
      improvements: fused.improvements,
      rewritten: fused.rewritten,
      tokensUsed: fused.tokensUsed,
      debug: {
        overall_01: fused.overall_01,
        calibration_mode: curve.mode,
        used_local: !!pyOut,
        used_llm: true,
        local_err: pyErr,
      },
    };

    try {
      await saveScore("writing", { taskId: taskId || "task-2", band: data.band });
    } catch (e) {
      console.warn("[KV save writing] fail:", (e as any)?.message || e);
    }

    return NextResponse.json({ ok: true, data, requestId }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: { code: "SERVER_ERROR", message: String(err?.message || err) }, requestId }, { status: 500 });
  }
}
