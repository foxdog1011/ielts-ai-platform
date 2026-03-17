import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "node:querystring";

export async function GET() {
  const key = process.env.OPENAI_API_KEY;
  // Dynamic access to bypass webpack inlining
  const keyDynamic = (process.env as Record<string, string | undefined>)["OPENAI_API_KEY"];
  const cwd = process.cwd();

  // Check what .env files actually exist relative to cwd
  const envFiles = [".env.local", ".env", "apps/web/.env.local"].map((f) => {
    const abs = path.resolve(cwd, f);
    return { file: f, abs, exists: fs.existsSync(abs) };
  });

  // Read .env.local raw to detect BOM / encoding issues
  const envLocalPath = path.resolve(cwd, ".env.local");
  let rawHex: string | null = null;
  let firstLineDecoded: string | null = null;
  let manualParsedKey: string | null = null;
  try {
    const buf = fs.readFileSync(envLocalPath);
    rawHex = buf.slice(0, 20).toString("hex");
    const text = buf.toString("utf8");
    firstLineDecoded = text.split("\n")[0].slice(0, 30);
    // Manual dotenv parse
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("OPENAI_API_KEY=")) {
        manualParsedKey = trimmed.slice("OPENAI_API_KEY=".length, "OPENAI_API_KEY=".length + 10);
      }
    }
  } catch {
    rawHex = "read-error";
  }

  return NextResponse.json({
    hasKey: !!key,
    hasKeyDynamic: !!keyDynamic,
    prefixDynamic: keyDynamic?.slice(0, 10) ?? null,
    prefix: key?.slice(0, 10) ?? null,
    model: process.env.OPENAI_MODEL ?? null,
    asr: process.env.ASR_MODEL ?? null,
    cwd,
    envFiles,
    nodeEnv: process.env.NODE_ENV,
    rawHex,
    firstLineDecoded,
    manualParsedKey,
    // All env keys containing OPENAI (case-insensitive)
    openaiKeys: Object.keys(process.env).filter(k => k.toLowerCase().includes("openai")),
    // Total env key count
    totalEnvKeys: Object.keys(process.env).length,
  });
}
