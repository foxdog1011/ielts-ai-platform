import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import path from "node:path";

export async function GET() {
  const mlCwd = process.env.ML_CWD || "";
  const pythonBin = process.env.PYTHON_BIN || "";

  if (!mlCwd || !pythonBin) {
    return NextResponse.json({
      ok: true,
      mlOnline: false,
      mode: "llm-only",
      reason: "ML_CWD or PYTHON_BIN not set",
    });
  }

  const scriptPath = path.join(mlCwd, "src", "score_cli.py");
  if (!existsSync(scriptPath)) {
    return NextResponse.json({
      ok: true,
      mlOnline: false,
      mode: "llm-only",
      reason: "score_cli.py not found",
    });
  }

  return NextResponse.json({
    ok: true,
    mlOnline: true,
    mode: "hybrid",
    reason: null,
  });
}
