// apps/web/app/api/health/route.ts
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET() {
  const env = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "set" : "",
    OPENAI_MODEL: process.env.OPENAI_MODEL || "",
    ASR_MODEL: process.env.ASR_MODEL || "",
    ML_CWD: process.env.ML_CWD || "",
    PYTHON_BIN: process.env.PYTHON_BIN || "",
    ALLOWED_AUDIO_ROOTS: (process.env.ALLOWED_AUDIO_ROOTS || "")
      .split(/[,:]/).map(s => s.trim()).filter(Boolean),
  };

  const scorePath = env.ML_CWD ? path.join(env.ML_CWD, "src", "score_cli.py") : "";
  let exists = false;
  let statError: string | null = null;

  if (scorePath) {
    try {
      exists = fs.existsSync(scorePath);
      if (exists) fs.statSync(scorePath); // 進一步確認可讀
    } catch (e: any) {
      exists = false;
      statError = e?.message || String(e);
    }
  }

  // quantile map
  const qPath = path.join(process.cwd(), "public", "calibration", "quantile_map.json");
  const qExists = fs.existsSync(qPath);

  // KV 檢查
  const hasUrl = !!process.env.KV_REST_API_URL;
  const hasToken = !!process.env.KV_REST_API_TOKEN;

  return NextResponse.json({
    ok: true,
    data: {
      env,
      kv: {
        provider: hasUrl && hasToken ? "vercel-kv" : "memory",
        hasUrl,
        hasToken,
        ok: true,
      },
      files: {
        score_cli_py: { path: scorePath, exists, statError },
        calibration: { path: qPath, exists: qExists },
      },
    },
  });
}
