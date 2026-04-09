import { NextResponse } from "next/server";

export async function GET() {
  const mlServiceUrl = process.env.ML_SERVICE_URL || "";

  if (!mlServiceUrl) {
    return NextResponse.json({
      ok: true,
      mlOnline: false,
      mode: "llm-only",
      reason: "ML_SERVICE_URL not set",
    });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);

    const response = await fetch(`${mlServiceUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return NextResponse.json({
        ok: true,
        mlOnline: false,
        mode: "llm-only",
        reason: `ML service returned ${response.status}`,
      });
    }

    const data = await response.json();
    return NextResponse.json({
      ok: true,
      mlOnline: true,
      mode: "hybrid",
      modelLoaded: data.model_loaded ?? false,
      reason: null,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({
      ok: true,
      mlOnline: false,
      mode: "llm-only",
      reason: `ML service unreachable: ${msg}`,
    });
  }
}
