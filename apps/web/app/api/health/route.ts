import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  const ML_CWD = process.env.ML_CWD || "";
  const PYTHON_BIN = process.env.PYTHON_BIN || "";
  const ALLOWED = (process.env.ALLOWED_AUDIO_ROOTS || ML_CWD).split(",").map(s=>s.trim()).filter(Boolean);
  const ASR_MODEL = process.env.ASR_MODEL || "gpt-4o-mini-transcribe";
  const scoreCli = ML_CWD ? path.join(ML_CWD, "src", "score_cli.py") : "";
  const calibration = path.join(process.cwd(), "public", "calibration", "quantile_map.json");

  return NextResponse.json({
    ok: true,
    data: {
      env: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "set" : "missing",
        OPENAI_MODEL: process.env.OPENAI_MODEL || "default",
        ASR_MODEL,
        ML_CWD,
        PYTHON_BIN,
        ALLOWED_AUDIO_ROOTS: ALLOWED,
      },
      files: {
        score_cli_py: { path: scoreCli, exists: !!scoreCli && fs.existsSync(scoreCli) },
        calibration: { path: calibration, exists: fs.existsSync(calibration) },
      },
    },
  });
}
